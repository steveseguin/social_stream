const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const PAGE_ORIGIN = process.env.SSN_AI_STAGE_ORIGIN || 'https://beta.socialstream.ninja';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sendRuntimeMessage(page, message) {
  return page.evaluate((value) => new Promise((resolve) => chrome.runtime.sendMessage(value, resolve)), message);
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-ai-stage-live-'));
  let context;

  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`]
    });

    let workers = context.serviceWorkers();
    if (!workers.length) workers = [await context.waitForEvent('serviceworker', { timeout: 30000 })];
    const extensionId = new URL(workers[0].url()).hostname;
    const setupPage = await context.newPage();
    await setupPage.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });

    const requestedRoom = `ai-stage-live-${Date.now()}`;
    const label = `stage-${Math.random().toString(36).slice(2, 8)}`;
    const sessionState = await sendRuntimeMessage(setupPage, {
      cmd: 'sidUpdated',
      streamID: requestedRoom,
      password: false,
      state: true
    });
    const room = sessionState && sessionState.streamID;
    assert(room, 'Extension did not return its normalized session ID.');
    await setupPage.waitForTimeout(8000);

    const overlay = await context.newPage();
    const cohost = await context.newPage();
    const errors = [];
    for (const entry of [['overlay', overlay], ['cohost', cohost]]) {
      entry[1].on('pageerror', (error) => errors.push(`${entry[0]}: ${error.message}`));
    }

    await overlay.goto(`${PAGE_ORIGIN}/cohost-overlay.html?session=${encodeURIComponent(room)}&label=${encodeURIComponent(label)}&hideidle&status`, { waitUntil: 'domcontentloaded' });
    await cohost.goto(`${PAGE_ORIGIN}/cohost.html?session=${encodeURIComponent(room)}&aioverlay=${encodeURIComponent(label)}`, { waitUntil: 'domcontentloaded' });
    await overlay.waitForFunction(() => !!window.__aiStageOverlay);
    await cohost.waitForFunction(() => typeof sendCohostOverlayPayload === 'function');
    await cohost.evaluate(() => ensureConfiguredLLMBridge());
    await cohost.waitForTimeout(10000);

    const expected = `Extension-backed live OBS overlay ${label}`;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await cohost.evaluate(({ text, sequence }) => {
        sendCohostOverlayPayload({
          command: 'say',
          text,
          emotion: 'excited',
          talking: false,
          final: true,
          tts: false,
          sequence
        });
      }, { text: expected, sequence: attempt });
      try {
        await overlay.waitForFunction((text) => window.__aiStageOverlay.getState().text === text, expected, { timeout: 3000 });
        break;
      } catch (_error) {}
    }

    const state = await overlay.evaluate(() => ({
      overlay: window.__aiStageOverlay.getState(),
      interactiveElements: document.querySelectorAll('audio,video,input,button,select,textarea').length,
      background: getComputedStyle(document.body).backgroundColor
    }));
    assert(state.overlay.text === expected, 'Live extension-backed overlay did not receive the cohost command.');
    assert(state.overlay.lastPayload.target === label, 'Live extension-backed overlay received the wrong target.');
    assert(state.interactiveElements === 0, 'Live OBS overlay contains interactive or media-input elements.');
    assert(state.background === 'rgba(0, 0, 0, 0)', 'Live OBS overlay background is not transparent.');
    assert(errors.length === 0, `Live page errors: ${errors.join(' | ')}`);
    console.log(`PASS live extension-backed AI stage overlay e2e (${room}, ${label})`);
  } finally {
    if (context) await context.close();
    const resolvedProfile = path.resolve(profile);
    const resolvedTemp = path.resolve(os.tmpdir()) + path.sep;
    if (resolvedProfile.startsWith(resolvedTemp)) fs.rmSync(resolvedProfile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
