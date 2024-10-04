const DB_NAME = 'chatMessagesDB';
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
function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = event => reject(event.target.error);
        request.onsuccess = event => resolve(event.target.result);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objStore = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
                objStore.createIndex("timestamp", "timestamp", { unique: false });
                objStore.createIndex("unique_user", ["chatname", "type"], { unique: false });
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
                    //console.log(`Loaded ${loadedMessages.length} messages for page ${page}, direction: ${direction}`);
                    resolve(loadedMessages);
                }
            } else {
                //console.log(`Finished loading. Got ${loadedMessages.length} messages for page ${page}, direction: ${direction}`);
                resolve(loadedMessages);
            }
        };
        cursorRequest.onerror = (event) => reject(event.target.error);
    });
}
function loadMoreMessages(direction) {
    //console.log(`Starting to load more messages: ${direction}`);
    if (isLoading) {
        //console.log('Already loading, returning early');
        return;
    }
    isLoading = true;
    //console.log('Set isLoading to true');
    const pageToLoad = direction === 'up' ? currentPage - 1 : currentPage + 1;
    //console.log(`Attempting to load page: ${pageToLoad}`);
    loadMessages(pageToLoad, direction)
        .then(newMessages => {
            //console.log(`Loaded ${newMessages.length} new messages`);
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
                //console.log(`Updated currentPage: ${currentPage}, totalPages: ${totalPages}, total messages: ${messages.length}`);
            } else {
                //console.log('No new messages loaded. Might have reached the end of available messages.');
            }
            isLoading = false;
            //console.log('Set isLoading back to false');
        })
        .catch(error => {
            console.error("Error loading more messages:", error);
            isLoading = false;
            //console.log('Set isLoading back to false after error');
        });
}
function removeOldMessages() {
    if (totalPages > MAX_PAGES) {
        const messagesToRemove = PAGE_SIZE;
        messages = messages.slice(messagesToRemove);
        totalPages--;
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
                    <span class="user-name">${message.chatname}</span>
                    <img src="./sources/images/${message.type}.png" alt="${message.type}" class="type-image" data-error-hide="self">
                    <p class="message-text">${message.chatmessage}</p>
                    ${message.contentimg ? `<img src="${message.contentimg}" alt="Content" class="content-image" data-error-hide="self">` : ''}
                    ${message.donation ? `<p class="donation">Donation: ${message.donation}</p>` : ''}
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
    //console.log(`Scroll Percentage: ${scrollPercentage.toFixed(2)}%`);
    if (scrollPercentage > 80 && !isLoading) {
        //console.log("Threshold met. Attempting to load more messages (DOWN)");
        loadMoreMessages('down');
    }
    if (messagesContainer.scrollTop === 0 && !isLoading) {
        //console.log("Loading more messages (UP)");
        loadMoreMessages('up');
    }
});
function checkAndLoadMore() {
    const containerHeight = messagesContainer.clientHeight;
    const contentHeight = messagesContainer.scrollHeight;
    //console.log(`Container height: ${containerHeight}, Content height: ${contentHeight}`);
    if (contentHeight <= containerHeight && !isLoading) {
        //console.log("Container not full, loading more messages");
        loadMoreMessages('down');
    } else {
        //console.log("Container is full or already loading");
    }
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