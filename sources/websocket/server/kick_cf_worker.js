const PUBLIC_KEY_ENDPOINT = 'https://api.kick.com/public/v1/public-key';
const KICK_TOKEN_ENDPOINT = 'https://id.kick.com/oauth/token';

const encoder = new TextEncoder();
const sseClients = new Set();

let kickPublicKeyPem = null;
let kickPublicKeyKey = null;
let kickPublicKeyPromise = null;

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      console.error('[kick-bridge] request error:', err?.message || err);
      return new Response('internal error', {
        status: 500,
        headers: corsHeaders(env, { 'Content-Type': 'text/plain' })
      });
    }
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  if (url.pathname === '/events' && request.method === 'GET') {
    return handleEvents(request, env);
  }

  if (url.pathname === '/webhook' && request.method === 'POST') {
    return handleWebhook(request, env);
  }

  if (url.pathname === '/kick/callback' && (request.method === 'GET' || request.method === 'POST')) {
    return handleKickCallback(request, env, url);
  }

  if (url.pathname === '/kick/token' && request.method === 'POST') {
    return handleKickTokenRequest(request, env);
  }

  return new Response('not found', { status: 404, headers: corsHeaders(env) });
}

function corsHeaders(env, extra = {}) {
  return Object.assign({
    'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,Kick-Event-Type,Kick-Event-Message-Id,Kick-Event-Message-Timestamp,Kick-Signature',
    'Access-Control-Expose-Headers': 'Content-Type'
  }, extra);
}

function getKickConfig(env) {
  return {
    clientId: env.KICK_CLIENT_ID || '01K7MXFQ9C39VAQ50DCQ2DXSDJ',
    clientSecret: env.KICK_CLIENT_SECRET || 'XXXXXXXXXXXXXXXXXXXXX',
    redirectUri: env.KICK_REDIRECT_URI || 'https://socialstream.ninja/beta/sources/websocket/kick.html',
    verifySignature: env.SKIP_SIGNATURE === '1' ? false : true
  };
}

function bodyOrQuery(url, body, key) {
  if (body && Object.prototype.hasOwnProperty.call(body, key)) {
    return body[key];
  }
  return url.searchParams.get(key);
}

async function handleEvents(request, env) {
  let clientRef = null;
  let abortHandler = null;
  let closed = false;

  function cleanup(controller) {
    if (closed) {
      return;
    }
    closed = true;

    if (abortHandler && request?.signal?.removeEventListener) {
      try {
        request.signal.removeEventListener('abort', abortHandler);
      } catch (_) {
        // ignore
      }
    }

    const target = controller || (clientRef ? clientRef.controller : null);
    if (clientRef) {
      sseClients.delete(clientRef);
      clientRef = null;
    }
    if (target) {
      try {
        target.close();
      } catch (_) {
        // noop
      }
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      clientRef = { controller };
      sseClients.add(clientRef);
      controller.enqueue(encoder.encode('\n'));
      if (request?.signal?.addEventListener) {
        abortHandler = () => cleanup(controller);
        request.signal.addEventListener('abort', abortHandler, { once: true });
      }
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'X-Accel-Buffering': 'no'
    }
  });
}

async function handleWebhook(request, env) {
  const rawBody = await request.text();
  let body = {};

  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch (err) {
      console.error('[kick-bridge] invalid json body', err);
      return new Response('invalid json', { status: 400, headers: corsHeaders(env) });
    }
  }

  const headers = request.headers;
  const type = headers.get('kick-event-type') || body?.type || null;
  const challenge = body?.challenge ?? body?.data?.challenge ?? null;

  const { verifySignature } = getKickConfig(env);
  let verified = true;
  const signature = headers.get('kick-signature');
  const shouldVerify = verifySignature && !challenge;

  if (shouldVerify) {
    if (signature) {
      try {
        verified = await verifyKickSignature(headers, rawBody);
      } catch (err) {
        console.error('[kick-bridge] signature verification error', err);
        verified = false;
      }
    } else {
      verified = false;
    }
  }

  const event = {
    type,
    messageId: headers.get('kick-event-message-id') || null,
    timestamp: headers.get('kick-event-message-timestamp') || null,
    version: headers.get('kick-event-version') || null,
    verified: challenge ? true : verified,
    challenge: challenge || undefined,
    body
  };

  broadcast(event);

  if (challenge) {
    return new Response(challenge, {
      status: 200,
      headers: corsHeaders(env, { 'Content-Type': 'text/plain' })
    });
  }

  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: corsHeaders(env, { 'Content-Type': 'application/json' })
  });
}

