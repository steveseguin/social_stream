#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startStaticServer } = require('../scripts/playwright-static-server.cjs');

const ROOT = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const PORT = 4200;
const ARTIFACT_DIR = path.join(__dirname, 'artifacts');
const ARTIFACT_PATH = path.join(ARTIFACT_DIR, 'rag-scale-benchmark-latest.json');
const BASE_DATASET = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'rag-benchmark-dataset.json'), 'utf8')
);
const DOC_STEPS = [25, 50, 75, 100, 125, 150, 175, 200];
const TIMEOUT_MS = 90000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function overlapDoc(index, bucket) {
  const id = `doc_noise_${bucket}_${index}`;
  if (bucket === 0) {
    return {
      id,
      title: `Shipping Memo ${index}`,
      mode: 'raw',
      content: `Canada shipping memo ${index}. Warehouse dispatch batches need label reviews before customs release. Delivery estimate details are not customer-facing.`,
      tags: ['shipping', 'canada', 'dispatch'],
      synonyms: ['postage note', 'warehouse delivery', 'customs memo']
    };
  }
  if (bucket === 1) {
    return {
      id,
      title: `Schedule Notes ${index}`,
      mode: 'raw',
      content: `Friday planning board ${index}. Community clips are reviewed on Thursday, and weekend tech checks happen before the live show.`,
      tags: ['friday', 'community', 'schedule'],
      synonyms: ['friday plan', 'show calendar', 'community note']
    };
  }
  if (bucket === 2) {
    return {
      id,
      title: `OBS Routing Note ${index}`,
      mode: 'raw',
      content: `OBS routing checklist ${index}. Audio buses must be reviewed before alerts are tested, and monitoring defaults are recorded for support staff.`,
      tags: ['obs', 'audio', 'alerts'],
      synonyms: ['monitoring note', 'routing checklist', 'alert setup']
    };
  }
  if (bucket === 3) {
    return {
      id,
      title: `Membership Draft ${index}`,
      mode: 'raw',
      content: `Premium supporter draft ${index}. Discord lounge moderation, supporter check-ins, and aftershow planning are reviewed weekly.`,
      tags: ['membership', 'premium', 'discord'],
      synonyms: ['member perks', 'supporter plan', 'vip notes']
    };
  }
  if (bucket === 4) {
    return {
      id,
      title: `Giveaway Prep ${index}`,
      mode: 'raw',
      content: `Giveaway prep sheet ${index}. Prize draw logistics and monthly production reminders are reviewed before the winner post goes live.`,
      tags: ['giveaway', 'monthly', 'rules'],
      synonyms: ['prize draw', 'contest prep', 'winner notice']
    };
  }
  return {
    id,
    title: `Support Notes ${index}`,
    mode: 'raw',
    content: `Digital support memo ${index}. Refund escalations for downloads are routed to billing review, and account cases are tracked separately.`,
    tags: ['support', 'refunds', 'digital'],
    synonyms: ['returns', 'download support', 'billing note']
  };
}

function genericNoiseDoc(index) {
  return {
    id: `doc_noise_generic_${index}`,
    title: `Noise Document ${index}`,
    mode: 'raw',
    content: `Archive note ${index}. Lighting checks, scene transitions, editor macros, thumbnail drafts, and sponsor copy are tracked for future broadcasts.`,
    tags: ['archive', 'production', 'notes'],
    synonyms: ['backlog', 'studio note', 'workflow']
  };
}

