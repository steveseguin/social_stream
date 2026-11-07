(function (root) {
	"use strict";
	var defaults = { accent: "#25D0B1", nameColor: "#25D0B1", border: "#25D0B1", background: "#192430", text: "#F3F6FA", muted: "#B5C0CC", fontSize: 24, radius: 12, chatWidth: 420, chatLimit: 5, chatSeconds: 30, alertSeconds: 7, alertLimit: 6, alertMode: "stack", featuredSeconds: 30, position: "right", title: "", subtitle: "", footer: "" };
	Object.assign(defaults, { layout: "stack", theme: "panel", motion: "slide", alertPosition: "left" });
	var componentNames = ["chat", "alerts", "reward", "donation", "featured", "viewer"];
	// Change detection only, not authentication. Settings are validated and code is rebuilt locally.
	function fingerprint(value) {
		var text = String(value).replace(/\r\n?/g, "\n"), a = 2166136261, b = 3339675911;
		for (var i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 2246822519); }
		return (a >>> 0).toString(16) + "-" + (b >>> 0).toString(16);
	}
	function components(input) {
		if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid overlay components.");
		var out = {};
		Object.keys(input).forEach(function (key) {
			if (componentNames.indexOf(key) < 0 || typeof input[key] !== "boolean") throw new Error("Unsupported overlay component: " + key);
			if (input[key]) out[key] = true;
		});
		if (!Object.keys(out).length || (out.viewer && Object.keys(out).length > 1)) throw new Error("Viewer counts need their own overlay.");
		return out;
	}
	function normalize(input) {
		if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected overlay settings.");
		var out = {}, ranges = { fontSize: [18, 40], radius: [0, 32], chatWidth: [280, 600], chatLimit: [1, 8], chatSeconds: [0, 600], alertSeconds: [1, 120], alertLimit: [1, 6], featuredSeconds: [0, 600] };
		var clean = Object.create(null), names = Object.keys(defaults);
		Object.keys(input).forEach(function (key) {
			var canonical = names.filter(function (name) { return name.toLowerCase() === key.trim().toLowerCase(); })[0];
			if (!canonical || Object.prototype.hasOwnProperty.call(clean, canonical)) throw new Error("Unsupported or repeated overlay setting: " + key);
			clean[canonical] = input[key];
		});
		input = clean;
		Object.keys(defaults).forEach(function (key) {
			var value = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : defaults[key];
			var choices = { layout: ["stack", "compact", "lower-third"], theme: ["panel", "outline", "minimal"], motion: ["slide", "fade", "none"], alertPosition: ["left", "center"] };
			if (choices[key]) {
				value = typeof value === "string" ? value.trim().toLowerCase() : value;
				if (choices[key].indexOf(value) < 0) throw new Error("Invalid " + key + ". Use " + choices[key].join(" or ") + ".");
				out[key] = value; return;
			}
			if (typeof value === "string" && /^(accent|nameColor|border|background|text|muted|alertMode|position)$/.test(key)) value = value.trim().toLowerCase();
			if (ranges[key]) {
				if (typeof value !== "number" || !isFinite(value)) throw new Error("Invalid number: " + key);
				out[key] = Math.max(ranges[key][0], Math.min(ranges[key][1], value));
				if (key === "chatLimit" || key === "alertLimit") out[key] = Math.round(out[key]);
			} else if (/^(accent|nameColor|border|background|text|muted)$/.test(key)) {
				if (typeof value !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) throw new Error("Use a hex colour for " + key);
				out[key] = value;
			} else if (key === "alertMode") {
				if (["stack", "queue"].indexOf(value) < 0) throw new Error("alertMode must be stack or queue.");
				out[key] = value;
			} else if (key === "position") {
				if (["left", "right"].indexOf(value) < 0) throw new Error("Invalid chat position.");
				out[key] = value;
			} else {
				if (typeof value !== "string" || value.length > 200) throw new Error("Invalid text: " + key);
				out[key] = value;
			}
		});
		return out;
	}
	function install(config, types) {
		var canvas = document.getElementById("ssn-layout"), queues = [], timers = new Map(), queueTimer = null;
		canvas.className = "ssn-layout-" + config.layout + " ssn-theme-" + config.theme + " ssn-motion-" + config.motion;
		if (config.alertPosition === "center") canvas.classList.add("ssn-alert-center");
		if (types.featured) canvas.classList.add("ssn-with-featured");
		var params = new URLSearchParams(location.search);
		if (params.has("limit")) config.chatLimit = Math.max(1, Math.min(8, parseInt(params.get("limit"), 10) || config.chatLimit));
		if (params.has("showtime") && isFinite(Number(params.get("showtime")))) config.chatSeconds = Math.max(0, Math.min(600, Number(params.get("showtime")) / 1000));
		["accent", "nameColor", "border", "background", "text", "muted"].forEach(function (key) { canvas.style.setProperty("--" + key, config[key]); });
		canvas.style.setProperty("--font", config.fontSize + "px");
		canvas.style.setProperty("--radius", config.radius + "px");
		canvas.style.setProperty("--chat-width", config.chatWidth + "px");
		function element(tag, cls, text) {
			var el = document.createElement(tag); el.className = cls;
			if (text !== undefined && text !== null) el.textContent = String(text);
			return el;
		}
		function section(cls) { var el = element("section", cls); canvas.appendChild(el); return el; }
		if (config.title || config.subtitle) {
			var header = section("ssn-header"); header.appendChild(element("strong", "ssn-title", config.title)); header.appendChild(element("span", "ssn-subtitle", config.subtitle));
		}
		if (config.footer) section("ssn-footer").textContent = config.footer;
		var chat = section("ssn-chat"), alerts = section("ssn-alerts"), featured = section("ssn-featured"), viewers = section("ssn-viewers");
		var combined = types.chat && (types.alerts || types.reward || types.donation || types.featured);
		if (!combined && config.position === "left") chat.classList.add("ssn-left");
		function resize() {
			var scale = Math.min(innerWidth / 1920, innerHeight / 1080);
			canvas.style.transform = "scale(" + scale + ")";
			canvas.style.left = Math.max(0, (innerWidth - 1920 * scale) / 2) + "px";
			canvas.style.top = Math.max(0, (innerHeight - 1080 * scale) / 2) + "px";
		}
		resize(); window.addEventListener("resize", resize);
		function remove(card) { clearTimeout(timers.get(card)); timers.delete(card); if (card.parentNode) card.parentNode.removeChild(card); }
		function clear(container) { while (container.firstChild) remove(container.firstChild); }
		function add(container, card, limit, seconds) {
			container.appendChild(card);
			while (container.children.length > limit) remove(container.firstChild);
			var maxHeight = parseFloat(getComputedStyle(container).maxHeight);
			function stackHeight() { return Array.prototype.reduce.call(container.children, function (height, item) { return height + item.offsetHeight; }, (container.children.length - 1) * 10); }
			while (container.children.length > 1 && maxHeight > 0 && stackHeight() > maxHeight) remove(container.firstChild);
			if (seconds > 0) timers.set(card, setTimeout(function () { remove(card); }, seconds * 1000));
		}
		function image(url, cls) {
			var safe = window.SSNAiPromptSafeMediaUrl(url);
			if (!safe) return null;
			var img = element("img", cls); img.src = safe; img.alt = "";
			img.addEventListener("error", function () { img.style.display = "none"; }); return img;
		}
		function card(data, label, detail) {
			var row = element("article", "ssn-card");
			row.ssnMessage = data;
			if (label) row.appendChild(element("div", "ssn-label", label));
			var head = element("div", "ssn-card-head"), avatar = image(data.chatimg, "ssn-avatar");
			if (avatar) head.appendChild(avatar);
			head.appendChild(element("strong", "ssn-name", data.chatname || ""));
			if (data.type) head.appendChild(element("span", "ssn-platform", data.type));
			row.appendChild(head);
			if (detail !== "" && detail !== undefined && detail !== null) row.appendChild(element("div", "ssn-detail", detail));
			if (data.chatmessage) {
				var body = element("div", "ssn-message");
				if (data.textonly === true) body.textContent = data.chatmessage;
				else body.innerHTML = window.SocialStreamChatHTML.sanitize(data.chatmessage);
				row.appendChild(body);
			}
			var attachment = image(data.contentimg, "ssn-attachment"); if (attachment) row.appendChild(attachment);
			return row;
		}
		function drain() {
			if (!queues.length) { queueTimer = null; return; }
			var item = queues.shift(); clear(alerts); add(alerts, card(item.data, item.label, item.detail), 1, 0);
			queueTimer = setTimeout(function () { clear(alerts); drain(); }, config.alertSeconds * 1000);
		}
		function alert(data, label, detail) {
			if (config.alertMode !== "queue") { add(alerts, card(data, label, detail), config.alertLimit, config.alertSeconds); return; }
			queues.push({ data: data, label: label, detail: detail }); if (queues.length > 50) queues.shift();
			if (!queueTimer) drain();
		}
		function hasValue(value) { return value !== undefined && value !== null && value !== ""; }
		function matchesDelete(message, deletion) {
			if (!message) return false;
			if (deletion.type && String(message.type || "") !== String(deletion.type)) return false;
			var nativeId = deletion.meta && deletion.meta.messageId;
			if (hasValue(nativeId)) return !!message.meta && hasValue(message.meta.messageId) && String(message.meta.messageId) === String(nativeId);
			if (hasValue(deletion.id)) return hasValue(message.id) && String(message.id) === String(deletion.id);
			if (hasValue(deletion.userid)) return hasValue(message.userid) && String(message.userid) === String(deletion.userid);
			if (deletion.chatname) return String(message.chatname || "") === String(deletion.chatname);
			return !!deletion.type;
		}
		function deleteCards(deletion) {
			if (!deletion || typeof deletion !== "object") return;
			queues = queues.filter(function (item) { return !matchesDelete(item.data, deletion); });
			var removedActiveAlert = false;
			[chat, alerts, featured].forEach(function (container) {
				Array.prototype.slice.call(container.children).forEach(function (row) {
					if (!matchesDelete(row.ssnMessage, deletion)) return;
					if (container === alerts) removedActiveAlert = true;
					remove(row);
				});
			});
			if (removedActiveAlert && config.alertMode === "queue") {
				clearTimeout(queueTimer); queueTimer = null; drain();
			}
		}
		function handleControl(data) {
			if ("clearAll" in data || data.action === "clear" || data.action === "clearAll") {
				clearTimeout(queueTimer); queueTimer = null; queues.length = 0;
				[chat, alerts, featured].forEach(clear); return true;
			}
			if ("deleteMessage" in data) {
				if (hasValue(data.deleteMessage)) deleteCards({ id: data.deleteMessage });
				return true;
			}
			if ("delete" in data) { deleteCards(data.delete); return true; }
			return false;
		}
		function handle(data) {
			if (!data || typeof data !== "object") return;
			if (handleControl(data)) return;
			var meta = data.meta || {}, event = String(data.event || "").toLowerCase();
			if (event === "viewer_updates") {
				if (!types.viewer) return;
				clear(viewers); var total = 0;
				Object.keys(meta).forEach(function (key) {
					if (typeof meta[key] !== "number" || !isFinite(meta[key])) return;
					var count = Math.max(0, Math.floor(meta[key])); total += count;
					viewers.appendChild(element("div", "ssn-card", key + ": " + count));
				}); viewers.appendChild(element("div", "ssn-card", "Total: " + total)); return;
			}
			if (meta.featured === true && types.featured) { clear(featured); add(featured, card(data, "Featured", ""), 1, config.featuredSeconds); return; }
			var reward = /^(reward|channel_points|redeem)$/.test(event) || meta.rewardId || meta.redemptionId;
			if (reward) {
				if (types.reward) {
					var detail = meta.rewardTitle || (meta.tokens && meta.tokens.product) || "";
					if (typeof meta.cost === "number") detail += (detail ? " Â· " : "") + meta.cost + " points";
					if (meta.userInput) detail += (detail ? " Â· " : "") + meta.userInput;
					alert(data, "Reward", detail);
				} return;
			}
			var paid = data.hasDonation || typeof data.donoValue === "number" || typeof meta.bits === "number" || /^(donation|cheer|superchat|supersticker|jeweldonation|gift)$/.test(event);
			if (paid && (types.donation || types.alerts)) { alert(data, "Support", data.hasDonation || (typeof meta.bits === "number" ? meta.bits + " bits" : "")); return; }
			var labels = { new_follower: "Follow", follow: "Follow", subscriber: "Subscription", subscription: "Subscription", resub: "Subscription", subscription_gift: "Gift subscription", gifted: "Gift subscription", raid: "Raid" };
			var label = Object.prototype.hasOwnProperty.call(labels, event) ? labels[event] : (!event && data.membership ? "Subscription" : "");
			if (label && types.alerts) {
				var supplied = data.subtitle;
				if (!supplied && /^(subscription_gift|gifted)$/.test(event) && typeof meta.gift_count === "number") supplied = meta.gift_count + " gifts";
				if (!supplied && event === "raid" && typeof meta.viewers === "number") supplied = meta.viewers + " viewers";
				alert(data, label, supplied || data.membership || ""); return;
			}
			if (types.chat && (!event || data.contentimg) && (data.chatname || data.chatmessage || data.contentimg)) add(chat, card(data, "", data.hasDonation || ""), config.layout === "lower-third" ? 1 : config.chatLimit, config.chatSeconds);
		}
		window.SSNStarterHandle = handle;
		window.addEventListener("pagehide", function () { timers.forEach(clearTimeout); timers.clear(); clearTimeout(queueTimer); queues.length = 0; });
	}
	var css = "#ssn-layout{position:fixed;width:1920px;height:1080px;transform-origin:top left;color:var(--text);font:var(--font) Arial,sans-serif;overflow:hidden}#ssn-layout *{box-sizing:border-box}.ssn-header{position:absolute;top:40px;left:40px;right:40px;display:flex;align-items:center;padding:14px 22px;background:var(--background);border-left:5px solid var(--border);border-radius:var(--radius)}.ssn-header>*{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ssn-header>*+*{margin-left:24px}.ssn-title{font-size:32px}.ssn-subtitle,.ssn-platform{color:var(--muted);font-size:18px}.ssn-footer{position:absolute;bottom:24px;left:40px;right:40px;text-align:center;color:var(--muted);font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ssn-chat{position:absolute;right:40px;bottom:90px;width:var(--chat-width);max-height:840px;display:flex;flex-direction:column;overflow:hidden}.ssn-chat>.ssn-card+.ssn-card,.ssn-alerts>.ssn-card+.ssn-card{margin-top:10px}.ssn-chat.ssn-left{right:auto;left:40px}.ssn-alerts{position:absolute;left:40px;top:140px;width:760px;max-height:570px;display:flex;flex-direction:column;overflow:hidden}.ssn-featured{position:absolute;bottom:90px;left:40px;width:1000px;max-height:250px;overflow:hidden}.ssn-viewers{position:absolute;bottom:90px;left:40px;right:40px;display:flex}.ssn-viewers>.ssn-card+.ssn-card{margin-left:12px}.ssn-viewers>.ssn-card{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ssn-card{flex-shrink:0;min-width:0;padding:14px 18px;background:var(--background);border-left:4px solid var(--border);border-radius:var(--radius);overflow:hidden;animation:ssn-enter .18s ease-out}.ssn-card-head{display:flex;align-items:center;min-width:0}.ssn-card-head>*+*{margin-left:10px}.ssn-name{color:var(--nameColor);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ssn-platform{margin-left:auto;font-size:16px;flex-shrink:0}.ssn-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover}.ssn-message,.ssn-detail{overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden;line-height:1.25;margin-top:6px}.ssn-message img,.ssn-message svg{max-height:1.3em;max-width:3em;vertical-align:middle}.ssn-attachment{display:block;max-width:100%;height:100px;object-fit:contain;margin-top:8px}.ssn-label{font-size:16px;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:5px}.ssn-alerts .ssn-message{-webkit-line-clamp:2}.ssn-alerts .ssn-card{padding:10px 16px}.ssn-alerts .ssn-label{float:right;margin-left:12px}.ssn-featured .ssn-message{font-size:28px}@keyframes ssn-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.ssn-card{animation:none}}";
	css += ".ssn-layout-compact .ssn-card{padding:8px 12px}.ssn-theme-outline .ssn-card{border:2px solid var(--border);box-shadow:none}.ssn-theme-minimal .ssn-card{border-radius:0;border-left:0;border-bottom:2px solid var(--border)}.ssn-motion-none .ssn-card{animation:none}.ssn-motion-fade .ssn-card{animation:ssn-fade .2s ease-out}.ssn-alert-center .ssn-alerts{left:640px;width:600px}.ssn-layout-lower-third .ssn-chat{left:40px;right:auto;width:1000px;max-height:240px}.ssn-layout-lower-third.ssn-with-featured .ssn-chat{bottom:370px}.ssn-layout-lower-third.ssn-with-featured .ssn-alerts{max-height:300px}@keyframes ssn-fade{from{opacity:0}to{opacity:1}}@media(prefers-reduced-motion:reduce){.ssn-motion-fade .ssn-card{animation:none}}";
	function assemble(config, types, blank, runtime, styles) {
		var doc = new DOMParser().parseFromString(blank, "text/html");
		var oldStage = doc.querySelector(".stage"); if (oldStage) oldStage.remove();
		var stage = doc.createElement("div"); stage.id = "ssn-layout"; doc.body.insertBefore(stage, doc.body.firstChild);
		var style = doc.createElement("style"); style.textContent = styles; doc.head.appendChild(style);
		var script = doc.createElement("script");
		script.textContent = "(" + runtime + ")(" + JSON.stringify(config).replace(/</g, "\\u003c") + "," + JSON.stringify(types) + ");";
		var bridgeScript = doc.querySelector("script");
		bridgeScript.textContent = bridgeScript.textContent.replace('console.log("payload", data);', "window.SSNStarterHandle(data);");
		if (types.viewer) bridgeScript.textContent = bridgeScript.textContent.replace('|| "dock"', '|| "meta"');
		doc.body.insertBefore(script, bridgeScript);
		return doc;
	}

	root.SSNAiPromptStarter = {
		defaults: defaults,
		parse: function (response) {
			var text = String(response || "").trim();
			try { return JSON.parse(text); } catch (_) {}
			var fences = text.match(/```(?:json)?\s*[\s\S]*?```/gi);
			if (fences && fences.length === 1) return JSON.parse(fences[0].replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim());
			// Accept one object surrounded by explanatory prose, never execute the response.
			var objects = [], start = -1, depth = 0, quoted = false, escaped = false;
			for (var i = 0; i < text.length; i++) {
				var ch = text.charAt(i);
				if (start < 0) { if (ch === "{") { start = i; depth = 1; } continue; }
				if (quoted) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === '"') quoted = false; continue; }
				if (ch === '"') quoted = true;
				else if (ch === "{") depth++;
				else if (ch === "}" && --depth === 0) { objects.push(text.slice(start, i + 1)); start = -1; }
			}
			if (objects.length !== 1 || start >= 0) throw new Error("Return one JSON settings object.");
			return JSON.parse(objects[0]);
		},
		read: function (source, blank) {
			try {
				var doc = new DOMParser().parseFromString(source, "text/html"), metadata = doc.getElementById("ssn-starter-config");
				if (metadata) {
					var saved = JSON.parse(metadata.textContent);
					if (saved.schema !== 1 || saved.version !== 2) return null;
					metadata.remove();
					if (fingerprint(doc.documentElement.outerHTML + JSON.stringify({ settings: saved.settings, components: saved.components })) !== saved.fingerprint) return null;
					return { settings: normalize(saved.settings), types: components(saved.components), version: saved.version };
				}
				// Version 1 had no metadata. Recognize only the original runtime and presentation.
				var script = Array.prototype.filter.call(doc.scripts, function (item) { return item.textContent.indexOf("(function install(config, types)") === 0; })[0];
				if (!script || script.textContent.slice(-2) !== ");") return null;
				var code = script.textContent, split = code.lastIndexOf("})("), runtime = code.slice(1, split + 1);
				if (fingerprint(runtime) !== "dd47adf7-8dd9caf1") return null;
				var style = Array.prototype.filter.call(doc.querySelectorAll("style"), function (item) { return fingerprint(item.textContent) === "9c9d9502-897b0380"; })[0];
				if (!style) return null;
				var args = JSON.parse("[" + code.slice(split + 3, -2) + "]");
				if (args.length !== 2 || assemble(args[0], args[1], blank, runtime, style.textContent).documentElement.outerHTML !== doc.documentElement.outerHTML) return null;
				return { settings: normalize(args[0]), types: components(args[1]), version: 1 };
			} catch (_) { return null; }
		},
		resolve: function (response, baseTypes, baseSettings, mentionedTypes) {
			if (!response || typeof response !== "object" || Array.isArray(response)) throw new Error("Expected overlay settings.");
			var changes = Object.assign(Object.create(null), response), types = Object.assign({}, baseTypes);
			var flatComponents = Object.create(null);
			Object.keys(changes).forEach(function (key) {
				var name = key.trim().toLowerCase();
				if (componentNames.indexOf(name) < 0) return;
				if (Object.prototype.hasOwnProperty.call(flatComponents, name)) throw new Error("Repeated component: " + name);
				flatComponents[name] = changes[key]; delete changes[key];
			});
			var componentKeys = Object.keys(changes).filter(function (key) { return key.trim().toLowerCase() === "components"; });
			if (componentKeys.length > 1) throw new Error("Repeated components setting.");
			if (componentKeys.length && componentKeys[0] !== "components") {
				changes.components = changes[componentKeys[0]]; delete changes[componentKeys[0]];
			}
			if (Object.prototype.hasOwnProperty.call(changes, "components")) {
				var requested = changes.components;
				if (!requested || typeof requested !== "object" || Array.isArray(requested)) throw new Error("Invalid components.");
				Object.keys(requested).forEach(function (key) {
					if (Object.prototype.hasOwnProperty.call(flatComponents, key)) throw new Error("Repeated component: " + key);
					flatComponents[key] = requested[key];
				});
				delete changes.components;
			}
			Object.keys(flatComponents).forEach(function (key) {
				if (componentNames.indexOf(key) < 0 || typeof flatComponents[key] !== "boolean") throw new Error("Invalid component: " + key);
				if (mentionedTypes && !mentionedTypes[key] && !!types[key] !== flatComponents[key]) throw new Error("Unrequested component change: " + key + ". Keep it " + !!types[key] + ".");
				types[key] = flatComponents[key];
			});
			return { settings: root.SSNAiPromptStarter.merge(baseSettings || defaults, changes), types: components(types) };
		},
		describe: function (before, after, beforeTypes, afterTypes) {
			var names = { nameColor: "username colour", accent: "accent colour", border: "border colour", background: "card background", text: "text colour", muted: "secondary text colour", fontSize: "text size", radius: "rounded corners", chatWidth: "chat width", chatLimit: "message limit", chatSeconds: "message duration", alertSeconds: "alert duration", alertLimit: "alert limit", alertMode: "alert playback", featuredSeconds: "featured-message duration", position: "chat position", title: "title", subtitle: "subtitle", footer: "footer", layout: "layout", theme: "card style", motion: "animation", alertPosition: "alert position" };
			if (!before) return "Created your " + Object.keys(afterTypes).map(function (key) { return key === "viewer" ? "viewer count" : key; }).join(" / ") + " overlay. Use the simulation buttons to preview it, then Copy overlay URL for OBS.";
			var changed = Object.keys(after).filter(function (key) { return before[key] !== after[key]; }).map(function (key) { return names[key] || key; });
			componentNames.forEach(function (key) { if (!!beforeTypes[key] !== !!afterTypes[key]) changed.push((afterTypes[key] ? "enabled " : "disabled ") + key); });
			return changed.length ? "Updated " + changed.join(", ") + ". Undo AI edit restores the previous version." : "Those settings already match your overlay; no changes were needed.";
		},
		merge: function (base, changes) {
			var normalized = normalize(changes), merged = Object.assign({}, base);
			Object.keys(changes).forEach(function (key) {
				var canonical = Object.keys(defaults).filter(function (name) { return name.toLowerCase() === key.trim().toLowerCase(); })[0];
				merged[canonical] = normalized[canonical];
			});
			return merged;
		},
		prompt: function (types, request, current, custom, requestedTypes, profile) {
			if (profile === "compact") {
				var values = Object.assign({}, current || defaults);
				componentNames.forEach(function (key) { values[key] = !!types[key]; });
				return "Choose settings for a Social Stream Ninja overlay. Reply with ONE JSON object, no explanation, no code. Use only changed keys; omitted keys stay unchanged. Settings are flat, not nested.\n" +
					(current ? "CURRENT values: " : "Defaults: ") + JSON.stringify(values) +
					"\nUse only the setting names above. Colours are hex strings. nameColor=usernames; background=card background. chatSeconds=0 means keep messages until replaced (no fading). Durations are seconds. title/subtitle/footer are static text.\n" +
					"layout: stack, compact, lower-third. lower-third shows one chat card and works with other panels too. theme: panel, outline, minimal. motion: slide, fade, none. position: left or right; combined chat stays right. alertMode: stack or queue. alertPosition: left or center.\n" +
					"Panel booleans: chat=ordinary chat; featured=selected questions; donation=paid support; reward=point redemptions; alerts=follows/subscriptions/raids; viewer=viewer counts (alone). Example: {\"featured\":false} hides selected questions. Add=true, remove/hide=false. Donation and reward do NOT require alerts=true. Keep every other component and setting unchanged.\n" +
					(custom ? "Additional instructions:\n" + custom + "\n" : "") +
					"Request:\n" + request + "\nFor unsupported behavior return {\"unsupported\":true}. Otherwise return just the changed settings JSON.";
			}
			var descriptions = { chat: "chat cards with avatars, usernames, platform labels, images and safe emotes; newest at bottom", alerts: "follow/subscription/gift/donation/cheer/raid cards with supplied details", reward: "reward/redeem cards with sender, reward, points cost and input", donation: "paid support cards with sender and supplied amount", featured: "selected-message lower third; replaces the previous selection", viewer: "bottom ribbon with each platform's live viewer count and their total; updates replace old counts" };
			return "Choose settings for a working Social Stream Ninja overlay. Built-in components: " + Object.keys(Object.assign({}, types, requestedTypes || {})).map(function (key) { return key + ": " + descriptions[key]; }).join("; ") + ". Return ONLY a JSON object of changed settings, no HTML or code. " + (current ? "Edit only the requested settings. Omitted keys keep these CURRENT values: " : "Omitted keys keep these defaults: ") + JSON.stringify(current || defaults) + ". Optional components changes use \"components\":{\"chat\":true,\"alerts\":false}; allowed names: chat, alerts, reward, donation, featured, viewer. Enable or disable components only when requested. Components are independent: donation and reward work without alerts. The alerts flag enables follows/subscriptions/gifts/raids; do not enable it for donation or reward alerts alone. Viewer counts require their own overlay. layout: stack, compact, or lower-third (one chat card). theme: panel, outline, or minimal. motion: slide, fade, or none. alertPosition: left or center. The canvas is ALWAYS transparent; background colours only the cards. Use hex colours: nameColor colours usernames, accent colours labels, border colours edges. Durations are seconds; chatSeconds=0 keeps chat until replaced, and featuredSeconds=0 keeps the selection visible. chatLimit is 1-8. position is left or right (combined stack chat always right). alertMode=stack displays several alerts at once (alertLimit 1-6) at upper left; alertMode=queue displays one at a time. For a request to stack alerts, keep alertMode=stack. Featured panel is lower left; combined panels stay separate. title/subtitle/footer are optional static branding, not viewer data. Do not invent content. Return {\"unsupported\":true} only for behavior or components absent from these built-in capabilities.\n\nCurrent components: " + JSON.stringify(types) + (custom ? "\n\nAdditional instructions (honor these; if unsupported, say so):\n" + custom : "") + "\n\nRequest:\n" + request;
		},
		build: function (input, types, blank) {
			var config = normalize(input); types = components(types);
			var doc = assemble(config, types, blank, String(install), css);
			var metadata = doc.createElement("script"); metadata.id = "ssn-starter-config"; metadata.type = "application/json";
			metadata.textContent = JSON.stringify({ schema: 1, version: 2, settings: config, components: types, fingerprint: fingerprint(doc.documentElement.outerHTML + JSON.stringify({ settings: config, components: types })) }).replace(/</g, "\\u003c");
			doc.head.appendChild(metadata);
			return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
		}
	};
})(window);
