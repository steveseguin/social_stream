(function () {
	if (!/^(www\.)?goodgame\.ru$/.test(location.hostname) || !/^\/(?:channel\/)?[^/]+\/chat\/?$/.test(location.pathname) || window.__ssnGoodgameIds) { return; }
	window.__ssnGoodgameIds = true;

	// Angular keeps the native message ID in its row scope, outside the extension's isolated world.
	function identify(row) {
		try {
			if (!/^\/(?:channel\/)?[^/]+\/chat\/?$/.test(location.pathname) || !window.angular || !row.matches(".message-block")) { return; }
			var scope = window.angular.element(row).scope();
			var message = scope && scope.message;
			var id = message && (message.message_id || message.id);
			if (id && /^\d+$/.test(String(id))) { row.setAttribute("data-ssn-goodgame-id", String(id)); }
		} catch (e) {}
	}
	function scan(node) {
		if (!node || node.nodeType !== 1) { return; }
		var row = node.closest(".message-block");
		if (row) { identify(row); }
		node.querySelectorAll(".message-block").forEach(identify);
	}
	new MutationObserver(function (mutations) {
		mutations.forEach(function (mutation) {
			scan(mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement);
		});
	}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
	scan(document.documentElement);
	// Also catch rows rendered before Angular exposes their scopes.
	setInterval(function () { scan(document.querySelector(".chat-section")); }, 1000);
})();
