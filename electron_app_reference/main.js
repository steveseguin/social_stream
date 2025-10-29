// Modules to control application life and create native browser window
const electron = require("electron");
const process = require("process");
const prompt = require("electron-prompt");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const {
    cleanVisibleString,
    firstNonEmptyVisibleString,
    normalizeTikTokImageUrl,
    collectTikTokBadges,
    getBadgeImageUrl
} = require('./tiktok-badges');
const {
    installTikTokSignServerFallback,
    createTikTokEnvironment
} = require('./tiktok/connection-manager');
const {
    app,
    Menu,
    Tray,
    BrowserWindow,
    BrowserView,
    webFrameMain,
    desktopCapturer,
    ipcMain,
    screen,
    shell,
    globalShortcut,
    session,
    dialog
} = require('electron')
const { exec } = require('child_process');
const contextMenu = require("electron-context-menu");
const Yargs = require("yargs");



const fetch = require("electron-fetch").default;
const TikTokAuth = require('./tiktok-auth');
const { setupWebSocketMonitor } = require('./websocket-monitor');

const {
    fetch: undiciFetch
} = require('undici');
const isMac = process.platform === "darwin";
const WebSocket = require('ws');
const {
    Worker,
    workerData
} = require('worker_threads');


const Store = require("electron-store");
const store = new Store();

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

let connectionStates = new Map();
let browserViews = {};

// Define isDevMode
const isDevMode = (
    process.env.NODE_ENV === 'development' ||
    process.argv.includes('--dev') ||
    process.argv.includes('--running-from-source') ||
    process.argv.includes('--inspect-brk') ||
    process.argv.includes('--inspect')
);

// Centralized logging toggle (disable console noise outside dev-style runs)
const explicitLogEnable = process.argv.includes('--enable-logs') || process.env.SSAPP_DEBUG_LOGS === '1';
const explicitLogDisable = process.argv.includes('--disable-logs') || process.env.SSAPP_DEBUG_LOGS === '0';
const isDebugLoggingEnabled = explicitLogDisable ? false : (explicitLogEnable || isDevMode);

if (!isDebugLoggingEnabled) {
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.warn = noop;
    console.trace = noop;
}

const forceTikTokLogging = process.argv.includes('--enable-tiktok-logs') || process.env.SSAPP_TIKTOK_LOGS === '1';
const disableTikTokLogging = process.argv.includes('--disable-tiktok-logs') || process.env.SSAPP_TIKTOK_LOGS === '0';
const shouldEnableTikTokLogging = !disableTikTokLogging && (forceTikTokLogging || isDevMode);

let TikTokLiveConnectionClass = null;
let TikTokPollingFallbackClass = null;
let usingLegacyTikTokConnector = false;
let ConnectionManager = null;
let cleanupConnection = () => {};
let sendToBackground = () => {};
let sendBatchToBackground = () => {};
let logTikTokForwardedMessage = () => {};
let sendToTikTok = () => {};
let wssID = 0;
// Track websocket connections globally for cleanup
const websocketConnections = {};

try {
    const tiktokConnector = require('tiktok-live-connector');
    installTikTokSignServerFallback(tiktokConnector);

    const tikTokEnv = createTikTokEnvironment({
        connector: tiktokConnector,
        shouldEnableTikTokLogging,
        resolveLogDirectory: () => app.getPath('userData'),
        getMainWindow: () => mainWindow,
        browserViews,
        websocketConnections,
        log,
        getCachedSettings,
        isCaptureEventsEnabled,
        isCaptureJoinedEventEnabled,
        isViewerUpdateAllowed,
        isTextOnlyModeEnabled,
        connectionStates
    });

    ConnectionManager = tikTokEnv.ConnectionManager;
    cleanupConnection = tikTokEnv.cleanupConnection;
    sendToBackground = tikTokEnv.sendToBackground;
    sendBatchToBackground = tikTokEnv.sendBatchToBackground;
    logTikTokForwardedMessage = tikTokEnv.logTikTokForwardedMessage;
    sendToTikTok = tikTokEnv.sendToTikTok;
    connectionStates = tikTokEnv.connectionStates;
    usingLegacyTikTokConnector = tikTokEnv.usingLegacyConnector;
    TikTokLiveConnectionClass = tikTokEnv.TikTokLiveConnectionClass;
    TikTokPollingFallbackClass = tikTokEnv.TikTokPollingFallbackClass;

    if (!usingLegacyTikTokConnector) {
        console.info('[TikTok] TikTokLiveConnection available (tiktok-live-connector v2.x)');
    }
} catch (e) {
    console.warn('[TikTok] tiktok-live-connector not available:', e && e.message ? e.message : e);
    TikTokLiveConnectionClass = null; // Allow app to boot; TikTok features disabled until module present
    ConnectionManager = null;
}

// Generate a random flag for this session to authenticate injected scripts
const INJECTED_SCRIPT_FLAG = '_ssapp_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

// App-level helper: whether to forward non-gift events to overlays
function isCaptureEventsEnabled() {
    const settings = cachedState && cachedState.settings;
    if (!settings || typeof settings !== 'object') return false;
    return Object.prototype.hasOwnProperty.call(settings, 'captureevents') ||
        Object.prototype.hasOwnProperty.call(settings, 'captureevent') ||
        Object.prototype.hasOwnProperty.call(settings, 'capturestreamevents');
}

function isCaptureJoinedEventEnabled() {
    const settings = cachedState && cachedState.settings;
    if (!settings || typeof settings !== 'object') return false;
    return Object.prototype.hasOwnProperty.call(settings, 'capturejoinedevent');
}

function isViewerUpdateAllowed() {
    try {
        const s = (typeof cachedState === 'object' && cachedState) ? cachedState.settings : undefined;
        if (!s || typeof s !== 'object') return false;
        // Enabled if any of these keys exist (value ignored)
        return (s.showviewercount !== undefined) || (s.hypemode !== undefined) || (s.hypemeter !== undefined);
    } catch (_) { return false; }
}

function getCachedSettings() {
    try {
        if (cachedState && typeof cachedState === 'object') {
            return cachedState.settings && typeof cachedState.settings === 'object'
                ? cachedState.settings
                : {};
        }
    } catch (_) {}
    return {};
}

function isTextOnlyModeEnabled() {
    try {
        const settings = getCachedSettings();
        return !!(settings.textonlymode || settings.textonly);
    } catch (_) {
        return false;
    }
}

function normalizeLocaleCandidate(candidate) {
    if (!candidate || typeof candidate !== 'string') {
        return null;
    }
    const trimmed = candidate.trim();
    if (!trimmed) {
        return null;
    }
    // Normalize separators to BCP-47 style without forcing case
    let normalized = trimmed.replace('_', '-');
    const dotIndex = normalized.indexOf('.');
    if (dotIndex !== -1) {
        normalized = normalized.slice(0, dotIndex);
    }
    return normalized;
}

function resolveLocaleOverride() {
    const envOverride =
        process.env.SSAPP_LOCALE ||
        process.env.SSAPP_LANGUAGE ||
        process.env.SSAPP_LANG;
    if (envOverride) {
        return {
            value: normalizeLocaleCandidate(envOverride),
            source: 'environment'
        };
    }

    let cliValue = null;
    const localeFlag = process.argv.find((arg) => arg.startsWith('--locale='));
    if (localeFlag) {
        cliValue = localeFlag.split('=')[1];
    } else {
        const idx = process.argv.indexOf('--locale');
        if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
            cliValue = process.argv[idx + 1];
        }
    }
    if (cliValue) {
        return {
            value: normalizeLocaleCandidate(cliValue),
            source: 'command line'
        };
    }

    return null;
}

function buildAcceptLanguageHeader(locale) {
    const normalized = normalizeLocaleCandidate(locale) || 'en-US';
    if (normalized === 'en-US') {
        return 'en-US,en;q=0.9';
    }

    const parts = [];
    const seen = new Set();
    const push = (segment) => {
        if (!segment) return;
        const key = segment.split(';')[0];
        if (seen.has(key)) return;
        seen.add(key);
        parts.push(segment);
    };

    push(normalized);
    const base = (normalized.split('-')[0] || '').toLowerCase() || 'en';
    push(`${base};q=0.9`);
    if (base !== 'en') {
        push('en;q=0.8');
    }

    return parts.join(',');
}

// Store the system locale - get it from environment or OS
let SYSTEM_LOCALE = 'en-US'; // Default fallback

// Try to get system locale from environment variables or OS
let localeOverrideSource = null;
try {
    const override = resolveLocaleOverride();
    if (override && override.value) {
        SYSTEM_LOCALE = override.value;
        localeOverrideSource = override.source;
        console.log(`Locale override detected (${override.source}): ${SYSTEM_LOCALE}`);
    } else if (process.platform === 'win32') {
        try {
            const { execSync } = require('child_process');
            const locale = execSync('powershell -command "Get-Culture | Select-Object -ExpandProperty Name"', { encoding: 'utf8' }).trim();
            if (locale) {
                SYSTEM_LOCALE = normalizeLocaleCandidate(locale);
            }
        } catch (e) {
            SYSTEM_LOCALE = normalizeLocaleCandidate(process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES) || 'en-US';
        }
    } else {
        SYSTEM_LOCALE = normalizeLocaleCandidate(process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES) || 'en-US';
        SYSTEM_LOCALE = SYSTEM_LOCALE.split('.')[0];
    }
    console.log('System locale detected:', SYSTEM_LOCALE);
} catch (e) {
    console.log('Could not detect system locale, using default:', SYSTEM_LOCALE);
}

// Force locale to English before app initialization (matches Chrome)
/* app.locale = 'en';
process.env.LANG = 'en_US.UTF-8';
process.env.LC_ALL = 'en_US.UTF-8';
process.env.LC_MESSAGES = 'en_US.UTF-8'; */


// Helper function to get/create installation ID
function getOrCreateInstallationId() {
    let installId = store.get('kasadaInstallId');
    if (!installId) {
        installId = Math.random().toString(36).substring(2, 10);
        store.set('kasadaInstallId', installId);
        console.log('[Main] Generated new installation ID:', installId);
    }
    return installId;
}

// Note: kasadaProxy cleanup is handled per-window in the closed event
// since each window has its own proxy instance (view.tlsProxy)

// CRITICAL: Set Chrome-like process model BEFORE app ready (from working code)
app.commandLine.appendSwitch('--site-per-process'); // Chrome's process model
app.commandLine.appendSwitch('--process-per-site');
app.commandLine.appendSwitch('--process-per-tab');
// Chrome security settings from working code
app.commandLine.appendSwitch('--disable-web-security', 'false'); // Chrome default
app.commandLine.appendSwitch('--allow-running-insecure-content', 'false');

// Essential anti-detection flags (safe for IPC) - MATCH WORKING CODE FORMAT
app.commandLine.appendSwitch('--disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('--exclude-switches', 'enable-automation');
app.commandLine.appendSwitch('--disable-automation');
app.commandLine.appendSwitch('--disable-dev-shm-usage');
app.commandLine.appendSwitch('--disable-permissions-api', 'false');

// Set language to the detected system locale
// Note: Electron has a bug where en-CA becomes en-GB, but we'll accept this for now
app.commandLine.appendSwitch('--lang', SYSTEM_LOCALE);

// Build proper Accept-Language header based on system locale
const acceptLangValue = buildAcceptLanguageHeader(SYSTEM_LOCALE);
app.commandLine.appendSwitch('--accept-lang', acceptLangValue);

console.log(`Setting app language to system locale: ${SYSTEM_LOCALE} (Note: Electron bug may change en-CA to en-GB)`);
process.env.SSAPP_LOCALE_EFFECTIVE = SYSTEM_LOCALE;
process.env.SSAPP_ACCEPT_LANGUAGE = acceptLangValue;
process.env.SSAPP_LOCALE_SOURCE = localeOverrideSource || 'system';

// Chrome-specific feature flags from working code
app.commandLine.appendSwitch('--enable-features', 'NetworkService,NetworkServiceInProcess,VaapiVideoDecoder');
app.commandLine.appendSwitch('--disable-features', 'TranslateUI,BlinkGenPropertyTrees,ImprovedCookieControls,LazyFrameLoading');
app.commandLine.appendSwitch('--use-angle', 'default'); // Chrome's graphics backend

// Performance and stability flags
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// User data directory for persistent profile
// app.commandLine.appendSwitch('user-data-dir', path.join(app.getPath('userData'), 'ChromeProfile'));
// User agent override at app level - this will be overridden by config if available
// Set platform-specific user agent with simplified Chrome version
const CHROME_UA_VERSION = '140.0.0.0';  // Chrome shows simplified version in UA string
if (isMac) {
    app.userAgentFallback = app.userAgentFallback || `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_UA_VERSION} Safari/537.36`;
} else if (process.platform === 'linux') {
    app.userAgentFallback = app.userAgentFallback || `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_UA_VERSION} Safari/537.36`;
} else {
    // Default to Windows
    app.userAgentFallback = app.userAgentFallback || `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_UA_VERSION} Safari/537.36`;
}

// Session management initialization
let currentSessionName = store.get('currentSession');
let sessions = store.get('sessions');

// First-time initialization - preserve existing user data
if (!sessions || !currentSessionName) {
    console.log('Initializing session management for the first time');

    // Set up default session with existing data
    sessions = {
        default: {
            name: 'Default Session (Original)',
            created: Date.now(),
            description: 'Your original settings and sources'
        }
    };

    currentSessionName = 'default';

    // Save the session configuration
    store.set('sessions', sessions);
    store.set('currentSession', currentSessionName);
    store.set('sessionSystemInitialized', true);
}

// Ensure current session exists
if (!sessions[currentSessionName]) {
    currentSessionName = 'default';
    store.set('currentSession', 'default');
}

process.on("uncaughtException", function(error) {
    console.error("Uncaught Exception:", error);
    if (!isDevMode) {
        dialog.showErrorBox('Application Error',
            `An error occurred: ${error.message}\nPlease report this to support.`);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.isQuitting = false;
process.on("exit", () => {
    quitApp();
});

// Track all created partitions for proper cleanup
const createdPartitions = new Set();

// Helper function to get and track partition name
function getTrackedPartition(sessionName) {
    const partition = sessionName === 'default' ? "persist:abc" : `persist:session-${sessionName}`;
    createdPartitions.add(partition); // Track this partition
    return partition;
}

//app.setAppUserModelId("app."+Date.now());
//  PORTABLE!!
let runningFromSource = process.argv.includes("--running-from-source");

// const settingsPath = path.join(path.dirname(app.getPath('exe')), `${app.name}_settings`);
// if (!fs.existsSync(settingsPath)) {
// fs.mkdirSync(settingsPath, { recursive: true });
// }
// log("settingsPath: " +settingsPath);

function getStackTrace() {
    const obj = {};
    Error.captureStackTrace(obj, getStackTrace);
    return obj.stack;
}

function getLineNumber() {
    const e = new Error();
    const frame = e.stack.split("\n")[3]; // Change the index if needed
    const lineNumber = frame.split(":").reverse()[1];
    return lineNumber;
}

function log(msg, a, b) {
    if (runningFromSource) {
        // if not source, hide console
        const lineNumber = getLineNumber();
        console.log(`${lineNumber}: `, msg);
    }
}

/* 
let lastLogTime = performance.now(); // Initialize with the current time
function getTimeStamp() {
  const now = performance.now();
  const timeSinceLastLog = now - lastLogTime;
  lastLogTime = now; // Update lastLogTime to the current time
  return timeSinceLastLog.toFixed(0); // Return time with three decimals for milliseconds
}

function log(msg) {
  const timeStamp = getTimeStamp();
  const lineNumber = getLineNumber();
  log(`${timeStamp}ms [Line ${lineNumber}]:`, msg);
}
function warnlog(msg) {
  const timeStamp = getTimeStamp();
  const lineNumber = getLineNumber();
  console.warn(`${timeStamp}ms [Line ${lineNumber}]:`, msg);
}
function errorlog(msg) {
  const timeStamp = getTimeStamp();
  const lineNumber = getLineNumber();
  console.error(`${timeStamp}ms [Line ${lineNumber}]:`, msg);
}
 */

const TIKTOK_LOG_SUBDIR = 'tiktok-logs';
let cachedTikTokLogDir = null;

function sanitizeForFilename(input) {
    if (input === null || input === undefined) return 'tiktok';
    return String(input)
        .replace(/[^a-z0-9-_]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64) || 'tiktok';
}

function ensureTikTokLogDir() {
    if (cachedTikTokLogDir) {
        return cachedTikTokLogDir;
    }
    try {
        const userDataPath = app.getPath('userData');
        const logDir = path.join(userDataPath, TIKTOK_LOG_SUBDIR);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        cachedTikTokLogDir = logDir;
    } catch (error) {
        console.error('Failed to prepare TikTok log directory:', error);
        cachedTikTokLogDir = null;
    }
    return cachedTikTokLogDir;
}

function normalizeForLogging(value, seen = new WeakMap()) {
    if (value === null || value === undefined) {
        return value;
    }

    const valueType = typeof value;
    if (valueType === 'bigint') {
        return value.toString();
    }
    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
        return value;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Buffer.isBuffer(value)) {
        return {
            type: 'Buffer',
            data: value.toString('base64')
        };
    }
    if (ArrayBuffer.isView(value)) {
        const buffer = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
        return {
            type: value.constructor && value.constructor.name ? value.constructor.name : 'TypedArray',
            data: buffer.toString('base64')
        };
    }
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack
        };
    }
    if (valueType === 'function') {
        return `[Function ${value.name || 'anonymous'}]`;
    }
    if (valueType === 'symbol') {
        return value.toString();
    }

    if (valueType === 'object') {
        if (seen.has(value)) {
            return '[Circular]';
        }

        if (Array.isArray(value)) {
            const arr = [];
            seen.set(value, arr);
            for (const item of value) {
                arr.push(normalizeForLogging(item, seen));
            }
            return arr;
        }

        if (value instanceof Map) {
            const obj = {};
            seen.set(value, obj);
            for (const [key, val] of value.entries()) {
                const mapKey = typeof key === 'string' ? key : String(key);
                obj[mapKey] = normalizeForLogging(val, seen);
            }
            return obj;
        }

        if (value instanceof Set) {
            const arr = [];
            seen.set(value, arr);
            for (const item of value.values()) {
                arr.push(normalizeForLogging(item, seen));
            }
            return arr;
        }

        const output = {};
        seen.set(value, output);
        for (const key of Object.keys(value)) {
            try {
                output[key] = normalizeForLogging(value[key], seen);
            } catch (error) {
                output[key] = `[Unserializable: ${error && error.message ? error.message : 'error'}]`;
            }
        }
        return output;
    }

    return value;
}

const SOCIAL_STREAM_CACHE_DIR = 'social_stream_cache';
const SOCIAL_STREAM_FALLBACK_DIR = 'social_stream_fallback';
const SOCIAL_STREAM_REMOTE_TIMEOUT_MS = 5000;
const socialStreamLoadPromises = new Map();
const pendingInjectorToasts = [];
const seenInjectorToastKeys = new Set();
let mainWindowReadyForInjectorToasts = false;

function normalizeSocialStreamRelativePath(input) {
    if (!input || typeof input !== 'string') return null;
    const normalized = [];
    const parts = input.replace(/\\/g, '/').split('/');
    for (const part of parts) {
        if (!part || part === '.') continue;
        if (part === '..') {
            if (normalized.length) normalized.pop();
            continue;
        }
        normalized.push(part);
    }
    if (!normalized.length) return null;
    return normalized.join(path.sep);
}

async function ensureDirectoryFor(filePath) {
    try {
        const dir = path.dirname(filePath);
        await fsp.mkdir(dir, { recursive: true });
    } catch (error) {
        if (error && error.code !== 'EEXIST') {
            console.warn('Failed to prepare directory for cache file:', error);
        }
    }
}

async function readTextIfExists(filePath) {
    try {
        return await fsp.readFile(filePath, 'utf8');
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

function getSocialStreamCachePath(branch, relativePath) {
    const sanitizedBranch = branch && typeof branch === 'string' ? branch : 'main';
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, SOCIAL_STREAM_CACHE_DIR, sanitizedBranch, relativePath);
}

function getCandidateBundledPaths(branch, relativePath) {
    const candidates = [];
    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, SOCIAL_STREAM_FALLBACK_DIR, branch, relativePath));
        candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', SOCIAL_STREAM_FALLBACK_DIR, branch, relativePath));
    }
    candidates.push(path.join(__dirname, 'resources', SOCIAL_STREAM_FALLBACK_DIR, branch, relativePath));
    candidates.push(path.join(__dirname, SOCIAL_STREAM_FALLBACK_DIR, branch, relativePath));
    return candidates;
}

async function loadBundledSocialStream(branch, relativePath) {
    const attempts = getCandidateBundledPaths(branch, relativePath);
    for (const candidate of attempts) {
        try {
            const text = await readTextIfExists(candidate);
            if (typeof text === 'string') {
                return { text, path: candidate };
            }
        } catch (error) {
            console.warn('Failed to read bundled Social Stream script:', error);
        }
    }
    return null;
}

async function fetchWithTimeout(url, timeoutMs = SOCIAL_STREAM_REMOTE_TIMEOUT_MS) {
    const fetchPromise = fetch(url);
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs} ms`)), timeoutMs);
    });
    try {
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        clearTimeout(timeoutId);
        if (!response) {
            throw new Error('No response received');
        }
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        return { text };
    } catch (error) {
        fetchPromise.catch(() => {}); // Prevent unhandled rejection if timeout wins
        clearTimeout(timeoutId);
        throw error;
    }
}

async function loadSocialStreamSource(remoteUrl, options = {}) {
    const branch = options.branch || 'main';
    const relativePath = normalizeSocialStreamRelativePath(options.relativePath || '');
    const cacheKey = `${branch}::${remoteUrl || 'none'}::${relativePath || 'inline'}`;

    if (socialStreamLoadPromises.has(cacheKey)) {
        return socialStreamLoadPromises.get(cacheKey);
    }

    const promise = (async () => {
        let remoteError = null;
        let cachePath = null;

        if (remoteUrl) {
            try {
                const { text } = await fetchWithTimeout(remoteUrl, options.timeoutMs || SOCIAL_STREAM_REMOTE_TIMEOUT_MS);
                if (relativePath) {
                    try {
                        cachePath = getSocialStreamCachePath(branch, relativePath);
                        await ensureDirectoryFor(cachePath);
                        await fsp.writeFile(cachePath, text, 'utf8');
                    } catch (cacheWriteError) {
                        console.warn('Failed to update Social Stream cache:', cacheWriteError);
                    }
                }
                return {
                    text,
                    origin: 'remote',
                    meta: { url: remoteUrl }
                };
            } catch (error) {
                remoteError = error;
            }
        }

        if (relativePath) {
            try {
                cachePath = cachePath || getSocialStreamCachePath(branch, relativePath);
                const cachedText = await readTextIfExists(cachePath);
                if (typeof cachedText === 'string') {
                    return {
                        text: cachedText,
                        origin: 'cache',
                        meta: {
                            path: cachePath,
                            reason: remoteError ? remoteError.message : 'remote unavailable'
                        }
                    };
                }
            } catch (cacheReadError) {
                console.warn('Failed to read Social Stream cache:', cacheReadError);
            }

            const bundled = await loadBundledSocialStream(branch, relativePath);
            if (bundled && typeof bundled.text === 'string') {
                return {
                    text: bundled.text,
                    origin: 'fallback',
                    meta: {
                        path: bundled.path,
                        reason: remoteError ? remoteError.message : 'remote unavailable'
                    }
                };
            }
        }

        const reasons = [];
        if (remoteError) {
            reasons.push(remoteError && remoteError.message ? remoteError.message : String(remoteError));
        }
        if (!relativePath) {
            reasons.push('No relative path available for cache or fallback.');
        } else {
            reasons.push('No cached or bundled Social Stream script available.');
        }
        throw new Error(reasons.join(' | '));
    })()
    .finally(() => {
        socialStreamLoadPromises.delete(cacheKey);
    });

    socialStreamLoadPromises.set(cacheKey, promise);
    return promise;
}

function queueInjectorToast(level, title, message) {
    if (!level || !title || !message) return;
    const key = `${level}|${title}|${message}`;
    if (seenInjectorToastKeys.has(key)) return;
    seenInjectorToastKeys.add(key);
    pendingInjectorToasts.push({ level, title, message });
    flushInjectorToastQueue();
}

function flushInjectorToastQueue() {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindowReadyForInjectorToasts) {
        return;
    }
    while (pendingInjectorToasts.length) {
        const toast = pendingInjectorToasts.shift();
        try {
            mainWindow.webContents.send('socialstream-injector-status', toast);
        } catch (error) {
            console.warn('Failed to send injector toast:', error);
            pendingInjectorToasts.unshift(toast);
            break;
        }
    }
}

function createTikTokLogWriter(username, wssID) {
    if (!shouldEnableTikTokLogging) {
        return null;
    }
    const logDir = ensureTikTokLogDir();
    if (!logDir) {
        return null;
    }

    const safeUser = sanitizeForFilename(username || 'tiktok');
    const safeId = sanitizeForFilename(wssID || 'connection');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${safeUser}-${safeId}-${timestamp}.log`;
    const filePath = path.join(logDir, fileName);

    let stream;
    try {
        stream = fs.createWriteStream(filePath, { flags: 'a' });
    } catch (error) {
        console.error('Failed to create TikTok log file:', error);
        return null;
    }

    console.info('[TikTok] Debug logging enabled:', filePath);

    return {
        filePath,
        append(entry) {
            if (!stream || stream.destroyed || stream.closed) {
                return;
            }
            try {
                const normalized = normalizeForLogging(entry);
                stream.write(JSON.stringify(normalized) + os.EOL);
            } catch (error) {
                console.error('Failed to write TikTok log entry:', error);
            }
        },
        close() {
            if (stream && !stream.destroyed && !stream.closed) {
                try {
                    stream.end();
                } catch (error) {
                    console.error('Failed to close TikTok log stream:', error);
                }
            }
        }
    };
}

function getWindowStateKey(window) {
    // Generate a unique key based on the window's URL
    // This prevents different types of windows from overwriting each other's saved dimensions
    const url = window.webContents.getURL();
    if (url.includes("dock.html")) return "windowState_dock";
    if (url.includes("input.html")) return "windowState_input";
    if (url.includes("popup.html")) return "windowState_popup";
    if (url.includes("chathistory.html")) return "windowState_history";
    if (url.includes("sampleoverlay.html")) return "windowState_overlay";
    // For other windows, use a hash of the base URL
    const baseUrl = url.split('?')[0].split('#')[0];
    return "windowState_" + baseUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
}

function saveWindowState(window) {
    // Use getBounds() instead of getNormalBounds() to get actual current size
    // getNormalBounds() returns the bounds when not maximized, which can be incorrect
    const bounds = window.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const stateKey = getWindowStateKey(window);

    store.set(stateKey, {
        width: Math.max(parseInt(bounds.width), 100),
        height: Math.max(parseInt(bounds.height), 100),
        x: bounds.x,
        y: bounds.y,
        displayId: display.id,
        scaleFactor: display.scaleFactor || 1
    });
}

function loadWindowState(url) {
    // Generate the same key based on URL that saveWindowState will use
    if (!url) {
        return store.get("windowState"); // Fallback for main window
    }
    
    let stateKey;
    if (url.includes("dock.html")) stateKey = "windowState_dock";
    else if (url.includes("input.html")) stateKey = "windowState_input";
    else if (url.includes("popup.html")) stateKey = "windowState_popup";
    else if (url.includes("chathistory.html")) stateKey = "windowState_history";
    else if (url.includes("sampleoverlay.html")) stateKey = "windowState_overlay";
    else {
        const baseUrl = url.split('?')[0].split('#')[0];
        stateKey = "windowState_" + baseUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    }
    
    const savedState = store.get(stateKey);
    if (savedState) {
        return savedState;
    }
    
    // Return appropriate defaults based on window type
    const defaultState = {
        width: url.includes("input.html") ? 600 : 800,
        height: url.includes("input.html") ? 60 : 600,
        x: null,
        y: null,
        displayId: null
    };

    return defaultState;
}
var ver = app.getVersion();

const argDescriptions = {};

let windowIdCounter = new Map();
// Guard to prevent multiple main-process YouTube ad-skipper intervals
let YT_AD_SKIPPER_INTERVAL = null;

function getActiveBrowserView(id) {
    const view = browserViews[id];
    if (!view) return null;
    try {
        if (typeof view.isDestroyed === 'function' && view.isDestroyed()) {
            delete browserViews[id];
            releaseWindowId(id);
            return null;
        }
        const wc = view.webContents;
        if (wc && typeof wc.isDestroyed === 'function' && wc.isDestroyed()) {
            return null;
        }
    } catch (error) {
        console.warn('Error validating browser view state:', error);
        return null;
    }
    return view;
}

function generateUniqueWindowId() {
    let id = 1;
    while (browserViews[id] || windowIdCounter.has(id)) {
        id++;
    }
    windowIdCounter.set(id, true);
    return id;
}

function releaseWindowId(id) {
    windowIdCounter.delete(id);
}

function createYargs() {
    var argv = Yargs.usage("Usage: $0 -w num -h num -w string -p")
        .example(
            "$0 -w 1280 -h 720 -u https://vdo.ninja/?view=xxxx",
            "Loads the stream with ID xxxx into a window sized 1280x720"
        )
        .describe("help", "Show help.");

    function addOption(key, config) {
        argv = argv.option(key, config);
        argDescriptions[key] = config.describe;
    }


    addOption("w", {
        alias: "width",
        describe: "The width of the window in pixel.",
        type: "number",
        nargs: 1,
        default: 1280,
    });
    addOption("h", {
        alias: "height",
        describe: "The height of the window in pixels.",
        type: "number",
        nargs: 1,
        default: 800,
    });
    addOption("u", {
        alias: "url",
        describe: "The URL of the window to load.",
        default: `file://${path.join(__dirname, "index.html")}`,
        type: "string",
    });
    addOption("fs", {
        alias: "filesource",
        describe: "The location of the local source files. Default is current directory.",
        default: "",
        type: "string",
    });
    addOption("t", {
        alias: "title",
        describe: "The default Title for the app Window",
        type: "string",
        default: null,
    });
    addOption("p", {
        alias: "pin",
        describe: "Toggle always on top",
        type: "boolean",
        default: process.platform == "darwin",
    });
    addOption("a", {
        alias: "hwa",
        describe: "Enable Hardware Acceleration",
        type: "boolean",
        default: true,
    });
    addOption("x", {
        alias: "x",
        describe: "Window X position",
        type: "number",
        default: -1,
    });
    addOption("y", {
        alias: "y",
        describe: "Window Y position",
        type: "number",
        default: -1,
    });
    addOption("node", {
        alias: "n",
        describe: "Enables node-integration, allowing for screen capture, global hotkeys, prompts, and more.",
        type: "boolean",
        default: true,
    });
    addOption("minimized", {
        alias: "min",
        describe: "Starts the window minimized",
        type: "boolean",
        default: false,
    });
    addOption("fullscreen", {
        alias: "f",
        describe: "Enables full-screen mode for the first window on its load.",
        type: "boolean",
        default: false,
    });
    addOption("unclickable", {
        alias: "uc",
        describe: "The page will pass thru any mouse clicks or other mouse events",
        type: "boolean",
        default: false,
    });
    addOption("savefolder", {
        alias: "sf",
        describe: "Where to save a file on disk",
        type: "string",
        default: null,
    });
    addOption("mediafoundation", {
        alias: "mf",
        describe: "Enable media foundation video capture",
        type: "string",
        default: null,
    });
    addOption("disablemediafoundation", {
        alias: "dmf",
        describe: "Disable media foundation video capture; helps capture some webcams",
        type: "string",
        default: null,
    });
    addOption("locale", {
        alias: "loc",
        describe: "Force Chromium locale (e.g. pt-BR) for testing regional behaviour.",
        type: "string",
        default: null,
    });
    addOption("css", {
        alias: "css",
        describe: "Have local CSS script be auto-loaded into every page",
        type: "string",
        default: null,
    });
    addOption("chroma", {
        alias: "color",
        describe: "Set background CSS to target hex color; FFF or 0000 are examples.",
        type: "string",
        default: null,
    });

    addOption("filesource", {
        describe: "Specify where the social stream ninja extension code is located",
        type: "string",
        default: null,
    });
    addOption("tiktokclassic", {
        alias: "tc",
        describe: "Force TikTok sources to use classic (HTTP) mode instead of WebSockets.",
        type: "boolean",
        default: false
    });


    const options = argv.getOptions();
    Object.keys(options.key).forEach((key) => {
        try {
            if (options.describe && options.describe[key]) {
                argDescriptions[key] = options.describe[key];
            }
        } catch (e) {
            console.error(`Error processing option ${key}:`, e);
        }
    });

    return argv;
}

var Args = createYargs();
var Argv = Args.argv;

const envForceTikTokClassic = process.env.SSAPP_FORCE_TIKTOK_CLASSIC === '1';
const CLI_FORCE_TIKTOK_CLASSIC = Argv.tiktokclassic === true;
if (CLI_FORCE_TIKTOK_CLASSIC) {
    process.env.SSAPP_FORCE_TIKTOK_CLASSIC = '1';
} else if (process.env.SSAPP_FORCE_TIKTOK_CLASSIC === undefined) {
    process.env.SSAPP_FORCE_TIKTOK_CLASSIC = envForceTikTokClassic ? '1' : '0';
}
let runtimeForceTikTokClassic = CLI_FORCE_TIKTOK_CLASSIC || process.env.SSAPP_FORCE_TIKTOK_CLASSIC === '1';

