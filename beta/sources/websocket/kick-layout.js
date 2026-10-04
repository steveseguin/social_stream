(function () {
    var toggle = document.getElementById('compact-menu-toggle');
    var label = document.getElementById('compact-menu-label');
    var chat = document.querySelector('.chat-panel');
    var socketState = document.getElementById('socket-state');
    var compact = window.matchMedia('(max-width: 580px)');
    var desktopChatOpen = chat.open;
    function isConnected() {
        var connected = socketState.getAttribute('data-connected');
        // Older installed capture scripts expose connection state by chip class.
        return connected === 'true' || (connected === null && socketState.matches('.status-chip:not(.warning):not(.danger)'));
    }
    var hasConnected = isConnected();
    var menuOpen = !hasConnected;

    function setMenuOpen(open) {
        document.body.classList.toggle('compact-settings-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        label.textContent = open ? 'Back to chat' : 'Settings';
    }

    function updateLayout() {
        setMenuOpen(compact.matches && menuOpen);
        if (compact.matches) {
            desktopChatOpen = chat.open;
            chat.open = true;
        } else {
            chat.open = desktopChatOpen;
        }
    }

    toggle.addEventListener('click', function () {
        menuOpen = toggle.getAttribute('aria-expanded') !== 'true';
        setMenuOpen(menuOpen);
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && compact.matches && toggle.getAttribute('aria-expanded') === 'true') {
            menuOpen = false;
            setMenuOpen(false);
            toggle.focus();
        }
    });
    // The source script can run in an isolated extension world. Read its DOM
    // status instead of sharing globals or requiring OAuth for public chat.
    new MutationObserver(function () {
        if (hasConnected || !isConnected()) return;
        hasConnected = true;
        menuOpen = false;
        if (compact.matches) {
            var focusWasInSetup = document.getElementById('kick-setup').contains(document.activeElement);
            setMenuOpen(false);
            if (focusWasInSetup) toggle.focus();
        }
    }).observe(socketState, { attributes: true, attributeFilter: ['data-connected', 'class'] });
    compact.addListener(updateLayout);
    updateLayout();
}());
