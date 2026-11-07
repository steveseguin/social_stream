(function () {
    "use strict";

    var DB_NAME = "chatMessagesDB_v3";
    var STORE_NAME = "messages";
    var DEFAULT_ENDPOINT = "https://llm.socialstream.ninja/v1/chat/completions";
    var DEFAULT_MODEL = "default";
    var DEFAULT_TOKEN = "test_token";
    var MAX_MESSAGE_CHARS_FOR_LLM = 900;
    var CONTEXT_MAX_MESSAGES = 20;
    var CONTEXT_MAX_AGE_MS = 30000;
    var CONTEXT_MESSAGE_CHARS_FOR_LLM = 500;
    var LLM_REQUEST_TIMEOUT_MS = 45000;
    var LLM_JSON_RETRY_LIMIT = 3;
    var LLM_FETCH_RETRY_LIMIT = 5;
    var TAXONOMIES = ["question", "positive_feedback", "negative_feedback", "feature_request", "support_issue", "purchase_intent", "moderation_risk", "spam", "off_topic", "other"];
    var CENSOR_COMPACT_FRAGMENT_MAX_LENGTH = 2;
    var CENSOR_COMPACT_CANDIDATE_MIN_LENGTH = 4;
    var CENSOR_COMPACT_CANDIDATE_MAX_LENGTH = 16;
    var safePhrasesSet = new Set(["lol", "lmao", "gg", "hi", "hello", "ok", "yes", "no", "thanks", "thank you"]);
    var longestSafePhraseLength = 19;
    var profanityHashTable = null;

    var endpointInput = document.getElementById("endpoint");
    var modelInput = document.getElementById("model");
    var tokenInput = document.getElementById("token");
    var timeframeInput = document.getElementById("timeframe");
    var dateFromInput = document.getElementById("date-from");
    var dateToInput = document.getElementById("date-to");
    var maxMessagesInput = document.getElementById("max-messages");
    var batchSizeInput = document.getElementById("batch-size");
    var startButton = document.getElementById("start-button");
    var stopButton = document.getElementById("stop-button");
    var downloadLink = document.getElementById("download-link");
    var statusEl = document.getElementById("status");
    var logEl = document.getElementById("log");

    var abortRequested = false;
    var activeControllers = [];
    var lastDownloadUrl = "";

    function log(message) {
        var stamp = new Date().toLocaleTimeString();
        logEl.textContent += "[" + stamp + "] " + message + "\n";
        logEl.scrollTop = logEl.scrollHeight;
    }

    function setStatus(message) {
        statusEl.textContent = message;
    }

    function setRunning(running) {
        startButton.disabled = running;
        stopButton.disabled = !running;
    }

    function delay(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    function clampConcurrentRequests(value) {
        var parsed = parseInt(value, 10);
        if (!isFinite(parsed) || parsed < 1) return 100;
        return Math.min(100, parsed);
    }

    function getNestedTextSetting(settings, key) {
        var value = settings && settings[key];
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value.textsetting === "string") return value.textsetting;
        if (typeof value.optionsetting === "string") return value.optionsetting;
        return "";
    }

    function getStoredSettings() {
        return new Promise(function (resolve) {
            if (!window.chrome || !chrome.storage || !chrome.storage.local) {
                resolve({});
                return;
            }
            chrome.storage.local.get(["settings"], function (result) {
                resolve((result && result.settings) || {});
            });
        });
    }

    function normalizeHostedEndpoint(endpoint) {
        var value = String(endpoint || "").trim();
        if (!value) return DEFAULT_ENDPOINT;
        if (value.indexOf("/v1") !== -1 && value.indexOf("/completions") !== -1) {
            return value;
        }
        return value.replace(/\/+$/, "") + "/v1/chat/completions";
    }

    async function loadLLMDefaults() {
        var settings = await getStoredSettings();
        var endpoint = getNestedTextSetting(settings, "hostedLLMEndpoint") || DEFAULT_ENDPOINT;
        var model = getNestedTextSetting(settings, "hostedLLMModel") || DEFAULT_MODEL;
        var token = getNestedTextSetting(settings, "hostedLLMToken") || DEFAULT_TOKEN;

        endpointInput.value = normalizeHostedEndpoint(endpoint);
        modelInput.value = model;
        tokenInput.value = token;
    }

    async function loadSafePhrasesFromAIJS() {
        try {
            var response = await fetch("./ai.js", { cache: "no-store" });
            if (!response.ok) return;
            var text = await response.text();
            var match = text.match(/let\s+safePhrasesSet\s*=\s*new\s+Set\s*\((\[[\s\S]*?\])\s*\)/);
            if (!match) return;
            var phrases = JSON.parse(match[1]);
            safePhrasesSet = new Set(phrases);
            longestSafePhraseLength = phrases.reduce(function (max, phrase) {
                return Math.max(max, String(phrase || "").length);
            }, longestSafePhraseLength);
            log("Loaded " + phrases.length + " safe phrases from ai.js.");
        } catch (error) {
            log("Safe phrase load fallback: " + error.message);
        }
    }

    function generateVariations(word) {
        if (!word || !word.trim()) return [word];
        if (word.length > 20) return [word];

        var alternatives = (typeof alternativeChars !== "undefined") ? alternativeChars : {
            a: ["@", "4"],
            e: ["3"],
            i: ["1", "!"],
            o: ["0"],
            s: ["$", "5"],
            t: ["7"]
        };
        var variations = [word];

        for (var i = 0; i < word.length && variations.length < 100; i++) {
            var char = word[i].toLowerCase();
            if (!alternatives.hasOwnProperty(char)) continue;
            var newVariations = [];
            var variationsToProcess = variations.slice(0, 10);

            for (var j = 0; j < variationsToProcess.length; j++) {
                for (var k = 0; k < alternatives[char].length; k++) {
                    if (newVariations.length + variations.length >= 100) break;
                    newVariations.push(variationsToProcess[j].slice(0, i) + alternatives[char][k] + variationsToProcess[j].slice(i + 1));
                }
            }
            variations = variations.concat(newVariations);
        }

        return variations.slice(0, 100).filter(function (variation) {
            return !variation.match(/[A-Z]/);
        });
    }

    function generateVariationsList(words) {
        var variationsList = [];
        var wordsTrimmed = (words || []).slice(0, 1500);

        for (var i = 0; i < wordsTrimmed.length && variationsList.length < 20000; i++) {
            var wordVariations = generateVariations(String(wordsTrimmed[i] || "").trim().toLowerCase());
            variationsList = variationsList.concat(wordVariations.slice(0, 20000 - variationsList.length));
        }

        return variationsList.filter(function (word) {
            return word && !word.match(/[A-Z]/);
        });
    }

    function createProfanityHashTable(profanityVariationsList) {
        var hashTable = {};
        var limitedList = (profanityVariationsList || []).slice(0, 20000);

        for (var i = 0; i < limitedList.length; i++) {
            var word = String(limitedList[i] || "").trim().toLowerCase();
            if (!word) continue;
            var firstChar = word.charAt(0);
            if (!hashTable[firstChar]) hashTable[firstChar] = {};
            hashTable[firstChar][word] = true;
        }

        return hashTable;
    }

    function isProfanity(word) {
        if (!profanityHashTable || !word) return false;
        var wordLower = String(word).toLowerCase();
        var words = profanityHashTable[wordLower[0]];
        return Boolean(words && words[wordLower]);
    }

    function containsProfanity(sentence) {
        if (!sentence || !profanityHashTable) return false;

        var buckets = Object.values(profanityHashTable);
        for (var i = 0; i < buckets.length; i++) {
            var phrases = Object.keys(buckets[i]).filter(function (word) {
                return word.indexOf(" ") !== -1;
            });
            for (var j = 0; j < phrases.length; j++) {
                if (String(sentence).toLowerCase().indexOf(phrases[j].toLowerCase()) !== -1) {
                    return true;
                }
            }
        }

        var words = String(sentence).split(/[\s\.\-_!?,]+/);
        for (var k = 0; k < words.length; k++) {
            if (isProfanity(words[k])) return true;
        }

        return false;
    }

    function loadProfanityList() {
        var customBadwords = "";
        try {
            customBadwords = localStorage.getItem("customBadwords") || "";
        } catch (e) {}

        var baseWords = customBadwords
            ? customBadwords.split(/\r?\n|\r|\n/g)
            : ((typeof badWords !== "undefined" && Array.isArray(badWords)) ? badWords : []);

        profanityHashTable = createProfanityHashTable(generateVariationsList(baseWords));
        log("Loaded profanity matcher.");
    }

    async function initializeAnalysisLayers() {
        setStatus("Loading local analysis layers...");
        await loadSafePhrasesFromAIJS();
        loadProfanityList();
    }

    function openMessageDB() {
        return new Promise(function (resolve, reject) {
            var request = indexedDB.open(DB_NAME);

            request.onupgradeneeded = function (event) {
                event.target.transaction.abort();
            };
            request.onsuccess = function (event) {
                var db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.close();
                    reject(new Error("Message store not found."));
                    return;
                }
                resolve(db);
            };
            request.onerror = function () {
                reject(request.error || new Error("Unable to open message database."));
            };
        });
    }

    function getDateRange() {
        var now = new Date();
        var start = null;
        var end = now.getTime();
        var timeframe = timeframeInput.value;

        if (timeframe === "day") {
            start = now.getTime() - 24 * 60 * 60 * 1000;
        } else if (timeframe === "week") {
            start = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        } else if (timeframe === "month") {
            var monthStart = new Date(now);
            monthStart.setMonth(monthStart.getMonth() - 1);
            start = monthStart.getTime();
        } else if (timeframe === "custom") {
            if (dateFromInput.value) {
                var from = new Date(dateFromInput.value);
                from.setHours(0, 0, 0, 0);
                start = from.getTime();
            }
            if (dateToInput.value) {
                var to = new Date(dateToInput.value);
                to.setHours(23, 59, 59, 999);
                end = to.getTime();
            }
        }

        return {
            start: start,
            end: end
        };
    }

    function createRange(start, end) {
        if (start !== null && end !== null) return IDBKeyRange.bound(start, end);
        if (start !== null) return IDBKeyRange.lowerBound(start);
        if (end !== null) return IDBKeyRange.upperBound(end);
        return null;
    }

    function htmlToText(value) {
        var text = String(value || "");
        if (!text) return "";

        text = text.replace(/<\s*br\s*\/?>/gi, " ");
        text = text.replace(/<\s*img\b[^>]*>/gi, function (tag) {
            var label = getTagAttribute(tag, "alt") || getTagAttribute(tag, "title") || "";
            return label ? " " + label + " " : " ";
        });
        text = text.replace(/<[^>]+>/g, " ");

        return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
    }

    function getTagAttribute(tag, name) {
        var pattern = new RegExp("\\s" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i");
        var match = String(tag || "").match(pattern);
        return match ? (match[1] || match[2] || match[3] || "") : "";
    }

    function decodeHtmlEntities(text) {
        var textarea = document.createElement("textarea");
        textarea.innerHTML = String(text || "");
        return textarea.value;
    }

    function loadMessages(db) {
        return new Promise(function (resolve, reject) {
            var maxMessages = parseInt(maxMessagesInput.value, 10);
            if (!isFinite(maxMessages) || maxMessages < 0) maxMessages = 0;

            var range = getDateRange();
            var transaction = db.transaction([STORE_NAME], "readonly");
            var store = transaction.objectStore(STORE_NAME);
            var index = store.index("timestamp");
            var cursorRange = createRange(range.start, range.end);
            var request = index.openCursor(cursorRange, "next");
            var results = [];

            request.onsuccess = function (event) {
                var cursor = event.target.result;
                if (!cursor) {
                    resolve(results);
                    return;
                }

                var value = cursor.value || {};
                var messageText = htmlToText(value.chatmessage || value.message || "");
                if (messageText) {
                    var meta = value.meta && typeof value.meta === "object" ? value.meta : {};
                    results.push({
                        id: value.id,
                        name: value.chatname || "",
                        source: value.type || "",
                        channel: value.channel || value.channelname || value.sourceName || value.sourceId || meta.channelId || meta.channel || value.tid || "",
                        time: value.timestamp || "",
                        message: messageText
                    });
                }

                if (maxMessages && results.length >= maxMessages) {
                    resolve(results);
                    return;
                }

                cursor.continue();
            };
            request.onerror = function () {
                reject(request.error || new Error("Unable to read message database."));
            };
        });
    }

    function truncateForLLM(text, maxChars) {
        text = String(text || "");
        if (text.length <= maxChars) return text;
        return text.slice(0, maxChars) + "...";
    }

    function getRecentContext(messages, index) {
        var current = messages[index];
        var currentTime = Number(current.time || 0);
        var currentSource = String(current.source || "");
        var currentChannel = String(current.channel || "");
        var context = [];

        for (var i = index - 1; i >= 0 && context.length < CONTEXT_MAX_MESSAGES; i--) {
            var candidate = messages[i];
            var candidateTime = Number(candidate.time || 0);
            if (currentTime && candidateTime && currentTime - candidateTime > CONTEXT_MAX_AGE_MS) {
                break;
            }
            if (currentSource && String(candidate.source || "") !== currentSource) {
                continue;
            }
            if (currentChannel && String(candidate.channel || "") && String(candidate.channel || "") !== currentChannel) {
                continue;
            }
            context.unshift(candidate);
        }

        return context;
    }

    function cleanCensorText(text) {
        var cleanedText = String(text || "");
        cleanedText = cleanedText.replace(/\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu, "").replace(/[\u200D\uFE0F]/g, "");
        cleanedText = cleanedText.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/gi, "");
        cleanedText = cleanedText.replace(/[\r\n]+/g, "").replace(/\s+/g, " ").trim().toLowerCase();
        return cleanedText;
    }

    function isSafePhraseMessage(message) {
        var cleanedText = cleanCensorText(message.message);
        if (!cleanedText) return { isSafe: true, cleanedText: "" };
        if (cleanedText.length > longestSafePhraseLength) return { isSafe: false, cleanedText: cleanedText };
        if (cleanedText.length === 1) return { isSafe: true, cleanedText: cleanedText };
        return { isSafe: safePhrasesSet.has(cleanedText), cleanedText: cleanedText };
    }

    function normalizeCompactCensorText(value) {
        return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    }

    function isCompactFragmentEligible(messageText) {
        var normalized = normalizeCompactCensorText(messageText);
        return !!normalized && normalized.length <= CENSOR_COMPACT_FRAGMENT_MAX_LENGTH;
    }

    function buildCompactSequenceCandidates(recentMessages, currentMessage) {
        var sequence = recentMessages.concat(currentMessage ? [currentMessage] : []);
        var candidates = [];
        var latestUser = currentMessage && currentMessage.name || "";
        var roomFragments = sequence
            .filter(function (entry) { return isCompactFragmentEligible(entry.message); })
            .map(function (entry) { return normalizeCompactCensorText(entry.message); });
        var sameUserFragments = latestUser
            ? sequence
                .filter(function (entry) { return (entry.name || "") === latestUser && isCompactFragmentEligible(entry.message); })
                .map(function (entry) { return normalizeCompactCensorText(entry.message); })
            : [];

        function pushCandidate(scope, label, fragments) {
            var compact = fragments.join("");
            if (compact.length < CENSOR_COMPACT_CANDIDATE_MIN_LENGTH || compact.length > CENSOR_COMPACT_CANDIDATE_MAX_LENGTH) return;
            candidates.push({ scope: scope, label: label, compact: compact });
        }

        pushCandidate("same-user", latestUser || "same user", sameUserFragments);
        pushCandidate("room", "whole room", roomFragments);

        return candidates;
    }

    function findCompactProfanityCandidate(candidates) {
        for (var i = 0; i < candidates.length; i++) {
            if (isProfanity(candidates[i].compact) || containsProfanity(candidates[i].compact)) {
                return candidates[i];
            }
        }
        return null;
    }

    function shouldReviewSafePhraseWithContext(recentMessages, currentMessage) {
        var latestUser = currentMessage && currentMessage.name || "";
        var sameUserRecentCount = latestUser
            ? recentMessages.filter(function (entry) { return (entry.name || "") === latestUser; }).length
            : 0;
        var sameUserShortCount = latestUser
            ? recentMessages.filter(function (entry) { return (entry.name || "") === latestUser && isCompactFragmentEligible(entry.message); }).length
            : 0;
        var roomShortCount = recentMessages.filter(function (entry) { return isCompactFragmentEligible(entry.message); }).length;
        var currentShort = isCompactFragmentEligible(currentMessage && currentMessage.message);

        return sameUserRecentCount >= 2 || (currentShort && sameUserShortCount >= 2) || (currentShort && roomShortCount >= 3);
    }

    function formatRecentMessagesForPrompt(recentMessages) {
        if (!recentMessages.length) {
            return "None";
        }
        return recentMessages
            .map(function (entry, index) {
                var name = entry.name || "User";
                var source = entry.source ? " [" + entry.source + "]" : "";
                return (index + 1) + ". " + name + source + ": " + truncateForLLM(entry.message, CONTEXT_MESSAGE_CHARS_FOR_LLM);
            })
            .join("\n");
    }

    function formatCompactCandidatesForPrompt(compactCandidates) {
        if (!compactCandidates.length) {
            return "None";
        }
        return compactCandidates
            .map(function (candidate) {
                return "- " + (candidate.scope === "same-user" ? "Same-user" : "Whole-room") + " short-fragment join for " + candidate.label + ": " + candidate.compact;
            })
            .join("\n");
    }

    function buildClassificationPrompt(message, recentMessages, compactCandidates) {
        var latestLine = (message.name || "User") +
            (message.source ? " [" + message.source + "]" : "") +
            ": " + truncateForLLM(message.message, MAX_MESSAGE_CHARS_FOR_LLM);

        return [
            "Analyze the recent chat context and latest message for moderation and taxonomy TSV export.",
            "Classify only the latest message, using context to understand references, replies, sarcasm, short answers, and follow-up comments.",
            "Messages may be long or very short, and offensive words may be spelled across multiple short messages or users.",
            "Return exactly one valid JSON object and nothing else.",
            "Use exactly these three keys: sentimentScore, censorScore, taxonomy.",
            "Do not include explanations, labels, markdown, quotes around numbers, or any extra keys.",
            "Shape: {\"sentimentScore\":0.5,\"censorScore\":0,\"taxonomy\":\"other\"}",
            "Example: {\"sentimentScore\":0.15,\"censorScore\":5,\"taxonomy\":\"moderation_risk\"}",
            "sentimentScore is a number from 0 to 1, where 0 is very negative, 0.5 is neutral, and 1 is very positive.",
            "censorScore is a number from 0 to 5: 0 means safe, 5 means clearly offensive.",
            "Any profanity or curse word automatically qualifies as censorScore 5.",
            "Taxonomy labels: question, positive_feedback, negative_feedback, feature_request, support_issue, purchase_intent, moderation_risk, spam, off_topic, other.",
            "",
            "Recent chat:",
            formatRecentMessagesForPrompt(recentMessages),
            "",
            "Compact candidates:",
            formatCompactCandidatesForPrompt(compactCandidates || []),
            "",
            "Latest message:",
            latestLine,
            ""
        ].join("\n");
    }

    function extractMessageContent(responseJson) {
        if (typeof responseJson === "string") return responseJson;
        if (responseJson && responseJson.choices && responseJson.choices[0]) {
            var choice = responseJson.choices[0];
            if (choice.message && typeof choice.message.content === "string") return choice.message.content;
            if (typeof choice.text === "string") return choice.text;
        }
        if (responseJson && typeof responseJson.response === "string") return responseJson.response;
        if (responseJson && typeof responseJson.content === "string") return responseJson.content;
        return "";
    }

    function parseLLMJson(content) {
        var text = String(content || "").trim();
        text = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

        var firstObject = text.indexOf("{");
        var firstArray = text.indexOf("[");
        var start = -1;
        if (firstObject === -1) {
            start = firstArray;
        } else if (firstArray === -1) {
            start = firstObject;
        } else {
            start = Math.min(firstObject, firstArray);
        }

        var end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
        if (start > 0 || end < text.length - 1) {
            text = text.slice(start, end + 1);
        }

        var parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed[0] || {};
        if (parsed && Array.isArray(parsed.results)) return parsed.results[0] || {};
        if (parsed && typeof parsed === "object") return parsed;
        throw new Error("LLM JSON did not include results.");
    }

    function normalizeLabel(value, allowed, fallback) {
        var normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
        for (var i = 0; i < allowed.length; i++) {
            if (normalized === allowed[i]) return normalized;
        }
        return fallback;
    }

    function validateLLMResult(result) {
        if (!result || typeof result !== "object" || Array.isArray(result)) {
            throw new Error("LLM response was not a JSON object.");
        }

        var sentimentScore = Number(result.sentimentScore);
        var score = Number(result.censorScore);
        var taxonomy = normalizeLabel(result.taxonomy, TAXONOMIES, "");
        if (!Number.isFinite(sentimentScore) || sentimentScore < 0 || sentimentScore > 1 || !Number.isFinite(score) || score < 0 || score > 5 || !taxonomy) {
            throw new Error("LLM response missing valid sentimentScore, censorScore, or taxonomy.");
        }

        return {
            sentimentScore: Math.max(0, Math.min(1, sentimentScore)),
            censorScore: Math.max(0, Math.min(5, score)),
            taxonomy: taxonomy
        };
    }

    function buildHostedLLMSettingsOverride() {
        var endpoint = normalizeHostedEndpoint(endpointInput.value);
        var token = String(tokenInput.value || "").trim();
        var model = String(modelInput.value || "").trim() || DEFAULT_MODEL;

        return {
            aiProvider: { optionsetting: "hostedllm" },
            hostedLLMEndpoint: { textsetting: endpoint },
            hostedLLMModel: { textsetting: model },
            hostedLLMToken: { textsetting: token }
        };
    }

    function formatBackgroundLLMError(error) {
        if (!error) return "Unexpected error";
        if (typeof error === "string") return error;
        var parts = [];
        if (error.provider) parts.push(String(error.provider));
        if (error.status) parts.push("HTTP " + error.status);
        if (error.code) parts.push(String(error.code));
        if (error.message) parts.push(String(error.message));
        if (error.hint) parts.push(String(error.hint));
        return parts.join(": ") || "Unexpected error";
    }

    function sendPromptToBackground(prompt) {
        if (!window.chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
            return Promise.reject(new Error("Chrome extension runtime is not available."));
        }

        return new Promise(function (resolve, reject) {
            var finished = false;
            var activeController = {
                abort: function () {
                    finish(reject, new Error("aborted"));
                }
            };
            var timeoutId = setTimeout(function () {
                activeController.abort();
            }, LLM_REQUEST_TIMEOUT_MS);

            function finish(handler, value) {
                if (finished) return;
                finished = true;
                clearTimeout(timeoutId);
                activeControllers = activeControllers.filter(function (controller) {
                    return controller !== activeController;
                });
                handler(value);
            }

            function handleResponse(response) {
                var lastError = chrome.runtime.lastError;
                if (lastError) {
                    finish(reject, new Error(lastError.message || "Background LLM request failed."));
                    return;
                }
                if (!response) {
                    finish(reject, new Error("Background LLM request did not respond."));
                    return;
                }
                if (response.success === false || response.error) {
                    finish(reject, new Error("LLM request failed: " + formatBackgroundLLMError(response.error)));
                    return;
                }
                finish(resolve, response.response);
            }

            var command = {
                cmd: "classifyMessageForExport",
                prompt: prompt,
                settingsOverride: buildHostedLLMSettingsOverride()
            };

            activeControllers.push(activeController);
            chrome.runtime.sendMessage(command, function (response) {
                var lastError = chrome.runtime.lastError;
                if (!finished && (lastError || !response)) {
                    chrome.runtime.sendMessage({
                        type: "toBackground",
                        data: command
                    }, handleResponse);
                    return;
                }
                handleResponse(response);
            });
        });
    }

    async function callLLM(message, recentMessages, compactCandidates) {
        var prompt = buildClassificationPrompt(message, recentMessages, compactCandidates);
        var response = await sendPromptToBackground(prompt);
        var content = extractMessageContent(response);

        return validateLLMResult(parseLLMJson(content));
    }

    async function classifyMessage(messages, index) {
        var message = messages[index];
        var recentMessages = getRecentContext(messages, index);
        var safePhrase = isSafePhraseMessage(message);
        var compactCandidates = buildCompactSequenceCandidates(recentMessages, message);
        var compactProfanityCandidate = findCompactProfanityCandidate(compactCandidates);
        var directProfanity = containsProfanity(message.message);

        if (compactProfanityCandidate || directProfanity) {
            return {
                censorScore: 5,
                sentimentScore: 0,
                taxonomy: "moderation_risk",
                censorSource: compactProfanityCandidate ? "compact_profanity" : "profanity"
            };
        }

        if (safePhrase.isSafe && !shouldReviewSafePhraseWithContext(recentMessages, message)) {
            return {
                censorScore: 0,
                sentimentScore: 0.5,
                taxonomy: inferLocalTaxonomy(message),
                censorSource: "safe_phrase"
            };
        }

        var lastError = null;
        for (var attempt = 1; attempt <= LLM_JSON_RETRY_LIMIT; attempt++) {
            try {
                var result = await callLLM(
                    message,
                    attempt === 1 ? recentMessages : [],
                    attempt === 1 ? compactCandidates : []
                );
                result.censorSource = attempt === 1 ? "llm" : "llm_retry";
                return result;
            } catch (error) {
                lastError = error;
                if (abortRequested || !isSplittableLLMError(error)) {
                    throw error;
                }
                if (attempt < LLM_JSON_RETRY_LIMIT) {
                    log("Retrying message " + message.id + " JSON attempt " + (attempt + 1) + "/" + LLM_JSON_RETRY_LIMIT + ": " + error.message);
                    await delay(250 * attempt);
                }
            }
        }

        throw lastError;
    }

    function isSplittableLLMError(error) {
        var message = String(error && error.message || "").toLowerCase();
        if (message.indexOf("llm request failed: http") !== -1) {
            return false;
        }
        return message.indexOf("json") !== -1 ||
            message.indexOf("unexpected token") !== -1 ||
            message.indexOf("did not include results") !== -1 ||
            message.indexOf("not a json object") !== -1 ||
            message.indexOf("missing valid sentiment") !== -1 ||
            message.indexOf("missing valid censor") !== -1 ||
            message.indexOf("context") !== -1 ||
            message.indexOf("token") !== -1 ||
            message.indexOf("too large") !== -1 ||
            message.indexOf("maximum") !== -1;
    }

    function isRetryableFetchError(error) {
        var message = String(error && error.message || "").toLowerCase();
        return message.indexOf("failed to fetch") !== -1 ||
            message.indexOf("networkerror") !== -1 ||
            message.indexOf("network error") !== -1 ||
            message.indexOf("failed to communicate") !== -1 ||
            message.indexOf("did not respond") !== -1 ||
            message.indexOf("message port") !== -1 ||
            message.indexOf("aborted") !== -1 ||
            message.indexOf("timeout") !== -1;
    }

    async function classifyMessageWithFetchRetries(messages, index) {
        var lastError = null;
        for (var attempt = 1; attempt <= LLM_FETCH_RETRY_LIMIT; attempt++) {
            try {
                return await classifyMessage(messages, index);
            } catch (error) {
                lastError = error;
                if (abortRequested || isHttpLLMError(error) || !isRetryableFetchError(error)) {
                    throw error;
                }
                if (attempt < LLM_FETCH_RETRY_LIMIT) {
                    var waitMs = 1000 * attempt;
                    log("Network retry for message " + messages[index].id + " attempt " + (attempt + 1) + "/" + LLM_FETCH_RETRY_LIMIT + " after " + waitMs + "ms: " + error.message);
                    await delay(waitMs);
                }
            }
        }
        throw lastError;
    }

    function buildRow(message, result) {
        result = result || {};
        return {
            message: message.message,
            name: message.name,
            source: message.source,
            time: message.time ? new Date(message.time).toISOString() : "",
            sentiment_score: Number.isFinite(Number(result.sentimentScore)) ? Number(result.sentimentScore).toFixed(6) : "",
            censor_score: Number.isFinite(Number(result.censorScore)) ? Number(result.censorScore).toFixed(2) : "0.00",
            taxonomy: normalizeLabel(result.taxonomy, TAXONOMIES, "other")
        };
    }

    function isHttpLLMError(error) {
        return String(error && error.message || "").toLowerCase().indexOf("llm request failed: http") !== -1;
    }

    function inferLocalTaxonomy(message) {
        var text = String(message && message.message || "").trim().toLowerCase();
        if (!text) return "other";
        if (text.indexOf("?") !== -1 || /^(who|what|when|where|why|how|can|could|should|is|are|do|does)\b/.test(text)) return "question";
        if (text.charAt(0) === "!") return "feature_request";
        if (/^(thanks|thank you|nice|great|awesome|good|love|congrats|gg)\b/.test(text)) return "positive_feedback";
        if (/\b(bad|terrible|awful|hate|sucks|annoying|wrong)\b/.test(text)) return "negative_feedback";
        if (/\b(bug|broken|crash|error|issue|doesn't work|not working|help)\b/.test(text)) return "support_issue";
        if (/\b(buy|sold|price|shipping|order|purchase|bid)\b/.test(text)) return "purchase_intent";
        return "other";
    }

    async function processConcurrent(messages, concurrentRequests, rows) {
        rows = rows || new Array(messages.length);
        rows.length = messages.length;
        var nextIndex = 0;
        var processed = 0;
        var failed = 0;

        async function worker() {
            while (!abortRequested) {
                var index = nextIndex++;
                if (index >= messages.length) {
                    return;
                }

                var message = messages[index];
                try {
                    var result = await classifyMessageWithFetchRetries(messages, index);
                    rows[index] = buildRow(message, result);
                } catch (error) {
                    if (abortRequested) {
                        return;
                    }
                    if (isHttpLLMError(error)) {
                        throw error;
                    }
                    failed++;
                    rows[index] = buildRow(message, { sentimentScore: 0.5, censorScore: 0, taxonomy: inferLocalTaxonomy(message), censorSource: "fallback" });
                    log("Message " + message.id + " fell back to local-only row: " + error.message);
                }
                processed++;

                if (processed === 1 || processed % 10 === 0 || processed === messages.length) {
                    setStatus("Processed " + processed + " of " + messages.length + "...");
                    log("Processed " + processed + " of " + messages.length + (failed ? " (" + failed + " fallback)." : "."));
                }
            }
        }

        var workers = [];
        var workerCount = Math.min(concurrentRequests, messages.length);
        for (var i = 0; i < workerCount; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);
        return rows.filter(Boolean);
    }

    function tsvValue(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/\t/g, " ")
            .replace(/\r?\n|\r/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function downloadTSV(rows, suffix) {
        var header = ["message", "name", "source", "time", "sentiment_score", "censor_score", "taxonomy"];
        var lines = [header.join("\t")];
        for (var i = 0; i < rows.length; i++) {
            lines.push([
                tsvValue(rows[i].message),
                tsvValue(rows[i].name),
                tsvValue(rows[i].source),
                tsvValue(rows[i].time),
                tsvValue(rows[i].sentiment_score),
                tsvValue(rows[i].censor_score),
                tsvValue(rows[i].taxonomy)
            ].join("\t"));
        }

        var tsv = "\ufeff" + lines.join("\r\n");
        var blob = new Blob([tsv], { type: "text/tab-separated-values;charset=utf-8" });
        var link = document.createElement("a");
        var stamp = new Date().toISOString().replace(/[:.]/g, "-");
        if (lastDownloadUrl) {
            URL.revokeObjectURL(lastDownloadUrl);
        }
        lastDownloadUrl = URL.createObjectURL(blob);
        link.href = lastDownloadUrl;
        link.download = "message_ai_export" + (suffix ? "_" + suffix : "") + "_" + stamp + ".tsv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        downloadLink.href = lastDownloadUrl;
        downloadLink.download = link.download;
        downloadLink.style.display = "inline";
        downloadLink.textContent = "Download last TSV";
    }

    async function runExport() {
        abortRequested = false;
        logEl.textContent = "";
        setRunning(true);

        var db = null;
        var rows = [];
        try {
            await initializeAnalysisLayers();

            setStatus("Opening message database...");
            db = await openMessageDB();

            setStatus("Loading messages...");
            var messages = await loadMessages(db);
            log("Loaded " + messages.length + " messages.");

            if (!messages.length) {
                setStatus("No messages found.");
                return;
            }

            var concurrentRequests = clampConcurrentRequests(batchSizeInput.value);
            setStatus("Processing with " + concurrentRequests + " concurrent requests...");
            log("Each LLM request contains one target message plus up to " + CONTEXT_MAX_MESSAGES + " context messages from the previous 30 seconds.");
            rows = new Array(messages.length);
            rows = await processConcurrent(messages, concurrentRequests, rows);

            if (abortRequested) {
                setStatus("Stopped.");
                if (rows.length) {
                    downloadTSV(rows, "partial");
                    log("Partial TSV downloaded: " + rows.length + " rows.");
                }
                return;
            }

            downloadTSV(rows);
            setStatus("Done. TSV downloaded.");
            log("Export complete: " + rows.length + " rows.");
        } catch (error) {
            var completedRows = rows.filter(Boolean);
            if (abortRequested) {
                setStatus("Stopped.");
                log("Stopped.");
                if (completedRows.length) {
                    downloadTSV(completedRows, "partial");
                    log("Partial TSV downloaded: " + completedRows.length + " rows.");
                }
            } else {
                setStatus("Error: " + error.message);
                log("Error: " + error.stack);
                if (completedRows.length) {
                    downloadTSV(completedRows, "partial");
                    log("Partial TSV downloaded after error: " + completedRows.length + " rows.");
                }
            }
        } finally {
            if (db) db.close();
            activeControllers = [];
            setRunning(false);
        }
    }

    timeframeInput.addEventListener("change", function () {
        var showCustom = timeframeInput.value === "custom";
        document.getElementById("custom-from").style.display = showCustom ? "flex" : "none";
        document.getElementById("custom-to").style.display = showCustom ? "flex" : "none";
    });

    startButton.addEventListener("click", runExport);
    stopButton.addEventListener("click", function () {
        abortRequested = true;
        activeControllers.forEach(function (controller) {
            controller.abort();
        });
        activeControllers = [];
    });

    document.getElementById("custom-from").style.display = "none";
    document.getElementById("custom-to").style.display = "none";
    loadLLMDefaults().then(function () {
        log("Loaded hosted LLM defaults.");
    });
})();
