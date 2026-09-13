(function () {
    'use strict';
    if (!new URLSearchParams(location.search).has('trackquestions')) return;
    var button = document.createElement('button'), filtering = false, sequence = 0;
    button.id = 'question-tracker'; button.type = 'button'; button.textContent = 'Questions 0';
    button.title = 'Show unanswered questions (latest 100; resets on reload)'; button.setAttribute('aria-pressed', 'false');
    document.getElementById('menu').appendChild(button);
    function refresh() {
        button.textContent = 'Questions ' + document.querySelectorAll('.ssn-question-pending').length;
    }
    button.onclick = function () {
        filtering = !filtering; document.body.classList.toggle('ssn-questions-only', filtering);
        button.setAttribute('aria-pressed', String(filtering));
    };
    window.SSNQuestionTracker = {
        add: function (node, data) {
            var text = String(data.chatmessage || '');
            if (!data.textonly) { var template = document.createElement('template'); template.innerHTML = text; text = template.content.textContent || ''; }
            if ((!data.question && text.indexOf('?') < 0) || data.event || data.bot || data.private || node.querySelector('.ssn-question-actions')) return;
            var pending = document.querySelectorAll('.ssn-question-pending');
            if (pending.length >= 100) {
                var oldest = Array.prototype.reduce.call(pending, function (a, b) { return a.ssnQuestionOrder < b.ssnQuestionOrder ? a : b; });
                oldest.classList.remove('ssn-question-pending');
                var oldActions = oldest.querySelector('.ssn-question-actions'); if (oldActions) oldActions.remove();
            }
            node.ssnQuestionOrder = ++sequence;
            node.classList.add('ssn-question-pending');
            var actions = document.createElement('div'); actions.className = 'ssn-question-actions';
            ['Answered', 'Dismiss'].forEach(function (label) {
                var action = document.createElement('button'); action.type = 'button'; action.textContent = label;
                action.onclick = function (event) {
                    event.stopPropagation(); node.classList.remove('ssn-question-pending');
                    actions.remove(); refresh();
                };
                actions.appendChild(action);
            });
            // Keep the existing first child and its queue metadata intact.
            actions.addEventListener('mousedown', function (event) { event.stopPropagation(); });
            actions.addEventListener('contextmenu', function (event) { event.stopPropagation(); });
            node.appendChild(actions); refresh();
        }
    };
    // Deletion and clearing chat also update the pending count.
    ['output', 'pinned'].forEach(function (id) { new MutationObserver(refresh).observe(document.getElementById(id), {childList:true}); });
})();
