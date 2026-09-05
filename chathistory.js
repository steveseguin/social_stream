// chathistory.js
const DB_NAME = 'chatMessagesDB_v3';
const STORE_NAME = 'messages';
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const MAX_ITEMS = PAGE_SIZE * MAX_PAGES;
const FILTER_DEBOUNCE_MS = 300;
const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

let db;
let messages = [];
let unlimitedDBEnabled = false;
let isLoading = false;
let newestTimestamp = null;
let oldestTimestamp = null;
let reachedNewest = false;
let reachedOldest = false;
const loadedMessageIds = new Set();
const knownTypes = new Set();
let filterDebounceHandle = null;
const historyUrlParams = new URLSearchParams(window.location.search);
const snapshotMode = historyUrlParams.get('ssappSnapshot') === '1';
let snapshotMessages = null;
let resolveSnapshot;
let rejectSnapshot;
const snapshotReady = new Promise((resolve, reject) => {
    resolveSnapshot = resolve;
    rejectSnapshot = reject;
});

if (snapshotMode) {
    const snapshotTimeout = setTimeout(() => rejectSnapshot(new Error('Timed out waiting for saved message history.')), 15000);
    window.addEventListener('message', event => {
        if (event.source !== window.parent || !event.data || event.data.type !== 'ssapp-chat-history-snapshot') return;
        const snapshot = event.data.snapshot || {};
        snapshotMessages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
        unlimitedDBEnabled = snapshot.unlimitedDB === true;
        snapshotMessages.sort(compareMessagesNewestFirst);
        window.__ssappHistorySnapshotState = {
            active: true,
            count: snapshotMessages.length,
            version: snapshot.version || null,
            stores: Array.isArray(snapshot.stores) ? snapshot.stores : []
        };
        clearTimeout(snapshotTimeout);
        resolveSnapshot(window.__ssappHistorySnapshotState);
    });
    window.parent.postMessage({ type: 'ssapp-chat-history-ready' }, '*');
}

const searchInput = document.getElementById('search-input');
const messagesContainer = document.getElementById('messages-container');
const exportButton = document.getElementById('export-button');
const exportFormat = document.getElementById('export-format');
const exportTimeframe = document.getElementById('export-timeframe');
const dateFilterFrom = document.getElementById('date-filter-from');
const dateFilterTo = document.getElementById('date-filter-to');

const typeFilter = document.getElementById('type-filter');
const usernameFilter = document.getElementById('username-filter');
const keywordFilter = document.getElementById('keyword-filter');
const messageDateFrom = document.getElementById('message-date-from');
const messageDateTo = document.getElementById('message-date-to');
const donationFilter = document.getElementById('donation-filter');
const membershipFilter = document.getElementById('membership-filter');
const clearFiltersButton = document.getElementById('clear-filters');
const clearHistoryButton = document.getElementById('clear-history');

const filters = {
    search: '',
    username: '',
    keyword: '',
    type: '',
    dateFrom: null,
    dateTo: null,
    donationsOnly: false,
    membershipsOnly: false
};

function initDatabase() {
    return new Promise((resolve, reject) => {
        const detectRequest = indexedDB.open(DB_NAME);

        detectRequest.onsuccess = event => {
            const detectedDb = event.target.result;
            const currentVersion = detectedDb.version;
            detectedDb.close();

            const request = indexedDB.open(DB_NAME, currentVersion);
            request.onerror = event => reject(event.target.error);
            request.onsuccess = event => {
                db = event.target.result;
                console.log(`Opened database version ${db.version}`);
                resolve(db);
            };
            request.onupgradeneeded = event => {
                const upgradeDb = event.target.result;
                let store;

                if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
                    store = upgradeDb.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp');
                    store.createIndex('user_timestamp', ['chatname', 'timestamp']);
                    store.createIndex('user_type_timestamp', ['chatname', 'type', 'timestamp']);
                } else {
                    const transaction = event.currentTarget.transaction;
                    store = transaction.objectStore(STORE_NAME);
                }

                if (event.oldVersion < 4 && store) {
                    if (!store.indexNames.contains('user_id_timestamp')) {
                        store.createIndex('user_id_timestamp', ['userid', 'timestamp']);
                    }
                    if (!store.indexNames.contains('user_id_type_timestamp')) {
                        store.createIndex('user_id_type_timestamp', ['userid', 'type', 'timestamp']);
                    }
                }
            };
        };

        detectRequest.onerror = event => {
            const request = indexedDB.open(DB_NAME, 4);
            request.onerror = event => reject(event.target.error);
            request.onsuccess = event => {
                db = event.target.result;
                console.log(`Opened database version ${db.version} (fallback)`);
                resolve(db);
            };
            request.onupgradeneeded = event => {
                const upgradeDb = event.target.result;
                if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
                    const store = upgradeDb.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp');
                    store.createIndex('user_timestamp', ['chatname', 'timestamp']);
                    store.createIndex('user_type_timestamp', ['chatname', 'type', 'timestamp']);
                }
            };
        };
    });
}

