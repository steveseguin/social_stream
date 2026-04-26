
	(function () {
		var STORAGE_KEY = "ssnAiPromptPagesV2";
		var LEGACY_KEY = "ssnAiPromptPagesV1";
		var MAX_HISTORY = 20;

		var state = null;
		var bridgeFrame = null;
		var bridgeReady = false;
		var bridgeRoomID = "";
		var bridgePassword = "false";
		var pendingResponses = {};
		var saveTimer = null;
		var previewTimer = null;
		var lastIframeError = null;
		var currentTab = "preview";
		var lastAppliedFromAI = false;
		var autoFixAttempts = 0;
		var MAX_AUTO_FIX = 2;
		var html2canvasPromise = null;
		var HTML2CANVAS_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
		var overlayPackageRequestTarget = null;
		var overlayPackageLoaded = false;
		var BRIDGE_CHUNK_SIZE = 12000;

		var el = function (id) { return document.getElementById(id); };
		var pageName = el("pageName");
		var pageList = el("pageList");
		var systemPrompt = el("systemPrompt");
		var userRequest = el("userRequest");
		var htmlEditor = el("htmlEditor");
		var previewFrame = el("previewFrame");
		var previewFrameWrap = el("previewFrameWrap");
		var conversationLog = el("conversationLog");
		var connectionStatus = el("connectionStatus");
		var storageStatus = el("storageStatus");
		var consoleBar = el("consoleBar");
		var consoleBarText = el("consoleBarText");
		var fixErrorBtn = el("fixError");
		var previewSize = el("previewSize");
		var templatesModal = el("templatesModal");
		var templateGrid = el("templateGrid");
		var customEventModal = el("customEventModal");
		var customEventJson = el("customEventJson");
		var customEventError = el("customEventError");
		var attachScreenshot = el("attachScreenshot");
		var autoFixErrors = el("autoFixErrors");

		var defaultSystemPrompt = el("default-system-prompt").value;

		var TEMPLATES = [
			{ id: "blank", name: "Blank canvas", desc: "Minimal bridge + stage. Perfect starting point — describe what you want in the AI panel.", src: el("tmpl-blank").value },
			{ id: "chat", name: "Chat overlay", desc: "Scrolling chat feed with avatars, platform tag, optional fade-out. Respects ?limit and ?showtime.", src: el("tmpl-chat").value },
			{ id: "alerts", name: "Alert banner", desc: "Follows, subs, gifted subs, donations, and raids as animated alerts at the top of the screen.", src: el("tmpl-alerts").value },
			{ id: "viewer-ticker", name: "Viewer counter ticker", desc: "Bottom bar with per-platform live viewer counts + combined total. Reads viewer_updates events.", src: el("tmpl-viewer-ticker").value },
			{ id: "goal", name: "Sub goal tracker", desc: "Animated progress bar that fills on subscriber and gifted-sub events. Configurable via ?target and ?title.", src: el("tmpl-goal").value },
			{ id: "brb", name: "Starting soon / BRB", desc: "Gradient card with countdown timer and mini chat. Configurable via ?minutes, ?title, ?sub.", src: el("tmpl-brb").value }
		];

		var EVENT_SAMPLES = {
			chat: {
				chatname: "Jess",
				chatmessage: "this overlay looks amazing! 🔥",
				chatimg: "https://socialstream.ninja/media/user1.jpg",
				type: "youtube",
				nameColor: "#79d6ac"
			},
			follow: {
				event: "new_follower",
				chatname: "NewFan42",
				chatimg: "https://socialstream.ninja/media/user3.jpg",
				type: "twitch"
			},
			subscriber: {
				event: "subscriber",
				chatname: "LoyalViewer",
				chatmessage: "resubbing for month 6!",
				chatimg: "https://socialstream.ninja/media/user5.jpg",
				type: "youtube",
				membership: "Member (6 months)",
				subtitle: "6 months"
			},
			gifted: {
				event: "subscription_gift",
				chatname: "GenerousGifter",
				chatimg: "https://socialstream.ninja/media/user2.jpg",
				type: "twitch",
				subtitle: "5",
				membership: "Tier 1",
				meta: { gift_count: 5 }
			},
			donation: {
				chatname: "BigTipper",
				chatmessage: "Keep crushing it!",
				chatimg: "https://socialstream.ninja/media/user4.jpg",
				type: "youtube",
				hasDonation: "$25.00"
			},
			raid: {
				event: "raid",
				chatname: "AlliedStreamer",
				chatimg: "https://socialstream.ninja/media/user6.jpg",
				type: "twitch",
				subtitle: "142 viewers",
				meta: { viewers: 142 }
			},
			cheer: {
				chatname: "BitsFriend",
				chatmessage: "Cheer1000 enjoy!",
				chatimg: "https://socialstream.ninja/media/user7.jpg",
				type: "twitch",
				hasDonation: "1000 bits",
				meta: { bits: 1000 }
			},
			viewer_updates: {
				event: "viewer_updates",
				meta: { youtube: 815, twitch: 221, kick: 94, tiktok: 312 }
			}
		};

		function makeId() { return "page-" + Date.now() + "-" + Math.floor(Math.random() * 1e6); }
		function makeMessageId() { return Math.floor(Math.random() * 1e9); }
		function cleanName(name) {
			name = String(name || "").toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
			return name || "overlay";
		}
		function slugName(name) { return cleanName(name); }

		function defaultPage(seed) {
			var tmpl = seed || TEMPLATES[0];
			return {
				id: makeId(),
				name: tmpl.name,
				systemPrompt: defaultSystemPrompt,
				html: tmpl.src,
				conversation: [],
				updatedAt: Date.now()
			};
		}

		function defaultState() {
			var page = defaultPage(TEMPLATES[1]);
			page.name = "chat-overlay";
			return { version: 2, activeId: page.id, pages: [page] };
		}

		function loadState() {
			try {
				var raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
				var parsed = raw ? JSON.parse(raw) : null;
				if (!parsed || !parsed.pages || !parsed.pages.length) return defaultState();
				for (var i = 0; i < parsed.pages.length; i++) {
					var p = parsed.pages[i];
					p.conversation = p.conversation || [];
					p.systemPrompt = p.systemPrompt || defaultSystemPrompt;
					p.html = p.html || TEMPLATES[0].src;
					p.name = cleanName(p.name);
				}
				var activeExists = false;
				for (var j = 0; j < parsed.pages.length; j++) {
					if (parsed.pages[j].id === parsed.activeId) { activeExists = true; break; }
				}
				if (!activeExists) parsed.activeId = parsed.pages[0].id;
				return parsed;
			} catch (e) {
				console.warn("Failed to load prompt pages", e);
				return defaultState();
			}
		}

		function saveState() {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
				storageStatus.textContent = "Saved " + new Date().toLocaleTimeString();
				publishOverlays();
			} catch (e) {
				storageStatus.textContent = "Local save failed: " + (e && e.message ? e.message : "unknown error");
			}
		}

		function scheduleSave() {
			clearTimeout(saveTimer);
			saveTimer = setTimeout(saveState, 250);
		}

		function findPage(id) {
			if (!state || !state.pages) return null;
			for (var i = 0; i < state.pages.length; i++) {
				if (state.pages[i].id === id) return state.pages[i];
			}
			return null;
		}

		function activePage() { return findPage(state.activeId) || state.pages[0]; }

		function uniqueOverlayKey(base, used) {
			var root = slugName(base || "overlay");
			var key = root;
			var count = 2;
			while (used[key]) {
				key = root + "-" + count++;
			}
			used[key] = true;
			return key;
		}

		function buildOverlayPackage() {
			var overlays = {};
			var order = [];
			var used = {};
			var activeKey = "";
			for (var i = 0; state && state.pages && i < state.pages.length; i++) {
				var page = state.pages[i];
				var key = uniqueOverlayKey(page.name || page.id || ("overlay-" + (i + 1)), used);
				if (page.id === state.activeId) activeKey = key;
				order.push(key);
				overlays[key] = {
					id: key,
					name: key,
					slug: key,
					pageId: page.id,
					html: page.html || "",
					systemPrompt: page.systemPrompt || defaultSystemPrompt,
					conversation: page.conversation || [],
					updatedAt: page.updatedAt || Date.now()
				};
			}
			return { version: 1, activeOverlay: activeKey || order[0] || "overlay", order: order, overlays: overlays, updatedAt: Date.now() };
		}

		function publishOverlays() {
			if (!bridgeReady || !bridgeFrame || !bridgeFrame.contentWindow || !bridgeRoomID) return;
			postBridgeOverlayPayload({ action: "saveAiPromptOverlays", value: buildOverlayPackage() }, "pcs");
		}

		function applyOverlayPackage(pack) {
			var overlays = pack && pack.overlays;
			if (!overlays) return false;
			var order = (pack.order && pack.order.length) ? pack.order.slice() : Object.keys(overlays);
			var pages = [];
			for (var i = 0; i < order.length; i++) {
				var key = order[i];
				var item = overlays[key];
				if (!item || !item.html) continue;
				pages.push({
					id: key,
					name: cleanName(item.name || item.slug || key),
					systemPrompt: item.systemPrompt || defaultSystemPrompt,
					html: item.html || "",
					conversation: item.conversation || [],
					updatedAt: item.updatedAt || Date.now()
				});
			}
			if (!pages.length) return false;
			state = { version: 2, activeId: (pack.activeOverlay && overlays[pack.activeOverlay]) ? pack.activeOverlay : pages[0].id, pages: pages };
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
			loadActivePage();
			setStatus("Loaded saved AI prompt overlays.", "ok");
			return true;
		}

		function requestOverlayPackage() {
			if (!bridgeReady || !bridgeFrame || !bridgeFrame.contentWindow || !bridgeRoomID) return;
			overlayPackageRequestTarget = makeMessageId();
			overlayPackageLoaded = false;
			postBridgeOverlayPayload({ action: "getAiPromptOverlays", target: overlayPackageRequestTarget }, "pcs");
			setTimeout(function () {
				if (!overlayPackageLoaded) publishOverlays();
			}, 2500);
		}

		function syncFormToPage() {
			var page = activePage();
			if (!page) return;
			page.name = cleanName(pageName.value);
			if (pageName.value !== page.name) pageName.value = page.name;
			page.systemPrompt = systemPrompt.value || defaultSystemPrompt;
			page.html = htmlEditor.value || "";
			page.updatedAt = Date.now();
		}

		function renderPageList() {
			pageList.innerHTML = "";
			for (var i = 0; i < state.pages.length; i++) {
				(function (page) {
					var button = document.createElement("button");
					button.type = "button";
					button.className = "page-tab" + (page.id === state.activeId ? " active" : "");
					button.textContent = cleanName(page.name);
					button.title = cleanName(page.name);
					button.addEventListener("click", function () {
						syncFormToPage();
						state.activeId = page.id;
						saveState();
						loadActivePage();
					});
					pageList.appendChild(button);
				}(state.pages[i]));
			}
		}

		function loadActivePage() {
			var page = activePage();
			pageName.value = cleanName(page.name);
			systemPrompt.value = page.systemPrompt || defaultSystemPrompt;
			htmlEditor.value = page.html || "";
			hideConsoleBar();
			renderPageList();
			renderConversation();
			refreshPreview();
		}

		function renderConversation() {
			var page = activePage();
			conversationLog.innerHTML = "";
			var history = page.conversation || [];
			if (!history.length) {
				var empty = document.createElement("div");
				empty.className = "small";
				empty.textContent = "No messages yet. Describe what you want above and hit Ask AI.";
				conversationLog.appendChild(empty);
				return;
			}
			for (var i = 0; i < history.length; i++) {
				appendConversationMessage(history[i].role, history[i].content, false);
			}
			conversationLog.scrollTop = conversationLog.scrollHeight;
		}

		function saveConversationMessage(role, content) {
			var page = activePage();
			page.conversation = page.conversation || [];
			page.conversation.push({ role: role, content: content || "", at: Date.now() });
			if (page.conversation.length > MAX_HISTORY) {
				page.conversation = page.conversation.slice(page.conversation.length - MAX_HISTORY);
			}
			scheduleSave();
		}

		function appendConversationMessage(role, content, save) {
			if (conversationLog.firstChild && conversationLog.firstChild.className === "small") {
				conversationLog.innerHTML = "";
			}
			var wrap = document.createElement("div");
			wrap.className = "msg " + role;
			var roleDiv = document.createElement("div");
			roleDiv.className = "role";
			roleDiv.textContent = role;
			var body = document.createElement("div");
			body.textContent = content || "";
			wrap.appendChild(roleDiv);
			wrap.appendChild(body);
			conversationLog.appendChild(wrap);
			conversationLog.scrollTop = conversationLog.scrollHeight;
			if (save) saveConversationMessage(role, content);
			return body;
		}

		function logBuilder(level, message, detail) {
			try {
				var logger = (console && console[level]) ? console[level] : console.log;
				if (detail !== undefined) logger.call(console, "[AI Prompt] " + message, detail);
				else logger.call(console, "[AI Prompt] " + message);
			} catch (e) {}
		}

		function setStatus(message, type) {
			connectionStatus.textContent = message;
			connectionStatus.className = "status" + (type ? " " + type : "");
			if (type === "error") logBuilder("error", message);
			else if (type === "warn") logBuilder("warn", message);
		}

		function formatElapsed(ms) {
			var seconds = Math.max(0, Math.floor(ms / 1000));
			if (seconds < 60) return seconds + "s";
			return Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
		}

		function streamExcerpt(text) {
			text = String(text || "").replace(/\r/g, "");
			if (!text) return "";
			var lines = text.split("\n");
			var kept = [];
			for (var i = 0; i < lines.length; i++) {
				if (lines[i].trim()) kept.push(lines[i]);
			}
			var excerpt = (kept.length ? kept : lines).slice(-8).join("\n");
			if (excerpt.length > 1600) excerpt = "..." + excerpt.slice(-1600);
			return excerpt;
		}

		function updatePendingStream(pending, state) {
			if (!pending || !pending.meta || !pending.preview) return;
			var elapsed = formatElapsed(Date.now() - pending.requestedAt);
			var chunks = pending.chunks || 0;
			var chars = pending.text ? pending.text.length : 0;
			var label = state || (chunks ? "Streaming" : "Waiting for first streamed token");
			pending.meta.className = "stream-meta" + (!chunks && Date.now() - pending.requestedAt > 10000 ? " warn" : "");
			pending.meta.innerHTML = '<span class="dot"></span><span>' + label + ' · ' + elapsed + ' · ' + chunks + ' chunks · ' + chars + ' chars</span>';
			pending.preview.textContent = streamExcerpt(pending.text) || "No tokens received yet.";
		}

		function createPendingStreamView(body, pending) {
			body.innerHTML = "";
			pending.meta = document.createElement("div");
			pending.preview = document.createElement("div");
			pending.meta.className = "stream-meta";
			pending.preview.className = "stream-preview";
			body.appendChild(pending.meta);
			body.appendChild(pending.preview);
			updatePendingStream(pending);
			pending.timer = setInterval(function () {
				updatePendingStream(pending);
			}, 1000);
			pending.noChunkTimer = setTimeout(function () {
				if (!pending.chunks) {
					logBuilder("warn", "No streamed chunks received after 10 seconds", { target: pending.id });
					updatePendingStream(pending, "Still waiting for first streamed token");
				}
			}, 10000);
		}

		function clearPendingTimers(pending) {
			if (!pending) return;
			if (pending.timer) clearInterval(pending.timer);
			if (pending.noChunkTimer) clearTimeout(pending.noChunkTimer);
			if (pending.timeoutTimer) clearTimeout(pending.timeoutTimer);
			pending.timer = null;
			pending.noChunkTimer = null;
			pending.timeoutTimer = null;
		}

		function applyPreviewSize() {
			var value = previewSize.value;
			if (value === "fit") {
				previewFrameWrap.classList.add("fit");
				previewFrameWrap.style.width = "";
				previewFrameWrap.style.height = "";
				return;
			}
			var parts = value.split("x");
			var w = parseInt(parts[0], 10);
			var h = parseInt(parts[1], 10);
			previewFrameWrap.classList.remove("fit");
			previewFrameWrap.style.width = w + "px";
			previewFrameWrap.style.height = h + "px";
		}

		function injectErrorReporter(source) {
			var reporter = "<script>(function(){function send(message,stack){try{parent.postMessage({__aiPromptError:true,message:String(message&&message.message||message),stack:stack?String(stack):\"\"},\"*\");}catch(e){}}window.addEventListener(\"error\",function(e){var detail=\"\";if(e.filename)detail+=\"Source: \"+e.filename+\"\\n\";if(e.lineno)detail+=\"Line: \"+e.lineno+\" Column: \"+(e.colno||0)+\"\\n\";var stack=e.error&&e.error.stack?e.error.stack:detail;send(e.error||e.message,stack);});window.addEventListener(\"unhandledrejection\",function(e){send(e.reason||\"Unhandled promise rejection\",e.reason&&e.reason.stack?e.reason.stack:\"\");});var origErr=console.error;console.error=function(){var parts=[];for(var i=0;i<arguments.length;i++)parts.push(String(arguments[i]));send(parts.join(\" \"),\"\");origErr.apply(console,arguments);};}());<\/script>";
			var lower = String(source || "").toLowerCase();
			var headIdx = lower.indexOf("<head>");
			if (headIdx >= 0) {
				return source.slice(0, headIdx + 6) + reporter + source.slice(headIdx + 6);
			}
			return reporter + source;
		}

		function refreshPreview() {
			syncFormToPage();
			hideConsoleBar();
			var html = htmlEditor.value || "";
			previewFrame.srcdoc = html ? injectErrorReporter(html) : "";
			scheduleSave();
		}

		function schedulePreview() {
			clearTimeout(previewTimer);
			previewTimer = setTimeout(refreshPreview, 650);
		}

		function showConsoleBar(message, stack) {
			lastIframeError = stack ? (message + "\n\n" + stack) : message;
			consoleBarText.textContent = message;
			consoleBar.classList.add("visible");
			fixErrorBtn.disabled = false;
			logBuilder("error", "Preview error: " + message, stack || "");
			maybeAutoFix();
		}

		function hideConsoleBar() {
			lastIframeError = null;
			consoleBar.classList.remove("visible");
			fixErrorBtn.disabled = true;
		}

		function maybeAutoFix() {
			if (!lastAppliedFromAI) return;
			if (!autoFixErrors || !autoFixErrors.checked) return;
			if (autoFixAttempts >= MAX_AUTO_FIX) {
				setStatus("Auto-fix budget exhausted (" + MAX_AUTO_FIX + " tries). Use \"Fix last error\" to try again.", "warn");
				return;
			}
			if (!bridgeFrame || !bridgeFrame.contentWindow) return;
			autoFixAttempts += 1;
			var retryNote = "Auto-fix attempt " + autoFixAttempts + "/" + MAX_AUTO_FIX + " - the preview threw this error:\n\n" + lastIframeError + "\n\nReturn a corrected, complete HTML document. Focus only on fixing the runtime or syntax error first; keep the existing design unless the error requires changing it.";
			setStatus("Auto-fixing error (attempt " + autoFixAttempts + "/" + MAX_AUTO_FIX + ")…", "warn");
			setTimeout(function () {
				hideConsoleBar();
				sendPrompt(retryNote, { isAutoFix: true });
			}, 400);
		}

		function loadHtml2Canvas() {
			if (window.html2canvas) return Promise.resolve(window.html2canvas);
			if (html2canvasPromise) return html2canvasPromise;
			html2canvasPromise = new Promise(function (resolve, reject) {
				var script = document.createElement("script");
				script.src = HTML2CANVAS_URL;
				script.async = true;
				script.onload = function () {
					if (window.html2canvas) resolve(window.html2canvas);
					else reject(new Error("html2canvas loaded but global not found"));
				};
				script.onerror = function () { reject(new Error("Failed to load html2canvas from CDN")); };
				document.head.appendChild(script);
			});
			return html2canvasPromise;
		}

		function capturePreviewDataUrl() {
			return loadHtml2Canvas().then(function (h2c) {
				var doc = previewFrame.contentDocument;
				if (!doc || !doc.body) throw new Error("Preview iframe not ready for capture");
				var rootEl = doc.documentElement;
				var opts = {
					backgroundColor: null,
					scale: 1,
					logging: false,
					useCORS: true,
					allowTaint: true,
					width: Math.max(rootEl.clientWidth, 320),
					height: Math.max(rootEl.clientHeight, 240),
					windowWidth: Math.max(rootEl.clientWidth, 320),
					windowHeight: Math.max(rootEl.clientHeight, 240)
				};
				return h2c(doc.body, opts).then(function (canvas) {
					var MAX = 1280;
					if (canvas.width > MAX || canvas.height > MAX) {
						var scale = MAX / Math.max(canvas.width, canvas.height);
						var scaled = document.createElement("canvas");
						scaled.width = Math.round(canvas.width * scale);
						scaled.height = Math.round(canvas.height * scale);
						scaled.getContext("2d").drawImage(canvas, 0, 0, scaled.width, scaled.height);
						canvas = scaled;
					}
					return canvas.toDataURL("image/png");
				});
			});
		}

		function reviewAndPolish() {
			syncFormToPage();
			setStatus("Capturing preview for review…", "warn");
			capturePreviewDataUrl().then(function (dataUrl) {
				var prompt = "Here is a rendered screenshot of the current overlay. Review the visual design and propose improvements: layout, spacing, color hierarchy, animations, legibility. Return the complete updated HTML file. Do not change core logic unless it's causing a visual problem.";
				sendPrompt(prompt, { images: [dataUrl] });
			}).catch(function (err) {
				logBuilder("error", "Screenshot review failed", err);
				setStatus("Screenshot failed: " + (err && err.message ? err.message : err), "error");
			});
		}

		function setCustomEventError(message) {
			customEventError.textContent = message || "";
			customEventError.hidden = !message;
			if (message) customEventJson.setAttribute("aria-invalid", "true");
			else customEventJson.removeAttribute("aria-invalid");
		}

		function openCustomEventModal() {
			setCustomEventError("");
			customEventModal.classList.add("visible");
			customEventJson.focus();
		}

		function closeCustomEventModal() {
			setCustomEventError("");
			customEventModal.classList.remove("visible");
		}

		function sendSimulatedEvent(kind) {
			if (kind === "custom") {
				customEventJson.value = JSON.stringify({ chatname: "You", chatmessage: "hi", type: "youtube" }, null, 2);
				openCustomEventModal();
				return;
			}
			var payload = EVENT_SAMPLES[kind];
			if (!payload) return;
			deliverToPreview(payload);
		}

		function deliverToPreview(payload) {
			if (!previewFrame || !previewFrame.contentWindow) return;
			previewFrame.contentWindow.postMessage({ dataReceived: { overlayNinja: payload } }, "*");
		}

		function buildPrompt(page, request) {
			var history = page.conversation || [];
			var recent = [];
			var start = Math.max(0, history.length - 8);
			for (var i = start; i < history.length; i++) {
				recent.push(history[i].role.toUpperCase() + ":\n" + history[i].content);
			}
			return [
				page.systemPrompt || defaultSystemPrompt,
				"",
				"=== CURRENT HTML FILE ===",
				"```html",
				page.html || "",
				"```",
				"",
				"=== RECENT CONVERSATION ===",
				recent.join("\n\n---\n\n") || "None yet.",
				"",
				"=== NEW REQUEST ===",
				request,
				"",
				"If the request needs a file change, return ONE complete HTML document inside one ```html fenced block. If it's just a question, answer normally.",
				"Before returning HTML, check every <script> block for valid plain JavaScript syntax. If you include dynamic text inside JavaScript, quote it with JSON-safe string literals. Do not leave raw prose, markdown, smart quotes, or stray punctuation inside <script> blocks.",
				"Live-data minimums: expose window.handleOverlayPayload = handlePayload; accept postMessage payloads without filtering event.source; support chat fields (chatname/chatmessage/chatimg/type), alert fields (hasDonation, membership, new_follower, raid, gifted/subscription_gift), and viewer_updates snapshots. Plain chat is valid without event/hasDonation/membership; alert events are valid even when chatmessage, subtitle, or meta is missing. Derive source icons from data.type with https://socialstream.ninja/sources/images/{type}.png and hide broken icons."
			].join("\n");
		}

		function looksLikeHtml(value) {
			return /^\s*(<!doctype html|<html[\s>]|<[a-z][\w-]*[\s>])/i.test(value || "");
		}

		function extractHtml(text) {
			var fenced = text.match(/```html\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
			if (fenced && looksLikeHtml(fenced[1])) return fenced[1].trim();
			var lower = text.toLowerCase();
			var start = lower.indexOf("<!doctype html");
			if (start < 0) start = lower.indexOf("<html");
			var end = lower.lastIndexOf("</html>");
			if (start >= 0 && end > start) return text.slice(start, end + 7).trim();
			var trimmed = text.trim();
			if (looksLikeHtml(trimmed)) return trimmed;
			return "";
		}

		function parseErrorResponse(value) {
			try {
				var parsed = JSON.parse(value);
				if (parsed && parsed.error) return parsed.error.message || "AI request failed.";
			} catch (e) {}
			return "";
		}

		function annotateErrorMessage(msg) {
			if (!msg) return msg;
			var lower = msg.toLowerCase();
			if (lower.indexOf("failed to fetch") >= 0 || lower.indexOf("networkerror") >= 0 || lower.indexOf("typeerror") >= 0) {
				return msg + "\n\nLikely causes:\n- The endpoint URL is wrong or the server is not running.\n- The AI endpoint is blocking browser/extension requests.\n- A local firewall, VPN, or CORS setting is blocking the request.";
			}
			if (lower.indexOf("not allowed") >= 0 && lower.indexOf("chatbot") >= 0) {
				return msg + "\n\nEnable 'Private chat bot' (allowChatBot) in the SSN popup AI/LLM section, then reload.";
			}
			return msg;
		}

		function buildOverlayUrl() {
			var base = location.origin + location.pathname.replace(/[^/]*$/, "");
			var urlParams = new URLSearchParams(location.search);
			var pack = buildOverlayPackage();
			var params = [];
			if (bridgeRoomID) params.push("session=" + encodeURIComponent(bridgeRoomID));
			if (bridgePassword && bridgePassword !== "false") params.push("password=" + encodeURIComponent(bridgePassword));
			if (urlParams.get("v")) params.push("v=" + encodeURIComponent(urlParams.get("v")));
			params.push("overlay=" + encodeURIComponent(pack.activeOverlay || "overlay"));
			return base + "aioverlay.html?" + params.join("&");
		}

		function connectBridge() {
			var urlParams = new URLSearchParams(location.search);
			bridgeRoomID = urlParams.get("session") || "";
			bridgePassword = urlParams.get("password") || "false";
			if (!bridgeRoomID) {
				setStatus("No session in URL. You can still build, preview, and export overlays. Add ?session=YOUR_ID to ask the AI.", "warn");
				return;
			}
			bridgeReady = false;
			bridgeFrame = document.createElement("iframe");
			bridgeFrame.onload = function () {
				bridgeReady = true;
				requestOverlayPackage();
				setStatus("Connected to session " + bridgeRoomID + ". LLM provider + Private Chat Bot option must be enabled in SSN.", "ok");
			};
			bridgeFrame.src = "https://vdo.socialstream.ninja/?ln&password=" + encodeURIComponent(bridgePassword) +
				"&salt=vdo.ninja&label=aiprompt&view=" + encodeURIComponent(bridgeRoomID) +
				"&scene&novideo&noaudio&cleanoutput&room=" + encodeURIComponent(bridgeRoomID);
			bridgeFrame.style.cssText = "width:0;height:0;position:fixed;left:-100px;top:-100px;";
			document.body.appendChild(bridgeFrame);
			setStatus("Connecting to session " + bridgeRoomID + "...", "warn");
		}

		function postBridgeOverlayPayload(payload, messageType) {
			messageType = messageType || "rpcs";
			var text = JSON.stringify(payload);
			if (text.length <= BRIDGE_CHUNK_SIZE) {
				bridgeFrame.contentWindow.postMessage({
					sendData: { overlayNinja: payload },
					type: messageType
				}, "*");
				return 1;
			}

			var chunkId = "aiprompt_" + Date.now() + "_" + makeMessageId();
			var total = Math.ceil(text.length / BRIDGE_CHUNK_SIZE);
			for (var i = 0; i < total; i++) {
				bridgeFrame.contentWindow.postMessage({
					sendData: {
						overlayNinja: {
							action: "ssnBridgeChunk",
							chunkId: chunkId,
							index: i,
							total: total,
							value: text.slice(i * BRIDGE_CHUNK_SIZE, (i + 1) * BRIDGE_CHUNK_SIZE)
						}
					},
					type: messageType
				}, "*");
			}
			return total;
		}

		function sendPrompt(requestOverride, opts) {
			opts = opts || {};
			syncFormToPage();
			var page = activePage();
			var request = (requestOverride != null) ? requestOverride : userRequest.value.trim();
			if (!request) { setStatus("Enter a request first.", "warn"); return; }
			if (!bridgeFrame || !bridgeFrame.contentWindow) {
				setStatus("Add ?session=YOUR_SESSION_ID to the URL to reach the AI.", "error");
				return;
			}

			if (!opts.isAutoFix) autoFixAttempts = 0;

			var attachFlag = !!(attachScreenshot && attachScreenshot.checked);
			var provided = Array.isArray(opts.images) ? opts.images : (opts.images ? [opts.images] : null);
			var sentAfterBridgeWait = false;

			var ensureBridgeReady = function (done) {
				if (bridgeReady) {
					done();
					return;
				}
				sentAfterBridgeWait = true;
				setStatus("Waiting for the session bridge before sending...", "warn");
				var started = Date.now();
				var waitTimer = setInterval(function () {
					if (bridgeReady) {
						clearInterval(waitTimer);
						done();
					} else if (Date.now() - started > 12000) {
						clearInterval(waitTimer);
						logBuilder("warn", "Sending before bridge reported ready after 12 seconds");
						done();
					}
				}, 250);
			};

			var submit = function (images) {
				var messageID = makeMessageId();
				var prompt = buildPrompt(page, request);
				if (requestOverride == null) userRequest.value = "";
				var displayRequest = opts.displayRequest || request;
				var userMsg = displayRequest + ((images && images.length) ? ("\n\n[attached " + images.length + " screenshot" + (images.length > 1 ? "s" : "") + "]") : "");
				appendConversationMessage("user", userMsg, true);
				var assistantBody = appendConversationMessage("assistant", "Thinking…", false);

				pendingResponses[messageID] = { id: messageID, body: assistantBody, text: "", chunks: 0, requestedAt: Date.now(), isAutoFix: !!opts.isAutoFix, isCompaction: !!opts.isCompaction };
				createPendingStreamView(assistantBody, pendingResponses[messageID]);
				pendingResponses[messageID].timeoutTimer = setTimeout(function () {
					var pending = pendingResponses[messageID];
					if (!pending) return;
					clearPendingTimers(pending);
					var msg = pending.chunks ? "The AI stream started but never sent a final response." : "No AI response arrived. The session bridge or bot service may not be connected.";
					pending.body.textContent = "Error: " + msg;
					saveConversationMessage("assistant", "Error: " + msg);
					delete pendingResponses[messageID];
					logBuilder("error", msg, { target: messageID, chunks: pending.chunks, chars: pending.text.length });
					setStatus("AI request timed out.", "error");
				}, 90000);

				var payload = { action: "chatbot", value: prompt, target: messageID, turbo: false };
				if (images && images.length) payload.images = images;

				var sentParts = postBridgeOverlayPayload(payload);
				var sentLabel = sentAfterBridgeWait ? "AI request sent after bridge warmup." : (opts.isAutoFix ? "Auto-fix request sent." : (opts.isCompaction ? "Compaction request sent." : "AI request sent."));
				if (sentParts > 1) sentLabel += " (" + sentParts + " chunks)";
				setStatus(sentLabel, "ok");
			};

			if (provided && provided.length) {
				ensureBridgeReady(function () { submit(provided); });
			} else if (attachFlag) {
				setStatus("Capturing preview…", "warn");
				capturePreviewDataUrl().then(function (dataUrl) { ensureBridgeReady(function () { submit([dataUrl]); }); })
					.catch(function (err) {
						logBuilder("warn", "Screenshot attachment failed; sending prompt without image", err);
						setStatus("Screenshot failed: " + (err && err.message ? err.message : err) + " — sending without image.", "warn");
						ensureBridgeReady(function () { submit(null); });
					});
			} else {
				ensureBridgeReady(function () { submit(null); });
			}
		}

		function receiveAIResponse(response, chunk) {
			var id = response.target;
			var pending = pendingResponses[id];
			if (!pending) {
				logBuilder("warn", "Received AI response for unknown target", response);
				return;
			}
			var value = response.value || "";

			if (chunk) {
				pending.text += value;
				pending.chunks += 1;
				if (pending.chunks === 1 || pending.chunks % 20 === 0) {
					logBuilder("log", "AI stream chunk " + pending.chunks + " for " + id + " (" + pending.text.length + " chars)");
				}
				updatePendingStream(pending);
				conversationLog.scrollTop = conversationLog.scrollHeight;
				return;
			}

			clearPendingTimers(pending);
			var finalText = value || pending.text || "";
			var errorMessage = parseErrorResponse(finalText);
			if (errorMessage) {
				var annotated = annotateErrorMessage(errorMessage);
				logBuilder("error", "AI request failed: " + errorMessage, finalText);
				pending.body.textContent = "Error: " + annotated;
				saveConversationMessage("assistant", "Error: " + annotated);
				delete pendingResponses[id];
				setStatus("AI request failed.", "error");
				return;
			}

			if (pending.isCompaction) {
				var summary = String(finalText || "").trim();
				if (!summary) summary = "Conversation compacted, but no summary was returned.";
				activePage().conversation = [{ role: "assistant", content: "Conversation summary:\n" + summary, at: Date.now() }];
				saveState();
				renderConversation();
				delete pendingResponses[id];
				logBuilder("log", "Chat compacted", { chars: summary.length });
				setStatus("Chat compacted.", "ok");
				return;
			}

			var html = extractHtml(finalText);
			if (html) {
				htmlEditor.value = html;
				syncFormToPage();
				lastAppliedFromAI = true;
				refreshPreview();
				var summaryIdx = finalText.indexOf("```");
				var note = (summaryIdx > 0 ? finalText.slice(0, summaryIdx).trim() : "") || "Updated HTML applied.";
				pending.body.textContent = note;
				saveConversationMessage("assistant", note);
				setStatus("HTML update applied.", "ok");
			} else {
				pending.body.textContent = finalText;
				saveConversationMessage("assistant", finalText);
				setStatus("AI response received.", "ok");
			}
			delete pendingResponses[id];
		}

		function exportPage() {
			syncFormToPage();
			var page = activePage();
			var blob = new Blob([page.html || ""], { type: "text/html;charset=utf-8" });
			var a = document.createElement("a");
			var fileName = slugName(page.name);
			a.href = URL.createObjectURL(blob);
			a.download = fileName + ".html";
			document.body.appendChild(a);
			a.click();
			setTimeout(function () {
				URL.revokeObjectURL(a.href);
				document.body.removeChild(a);
			}, 1000);
		}

		function newPage(seed) {
			syncFormToPage();
			var page = defaultPage(seed);
			if (!seed) page.name = "new-prompt-page";
			state.pages.push(page);
			state.activeId = page.id;
			saveState();
			loadActivePage();
		}

		function duplicatePage() {
			syncFormToPage();
			var current = activePage();
			var copy = {
				id: makeId(),
				name: cleanName(current.name) + "-copy",
				systemPrompt: current.systemPrompt || defaultSystemPrompt,
				html: current.html || TEMPLATES[0].src,
				conversation: [],
				updatedAt: Date.now()
			};
			state.pages.push(copy);
			state.activeId = copy.id;
			saveState();
			loadActivePage();
		}

		function deletePage() {
			if (state.pages.length <= 1) { setStatus("Keep at least one page.", "warn"); return; }
			var current = activePage();
			if (!confirm("Delete \"" + cleanName(current.name) + "\"?")) return;
			var next = [];
			for (var i = 0; i < state.pages.length; i++) {
				if (state.pages[i].id !== current.id) next.push(state.pages[i]);
			}
			state.pages = next;
			state.activeId = state.pages[0].id;
			saveState();
			loadActivePage();
		}

		function applyTemplate(tmpl) {
			if (!confirm("Replace the active page's HTML with the \"" + tmpl.name + "\" template? (Existing HTML will be lost — use Duplicate first to keep it.)")) return;
			htmlEditor.value = tmpl.src;
			var page = activePage();
			if (!page.conversation || !page.conversation.length) {
				page.name = tmpl.name;
				pageName.value = tmpl.name;
			}
			syncFormToPage();
			refreshPreview();
			renderPageList();
			templatesModal.classList.remove("visible");
			setStatus("Applied template: " + tmpl.name, "ok");
		}

		function renderTemplateGrid() {
			templateGrid.innerHTML = "";
			for (var i = 0; i < TEMPLATES.length; i++) {
				(function (tmpl) {
					var card = document.createElement("button");
					card.type = "button";
					card.className = "template-card";
					card.innerHTML =
						'<span class="badge">' + tmpl.id + '</span>' +
						'<div class="title">' + tmpl.name + '</div>' +
						'<div class="desc">' + tmpl.desc + '</div>';
					card.addEventListener("click", function () { applyTemplate(tmpl); });
					templateGrid.appendChild(card);
				}(TEMPLATES[i]));
			}
		}

		function importHtml(file) {
			if (!file) return;
			var reader = new FileReader();
			reader.onload = function () {
				syncFormToPage();
				var page = defaultPage(TEMPLATES[0]);
				page.name = file.name.replace(/\.(html|htm)$/i, "") || "Imported page";
				page.html = String(reader.result || "");
				state.pages.push(page);
				state.activeId = page.id;
				saveState();
				loadActivePage();
				setStatus("HTML imported.", "ok");
			};
			reader.readAsText(file);
		}

		function clearConversation() {
			var page = activePage();
			if (!page.conversation || !page.conversation.length) return;
			if (!confirm("Clear this page's chat history?")) return;
			page.conversation = [];
			saveState();
			renderConversation();
		}

		function headTailText(text, maxLength) {
			text = String(text || "");
			maxLength = maxLength || 900;
			if (text.length <= maxLength) return text;
			var edge = Math.max(120, Math.floor((maxLength - 28) / 2));
			return text.slice(0, edge) + "\n...[middle removed]...\n" + text.slice(text.length - edge);
		}

		function buildCompactPrompt(conversation) {
			var page = activePage();
			var prompt = [
				"Summarize this AI prompt-page builder chat into one short paragraph and, only if needed, one sentence of remaining next steps.",
				"Preserve user intent, important design/code decisions, known errors, current state, and constraints.",
				"Do not include code blocks, HTML, markdown fences, or new implementation instructions.",
				"Current overlay name: " + cleanName(page && page.name),
				"Current HTML length: " + String((page && page.html ? page.html.length : 0)) + " characters.",
				"",
				"Conversation:"
			].join("\n");
			for (var i = 0; i < conversation.length; i++) {
				var msg = conversation[i] || {};
				prompt += "\n\n" + String(msg.role || "message").toUpperCase() + " " + (i + 1) + ":\n" + headTailText(msg.content, 900);
			}
			return prompt;
		}

		function compactConversation() {
			var page = activePage();
			var conversation = (page && page.conversation) ? page.conversation : [];
			if (!conversation.length) { setStatus("No chat to compact.", "warn"); return; }
			if (!confirm("Compact this chat into one short summary message?")) return;
			sendPrompt(buildCompactPrompt(conversation), {
				isCompaction: true,
				displayRequest: "Compact this chat into a shorter summary."
			});
		}

		function saveNow() {
			syncFormToPage();
			saveState();
			logBuilder("log", "Saved current overlay manually");
			setStatus("Saved current overlay.", "ok");
		}

		function clearTemplate() {
			if (!htmlEditor.value) { setStatus("Current HTML is already empty.", "warn"); return; }
			if (!confirm("Clear the current page HTML?")) return;
			htmlEditor.value = "";
			lastAppliedFromAI = false;
			syncFormToPage();
			refreshPreview();
			saveState();
			setStatus("Current HTML cleared.", "ok");
		}

		function copyOverlayUrl() {
			syncFormToPage();
			saveState();
			var url = buildOverlayUrl();
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(url).then(function () {
					setStatus("Overlay URL copied: " + url, "ok");
				}, function () {
					prompt("Copy this overlay URL:", url);
				});
			} else {
				prompt("Copy this overlay URL:", url);
			}
		}

		function openOverlay() {
			syncFormToPage();
			saveState();
			var url = buildOverlayUrl();
			var win = window.open(url, "_blank");
			if (!win) setStatus("Pop-up blocked. Allow pop-ups for this page.", "warn");
		}

		function setTab(name) {
			currentTab = name;
			var tabs = document.querySelectorAll(".tab");
			for (var i = 0; i < tabs.length; i++) {
				tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === name);
			}
			var panels = document.querySelectorAll(".tab-panel");
			for (var j = 0; j < panels.length; j++) {
				panels[j].classList.toggle("active", panels[j].getAttribute("data-tab") === name);
			}
			if (name === "preview") applyPreviewSize();
		}

		function bindEvents() {
			el("newPage").addEventListener("click", function () { newPage(TEMPLATES[0]); });
			el("duplicatePage").addEventListener("click", duplicatePage);
			el("deletePage").addEventListener("click", deletePage);
			el("openTemplates").addEventListener("click", function () { templatesModal.classList.add("visible"); });
			el("closeTemplates").addEventListener("click", function () { templatesModal.classList.remove("visible"); });
			el("exportPage").addEventListener("click", exportPage);
			el("refreshPreview").addEventListener("click", refreshPreview);
			el("sendPrompt").addEventListener("click", function () { sendPrompt(); });
			el("reviewAndPolish").addEventListener("click", reviewAndPolish);
			el("openSettings").addEventListener("click", function () {
				alert("The AI runs in the Social Stream Ninja extension. Configure your LLM provider and model in SSN's popup → AI settings. Any provider that speaks the OpenAI chat-completions format works here, including local vLLM or Ollama endpoints.");
			});
			el("savePage").addEventListener("click", saveNow);
			el("compactConversation").addEventListener("click", compactConversation);
			el("clearConversation").addEventListener("click", clearConversation);
			el("clearTemplate").addEventListener("click", clearTemplate);
			el("copyOverlayUrl").addEventListener("click", copyOverlayUrl);
			el("openOverlay").addEventListener("click", openOverlay);
			el("importPage").addEventListener("change", function (event) {
				importHtml(event.target.files && event.target.files[0]);
				event.target.value = "";
			});
			pageName.addEventListener("input", function () { syncFormToPage(); renderPageList(); scheduleSave(); });
			systemPrompt.addEventListener("input", function () { syncFormToPage(); scheduleSave(); });
			htmlEditor.addEventListener("input", function () { lastAppliedFromAI = false; syncFormToPage(); scheduleSave(); schedulePreview(); });
			userRequest.addEventListener("keydown", function (event) {
				if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
					event.preventDefault();
					sendPrompt();
				}
			});
			previewSize.addEventListener("change", applyPreviewSize);

			var tabs = document.querySelectorAll(".tab");
			for (var i = 0; i < tabs.length; i++) {
				tabs[i].addEventListener("click", function (e) { setTab(e.currentTarget.getAttribute("data-tab")); });
			}

			var eventBtns = document.querySelectorAll(".event-buttons button[data-event]");
			for (var j = 0; j < eventBtns.length; j++) {
				eventBtns[j].addEventListener("click", function (e) { sendSimulatedEvent(e.currentTarget.getAttribute("data-event")); });
			}

			el("customEventCancel").addEventListener("click", closeCustomEventModal);
			customEventJson.addEventListener("input", function () { setCustomEventError(""); });
			el("customEventSend").addEventListener("click", function () {
				try {
					var parsed = JSON.parse(customEventJson.value || "null");
					deliverToPreview(parsed);
					closeCustomEventModal();
					setStatus("Custom payload sent to preview.", "ok");
				} catch (err) {
					logBuilder("warn", "Invalid custom payload JSON", err);
					setCustomEventError("Invalid JSON: " + err.message);
					setStatus("Invalid custom payload JSON.", "warn");
					customEventJson.focus();
				}
			});

			el("consoleBarDismiss").addEventListener("click", hideConsoleBar);
			el("consoleBarFix").addEventListener("click", function () { askAiToFix(); });
			fixErrorBtn.addEventListener("click", function () { askAiToFix(); });

			window.addEventListener("message", function (event) {
				var data = event.data || {};
				if (data.__aiPromptError && previewFrame && event.source === previewFrame.contentWindow) {
					showConsoleBar(data.message || "Unknown error in preview", data.stack || "");
					return;
				}
				if (bridgeFrame && event.source === bridgeFrame.contentWindow) {
					var payload = data.dataReceived && data.dataReceived.overlayNinja;
					if (!payload) return;
					if (payload.chatbotChunk && typeof payload.chatbotChunk.value !== "undefined") {
						receiveAIResponse(payload.chatbotChunk, true);
					} else if (payload.chatbotResponse && typeof payload.chatbotResponse.value !== "undefined") {
						receiveAIResponse(payload.chatbotResponse, false);
					} else if (payload.aiPromptOverlays && payload.aiPromptOverlays.target === overlayPackageRequestTarget) {
						overlayPackageLoaded = true;
						if (!applyOverlayPackage(payload.aiPromptOverlays.value || payload.aiPromptOverlays)) publishOverlays();
					}
				}
			});

			window.addEventListener("beforeunload", function () {
				syncFormToPage();
				saveState();
			});

			window.addEventListener("resize", applyPreviewSize);
		}

		function askAiToFix() {
			if (!lastIframeError) { setStatus("No error to fix yet.", "warn"); return; }
			var msg = "The preview threw this error. Return a corrected, complete HTML document and focus on the failing syntax/runtime issue first:\n\n" + lastIframeError;
			sendPrompt(msg);
			hideConsoleBar();
		}

		state = loadState();
		renderTemplateGrid();
		bindEvents();
		loadActivePage();
		applyPreviewSize();
		connectBridge();
	}());
	