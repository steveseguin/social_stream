(function () {
	"use strict";
	window.createSSNCloudReceipts = function (roomID, urlParams, deliver, receiverName) {
		var cloudReceiptPositions = null;
		var cloudReceiptLegacy = null;
		var cloudReceiptWindow = 10000;
		var cloudReceiptPending = 0;
		var cloudReceiptStorageKey = "ssn-cloud-receipts-v3:" + roomID;
		var remoteCloudReceipts = urlParams.get("cloudack") === "remote";
		var remoteCloudReceiver = null;
		var remoteCloudReceiverPending = false;
		function remoteCloudReceiverName() {
			var label = (urlParams.get("label") || "").trim();
			if (label && label.length <= 64 && !/[\x00-\x1f\x7f]/.test(label)) return label;
			if (receiverName) return receiverName;
			var ua = navigator.userAgent || "";
			return /obsbrowser|OBS Studio/i.test(ua) ? "OBS" : /Android/i.test(ua) ? "Android" :
				/iPhone|iPad/i.test(ua) ? "iPhone / iPad" : /Windows/i.test(ua) ? "Windows" : /Macintosh/i.test(ua) ? "Mac" : "Browser";
		}
		function prepareRemoteCloudReceiver() {
			if (!remoteCloudReceipts || remoteCloudReceiver || remoteCloudReceiverPending) return;
			if (!navigator.locks || typeof navigator.locks.request !== "function") return;
			remoteCloudReceiverPending = true;
			var poolKey = "ssn-cloud-receivers:" + roomID;
			var viewParams = new URLSearchParams(location.search);
			viewParams.delete("server2");
			viewParams.delete("localserver");
			viewParams.delete("localserverport");
			viewParams.sort();
			var view = location.pathname + "?" + viewParams.toString();
			// A held browser lock separates simultaneous copies of the same link.
			// Persisted slots can be reclaimed after a reload or browser restart.
			navigator.locks.request(poolKey, async function () {
				var pool = JSON.parse(localStorage.getItem(poolKey) || "[]");
				if (!Array.isArray(pool) || pool.length > 16 || pool.some(function (slot) {
					return !slot || typeof slot.view !== "string" || !/^[a-f0-9]{32}$/.test(slot.id || "");
				})) return;
				var preferred = sessionStorage.getItem(poolKey + ":" + view);
				var slots = pool.filter(function (slot) { return slot.view === view; });
				slots.sort(function (a, b) { return a.id === preferred ? -1 : b.id === preferred ? 1 : 0; });
				if (pool.length < 16) {
					var bytes = new Uint8Array(16);
					crypto.getRandomValues(bytes);
					var id = Array.from(bytes).map(function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
					slots.push({id: id, view: view});
				}
				for (var i = 0; i < slots.length; i++) {
					var slot = slots[i];
					var acquired = await new Promise(function (resolve) {
						navigator.locks.request(poolKey + ":" + slot.id, {ifAvailable: true}, function (lock) {
							if (!lock) { resolve(false); return; }
							try {
								var key = "ssn-cloud-receipts-v4:" + roomID + ":" + slot.id;
								var positions = JSON.parse(localStorage.getItem(key) || "{}");
								if (!positions || typeof positions !== "object" || Array.isArray(positions)) throw Error("Invalid receipt storage.");
								if (!pool.some(function (saved) { return saved.id === slot.id; })) pool.push(slot);
								localStorage.setItem(poolKey, JSON.stringify(pool));
								sessionStorage.setItem(poolKey + ":" + view, slot.id);
								remoteCloudReceiver = {id: slot.id, key: key, positions: positions};
								resolve(true);
								return new Promise(function () {});
							} catch (error) { resolve(false); }
						}).catch(function () { resolve(false); });
					});
					if (acquired) break;
				}
			}).catch(function () {}).then(function () { remoteCloudReceiverPending = false; });
		}

		try {
			cloudReceiptPositions = JSON.parse(localStorage.getItem(cloudReceiptStorageKey) || localStorage.getItem("ssn-cloud-receipts-v2:" + roomID) || "{}");
			cloudReceiptLegacy = JSON.parse(localStorage.getItem("ssn-cloud-receipts:" + roomID) || "{}");
		} catch (error) {}
		function validCloudReceiptRecord(record) {
			if (!record || !Number.isSafeInteger(record.legacy) || record.legacy < 0 ||
				!Number.isSafeInteger(record.floor) || record.floor < 1 || record.floor < record.legacy ||
				!Array.isArray(record.ranges) || record.ranges.length > cloudReceiptWindow / 2) return false;
			var previous = record.floor - 2;
			for (var i = 0; i < record.ranges.length; i++) {
				var range = record.ranges[i];
				if (!Array.isArray(range) || range.length !== 2 || !Number.isSafeInteger(range[0]) || !Number.isSafeInteger(range[1]) ||
					range[0] < record.floor || range[0] <= record.legacy || range[1] < range[0] ||
					range[1] - record.floor >= cloudReceiptWindow || range[0] <= previous + 1) return false;
				previous = range[1];
			}
			if (record.moderation !== undefined) {
				if (!Array.isArray(record.moderation) || record.moderation.length > cloudReceiptWindow) return false;
				for (var j = 0; j < record.moderation.length; j++) {
					var action = record.moderation[j];
					if (!action || !Number.isSafeInteger(action.seq) || action.seq < record.floor || action.seq - record.floor >= cloudReceiptWindow) return false;
					if (remoteCloudReceipts && action.source !== undefined) {
						if (["twitch", "youtube"].indexOf(action.source) === -1 || ["userid", "chatname", "all"].indexOf(action.field) === -1 ||
							typeof action.value !== "string" || action.value.length > 192 || (action.field !== "all" && !action.value)) return false;
					} else if (action.id !== undefined) {
						if (typeof action.id !== "string" || !action.id || action.id.length > 192) return false;
					} else if (typeof action.userid !== "string" || typeof action.chatroomId !== "string" ||
						!/^[1-9]\d{0,19}$/.test(action.userid) || !/^[1-9]\d{0,19}$/.test(action.chatroomId)) return false;
				}
			}
			return true;
		}
		function hasCloudReceipt(record, sequence) {
			return sequence <= record.legacy || record.ranges.some(function (range) { return sequence >= range[0] && sequence <= range[1]; });
		}
		function mergeCloudReceipts(first, second, sequence) {
			var ranges = first.ranges.concat(second.ranges, [[sequence, sequence]]).sort(function (a, b) { return a[0] - b[0]; });
			var legacy = Math.max(first.legacy, second.legacy);
			var high = Math.max(sequence, first.ranges.length ? first.ranges[first.ranges.length - 1][1] : 0,
				second.ranges.length ? second.ranges[second.ranges.length - 1][1] : 0);
			var floor = Math.max(first.floor, second.floor, high - cloudReceiptWindow + 1, Math.min(Number.MAX_SAFE_INTEGER, legacy + 1));
			var merged = [];
			for (var i = 0; i < ranges.length; i++) {
				if (ranges[i][1] < floor) continue;
				var start = Math.max(floor, ranges[i][0]), last = merged[merged.length - 1];
				if (last && start <= last[1] + 1) last[1] = Math.max(last[1], ranges[i][1]);
				else merged.push([start, ranges[i][1]]);
			}
			var result = { legacy: legacy, floor: floor, ranges: merged };
			var moderation = new Map();
			(first.moderation || []).concat(second.moderation || []).forEach(function (action) {
				if (action.seq < floor) return;
				var key = remoteCloudReceipts && action.source !== undefined ? "source:" + action.source + ":" + action.field + ":" + action.value :
					action.id !== undefined ? "message:" + action.id : "user:" + action.chatroomId + ":" + action.userid;
				if (!moderation.has(key) || moderation.get(key).seq < action.seq) moderation.set(key, action);
			});
			if (moderation.size) result.moderation = Array.from(moderation.values());
			return result;
		}
		function receiveCloudMessage(data, socket) {
			if (data && data.ssnCloudHello) {
				var hello = data.ssnCloudHello;
				if (remoteCloudReceipts && hello.v === 2 && /^[a-f0-9]{32}$/.test(hello.stream || "") && /^[a-f0-9]{32}$/.test(hello.challenge || "")) {
					prepareRemoteCloudReceiver();
					if (remoteCloudReceiver && socket.readyState === 1) socket.send(JSON.stringify({ssnCloudReceiver: {
						v: 2, stream: hello.stream, challenge: hello.challenge, receiver: remoteCloudReceiver.id, name: remoteCloudReceiverName()
					}}));
				}
				return true;
			}
			if (!data || !data.ssnCloudDelivery) return false;
			// Only Cloud's opt-in link consumes these envelopes. Ordinary source
			// messages and existing overlay links retain their usual behavior.
			if (!urlParams.has("cloudack")) return true;
			var receipt = data.ssnCloudDelivery;
			var payload = data.ssnCloudMessage;
			var remoteType = remoteCloudReceipts && payload && (["twitch", "youtube", "chaturbate"].indexOf(payload.delete ? payload.delete.type : payload.type) !== -1 ||
				receipt.v === 2 && ["kick", "tiktok", "cam4", "stripchat", "rumble", "whatnot", "chzzk", "sooplive", "bongacams", "camsoda", "streamate", "bilibili", "picarto", "piczel", "goodgame", "mixcloud", "nicovideo"].indexOf(payload.delete ? payload.delete.type : payload.type) !== -1);
			var remoteReceipt = receipt.v === 2 && remoteType;
			if (remoteReceipt && (!remoteCloudReceiver || receipt.receiver !== remoteCloudReceiver.id)) return true;
			if ((!remoteReceipt && (receipt.v !== 1 || remoteType)) || !/^[a-f0-9]{32}$/.test(receipt.stream || "") ||
				!/^[a-f0-9]{32}$/.test(receipt.token || "") || !Number.isSafeInteger(receipt.seq) || receipt.seq < 1 ||
				!payload || (!remoteType && payload.type !== "kick" && (!payload.delete || payload.delete.type !== "kick"))) return true;
			var storageKey = remoteReceipt ? remoteCloudReceiver.key : cloudReceiptStorageKey;
			var positions = remoteReceipt ? remoteCloudReceiver.positions : cloudReceiptPositions;
			var legacyPositions = remoteReceipt ? {} : cloudReceiptLegacy;
			function acceptReceipt() {
				try {
					if (!positions || typeof positions !== "object" || Array.isArray(positions)) return true;
					var previous = positions[receipt.stream];
					if (!previous) {
						if (Object.keys(positions).length >= 128 || !legacyPositions || typeof legacyPositions !== "object" || Array.isArray(legacyPositions)) return true;
						var legacy = legacyPositions[receipt.stream] || 0;
						if (!Number.isSafeInteger(legacy) || legacy < 0) return true;
						// Old storage only records a high-water mark. Preserve that
						// boundary; new receipts are tracked individually above it.
						previous = { legacy: legacy, floor: Math.min(Number.MAX_SAFE_INTEGER, legacy + 1), ranges: [] };
					}
					if (!validCloudReceiptRecord(previous)) return true;
					var persisted = JSON.parse(localStorage.getItem(storageKey) || (!remoteReceipt && localStorage.getItem("ssn-cloud-receipts-v2:" + roomID)) || "{}");
					if (!persisted || typeof persisted !== "object" || Array.isArray(persisted) ||
						(!persisted[receipt.stream] && Object.keys(persisted).length >= 128)) return true;
					var saved = persisted[receipt.stream] || previous;
					if (!validCloudReceiptRecord(saved)) return true;
					var next = mergeCloudReceipts(previous, previous, receipt.seq);
					if (payload.delete) {
						var action = null;
						if (typeof payload.delete.id === "string" && payload.delete.id && payload.delete.id.length <= 192) action = { seq: receipt.seq, id: payload.delete.id };
						else if (payload.delete.userid && payload.delete.meta && payload.delete.meta.chatroomId) action = { seq: receipt.seq, userid: String(payload.delete.userid), chatroomId: String(payload.delete.meta.chatroomId) };
						else if (remoteCloudReceipts && ["twitch", "youtube"].indexOf(payload.delete.type) !== -1) {
							// Preserve a platform-only delete as an explicit clear of all messages from that platform.
							var field = payload.delete.userid ? "userid" : payload.delete.chatname ? "chatname" : "all";
							action = { seq: receipt.seq, source: payload.delete.type, field: field, value: field === "all" ? "" : String(payload.delete[field]) };
						}
						if (action) next.moderation = (next.moderation || []).concat([action]);
					}
					var combined = mergeCloudReceipts(saved, next, receipt.seq);
					if (!validCloudReceiptRecord(combined)) return true;
					if (!hasCloudReceipt(previous, receipt.seq)) {
						// An expired gap is unknown, not a duplicate. Leave it
						// unacknowledged rather than silently discard its message.
						if (receipt.seq < Math.max(previous.floor, saved.floor)) throw Error("Cloud receipt is outside the retained window.");
						// Check storage availability before handing the message to the dock.
						localStorage.setItem(storageKey, JSON.stringify(persisted));
						var moderated = !payload.delete && (combined.moderation || []).some(function (action) {
							return receipt.seq < action.seq && (remoteCloudReceipts && action.source !== undefined ? payload.type === action.source && (action.field === "all" || String(payload[action.field]) === action.value) : action.id !== undefined ? String(payload.id) === action.id :
								String(payload.userid) === action.userid && String(payload.meta && payload.meta.chatroomId) === action.chatroomId);
						});
						deliver(payload, { stream: receipt.stream, seq: receipt.seq }, moderated);
					}
					// Each open dock has its own delivery ledger. Merge persistent
					// records for reloads without suppressing another dock's feed.
					positions[receipt.stream] = mergeCloudReceipts(next, next, receipt.seq);
					persisted[receipt.stream] = combined;
					localStorage.setItem(storageKey, JSON.stringify(persisted));
					if (socket.readyState === 1) socket.send(JSON.stringify({ssnCloudReceipt: receipt}));
				} catch (error) {
					console.warn("Cloud message confirmation is unavailable.");
				}
			}
			if (navigator.locks && typeof navigator.locks.request === "function") {
				if (cloudReceiptPending >= 1000) return true;
				cloudReceiptPending++;
				// Multiple docks share reload state, but each displays its own
				// feed. Serialize the storage merge across those open pages.
				navigator.locks.request(storageKey, acceptReceipt).catch(function () {
					console.warn("Cloud message confirmation is unavailable.");
				}).then(function () { cloudReceiptPending--; });
			} else acceptReceipt();
			return true;
		}
		if (remoteCloudReceipts) prepareRemoteCloudReceiver();
		return { receive: receiveCloudMessage };
	};
})();
