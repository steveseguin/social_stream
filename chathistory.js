// chathistory.js
const DB_NAME = 'chatMessagesDB_v3';
const STORE_NAME = 'messages';
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const MAX_ITEMS = PAGE_SIZE * MAX_PAGES;
const FILTER_DEBOUNCE_MS = 300;

let db;
let messages = [];
let isLoading = false;
let newestTimestamp = null;
let oldestTimestamp = null;
let reachedNewest = false;
let reachedOldest = false;
const loadedMessageIds = new Set();
const knownTypes = new Set();
let filterDebounceHandle = null;

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
    const parsed = new Date(value);
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
            range: createRange(dateLower, upper, { excludeUpper: true })
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
            range: createRange(lower, dateUpper, { excludeLower: true })
        };
    }

    return { cursorDirection: null, range: null };
}

function messageMatchesFilters(message, activeFilters = filters) {
    if (!message) return false;

    if (activeFilters.search) {
        const term = activeFilters.search;
        const matchesGlobal = (message.chatname || '').toLowerCase().includes(term) ||
            (message.userid || '').toLowerCase().includes(term) ||
            (message.type || '').toLowerCase().includes(term) ||
            (message.chatmessage || '').toLowerCase().includes(term);
        if (!matchesGlobal) return false;
    }

    if (activeFilters.username) {
        if (!(message.chatname || '').toLowerCase().includes(activeFilters.username)) {
            return false;
        }
    }

    if (activeFilters.keyword) {
        if (!(message.chatmessage || '').toLowerCase().includes(activeFilters.keyword)) {
            return false;
        }
    }

    if (activeFilters.type) {
        if ((message.type || '').toLowerCase() !== activeFilters.type) {
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

function fetchMessages(direction = 'initial') {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');

        const { cursorDirection, range } = buildCursorConfig(direction);
        if (!cursorDirection) {
            resolve([]);
            return;
        }

        const results = [];
        const request = index.openCursor(range, cursorDirection);
        request.onsuccess = event => {
            const cursor = event.target.result;
            if (!cursor) {
                resolve(results.sort((a, b) => b.timestamp - a.timestamp));
                return;
            }

            const value = cursor.value;
            if (messageMatchesFilters(value)) {
                results.push(value);
            }

            if (results.length >= PAGE_SIZE) {
                resolve(results.sort((a, b) => b.timestamp - a.timestamp));
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
        const type = (message.type || '').toLowerCase();
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

    fresh.sort((a, b) => b.timestamp - a.timestamp);

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
                    <p class="message-text">${message.chatmessage || ''}</p>
                    ${message.contentimg ? `<img src="${message.contentimg}" alt="Content" class="content-image" data-error-hide="self">` : ''}
                    ${message.hasDonation ? `<p class="donation">Donation: ${message.hasDonation}</p>` : ''}
                    ${(message.membership || message.hasMembership) ? `<p class="membership">Membership: ${message.membership || message.hasMembership}</p>` : ''}
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
    if (!db) return;
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
    const previousScrollHeight = messagesContainer.scrollHeight;
    const previousScrollTop = messagesContainer.scrollTop;

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

        if (direction === 'up') {
            const newScrollHeight = messagesContainer.scrollHeight;
            messagesContainer.scrollTop = newScrollHeight - (previousScrollHeight - previousScrollTop);
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
    if (img.classList.contains('avatar')) {
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
            startDate.setDate(now.getDate() - 1);
            break;
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
                        sorted.map(m => `${m.id}\t${m.timestamp}\t${m.chatname}\t${m.userid || ''}\t${m.type}\t${m.chatmessage}\t${m.hasDonation || ''}`).join('\n');
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

    dateFilterFrom.valueAsDate = lastMonth;
    dateFilterTo.valueAsDate = today;
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

initDatabase()
    .then(result => {
        db = result;
        setDefaultExportDates();
        return resetAndLoadMessages();
    })
    .catch(error => console.error('Error initializing app:', error));
