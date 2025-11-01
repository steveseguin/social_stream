// loader.js (for background.html)
function loadScript(src) {
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
    // Core app scripts; SDK is now lazily loaded by background.js when needed

    const scripts = [
		'./actions/EventFlowSystem.js?v=1',
        './actions/EventFlowEditor.js?v=1',
		'./actions/interface.js',
		'./dashboard.js',
        './libs/objects.js?v=1',
        './libs/colours.js?v=1',
        './spotify.js?v=1',
        './background.js?v=2',
        './db.js?v=1',
        './ai.js?v=2',
        './points.js?v=1'

    ];

    for (const src of scripts) {
        try {
            await loadScript(src);
            console.log(`Successfully loaded: ${src}`);
        } catch (error) {
            console.error(`Error in script loading sequence at: ${src}`, error);
            // Continue loading other scripts even if one fails
        }
    }
    // After all scripts are loaded, specifically initialize the editor and UI logic from dashboard.js
    if (typeof window.initDashboardAndEditor === 'function') {
        window.initDashboardAndEditor();
    }
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    loadScriptsInOrder();
} else {
    document.addEventListener("DOMContentLoaded", loadScriptsInOrder);
}
