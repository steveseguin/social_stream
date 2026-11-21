(function (global) {
	"use strict";

	// Exact Twitch logins only; custom bot accounts can still be assigned in settings.
	var knownBots = new Set([
		"botrixoficial",
		"fossabot",
		"kofistreambot",
		"moobot",
		"nightbot",
		"own3d",
		"pokemoncommunitygame",
		"pretzelrocks",
		"sery_bot",
		"soundalerts",
		"streamelements",
		"streamlabs",
		"tangiabot",
		"twitchmusicid",
		"wizebot"
	]);
	// Twitch's global bot-badge/1 image, shared by every locale.
	var botBadgeImageId = "3ffa9565-c35b-4cad-800b-041e60659cf2";

	function isKnownBot(login) {
		return typeof login === "string" && knownBots.has(login.trim().toLowerCase());
	}

	function isBotBadgeId(value) {
		return typeof value === "string" && value.split("/")[0].trim().toLowerCase() === "bot-badge";
	}

	function hasBotBadge(badges) {
		if (typeof badges === "string") {
			return badges.split(",").some(isBotBadgeId);
		}
		if (Array.isArray(badges)) {
			return badges.some(function (badge) {
				return badge && isBotBadgeId(badge.set_id);
			});
		}
		return !!badges && typeof badges === "object" && Object.prototype.hasOwnProperty.call(badges, "bot-badge");
	}

	function isBotBadgeElement(badge) {
		if (!badge || !badge.getAttribute) return false;
		var sources = [badge.src, badge.srcset, badge.getAttribute("data-src"), badge.style && badge.style.backgroundImage];
		if (badge.classList && badge.classList.contains("ffz-badge")) {
			try { sources.push(getComputedStyle(badge).backgroundImage); } catch (e) {}
		}
		if (sources.some(function (source) {
			return String(source || "").toLowerCase().indexOf("/badges/v1/" + botBadgeImageId + "/") !== -1;
		})) return true;

		var nodes = [badge, badge.parentElement];
		var attributes = ["data-a-badge", "data-badge", "data-badge-id", "data-a-badge-id", "data-badge-set-id", "data-set-id"];
		for (var i = 0; i < nodes.length; i++) {
			if (!nodes[i] || !nodes[i].getAttribute) continue;
			for (var j = 0; j < attributes.length; j++) {
				if (isBotBadgeId(nodes[i].getAttribute(attributes[j]))) return true;
			}
		}
		// Exact badge labels only, never message text or a username containing "bot".
		return [badge.alt, badge.getAttribute("aria-label"), badge.getAttribute("title")].some(function (label) {
			return /^(chat bot|bot)( badge)?$/i.test(String(label || "").trim());
		});
	}

	global.SSNTwitchBots = Object.freeze({
		isKnownBot: isKnownBot,
		hasBotBadge: hasBotBadge,
		isBotBadgeElement: isBotBadgeElement
	});
})(typeof globalThis !== "undefined" ? globalThis : window);
