// chathistory.js
const DB_NAME = 'chatMessagesDB_v3';
const STORE_NAME = 'messages';
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
let db;
let messages = [];
let currentPage = 0;
let totalPages = 0;
let isLoading = false;
const searchInput = document.getElementById('search-input');
const messagesContainer = document.getElementById('messages-container');
const exportButton = document.getElementById('export-button');
const exportFormat = document.getElementById('export-format');
const exportTimeframe = document.getElementById('export-timeframe');
const dateFilterFrom = document.getElementById('date-filter-from');
const dateFilterTo = document.getElementById('date-filter-to');

function initDatabase() {
    return new Promise((resolve, reject) => {
        // First, try to open without version to detect current version
        const detectRequest = indexedDB.open(DB_NAME);
        
        detectRequest.onsuccess = event => {
            const detectedDb = event.target.result;
            const currentVersion = detectedDb.version;
            detectedDb.close();
            
            // Now open with the detected version (3 or 4)
            const request = indexedDB.open(DB_NAME, currentVersion);
            request.onerror = event => reject(event.target.error);
            request.onsuccess = event => {
                db = event.target.result;
                console.log(`Opened database version ${db.version}`);
                resolve(db);
            };
            request.onupgradeneeded = event => {
                const db = event.target.result;
                let store;
                
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp');
                    store.createIndex('user_timestamp', ['chatname', 'timestamp']);
                    store.createIndex('user_type_timestamp', ['chatname', 'type', 'timestamp']);
                } else {
                    // Get existing store for upgrades
                    const transaction = event.currentTarget.transaction;
                    store = transaction.objectStore(STORE_NAME);
                }
                
                // Add userid indexes only for version 4
                if (event.oldVersion < 4 && currentVersion >= 4 && store) {
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
            // If detection fails, try opening with version 3 as fallback
            const request = indexedDB.open(DB_NAME, 3);
            request.onerror = event => reject(event.target.error);
            request.onsuccess = event => {
                db = event.target.result;
                console.log(`Opened database version ${db.version} (fallback)`);
                resolve(db);
            };
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp');
                    store.createIndex('user_timestamp', ['chatname', 'timestamp']);
                    store.createIndex('user_type_timestamp', ['chatname', 'type', 'timestamp']);
                }
            };
        };
    });
}

