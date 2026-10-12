const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notStrictEqual(start, -1, `Missing ${name}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  throw new Error(`Could not extract ${name}`);
}

const harnessSource = `
  var settings = {};
  var lastSentTimestamp = 0;
  var alreadyCaptured = [];
  const messageStore = {};
  function errorlog() {}

  ${extractFunction(backgroundSource, "normalizeMessageForTracking")}
  ${extractFunction(backgroundSource, "checkExactDuplicateAlreadyRelayed")}
  ${extractFunction(backgroundSource, "checkExactDuplicateAlreadyReceived")}
  ${extractFunction(backgroundSource, "sanitizeMessageForTracking")}

  window.reflectionHarness = {
    normalizeMessageForTracking,
    sanitizeMessageForTracking,
    reset(nextSettings = {}) {
      settings = nextSettings;
      lastSentTimestamp = Date.now();
      alreadyCaptured = [];
      Object.keys(messageStore).forEach(key => delete messageStore[key]);
    },
    setLastSentTimestamp(value) {
      lastSentTimestamp = value;
    },
    store(tabId, message, options = {}) {
      messageStore[tabId] = [{
        message: normalizeMessageForTracking(message, options.textonly === true),
        timestamp: options.timestamp || Date.now(),
        relayMode: options.relayMode !== false,
        origin: options.origin || "relay"
      }];
    },
    receive(tabId, message, type = "youtube", textonly = false) {
      return checkExactDuplicateAlreadyReceived(message, textonly, tabId, type);
    },
    alreadyRelayed(tabId, message, textonly = false) {
      return checkExactDuplicateAlreadyRelayed(message, textonly, tabId, false);
    },
    normalizedForStore(message, textonly = false) {
      return checkExactDuplicateAlreadyRelayed(message, textonly, false, true);
    }
  };
`;

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: harnessSource });

    const diamond = String.fromCodePoint(0x1f48e);
    const heartText = String.fromCodePoint(0x2764);
    const heartEmoji = heartText + String.fromCodePoint(0xfe0f);
    const familyEmoji = "👩‍👩‍👧‍👦";
    const skinToneEmoji = "👋🏽";
    const flagEmoji = "🇨🇦";

    const equivalentCases = [
      {
        name: "reported Twitch named emote",
        sent: "erallieLuv",
        received: '<img class="regular-emote" src="https://example.test/emote.png" alt="erallieLuv" title="erallieLuv">',
        expected: "erallieLuv"
      },
      {
        name: "colon shortcode emote",
        sent: "hello :wave:",
        received: 'hello <img src="https://example.test/wave.png" alt=":wave:">',
        expected: "hello :wave:"
      },
      {
        name: "title fallback when alt is absent",
        sent: "DanceParty",
        received: '<img src="https://example.test/dance.png" title="DanceParty">',
        expected: "DanceParty"
      },
      {
        name: "reported diamond image",
        sent: `nerbyfans on tiktok donated 1 ${diamond}. Thank you`,
        received: `nerbyfans on tiktok donated 1 <img src="https://example.test/diamond.png" alt="${diamond}">. Thank you`,
        expected: `nerbyfans on tiktok donated 1 ${diamond}. Thank you`
      },
      {
        name: "reported diamond with platform spacing",
        sent: `nerbyfans on tiktok donated 1 ${diamond}. Thank you`,
        received: `nerbyfans on tiktok donated 1 <img src="https://example.test/diamond.png" alt="${diamond}">&nbsp;. Thank you`,
        expected: `nerbyfans on tiktok donated 1 ${diamond}. Thank you`
      },
      {
        name: "multiple emotes",
        sent: "Wave Dance",
        received: '<span><img alt="Wave" src="wave.png"> <img alt="Dance" src="dance.png"></span>',
        expected: "Wave Dance"
      },
      {
        name: "zero-width emote composition",
        sent: "BaseSparkle",
        received: '<span class="emote-container"><img alt="Base" src="base.png"><img class="zero-width-emote" alt="Sparkle" src="sparkle.png"></span>',
        expected: "BaseSparkle"
      },
      {
        name: "HTML wrappers and entities",
        sent: "Tom & Jerry <3",
        received: "<span>Tom &amp; <strong>Jerry</strong> &lt;3</span>",
        expected: "Tom & Jerry <3"
      },
      {
        name: "mixed whitespace",
        sent: "hello world",
        received: "<span>hello\n\t  world</span>",
        expected: "hello world"
      },
      {
        name: "Unicode normalization",
        sent: "Café",
        received: "Cafe\u0301",
        expected: "Café"
      },
      {
        name: "emoji presentation selector",
        sent: `heart ${heartText}`,
        received: `heart ${heartEmoji}`,
        expected: `heart ${heartText}`
      },
      {
        name: "ZWJ family emoji",
        sent: `family ${familyEmoji}`,
        received: `family <img alt="${familyEmoji}" src="family.png">`,
        expected: `family ${familyEmoji}`
      },
      {
        name: "skin-tone emoji",
        sent: `hello ${skinToneEmoji}`,
        received: `hello <img alt="${skinToneEmoji}" src="wave.png">`,
        expected: `hello ${skinToneEmoji}`
      },
      {
        name: "flag emoji",
        sent: `Canada ${flagEmoji}`,
        received: `Canada <img alt="${flagEmoji}" src="flag.png">`,
        expected: `Canada ${flagEmoji}`
      },
      {
        name: "CJK text",
        sent: "こんにちは 世界",
        received: "<span>こんにちは&nbsp;世界</span>",
        expected: "こんにちは 世界"
      },
      {
        name: "Arabic text",
        sent: "مرحبا بالعالم",
        received: "<span>مرحبا&nbsp;بالعالم</span>",
        expected: "مرحبا بالعالم"
      }
    ];

    const equivalentResults = await page.evaluate(cases => {
      return cases.map(testCase => {
        const sent = window.reflectionHarness.normalizeMessageForTracking(testCase.sent, false);
        const received = window.reflectionHarness.normalizeMessageForTracking(testCase.received, false);
        return { name: testCase.name, sent, received };
      });
    }, equivalentCases);

    equivalentResults.forEach((result, index) => {
      assert.strictEqual(result.sent, equivalentCases[index].expected, `${result.name}: sent normalization`);
      assert.strictEqual(result.received, equivalentCases[index].expected, `${result.name}: received normalization`);
    });

    const distinctCases = [
      ["different named emotes", '<img alt="Wave" src="wave.png">', '<img alt="Dance" src="dance.png">'],
      ["different emoji", `gift ${diamond}`, `gift ${heartEmoji}`],
      ["case remains significant", "Hello", "hello"],
      ["intentional plain punctuation spacing", "version 1. 2", "version 1 . 2"],
      ["colon spacing remains significant", "label:value", "label :value"],
      ["unknown image does not disappear into adjacent text", "hello", 'hello<img src="unknown.png">'],
      ["different scripts", "hello", "こんにちは"]
    ];

    const distinctResults = await page.evaluate(cases => {
      return cases.map(([name, left, right]) => ({
        name,
        left: window.reflectionHarness.normalizeMessageForTracking(left, false),
        right: window.reflectionHarness.normalizeMessageForTracking(right, false)
      }));
    }, distinctCases);

    distinctResults.forEach(result => {
      assert.notStrictEqual(result.left, result.right, `${result.name}: messages must remain distinct`);
    });

    const textOnlyResults = await page.evaluate(() => ({
      tags: window.reflectionHarness.normalizeMessageForTracking("hello <b>world</b>", true),
      namedEmote: window.reflectionHarness.normalizeMessageForTracking('<img alt="erallieLuv" src="emote.png">', true),
      emojiImage: window.reflectionHarness.normalizeMessageForTracking('gift <img alt="💎" src="diamond.png">', true),
      lessThan: window.reflectionHarness.normalizeMessageForTracking("2 < 3", true),
      whitespace: window.reflectionHarness.normalizeMessageForTracking("one\n\t two", true),
      nullValue: window.reflectionHarness.normalizeMessageForTracking(null, true),
      numericValue: window.reflectionHarness.normalizeMessageForTracking(42, true)
    }));

    assert.deepStrictEqual(textOnlyResults, {
      tags: "hello <b>world</b>",
      namedEmote: '<img alt="erallieLuv" src="emote.png">',
      emojiImage: 'gift <img alt="💎" src="diamond.png">',
      lessThan: "2 < 3",
      whitespace: "one two",
      nullValue: "",
      numericValue: "42"
    });

    const reportedEmoteSequence = await page.evaluate(() => {
      window.reflectionHarness.reset({ firstsourceonly: true });
      window.reflectionHarness.store(101, "erallieLuv");
      window.reflectionHarness.store(202, "erallieLuv");
      return {
        twitch: window.reflectionHarness.receive(101, '<img alt="erallieLuv" src="emote.png">', "twitch"),
        youtube: window.reflectionHarness.receive(202, "erallieLuv", "youtube")
      };
    });

    assert.strictEqual(reportedEmoteSequence.twitch, null, "the rich Twitch emote should be the first allowed reflection");
    assert.strictEqual(reportedEmoteSequence.youtube, true, "the returned YouTube emote text should be suppressed");

    const reportedDiamondSequence = await page.evaluate(diamondValue => {
      const sent = `nerbyfans on tiktok donated 1 ${diamondValue}. Thank you`;
      window.reflectionHarness.reset({ firstsourceonly: true });
      window.reflectionHarness.store(101, sent);
      window.reflectionHarness.store(202, sent);
      return {
        twitch: window.reflectionHarness.receive(101, `nerbyfans on tiktok donated 1 <img alt="${diamondValue}" src="diamond.png"> . Thank you`, "twitch"),
        youtube: window.reflectionHarness.receive(202, sent, "youtube")
      };
    }, diamond);

    assert.strictEqual(reportedDiamondSequence.twitch, null, "the rich diamond should be the first allowed reflection");
    assert.strictEqual(reportedDiamondSequence.youtube, true, "the returned YouTube diamond message should be suppressed");

    const policyResults = await page.evaluate(() => {
      window.reflectionHarness.reset({ hideallreplies: true });
      window.reflectionHarness.store(1, "Wave");
      const hideAll = window.reflectionHarness.receive(1, '<img alt="Wave" src="wave.png">', "twitch");

      window.reflectionHarness.reset({ thissourceonly: true, thissourceonlytype: { optionsetting: "twitch" } });
      window.reflectionHarness.store(1, "Wave");
      window.reflectionHarness.store(2, "Wave");
      const wrongSource = window.reflectionHarness.receive(2, "Wave", "youtube");
      const selectedSource = window.reflectionHarness.receive(1, '<img alt="Wave" src="wave.png">', "twitch");

      window.reflectionHarness.reset({});
      window.reflectionHarness.store(1, "Wave", { relayMode: true });
      const relayed = window.reflectionHarness.alreadyRelayed(1, '<img alt="Wave" src="wave.png">');
      window.reflectionHarness.store(2, "Wave", { relayMode: false });
      const notRelayMode = window.reflectionHarness.alreadyRelayed(2, '<img alt="Wave" src="wave.png">');

      window.reflectionHarness.reset({ hideallreplies: true });
      window.reflectionHarness.store(1, "Wave");
      window.reflectionHarness.setLastSentTimestamp(Date.now() - 10001);
      const outsideWindow = window.reflectionHarness.receive(1, '<img alt="Wave" src="wave.png">', "twitch");

      window.reflectionHarness.reset({ hideallreplies: true });
      window.reflectionHarness.store(1, "Wave", { timestamp: Date.now() - 10001 });
      const staleStoreEntry = window.reflectionHarness.receive(1, '<img alt="Wave" src="wave.png">', "twitch");

      window.reflectionHarness.reset({ hideallreplies: true });
      window.reflectionHarness.store(1, "Wave");
      const otherTab = window.reflectionHarness.receive(2, '<img alt="Wave" src="wave.png">', "twitch");

      return { hideAll, wrongSource, selectedSource, relayed, notRelayMode, outsideWindow, staleStoreEntry, otherTab };
    });

    assert.deepStrictEqual(policyResults, {
      hideAll: true,
      wrongSource: true,
      selectedSource: null,
      relayed: true,
      notRelayMode: false,
      outsideWindow: false,
      staleStoreEntry: false,
      otherTab: false
    });

    const sharedNormalizerResults = await page.evaluate(() => {
      const rich = '<span>Hello <img alt=":wave:" src="wave.png"></span>';
      return {
        direct: window.reflectionHarness.normalizeMessageForTracking(rich, false),
        originLookup: window.reflectionHarness.sanitizeMessageForTracking(rich, false),
        stored: window.reflectionHarness.normalizedForStore(rich, false)
      };
    });

    assert.deepStrictEqual(sharedNormalizerResults, {
      direct: "Hello :wave:",
      originLookup: "Hello :wave:",
      stored: "Hello :wave:"
    });

    console.log(`Reflection normalization tests passed (${equivalentCases.length} equivalent cases, ${distinctCases.length} distinct cases, and relay policy coverage).`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