function removeHtmlTagsFromPlainText(value) {
    return String(value || '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '')
        .replace(/<[^>]*>/g, '');
}

function stripHtmlToPlainText(value) {
    const text = String(value == null ? '' : value);
    try {
        if (typeof DOMParser !== 'undefined') {
            const doc = new DOMParser().parseFromString(text, 'text/html');
            if (doc && doc.body) {
                doc.body.querySelectorAll('script,style,noscript,template').forEach(node => node.remove());
                return removeHtmlTagsFromPlainText(doc.body.textContent || '');
            }
        }
    } catch (e) {}
    return removeHtmlTagsFromPlainText(text);
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatTsvField(value) {
    const normalized = String(value || '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
    return /^\s*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

function safePlainText(value) {
    return escapeHtml(stripHtmlToPlainText(value));
}

function debounceFilters() {
    if (filterDebounceHandle) {
        clearTimeout(filterDebounceHandle);
    }
    filterDebounceHandle = setTimeout(() => {
        filterDebounceHandle = null;
        resetAndLoadMessages();
    }, FILTER_DEBOUNCE_MS);
}

function parseDateInput(value, endOfDay = false) {
    if (!value) return null;
    // Date inputs represent a local calendar day, not UTC midnight.
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    if (endOfDay) {
        parsed.setHours(23, 59, 59, 999);
    } else {
        parsed.setHours(0, 0, 0, 0);
    }
    return parsed.getTime();
}

function createRange(lower, upper, options = {}) {
    const { excludeLower = false, excludeUpper = false } = options;
    if (lower != null && upper != null) {
        if (lower > upper) return null;
        return IDBKeyRange.bound(lower, upper, excludeLower, excludeUpper);
    }
    if (lower != null) {
        return IDBKeyRange.lowerBound(lower, excludeLower);
    }
    if (upper != null) {
        return IDBKeyRange.upperBound(upper, excludeUpper);
    }
    return null;
}

function buildCursorConfig(direction) {
    const dateLower = filters.dateFrom;
    const dateUpper = filters.dateTo;

    if (direction === 'initial') {
        return {
            cursorDirection: 'prev',
            range: createRange(dateLower, dateUpper)
        };
    }

    if (direction === 'down') {
        if (oldestTimestamp == null) {
            return {
                cursorDirection: 'prev',
                range: createRange(dateLower, dateUpper)
            };
        }

        let upper = oldestTimestamp;
        if (dateUpper != null) {
            upper = Math.min(upper, dateUpper);
        }
        if (dateLower != null && upper < dateLower) {
            return { cursorDirection: null, range: null };
        }
        return {
            cursorDirection: 'prev',
            range: createRange(dateLower, upper)
        };
    }

    if (direction === 'up') {
        if (newestTimestamp == null) {
            return { cursorDirection: null, range: null };
        }

        let lower = newestTimestamp;
        if (dateLower != null) {
            lower = Math.max(lower, dateLower);
        }
        if (dateUpper != null && lower > dateUpper) {
            return { cursorDirection: null, range: null };
        }
        return {
            cursorDirection: 'next',
            range: createRange(lower, dateUpper)
        };
    }

    return { cursorDirection: null, range: null };
}

function isHistorySettingEnabled(value) {
    return value === true || !!(value && typeof value === 'object' && value.setting === true);
}

function isHistoryMessageExpired(message, now = Date.now()) {
    if (!message || unlimitedDBEnabled) return false;

    if (message.expiresAt !== undefined && message.expiresAt !== null && message.expiresAt !== '') {
        const explicitExpiration = Number(message.expiresAt);
        if (Number.isFinite(explicitExpiration)) return explicitExpiration <= now;
    }

    const timestamp = Number(message.timestamp);
    return Number.isFinite(timestamp) && timestamp + DEFAULT_RETENTION_MS <= now;
}

function loadUnlimitedDBSetting() {
    if (snapshotMode) return snapshotReady.then(() => unlimitedDBEnabled);

    return new Promise(resolve => {
        let settled = false;
        let timeout = null;
        const finish = value => {
            if (settled) return;
            settled = true;
            if (timeout !== null) clearTimeout(timeout);
            unlimitedDBEnabled = value;
            resolve(value);
        };
        timeout = setTimeout(() => finish(false), 5000);

        const readFromRuntime = () => {
            if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
                finish(false);
                return;
            }

            try {
                chrome.runtime.sendMessage({ cmd: 'getSettings' }, response => {
                    if (chrome.runtime.lastError || !response || !response.settings) {
                        finish(false);
                        return;
                    }
                    finish(isHistorySettingEnabled(response.settings.unlimitedDB));
                });
            } catch (error) {
                finish(false);
            }
        };

        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || typeof chrome.storage.local.get !== 'function') {
            readFromRuntime();
            return;
        }

        try {
            chrome.storage.local.get(['settings'], result => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    readFromRuntime();
                    return;
                }
                if (!result || typeof result !== 'object') {
                    readFromRuntime();
                    return;
                }
                finish(isHistorySettingEnabled(result.settings && result.settings.unlimitedDB));
            });
        } catch (error) {
            readFromRuntime();
        }
    });
}

