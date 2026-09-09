// loader.js (for background.html)
function loadScript(src) {
    if (window.ssappFallback && typeof window.ssappFallback.fetchBackgroundScript === 'function'
        && location.protocol === 'https:') {
        return window.ssappFallback.fetchBackgroundScript(src).then(function (result) {
            // Execute once, only after a complete download has passed the app's
            // JavaScript parser. An aborted/late response never inserts a script.
            const script = document.createElement('script');
            const sourceUrl = new URL(src, location.href).href;
            // Preserve currentScript.src for libraries resolving their own assets,
            // without setting a src attribute and starting a second download.
            Object.defineProperty(script, 'src', { value: sourceUrl });
            script.textContent = result.text + '\n;document.currentScript.dataset.ssappExecuted = "1";\n//# sourceURL=' + sourceUrl;
            let executionError = '';
            const captureError = event => {
                if (event.filename === sourceUrl) executionError = event.message || 'Unknown execution error';
            };
            window.addEventListener('error', captureError);
            try {
                document.body.appendChild(script);
            } finally {
                window.removeEventListener('error', captureError);
            }
            if (script.dataset.ssappExecuted !== '1') {
                throw new Error('Script execution failed: ' + src + (executionError ? ': ' + executionError : ''));
            }
        });
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = (error) => {
            console.error(`Failed to load script: ${src}`, error);
            reject(error);
        };
        document.body.appendChild(script);
    });
}

async function loadScriptsInOrder() {
    const loadState = window.ssappBackgroundLoadState = { status: 'loading', currentScript: '', failures: [] };
    let onloadAtBrowserLoad = null;
    window.addEventListener('load', function () { onloadAtBrowserLoad = window.onload; }, { once: true });
    // Core app scripts; SDK is now lazily loaded by background.js when needed

    const scripts = [
		'./shared/ai/browserModelCatalog.js?v=1',
		'./shared/ai/localBrowserLLM.js?v=1',
		'./actions/EventFlowSystem.js?v=1',
        './shared/alerts/sound-library.js',
        './actions/EventFlowEditor.js?v=1',
		'./actions/interface.js',
		'./dashboard.js',
        './libs/objects.js?v=2',
        './libs/colours.js?v=1',
        './spotify.js?v=1',
        './js/streamdeck-remote-control.js?v=3',
        './shared/monetization/core.js',
        './shared/giveaway/core.js',
        './background.js?v=5',
        './shared/audience-room/connector.js',
        './shared/audience-room/background.js',
        './db.js?v=2',
        './ai.js?v=2',
        './points.js?v=1',
        './pointsactions.js?v=1',
        './shared/stickers/catalog.js',
        './shared/stickers/rewards.js',
        './shared/stickers/background.js',

        './shared/monetization/ebay-service.js',
        './shared/monetization/ninja-service.js',
        './shared/monetization/shopify-service.js',
        './shared/monetization/background.js'

    ];

    for (const src of scripts) {
        loadState.currentScript = src;
        try {
            await loadScript(src);
            console.log(`Successfully loaded: ${src}`);
        } catch (error) {
            loadState.failures.push({ script: src, error: String(error && error.message || error) });
            console.error(`Error in script loading sequence at: ${src}`, error);
            // Keep the existing page/storage origin. SSApp offers an explicit
            // retry rather than executing the rest of an incomplete background.
            if (window.ssappFallback && typeof window.ssappFallback.fetchBackgroundScript === 'function'
                && location.protocol === 'https:') {
                loadState.status = 'failed';
                return;
            }
        }
    }
    // After all scripts are loaded, specifically initialize the editor and UI logic from dashboard.js
    try {
        if (typeof window.initDashboardAndEditor === 'function') {
            window.initDashboardAndEditor();
        }
        loadState.status = 'initializing';
        if (window.ssappFallback && typeof window.ssappFallback.fetchBackgroundScript === 'function'
            && location.protocol === 'https:') {
            if (typeof window.initializeBackgroundSettings === 'function') {
                await window.initializeBackgroundSettings();
            } else if (document.readyState === 'complete' && typeof window.onload === 'function'
                && window.onload !== onloadAtBrowserLoad) {
                // Compatibility with an older background.js from a web cache.
                await window.onload();
            }
        }
    } catch (error) {
        loadState.failures.push({ script: 'initialization', error: String(error && error.message || error) });
    }
    loadState.status = loadState.failures.length ? 'failed' : 'ready';
    loadState.currentScript = '';
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    loadScriptsInOrder();
} else {
    document.addEventListener("DOMContentLoaded", loadScriptsInOrder);
}