async function handleKickCallback(request, env, url) {
  let payload = null;

  if (request.method === 'POST') {
    try {
      payload = await parseRequestBody(request);
    } catch (_) {
      return new Response(JSON.stringify({ error: 'invalid_json', message: 'Request body must be valid JSON.' }), {
        status: 400,
        headers: corsHeaders(env, { 'Content-Type': 'application/json' })
      });
    }
  }

  const config = getKickConfig(env);
  const code = bodyOrQuery(url, payload, 'code');
  const verifier = bodyOrQuery(url, payload, 'code_verifier');
  const redirectUri = bodyOrQuery(url, payload, 'redirect_uri') || config.redirectUri;

  if (!code) {
    return new Response(JSON.stringify({ error: 'missing_code', message: 'Kick did not return an authorization code.' }), {
      status: 400,
      headers: corsHeaders(env, { 'Content-Type': 'application/json' })
    });
  }

  if (!verifier) {
    return new Response(JSON.stringify({ error: 'missing_verifier', message: 'PKCE code verifier is required.' }), {
      status: 400,
      headers: corsHeaders(env, { 'Content-Type': 'application/json' })
    });
  }

  if (!config.clientId || !config.clientSecret) {
    return new Response(JSON.stringify({ error: 'oauth_not_configured', message: 'Kick OAuth client credentials are not set.' }), {
      status: 500,
      headers: corsHeaders(env, { 'Content-Type': 'application/json' })
    });
  }

  try {
    const result = await exchangeKickAuthorizationCode(config, code, verifier, redirectUri);
    return new Response(result.body || '{}', {
      status: result.statusCode,
      headers: corsHeaders(env, { 'Content-Type': 'application/json' })
    });
  } catch (err) {
    console.error('[kick-bridge] kick callback error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'oauth_exchange_failed', message: 'Failed to exchange authorization code with Kick.' }), {
      status: 500,
      headers: corsHeaders(env, { 'Content-Type': 'application/json' })
    });
  }
}

async function handleKickTokenRequest(request, env) {
  let payload = {};
  try {
    payload = (await parseRequestBody(request)) || {};
  } catch (_) {
    return new Response(JSON.stringify({ error: 'invalid_json', message: 'Request body must be valid JSON.' }), {
      status: 400,
      headers: corsHeaders(env, { 'Content-Type': 'application/json' })
    });
  }

  const config = getKickConfig(env);
  if (!config.clientId || !config.clientSecret) {
    return new Response(JSON.stringify({ error: 'oauth_not_configured', message: 'Kick OAuth client credentials are not set.' }), {
      status: 500,
      headers: corsHeaders(env, { 'Content-Type': 'application/json' })
    });
  }

  const grantType = payload?.grant_type;
  if (grantType !== 'refresh_token') {
    return new Response(JSON.stringify({ error: 'unsupported_grant_type', message: 'Only refresh_token grant is supported.' }), {
      status: 400,
      headers: corsHeaders(env, { 'Content-Type': 'application/json' })
    });
  }

  if (!payload.refresh_token) {
    return new Response(JSON.stringify({ error: 'missing_refresh_token', message: 'refresh_token is required for this grant type.' }), {
      status: 400,
      headers: corsHeaders(env, { 'Content-Type': 'application/json' })
    });
  }

  try {
    const result = await exchangeKickRefreshToken(config, payload.refresh_token);
    return new Response(result.body || '{}', {
      status: result.statusCode,
      headers: corsHeaders(env, { 'Content-Type': 'application/json' })
    });
  } catch (err) {
    console.error('[kick-bridge] kick token error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'token_request_failed', message: 'Kick token request failed.' }), {
      status: 500,
      headers: corsHeaders(env, { 'Content-Type': 'application/json' })
    });
  }
}

async function parseRequestBody(request) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  const raw = await request.text();
  if (!raw) {
    return null;
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(raw);
    const result = {};
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    return result;
  }
  return JSON.parse(raw);
}

async function exchangeKickAuthorizationCode(config, code, verifier, redirectUri) {
  return requestKickToken({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier
  });
}

async function exchangeKickRefreshToken(config, refreshToken) {
  return requestKickToken({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken
  });
}

async function requestKickToken(payload) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }

  const response = await fetch(KICK_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const body = await response.text();
  return { statusCode: response.status || 500, body };
}

async function verifyKickSignature(headers, rawBody) {
  await ensurePublicKey();
  const messageId = headers.get('kick-event-message-id');
  const timestamp = headers.get('kick-event-message-timestamp');
  const signature = headers.get('kick-signature');

  if (!messageId || !timestamp || !signature) {
    return false;
  }

  const payload = encoder.encode(`${messageId}.${timestamp}.${rawBody}`);
  const signatureBytes = base64ToUint8Array(signature);

  return crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    kickPublicKeyKey,
    signatureBytes,
    payload
  );
}

function broadcast(data) {
  const serialized = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  for (const client of sseClients) {
    try {
      client.controller.enqueue(serialized);
    } catch (_) {
      sseClients.delete(client);
      try { client.controller.close(); } catch (_) {}
    }
  }
}

async function ensurePublicKey() {
  if (kickPublicKeyKey) {
    return kickPublicKeyKey;
  }

  if (!kickPublicKeyPromise) {
    kickPublicKeyPromise = (async () => {
      const response = await fetch(PUBLIC_KEY_ENDPOINT, { cf: { cacheTtl: 300, cacheEverything: true } });
      if (!response.ok) {
        throw new Error(`Kick public key fetch failed: ${response.status}`);
      }
      kickPublicKeyPem = (await response.text()).trim();
      const keyData = pemToArrayBuffer(kickPublicKeyPem);
      kickPublicKeyKey = await crypto.subtle.importKey(
        'spki',
        keyData,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      console.log('[kick-bridge] downloaded Kick public key');
      return kickPublicKeyKey;
    })().catch(err => {
      kickPublicKeyPromise = null;
      kickPublicKeyKey = null;
      throw err;
    });
  }

  return kickPublicKeyPromise;
}

function base64ToUint8Array(input) {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function pemToArrayBuffer(pem) {
  const cleaned = pem.replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  return base64ToUint8Array(cleaned).buffer;
}
