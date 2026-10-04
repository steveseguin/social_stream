(function () {
	"use strict";
	var storageKey = "ncAudiencePrivate";
	var electron = location.protocol !== "chrome-extension:";
	function load() {
		if (electron) return ipcRenderer.invoke("ninjachatter:audience-room", { op: "load" });
		return new Promise(function (resolve, reject) {
			chrome.storage.local.get([storageKey], function (result) {
				if (chrome.runtime.lastError) return reject(Error("Private storage unavailable"));
				resolve(result && result[storageKey]);
			});
		});
	}
	function save(config) {
		if (electron) return ipcRenderer.invoke("ninjachatter:audience-room", { op: "save", config: config });
		return new Promise(function (resolve, reject) {
			var data = Object.assign({}, config);
			var update = {};
			update[storageKey] = data;
			chrome.storage.local.set(update, function () {
				if (chrome.runtime.lastError) return reject(Error("Private storage unavailable"));
				resolve();
			});
		});
	}
    async function testCheer() {
        if (typeof isExtensionOn !== "undefined" && !isExtensionOn) return false;
        if (!window.eventFlowSystem) return false;
        return window.eventFlowSystem.executeCommunityCheer();
    }
	var connector = new NCAudienceConnector({
		storage: { load: load, save: save },
		cleanText: function (value) {
			return decodeAndCleanHtml(String(value));
		},
		onChat: function (row) {
			if (typeof isExtensionOn !== "undefined" && !isExtensionOn) return;
			// Display path only: bypass bots, Event Flow, points, webhooks, and platform replies.
			sendDataP2P(sanitizeRelayPayloadFields({ id: row.id, chatname: escapeHtml(row.name), chatmessage: row.text, chatimg: "", type: "socialstreamchat", platform: "ninjachatter", /* textonly=true declares a literal chatmessage string, not HTML; preserve its characters and keep display formatting out of the payload. */ textonly: true, meta: { ninjachatter: { origin: "audience", provider: row.provider, room: connector.config.room } } }));
		},
		onCheer: testCheer
	});
	window.ncAudience = {
		paired: function () {
			return !!connector.config.credential;
		},
		ownsRoom: function (room) {
			return !!room && !!connector.config.credential && room === connector.config.room;
		},
		publish: function (message) {
			connector.publish(message).catch(function () {
				connector.warn("publication_unknown");
			});
		},
		handle: async function (request) {
			if (electron) await ready;
			switch (request.op) {
				case "status":
					return connector.status();
				case "test":
					return Object.assign(connector.status(), { testSent: await testCheer() === true });
				case "pair":
					return connector.beginPair();
				case "save":
					await connector.configure({ sources: request.sources, cheer: request.cheer });
					break;
				case "pause":
					await connector.pause();
					break;
				case "resume":
					await connector.resume();
					break;
				case "disconnect":
					await connector.disconnect();
					break;
				default:
					throw Error("Unknown audience room operation");
			}
			return connector.status();
		}
	};
	var ready = connector.init();
	ready.catch(function () {
		connector.notify("storage_error");
	});
})();
