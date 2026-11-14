(function (root) {
	"use strict";
	// Runs only in the builder. Fixtures never reach the live preview or session bridge.
	function probe(token) {
		var errors = [];
		window.addEventListener("error", function (event) { if (event.message) errors.push(event.message); });
		window.addEventListener("unhandledrejection", function (event) { errors.push(String(event.reason && event.reason.message || event.reason)); });
		function visible(el) {
			while (el && el.nodeType === 1) {
				var style = getComputedStyle(el);
				if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return false;
				el = el.parentElement;
			}
			return true;
		}
		function visibleCount(needle) {
			if (!needle) return 0;
			var count = 0, walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), node;
			while ((node = walker.nextNode())) {
				if (node.nodeValue.indexOf(needle) < 0 || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentElement.tagName)) continue;
				var range = document.createRange(); range.selectNodeContents(node);
				var rect = range.getBoundingClientRect();
				if (rect.width && rect.height && visible(node.parentElement)) count += node.nodeValue.split(needle).length - 1;
			}
			return count;
		}
		function report(expected) {
			// Background frames can pause animations. Inspect the settled entrance state.
			if (document.getAnimations) document.getAnimations().forEach(function (animation) {
				try {
					var end = animation.effect.getComputedTiming().endTime;
					if (isFinite(end) && end <= 1000) animation.finish();
					else if (isFinite(end)) animation.currentTime = Math.max(animation.currentTime || 0, 800);
				} catch (_) {}
			});
			var outside = [];
			Array.prototype.forEach.call(document.body.querySelectorAll("*"), function (el) {
				if (el.children.length || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || !el.textContent.trim()) return;
				var rect = el.getBoundingClientRect();
				if (!rect.width || !rect.height || !visible(el)) return;
				if (rect.left < -2 || rect.top < -2 || rect.right > innerWidth + 2 || rect.bottom > innerHeight + 2) outside.push(el.textContent.slice(0, 60));
			});
			parent.postMessage({ ssnValidation: token, kind: "result", errors: errors.slice(0, 5), outside: outside.slice(0, 5), counts: expected.map(visibleCount) }, "*");
		}
		window.addEventListener("message", function (event) {
			if (event.source !== parent || !event.data || event.data.ssnValidation !== token) return;
			var command = event.data;
			if (command.kind === "run") {
				document.body.getBoundingClientRect();
				window.dispatchEvent(new Event("resize"));
				(command.payloads || []).forEach(function (payload) {
					window.dispatchEvent(new MessageEvent("message", { data: { dataReceived: { overlayNinja: payload } }, source: parent, origin: "null" }));
				});
				setTimeout(function () { report(command.expected || []); }, command.settle);
			}
		});
		window.addEventListener("load", function () { parent.postMessage({ ssnValidation: token, kind: "ready" }, "*"); });
	}
	function cases(types, settings, strict) {
		var result = [], token = "SSNCheck" + Math.random().toString(36).slice(2, 9);
		function row(suffix, extra) { return Object.assign({ id: token + suffix, type: "youtube", chatname: token + suffix, chatmessage: "Example message", textonly: true }, extra || {}); }
		function add(name, payloads, expected) { result.push({ name: name, payloads: payloads, expected: expected || payloads.map(function (p) { return p.chatname; }), strict: strict }); }
		if (types.chat) {
			var one = row("Chat1"), two = row("Chat2");
			add("chat", [one], [one.chatname]);
			if (settings && settings.chatLimit > 1 && settings.layout !== "lower-third") add("distinct messages with identical text", [one, two]);
			add("long chat", [row("Long", { chatmessage: "LongWord".repeat(70) })]);
		}
		if (types.alerts) {
			add("follow", [row("Follow", { event: "new_follower", chatmessage: "" })]);
			add("subscription", [row("Sub", { membership: "Member", chatmessage: "" })]);
		}
		if (types.donation || types.alerts) add("donation", [row("Support", { hasDonation: "$5.00" })]);
		if (types.reward) add("reward", [row("Reward", { event: "reward", meta: { rewardTitle: "Choose a topic", cost: 0, redemptionId: token } })]);
		if (types.featured) add("featured message", [row("Featured", { meta: { featured: true } })]);
		if (types.viewer) add("viewer counts", [{ event: "viewer_updates", meta: { youtube: 123, twitch: 45 } }], ["123", "45"]);
		if (!result.length) add("layout", [], []);
		return result;
	}
	root.SSNAiPromptValidation = {
		check: function (html, options) {
			options = options || {};
			var cancelled = false, frame = null, cleanStep = null, stop = null;
			var promise = new Promise(function (resolve) {
				stop = function () { cancelled = true; if (cleanStep) cleanStep(); resolve({ cancelled: true }); };
				var tests = cases(options.types || {}, options.settings, options.strict === true), issues = [], unchecked = [], results = [];
				var sizes = [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }], index = 0;
				function next() {
					if (cancelled) return;
					if (index >= tests.length * sizes.length || issues.length) { resolve({ ok: !issues.length, issues: issues, unchecked: unchecked, results: results }); return; }
					var test = tests[Math.floor(index / sizes.length)], size = sizes[index % sizes.length]; index++;
					var token = "validate-" + Math.random().toString(36).slice(2) + Date.now(), timer, started = false;
					frame = document.createElement("iframe"); frame.setAttribute("sandbox", "allow-scripts"); frame.setAttribute("aria-hidden", "true"); frame.tabIndex = -1;
					frame.style.cssText = "position:fixed;left:0;top:0;opacity:0;z-index:-1;border:0;pointer-events:none;width:" + size.width + "px;height:" + size.height + "px";
					function clean() { clearTimeout(timer); window.removeEventListener("message", receive); if (frame) frame.remove(); frame = null; cleanStep = null; }
					function finish(message) {
						if (message) issues.push(test.name + " at " + size.width + "x" + size.height + ": " + message);
						clean(); next();
					}
					function receive(event) {
						if (!frame || event.source !== frame.contentWindow || !event.data || event.data.ssnValidation !== token) return;
						var data = event.data;
						if (data.kind === "ready") { if (!started) { started = true; frame.contentWindow.postMessage({ ssnValidation: token, kind: "run", payloads: test.payloads, expected: test.expected, settle: options.settings ? 200 : 800 }, "*"); } return; }
						if (data.kind !== "result") return;
						results.push({ test: test.name, width: size.width, counts: data.counts });
						if (data.errors.length) { finish(data.errors.join("; ")); return; }
						if (data.outside.length) { finish("Text extends outside the canvas: " + data.outside.join(", ")); return; }
						if (data.counts.some(function (n) { return n > 1; })) { finish("The same input was rendered more than once."); return; }
						if (data.counts.some(function (n) { return n === 0; })) {
							if (test.strict) { finish("An expected message was not displayed. Check routing and visibility."); return; }
							unchecked.push(test.name);
						}
						finish();
					}
					cleanStep = clean;
					try {
						var doc = new DOMParser().parseFromString(html, "text/html"), script = doc.createElement("script");
						script.textContent = "(" + String(probe) + ")(" + JSON.stringify(token) + ");";
						doc.head.insertBefore(script, doc.head.firstChild);
						var policy = doc.createElement("meta"); policy.httpEquiv = "Content-Security-Policy";
						policy.content = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'";
						doc.head.insertBefore(policy, doc.head.firstChild);
						var prepared = root.SSNAiPromptSecurity.prepare("<!DOCTYPE html>\n" + doc.documentElement.outerHTML);
						window.addEventListener("message", receive); timer = setTimeout(function () { finish("The test preview did not respond."); }, 4000);
						document.body.appendChild(frame);
						frame.getBoundingClientRect();
						frame.srcdoc = prepared;
					} catch (error) { finish(error.message); }
				}
				next();
			});
			return { promise: promise, cancel: function () { if (stop) stop(); } };
		}
	};
})(window);
