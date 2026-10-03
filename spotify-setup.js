
        document.querySelectorAll('[data-copy]').forEach((button) => {
            button.addEventListener('click', () => {
                const uri = button.parentElement.querySelector('[data-uri]').textContent.trim();
                navigator.clipboard.writeText(uri).then(() => {
                    button.textContent = 'Copied!';
                    setTimeout(() => button.textContent = 'Copy', 1600);
                }).catch(() => {
                    alert('Press Ctrl+C (Cmd+C on Mac) to copy the highlighted text.');
                    const range = document.createRange();
                    range.selectNode(button.parentElement.querySelector('[data-uri]'));
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                });
            });
        });

        (function() {
            const params = new URLSearchParams(window.location.search);
            if (params.has('code') || params.has('error')) {
                const guide = document.getElementById('guide-container');
                if (guide) guide.style.display = 'none';
                const callbackShell = document.getElementById('callback-container');
                if (callbackShell) callbackShell.style.display = 'block';

                const script = document.createElement('script');
                script.src = 'spotify-callback.js';
                document.body.appendChild(script);
            }
        })();
    