function showCommandLineArguments() {

    const argInfo = Args.getOptions();
    const argWindow = new BrowserWindow({
        width: 1280,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalPermissions: ['clipboard-write']
        }
    });

    argWindow.loadURL(`data:text/html,${encodeURIComponent(generateArgHTML(argInfo))}`);
}

function generateArgHTML(argInfo) {
    let html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Command Line Arguments</h1>
        <table>
          <tr>
            <th>Option</th>
            <th>Alias</th>
            <th>Description</th>
            <th>Type</th>
            <th>Default</th>
          </tr>
  `;

    for (const [key, option] of Object.entries(argInfo.key)) {
        const alias = argInfo.alias[key] ? argInfo.alias[key].join(', ') : '';
        const type = argInfo.boolean.includes(key) ? 'boolean' :
            argInfo.string.includes(key) ? 'string' :
            argInfo.number.includes(key) ? 'number' : '';
        const defaultValue = argInfo.default[key] !== undefined ? argInfo.default[key] : '';

        html += `
      <tr>
        <td>${key}</td>
        <td>${alias}</td>
        <td>${argDescriptions[key] || ''}</td>
        <td>${type}</td>
        <td>${defaultValue}</td>
      </tr>
    `;
    }

    html += `
      </table>
    </body>
    </html>
  `;

    return html;
}

if (!app.requestSingleInstanceLock(Argv)) {
    log("requestSingleInstanceLock");
    quitApp();
}

function getDirectories(path) {
    return fs.readdirSync(path).filter(function(file) {
        return fs.statSync(path + "/" + file).isDirectory();
    });
}

if (!Argv.hwa) {
    app.disableHardwareAcceleration();
    log("HWA DISABLED");
}

// Media foundation switches
if (!Argv.mf) {
    app.commandLine.appendSwitch("enable-features", "MediaFoundationVideoCapture");
}
if (!Argv.dmf) {
    app.commandLine.appendSwitch("disable-features", "MediaFoundationVideoCapture");
}

// WebRTC and media performance flags
app.commandLine.appendSwitch("webrtc-max-cpu-consumption-percentage", "100");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("max-web-media-player-count", "5000");

// Network and security flags
app.commandLine.appendSwitch("ignore-certificate-errors");
app.commandLine.appendSwitch("disable-http-cache");
app.commandLine.appendSwitch('dns-server', '1.1.1.1,8.8.8.8');

// Enable experimental features for better compatibility
app.commandLine.appendSwitch("enable-experimental-web-platform-features");
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'WebAssemblySimd');

// Memory allocation for JavaScript
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

var counter = 0;
var forcingAspectRatio = false;

var cachedState = {};
// cachedState.state = false;

var mainWindow = null;
let ttt = {
    width: 1280,
    height: 800
};

var extensions = [];
try {
    var dir = false;
    if (process.platform == "win32") {
        dir = process.env.APPDATA.replace("Roaming", "") + "\\Local\\Google\\Chrome\\User Data\\Default\\Extensions";
        if (dir) {
            //dir = dir.replace("Roaming","");
            var getDir = getDirectories(dir);
            getDir.forEach((d) => {
                try {
                    var ddd = getDirectories(dir + "\\" + d);
                    var fd = fs.readFileSync(dir + "\\" + d + "\\" + ddd[0] + "\\manifest.json", "utf8");
                    var json = JSON.parse(fd);

                    if (json.name.startsWith("_")) {
                        return;
                    }

                    extensions.push({
                        name: json.name,
                        location: dir + "\\" + d + "\\" + ddd[0],
                    });
                } catch (e) {}
            });
        }
    } else if (process.platform == "darwin") {
        dir = process.env.HOME + "/Library/Application Support/Google/Chrome/Default/Extensions";
        log(dir);
        if (dir) {
            //dir = dir.replace("Roaming","");
            var getDir = getDirectories(dir);
            getDir.forEach((d) => {
                try {
                    var ddd = getDirectories(dir + "/" + d);
                    if (!ddd.length) {
                        return;
                    }
                    var fd = fs.readFileSync(dir + "/" + d + "/" + ddd[0] + "/manifest.json", "utf8");
                    var json = JSON.parse(fd);

                    if (json.name.startsWith("_")) {
                        return;
                    }

                    extensions.push({
                        name: json.name,
                        location: dir + "/" + d + "/" + ddd[0],
                    });
                } catch (e) {
                    console.error(e);
                }
            });
        }
    }
} catch (e) {
    console.error(e);
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function formatURL(inputURL, browserWindow) {
    inputURL = inputURL.trim();

    if (inputURL.match(/^[a-zA-Z]+:\/\//)) {
        return inputURL;
    }

    if (inputURL.startsWith('/') || inputURL.match(/^[a-zA-Z]:\\/)) {
        return `file://${inputURL}`;
    }

    if (inputURL.startsWith('www.')) {
        return `https://${inputURL}`;
    }

    if (inputURL.match(/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/)) {
        return `https://${inputURL}`;
    }

    // If it doesn't look like a URL, ask the user what to do
    const {
        response
    } = await dialog.showMessageBox(browserWindow, {
        type: 'question',
        buttons: ['Search', 'Treat as URL', 'Cancel'],
        defaultId: 2,
        title: 'Confirm Action',
        message: `"${inputURL}" doesn't look like a URL. What would you like to do?`,
    });

    if (response === 0) { // Search
        const searchEngines = {
            'Google': 'https://www.google.com/search?q=',
            'DuckDuckGo': 'https://duckduckgo.com/?q=',
            'Bing': 'https://www.bing.com/search?q=',
        };

        const {
            response: engineChoice
        } = await dialog.showMessageBox(browserWindow, {
            type: 'question',
            buttons: Object.keys(searchEngines),
            defaultId: 0,
            title: 'Choose Search Engine',
            message: 'Select your preferred search engine:',
        });

        const chosenEngine = Object.values(searchEngines)[engineChoice];
        return `${chosenEngine}${encodeURIComponent(inputURL)}`;
    } else if (response === 1) { // Treat as URL
        return `https://${inputURL}`;
    } else { // Cancel
        return null;
    }
}

class WebSocketServer {
    constructor() {
        this.server = null;
        this.port = 3000;
        this.connections = new Set();
        this.started = false;
        this.callback = {};
    }

    handleConnection(webSocketClient, request) {
        var out = false;
        const pathComponents = request.url.split('/');

        // Handle path-based connection parameters
        if (pathComponents.length >= 3 && pathComponents[1] === 'join') {
            if (pathComponents[2]) {
                webSocketClient.room = pathComponents[2];
            }
            if (pathComponents.length >= 4) {
                const inChannel = parseInt(pathComponents[3], 10);
                if (!isNaN(inChannel)) {
                    webSocketClient.inn = inChannel;
                }
            }
            if (pathComponents.length >= 5) {
                const outChannel = parseInt(pathComponents[4], 10);
                if (!isNaN(outChannel)) {
                    webSocketClient.out = outChannel;
                    out = outChannel;
                }
            }
        }

        webSocketClient.on('message', (message) => {
            try {
                // Handle room joining via message if not already in a room
                if (!webSocketClient.room) {
                    try {
                        var msg = JSON.parse(message);
                        if ("join" in msg) {
                            webSocketClient.room = msg.join + "";
                            if ("out" in msg) {
                                webSocketClient.out = msg.out;
                                out = msg.out;
                            } else {
                                webSocketClient.out = false;
                            }
                            if ("in" in msg) {
                                webSocketClient.inn = msg.in;
                            } else {
                                webSocketClient.inn = false;
                            }
                        }
                        return;
                    } catch (e) {
                        return;
                    }
                }

                var msg = JSON.parse(message);

                if (msg.callback && ("get" in msg.callback)) {
                    if (this.callback[msg.callback.get]) {
                        if ("result" in msg.callback) {
                            if (typeof msg.callback.result == 'object') {
                                this.callback[msg.callback.get].resolve(JSON.stringify(msg.callback.result));
                            } else {
                                this.callback[msg.callback.get].resolve(msg.callback.result);
                            }
                        } else {
                            this.callback[msg.callback.get].resolve("null");
                        }
                    }
                    return;
                }

                const outChannel = msg.out || out;

                this.server.clients.forEach(client => {
                    if (webSocketClient != client) {
                        if (client.inn && outChannel) {
                            if (client.inn == outChannel) {
                                try {
                                    client.send(message.toString());
                                } catch (e) {}
                            }
                        } else if (client.inn || outChannel) {
                            // skip
                        } else {
                            try {
                                client.send(message.toString());
                            } catch (e) {}
                        }
                    }
                });
            } catch (e) {
                //
            }
        });

        webSocketClient.on('close', () => {
            this.connections.delete(webSocketClient);
        });

        this.connections.add(webSocketClient);
    }

    start(update = false) {

        if (this.server) {
            return {
                success: false,
                message: 'Server already running'
            };
        }

        try {
            this.server = new WebSocket.Server({
                port: this.port
            });
            this.server.on('connection', (ws, req) => this.handleConnection(ws, req));
            this.started = true;

            try {
                cachedState.wsServer = true;
                if (update) {
                    mainWindow.webContents.mainFrame.postMessage("fromMainToIndex", "serverStarted");
                }
            } catch (error) {
                log(error);
            }

            return {
                success: true,
                message: `Server started on port ${this.port}`
            };
        } catch (error) {

            try {
                cachedState.wsServer = false;
                if (update) {
                    mainWindow.webContents.mainFrame.postMessage("fromMainToIndex", "serverStopped");
                }
            } catch (error) {
                log(error);
            }

            return {
                success: false,
                message: error.message
            };
        }
    }

    stop(update = false) {
        if (!this.server) {
            return {
                success: false,
                message: 'Server not running'
            };
        }
        try {
            cachedState.wsServer = false;
            if (update) {
                mainWindow.webContents.mainFrame.postMessage("fromMainToIndex", "serverStopped");
            }
        } catch (error) {
            log(error);
        }
        try {
            for (const client of this.connections) {
                client.close();
            }
            this.connections.clear();
        } catch (error) {
            log(error);
        }

        try {
            this.server.close();
            this.server = null;


            this.started = false;
            return {
                success: true,
                message: 'Server stopped'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
}

const wsServer = new WebSocketServer();

// Track sessions we've already configured to avoid stacking listeners
const cspConfiguredSessions = new WeakSet();
const clientHintsConfiguredSessions = new WeakSet();
const cookiesListenerConfiguredSessions = new WeakSet();

function getOrCreatePersistentSession(domain) {
    const sessionName = `persist:${domain}`;
    createdPartitions.add(sessionName); // Track this partition
    return session.fromPartition(sessionName);
}

async function clearAllData() {
    try {
        const {
            response
        } = await dialog.showMessageBox({
            type: 'warning',
            buttons: ['Continue', 'Cancel'],
            defaultId: 1,
            title: "Clear All Data",
            message: "This will delete all data, including settings, cache, and cookies for all sites.\n\nThis action cannot be undone.\n\nAre you sure you want to continue❓",
            cancelId: 1,
        });

        if (response === 1) { // User clicked Cancel
            log("Operation cancelled by user");
            return false;
        }

        // Preserve minimal cached state
        const preservedStreamID = (cachedState && typeof cachedState === 'object' && 'streamID' in cachedState)
            ? cachedState.streamID
            : null;
        const preservedPassword = (cachedState && typeof cachedState === 'object' && 'password' in cachedState)
            ? cachedState.password
            : null;

        // Reset cached state while preserving stream credentials
        cachedState = {};
        if (preservedStreamID) {
            cachedState.streamID = preservedStreamID;
        }
        if (preservedPassword !== null && preservedPassword !== undefined) {
            cachedState.password = preservedPassword;
        }
        cachedState.state = false;

        const savedSyncPath = path.join(folder, "savedSync.json");
        try {
            fs.writeFileSync(savedSyncPath, JSON.stringify(cachedState, null, 2));
        } catch (writeError) {
            console.error('Failed to rewrite cached state during reset:', writeError);
        }

        // Clear persisted application settings
        try {
            store.clear();
        } catch (storeError) {
            console.error('Failed to clear settings store during reset:', storeError);
        }

        sessions = {
            default: {
                name: 'Default Session (Original)',
                created: Date.now(),
                description: 'Your original settings and sources'
            }
        };
        currentSessionName = 'default';
        store.set('sessions', sessions);
        store.set('currentSession', currentSessionName);
        store.set('sessionSystemInitialized', true);

        createdPartitions.clear();

        // Clear data from default session
        const defaultSession = session.defaultSession;
        await clearSessionData(defaultSession);

        // Clear data from known partition patterns
        const knownPartitions = [
            'persist:youtubemusic',
            'persist:youtube',
            'persist:abc' // Default session partition
        ];

        // Collect all unique sessions from all windows first
        const sessionsToClean = new Set();

        // Add known partitions
        for (const partition of knownPartitions) {
            sessionsToClean.add(partition);
        }

        // Add all dynamically created partitions
        for (const partition of createdPartitions) {
            sessionsToClean.add(partition);
        }

        // Get all windows and collect their session partitions
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            const contents = win.webContents;
            const sessionPartition = contents.session.getStoragePath();

            // Extract partition name from storage path if available
            if (sessionPartition && sessionPartition.includes('Partitions')) {
                const match = sessionPartition.match(/Partitions[\\\/](.+?)$/);
                if (match && match[1]) {
                    sessionsToClean.add(match[1]);
                }
            }
        }

        // Clear data from all collected partition sessions
        for (const partition of sessionsToClean) {
            try {
                const ses = session.fromPartition(partition);
                await clearSessionData(ses);
                log(`Cleared session data for partition: ${partition}`);
            } catch (error) {
                console.error(`Error clearing partition ${partition}:`, error);
            }
        }

        // Clear data from all window sessions (in case we missed any)
        for (const win of windows) {
            try {
                const contents = win.webContents;
                await clearSessionData(contents.session);
                await contents.clearHistory();
                log(`Cleared session for window: ${win.id}`);
            } catch (error) {
                console.error(`Error clearing window ${win.id} session:`, error);
            }
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
            try {
                mainWindow.webContents.send('app:clear-all-sources');
            } catch (error) {
                console.error('Failed to dispatch source clear during reset:', error);
            }
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.reload();
            log('Main window refreshed');
        } else {
            log('Main window is not available for refresh');
        }

        log("All data cleared successfully");
        return true;
    } catch (error) {
        console.error("Error clearing all data:", error);
        return false;
    }
}

async function promptClearAllSources() {
    try {
        if (!mainWindow || mainWindow.isDestroyed()) {
            log('Clear all sources requested but main window is unavailable');
            return;
        }

        const { response } = await dialog.showMessageBox({
            type: 'warning',
            buttons: ['Clear Sources', 'Cancel'],
            defaultId: 1,
            cancelId: 1,
            title: 'Clear All Sources',
            message: 'Remove every configured source and group from the Embedded Core?',
            detail: 'This stops active source windows and connections but keeps app sessions, cookies, and other settings intact.'
        });

        if (response !== 0) {
            log('Clear all sources cancelled by user');
            return;
        }

        mainWindow.webContents.send('app:clear-all-sources');
    } catch (error) {
        console.error('Error sending clear-all-sources command:', error);
    }
}

async function clearSessionData(ses) {
    try {
        await ses.clearStorageData({
            storages: [
                'appcache',
                'cookies',
                'filesystem',
                'indexdb',
                'localstorage',
                'shadercache',
                'websql',
                'serviceworkers',
                'cachestorage',
            ],
            quotas: [
                'temporary',
                'persistent',
                'syncable',
            ],
        });
        await ses.clearCache();
        await ses.clearHostResolverCache();
        await ses.clearAuthCache();
        await ses.clearCodeCaches({});
        if (typeof ses.clearHttpCache === 'function') {
            await ses.clearHttpCache();
        }
    } catch (error) {
        console.error(`Error clearing session data: ${error}`);
    }
}

// Export all session data (cookies, localStorage, IndexedDB, etc.) from all windows/partitions
async function exportAllSessionData() {
    try {
        const sessionData = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            sessions: {}
        };

        // Helper to get all storage data from a session
        async function getSessionStorageData(ses, partitionName) {
            const data = {
                cookies: [],
                localStorage: {},
                sessionStorage: {},
                indexedDB: {}
            };

            try {
                // Get cookies
                data.cookies = await ses.cookies.get({});
                log(`Exported ${data.cookies.length} cookies from ${partitionName}`);
            } catch (error) {
                console.error(`Error exporting cookies from ${partitionName}:`, error);
            }

            // Note: localStorage, sessionStorage, and IndexedDB need to be extracted from renderer process
            // We'll handle this through IPC communication with windows

            return data;
        }

        // Export from default session
        const defaultSession = session.defaultSession;
        sessionData.sessions['default'] = await getSessionStorageData(defaultSession, 'default');

        // Export from known partitions
        const knownPartitions = [
            'persist:youtubemusic',
            'persist:youtube',
            'persist:abc'
        ];

        // Add all dynamically created partitions
        const allPartitions = new Set([...knownPartitions, ...createdPartitions]);

        // Export from all partitions
        for (const partition of allPartitions) {
            try {
                const ses = session.fromPartition(partition);
                sessionData.sessions[partition] = await getSessionStorageData(ses, partition);
            } catch (error) {
                console.error(`Error exporting data from partition ${partition}:`, error);
            }
        }

        // Get data from all open windows
        const windows = BrowserWindow.getAllWindows();
        const windowDataPromises = [];

        for (const win of windows) {
            try {
                const contents = win.webContents;
                const winSession = contents.session;

                // Try to identify the partition name
                let partitionKey = `window-${win.id}`;
                const storagePath = winSession.getStoragePath();
                if (storagePath && storagePath.includes('Partitions')) {
                    const match = storagePath.match(/Partitions[\\\/](.+?)$/);
                    if (match && match[1]) {
                        partitionKey = match[1];
                    }
                }

                // Skip if we already have this partition
                if (sessionData.sessions[partitionKey]) continue;

                // Get cookies from window session
                const cookies = await winSession.cookies.get({});

                // Execute script in window to get localStorage and sessionStorage
                const windowData = await contents.executeJavaScript(`
          (function() {
            const data = {
              localStorage: {},
              sessionStorage: {},
              url: window.location.href,
              origin: window.location.origin
            };
            
            // Export localStorage
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              data.localStorage[key] = localStorage.getItem(key);
            }
            
            // Export sessionStorage
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              data.sessionStorage[key] = sessionStorage.getItem(key);
            }
            
            return data;
          })();
        `).catch(err => {
                    console.error(`Error getting storage from window ${win.id}:`, err);
                    return {
                        localStorage: {},
                        sessionStorage: {}
                    };
                });

                sessionData.sessions[partitionKey] = {
                    cookies: cookies || [],
                    localStorage: windowData.localStorage || {},
                    sessionStorage: windowData.sessionStorage || {},
                    url: windowData.url,
                    origin: windowData.origin
                };

                log(`Exported data from window ${win.id} (${partitionKey})`);
            } catch (error) {
                console.error(`Error exporting data from window ${win.id}:`, error);
            }
        }

        log(`Total sessions exported: ${Object.keys(sessionData.sessions).length}`);
        return sessionData;
    } catch (error) {
        console.error("Error exporting all session data:", error);
        return null;
    }
}

// Import all session data to restore complete state
async function importAllSessionData(sessionData) {
    try {
        if (!sessionData || !sessionData.sessions) {
            throw new Error('Invalid session data format');
        }

        let results = {
            totalCookies: 0,
            totalSessions: 0,
            errors: []
        };

        // Helper to import cookies to a session
        async function importCookiesToSession(ses, cookies, partitionName) {
            let imported = 0;
            for (const cookie of cookies) {
                try {
                    // Build URL for cookie
                    const protocol = cookie.secure ? 'https' : 'http';
                    const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
                    const url = `${protocol}://${domain}${cookie.path || '/'}`;

                    await ses.cookies.set({
                        url: url,
                        name: cookie.name,
                        value: cookie.value,
                        domain: cookie.domain,
                        path: cookie.path || '/',
                        secure: cookie.secure || false,
                        httpOnly: cookie.httpOnly || false,
                        expirationDate: cookie.expirationDate,
                        sameSite: cookie.sameSite || 'no_restriction'
                    });
                    imported++;
                } catch (error) {
                    console.error(`Error importing cookie ${cookie.name} to ${partitionName}:`, error);
                    results.errors.push(`Cookie ${cookie.name} to ${partitionName}: ${error.message}`);
                }
            }
            return imported;
        }

        // Import to each partition
        for (const [partitionName, data] of Object.entries(sessionData.sessions)) {
            try {
                let ses;
                if (partitionName === 'default') {
                    ses = session.defaultSession;
                } else {
                    ses = session.fromPartition(partitionName);
                    // Track this partition for future cleanup
                    if (partitionName.startsWith('persist:')) {
                        createdPartitions.add(partitionName);
                    }
                }

                // Import cookies
                if (data.cookies && data.cookies.length > 0) {
                    const imported = await importCookiesToSession(ses, data.cookies, partitionName);
                    results.totalCookies += imported;
                    log(`Imported ${imported} cookies to ${partitionName}`);
                }

                results.totalSessions++;

                // Note: localStorage and sessionStorage will be imported on the renderer side
                // when windows are created or reloaded

            } catch (error) {
                console.error(`Error importing to partition ${partitionName}:`, error);
                results.errors.push(`Partition ${partitionName}: ${error.message}`);
            }
        }

        log(`Import complete: ${results.totalSessions} sessions, ${results.totalCookies} cookies`);
        return results;
    } catch (error) {
        console.error("Error importing session data:", error);
        return {
            error: error.message
        };
    }
}


function createCustomDialog(htmlFile, width, height) {
    try {
        let win = new BrowserWindow({
            width: width,
            height: height,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                additionalPermissions: ['clipboard-write']
            }
        });

        // Workaround for Electron 36 frameless window titlebar issue
        if (process.platform === 'win32') {
            // Apply initial fix after window is created
            setTimeout(() => {
                if (win && !win.isDestroyed()) {
                    // Force a resize to trigger proper rendering
                    const bounds = win.getBounds();
                    win.setBounds({
                        x: bounds.x,
                        y: bounds.y,
                        width: bounds.width + 1,
                        height: bounds.height
                    });
                    win.setBounds(bounds);
                }
            }, 100);

            // Handle blur events to prevent titlebar from appearing
            let blurTimeout;
            win.on('blur', () => {
                // Clear any existing timeout
                if (blurTimeout) {
                    clearTimeout(blurTimeout);
                    blurTimeout = null;
                }

                blurTimeout = setTimeout(() => {
                    if (win && !win.isDestroyed()) {
                        // Store current bounds
                        const currentBounds = win.getBounds();

                        // Toggle a minimal size change to force re-render
                        win.setBounds({
                            x: currentBounds.x,
                            y: currentBounds.y,
                            width: currentBounds.width + 1,
                            height: currentBounds.height
                        });

                        // Immediately restore original size
                        win.setBounds(currentBounds);
                    }
                }, 10);
            });

            // Clean up timeout on window close
            win.on('closed', () => {
                if (blurTimeout) clearTimeout(blurTimeout);
            });
        }

        win.loadFile(path.join(__dirname, htmlFile));

        // Add error handling for window creation
        win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('Failed to load custom dialog:', errorDescription);
            win.close();
        });

        return win;
    } catch (e) {
        console.error('Error creating custom dialog:', e);
        return null;
    }
}

function handleZoom(window) {
    window.webContents.on('zoom-changed', (event, zoomDirection) => {
        const currentZoom = window.webContents.getZoomFactor();
        if (zoomDirection === 'in') {
            window.webContents.setZoomFactor(currentZoom + 0.1);
        } else if (zoomDirection === 'out') {
            window.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.1));
        }
    });

    window.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.type === 'keyDown') {
            if (input.key === '=') {
                window.webContents.emit('zoom-changed', event, 'in');
            } else if (input.key === '-') {
                window.webContents.emit('zoom-changed', event, 'out');
            }
        }
    });
}

// Handler to get the injected script flag
ipcMain.handle('get-injected-script-flag', () => {
    return INJECTED_SCRIPT_FLAG;
});

ipcMain.handle("show-save-dialog", async (event, opts) => {
    const dialogOpts = {
        title: "Save File",
        buttonLabel: "Save",
        ...opts, // Override defaults with opts provided from renderer
    };
    try {
        const {
            filePath
        } = await dialog.showSaveDialog(dialogOpts);
        return filePath;
    } catch (error) {
        log(error);
    }
});

ipcMain.handle('read-from-file', async (event, filePath) => {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error('Error reading file:', error);
        return null;
    }
});

// Utility: compute virtual desktop bounds across all displays
function getVirtualScreenBounds() {
    try {
        const displays = screen.getAllDisplays();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const d of displays) {
            const { x, y, width, height } = d.bounds;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
        }
        if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
            const pb = screen.getPrimaryDisplay().bounds;
            return { x: pb.x, y: pb.y, width: pb.width, height: pb.height };
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } catch (_) {
        const pb = screen.getPrimaryDisplay().bounds;
        return { x: pb.x, y: pb.y, width: pb.width, height: pb.height };
    }
}

// Stealth-hide: keep window visible to the OS, but move/resize it off-screen
function stealthHideView(view) {
    try {
        if (!view || view.isDestroyed()) return false;
        // Mark logical visibility
        view.__ss_visible = false;
        // Remember current bounds once
        if (!view.__prevBounds) {
            try { view.__prevBounds = view.getBounds(); } catch (_) { view.__prevBounds = null; }
        }
        // Compute an off-screen coordinate
        const vb = getVirtualScreenBounds();
        // Place far to the left/top and reduce size to 1x1
        const offX = Math.floor(vb.x - 3000);
        const offY = Math.floor(vb.y - 3000);
        view.setBounds({ x: offX, y: offY, width: 1, height: 1 });
        // Avoid taskbar clutter while hidden
        try { view.setSkipTaskbar(true); } catch (_) {}
        // Keep window technically visible; do not call hide()/minimize()
        return false;
    } catch (_) {
        return false;
    }
}

// Restore from stealth-hide
function stealthShowView(view) {
    try {
        if (!view || view.isDestroyed()) return true;
        view.__ss_visible = true;
        // Restore size/position
        if (view.__prevBounds && typeof view.__prevBounds.x === 'number') {
            view.setBounds(view.__prevBounds);
        }
        try { view.setSkipTaskbar(false); } catch (_) {}
        try { view.show(); } catch (_) {}
        return true;
    } catch (_) {
        return true;
    }
}

ipcMain.handle('showWindow', (event, args) => {
    const view = browserViews[args.vid];
    if (!view) return false;

    // Initialize logical visibility if missing
    if (typeof view.__ss_visible !== 'boolean') {
        view.__ss_visible = true;
    }

    // args.state semantics (legacy): true => hide, false => show, null => toggle
    if (args.state === null || typeof args.state === 'undefined') {
        if (view.__ss_visible) {
            stealthHideView(view);
        } else {
            stealthShowView(view);
        }
    } else if (args.state) {
        stealthHideView(view);
    } else {
        stealthShowView(view);
    }

    return { newState: !!view.__ss_visible };
});

ipcMain.handle('checkWindowExists', (event, args) => {
    const view = browserViews[args.vid];
    if (!view) return false;
    try {
        if (typeof view.isDestroyed === 'function') {
            if (view.isDestroyed()) {
                // Clean up stale reference
                delete browserViews[args.vid];
                releaseWindowId(args.vid);
                return false;
            }
        }
    } catch (_) {}
    return true;
});

// Explicit window close handler for classic/browser windows
ipcMain.handle('closeWindow', async (event, args) => {
    const vid = args && args.vid;
    if (!vid) return false;
    const view = browserViews[vid];
    if (!view) return false;

    try {
        // Attempt a clean destroy regardless of custom close handlers
        if (typeof view.destroy === 'function' && !view.isDestroyed()) {
            view.destroy();
        } else if (typeof view.close === 'function') {
            view.close();
        }
    } catch (e) {
        console.error('Error destroying window:', e);
    }

    try {
        delete browserViews[vid];
        releaseWindowId(vid);
    } catch (_) {}

    return true;
});


// Session management IPC handlers
ipcMain.handle('getSessions', () => {
    const sessions = store.get('sessions', {});

    // Ensure default session always exists
    if (!sessions.default) {
        sessions.default = {
            name: 'Default Session',
            description: 'Main session',
            created: Date.now()
        };
        store.set('sessions', sessions);
    }

    return {
        sessions: sessions,
        currentSession: currentSessionName
    };
});

ipcMain.handle('createSession', (event, sessionData) => {
    const sessions = store.get('sessions', {});
    const sessionId = sessionData.id || `session-${Date.now()}`;
    sessions[sessionId] = {
        name: sessionData.name,
        description: sessionData.description || '',
        created: Date.now()
    };
    store.set('sessions', sessions);
    return {
        success: true,
        sessionId
    };
});

ipcMain.handle('switchSession', async (event, sessionId) => {
    if (sessionId === currentSessionName) {
        return {
            success: false,
            message: 'Already on this session'
        };
    }

    // Save current session
    store.set('currentSession', sessionId);

    // Restart the app to apply new session
    app.relaunch();
    app.exit();

    return {
        success: true
    };
});

ipcMain.handle('deleteSession', (event, sessionId) => {
    if (sessionId === 'default') {
        return {
            success: false,
            message: 'Cannot delete default session'
        };
    }

    const sessions = store.get('sessions', {});
    delete sessions[sessionId];
    store.set('sessions', sessions);

    // If deleting current session, switch to default
    if (sessionId === currentSessionName) {
        store.set('currentSession', 'default');
        app.relaunch();
        app.exit();
    }

    return {
        success: true
    };
});

ipcMain.handle('renameSession', (event, sessionId, newName) => {
    const sessions = store.get('sessions', {});
    if (sessions[sessionId]) {
        sessions[sessionId].name = newName;
        store.set('sessions', sessions);
        return {
            success: true
        };
    }
    return {
        success: false,
        message: 'Session not found'
    };
});

