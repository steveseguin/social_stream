(function () {
// Keep these aligned with Optional chat services and the packaged content scripts.
const CAPTURE_REMINDER_SITES = [
	{ setting: "teams", name: "Teams", hosts: ["teams.live.com", "teams.microsoft.com", "teams.cloud.microsoft"] },
	{ setting: "discord", name: "Discord", hosts: ["discord.com", "discord.gg"] },
	{ setting: "slack", name: "Slack", hosts: ["app.slack.com"], path: /^\/client\// },
	{ setting: "openai", name: "ChatGPT", hosts: ["chat.openai.com", "chatgpt.com"] },
	{ setting: "chime", name: "Chime", hosts: ["app.chime.aws"], path: /^\/meetings\// },
	{ setting: "meet", name: "Google Meet", hosts: ["meet.google.com"] },
	{ setting: "telegram", name: "Telegram", hostSuffix: ".telegram.org", path: /^\/(a|k|z)\// },
	{ setting: "whatsapp", name: "WhatsApp", hosts: ["web.whatsapp.com"] },
	{ setting: "instagram", name: "Instagram non-live", hosts: ["www.instagram.com"], excludePath: /\/live(?:\/|$)|^\/stories\// },
	{ setting: "xcapture", name: "X embedded page features", hosts: ["x.com", "www.x.com"],
		excludePath: /^\/(?:i|messages|notifications|bookmarks|settings|compose)(?:\/|$)|\/(?:chat|live|livechat)\/?$/,
		message: "Enable capture to use X's embedded post capture controls." }
];
function getCaptureReminderSite(sender) {
	if (!sender || !sender.tab) {
		return null;
	}
	try {
		const url = new URL(sender.url || sender.tab.url);
		if (url.protocol !== "https:") {
			return null;
		}
		return CAPTURE_REMINDER_SITES.find(function (site) {
			return ((site.hosts && site.hosts.includes(url.hostname)) || (site.hostSuffix && url.hostname.endsWith(site.hostSuffix))) &&
				(!site.path || site.path.test(url.pathname)) && (!site.excludePath || !site.excludePath.test(url.pathname));
		}) || null;
	} catch (e) {
		return null;
	}
}


function initializeCaptureReminder() {
	// The desktop app does not require these opt-ins.
	if (!/^(chrome|moz)-extension:$/.test(location.protocol) || typeof chrome === "undefined" || !chrome.tabs || !chrome.storage) return;
	var panel = document.getElementById("captureSiteReminder");
	if (!panel) return;
	var message = panel.querySelector("[data-capture-message]");
	var enable = panel.querySelector("[data-capture-enable]");
	var dismiss = panel.querySelector("[data-capture-dismiss]");
	var site = null;
	var revision = 0;
	var busy = false;
	function refresh() {
		var currentRevision = ++revision;
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if (chrome.runtime.lastError || currentRevision !== revision) return;
			var candidate = tabs && tabs[0] && getCaptureReminderSite({ tab: tabs[0] });
			if (!candidate) { panel.hidden = true; site = null; return; }
			// Only explicit popup dismissal suppresses this; old system notification flags do not.
			chrome.storage.local.get(["settings", candidate.setting + "CapturePopupDismissed"], function (stored) {
				if (chrome.runtime.lastError || currentRevision !== revision) return;
				stored = stored || {};
				site = candidate;
				panel.hidden = !!((stored.settings || {})[site.setting] || stored[site.setting + "CapturePopupDismissed"]);
				message.textContent = site.name + " detected. Capture is off.";
			});
		});
	}
	function setBusy(value) {
		busy = value;
		enable.disabled = value;
		dismiss.disabled = value;
	}
	enable.addEventListener("click", function () {
		if (!site || busy) return;
		var selected = site;
		setBusy(true);
		chrome.runtime.sendMessage({ cmd: "saveSetting", type: "setting", setting: selected.setting, value: true }, function (response) {
			setBusy(false);
			if (chrome.runtime.lastError || !response || !response.saved) {
				message.textContent = "Couldn't enable capture. Please try again.";
				return;
			}
			panel.hidden = true;
			// Keep the existing capture toggle and source settings in sync.
			var checkbox = document.querySelector('input[data-setting="' + selected.setting + '"]');
			if (checkbox) checkbox.checked = true;
		});
	});
	dismiss.addEventListener("click", function () {
		if (!site || busy) return;
		setBusy(true);
		chrome.storage.local.set({ [site.setting + "CapturePopupDismissed"]: true }, function () {
			setBusy(false);
			if (chrome.runtime.lastError) {
				message.textContent = "Couldn't save dismissal. Please try again.";
				return;
			}
			panel.hidden = true;
		});
	});
	chrome.storage.onChanged.addListener(function (changes, area) {
		if (area === "local" && (changes.settings || (site && changes[site.setting + "CapturePopupDismissed"]))) refresh();
	});
	if (chrome.tabs.onActivated) chrome.tabs.onActivated.addListener(refresh);
	if (chrome.tabs.onUpdated) chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
		if (tab.active && changeInfo.url) refresh();
	});
	refresh();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeCaptureReminder);
else initializeCaptureReminder();
})();