function messageMatchesFilters(message, activeFilters = filters) {
    if (!message) return false;
    if (isHistoryMessageExpired(message)) return false;

    if (activeFilters.search) {
        const term = activeFilters.search;
        const matchesGlobal = String(message.chatname == null ? '' : message.chatname).toLowerCase().includes(term) ||
            String(message.userid == null ? '' : message.userid).toLowerCase().includes(term) ||
            String(message.type == null ? '' : message.type).toLowerCase().includes(term) ||
            String(message.chatmessage == null ? '' : message.chatmessage).toLowerCase().includes(term);
        if (!matchesGlobal) return false;
    }

    if (activeFilters.username) {
        if (!String(message.chatname == null ? '' : message.chatname).toLowerCase().includes(activeFilters.username)) {
            return false;
        }
    }

    if (activeFilters.keyword) {
        if (!String(message.chatmessage == null ? '' : message.chatmessage).toLowerCase().includes(activeFilters.keyword)) {
            return false;
        }
    }

    if (activeFilters.type) {
        if (String(message.type == null ? '' : message.type).toLowerCase() !== activeFilters.type) {
            return false;
        }
    }

    if (activeFilters.donationsOnly && !message.hasDonation) {
        return false;
    }

    if (activeFilters.membershipsOnly) {
        const hasMembership = Boolean(message.membership || message.hasMembership);
        const isMembershipEvent = typeof message.event === 'string' && message.event.toLowerCase().includes('membership');
        if (!hasMembership && !isMembershipEvent) {
            return false;
        }
    }

    if (activeFilters.dateFrom != null && message.timestamp < activeFilters.dateFrom) {
        return false;
    }
    if (activeFilters.dateTo != null && message.timestamp > activeFilters.dateTo) {
        return false;
    }

    return true;
}

function compareMessagesNewestFirst(a, b) {
    const timestampDifference = (Number(b && b.timestamp) || 0) - (Number(a && a.timestamp) || 0);
    if (timestampDifference) return timestampDifference;
    return (Number(b && b.id) || 0) - (Number(a && a.id) || 0);
}

function findSnapshotMessageIndex(matching, anchor) {
    if (!anchor) return -1;
    const directIndex = matching.indexOf(anchor);
    if (directIndex !== -1) return directIndex;
    if (anchor.id == null) return -1;
    return matching.findIndex(message => message && message.id === anchor.id);
}

function fetchSnapshotMessages(direction = 'initial') {
    const snapshot = snapshotMessages || [];
    const initial = direction === 'initial' || !messages.length;
    const step = !initial && direction === 'up' ? -1 : 1;
    let index = 0;
    if (!initial) {
        if (direction !== 'up' && direction !== 'down') return [];
        const anchor = step === -1 ? messages[0] : messages[messages.length - 1];
        index = findSnapshotMessageIndex(snapshot, anchor);
        if (index === -1) return [];
        index += step;
    }

    // The snapshot is already sorted. Scan only as far as this page needs,
    // instead of filtering and allocating a copy of the entire archive.
    const results = [];
    for (; index >= 0 && index < snapshot.length && results.length < PAGE_SIZE; index += step) {
        if (messageMatchesFilters(snapshot[index])) results.push(snapshot[index]);
    }
    return step === -1 ? results.reverse() : results;
}

