#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startStaticServer } = require('../scripts/playwright-static-server.cjs');

const ROOT = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const PORT = 4197;
const DATASET = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'rag-dataset.json'), 'utf8')
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
  const unexpectedRequests = [];

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];

    await context.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const isLocal = requestUrl.hostname === HOST || requestUrl.hostname === 'localhost';

      if (!isLocal) {
        unexpectedRequests.push(route.request().url());
        await route.abort();
        return;
      }

      await route.continue();
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(`http://${HOST}:${PORT}/tests/rag-e2e.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.runRagE2EScenario === 'function');

    const seededState = await page.evaluate(async (dataset) => {
      return await window.runRagE2EScenario({ dataset: dataset, seed: true });
    }, DATASET);

    assert(seededState.docCount === 3, 'Expected three fixture documents after seeding.');
    assert(seededState.docs.some((doc) => doc.id === 'doc_shipping' && doc.chunkCount >= 1), 'Processed shipping doc did not persist with chunks.');
    assert(seededState.docs.some((doc) => doc.id === 'doc_setup' && doc.tags.includes('camera')), 'Processed setup doc tags were not parsed.');
    assert(seededState.docs.some((doc) => doc.id === 'doc_schedule' && doc.chunkCount === 0), 'Raw schedule doc should remain a non-chunked document.');
    assert(seededState.descriptor === DATASET.expected.descriptor, 'Database descriptor did not update from the seeded corpus.');
    assert(seededState.searches.canada.refs[0] === 'doc_shipping_0', 'Canada shipping search did not return the processed shipping chunk first.');
    assert(seededState.searches.canada.firstContent && seededState.searches.canada.firstContent.includes('5-7 business days'), 'Canada shipping search did not retrieve the expected content.');
    assert(seededState.searches.friday.refs[0] === 'doc_schedule', 'Friday search did not return the raw schedule document.');
    assert(seededState.searches.friday.firstContent && seededState.searches.friday.firstContent.includes(DATASET.expected.fridayAnswer), 'Friday search did not retrieve the schedule text.');
    assert(seededState.searches.fuzzy.refs.includes('doc_shipping_0'), 'Misspelled fuzzy search did not recover the shipping chunk.');
    assert(seededState.answers.canada === DATASET.expected.canadaAnswer, 'RAG answer for the Canada question was wrong.');
    assert(seededState.answers.friday === DATASET.expected.fridayAnswer, 'RAG answer for the Friday question was wrong.');
    assert(seededState.answers.offtopic === false, 'Off-topic question should not force a chatbot answer.');
    assert((seededState.promptKinds.analyzeChunk || 0) >= 2, 'Chunk analysis did not run for the processed fixture documents.');
    assert((seededState.promptKinds.databaseDescriptor || 0) >= 1, 'Database descriptor generation did not run.');
    assert((seededState.promptKinds.ragDecision || 0) >= 2, 'RAG decision prompting did not run.');
    assert((seededState.promptKinds.ragAnswer || 0) >= 2, 'RAG answer prompting did not run.');
    assert(seededState.lastRagDecisionPrompt.includes(DATASET.expected.descriptor), 'RAG decision prompt did not include the database descriptor.');
    assert(!seededState.lastRagDecisionPrompt.includes('${databaseDescriptor}'), 'RAG decision prompt still contains the literal descriptor placeholder.');
    assert(seededState.lastRagAnswerPrompt.includes(DATASET.expected.fridayAnswer), 'RAG answer prompt did not include retrieved evidence.');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.runRagE2EScenario === 'function');

    const reloadedState = await page.evaluate(async (dataset) => {
      return await window.runRagE2EScenario({ dataset: dataset, seed: false });
    }, DATASET);

    assert(reloadedState.docCount === 3, 'Expected the same three fixture documents after reload.');
    assert(reloadedState.searches.canada.refs[0] === 'doc_shipping_0', 'Reloaded index did not preserve the shipping chunk.');
    assert(reloadedState.searches.friday.refs[0] === 'doc_schedule', 'Reloaded index did not preserve the raw schedule doc.');
    assert(reloadedState.answers.canada === DATASET.expected.canadaAnswer, 'Reloaded Canada answer changed unexpectedly.');
    assert(reloadedState.answers.friday === DATASET.expected.fridayAnswer, 'Reloaded Friday answer changed unexpectedly.');
    assert(reloadedState.answers.offtopic === false, 'Reloaded off-topic question should still decline to answer.');
    assert(pageErrors.length === 0, `Unexpected page errors: ${pageErrors.join(' | ')}`);
    assert(unexpectedRequests.length === 0, `Unexpected external requests: ${unexpectedRequests.join(', ')}`);

    console.log('PASS rag e2e');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
