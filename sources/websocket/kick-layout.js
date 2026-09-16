(function () {
    var toggle = document.getElementById('compact-menu-toggle');
    var label = document.getElementById('compact-menu-label');
    var chat = document.querySelector('.chat-panel');
    var compact = window.matchMedia('(max-width: 580px)');
    var desktopChatOpen = chat.open;

    function setMenuOpen(open) {
        document.body.classList.toggle('compact-settings-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        label.textContent = open ? 'Back to chat' : 'Settings';
    }

    function updateLayout() {
        setMenuOpen(false);
        if (compact.matches) {
            desktopChatOpen = chat.open;
            chat.open = true;
        } else {
            chat.open = desktopChatOpen;
        }
    }

    toggle.addEventListener('click', function () {
        setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && compact.matches && toggle.getAttribute('aria-expanded') === 'true') {
            setMenuOpen(false);
            toggle.focus();
        }
    });
    compact.addListener(updateLayout);
    updateLayout();
}());
