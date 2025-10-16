#!/usr/bin/env node
/**
 * Kick Webhook Bridge
 * -------------------
 * Lightweight Node server that accepts Kick webhook POSTs and exposes them as
 * a server-sent events (SSE) stream. Deploy this behind HTTPS (or tunnel) and
 * configure your Kick developer app webhook URL to point at `${HOST}/webhook`.
 * The Social Stream Kick websocket source connects to `${HOST}/events`.
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_KEY_ENDPOINT = 'https://api.kick.com/public/v1/public-key';
const VERIFY_SIGNATURE = process.env.SKIP_SIGNATURE === '1' ? false : true;
const ALLOWED_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const TLS_CERT_PATH= "/etc/letsencrypt/live/kick.socialstream.ninja/fullchain.pem";
const TLS_KEY_PATH= "/etc/letsencrypt/live/kick.socialstream.ninja/privkey.pem";
const TLS_CA_PATH = process.env.TLS_CA_PATH || null;
const TLS_RELOAD_INTERVAL_MS = Number(process.env.TLS_RELOAD_INTERVAL_MS || 12 * 60 * 60 * 1000); // 12 hours

// Hard-coded Kick OAuth client credentials. Update these with your actual values.
const KICK_CLIENT_ID = '01K7MXFQ9C39VAQ50DCQ2DXSDJ';
const KICK_CLIENT_SECRET = 'f1eca0aa5bdf2e2c5d0c70330f2dc8c8b6c4d305c63df06de76e57fc3a96e73a';
const KICK_REDIRECT_URI =
    process.env.KICK_REDIRECT_URI || 'https://socialstream.ninja/beta/sources/websocket/kick.html';

let kickPublicKeyPem = null;
let clients = new Set();

function fetchKickPublicKey() {
    return new Promise((resolve, reject) => {
        const req = https.get(PUBLIC_KEY_ENDPOINT, res => {
            if (res.statusCode !== 200) {
                reject(new Error(`Kick public key fetch failed: ${res.statusCode}`));
                res.resume();
                return;
            }
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
    });
}

async function ensurePublicKey() {
    if (!VERIFY_SIGNATURE) return;
    if (kickPublicKeyPem) return;
    kickPublicKeyPem = await fetchKickPublicKey();
    console.log('[kick-bridge] Downloaded Kick public key');
}

async function verifySignature(headers, rawBody) {
    if (!VERIFY_SIGNATURE) return true;
    await ensurePublicKey();
    const messageId = headers['kick-event-message-id'];
    const timestamp = headers['kick-event-message-timestamp'];
    const signature = headers['kick-signature'];
    if (!messageId || !timestamp || !signature) {
        return false;
    }
    const payload = Buffer.from(`${messageId}.${timestamp}.${rawBody}`);
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(payload);
    const decodedSig = Buffer.from(signature, 'base64');
    return verifier.verify(kickPublicKeyPem, decodedSig);
}

function writeSse(client, data) {
    try {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
        clients.delete(client);
        try { client.end(); } catch (_) {}
    }
}

function broadcast(data) {
    for (const client of clients) {
        writeSse(client, data);
    }
}

function requestKickToken(payload) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams();
        Object.entries(payload).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
        const body = params.toString();
        const options = {
            hostname: 'id.kick.com',
            path: '/oauth/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const request = https.request(options, response => {
            let responseBody = '';
            response.setEncoding('utf8');
            response.on('data', chunk => responseBody += chunk);
            response.on('end', () => {
                resolve({
                    statusCode: response.statusCode || 500,
                    body: responseBody
                });
            });
        });

        request.on('error', reject);
        request.write(body);
        request.end();
    });
}

function exchangeKickAuthorizationCode(code, verifier, redirectUri) {
    return requestKickToken({
        grant_type: 'authorization_code',
        client_id: KICK_CLIENT_ID,
        client_secret: KICK_CLIENT_SECRET,
        redirect_uri: redirectUri || KICK_REDIRECT_URI,
        code,
        code_verifier: verifier || undefined
    });
}

function exchangeKickRefreshToken(refreshToken) {
    return requestKickToken({
        grant_type: 'refresh_token',
        client_id: KICK_CLIENT_ID,
        client_secret: KICK_CLIENT_SECRET,
        refresh_token: refreshToken
    });
}

function loadTlsOptions() {
    if (!TLS_CERT_PATH || !TLS_KEY_PATH) {
        return null;
    }
    try {
        const key = fs.readFileSync(TLS_KEY_PATH);
        const cert = fs.readFileSync(TLS_CERT_PATH);
        const ca = TLS_CA_PATH ? fs.readFileSync(TLS_CA_PATH) : undefined;
        const options = { key, cert };
        if (ca) {
            options.ca = ca;
        }
        return options;
    } catch (err) {
        console.error('[kick-bridge] failed to load TLS files:', err?.message || err);
        return null;
    }
}

function createFingerprint(options) {
    const hash = crypto.createHash('sha256');
    if (options.key) {
        hash.update(Buffer.isBuffer(options.key) ? options.key : Buffer.from(String(options.key)));
    }
    if (options.cert) {
        hash.update(Buffer.isBuffer(options.cert) ? options.cert : Buffer.from(String(options.cert)));
    }
    if (options.ca) {
        const entries = Array.isArray(options.ca) ? options.ca : [options.ca];
        for (const entry of entries) {
            hash.update(Buffer.isBuffer(entry) ? entry : Buffer.from(String(entry)));
        }
    }
    return hash.digest('hex');
}

function toSecureContextOptions(options) {
    const { key, cert, ca } = options;
    return ca ? { key, cert, ca } : { key, cert };
}

function scheduleTlsReload(serverInstance, intervalMs) {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
        return;
    }
    let lastFingerprint = null;

    const reload = () => {
        const updated = loadTlsOptions();
        if (!updated) {
            return;
        }
        const fingerprint = createFingerprint(updated);
        if (fingerprint === lastFingerprint) {
            return;
        }
        try {
            serverInstance.setSecureContext(toSecureContextOptions(updated));
            lastFingerprint = fingerprint;
            console.log('[kick-bridge] reloaded TLS certificates at', new Date().toISOString());
        } catch (err) {
            console.error('[kick-bridge] failed to reload TLS context:', err?.message || err);
        }
    };

    const initial = loadTlsOptions();
    if (initial) {
        lastFingerprint = createFingerprint(initial);
    }

    setInterval(reload, intervalMs).unref();

    [TLS_CERT_PATH, TLS_KEY_PATH, TLS_CA_PATH]
        .filter(Boolean)
        .forEach(filePath => {
            try {
                fs.watch(filePath, { persistent: false }, () => reload());
            } catch (err) {
                // Ignore watcher errors but rely on interval-based reloads
            }
        });
}

function handleEvents(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN
    });
    res.write('\n');
    clients.add(res);
    req.on('close', () => {
        clients.delete(res);
    });
}

async function handleWebhook(req, res) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const bodyStr = buffer.toString('utf8');
    let body;
    try {
        body = JSON.parse(bodyStr);
    } catch (err) {
        console.error('[kick-bridge] Invalid JSON body', err);
        res.writeHead(400, corsHeaders());
        res.end('invalid json');
        return;
    }

    const type = req.headers['kick-event-type'] || body?.type || null;
    const challenge = body?.challenge || body?.data?.challenge || null;
    let verified = true;
    const hasSignature = typeof req.headers['kick-signature'] === 'string';
    if (VERIFY_SIGNATURE && !challenge) {
        if (hasSignature) {
            try {
                verified = await verifySignature(req.headers, bodyStr);
            } catch (err) {
                console.error('[kick-bridge] Signature verification error', err);
                verified = false;
            }
        } else {
            verified = false;
        }
    }

    const event = {
        type,
        messageId: req.headers['kick-event-message-id'] || null,
        timestamp: req.headers['kick-event-message-timestamp'] || null,
        version: req.headers['kick-event-version'] || null,
        verified: challenge ? true : verified,
        challenge: challenge || undefined,
        body
    };

    broadcast(event);

    if (challenge) {
        res.writeHead(200, corsHeaders({ 'Content-Type': 'text/plain' }));
        res.end(challenge);
        return;
    }

    res.writeHead(200, corsHeaders({ 'Content-Type': 'application/json' }));
    res.end(JSON.stringify({ status: 'ok' }));
}

function corsHeaders(extra = {}) {
    return Object.assign({
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,Kick-Event-Type,Kick-Event-Message-Id,Kick-Event-Message-Timestamp,Kick-Signature'
    }, extra);
}

async function routeRequest(req, res) {
    const protocol = req.socket?.encrypted ? 'https' : 'http';
    const url = new URL(req.url, `${protocol}://${req.headers.host}`);
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders());
        res.end();
        return;
    }
    if (url.pathname === '/events' && req.method === 'GET') {
        handleEvents(req, res);
        return;
    }
    if (url.pathname === '/kick/callback' && (req.method === 'GET' || req.method === 'POST')) {
        await handleKickCallback(req, res, url, req);
        return;
    }
    if (url.pathname === '/kick/token' && req.method === 'POST') {
        await handleKickTokenRequest(req, res);
        return;
    }
    if (url.pathname === '/webhook' && req.method === 'POST') {
        await handleWebhook(req, res);
        return;
    }
    res.writeHead(404, corsHeaders());
    res.end('not found');
}

function createRequestListener() {
    return (req, res) => {
        routeRequest(req, res).catch(err => {
            console.error('[kick-bridge] request error:', err?.message || err);
            if (!res.headersSent) {
                res.writeHead(500, corsHeaders({ 'Content-Type': 'text/plain' }));
            }
            res.end('internal error');
        });
    };
}

async function parseJsonBody(req) {
    const buffers = [];
    for await (const chunk of req) {
        buffers.push(chunk);
    }
    if (!buffers.length) {
        return null;
    }
    try {
        const raw = Buffer.concat(buffers).toString('utf8');
        if (!raw) return null;
        const contentType = (req.headers['content-type'] || '').toLowerCase();
        if (contentType.includes('application/x-www-form-urlencoded')) {
            const params = new URLSearchParams(raw);
            const result = {};
            for (const [key, value] of params.entries()) {
                result[key] = value;
            }
            return result;
        }
        return JSON.parse(raw);
    } catch (err) {
        throw new Error('invalid_json');
    }
}

function bodyOrQuery(url, body, key) {
    if (body && Object.prototype.hasOwnProperty.call(body, key)) {
        return body[key];
    }
    return url.searchParams.get(key);
}

async function handleKickCallback(req, res, url, rawReq) {
    let body = null;
    if (req.method === 'POST') {
        try {
            body = await parseJsonBody(rawReq);
        } catch (err) {
            res.writeHead(400, corsHeaders({ 'Content-Type': 'application/json' }));
            res.end(JSON.stringify({ error: 'invalid_json', message: 'Request body must be valid JSON.' }));
            return;
        }
    }
    const code = bodyOrQuery(url, body, 'code');
    const verifier = bodyOrQuery(url, body, 'code_verifier');
    const redirectUri = bodyOrQuery(url, body, 'redirect_uri') || KICK_REDIRECT_URI;
    if (!code) {
        res.writeHead(400, corsHeaders({ 'Content-Type': 'application/json' }));
        res.end(JSON.stringify({ error: 'missing_code', message: 'Kick did not return an authorization code.' }));
        return;
    }
    if (!verifier) {
        res.writeHead(400, corsHeaders({ 'Content-Type': 'application/json' }));
        res.end(JSON.stringify({ error: 'missing_verifier', message: 'PKCE code verifier is required.' }));
        return;
    }

    if (!KICK_CLIENT_ID || !KICK_CLIENT_SECRET) {
        res.writeHead(500, corsHeaders({ 'Content-Type': 'application/json' }));
        res.end(JSON.stringify({ error: 'oauth_not_configured', message: 'Kick OAuth client credentials are not set.' }));
        return;
    }

    try {
        const result = await exchangeKickAuthorizationCode(code, verifier, redirectUri);
        res.writeHead(result.statusCode, corsHeaders({ 'Content-Type': 'application/json' }));
        res.end(result.body || '{}');
    } catch (err) {
        console.error('[kick-bridge] kick callback error:', err?.message || err);
        res.writeHead(500, corsHeaders({ 'Content-Type': 'application/json' }));
        res.end(JSON.stringify({ error: 'oauth_exchange_failed', message: 'Failed to exchange authorization code with Kick.' }));
    }
}

async function handleKickTokenRequest(req, res) {
    let payload = {};
    try {
        payload = (await parseJsonBody(req)) || {};
    } catch (err) {
        res.writeHead(400, corsHeaders({ 'Content-Type': 'application/json' }));
        res.end(JSON.stringify({ error: 'invalid_json', message: 'Request body must be valid JSON.' }));
        return;
    }
    const grantType = payload?.grant_type;

    if (!KICK_CLIENT_ID || !KICK_CLIENT_SECRET) {
        res.writeHead(500, corsHeaders({ 'Content-Type': 'application/json' }));
        res.end(JSON.stringify({ error: 'oauth_not_configured', message: 'Kick OAuth client credentials are not set.' }));
        return;
    }

    try {
        let result;
        if (grantType === 'refresh_token') {
            if (!payload.refresh_token) {
                res.writeHead(400, corsHeaders({ 'Content-Type': 'application/json' }));
                res.end(JSON.stringify({ error: 'missing_refresh_token', message: 'refresh_token is required for this grant type.' }));
                return;
            }
            result = await exchangeKickRefreshToken(payload.refresh_token);
        } else {
            res.writeHead(400, corsHeaders({ 'Content-Type': 'application/json' }));
            res.end(JSON.stringify({ error: 'unsupported_grant_type', message: 'Only refresh_token grant is supported.' }));
            return;
        }

        res.writeHead(result.statusCode, corsHeaders({ 'Content-Type': 'application/json' }));
        res.end(result.body || '{}');
    } catch (err) {
        console.error('[kick-bridge] kick token error:', err?.message || err);
        res.writeHead(500, corsHeaders({ 'Content-Type': 'application/json' }));
        res.end(JSON.stringify({ error: 'token_request_failed', message: 'Kick token request failed.' }));
    }
}

const tlsOptions = loadTlsOptions();
const useTls = Boolean(tlsOptions);
const requestListener = createRequestListener();
const server = useTls ? https.createServer(tlsOptions, requestListener) : http.createServer(requestListener);

if (useTls && Number.isFinite(TLS_RELOAD_INTERVAL_MS) && TLS_RELOAD_INTERVAL_MS > 0) {
    scheduleTlsReload(server, TLS_RELOAD_INTERVAL_MS);
} else if (!useTls && (TLS_CERT_PATH || TLS_KEY_PATH)) {
    console.warn('[kick-bridge] TLS files configured but could not be loaded; falling back to HTTP.');
}

server.listen(PORT, HOST, () => {
    const scheme = useTls ? 'https' : 'http';
    console.log(`[kick-bridge] Listening on ${scheme}://${HOST}:${PORT}`);
    if (!VERIFY_SIGNATURE) {
        console.warn('[kick-bridge] Signature verification disabled (SKIP_SIGNATURE=1).');
    }
    if (useTls) {
        console.log('[kick-bridge] TLS enabled.');
    } else {
        console.log('[kick-bridge] TLS disabled (set TLS_CERT_PATH and TLS_KEY_PATH to enable).');
    }
    console.log(`[kick-bridge] Allow-Origin: ${ALLOWED_ORIGIN}`);
});
