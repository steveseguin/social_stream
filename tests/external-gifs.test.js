const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const start = background.indexOf("function getExternalGifUrl(");
const giphyStart = background.indexOf("async function applyGiphyToMessage(", start);
assert.ok(start >= 0 && giphyStart > start, "GIF message handlers must be present");
const gifSource = background.slice(start, background.indexOf("\n}", giphyStart) + 2);

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const networkRequests = [];
        await page.route("**/*", route => {
            networkRequests.push(route.request().url());
            return route.abort();
        });
        await page.setContent("<!doctype html><html><body></body></html>");
        await page.addScriptTag({ content: fs.readFileSync(path.join(root, "libs/objects.js"), "utf8") });
        await page.addScriptTag({ content: gifSource });

        const results = await page.evaluate(async () => {
            const slinky = "https://gifs.kreative-kompas.com/image/d95394e0-079d-4dc4-b9b7-f0e7fc496eb2.gif";
            const klipy = "https://static2.klipy.com/ii/a15b48460c436e1e92c85ffc680932cc/18/44/n1D0slCD.gif";
            const gif = "https://example.com/hello.gif";
            const apiCalls = [];
            window.fetch = async url => {
                apiCalls.push(url);
                return { ok: true, json: async () => ({ data: [{ images: { downsized_large: { url: "https://media.giphy.com/result.gif" } } }] }) };
            };
            window.__gifScriptExecuted = false;
            const cases = [
                { name: "Slinky without an API key", message: slinky, expected: slinky },
                { name: "Klipy without an API key", message: klipy, expected: klipy },
                { name: "HTTP host", message: "http://example.com/a.gif", expected: "http://example.com/a.gif" },
                { name: "uppercase extension and query", message: "HTTPS://EXAMPLE.COM/a.GIF?token=a%2Bb&size=2#frame", expected: "https://example.com/a.GIF?token=a%2Bb&size=2#frame" },
                { name: "query punctuation preserved", message: gif + "?token=abc!", expected: gif + "?token=abc!" },
                { name: "surrounding text and punctuation", message: "Look at (" + gif + ").", expected: gif },
                { name: "quoted URL", message: "Look: “" + gif + "”", expected: gif },
                { name: "first matching link", message: "https://example.com/page " + slinky + " " + klipy, expected: slinky },
                { name: "plain URL in HTML message", message: "Look: " + gif, textonly: false, expected: gif },
                { name: "HTML anchor with a shortened label", message: '<a href="' + slinky + '">gifs.kreative-kompas.com/...</a>', textonly: false, expected: slinky },
                { name: "HTML entities in anchor query", message: '<a href="' + gif + '?a=1&amp;b=2">GIF</a>', textonly: false, expected: gif + "?a=1&b=2" },
                { name: "HTML entities in visible text", message: gif + "?a=1&amp;b=2", textonly: false, expected: gif + "?a=1&b=2" },
                { name: "document order across text and anchors", message: slinky + ' <a href="' + klipy + '">GIF</a>', textonly: false, expected: slinky },
                { name: "disabled by default", message: gif, settings: {}, expected: "" },
                { name: "explicitly disabled", message: gif, settings: { allowExternalGifs: false }, expected: "" },
                { name: "content images disabled", message: gif, settings: { allowExternalGifs: true, removeContentImage: true }, expected: "" },
                { name: "existing attachment preserved", message: gif, contentimg: "https://example.com/existing.png", expected: "https://example.com/existing.png" },
                { name: "empty message", message: "", expected: "" },
                { name: "missing message", message: null, expected: "" },
                { name: "sharing page", message: "https://klipy.com/gifs/hello", expected: "" },
                { name: "non-GIF file", message: "https://example.com/a.png", expected: "" },
                { name: "GIF only in query", message: "https://example.com/view?file=a.gif", expected: "" },
                { name: "GIF only in fragment", message: "https://example.com/page#a.gif", expected: "" },
                { name: "GIF only in hostname", message: "https://example.gif", expected: "" },
                { name: "GIF directory", message: "https://example.com/a.gif/", expected: "" },
                { name: "double file extension", message: "https://example.com/a.gif.html", expected: "" },
                { name: "relative URL", message: "/a.gif", expected: "" },
                { name: "unsupported scheme", message: "file:///a.gif", expected: "" },
                { name: "URL credentials", message: "https://user:pass@example.com/a.gif", expected: "" },
                { name: "overlong URL", message: "https://example.com/" + "a".repeat(2050) + ".gif", expected: "" },
                { name: "invalid host", message: "https://[invalid]/a.gif", expected: "" },
                { name: "inline image is not a posted link", message: '<img src="' + gif + '" onerror="window.__gifScriptExecuted=true">', textonly: false, expected: "" },
                { name: "script stays inert and is ignored", message: '<script>window.__gifScriptExecuted=true; // ' + gif + '</script>', textonly: false, expected: "" },
                { name: "HTML comments are ignored", message: '<!-- ' + gif + ' -->', textonly: false, expected: "" },
                { name: "unsafe anchor", message: '<a href="javascript:alert(1)">GIF</a>', textonly: false, expected: "" },
                { name: "attribute injection is rejected", message: '<a href="' + gif + '?x=&quot; onerror=&quot;alert(1)">GIF</a>', textonly: false, expected: "" }
            ];
            const outcomes = [];
            for (const item of cases) {
                const data = { chatname: "Viewer", chatmessage: item.message, type: "youtube", textonly: item.textonly !== false, contentimg: item.contentimg || "", meta: { messageId: "native-id" } };
                const before = JSON.stringify(data);
                const settings = item.settings || { allowExternalGifs: true };
                applyExternalGifToMessage(data, settings);
                await applyGiphyToMessage(data, settings);
                const image = data.contentimg;
                data.contentimg = item.contentimg || "";
                outcomes.push({ name: item.name, expected: item.expected, actual: image, preserved: JSON.stringify(data) === before });
            }
            const externalApiCalls = apiCalls.length;
            const giphyCases = [
                { message: "!giphy happy cat", settings: { giphy: true }, endpoint: "gifs", query: "happy cat" },
                { message: "!tenor happy cat", settings: { tenor: true }, endpoint: "gifs", query: "happy cat" },
                { message: "#happy-cat", settings: { giphy2: true }, endpoint: "gifs", query: "happy cat" },
                { message: "##happy-cat", settings: { giphy2: true }, endpoint: "stickers", query: "happy cat" }
            ];
            const giphyOutcomes = [];
            for (const item of giphyCases) {
                const data = { chatmessage: item.message, textonly: true };
                const settings = Object.assign({ allowExternalGifs: true, giphyKey: { textsetting: "test-key" } }, item.settings);
                applyExternalGifToMessage(data, settings);
                await applyGiphyToMessage(data, settings);
                const request = new URL(apiCalls[apiCalls.length - 1]);
                giphyOutcomes.push({ message: item.message, image: data.contentimg, preserved: data.chatmessage === item.message,
                    correctRequest: request.pathname === "/v1/" + item.endpoint + "/search" && request.searchParams.get("q") === item.query && request.searchParams.get("api_key") === "test-key" && request.searchParams.get("rating") === "g" });
            }
            const direct = { chatmessage: "!giphy " + slinky, textonly: true };
            const directSettings = { allowExternalGifs: true, giphy: true, hidegiphytrigger: true, giphyKey: { textsetting: "test-key" } };
            const callsBefore = apiCalls.length;
            applyExternalGifToMessage(direct, directSettings);
            await applyGiphyToMessage(direct, directSettings);
            const hideLink = { chatmessage: slinky, textonly: true, meta: { messageId: "preserved" } };
            applyExternalGifToMessage(hideLink, { allowExternalGifs: true, hideExternalGifUrl: true });
            const legacyMeta = { chatmessage: slinky, textonly: true, meta: 12 };
            applyExternalGifToMessage(legacyMeta, { allowExternalGifs: true, hideExternalGifUrl: true });
            return { outcomes, externalApiCalls, giphyOutcomes, scriptExecuted: window.__gifScriptExecuted,
                hideLinkFlag: hideLink.meta.hideExternalGifUrl === true && hideLink.meta.messageId === "preserved" && hideLink.chatmessage === slinky,
                legacyMetaPreserved: legacyMeta.meta === 12 && legacyMeta.contentimg === slinky,
                directPreserved: direct.contentimg === slinky && direct.chatmessage === "!giphy " + slinky && apiCalls.length === callsBefore };
        });

        for (const result of results.outcomes) {
            assert.equal(result.actual, result.expected, result.name);
            assert.equal(result.preserved, true, result.name + ": existing message fields must be preserved");
        }
        assert.equal(results.externalApiCalls, 0, "Direct GIF detection must not require an API or fetch remote data");
        assert.equal(results.scriptExecuted, false, "Parsing source HTML must not execute scripts");
        assert.deepEqual(networkRequests, [], "Parsing source HTML must not load embedded resources");
        for (const result of results.giphyOutcomes) {
            assert.equal(result.image, "https://media.giphy.com/result.gif", result.message);
            assert.equal(result.preserved, true, result.message);
            assert.equal(result.correctRequest, true, result.message);
        }
        assert.equal(results.directPreserved, true, "GIPHY processing must preserve a detected external GIF and its fallback text");
        assert.equal(results.hideLinkFlag, true, "Link hiding must be a render hint; preserve the message and existing metadata");
        assert.equal(results.legacyMetaPreserved, true, "Do not replace legacy scalar metadata to add a rendering preference");
        console.log("PASS: " + results.outcomes.length + " external GIF cases and existing GIPHY commands.");
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
