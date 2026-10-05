(function () {
	if (!/^(www\.)?starvios\.com$/i.test(location.hostname) || !/^\/popout\/chat\/[^/]+\/?$/.test(location.pathname) || window.__ssnReadStarviosMessageId) { return; }
	function readMessageId(row) {
		if (!row || !row.parentElement || !row.parentElement.matches("main div.overscroll-contain.overflow-y-auto")) { return ""; }
		// Starvios keys each rendered chat row by its message ID, including tmp-* sends.
		var keys = Object.keys(row);
		for (var i = 0; i < keys.length; i++) {
			if (keys[i].indexOf("__reactFiber$") !== 0) { continue; }
			var fiber = row[keys[i]];
			return fiber && typeof fiber.key === "string" ? fiber.key : "";
		}
		return "";
	}
	window.__ssnReadStarviosMessageId = readMessageId;
	// Chrome content scripts use a separate world; share only this row's ID via the DOM.
	document.addEventListener("ssn-read-starvios-id", function (event) {
		try {
			var id = readMessageId(event.target);
			if (id) { event.target.setAttribute("data-ssn-starvios-id", id); }
		} catch (e) {}
	});
})();
