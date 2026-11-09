"use strict";

// Run: node tests/leaderboard-row-identity.test.cjs

const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { createStaticServer, closeServer } = require("./background-overlay-compat-matrix.test.cjs");
const { configureContext } = require("./helpers/chat-security-harness.cjs");

async function checkRows(page) {
    return page.evaluate(() => {
        const list = document.getElementById("leaderboard-content");
        const rows = () => Array.from(list.querySelectorAll(".leaderboard-item"));
        const key = (name, type) => JSON.stringify([name, type]);
        const find = (name, type) => rows().find(row => row.dataset.userKey === key(name, type));
        const points = row => row.querySelector(".score-number").textContent.trim();
        let checks = 0;
        const check = (condition, description) => {
            if (!condition) throw new Error(description);
            checks++;
        };
        const snapshot = leaderboard => processData({
            event: "points_leaderboard", timestamp: Date.now(), leaderboard
        });
        const accounts = [
            { username: "SharedName", type: "youtube", points: 6 },
            { username: "SharedName", type: "twitch", points: 3 },
            { username: "OtherViewer", type: "youtube", points: 1 }
        ];

        snapshot(accounts);
        const originalRows = rows();
        check(originalRows.length === 3, "Initial snapshot must create three account rows");
        for (let i = 0; i < 100; i++) snapshot(accounts);
        check(rows().length === 3, "100 identical snapshots must not accumulate same-name rows");
        check(originalRows.every(row => rows().includes(row)), "Unchanged accounts must reuse their DOM rows");
        check(points(find("SharedName", "youtube")) === "6", "YouTube balance must stay 6");
        check(points(find("SharedName", "twitch")) === "3", "Twitch balance must stay 3");

        snapshot([
            { username: "SharedName", type: "youtube", points: 2 },
            { username: "SharedName", type: "twitch", points: 9 },
            accounts[2]
        ]);
        check(rows()[0] === find("SharedName", "twitch"), "Balance changes must reorder the right account");
        check(points(find("SharedName", "youtube")) === "2", "Balance changes must update the right platform");

        list.appendChild(rows()[0].cloneNode(true));
        const unkeyed = rows()[0].cloneNode(true);
        delete unkeyed.dataset.userKey;
        list.appendChild(unkeyed);
        snapshot(accounts);
        check(rows().length === 3, "Reconciliation must remove duplicate and unkeyed stale rows");
        snapshot([accounts[0]]);
        check(rows().length === 1 && points(rows()[0]) === "6", "Omitted accounts must be removed");
        snapshot([{ ...accounts[0], points: 0 }]);
        check(rows().length === 0, "Zero balances must not leave account rows");
        snapshot(accounts);
        snapshot([{ ...accounts[0], bot: true }, accounts[1]]);
        check(rows().length === 1 && find("SharedName", "twitch"), "Bot removal must preserve its same-name peer");

        const formatted = [{ username: "<b>Viewer</b> &amp; Friends", type: "youtube", points: 4 }];
        snapshot(formatted);
        const formattedRow = rows()[0];
        for (let i = 0; i < 5; i++) snapshot(formatted);
        check(rows().length === 1 && rows()[0] === formattedRow, "Formatted names must reuse raw account identity");

        const manyAccounts = Array.from({ length: 60 }, (_, i) => ({
            username: "LimitViewer" + i, type: "youtube", points: i + 1
        }));
        snapshot(manyAccounts);
        snapshot(manyAccounts.slice().reverse());
        check(rows().length === 50, "Updates must respect maxentries=50");
        check(new Set(rows().map(row => row.dataset.userKey)).size === 50, "Displayed account keys must be unique");
        snapshot([]);
        check(rows().length === 0, "Empty snapshots must clear all account rows");
        return checks;
    });
}

(async () => {
    const server = await createStaticServer();
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        await configureContext(context, server.baseUrl);
        for (const layout of ["corner", "bar", "full"]) {
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", error => errors.push(error.message));
            await page.goto(server.baseUrl + "/leaderboard.html?session=ROW_IDENTITY_" + layout +
                "&layout=" + layout + "&rankby=loyalty&maxentries=50&showsource", {
                waitUntil: "domcontentloaded"
            });
            await page.waitForFunction(() => typeof processData === "function");
            const checks = await checkRows(page);
            assert.deepEqual(errors, [], layout + ": unexpected browser errors");
            console.log(layout + ": " + checks + " row identity checks passed");
            await page.close();
        }
        await context.close();
    } finally {
        if (browser) await browser.close();
        await closeServer(server.server);
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