function fetchMessages(direction = 'initial') {
	if (snapshotMode) return Promise.resolve(fetchSnapshotMessages(direction));
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');

        const { cursorDirection, range } = buildCursorConfig(direction);
        if (!cursorDirection) {
            resolve([]);
            return;
        }

        // Timestamp indexes are not unique; keep the boundary timestamp and skip
        // only rows on the already displayed side of the (timestamp, id) pair.
        const anchor = direction === 'down' ? messages[messages.length - 1] : direction === 'up' ? messages[0] : null;
        const results = [];
        const request = index.openCursor(range, cursorDirection);
        request.onsuccess = event => {
            const cursor = event.target.result;
            if (!cursor) {
                resolve(results.sort(compareMessagesNewestFirst));
                return;
            }

            const value = cursor.value;
            const comparison = anchor ? compareMessagesNewestFirst(value, anchor) : 0;
            const pastAnchor = !anchor || (direction === 'down' ? comparison > 0 : comparison < 0);
            if (pastAnchor && messageMatchesFilters(value)) {
                results.push(value);
            }

            if (results.length >= PAGE_SIZE) {
                resolve(results.sort(compareMessagesNewestFirst));
                return;
            }

            cursor.continue();
        };
        request.onerror = event => reject(event.target.error);
    });
}

function updateTypeOptions(newMessages) {
    const select = typeFilter;
    let optionsAdded = false;

    newMessages.forEach(message => {
        const type = String(message.type == null ? '' : message.type).toLowerCase();
        if (!type) return;
        if (knownTypes.has(type)) return;
        knownTypes.add(type);
        optionsAdded = true;
    });

    if (!optionsAdded) return;

    const existingValue = select.value;
    const sortedTypes = Array.from(knownTypes).sort();
    select.innerHTML = '<option value="">All Sources</option>' +
        sortedTypes.map(type => `<option value="${type}">${type}</option>`).join('');
    select.value = existingValue;
}

function trimMessages(direction) {
    if (messages.length <= MAX_ITEMS) return;

    const excess = messages.length - MAX_ITEMS;
    let removed;

    if (direction === 'up') {
        removed = messages.splice(messages.length - excess, excess);
        reachedOldest = false;
    } else {
        removed = messages.splice(0, excess);
        reachedNewest = false;
    }

    removed.forEach(msg => loadedMessageIds.delete(msg.id));
}

function updateTimestampBoundaries() {
    if (!messages.length) {
        newestTimestamp = null;
        oldestTimestamp = null;
        return;
    }
    newestTimestamp = messages[0].timestamp;
    oldestTimestamp = messages[messages.length - 1].timestamp;
}

function mergeMessages(newMessages, direction) {
    const fresh = newMessages.filter(message => {
        if (!message || loadedMessageIds.has(message.id)) return false;
        loadedMessageIds.add(message.id);
        return true;
    });

    if (!fresh.length) return;

    fresh.sort(compareMessagesNewestFirst);

    if (direction === 'up') {
        messages = [...fresh, ...messages];
    } else if (direction === 'down') {
        messages = [...messages, ...fresh];
    } else {
        messages = fresh;
    }

    updateTypeOptions(fresh);
    trimMessages(direction);
    updateTimestampBoundaries();
}

function renderMessages() {
    if (!messages.length) {
        messagesContainer.innerHTML = '<p>No messages match the current filters.</p>';
        return;
    }

    // Stored relay HTML comes from the background.js path where non-text-only chat fields are sanitized
    // before persistence. Text-only messages are deliberately stored raw (see background.js), so their
    // chatmessage must be escaped here — matching how the live overlays (featured/dock) render text-only.
    const html = messages.map(message => `
        <div class="message-wrapper" id="message-${message.id}">
            <div class="message">
                <img src="${message.chatimg || 'https://socialstream.ninja/sources/images/unknown.png'}" alt="Avatar" class="avatar" data-error-hide="message">
                <div class="message-content">
                    <div class="message-header">
                        <span class="user-name">${message.chatname || 'Anonymous'}</span>
                        ${message.type ? `<img src="https://socialstream.ninja/sources/images/${message.type}.png" alt="${message.type}" class="type-image" data-error-hide="self">` : ''}
                        <span class="timestamp">${formatTimestamp(message.timestamp)}</span>
                    </div>
                    <p class="message-text">${message.textonly ? escapeHtml(message.chatmessage || '') : (message.chatmessage || '')}</p>
                    ${message.contentimg ? `<img src="${message.contentimg}" alt="Content" class="content-image" data-error-hide="self">` : ''}
                    ${message.hasDonation ? `<p class="donation">Donation: ${safePlainText(message.hasDonation)}</p>` : ''}
                    ${(message.membership || message.hasMembership) ? `<p class="membership">Membership: ${safePlainText(message.membership || message.hasMembership)}</p>` : ''}
                </div>
            </div>
        </div>
    `).join('');

    messagesContainer.innerHTML = html;
    messagesContainer.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', handleImageError);
    });
}

