const path = require('path');
const { test, expect } = require('playwright/test');

function localPage(file, query) {
  const fullPath = path.resolve(__dirname, file).replace(/\\/g, '/');
  return 'file:///' + fullPath + (query || '');
}

test.use({
  launchOptions: {
    args: ['--autoplay-policy=user-gesture-required']
  }
});

test('gif muted video does not require audio context resume', async ({ page }) => {
  await page.goto(localPage('gif.html', '?muted'), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.__resumeCalled = false;
    window.resumeAudioContext = function() {
      window.__resumeCalled = true;
      return Promise.reject(new Error('resume should not be required'));
    };
    window.displayVideo('audio/tone.mp3');
  });
  await expect.poll(() => page.evaluate(() => window.__resumeCalled)).toBe(false);
});

test('tipjar priming flag survives async play', async ({ page }) => {
  await page.goto(localPage('tipjar.html', '?sound'), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.__playResolve = null;
    HTMLMediaElement.prototype.play = function() {
      return new Promise(resolve => {
        window.__playResolve = resolve;
      });
    };
    HTMLMediaElement.prototype.pause = function() {};
    window.primeDonationSound();
  });
  await expect.poll(() => page.evaluate(() => window.primingDonationSound)).toBe(true);
  await page.evaluate(() => window.__playResolve());
  await expect.poll(() => page.evaluate(() => window.donationSoundPrimed === true && window.primingDonationSound === false)).toBe(true);
});
