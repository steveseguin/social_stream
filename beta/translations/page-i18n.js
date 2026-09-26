(function (global) {
	"use strict";

	var scriptUrl = document.currentScript && document.currentScript.src
		? document.currentScript.src
		: new URL("./page-i18n.js", document.baseURI).href;
	var defaultContent = new Map();
	var currentLanguage = "en-us";
	var currentTranslation = { innerHTML: {} };
	var requestId = 0;

	function normalizeLanguage(value) {
		var lower = String(value || "").trim().toLowerCase();
		if (!lower) return "en-us";
		if (lower === "test") return "test";
		if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans") return "zh-CN";
		if (lower === "zh-tw" || lower === "zh-hk" || lower === "zh-hant") return "zh-TW";
		if (lower === "en-gb" || lower === "en-uk") return "en-uk";
		if (lower === "en" || lower.indexOf("en-") === 0) return "en-us";
		if (lower.indexOf("pt") === 0) return "pt-br";
		if (lower.indexOf("ar") === 0) return "ar";
		if (lower.indexOf("es") === 0) return "es";
		if (lower.indexOf("fr") === 0) return "fr";
		if (lower.indexOf("de") === 0) return "de";
		if (lower.indexOf("cs") === 0) return "cs";
		if (lower.indexOf("th") === 0) return "th";
		if (lower.indexOf("tr") === 0) return "tr";
		if (lower.indexOf("uk") === 0) return "uk";
		return "en-us";
	}

	function languageFromLocation() {
		try {
			var params = new URLSearchParams(global.location.search);
			return normalizeLanguage(params.get("ln") || params.get("lang") || params.get("language"));
		} catch (_) {
			return "en-us";
		}
	}

	function rememberDefault(element, attribute) {
		if (!defaultContent.has(element)) defaultContent.set(element, {});
		var defaults = defaultContent.get(element);
		if (!(attribute in defaults)) {
			defaults[attribute] = attribute === "innerHTML" ? element.innerHTML : element.getAttribute(attribute) || "";
		}
		return defaults[attribute];
	}

	function lookup(key, fallback, values) {
		var entries = currentTranslation && currentTranslation.innerHTML ? currentTranslation.innerHTML : {};
		var value = Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : fallback;
		return String(value == null ? "" : value).replace(/\{(\w+)\}/g, function (_match, name) {
			return values && Object.prototype.hasOwnProperty.call(values, name) ? values[name] : "{" + name + "}";
		});
	}

	function apply(root) {
		root = root || document;
		root.querySelectorAll("[data-page-translate]").forEach(function (element) {
			var fallback = rememberDefault(element, "innerHTML");
			element.innerHTML = lookup(element.dataset.pageTranslate, fallback);
		});
		root.querySelectorAll("[data-page-title]").forEach(function (element) {
			var fallback = rememberDefault(element, "title");
			element.title = lookup(element.dataset.pageTitle, fallback);
		});
		root.querySelectorAll("[data-page-alt]").forEach(function (element) {
			var fallback = rememberDefault(element, "alt");
			element.alt = lookup(element.dataset.pageAlt, fallback);
		});
		document.documentElement.lang = currentLanguage;
		document.documentElement.dir = currentLanguage === "ar" ? "rtl" : "ltr";
	}

	async function setLanguage(value) {
		var normalized = normalizeLanguage(value);
		var activeRequest = ++requestId;
		var response;
		try {
			response = await fetch(new URL(encodeURIComponent(normalized) + ".json", scriptUrl).href, { cache: "no-store" });
			if (!response.ok) throw new Error("Translation request failed: " + response.status);
			var data = await response.json();
			if (activeRequest !== requestId) return;
			currentLanguage = normalized;
			currentTranslation = data || { innerHTML: {} };
		} catch (error) {
			console.warn("[Translations] Unable to load " + normalized, error && error.message ? error.message : error);
			if (activeRequest !== requestId) return;
			currentLanguage = "en-us";
			currentTranslation = { innerHTML: {} };
		}
		apply(document);
		global.dispatchEvent(new CustomEvent("ssn-page-language-changed", { detail: { language: currentLanguage } }));
	}

	global.SSNPageI18n = {
		apply: apply,
		getLanguage: function () { return currentLanguage; },
		normalizeLanguage: normalizeLanguage,
		setLanguage: setLanguage,
		t: lookup
	};

	global.addEventListener("message", function (event) {
		var data = event && event.data;
		if (!data || (data.type !== "changeLanguage" && data.action !== "changeLanguage")) return;
		setLanguage(data.language || data.lang || data.value);
	});

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () { setLanguage(languageFromLocation()); }, { once: true });
	} else {
		setLanguage(languageFromLocation());
	}
})(window);