function ensureContentFillsContainer() {
    const containerHeight = messagesContainer.clientHeight;
    const contentHeight = messagesContainer.scrollHeight;
    if (contentHeight <= containerHeight && !reachedOldest && !isLoading) {
        loadMoreMessages('down');
    }
}

async function resetAndLoadMessages() {
    if (!db && !snapshotMode) return;
    isLoading = true;
    messagesContainer.scrollTop = 0;

    messages = [];
    loadedMessageIds.clear();
    newestTimestamp = null;
    oldestTimestamp = null;
    reachedNewest = false;
    reachedOldest = false;

    try {
        const initialMessages = await fetchMessages('initial');
        mergeMessages(initialMessages, 'initial');
        renderMessages();
    } catch (error) {
        console.error('Error loading messages:', error);
    } finally {
        isLoading = false;
        ensureContentFillsContainer();
    }
}

async function loadMoreMessages(direction) {
    if (isLoading) return;
    if (direction === 'down' && reachedOldest) return;
    if (direction === 'up' && reachedNewest) return;

    isLoading = true;
    // Preserve the visible row even when the 500-row limit removes rows
    // from the opposite end. Total scroll height alone cannot track that.
    const containerTop = messagesContainer.getBoundingClientRect().top;
    const scrollAnchor = Array.from(messagesContainer.querySelectorAll('.message-wrapper'))
        .find(row => row.getBoundingClientRect().bottom > containerTop);
    const anchorTop = scrollAnchor ? scrollAnchor.getBoundingClientRect().top : 0;

    try {
        const newMessages = await fetchMessages(direction);
        if (!newMessages.length) {
            if (direction === 'down') {
                reachedOldest = true;
            } else if (direction === 'up') {
                reachedNewest = true;
            }
            return;
        }

        mergeMessages(newMessages, direction);
        renderMessages();

        if (scrollAnchor) {
            const currentAnchor = document.getElementById(scrollAnchor.id);
            if (currentAnchor) {
                messagesContainer.scrollTop += currentAnchor.getBoundingClientRect().top - anchorTop;
            }
        }

        if (direction === 'down') {
            ensureContentFillsContainer();
        }
    } catch (error) {
        console.error('Error loading more messages:', error);
    } finally {
        isLoading = false;
    }
}

function handleImageError(event) {
    const img = event.target;
    img.style.display = 'none';
    if (img.classList.contains('avatar') && img.src !== 'https://socialstream.ninja/sources/images/unknown.png') {
        img.src = 'https://socialstream.ninja/sources/images/unknown.png';
        img.style.display = 'block';
    }
}

