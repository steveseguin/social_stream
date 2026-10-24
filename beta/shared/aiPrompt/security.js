(function (root) {
	"use strict";
	var runtimeSource = "";

	function installInputGuard() {
		function escapeAttribute(value) {
			return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
				return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
			});
		}
		function safeMediaUrl(value) {
			var template = document.createElement("template");
			template.innerHTML = window.SocialStreamChatHTML.sanitize('<img src="' + escapeAttribute(value) + '">');
			var image = template.content.querySelector("img");
			return image ? image.getAttribute("src") || "" : "";
		}
		function sanitizePayload(value) {
			if (!value || typeof value !== "object") return value;
			if (Array.isArray(value)) return value.map(sanitizePayload);
			var safe = Object.create(null);
			Object.keys(value).forEach(function (key) { safe[key] = value[key]; });
			if (typeof safe.chatmessage === "string" && safe.textonly !== true) {
				safe.chatmessage = window.SocialStreamChatHTML.sanitize(safe.chatmessage);
			}
			["chatimg", "contentimg", "sourceImg", "backupChatimg"].forEach(function (key) {
				if (typeof safe[key] === "string") safe[key] = safeMediaUrl(safe[key]);
			});
			return safe;
		}
		// Registered before generated code. Keep text-only bodies and ordinary fields
		// literal; the CSP also blocks execution if generated code misuses an HTML sink.
		window.addEventListener("message", function (event) {
			var data = event.data;
			if (data && data.dataReceived && typeof data.dataReceived === "object" &&
				Object.prototype.hasOwnProperty.call(data.dataReceived, "overlayNinja")) {
				data.dataReceived.overlayNinja = sanitizePayload(data.dataReceived.overlayNinja);
			}
		}, true);
		window.SSNAiPromptSafeMediaUrl = safeMediaUrl;
	}

	// Also serialized into standalone downloads, so each load gets a fresh nonce.
	function prepareDocument(source, runtime) {
		var bytes = new Uint8Array(24);
		window.crypto.getRandomValues(bytes);
		var nonce = Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
		var doc = new DOMParser().parseFromString(String(source || ""), "text/html");
		Array.prototype.forEach.call(doc.querySelectorAll("script"), function (script) {
			script.setAttribute("nonce", nonce);
		});
		var policy = doc.createElement("meta");
		policy.setAttribute("http-equiv", "Content-Security-Policy");
		policy.setAttribute("content", "script-src 'nonce-" + nonce + "'; object-src 'none'; base-uri 'none'; worker-src 'none'; frame-src https://vdo.socialstream.ninja; form-action 'none'");
		var guard = doc.createElement("script");
		guard.setAttribute("nonce", nonce);
		guard.textContent = runtime;
		doc.head.insertBefore(guard, doc.head.firstChild);
		doc.head.insertBefore(policy, guard);
		return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
	}

	function getRuntime() {
		if (!runtimeSource) {
			if (!root.SocialStreamChatHTML || typeof root.SocialStreamChatHTML.getRuntimeSource !== "function") {
				throw new Error("Overlay security helpers could not load. Reload the builder and try again.");
			}
			runtimeSource = root.SocialStreamChatHTML.getRuntimeSource() + "\n(" + String(installInputGuard) + ")();";
		}
		return runtimeSource;
	}

	root.SSNAiPromptSecurity = {
		prepare: function (source) { return prepareDocument(source, getRuntime()); },
		standalone: function (source) {
			// Escape '<' in serialized input so even a literal closing script tag in
			// generated HTML cannot escape this loader. Do not put this wrapper in prompts.
			var args = JSON.stringify([String(source || ""), getRuntime()]).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
			return '<!DOCTYPE html><html><head><meta charset="UTF-8"><script>(function(){var args=' + args + ';var html=(' + String(prepareDocument) + ').apply(null,args);document.open();document.write(html);document.close();})();<\/script></head><body></body></html>';
		}
	};
})(window);
