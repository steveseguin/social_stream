const assert = require("assert");
const path = require("path");
const { chromium } = require("playwright");

function installChromeStub() {
	window.__youtubeMessages = [];
	window.chrome = window.chrome || {};
	window.chrome.runtime = {
		id: "youtube-effects-test",
		onMessage: {
			addListener: function () {}
		},
		sendMessage: function (runtimeId, request, callback) {
			if (request && request.getSettings) {
				if (typeof callback === "function") {
					callback({
						state: true,
						settings: {
							disableAutoLiveYoutube: true,
							disableYoutubeAutoScroll: true,
							disableYoutubeStaleReload: true,
							textonlymode: false
						}
					});
				}
				return;
			}
			window.__youtubeMessages.push(JSON.parse(JSON.stringify(request || {})));
			if (typeof callback === "function") {
				callback({ id: window.__youtubeMessages.length });
			}
		}
	};
}

async function run() {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();

	try {
		await page.addInitScript(installChromeStub);

		var fixtureHtml =
			"<yt-live-chat-app>" +
				"<yt-live-chat-renderer>" +
					"<yt-live-chat-item-list-renderer>" +
						"<div id='item-offset'><div id='items' class='yt-live-chat-item-list-renderer'></div></div>" +
					"</yt-live-chat-item-list-renderer>" +
					"<yt-emoji-fountain-view-model><div id='emoji-container'></div></yt-emoji-fountain-view-model>" +
					"<ytls-widget-overlay-manager></ytls-widget-overlay-manager>" +
				"</yt-live-chat-renderer>" +
			"</yt-live-chat-app>";
		await page.goto("data:text/html;charset=utf-8," + encodeURIComponent(fixtureHtml));
		await page.addScriptTag({ path: path.join(process.cwd(), "sources", "youtube.js") });
		await page.waitForTimeout(1200);

		await page.evaluate(function () {
			var reaction = document.createElement("emoji");
			reaction.innerHTML =
				"<div><img src='https://fonts.gstatic.com/s/e/notoemoji/15.1/1f389/72.png' alt='🎉'></div>";
			document.querySelector("yt-emoji-fountain-view-model #emoji-container").appendChild(reaction);
			var thumbsUp = document.createElement("emoji");
			thumbsUp.innerHTML =
				"<div><img src='https://fonts.gstatic.com/s/e/notoemoji/15.1/1f44d/72.png' alt='👍'></div>";
			document.querySelector("yt-emoji-fountain-view-model #emoji-container").appendChild(thumbsUp);

			var giftMessage = document.createElement("yt-gift-message-view-model");
			giftMessage.innerHTML =
				"<yt-attributed-string id='author-name-v2'>@Damian-w6f2x</yt-attributed-string>" +
				"<yt-attributed-string id='message-v2'>sent Stay hydrated</yt-attributed-string>" +
				"<yt-image id='gift-image'><img src='//www.gstatic.com/youtube/img/pdg/gift/assets/stay_hydrated.png=w480-h480'></yt-image>";
			document.querySelector("#items").appendChild(giftMessage);

			var manager = document.querySelector("ytls-widget-overlay-manager");
			var attribution = document.createElement("ytls-interactivity-widget");
			attribution.id = "gift-attribution";
			attribution.innerHTML =
				"<ytls-gift-attribution-item-view-model>" +
					"<span class='ytlsGiftAttributionItemViewModelAuthorName'>@Damian-w6f2x</span>" +
					"<div class='ytlsGiftAttributionItemViewModelAvatar'><img src='https://yt4.ggpht.com/avatar=s64'></div>" +
					"<img class='ytlsGiftAttributionItemViewModelGiftImage' " +
						"alt='@Damian-w6f2x sent a gift, Image of a turtle drinking from a water jug' " +
						"src='//www.gstatic.com/youtube/img/pdg/gift/assets/stay_hydrated.png=w80-h80'>" +
				"</ytls-gift-attribution-item-view-model>";
			manager.appendChild(attribution);

			var overlay = document.createElement("ytls-interactivity-widget");
			overlay.id = "gift-overlay";
			overlay.innerHTML =
				"<ytls-gift-overlay-item-view-model>" +
					"<img alt='An animation of a turtle drinking water from a jug, displayed over live chat' " +
						"src='//www.gstatic.com/youtube/img/pdg/gift/assets/stay_hydrated.webp'>" +
				"</ytls-gift-overlay-item-view-model>";
			manager.appendChild(overlay);
		});

		await page.waitForTimeout(500);
		const messages = await page.evaluate(function () {
			return window.__youtubeMessages;
		});
		const reactions = messages.filter(function (entry) {
			return entry.target === "reactions";
		});
		const giftEffect = messages.find(function (entry) {
			return entry.target === "gif";
		});

		assert.strictEqual(reactions.length, 2, "YouTube emoji fountain did not emit every reaction.");
		assert(reactions.every(function (entry) {
			return entry.message.event === "reaction" && entry.message.chatmessage.includes("youtube-live-reaction");
		}));
		assert.deepStrictEqual(
			reactions.map(function (entry) {
				return entry.message.meta.reactionType;
			}).sort(),
			["👍", "🎉"].sort()
		);

		assert(giftEffect, "YouTube gift animation did not emit to the GIF target.");
		assert.strictEqual(giftEffect.message.event, "jeweldonation");
		assert.strictEqual(giftEffect.message.chatname, "Damian-w6f2x");
		assert.strictEqual(giftEffect.message.subtitle, "Stay hydrated");
		assert.strictEqual(
			giftEffect.message.contentimg,
			"https://www.gstatic.com/youtube/img/pdg/gift/assets/stay_hydrated.webp"
		);
		assert.strictEqual(
			giftEffect.message.meta.youtubeGift.animationUrl,
			giftEffect.message.contentimg
		);
	} finally {
		await browser.close();
	}
}

run()
	.then(function () {
		console.log("YouTube live effects browser test passed.");
	})
	.catch(function (error) {
		console.error(error);
		process.exitCode = 1;
	});
