(function () {
			var state = {
				files: [],
				textByPath: {},
				assetByPath: {},
				fieldData: {},
				html: "",
				css: "",
				js: "",
				sourceName: "",
				processing: false,
				remoteAssetsEmbedded: 0,
				remoteAssetsFailed: 0,
				detected: null,
				warnings: [],
				manualParts: {},
				lastExportFileName: ""
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
			var livePreviewBtn = document.getElementById("livePreviewBtn");
			var exportBtn = document.getElementById("exportBtn");
			var clearBtn = document.getElementById("clearBtn");
			var sessionInput = document.getElementById("sessionInput");
			var sessionWarning = document.getElementById("sessionWarning");
			var passwordInput = document.getElementById("passwordInput");
			var outputName = document.getElementById("outputName");
			var fallbackPromptText = document.getElementById("fallbackPromptText");
			var copyPromptBtn = document.getElementById("copyPromptBtn");
			var promptCopyStatus = document.getElementById("promptCopyStatus");
			var exportModal = document.getElementById("exportModal");
			var exportSessionHint = document.getElementById("exportSessionHint");
			var exportObsUrlHint = document.getElementById("exportObsUrlHint");
			var exportSessionMessage = document.getElementById("exportSessionMessage");
			var exportSummary = document.getElementById("exportSummary");
			var copySessionHintBtn = document.getElementById("copySessionHintBtn");
			var copyObsUrlBtn = document.getElementById("copyObsUrlBtn");
			var downloadReadmeBtn = document.getElementById("downloadReadmeBtn");
			var closeExportModalBtn = document.getElementById("closeExportModalBtn");
			var htmlPartSelect = document.getElementById("htmlPartSelect");
			var cssPartSelect = document.getElementById("cssPartSelect");
			var jsPartSelect = document.getElementById("jsPartSelect");
			var fieldsPartSelect = document.getElementById("fieldsPartSelect");
			var dataPartSelect = document.getElementById("dataPartSelect");
			var applyFileSelectionBtn = document.getElementById("applyFileSelectionBtn");

			loadSavedSession();
			updateSessionWarning();

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

			if (livePreviewBtn) {
				livePreviewBtn.addEventListener("click", function () {
					renderLivePreview();
				});
			}

			exportBtn.addEventListener("click", function () {
				exportOverlay();
			});

			clearBtn.addEventListener("click", function () {
				resetState();
			});

			if (copyPromptBtn && fallbackPromptText) {
				copyPromptBtn.addEventListener("click", copyFallbackPrompt);
			}

			if (copySessionHintBtn) {
				copySessionHintBtn.addEventListener("click", copySessionHint);
			}

			if (copyObsUrlBtn) {
				copyObsUrlBtn.addEventListener("click", copyObsUrl);
			}

			if (downloadReadmeBtn) {
				downloadReadmeBtn.addEventListener("click", downloadReadme);
			}

			if (applyFileSelectionBtn) {
				applyFileSelectionBtn.addEventListener("click", applyFileSelection);
			}

			if (closeExportModalBtn) {
				closeExportModalBtn.addEventListener("click", hideExportModal);
			}

			if (exportModal) {
				exportModal.addEventListener("click", function (event) {
					if (event.target === exportModal) hideExportModal();
				});
			}

			sessionInput.addEventListener("input", function () {
				saveSession();
				updateSessionWarning();
				refreshButtons();
			});
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
					sourceName: "",
					processing: false,
					remoteAssetsEmbedded: 0,
					remoteAssetsFailed: 0,
					detected: null,
					warnings: [],
					manualParts: {},
					lastExportFileName: ""
				};
				previewFrame.removeAttribute("srcdoc");
				emptyPreview.style.display = "";
				statusBox.textContent = "Waiting for overlay files.";
				fileList.innerHTML = "";
				populateFileSelectors(null);
				refreshButtons();
			}

			function setStatus(lines) {
				statusBox.innerHTML = lines.map(function (line) {
					return escapeHTML(line);
				}).join("\n");
			}

			function refreshButtons() {
				var hasBuild = !!(state.html || state.css || state.js);
				previewBtn.disabled = !hasBuild || state.processing;
				if (livePreviewBtn) livePreviewBtn.disabled = !hasBuild || state.processing || !(sessionInput.value || "").trim();
				exportBtn.disabled = !hasBuild || state.processing;
			}

			function loadSavedSession() {
				try {
					var saved = localStorage.getItem("ssnSeImporterSession") || "";
					if (saved && sessionInput && !sessionInput.value) sessionInput.value = saved;
				} catch (error) {}
			}

			function saveSession() {
				try {
					var session = (sessionInput.value || "").trim();
					if (session) localStorage.setItem("ssnSeImporterSession", session);
					else localStorage.removeItem("ssnSeImporterSession");
				} catch (error) {}
			}

			function updateSessionWarning() {
				if (!sessionWarning) return;
				sessionWarning.className = "session-warning" + ((sessionInput.value || "").trim() ? "" : " show");
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

			function copyText(text, callback) {
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(text).then(function () {
						if (callback) callback(true);
					}).catch(function () {
						copyTextViaTextarea(text);
						if (callback) callback(true);
					});
				} else {
					copyTextViaTextarea(text);
					if (callback) callback(true);
				}
			}

			function copyTextViaTextarea(text) {
				var textarea = document.createElement("textarea");
				textarea.value = text;
				textarea.style.position = "fixed";
				textarea.style.left = "-9999px";
				document.body.appendChild(textarea);
				textarea.focus();
				textarea.select();
				try {
					document.execCommand("copy");
				} catch (error) {}
				if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
			}

			function showExportModal(fileName) {
				if (!exportModal || !exportSessionHint || !exportSessionMessage) return;
				var session = (sessionInput.value || "").trim();
				var password = (passwordInput.value || "").trim();
				var suffix = session ? "?session=" + encodeURIComponent(session) : "?session=YOUR_SESSION_ID";
				if (password) suffix += "&password=" + encodeURIComponent(password);
				var exampleUrl = fileName + suffix;
				state.lastExportFileName = fileName;
				exportSessionHint.textContent = suffix;
				if (exportObsUrlHint) exportObsUrlHint.textContent = exampleUrl;
				if (session) {
					exportSessionMessage.textContent = "This session was also embedded into " + fileName + ". The URL ending still lets you override it later.";
				} else {
					exportSessionMessage.textContent = "Without this URL ending, the overlay will open but will not receive live SSN messages.";
				}
				if (exportSummary) exportSummary.textContent = buildExportSummary(fileName);
				exportModal.classList.add("open");
				if (closeExportModalBtn) closeExportModalBtn.focus();
			}

			function hideExportModal() {
				if (exportModal) exportModal.classList.remove("open");
			}

			function copySessionHint() {
				if (!exportSessionHint) return;
				copyText(exportSessionHint.textContent || "?session=YOUR_SESSION_ID", function () {
					if (copySessionHintBtn) {
						var oldText = copySessionHintBtn.textContent;
						copySessionHintBtn.textContent = "Copied";
						setTimeout(function () {
							copySessionHintBtn.textContent = oldText;
						}, 1600);
					}
				});
			}

			function copyObsUrl() {
				if (!exportObsUrlHint) return;
				copyText(exportObsUrlHint.textContent || "", function () {
					if (copyObsUrlBtn) {
						var oldText = copyObsUrlBtn.textContent;
						copyObsUrlBtn.textContent = "Copied";
						setTimeout(function () {
							copyObsUrlBtn.textContent = oldText;
						}, 1600);
					}
				});
			}

			function downloadReadme() {
				var fileName = state.lastExportFileName || (outputName.value || "ssn-imported-overlay.html").trim();
				if (!/\.html?$/i.test(fileName)) fileName += ".html";
				downloadTextFile(fileName.replace(/\.html?$/i, "-README.txt"), buildReadmeText(fileName));
			}

			function downloadTextFile(fileName, text) {
				var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
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

			function buildExportSummary(fileName) {
				var lines = [];
				lines.push("Export: " + fileName);
				lines.push("Local assets embedded: " + Object.keys(state.assetByPath).length);
				lines.push("Remote assets embedded: " + (state.remoteAssetsEmbedded || 0));
				lines.push("Remote assets left as URLs: " + (state.remoteAssetsFailed || 0));
				if (state.detected && state.detected.ignoredFiles && state.detected.ignoredFiles.length) {
					lines.push("Ignored generated/export files: " + state.detected.ignoredFiles.length);
				}
				if (state.detected && state.detected.unusedPartFiles && state.detected.unusedPartFiles.length) {
					lines.push("Other source-like files not used: " + state.detected.unusedPartFiles.length);
				}
				if (state.warnings && state.warnings.length) {
					lines.push("");
					lines.push("Possible manual fixes:");
					state.warnings.forEach(function (warning) {
						lines.push("- " + warning);
					});
				}
				return lines.join("\n");
			}

			function buildReadmeText(fileName) {
				var suffix = exportSessionHint ? exportSessionHint.textContent : "?session=YOUR_SESSION_ID";
				var lines = [
					"Social Stream Ninja Imported Overlay",
					"",
					"HTML file:",
					fileName,
					"",
					"OBS setup:",
					"1. Add a Browser Source.",
					"2. Select the exported HTML file or paste its file URL.",
					"3. Add your SSN session to the end of the URL:",
					suffix,
					"",
					"Example:",
					fileName + suffix,
					"",
					"Optional URL overrides:",
					"- Add &limit=30 to cap chat rows.",
					"- Add &direction=top or &direction=bottom to change message order when the imported widget supports standard fields.",
					"- Add &hideAfter=20 to remove rows after 20 seconds when supported by the widget.",
					"",
					"Quick visual test:",
					fileName + "?demo",
					"",
					buildExportSummary(fileName)
				];
				return lines.join("\n");
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

			function processImportedItems(items, sourceName, manualParts) {
				state.files = items.slice().sort(function (a, b) {
					return a.path.localeCompare(b.path);
				});
				state.textByPath = {};
				state.assetByPath = {};
				state.sourceName = sourceName || "overlay";
				state.processing = false;
				state.remoteAssetsEmbedded = 0;
				state.remoteAssetsFailed = 0;
				state.manualParts = manualParts || {};

				state.files.forEach(function (item) {
					if (item.isText) {
						state.textByPath[item.path] = item.text || "";
					} else {
						state.assetByPath[item.path] = item.dataUrl || "";
					}
				});

				var detected = detectWidgetParts(state.files, state.manualParts);
				state.detected = detected;
				var fields = parseJSONSafe(detected.fieldsText || "{}");
				var data = parseJSONSafe(detected.dataText || "{}");
				state.fieldData = mergeFieldDefaults(fields, data);
				state.html = normalizeProtocolRelative(replaceAssets(resolveTemplate(detected.htmlText || '<div class="main-container"></div>', state.fieldData)));
				state.css = normalizeProtocolRelative(replaceAssets(resolveTemplate(detected.cssText || "", state.fieldData)));
				state.js = normalizeProtocolRelative(resolveTemplate(detected.jsText || "", state.fieldData));
				state.warnings = analyzeUnsupportedFeatures(state.html, state.css, state.js);

				state.processing = true;
				populateFileSelectors(detected);
				updateFileList(detected, ["Checking remote asset URLs."]);
				refreshButtons();
				inlineRemoteCssImports().then(function () {
					return inlineRemoteAssets();
				}).then(function (stats) {
					state.remoteAssetsEmbedded = stats.embedded;
					state.remoteAssetsFailed = stats.failed;
					state.processing = false;
					updateFileList(detected);
					refreshButtons();
					renderPreview();
				}).catch(function (error) {
					state.remoteAssetsFailed += 1;
					state.processing = false;
					updateFileList(detected, ["Remote asset check failed: " + String(error && error.message || error)]);
					refreshButtons();
					renderPreview();
				});
			}

			function detectWidgetParts(items, manualParts) {
				var ignoredFiles = [];
				var textItems = items.filter(function (item) {
					return item.isText;
				});
				var usableItems = textItems.filter(function (item) {
					if (isGeneratedOutput(item)) {
						ignoredFiles.push(item.path);
						return false;
					}
					return true;
				});

				var fieldsItem = chooseBestPart(usableItems.filter(function (item) { return isLikelyFields(item.name.toLowerCase(), item.path.toLowerCase()); }), "fields");
				var dataItem = chooseBestPart(usableItems.filter(function (item) { return isLikelyData(item.name.toLowerCase(), item.path.toLowerCase()); }), "data");
				var htmlItem = chooseBestPart(usableItems.filter(isLikelyHTML), "html");
				if (!htmlItem) {
					htmlItem = chooseBestPart(usableItems.filter(function (item) {
						return /<\s*(div|html|body|head|link|script)\b/i.test(item.text || "");
					}), "html");
				}
				var cssItem = chooseBestPart(usableItems.filter(isLikelyCSS), "css");
				var jsItem = chooseBestPart(usableItems.filter(isLikelyJS), "js");

				if (manualParts) {
					htmlItem = chooseManualPart(usableItems, manualParts.html, htmlItem);
					cssItem = chooseManualPart(usableItems, manualParts.css, cssItem);
					jsItem = chooseManualPart(usableItems, manualParts.js, jsItem);
					fieldsItem = chooseManualPart(usableItems, manualParts.fields, fieldsItem);
					dataItem = chooseManualPart(usableItems, manualParts.data, dataItem);
				}

				var unusedPartFiles = collectUnusedPartFiles(usableItems, [fieldsItem, dataItem, htmlItem, cssItem, jsItem]);

				return {
					htmlText: joinTextParts(htmlItem ? [htmlItem] : []),
					cssText: joinTextParts(cssItem ? [cssItem] : []),
					jsText: joinTextParts(jsItem ? [jsItem] : []),
					fieldsText: fieldsItem ? fieldsItem.text : "",
					dataText: dataItem ? dataItem.text : "",
					htmlFiles: htmlItem ? [htmlItem.path] : [],
					cssFiles: cssItem ? [cssItem.path] : [],
					jsFiles: jsItem ? [jsItem.path] : [],
					fieldsFile: fieldsItem ? fieldsItem.path : "",
					dataFile: dataItem ? dataItem.path : "",
					ignoredFiles: ignoredFiles,
					unusedPartFiles: unusedPartFiles
				};
			}

			function chooseManualPart(items, path, fallback) {
				if (!path) return fallback;
				if (path === "__none__") return null;
				for (var i = 0; i < items.length; i++) {
					if (items[i].path === path) return items[i];
				}
				return fallback;
			}

			function isLikelyHTML(item) {
				var lowerPath = item.path.toLowerCase();
				var lowerName = item.name.toLowerCase();
				return /\.html?$/i.test(lowerPath) || /^html(\s*[-_].*)?\.txt$/i.test(lowerName) || /\bhtml\b/i.test(lowerName);
			}

			function isLikelyCSS(item) {
				var lowerPath = item.path.toLowerCase();
				var lowerName = item.name.toLowerCase();
				return /\.css$/i.test(lowerPath) || /^css(\s*[-_].*)?\.txt$/i.test(lowerName) || /\bcss\b/i.test(lowerName);
			}

			function isLikelyJS(item) {
				var lowerPath = item.path.toLowerCase();
				var lowerName = item.name.toLowerCase();
				return /\.js$/i.test(lowerPath) || /^js(\s*[-_].*)?\.txt$/i.test(lowerName) || /\bjs\b/i.test(lowerName);
			}

			function isGeneratedOutput(item) {
				var lowerPath = item.path.toLowerCase();
				var lowerName = item.name.toLowerCase();
				if (/validation-|ssn-imported|stream-overlay-to-ssn-prompt|streamelements-importer-prompt|-ssn-overlay|converted/i.test(lowerPath)) return true;
				if (/\.(png|jpe?g|gif|webp|svg)$/i.test(lowerName)) return false;
				var text = item.text || "";
				return /SSN_SE_COMPAT_CONFIG|Social Stream Ninja SE Widget Importer|window\.SSNSECompat|overlayNinja|graycodeAddMessage/i.test(text);
			}

			function chooseBestPart(items, type) {
				if (!items.length) return null;
				return items.slice().sort(function (a, b) {
					return scorePart(b, type) - scorePart(a, type) || a.path.localeCompare(b.path);
				})[0];
			}

			function scorePart(item, type) {
				var lowerPath = item.path.toLowerCase().replace(/\\/g, "/");
				var lowerName = item.name.toLowerCase();
				var score = 0;
				if (type === "html") {
					if (/^html(\s*[-_].*)?\.txt$/.test(lowerName)) score += 170;
					if (lowerName === "widget.html") score += 150;
					if (lowerName === "chat.html") score += 145;
					if (lowerName === "index.html") score += 90;
					if (/\.html?$/.test(lowerName)) score += 60;
					if (/\bhtml\b/.test(lowerName)) score += 50;
				} else if (type === "css") {
					if (/^css(\s*[-_].*)?\.txt$/.test(lowerName)) score += 170;
					if (lowerName === "widget.css") score += 150;
					if (lowerName === "chat.css") score += 145;
					if (lowerName === "style.css" || lowerName === "styles.css") score += 110;
					if (/\.css$/.test(lowerName)) score += 60;
					if (/\bcss\b/.test(lowerName)) score += 50;
				} else if (type === "js") {
					if (/^js(\s*[-_].*)?\.txt$/.test(lowerName)) score += 170;
					if (lowerName === "widget.js") score += 150;
					if (lowerName === "chat.js") score += 145;
					if (lowerName === "script.js" || lowerName === "main.js") score += 100;
					if (/\.js$/.test(lowerName)) score += 60;
					if (/\bjs\b/.test(lowerName)) score += 50;
				} else if (type === "fields") {
					if (/^fields?(\s*[-_].*)?\.txt$/.test(lowerName)) score += 170;
					if (lowerName === "fields.json") score += 160;
					if (lowerName === "widget.json") score += 140;
					if (/\bfields?\b/.test(lowerName)) score += 80;
				} else if (type === "data") {
					if (/^data(\s*[-_].*)?\.txt$/.test(lowerName)) score += 170;
					if (lowerName === "data.json") score += 160;
					if (/\bdata\b/.test(lowerName)) score += 80;
				}
				if (/node_modules|__macosx|\.git|readme|docs?\//.test(lowerPath)) score -= 80;
				score -= lowerPath.split("/").length;
				return score;
			}

			function collectUnusedPartFiles(items, selectedItems) {
				var selected = {};
				selectedItems.forEach(function (item) {
					if (item) selected[item.path] = true;
				});
				return items.filter(function (item) {
					if (selected[item.path]) return false;
					return isLikelyHTML(item) || isLikelyCSS(item) || isLikelyJS(item) || isLikelyFields(item.name.toLowerCase(), item.path.toLowerCase()) || isLikelyData(item.name.toLowerCase(), item.path.toLowerCase());
				}).map(function (item) {
					return item.path;
				});
			}

			function populateFileSelectors(detected) {
				var selects = [htmlPartSelect, cssPartSelect, jsPartSelect, fieldsPartSelect, dataPartSelect];
				if (!htmlPartSelect || !cssPartSelect || !jsPartSelect || !fieldsPartSelect || !dataPartSelect || !applyFileSelectionBtn) return;
				var textItems = state.files.filter(function (item) {
					return item.isText && !isGeneratedOutput(item);
				});
				fillPartSelect(htmlPartSelect, textItems, state.manualParts.html || (detected && detected.htmlFiles[0]), "Auto HTML", false);
				fillPartSelect(cssPartSelect, textItems, state.manualParts.css || (detected && detected.cssFiles[0]), "Auto CSS", false);
				fillPartSelect(jsPartSelect, textItems, state.manualParts.js || (detected && detected.jsFiles[0]), "Auto JS", true);
				fillPartSelect(fieldsPartSelect, textItems, state.manualParts.fields || (detected && detected.fieldsFile), "Auto fields", true);
				fillPartSelect(dataPartSelect, textItems, state.manualParts.data || (detected && detected.dataFile), "Auto data", true);
				selects.forEach(function (select) {
					select.disabled = !state.files.length;
				});
				applyFileSelectionBtn.disabled = !state.files.length;
			}

			function fillPartSelect(select, items, selectedPath, autoLabel, allowNone) {
				select.innerHTML = "";
				addSelectOption(select, "", autoLabel);
				if (allowNone) addSelectOption(select, "__none__", "None");
				items.forEach(function (item) {
					addSelectOption(select, item.path, item.path);
				});
				if (selectedPath) select.value = selectedPath;
			}

			function addSelectOption(select, value, label) {
				var option = document.createElement("option");
				option.value = value;
				option.textContent = label;
				select.appendChild(option);
			}

			function applyFileSelection() {
				if (!state.files.length) return;
				var manualParts = {
					html: htmlPartSelect ? htmlPartSelect.value : "",
					css: cssPartSelect ? cssPartSelect.value : "",
					js: jsPartSelect ? jsPartSelect.value : "",
					fields: fieldsPartSelect ? fieldsPartSelect.value : "",
					data: dataPartSelect ? dataPartSelect.value : ""
				};
				processImportedItems(state.files, state.sourceName, manualParts);
			}

			function analyzeUnsupportedFeatures(html, css, js) {
				var warnings = [];
				var combined = [html || "", css || "", js || ""].join("\n");
				addWarningIf(warnings, /\bSE_API\b|streamelements\.com\/api|api\.streamelements\.com/i.test(combined), "StreamElements account APIs may require manual replacement.");
				addWarningIf(warnings, /\bStreamlabs\b|streamlabs\.com\/api/i.test(combined), "Streamlabs account APIs may require manual replacement.");
				addWarningIf(warnings, /\bTwitch\.ext\b|extension\.twitch\.tv/i.test(combined), "Twitch extension APIs are not available in standalone OBS overlays.");
				addWarningIf(warnings, /\b(localStorage|sessionStorage)\b/i.test(combined), "Widget store state may not match StreamElements overlay-store behavior.");
				addWarningIf(warnings, /(\$|jQuery)\.fn\.|\.slick\(|\.select2\(|\.draggable\(|\.resizable\(/i.test(combined), "Custom jQuery plugins are not bundled by the importer.");
				addWarningIf(warnings, /\bfetch\s*\(|XMLHttpRequest/i.test(js || ""), "Network requests are left in place unless they are recognized static assets.");
				addWarningIf(warnings, /@import\s+url\(["']?https?:\/\/(?!fonts\.googleapis\.com|cdnjs\.cloudflare\.com\/ajax\/libs\/animate\.css)/i.test(css || ""), "Some remote CSS imports may not bundle if CORS blocks them.");
				return warnings;
			}

			function addWarningIf(warnings, condition, message) {
				if (condition && warnings.indexOf(message) === -1) warnings.push(message);
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

			function updateFileList(detected, extraLines) {
				var lines = [];
				lines.push("Detected HTML: " + (detected.htmlFiles.join(", ") || "generated fallback"));
				lines.push("Detected CSS: " + (detected.cssFiles.join(", ") || "none"));
				lines.push("Detected JS: " + (detected.jsFiles.join(", ") || "none"));
				lines.push("Fields: " + (detected.fieldsFile || "none"));
				lines.push("Data: " + (detected.dataFile || "none"));
				lines.push("Fields resolved: " + Object.keys(state.fieldData).length);
				lines.push("Assets embedded: " + Object.keys(state.assetByPath).length);
				if (state.remoteAssetsEmbedded) lines.push("Remote assets embedded: " + state.remoteAssetsEmbedded);
				if (state.remoteAssetsFailed) lines.push("Remote assets left as URLs: " + state.remoteAssetsFailed);
				if (detected.ignoredFiles && detected.ignoredFiles.length) lines.push("Ignored generated/export files: " + detected.ignoredFiles.length);
				if (detected.unusedPartFiles && detected.unusedPartFiles.length) lines.push("Other source-like files not used: " + detected.unusedPartFiles.length);
				if (state.warnings && state.warnings.length) lines.push("Possible manual fixes: " + state.warnings.length);
				if (extraLines && extraLines.length) {
					extraLines.forEach(function (line) {
						lines.push(line);
					});
				}
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
					var normalizedPath = normalizeAssetKey(path);
					lookup[normalizedPath] = dataUrl;
					lookup[normalizeAssetKey(basename(path))] = dataUrl;
					addAssetSuffixes(lookup, normalizedPath, dataUrl);
				});
				return lookup;
			}

			function addAssetSuffixes(lookup, normalizedPath, dataUrl) {
				var parts = String(normalizedPath || "").split("/");
				for (var i = 1; i < parts.length; i++) {
					lookup[parts.slice(i).join("/")] = dataUrl;
				}
			}

			function inlineRemoteAssets() {
				var urls = collectRemoteAssetUrls(state.html + "\n" + state.css);
				var maxRemoteAssets = 40;
				var stats = { embedded: 0, failed: 0 };
				if (!urls.length) return Promise.resolve(stats);
				urls = urls.slice(0, maxRemoteAssets);
				return urls.reduce(function (chain, url) {
					return chain.then(function () {
						return fetchRemoteAssetAsDataUrl(url).then(function (dataUrl) {
							if (dataUrl) {
								state.html = replaceAllText(state.html, url, dataUrl);
								state.css = replaceAllText(state.css, url, dataUrl);
								stats.embedded += 1;
							} else {
								stats.failed += 1;
							}
						}).catch(function () {
							stats.failed += 1;
						});
					});
				}, Promise.resolve()).then(function () {
					return stats;
				});
			}

			function inlineRemoteCssImports() {
				var imports = collectRemoteCssImports(state.css);
				if (!imports.length) return Promise.resolve();
				return imports.reduce(function (chain, item) {
					return chain.then(function () {
						return fetchRemoteText(item.url).then(function (cssText) {
							if (!cssText) return;
							cssText = rewriteCssRelativeUrls(cssText, item.url);
							state.css = state.css.split(item.full).join(cssText);
						}).catch(function () {});
					});
				}, Promise.resolve());
			}

			function collectRemoteCssImports(cssText) {
				var imports = [];
				String(cssText || "").replace(/@import\s+(?:url\(\s*)?["']?(https?:\/\/[^"')\s]+)["']?\s*\)?[^;]*;/gi, function (full, url) {
					if (isEmbeddableCssUrl(url)) imports.push({ full: full, url: url });
					return full;
				});
				return imports.slice(0, 12);
			}

			function isEmbeddableCssUrl(url) {
				url = String(url || "");
				if (!/^https?:\/\//i.test(url)) return false;
				if (/fonts\.googleapis\.com/i.test(url)) return false;
				return /cdnjs\.cloudflare\.com\/ajax\/libs\/animate\.css|\.css([?#].*)?$/i.test(url);
			}

			function fetchRemoteText(url) {
				if (!window.fetch) return Promise.resolve("");
				return fetch(url, { mode: "cors", credentials: "omit" }).then(function (response) {
					if (!response || !response.ok) return "";
					return response.text();
				});
			}

			function rewriteCssRelativeUrls(cssText, sourceUrl) {
				return String(cssText || "").replace(/url\(\s*(['"]?)(?!data:|https?:|\/\/|#)([^'")]+)\1\s*\)/gi, function (full, quote, url) {
					var absolute = resolveCssUrl(url, sourceUrl);
					return absolute ? "url(\"" + absolute + "\")" : full;
				});
			}

			function resolveCssUrl(url, sourceUrl) {
				url = String(url || "").replace(/^\s+|\s+$/g, "");
				if (!url) return "";
				try {
					if (window.URL) return new URL(url, sourceUrl).href;
				} catch (error) {}
				if (/^\//.test(url)) {
					var origin = String(sourceUrl || "").match(/^(https?:\/\/[^\/]+)/i);
					return origin ? origin[1] + url : url;
				}
				return String(sourceUrl || "").replace(/[?#].*$/, "").replace(/\/[^\/]*$/, "/") + url.replace(/^\.\//, "");
			}

			function collectRemoteAssetUrls(text) {
				var found = {};
				String(text || "").replace(/url\(\s*(['"]?)(https?:\/\/[^'")]+)\1\s*\)/gi, function (full, quote, url) {
					if (isEmbeddableRemoteUrl(url)) found[url] = true;
					return full;
				});
				String(text || "").replace(/\b(src|href)=["'](https?:\/\/[^"']+)["']/gi, function (full, attr, url) {
					if (isEmbeddableRemoteUrl(url)) found[url] = true;
					return full;
				});
				return Object.keys(found);
			}

			function isEmbeddableRemoteUrl(url) {
				url = String(url || "");
				if (!/^https?:\/\//i.test(url)) return false;
				if (/\.(css|js|html?|json|txt|md)([?#].*)?$/i.test(url)) return false;
				if (/fonts\.googleapis\.com|cdnjs\.cloudflare\.com\/ajax\/libs\/animate\.css|blueimp-md5/i.test(url)) return false;
				return /\.(png|jpe?g|gif|webp|svg|avif|woff2?|ttf|otf|mp3|wav|ogg|mp4|webm)([?#].*)?$/i.test(url) ||
					/cdn\.streamelements\.com\/uploads\//i.test(url) ||
					/static-cdn\.jtvnw\.net\/badges\//i.test(url);
			}

			function fetchRemoteAssetAsDataUrl(url) {
				if (!window.fetch || !window.FileReader) return Promise.resolve("");
				return fetch(url, { mode: "cors", credentials: "omit" }).then(function (response) {
					if (!response || !response.ok) return "";
					var type = response.headers && response.headers.get ? response.headers.get("content-type") : "";
					if (type && !/^(image|font|audio|video)\//i.test(type) && !/svg/i.test(type)) return "";
					return response.blob();
				}).then(function (blob) {
					if (!blob) return "";
					return new Promise(function (resolve, reject) {
						var reader = new FileReader();
						reader.onerror = function () { reject(reader.error); };
						reader.onload = function () { resolve(String(reader.result || "")); };
						reader.readAsDataURL(blob);
					});
				});
			}

			function replaceAllText(text, search, replacement) {
				return String(text || "").split(search).join(replacement);
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

			function renderLivePreview() {
				if (!(state.html || state.css || state.js)) return;
				if (!(sessionInput.value || "").trim()) {
					updateSessionWarning();
					sessionInput.focus();
					return;
				}
				previewFrame.srcdoc = buildExportHTML({ preview: false });
				emptyPreview.style.display = "none";
				updateFileList(state.detected, ["Live preview is listening for SSN session: " + (sessionInput.value || "").trim()]);
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
				showExportModal(fileName);
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
					getExportInstructionsComment(config),
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

			function getExportInstructionsComment(config) {
				var suffix = config.session ? "?session=" + encodeURIComponent(config.session) : "?session=YOUR_SESSION_ID";
				if (config.password && config.password !== "false") suffix += "&password=" + encodeURIComponent(config.password);
				return [
					"<!--",
					"Social Stream Ninja imported overlay",
					"Live use: add this file as an OBS Browser Source and append " + suffix + " to the file URL if a session was not embedded.",
					"Optional overrides: &limit=30, &direction=top, &direction=bottom, &hideAfter=20.",
					"Demo use: open this file with ?demo to show sample messages without SSN traffic.",
					"Generated by streamelements-importer.html",
					"-->"
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
						applyRuntimeFieldOverrides(fieldData);
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

						function applyRuntimeFieldOverrides(data) {
							var limit = parseInt(urlParams.get("limit") || "", 10);
							if (limit > 0) {
								data.messagesLimit = limit;
								data.eventsLimit = limit;
							}
							var hideAfter = parseFloat(urlParams.get("hideAfter") || urlParams.get("hideafter") || "");
							if (hideAfter >= 0 && isFinite(hideAfter)) data.hideAfter = hideAfter;
							var direction = String(urlParams.get("direction") || "").toLowerCase();
							if (urlParams.has("top")) direction = "top";
							if (urlParams.has("bottom")) direction = "bottom";
							if (direction === "top" || direction === "prepend") {
								data.direction = "top";
								data.alignMessages = "block";
							} else if (direction === "bottom" || direction === "append") {
								data.direction = "bottom";
								data.alignMessages = "inline";
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
								if (!hasRenderableChatPayload(payload)) return;
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

						function hasRenderableChatPayload(payload) {
							if (hasRenderableText(payload.chatmessage) || hasRenderableText(payload.message)) return true;
							if (payload.contentimg || payload.hasDonation || payload.donation || payload.membership || payload.subtitle) return true;
							return false;
						}

						function hasRenderableText(value) {
							var raw = String(value || "");
							if (/<(img|svg|video|audio|canvas)\b/i.test(raw)) return true;
							return !!stripHTML(raw);
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
							scheduleGenericRemoval(row);
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

						function scheduleGenericRemoval(row) {
							var hideAfter = parseFloat(urlParams.get("hideAfter") || urlParams.get("hideafter") || fieldData.hideAfter || "");
							if (!hideAfter || hideAfter < 0 || hideAfter === 999 || !isFinite(hideAfter)) return;
							setTimeout(function () {
								if (row && row.parentNode) row.parentNode.removeChild(row);
							}, hideAfter * 1000);
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