// Export all session data including cookies, localStorage, etc from all windows
ipcMain.handle('exportAllSessionData', async () => {
    try {
        const sessionData = await exportAllSessionData();
        return {
            success: true,
            data: sessionData
        };
    } catch (error) {
        console.error('Error in exportAllSessionData handler:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// Import all session data including cookies, localStorage, etc
ipcMain.handle('importAllSessionData', async (event, sessionData) => {
    try {
        const results = await importAllSessionData(sessionData);
        return {
            success: true,
            results
        };
    } catch (error) {
        console.error('Error in importAllSessionData handler:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// Get localStorage data from a specific window/partition for import
ipcMain.handle('getStorageDataForImport', async (event, partitionName) => {
    try {
        const sessionData = store.get('pendingSessionImport', {});
        if (sessionData && sessionData.sessions && sessionData.sessions[partitionName]) {
            return {
                success: true,
                localStorage: sessionData.sessions[partitionName].localStorage || {},
                sessionStorage: sessionData.sessions[partitionName].sessionStorage || {}
            };
        }
        return {
            success: false,
            message: 'No pending import data found'
        };
    } catch (error) {
        console.error('Error getting storage data for import:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// Generic store setter
ipcMain.handle('store-set', async (event, key, value) => {
    try {
        store.set(key, value);
        return {
            success: true
        };
    } catch (error) {
        console.error('Error setting store value:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// Generic store getter
ipcMain.handle('store-get', async (event, key) => {
    try {
        const value = store.get(key);
        return {
            success: true,
            value
        };
    } catch (error) {
        console.error('Error getting store value:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

let tray = null;

async function createWindow(args, reuse = false, mainApp = false) {
    try {
        var webSecurity = true;
        var URI = args.url,
            NODE = args.node,
            WIDTH = args.width,
            HEIGHT = args.height,
            TITLE = args.title,
            PIN = args.pin,
            X = args.x,
            Y = args.y,
            FULLSCREEN = args.fullscreen,
            UNCLICKABLE = args.uc,
            MINIMIZED = args.min,
            CSS = args.css,
            BGCOLOR = args.chroma,
            runningLocally = args.filesource;
    } catch (e) {
        console.error(e);
    }
    try {
        if (runningFromSource) {
            if (isMac && !runningLocally) {
                runningLocally = "/Users/steveseguin/Code/social_stream/";
                runningFromSource = false;
            }
        }
        if (runningLocally && !runningLocally.endsWith("/")) {
            runningLocally += "/";
        }

        log("runningLocally :" + runningLocally);

        var CSSCONTENT = "";

        if (BGCOLOR) {
            CSSCONTENT = "body {background-color:#" + BGCOLOR + "!important;}";
        }

        if (CSS) {
            var p = path.join(__dirname, ".", CSS);

            var res, rej;
            var promise = new Promise((resolve, reject) => {
                res = resolve;
                rej = reject;
            });
            promise.resolve = res;
            promise.reject = rej;

            fs.readFile(p, "utf8", function(err, data) {
                if (err) {
                    fs.readFile(CSS, "utf8", function(err, data) {
                        if (err) {
                            log("Couldn't read specified CSS file");
                        } else {
                            CSSCONTENT += data;
                        }
                        promise.resolve();
                    });
                } else {
                    CSSCONTENT += data;
                    promise.resolve();
                }
            });
            try {
                await promise;
            } catch (error) {
                log(error);
            }
            if (CSSCONTENT) {
                log("Loaded specified file.");
            }
        }
    } catch (e) {
        console.error(e);
    }
    try {
        if (URI.startsWith("file:")) {
            webSecurity = false; // not ideal, but to open local files, this is needed.
            // warn the user in some way that this window is tained.  perhaps detect if they navigate to a different website or load an iframe that it will be a security concern?
            // maybe filter all requests to file:// and ensure they are made from a file:// resource already.
        } else if (!URI.startsWith("http")) {
            URI = "https://" + URI.toString();
            webSecurity = true; // just in case its a remote URI being loaded.
        }
    } catch (e) {
        URI = `file://${path.join(__dirname, "index.html")}`; // zero idea.
        webSecurity = false; // should be local, so we're good.
    }

    if (runningFromSource) {
        if (URI.includes("?")) {
            URI += "&devmode";
        } else {
            URI += "?devmode";
        }
    }
    if (runningLocally) {
        if (URI.includes("?")) {
            URI += "&sourcemode=" + encodeURIComponent(runningLocally);
        } else {
            URI += "?sourcemode=" + encodeURIComponent(runningLocally);
        }
    }

    let currentTitle = "Social Stream Ninja";
    try {
        if (reuse) {
            currentTitle = reuse;
        } else if (TITLE === null) {
            counter += 1;
            if (counter === 1) {
                currentTitle = "Social Stream Ninja - Desktop App v" + app.getVersion();
            } else {
                currentTitle = "Social Stream Ninja (" + counter.toString() + ")";
            }
        } else if (counter == 0) {
            counter += 1;
            currentTitle = TITLE.toString();
        } else {
            counter += 1;
            currentTitle = TITLE.toString() + " (" + counter.toString() + ")";
        }
    } catch (e) {
        console.error(e);
    }

    ipcMain.on("prompt", (event, arg) => {
        try {
            let promptWindow = createCustomDialog('prompt.html', 1000, 600);

            if (!promptWindow) {
                console.error('Failed to create prompt window');
                event.returnValue = null;
                return;
            }

            // Center the prompt window on the same display as the main window
            if (mainWindow && !mainWindow.isDestroyed()) {
                const mainBounds = mainWindow.getBounds();
                const promptBounds = promptWindow.getBounds();
                
                // Get the display that contains the main window
                const display = screen.getDisplayMatching(mainBounds);
                
                // Calculate center position within the display
                const x = display.bounds.x + (display.bounds.width - promptBounds.width) / 2;
                const y = display.bounds.y + (display.bounds.height - promptBounds.height) / 2;
                
                promptWindow.setPosition(Math.round(x), Math.round(y));
            } else {
                // Fallback to centering on primary display
                promptWindow.center();
            }

            // Focus the prompt window
            promptWindow.show();
            promptWindow.focus();

            promptWindow.webContents.on('did-finish-load', () => {
                promptWindow.webContents.send('prompt-data', arg);
            });

            // Use once to ensure this listener is only triggered once
            ipcMain.once('prompt-response', (responseEvent, response) => {
                event.returnValue = response;
                if (!promptWindow.isDestroyed()) {
                    promptWindow.close();
                }
            });

            // Handle window close event
            promptWindow.on('closed', () => {
                if (!event.returnValue) {
                    event.returnValue = null;
                }
            });

            // Set a timeout to close the window if no response is received
            setTimeout(() => {
                if (!promptWindow.isDestroyed()) {
                    log('Prompt timed out');
                    promptWindow.close();
                    if (!event.returnValue) {
                        event.returnValue = null;
                    }
                }
            }, 60000); // 60 second timeout

        } catch (e) {
            console.error('Error handling prompt:', e);
            event.returnValue = null;
        }
    });
    ipcMain.on("confirm", function(eventRet, arg) {
        // This enables a CONFIRM pop up, which is used to BLOCK the main thread until the user provides input.
        log("confirm");
        try {
            dialog.showMessageBox({
                type: 'question',
                buttons: ['Continue', 'Cancel'],
                defaultId: 1,
                title: arg.title.split("\n")[0],
                message: arg.title.replace("\n", "\n\n").replaceAll("\n", "\n"),
                detail: arg.val || "",
                cancelId: 1,
            }).then(result => {
                if (result.response === 0) {
                    log("user chose Continue");
                    eventRet.returnValue = true;
                } else {
                    log("user chose Cancel");
                    eventRet.returnValue = false;
                }
            }).catch((e) => {
                console.error(e);
                eventRet.returnValue = null;
            });
        } catch (e) {
            console.error(e);
        }
    });

    ipcMain.on("showOpenDialog", async function(eventRet, arg) {
        // this enables a PROMPT pop up , which is used to BLOCK the main thread until the user provides input. VDO.Ninja uses prompt for passwords, etc.
        log("----------------------------- showOpenDialog");
        //eventRet.returnValue = null;;
        try {
            //const { dialog } = require('electron').remote;
            let dialogOptions = {
                title: "Choisir un dossier:",
                properties: ["openFile"],
            };
            await dialog
                .showOpenDialog(dialogOptions)
                .then(async (fileNames) => {
                    log(fileNames);
                    if (fileNames !== undefined) {
                        const filePath = fileNames.filePaths[0]; // Assuming you want to read the first selected file.
                        await fs.readFile(filePath, "utf8", async (err, data) => {
                            if (err) {
                                console.error(err);
                                eventRet.returnValue = 1;
                            } else {
                                // The contents of the file are now in the 'data' variable.
                                log("loaded file...");
                                log(data);
                                eventRet.returnValue = data;
                            }
                        });
                    } else {
                        console.error("fileNames is undefined");
                        eventRet.returnValue = 2;
                    }
                })
                .catch((err) => {
                    console.error(err);
                    eventRet.returnValue = 3;
                });
        } catch (e) {
            console.error(e);
        }
    });

    ipcMain.on("alert", function(eventRet, arg) {
        // this enables a PROMPT pop up , which is used to BLOCK the main thread until the user provides input. VDO.Ninja uses prompt for passwords, etc.
        log("PROMPT");
        try {
            arg.val = arg.val || "";
            arg.title = arg.title.replace("\n", "<br /><br />");

            let options = {
                title: arg.title,
                buttons: ["OK"],
                message: arg.val,
            };
            let response = dialog.showMessageBoxSync(options);
        } catch (e) {
            console.error(e);
        }
    });


    let factor = 1;


    if (app.isReady()) {
        try {
            const primaryDisplay = screen.getPrimaryDisplay();
            ttt = primaryDisplay.workAreaSize;
            // Don't use scaleFactor for window sizing - Electron handles DPI scaling internally
            // factor = primaryDisplay.scaleFactor || 1;
        } catch (e) {
            console.error('Failed to get screen info:', e);
        }
    }

    var targetWidth = WIDTH;  // Use WIDTH directly without dividing by factor
    var targetHeight = HEIGHT;  // Use HEIGHT directly without dividing by factor

    var tainted = false;
    if (targetWidth > ttt.width) {
        targetHeight = Math.max(parseInt((targetHeight * ttt.width) / targetWidth), 0);
        targetWidth = ttt.width;
        tainted = true;
    }
    if (targetHeight > ttt.height) {
        targetWidth = Math.max(0, parseInt((targetWidth * ttt.height) / targetHeight));
        targetHeight = ttt.height;
        tainted = true;
    }
    
    // Create the browser window. 
    mainWindow = new BrowserWindow({
        transparent: false,
        //focusable: false,
        width: targetWidth,
        height: targetHeight,
        frame: true,
        backgroundColor: "#FFF",
        fullscreenable: true,
        //titleBarStyle: 'customButtonsOnHover',
        roundedCorners: false,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Regular preload without anti-detection
            pageVisibility: true,
            partition: currentSessionName === 'default' ? "persist:abc" : `persist:session-${currentSessionName}`,
            contextIsolation: false,
            backgroundThrottling: false,
            webSecurity: webSecurity, // this is a locally hosted file, so it should be fine.
            nodeIntegrationInSubFrames: !webSecurity, // if security is on, then node support is off.
            nodeIntegration: !webSecurity // this could be a security hazard, but useful for enabling screen sharing and global hotkeys
        },
        title: currentTitle,
    });

    mainWindowReadyForInjectorToasts = false;
    if (mainWindow && mainWindow.webContents) {
        const wc = mainWindow.webContents;
        wc.on('did-finish-load', () => {
            mainWindowReadyForInjectorToasts = true;
            flushInjectorToastQueue();
        });
        wc.on('will-navigate', () => {
            mainWindowReadyForInjectorToasts = false;
        });
        wc.on('did-start-navigation', () => {
            mainWindowReadyForInjectorToasts = false;
        });
        wc.on('destroyed', () => {
            mainWindowReadyForInjectorToasts = false;
        });
    }

    const consoleFilterPatterns = [
        /Potential permissions policy violation/i,
        /Unrecognized feature/i,
        /Electron Security Warning/i
    ];

    mainWindow.webContents.on('console-message', (event, level, message) => {
        if (consoleFilterPatterns.some((pattern) => pattern.test(message))) {
            if (typeof event?.preventDefault === 'function') {
                event.preventDefault();
            }
            return;
        }
    });

    mainWindow.args = args; // storing settings
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
            if (details.responseHeaders["X-Frame-Options"]) {
                delete details.responseHeaders["X-Frame-Options"];
            } else if (details.responseHeaders["x-frame-options"]) {
                delete details.responseHeaders["x-frame-options"];
            }
            callback({
                cancel: false,
                responseHeaders: details.responseHeaders
            });
        });

        mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
            try {
                const allowedPermissions = [
                    "media",
                    "audioCapture",
                    "desktopCapture",
                    "pageCapture",
                    "tabCapture",
                    "experimental",
                    "screenCapture",
                    "display-capture",
                    "midiSysex",
                    "midi",
                    "shared-array-buffer",
                    "clipboard-sanitized-write"
                ];

                if (allowedPermissions.includes(permission)) {
                    callback(true); // Approve permission request
                } else {
                    console.error(
                        `The application tried to request permission for '${permission}'. This permission was not whitelisted and has been blocked.`
                    );
                    callback(false); // Deny
                }
            } catch (e) {
                console.error(e);
            }
        });


        /* 	mainWindow.webContents.on('zoom-changed', (event, zoomDirection) => {
        	const currentZoom = mainWindow.webContents.getZoomFactor();
        	if (zoomDirection === 'in') {
        	  mainWindow.webContents.setZoomFactor(currentZoom + 0.1);
        	} else if (zoomDirection === 'out') {
        	  mainWindow.webContents.setZoomFactor(currentZoom - 0.1);
        	}
        });
			

          // Handle Ctrl+mousewheel zoom
        mainWindow.webContents.on('before-input-event', (event, input) => {
        	if (input.control && input.type === 'mouseWheel') {
        	  const zoomDirection = input.deltaY < 0 ? 'in' : 'out';
        	  mainWindow.webContents.emit('zoom-changed', event, zoomDirection);
        	}
        }); */

        handleZoom(mainWindow);
        
        // Add window state saving for main window
        let saveTimeout;
        mainWindow.on("resize", () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                saveWindowState(mainWindow);
            }, 100);
        });

        mainWindow.on("move", () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                saveWindowState(mainWindow);
            }, 100);
        });

        mainWindow.webContents.setWindowOpenHandler(({
            url,
            features
        }) => {

            var frame = true;
            if (url.includes("&transparent")) {
                frame = false;
            } else if (url.includes("&chroma=")) {
                frame = false;
            } else if (url.includes("?transparent")) {
                frame = false;
            } else if (url.includes("?chroma=")) {
                frame = false;
            }
            log(url);
            if (url.startsWith("https://socialstream.ninja/chathistory.html") || (url == "./chathistory.html")) {
                url = path.join(__dirname, "chathistory.html");
            }

            var backgroundColor = "#DDD";
            var useTransparency = false;
            if (!frame) {
                backgroundColor = "#0000";
                // Check if we actually need transparency
                if (url.includes("&transparent") || url.includes("?transparent")) {
                    useTransparency = true;
                }
            }

            if (url.startsWith("https://socialstream.ninja/cohost") || url.startsWith("https://beta.socialstream.ninja/cohost") || (url.startsWith("file://") && url.includes("/cohost"))) {
                var config = {
                    webPreferences: {
                        preload: path.join(__dirname, "preload.js"),
                        pageVisibility: true,
                        partition: getTrackedPartition(currentSessionName),
                        contextIsolation: false,
                        backgroundThrottling: false,
                        webSecurity: true, // this is probably a remote file, so we will ensure its off
                        nodeIntegrationInSubFrames: true, // also security concern
                        nodeIntegration: true, // this could be a security hazard, but useful for enabling screen sharing and global hotkeys
                        additionalPermissions: ['clipboard-write']
                    },
                    show: true,
                    backgroundColor: backgroundColor,
                    transparent: useTransparency,
                    resizable: true,
                    frame: frame,
                    autoHideMenuBar: false,
                    title: url.replace("https://", "").slice(0, 50),
                };
            } else {
                var config = {
                    webPreferences: {
                        preload: path.join(__dirname, "preload.js"),
                        pageVisibility: true,
                        partition: currentSessionName === 'default' ? "persist:abc" : `persist:session-${currentSessionName}`,
                        contextIsolation: true,
                        backgroundThrottling: false,
                        webSecurity: true, // this is probably a remote file, so we will ensure its off
                        nodeIntegrationInSubFrames: false, // also security concern
                        nodeIntegration: false, // this could be a security hazard, but useful for enabling screen sharing and global hotkeys
                        additionalPermissions: ['clipboard-write']
                    },
                    show: true,
                    backgroundColor: backgroundColor,
                    transparent: !frame,
                    resizable: true,
                    frame: frame,
                    autoHideMenuBar: false,
                    title: url.replace("https://", "").slice(0, 50),
                };
            }

            const windowState = loadWindowState(url);
            if (windowState) {
                // Adjust for display scaling
                let scaleFactor = 1;
                if (windowState.scaleFactor) {
                    const currentDisplay = screen.getPrimaryDisplay();
                    scaleFactor = (currentDisplay.scaleFactor || 1) / windowState.scaleFactor;
                }
                
                if (windowState.x !== null && windowState.x !== undefined) {
                    config.x = windowState.x;
                }
                if (windowState.y !== null && windowState.y !== undefined) {
                    config.y = windowState.y;
                }
                if (windowState.width) {
                    config.width = Math.round(windowState.width * scaleFactor);
                }
                if (windowState.height) {
                    config.height = Math.round(windowState.height * scaleFactor);
                }
            }


            const view = new BrowserWindow(config);

            // Workaround for Electron 36 frameless window titlebar issue
            if (!frame && process.platform === 'win32') {
                // Show the window immediately but apply fixes
                view.show();

                // Apply initial fix after a short delay
                setTimeout(() => {
                    if (view && !view.isDestroyed()) {
                        // Force a resize to trigger proper rendering
                        const bounds = view.getBounds();
                        view.setBounds({
                            x: bounds.x,
                            y: bounds.y,
                            width: bounds.width + 1,
                            height: bounds.height
                        });
                        view.setBounds(bounds);
                    }
                }, 100);

                // Handle blur events to prevent titlebar from appearing
                let blurTimeout;
                view.on('blur', () => {
                    // Clear any existing timeout
                    if (blurTimeout) clearTimeout(blurTimeout);

                    blurTimeout = setTimeout(() => {
                        if (view && !view.isDestroyed()) {
                            // Store current bounds
                            const currentBounds = view.getBounds();

                            // Toggle a minimal size change to force re-render
                            view.setBounds({
                                x: currentBounds.x,
                                y: currentBounds.y,
                                width: currentBounds.width + 1,
                                height: currentBounds.height
                            });

                            // Immediately restore original size
                            view.setBounds(currentBounds);
                        }
                    }, 10);
                });

                // Clean up timeout on window close
                view.on('closed', () => {
                    if (blurTimeout) clearTimeout(blurTimeout);
                });
            }

            // Add a small delay to save window state to ensure we get the correct bounds
            let saveTimeout;
            view.on("resize", () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    saveWindowState(view);
                }, 100);
            });

            view.on("move", () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    saveWindowState(view);
                }, 100);
            });

            let isClosing = false;
            view.on("close", async (event) => {
                log("close");
                if (isClosing) return;
                event.preventDefault();
                isClosing = true;

                view.hide(); // Hide immediately for better UX
                saveWindowState(view);
                view.webContents.closeDevTools();

                view.webContents.send('close-file-stream');

                await new Promise(resolve => setTimeout(resolve, 1000));
                view.destroy();
            });

            if (view.webContents) {
                // Auto-close on top-level navigation for activated (classic) windows if configured
                try {
                    const enforceCloseOnNavigate = (!args.wss && args.config && args.config.closeOnNavigate === true);
                    if (enforceCloseOnNavigate) {
                        const mode = (args.config && args.config.closeOnNavigateMode) || 'prefix'; // 'origin' | 'prefix' | 'exact'
                        let initialHref = '';
                        let initialOrigin = '';
                        let initialNoHash = '';
                        try {
                            const u = new URL(args.url);
                            initialHref = u.href.replace(/\/+$/, '/');
                            initialOrigin = u.origin;
                            initialNoHash = u.origin + u.pathname + (u.search || '');
                        } catch (_) {
                            initialHref = String(args.url || '').trim();
                            initialOrigin = '';
                            initialNoHash = initialHref.replace(/#.*$/, '');
                        }

                        const isAllowed = (url) => {
                            try {
                                const nu = new URL(url);
                                const href = nu.href.replace(/\/+$/, '/');
                                const noHash = nu.origin + nu.pathname + (nu.search || '');
                                if (mode === 'origin') {
                                    return initialOrigin && nu.origin === initialOrigin;
                                } else if (mode === 'exact') {
                                    // Treat hash-only changes as allowed; compare without hash fragment
                                    return noHash === initialNoHash;
                                } else { // prefix (default)
                                    return href.startsWith(initialHref);
                                }
                            } catch (_) {
                                return true; // If URL parsing fails, do not block
                            }
                        };

                        const maybeClose = (navUrl, reason) => {
                            if (!isAllowed(navUrl)) {
                                try { log(`Auto-closing activated window due to navigation (${reason}): ${navUrl}`); } catch (_) {}
                                try {
                                    // Inform renderer (best-effort)
                                    if (mainWindow && !mainWindow.isDestroyed()) {
                                        mainWindow.webContents.send(`window-closed-${view.tabID}`);
                                    }
                                } catch (_) {}
                                try { if (!view.isDestroyed()) view.destroy(); } catch (_) {}
                                try { delete browserViews[view.tabID]; releaseWindowId(view.tabID); } catch (_) {}
                            }
                        };

                        view.webContents.on('will-navigate', (event, url) => { maybeClose(url, 'will-navigate'); });
                        view.webContents.on('did-navigate', (event, url) => { maybeClose(url, 'did-navigate'); });
                        view.webContents.on('did-navigate-in-page', (event, url) => { maybeClose(url, 'did-navigate-in-page'); });
                        view.webContents.on('did-redirect-navigation', (event, url) => { maybeClose(url, 'redirect'); });
                    }
                } catch (e) {
                    try { console.warn('Error attaching closeOnNavigate handlers:', e); } catch (_) {}
                }
                // Log the URL being loaded
                console.log("Loading URL in new window:", url);

                view.webContents.loadURL(url).catch(err => {
                    console.error("Failed to load URL:", url, err);
                });

                view.webContents.on("zoom-changed", (event, zoomDirection) => {
                    const currentZoom = view.webContents.getZoomFactor();
                    if (zoomDirection === "in") {
                        view.webContents.setZoomFactor(currentZoom + 0.1);
                    } else if (zoomDirection === "out") {
                        view.webContents.setZoomFactor(currentZoom - 0.1);
                    }
                });

                view.webContents.on("did-fail-load", function(e) {
                    console.error("failed to load");
                    console.error(e);
                    //quitApp();
                });

                // Handle Ctrl+mousewheel zoom
                view.webContents.on("before-input-event", (event, input) => {
                    if (input.control && input.type === "mouseWheel") {
                        const zoomDirection = input.deltaY < 0 ? "in" : "out";
                        view.webContents.emit("zoom-changed", event, zoomDirection);
                    }
                });
            }

            createMenu();

            return {
                action: "deny"
            }; // This denies the default window creation since we already created our custom window
        });
    }
    //var appData = process.env.APPDATA+"\\..\\Local" || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")

    createMenu();

    /* 	let options  = {
    	 title : "",
    	 buttons: ["OK"],
    	 message:folder
    };
    let response = dialog.showMessageBoxSync(options);
     */
    if (UNCLICKABLE) {
        mainWindow.mouseEvent = true;
        mainWindow.setIgnoreMouseEvents(mainWindow.mouseEvent);
    }

    ipcMain.on("backgroundLoaded", function(eventRet, value) {
        // this doens't run tho, does it?
        log("BACKGROUND LOADED");
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.mainFrame.postMessage("fromMainToIndex", (cachedState.wsServer || wsServer.server) ? "serverStarted" : "loadPopup");
        }
    });

    ipcMain.on("write-to-file", (event, {
        filePath,
        data
    }) => {
        log("WRITING FILE: " + filePath);

        fs.writeFile(filePath, data, (err) => {
            if (err) {
                console.error("Failed to write the file:", err);
                // If you need to send a response back to the renderer process indicating failure
                event.reply("write-failure", err.message);
            } else {
                log("File has been written successfully.");
                // If you need to send a response back to the renderer process indicating success
                event.reply("write-success", filePath);
            }
        });
    });

    ipcMain.on("fromBackground", function(eventRet, value) {
        log("\nfromBackground ??????????????????");
        log("Received settings from background:", JSON.stringify(value).substring(0, 200));
        cachedState = value;
        //log(cachedState);
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.mainFrame.frames.forEach((frame) => {
                if (frame.url.split("?")[0].endsWith("popup.html")) {
                    frame.postMessage("fromMain", cachedState);
                    log("SENT TO POP UP SCUCESSFULLY");
                }
            });

            mainWindow.webContents.mainFrame.postMessage("fromMainToIndex", (cachedState.wsServer || wsServer.server) ? "serverStarted" : "loadPopup"); // let the index.html page know the pop out should be loaded
        }
        eventRet.returnValue = cachedState;
    });

    ipcMain.on("storageSave", function(eventRet, value) {
        // from background

        log("\nstorageSave:");
        //log(value);
        ////log(cachedState);
        Object.keys(value).forEach((key) => {
            cachedState[key] = value[key];
        });
        //log(cachedState);
        log("saving to storage");
        try {
            fs.writeFileSync(path.join(folder, "savedSync.json"), JSON.stringify(cachedState));
            //fs.writeFileSync(path.join(settingsPath, "savedSync.json"), JSON.stringify(cachedState));
        } catch (e) {
            console.error(e);
        }


        log("Updating popup.html"); // Since the pop up is open, any setting I make I need to reflect back into the pop up, since there is no "on dom load -> getSettings" trigger to do that for us as the pop up is always open
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.mainFrame.frames.forEach((frame) => {
                if (frame.url.split("?")[0].endsWith("popup.html")) {
                    frame.postMessage("fromMain", cachedState); // just sync what's been saved. I need to send everything else the copy-URL in the pop up won't have all the settings needed to update right.
                }
            });
        }
        eventRet.returnValue = cachedState;

        log("SAVING:");
        log(cachedState);
    });

    ipcMain.on("storageGet", function(eventRet, value) {
        // from background , ["streamID", "password", "state", "settings"];

        var response = {};

        log("\n >>>>>      getting from storage");
        ////log("!!!!!!!!!!!!!cachedState");
        //log(cachedState);

        value.forEach((key) => {
            //log(key);
            if (cachedState && key in cachedState) {
                response[key] = cachedState[key];
            }
        });
        //log("storageGet running still");

        log(response);
        eventRet.returnValue = response;
    });

    ipcMain.on("fromBackgroundPopupResponse", function(eventRet, value) {
        log("\nfromBackgroundPopupResponse:");
        //log(value)

        // // state, password, streamID, settings
        if (!value) {
            return;
        }
        if (value.settings) {
            cachedState.settings = value.settings;
        }
        if ("password" in value) {
            cachedState.password = value.password;
        }
        if ("streamID" in value) {
            cachedState.streamID = value.streamID;
        }
        if ("state" in value) {
            cachedState.state = value.state;
        }

        // Forward response to popup frame
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.mainFrame.frames.forEach((frame) => {
                if (frame.url.split("?")[0].endsWith("popup.html")) {
                    frame.postMessage("fromMain", value);
                }
            });
        }

        eventRet.returnValue = value;
    });

    ipcMain.on("fromBackgroundResponse", function(eventRet, value) {
        // log("\nBackgroundResponsed");
        //log(value)

        // // state, password, streamID, settings
        if (!value) {
            return;
        }
        if (value.settings) {
            cachedState.settings = value.settings;
        }
        if ("password" in value) {
            cachedState.password = value.password;
        }
        if ("streamID" in value) {
            cachedState.streamID = value.streamID;
        }
        if ("state" in value) {
            cachedState.state = value.state;
        }
        eventRet.returnValue = value;
    });

    ipcMain.on("fromPopup", function(eventRet, value) {
        log("\nfromPopup; will forward to background.js");
        //log(value);

        // Check if this is an async message with callbackId
        const hasCallbackId = value && value.callbackId;

        if (!hasCallbackId && value.cmd) {
            // Sync message - return immediately
            if (value.cmd == "getSettings") {
                eventRet.returnValue = cachedState;
            } else if (value.cmd == "getOnOffState") {
                eventRet.returnValue = {
                    state: cachedState.state || false
                };
            } else if (value.cmd == "setOnOffState") {
                if (value.data) {
                    cachedState.state = value.data.value || false;
                }
                eventRet.returnValue = {
                    state: cachedState.state || false
                };
            } else {
                eventRet.returnValue = cachedState;
            }
        } else if (!hasCallbackId) {
            // Sync message without cmd
            eventRet.returnValue = {
                state: cachedState.state || false
            };
        }

        try {
            log("Forwarding to background now..");
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.mainFrame.frames.forEach((frame) => {
                    if (frame.url.split("?")[0].endsWith("background.html")) {
                        log(" - found background.html to forward to");
                        frame.postMessage("fromPopup", value); // pass it along to the actual background
                    }
                });
            }
        } catch (e) {
            console.error(e);
        }
    });

    ipcMain.on("fromPopupResponse", function(eventRet, value) {
        log("\nfromPopupResponse");
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.mainFrame.frames.forEach((frame) => {
                if (frame.url.split("?")[0].endsWith("background.html")) {
                    frame.postMessage("fromMain", value);
                }
            });
        }
    });

    ipcMain.on("PPTHotkey", function(eventRet, value) {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("postMessage", {
                PPT: true,
                node: mainWindow.node
            }); // sends to INDEX
        }
    });

    try {
        mainWindow.node = NODE;

        if (X != -1 || Y != -1) {
            if (X == -1) {
                X = 0;
            }
            if (Y == -1) {
                Y = 0;
            }
            mainWindow.setPosition(Math.floor(X / factor), Math.floor(Y / factor));
        }
    } catch (e) {
        console.error(e);
    }

    mainWindow.on("close", async function(e) {
        log("mainWindow close");
        saveWindowState(mainWindow);
        if (!app.isQuitting) {
            e.preventDefault();
            quitApp();
        } else {
            try {
                ipcMain.removeAllListeners("prompt");
                ipcMain.removeAllListeners("showOpenDialog");
                ipcMain.removeAllListeners("alert");
                ipcMain.removeAllListeners("backgroundLoaded");
                ipcMain.removeAllListeners("fromBackground");
                ipcMain.removeAllListeners("storageSave");
                ipcMain.removeAllListeners("storageGet");
                ipcMain.removeAllListeners("fromBackgroundPopupResponse");
                ipcMain.removeAllListeners("fromBackgroundResponse");
                ipcMain.removeAllListeners("fromPopup");
                ipcMain.removeAllListeners("fromPopupResponse");
                ipcMain.removeAllListeners("PPTHotkey");
                ipcMain.removeAllListeners("postMessage");
                ipcMain.removeAllListeners("getAppVersion");
                ipcMain.removeAllListeners("createWindow");
                ipcMain.removeAllListeners("disconnectTikTokConnection");
                ipcMain.removeAllListeners("getVersion");
                ipcMain.removeAllListeners("createTikTokConnection");
                ipcMain.removeHandler("createTikTokConnection");
                ipcMain.removeAllListeners("reloadWindow");
                ipcMain.removeAllListeners("closeWindow");
                ipcMain.removeAllListeners("clearWindowCache");
                ipcMain.removeAllListeners("clearAllCache");
                ipcMain.removeAllListeners("showWindow");
                ipcMain.removeAllListeners("muteWindow");
                ipcMain.removeAllListeners("sendToTab");
                ipcMain.removeAllListeners("getTabs");
                ipcMain.removeAllListeners("sendInputToTab");
                ipcMain.removeAllListeners("getSources");
            } catch (e) {}


            // Destroy browser views
            if (browserViews) {
                for (var winID in browserViews) {
                    try {
                        if (browserViews[winID]) {
                            try {
                                browserViews[winID].close();
                                
                                // Immediate cleanup with safety check
                                if (!browserViews[winID].isDestroyed()) {
                                    browserViews[winID].destroy();
                                }
                            } catch (e) {
                                console.error(`Error closing/destroying view ${winID}:`, e);
                            } finally {
                                // Always remove reference to prevent memory leak
                                delete browserViews[winID];
                                // Also release window ID
                                releaseWindowId(winID);
                            }
                        }
                    } catch (e) {
                        console.error("Error destroying browser view:", e);
                    }
                }
            }
            browserViews = {};

            // Clean up global intervals
            if (global.intervals) {
                global.intervals.forEach(interval => {
                    try {
                        clearInterval(interval);
                    } catch (e) {
                        console.error("Error clearing interval:", e);
                    }
                });
                global.intervals = [];
            }

            try {
                // Close all child windows
                BrowserWindow.getAllWindows().forEach((window) => {
                    if (window !== mainWindow) {
                        window.close();
                    }
                });
            } catch (e) {}
            try {
                // Unregister all shortcuts
                globalShortcut.unregisterAll();

                if (mainWindow) {
                    mainWindow.removeAllListeners();
                }
            } catch (e) {}

            try {
                if (dialog) {
                    dialog.closeAll();
                }
            } catch (e) {}

            try {
                if (tray) {
                    tray.destroy();
                    tray = null;
                }
            } catch (e) {}

            try {

                if (mainWindow && !mainWindow.isDestroyed()) {

                    mainWindow.close();

                    setTimeout(() => {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.destroy();
                        }
                    }, 2000);
                }
            } catch (e) {
                console.error("Error during window close:", e);
            }
        }
    });

    mainWindow.on("closed", async function(e) {
        log("mainWindow closed");
        
        // Clear any intervals attached to mainWindow
        if (mainWindow && mainWindow.intervals) {
            mainWindow.intervals.forEach(interval => clearInterval(interval));
            mainWindow.intervals = [];
        }
        
        setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.destroy();
                mainWindow = null;
            }
        }, 2000);
    });

    mainWindow.on("page-title-updated", function(event) {
        event.preventDefault();
    });

    mainWindow.webContents.on("did-fail-load", function(e) {
        console.error("failed to load");
        console.error(e);
        //quitApp();
    });


    mainWindow.webContents.on(
        "new-window",
        (event, url, frameName, disposition, options, additionalFeatures, referrer, postBody) => {
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.mainFrame.frames.forEach((frame) => {
                    if (frame.url === referrer.url) {
                        event.preventDefault();
                        frame.executeJavaScript(
                            '(function () {\
						window.location = "' +
                            url +
                            '";\
					})();'
                        );
                    } else if (frame.frames) {
                        frame.frames.forEach((subframe) => {
                            if (subframe.url === referrer.url) {
                                event.preventDefault();
                                subframe.executeJavaScript(
                                    '(function () {\
								window.location = "' +
                                    url +
                                    '";\
							})();'
                                );
                            }
                        });
                    }
                });
            }
        }
    );

    mainWindow.webContents.session.on("will-download", (event, item, webContents) => {
        if (mainWindow && mainWindow.webContents) {
            var currentURL = mainWindow.webContents.getURL();
        } else if (webContents.getURL) {
            var currentURL = webContents.getURL();
        }
        if (currentURL.includes("autorecord") || args.savefolder !== null) {
            var dir = args.savefolder;
            if (!dir && process.platform == "darwin") {
                //process.env.USERPROFILE
                dir = process.env.HOME + "/Downloads/";
            } else if (!dir && process.platform == "win32") {
                //process.env.USERPROFILE
                dir = process.env.USERPROFILE + "\\Downloads\\";
            } else if (!dir && process.env.HOME) {
                //process.env.USERPROFILE
                dir = process.env.HOME + "/";
            } else if (!dir && process.env.USERPROFILE) {
                //process.env.USERPROFILE
                dir = process.env.USERPROFILE + "/";
            }

            if (dir !== null) {
                log("Auto saving too " + dir + item.getFilename());
                item.setSavePath(dir + item.getFilename());
            }
        }
    });

    function handleNavigation(event, url) {
        const urlObj = new URL(url);
        if (!["https:", "http:", "file:"].includes(urlObj.protocol)) {
            // Prevent default if the protocol is not in the allowed list
            event.preventDefault();
            log(`Blocked navigation to: ${url}`);
            // Optionally, add your custom handling logic here
        }
    }

    mainWindow.webContents.on("did-finish-load", function(e) {
        if (tainted) {
            mainWindow.setSize(parseInt(WIDTH), parseInt(HEIGHT)); // allows for larger than display resolution.
            tainted = false;
        }
        
        // Only inject language preference if this is the main app window
        // Check if this is a local file:// URL pointing to our app
        const currentURL = mainWindow.webContents.getURL();
        const isMainAppWindow = currentURL && currentURL.startsWith('file://') && 
                               (currentURL.includes(path.join(__dirname, 'index.html').replace(/\\/g, '/')) ||
                                currentURL === URI); // URI is the URL we loaded
        
        if (isMainAppWindow) {
            // This is the main app window, inject language preference
            try {
                const savedLanguage = store.get('language');
                if (savedLanguage) {
                    mainWindow.webContents.executeJavaScript(`
                        // Set the language preference in localStorage for the UI to use
                        localStorage.setItem('language', '${savedLanguage}');
                        // Also trigger language change if the page is already loaded
                        if (typeof changeLanguage === 'function') {
                            changeLanguage('${savedLanguage}');
                        }
                    `);
                } else if (SYSTEM_LOCALE && SYSTEM_LOCALE !== 'en-US') {
                    // If no saved preference, use system locale
                    // Map common system locales to our supported languages
                    let uiLanguage = SYSTEM_LOCALE;
                    const languageMap = {
                        'tr-TR': 'tr',
                        'pt-BR': 'pt-BR', // Keep as is
                        'es-ES': 'es',
                        'es-MX': 'es',
                        'fr-FR': 'fr',
                        'fr-CA': 'fr',
                        'de-DE': 'de',
                        'de-AT': 'de',
                        'de-CH': 'de',
                        'cs-CZ': 'cs',
                        'it-IT': 'it',
                        'ja-JP': 'ja',
                        'zh-CN': 'zh',
                        'zh-TW': 'zh',
                        'ko-KR': 'ko',
                        'ru-RU': 'ru'
                    };
                    
                    // Use mapped language or extract the base language code
                    if (languageMap[SYSTEM_LOCALE]) {
                        uiLanguage = languageMap[SYSTEM_LOCALE];
                    } else if (SYSTEM_LOCALE.includes('-')) {
                        uiLanguage = SYSTEM_LOCALE.split('-')[0];
                    }
                    
                    mainWindow.webContents.executeJavaScript(`
                        localStorage.setItem('language', '${uiLanguage}');
                        if (typeof changeLanguage === 'function') {
                            changeLanguage('${uiLanguage}');
                        }
                    `);
                }
            } catch (e) {
                console.log('Could not inject language preference:', e);
            }
        }
        
        if (mainWindow && mainWindow.webContents && mainWindow.webContents.getURL().includes("youtube.com")) {
            log("Youtube ad skipper inserted");
            if (!YT_AD_SKIPPER_INTERVAL) {
            const adSkipperInterval = YT_AD_SKIPPER_INTERVAL = setInterval(
                function(mw) {
                    try {
                        if (!mw || mw.isDestroyed()) {
                            clearInterval(adSkipperInterval);
                            YT_AD_SKIPPER_INTERVAL = null;
                            return;
                        }
                        mw.webContents.executeJavaScript(
                            '\
						if (!xxxxxx){\
							var xxxxxx = setInterval(function(){\
							if (document.querySelector(".ytp-ad-skip-button")){\
								document.querySelector(".ytp-ad-skip-button").click();\
							}\
							},500);\
						}\
					'
                        );
                    } catch (e) {
                        clearInterval(adSkipperInterval);
                        YT_AD_SKIPPER_INTERVAL = null;
                        return;
                    }
                },
                5000,
                mainWindow
            );
            
            // Store interval for cleanup
            if (!mainWindow.intervals) mainWindow.intervals = [];
            mainWindow.intervals.push(adSkipperInterval);

            // Attach a one-time navigation handler to clear page-level timer when leaving YouTube
            if (!mainWindow.__ytSkipperNavHandlerAttached) {
                const clearYtPageTimer = () => {
                    try {
                        mainWindow.webContents.executeJavaScript('try{ if (window.xxxxxx){ clearInterval(window.xxxxxx); window.xxxxxx=null; } }catch(e){}');
                    } catch (_) {}
                };
                try {
                    mainWindow.webContents.on('did-navigate', (event, url) => {
                        if (url && !url.includes('youtube.com')) clearYtPageTimer();
                    });
                    mainWindow.webContents.on('did-navigate-in-page', () => {
                        try {
                            const cu = mainWindow.webContents.getURL() || '';
                            if (!cu.includes('youtube.com')) clearYtPageTimer();
                        } catch (_) {}
                    });
                    mainWindow.__ytSkipperNavHandlerAttached = true;
                } catch (_) {}
            }
            }
        }

        mainWindow.webContents.executeJavaScript(`
			document.addEventListener('wheel', (event) => {
			  if (event.ctrlKey) {
				event.preventDefault();
				const direction = event.deltaY < 0 ? 'in' : 'out';
				require('electron').ipcRenderer.send('zoom', direction);
			  }
			}, { passive: false });
		  `);

        if (CSSCONTENT && mainWindow && mainWindow.webContents) {
            try {
                mainWindow.webContents.insertCSS(CSSCONTENT, {
                    cssOrigin: "user"
                });
                log("Inserting specified CSS contained in the file");
            } catch (e) {
                log(e);
            }
        }

        //
    });

    ipcMain.on("postMessage", function(eventRet, ...args) {
        var tabID = -1;
        var options = {};

        if (args.length >= 2) {
            if (args[1] && args[1].tabID) {
                tabID = args[1].tabID;
                options = args[1];
            }
        }
        
        // Also check for tabID in the message data itself
        if (args[0] && args[0].__tabID__ !== undefined) {
            tabID = args[0].__tabID__;
            // Don't delete it here as it might be needed by background.html
        }

        try {
            let sssurl = eventRet.sender.getURL().toLowerCase();
            if (sssurl.startsWith("https://socialstream.ninja/dock.html?") || sssurl.startsWith("https://beta.socialstream.ninja/dock.html?") || (sssurl.startsWith("file://") && sssurl.includes("/dock.html?"))) {
                return;
            } else if (sssurl.startsWith("https://socialstream.ninja/featured.html?") || sssurl.startsWith("https://beta.socialstream.ninja/featured.html?") || (sssurl.startsWith("file://") && sssurl.includes("/featured.html?"))) {
                return;
            }
        } catch (e) {}

        // Handle generic WebSocket status signals (from WSS pages)
        try {
            if (args[0] && args[0].wssStatus) {
                const payload = {
                    tabID,
                    ...(args[0].wssStatus || {})
                };
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('wssStatus', payload);
                }
                // respond quickly for sendMessage callbacks
                eventRet.returnValue = { ok: true };
                return;
            }
        } catch (_) {}

        if (args[0] && args[0].getSettings) {
            let tab = options.tabID || tabID;

            // Create settings response matching background.js format
            let settingsResponse = {
                settings: cachedState.settings || {},
                state: cachedState.state !== undefined ? cachedState.state : true,
                streamID: cachedState.streamID || null,
                password: cachedState.password || null
            };
            
            log("getSettings request - returning cachedState:", JSON.stringify(settingsResponse).substring(0, 200));

            const settingsView = getActiveBrowserView(tab);
            if (settingsView && settingsView.webContents) {
                try {
                    log("-----------------------------------------");
                    log(settingsView);
                    if ("muted" in settingsView.args) {
                        if (settingsView.args.muted) {
                            settingsView.webContents.setAudioMuted(true);
                            settingsView.webContents.send("sendToTab", {
                                muteWindow: true
                            });
                        }
                    } else {
                        log("SENDING MUTE");
                        settingsView.webContents.setAudioMuted(true);
                        settingsView.webContents.send("sendToTab", {
                            muteWindow: true
                        });
                    }
                } catch (error) {
                    console.error('Failed to enforce mute state on settings response:', error);
                }
            }

            eventRet.returnValue = settingsResponse;
            return;
        }

        if (mainWindow && mainWindow.webContents) {
            // log("on postMessage:"); // Commented out to reduce spam
            var sender = {};
            sender.tab = {};
            sender.tab.id = tabID;
            if (eventRet.sender && eventRet.sender.getURL) {
                sender.tab.url = eventRet.sender.getURL();
            }
            
            mainWindow.webContents.mainFrame.frames.forEach((frame) => {
                if (frame.url.split("?")[0].endsWith("background.html")) {
                    frame.postMessage("fromMainSender", [args[0], {
                        ...sender
                    }]);
                }
            });
            
            // Return response with message ID for callbacks
            if (args[0] && args[0].message) {
                const response = {
                    state: cachedState.state !== undefined ? cachedState.state : true
                };
                if (args[0].message.id !== undefined) {
                    response.id = args[0].message.id;
                }
                eventRet.returnValue = response;
                return;
            }
        }
        eventRet.returnValue = cachedState || {
            settings: {}
        };
    });

    ipcMain.on("getAppVersion", function(eventRet) {
        try {
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send("appVersion", app.getVersion());
            }
        } catch (e) {
            console.error(e);
        }
    });

    ipcMain.on('zoom', (event, direction) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.webContents.emit('zoom-changed', event, direction);
        }
    });

    // Keep the synchronous version for backward compatibility
    ipcMain.on("nodefetch", function(eventRet, args) {
        log("NODE FETCHING! (sync)");
        fetch(args.url, {
                method: args.method || "GET",
                headers: args.headers,
                body: args.method === 'POST' ? JSON.stringify(args.body) : undefined,
                timeout: args.timeout || 30000
            })
            .then((response) => {
                log(response);
                return response.text().then(text => ({
                    status: response.status,
                    data: text
                }));
            })
            .then((result) => {
                eventRet.returnValue = result;
            })
            .catch((error) => {
                console.error("Fetch error:", error);
                eventRet.returnValue = {
                    status: 500,
                    error: error.message
                };
            });
    });

    // Add async version
    ipcMain.handle("nodefetch", async function(event, args) {
        log("NODE FETCHING! (async)");
        try {
            const response = await fetch(args.url, {
                method: args.method || "GET",
                headers: args.headers,
                body: args.method === 'POST' ? JSON.stringify(args.body) : undefined,
                timeout: args.timeout || 30000
            });
            
            const text = await response.text();
            return {
                status: response.status,
                data: text
            };
        } catch (error) {
            console.error("Fetch error:", error);
            return {
                status: 500,
                error: error.message
            };
        }
    });

    ipcMain.on("nodepost", function(eventRet, args2) {
        log("NODE POSTING!");
        fetch(args2.url, {
                method: "POST",
                headers: args2.headers,
                body: (typeof args2.body === 'object') ? JSON.stringify(args2.body) : args2.body,
            })
            .then((response) => response.text())
            .then((data) => {
                eventRet.returnValue = data;
            })
            .catch((error) => {
                log(error);
                eventRet.returnValue = null;
            });
    });

    ipcMain.on("nodeput", function(eventRet, args2) {
        log("NODE PUTTING!");
        fetch(args2.url, {
                method: "PUT",
                headers: args2.headers,
                body: (typeof args2.body === 'object') ? JSON.stringify(args2.body) : args2.body,
            })
            .then((response) => response.text())
            .then((data) => {
                eventRet.returnValue = data;
            })
            .catch((error) => {
                log(error);
                eventRet.returnValue = null;
            });
    });


    ipcMain.on("streaming-nodepost", async (event, args) => {
        const {
            channelId,
            url,
            body,
            headers
        } = args;
        const abortController = new AbortController();

        try {
            const response = await undiciFetch(url, {
                method: "POST",
                headers: headers,
                body: (typeof body === 'object') ? JSON.stringify(body) : body,
                signal: abortController.signal
            });


            if (!response.ok) {
                // log("FAILLLLLLLLL "+response.status);
                event.reply(channelId, {
                    error: response.status,
                    message: `HTTP error! status: ${response.status}`
                });
                return;
            }


            const reader = response.body.getReader();

            while (true) {
                const {
                    done,
                    value
                } = await reader.read();
                if (done) {
                    event.reply(channelId, null); // Signal end of stream
                    break;
                }

                const chunk = new TextDecoder().decode(value);
                event.reply(channelId, chunk);
                // {"model":"llama3.2:latest","created_at":"2024-10-11T07:49:42.864094Z","response":"","done":true,"done_reason":"stop","context":[128006,9125,128007,271,38766,1303,33025,2696,25,6790,220,2366,18,271,128009,128006,882,128007,271,882,25,24748,198,78191,25,128009,128006,78191,128007,271,9906,0,2650,649,358,7945,499,3432,30],"total_duration":196930300,"load_duration":19191800,"prompt_eval_count":31,"prompt_eval_duration":21749000,"eval_count":10,"eval_duration":154659000}
            }

        } catch (error) {
            console.error('Fetch error:', error);
            event.reply(channelId, null);
        }

        ipcMain.once(`${channelId}-abort`, () => {
            abortController.abort();
        });

        ipcMain.once(`${channelId}-close`, () => {
            // Clean up any resources if needed
        });
    });


    function getPrimaryDomain(url) {
        try {

            if (url.startsWith("about:blank") || url.startsWith("https://about:blank")) {
                return null;
            }
            // Ensure the URL has a protocol
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }

            const parsedUrl = new URL(url);
            const hostParts = parsedUrl.hostname.split('.');

            // Check if it's a common subdomain like 'www'
            if (hostParts.length > 2 && hostParts[0] === 'www') {
                return hostParts.slice(-2).join('.');
            }

            // Return the last two parts of the hostname
            return hostParts.slice(-2).join('.');
        } catch (error) {
            console.error('Invalid URL:', error);
            return null;
        }
    }
    
    function getDomainToPlatform(domain) {
        // Map common domains to platform names (without TLD)
        const domainMap = {
            'youtube.com': 'youtube',
            'twitch.tv': 'twitch',
            'kick.com': 'kick',
            'tiktok.com': 'tiktok',
            'facebook.com': 'facebook',
            'instagram.com': 'instagram',
            'x.com': 'x',
            'twitter.com': 'x',
            'rumble.com': 'rumble',
            'dlive.tv': 'dlive',
            'trovo.live': 'trovo',
            'vimeo.com': 'vimeo',
            'restream.io': 'restream',
            'zoom.us': 'zoom'
        };
        
        return domainMap[domain] || domain;
    }

    ipcMain.on("signIn", function(eventRet, args2) {
        log("IPC CREATE WINDOW - SIGN IN");
        var args = Object.assign({}, Argv, args2);

        if (!args.url) {
            log("No URL; can't load");
            eventRet.returnValue = null;
            return;
        }

        args.url = args.url.trim();
        if (args.url == null || args.url == "https://null") {
            args.url = "https://google.com";
        }

        // Handle existing tab case
        if (args.tab) {
            const existingView = getActiveBrowserView(args.tab);
            if (existingView && existingView.webContents) {
                log("Existing tab");
                try {
                    if (args?.config?.userAgent) {
                        existingView.webContents.loadURL(args.url, {
                            userAgent: args.config.userAgent
                        });
                    } else {
                        existingView.webContents.loadURL(args.url);
                    }
                    eventRet.returnValue = args.tab;
                    return;
                } catch (e) {
                    console.error(e);
                }
            }
        }

        // Create new window
        createSignInWindow(args).then(windowId => {
            eventRet.returnValue = windowId;
        }).catch(error => {
            console.error('Failed to create sign-in window:', error);
            eventRet.returnValue = null;
        });
    });


    function getSignInUserAgent(url, config, configs) {
        try {
            // Prefer per-target signin UA, then per-target UA, then global signin UA, then global UA, else 'Chrome'
            if (config?.signin?.userAgent) return config.signin.userAgent;
            if (config?.userAgent) return config.userAgent;
            if (configs?.global?.signin?.userAgent) return configs.global.signin.userAgent;
            if (configs?.global?.userAgent) return configs.global.userAgent;
            return 'Chrome';
        } catch (e) {
            console.error(e);
            return 'Chrome';
        }
    }

    

    async function createSignInWindow(args) {
        try {
            const domain = getPrimaryDomain(args.url);
            
            // Always use in-app sign-in (never system browser)

            // Determine session partition name first (same logic as below)
            let sessionPartition;
            if (args.customSession && args.customSession !== 'AUTO') {
                if (args.customSession.startsWith('default-')) {
                    const platform = args.customSession.replace('default-', '');
                    sessionPartition = `persist:${platform}`;
                } else {
                    sessionPartition = `persist:custom-${args.customSession}`;
                }
            } else {
                const platform = getDomainToPlatform(domain);
                sessionPartition = `persist:${platform}`;
            }

            // Now check for existing session using the correct partition
            const ses = session.fromPartition(sessionPartition);
            const existingCookies = await ses.cookies.get({});
            const hasExistingSession = existingCookies.length > 0;

            // Simple, config-driven popup behavior
            // Popup policy: per-target override wins, otherwise global, default allow
            let allowPopups = true;
            if (args?.config?.signin && args.config.signin.allowPopups === false) {
                allowPopups = false;
            } else if (args?.configs?.global?.signin && args.configs.global.signin.allowPopups === false) {
                allowPopups = false;
            }
            // Removed SSO-specific UA map; keep behavior simple and config-driven per target

            let shouldClearSession = false;

            if (hasExistingSession) {
                // Show confirmation dialog
                const result = await dialog.showMessageBox(mainWindow, {
                    type: 'question',
                    buttons: ['Keep Session (Recommended)', 'Sign Out (Clear Session - Not Recommended)'],
                    defaultId: 0,
                    title: 'Existing Session Detected',
                    message: `You have an existing session for ${domain}.`,
                    detail: 'Would you like to keep your current session or sign out and start fresh?\n\nKeeping your session is recommended as it preserves your login state and preferences.',
                    cancelId: 0
                });

                // result.response is 0 for "Keep Session", 1 for "Sign Out"
                shouldClearSession = result.response === 1;
            }

            if (shouldClearSession) {
                // Check if we should preserve Kasada cookies (default: false when clearing)
                const preserveKasadaCookies = false; // Never preserve when user chooses to clear
                
                // Store existing Kasada cookies before clearing
                const kasadaCookieNames = ['KP_UIDz', 'KP_UIDZ', 'kpid', 'kppid', 'kppidg', 'ga__12_abel', 'ga__15_abel', 'ga__12_abel-ssn', 'ga__15_abel-ssn'];
                let kasadaCookies = [];

                // Get all cookies and filter for Kasada ones
                ses.cookies.get({}).then(cookies => {
                    if (preserveKasadaCookies) {
                        kasadaCookies = cookies.filter(cookie =>
                            kasadaCookieNames.some(name => cookie.name.includes(name))
                        );
                        log(`Found ${kasadaCookies.length} Kasada cookies to preserve`);
                    } else {
                        log(`Not preserving Kasada cookies (preserveAntiBot: false)`);
                    }

                    // Clear all session data
                    ses.clearStorageData({
                        storages: [
                            'appcache',
                            'cookies',
                            'filesystem',
                            'indexdb',
                            'localstorage',
                            'shadercache',
                            'websql',
                            'serviceworkers',
                            'cachestorage',
                        ],
                        quotas: [
                            'temporary',
                            'persistent',
                            'syncable',
                        ],
                    }).then(() => {
                        // Restore Kasada cookies after clearing
                        kasadaCookies.forEach(cookie => {
                            const cookieDetails = {
                                url: `https://${cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain}${cookie.path}`,
                                name: cookie.name,
                                value: cookie.value,
                                domain: cookie.domain,
                                path: cookie.path,
                                secure: cookie.secure,
                                httpOnly: cookie.httpOnly,
                                expirationDate: cookie.expirationDate,
                                sameSite: cookie.sameSite
                            };

                            ses.cookies.set(cookieDetails).then(() => {
                                log(`Restored Kasada cookie: ${cookie.name}`);
                            }).catch(err => {
                                log(`Failed to restore Kasada cookie ${cookie.name}: ${err}`);
                            });
                        });
                    });
                }).catch(err => {
                    log(`Error getting cookies: ${err}`);
                    // If we can't get cookies, just clear everything as before
                    ses.clearStorageData({
                        storages: [
                            'appcache',
                            'cookies',
                            'filesystem',
                            'indexdb',
                            'localstorage',
                            'shadercache',
                            'websql',
                            'serviceworkers',
                            'cachestorage',
                        ],
                        quotas: [
                            'temporary',
                            'persistent',
                            'syncable',
                        ],
                    });
                });

                // Clear cache operations
                await ses.clearCache();
                await ses.clearHostResolverCache();
                await ses.clearAuthCache();

                // Small delay to ensure clearing operations complete
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                log(`User chose to keep existing session for ${domain}`);
            }

            // Use the session partition we already determined above
            const persistentSession = ses; // We already have this from line 3212
            
            
            log(`[SIGN-IN] URL: ${args.url}, Domain: ${domain}, Platform: ${getDomainToPlatform(domain)}, Session: ${sessionPartition}, CustomSession: ${args.customSession}`);
            
            // Debug: Check cookies after sign-in window closes
            setTimeout(async () => {
                const cookies = await ses.cookies.get({ domain: '.twitch.tv' });
                log(`[SIGN-IN DEBUG] Cookies for .twitch.tv after 5s: ${cookies.length} cookies found`);
                cookies.forEach(cookie => {
                    log(`  - ${cookie.name}: ${cookie.value.substring(0, 10)}... (domain: ${cookie.domain})`);
                });
            }, 5000);
            createdPartitions.add(sessionPartition); // Track this partition
            
            // Kasada interceptor removed - handled by preload-kasada.js instead
            // const { setupKasadaInterceptor } = require('./kasada-intercept');
            // setupKasadaInterceptor(persistentSession);

            // Check if this is a trusted domain
            const trustedDomains = ['socialstream.ninja', 'beta.socialstream.ninja'];
            const isTrustedDomain = trustedDomains.some(trusted =>
                args.url.includes(trusted) || domain === trusted
            );
            

            // Determine preload script based on configuration
            let preloadScript = null;
            
            // Domains known to use Kasada protection
            const kasadaDomains = ['twitch.tv', 'kick.com'];
            const isKasadaDomain = kasadaDomains.some(kd => domain.includes(kd));
            
            // Check if there's a specific preload config for this domain's signin
            if (args.config && args.config.signin && args.config.signin.preload !== undefined) {
                const preloadConfig = args.config.signin.preload;
                if (preloadConfig === 'none' || preloadConfig === false) {
                    preloadScript = null;
                } else if (preloadConfig === 'mock') {
                    preloadScript = 'preload-mock.js';
                } else if (preloadConfig === 'kasada') {
                    preloadScript = 'preload-kasada.js';
                } else if (preloadConfig === 'full') {
                    preloadScript = 'preload.js';
                }
            } else {
                // Default behavior: 
                // - Trusted domains get full preload
                // - Kasada domains get enhanced preload
                // - Others get mock preload
                if (isTrustedDomain) {
                    preloadScript = 'preload.js';
                } else if (isKasadaDomain) {
                    preloadScript = 'preload-kasada.js';
                } else {
                    preloadScript = 'preload-mock.js';
                }
            }
            
            console.log(`Using preload: ${preloadScript || 'none'} for domain: ${domain}`);

            // Build webPreferences object - MATCH WORKING CODE EXACTLY
            const webPreferences = {
                preload: preloadScript ? path.join(__dirname, preloadScript) : undefined,
                
                // Critical Chrome-matching settings from working code
                contextIsolation: (preloadScript === 'preload-kasada.js') ? false : true,
                nodeIntegration: false,
                // DON'T set nodeIntegrationInSubFrames - working code doesn't have it
                sandbox: false, // FALSE to avoid automation detection
                webSecurity: true, // TRUE to match working code
                allowRunningInsecureContent: false,
                experimentalFeatures: false,
                // Ensure proper window.open/opener semantics for OAuth popups
                nativeWindowOpen: true,
                
                // Chrome's plugin settings
                plugins: true,
                
                // Chrome's default web preferences
                images: true,
                javascript: true,
                webgl: true,
                
                // Chrome process model
                affinity: 'browser'
            };
            
            // Always specify session
            webPreferences.session = persistentSession;
            
            // Pass Chrome-specific arguments for kasada preload - match working code exactly
            if (preloadScript === 'preload-kasada.js') {
                webPreferences.additionalArguments = [
                    '--enable-blink-features=CSSColorSchemeUARendering',
                    '--enable-features=WebUIDarkMode',
                    '--force-color-profile=srgb',
                    '--metrics-recording-only',
                    '--no-first-run',
                    '--password-store=basic',
                    '--use-mock-keychain'
                ];
            }

            // Create window - minimal for kasada to match working code EXACTLY
            let windowOptions = {
                width: 1280,
                height: 720,
                webPreferences: webPreferences
            };
            
            // Only add extra options if NOT using kasada
            if (preloadScript !== 'preload-kasada.js') {
                windowOptions = {
                    ...windowOptions,
                    minWidth: 400,
                    minHeight: 300,
                    backgroundColor: '#ffffff',
                    show: false,
                    frame: true,
                    hasShadow: true,
                    thickFrame: true,
                    titleBarStyle: 'default',
                    center: true,
                    movable: true,
                    resizable: true,
                    closable: true,
                    focusable: true,
                    fullscreenable: true,
                    minimizable: true,
                    maximizable: true
                };
            } else {
                // For kasada, match working code exactly
                windowOptions.minWidth = 400;
                windowOptions.minHeight = 300;
                windowOptions.backgroundColor = '#ffffff';
                windowOptions.show = false;
                // Chrome's frame options from working code
                windowOptions.frame = true;
                windowOptions.hasShadow = true;
                windowOptions.thickFrame = true;
                windowOptions.titleBarStyle = 'default';
                // Chrome window behavior
                windowOptions.center = true;
                windowOptions.movable = true;
                windowOptions.resizable = true;
                windowOptions.closable = true;
                windowOptions.focusable = true;
                windowOptions.fullscreenable = true;
                windowOptions.minimizable = true;
                windowOptions.maximizable = true;
            }
            
            const view = new BrowserWindow(windowOptions);
            
            // Chrome's loading behavior
            view.once('ready-to-show', () => {
                view.show();
            });
            
            // Enhanced protection when Kasada preload is used
            // This applies to any domain where the user has specified kasada preload in config
            if (preloadScript === 'preload-kasada.js') {
                log(`Using minimal config for kasada (matching working code)...`);
                // Additional session configuration for Kasada
                persistentSession.setPermissionRequestHandler((webContents, permission, callback) => {
                    // Match Chrome's default permission behavior
                    const allowedByDefault = ['clipboard-read', 'clipboard-write', 'fullscreen'];
                    callback(allowedByDefault.includes(permission));
                });
            }

            view.setMenuBarVisibility(true);

            // Set Content-Security-Policy once per session to avoid listener accumulation (skip for Kasada)
            if (preloadScript !== 'preload-kasada.js') {
                const ses = view.webContents.session;
                if (ses && !cspConfiguredSessions.has(ses)) {
                    ses.webRequest.onHeadersReceived((details, callback) => {
                        try {
                            callback({
                                responseHeaders: {
                                    ...details.responseHeaders,
                                    'Content-Security-Policy': ["default-src 'self' https: wss: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:;"]
                                }
                            });
                        } catch (e) {
                            callback({ responseHeaders: details.responseHeaders });
                        }
                    });
                    cspConfiguredSessions.add(ses);
                }
            }

            // Store window configuration
            view.args = args;
            view.tabID = generateUniqueWindowId();
            log("Generated tabID for sign-in window:", view.tabID);
            // Initialize logical visibility flag for stealth-hide/show
            view.__ss_visible = true;
            try { view.setSkipTaskbar(false); } catch(_){}
            browserViews[view.tabID] = view;


            // Skip header manipulation for kasada preload - let it work like the working code
            if (args.config && args.config.userAgent && args.config.mockUserAgentData && preloadScript !== 'preload-kasada.js') {
                const session = view.webContents.session;
                // Guard: avoid stacking client hints handlers on the same session
                if (session && !clientHintsConfiguredSessions.has(session)) {

                // Don't set user agent here - let it be set once at session creation
                // session.setUserAgent(args.config.userAgent);

                // First, handle the Accept-CH response headers to prevent client hints negotiation
                session.webRequest.onHeadersReceived({
                        urls: ['*://*/*']
                    },
                    (details, callback) => {
                        const responseHeaders = details.responseHeaders;

                        // Remove Accept-CH headers that trigger client hints
                        delete responseHeaders['Accept-CH'];
                        delete responseHeaders['accept-ch'];

                        callback({
                            responseHeaders
                        });
                    }
                );

                // Use onBeforeRequest to modify the request details
                session.webRequest.onBeforeRequest({
                        urls: ['*://*/*']
                    },
                    (details, callback) => {
                        callback({
                            cancel: false
                        });
                    }
                );

                // Minimal header modification - let Chromium handle most headers naturally
                session.webRequest.onBeforeSendHeaders({
                        urls: ['*://*/*']
                    },
                    (details, callback) => {
                        const {
                            requestHeaders
                        } = details;

                        // Don't manipulate User-Agent in headers - let session handle it
                        /* DISABLED - This manipulation might be causing iframe issues
                        if (args.config.userAgent) {
                            requestHeaders['User-Agent'] = args.config.userAgent;
                            
                            // Handle Client Hints based on browser type
                            const chromeMatch = args.config.userAgent.match(/Chrome\/(\d+)/);
                            const firefoxMatch = args.config.userAgent.match(/Firefox\/(\d+)/);
                            const edgeMatch = args.config.userAgent.match(/Edg\/(\d+)/);
                            
                            if (chromeMatch) {
                                const chromeVersion = chromeMatch[1];
                                
                                // Set Client Hints headers to match the User-Agent
                                requestHeaders['sec-ch-ua'] = `"Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}", "Not;A=Brand";v="99"`;
                                requestHeaders['sec-ch-ua-mobile'] = '?0';
                                requestHeaders['sec-ch-ua-platform'] = '"Windows"';
                                
                                // Only set full version list if requested by server
                                if (requestHeaders['sec-ch-ua-full-version-list']) {
                                    requestHeaders['sec-ch-ua-full-version-list'] = `"Google Chrome";v="${chromeVersion}.0.0.0", "Chromium";v="${chromeVersion}.0.0.0", "Not;A=Brand";v="99.0.0.0"`;
                                }
                            } else if (edgeMatch) {
                                const edgeVersion = edgeMatch[1];
                                
                                // Edge also uses Chromium-based Client Hints
                                requestHeaders['sec-ch-ua'] = `"Microsoft Edge";v="${edgeVersion}", "Chromium";v="${edgeVersion}", "Not;A=Brand";v="99"`;
                                requestHeaders['sec-ch-ua-mobile'] = '?0';
                                requestHeaders['sec-ch-ua-platform'] = '"Windows"';
                            } else if (firefoxMatch) {
                                // Firefox doesn't send Client Hints headers - remove them if present
                                delete requestHeaders['sec-ch-ua'];
                                delete requestHeaders['sec-ch-ua-mobile'];
                                delete requestHeaders['sec-ch-ua-platform'];
                                delete requestHeaders['sec-ch-ua-full-version-list'];
                            }
                        }
                        */ // END DISABLED BLOCK

                        // Remove any Electron-specific headers that might give us away
                        delete requestHeaders['Electron'];

                        callback({
                            requestHeaders
                        });
                    }
                );
                clientHintsConfiguredSessions.add(session);
                }
            }

            // Set window bounds
            if (args.size) {
                view.setBounds({
                    x: 635,
                    y: 100,
                    width: Math.max(parseInt(args.size.width), 0) || 1100,
                    height: Math.max(0, parseInt(args.size.height)) || 600,
                });
            } else if (args.config && args.config.size) {
                view.setBounds({
                    x: 635,
                    y: 100,
                    width: args.config.size.width,
                    height: args.config.size.height
                });
            } else {
                view.setBounds({
                    x: 635,
                    y: 100,
                    width: 1100,
                    height: 600
                });
            }


            // Set up window behaviors
            if (view.webContents) {
                // Handle audio
                if ("muted" in args) {
                    log(`Setting audio muted to: ${args.muted}`);
                    view.webContents.setAudioMuted(args.muted);
                } else {
                    log("No muted arg, defaulting to muted=true");
                    view.webContents.setAudioMuted(true);
                }

                // Set window title
                const hostname = new URL(args.url).hostname;

                view.setTitle(`${hostname} - ⚠️⚠️ Close this window after signing in ⚠️⚠️`);

                view.on('page-title-updated', (event, title) => {
                    event.preventDefault();
                    const hostname = new URL(view.webContents.getURL()).hostname;
                    view.setTitle(`${hostname} - ⚠️⚠️ Close this window after signing in ⚠️⚠️`);
                });

                view.webContents.on("zoom-changed", (event, zoomDirection) => {
                    const currentZoom = view.webContents.getZoomFactor();
                    if (zoomDirection === "in") {
                        view.webContents.setZoomFactor(currentZoom + 0.1);
                    } else if (zoomDirection === "out") {
                        view.webContents.setZoomFactor(currentZoom - 0.1);
                    }
                });

                view.webContents.on("before-input-event", (event, input) => {
                    if (input.control && input.type === "mouseWheel") {
                        const zoomDirection = input.deltaY < 0 ? "in" : "out";
                        view.webContents.emit("zoom-changed", event, zoomDirection);
                    }
                });

                view.webContents.setWindowOpenHandler(({ url }) => {
                    if (!allowPopups) {
                        // Open OAuth target in the same window instead of a popup
                        try {
                            const ua = getSignInUserAgent(url, args.config, args.configs);
                            try { view.webContents.setUserAgent(ua); } catch(_) {}
                            view.webContents.loadURL(url, { userAgent: ua }).catch(() => {});
                        } catch(_) {}
                        return { action: 'deny' };
                    }
                    const childContextIsolation = webPreferences.contextIsolation;
                    return {
                        action: 'allow',
                        overrideBrowserWindowOptions: {
                            autoHideMenuBar: false,
                            frame: true,
                            titleBarStyle: 'default',
                            title: `${new URL(url).hostname} - ⚠️⚠️ Close this window after signing in ⚠️⚠️`,
                            webPreferences: {
                                nodeIntegration: false,
                                contextIsolation: childContextIsolation,
                                nativeWindowOpen: true,
                                sandbox: false,
                                webviewTag: false,
                                webSecurity: true,
                                allowRunningInsecureContent: false,
                                additionalPermissions: ['clipboard-write']
                            }
                        }
                    };
                });


                view.webContents.on('will-navigate', (event, url) => {
                    if (url.includes('oauth') || url.includes('signin') || url.includes('login')) {
                        try {
                            const userAgent = getSignInUserAgent(url, args.config, args.configs);
                            view.webContents.setUserAgent(userAgent);
                        } catch (_) {}
                    }
                });

                

                // Inject chrome.runtime mock for sign-in windows that need it
                view.webContents.on('dom-ready', () => {
                    log('Sign-in window DOM ready, checking if chrome.runtime mock needed');

                    // Skip ALL injection for kasada preload - let it work like the working code
                    if (preloadScript === 'preload-kasada.js') {
                        log('Skipping all DOM injections for kasada preload');
                        return;
                    }

                    // Check if this is a page that needs chrome.runtime (like twitch.html)
                    const currentURL = view.webContents.getURL();
                    if (currentURL.includes('twitch.html') || currentURL.includes('tiktok.html')) {
                        log('Injecting chrome.runtime mock for sign-in window');
                        const chromeRuntimeCode = `
                            if (!window.chrome) {
                                window.chrome = {};
                            }
                            if (!window.chrome.runtime) {
                                window.chrome.runtime = {
                                    id: 'socialstream-extension-mock',
                                    sendMessage: function(extensionId, message, callback) {
                                                                                
                                        // Handle specific message types
                                        if (message && message.getSettings) {
                                            // Return mock settings response
                                            if (callback) {
                                                setTimeout(() => {
                                                    callback({
                                                        state: true,
                                                        streamID: 'mock-stream',
                                                        settings: {}
                                                    });
                                                }, 0);
                                            }
                                        } else if (callback) {
                                            // For other messages, just call the callback with an empty response
                                            setTimeout(() => {
                                                callback({});
                                            }, 0);
                                        }
                                    },
                                    onMessage: {
                                        addListener: function(listener) {
                                            console.log('[Chrome Runtime Mock] onMessage.addListener called');
                                            // Store the listener but don't do anything with it for now
                                            window.chrome.runtime.onMessage._listeners = window.chrome.runtime.onMessage._listeners || [];
                                            window.chrome.runtime.onMessage._listeners.push(listener);
                                        },
                                        removeListener: function(listener) {
                                            console.log('[Chrome Runtime Mock] onMessage.removeListener called');
                                            if (window.chrome.runtime.onMessage._listeners) {
                                                const index = window.chrome.runtime.onMessage._listeners.indexOf(listener);
                                                if (index > -1) {
                                                    window.chrome.runtime.onMessage._listeners.splice(index, 1);
                                                }
                                            }
                                        },
                                        _listeners: []
                                    }
                                };
                                console.log('[Chrome Runtime Mock] Injection complete for sign-in window');
                            } else {
                                console.log('[Chrome Runtime Mock] chrome.runtime already exists in sign-in window');
                            }
                        `;
                        view.webContents.executeJavaScript(chromeRuntimeCode).catch(err => {
                            console.error('Failed to inject chrome.runtime in sign-in window:', err);
                        });
                    }
                    
                    // Inject additional anti-detection code for all sign-in windows
                    const antiDetectionCode = `
                        // Additional anti-detection measures for Kasada
                        (function() {
                            // Override navigator.permissions more thoroughly
                            if (navigator.permissions && navigator.permissions.query) {
                                const originalQuery = navigator.permissions.query;
                                navigator.permissions.query = function(descriptor) {
                                    return new Promise((resolve) => {
                                        // Return realistic permission states
                                        let state = 'prompt';
                                        if (descriptor.name === 'clipboard-read' || descriptor.name === 'clipboard-write') {
                                            state = 'granted';
                                        }
                                        
                                        resolve({
                                            state: state,
                                            onchange: null,
                                            addEventListener: () => {},
                                            removeEventListener: () => {},
                                            dispatchEvent: () => true
                                        });
                                    });
                                };
                            }
                            
                            // Fix Notification.permission
                            try {
                                Object.defineProperty(Notification, 'permission', {
                                    get: () => 'default',
                                    configurable: true
                                });
                            } catch(e) {}
                            
                            // Remove CDP artifacts
                            delete window.$cdc_asdjflasutopfhvcZLmcfl_;
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
                            
                            // Override runtime detection
                            const originalRuntime = window.chrome?.runtime;
                            if (window.chrome && !originalRuntime) {
                                Object.defineProperty(window.chrome, 'runtime', {
                                    get: () => undefined,
                                    configurable: true
                                });
                            }
                            
                            // Fix window.chrome properties
                            if (window.chrome) {
                                // Add csi function (Chrome Speed Index)
                                if (!window.chrome.csi) {
                                    window.chrome.csi = function() {
                                        return {
                                            onloadT: Date.now(),
                                            startE: Date.now() - 1000,
                                            pageT: Date.now() - Date.now(),
                                            tran: 15
                                        };
                                    };
                                }
                                
                                // Add loadTimes (deprecated but still checked)
                                if (!window.chrome.loadTimes) {
                                    window.chrome.loadTimes = function() {
                                        return {
                                            requestTime: Date.now() / 1000 - 1,
                                            startLoadTime: Date.now() / 1000 - 0.5,
                                            commitLoadTime: Date.now() / 1000 - 0.3,
                                            finishDocumentLoadTime: Date.now() / 1000 - 0.1,
                                            finishLoadTime: Date.now() / 1000,
                                            firstPaintTime: Date.now() / 1000 - 0.2,
                                            firstPaintAfterLoadTime: 0,
                                            navigationType: "Other",
                                            wasFetchedViaSpdy: false,
                                            wasNpnNegotiated: true,
                                            npnNegotiatedProtocol: "h2",
                                            wasAlternateProtocolAvailable: false,
                                            connectionInfo: "h2"
                                        };
                                    };
                                }
                            }
                            
                            // Override Object.getOwnPropertyNames to hide modifications
                            const originalGetOwnPropertyNames = Object.getOwnPropertyNames;
                            Object.getOwnPropertyNames = function(obj) {
                                const props = originalGetOwnPropertyNames(obj);
                                // Remove suspicious properties from the list
                                return props.filter(prop => !prop.includes('$cdc') && !prop.includes('selenium') && !prop.includes('webdriver'));
                            };
                            
                            // More aggressive CDP detection removal
                            const cdpProps = Object.getOwnPropertyNames(window).filter(prop => prop.includes('$cdc') || prop.includes('_cdc'));
                            cdpProps.forEach(prop => {
                                try {
                                    delete window[prop];
                                } catch(e) {}
                            });
                        })();
                    `;
                    
                    view.webContents.executeJavaScript(antiDetectionCode).catch(err => {
                        console.error('Failed to inject additional anti-detection code:', err);
                    });
                });

                // Kasada monitoring removed - handled by preload-kasada.js
                /*
                view.webContents.on('did-start-loading', () => {
                    const { kasadaBypassScript } = require('./kasada-intercept');
                    view.webContents.executeJavaScript(kasadaBypassScript).catch(err => {
                        console.error('Failed to inject Kasada bypass script:', err);
                    });
                });
                */
                
                // TEMPORARILY DISABLED: Kasada fix injection creates fake KPSDK with placeholder tokens
                // This prevents the real SDK from loading properly
                /*
                view.webContents.on('did-navigate', (event, url) => {
                    if (url.includes('twitch.tv') || url.includes('kick.com')) {
                        // Read and inject the Kasada fix
                        const fs = require('fs');
                        const kasadaFixPath = path.join(__dirname, 'kasada-fix-injection.js');
                        
                        fs.readFile(kasadaFixPath, 'utf8', (err, data) => {
                            if (err) {
                                console.error('Failed to read Kasada fix script:', err);
                                return;
                            }
                            
                            view.webContents.executeJavaScript(data).then(() => {
                                log('Kasada fix injection successful');
                            }).catch(err => {
                                console.error('Failed to inject Kasada fix:', err);
                            });
                        });
                    }
                });
                */

                // Anti-detection is now handled by preload.js to avoid conflicts
                // The preload script provides more comprehensive and consistent spoofing

                // Monitor for new Kasada cookies (if not disabled)
                if (args.config?.signin?.monitorAntiBot !== false) {
                    const sess = view.webContents.session;
                    if (sess && !cookiesListenerConfiguredSessions.has(sess)) {
                        sess.cookies.on('changed', (event, cookie, cause, removed) => {
                            const kasadaCookieNames = ['KP_UIDz', 'KP_UIDZ', 'kpid', 'kppid', 'kppidg'];

                            // Check if this is a Kasada cookie
                            if (kasadaCookieNames.some(name => cookie.name.includes(name))) {
                                if (!removed) {
                                    log(`New Kasada cookie set: ${cookie.name} = ${cookie.value.substring(0, 20)}...`);
                                    log(`Cookie details: domain=${cookie.domain}, path=${cookie.path}, expires=${cookie.expirationDate}`);
                                } else {
                                    log(`Kasada cookie removed: ${cookie.name}`);
                                }
                            }
                        });
                        cookiesListenerConfiguredSessions.add(sess);
                    }
                }

                // Add a small delay before loading to ensure all interceptors are set up
                const loadDelay = view.urlLoadDelay || 100;
                log(`Delaying URL load by ${loadDelay}ms...`);
                setTimeout(() => {
                    log(`Loading sign-in URL: ${args.url}`);
                    if (preloadScript === 'preload-kasada.js') {
                        // Use config user agent if provided, otherwise use platform-specific fallback
                        let userAgent;
                        if (args.config?.userAgent) {
                            userAgent = args.config.userAgent;
                            log(`Loading URL with configured user agent for kasada: ${userAgent}`);
                        } else {
                            // Use platform-specific fallback
                            const CHROME_UA_VERSION = '140.0.0.0';
                            if (isMac) {
                                userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_UA_VERSION} Safari/537.36`;
                            } else if (process.platform === 'linux') {
                                userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_UA_VERSION} Safari/537.36`;
                            } else {
                                userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_UA_VERSION} Safari/537.36`;
                            }
                            log(`Loading URL with platform-specific fallback user agent for kasada: ${userAgent}`);
                        }
                        try { view.webContents.setUserAgent(userAgent); } catch(_) {}
                        view.webContents.loadURL(args.url, {
                            userAgent: userAgent,
                            httpReferrer: {
                                url: '',
                                policy: 'strict-origin-when-cross-origin' // Chrome's default
                            }
                        });
                    } else if (args.config?.userAgent) {
                        log(`Using configured user agent: ${args.config.userAgent}`);
                        try { view.webContents.setUserAgent(args.config.userAgent); } catch(_) {}
                        view.webContents.loadURL(args.url, {
                            userAgent: args.config.userAgent
                        });
                    } else {
                        view.webContents.loadURL(args.url);
                    }
                }, loadDelay);

                view.webContents.on("did-fail-load", function(event, errorCode, errorDescription, validatedURL) {
                    console.error("Sign-in window failed to load:", validatedURL);
                    console.error("Error:", errorDescription, "Code:", errorCode);

                    // Common error codes:
                    // -3 = ERR_ABORTED
                    // -6 = ERR_FILE_NOT_FOUND  
                    // -7 = ERR_TIMED_OUT
                    // -105 = ERR_NAME_NOT_RESOLVED
                    // -106 = ERR_INTERNET_DISCONNECTED

                    if (errorCode === -7) {
                        log("Connection timed out - retrying in 2 seconds...");
                        setTimeout(() => {
                            if (!view.isDestroyed()) {
                                view.webContents.reload();
                            }
                        }, 2000);
                    }
                });

                // Add navigation debugging
                view.webContents.on('did-start-loading', () => {
                    log(`Sign-in window started loading: ${args.url}`);
                });

                view.webContents.on('did-stop-loading', () => {
                    log(`Sign-in window stopped loading`);
                });

                view.webContents.on('dom-ready', () => {
                    log(`Sign-in window DOM ready`);
                });

                // URL loading is already handled above in the setTimeout - DON'T DUPLICATE!

                // Handle window closure
                view.on('closed', () => {
                    const tabID = view.tabID; // Store it immediately
                    log("Sign-in window closed, destroyed: " + view.isDestroyed());

                    // Clean up if possible
                    if (!view.isDestroyed()) {
                        try {
                            view.destroy();
                        } catch (e) {
                            log("Error destroying view: " + e);
                        }
                    }

                    // Always clean up references and send the message
                    if (browserViews[tabID]) {
                        delete browserViews[tabID];
                    }

                    if (mainWindow && !mainWindow.isDestroyed() && !app.isQuitting) {
                        try {
                            log("Sending window-closed event for tab: " + tabID);
                            mainWindow.webContents.send(`window-closed-${tabID}`);
                        } catch (e) {
                            log("Error sending window-closed event: " + e);
                        }
                    }
                });

                return view.tabID;
            }
        } catch (error) {
            console.error('Error creating sign-in window:', error);
            return null;
        }
    }


    // Universal IPC Request Handler
    ipcMain.on('ipc-request', async (event, request) => {
        const { channel, callbackId, data, timestamp } = request;
        
        // Log all IPC requests for debugging
        log(`IPC Request: ${channel} [${callbackId}]`);
        
        try {
            let result;
            
            // Route to appropriate handler based on channel
            switch (channel) {
                case 'createWindow':
                    // Handle window creation
                    result = await handleCreateWindowAsync(data);
                    break;
                    
                case 'storageSave':
                    result = await handleStorageSave(data);
                    break;
                    
                case 'storageLoad':
                    result = await handleStorageLoad(data);
                    break;
                    
                case 'nodefetch':
                    result = await handleNodeFetch(data);
                    break;
                    
                case 'closeWindow':
                    result = await handleCloseWindow(data);
                    break;
                    
                case 'reloadWindow':
                    result = await handleReloadWindow(data);
                    break;
                    
                case 'getWindowInfo':
                    result = await handleGetWindowInfo(data);
                    break;
                    
                default:
                    throw new Error(`Unknown IPC channel: ${channel}`);
            }
            
            // Send success response
            event.sender.send('ipc-response', {
                callbackId,
                result
            });
            
        } catch (error) {
            log(`IPC Error in ${channel}: ${error.message}`);
            
            // Send error response
            event.sender.send('ipc-response', {
                callbackId,
                error: error.message
            });
        }
    });
    
    // Async window creation handler
    async function handleCreateWindowAsync(args2) {
        return new Promise((resolve, reject) => {
            try {
                var args = Object.assign({}, Argv, args2);
                if (!args.url) {
                    reject(new Error("No URL provided"));
                    return;
                }

                const isBetaMode = args.isBetaMode || false;

                // Check if we're already creating a window for this source to prevent duplicates
                if (args.sourceId) {
                    for (const [id, view] of Object.entries(browserViews)) {
                        if (view.args && view.args.sourceId === args.sourceId && !view.isDestroyed()) {
                            log("Window already exists for source: " + args.sourceId);
                            resolve(id);
                            return;
                        }
                    }
                }

                // If updating existing window
                if (args.tab) {
                    const existingView = getActiveBrowserView(args.tab);
                    if (existingView && existingView.webContents) {
                        try {
                            if (args?.config?.userAgent) {
                                existingView.webContents.loadURL(args.url, {
                                    userAgent: args.config.userAgent
                                });
                            } else {
                                existingView.webContents.loadURL(args.url);
                            }
                            resolve(args.tab);
                            return;
                        } catch (e) {
                            reject(e);
                            return;
                        }
                    }
                }

                // For now, run the sync handler in a non-blocking way
                setImmediate(() => {
                    const mockEvent = {
                        returnValue: null
                    };
                    
                    try {
                        log("Calling originalCreateWindowHandler for async request");
                        originalCreateWindowHandler(mockEvent, args2);
                        
                        if (mockEvent.returnValue) {
                            log(`Async handler got window ID: ${mockEvent.returnValue}`);
                            resolve(mockEvent.returnValue);
                        } else {
                            log("Async handler got no window ID");
                            reject(new Error("No window ID returned"));
                        }
                    } catch (e) {
                        log(`Error in async window creation: ${e.message}`);
                        reject(e);
                    }
                });
                
            } catch (error) {
                log(`Outer error in handleCreateWindowAsync: ${error.message}`);
                reject(error);
            }
        });
    }
    
    // Keep the old sync handler for backward compatibility  
    const originalCreateWindowHandler = function(eventRet, args2) {
        log("IPC CREATE WINDOW");
        var args = Object.assign({}, Argv, args2);
        if (!args.url) {
            log("No URL; can't load");
            eventRet.returnValue = null;
            return;
        }

        const isBetaMode = args.isBetaMode || false;

        // Check if we're already creating a window for this source to prevent duplicates
        if (args.sourceId) {
            for (const [id, view] of Object.entries(browserViews)) {
                if (view.args && view.args.sourceId === args.sourceId && !view.isDestroyed()) {
                    log("Window already exists for source: " + args.sourceId);
                    eventRet.returnValue = id;
                    return;
                }
            }
        }

        // If updating existing window
        if (args.tab) {
            const existingView = getActiveBrowserView(args.tab);
            if (existingView && existingView.webContents) {
                try {
                    if (args?.config?.userAgent) {
                        existingView.webContents.loadURL(args.url, {
                            userAgent: args.config.userAgent
                        });
                    } else {
                        existingView.webContents.loadURL(args.url);
                    }
                    eventRet.returnValue = args.tab;
                    return;
                } catch (e) {
                    console.error(e);
                }
            }
        }

        var loaded = false;
        var timeout = false;

        let visibibility = true;
        if ("visible" in args && !args.visible) {
            visibibility = false;
        }


        // Determine session based on customSession parameter
        let sessionPartition;
        let persistentSession;
        
        if (args.customSession && args.customSession !== 'AUTO') {
            // Use custom session
            if (args.customSession.startsWith('default-')) {
                // Platform default (e.g., 'default-youtube')
                const platform = args.customSession.replace('default-', '');
                sessionPartition = `persist:${platform}`;
            } else {
                // Custom user-defined session
                sessionPartition = `persist:custom-${args.customSession}`;
            }
            log(`Using custom session: ${sessionPartition}`);
        } else {
            // AUTO - use platform-based session (without TLD)
            const domain = getPrimaryDomain(args.url);
            const platform = getDomainToPlatform(domain);
            sessionPartition = `persist:${platform}`;
            log(`Using auto session based on platform: ${sessionPartition}`);
        }
        
        // Always use the platform-based session, regardless of preload type
        persistentSession = session.fromPartition(sessionPartition);
        createdPartitions.add(sessionPartition); // Track this partition
        const domain = getPrimaryDomain(args.url);
        const platform = getDomainToPlatform(domain);
        log(`[ACTIVATE] URL: ${args.url}, Domain: ${domain}, Platform: ${platform}, Session: ${sessionPartition}, CustomSession: ${args.customSession}`);
        
        // Language is now set globally via command line to match system locale
        // This avoids Electron's en-GB bug for Canadians and should work properly
        log(`[ACTIVATE] Using system locale: ${SYSTEM_LOCALE} (set globally via command line)`)
        
        // Debug: Check cookies when activate window is created
        persistentSession.cookies.get({ domain: '.twitch.tv' }).then(cookies => {
            log(`[ACTIVATE DEBUG] Cookies for .twitch.tv: ${cookies.length} cookies found`);
            cookies.forEach(cookie => {
                log(`  - ${cookie.name}: ${cookie.value.substring(0, 10)}... (domain: ${cookie.domain})`);
            });
        }).catch(err => {
            log(`[ACTIVATE DEBUG] Error getting cookies: ${err}`);
        });

        try {
            let webSecurity = true;
            if (args.config && ("webSecurity" in args.config)) {
                webSecurity = args.config.webSecurity;
            }
            let contextIsolation = true;
            if (args.config && ("contextIsolation" in args.config)) {
                contextIsolation = args.config.contextIsolation;
            }

            // Allow websocket windows to select a preload via config (to better match sign-in behavior)
            // Supported values: 'mock' -> preload-mock.js, 'kasada' -> preload-kasada.js, 'full'|true -> preload.js, 'none'|false -> no preload
            let preloadPath = path.join(__dirname, 'preload.js');
            if (args.wss && args.config && ("preload" in args.config)) {
                const p = args.config.preload;
                if (p === 'mock') {
                    preloadPath = path.join(__dirname, 'preload-mock.js');
                } else if (p === 'kasada') {
                    preloadPath = path.join(__dirname, 'preload-kasada.js');
                    // Match sign-in behavior: disable contextIsolation for kasada preload unless explicitly overridden
                    if (!("contextIsolation" in (args.config || {}))) {
                        contextIsolation = false;
                    }
                } else if (p === 'full' || p === true) {
                    preloadPath = path.join(__dirname, 'preload.js');
                } else if (p === 'none' || p === false) {
                    preloadPath = null; // omit preload entirely
                } else if (typeof p === 'string') {
                    // Allow specifying a custom preload file relative to app dir
                    preloadPath = path.join(__dirname, p);
                }
            }

            log("Context isolation for window:", contextIsolation, "Platform:", args.domain);

            // Build webPreferences dynamically so we can omit preload when asked
            const webPreferences = {
                pageVisibility: true,
                contextIsolation: contextIsolation,
                backgroundThrottling: false,
                webSecurity: webSecurity,
                nodeIntegrationInSubFrames: false,
                nodeIntegration: false,
                session: persistentSession,
                additionalPermissions: ['clipboard-write']
            };
            if (preloadPath) {
                webPreferences.preload = preloadPath;
            }

            const view = new BrowserWindow({
                webPreferences,
                show: visibibility,
                backgroundColor: "#0000",
                transparent: false,
                frame: true,
                autoHideMenuBar: false,
                title: args.url.replace("https://", "").slice(0, 50),
            });
            //log(args);
            view.args = args;

            if (view.webContents && view.webContents.session) {
                // Workaround: Block LinkedIn's passkey initiation endpoint only for this activate window
                // This prevents Windows Security "Sign in with your passkey" popups in activate-source windows
                try {
                    const thisWebContentsId = view.webContents.id;
                    const liFilter = { urls: [ 'https://www.linkedin.com/checkpoint/pk/*' ] };
                    view.webContents.session.webRequest.onBeforeRequest(liFilter, (details, callback) => {
                        try {
                            if (details.webContentsId === thisWebContentsId && details.url.includes('/checkpoint/pk/initiateLogin')) {
                                console.log('[LinkedIn] Blocking passkey initiation:', details.url);
                                return callback({ cancel: true });
                            }
                        } catch (e) {}
                        return callback({});
                    });
                } catch (e) {
                    console.warn('Failed to attach LinkedIn passkey blocker:', e);
                }

                // Set session user agent if configured
                // Don't set user agent on session - already set at session creation
                /* if (args.config && args.config.userAgent) {
                    log(`Setting session user agent: ${args.config.userAgent}`);
                    view.webContents.session.setUserAgent(args.config.userAgent);
                } */
                
                // Check if we need to set any headers
                const needsOriginReferer = args.config && (("Origin" in args.config) || ("Referer" in args.config));
                const needsUserAgentHeaders = args.config && args.config.userAgent && args.config.mockUserAgentData;

                if (needsOriginReferer || needsUserAgentHeaders) {
                    view.webContents.session.webRequest.onBeforeSendHeaders({
                            urls: ['*://*/*']
                        },
                        (details, callback) => {
                            const {
                                requestHeaders
                            } = details;

                            // Handle Origin/Referer headers
                            if (needsOriginReferer) {
                                if ("Origin" in args.config) {
                                    requestHeaders['Origin'] = args.config.Origin;
                                }
                                if ("Referer" in args.config) {
                                    requestHeaders['Referer'] = args.config.Referer;
                                }
                            }

                            // Handle User-Agent and client hint headers
                            if (needsUserAgentHeaders) {
                                // Don't manipulate User-Agent - let session handle it
                                // requestHeaders['User-Agent'] = args.config.userAgent;

                                // Remove any Electron-specific headers
                                delete requestHeaders['Electron'];

                                // Let Chromium handle all other headers naturally
                                // The browser will generate sec-ch-ua headers based on the User-Agent
                            }

                            callback({
                                requestHeaders
                            });
                        }
                    );
                }
            }

            view.tabID = generateUniqueWindowId();;
            browserViews[view.tabID] = view;

            if (args.size) {
                view.setBounds({
                    x: 635,
                    y: 100,
                    width: Math.max(parseInt(args.size.width), 0) || 1200,
                    height: Math.max(0, parseInt(args.size.height)) || 600,
                });
            } else if (args.config && args.config.size) {
                view.setBounds({
                    x: 635,
                    y: 100,
                    width: args.config.size.width,
                    height: args.config.size.height
                });
            } else {
                view.setBounds({
                    x: 635,
                    y: 100,
                    width: 1100,
                    height: 600
                });
            }

            if (view.webContents) {
                // Auto-close on navigate for activated (classic) windows only
                try {
                    const enforceCloseOnNavigate = (!args.wss && args.config && args.config.closeOnNavigate === true);
                    if (enforceCloseOnNavigate) {
                        const mode = (args.config && args.config.closeOnNavigateMode) || 'prefix'; // 'origin' | 'prefix' | 'exact'
                        let initialHref = '';
                        let initialOrigin = '';
                        let initialNoHash = '';
                        try {
                            const u = new URL(args.url);
                            initialHref = u.href.replace(/\/+$/, '/');
                            initialOrigin = u.origin;
                            initialNoHash = u.origin + u.pathname + (u.search || '');
                        } catch (_) {
                            initialHref = String(args.url || '').trim();
                            initialOrigin = '';
                            initialNoHash = initialHref.replace(/#.*$/, '');
                        }

                        const isAllowed = (url) => {
                            try {
                                const nu = new URL(url);
                                const href = nu.href.replace(/\/+$/, '/');
                                const noHash = nu.origin + nu.pathname + (nu.search || '');
                                if (mode === 'origin') {
                                    return initialOrigin && nu.origin === initialOrigin;
                                } else if (mode === 'exact') {
                                    // Treat hash-only changes as allowed; compare without hash fragment
                                    return noHash === initialNoHash;
                                } else { // prefix (default)
                                    return href.startsWith(initialHref);
                                }
                            } catch (_) {
                                return true; // If URL parsing fails, do not block
                            }
                        };

                        const maybeClose = (navUrl, reason) => {
                            if (!isAllowed(navUrl)) {
                                try { log(`Auto-closing activated window due to navigation (${reason}): ${navUrl}`); } catch (_) {}

                                // Best-effort UI notification with details for toast
                                try {
                                    if (mainWindow && !mainWindow.isDestroyed()) {
                                        mainWindow.webContents.send('window-auto-closed', {
                                            tabID: view.tabID,
                                            sourceId: view.args && view.args.sourceId,
                                            reason,
                                            mode,
                                            initialUrl: args.url,
                                            newUrl: navUrl
                                        });
                                    }
                                } catch (_) {}

                                // Also send the legacy per-tab closed event (used by sign-in flow, harmless here)
                                try {
                                    if (mainWindow && !mainWindow.isDestroyed()) {
                                        mainWindow.webContents.send(`window-closed-${view.tabID}`);
                                    }
                                } catch (_) {}

                                // Destroy the window and clean up bookkeeping
                                try { if (!view.isDestroyed()) view.destroy(); } catch (_) {}
                                try { delete browserViews[view.tabID]; releaseWindowId(view.tabID); } catch (_) {}
                            }
                        };

                        view.webContents.on('will-navigate', (event, url) => { maybeClose(url, 'will-navigate'); });
                        view.webContents.on('did-navigate', (event, url) => { maybeClose(url, 'did-navigate'); });
                        view.webContents.on('did-navigate-in-page', (event, url) => { maybeClose(url, 'did-navigate-in-page'); });
                        view.webContents.on('did-redirect-navigation', (event, url) => { maybeClose(url, 'redirect'); });
                    }
                } catch (e) {
                    try { console.warn('Error attaching closeOnNavigate handlers (classic window):', e); } catch (_) {}
                }
                // Add navigation debugging for regular windows
                view.webContents.on('did-start-loading', () => {
                    log(`Regular window started loading: ${args.url}`);
                });

                view.webContents.on('did-stop-loading', () => {
                    log(`Regular window stopped loading`);
                });

                view.webContents.on('dom-ready', () => {
                    log(`Regular window DOM ready`);
                });

                view.webContents.on("did-fail-load", function(event, errorCode, errorDescription, validatedURL) {
                    console.error("Regular window failed to load:", validatedURL);
                    console.error("Error:", errorDescription, "Code:", errorCode);

                    if (errorCode === -7) {
                        log("Connection timed out - retrying in 2 seconds...");
                        setTimeout(() => {
                            if (!view.isDestroyed()) {
                                view.webContents.reload();
                            }
                        }, 2000);
                    }
                });


                
                // Load URL
                log(`Loading regular window URL: ${args.url}`);
                log(`User agent config: ${args.config?.userAgent}`);
                // Apply custom UA only for websocket windows (classic windows continue to use session UA)
                if (view.args?.wss && view.args?.config?.userAgent) {
                    log(`Setting custom user agent for WSS window loadURL: ${view.args.config.userAgent}`);
                    view.webContents.loadURL(args.url, {
                        userAgent: view.args.config.userAgent
                    });
                } else {
                    log(`Using default user agent for loadURL`);
                    view.webContents.loadURL(args.url);
                }
            }

            view.onbeforeunload = (e) => {
                log("I do not want to be closed 1");
                e.preventDefault();
                try { stealthHideView(view); } catch(_) { try { view.hide(); } catch(_){} }
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('window-hidden', {
                        tabID: view.tabID,
                        url: view.args.url
                    });
                }
                e.returnValue = false;
            };

            view.on("close", function(e) {
                log("I do not want to be closed 2");
                e.preventDefault();

                // Clean up WebSocket debugger if it exists
                if (view.__websocketMonitorCleanup) {
                    try {
                        view.__websocketMonitorCleanup();
                        delete view.__websocketMonitorCleanup;
                    } catch (error) {
                        console.error('Error cleaning up WebSocket debugger:', error);
                    }
                }

                try { stealthHideView(view); } catch(_) {
                    try { if (view && !view.isDestroyed()) view.hide(); } catch(_){}
                }
                if (mainWindow && view && !mainWindow.isDestroyed() && !view.isDestroyed()) {
                    mainWindow.webContents.send('window-hidden', {
                        tabID: view.tabID,
                        url: view.args.url
                    });
                }
                e.returnValue = false;
            });

            if (view.webContents) {
                if ("muted" in args) {
                    log(`Setting audio muted to: ${args.muted}`);
                    view.webContents.setAudioMuted(args.muted);
                } else {
                    log("No muted arg, defaulting to muted=true");
                    view.webContents.setAudioMuted(true);
                }
                
                // Set up WebSocket monitoring if configured in args or config
                // Configuration can be set in config files (e.g., config_0.json) or passed via args
                // Configuration options:
                //   websocketMonitoring = true                           // Monitor all WebSockets
                //   websocketMonitoring = "streamelements.com"           // Monitor WebSockets containing this domain
                //   websocketMonitoring = { filter: "domain.com" }       // Object format with filter
                const websocketMonitoring = args.websocketMonitoring || (args.config && args.config.websocketMonitoring);
                if (websocketMonitoring) {
                    try {
                                                
                        let websocketFilter = null;
                        
                        // Handle different configuration formats
                        if (typeof websocketMonitoring === 'object' && websocketMonitoring.filter) {
                            // Object format: { filter: "domain.com" }
                            const filterDomain = websocketMonitoring.filter;
                            websocketFilter = (url) => url.includes(filterDomain);
                        } else if (typeof websocketMonitoring === 'string') {
                            // String format: "domain.com"
                            const filterDomain = websocketMonitoring;
                            websocketFilter = (url) => url.includes(filterDomain);
                        } else if (websocketMonitoring === true) {
                            // Boolean true: monitor all WebSockets
                            websocketFilter = null;
                        }
                        
                        const cleanup = setupWebSocketMonitor(view.webContents, {
                            filter: websocketFilter,
                            onMessage: (data) => {
                                // Forward to content script via preload
                                view.webContents.send('websocket-message', {
                                    type: 'message',
                                    data: data.data,
                                    url: data.url,
                                    timestamp: data.timestamp
                                });
                            },
                            onOpen: (data) => {
                                view.webContents.send('websocket-message', {
                                    type: 'open',
                                    url: data.url,
                                    timestamp: Date.now()
                                });
                            },
                            onClose: (data) => {
                                view.webContents.send('websocket-message', {
                                    type: 'close',
                                    url: data.url,
                                    timestamp: Date.now()
                                });
                            },
                            onSend: (data) => {
                                view.webContents.send('websocket-message', {
                                    type: 'send',
                                    data: data.data,
                                    url: data.url,
                                    timestamp: Date.now()
                                });
                            }
                        });
                        
                        // Store cleanup function for later
                        view.__websocketMonitorCleanup = cleanup;
                        log(`WebSocket monitoring enabled${websocketFilter ? ' with filter' : ' for all WebSockets'}`);
                    } catch (error) {
                        log('Failed to set up WebSocket monitoring:', error);
                    }
                }
                
                //view.webContents.on("will-navigate", handleNavigation);
                //view.webContents.on("new-window", handleNavigation);

                view.webContents.on("zoom-changed", (event, zoomDirection) => {
                    const currentZoom = view.webContents.getZoomFactor();
                    if (zoomDirection === "in") {
                        view.webContents.setZoomFactor(currentZoom + 0.1);
                    } else if (zoomDirection === "out") {
                        view.webContents.setZoomFactor(currentZoom - 0.1);
                    }
                });

                // Handle Ctrl+mousewheel zoom
                view.webContents.on("before-input-event", (event, input) => {
                    if (input.control && input.type === "mouseWheel") {
                        const zoomDirection = input.deltaY < 0 ? "in" : "out";
                        view.webContents.emit("zoom-changed", event, zoomDirection);
                    }
                });

                view.webContents.on("did-start-loading", function() {
                    //loaded = false;
                    timeout = setTimeout(function() {
                        if (!loaded) {
                            loaded = true;
                            startRunning();
                        }
                    }, 3000);
                });

                view.webContents.on("dom-ready", function() {
                    if (!loaded) {
                        loaded = true;
                        clearTimeout(timeout);
                        // Add a delay to ensure preload script has finished setting up contextBridge
                        setTimeout(() => {
                            startRunning();
                        }, 500);
                    }

                    if (view.args?.config && view.args.config.userAgent && view.args.config.mockUserAgentData) {
                        const userAgent = view.args.config.userAgent;

                        const mockData = view.args.config.mockUserAgentData;
                        view.webContents.executeJavaScript(`
					  Object.defineProperty(navigator, 'userAgent', {
						get: () => '${userAgent}',
						configurable: true
					  });
					  
					  Object.defineProperty(navigator, 'appVersion', {
						get: () => '${userAgent.replace('Mozilla/', '')}',
						configurable: true
					  });
					  
					  Object.defineProperty(navigator, 'platform', {
						get: () => '${mockData.platform === 'macOS' ? 'MacIntel' : mockData.platform === 'Linux' ? 'Linux x86_64' : 'Win32'}',
						configurable: true
					  });
					  
					  Object.defineProperty(navigator, 'vendor', {
						get: () => 'Google Inc.',
						configurable: true
					  });
					  
					  const mockUserAgentData = {
						brands: ${JSON.stringify(mockData.brands)},
						mobile: ${mockData.mobile},
						platform: "${mockData.platform}",
						getHighEntropyValues: async function(hints) {
						  const values = {
							brands: this.brands,
							mobile: this.mobile,
							platform: this.platform
						  };
						  
						  // Add specific high entropy values based on hints
						  if (hints.includes('fullVersionList') && ${JSON.stringify(mockData.fullVersionList)}) {
							values.fullVersionList = ${JSON.stringify(mockData.fullVersionList)};
						  }
						  if (hints.includes('architecture')) {
							values.architecture = "${mockData.architecture || 'x86'}";
						  }
						  if (hints.includes('bitness')) {
							values.bitness = "${mockData.bitness || '64'}";
						  }
						  if (hints.includes('model')) {
							values.model = "${mockData.model || ''}";
						  }
						  if (hints.includes('platformVersion')) {
							values.platformVersion = "${mockData.platformVersion || '19.0.0'}";
						  }
						  if (hints.includes('uaFullVersion')) {
							values.uaFullVersion = "${mockData.uaFullVersion || '140.0.7339.41'}";
						  }
						  if (hints.includes('wow64')) {
							values.wow64 = ${mockData.wow64 || false};
						  }
						  
						  return Promise.resolve(values);
						},
						toJSON: function() {
						  return {
							brands: this.brands,
							mobile: this.mobile,
							platform: this.platform
						  };
						}
					  };
					  
					  Object.defineProperty(navigator, 'userAgentData', {
						get: () => mockUserAgentData,
						configurable: true
					  });
					  
					  // Return a simple value to avoid serialization issues
					  true;
					`);
                    }
                });

                view.webContents.on("did-navigate", function(e) {
                    log("did-navigate");
                    loaded = false;
                    scriptInjected = false; // Reset injection flag on navigation
                });

            }

            // Move this declaration before it's used in event handlers
            let scriptInjected = false; // Track if script has been injected
            
            function startRunning() {
                // Prevent duplicate injection
                if (scriptInjected) {
                    log("Script already injected, skipping duplicate injection");
                    return;
                }

                if (!view || (typeof view.isDestroyed === "function" && view.isDestroyed())) {
                    log("Cannot start injection; view is already destroyed");
                    return;
                }

                let webContents;
                try {
                    webContents = view.webContents;
                } catch (err) {
                    const reason = err && err.message ? err.message : String(err);
                    log("Cannot start injection; failed to access webContents: " + reason);
                    return;
                }

                const isDestroyedError = (err) => {
                    if (!err) {
                        return false;
                    }
                    const message = err && err.message ? err.message : String(err);
                    return typeof message === "string" && message.indexOf("Object has been destroyed") !== -1;
                };

                const isWebContentsAlive = () => {
                    if (!webContents) {
                        return false;
                    }
                    if (typeof webContents.isDestroyed === "function") {
                        return !webContents.isDestroyed();
                    }
                    return true;
                };

                if (!isWebContentsAlive()) {
                    log("Cannot start injection; webContents is already destroyed");
                    return;
                }

                const runWithWebContents = (context, action) => {
                    if (!isWebContentsAlive()) {
                        log(context + ": webContents is no longer available; skipping");
                        return;
                    }
                    try {
                        action(webContents);
                    } catch (err) {
                        if (isDestroyedError(err)) {
                            log(context + ": webContents was destroyed during operation; skipping");
                            return;
                        }
                        throw err;
                    }
                };

                const whenDestroyedReject = (context) => (err) => {
                    if (isDestroyedError(err)) {
                        log(context + ": webContents was destroyed during async operation; skipping error");
                        return;
                    }
                    console.error(context + " failed:", err);
                };

                scriptInjected = true;
                if (runningLocally && args.source && !args.source.startsWith("https://")) {
                    var jsSource;
                    // Check if args.source already contains the full path
                    if (args.source.includes(runningLocally.replace(/\/$/, ''))) {
                        jsSource = args.source;
                    } else {
                        jsSource = runningLocally + args.source;
                    }
                    
                    // Convert file:// URL to regular file path if needed
                    if (jsSource.startsWith('file://')) {
                        jsSource = jsSource.replace('file:///', '').replace(/\//g, path.sep);
                        // Handle Windows drive letters
                        if (process.platform === 'win32' && jsSource.match(/^[a-zA-Z]:/)) {
                            // Path is already correct for Windows
                        } else if (process.platform === 'win32') {
                            // Add drive letter if missing on Windows
                            jsSource = jsSource.replace(/^([a-zA-Z]):/, '$1:');
                        }
                    }
                    
                    log("jsSource: " + jsSource);
                    let text = null;
                    try {
                        text = fs.readFileSync(jsSource, 'utf8');
                    } catch (e) {
                        let options = {
                            title: "Site not supported or injection script not found",
                            buttons: ["OK"],
                            message: args.source + " was not found.\n\njoin the Discord for support: \nhttps://discord.socialstream.ninja",
                        };
                        dialog.showMessageBoxSync(options);
                        console.error(e);
                    }

                    if (text) {
                        runWithWebContents("Script injection", (wc) => {
                            // Removed empty console-message handler to allow console logs to flow through

                            var code =
                                `
								// Get the random flag from contextBridge if available
								const injectedScriptFlag = window.ninjafy?.getInjectedScriptFlag?.() || '` + INJECTED_SCRIPT_FLAG + `';
								window.__SSAPP_TAB_ID__ = ${view.tabID};
								// Per-tab reply-only mode (disable capture forwarding)
								const __SSAPP_REPLY_ONLY__ = ${args.replyOnly ? 'true' : 'false'};
								
								// Create a more complete chrome.runtime mock
								chrome.runtime = {};
								chrome.runtime.id = 1;
								chrome.runtime.getURL = function(path) {
									// Return a placeholder
									return 'electron-inject:' + path;
								};
								chrome.runtime.onMessage = {};
								chrome.runtime.onMessage.addListener = function(callback) {
									// Set up the callback for sendToTab messages
									function tryRegister() {
										if (window.ninjafy && window.ninjafy.exposeDoSomethingInWebApp) {
											window.ninjafy.exposeDoSomethingInWebApp(function(message, sender, sendResponse) {
												// This receives messages from sendToTab
												callback(message, sender, sendResponse);
											});
											return true;
										}
										return false;
									}
									
									// Try immediately
									if (!tryRegister()) {
										// If failed, retry a few times with delays
										let retries = 0;
										const maxRetries = 10;
										const retryInterval = setInterval(() => {
											retries++;
											if (tryRegister() || retries >= maxRetries) {
												clearInterval(retryInterval);
												if (retries >= maxRetries) {
													console.warn("Failed to register chrome.runtime.onMessage handler after " + maxRetries + " retries");
													console.warn("window.ninjafy status:", window.ninjafy);
												}
											}
										}, 100);
									}
									
									// Also listen for responses from preload script
									window.addEventListener('message', (event) => {
										if (event.data && event.data._isResponse) {
											callback(event.data, null, () => {});
										}
									});
								};
								// Use closure to hide cached settings
								(function() {
									const cachedSettings = ${JSON.stringify(cachedState)};
									
								chrome.runtime.sendMessage = function(a=null,b=null,c=null){
									// Use postMessage to communicate with preload script
									const messageData = b || a;
									
									// Handle getSettings synchronously from cached data
									if (messageData && messageData.getSettings && c) {
										c(cachedSettings);
										return;
									}

									// If reply-only, drop all non-status messages
									try {
										if (typeof __SSAPP_REPLY_ONLY__ !== 'undefined' && __SSAPP_REPLY_ONLY__) {
											if (!messageData || (!messageData.wssStatus && !messageData.youtubeWssStatus)) {
												if (typeof c === 'function') { try { c(null); } catch(_){} }
												return;
											}
										}
									} catch(_){}
									
									// For other messages, check if we can use ninjafy.sendMessage first
									if (window.ninjafy && window.ninjafy.sendMessage) {
										window.ninjafy.sendMessage(null, messageData, c, window.__SSAPP_TAB_ID__);
									} else {
										// Fallback to postMessage
										const outgoingMessage = {
											...messageData
										};
										outgoingMessage[injectedScriptFlag] = true;
										outgoingMessage.__tabID__ = window.__SSAPP_TAB_ID__;
																				window.postMessage(outgoingMessage, '*');
										
										if (c && !messageData.getSettings) {
											setTimeout(() => c(null), 0);
										}
									}
								};
								})();
                                
                                // Lightweight WSS status hooks for YouTube when upstream isn't patched
                                (function(){
                                  try {
                                    var href = '' + (location && location.href);
                                    var isYT = href.indexOf('websocket/youtube.html') !== -1;
                                    if (!isYT) return;
                                    function __ss_wssNotify(status, message){
                                      try {
                                        var payload = { wssStatus: { platform: 'youtube', status: status, message: message } };
                                        if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) {
                                          window.chrome.runtime.sendMessage(window.chrome.runtime.id, payload, function(){});
                                        } else if (window.ninjafy && window.ninjafy.sendMessage) {
                                          window.ninjafy.sendMessage(null, payload, null, window.__SSAPP_TAB_ID__);
                                        } else {
                                          var data = Object.assign({}, payload);
                                          data.__tabID__ = window.__SSAPP_TAB_ID__;
                                          window.postMessage(data, '*');
                                        }
                                      } catch(e){}
                                    }
                                    (function(){
                                      try {
                                        var hasToken = false;
                                        try { hasToken = !!localStorage.getItem('youtubeOAuthToken'); } catch(_){ }
                                        if (!hasToken) __ss_wssNotify('signin_required','Sign in with YouTube to continue');
                                      } catch(_){ }
                                    })();
                                    (function(){
                                      try {
                                        var prev = null;
                                        setInterval(function(){
                                          try {
                                            var cur = (typeof window.liveChatId !== 'undefined') ? window.liveChatId : null;
                                            if (cur && !prev) __ss_wssNotify('connected','Connected to YouTube live chat');
                                            if (!cur && prev) __ss_wssNotify('disconnected','Disconnected from YouTube live chat');
                                            prev = cur;
                                          } catch(_){ }
                                        }, 1500);
                                      } catch(_){ }
                                    })();
                                    (function(){
                                      try {
                                        if (window.__ss_fetch_patched__) return; window.__ss_fetch_patched__ = true;
                                        var _orig = window.fetch;
                                        if (typeof _orig !== 'function') return;
                                        var lastAt = 0; var throttle = 3000;
                                        var ping = function(status, msg){ var now = Date.now(); if (now - lastAt > throttle) { __ss_wssNotify('error', msg || ('YouTube API error: ' + status)); lastAt = now; } };
                                        window.fetch = async function(input, init){
                                          try {
                                            var res = await _orig(input, init);
                                            var url = (typeof input === 'string') ? input : (input && input.url) || '';
                                            if (url.indexOf('googleapis.com/youtube') !== -1 || url.indexOf('youtube.googleapis.com') !== -1){
                                              if (!res.ok){
                                                var msg = 'YouTube API ' + res.status;
                                                try {
                                                  var body = await res.clone().json().catch(function(){ return null; });
                                                  if (body && body.error){
                                                    var emsg = body.error.message || '';
                                                    var reason = (body.error.errors && body.error.errors[0] && body.error.errors[0].reason) || '';
                                                    if (emsg) msg = emsg;
                                                    if (reason) msg += ' (' + reason + ')';
                                                  }
                                                } catch(_){ }
                                                ping(res.status, msg);
                                              }
                                            }
                                            return res;
                                          } catch(e){ ping('network_error', e && e.message ? e.message : 'Network error'); throw e; }
                                        };
                                      } catch(_){ }
                                    })();
                                  } catch(_){ }
                                })();

                                try {
                                    ` + text + `
                                } catch(err) {
                                    try {
                                        throw { name: err.name, message: err.message, stack: err.stack }
                                    } catch(e){}
                                }
                                `;

                            // Inject into main world (worldId: 0) to access contextBridge APIs
                            wc.executeJavaScriptInIsolatedWorld(0, [{ code }])
                                .then(() => {
                                    log("Script injection completed successfully in main world");
                                })
                                .catch(whenDestroyedReject("Script injection"));
                        });
                    }
                } else if (args.source) {
                    (async () => {
                        try {
                            const branch = isBetaMode ? 'beta' : 'main';
                            const jsSource = args.source.startsWith("https://") ? args.source : `https://raw.githubusercontent.com/steveseguin/social_stream/${branch}/${args.source}`;
                            const relativeSource = args.source.startsWith("https://") ? '' : args.source;

                            log(jsSource);

                            const { text, origin, meta } = await loadSocialStreamSource(jsSource, {
                                branch,
                                relativePath: relativeSource,
                                timeoutMs: SOCIAL_STREAM_REMOTE_TIMEOUT_MS
                            });

                            if (origin === 'cache') {
                                const reason = meta && meta.reason ? meta.reason : 'remote fetch unavailable';
                                console.warn(`Using cached Social Stream scripts for ${relativeSource || jsSource}: ${reason}`);
                                queueInjectorToast('warning', 'Classic Mode Fallback', `Using cached Social Stream scripts (${reason}).`);
                            } else if (origin === 'fallback') {
                                const reason = meta && meta.reason ? meta.reason : 'remote fetch unavailable';
                                console.warn(`Using bundled Social Stream scripts for ${relativeSource || jsSource}: ${reason}`);
                                queueInjectorToast('warning', 'Classic Mode Fallback', `Using bundled Social Stream scripts (${reason}).`);
                            }

                            try {
                                runWithWebContents("Remote script injection", (wc) => {
                                    // Removed empty console-message handler to allow console logs to flow through

                                    var code =
                                        `
										// Debug window.ninjafy availability
										console.log("[Injection Remote] window.ninjafy:", window.ninjafy);
										console.log("[Injection Remote] window.ninjafy._authToken:", window.ninjafy?._authToken);
                                            
                                            // Get the random flag from contextBridge if available
										const injectedScriptFlag = window.ninjafy?.getInjectedScriptFlag?.() || '` + INJECTED_SCRIPT_FLAG + `';
										window.__SSAPP_TAB_ID__ = ${view.tabID};
										
										chrome.runtime = {};
										chrome.runtime.id = 1;
										chrome.runtime.onMessage = {};
										chrome.runtime.onMessage.addListener = function(callback) {
											// Set up the callback for sendToTab messages
											function tryRegister() {
												if (window.ninjafy && window.ninjafy.exposeDoSomethingInWebApp) {
													window.ninjafy.exposeDoSomethingInWebApp(function(message, sender, sendResponse) {
														// This receives messages from sendToTab
														callback(message, sender, sendResponse);
													});
													return true;
												}
												return false;
											}
											
											// Try immediately
											if (!tryRegister()) {
												// If failed, retry a few times with delays
												let retries = 0;
												const maxRetries = 10;
												const retryInterval = setInterval(() => {
													retries++;
													if (tryRegister() || retries >= maxRetries) {
														clearInterval(retryInterval);
														if (retries >= maxRetries) {
															//console.warn("Failed to register chrome.runtime.onMessage handler after " + maxRetries + " retries");
														}
													}
												}, 100);
											}
											
											// Also listen for responses from preload script
											window.addEventListener('message', (event) => {
												if (event.data && event.data._isResponse) {
													callback(event.data, null, () => {});
												}
											});
										};
                                            // Use closure to hide cached settings
                                            (function() {
											const cachedSettings = ${JSON.stringify(cachedState)};
											
											chrome.runtime.sendMessage = function(a=null,b=null,c=null){
												// Use postMessage to communicate with preload script
												const messageData = b || a;
												
												// Handle getSettings synchronously from cached data
												if (messageData && messageData.getSettings && c) {
													c(cachedSettings);
													return;
												}
											
											// For other messages, check if we can use ninjafy.sendMessage first
											if (window.ninjafy && window.ninjafy.sendMessage) {
												window.ninjafy.sendMessage(null, messageData, c, window.__SSAPP_TAB_ID__);
											} else {
												// Fallback to postMessage
												const outgoingMessage = {
													...messageData
												};
												outgoingMessage[injectedScriptFlag] = true;
												outgoingMessage.__tabID__ = window.__SSAPP_TAB_ID__;
												window.postMessage(outgoingMessage, '*');
												
												if (c && !messageData.getSettings) {
													setTimeout(() => c(null), 0);
												}
											}
										};
										})();
										new Promise((resolve, reject) => {
										   try {
											  ` + text + `
										   } catch(err) {
											  throw { name: err.name, message: err.message, stack: err.stack }
										   }
                                            })
                                            
                                            // Lightweight WSS status hooks for YouTube when upstream isn't patched
                                            ;(function(){
                                              try {
                                                var href = '' + (location && location.href);
                                                var isYT = href.indexOf('websocket/youtube.html') !== -1;
                                                if (!isYT) return;
                                                function __ss_wssNotify(status, message){
                                                  try {
                                                    var payload = { wssStatus: { platform: 'youtube', status: status, message: message } };
                                                    if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) {
                                                      window.chrome.runtime.sendMessage(window.chrome.runtime.id, payload, function(){});
                                                    } else if (window.ninjafy && window.ninjafy.sendMessage) {
                                                      window.ninjafy.sendMessage(null, payload, null, window.__SSAPP_TAB_ID__);
                                                    } else {
                                                      var data = Object.assign({}, payload);
                                                      data.__tabID__ = window.__SSAPP_TAB_ID__;
                                                      window.postMessage(data, '*');
                                                    }
                                                  } catch(e){}
                                                }
                                                (function(){
                                                  try { var hasToken=false; try{ hasToken = !!localStorage.getItem('youtubeOAuthToken'); } catch(_){ } if (!hasToken) __ss_wssNotify('signin_required','Sign in with YouTube to continue'); } catch(_){ }
                                                })();
                                                (function(){
                                                  try {
                                                    var prev = null;
                                                    setInterval(function(){
                                                      try {
                                                        var cur = (typeof window.liveChatId !== 'undefined') ? window.liveChatId : null;
                                                        if (cur && !prev) __ss_wssNotify('connected','Connected to YouTube live chat');
                                                        if (!cur && prev) __ss_wssNotify('disconnected','Disconnected from YouTube live chat');
                                                        prev = cur;
                                                      } catch(_){ }
                                                    }, 1500);
                                                  } catch(_){ }
                                                })();
                                                (function(){
                                                  try {
                                                    if (window.__ss_fetch_patched__) return; window.__ss_fetch_patched__ = true;
                                                    var _orig = window.fetch; if (typeof _orig !== 'function') return;
                                                    var lastAt=0, throttle=3000;
                                                    var ping=function(status,msg){ var now=Date.now(); if (now-lastAt>throttle){ __ss_wssNotify('error', msg || ('YouTube API error: ' + status)); lastAt=now; } };
                                                    window.fetch = async function(input, init){
                                                      try {
                                                        var res = await _orig(input, init);
                                                        var url = (typeof input === 'string') ? input : (input && input.url) || '';
                                                        if (url.indexOf('googleapis.com/youtube') !== -1 || url.indexOf('youtube.googleapis.com') !== -1){
                                                          if (!res.ok){
                                                            var msg = 'YouTube API ' + res.status;
                                                            try {
                                                              var body = await res.clone().json().catch(function(){ return null; });
                                                              if (body && body.error){
                                                                var emsg = body.error.message || '';
                                                                var reason = (body.error.errors && body.error.errors[0] && body.error.errors[0].reason) || '';
                                                                if (emsg) msg = emsg; if (reason) msg += ' (' + reason + ')';
                                                              }
                                                            } catch(_){ }
                                                            ping(res.status, msg);
                                                          }
                                                        }
                                                        return res;
                                                      } catch(e){ ping('network_error', e && e.message ? e.message : 'Network error'); throw e; }
                                                    };
                                                  } catch(_){ }
                                                })();
                                              } catch(_){ }
                                            })();
                                            `;

                                    // Inject into main world (worldId: 0) to access contextBridge APIs
                                    wc.executeJavaScriptInIsolatedWorld(0, [{ code }])
                                        .catch(whenDestroyedReject("Remote script injection"));
                                });
                            } catch (e) {
                                let options = {
                                    title: "Could not inject required code.",
                                    buttons: ["OK"],
                                    message: "An error occured parsing or injecting the required js script.",
                                };
                                dialog.showMessageBoxSync(options);
                                console.error(e);
                            }
                        } catch (e) {
                            console.error('Failed to load Social Stream injector:', e);
                            queueInjectorToast('error', 'Classic Mode Failed', `Could not load Social Stream scripts (${e && e.message ? e.message : 'unknown error'}).`);
                            try {
                                dialog.showMessageBoxSync({
                                    title: "Site not supported or injection script not found",
                                    buttons: ["OK"],
                                    message: args.source + " was not found.\n\njoin the Discord for support: \nhttps://discord.socialstream.ninja",
                                });
                            } catch (dialogError) {
                                console.error('Failed to show injector error dialog:', dialogError);
                            }
                        }
                    })();
                } else {
                    var code =
                        `
					// Get the random flag from contextBridge if available
					const injectedScriptFlag = window.ninjafy?.getInjectedScriptFlag?.() || '` + INJECTED_SCRIPT_FLAG + `';
					window.__SSAPP_TAB_ID__ = ${view.tabID};
					// Per-tab reply-only mode
					const __SSAPP_REPLY_ONLY__ = ${args.replyOnly ? 'true' : 'false'};
					
					chrome.runtime = {};
					chrome.runtime.id = 1;
					chrome.runtime.onMessage = {};
					chrome.runtime.onMessage.addListener = function(callback) {
						// Listen for responses from preload script
						window.addEventListener('message', (event) => {
							if (event.data && event.data._isResponse) {
								callback(event.data, null, () => {});
							}
						});
					};
					chrome.runtime.sendMessage = function(a=null,b=null,c=null){
						// Use postMessage to communicate with preload script
						const messageData = b || a;
						// If reply-only, drop non-status messages
						try {
							if (typeof __SSAPP_REPLY_ONLY__ !== 'undefined' && __SSAPP_REPLY_ONLY__) {
								if (!messageData || (!messageData.wssStatus && !messageData.youtubeWssStatus)) {
									if (typeof c === 'function') { try { c(null); } catch(_){} }
									return;
								}
							}
						} catch(_){}
												const outgoingMessage = {
							...messageData
						};
						outgoingMessage[injectedScriptFlag] = true;
						outgoingMessage.__tabID__ = window.__SSAPP_TAB_ID__;
						window.postMessage(outgoingMessage, '*');
						
						// Handle callback if provided
						if (typeof c === 'function') {
							// Simple callback with empty response for now
							setTimeout(() => c({}), 0);
						}
					};
					`;
                    runWithWebContents("Default script injection", (wc) => {
                        // Inject into main world (worldId: 0) to access contextBridge APIs
                        wc.executeJavaScriptInIsolatedWorld(0, [{ code }]);
                    });
                }
                // Set mute state based on args
                runWithWebContents("Applying mute state", (wc) => {
                    if ("muted" in args) {
                        log(`Setting audio muted to: ${args.muted}`);
                        wc.setAudioMuted(args.muted);
                        if (args.muted && typeof wc.send === "function") {
                            wc.send("sendToTab", {
                                muteWindow: true
                            });
                        }
                    } else {
                        log("No muted arg, defaulting to muted=true");
                        wc.setAudioMuted(true);
                        if (typeof wc.send === "function") {
                            wc.send("sendToTab", {
                                muteWindow: true
                            });
                        }
                    }
                });
            }
            // Initialize logical visibility flag for stealth-hide/show
            view.__ss_visible = true;
            try { view.setSkipTaskbar(false); } catch(_){}
            eventRet.returnValue = view.tabID;
            log(`Window created successfully with ID: ${view.tabID}`);
        } catch (e) {
            log(e);
            eventRet.returnValue = null;
        }
    };
    
    // Register the sync handler for backward compatibility
    ipcMain.on("createWindow", originalCreateWindowHandler);
    
    // Add async handlers for other IPC channels
    async function handleStorageSave(data) {
        // TODO: Implement async storage save
        throw new Error("Not implemented yet - use sync handler");
    }
    
    async function handleStorageLoad(data) {
        // TODO: Implement async storage load
        throw new Error("Not implemented yet - use sync handler");
    }
    
    async function handleNodeFetch(data) {
        // TODO: Implement async node fetch
        throw new Error("Not implemented yet - use sync handler");
    }
    
    async function handleCloseWindow(data) {
        // TODO: Implement async close window
        throw new Error("Not implemented yet - use sync handler");
    }
    
    async function handleReloadWindow(data) {
        // TODO: Implement async reload window
        throw new Error("Not implemented yet - use sync handler");
    }
    
    async function handleGetWindowInfo(data) {
        // TODO: Implement async get window info
        throw new Error("Not implemented yet - use sync handler");
    }

    ipcMain.on("getVersion", function(eventRet) {
        eventRet.returnValue = app.getVersion();
    });

