const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

(async () => {
  const corpus = JSON.parse(readText("tests/fixtures/xss-corpus.json"));
  const payloadCorpus = JSON.parse(readText("tests/fixtures/xss-payload-corpus.json"));
  const xssSource = readText("thirdparty/xss.min.js");
  const objectsSource = readText("libs/objects.js");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body><div id=\"sink\"></div></body></html>");
  await page.addScriptTag({ content: xssSource });
  await page.addScriptTag({ content: objectsSource });

  const results = await page.evaluate(async (items) => {
    const sink = document.getElementById("sink");
    window.__xssHit = false;
    window.alert = window.confirm = window.prompt = function () {
      window.__xssHit = true;
    };
    window.__markXss = function () {
      window.__xssHit = true;
    };

    const failures = [];
    const forbiddenTags = new Set(["script", "style", "iframe", "object", "embed", "math", "form", "input", "textarea", "link", "meta", "foreignobject", "animate", "set", "use", "image"]);

    function inspectOutput(html) {
      sink.innerHTML = html;
      const nodes = Array.from(sink.querySelectorAll("*"));
      for (const node of nodes) {
        const tag = node.tagName.toLowerCase();
        if (forbiddenTags.has(tag)) {
          return "forbidden tag survived: " + tag;
        }
        for (const attr of Array.from(node.attributes)) {
          const name = attr.name.toLowerCase();
          const value = attr.value || "";
          if (name.startsWith("on") || name === "style" || name === "srcdoc") {
            return "forbidden attribute survived: " + name;
          }
          if ((name === "href" || name === "src" || name === "xlink:href") && /^\s*(?:javascript|vbscript|data:text\/html)/i.test(value)) {
            return "dangerous URL survived: " + name + "=" + value;
          }
          if (name === "srcset" && /(?:javascript|vbscript|data:text\/html)/i.test(value)) {
            return "dangerous srcset survived: " + value;
          }
          if ((name === "fill" || name === "stroke") && /url\(\s*(?:javascript|data:|https?:)/i.test(value)) {
            return "dangerous SVG paint survived: " + name + "=" + value;
          }
        }
      }
      return "";
    }

    for (const item of items) {
      window.__xssHit = false;
      sink.innerHTML = "";
      let output = "";
      try {
        output = filterXSS(item.input);
      } catch (error) {
        failures.push({ name: item.name, reason: "filterXSS threw: " + error.message });
        continue;
      }

      const structuralError = inspectOutput(output);
      if (structuralError) {
        failures.push({ name: item.name, reason: structuralError, output });
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
      if (window.__xssHit) {
        failures.push({ name: item.name, reason: "payload executed", output });
        continue;
      }

      if (item.mustContain) {
        for (const expected of item.mustContain) {
          if (!output.includes(expected)) {
            failures.push({ name: item.name, reason: "missing expected safe content: " + expected, output });
            break;
          }
        }
      }
    }

    return failures;
  }, corpus);

  const payloadResults = await page.evaluate(async (items) => {
    const sink = document.getElementById("sink");
    window.__xssHit = false;
    window.alert = window.confirm = window.prompt = function () {
      window.__xssHit = true;
    };

    const failures = [];
    const forbiddenTags = new Set(["script", "style", "iframe", "object", "embed", "math", "form", "input", "textarea", "link", "meta", "foreignobject"]);

    function renderPayload(payload) {
      let html = "";
      if (payload.chatimg) html += "<img class='avatar' src='" + payload.chatimg + "'>";
      if (payload.backupChatimg) html += "<img class='avatar' data-backup-image='" + payload.backupChatimg + "'>";
      if (payload.sourceImg) html += "<img class='source' src='" + payload.sourceImg + "'>";
      if (payload.contentimg) html += "<img class='content' src='" + payload.contentimg + "'>";
      if (payload.nameColor) html += "<span style='color:" + payload.nameColor + "'>name</span>";
      if (payload.textColor || payload.backgroundColor) html += "<span style='background-color:" + (payload.backgroundColor || "transparent") + ";color:" + (payload.textColor || "inherit") + "'>message</span>";
      if (payload.highlightColor) html += "<span style='background-color:" + payload.highlightColor + "'>highlight</span>";
      if (payload.backgroundNameColor || payload.textNameColor) html += "<span style='" + (payload.backgroundNameColor || "") + (payload.textNameColor || "") + "'>styled name</span>";
      if (payload.title) html += "<div class='donation-title'>" + payload.title + "</div>";
      if (payload.hasDonation) html += "<span class='donationAmount hl-donation'>" + payload.hasDonation + "</span>";
      if (payload.donation) html += "<span class='donationAmount hl-donation'>" + payload.donation + "</span>";
      if (payload.membership) html += "<div class='donation membership'>" + payload.membership + "</div>";
      if (payload.hasMembership && payload.hasMembership !== true) html += "<div class='donation membership'>" + payload.hasMembership + "</div>";
      if (payload.subtitle) html += "<div class='subtitle'>" + payload.subtitle + "</div>";
      if (typeof payload.chatbadges === "string") {
        html += payload.chatbadges;
      } else if (Array.isArray(payload.chatbadges)) {
        for (const badge of payload.chatbadges) {
          if (typeof badge === "string") {
            html += "<img class='hl-badge' src='" + badge + "'>";
          } else if (badge && badge.type === "img") {
            html += "<img class='hl-badge' src='" + badge.src + "'" + (badge.bgcolor ? " style='background-color:" + badge.bgcolor + "'" : "") + ">";
          } else if (badge && badge.type === "svg") {
            html += "<span class='hl-badge svg'>" + badge.html + "</span>";
          } else if (badge && badge.type === "text") {
            html += "<span class='hl-badge textbadge'>" + badge.text + "</span>";
          }
        }
      }
      return html;
    }

    function inspectPayloadOutput(html) {
      sink.innerHTML = html;
      const nodes = Array.from(sink.querySelectorAll("*"));
      for (const node of nodes) {
        const tag = node.tagName.toLowerCase();
        if (forbiddenTags.has(tag)) {
          return "forbidden tag survived: " + tag;
        }
        for (const attr of Array.from(node.attributes)) {
          const name = attr.name.toLowerCase();
          const value = attr.value || "";
          if (name.startsWith("on") || name === "srcdoc") {
            return "forbidden attribute survived: " + name;
          }
          if ((name === "href" || name === "src" || name === "data-backup-image") && /^\s*(?:javascript|vbscript|data:text\/html)/i.test(value)) {
            return "dangerous URL survived: " + name + "=" + value;
          }
          if (name === "style" && /(?:javascript|expression|url\s*\()/i.test(value)) {
            return "dangerous style survived: " + value;
          }
        }
      }
      return "";
    }

    for (const item of items) {
      window.__xssHit = false;
      sink.innerHTML = "";
      let output;
      try {
        output = sanitizeRelayPayloadFields(JSON.parse(JSON.stringify(item.input)));
      } catch (error) {
        failures.push({ name: item.name, reason: "sanitizeRelayPayloadFields threw: " + error.message });
        continue;
      }

      if (item.fields) {
        for (const [field, expected] of Object.entries(item.fields)) {
          if ((output[field] || "") !== expected) {
            failures.push({ name: item.name, reason: "unexpected " + field + ": " + output[field], output });
            break;
          }
        }
      }

      if (item.badgesLength !== undefined) {
        const actualLength = Array.isArray(output.chatbadges) ? output.chatbadges.length : 0;
        if (actualLength !== item.badgesLength) {
          failures.push({ name: item.name, reason: "unexpected badge count: " + actualLength, output });
          continue;
        }
      }

      const serialized = JSON.stringify(output);
      if (item.mustContain) {
        for (const expected of item.mustContain) {
          if (!serialized.includes(expected)) {
            failures.push({ name: item.name, reason: "missing expected safe content: " + expected, output });
            break;
          }
        }
      }
      if (item.mustNotContain) {
        for (const forbidden of item.mustNotContain) {
          if (serialized.toLowerCase().includes(forbidden.toLowerCase())) {
            failures.push({ name: item.name, reason: "unsafe content survived: " + forbidden, output });
            break;
          }
        }
      }

      const structuralError = inspectPayloadOutput(renderPayload(output));
      if (structuralError) {
        failures.push({ name: item.name, reason: structuralError, output });
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
      if (window.__xssHit) {
        failures.push({ name: item.name, reason: "payload executed", output });
      }
    }

    return failures;
  }, payloadCorpus);

  await browser.close();
  assert.deepStrictEqual(results.concat(payloadResults), []);
  console.log(`XSS sanitizer corpus passed (${corpus.length} HTML cases, ${payloadCorpus.length} payload cases).`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