function formatTimestamp(timestamp) {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffInSeconds = Math.floor((now - messageDate) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    }
    if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}m ago`;
    }
    if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}h ago`;
    }
    if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}d ago`;
    }
    return messageDate.toLocaleDateString();
}

function getDateRangeFromTimeframe(timeframe) {
    const now = new Date();
    const startDate = new Date(now);

    switch (timeframe) {
        case 'day':
            return { startTimestamp: now.getTime() - 24 * 60 * 60 * 1000, endTimestamp: now.getTime() };
        case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
        case 'custom':
            if (dateFilterFrom.value) {
                const fromTs = parseDateInput(dateFilterFrom.value, false);
                const toTs = dateFilterTo.value ? parseDateInput(dateFilterTo.value, true) : now.getTime();
                return { startTimestamp: fromTs, endTimestamp: toTs };
            }
            startDate.setMonth(now.getMonth() - 1);
            break;
        case 'all':
        default:
            startDate.setFullYear(startDate.getFullYear() - 10);
    }

    const startTimestamp = startDate.setHours(0, 0, 0, 0);
    const endTimestamp = now.getTime();
    return { startTimestamp, endTimestamp };
}

function loadAllMessagesMatchingFilters(activeFilters) {
	if (snapshotMode) {
		return Promise.resolve((snapshotMessages || []).filter(message => messageMatchesFilters(message, activeFilters)));
	}
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        const range = createRange(activeFilters.dateFrom, activeFilters.dateTo);
        const results = [];

        const request = index.openCursor(range);
        request.onsuccess = event => {
            const cursor = event.target.result;
            if (!cursor) {
                resolve(results);
                return;
            }
            const value = cursor.value;
            if (messageMatchesFilters(value, activeFilters)) {
                results.push(value);
            }
            cursor.continue();
        };
        request.onerror = event => reject(event.target.error);
    });
}

function exportMessages(format) {
    const timeframe = exportTimeframe.value;
    const { startTimestamp, endTimestamp } = getDateRangeFromTimeframe(timeframe);

    const exportFilters = {
        ...filters,
        dateFrom: startTimestamp,
        dateTo: endTimestamp
    };

    exportButton.disabled = true;
    exportButton.textContent = 'Exporting...';

    loadAllMessagesMatchingFilters(exportFilters)
        .then(allMessages => {
            const sorted = allMessages.sort((a, b) => b.timestamp - a.timestamp);
            let content = '';
            const filename = `chat_export_${new Date().toISOString()}.${format}`;

            switch (format) {
                case 'json':
                    content = JSON.stringify(sorted, null, 2);
                    break;
                case 'tsv':
                    content = 'ID\tTimestamp\tUsername\tUserID\tType\tMessage\tDonation\n' +
                        sorted.map(m => [
                            formatTsvField(m.id),
                            formatTsvField(m.timestamp),
                            formatTsvField(m.chatname),
                            formatTsvField(m.userid),
                            formatTsvField(m.type),
                            formatTsvField(m.chatmessage),
                            formatTsvField(m.hasDonation)
                        ].join('\t')).join('\n');
                    break;
                case 'html':
                    content = `
                        <html>
                        <head>
                            <style>
                                body { font-family: Arial, sans-serif; }
                                .message { border-bottom: 1px solid #ccc; padding: 10px; }
                                .username { font-weight: bold; }
                                .timestamp { color: #888; font-size: 0.8em; }
                            </style>
                        </head>
                        <body>
                            <h1>Chat Export (${new Date(startTimestamp).toLocaleDateString()} - ${new Date(endTimestamp).toLocaleDateString()})</h1>
                            <p>Total messages: ${sorted.length}</p>
                            ${sorted.map(m => `
                                <div class="message">
                                    <span class="username">${m.chatname}</span>
                                    <span class="timestamp">${new Date(m.timestamp).toLocaleString()}</span>
                                    <p>${m.chatmessage}</p>
                                    ${m.hasDonation ? `<p>Donation: ${m.hasDonation}</p>` : ''}
                                </div>
                            `).join('')}
                        </body>
                        </html>
                    `;
                    break;
            }

            const blob = new Blob([content], { type: 'text/' + format });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            URL.revokeObjectURL(link.href);
        })
        .catch(error => {
            console.error('Error exporting messages:', error);
        })
        .finally(() => {
            exportButton.disabled = false;
            exportButton.textContent = 'Download';
        });
}

function setDefaultExportDates() {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);

    // valueAsDate uses UTC and can select tomorrow late in the local evening.
    const localDateValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    dateFilterFrom.value = localDateValue(lastMonth);
    dateFilterTo.value = localDateValue(today);
}

function clearFilters() {
    filters.search = '';
    filters.username = '';
    filters.keyword = '';
    filters.type = '';
    filters.dateFrom = null;
    filters.dateTo = null;
    filters.donationsOnly = false;
    filters.membershipsOnly = false;

    searchInput.value = '';
    typeFilter.value = '';
    usernameFilter.value = '';
    keywordFilter.value = '';
    messageDateFrom.value = '';
    messageDateTo.value = '';
    donationFilter.checked = false;
    membershipFilter.checked = false;

    debounceFilters();
}

function clearHistoryDirectly() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve({ ok: true });
        tx.onerror = () => reject(tx.error || new Error('Failed to clear saved message history'));
        tx.onabort = () => reject(tx.error || new Error('Saved message history clear was aborted'));
    });
}

function requestHistoryClear() {
    if (snapshotMode) {
        return new Promise((resolve, reject) => {
            const requestId = `clear-history-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const timeout = setTimeout(() => {
                window.removeEventListener('message', handleClearResult);
                reject(new Error('Timed out while deleting saved message history.'));
            }, 5000);
            const handleClearResult = event => {
                if (event.source !== window.parent || !event.data || event.data.type !== 'ssapp-chat-history-clear-result' || event.data.requestId !== requestId) return;
                clearTimeout(timeout);
                window.removeEventListener('message', handleClearResult);
                if (!event.data.ok) {
                    reject(new Error('The desktop app could not relay the history deletion.'));
                    return;
                }
                snapshotMessages = [];
                if (window.__ssappHistorySnapshotState) window.__ssappHistorySnapshotState.count = 0;
                resolve({ ok: true });
            };
            window.addEventListener('message', handleClearResult);
            window.parent.postMessage({ type: 'ssapp-chat-history-clear', requestId }, '*');
        });
    }
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        return clearHistoryDirectly();
    }
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'toBackground', data: { action: 'clearHistory', value: { confirm: true } } }, response => {
            const runtimeError = chrome.runtime.lastError;
            if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
            }
            resolve(response || { ok: false, error: 'No response from the extension.' });
        });
    });
}