ipcMain.on('set-force-tiktok-classic', (_event, enabled) => {
        if (CLI_FORCE_TIKTOK_CLASSIC) {
            runtimeForceTikTokClassic = true;
            process.env.SSAPP_FORCE_TIKTOK_CLASSIC = '1';
            return;
        }
        const next = !!enabled;
        runtimeForceTikTokClassic = next;
        process.env.SSAPP_FORCE_TIKTOK_CLASSIC = next ? '1' : '0';
    });

    ipcMain.handle("createTikTokConnection", async function(_event, args) {
        if (runtimeForceTikTokClassic) {
            console.info('[TikTok] Skipping WebSocket connection - classic mode is forced.');
            const fallbackError = new Error('SSAPP_TIKTOK_FORCED_CLASSIC: TikTok WebSocket disabled by classic mode preference');
            fallbackError.code = 'SSAPP_TIKTOK_FORCED_CLASSIC';
            fallbackError.ssappFallback = true;
            fallbackError.ssappFallbackMode = 'classic';
            fallbackError.ssappFallbackMessage = 'TikTok WebSocket disabled by classic mode preference';
            fallbackError.payloadLength = 0;
            throw fallbackError;
        }

        if (!ConnectionManager) {
            console.warn('[TikTok] ConnectionManager unavailable (tiktok-live-connector missing); falling back to classic mode');
            const fallbackError = new Error('SSAPP_TIKTOK_CONNECTOR_MISSING: TikTok WebSocket connector not installed');
            fallbackError.code = 'SSAPP_TIKTOK_CONNECTOR_MISSING';
            fallbackError.ssappFallback = true;
            fallbackError.ssappFallbackMode = 'classic';
            fallbackError.ssappFallbackMessage = 'TikTok WebSocket connector not installed';
            fallbackError.payloadLength = 0;
            throw fallbackError;
        }

        wssID++;
        let username = args.username;
        if (username) {
            username = username.replace("@", "").toLowerCase().trim();
            // Warn if username contains spaces or special chars (might be display name)
            if (username.includes(' ') || username.match(/[^a-z0-9._]/)) {
                console.warn('Username contains invalid characters - might be a display name:', username);
                // Remove spaces and special chars to try to extract username
                username = username.replace(/[^a-z0-9._]/g, '');
            }
        }
        if (!username) {
            return null;
        }
        console.log('Attempting TikTok connection with username:', username);

        // Extract session credentials if provided
        const rawSessionId = typeof args.sessionId === 'string' ? args.sessionId.trim() : '';
        const rawTtTargetIdc = typeof args.ttTargetIdc === 'string' ? args.ttTargetIdc.trim() : '';
        const sessionId = rawSessionId || null;
        const ttTargetIdc = rawTtTargetIdc || null;

        const requestedStrategy = args && args.strategy === 'legacy' ? 'legacy' : 'websocket';
        const manager = new ConnectionManager(
            username,
            wssID,
            sessionId,
            ttTargetIdc,
            { forceLegacyConnector: requestedStrategy === 'legacy' }
        );
        if (args && args.replyOnly === true) {
            manager.replyOnly = true;
        }
        websocketConnections[wssID] = manager;

        connectionStates.set(wssID, {
            isConnected: false,
            lastAttempt: Date.now(),
            isReconnecting: false,
            attemptInProgress: false
        });

        // Create a virtual tab entry for the TikTok connection
        // Use a special tab ID that won't conflict with real browser tabs
        const virtualTabId = 900000 + wssID; // High number to avoid conflicts
        browserViews[virtualTabId] = {
            isTikTokVirtual: true,
            wssID: wssID,
            username: username,
            args: {
                url: `https://www.tiktok.com/@${username}/live`
            },
            webContents: {
                getURL: () => `https://www.tiktok.com/@${username}/live`,
                send: (channel, data) => {
                    // Handle messages sent to this virtual tab
                    if (channel !== "sendToTab") return;

                    const text = typeof data?.text === 'string' ? data.text.trim() : '';
                    if (!text) {
                        console.warn('Ignoring empty TikTok chat send request');
                        return;
                    }

                    if (!manager.sessionId) {
                        console.warn('TikTok outbound messaging ignored: sessionid cookie missing');
                        return;
                    }

                    if (!manager.ttTargetIdc && !manager.warnedMissingTtTargetIdc) {
                        console.warn('TikTok outbound messaging proceeding without tt-target-idc cookie');
                        manager.warnedMissingTtTargetIdc = true;
                    }

                    manager.sendChatMessage(text).then(result => {
                        if (!result?.success && result?.error) {
                            console.log('Failed to send TikTok message:', result.error);
                        }
                    }).catch(error => {
                        console.error('Failed to send TikTok message:', error);
                    });
                }
            }
        };

        // Store the virtual tab ID in the manager for reference
        manager.virtualTabId = virtualTabId;
        manager.wssID = wssID; // Store wssID for reference too
        if (typeof manager.logDebug === 'function') {
            manager.logDebug('lifecycle.virtualTab.assigned', { virtualTabId });
        }

        try {
            await manager.initialize();
        } catch (e) {
            console.error('Error creating TikTok connection:', e);
            // Propagate the error to the renderer so the UI can react accordingly
            throw e;
        }

        // Return the virtual tab ID instead of wssID so it can be used with browserViews
        return virtualTabId;
    });

    ipcMain.on("disconnectTikTokConnection", function(eventRet, args) {
        if (!args.wssID) {
            eventRet.returnValue = false;
            return;
        }

        try {
            try {
                // Notify renderer to clear UI/countdowns
                mainWindow.webContents.send('tiktokConnectionStatus', {
                    wssID: args.wssID,
                    status: 'stopped_by_user'
                });
            } catch (_) {}
            cleanupConnection(args.wssID);
            eventRet.returnValue = true;
        } catch (e) {
            console.error('Error in disconnectTikTokConnection:', e);
            eventRet.returnValue = false;
        }
    });

    // TikTok authentication handlers
    ipcMain.handle("authenticateTikTok", async () => {
        try {
            const auth = new TikTokAuth(mainWindow);
            const credentials = await auth.authenticate();
            return {
                success: true,
                credentials
            };
        } catch (error) {
            console.error('TikTok authentication failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle("getTikTokCookies", async () => {
        try {
            const auth = new TikTokAuth(mainWindow);
            const credentials = await auth.getCookiesFromSession();
            return {
                success: true,
                credentials
            };
        } catch (error) {
            console.error('Failed to get TikTok cookies:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle("promptTikTokCookies", async () => {
        try {
            const auth = new TikTokAuth(mainWindow);
            const credentials = await auth.promptForCookies();
            if (credentials) {
                return {
                    success: true,
                    credentials
                };
            } else {
                return {
                    success: false,
                    error: 'User cancelled'
                };
            }
        } catch (error) {
            console.error('Failed to prompt for TikTok cookies:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Handler for sending TikTok chat messages
    ipcMain.handle("sendTikTokMessage", async (event, args) => {
        try {
            const {
                wssID,
                message
            } = args || {};

            const numericWssID = typeof wssID === 'number' ? wssID : Number.parseInt(wssID, 10);

            if (!Number.isFinite(numericWssID)) {
                return {
                    success: false,
                    error: 'Missing wssID or message'
                };
            }

            if (typeof message !== 'string' || !message.trim()) {
                return {
                    success: false,
                    error: 'Message must be a non-empty string'
                };
            }

            const connection = websocketConnections[numericWssID];
            if (!connection) {
                return {
                    success: false,
                    error: 'Connection not found'
                };
            }

            // Send the message
            const result = await connection.sendChatMessage(message);
            return result;

        } catch (error) {
            console.error('Error in sendTikTokMessage handler:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    /* ipcMain.on('inject', function(eventRet,args) {
    	const view = browserViews[args.vid];
    	log("https://raw.githubusercontent.com/steveseguin/social_stream/main/"+args.source);
    	fetch("https://raw.githubusercontent.com/steveseguin/social_stream/main/"+args.source).then((response) => response.text()).then(text=>{
    		try {
    			view.webContents.on("console-message", async (event, level, message,line, sourceId) => {
    				log(message);
    			});
    			
    		} catch(e){
    			log(e);
    		}
    	});
    	eventRet.returnValue = args.vid || null;
    }); */

    ipcMain.on("reloadWindow", function(eventRet, args) {
        try {
            const byVid = getActiveBrowserView(args.vid);
            if (byVid && byVid.webContents) {
                byVid.webContents.reload();
            } else if (args.tab) {
                const byTab = getActiveBrowserView(args.tab);
                if (byTab && byTab.webContents) {
                    byTab.webContents.reload();
                }
            }
            eventRet.returnValue = true;
        } catch (e) {
            eventRet.returnValue = false;
        }
    });

    ipcMain.on("closeWindow", function(eventRet, args) {
        log("close window: " + args.vid);
        try {
            const view = browserViews[args.vid];
            if (!view) {
                eventRet.returnValue = false;
                return;
            }

            if (view.isTikTokVirtual) {
                const wssID = view.wssID;
                if (wssID !== undefined) {
                    cleanupConnection(wssID);
                } else {
                    delete browserViews[args.vid];
                }
                eventRet.returnValue = true;
                return;
            }

            if (view.webContents && typeof view.webContents.removeAllListeners === 'function') {
                view.webContents.removeAllListeners();
            }

            const tabID = view.tabID;

            if (typeof view.close === 'function') {
                try { view.close(); } catch (closeErr) { console.warn('Error closing view:', closeErr); }
            }
            if (typeof view.destroy === 'function') {
                try { view.destroy(); } catch (destroyErr) { console.warn('Error destroying view:', destroyErr); }
            }

            delete browserViews[args.vid];

            if (tabID) {
                releaseWindowId(tabID);
            }

            eventRet.returnValue = true;
        } catch (e) {
            console.error('closeWindow handler error:', e);
            eventRet.returnValue = false;
        }
    });

    function getTLD(url) {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol === "file:") {
                return "file://";
            }
            const hostParts = parsedUrl.hostname.split(".");
            return hostParts.length > 2 ? hostParts.slice(-2).join(".") : parsedUrl.hostname;
        } catch (error) {
            console.error("Error parsing URL:", error);
            return null;
        }
    }

    function clearCacheForDomainSession(url) {
        const domain = getPrimaryDomain(url);
        const sess = getOrCreatePersistentSession(domain);
        sess.clearCache().then(() => {
            log(`Cache cleared for ${domain} of this session`);
        });
    }

    ipcMain.handle('clearWindowCache', async (event, windowId) => {
        try {

            const view = browserViews[windowId];
            if (!view || !view.webContents) {
                console.error(`No view found for window ID ${windowId}`);
                return {
                    success: false,
                    error: 'No view found'
                };
            }

            // Clear all possible data for the specific domain
            const result = await clearDataForDomain(view.webContents);

            // Add a delay before reloading
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

            // Force reload ignoring cache
            view.webContents.reloadIgnoringCache();

            return {
                success: result,
                error: null
            };
        } catch (error) {
            console.error('Error in clearWindowCache:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    async function clearDataForDomain(webContentsInstance) {
        const ses = webContentsInstance.session;
        try {
            const url = webContentsInstance.getURL();
            const {
                protocol,
                hostname
            } = new URL(url);
            log(`Starting to clear data for: ${url}`);

            // Get the base domain (e.g., 'youtube.com' from 'www.youtube.com')
            const baseDomain = hostname.split('.').slice(-2).join('.');

            // Clear all storage types for the specific domain and its subdomains
            await ses.clearStorageData({
                origin: `${protocol}//*.${baseDomain}`,
                storages: [
                    'appcache',
                    'cookies',
                    'filesystem',
                    'indexdb',
                    'localstorage',
                    'shadercache',
                    'websql',
                    'serviceworkers',
                    'cachestorage',
                ],
            });
            log('Domain-specific storage cleared');

            // Clear cookies for the specific domain and its subdomains
            const cookies = await ses.cookies.get({
                domain: baseDomain
            });
            for (const cookie of cookies) {
                await ses.cookies.remove(`${protocol}//${cookie.domain}`, cookie.name);
            }
            log('Domain-specific cookies cleared');

            // Inject JavaScript to clear client-side storage
            await webContentsInstance.executeJavaScript(`
		  // Clear localStorage and sessionStorage
		  localStorage.clear();
		  sessionStorage.clear();
		  
		  // Clear cookies (limited to those accessible by JavaScript)
		  document.cookie.split(";").forEach(function(c) { 
			document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
		  });
		  
		  // Clear IndexedDB
		  if (window.indexedDB) {
			indexedDB.databases().then(dbs => {
			  dbs.forEach(db => indexedDB.deleteDatabase(db.name));
			});
		  }
		  
		  // Clear Cache Storage
		  if (window.caches) {
			caches.keys().then(names => {
			  names.forEach(name => caches.delete(name));
			});
		  }
		  
		  // Unregister Service Workers
		  if (navigator.serviceWorker) {
			navigator.serviceWorker.getRegistrations().then(registrations => {
			  registrations.forEach(registration => registration.unregister());
			});
		  }

		  console.log('Client-side storage and accessible cookies cleared');
		`);
            log('Client-side storage cleared');

            // Clear cache for the specific domain
            await ses.clearCache({
                origin: `${protocol}//*.${baseDomain}`
            });
            log('Domain-specific cache cleared');

            // Clear auth cache for the specific domain and its subdomains
            if (typeof ses.clearAuthCache === 'function') {
                await ses.clearAuthCache({
                    type: 'password',
                    origin: `${protocol}//*.${baseDomain}`
                });
                log('Domain-specific auth cache cleared');
            }
            try {
                clearCacheForDomainSession(url)
            } catch (e) {
                console.error(e);
            }

            log(`All possible data cleared for ${baseDomain} and its subdomains`);
            return true;
        } catch (error) {
            console.error(`Error clearing data:`, error);
            return false;
        }
    }


    ipcMain.on("clearAllCache", async () => {
        try {
            return await clearAllData([URI]);
        } catch (error) {
            log(error);
        }
    });

    // i need to have the injected code be made aware it shoudl stop video; on window create. figure out how
    //  need to save the state of mute and visibility, so remembers on page load.  should be muted by default?

    ipcMain.on("muteWindow", function(eventRet, args) {
        try {
            log("muteWindow 1");
            const view = getActiveBrowserView(args.vid);
            if (view && view.webContents) {
                try {
                    view.webContents.setAudioMuted(!!args.muteWindow);
                    view.webContents.send("sendToTab", {
                        muteWindow: !!args.muteWindow
                    });
                    eventRet.returnValue = true;
                } catch (error) {
                    console.error('muteWindow send failed:', error);
                    eventRet.returnValue = false;
                }
            } else {
                eventRet.returnValue = false;
            }
        } catch (e) {
            eventRet.returnValue = false;
        }
    });

    // Async handler for messages that need responses
    ipcMain.handle("sendToTab-async", async (event, args) => {
        log("sendToTab-async");
        const view = getActiveBrowserView(args.tab);
        if (view && view.webContents) {
            return new Promise((resolve) => {
                const requestId = `${Date.now()}-${Math.random()}`;

                const timeoutId = setTimeout(() => {
                    ipcMain.removeAllListeners(`sendToTab-response-${requestId}`);
                    resolve(false);
                }, 5000);

                ipcMain.once(`sendToTab-response-${requestId}`, (_evt, response) => {
                    clearTimeout(timeoutId);
                    log(`sendToTab-async response for ${args.message}: ${response}`);
                    resolve(response);
                });

                try {
                    view.webContents.send("sendToTab-request", {
                        message: args.message,
                        requestId
                    });
                } catch (error) {
                    console.error('sendToTab-async send failed:', error);
                    clearTimeout(timeoutId);
                    ipcMain.removeAllListeners(`sendToTab-response-${requestId}`);
                    resolve(false);
                }
            });
        }
        return false;
    });
    
    // Performance monitoring IPC handlers
    ipcMain.handle('getPerformanceMetrics', async () => {
        try {
            const metrics = {
                cpu: 0,
                memory: process.memoryUsage().heapUsed,
                memoryPercent: 0,
                windows: []
            };

            // Get total system memory
            const totalMem = require('os').totalmem();
            metrics.memoryPercent = (metrics.memory / totalMem) * 100;

            // Get CPU usage (averaged over 1 second)
            const startUsage = process.cpuUsage();
            await new Promise(resolve => setTimeout(resolve, 100));
            const endUsage = process.cpuUsage(startUsage);
            const totalCPUTime = (endUsage.user + endUsage.system) / 1000; // microseconds to milliseconds
            metrics.cpu = (totalCPUTime / 100) * 100; // percentage over 100ms

            // Collect metrics for each window/tab
            for (const [id, view] of Object.entries(browserViews)) {
                if (view && view.webContents && !view.isDestroyed()) {
                    try {
                        const wcMetrics = await view.webContents.executeJavaScript(`
                            ({
                                memory: performance.memory ? performance.memory.usedJSHeapSize : 0,
                                title: document.title,
                                url: window.location.href
                            })
                        `).catch(() => ({ memory: 0, title: 'Unknown', url: '' }));

                        metrics.windows.push({
                            id: id,
                            title: wcMetrics.title || view.args?.title || 'Tab ' + id,
                            url: wcMetrics.url || view.args?.url || '',
                            memory: wcMetrics.memory || 0,
                            cpu: 0 // CPU per window is complex to measure accurately
                        });
                    } catch (e) {
                        // Window might be loading or destroyed
                    }
                }
            }

            return metrics;
        } catch (error) {
            console.error('Error getting performance metrics:', error);
            return {
                cpu: 0,
                memory: 0,
                memoryPercent: 0,
                windows: []
            };
        }
    });

    // Original synchronous handler for backward compatibility
    ipcMain.on("sendToTab", function(eventRet, args) {
        log("sendToTab 1");
        const tabId = args.tab || args.tabID;
        const message = args.message || args;

        const view = getActiveBrowserView(tabId);
        if (view && view.webContents) {
            try {
                view.webContents.send("sendToTab", message);
                eventRet.returnValue = true;
            } catch (error) {
                console.error('sendToTab send failed:', error);
                eventRet.returnValue = false;
            }
        } else {
            eventRet.returnValue = false;
        }
    });

    ipcMain.on("getTabs", function(eventRet, args) {
        var keys = Object.keys(browserViews);
        var tabs = [];
        keys.forEach((key) => {
            if (browserViews[key].args && browserViews[key].args.url) {
                tabs.push({
                    id: parseInt(key),
                    url: browserViews[key].args.url
                });
            }
        });
        log(tabs);
        eventRet.returnValue = tabs;
    });

    ipcMain.on("sendInputToTab", function(eventRet, args) {
        log("sendInputToTab 1");
        const view = getActiveBrowserView(args.tab);
        if (view) {

            // Check if this is a TikTok virtual tab
            if (view && view.isTikTokVirtual) {
                log("TikTok virtual tab - sending message via WebSocket");
                const text = typeof args.text === 'string' ? args.text : '';
                if (!text.trim() || view.wssID === undefined) {
                    log("TikTok virtual tab - missing text or wssID");
                    eventRet.returnValue = false;
                    return;
                }

                const manager = websocketConnections[view.wssID];
                const isConnected = !!(manager && manager.connection && manager.connection.isConnected && !manager.isStopped);
                const hasSession = !!manager?.sessionId;

                if (!manager || !isConnected || !hasSession) {
                    log("TikTok virtual tab - connection not ready for outbound send");
                    eventRet.returnValue = false;
                    return;
                }

                sendToTikTok({
                    wssID: view.wssID,
                    message: text
                }).then(result => {
                    if (!result?.success) {
                        log(`TikTok virtual tab - outbound send failed: ${result?.error || 'unknown error'}`);
                        try {
                            if (mainWindow?.webContents) {
                                mainWindow.webContents.send('tiktokSendResult', {
                                    wssID: view.wssID,
                                    success: false,
                                    error: result?.error || 'Unknown error'
                                });
                            }
                        } catch (notifyErr) {
                            console.warn('Failed to notify renderer about TikTok send failure:', notifyErr);
                        }
                    }
                }).catch(error => {
                    console.error('TikTok virtual tab - outbound send threw:', error);
                    try {
                        if (mainWindow?.webContents) {
                            mainWindow.webContents.send('tiktokSendResult', {
                                wssID: view.wssID,
                                success: false,
                                error: error?.message || 'Failed to send TikTok message'
                            });
                        }
                    } catch (notifyErr) {
                        console.warn('Failed to notify renderer about TikTok send exception:', notifyErr);
                    }
                });

                log("Sent message to TikTok WebSocket");
                eventRet.returnValue = true;
            } else if (view && view.webContents && view.webContents.sendInputEvent) {
                try {
                    view.focus();
                    if (args.key && args.type) {
                        log("inputting: " + args.key);
                        view.webContents.sendInputEvent({
                            keyCode: args.key,
                            type: args.type
                        });
                    } else if (args.text) {
                        for (const char of [...args.text]) {
                            log("Inputting: " + char);
                            view.webContents.sendInputEvent({
                                type: "char",
                                keyCode: char
                            });
                        }
                    }
                    log("ISSUED KEY EVENT");
                    eventRet.returnValue = true;
                } catch (error) {
                    console.error('sendInputToTab failed:', error);
                    eventRet.returnValue = false;
                }
            } else {
                log("ISSUED KEY EVENT failed - webContents or sendInputEvent not available");
                eventRet.returnValue = false;
            }
        } else {
            eventRet.returnValue = false;
        }
    });

    ipcMain.on("getSources", async function(eventRet, args) {
        try {
            if (mainWindow) {
                const sources = await desktopCapturer.getSources({
                    types: args.types
                });
                eventRet.returnValue = sources;
            }
        } catch (e) {
            console.error(e);
        }
    });

    /* if (mainWindow){
    	const ret = globalShortcut.register('CommandOrControl+M', () => {
    		log('CommandOrControl+M is pressed');
    		if (mainWindow.node && mainWindow.vdonVersion){
    			mainWindow.webContents.send('postMessage', {'micOld':'toggle'});
    		} else if (mainWindow && mainWindow.vdonVersion) {
    			mainWindow.webContents.send('postMessage', {'mic':'toggle'});
    		}
    	});
    	if (!ret) {
    		log('registration failed1')
    	}
    } */

    const ret_refresh = globalShortcut.register("CommandOrControl+Shift+Alt+R", () => {
        log("CommandOrControl+Shift+Alt+R");

        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) {
            focusedWindow.reload();
        } else {
            const windows = BrowserWindow.getAllWindows();
            for (const win of windows) {
                win.reload();
            }
        }
    });
    if (!ret_refresh) {
        log("registration failed2");
    }

    const socialstream = globalShortcut.register("CommandOrControl+Shift+Alt+X", () => {
        log("CommandOrControl+Shift+Alt+X");

        const windows = BrowserWindow.getAllWindows();
        const hasPinnedWindow = windows.some(win => win.args?.pin);

        if (hasPinnedWindow) {
            for (const win of windows) {
                win.args.pin = false;
                win.setAlwaysOnTop(false);
            }
        } else {
            for (const win of windows) {
                win.mouseEvent = !win.mouseEvent;
                win.setIgnoreMouseEvents(win.mouseEvent);

                if (win.mouseEvent) {
                    if (process.platform == "darwin") {
                        win.setAlwaysOnTop(true, "floating", 1);
                    } else {
                        win.setAlwaysOnTop(true, "level");
                    }
                } else {
                    win.show();
                    if (!win.args?.pin) {
                        win.setAlwaysOnTop(false);
                    }
                }
            }
        }
    });
    if (!socialstream) {
        log("registration failed3");
    }

    // "CommandOrControl+Shift+X

    try {
        if (PIN == true) {
            // "floating" + 1 is higher than all regular windows, but still behind things
            // like spotlight or the screen saver
            mainWindow.setAlwaysOnTop(true, "level");
            // allows the window to show over a fullscreen window
            mainWindow.setVisibleOnAllWorkspaces(true);
        } else {
            mainWindow.setAlwaysOnTop(false);
            // allows the window to show over a fullscreen window
            mainWindow.setVisibleOnAllWorkspaces(false);
        }

        if (FULLSCREEN) {
            if (process.platform == "darwin") {
                mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
            } else {
                mainWindow.isFullScreen() ? mainWindow.setFullScreen(false) : mainWindow.setFullScreen(true);
            }
        }

        if (process.platform == "darwin") {
            try {
                // MacOS
                app.dock.hide();
            } catch (e) {
                // Windows?
            }
        }
    } catch (e) {
        console.error(e);
    }

    mainWindow.once("ready-to-show", () => {
        if (MINIMIZED) {
            mainWindow.minimize();
            //+ KravchenkoAndrey 08.01.2022
        } else if (UNCLICKABLE) {
            mainWindow.showInactive();
            //- KravchenkoAndrey 08.01.2022
        } else {
            mainWindow.show();
        }
    });

    // Intercept in-page navigation attempts
    mainWindow.webContents.on("will-navigate", handleNavigation);

    // Intercept new window/tab attempts
    mainWindow.webContents.on("new-window", handleNavigation);

    /* session.defaultSession.webRequest.onBeforeRequest({urls: ['file://*']}, (details, callback) => { // added for added security, but doesn't seem to be working.
      if (details.referrer.startsWith("http://")){
    	 callback({response:{cancel:true}});
      } else if (details.referrer.startsWith("https://")){ // do not let a third party load a local resource.
    	  callback({response:{cancel:true}});
      } else {
    	  callback({response:{cancel:false}});
      }
    }); */

    /* try {
    	var HTML = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" /><style>body {padding:0;height:100%;width:100%;margin:0;}</style></head><body ><div style="-webkit-app-region: drag;height:25px;width:100%"></div></body></html>';
    	await mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURI(HTML));
    } catch(e){
    	console.error(e);
    } */

    try {
        log("LOAD MAIN WINDOW");
        mainWindow.loadURL(URI);
    } catch (e) {
        console.error(e);
        //quitApp();
    }
}

contextMenu({
    prepend: (defaultActions, params, browserWindow) => [{
            label: "🔙 Go Back",
            // Only show it when right-clicking text
            visible: browserWindow.webContents.navigationHistory.canGoBack(),
            click: () => {
                //var args = browserWindow.args; // reloading doesn't work otherwise
                //args.url = "https://vdo.ninja/electron?version="+ver;
                //browserWindow.destroy();
                //createWindow(args); // we close the window and open it again; a faked refresh
                //DoNotClose = false;
                browserWindow.webContents.goBack();
            },
        },
        {
            label: "♻ Reload (Ctrl+Shift+Alt+R)",
            // Only show it when right-clicking text
            visible: true,
            click: () => {
                browserWindow.reload();

                /* DoNotClose = true; // avoids fully closing the app if no other windows are open
                
                var args = browserWindow.args; // reloading doesn't work otherwise
                args.url = browserWindow.webContents.getURL();
                var title = browserWindow.getTitle();
                browserWindow.destroy();
                createWindow(args, title); // we close the window and open it again; a faked refresh
                DoNotClose = false; */
            },
        },
        /////////////
        {
            label: "🎶 Change media device",
            // Only show it when right-clicking text
            visible: false,
            type: "submenu",
            submenu: [{
                    label: "🔈 Change audio destination for THIS element only",
                    // Only show it when right-clicking text

                    visible: params.mediaType == "video" || params.mediaType == "audio" || false,
                    click: () => {
                        var buttons = ["Cancel"];
                        var details = [false];

                        // browserWindow.inspectElement(params.x, params.y)
                        browserWindow.webContents.send("postMessage", {
                            getDeviceList: true,
                            params: params
                        });

                        ipcMain.once("deviceList", (event, data) => {
                            //log(data);
                            var deviceList = data.deviceInfos;

                            //data.menu = menu || false;
                            //data.eleId = ele.id || false;
                            //data.UUID = ele.dataset.UUID || false;
                            //data.deviceInfos;
                            //data.params = params;

                            for (var i = 0; i < deviceList.length; i++) {
                                if (deviceList[i].kind === "audiooutput") {
                                    buttons.push(deviceList[i].label);
                                    details.push(deviceList[i].deviceId);
                                }
                            }
                            let options = {
                                title: "Change audio output device",
                                buttons: buttons,
                                message: "Change audio output specifically for this media element",
                            };

                            let response = dialog.showMessageBoxSync(options);
                            if (response) {
                                browserWindow.webContents.send("postMessage", {
                                    changeAudioOutputDevice: details[response],
                                    data: data,
                                });
                            }
                        });
                    },
                },
                {
                    label: "🔈 Change audio destination",
                    // Only show it when right-clicking text

                    visible: false, //browserWindow.node,
                    click: () => {
                        var buttons = ["Cancel"];
                        var details = [false];

                        // browserWindow.inspectElement(params.x, params.y)
                        browserWindow.webContents.send("postMessage", {
                            getDeviceList: true,
                            params: params
                        });

                        ipcMain.once("deviceList", (event, data) => {
                            log(data);
                            var deviceList = data.deviceInfos;

                            //data.menu = menu || false;
                            //data.eleId = ele.id || false;
                            //data.UUID = ele.dataset.UUID || false;
                            //data.deviceInfos;
                            //data.params = params;

                            for (var i = 0; i < deviceList.length; i++) {
                                if (deviceList[i].kind === "audiooutput") {
                                    buttons.push(deviceList[i].label);
                                    details.push(deviceList[i].deviceId);
                                }
                            }
                            let options = {
                                title: "Change audio output device",
                                buttons: buttons,
                                message: "Change the audio output device",
                            };

                            let response = dialog.showMessageBoxSync(options);
                            if (response) {
                                browserWindow.webContents.send("postMessage", {
                                    changeAudioOutputDevice: details[response]
                                });
                            }
                        });
                    },
                },
                {
                    label: "🎤 Change audio input",
                    // Only show it when right-clicking text

                    visible: false,
                    click: () => {
                        var buttons = ["Cancel"];
                        var details = [false];

                        browserWindow.webContents.send("postMessage", {
                            getDeviceList: true,
                            params: params
                        });

                        ipcMain.once("deviceList", (event, data) => {
                            log(data);
                            var deviceList = data.deviceInfos;

                            //data.menu = menu || false;
                            //data.eleId = ele.id || false;
                            //data.UUID = ele.dataset.UUID || false;
                            //data.deviceInfos;
                            //data.params = params;

                            var deviceCounter = 0;
                            for (var i = 0; i < deviceList.length; i++) {
                                if (deviceList[i].kind === "audioinput") {
                                    deviceCounter += 1;
                                    buttons.push(deviceList[i].label);
                                    details.push(deviceList[i].deviceId);
                                }
                            }

                            let options = {
                                title: "Change audio input device",
                                buttons: buttons,
                                message: "Change your local audio input source",
                            };

                            if (!deviceCounter) {
                                options.message = "No audio input devices available here";
                            }

                            let response = dialog.showMessageBoxSync(options);
                            if (response) {
                                browserWindow.webContents.send("postMessage", {
                                    changeAudioDevice: details[response]
                                });
                            }
                        });
                    },
                },
            ],
        },
        {
            label: "🧰 Enable Chrome Extension",
            // Only show it when right-clicking text

            visible: extensions.length,
            click: () => {
                var buttons = ["Cancel"];

                for (var i = 0; i < extensions.length; i++) {
                    buttons.push(extensions[i].name);
                }
                var options = {
                    title: "Choose an extension to enable",
                    buttons: buttons,
                    message: "Choose an extension to enable. You may need to reload the window to trigger once loaded.",
                };

                let idx = dialog.showMessageBoxSync(options);
                if (idx) {
                    idx -= 1;
                    //log(idx, extensions[idx].location);

                    browserWindow.webContents.session.loadExtension(extensions[idx].location + "").then(({
                        id
                    }) => {
                        log("loadExtension");
                    });
                    // extensions
                }
            },
        },
        {
            label: "🔇 Mute the window",
            type: "checkbox",
            visible: true,
            checked: browserWindow.webContents.isAudioMuted(),
            click: () => {
                if (browserWindow.webContents.isAudioMuted()) {
                    browserWindow.webContents.setAudioMuted(false);
                } else {
                    browserWindow.webContents.setAudioMuted(true);
                }
            },
        },
        {
            label: "🔴 Record Video (toggle)",
            // Only show it when right-clicking text
            visible: false,
            click: () => {
                if (browserWindow) {
                    browserWindow.webContents.send("postMessage", {
                        record: true,
                        params: params
                    });
                }
            },
        },
        {
            label: "✏ Edit URL",
            // Only show it when right-clicking text
            visible: true,
            click: () => {
                var URI = browserWindow.webContents.getURL();
                var onTop = browserWindow.isAlwaysOnTop();
                if (onTop) {
                    browserWindow.setAlwaysOnTop(false);
                }
                prompt({
                        title: "Edit the URL",
                        label: "URL:",
                        value: URI,
                        inputAttrs: {
                            type: "text",
                            placeholder: "Enter URL or search term"
                        },
                        resizable: true,
                        type: "input",
                        alwaysOnTop: true,
                    })
                    .then(async (r) => {
                        if (r === null) {
                            log("user cancelled");
                            if (onTop) {
                                browserWindow.setAlwaysOnTop(true);
                            }
                        } else {
                            log("result", r);
                            if (onTop) {
                                browserWindow.setAlwaysOnTop(true);
                            }

                            const formattedURL = await formatURL(r, browserWindow);
                            if (formattedURL) {
                                if (browserWindow?.args?.config?.userAgent) {
                                    browserWindow.webContents.loadURL(formattedURL, {
                                        userAgent: browserWindow.args.config.userAgent
                                    });
                                } else {
                                    browserWindow.loadURL(formattedURL);
                                }
                            }
                        }
                    })
                    .catch(console.error);
            },
        },
        {
            label: "🪟 IFrame Options",
            // Only show it when right-clicking text
            visible: params.frameURL,
            type: "submenu",
            submenu: [{
                    label: "✏ Edit IFrame URL",
                    // Only show it when right-clicking text
                    visible: true,
                    click: () => {
                        log(browserWindow.webContents);
                        log(params);

                        var URI = params.frameURL;
                        var onTop = browserWindow.isAlwaysOnTop();
                        if (onTop) {
                            browserWindow.setAlwaysOnTop(false);
                        }
                        prompt({
                                title: "Edit the target IFrame URL",
                                label: "URL:",
                                value: URI,
                                inputAttrs: {
                                    type: "url",
                                },
                                resizable: true,
                                type: "input",
                                alwaysOnTop: true,
                            })
                            .then((r) => {
                                if (r === null) {
                                    log("user cancelled");
                                    if (onTop) {
                                        browserWindow.setAlwaysOnTop(true);
                                    }
                                } else {
                                    log("result", r);
                                    if (onTop) {
                                        browserWindow.setAlwaysOnTop(true);
                                    }

                                    browserWindow.webContents.executeJavaScript(
                                        "(function () {\
								var ele = document.elementFromPoint(" +
                                        params.x +
                                        ", " +
                                        params.y +
                                        ');\
								if (ele.tagName !== "IFRAME"){\
									ele = false;\
									document.querySelectorAll("iframe").forEach(ee=>{\
										if (ee.src == "' +
                                        URI +
                                        '"){\
											ele = ee;\
										}\
									});\
								}\
								if (ele && (ele.tagName == "IFRAME")){\
									ele.src = "' +
                                        r +
                                        '";\
								}\
							})();'
                                    );
                                }
                            })
                            .catch(console.error);
                    },
                },
                {
                    label: "♻ Reload IFrame",
                    // Only show it when right-clicking text
                    visible: true,
                    click: () => {
                        browserWindow.webContents.mainFrame.frames.forEach((frame) => {
                            if (frame.url === params.frameURL) {
                                frame.reload();
                            }
                        });
                    },
                },
                {
                    label: "🔙 Go Back in IFrame",
                    // Only show it when right-clicking text
                    visible: true,
                    click: () => {
                        browserWindow.webContents.mainFrame.frames.forEach((frame) => {
                            if (frame.url === params.frameURL) {
                                frame.executeJavaScript("(function () {window.history.back();})();");
                            }
                        });
                    },
                },
                {
                    label: "Go Forward in IFrame",
                    // Only show it when right-clicking text
                    visible: true,
                    click: () => {
                        browserWindow.webContents.mainFrame.frames.forEach((frame) => {
                            if (frame.url === params.frameURL) {
                                frame.executeJavaScript("(function () {window.history.forward();})();");
                            }
                        });
                    },
                },
            ],
        },
        {
            label: "📑 Insert CSS",
            // Only show it when right-clicking text
            visible: true,
            click: async () => {
                try {
                    var onTop = browserWindow.isAlwaysOnTop();
                    if (onTop) {
                        browserWindow.setAlwaysOnTop(false);
                    }
                    if (browserWindow.webContents) {
                        const savedValue = await browserWindow.webContents.executeJavaScript(`localStorage.getItem('insertCSS');`);

                        log(savedValue);
                        prompt({
                                title: "Insert Custom CSS",
                                label: "CSS:",
                                value: savedValue || "body {background-color:#0000;}",
                                inputAttrs: {
                                    type: "text",
                                },
                                resizable: true,
                                type: "input",
                                alwaysOnTop: true,
                            })
                            .then((r) => {
                                if (r === null) {
                                    log("user cancelled");
                                    if (onTop) {
                                        browserWindow.setAlwaysOnTop(true);
                                    }
                                } else {
                                    log("result", r);
                                    const safeJSString = JSON.stringify(r);
                                    browserWindow.webContents.executeJavaScript(
                                        `localStorage.setItem('insertCSS', ${safeJSString});`
                                    );
                                    if (onTop) {
                                        browserWindow.setAlwaysOnTop(true);
                                    }
                                    browserWindow.webContents.insertCSS(r, {
                                        cssOrigin: "user"
                                    });
                                }
                            })
                            .catch(console.error);
                    }
                } catch (error) {
                    log(error);
                }
            },
        },
        {
            label: "✏ Edit Window Title",
            // Only show it when right-clicking text
            visible: true,
            click: () => {
                if (!browserWindow.args) {
                    browserWindow.args = {};
                }
                var title2 = browserWindow.getTitle();
                var onTop = browserWindow.isAlwaysOnTop();
                if (onTop) {
                    browserWindow.setAlwaysOnTop(false);
                }
                prompt({
                        title: "Edit Window Title",
                        label: "Title:",
                        value: title2,
                        inputAttrs: {
                            type: "string",
                        },
                        resizable: true,
                        type: "input",
                        alwaysOnTop: true,
                    })
                    .then((r) => {
                        if (r === null) {
                            if (onTop) {
                                browserWindow.setAlwaysOnTop(true);
                            }
                            log("user cancelled");
                        } else {
                            if (onTop) {
                                browserWindow.setAlwaysOnTop(true);
                            }
                            log("result", r);
                            browserWindow.args.title = r;
                            browserWindow.setTitle(r);
                        }
                    })
                    .catch(console.error);
            },
        },
        {
            label: "↔ Resize window",
            // Only show it when right-clicking text
            visible: true,
            type: "submenu",
            submenu: [{
                    label: "Fullscreen",
                    // Only show if not already full-screen
                    visible: !browserWindow.isMaximized(),
                    click: () => {
                        if (process.platform == "darwin") {
                            // On certain electron builds, fullscreen fails on macOS; this is in case it starts happening again
                            browserWindow.isMaximized() ? browserWindow.unmaximize() : browserWindow.maximize();
                        } else {
                            browserWindow.isFullScreen() ? browserWindow.setFullScreen(false) : browserWindow.setFullScreen(true);
                        }
                        //browserWindow.setMenu(null);
                        //const {width,height} = screen.getPrimaryDisplay().workAreaSize;
                        //browserWindow.setSize(width, height);
                    },
                },
                {
                    label: "1920x1080",
                    // Only show it when right-clicking text
                    visible: true,
                    click: () => {
                        if (process.platform !== "darwin") {
                            if (browserWindow.isFullScreen()) {
                                browserWindow.setFullScreen(false);
                            }
                        } else {
                            if (browserWindow.isMaximized()) {
                                browserWindow.unmaximize();
                            }
                        }
                        //let factor = screen.getPrimaryDisplay().scaleFactor;
                        //browserWindow.setSize(1920/factor, 1080/factor);
                        let point = screen.getCursorScreenPoint();
                        let factor = screen.getDisplayNearestPoint(point).scaleFactor || 1;
                        browserWindow.setSize(parseInt(1920 / factor), parseInt(1080 / factor));
                    },
                },
                {
                    label: "1280x720",
                    // Only show it when right-clicking text
                    visible: true,
                    click: () => {
                        if (process.platform !== "darwin") {
                            if (browserWindow.isFullScreen()) {
                                browserWindow.setFullScreen(false);
                            }
                        } else {
                            if (browserWindow.isMaximized()) {
                                browserWindow.unmaximize();
                            }
                        }
                        let point = screen.getCursorScreenPoint();
                        let factor = screen.getDisplayNearestPoint(point).scaleFactor || 1;
                        browserWindow.setSize(parseInt(1280 / factor), parseInt(720 / factor));
                    },
                },
                {
                    label: "640x360",
                    // Only show it when right-clicking text
                    visible: true,
                    click: () => {
                        if (process.platform !== "darwin") {
                            if (browserWindow.isFullScreen()) {
                                browserWindow.setFullScreen(false);
                            }
                        } else {
                            if (browserWindow.isMaximized()) {
                                browserWindow.unmaximize();
                            }
                        }
                        let point = screen.getCursorScreenPoint();
                        let factor = screen.getDisplayNearestPoint(point).scaleFactor || 1;
                        browserWindow.setSize(parseInt(640 / factor), parseInt(360 / factor));
                    },
                },
                {
                    label: "Custom resolution",
                    // Only show it when right-clicking text
                    visible: true,
                    click: () => {
                        var URI = browserWindow.webContents.getURL();
                        var onTop = browserWindow.isAlwaysOnTop();
                        if (onTop) {
                            browserWindow.setAlwaysOnTop(false);
                        }
                        prompt({
                                title: "Custom window resolution",
                                label: "Enter a resolution:",
                                value: browserWindow.getSize()[0] + "x" + browserWindow.getSize()[1],
                                inputAttrs: {
                                    type: "string",
                                    placeholder: "1280x720",
                                },
                                type: "input",
                                alwaysOnTop: true,
                            })
                            .then((r) => {
                                if (r === null) {
                                    log("user cancelled");
                                    if (onTop) {
                                        browserWindow.setAlwaysOnTop(true);
                                    }
                                } else {
                                    log("Window resized to ", r);
                                    if (onTop) {
                                        browserWindow.setAlwaysOnTop(true);
                                    }
                                    if (process.platform !== "darwin") {
                                        if (browserWindow.isFullScreen()) {
                                            browserWindow.setFullScreen(false);
                                        }
                                    } else {
                                        if (browserWindow.isMaximized()) {
                                            browserWindow.unmaximize();
                                        }
                                    }
                                    let point = screen.getCursorScreenPoint();
                                    let factor = screen.getDisplayNearestPoint(point).scaleFactor || 1;
                                    log(r);
                                    log(factor);
                                    browserWindow.setSize(parseInt(r.split("x")[0] / factor), parseInt(r.split("x")[1] / factor));
                                }
                            })
                            .catch(console.error);
                    },
                },
            ],
        },
        {
            label: "🚿 Clean Video Output",
            type: "checkbox",
            visible: false,
            checked: false,
            click: () => {
                var css =
                    " \
					.html5-video-player {\
						z-index:unset!important;\
					}\
					.html5-video-container {	\
						z-index:unset!important;\
					}\
					video { \
						width: 100vw!important;height: 100vh!important;  \
						left: 0px!important;    \
						object-fit: cover!important;\
						top: 0px!important;\
						overflow:hidden;\
						z-index: 2147483647!important;\
						position: fixed!important;\
					}\
					body {\
						overflow: hidden!important;\
					}";
                browserWindow.webContents.insertCSS(css, {
                    cssOrigin: "user"
                });
                browserWindow.webContents.executeJavaScript(
                    '(function () {\
					var videos = document.querySelectorAll("video");\
					if (videos.length>1){\
						var video = videos[0];\
						for (var i=1;i<videos.length;i++){\
							if (!video.videoWidth){\
								video = videos[i];\
							} else if (videos[i].videoWidth && (videos[i].videoWidth>video.videoWidth)){\
								video = videos[i];\
							}\
						}\
						document.body.appendChild(video);\
					} else if (videos.length){\
						document.body.appendChild(videos[0]);\
					}\
				})();'
                );

                if (browserWindow.webContents.getURL().includes("youtube.com")) {
                    browserWindow.webContents.executeJavaScript(
                        '(function () {\
						if (!xxxxxx){\
							var xxxxxx = setInterval(function(){\
							if (document.querySelector(".ytp-ad-skip-button")){\
								document.querySelector(".ytp-ad-skip-button").click();\
							}\
							},500);\
						}\
					})();'
                    );
                }
            },
        },
        {
            label: "📌 Always on top",
            type: "checkbox",
            visible: true,
            checked: browserWindow.isAlwaysOnTop(),
            click: () => {
                if (!browserWindow.args) {
                    browserWindow.args = {};
                }
                if (browserWindow.isAlwaysOnTop()) {
                    browserWindow.setAlwaysOnTop(false);
                    browserWindow.args.pin = false;
                    browserWindow.setVisibleOnAllWorkspaces(false);
                } else {
                    browserWindow.args.pin = true;
                    if (process.platform == "darwin") {
                        browserWindow.setAlwaysOnTop(true, "floating", 1);
                    } else {
                        browserWindow.setAlwaysOnTop(true, "level");
                    }

                    browserWindow.setVisibleOnAllWorkspaces(true);
                }
            },
        },
        {
            label: "🚫🖱 ️Make UnClickable until in-focus (CTRL+SHIFT+ALT+X)",
            visible: true, // Only show it when pinned
            click: () => {
                if (browserWindow) {
                    if (!browserWindow.isAlwaysOnTop()) {
                        if (process.platform == "darwin") {
                            browserWindow.setAlwaysOnTop(true, "floating", 1);
                        } else {
                            browserWindow.setAlwaysOnTop(true, "level");
                        }
                        browserWindow.setVisibleOnAllWorkspaces(true);
                    }
                    browserWindow.mouseEvent = true;
                    browserWindow.setIgnoreMouseEvents(browserWindow.mouseEvent);
                }
            },
        },
        {
            label: "Force 16/9 aspect ratio",
            type: "checkbox",
            visible: false, // need to re-ensable this at some point
            checked: forcingAspectRatio,
            click: () => {
                if (forcingAspectRatio) {
                    browserWindow.setAspectRatio(0);
                    forcingAspectRatio = false;
                } else {
                    browserWindow.setAspectRatio(16 / 9);
                    forcingAspectRatio = true;
                }
            },
        },
        {
            label: "🔍 Inspect Element",
            visible: true,
            click: () => {
                browserWindow.inspectElement(params.x, params.y);
            },
        },
        {
            label: "❌ Close",
            // Only show it when right-clicking text
            visible: true,
            click: () => {
                browserWindow.close(); // hide, and wait 2 second before really closing; this allows for saving of files.
            },
        },
    ],
});

app.on("second-instance", (event, commandLine, workingDirectory, argv2) => {
    log("can't create a second instance");
    // createWindow(argv2, argv2.title);
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        quitApp();
    }
});


app.on("before-quit", (event) => {
    if (BrowserWindow.getAllWindows().length > 0) {
        event.preventDefault();
        BrowserWindow.getAllWindows().forEach((window) => {
            if (window && !window.isDestroyed()) {
                window.close();
            }
        });
    }
    if (tray) {
        tray.destroy();
    }
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});

const folder = path.join(app.getPath("appData"), `${app.name}`);
if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, {
        recursive: true
    });
}
app.setPath("userData", folder);
log("folder: " + folder);

app.whenReady().then(function() {
        //app.allowRendererProcessReuse = false;
        log("APP READY");
        
        // Log actual app locale to see what Electron is using
        log(`Electron app.getLocale(): ${app.getLocale()}`);
        log(`Expected SYSTEM_LOCALE: ${SYSTEM_LOCALE}`);

        // Set a global fallback user agent WITHOUT Electron to avoid detection
        // Chrome shows simplified version in UA string
        const CHROME_UA_VERSION = '140.0.0.0';  // For user agent string
        const CHROME_UA_FULL_VERSION = '140.0.7339.41'; // For Client Hints full version
        let CHROME_UA;
        if (isMac) {
            CHROME_UA = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_UA_VERSION} Safari/537.36`;
        } else if (process.platform === 'linux') {
            CHROME_UA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_UA_VERSION} Safari/537.36`;
        } else {
            CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_UA_VERSION} Safari/537.36`;
        }
        app.userAgentFallback = CHROME_UA;
        
        // Configure defaultSession to match Chrome exactly BEFORE creating windows (from working code)
        const ses = session.defaultSession;
        
        // Chrome's exact user agent - MUST BE SET BEFORE WINDOW CREATION
        // Don't set locale here - let the command line switch handle it
        ses.setUserAgent(CHROME_UA);
        
        // Chrome's exact headers (from working code)
        ses.webRequest.onBeforeSendHeaders((details, callback) => {
            const headers = details.requestHeaders;
            
            // Chrome's exact header order and values
            headers['Accept'] = headers['Accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
            // Don't override Accept-Language - let the system locale from command line take effect
            headers['Accept-Encoding'] = 'gzip, deflate, br, zstd';
            headers['Cache-Control'] = headers['Cache-Control'] || 'max-age=0';
            
            // Chrome's security headers / Client Hints
            const chromeMainVersion = CHROME_UA_VERSION.split('.')[0]; // Extract "140" from "140.0.0.0"
            headers['Sec-CH-UA'] = `"Not;A=Brand";v="99", "Chromium";v="${chromeMainVersion}", "Google Chrome";v="${chromeMainVersion}"`;
            headers['Sec-CH-UA-Mobile'] = '?0';
            headers['Sec-CH-UA-Platform'] = '"Windows"';
            headers['Sec-CH-UA-Platform-Version'] = '"19.0.0"';
            headers['Sec-CH-UA-Arch'] = '"x86"';
            headers['Sec-CH-UA-Bitness'] = '"64"';
            headers['Sec-CH-UA-Model'] = '""';
            headers['Sec-CH-UA-Full-Version'] = `"${CHROME_UA_FULL_VERSION}"`;
            headers['Sec-CH-UA-Full-Version-List'] = `"Not;A=Brand";v="99.0.0.0", "Chromium";v="${CHROME_UA_FULL_VERSION}", "Google Chrome";v="${CHROME_UA_FULL_VERSION}"`;
            headers['Sec-Fetch-Site'] = headers['Sec-Fetch-Site'] || 'none';
            headers['Sec-Fetch-Mode'] = headers['Sec-Fetch-Mode'] || 'navigate';
            headers['Sec-Fetch-User'] = headers['Sec-Fetch-User'] || '?1';
            headers['Sec-Fetch-Dest'] = headers['Sec-Fetch-Dest'] || 'document';
            headers['Upgrade-Insecure-Requests'] = '1';
            
            // Chrome sends DNT
            headers['DNT'] = '1';
            
            // Remove Electron specific headers
            delete headers['X-DevTools-Request-Id'];
            delete headers['X-DevTools-Emulate-Network-Conditions-Client-Id'];
            
            callback({ requestHeaders: headers });
        });
        
        session.fromPartition("default").setPermissionRequestHandler((webContents, permission, callback) => {
            try {
                let allowedPermissions = ["audioCapture", "desktopCapture", "pageCapture", "tabCapture", "experimental"]; // Full list here: https://developer.chrome.com/extensions/declare_permissions#manifest

                if (allowedPermissions.includes(permission)) {
                    callback(true); // Approve permission request
                } else {
                    console.error(
                        `The application tried to request permission for '${permission}'. This permission was not whitelisted and has been blocked.`
                    );
                    callback(false); // Deny
                }

                ttt = screen.getPrimaryDisplay().workAreaSize;

            } catch (e) {
                console.error(e);
            }
        });

        try {
            ////log("READING CACHE STATE FROM DISK");
            cachedState = JSON.parse(fs.readFileSync(path.join(folder, "savedSync.json")));
            //log(cachedState);

            if ("streamID" in cachedState && !cachedState.streamID) {
                log("invalid cachedState");
            } else {
                log("loaded cachedState");
                if (cachedState && !("state" in cachedState) && "isExtensionOn" in cachedState) {
                    cachedState.state = cachedState.isExtensionOn;
                    delete cachedState.isExtensionOn;
                } else if (cachedState && "isExtensionOn" in cachedState) {
                    delete cachedState.isExtensionOn;
                }
            }
            log(cachedState);

            if (cachedState.wsServer) {
                wsServer.start();
            }
        } catch (e) {
            log("Failed to load cachedState -- it probably doesn't yet exist");
            //console.error(e);
            //log("saving file");
            // fs.writeFileSync(path.join(folder, "savedSync.json"), JSON.stringify(cachedState));
        }

        // If no --filesource provided, use saved local source path (if any)
        try {
            const savedLocalSource = store.get('localSourcePath');
            if (!Argv.filesource && savedLocalSource) {
                const resolved = fsPathFromMaybeFileUrl(savedLocalSource) || savedLocalSource;
                if (resolved && fs.existsSync(resolved)) {
                    Argv.filesource = savedLocalSource;
                    log(`Using saved local source: ${savedLocalSource}`);
                } else {
                    console.warn('Saved local Social Stream source missing, reverting to online assets:', savedLocalSource);
                    try { store.delete('localSourcePath'); } catch (_) {}
                    queueInjectorToast('warning', 'Local Social Stream Missing', 'Saved Social Stream files were not found. Reverting to the online version.');
                }
            }
        } catch (e) {
            console.error('Error applying saved local source:', e);
        }

        createWindow(Argv, false, true);
    })
    .catch(console.error);

ipcMain.handle("tts", async (event, data) => {
    return new Promise((resolve, reject) => {
        // Determine the correct path to the Kokoro-82M-ONNX directory
        let appPath;
        if (app.isPackaged) {
            // In production: use the path relative to the application's root
            appPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'Kokoro-82M-ONNX');
        } else {
            // In development: use the path relative to the current directory
            appPath = path.join(__dirname, 'Kokoro-82M-ONNX');
        }

        log("Using Kokoro model path:" + appPath);

        // Create a worker thread with model path information
        const worker = new Worker(path.join(__dirname, 'tts-worker.js'), {
            workerData: {
                appPath
            }
        });

        // Send the text to the worker
        worker.postMessage(data);

        // Handle the result from the worker
        worker.on('message', (result) => {
            if (result.error) {
                reject(result.error);
            } else {
                resolve(result.wavBuffer);
            }
            worker.terminate();
        });

        worker.on('error', (error) => {
            console.error("TTS Worker Error:", error);
            reject(error);
            worker.terminate();
        });
    });
});

app.on("ready", () => {
    app.on('web-contents-created', (event, contents) => {
        // NB: Work around electron/electron#6643
        contents.on("context-menu", (event, params) => {
            contents.send("context-menu-ipc", params);
        });


        // Handle new window creation
        contents.setWindowOpenHandler(({ url, features }) => {
            // Always open links in-app, inheriting the opener's session
            // Apply a sensible default window configuration
            let frame = true;
            let backgroundColor = '#DDD';
            let useTransparency = false;

            if (url.includes('&transparent') || url.includes('?transparent') ||
                url.includes('&chroma=') || url.includes('?chroma=')) {
                frame = false;
                backgroundColor = '#0000';
                useTransparency = url.includes('&transparent') || url.includes('?transparent');
            }

            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    width: 800,
                    height: 600,
                    minWidth: 400,
                    minHeight: 200,
                    frame,
                    transparent: useTransparency,
                    backgroundColor,
                    autoHideMenuBar: false,
                    webPreferences: {
                        // Inherit session by default (Electron handles this when allowing)
                        // Keep a safe renderer environment
                        nodeIntegration: false,
                        contextIsolation: true,
                        additionalPermissions: ['clipboard-write']
                    }
                }
            };
        });

        // Handle navigation within the window
        //contents.on('will-navigate', (event, navigationUrl) => {
        //const parsedUrl = new URL(navigationUrl);

        // If it's an external URL, open in default browser
        // if (!parsedUrl.hostname.includes('localhost') && !parsedUrl.protocol.includes('file:')) {
        //   event.preventDefault();
        //   shell.openExternal(navigationUrl);
        // }
        // For internal navigation, allow it to proceed
        // });
    });

    app.on("browser-window-focus", (event, win) => {
        // Initially keep window non-clickable
        //win.setIgnoreMouseEvents(true);

        // Wait 1 second to check if still focused
        setTimeout(() => {
            // Check if window is still focused
            try {
                // Check if window still exists and is not destroyed
                if (win && !win.isDestroyed() && win.isFocused()) {
                    win.setIgnoreMouseEvents(false);
                }
            } catch (e) {
                // Window was destroyed, ignore
            }
        }, 800);
    });
});

app.on("activate", function() {
    // social stream activating a window from the index.html page
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(Argv, false, true);
    }
});

app.on('browser-window-created', (event, window) => {
    window.webContents.on('will-prevent-unload', (event) => {
        event.preventDefault();
    });

    /*   window.on('close', (event) => {
    	 log("window close");
    	 
        if (!app.isQuitting) {
          event.preventDefault();
          if (window && !window.isDestroyed()) {
    		log("Hiding window instead of closing");
            window.hide();
          }
        } else {
    		log("closign window");
    	}
      }); */
});


async function quitApp() {
    app.isQuitting = true;
    
    // Clear all global intervals
    if (global.intervals) {
        global.intervals.forEach(interval => clearInterval(interval));
        global.intervals = [];
    }
    
    // Clear all websocket connections
    if (websocketConnections) {
        Object.keys(websocketConnections).forEach(id => {
            try {
                if (websocketConnections[id] && websocketConnections[id].stop) {
                    websocketConnections[id].stop();
                }
            } catch (e) {
                console.error('Error stopping websocket:', e);
            }
        });
    }
    
    // Close all browser views immediately
    if (browserViews) {
        Object.keys(browserViews).forEach(id => {
            try {
                if (browserViews[id]) {
                    // Check if it's a BrowserView with isDestroyed method
                    if (typeof browserViews[id].isDestroyed === 'function' && !browserViews[id].isDestroyed()) {
                        browserViews[id].destroy();
                    } else if (typeof browserViews[id].destroy === 'function') {
                        // If no isDestroyed method, try to destroy anyway
                        browserViews[id].destroy();
                    }
                }
                delete browserViews[id];
                releaseWindowId(id);
            } catch (e) {
                console.error('Error destroying browser view:', e);
            }
        });
    }
    
    // Close all windows
    BrowserWindow.getAllWindows().forEach(window => {
        try {
            if (window && !window.isDestroyed()) {
                // Clear any window-specific intervals
                if (window.intervals) {
                    window.intervals.forEach(interval => clearInterval(interval));
                    window.intervals = [];
                }
                window.destroy(); // Immediate destruction
            }
        } catch (e) {
            console.error('Error destroying window:', e);
        }
    });

    // Small delay for cleanup
    await sleep(100);
    
    if (tray) {
        try {
            tray.destroy();
        } catch (e) {}
    }
    app.quit();
}

function minimizeToTray() {
    if (mainWindow) {
        mainWindow.hide();
    }
}


// Offline source helpers
function ensureTrailingSep(pth) {
    if (!pth) return pth;
    return pth.endsWith(path.sep) ? pth : pth + path.sep;
}

function pathToFileUrl(pth) {
    if (!pth) return pth;
    let withSep = ensureTrailingSep(pth);
    let forward = withSep.replace(/\\/g, '/');
    if (!forward.startsWith('/')) forward = '/' + forward; // Windows drive letters
    return 'file://' + forward;
}

function fsPathFromMaybeFileUrl(p) {
    try {
        if (typeof p === 'string' && p.startsWith('file://')) {
            const { fileURLToPath } = require('url');
            return ensureTrailingSep(fileURLToPath(p));
        }
    } catch (e) {}
    return p;
}

function reloadWithLocalSource(localPath) {
    try {
        if (!mainWindow) return;
        const src = localPath.startsWith('file://') ? localPath : pathToFileUrl(localPath);
        const indexUrl = `file://${path.join(__dirname, 'index.html')}`;
        const loadUrl = `${indexUrl}?sourcemode=${encodeURIComponent(src)}`;
        mainWindowReadyForInjectorToasts = false;
        mainWindow.loadURL(loadUrl);
    } catch (e) {
        console.error('Failed to reload with local source:', e);
    }
}

function clearLocalSourceAndReload() {
    try { store.delete('localSourcePath'); } catch (e) {}
    try { Argv.filesource = null; } catch (e) {}
    try {
        if (mainWindow) {
            const indexUrl = `file://${path.join(__dirname, 'index.html')}`;
            mainWindowReadyForInjectorToasts = false;
            mainWindow.loadURL(indexUrl);
            queueInjectorToast('info', 'Classic Mode', 'Returned to online Social Stream scripts.');
        }
    } catch (e) {
        console.error('Failed to reload default index:', e);
    }
}

function findSocialStreamRoot(startDir) {
    try {
        const direct = path.join(startDir, 'manifest.json');
        if (fs.existsSync(direct)) return startDir;
        const entries = fs.readdirSync(startDir, { withFileTypes: true });
        for (const e of entries) {
            if (e.isDirectory()) {
                const p = path.join(startDir, e.name);
                if (fs.existsSync(path.join(p, 'manifest.json'))) return p;
            }
        }
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            const p1 = path.join(startDir, e.name);
            let subs = [];
            try { subs = fs.readdirSync(p1, { withFileTypes: true }); } catch {}
            for (const s of subs) {
                if (s.isDirectory()) {
                    const p2 = path.join(p1, s.name);
                    if (fs.existsSync(path.join(p2, 'manifest.json'))) return p2;
                }
            }
        }
    } catch (e) {
        console.error('Error scanning for manifest.json:', e);
    }
    return startDir;
}

function extractZipToTemp(zipPath) {
    return new Promise((resolve, reject) => {
        try {
            const baseTemp = path.join(app.getPath('userData'), 'localSource');
            if (!fs.existsSync(baseTemp)) fs.mkdirSync(baseTemp, { recursive: true });
            const dest = path.join(baseTemp, `extracted_${Date.now()}`);
            fs.mkdirSync(dest, { recursive: true });

            if (process.platform === 'win32') {
                const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;
                const cmd = `powershell -NoProfile -Command "Expand-Archive -Path ${psQuote(zipPath)} -DestinationPath ${psQuote(dest)} -Force"`;
                exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
                    if (err) return reject(new Error(stderr || err.message || 'Expand-Archive failed'));
                    resolve(dest);
                });
            } else {
                // Pre-check for unzip to provide clearer instructions if missing
                exec('command -v unzip', (whichErr) => {
                    if (whichErr) {
                        const noUnzipError = new Error('UNZIP_NOT_FOUND');
                        noUnzipError.code = 'UNZIP_NOT_FOUND';
                        return reject(noUnzipError);
                    }
                    const shQuote = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
                    const cmd = `unzip -o ${shQuote(zipPath)} -d ${shQuote(dest)}`;
                    exec(cmd, (err, stdout, stderr) => {
                        if (err) return reject(new Error(stderr || err.message || 'unzip failed'));
                        resolve(dest);
                    });
                });
            }
        } catch (e) { reject(e); }
    });
}

async function handleLoadFromFolder() {
    try {
        const result = await dialog.showOpenDialog({
            title: 'Select Social Stream Ninja folder',
            properties: ['openDirectory']
        });
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;
        const chosen = result.filePaths[0];
        const root = findSocialStreamRoot(chosen);
        const finalPath = ensureTrailingSep(root);
        const fileUrl = pathToFileUrl(finalPath);
        store.set('localSourcePath', fileUrl);
        try { Argv.filesource = fileUrl; } catch (e) {}
        reloadWithLocalSource(fileUrl);
        createMenu();
    } catch (e) {
        dialog.showErrorBox('Load From Folder Failed', e.message || String(e));
    }
}

async function handleLoadFromZip() {
    try {
        const result = await dialog.showOpenDialog({
            title: 'Select Social Stream Ninja ZIP',
            properties: ['openFile'],
            filters: [{ name: 'ZIP files', extensions: ['zip'] }]
        });
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;
        const zip = result.filePaths[0];
        const extractedDir = await extractZipToTemp(zip);
        const root = findSocialStreamRoot(extractedDir);
        const finalPath = ensureTrailingSep(root);
        const fileUrl = pathToFileUrl(finalPath);
        store.set('localSourcePath', fileUrl);
        try { Argv.filesource = fileUrl; } catch (e) {}
        reloadWithLocalSource(fileUrl);
        createMenu();
    } catch (e) {
        console.error('ZIP load failed:', e);
        let instructions = '';
        if (process.platform === 'win32') {
            instructions = [
                'Windows could not extract the ZIP automatically.',
                '- Option A: Right-click the ZIP in File Explorer → "Extract All..." → pick a folder → then use File → Load Social Stream From Folder…',
                '- Option B: Ensure PowerShell is available and try again.',
            ].join('\n');
        } else if (process.platform === 'darwin') {
            if (e && (e.code === 'UNZIP_NOT_FOUND' || String(e.message).includes('UNZIP_NOT_FOUND'))) {
                instructions = [
                    'macOS: The "unzip" tool is not available.',
                    '- Option A: Open Terminal and run: brew install unzip',
                    '- Option B: Double‑click the ZIP in Finder to extract, then use File → Load Social Stream From Folder…',
                ].join('\n');
            } else {
                instructions = [
                    'macOS could not extract the ZIP.',
                    '- Try double‑clicking the ZIP in Finder to extract, then use File → Load Social Stream From Folder…',
                    '- Or install the unzip tool via Homebrew: brew install unzip',
                ].join('\n');
            }
        } else {
            // Linux
            if (e && (e.code === 'UNZIP_NOT_FOUND' || String(e.message).includes('UNZIP_NOT_FOUND'))) {
                instructions = [
                    'Linux: The "unzip" tool is not installed.',
                    '- Debian/Ubuntu: sudo apt update && sudo apt install unzip',
                    '- Fedora: sudo dnf install unzip',
                    '- Arch: sudo pacman -S unzip',
                    '- Or extract with your file manager, then use File → Load Social Stream From Folder…',
                ].join('\n');
            } else {
                instructions = [
                    'Linux could not extract the ZIP.',
                    '- Ensure the "unzip" tool is installed, e.g.:',
                    '  Debian/Ubuntu: sudo apt update && sudo apt install unzip',
                    '  Fedora: sudo dnf install unzip',
                    '  Arch: sudo pacman -S unzip',
                    '- Or extract with your file manager, then use File → Load Social Stream From Folder…',
                ].join('\n');
            }
        }

        dialog.showMessageBox({
            type: 'error',
            title: 'Load From ZIP Failed',
            message: 'Could not extract Social Stream Ninja ZIP',
            detail: `${e && e.message ? e.message : e}\n\n${instructions}`,
            buttons: ['OK']
        });
    }
}

function createMenu() {
    const template = [
        // Mac specific top menu
        ...(isMac ? [{
            label: app.name,
            submenu: [{
                    role: "about"
                },
                {
                    type: "separator"
                },
                {
                    role: "services"
                },
                {
                    type: "separator"
                },
                {
                    role: "hide"
                },
                {
                    role: "hideothers"
                },
                {
                    role: "unhide"
                },
                {
                    type: "separator"
                },
                {
                    role: "quit"
                },
            ],
        }, ] : []),
        // File menu
        {
            label: 'File',
            submenu: [
                isMac ? {
                    role: 'close'
                } : {
                    role: 'quit'
                },
                {
                    label: 'Clear All Sources',
                    click: () => promptClearAllSources()
                },
                {
                    label: 'Reset Everything (Full Reset)',
                    click: () => clearAllData()
                },
                {
                    type: 'separator'
                },
                {
                    label: wsServer.server ? 'Stop Local Server' : 'Enable Local Server',
                    click: async () => {
                        if (wsServer.server) {
                            const result = wsServer.stop(true);
                            log(result.success);
                            createMenu();
                        } else {
                            const result = wsServer.start(true);
                            log(result.success);
                            createMenu();
                        }
                    }
                },
                {
                    type: 'separator'
                },
                { label: 'Load Social Stream From Folder…', click: () => handleLoadFromFolder() },
                { label: 'Load Social Stream From ZIP…', click: () => handleLoadFromZip() },
                ...(store.get('localSourcePath') ? [
                    { label: 'Open Local Source Folder', click: async () => { const p = store.get('localSourcePath'); if (p) await shell.openPath(fsPathFromMaybeFileUrl(p)); } },
                    { label: 'Stop Using Local Social Stream Source', click: () => clearLocalSourceAndReload() },
                ] : []),
                { type: 'separator' },
                {
                    label: 'Edit URL',
                    click: () => {
                        if (mainWindow && mainWindow.webContents) {

                            const currentURL = mainWindow.webContents.getURL();
                            prompt({
                                title: 'Edit the URL',
                                label: 'URL:',
                                value: currentURL,
                                inputAttrs: {
                                    type: 'url'
                                },
                                type: 'input'
                            }).then(r => {
                                if (r !== null) {
                                    mainWindow.loadURL(r);
                                }
                            }).catch(console.error);
                        }
                    }
                }
            ]
        },
        // Edit menu
        {
            label: "Edit",
            submenu: [{
                    role: "undo"
                },
                {
                    role: "redo"
                },
                {
                    type: "separator"
                },
                {
                    role: "cut"
                },
                {
                    role: "copy"
                },
                {
                    role: "paste"
                },
                ...(isMac ? [{
                        role: "pasteAndMatchStyle"
                    },
                    {
                        role: "delete"
                    },
                    {
                        role: "selectAll"
                    },
                    {
                        type: "separator"
                    },
                    {
                        label: "Speech",
                        submenu: [{
                            role: "startspeaking"
                        }, {
                            role: "stopspeaking"
                        }],
                    },
                ] : [{
                    role: "delete"
                }, {
                    type: "separator"
                }, {
                    role: "selectAll"
                }]),

            ],
        },
        {
            label: 'View',
            submenu: [{
                    role: 'reload'
                },
                {
                    role: 'forceReload'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Zoom In',
                    accelerator: 'CommandOrControl+=',
                    click: () => {
                        const win = BrowserWindow.getFocusedWindow();
                        if (win) {
                            const currentZoom = win.webContents.getZoomFactor();
                            win.webContents.setZoomFactor(currentZoom + 0.1);
                        }
                    }
                },
                {
                    role: 'zoomOut'
                },
                {
                    role: 'resetZoom'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'togglefullscreen'
                },
                {
                    type: 'separator'
                },
                //{
                //  label: 'Clean Video Output',
                //  click: () => {
                //	if (mainWindow && mainWindow.webContents) {
                //	  // Insert the CSS and execute the JavaScript as in the context menu
                //	  const css = `/* ... CSS content ... */`;
                //	  mainWindow.webContents.insertCSS(css, { cssOrigin: 'user' });
                //	  mainWindow.webContents.executeJavaScript(`/* ... JavaScript content ... */`);
                //	}
                //  }
                //},
                {
                    label: 'Insert Custom CSS',
                    click: async () => {
                        if (mainWindow && mainWindow.webContents) {
                            const savedValue = await mainWindow.webContents.executeJavaScript(`localStorage.getItem('insertCSS');`);
                            prompt({
                                title: 'Insert Custom CSS',
                                label: 'CSS:',
                                value: savedValue || 'body {background-color:#0000;}',
                                inputAttrs: {
                                    type: 'text'
                                },
                                type: 'input'
                            }).then(r => {
                                if (r !== null) {
                                    mainWindow.webContents.executeJavaScript(`localStorage.setItem('insertCSS', '${r}');`);
                                    mainWindow.webContents.insertCSS(r, {
                                        cssOrigin: 'user'
                                    });
                                }
                            }).catch(console.error);
                        }
                    }
                }
            ]
        },

        // Window menu (including your custom "Minimize to Tray")
        {
            label: 'Window',
            submenu: [{
                    role: 'minimize'
                },
                {
                    role: 'zoom'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Always on Top',
                    type: 'checkbox',
                    checked: mainWindow ? mainWindow.isAlwaysOnTop() : false,
                    click: () => {
                        if (mainWindow) {
                            const shouldPin = !mainWindow.isAlwaysOnTop();
                            mainWindow.setAlwaysOnTop(shouldPin);
                            mainWindow.setVisibleOnAllWorkspaces(shouldPin);
                        }
                    }
                },
                {
                    label: 'Make Unclickable',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.setIgnoreMouseEvents(true);
                        }
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Minimize to Tray',
                    click: () => minimizeToTray()
                },
                {
                    type: 'separator'
                },
                {
                    role: 'front'
                },
                ...(isMac ? [{
                    type: 'separator'
                }, {
                    role: 'window'
                }] : [])
            ]
        },
        // Help menu
        {
            role: "help",
            submenu: [{
                    label: "Get support on Discord",
                    click: async () => {
                        await shell.openExternal("https://discord.socialstream.ninja");
                    },
                },
                {
                    label: "Visit main website",
                    click: async () => {
                        await shell.openExternal("https://socialstream.ninja/");
                    },
                },
                {
                    label: "Terms of service",
                    click: async () => {
                        await shell.openExternal("https://socialstream.ninja/TOS");
                    },
                },
                {
                    label: "Privacy policy",
                    click: async () => {
                        await shell.openExternal("https://socialstream.ninja/privacy");
                    },
                },
                {
                    label: "YouTube's terms of service",
                    click: async () => {
                        await shell.openExternal("https://www.youtube.com/t/terms");
                    },
                },
                {
                    label: 'Command Line Arguments',
                    click: () => showCommandLineArguments()
                },
            ],
        },
    ];

    // Initialize the tray
    if (isMac) {
        var iconPath = path.join(__dirname, "assets", "icons", "png", "24x24.png");
    } else {
        var iconPath = path.join(__dirname, "assets", "icons", "png", "256x256.png");
    }

    // log(iconPath);

    tray = new Tray(iconPath);
    tray.setToolTip("Social Stream Ninja");
    tray.setContextMenu(
        Menu.buildFromTemplate([{
                label: "Show App",
                click: () => {
                    mainWindow.show();
                },
            },
            {
                label: "Exit",
                click: () => {
                    app.isQuitting = true;
                    quitApp();
                },
            },
        ])
    );

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

electron.powerMonitor.on("on-battery", () => {
    var notification = new electron.Notification({
        title: "Social Stream Ninja performance is degraded",
        body: "You are now on battery power. Please consider connecting your charger for improved performance.",
        icon: path.join(__dirname, "assets", "icons", "png", "256x256.png"),
    });
    notification.show();
});
