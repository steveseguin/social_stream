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

function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 3); // Add version number to match db.js
        request.onerror = event => reject(event.target.error);
        request.onsuccess = event => {
            db = event.target.result;
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
    const filteredMessages = messages.filter(message =>
        message.chatname.toLowerCase().includes(searchTerm) ||
        message.type.toLowerCase().includes(searchTerm) ||
        message.chatmessage.toLowerCase().includes(searchTerm)
    );
    messagesContainer.innerHTML = filteredMessages.map(message => `
        <div class="message-wrapper" id="message-${message.id}">
            <div class="message">
                <img src="${message.chatimg}" alt="Avatar" class="avatar" data-error-hide="message">
                <div class="message-content">
                    <div class="message-header">
                        <span class="user-name">${message.chatname}</span>
                        <img src="./sources/images/${message.type}.png" alt="${message.type}" class="type-image" data-error-hide="self">
                        <span class="timestamp">${formatTimestamp(message.timestamp)}</span>
                    </div>
                    <p class="message-text">${message.chatmessage}</p>
                    ${message.contentimg ? `<img src="${message.contentimg}" alt="Content" class="content-image" data-error-hide="self">` : ''}
                    ${message.hasDonation ? `<p class="donation">Donation: ${message.hasDonation}</p>` : ''}
                </div>
            </div>
        </div>
    `).join('');
    messagesContainer.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', handleImageError);
    });
    checkAndLoadMore();
}
function handleImageError(event) {
    const img = event.target;
    const errorBehavior = img.getAttribute('data-error-hide');
    if (errorBehavior === 'message') {
        const messageWrapper = img.closest('.message-wrapper');
        if (messageWrapper) {
            messageWrapper.style.display = 'none';
        }
    } else if (errorBehavior === 'self') {
        img.style.display = 'none';
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
function exportMessages(format) {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredMessages = messages.filter(message =>
        message.chatname.toLowerCase().includes(searchTerm) ||
        message.type.toLowerCase().includes(searchTerm) ||
        message.chatmessage.toLowerCase().includes(searchTerm)
    );
    let content = '';
    let filename = `chat_export_${new Date().toISOString()}.${format}`;
    switch (format) {
        case 'json':
            content = JSON.stringify(filteredMessages, null, 2);
            break;
        case 'tsv':
            content = 'ID\tTimestamp\tUsername\tType\tMessage\tDonation\n' +
                filteredMessages.map(m =>
                    `${m.id}\t${m.timestamp}\t${m.chatname}\t${m.type}\t${m.chatmessage}\t${m.hasDonation || ''}`
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
}
document.getElementById('export-button').addEventListener('click', () => {
    const format = document.getElementById('export-format').value;
    exportMessages(format);
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
initDatabase()
    .then(result => {
        db = result;
        return loadMessages();
    })
    .then(loadedMessages => {
        messages = loadedMessages;
        totalPages = 1;
        renderMessages();
        checkAndLoadMore();
    })
    .catch(error => console.error("Error initializing app:", error));