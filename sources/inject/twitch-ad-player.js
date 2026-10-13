(function () {
    // The alternate Twitch player lives in the page's JavaScript world.
    if (window.__ssnTwitchAdPlayer) return;
    window.__ssnTwitchAdPlayer = true;
    var enabled = false;
    var volume = 1;
    var muted = null;
    var observer = null;
    var players = new Map();

    function findPlayerComponent(video) {
        var container = video.closest('.pbyp-player-instance');
        if (!container) return null;
        var key = Object.keys(container).find(function (name) {
            return name.indexOf('__reactFiber$') === 0 || name.indexOf('__reactInternalInstance$') === 0;
        });
        var fiber = key && container[key];
        for (var depth = 0; fiber && depth < 30; depth++, fiber = fiber.return) {
            var instance = fiber.stateNode && fiber.stateNode.mediaPlayerInstance;
            if (instance && typeof instance.getHTMLVideoElement === 'function' &&
                instance.getHTMLVideoElement() === video) return fiber.stateNode;
        }
        return null;
    }

    function setBackgroundControl(config, value) {
        var options = { features: { allowBackgroundControl: value } };
        if (typeof config.updateMainConfig === 'function') {
            config.updateMainConfig(options);
        } else {
            config.mergeIntoLayer('adHoc', options);
        }
    }

    function releasePlayer(player, entry) {
        players.delete(player);
        try {
            if (player.core && player.core.configManager === entry.config) {
                setBackgroundControl(entry.config, entry.previous);
            }
        } catch (e) {}
        try {
            if (entry.resumeDestroyTimer && entry.component.mediaPlayerInstance === player &&
                !entry.component.destroyTimeoutID) entry.component.setDestroyTimer();
        } catch (e) {}
    }

    function updatePlayers() {
        var adPlaying = enabled && !!document.querySelector('[data-a-target="video-ad-label"], [data-a-target="video-ad-countdown"]');
        players.forEach(function (entry, player) {
            if (!adPlaying || !entry.video.isConnected || findPlayerComponent(entry.video) !== entry.component ||
                entry.component.mediaPlayerInstance !== player) {
                releasePlayer(player, entry);
            }
        });
        if (!adPlaying) return;
        document.querySelectorAll('.pbyp-player-instance video[id]').forEach(function (video) {
            try {
                var adVideo = document.querySelector('video:not([id])');
                if (video.paused && (!adVideo || adVideo.paused)) return;
                var component = findPlayerComponent(video);
                var player = component && component.mediaPlayerInstance;
                if (!player || players.has(player) || typeof player.play !== 'function' ||
                    typeof player.setMuted !== 'function' || typeof player.setVolume !== 'function') return;
                var config = player.core && player.core.configManager;
                if (!config || typeof config.getConfigSnapshot !== 'function' ||
                    (typeof config.updateMainConfig !== 'function' && typeof config.mergeIntoLayer !== 'function')) return;
                var snapshot = config.getConfigSnapshot();
                if (!snapshot || !snapshot.features || typeof snapshot.features.allowBackgroundControl !== 'boolean') return;
                var entry = { video: video, component: component, config: config, previous: snapshot.features.allowBackgroundControl };
                players.set(player, entry);
                setBackgroundControl(config, true);
                // Twitch cancels this warmup timeout when it shows the alternate
                // player. A hidden tab may never show it, even during the ad.
                if (document.hidden && component.destroyTimeoutID && typeof component.setDestroyTimer === 'function') {
                    clearTimeout(component.destroyTimeoutID);
                    component.destroyTimeoutID = null;
                    entry.resumeDestroyTimer = true;
                }
                // Twitch's attemptPlay otherwise refuses to initialize this player
                // while the document is hidden. Do not resume an already loaded,
                // deliberately paused video, or change the primary/ad player.
                if (document.hidden && video.paused && video.readyState === 0 && !video.src && !video.srcObject) {
                    player.setVolume(volume);
                    player.setMuted(muted === null ? (adVideo || video).muted : muted);
                    player.play();
                }
            } catch (e) {}
        });
    }

    function setEnabled(value) {
        enabled = value;
        if (observer) observer.disconnect();
        observer = null;
        updatePlayers();
        if (!enabled || !document.documentElement) return;
        observer = new MutationObserver(updatePlayers);
        observer.observe(document.documentElement, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['data-a-target', 'id']
        });
    }

    window.addEventListener('message', function (event) {
        if (event.source !== window || event.origin !== location.origin || !event.data ||
            event.data.source !== 'ssn-twitch-ad-player-settings') return;
        if (typeof event.data.volume === 'number' && isFinite(event.data.volume)) {
            volume = Math.max(0, Math.min(1, event.data.volume));
        }
        if (typeof event.data.muted === 'boolean') muted = event.data.muted;
        setEnabled(event.data.enabled === true);
    });
    window.addEventListener('pagehide', function () { setEnabled(false); });
    document.addEventListener('DOMContentLoaded', function () {
        if (enabled) setEnabled(true);
    });
    window.addEventListener('pageshow', function () {
        window.postMessage({ source: 'ssn-twitch-ad-player-ready' }, location.origin);
    });
    window.postMessage({ source: 'ssn-twitch-ad-player-ready' }, location.origin);
})();