async function clearSavedHistory() {
    if (!window.confirm('Permanently delete all saved message history? This also resets first-time chatter and last-activity history.')) {
        return;
    }
    clearHistoryButton.disabled = true;
    clearHistoryButton.textContent = 'Deleting...';
    try {
        const result = await requestHistoryClear();
        if (!result || result.ok !== true) {
            throw new Error(result && result.error ? result.error : 'Failed to clear saved message history.');
        }
        await resetAndLoadMessages();
        clearHistoryButton.textContent = 'History Deleted';
    } catch (error) {
        window.alert(error && error.message ? error.message : 'Failed to clear saved message history.');
        clearHistoryButton.textContent = 'Delete All History';
    } finally {
        clearHistoryButton.disabled = false;
    }
}

// Event listeners for filters
searchInput.addEventListener('input', () => {
    filters.search = searchInput.value.trim().toLowerCase();
    debounceFilters();
});

typeFilter.addEventListener('change', () => {
    filters.type = typeFilter.value.trim().toLowerCase();
    debounceFilters();
});

usernameFilter.addEventListener('input', () => {
    filters.username = usernameFilter.value.trim().toLowerCase();
    debounceFilters();
});

keywordFilter.addEventListener('input', () => {
    filters.keyword = keywordFilter.value.trim().toLowerCase();
    debounceFilters();
});

messageDateFrom.addEventListener('change', () => {
    filters.dateFrom = parseDateInput(messageDateFrom.value, false);
    debounceFilters();
});

messageDateTo.addEventListener('change', () => {
    filters.dateTo = parseDateInput(messageDateTo.value, true);
    debounceFilters();
});

donationFilter.addEventListener('change', () => {
    filters.donationsOnly = donationFilter.checked;
    debounceFilters();
});

membershipFilter.addEventListener('change', () => {
    filters.membershipsOnly = membershipFilter.checked;
    debounceFilters();
});

clearFiltersButton.addEventListener('click', clearFilters);
clearHistoryButton.addEventListener('click', clearSavedHistory);

messagesContainer.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    if (scrollTop <= 50 && !isLoading) {
        loadMoreMessages('up');
    }

    if (distanceFromBottom <= 50 && !isLoading) {
        loadMoreMessages('down');
    }
});

exportButton.addEventListener('click', () => {
    const format = exportFormat.value;
    exportMessages(format);
});

exportTimeframe.addEventListener('change', function () {
    const dateFilterContainer = document.getElementById('date-filter-container');
    dateFilterContainer.style.display = this.value === 'custom' ? 'inline-block' : 'none';
});

const databaseReady = snapshotMode
    ? snapshotReady.then(() => {
        updateTypeOptions(snapshotMessages || []);
        return null;
    })
    : initDatabase();

Promise.all([databaseReady, loadUnlimitedDBSetting()])
    .then(([result]) => {
        db = result;
        setDefaultExportDates();
        return resetAndLoadMessages();
    })
    .catch(error => console.error('Error initializing app:', error));
