(function() {
    const dockInput = document.getElementById("dockUrl");
    const output = document.getElementById("output");
    const summary = document.getElementById("summary");
    const errorBox = document.getElementById("error");
    const downloadBtn = document.getElementById("downloadBtn");
    const copyBtn = document.getElementById("copyBtn");

    const SKIP_KEYS = ["session", "password", "pass", "pw", "v"];
    const NUMBER_KEYS = new Set([
        "scale","opacity","chromaalpha","showtime","delaytime","beepvolume","autoshowtime","volume","rate","pitch",
        "kokorospeed","kittenspeed","elevenrate","elevenlatency","elevenstability","elevensimilarity","elevenstyle",
        "elevenspeakerboost","googlerate","googlepitch","speechifyspeed","openaispeed","limit","hideshortmessages",
        "padding","trimname","elevenrate","elevenlatency","elevenstability","elevensimilarity","elevenstyle","elevenspeakerboost",
        "latency","queuetime","chartime","trim"
    ]);
    const EQUALS_PARAMS = new Set([
        "chroma=fff","skipmessages=3","exclude=kick","exclude=kofi","exclude=youtube","limitbadges=2","chartime=100","trim=200"
    ]);

    function normalizeUrl(raw) {
        if (!raw) return null;
        const trimmed = raw.trim();
        if (!trimmed) return null;

        // Allow users to paste just the query portion
        if (trimmed.startsWith("session=") || trimmed.startsWith("?session=")) {
            return new URL("https://socialstream.ninja/dock.html" + (trimmed.startsWith("?") ? trimmed : "?" + trimmed));
        }

        try {
            return new URL(trimmed);
        } catch (e) {
            // If no protocol was provided, try https by default
            try {
                return new URL("https://" + trimmed);
            } catch (err) {
                return null;
            }
        }
    }

    function deriveStreamId(params) {
        return params.get("session") || params.get("room") || params.get("push") || params.get("view") || params.get("label") || "";
    }

    function derivePassword(params) {
        return params.get("password") || params.get("pass") || params.get("pw") || "";
    }

    function buildSettingsFromUrl(urlObj) {
        const params = urlObj.searchParams;
        const streamID = deriveStreamId(params);
        const password = derivePassword(params);

        const extras = new URLSearchParams();
        let extrasString = "";
        const settings = {};

        params.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            if (SKIP_KEYS.includes(lowerKey)) return;
            extras.append(key, value);
            extrasString = extras.toString();

            const combined = value ? `${key}=${value}` : key;
            const entryKey = EQUALS_PARAMS.has(combined) ? combined : key;
            const entry = settings[entryKey] || {};

            entry.param1 = true;

            if (value !== null && value !== "") {
                const isNumberKey = NUMBER_KEYS.has(lowerKey);
                const numeric = !isNaN(parseFloat(value));
                if (isNumberKey || numeric) {
                    entry.numbersetting = String(value);
                } else if (value === "true" || value === "false") {
                    entry.setting = value === "true";
                } else {
                    entry.textparam1 = value;
                }
            }

            settings[entryKey] = entry;
        });

        const urlParamsString = extrasString ? "?" + extrasString : "";

        return {
            streamID,
            password,
            settings,
            extrasString: urlParamsString,
            rawDockUrl: urlObj.href
        };
    }

    function renderSummary(payload) {
        summary.innerHTML = "";
        const parts = [
            { label: "Stream ID", value: payload.streamID || "Not found" },
            { label: "Password", value: payload.password ? "••••••" : "None" },
            { label: "Extra params", value: payload.extrasString || "None" },
            { label: "Settings entries", value: Object.keys(payload.settings).length }
        ];
        parts.forEach(part => {
            const pill = document.createElement("div");
            pill.className = "pill";
            const strong = document.createElement("strong");
            strong.textContent = part.label + ":";
            const valueSpan = document.createElement("span");
            valueSpan.className = "pill-value";
            valueSpan.textContent = " " + part.value;
            pill.appendChild(strong);
            pill.appendChild(valueSpan);
            summary.appendChild(pill);
        });
    }

    function setError(msg) {
        errorBox.textContent = msg || "";
        if (msg) {
            output.value = "";
            summary.innerHTML = "";
            downloadBtn.disabled = true;
            copyBtn.disabled = true;
        }
    }

    function generate() {
        setError("");
        const urlObj = normalizeUrl(dockInput.value);
        if (!urlObj) {
            setError("Please enter a valid dock.html URL (or query string).");
            return;
        }

        const payload = buildSettingsFromUrl(urlObj);
        if (!payload.streamID) {
            setError("No session/stream ID found in that URL.");
            return;
        }

        const exportObj = {
            streamID: payload.streamID,
            state: true,
            settings: payload.settings
        };
        if (payload.password) {
            exportObj.password = payload.password;
        }

        const json = JSON.stringify(exportObj, null, 2);
        output.value = json;
        renderSummary(payload);
        downloadBtn.disabled = false;
        copyBtn.disabled = false;
    }

    function downloadFile() {
        if (!output.value) return;
        const blob = new Blob([output.value], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "socialstream-settings.data";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function copyJson() {
        if (!output.value) return;
        try {
            await navigator.clipboard.writeText(output.value);
            copyBtn.textContent = "Copied";
            setTimeout(() => { copyBtn.textContent = "Copy JSON"; }, 900);
        } catch (e) {
            setError("Could not copy to clipboard. Copy manually from the text area.");
        }
    }

    document.getElementById("generateBtn").addEventListener("click", generate);
    dockInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            generate();
        }
    });
    downloadBtn.addEventListener("click", downloadFile);
    copyBtn.addEventListener("click", copyJson);
})();
