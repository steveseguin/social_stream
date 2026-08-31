#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startStaticServer } = require('../scripts/playwright-static-server.cjs');

const ROOT = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const PORT = 4199;
const DATASET = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'rag-benchmark-dataset.json'), 'utf8')
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function printSummary(label, summary) {
  console.log(`${label}: ${summary.passed}/${summary.total} (${formatPercent(summary.accuracy)})`);
  Object.keys(summary.byLevel || {}).sort().forEach((level) => {
    const levelSummary = summary.byLevel[level];
    console.log(`  ${level}: ${levelSummary.passed}/${levelSummary.total} (${formatPercent(levelSummary.accuracy)})`);
  });
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
    await page.waitForFunction(() => typeof window.runRagBenchmark === 'function');

    const benchmark = await page.evaluate(async (dataset) => {
      return await window.runRagBenchmark({ dataset: dataset, seed: true });
    }, DATASET);

    console.log(`Corpus: ${benchmark.corpus.docCount} docs, ${benchmark.corpus.chunkCount} processed chunks`);
    printSummary('Retrieval top1', benchmark.retrieval.top1);
    printSummary('Retrieval topK', benchmark.retrieval.topK);
    printSummary('Question accuracy', benchmark.questions.overall);
    printSummary('Answerable accuracy', benchmark.questions.answerable);
    printSummary('Abstain accuracy', benchmark.questions.abstain);
    printSummary('Question retrieval top1', benchmark.questions.retrievalTop1);
    printSummary('Question retrieval topK', benchmark.questions.retrievalTopK);

    benchmark.retrieval.cases.forEach((testCase) => {
      console.log(`RET ${testCase.id}: refs=${testCase.refs.join(',') || '-'} top1=${testCase.top1Pass} topK=${testCase.topKPass}`);
    });
    benchmark.questions.cases.forEach((testCase) => {
      console.log(`Q ${testCase.id}: refs=${testCase.refs.join(',') || '-'} response=${testCase.response === false ? 'NO_RESPONSE' : testCase.response} pass=${testCase.answerPass}`);
    });

    assert(benchmark.corpus.docCount === DATASET.documents.length, 'Benchmark corpus did not load all fixture documents.');
    assert(benchmark.corpus.chunkCount === 3, 'Benchmark corpus should contain three processed chunks.');
    assert(benchmark.corpus.descriptor === DATASET.descriptor, 'Benchmark descriptor did not match the fixture descriptor.');
    assert(benchmark.retrieval.topK.accuracy >= 1, 'Benchmark retrieval topK accuracy regressed.');
    assert(benchmark.retrieval.top1.accuracy >= 0.9, 'Benchmark retrieval top1 accuracy regressed.');
    assert(benchmark.questions.overall.accuracy >= 1, 'Benchmark question accuracy regressed.');
    assert(benchmark.questions.answerable.accuracy >= 1, 'Benchmark answerable-case accuracy regressed.');
    assert(benchmark.questions.abstain.accuracy >= 1, 'Benchmark abstain accuracy regressed.');
    assert(benchmark.questions.retrievalTopK.accuracy >= 1, 'Benchmark question retrieval topK accuracy regressed.');
    assert(pageErrors.length === 0, `Unexpected page errors: ${pageErrors.join(' | ')}`);
    assert(unexpectedRequests.length === 0, `Unexpected external requests: ${unexpectedRequests.join(', ')}`);

    console.log('PASS rag benchmark');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
