(function () {
	var host = location.hostname;
	var type = /(^|\.)cam4\.com$/.test(host) ? "cam4" : /(^|\.)camsoda\.com$/.test(host) ? "camsoda" : /(^|\.)bongacams\.com$/.test(host) ? "bongacams" : /(^|\.)stripchat\.com$/.test(host) ? "stripchat" : "";
	if (!type || window.__ssnCamModeration) return;
	var records = new Map();
	var deleted = new Set();
	var deletedRows = new WeakSet();
	var rowIds = new WeakMap();
	var serial = 0;
	var instance = Date.now().toString(36) + Math.random().toString(36).slice(2);
	function room() { return location.pathname.toLowerCase().replace(/\/$/, ""); }
	function key(id, sourceRoom) { return type === "stripchat" ? String(id) : sourceRoom + ":" + id; }
	function trim(collection) {
		while (collection.size > 5000) collection.delete(collection.keys().next().value);
	}
	function nativeId(row) {
		if (type === "stripchat") return row.getAttribute("data-message-id") || "";
		if (type === "bongacams") {
			var element = row.matches(".msg_row") ? row : row.querySelector(".msg_row");
			var match = element && element.className.match(/(?:^|\s)js-chat_msg_(\d+)(?:\s|$)/);
			return match ? match[1] : "";
		}
		if (type === "cam4") {
			var element = row.querySelector("[class*='ChatMessageTypes__msgPosition']") || row;
			element.dispatchEvent(new CustomEvent("ssn-read-cam4-id", { bubbles: true }));
			return element.getAttribute("data-ssn-cam4-id") || "";
		}
		return "";
	}
	function userId(row) {
		var element = row.querySelector("[id^='user-levels-name-']");
		var match = element && element.id.match(/^user-levels-name-(\d+)-/);
		return match ? match[1] : "";
	}
	function remove(id) {
		if (deleted.has(id)) return;
		deleted.add(id);
		trim(deleted);
		records.delete(id);
		try { chrome.runtime.sendMessage(chrome.runtime.id, { delete: { type: type, meta: { messageId: id } } }, function () {}); } catch (_) { }
	}
	window.__ssnCamModeration = {
		track: function (row, data) {
			if (deletedRows.has(row)) return false;
			var sourceRoom = room();
			var native = nativeId(row);
			var id = native ? key(native, sourceRoom) : rowIds.get(row);
			if (!id) {
				id = sourceRoom + ":ssn:" + instance + ":" + (++serial);
				rowIds.set(row, id);
			}
			if (deleted.has(id)) return false;
			data.meta = data.meta || {};
			data.meta.messageId = id;
			var username = type === "bongacams" ? row.getAttribute("data-author") || data.chatname : data.chatname;
			records.set(id, { room: sourceRoom, username: (username || "").toLowerCase(), userId: userId(row) });
			trim(records);
			return true;
		}
	};
	document.addEventListener("ssn-cam-moderation", function (event) {
		try {
			var data = JSON.parse(event.detail);
			if (!data || data.type !== type || data.room !== room()) return;
			if (Array.isArray(data.ids)) data.ids.slice(0,5000).forEach(function (id) {
				if (/^\d+$/.test(String(id))) remove(key(id, data.room));
			});
			var username = typeof data.username === "string" ? data.username.toLowerCase() : "";
			var users = new Set(Array.isArray(data.userIds) ? data.userIds.map(String) : []);
			if (!username && !users.size) return;
			records.forEach(function (record, id) {
				if (record.room === data.room && ((username && record.username === username) || users.has(record.userId))) remove(id);
			});
			// Also suppress rows waiting for their text/author to finish rendering.
			var selector = type === "camsoda" ? "[class*='message-module__wrapper--']" : type === "bongacams" ? ".js-chat_msg" : ".message-base";
			document.querySelectorAll(selector).forEach(function (row) {
				var author = row.getAttribute("data-author") || "";
				if (type === "camsoda") {
					var name = row.querySelector("[class*='chat-user-module__user--']");
					author = name ? name.textContent.trim().replace(/:$/, "") : "";
				}
				if ((username && author.toLowerCase() === username) || users.has(userId(row))) deletedRows.add(row);
			});
		} catch (_) { }
	});
})();
