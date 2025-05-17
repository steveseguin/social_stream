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
    const scripts = [
        './dashboard.js',
        './actions/EventFlowSystem.js?v=1',
        './libs/objects.js?v=1',
        './libs/colours.js?v=1',
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
            console.error(`Error in script loading sequence at: ${src}`);
            // To stop on first error, uncomment the next line:
            // break;
        }
    }
}

document.addEventListener('DOMContentLoaded', loadScriptsInOrder);