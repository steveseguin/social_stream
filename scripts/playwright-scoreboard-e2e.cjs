const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4181;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function sendOverlayPayload(page, payload) {
  await page.evaluate((data) => {
    window.postMessage({ dataReceived: { overlayNinja: data } }, '*');
  }, payload);
}

async function getScoreboardState(page) {
  return page.evaluate(() => ({
    title: document.getElementById('scoreboardTitle').textContent.trim(),
    subtitle: document.getElementById('scoreboardSubtitle').textContent.trim(),
    rows: Array.from(document.querySelectorAll('.score-row')).map((row) => row.textContent.trim()),
    bodyLayout: document.body.getAttribute('data-layout'),
    bodyTheme: document.body.getAttribute('data-theme'),
    empty: document.querySelector('.empty-state') ? document.querySelector('.empty-state').textContent.trim() : ''
  }));
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(`http://${HOST}:${PORT}/scoreboard.html?preview&layout=ticker&theme=neon&title=Points%20Race&maxusers=3&minpoints=5&animations&highlightchanges`, {
      waitUntil: 'domcontentloaded'
    });

    await sendOverlayPayload(page, {
      event: 'points_leaderboard',
      reason: 'admin',
      leaderboard: [
        { chatname: 'Ava', type: 'youtube', points: 82, available: 82, rank: 1, currentStreak: 3 },
        { chatname: 'Ben', type: 'twitch', points: 41, available: 41, rank: 2 },
        { chatname: 'Cy', type: 'kick', points: 11, available: 11, rank: 3 },
        { chatname: 'Low', type: 'tiktok', points: 2, available: 2, rank: 4 }
      ]
    });

    await page.waitForFunction(() => document.querySelectorAll('.score-row').length === 3, null, { timeout: 10000 });
    let state = await getScoreboardState(page);
    assert(state.title === 'Points Race', `Unexpected title: ${state.title}`);
    assert(state.bodyLayout === 'ticker', `Expected ticker layout, got ${state.bodyLayout}`);
    assert(state.bodyTheme === 'neon', `Expected neon theme, got ${state.bodyTheme}`);
    assert(state.rows.length === 3, `Expected 3 rows, got ${state.rows.length}`);
    assert(state.rows[0].includes('Ava') && state.rows[0].includes('82'), `Top row mismatch: ${state.rows[0]}`);
    assert(state.rows[1].includes('Ben') && state.rows[2].includes('Cy'), `Rows not rendered in score order: ${state.rows.join(' | ')}`);
    assert(!state.rows.join(' ').includes('Low'), 'Minimum points filter should hide Low');
    assert(/3 ranked viewers/i.test(state.subtitle), `Subtitle did not summarize rows: ${state.subtitle}`);

    await page.goto(`http://${HOST}:${PORT}/scoreboard.html?preview&chatpoints&donationpoints&customtriggers&hidepoints&layout=compact`, {
      waitUntil: 'domcontentloaded'
    });
    await sendOverlayPayload(page, { chatname: 'Jess', type: 'youtube', chatmessage: 'hello' });
    await sendOverlayPayload(page, { chatname: 'Jess', type: 'youtube', hasDonation: '$2.50' });
    await sendOverlayPayload(page, { chatname: 'Mika', type: 'twitch', meta: { score: 25 } });

    await page.waitForFunction(() => document.querySelectorAll('.score-row').length === 2, null, { timeout: 10000 });
    state = await getScoreboardState(page);
    assert(state.bodyLayout === 'compact', `Expected compact layout, got ${state.bodyLayout}`);
    assert(state.rows[0].includes('Jess'), `Donation fallback should put Jess first: ${state.rows.join(' | ')}`);
    assert(!/\b251\b/.test(state.rows[0]), `Hidden points should not be visible: ${state.rows[0]}`);
    assert(state.rows[1].includes('Mika'), `Custom fallback score missing: ${state.rows.join(' | ')}`);

    assert(pageErrors.length === 0, `Unexpected page errors: ${pageErrors.join(' | ')}`);
    await browser.close();
    console.log('PASS scoreboard e2e');
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
