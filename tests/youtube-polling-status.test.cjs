'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const html = fs.readFileSync(path.join(__dirname, '../sources/websocket/youtube.html'), 'utf8');

function section(start, end) {
    const first = html.indexOf(start);
    const last = html.indexOf(end, first);
    assert(first >= 0 && last > first);
    return html.slice(first, last);
}

function fixture(fallback) {
    const status = { textContent: '' };
    const timers = [];
    let polls = 0;
    const context = vm.createContext({
        console, Date,
        document: { getElementById: id => id === 'poll-time' ? status : { setAttribute() {} } },
        liveChatId: 'fixture-chat', fetchTimeout: null,
        liveChatStreamActive: false, liveChatStreamAbortController: null,
        liveChatPollingFallbackActive: fallback, isPageVisible: true,
        setTrackedTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
        clearTimeout() {},
        startLiveChatPolling() { polls++; return true; },
        updatePollSpinner(delay) { status.textContent = `polling ${delay / 1000}s`; },
        youtubeRecommendedInterval: 5000, lastSuccessfulPollTime: 0,
        normalizeLiveChatMessageItem: item => item, currentStream: null, videoId: null,
        initialBacklogProcessing: false, nextPageToken: null, LIVE_CHAT_MAX_RESULTS: 500,
        consecutiveMaxMessages: 0, consecutiveEmptyPolls: 0, quickPollCount: 0, slowerPollingMode: false,
        QUIET_CHAT_IDLE_THRESHOLD: 6, QUIET_CHAT_IDLE_INTERVAL_MS: 30000,
        QUIET_CHAT_BACKOFF_THRESHOLD: 3, QUIET_CHAT_BACKOFF_INTERVAL_MS: 10000, QUIET_CHAT_MIN_INTERVAL_MS: 5000
    });
    vm.runInContext(
        section('function updateLiveChatStreamIndicator(', 'function scheduleLiveChatPolling(')
        + section('async function startLiveChatStream(', 'async function startLiveChatPolling(')
        + section('async function processLiveChatResponseData(', 'function normalizeYouTubeSignInTargetValue('), context);
    return { context, status, timers, polls: () => polls };
}

test('Successful fallback polling keeps its polling label and schedules another poll', async () => {
    const { context, status, timers, polls } = fixture(true);
    await context.processLiveChatResponseData({ items: [], pollingIntervalMillis: 8000 }, { scheduleNextPoll: true });
    assert.equal(status.textContent, 'polling 8s');
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 8000);
    await timers[0].callback();
    assert.equal(polls(), 1, 'The existing fallback dispatch must remain polling');
});

test('Actual streaming retries still show reconnecting and avoid duplicate timers', () => {
    const { context, status, timers } = fixture(false);
    context.scheduleLiveChatStreamReconnect(2000);
    assert.equal(status.textContent, 'reconnecting');
    context.scheduleLiveChatStreamReconnect(2000);
    assert.equal(timers.length, 1);
});
