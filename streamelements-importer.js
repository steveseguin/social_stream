(function () {
			var state = {
				files: [],
				textByPath: {},
				assetByPath: {},
				fieldData: {},
				html: "",
				css: "",
				js: "",
				sourceName: ""
			};

			var zipInput = document.getElementById("zipInput");
			var fileInput = document.getElementById("fileInput");
			var folderInput = document.getElementById("folderInput");
			var dropZone = document.getElementById("dropZone");
			var statusBox = document.getElementById("statusBox");
			var fileList = document.getElementById("fileList");
			var previewFrame = document.getElementById("previewFrame");
			var emptyPreview = document.getElementById("emptyPreview");
			var previewBtn = document.getElementById("previewBtn");
			var exportBtn = document.getElementById("exportBtn");
			var clearBtn = document.getElementById("clearBtn");
			var sessionInput = document.getElementById("sessionInput");
			var passwordInput = document.getElementById("passwordInput");
			var outputName = document.getElementById("outputName");
			var fallbackPromptText = document.getElementById("fallbackPromptText");
			var copyPromptBtn = document.getElementById("copyPromptBtn");
			var promptCopyStatus = document.getElementById("promptCopyStatus");

			zipInput.addEventListener("change", function () {
				if (zipInput.files && zipInput.files[0]) {
					loadZip(zipInput.files[0]);
				}
			});

			fileInput.addEventListener("change", function () {
				loadFiles(fileInput.files);
			});

			folderInput.addEventListener("change", function () {
				loadFiles(folderInput.files);
			});

			dropZone.addEventListener("dragover", function (event) {
				event.preventDefault();
				dropZone.classList.add("dragover");
			});

			dropZone.addEventListener("dragleave", function () {
				dropZone.classList.remove("dragover");
			});

			dropZone.addEventListener("drop", function (event) {
				event.preventDefault();
				dropZone.classList.remove("dragover");
				var files = event.dataTransfer && event.dataTransfer.files;
				if (!files || !files.length) return;
				if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
					loadZip(files[0]);
				} else {
					loadFiles(files);
				}
			});

			previewBtn.addEventListener("click", function () {
				renderPreview();
			});

			exportBtn.addEventListener("click", function () {
				exportOverlay();
			});

			clearBtn.addEventListener("click", function () {
				resetState();
			});

			if (copyPromptBtn && fallbackPromptText) {
				copyPromptBtn.addEventListener("click", copyFallbackPrompt);
			}

			sessionInput.addEventListener("input", refreshButtons);
			passwordInput.addEventListener("input", refreshButtons);

			function resetState() {
				state = {
					files: [],
					textByPath: {},
					assetByPath: {},
					fieldData: {},
					html: "",
					css: "",
					js: "",
					sourceName: ""
				};
				previewFrame.removeAttribute("srcdoc");
				emptyPreview.style.display = "";
				statusBox.textContent = "Waiting for overlay files.";
				fileList.innerHTML = "";
				refreshButtons();
			}

			function setStatus(lines) {
				statusBox.innerHTML = lines.map(function (line) {
					return escapeHTML(line);
				}).join("\n");
			}

			function refreshButtons() {
				var hasBuild = !!(state.html || state.css || state.js);
				previewBtn.disabled = !hasBuild;
				exportBtn.disabled = !hasBuild;
			}

			function copyFallbackPrompt() {
				var text = fallbackPromptText.value || fallbackPromptText.textContent || "";
				function markCopied(message) {
					if (!promptCopyStatus) return;
					promptCopyStatus.textContent = message;
					setTimeout(function () {
						promptCopyStatus.textContent = "";
					}, 2200);
				}
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(text).then(function () {
						markCopied("Copied.");
					}).catch(function () {
						copyPromptViaSelection(markCopied);
					});
				} else {
					copyPromptViaSelection(markCopied);
				}
			}

			function copyPromptViaSelection(callback) {
				fallbackPromptText.focus();
				fallbackPromptText.select();
				try {
					document.execCommand("copy");
					callback("Copied.");
				} catch (error) {
					callback("Select and copy manually.");
				}
			}

			function loadZip(file) {
				if (!window.JSZip) {
					setStatus(["Zip support is not available. Missing thirdparty/jszip.min.js."]);
					return;
				}
				setStatus(["Reading zip: " + file.name]);
				JSZip.loadAsync(file).then(function (zip) {
					var jobs = [];
					zip.forEach(function (path, entry) {
						if (entry.dir) return;
						jobs.push(readZipEntry(entry, path));
					});
					return Promise.all(jobs);
				}).then(function (items) {
					processImportedItems(items, file.name);
				}).catch(function (error) {
					setStatus(["Could not read zip.", String(error && error.message || error)]);
				});
			}

			function readZipEntry(entry, path) {
				if (isTextPath(path)) {
					return entry.async("string").then(function (text) {
						return { path: path, name: basename(path), text: text, isText: true };
					});
				}
				return entry.async("base64").then(function (base64) {
					return {
						path: path,
						name: basename(path),
						dataUrl: "data:" + mimeForPath(path) + ";base64," + base64,
						isText: false
					};
				});
			}

			function loadFiles(fileListObject) {
				var files = Array.prototype.slice.call(fileListObject || []);
				if (!files.length) return;
				setStatus(["Reading " + files.length + " file(s)."]);
				Promise.all(files.map(readBrowserFile)).then(function (items) {
					processImportedItems(items, files[0].webkitRelativePath || files[0].name || "overlay");
				}).catch(function (error) {
					setStatus(["Could not read files.", String(error && error.message || error)]);
				});
			}

			function readBrowserFile(file) {
				var path = file.webkitRelativePath || file.name;
				return new Promise(function (resolve, reject) {
					var reader = new FileReader();
					reader.onerror = function () {
						reject(reader.error);
					};
					reader.onload = function () {
						if (isTextPath(path)) {
							resolve({ path: path, name: file.name, text: String(reader.result || ""), isText: true });
						} else {
							resolve({ path: path, name: file.name, dataUrl: String(reader.result || ""), isText: false });
						}
					};
					if (isTextPath(path)) {
						reader.readAsText(file);
					} else {
						reader.readAsDataURL(file);
					}
				});
			}

			function processImportedItems(items, sourceName) {
				state.files = items.slice().sort(function (a, b) {
					return a.path.localeCompare(b.path);
				});
				state.textByPath = {};
				state.assetByPath = {};
				state.sourceName = sourceName || "overlay";

				state.files.forEach(function (item) {
					if (item.isText) {
						state.textByPath[item.path] = item.text || "";
					} else {
						state.assetByPath[item.path] = item.dataUrl || "";
					}
				});

				var detected = detectWidgetParts(state.files);
				var fields = parseJSONSafe(detected.fieldsText || "{}");
				var data = parseJSONSafe(detected.dataText || "{}");
				state.fieldData = mergeFieldDefaults(fields, data);
				state.html = normalizeProtocolRelative(replaceAssets(resolveTemplate(detected.htmlText || '<div class="main-container"></div>', state.fieldData)));
				state.css = normalizeProtocolRelative(replaceAssets(resolveTemplate(detected.cssText || "", state.fieldData)));
				state.js = normalizeProtocolRelative(resolveTemplate(detected.jsText || "", state.fieldData));

				updateFileList(detected);
				refreshButtons();
				renderPreview();
			}

			function detectWidgetParts(items) {
				var htmlItems = [];
				var cssItems = [];
				var jsItems = [];
				var fieldsItem = null;
				var dataItem = null;

				items.forEach(function (item) {
					if (!item.isText) return;
					var lowerPath = item.path.toLowerCase();
					var lowerName = item.name.toLowerCase();

					if (isLikelyFields(lowerName, lowerPath)) {
						fieldsItem = fieldsItem || item;
					} else if (isLikelyData(lowerName, lowerPath)) {
						dataItem = dataItem || item;
					} else if (/\.css$/i.test(lowerPath) || /\bcss\b/i.test(lowerName)) {
						cssItems.push(item);
					} else if (/\.js$/i.test(lowerPath) || /\bjs\b/i.test(lowerName)) {
						jsItems.push(item);
					} else if (/\.html?$/i.test(lowerPath) || /\bhtml\b/i.test(lowerName)) {
						htmlItems.push(item);
					}
				});

				if (!htmlItems.length) {
					htmlItems = items.filter(function (item) {
						return item.isText && /<\s*(div|html|body|head|link|script)\b/i.test(item.text || "");
					});
				}

				return {
					htmlText: joinTextParts(htmlItems),
					cssText: joinTextParts(cssItems),
					jsText: joinTextParts(jsItems),
					fieldsText: fieldsItem ? fieldsItem.text : "",
					dataText: dataItem ? dataItem.text : "",
					htmlFiles: htmlItems.map(function (item) { return item.path; }),
					cssFiles: cssItems.map(function (item) { return item.path; }),
					jsFiles: jsItems.map(function (item) { return item.path; }),
					fieldsFile: fieldsItem ? fieldsItem.path : "",
					dataFile: dataItem ? dataItem.path : ""
				};
			}

			function isLikelyFields(name, path) {
				return name === "fields.json" || name === "fields.txt" || name === "widget.json" || /(^|[\\\/\s_-])fields?([.\s_-]|$)/i.test(path);
			}

			function isLikelyData(name, path) {
				return name === "data.json" || name === "data.txt" || /(^|[\\\/\s_-])data([.\s_-]|$)/i.test(path);
			}

			function joinTextParts(items) {
				return items.map(function (item) {
					return item.text || "";
				}).join("\n\n");
			}

			function updateFileList(detected) {
				var lines = [];
				lines.push("Detected HTML: " + (detected.htmlFiles.join(", ") || "generated fallback"));
				lines.push("Detected CSS: " + (detected.cssFiles.join(", ") || "none"));
				lines.push("Detected JS: " + (detected.jsFiles.join(", ") || "none"));
				lines.push("Fields: " + (detected.fieldsFile || "none"));
				lines.push("Data: " + (detected.dataFile || "none"));
				lines.push("Fields resolved: " + Object.keys(state.fieldData).length);
				lines.push("Assets embedded: " + Object.keys(state.assetByPath).length);
				setStatus(lines);

				fileList.innerHTML = "";
				state.files.forEach(function (item) {
					var div = document.createElement("div");
					div.textContent = item.path;
					fileList.appendChild(div);
				});
			}

			function mergeFieldDefaults(fields, data) {
				var output = {};
				if (fields && typeof fields === "object") {
					Object.keys(fields).forEach(function (key) {
						var entry = fields[key];
						if (entry && typeof entry === "object" && "value" in entry) {
							output[key] = entry.value;
						}
					});
				}
				if (data && typeof data === "object") {
					Object.keys(data).forEach(function (key) {
						output[key] = data[key];
					});
				}
				return output;
			}

			function resolveTemplate(text, fieldData) {
				var output = String(text || "").replace(/{{\s*([\w.-]+)\s*}}/g, function (full, key) {
					if (Object.prototype.hasOwnProperty.call(fieldData, key)) {
						return String(fieldData[key]);
					}
					return "";
				});
				return output.replace(/\{\s*([\w.-]+)\s*\}/g, function (full, key) {
					if (Object.prototype.hasOwnProperty.call(fieldData, key)) {
						return String(fieldData[key]);
					}
					return full;
				});
			}

			function replaceAssets(text) {
				var assetLookup = buildAssetLookup();
				var output = String(text || "");
				output = output.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, function (full, quote, url) {
					var replacement = assetLookup[normalizeAssetKey(url)];
					if (!replacement) return full;
					return "url(\"" + replacement + "\")";
				});
				output = output.replace(/\b(src|href)=["']([^"']+)["']/gi, function (full, attr, url) {
					var replacement = assetLookup[normalizeAssetKey(url)];
					if (!replacement) return full;
					return attr + "=\"" + replacement + "\"";
				});
				return output;
			}

			function buildAssetLookup() {
				var lookup = {};
				Object.keys(state.assetByPath).forEach(function (path) {
					var dataUrl = state.assetByPath[path];
					lookup[normalizeAssetKey(path)] = dataUrl;
					lookup[normalizeAssetKey(basename(path))] = dataUrl;
				});
				return lookup;
			}

			function normalizeAssetKey(value) {
				value = String(value || "").trim();
				if (/^(https?:|data:|blob:|#|\/\/)/i.test(value)) return value;
				value = value.replace(/[?#].*$/, "").replace(/\\/g, "/").replace(/^(?:\.\/|\/)+/, "").replace(/^(?:\.\.\/)+/, "");
				return value.toLowerCase();
			}

			function renderPreview() {
				if (!(state.html || state.css || state.js)) return;
				previewFrame.srcdoc = buildExportHTML({ preview: true });
				emptyPreview.style.display = "none";
			}

			function exportOverlay() {
				var html = buildExportHTML({ preview: false });
				var fileName = (outputName.value || "ssn-imported-overlay.html").trim();
				if (!/\.html?$/i.test(fileName)) {
					fileName += ".html";
				}
				var blob = new Blob([html], { type: "text/html;charset=utf-8" });
				var a = document.createElement("a");
				a.href = URL.createObjectURL(blob);
				a.download = fileName;
				document.body.appendChild(a);
				a.click();
				setTimeout(function () {
					URL.revokeObjectURL(a.href);
					if (a.parentNode) a.parentNode.removeChild(a);
				}, 1000);
			}

			function buildExportHTML(options) {
				var config = {
					fieldData: state.fieldData || {},
					session: (sessionInput.value || "").trim(),
					password: (passwordInput.value || "").trim(),
					preview: !!(options && options.preview),
					sourceName: state.sourceName || "imported-overlay",
					hasWidgetScript: !!String(state.js || "").trim()
				};
				var bodyMarkup = stripScriptTags(extractBodyMarkup(state.html));
				var htmlScripts = extractScriptTags(state.html);
				var extraHead = extractHeadMarkup(state.html);
				var title = "SSN Imported Overlay";

				return [
					"<!DOCTYPE html>",
					"<html lang=\"en\">",
					"<head>",
					"<meta charset=\"UTF-8\">",
					"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
					"<title>" + escapeHTML(title) + "</title>",
					"<meta name=\"generator\" content=\"Social Stream Ninja SE Widget Importer\">",
					extraHead,
					"<style>",
					"html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;}",
					safeStyleText(state.css),
					"</style>",
					"</head>",
					"<body>",
					bodyMarkup,
					"<script>window.SSN_SE_COMPAT_CONFIG=" + safeJSON(config) + ";<\/script>",
					"<script>",
					safeScriptText(getCompatRuntimeSource()),
					"<\/script>",
					htmlScripts,
					"<script>",
					safeScriptText(state.js || ""),
					"<\/script>",
					"<script>window.SSNSECompat&&window.SSNSECompat.start();<\/script>",
					"</body>",
					"</html>"
				].join("\n");
			}

			function extractHeadMarkup(html) {
				html = String(html || "");
				var match = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
				if (!match) return "";
				return match[1].replace(/<script\b[\s\S]*?<\/script>/gi, "");
			}

			function extractBodyMarkup(html) {
				html = String(html || "");
				var match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
				if (match) return match[1];
				return html.replace(/<!doctype[^>]*>/ig, "")
					.replace(/<html[^>]*>/ig, "")
					.replace(/<\/html>/ig, "")
					.replace(/<head[^>]*>[\s\S]*?<\/head>/ig, "");
			}

			function extractScriptTags(html) {
				var scripts = [];
				String(html || "").replace(/<script\b[\s\S]*?<\/script>/gi, function (tag) {
					scripts.push(tag);
					return "";
				});
				return scripts.join("\n");
			}

			function stripScriptTags(html) {
				return String(html || "").replace(/<script\b[\s\S]*?<\/script>/gi, "");
			}

			function normalizeProtocolRelative(text) {
				return String(text || "")
					.replace(/(src|href)=["']\/\/([^"']+)["']/gi, '$1="https://$2"')
					.replace(/url\(\s*(['"]?)\/\/([^'")]+)\1\s*\)/gi, 'url("https://$2")');
			}

			function getCompatRuntimeSource() {
				return String(function () {
					(function () {
						var config = window.SSN_SE_COMPAT_CONFIG || {};
						var fieldData = config.fieldData || {};
						var urlParams = new URLSearchParams(window.location.search);
						var roomID = urlParams.get("session") || config.session || "";
						var password = urlParams.get("password") || config.password || "false";
						var serverURL = urlParams.has("localserver") ? "ws://127.0.0.1:3000" : "wss://io.socialstream.ninja";
						var socketserver = false;
						var reconnectDelay = 1;
						var nameToUserId = {};
						var originalFetch = window.fetch;

						installMiniQuery();
						installHashFallback();
						installFetchShim();

						window.SSNSECompat = {
							start: start,
							receive: receiveSSNPayload,
							mapMessage: mapSSNToSEMessage,
							fieldData: fieldData
						};

						function start() {
							whenReady(function () {
								dispatchWidgetLoad();
								setupIframeBridge();
								setupSocketBridge();
								if (config.preview || urlParams.has("demo")) {
									sendDemoMessages();
								}
							});
						}

						function whenReady(callback) {
							if (document.readyState === "loading") {
								document.addEventListener("DOMContentLoaded", callback);
							} else {
								callback();
							}
						}

						function dispatchWidgetLoad() {
							var detail = {
								fieldData: fieldData,
								channel: {
									id: "ssn",
									username: urlParams.get("channel") || fieldData.channelName || "SocialStream"
								},
								currency: {
									code: "USD",
									symbol: "$"
								},
								session: {
									data: {}
								}
							};
							window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: detail }));
						}

						function setupIframeBridge() {
							if (!roomID || urlParams.has("serveronly")) return;
							var iframe = document.createElement("iframe");
							iframe.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=" + encodeURIComponent(password) + "&push&label=dock&vd=0&ad=0&novideo&noaudio&autostart&cleanoutput&room=" + encodeURIComponent(roomID);
							iframe.style.cssText = "width:0;height:0;position:fixed;left:-100px;top:-100px;border:0;";
							document.body.appendChild(iframe);
							window.addEventListener("message", function (event) {
								if (event.source !== iframe.contentWindow) return;
								if (event.data && typeof event.data === "object" && event.data.dataReceived && typeof event.data.dataReceived === "object" && event.data.dataReceived.overlayNinja !== undefined) {
									receiveSSNPayload(event.data.dataReceived.overlayNinja);
								}
							});
						}

						function setupSocketBridge() {
							if (!(urlParams.has("server") || urlParams.has("server2") || urlParams.has("localserver"))) return;
							if (!roomID) return;
							serverURL = urlParams.get("server") || urlParams.get("server2") || serverURL;
							connectSocket();
						}

						function connectSocket() {
							socketserver = new WebSocket(serverURL);
							socketserver.onclose = function () {
								setTimeout(function () {
									reconnectDelay += 1;
									connectSocket();
								}, 100 * reconnectDelay);
							};
							setupSocketHandlers();
						}

						function setupSocketHandlers() {
							socketserver.onopen = function () {
								reconnectDelay = 1;
								socketserver.send(JSON.stringify({ join: roomID, out: 3, in: 4 }));
							};
							socketserver.addEventListener("message", function (event) {
								if (!event.data) return;
								try {
									receiveSSNPayload(JSON.parse(event.data));
								} catch (error) {
									console.error("SSN SE compat parse error:", error);
								}
							});
						}

						function receiveSSNPayload(payload) {
							if (!payload || typeof payload !== "object") return;
							if (handleControlPayload(payload)) return;
							if (!config.hasWidgetScript) {
								renderGenericMessage(payload);
								return;
							}
							var eventData = mapSSNToSEMessage(payload);
							window.dispatchEvent(new CustomEvent("onEventReceived", {
								detail: {
									listener: "message",
									event: eventData
								}
							}));
						}

						function handleControlPayload(payload) {
							if ("deleteMessage" in payload) {
								removeByMessageId(payload.deleteMessage);
								window.dispatchEvent(new CustomEvent("onEventReceived", {
									detail: {
										listener: "delete-message",
										event: { msgId: String(payload.deleteMessage) }
									}
								}));
								return true;
							}
							if ("clearAll" in payload || payload.action === "clear" || payload.action === "clearAll") {
								clearLikelyContainers();
								return true;
							}
							if (payload.delete && typeof payload.delete === "object") {
								if (payload.delete.id) {
									removeByMessageId(payload.delete.id);
									window.dispatchEvent(new CustomEvent("onEventReceived", {
										detail: {
											listener: "delete-message",
											event: { msgId: String(payload.delete.id) }
										}
									}));
									return true;
								}
								if (payload.delete.chatname) {
									removeByChatName(payload.delete.chatname);
									dispatchDeleteMessagesForName(payload.delete.chatname);
									return true;
								}
							}
							if (payload.timeoutUser && (payload.timeoutUser.username || payload.timeoutUser.chatname)) {
								removeByChatName(payload.timeoutUser.username || payload.timeoutUser.chatname);
								dispatchDeleteMessagesForName(payload.timeoutUser.username || payload.timeoutUser.chatname);
								return true;
							}
							if (payload.blockUser && (payload.blockUser.username || payload.blockUser.chatname)) {
								removeByChatName(payload.blockUser.username || payload.blockUser.chatname);
								dispatchDeleteMessagesForName(payload.blockUser.username || payload.blockUser.chatname);
								return true;
							}
							return false;
						}

						function renderGenericMessage(payload) {
							var container = getGenericContainer();
							var displayName = String(payload.chatname || payload.name || "Viewer");
							var msgId = String(payload.mid || payload.id || payload.messageId || payload.message_id || (payload.meta && (payload.meta.messageId || payload.meta.message_id)) || ("ssn-" + Date.now() + "-" + Math.floor(Math.random() * 100000)));
							var userId = userIdForName(displayName);
							var row = document.createElement("div");
							var badges = mapBadges(payload.chatbadges, getRole(payload));
							var badgeHTML = badges.map(function (badge) {
								return '<img alt="" src="' + escapeAttr(badge.url || transparentPixel()) + '" class="badge ' + escapeAttr(badge.type || "badge") + '-icon">';
							}).join(" ");
							var userStyle = payload.nameColor ? ' style="color:' + escapeAttr(payload.nameColor) + '"' : "";
							var messageHTML = String(payload.chatmessage || payload.message || "");
							if (payload.contentimg) {
								messageHTML += '<div class="attachment"><img src="' + escapeAttr(payload.contentimg) + '" alt=""></div>';
							}
							if (payload.hasDonation || payload.donation) {
								messageHTML = '<span class="donation">' + escapeHTML(payload.hasDonation || payload.donation) + '</span> ' + messageHTML;
							}
							if (payload.membership || payload.subtitle) {
								messageHTML = '<span class="membership">' + escapeHTML([payload.membership, payload.subtitle].filter(Boolean).join(" ")) + '</span> ' + messageHTML;
							}
							row.className = "message-row animated";
							row.setAttribute("data-mid", msgId);
							row.setAttribute("data-id", msgId);
							row.setAttribute("data-msgid", msgId);
							row.setAttribute("data-sender", userId);
							row.setAttribute("data-from", userId);
							row.setAttribute("data-chatname", displayName);
							row.setAttribute("data-source-type", payload.type || "ssn");
							row.innerHTML = '<div class="user-box">' + badgeHTML + '<span' + userStyle + '>' + escapeHTML(displayName) + '</span></div><div class="user-message">' + messageHTML + '</div>';
							if (urlParams.has("top") || urlParams.get("direction") === "top") {
								container.insertBefore(row, container.firstChild);
							} else {
								container.appendChild(row);
							}
							trimGenericMessages(container);
						}

						function getGenericContainer() {
							var container = document.querySelector(".main-container, #main-container, #log, .chat-container, #chat-container");
							if (container) return container;
							container = document.createElement("div");
							container.className = "main-container";
							document.body.appendChild(container);
							return container;
						}

						function trimGenericMessages(container) {
							var limit = parseInt(urlParams.get("limit") || fieldData.messagesLimit || "50", 10);
							if (!limit || limit < 1) return;
							while (container.children.length > limit) {
								container.removeChild(urlParams.has("top") ? container.lastElementChild : container.firstElementChild);
							}
						}

						function removeByMessageId(id) {
							id = String(id || "");
							if (!id) return;
							removeMatching('[data-mid="' + cssEscape(id) + '"], [data-id="' + cssEscape(id) + '"], [data-msgid="' + cssEscape(id) + '"]');
						}

						function removeByChatName(name) {
							name = String(name || "");
							if (!name) return;
							removeMatching('[data-chatname="' + cssEscape(name) + '"]');
						}

						function removeMatching(selector) {
							Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (element) {
								if (element.parentNode) element.parentNode.removeChild(element);
							});
						}

						function dispatchDeleteMessagesForName(name) {
							var userId = userIdForName(name);
							window.dispatchEvent(new CustomEvent("onEventReceived", {
								detail: {
									listener: "delete-messages",
									event: { userId: userId }
								}
							}));
						}

						function clearLikelyContainers() {
							var selectors = [".main-container", "#main-container", "#log", ".chat-container", "#chat-container"];
							selectors.forEach(function (selector) {
								Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (element) {
									while (element.firstChild) element.removeChild(element.firstChild);
								});
							});
						}

						function mapSSNToSEMessage(payload) {
							var displayName = String(payload.chatname || payload.name || "Viewer");
							var msgId = String(payload.mid || payload.id || payload.messageId || payload.message_id || (payload.meta && (payload.meta.messageId || payload.meta.message_id)) || ("ssn-" + Date.now() + "-" + Math.floor(Math.random() * 100000)));
							var textHTML = String(payload.chatmessage || payload.message || "");
							var plainText = stripHTML(textHTML);
							var role = getRole(payload);
							var badges = mapBadges(payload.chatbadges, role);
							var userId = userIdForName(displayName);
							var tags = buildTags(payload, role, displayName, msgId, badges);
							var attachment = payload.contentimg ? { media: { image: { src: payload.contentimg } } } : undefined;
							var eventText = plainText;
							if (!eventText && payload.hasDonation) eventText = String(payload.hasDonation);
							if (!eventText && payload.membership) eventText = String(payload.membership);

							return {
								service: payload.type || "ssn",
								renderedText: textHTML,
								data: {
									time: Date.now(),
									tags: tags,
									nick: displayName.toLowerCase().replace(/\s+/g, ""),
									userId: userId,
									displayName: displayName,
									displayColor: payload.nameColor || "",
									badges: badges,
									channel: roomID || "ssn",
									text: eventText,
									isAction: !!payload.event,
									emotes: [],
									msgId: msgId,
									attachment: attachment,
									amount: payload.hasDonation || payload.donation || "",
									role: role,
									rawSSN: payload
								}
							};
						}

						function buildTags(payload, role, displayName, msgId, badges) {
							return {
								"badge-info": "",
								badges: badges.map(function (badge) {
									return badge.type ? badge.type + "/1" : "";
								}).filter(Boolean).join(","),
								color: payload.nameColor || "",
								"display-name": displayName,
								emotes: "",
								flags: "",
								id: msgId,
								mod: role === "moderator" ? "1" : "0",
								"room-id": roomID || "ssn",
								subscriber: role === "subscriber" ? "1" : "0",
								"tmi-sent-ts": String(Date.now()),
								turbo: "0",
								"user-id": userIdForName(displayName),
								"user-type": role === "broadcaster" ? "broadcaster" : (role === "moderator" ? "mod" : "")
							};
						}

						function mapBadges(input, role) {
							var badges = [];
							if (Array.isArray(input)) {
								input.forEach(function (badge) {
									var mapped = mapBadge(badge);
									if (mapped) badges.push(mapped);
								});
							} else if (typeof input === "string" && input) {
								badges.push({ type: inferBadgeType(input), version: "1", url: input, description: inferBadgeType(input) });
							}
							if (role !== "viewer" && !badges.some(function (badge) { return badge.type === role || (role === "moderator" && badge.type === "mod"); })) {
								badges.push({ type: role === "moderator" ? "moderator" : role, version: "1", url: transparentPixel(), description: role });
							}
							return badges;
						}

						function mapBadge(badge) {
							if (!badge) return null;
							if (typeof badge === "string") {
								return { type: inferBadgeType(badge), version: "1", url: badge, description: inferBadgeType(badge) };
							}
							var url = badge.url || badge.src || "";
							var type = badge.type || badge.name || badge.title || badge.label || badge.text || inferBadgeType(url);
							return {
								type: String(type || "badge").toLowerCase(),
								version: String(badge.version || "1"),
								url: url || transparentPixel(),
								description: badge.description || type || "badge"
							};
						}

						function getRole(payload) {
							var roleText = "";
							if (payload.role) roleText += " " + payload.role;
							if (payload.membership) roleText += " subscriber member sub";
							if (payload.meta) roleText += " " + [payload.meta.role, payload.meta.badge, payload.meta.badges, payload.meta.userType, payload.meta.user_type].join(" ");
							if (Array.isArray(payload.chatbadges)) {
								payload.chatbadges.forEach(function (badge) {
									if (typeof badge === "string") roleText += " " + badge;
									else if (badge) roleText += " " + [badge.type, badge.name, badge.title, badge.label, badge.text, badge.description, badge.src, badge.url].join(" ");
								});
							} else if (payload.chatbadges) {
								roleText += " " + payload.chatbadges;
							}
							roleText = roleText.toLowerCase();
							if (payload.isBroadcaster || payload.broadcaster || /broadcaster|owner/.test(roleText)) return "broadcaster";
							if (payload.isMod || payload.mod || payload.moderator || /moderator|\bmod\b/.test(roleText)) return "moderator";
							if (payload.isVIP || payload.vip || /\bvip\b/.test(roleText)) return "vip";
							if (payload.isSubscriber || payload.subscriber || /subscriber|member|\bsub\b/.test(roleText)) return "subscriber";
							return "viewer";
						}

						function inferBadgeType(value) {
							value = String(value || "").toLowerCase();
							if (value.indexOf("broadcaster") !== -1) return "broadcaster";
							if (value.indexOf("moderator") !== -1 || value.indexOf("/mod") !== -1 || value.indexOf("mod.") !== -1) return "moderator";
							if (value.indexOf("vip") !== -1) return "vip";
							if (value.indexOf("subscriber") !== -1 || value.indexOf("member") !== -1 || value.indexOf("sub") !== -1) return "subscriber";
							return "badge";
						}

						function userIdForName(name) {
							name = String(name || "viewer");
							if (nameToUserId[name]) return nameToUserId[name];
							var hash = 0;
							for (var i = 0; i < name.length; i++) {
								hash = ((hash << 5) - hash) + name.charCodeAt(i);
								hash |= 0;
							}
							nameToUserId[name] = "ssn-" + Math.abs(hash);
							return nameToUserId[name];
						}

						function stripHTML(html) {
							var div = document.createElement("div");
							div.innerHTML = String(html || "");
							return (div.textContent || div.innerText || "").trim();
						}

						function escapeHTML(value) {
							return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (character) {
								return {
									"&": "&amp;",
									"<": "&lt;",
									">": "&gt;",
									'"': "&quot;",
									"'": "&#39;"
								}[character];
							});
						}

						function escapeAttr(value) {
							return escapeHTML(value).replace(/`/g, "&#96;");
						}

						function cssEscape(value) {
							if (window.CSS && CSS.escape) return CSS.escape(value);
							return String(value).replace(/["\\]/g, "\\$&");
						}

						function transparentPixel() {
							return "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
						}

						function sendDemoMessages() {
							var messages = [
								{ chatname: "Jess", chatmessage: "Imported overlay preview message.", type: "youtube", mid: "demo-1" },
								{ chatname: "Morgan", chatmessage: "VIP and subscriber styling should map where possible.", type: "twitch", vip: true, mid: "demo-2" },
								{ chatname: "Ava", chatmessage: "Supporter event preview.", type: "kick", membership: "Subscriber", mid: "demo-3" }
							];
							messages.forEach(function (message, index) {
								setTimeout(function () {
									receiveSSNPayload(message);
								}, 300 + index * 450);
							});
						}

						function installFetchShim() {
							window.fetch = function (url, options) {
								if (/api\.streamelements\.com\/kappa\/v2\/channels/i.test(String(url || ""))) {
									return Promise.resolve({
										ok: true,
										json: function () {
											return Promise.resolve({ provider: "twitch" });
										}
									});
								}
								if (originalFetch) {
									return originalFetch.apply(window, arguments);
								}
								return Promise.reject(new Error("fetch unavailable"));
							};
						}

						function installHashFallback() {
							if (window.md5) return;
							window.md5 = function (input) {
								var text = String(input || "");
								var h1 = 0x811c9dc5;
								var h2 = 0x01000193;
								var h3 = 0x9e3779b9;
								var h4 = 0x85ebca6b;
								for (var i = 0; i < text.length; i++) {
									var code = text.charCodeAt(i);
									h1 = Math.imul(h1 ^ code, 0x01000193);
									h2 = Math.imul(h2 ^ code, 0x85ebca6b);
									h3 = Math.imul(h3 ^ code, 0xc2b2ae35);
									h4 = Math.imul(h4 ^ code, 0x27d4eb2f);
								}
								return toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
							};
							function toHex(value) {
								return ("00000000" + (value >>> 0).toString(16)).slice(-8);
							}
						}

						function installMiniQuery() {
							if (window.jQuery || window.$) {
								if (!window.jQuery && window.$) window.jQuery = window.$;
								if (!window.$ && window.jQuery) window.$ = window.jQuery;
								return;
							}

							function MiniQuery(input) {
								this.elements = normalizeElements(input);
								this.length = this.elements.length;
								this._delay = 0;
							}

							MiniQuery.prototype.each = function (callback) {
								this.elements.forEach(function (element, index) {
									callback.call(element, index, element);
								});
								return this;
							};

							MiniQuery.prototype.appendTo = function (target) {
								var container = typeof target === "string" ? document.querySelector(target) : target;
								if (!container) return this;
								return this.each(function () {
									container.appendChild(this);
								});
							};

							MiniQuery.prototype.prependTo = function (target) {
								var container = typeof target === "string" ? document.querySelector(target) : target;
								if (!container) return this;
								return this.each(function () {
									container.insertBefore(this, container.firstChild);
								});
							};

							MiniQuery.prototype.remove = function () {
								return this.each(function () {
									if (this.parentNode) this.parentNode.removeChild(this);
								});
							};

							MiniQuery.prototype.addClass = function (name) {
								return this.each(function () {
									if (name) String(name).split(/\s+/).forEach(this.classList.add, this.classList);
								});
							};

							MiniQuery.prototype.removeClass = function (name) {
								return this.each(function () {
									if (name) String(name).split(/\s+/).forEach(this.classList.remove, this.classList);
								});
							};

							MiniQuery.prototype.hasClass = function (name) {
								return !!(this.elements[0] && this.elements[0].classList && this.elements[0].classList.contains(name));
							};

							MiniQuery.prototype.append = function (content) {
								return insertContent(this, content, false);
							};

							MiniQuery.prototype.prepend = function (content) {
								return insertContent(this, content, true);
							};

							MiniQuery.prototype.empty = function () {
								return this.each(function () {
									this.innerHTML = "";
								});
							};

							MiniQuery.prototype.html = function (value) {
								if (value === undefined) {
									return this.elements[0] ? this.elements[0].innerHTML : undefined;
								}
								return this.each(function () {
									this.innerHTML = value;
								});
							};

							MiniQuery.prototype.text = function (value) {
								if (value === undefined) {
									return this.elements[0] ? this.elements[0].textContent : undefined;
								}
								return this.each(function () {
									this.textContent = value;
								});
							};

							MiniQuery.prototype.attr = function (name, value) {
								if (value === undefined) {
									return this.elements[0] ? this.elements[0].getAttribute(name) : undefined;
								}
								return this.each(function () {
									this.setAttribute(name, value);
								});
							};

							MiniQuery.prototype.css = function (name, value) {
								if (typeof name === "string" && value === undefined) {
									return this.elements[0] ? window.getComputedStyle(this.elements[0]).getPropertyValue(name) || this.elements[0].style[name] : undefined;
								}
								return this.each(function () {
									var element = this;
									if (typeof name === "object") {
										Object.keys(name || {}).forEach(function (key) {
											setStyle(element, key, name[key]);
										});
									} else {
										setStyle(element, name, value);
									}
								});
							};

							MiniQuery.prototype.find = function (selector) {
								var found = [];
								this.each(function () {
									found = found.concat(Array.prototype.slice.call(this.querySelectorAll(selector)));
								});
								return new MiniQuery(found);
							};

							MiniQuery.prototype.parent = function () {
								var parents = [];
								this.each(function () {
									if (this.parentNode && parents.indexOf(this.parentNode) === -1) parents.push(this.parentNode);
								});
								return new MiniQuery(parents);
							};

							MiniQuery.prototype.show = function () {
								return this.each(function () {
									this.style.display = "";
								});
							};

							MiniQuery.prototype.hide = function () {
								return this.each(function () {
									this.style.display = "none";
								});
							};

							MiniQuery.prototype.fadeTo = function (speed, opacity, callback) {
								return this.animate({ opacity: opacity }, speed, callback);
							};

							MiniQuery.prototype.fadeIn = function (speed, callback) {
								this.show();
								return this.fadeTo(speed, 1, callback);
							};

							MiniQuery.prototype.fadeOut = function (speed, callback) {
								return this.fadeTo(speed, 0, callback);
							};

							MiniQuery.prototype.width = function (value) {
								if (value === undefined) {
									return this.elements[0] ? this.elements[0].getBoundingClientRect().width : undefined;
								}
								return this.css("width", typeof value === "number" ? value + "px" : value);
							};

							MiniQuery.prototype.height = function (value) {
								if (value === undefined) {
									return this.elements[0] ? this.elements[0].getBoundingClientRect().height : undefined;
								}
								return this.css("height", typeof value === "number" ? value + "px" : value);
							};

							MiniQuery.prototype.delay = function (ms) {
								this._delay += Number(ms) || 0;
								return this;
							};

							MiniQuery.prototype.queue = function (callback) {
								var self = this;
								setTimeout(function () {
									self.each(function () {
										callback.call(this);
									});
								}, self._delay);
								self._delay = 0;
								return self;
							};

							MiniQuery.prototype.dequeue = function () {
								return this;
							};

							MiniQuery.prototype.animate = function (props, speed, callback) {
								var duration = speed === "slow" ? 600 : (Number(speed) || 300);
								return this.each(function () {
									var element = this;
									element.style.transition = "all " + duration + "ms ease";
									Object.keys(props || {}).forEach(function (key) {
										var value = props[key];
										element.style[key] = typeof value === "number" ? value + "px" : value;
									});
									if (callback) {
										setTimeout(function () {
											callback.call(element);
										}, duration);
									}
								});
							};

							MiniQuery.prototype.first = function () {
								return new MiniQuery(this.elements.length ? [this.elements[0]] : []);
							};

							function insertContent(collection, content, prepend) {
								var nodes = content instanceof MiniQuery ? content.elements : normalizeElements(content);
								if (!nodes.length && typeof content === "string") {
									nodes = [document.createTextNode(content)];
								}
								return collection.each(function () {
									var container = this;
									nodes.forEach(function (node, index) {
										var child = index === 0 ? node : node.cloneNode(true);
										if (prepend) {
											container.insertBefore(child, container.firstChild);
										} else {
											container.appendChild(child);
										}
									});
								});
							}

							function setStyle(element, name, value) {
								if (String(name).indexOf("-") !== -1 && element.style.setProperty) {
									element.style.setProperty(name, value);
								} else {
									element.style[name] = value;
								}
							}

							function normalizeElements(input) {
								if (!input) return [];
								if (input instanceof MiniQuery) return input.elements;
								if (typeof input === "string") {
									var trimmed = input.trim();
									if (trimmed.charAt(0) === "<") {
										return parseHTML(trimmed);
									}
									return Array.prototype.slice.call(document.querySelectorAll(input));
								}
								if (input.nodeType || input === window || input === document) return [input];
								if (Array.isArray(input)) return input;
								if (typeof input.length === "number") return Array.prototype.slice.call(input);
								return [];
							}

							function parseHTML(html) {
								var template = document.createElement("template");
								template.innerHTML = String(html || "").trim();
								return Array.prototype.slice.call(template.content.childNodes);
							}

							function dollar(input) {
								return new MiniQuery(input);
							}

							dollar.parseHTML = parseHTML;
							window.$ = dollar;
							window.jQuery = dollar;
						}
					})();
				}).replace(/^function\s*\(\)\s*\{\s*|\s*\}$/g, "");
			}

			function parseJSONSafe(text) {
				text = String(text || "").trim();
				if (!text) return {};
				try {
					return JSON.parse(text);
				} catch (error) {
					return {};
				}
			}

			function isTextPath(path) {
				return /\.(html?|css|js|json|txt|md|xml)$/i.test(path || "");
			}

			function mimeForPath(path) {
				path = String(path || "").toLowerCase();
				if (/\.png$/.test(path)) return "image/png";
				if (/\.jpe?g$/.test(path)) return "image/jpeg";
				if (/\.gif$/.test(path)) return "image/gif";
				if (/\.webp$/.test(path)) return "image/webp";
				if (/\.svg$/.test(path)) return "image/svg+xml";
				if (/\.woff2?$/.test(path)) return path.slice(-5) === "woff2" ? "font/woff2" : "font/woff";
				if (/\.ttf$/.test(path)) return "font/ttf";
				if (/\.mp3$/.test(path)) return "audio/mpeg";
				if (/\.wav$/.test(path)) return "audio/wav";
				if (/\.mp4$/.test(path)) return "video/mp4";
				if (/\.webm$/.test(path)) return "video/webm";
				return "application/octet-stream";
			}

			function basename(path) {
				return String(path || "").replace(/\\/g, "/").split("/").pop();
			}

			function safeJSON(value) {
				return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
			}

			function safeScriptText(text) {
				return String(text || "").replace(/<\/script/gi, "<\\/script");
			}

			function safeStyleText(text) {
				return String(text || "").replace(/<\/style/gi, "<\\/style");
			}

			function escapeHTML(value) {
				return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (character) {
					return {
						"&": "&amp;",
						"<": "&lt;",
						">": "&gt;",
						'"': "&quot;",
						"'": "&#39;"
					}[character];
				});
			}
		})();
