/**
 * Final screenshot capture for the Custom JS guide.
 * Run: node scripts/capture-editor-final.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:7788/actions/index.html';
const OUT  = path.join(__dirname, '..', 'actions', 'img');

async function go() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 820 } });
    const p   = await ctx.newPage();
    p.on('console', () => {}); p.on('pageerror', () => {});

    await p.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    // wait for loading modal to go away
    await p.waitForSelector('#loading-modal', { state: 'hidden', timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(800);

    /* ── 1. Overview – empty editor ── */
    await p.screenshot({ path: `${OUT}/editor-overview.png` });
    console.log('✓ editor-overview.png');

    /* ── Setup: create flow + expand all groups ── */
    await p.evaluate(() => {
        const btn = [...document.querySelectorAll('button,div,span')]
            .find(e => e.textContent.trim() === 'Create Flow');
        if (btn) btn.click();
    });
    await p.waitForTimeout(400);
    await p.evaluate(() => {
        const inp = document.querySelector('input[placeholder="Flow Name"]');
        if (inp) { inp.value = 'Custom JS Examples'; inp.dispatchEvent(new Event('input')); }
        document.querySelectorAll('.trigger-group-items,.action-group-items')
            .forEach(el => { el.style.display = 'block'; });
    });
    await p.waitForTimeout(300);

    /* ── 2. Trigger panel – scroll to Custom Code ── */
    await p.evaluate(() => {
        const n = document.querySelector('[data-subtype="customJs"][data-nodetype="trigger"]');
        if (n) n.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/trigger-panel.png`, clip: { x: 0, y: 80, width: 258, height: 680 } });
    console.log('✓ trigger-panel.png');

    /* ── 3. Action panel – scroll to Execute Custom Code ── */
    await p.evaluate(() => {
        const n = document.querySelector('[data-subtype="customJs"][data-nodetype="action"]');
        if (n) n.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/action-panel.png`, clip: { x: 0, y: 80, width: 258, height: 680 } });
    console.log('✓ action-panel.png');

    /* ── 4. Drag Custom Code TRIGGER onto canvas ── */
    await p.evaluate(() => {
        const n = document.querySelector('[data-subtype="customJs"][data-nodetype="trigger"]');
        if (n) n.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    await p.waitForTimeout(300);

    const trig = await p.$('[data-subtype="customJs"][data-nodetype="trigger"]');
    const tb = await trig.boundingBox();
    // simulate a real drag: mousedown → move slowly → mouseup
    await p.mouse.move(tb.x + tb.width/2, tb.y + tb.height/2);
    await p.mouse.down();
    await p.waitForTimeout(80);
    for (let i = 1; i <= 20; i++) {
        await p.mouse.move(
            tb.x + tb.width/2 + (260 - tb.x - tb.width/2) * i/20 + (300*i/20),
            tb.y + tb.height/2 + (300 - tb.y - tb.height/2) * i/20,
            { steps: 1 }
        );
        await p.waitForTimeout(10);
    }
    await p.mouse.move(560, 320, { steps: 5 });
    await p.mouse.up();
    await p.waitForTimeout(700);

    await p.screenshot({ path: `${OUT}/customjs-trigger-on-canvas.png` });
    console.log('✓ customjs-trigger-on-canvas.png');

    // Properties panel zoom
    await p.screenshot({ path: `${OUT}/customjs-trigger-props.png`, clip: { x: 1110, y: 100, width: 295, height: 460 } });
    console.log('✓ customjs-trigger-props.png');

    /* ── 5. Drag Execute Custom Code ACTION onto canvas ── */
    await p.evaluate(() => {
        const n = document.querySelector('[data-subtype="customJs"][data-nodetype="action"]');
        if (n) n.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    await p.waitForTimeout(300);

    const act = await p.$('[data-subtype="customJs"][data-nodetype="action"]');
    const ab = await act.boundingBox();
    await p.mouse.move(ab.x + ab.width/2, ab.y + ab.height/2);
    await p.mouse.down();
    await p.waitForTimeout(80);
    await p.mouse.move(820, 320, { steps: 25 });
    await p.mouse.up();
    await p.waitForTimeout(700);

    await p.screenshot({ path: `${OUT}/customjs-action-on-canvas.png` });
    console.log('✓ customjs-action-on-canvas.png');

    // Properties panel zoom for action
    await p.screenshot({ path: `${OUT}/customjs-action-props.png`, clip: { x: 1110, y: 100, width: 295, height: 500 } });
    console.log('✓ customjs-action-props.png');

    /* ── 6. Both nodes on canvas – click away to deselect, full shot ── */
    await p.mouse.click(680, 600);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/both-nodes-canvas.png` });
    console.log('✓ both-nodes-canvas.png');

    /* ── 7. Test panel ── */
    await p.click('text=Test Flow').catch(() => {});
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/test-panel.png` });
    console.log('✓ test-panel.png');

    await browser.close();
    console.log('\nAll screenshots saved to actions/img/');
}

go().catch(e => { console.error(e.message); process.exit(1); });
