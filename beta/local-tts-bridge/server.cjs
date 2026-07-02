#!/usr/bin/env node
"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");

function arg(name, fallback) {
    const index = process.argv.indexOf("--" + name);
    if (index !== -1 && process.argv[index + 1]) {
        return process.argv[index + 1];
    }
    return fallback;
}

const mode = (arg("mode", process.env.SSN_TTS_TARGET_MODE || "openai") || "openai").toLowerCase();
const defaultTarget = mode === "gptsovits"
    ? "http://127.0.0.1:9880/tts"
    : mode === "f5"
        ? "http://127.0.0.1:7860/synthesize_speech/"
        : "http://127.0.0.1:8000/v1/audio/speech";
const targetUrl = arg("target", process.env.SSN_TTS_TARGET || defaultTarget);
const port = parseInt(arg("port", process.env.PORT || process.env.SSN_TTS_BRIDGE_PORT || "8124"), 10);
const host = arg("host", process.env.SSN_TTS_BRIDGE_HOST || "127.0.0.1");
const targetBearer = process.env.SSN_TTS_TARGET_BEARER || "";
const forwardAuth = process.env.SSN_TTS_FORWARD_AUTH === "1";

function corsHeaders(extra) {
    return Object.assign({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "content-type,authorization",
        "Access-Control-Expose-Headers": "content-type,content-length",
        "Cache-Control": "no-store"
    }, extra || {});
}

function sendJson(res, status, payload) {
    res.writeHead(status, corsHeaders({ "Content-Type": "application/json" }));
    res.end(JSON.stringify(payload));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", chunk => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

function parseJson(buffer) {
    if (!buffer || !buffer.length) {
        return {};
    }
    return JSON.parse(buffer.toString("utf8"));
}

function getExtraJson() {
    if (!process.env.SSN_TTS_EXTRA_JSON) {
        return {};
    }
    try {
        return JSON.parse(process.env.SSN_TTS_EXTRA_JSON);
    } catch (e) {
        console.warn("Ignoring invalid SSN_TTS_EXTRA_JSON:", e.message);
        return {};
    }
}

function buildTargetRequest(incomingBuffer, target) {
    if (mode === "f5") {
        const input = parseJson(incomingBuffer);
        const f5Target = new URL(target.toString());
        f5Target.searchParams.set("text", input.input || input.text || "");
        f5Target.searchParams.set("voice", process.env.SSN_TTS_VOICE || input.voice || "default_en");
        f5Target.searchParams.set("speed", input.speed || 1.0);

        return {
            method: "GET",
            path: f5Target.pathname + f5Target.search,
            body: Buffer.alloc(0),
            headers: {}
        };
    }

    if (mode !== "gptsovits") {
        return {
            method: "POST",
            path: target.pathname + target.search,
            body: incomingBuffer,
            headers: { "Content-Type": "application/json" }
        };
    }

    const input = parseJson(incomingBuffer);
    const refAudioPath = process.env.SSN_TTS_REF_AUDIO_PATH || input.ref_audio_path || "";
    if (!refAudioPath) {
        const err = new Error("SSN_TTS_REF_AUDIO_PATH is required for --mode gptsovits");
        err.statusCode = 400;
        throw err;
    }

    const payload = Object.assign({
        text: input.input || input.text || "",
        text_lang: process.env.SSN_TTS_TEXT_LANG || input.text_lang || "en",
        ref_audio_path: refAudioPath,
        prompt_text: process.env.SSN_TTS_REF_TEXT || input.prompt_text || "",
        prompt_lang: process.env.SSN_TTS_REF_LANG || input.prompt_lang || process.env.SSN_TTS_TEXT_LANG || "en",
        media_type: input.response_format || process.env.SSN_TTS_MEDIA_TYPE || "wav",
        speed_factor: input.speed || 1.0,
        streaming_mode: false
    }, getExtraJson());

    return {
        method: "POST",
        path: target.pathname + target.search,
        body: Buffer.from(JSON.stringify(payload)),
        headers: { "Content-Type": "application/json" }
    };
}

function requestTarget(req, res, incomingBuffer) {
    let target;
    let targetRequest;
    try {
        target = new URL(targetUrl);
        targetRequest = buildTargetRequest(incomingBuffer, target);
    } catch (e) {
        sendJson(res, e.statusCode || 500, { error: e.message });
        return;
    }

    const client = target.protocol === "https:" ? https : http;
    const outgoingHeaders = Object.assign({}, targetRequest.headers, {
        "Accept": req.headers.accept || "*/*",
        "Content-Length": targetRequest.body.length
    });

    if (targetBearer) {
        outgoingHeaders.Authorization = "Bearer " + targetBearer;
    } else if (forwardAuth && req.headers.authorization) {
        outgoingHeaders.Authorization = req.headers.authorization;
    }

    const upstreamReq = client.request({
        method: targetRequest.method || "POST",
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: targetRequest.path || (target.pathname + target.search),
        headers: outgoingHeaders
    }, upstreamRes => {
        const chunks = [];
        upstreamRes.on("data", chunk => chunks.push(chunk));
        upstreamRes.on("end", () => {
            const body = Buffer.concat(chunks);
            res.writeHead(upstreamRes.statusCode || 502, corsHeaders({
                "Content-Type": upstreamRes.headers["content-type"] || "application/octet-stream",
                "Content-Length": body.length
            }));
            res.end(body);
        });
    });

    upstreamReq.on("error", e => {
        sendJson(res, 502, { error: "TTS target request failed", detail: e.message });
    });

    upstreamReq.write(targetRequest.body);
    upstreamReq.end();
}

const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders());
        res.end();
        return;
    }

    if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
        sendJson(res, 200, {
            status: "ok",
            mode,
            endpoint: "http://" + host + ":" + port + "/v1/audio/speech",
            target: targetUrl
        });
        return;
    }

    if (req.method !== "POST" || (req.url !== "/v1/audio/speech" && req.url !== "/tts")) {
        sendJson(res, 404, { error: "Use POST /v1/audio/speech" });
        return;
    }

    try {
        const body = await readBody(req);
        requestTarget(req, res, body);
    } catch (e) {
        sendJson(res, 500, { error: e.message });
    }
});

server.listen(port, host, () => {
    console.log("SSN local TTS bridge listening on http://" + host + ":" + port + "/v1/audio/speech");
    console.log("Mode: " + mode + " Target: " + targetUrl);
});
