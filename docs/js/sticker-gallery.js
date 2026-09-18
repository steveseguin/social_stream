(function () {
    'use strict';
    var dialog = document.getElementById('sticker-preview');
    var frame = document.getElementById('preview-frame');
    var current;
    var copyTimer;
    function showCopyStatus(text, copied) {
        clearTimeout(copyTimer);
        document.getElementById('copy-status').textContent = (copied ? 'Copied: ' : 'Copy this command: ') + text;
        if (copied) copyTimer = setTimeout(function () { document.getElementById('copy-status').textContent = ''; }, 4000);
    }
    document.querySelectorAll('[data-variation]').forEach(function (select) {
        select.addEventListener('change', function () {
            var card = select.closest('[data-pack]');
            var pack = SSNStickers.packs.find(function (item) { return item.id === card.dataset.pack; });
            var reward = pack.rewards.find(function (item) { return item.id === select.value; });
            if (!reward) return;
            card.querySelector('code').textContent = '!sticker ' + reward.id;
            card.querySelector('[data-copy]').dataset.copy = '!sticker ' + reward.id;
            var link = card.querySelector('[data-preview]');
            link.dataset.preview = reward.id; link.href = '../stickers.html?demo=' + reward.id;
        });
    });
    document.querySelectorAll('[data-preview]').forEach(function (link) {
        link.addEventListener('click', function (event) {
            if (!dialog.showModal) return; // The normal preview link works in older browsers.
            event.preventDefault(); current = link.href; frame.src = current;
            document.getElementById('preview-title').textContent = link.closest('article').querySelector('h2').textContent;
            dialog.showModal();
        });
    });
    document.getElementById('preview-close').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () { frame.src = 'about:blank'; });
    document.getElementById('preview-replay').addEventListener('click', function () { frame.src = current; });
    document.querySelectorAll('[data-copy]').forEach(function (button) {
        button.addEventListener('click', function () {
            var text = button.dataset.copy;
            function fallback() {
                var input = document.createElement('textarea'); input.value = text;
                input.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(input); input.select();
                var copied = false; try { copied = document.execCommand('copy'); } catch (_) {}
                input.remove(); button.focus(); showCopyStatus(text, copied);
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () { showCopyStatus(text, true); }, fallback);
            } else fallback();
        });
    });
})();
