// Read explicit native moderation events. Removing old DOM rows is not moderation.
(function () {
	var host = location.hostname;
	var type = /(^|\.)cam4\.com$/.test(host) ? "cam4" : /(^|\.)camsoda\.com$/.test(host) ? "camsoda" : /(^|\.)bongacams\.com$/.test(host) ? "bongacams" : /(^|\.)stripchat\.com$/.test(host) ? "stripchat" : "";
	if (!type || window.__ssnCamModerationReader) return;
	window.__ssnCamModerationReader = true;
	var attached = null;
	var detach = null;
	var cam4Require = null;
	var sodaHandler = null;
	var sodaRoom = "";
	var selectors = {
		cam4: "[class*='ChatMessageTypes__msgPosition']",
		camsoda: "[class*='message-module__wrapper--']",
		stripchat: ".message-base"
	};
	function room() { return location.pathname.toLowerCase().replace(/\/$/, ""); }
	function publish(data) {
		data.type = type;
		if (!data.room) data.room = room();
		document.dispatchEvent(new CustomEvent("ssn-cam-moderation", { detail: JSON.stringify(data) }));
	}
	function walk(row, visit) {
		if (!row) return;
		var key = Object.keys(row).find(function (key) { return key.indexOf("__reactFiber") === 0; });
		var fiber = key && row[key];
		for (var depth = 0; fiber && depth < 180; depth++, fiber = fiber.return) {
			if (visit(fiber.memoizedProps || {})) return;
		}
	}
	// Like the Starvios ID reader, bridge only the needed scalar through the DOM.
	document.addEventListener("ssn-read-cam4-id", function (event) {
		if (type !== "cam4") return;
		walk(event.target, function (props) {
			var message = props.value && props.value.message;
			if (!message || message.type !== 1 || !message.timestamp) return false;
			event.target.setAttribute("data-ssn-cam4-id", String(message.timestamp));
			return true;
		});
	});
	function connectCam4() {
		if (attached || !document.querySelector(selectors.cam4)) return;
		var chunks = window.webpackChunk;
		var moduleId = "./javascripts/stores/ChatStore.js";
		// A rendered chat row means this store is already initialized. Never load another bundle.
		if (!Array.isArray(chunks) || !chunks.some(function (chunk) { return chunk && chunk[1] && chunk[1][moduleId]; })) return;
		if (!cam4Require) chunks.push([["ssn-cam4-moderation-reader"], {}, function (require) { cam4Require = require; }]);
		if (!cam4Require) return;
		var store = cam4Require(moduleId).default;
		if (!store || typeof store._handleMainChatLight !== "function") return;
		var original = store._handleMainChatLight;
		store._handleMainChatLight = function (event) {
			try {
				var value = event && event.snapshot && event.snapshot.val();
				if (value && Object.prototype.hasOwnProperty.call(value, "delete") && value.tm && event.roomName) {
					publish({ room: "/" + String(event.roomName).toLowerCase(), ids: [String(value.tm)] });
				}
			} catch (_) { }
			return original.apply(this, arguments);
		};
		attached = store;
	}
	function connectBonga() {
		var chat = window.chat;
		if (!chat || chat === attached || typeof chat.onDeleteMessages !== "function") return;
		if (detach) detach();
		var original = chat.onDeleteMessages;
		var wrapper = function (event) {
			try {
				if (event && (!event.r || String(event.r).toLowerCase() === room().split("/")[1])) {
					if (event.id) publish({ ids: [String(event.id)] });
					else if (event.username) publish({ username: String(event.username) });
				}
			} catch (_) { }
			return original.apply(this, arguments);
		};
		chat.onDeleteMessages = wrapper;
		attached = chat;
		detach = function () { if (chat.onDeleteMessages === wrapper) chat.onDeleteMessages = original; };
	}
	function connectSoda() {
		var username = room().split("/")[1];
		var client = null;
		walk(document.querySelector(selectors.camsoda) || document.querySelector("[class*='chat-module__wrapper--']"), function (props) {
			var value = props.value && props.value[username];
			if (!value || typeof value.on !== "function" || typeof value.off !== "function" || !value.socket) return false;
			client = value;
			return true;
		});
		if (!client && room() === sodaRoom) return;
		if (client && client === attached && (typeof client.listeners !== "function" || client.listeners("v3.chat.moderate").indexOf(sodaHandler) !== -1)) return;
		if (detach) detach();
		attached = client;
		detach = null;
		if (!client) return;
		var currentRoom = room();
		sodaRoom = currentRoom;
		function moderate(event) {
			if (!event || !event.username) return;
			if ((event.action === "banned" && event.type === "add") || event.action === "silenced") {
				publish({ room: currentRoom, username: String(event.username) });
			}
		}
		client.on("v3.chat.moderate", moderate);
		sodaHandler = moderate;
		detach = function () { client.off("v3.chat.moderate", moderate); };
	}
	function connectStrip() {
		var bus = null;
		walk(document.querySelector(selectors.stripchat), function (props) {
			var value = props.value && props.value.eventEmitter;
			if (!value || !value.handlers || !value.handlers.wsMessage || typeof value.on !== "function") return false;
			bus = value;
			return true;
		});
		if (!bus || bus === attached) return;
		if (detach) detach();
		attached = bus;
		// Namespace listener observes existing subscriptions without requesting new ones.
		detach = bus.on({ namespace: "wsMessage", handler: function (event) {
			var data = event && event.data;
			if (!data) return;
			if (event.type === "clearChatMessages") {
				var users = Array.isArray(data.senderIds) ? data.senderIds : [data.senderId];
				publish({ userIds: users.filter(function (id) { return id != null; }).map(String) });
			} else if (/^deleteChatMessages@\d+$/.test(event.type) && Array.isArray(data.messageIds)) {
				publish({ ids: data.messageIds.map(String) });
			}
		} });
	}
	function connect() {
		try {
			if (type === "cam4") connectCam4();
			else if (type === "camsoda") connectSoda();
			else if (type === "bongacams") connectBonga();
			else connectStrip();
		} catch (_) { }
	}
	connect();
	setInterval(connect, 2000);
})();
