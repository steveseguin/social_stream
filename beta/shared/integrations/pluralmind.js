(function (global) {
	"use strict";

	var DEFAULT_TIMEOUT_MS = 2000;
	var TEXT_NODE = 3;
	var pluralmindLibrary = null;

	function getLibrary() {
		if (global.pluralmind && typeof global.pluralmind.getSystem === "function") {
			return global.pluralmind;
		}
		if (!pluralmindLibrary && typeof global.SSNCreatePluralmindLibrary === "function") {
			try {
				pluralmindLibrary = global.SSNCreatePluralmindLibrary();
			} catch (error) {
				return null;
			}
		}
		return pluralmindLibrary;
	}

	function withTimeout(promise, timeoutMs) {
		return new Promise(function (resolve) {
			var settled = false;
			var timer = setTimeout(function () {
				if (!settled) {
					settled = true;
					resolve(null);
				}
			}, timeoutMs);

			Promise.resolve(promise).then(function (value) {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					resolve(value);
				}
			}, function () {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					resolve(null);
				}
			});
		});
	}

	function normalizeResult(proxiedMessage) {
		if (!proxiedMessage || !proxiedMessage.member || !proxiedMessage.member.name) {
			return null;
		}
		return {
			name: String(proxiedMessage.member.name),
			color: typeof proxiedMessage.color === "string" && /^#[0-9a-f]{6}$/i.test(proxiedMessage.color) ? proxiedMessage.color : "",
			pronouns: typeof proxiedMessage.pronouns === "string" ? proxiedMessage.pronouns.trim() : "",
			body: typeof proxiedMessage.body === "string" ? proxiedMessage.body : "",
			changedFragments: proxiedMessage.changedFragments || {}
		};
	}

	async function resolveProxy(identity, message, timeoutMs) {
		if (!identity || !message) {
			return null;
		}
		var library = getLibrary();
		if (!library || typeof library.getSystem !== "function" || typeof library.getProxiedMessage !== "function") {
			return null;
		}

		try {
			var system = await withTimeout(library.getSystem(String(identity)), timeoutMs || DEFAULT_TIMEOUT_MS);
			if (!system) {
				return null;
			}
			return normalizeResult(library.getProxiedMessage(system, message));
		} catch (error) {
			return null;
		}
	}

	function isMentionElement(element) {
		if (!element || element.nodeType !== 1) {
			return false;
		}
		return element.classList.contains("chat-message-mention") ||
			element.classList.contains("mention-fragment--recipient") ||
			element.getAttribute("data-a-target") === "chat-message-mention";
	}

	function collectFragments(node, fragments, inheritedMention) {
		if (!node) {
			return;
		}
		if (node.nodeType === TEXT_NODE) {
			if (node.textContent) {
				fragments.push({
					type: inheritedMention ? "mention" : "text",
					text: node.textContent,
					node: node
				});
			}
			return;
		}
		if (node.nodeType !== 1) {
			return;
		}
		if (node.tagName === "IMG" && node.getAttribute("alt")) {
			fragments.push({
				type: "emote",
				text: node.getAttribute("alt"),
				node: node
			});
			return;
		}

		var mention = inheritedMention || isMentionElement(node);
		for (var i = 0; i < node.childNodes.length; i++) {
			collectFragments(node.childNodes[i], fragments, mention);
		}
	}

	function applyFragmentChanges(fragments, changedFragments) {
		Object.keys(changedFragments || {}).forEach(function (key) {
			var index = Number(key);
			var original = fragments[index];
			if (!original || !original.node || !original.node.parentNode) {
				return;
			}
			var replacement = changedFragments[key];
			if (replacement === null) {
				original.node.parentNode.removeChild(original.node);
			} else if (typeof replacement.text === "string") {
				if (original.node.nodeType === TEXT_NODE) {
					original.node.textContent = replacement.text;
				} else if (original.node.tagName === "IMG") {
					original.node.setAttribute("alt", replacement.text);
				}
			}
		});
	}

	async function resolveMessage(options) {
		options = options || {};
		var identity = options.userId || options.username;
		var result = await resolveProxy(identity, options.message, options.timeoutMs);
		if (!result) {
			return null;
		}
		result.cleanedMessage = result.body;
		return result;
	}

	async function resolveRenderedMessage(options) {
		options = options || {};
		if (options.textOnly) {
			return resolveMessage(options);
		}
		var documentRef = options.documentRef || global.document;
		if (!documentRef || typeof documentRef.createElement !== "function") {
			return null;
		}

		var container = documentRef.createElement("div");
		container.innerHTML = options.message || "";
		var fragments = [];
		collectFragments(container, fragments, false);
		var publicFragments = fragments.map(function (fragment) {
			return { type: fragment.type, text: fragment.text };
		});
		var identity = options.userId || options.username;
		var result = await resolveProxy(identity, publicFragments, options.timeoutMs);
		if (!result) {
			return null;
		}
		applyFragmentChanges(fragments, result.changedFragments);
		result.cleanedMessage = container.innerHTML;
		return result;
	}

	function escapeHtmlText(value) {
		return value.replace(/[&<>"']/g, function (character) {
			return {
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;"
			}[character];
		});
	}

	function createPronounBadge(pronouns) {
		var text = typeof pronouns === "string" ? pronouns.trim() : "";
		if (!text) {
			return null;
		}
		return {
			text: escapeHtmlText(text),
			type: "text",
			bgcolor: "#000",
			color: "#FFF",
			source: "pluralmind"
		};
	}

	function hasPronounBadge(badges) {
		return Array.isArray(badges) && badges.some(function (badge) {
			return badge && typeof badge === "object" && badge.source === "pluralmind";
		});
	}

	global.SSNPluralmindIntegration = Object.freeze({
		resolveMessage: resolveMessage,
		resolveRenderedMessage: resolveRenderedMessage,
		createPronounBadge: createPronounBadge,
		hasPronounBadge: hasPronounBadge
	});
})(typeof globalThis !== "undefined" ? globalThis : window);