function loadMessages(page = 0, direction = 'down') {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index("timestamp");
        const loadedMessages = [];
        const skipCount = page * PAGE_SIZE;
        const cursorDirection = direction === 'down' ? 'prev' : 'next';
        const cursorRequest = index.openCursor(null, cursorDirection);
        let count = 0;
        cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if (count < skipCount) {
                    count++;
                    cursor.continue();
                } else if (loadedMessages.length < PAGE_SIZE) {
                    loadedMessages.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(loadedMessages);
                }
            } else {
                resolve(loadedMessages);
            }
        };
        cursorRequest.onerror = (event) => reject(event.target.error);
    });
}
function loadMoreMessages(direction) {
    if (isLoading) {
        return;
    }
    isLoading = true;
    const pageToLoad = direction === 'up' ? currentPage - 1 : currentPage + 1;
    loadMessages(pageToLoad, direction)
        .then(newMessages => {
            if (newMessages.length > 0) {
                if (direction === 'up') {
                    messages = [...newMessages, ...messages];
                    currentPage--;
                } else {
                    messages = [...messages, ...newMessages];
                    currentPage++;
                }
                totalPages++;
                removeOldMessages();
                renderMessages();
                if (direction === 'up') {
                    const heightDiff = messagesContainer.scrollHeight - messagesContainer.scrollTop;
                    messagesContainer.scrollTop = messagesContainer.scrollHeight - heightDiff;
                }
            } else {
            }
            isLoading = false;
        })
        .catch(error => {
            console.error("Error loading more messages:", error);
            isLoading = false;
        });
}
function removeOldMessages() {
    if (totalPages > MAX_PAGES) {
        const messagesToRemove = PAGE_SIZE;
        messages = messages.slice(messagesToRemove);
        totalPages--;
    }
}
function formatTimestamp(timestamp) {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffInSeconds = Math.floor((now - messageDate) / 1000);
    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}d ago`;
    } else {
        return messageDate.toLocaleDateString();
    }
}
function renderMessages() {
    const searchTerm = searchInput.value.toLowerCase();
    console.log('Current messages array:', messages);
    
    const filteredMessages = searchTerm 
        ? messages.filter(message => {
            if (!message) return false;
            return (message.chatname || '').toLowerCase().includes(searchTerm) ||
                   (message.userid || '').toLowerCase().includes(searchTerm) ||
                   (message.type || '').toLowerCase().includes(searchTerm) ||
                   (message.chatmessage || '').toLowerCase().includes(searchTerm);
        })
        : messages;

    console.log('Filtered messages:', filteredMessages);
    
    messagesContainer.innerHTML = filteredMessages.map(message => {
        if (!message) return '';
        return `
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
                    </div>
                </div>
            </div>
        `;
    }).join('');
    messagesContainer.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', handleImageError);
    });
    checkAndLoadMore();
}
function handleImageError(event) {
    const img = event.target;
    img.style.display = 'none';
    
    // If it's an avatar, replace with default placeholder
    if (img.classList.contains('avatar')) {
        img.src = 'https://socialstream.ninja/sources/images/unknown.png';
        img.style.display = 'block';
    }
}

searchInput.addEventListener('input', renderMessages);
messagesContainer.addEventListener('scroll', () => {
    const scrollPosition = messagesContainer.scrollTop + messagesContainer.clientHeight;
    const totalHeight = messagesContainer.scrollHeight;
    const scrollPercentage = (scrollPosition / totalHeight) * 100;
    if (scrollPercentage > 80 && !isLoading) {
        loadMoreMessages('down');
    }
    if (messagesContainer.scrollTop === 0 && !isLoading) {
        loadMoreMessages('up');
    }
});
exportButton.addEventListener('click', () => {
    const format = exportFormat.value;
    exportMessages(format);
});
function checkAndLoadMore() {
    const containerHeight = messagesContainer.clientHeight;
    const contentHeight = messagesContainer.scrollHeight;
    if (contentHeight <= containerHeight && !isLoading) {
        loadMoreMessages('down');
    } else {
    }
}

function getDateRangeFromTimeframe(timeframe) {
    const now = new Date();
    const startDate = new Date();
    
    switch(timeframe) {
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
                return {
                    startDate: new Date(dateFilterFrom.value),
                    endDate: dateFilterTo.value ? new Date(dateFilterTo.value) : now
                };
            }
            startDate.setMonth(now.getMonth() - 1); // Default to 1 month if no date specified
            break;
        case 'all':
        default:
            startDate.setFullYear(startDate.getFullYear() - 10); // Effectively all messages
    }
    
    return { startDate, endDate: now };
}

function loadAllMessagesFiltered(startDate, endDate) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index("timestamp");
        
        const startTimestamp = startDate.getTime();
        const endTimestamp = endDate.getTime();
        const range = IDBKeyRange.bound(startTimestamp, endTimestamp);
        
        const messages = [];
        
        index.openCursor(range).onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                messages.push(cursor.value);
                cursor.continue();
            } else {
                resolve(messages);
            }
        };
        
        transaction.onerror = (event) => reject(event.target.error);
    });
}

function exportMessages(format) {
    const searchTerm = searchInput.value.toLowerCase();
    const timeframe = exportTimeframe.value;
    
    const { startDate, endDate } = getDateRangeFromTimeframe(timeframe);
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();
    
    // Show loading indicator
    exportButton.disabled = true;
    exportButton.textContent = 'Exporting...';
    
    loadAllMessagesFiltered(startDate, endDate)
        .then(allMessages => {
            const filteredMessages = searchTerm 
                ? allMessages.filter(message => 
                    (message.chatname || '').toLowerCase().includes(searchTerm) ||
                    (message.userid || '').toLowerCase().includes(searchTerm) ||
                    (message.type || '').toLowerCase().includes(searchTerm) ||
                    (message.chatmessage || '').toLowerCase().includes(searchTerm))
                : allMessages;
                
            let content = '';
            let filename = `chat_export_${new Date().toISOString()}.${format}`;
            
            switch (format) {
                case 'json':
                    content = JSON.stringify(filteredMessages, null, 2);
                    break;
                case 'tsv':
                    content = 'ID\tTimestamp\tUsername\tUserID\tType\tMessage\tDonation\n' +
                        filteredMessages.map(m =>
                            `${m.id}\t${m.timestamp}\t${m.chatname}\t${m.userid || ''}\t${m.type}\t${m.chatmessage}\t${m.hasDonation || ''}`
                        ).join('\n');
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
                            <h1>Chat Export (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})</h1>
                            <p>Total messages: ${filteredMessages.length}</p>
                            ${filteredMessages.map(m => `
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
            
            // Reset button
            exportButton.disabled = false;
            exportButton.textContent = 'Download';
        })
        .catch(error => {
            console.error("Error exporting messages:", error);
            exportButton.disabled = false;
            exportButton.textContent = 'Download';
        });
}

// Toggle custom date filter fields visibility
exportTimeframe.addEventListener('change', function() {
    const dateFilterContainer = document.getElementById('date-filter-container');
    if (this.value === 'custom') {
        dateFilterContainer.style.display = 'inline-block';
    } else {
        dateFilterContainer.style.display = 'none';
    }
});

function loadAllMessages() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onerror = event => reject(event.target.error);
        request.onsuccess = event => resolve(event.target.result);
    });
}

// Set default date values
function setDefaultDates() {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);
    
    dateFilterFrom.valueAsDate = lastMonth;
    dateFilterTo.valueAsDate = today;
}

initDatabase()
    .then(result => {
        db = result;
        setDefaultDates();
        return loadMessages();
    })
   .then(loadedMessages => {
        messages = loadedMessages;
        totalPages = 1;
        console.log('Initial messages loaded:', loadedMessages);
        renderMessages();
        checkAndLoadMore();
    })
    .catch(error => console.error("Error initializing app:", error));