function buildScaleDataset(totalDocs) {
  const dataset = clone(BASE_DATASET);
  const distractorCount = Math.max(0, totalDocs - dataset.documents.length);

  dataset.descriptor = `Synthetic large-corpus benchmark with ${totalDocs} documents covering shipping, schedules, setup, memberships, giveaways, digital support, and heavy distractor noise.`;

  for (let index = 0; index < distractorCount; index += 1) {
    if (index % 4 === 0) {
      dataset.documents.push(genericNoiseDoc(index));
    } else {
      dataset.documents.push(overlapDoc(index, index % 6));
    }
  }

  return dataset;
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

function summarizeFailure(result) {
  if (!result) {
    return 'unknown failure';
  }
  if (result.error) {
    return result.error;
  }
  if (result.retrievalTopK < 1) {
    return `retrievalTopK dropped to ${result.retrievalTopK}`;
  }
  if (result.retrievalTop1 < 1) {
    return `retrievalTop1 dropped to ${result.retrievalTop1}`;
  }
  if (result.questionAccuracy < 1) {
    return `questionAccuracy dropped to ${result.questionAccuracy}`;
  }
  if (result.totalMs > TIMEOUT_MS) {
    return `runtime exceeded timeout budget (${result.totalMs}ms)`;
  }
  return 'unknown failure';
}

function failedCaseIds(cases, field) {
  return (cases || [])
    .filter((testCase) => !testCase[field])
    .map((testCase) => testCase.id);
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
  const results = [];
  let pageErrors = [];
  let unexpectedRequests = [];

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

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

    let lastPassing = null;
    let firstRankingFailure = null;
    let firstRetrievalFailure = null;
    let firstFunctionalFailure = null;

    for (const docCount of DOC_STEPS) {
      const dataset = buildScaleDataset(docCount);
      const startedAt = Date.now();

      try {
        const benchmark = await withTimeout(
          page.evaluate(async (inputDataset) => {
            return await window.runRagBenchmark({ dataset: inputDataset, seed: true });
          }, dataset),
          TIMEOUT_MS
        );

        const result = {
          docCount,
          chunkCount: benchmark.corpus.chunkCount,
          retrievalTop1: benchmark.retrieval.top1.accuracy,
          retrievalTopK: benchmark.retrieval.topK.accuracy,
          questionAccuracy: benchmark.questions.overall.accuracy,
          answerableAccuracy: benchmark.questions.answerable.accuracy,
          abstainAccuracy: benchmark.questions.abstain.accuracy,
          seedMs: benchmark.timings.seedMs,
          retrievalMs: benchmark.timings.retrievalMs,
          questionMs: benchmark.timings.questionMs,
          collectMs: benchmark.timings.collectMs,
          totalMs: benchmark.timings.totalMs,
          wallClockMs: Date.now() - startedAt,
          retrievalTop1Failures: failedCaseIds(benchmark.retrieval.cases, 'top1Pass'),
          retrievalTopKFailures: failedCaseIds(benchmark.retrieval.cases, 'topKPass'),
          questionFailures: failedCaseIds(benchmark.questions.cases, 'answerPass'),
          retrievalPassed: benchmark.retrieval.topK.accuracy === 1 &&
            benchmark.retrieval.top1.accuracy === 1,
          passed: benchmark.questions.overall.accuracy === 1 &&
            benchmark.questions.answerable.accuracy === 1 &&
            benchmark.questions.abstain.accuracy === 1
        };

        results.push(result);
        console.log(
          `DOCS ${docCount}: top1=${(result.retrievalTop1 * 100).toFixed(1)}% topK=${(result.retrievalTopK * 100).toFixed(1)}% ` +
          `qa=${(result.questionAccuracy * 100).toFixed(1)}% seed=${result.seedMs}ms total=${result.totalMs}ms`
        );

        if (!firstRankingFailure && result.retrievalTop1 < 1) {
          firstRankingFailure = Object.assign({ reason: summarizeFailure(result) }, result);
        }
        if (!firstRetrievalFailure && result.retrievalTopK < 1) {
          firstRetrievalFailure = Object.assign({ reason: summarizeFailure(result) }, result);
        }

        if (!result.passed) {
          firstFunctionalFailure = Object.assign({ reason: summarizeFailure(result) }, result);
          break;
        }

        lastPassing = result;
      } catch (error) {
        const result = {
          docCount,
          passed: false,
          error: error && error.message ? error.message : String(error),
          wallClockMs: Date.now() - startedAt
        };
        results.push(result);
        firstFunctionalFailure = Object.assign({ reason: summarizeFailure(result) }, result);
        console.log(`DOCS ${docCount}: FAIL ${result.error}`);
        break;
      }
    }

    const summary = {
      timestamp: new Date().toISOString(),
      timeoutMs: TIMEOUT_MS,
      steps: DOC_STEPS,
      lastPassing,
      firstRankingFailure,
      firstRetrievalFailure,
      firstFunctionalFailure,
      pageErrors,
      unexpectedRequests,
      results
    };

    fs.writeFileSync(ARTIFACT_PATH, JSON.stringify(summary, null, 2));

    if (lastPassing) {
      console.log(`LAST PASS: ${lastPassing.docCount} docs in ${lastPassing.totalMs}ms`);
    }
    if (firstRankingFailure) {
      console.log(`FIRST RANKING FAIL: ${firstRankingFailure.docCount} docs (${firstRankingFailure.reason})`);
      if (firstRankingFailure.retrievalTop1Failures && firstRankingFailure.retrievalTop1Failures.length) {
        console.log(`RANKING CASES: ${firstRankingFailure.retrievalTop1Failures.join(', ')}`);
      }
    }
    if (firstRetrievalFailure) {
      console.log(`FIRST RETRIEVAL FAIL: ${firstRetrievalFailure.docCount} docs (${firstRetrievalFailure.reason})`);
      if (firstRetrievalFailure.retrievalTopKFailures && firstRetrievalFailure.retrievalTopKFailures.length) {
        console.log(`TOPK CASES: ${firstRetrievalFailure.retrievalTopKFailures.join(', ')}`);
      }
    }
    if (firstFunctionalFailure) {
      console.log(`FIRST FUNCTIONAL FAIL: ${firstFunctionalFailure.docCount} docs (${firstFunctionalFailure.reason})`);
      if (firstFunctionalFailure.questionFailures && firstFunctionalFailure.questionFailures.length) {
        console.log(`QUESTION FAIL CASES: ${firstFunctionalFailure.questionFailures.join(', ')}`);
      }
      if (firstFunctionalFailure.retrievalTopKFailures && firstFunctionalFailure.retrievalTopKFailures.length) {
        console.log(`TOPK FAIL CASES: ${firstFunctionalFailure.retrievalTopKFailures.join(', ')}`);
      }
    } else {
      console.log(`NO FAILURE THROUGH ${lastPassing ? lastPassing.docCount : 0} docs`);
    }
    console.log(`WROTE ${ARTIFACT_PATH}`);

    if (pageErrors.length) {
      throw new Error(`Unexpected page errors: ${pageErrors.join(' | ')}`);
    }
    if (unexpectedRequests.length) {
      throw new Error(`Unexpected external requests: ${unexpectedRequests.join(', ')}`);
    }

    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
