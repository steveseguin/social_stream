(function () {
    var source = document.body.getAttribute('data-compact-source');
    var layouts = {
        twitch: { title: 'Twitch Chat', feed: '#textarea', compose: '.chat-input', extra: '#send-status', pane: '.chat-container', watch: '#sendmessage', connected: '#sendmessage[data-chat-connected="true"]', auth: '.auth' },
        youtube: { title: 'YouTube Chat', feed: '#textarea', compose: '.chat-input', extra: '#write-access-note', pane: '.chat-container', watch: '#textarea', connected: '#textarea[data-connected="true"]', auth: '.auth' },
        rumble: { title: 'Rumble Chat', feed: '#feed', pane: '.stream-panel', watch: '#socket-chip', connected: '#socket-chip.good' },
        facebook: { title: 'Facebook Chat', feed: '#chat-feed', pane: '.panel', watch: '#chat-feed', connected: '#chat-feed[data-connected="true"]' },
        joystick: { title: 'Joystick Chat', feed: '#feed', compose: '#chat-input', composeParent: true, pane: '.card', watch: '#socket-chip', connected: '#socket-chip.good' },
        vpzone: { title: 'VPZone Chat', feed: '#feed', compose: '#chat-compose', pane: '.card', watch: '#socket-chip', connected: '#socket-chip.good' },
        velora: { title: 'Velora Chat', feed: '#chat-feed', compose: '.chat-input-footer', pane: '.chat-panel', watch: '#socket-state', connected: '#socket-state.connected', gate: '#dashboard' },
        bilibili: { title: 'Bilibili Chat', feed: '#messageContainer', compose: '#messageInput', composeParent: true, watch: '#disconnectBtn', connected: '#disconnectBtn:not([disabled])' },
        irc: { title: 'IRC Chat', feed: '#messageArea', compose: '#messageForm', watch: '#status', connected: '#status[data-connected="true"]' },
        nostr: { title: 'Nostr Chat', feed: '#messageArea', watch: '#streamInfo, #relayStatus', connected: '#streamInfo:not(.hidden)', relay: '#relayStatus .connected' },
        stageten: { title: 'Stage TEN Chat', feed: '#textarea', compose: '.chat-input', pane: '.chat-container', watch: '#channel-status', connected: '#channel-status.status-connected', auth: '.auth' },
        socialstreamchat: { title: 'Social Stream Chat', feed: '#textarea', compose: '.chat-input', pane: '.chat-container', watch: '#room-status', connected: '#room-status.status-connected', auth: '.auth' },
        streamlabs: { title: 'Streamlabs Alerts', feed: '#event-log', pane: '.panel', watch: '#connection-chip', connected: '#connection-chip.connected' }
    };
    var layout = layouts[source];
    if (!layout) return;
    var feed = document.querySelector(layout.feed);
    if (!feed) return;
    var compact = window.matchMedia('(max-width: 580px)');
    var compose = layout.compose && document.querySelector(layout.compose);
    if (compose && layout.composeParent) compose = compose.parentElement;
    var extra = layout.extra && document.querySelector(layout.extra);
    var auth = layout.auth && document.querySelector(layout.auth);
    var gate = layout.gate && document.querySelector(layout.gate);
    var paths = [];
    var leaves = [feed];
    if (compose) leaves.push(compose);
    if (extra) leaves.push(extra);
    feed.classList.add('ss-chat-feed');
    if (compose) compose.classList.add('ss-chat-compose');
    if (extra) extra.classList.add('ss-chat-extra');
    if (layout.pane) feed.closest(layout.pane).classList.add('ss-chat-pane');

    // Keep the original DOM and controls in place for each source's handlers.
    leaves.forEach(function (leaf) {
        var node = leaf.parentElement;
        while (node && node !== document.body) {
            if (paths.indexOf(node) === -1) paths.push(node);
            node = node.parentElement;
        }
    });
    paths.forEach(function (node) {
        node.classList.add('ss-chat-path');
        if (!node.contains(feed)) node.classList.add('ss-chat-compose-path');
    });
    var setupIds = [];
    paths.concat([document.body]).forEach(function (node) {
        Array.prototype.forEach.call(node.children, function (child) {
            if (paths.indexOf(child) !== -1 || leaves.indexOf(child) !== -1 || /^(SCRIPT|STYLE|LINK)$/.test(child.tagName)) return;
            child.classList.add('ss-chat-setup');
            if (!child.id) child.id = 'ss-source-setup-' + setupIds.length;
            setupIds.push(child.id);
        });
    });

    var toolbar = document.createElement('div');
    toolbar.className = 'ss-compact-toolbar';
    var title = document.createElement('strong');
    title.textContent = layout.title;
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', setupIds.join(' '));
    toolbar.appendChild(title);
    toolbar.appendChild(toggle);
    document.body.insertBefore(toolbar, document.body.firstChild);
    document.body.classList.add('ss-compact-source');

    var hasConnected = false;
    var menuOpen = true;
    var detailStates = [];
    function render() {
        var open = compact.matches && menuOpen;
        document.body.classList.toggle('ss-setup-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.textContent = open ? 'Back to chat' : '\u2630 Settings';
    }
    function updateConnection() {
        if ((auth && !auth.hidden && !auth.classList.contains('hidden')) || (gate && gate.hidden)) {
            hasConnected = false;
            menuOpen = true;
            render();
            return;
        }
        if (hasConnected || !document.querySelector(layout.connected)) return;
        if (layout.relay && !document.querySelector(layout.relay)) return;
        hasConnected = true;
        menuOpen = false;
        var focusWasInSetup = document.activeElement.closest('.ss-chat-setup');
        render();
        if (compact.matches && focusWasInSetup) toggle.focus();
    }
    function updateLayout() {
        if (compact.matches) {
            paths.forEach(function (node) {
                if (node.tagName !== 'DETAILS') return;
                detailStates.push({ node: node, open: node.open });
                node.open = true;
            });
        } else {
            detailStates.forEach(function (entry) { entry.node.open = entry.open; });
            detailStates = [];
        }
        render();
    }
    toggle.addEventListener('click', function () {
        menuOpen = !menuOpen;
        render();
    });
    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' || !compact.matches || !menuOpen) return;
        menuOpen = false;
        render();
        toggle.focus();
    });
    var observer = new MutationObserver(updateConnection);
    document.querySelectorAll(layout.watch).forEach(function (node) {
        observer.observe(node, { attributes: true, childList: !!layout.relay, subtree: !!layout.relay });
    });
    if (auth) observer.observe(auth, { attributes: true, attributeFilter: ['class', 'hidden'] });
    if (gate) observer.observe(gate, { attributes: true, attributeFilter: ['hidden'] });
    compact.addListener(updateLayout);
    updateConnection();
    updateLayout();
}());
