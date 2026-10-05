const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const repoRoot = path.resolve(__dirname, '..');
const sdkPath = path.join(repoRoot, 'thirdparty', 'vdoninja-sdk.js');
const bridgePath = path.join(repoRoot, 'js', 'ninja-transport.js');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const publisher = await context.newPage();
  const overlay = await context.newPage();
  const room = `ssn-sdk-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    await Promise.all([
      publisher.goto('https://socialstream.ninja/404.html'),
      overlay.goto('https://socialstream.ninja/404.html'),
    ]);
    for (const page of [publisher, overlay]) {
      await page.addScriptTag({ path: sdkPath });
      await page.addScriptTag({ path: bridgePath });
    }

    await Promise.all([
      publisher.evaluate(async ({ room }) => {
        window.livePackets = [];
        window.liveBridge = new NinjaBridge({
          label: 'SocialStream',
          wss: 'wss://apibackup.vdo.ninja',
        });
        window.liveBridge.addEventListener('data', (event) => window.livePackets.push(event.detail));
        await window.liveBridge.init({ room, password: false, streamID: `${room}-publisher` });
      }, { room }),
      overlay.evaluate(async ({ room }) => {
        window.livePackets = [];
        window.liveBridge = new NinjaBridge({
          label: 'dock',
          wss: 'wss://apibackup.vdo.ninja',
        });
        window.liveBridge.addEventListener('data', (event) => window.livePackets.push(event.detail));
        await window.liveBridge.init({ room, password: false, streamID: `${room}-dock` });
      }, { room }),
    ]);

    await publisher.waitForFunction(() => Object.values(window.liveBridge.getPeers()).includes('dock'), null, {
      timeout: 30000,
    });
    assert.equal(await publisher.evaluate(() => window.liveBridge.sendToLabel({ probe: 'live' }, 'dock')), true);
    await overlay.waitForFunction(
      () => window.livePackets.some((packet) => packet.data && packet.data.probe === 'live'),
      null,
      { timeout: 15000 }
    );

    await publisher.waitForTimeout(1000);
    assert.equal(
      await publisher.evaluate(() => Object.values(window.liveBridge.getPeers()).includes('dock')),
      true,
      'the authoritative dock label should survive later connection events'
    );
  } finally {
    await Promise.allSettled([
      publisher.evaluate(() => window.liveBridge && window.liveBridge.destroy()),
      overlay.evaluate(() => window.liveBridge && window.liveBridge.destroy()),
    ]);
    await browser.close();
  }
}

main().then(
  () => console.log('NinjaBridge live browser test passed'),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
