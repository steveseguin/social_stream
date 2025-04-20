(function () {
  // Utility functions
  function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

 const messageDeduplication = {
    // Store messages with key format: "username:message"
    recentMessages: new Map(),
    // Maximum number of messages to keep in history per user
    maxMessagesPerUser: 10,
    // Time window in milliseconds to consider for duplication (default: 5 minutes)
    timeWindow: 31 * 60 * 1000,
    // Map to store user's message history
    userMessageHistory: new Map(),
    // Enable/disable deduplication
    enabled: true,
    
    // Check if message is a duplicate
    isDuplicate: function(username, message) {
      // If deduplication is disabled or invalid input, return false
      if (!this.enabled || !username || !message) return false;
      
      const key = `${username}:${message}`;
      const now = Date.now();
      
      // Check if this exact message was recently seen
      if (this.recentMessages.has(key)) {
        const timestamp = this.recentMessages.get(key);
        // If message is within the time window, it's a duplicate
        if (now - timestamp < this.timeWindow) {
          return true;
        }
      }
      
      // Update the message timestamp
      this.recentMessages.set(key, now);
      
      // Update user message history
      if (!this.userMessageHistory.has(username)) {
        this.userMessageHistory.set(username, []);
      }
      
      const userMessages = this.userMessageHistory.get(username);
      userMessages.push({ message, timestamp: now });
      
      // Keep only recent messages up to maxMessagesPerUser
      if (userMessages.length > this.maxMessagesPerUser) {
        userMessages.shift(); // Remove oldest message
      }
      
      this.userMessageHistory.set(username, userMessages);
      
      return false;
    },
    
    // Clean up old messages outside the time window
    cleanupOldMessages: function(currentTime) {
      const cutoffTime = currentTime - this.timeWindow;
      
      // Clean up recentMessages map
      for (const [key, timestamp] of this.recentMessages.entries()) {
        if (timestamp < cutoffTime) {
          this.recentMessages.delete(key);
        }
      }
      
      // Clean up userMessageHistory map
      for (const [username, messages] of this.userMessageHistory.entries()) {
        const filteredMessages = messages.filter(msg => msg.timestamp >= cutoffTime);
        
        if (filteredMessages.length === 0) {
          this.userMessageHistory.delete(username);
        } else {
          this.userMessageHistory.set(username, filteredMessages);
        }
      }
    },
    
    // Get statistics about current deduplication
    getStats: function() {
      return {
        totalTrackedMessages: this.recentMessages.size,
        uniqueUsers: this.userMessageHistory.size,
        oldestMessage: this.getOldestMessageTime()
      };
    },
    
    // Find the oldest message timestamp
    getOldestMessageTime: function() {
      let oldest = Date.now();
      
      for (const timestamp of this.recentMessages.values()) {
        if (timestamp < oldest) {
          oldest = timestamp;
        }
      }
      
      return oldest;
    }
  };
  
  // Enhanced getAllContentNodes function with better filtering
  function getAllContentNodes(element) {
    if (!element) return "";
    let resp = "";
    
    // Skip time-related and metadata elements
    if (element.tagName === 'SMALL' || 
        element.tagName === 'I' && element.querySelector('small') ||
        element.classList && (
          element.classList.contains('timestamp') || 
          element.classList.contains('time') ||
          element.classList.contains('metadata') ||
          element.classList.contains('info')
        )) {
      return "";
    }
    
    // Direct text node handling
    if (!element.children || element.children.length === 0) {
      if (element.textContent) {
        return escapeHtml(element.textContent) || "";
      } else {
        return "";
      }
    }
    
    // Process child nodes with better filtering
    Array.from(element.childNodes).forEach(node => {
      // Skip metadata elements with expanded detection
      if (node.nodeType === 1 && ( 
          node.tagName === 'SMALL' || 
          node.tagName === 'I' || 
          node.tagName === 'TIME' ||
          (node.classList && (
            node.classList.contains('timestamp') || 
            node.classList.contains('time') ||
            node.classList.contains('metadata') ||
            node.classList.contains('date') ||
            node.classList.contains('info')
          ))
        )) {
        return;
      }
      
      if (node.childNodes && node.childNodes.length) {
        resp += getAllContentNodes(node);
      } else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)) {
        resp += escapeHtml(node.textContent);
      } else if (node.nodeType === 1) {
        if (!settings.textonlymode) {
          if ((node.nodeName == "IMG") && node.src) {
            node.src = node.src + "";
            resp += node.outerHTML;
          }
        }
      }
    });
    return resp;
  }

  function toDataURL(url, callback) {
    if (!url || url.startsWith('data:')) {
      callback(url);
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      var blob = xhr.response;
      
      if (!blob || blob.size > (25 * 1024)) {
        callback(url); // Image size is larger than 25kb.
        return;
      }

      var reader = new FileReader();
      reader.onloadend = function() {
        callback(reader.result);
      };
      reader.onerror = function() {
        callback(url);
      };
      reader.readAsDataURL(blob);
    };
    xhr.onerror = function() {
      callback(url);
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
  }

  // Expanded common chat message selectors
  const MESSAGE_SELECTORS = [
    '.chat-message', '.message', '[class*="message"]', '[class*="chat"]', 
    '.comment', '[class*="comment"]', '.msg', '.user-card', 
    '[data-message]', '[data-chat]', '[class*="Message"]', '.inMessage', 
    '.outMessage', '.ui-chat__item--message', '[class*="ChatRow"]', 
    '[class*="ChatItem"]', '.chatrow', '[class*="chatItem"]', 
    '[class*="chatMessage"]', '[class*="message-item"]', '.activity-item', 
    '[class*="chat__item"]', '[class*="chat-item"]', '[data-lcmessage]', 
    '.chat__message', '.user-text-content', '.VideoChat-module__message', 
    'li[tabindex]', '.live-message-body', '.tw-comment-item',
    '.MessageRow', '.user-card__body', '.danmaku-item',
    // New modern selectors
    '.chat-line__message', '.chat-entry', '.chat-history-panel__message',
    '.stream-chat-message', '[data-a-target="chat-line-message"]',
    '[role="row"]', '[data-testid="chat-message"]', '[data-testid="message"]',
    '.message-container .message-bubble', '[data-testid="message-container"]',
    '.messageListItem', '[data-type="chat-message"]', '.EmojiChat-item',
    '[class*="streamChatMessage"]', '.css-chat-message', '.chat-item-user',
    '.pl-3', '.nx-comment-item', '.nx-chat-item', '.chat-history-message',
    '[data-role="message-container"]', '.c-chat-message',
    '.ChatMessageEntry', '.YouTubeChatEntry', '.YoutubeComment',
    '[data-purpose="chat-message-container"]', '.livelike-message-content'
  ];

  // Expanded username selectors
  const USERNAME_SELECTORS = [
    '.chat-username', '.username', '.user-name', '.author', '.nme', 
    '.sender-name', '[class*="username"]', '[class*="user-name"]', 
    '[class*="author"]', '[class*="sender"]', '[class*="nickname"]', 
    '[class*="name"]', '[data-username]', '[data-author]', '.chat-user-name',
    '.message-username', '.chat__message__username', '.comment-author-name', 
    '.chat-user-name', '[class*="Username"]', '.VideoChat-module__ownerName', 
    '.tw-comment-item-name', '.sender-name', '.annoto-comment-author-name',
    '[property="sender.name"]', '.message-profile-name', '.dlive-name__text',
    '.dlive-name', '[class*="ChatMessageAuthorPanel_name"]',
    '.live-message-body-author',
    // New modern selectors
    '.chat-author__display-name', '[data-a-target="chat-message-username"]',
    '.chat-message__sender', '.chat-author-name', '[class*="chatSenderName"]',
    '[data-testid="username"]', '[data-testid="author-name"]',
    '.sender-name-container', '[class*="authorName"]', '.message-sender',
    '.message-author', '.csm-author', '.chat-history-author',
    '.bubble-username', '.comment-author', '[data-role="display-name"]',
    '.userName', '.chat-entry-author', '[data-role="author"]',
    '.css-chat-author', '.c-chat-author', '.chat-name', '.twitch-chat-name',
    '[class*="userDisplay"]', '.user-badge-label', '.user-id'
  ];

  // Expanded avatar selectors
  const AVATAR_SELECTORS = [
    '.avatar img', '.profile-img', '.user-avatar', '.profile-picture', '.pic',
    'img.avatar', 'img[class*="avatar"]', 'img[class*="profile"]', '.image img',
    '.user-img', '[class*="profile"] img', '[class*="avatar"] img', 
    '[class*="user"] img', '.v-avatar .v-image', '[class*="Avatar"] img', 
    'img.profile-icon-image', '.MuiAvatar-img', '[property="sender.avatar"]',
    '.tw-comment-item-icon img', '.md-avatar-wrapper img', '.rounded-full',
    '[data-part="avatar"] img', '.sc-1f9oe74-3 img',
    // New modern selectors
    '[data-testid="user-avatar"]', '.chat-author__avatar img',
    '.chat-line__message-image', '.user-avatar-container img',
    '[class*="userAvatar"]', '.profile-thumbnail img',
    '[data-a-target="chat-avatar"]', '.chat-message-avatar img',
    '.display-pic-image', '.chat-badge', '.chat-author-avatar',
    '.message-avatar', '.avatar-container img', '.author-avatar',
    '.css-avatar img', '.user-profile-picture', '.user-pic',
    '[class*="avatarContainer"] img', '.chat-author-avatar-container img',
    '.message-bubble-avatar', '.profile-pic-container img'
  ];

  // Expanded message content selectors
  const MESSAGE_CONTENT_SELECTORS = [
    '.message-text', '.chat-text', '.message-content', '.content',
    '.text', '.body', '.comment-text', '[class*="message-text"]',
    '[class*="chat-text"]', '[class*="content"]', '[class*="message-body"]',
    '.user-text-content', '[class*="MessageText"]', '[data-text="true"]',
    '[class*="message__text"]', '[class*="comment__text"]',
    '.VideoChat-module__messageText', '.tw-comment-item-comment',
    '.activity-item-message', '[data-role="messageMainContent"]',
    '.annoto-comment-body', '.break-words', '.chat_message',
    '[property*="message"]', '.danmaku-item-right', '.linkify',
    '.jclrku-5 span','.chat_message', '.chat_sent', '.message-bubble',
    '[class*="chat_message"]', '[class*="message-content"]',
    '[class*="message-text"]', '[class*="ChatMessage"]',
    // New modern selectors
    '.chat-line__message-body', '.chat-message__body',
    '.chat-message-content', '[data-a-target="chat-message-text"]',
    '.message-fragment', '.chat-message__message',
    '[data-testid="message-text"]', '.text-fragment',
    '.message-container-text', '[class*="chatMessageText"]',
    '.chat-text-normal', '.chat-message-text', '.comment-content',
    '.css-chat-message-text', '.message-text-content',
    '.c-chat-content', '.chat-bubble-text', '.message-body-text',
    '[class*="messageText"]', '.message-content-body',
    '[data-role="message-text"]', '.stream-chat-message-text',
    '.chat-message__html', '.chat-history-message-body'
  ];

  function pushMessage(data) {
    try {
      chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e) {});
    } catch(e) {
      console.error("Error sending message:", e);
    }
  }
  
  // Settings and message passing
  var settings = {
    textonlymode: false,
    captureevents: true
  };
  
  chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response) {
    if (response && "settings" in response) {
      settings = response.settings;
    }
  });
  
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      try {
        if ("focusChat" == request) {
          // Enhanced chat input detection
          const inputSelectors = [
            'textarea', 'textarea[placeholder]', 'input[type="text"][placeholder]', 
            '.chat-input', '[contenteditable="true"]', 
            'textarea.comment-sender_input', 'textarea#commentField',
            'input[type="text"][name*="chat"]', '.public-DraftEditor-content',
            '.chat-input-wrapper > textarea', '#chat-input',
            '#chatInput', '#type-a-message', '#interaction-chat-input-field',
            'div[class^="style-text-container-"]>textarea', 
            "ds-text-editor shadowRoot div[contenteditable='true']",
            '.chatInput', "#write_area",
            // New modern selectors
            '[data-a-target="chat-input"]', '.chat-input__textarea',
            '[data-testid="chat-input"]', '.stream-chat-input',
            '[placeholder*="chat"]', '[placeholder*="message"]',
            '[placeholder*="say something"]', '.chat-composer',
            '#live-comment-input', '.chat-input-field',
            '[data-role="chat-input"]', '.css-chat-input',
            '[data-purpose="chat-input"]', '.c-chat-input textarea',
            '[aria-label*="chat"]', '[aria-label*="message"]',
            '.message-input', '#chatbox'
          ];
          
          for (const selector of inputSelectors) {
            try {
              const inputs = document.querySelectorAll(selector);
              if (inputs && inputs.length) {
                for (const input of inputs) {
                  if (input && input.isConnected) {
                    input.focus();
                    sendResponse(true);
                    return;
                  }
                }
              }
            } catch (e) {}
          }
          
          // Improved shadow root traversal
          try {
            const potentialShadowHosts = Array.from(document.querySelectorAll('*'))
              .filter(el => el.tagName.includes('-') || el.tagName.toLowerCase() === 'slot');
              
            for (const host of potentialShadowHosts) {
              if (host.shadowRoot) {
                for (const selector of inputSelectors) {
                  const shadowInput = host.shadowRoot.querySelector(selector);
                  if (shadowInput) {
                    shadowInput.focus();
                    sendResponse(true);
                    return;
                  }
                }
              }
            }
          } catch (e) {}
          
          sendResponse(false);
          return;
        }
        
        if (typeof request === "object") {
          if ("settings" in request) {
            settings = request.settings;
            sendResponse(true);
            return;
          }
        }
      } catch(e) {}
      
      sendResponse(false);
    }
  );

  // Enhanced chat learning system
  const chatLearning = {
    namePatterns: new Map(),
    messagePatterns: new Map(),
    nameCache: new Map(),
    messageCache: new Map(),
    nameDuplications: new Map(),
    messageMatchesName: 0,
    usernameStats: {
      avgLength: 0,
      totalNames: 0,
      // Added statistics
      lengthDistribution: new Map(),
      commonPrefixes: new Map(),
      commonFormats: new Map()
    },
    messageStats: {
      avgLength: 0, 
      totalMessages: 0,
      // Added statistics
      lengthDistribution: new Map(),
      commonStarting: new Map()
    },
    
    // Improved learning system
    learnFromSuccess: function(element, nameSelector, messageSelector, name, message) {
      if (!element || !name || !message) return;
      
      // Update selector success counters
      if (nameSelector) {
        this.namePatterns.set(nameSelector, (this.namePatterns.get(nameSelector) || 0) + 1);
      }
      
      if (messageSelector) {
        this.messagePatterns.set(messageSelector, (this.messagePatterns.get(messageSelector) || 0) + 1);
      }
      
      // Update username statistics with enhanced tracking
      this.nameCache.set(name, (this.nameCache.get(name) || 0) + 1);
      this.usernameStats.totalNames++;
      this.usernameStats.avgLength = ((this.usernameStats.avgLength * (this.usernameStats.totalNames - 1)) + name.length) / this.usernameStats.totalNames;
      
      // Track username length distribution
      const nameLength = name.length;
      this.usernameStats.lengthDistribution.set(
        nameLength, 
        (this.usernameStats.lengthDistribution.get(nameLength) || 0) + 1
      );
      
      // Track common name formats (special characters, patterns)
      if (name.match(/^\w+$/)) {
        this.usernameStats.commonFormats.set(
          'alphanumeric', 
          (this.usernameStats.commonFormats.get('alphanumeric') || 0) + 1
        );
      } else if (name.includes(' ')) {
        this.usernameStats.commonFormats.set(
          'space-separated', 
          (this.usernameStats.commonFormats.get('space-separated') || 0) + 1
        );
      }
      
      // Track username prefixes (first 3 chars)
      if (name.length >= 3) {
        const prefix = name.substring(0, 3);
        this.usernameStats.commonPrefixes.set(
          prefix, 
          (this.usernameStats.commonPrefixes.get(prefix) || 0) + 1
        );
      }
      
      // Enhanced message statistics
      const messageSignature = this.getMessageSignature(message);
      this.messageCache.set(messageSignature, (this.messageCache.get(messageSignature) || 0) + 1);
      this.messageStats.totalMessages++;
      this.messageStats.avgLength = ((this.messageStats.avgLength * (this.messageStats.totalMessages - 1)) + message.length) / this.messageStats.totalMessages;
      
      // Track message length distribution
      const msgLength = message.length;
      this.messageStats.lengthDistribution.set(
        msgLength, 
        (this.messageStats.lengthDistribution.get(msgLength) || 0) + 1
      );
      
      // Track common message starts
      if (message.length >= 5) {
        const msgStart = message.substring(0, 5);
        this.messageStats.commonStarting.set(
          msgStart, 
          (this.messageStats.commonStarting.get(msgStart) || 0) + 1
        );
      }
    },
    
    // Improved message signature function
    getMessageSignature: function(message) {
      if (!message) return "empty";
      
      // Create a more robust signature
      const shortened = message.substring(0, 20);
      
      // Add pattern detection
      let type = "text";
      if (message.match(/^[A-Z0-9\s!]+$/)) {
        type = "uppercase";
      } else if (message.includes("http") || message.includes("www.")) {
        type = "url";
      } else if (message.match(/^\p{Emoji}/u)) {
        type = "emoji";
      }
      
      return `len:${message.length} type:${type} starts:${shortened}`;
    },
    
    // Improved name/message duplication handler
    handleNameMessageDuplication: function(name, message, nameSelector, msgSelector) {
      if (!name || !message) return null;
      
      // Duplication detection
      if (name === message || message.startsWith(name + ": ")) {
        this.messageMatchesName++;
        const duplicationKey = `${nameSelector || "unknown"}|${msgSelector || "unknown"}`;
        
        // Track this duplication pattern
        this.nameDuplications.set(
          duplicationKey, 
          (this.nameDuplications.get(duplicationKey) || 0) + 1
        );
        
        // Analyze pattern frequency
        const patternCount = this.nameDuplications.get(duplicationKey) || 0;
        
        if (patternCount >= 2) {
          // Name length heuristics (more advanced)
          const isLikelyName = name.length < 25 && 
                               (name.length <= this.usernameStats.avgLength * 1.5);
                               
          // Message patterns
          const nameFrequency = this.nameCache.get(name) || 0;
          const isCommonName = nameFrequency > 1;
          
          // If message starts with name followed by colon, it's a formatting issue
          if (message === name) {
            // Just the name, likely not a valid message
            if (isLikelyName || isCommonName) {
              return { validName: name, validMessage: null };
            }
          } else if (message.startsWith(name + ": ")) {
            // Message includes name prefix, extract the actual message
            const actualMessage = message.substring(name.length + 2).trim();
            if (actualMessage) {
              return { validName: name, validMessage: actualMessage };
            }
          }
          
          // Message vs name length heuristic
          const msgLengthRatio = message.length / name.length;
          if (msgLengthRatio > 3) {
            // Message is much longer - likely valid message with name prefix
            const possibleMessage = message.replace(name, "").replace(/^[:]\s*/, "").trim();
            if (possibleMessage) {
              return { validName: name, validMessage: possibleMessage };
            }
          }
        }
      }
      
      // No duplication detected
      return { validName: name, validMessage: message };
    },
    
    // Improved extraction validation
    validateExtraction: function(name, message, nameSelector, msgSelector) {
      if (!name || !message) return false;
      
      // Check reasonable lengths
      if (name.length > 40) return false;
      
      // Handle the case where name equals message
      if (name === message || message.startsWith(name)) {
        const validParts = this.handleNameMessageDuplication(name, message, nameSelector, msgSelector);
        if (validParts) {
          if (!validParts.validMessage) return false;
          if (validParts.validMessage !== message) {
            // We have a corrected message - we should update it
            message = validParts.validMessage;
          }
        }
      }
      
      // Known patterns for outgoing messages
      const outgoingPatterns = ['chat_sent', 'outMessage', 'outgoing', 'sent'];
      const isOutgoing = msgSelector && outgoingPatterns.some(pattern => msgSelector.includes(pattern));
      
      if ((name.toLowerCase() === "you" || name.toLowerCase() === "me") && isOutgoing) {
        return true; // Valid outgoing message
      }
      
      // Improve message cleaning when it contains the name
      if (message.startsWith(name) && message.length > name.length + 2) {
        // Strip the name prefix from the message if it starts with it
        message = message.substring(name.length).replace(/^[:]\s*/, "").trim();
      }
      
      // Enhanced validation using learned patterns
      const nameFrequency = this.nameCache.get(name) || 0;
      
      // Names with higher frequency are more likely valid
      if (nameFrequency >= 2) return true;
      
      // Check length distributions
      if (this.usernameStats.totalNames > 10) {
        // Get most common name length 
        const mostCommonLength = Array.from(this.usernameStats.lengthDistribution.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0];
          
        // If name length is very different from most common, be suspicious
        if (mostCommonLength && Math.abs(name.length - mostCommonLength) > 10) {
          // But if it's a frequent name, accept it anyway
          if (nameFrequency < 2) return false;
        }
      }
      
      // Message should typically be longer than name
      if (message.length < name.length && message.length < 10) {
        return false;
      }
      
      return true;
    },
    
    // Get best selectors with improved ranking
    getBestNameSelectors: function() {
      // Weight recent successes more heavily
      return Array.from(this.namePatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(entry => entry[0]);
    },
    
    getBestMessageSelectors: function() {
      return Array.from(this.messagePatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(entry => entry[0]);
    }
  };

  // Improved message processing function
  function processMessage(ele) {
    if (!ele || ele.processed || !ele.isConnected) return;
    ele.processed = true;
    
    // Handle container elements
    const containerClasses = ['chat-list', 'message-list', 'comments-list', 'chat-history'];
    if (ele.tagName === 'UL' || ele.tagName === 'OL' || 
        (ele.classList && containerClasses.some(cls => ele.classList.contains(cls)))) {
      const messageElements = ele.querySelectorAll(MESSAGE_SELECTORS.join(','));
      if (messageElements.length) {
        messageElements.forEach(messageEle => {
          if (!messageEle.processed && messageEle !== ele) {
            setTimeout(() => processMessage(messageEle), 10);
          }
        });
        return;
      }
    }
    
    // Extract username with priority-based approach
    let name = "";
    let nameElement = null;
    let nameSelector = null;
    
    // First try learned selectors (higher success rate)
    const bestNameSelectors = chatLearning.getBestNameSelectors();
    for (const selector of bestNameSelectors) {
      try {
        const element = ele.querySelector(selector);
        if (element && element.textContent && element.textContent.trim()) {
          name = element.textContent.trim();
          nameElement = element;
          nameSelector = selector;
          break;
        }
      } catch (e) {}
    }
    
    // Try common username selectors if learned ones failed
    if (!name) {
      for (const selector of USERNAME_SELECTORS) {
        try {
          const element = ele.querySelector(selector);
          if (element && element.textContent && element.textContent.trim()) {
            name = element.textContent.trim();
            nameElement = element;
            nameSelector = selector;
            break;
          }
        } catch (e) {}
      }
    }
    
    // Try platform-specific patterns
    if (!name) {
      // Check for TikTok/Zapstream style direct elements
      try {
        const directSpan = ele.querySelector(":scope > a > span, :scope > div > a > span");
        if (directSpan && directSpan.textContent && directSpan.textContent.trim()) {
          name = directSpan.textContent.trim();
          nameElement = directSpan;
          nameSelector = "direct-span";
        }
      } catch (e) {}
      
      // Check for Discord-style message components
      try {
        const messageHeader = ele.querySelector('[class*="header"], [class*="Header"], [class*="heading"]');
        if (messageHeader) {
          const headerName = messageHeader.querySelector('[class*="name"], [class*="Name"], [class*="author"], [class*="Author"]');
          if (headerName && headerName.textContent && headerName.textContent.trim()) {
            name = headerName.textContent.trim();
            nameElement = headerName;
            nameSelector = "message-header-name";
          }
        }
      } catch (e) {}
    }
    
    // Try attribute-based username extraction (for data-* attributes)
    if (!name) {
      const usernameAttributes = [
        'data-username', 'data-user', 'data-author', 'data-sender', 
        'data-from', 'data-display-name', 'aria-label'
      ];
      
      for (const attr of usernameAttributes) {
        if (ele.hasAttribute(attr)) {
          const attrValue = ele.getAttribute(attr);
          if (attrValue && attrValue.trim()) {
            name = attrValue.trim();
            nameSelector = `[${attr}]`;
            break;
          }
        }
      }
    }
    
    // Try direct child heuristics for special cases
    if (!name) {
      try {
        // Look for bold text as a potential username
        const boldText = ele.querySelector('b, strong, [style*="bold"], [style*="font-weight: 600"], [style*="font-weight:600"]');
        if (boldText && boldText.textContent && boldText.textContent.trim().length < 30) {
          name = boldText.textContent.trim();
          nameElement = boldText;
          nameSelector = "bold-text";
        }
      } catch (e) {}
    }
    
    // Try text pattern matching (e.g., "Username: Message")
    if (!name && ele.textContent && ele.textContent.includes(":")) {
      try {
        const textContent = ele.textContent.trim();
        const colonIndex = textContent.indexOf(":");
        
        // Only use this if the colon is in the first half of the text
        if (colonIndex > 0 && colonIndex < textContent.length / 2) {
          name = textContent.substring(0, colonIndex).trim();
          nameSelector = "text-pattern";
        }
      } catch (e) {}
    }
    
    // Clean username
    name = cleanName(escapeHtml(name));
    
    // Extract name color if available
    let nameColor = "";
    if (nameElement) {
      try {
        nameColor = getComputedStyle(nameElement).color || "";
      } catch (e) {}
    }
    
    // Extract message content with priority approach
    let msg = "";
    let msgElement = null;
    let msgSelector = null;
    
    // First try learned message selectors
    const bestMessageSelectors = chatLearning.getBestMessageSelectors();
    for (const selector of bestMessageSelectors) {
      try {
        const element = ele.querySelector(selector);
        if (element) {
          msg = getAllContentNodes(element);
          msgElement = element;
          msgSelector = selector;
          break;
        }
      } catch (e) {}
    }
    
    // Try common message content selectors if learned ones failed
    if (!msg) {
      for (const selector of MESSAGE_CONTENT_SELECTORS) {
        try {
          const element = ele.querySelector(selector);
          if (element) {
            msg = getAllContentNodes(element);
            msgElement = element;
            msgSelector = selector;
            break;
          }
        } catch (e) {}
      }
    }
    
    // Try platform-specific message patterns
    if (!msg) {
      // Try for TikTok/Zapstream direct message structure
      try {
        const titleSpans = ele.querySelectorAll(":scope > span[title] > span, :scope > div > span[title] > span");
        if (titleSpans.length) {
          let combinedText = "";
          titleSpans.forEach(span => {
            combinedText += getAllContentNodes(span);
          });
          
          if (combinedText.trim()) {
            msg = combinedText;
            msgSelector = "title-spans";
          }
        }
      } catch (e) {}
      
      // Try Discord-style message content
      try {
        const messageContent = ele.querySelector('[class*="content"], [class*="Content"], [class*="message-body"], [class*="messageBody"]');
        if (messageContent) {
          const contentText = getAllContentNodes(messageContent);
          if (contentText.trim()) {
            msg = contentText;
            msgSelector = "message-content";
          }
        }
      } catch (e) {}
    }
    
    // Try non-username child elements (for simpler layouts)
    if (!msg) {
      try {
        let childMessage = "";
        let isFirst = true;
        
        Array.from(ele.children).forEach(child => {
          // Skip already identified username element
          if (child === nameElement) return;
          
          // Skip elements that match username selectors
          for (const selector of USERNAME_SELECTORS) {
            try {
              if (child.matches(selector) || child.querySelector(selector)) return;
            } catch (e) {}
          }
          
          // Skip avatar and metadata elements
          if (child.querySelector(AVATAR_SELECTORS.join(',')) || 
              child.classList && (
                child.classList.contains('avatar') || 
                child.classList.contains('metadata') ||
                child.classList.contains('time') ||
                child.classList.contains('timestamp')
              )) {
            return;
          }
          
          const childText = getAllContentNodes(child);
          if (childText.trim()) {
            // If this is our first content, check if it contains the name
            if (isFirst && name && childText.startsWith(name)) {
              // This might be combined name+message
              const potentialMessage = childText.substring(name.length).replace(/^[:]\s*/, "").trim();
              if (potentialMessage) {
                childMessage = potentialMessage;
                msgSelector = "name-stripped";
                return; // Found the message, stop processing
              }
            }
            
            childMessage += (childMessage ? " " : "") + childText;
            isFirst = false;
          }
        });
        
        if (childMessage.trim()) {
          msg = childMessage;
          msgSelector = msgSelector || "child-content";
        }
      } catch (e) {}
    }
    
    // Text pattern matching fallback
    if (!msg && ele.textContent && ele.textContent.includes(':') && name) {
      try {
        const textContent = ele.textContent.trim();
        const nameIndex = textContent.indexOf(name);
        
        if (nameIndex === 0) {
          // Format: "Name: Message"
          const afterName = textContent.substring(name.length).trim();
          if (afterName.startsWith(':')) {
            msg = escapeHtml(afterName.substring(1).trim());
            msgSelector = "name-colon-text";
          }
        } else {
          // Try to find text after any colon
          const colonIndex = textContent.indexOf(":");
          if (colonIndex > 0 && colonIndex < textContent.length - 1) {
            msg = escapeHtml(textContent.substring(colonIndex + 1).trim());
            msgSelector = "colon-text";
          }
        }
      } catch (e) {}
    }
	
	if (!msg) {
	  try {
		// Check for common chat message patterns with display containers
		const messageContainers = [
		  ele.querySelector('.chat_message'),
		  ele.querySelector('[class*="chat_message"]'),
		  ele.querySelector('[class*="message-text"]'),
		  ele.querySelector('[class*="message-content"]')
		];
		
		for (const container of messageContainers) {
		  if (container && container.textContent && container.textContent.trim()) {
			msg = getAllContentNodes(container);
			msgElement = container;
			msgSelector = "direct-message-class";
			break;
		  }
		}
	  } catch (e) {}
	}

	// Handle potential hidden username elements
	if (!name) {
	  try {
		// Look for hidden username elements that might be styled as display:none
		const hiddenUsers = ele.querySelectorAll('span[style*="display:none"], [style*="visibility:hidden"]');
		for (const hidden of hiddenUsers) {
		  if (hidden && hidden.textContent && hidden.textContent.trim()) {
			name = hidden.textContent.trim();
			nameElement = hidden;
			nameSelector = "hidden-username";
			break;
		  }
		}
	  } catch (e) {}
	}

	// Enhanced handling for message containers with special classes
	if (ele.classList) {
	  const specialClasses = ['outMessage', 'inMessage', 'sentMessage', 'receivedMessage'];
	  for (const className of specialClasses) {
		if (ele.classList.contains(className)) {
		  // Handle "You:" or other prefixes in hidden spans
		  if (!name) {
			const hiddenName = ele.querySelector('[style*="display:none"]');
			if (hiddenName && hiddenName.textContent) {
			  name = hiddenName.textContent.trim();
			  nameSelector = "platform-specific-name";
			} else if (className === 'outMessage') {
			  name = "You";
			  nameSelector = "implied-user";
			}
		  }
		  
		  // Prioritize .chat_message or similar classes
		  if (!msg) {
			const chatMsg = ele.querySelector('.chat_message, [class*="chat_message"], [class*="message-content"]');
			if (chatMsg && chatMsg.textContent) {
			  msg = getAllContentNodes(chatMsg);
			  msgElement = chatMsg;
			  msgSelector = "platform-message";
			}
		  }
		}
	  }
	}
    
    // Final cleaning of message
    msg = cleanMessage(msg.trim());
    
    // Skip if no message content or validation fails
    if (!msg || !chatLearning.validateExtraction(name, msg, nameSelector, msgSelector)) {
      return;
    }
    
    // Handle case where name is in message (improved)
    if (name && msg.startsWith(name)) {
      // Try to fix the common "Name: Message" format being captured entirely
      const remainingMsg = msg.substring(name.length).trim();
      if (remainingMsg.startsWith(':')) {
        msg = remainingMsg.substring(1).trim();
      }
    }
    
    // Learn from successful extraction
    chatLearning.learnFromSuccess(ele, nameSelector, msgSelector, name, msg);
    
    // Enhanced avatar extraction
    let chatimg = "";
    
    // Try common avatar selectors
    for (const selector of AVATAR_SELECTORS) {
      try {
        const element = ele.querySelector(selector);
        if (element && element.src) {
          chatimg = element.src;
          break;
        }
      } catch (e) {}
    }
    
    // Try direct child avatar patterns
    if (!chatimg) {
      try {
        const directImg = ele.querySelector(":scope > a > img[src], :scope > div > a > img[src]");
        if (directImg) {
          chatimg = directImg.src;
        }
      } catch (e) {}
    }
    
    // Try any image in the message element that's likely an avatar
    if (!chatimg) {
      try {
        const images = ele.querySelectorAll('img[src]');
        for (const img of images) {
          // Skip images that are likely emojis or icons (small or from emoji domains)
          const imgSrc = img.src.toLowerCase();
          const isEmoji = imgSrc.includes('emoji') || 
                        imgSrc.includes('icon') || 
                        img.width < 16 || 
                        img.height < 16;
                        
          if (!isEmoji) {
            chatimg = img.src;
            break;
          }
        }
      } catch (e) {}
    }
    
    // Try background-image avatars
    if (!chatimg) {
      try {
        const bgElements = ele.querySelectorAll('[style*="background-image"]');
        for (const bgElement of bgElements) {
          const style = getComputedStyle(bgElement);
          const bgImage = style.backgroundImage;
          if (bgImage && bgImage !== 'none') {
            chatimg = bgImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
            break;
          }
        }
      } catch (e) {}
    }
    
    // Enhanced badge detection
    let chatbadges = [];
    try {
      const badgeSelectors = [
        'img[class*="badge"]', 
        '[class*="badge"] img', 
        'img[src*="badges"]',
        'img[class*="ChatBadge"]',
        'user-badges img',
        '[class*="ChatMessageAuthorPanel"] img',
        // New selectors
        '.badges img', 
        '.chat-badge', 
        '[data-testid="chat-badge"]',
        '.chat-author-badge',
        '[data-a-target="chat-badge"]',
        '.badge-container img',
        '[class*="badgeContainer"] img',
        '.user-badges-container img',
        '.message-badges img'
      ];
      
      for (const selector of badgeSelectors) {
        try {
          ele.querySelectorAll(selector).forEach(badge => {
            if (badge && badge.src) {
              const badgeSrc = badge.src.toLowerCase();
              // Skip likely non-badge images
              if (!badgeSrc.includes('emoji') && !badgeSrc.includes('icon')) {
                chatbadges.push(badge.src);
              }
            }
          });
        } catch (e) {}
      }
    } catch (e) {}
    
    // Improved event detection
    let isEvent = false;
    const eventPatterns = [
      /joined/i, /became a fan/i, /is watching/i, /subscribed/i, 
      /donated/i, /gift/i, /invited/i, /followed/i, /resubscribed/i,
      /cheered/i, /hosted/i, /raided/i, /bits/i, /tipped/i, /sent stars/i,
      /has connected/i, /has entered/i, /welcomed/i, /is now a/i
    ];
    
    for (const pattern of eventPatterns) {
      if (pattern.test(msg)) {
        isEvent = true;
        break;
      }
    }
    
    // Skip if no username or no message
    if (!name && !msg) return;
	
	
	const cleanedName = cleanName(name);
    const cleanedMessage = cleanMessage(msg);
	
	
	if (messageDeduplication.isDuplicate(cleanedName, cleanedMessage)) {
      return; 
    }
    
    // Prepare data for sending
    const data = {
      chatname: cleanName(name),
      chatbadges: chatbadges,
      backgroundColor: "",
      textColor: "",
      nameColor: nameColor,
      chatmessage: cleanMessage(msg), 
      chatimg: chatimg,
      hasDonation: "",
      membership: "",
      contentimg: "",
      textonly: settings.textonlymode || false,
      type: "generic"
    };
    
    // Add event flag if detected
    if (isEvent) {
      data.event = true;
    }
    
    // Detect platform/domain type
    try {
      const hostname = window.location.hostname;
      if (hostname) {
        // Extract most significant domain part
        let domainType = "";
        
        // Try known platforms first
        const knownPlatforms = {
          'youtube': ['youtube', 'yt'],
          'twitch': ['twitch', 'twitchtv'],
          'facebook': ['facebook', 'fb'],
          'instagram': ['instagram', 'ig'],
          'tiktok': ['tiktok', 'tiktok'],
          'discord': ['discord'],
          'reddit': ['reddit'],
          'twitter': ['twitter', 'x.com'],
          'kick': ['kick']
        };
        
        for (const [platform, domains] of Object.entries(knownPlatforms)) {
          if (domains.some(d => hostname.includes(d))) {
            domainType = platform;
            break;
          }
        }
        
        // Fallback to domain extraction
        if (!domainType) {
          const domainParts = hostname.split('.');
          if (domainParts.length >= 2) {
            domainType = domainParts[domainParts.length - 2];
            // Skip generic domains
            if (['co', 'com', 'org', 'net', 'io'].includes(domainType)) {
              domainType = domainParts[0]; // Use subdomain instead
            }
          }
        }
        
        if (domainType) {
          data.type = domainType.toLowerCase();
        }
      }
    } catch (e) {}
    
    // Handle image conversion and send message
    if (data.chatimg) {
      toDataURL(data.chatimg, function(dataUrl) {
        data.chatimg = dataUrl;
        pushMessage(data);
      });
    } else {
      pushMessage(data);
    }
  }

  // Improved observer setup for chat messages
  function setupMutationObservers() {
    // Enhanced chat container selectors
    const CHAT_CONTAINER_SELECTORS = [
      '.chat', '.chat-messages', '.chat-container', '.comments', '.chat-list',
      '[class*="chat-container"]', '[class*="chat__container"]', '.interactive .chat',
      '[class*="chat-list"]', '[class*="chat__list"]', '[class*="chatList"]',
      '[class*="message-list"]', '[class*="comment-list"]', '#chat-items',
      '#chat-body', '#chatBody', '#messages', '#messageList', '#chat_area',
      '.message-list', '.comment-list', '.chatbody', '.chat__container',
      '#meeting-panel-container', '.tw-comment-list-view', '.chatbox-messages',
      '[data-hook="MESSAGES_CONTAINER"]', '[class^="MessageList"]',
      '[class^="styles_chat__list"]', '.VideoChat-module', '#react_rootVideoChat',
      '[class^="Chat_root"]', '[class^="ChatBoxBase_root"] > div',
      '.flex.flex-col-reverse', '.chatbox-messages', '[class^="styles_chat__list"]',
      '[data-program-target="sidebar"] .scroll-container .w-full.lc-scroll',
      '[data-sentry-element="ScrollableCardContent"]', '.comment-container',
      '.live-chat-block', '.comment-list-container>div', '#app',
      '#chatBody', '.message-container', '.chat-messages',
      '.chat-window', '.discussion', '[class*="messageList"]',
      '[class*="chat-container"]', '[class*="chatContainer"]',
      '[data-testid="message-list"]', '[role="log"]',
      // New modern container selectors
      '.chat-scrollable-area__message-container', 
      '[data-a-target="chat-message-container"]',
      '.stream-chat', '.stream-chat__container', 
      '.chat-history-panel', '.chat-scroller',
      '[data-testid="chat-container"]', '[data-testid="chat-list"]',
      '.chat-scroll-container', '.chat-feed',
      '[class*="chatContainer"]', '.messages-wrapper',
      '.chat-messages-container', '.chat-history',
      '.message-list-wrapper', '.chat-panel__container',
      '[role="feed"]', '[role="list"]', '[aria-live="polite"]',
      '[data-purpose="chat-feed"]', '.c-chat-feed',
      '.chat-messages-list', '.chat-room__message-list',
      '[data-testid="conversation"]', '[data-purpose="messages"]'
    ];
    
    // Create and configure MutationObserver
    function createObserver(target) {
      if (!target || target.hasObserver) return;
      
      target.hasObserver = true;
      
      const config = { childList: true, subtree: true };
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.addedNodes.length) {
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];
              
              // Skip already processed nodes
              if (node.processed || node.skip) continue;
              
              // Check if node is an element
              if (node.nodeType === 1) {
                // Check if the node itself is a message
                for (const selector of MESSAGE_SELECTORS) {
                  try {
                    if (node.matches && node.matches(selector)) {
                      setTimeout(() => processMessage(node), 50);
                      node.skip = true;
                      break;
                    }
                  } catch (e) {}
                }
                
                // Check for child messages
                if (node.querySelectorAll) {
                  for (const selector of MESSAGE_SELECTORS) {
                    try {
                      const messages = node.querySelectorAll(selector);
                      if (messages.length) {
                        messages.forEach(messageNode => {
                          if (!messageNode.processed && !messageNode.skip) {
                            setTimeout(() => processMessage(messageNode), 50);
                            messageNode.skip = true;
                          }
                        });
                      }
                    } catch (e) {}
                  }
                }
              }
            }
          }
        });
      });
      
      observer.observe(target, config);
      return observer;
    }
    
    // Enhanced shadow DOM handling
    function checkShadowRoots() {
      try {
        // Focus on elements likely to have shadow DOM
        const candidateElements = Array.from(document.querySelectorAll('*'))
          .filter(el => (
            // Custom elements are more likely to have shadow roots
            el.tagName.includes('-') || 
            // Common web component attributes
            el.hasAttribute('shadowroot') || 
            // Special cases for known platforms
            el.tagName === 'YT-LIVE-CHAT-APP' ||  // YouTube
            el.classList.contains('shadow-root-host') // Generic shadow class
          ));
          
        for (const element of candidateElements) {
          if (element.shadowRoot && !element.shadowRoot.hasObserver) {
            // Look for chat containers in shadow DOM
            for (const selector of CHAT_CONTAINER_SELECTORS) {
              try {
                const shadowContainers = element.shadowRoot.querySelectorAll(selector);
                if (shadowContainers.length) {
                  shadowContainers.forEach(container => {
                    if (!container.hasObserver) {
                      createObserver(container);
                      
                      // Process existing messages
                      for (const msgSelector of MESSAGE_SELECTORS) {
                        try {
                          container.querySelectorAll(msgSelector).forEach(message => {
                            if (!message.processed && !message.skip) {
                              setTimeout(() => processMessage(message), 50);
                              message.skip = true;
                            }
                          });
                        } catch (e) {}
                      }
                    }
                  });
                }
              } catch (e) {}
            }
            
            // If no specific container found, observe the entire shadow root
            if (!element.shadowRoot.hasObserver) {
              createObserver(element.shadowRoot);
              
              // Process existing messages in shadow root
              for (const msgSelector of MESSAGE_SELECTORS) {
                try {
                  element.shadowRoot.querySelectorAll(msgSelector).forEach(message => {
                    if (!message.processed && !message.skip) {
                      setTimeout(() => processMessage(message), 50);
                      message.skip = true;
                    }
                  });
                } catch (e) {}
              }
            }
          }
        }
      } catch (e) {
        console.error("Error checking shadow roots:", e);
      }
    }
    
    
    // Initialize default observer setup
    function initializeObservers() {
      // First check for regular DOM chat containers
      for (const selector of CHAT_CONTAINER_SELECTORS) {
        try {
          const containers = document.querySelectorAll(selector);
          containers.forEach(container => {
            if (!container.hasObserver && container.isConnected) {
              createObserver(container);
              
              // Process existing messages
              MESSAGE_SELECTORS.forEach(msgSelector => {
                try {
                  container.querySelectorAll(msgSelector).forEach(message => {
                    if (!message.processed && !message.skip) {
                      setTimeout(() => processMessage(message), 50);
                      message.skip = true;
                    }
                  });
                } catch (e) {}
              });
            }
          });
        } catch (e) {}
      }
      
      // Check for shadow DOM elements
      checkShadowRoots();
      
      // If we still haven't found a chat container, try watching the document body
      if (!document.body.hasObserver) {
        let foundContainer = false;
        
        for (const selector of CHAT_CONTAINER_SELECTORS) {
          try {
            if (document.querySelector(selector)) {
              foundContainer = true;
              break;
            }
          } catch (e) {}
        }
        
        if (!foundContainer) {
          // Try to find messages directly
          let foundMessages = false;
          
          for (const selector of MESSAGE_SELECTORS) {
            try {
              const messages = document.querySelectorAll(selector);
              if (messages.length) {
                foundMessages = true;
                messages.forEach(message => {
                  if (!message.processed && !message.skip) {
                    setTimeout(() => processMessage(message), 50);
                    message.skip = true;
                  }
                });
              }
            } catch (e) {}
          }
          
          // If we found direct messages but no container, observe body
          if (foundMessages) {
            createObserver(document.body);
          }
        }
      }
      
      // Check iframes for chat content
      try {
        document.querySelectorAll('iframe').forEach(iframe => {
          try {
            if (iframe.contentWindow && iframe.contentWindow.document && 
                iframe.contentWindow.document.body) {
              const iframeBody = iframe.contentWindow.document.body;
              
              if (!iframeBody.hasObserver) {
                // Look for chat containers in iframe
                for (const selector of CHAT_CONTAINER_SELECTORS) {
                  try {
                    const containers = iframeBody.querySelectorAll(selector);
                    containers.forEach(container => {
                      if (!container.hasObserver) {
                        createObserver(container);
                      }
                    });
                  } catch (e) {}
                }
                
                // If no specific container found, observe the iframe body
                if (!iframeBody.hasObserver) {
                  createObserver(iframeBody);
                }
              }
            }
          } catch (e) {}
        });
      } catch (e) {}
    }
    
    // Check for new containers and messages periodically
    let initCount = 0;
    const maxInitCount = 10; // Limit initial checks
    
    // Periodic checking
    setInterval(() => {
      if (initCount < maxInitCount) {
        initializeObservers();
        initCount++;
      } else {
        // After initial checks, just look for new containers
        // Check for new containers that might have been added dynamically
        for (const selector of CHAT_CONTAINER_SELECTORS) {
          try {
            const containers = document.querySelectorAll(selector);
            containers.forEach(container => {
              if (!container.hasObserver && container.isConnected) {
                createObserver(container);
              }
            });
          } catch (e) {}
        }
        
        // Check shadow roots but less frequently
        if (Math.random() < 0.2) { // 20% chance each interval
          checkShadowRoots();
        }
      }
    }, 3000);
  }

  // Improved learning data persistence
  function saveLearningData() {
    try {
      // Get domain-specific key
      const domain = window.location.hostname;
      const storageKey = `chatLearning_${domain}`;
      
      const data = {
        namePatterns: Array.from(chatLearning.namePatterns.entries()),
        messagePatterns: Array.from(chatLearning.messagePatterns.entries()),
        nameCache: Array.from(chatLearning.nameCache.entries()).slice(0, 100), // Limit size
        messageCache: Array.from(chatLearning.messageCache.entries()).slice(0, 100), 
        usernameStats: chatLearning.usernameStats,
        messageStats: chatLearning.messageStats,
        lastUpdated: new Date().toISOString()
      };
      
      // Save to extension storage
      chrome.runtime.sendMessage(chrome.runtime.id, { 
        "saveLearningData": data,
        "domain": domain
      }, function(response) {
        console.log("Learning data saved");
      });
      
      // Save to localStorage with improved error handling
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (storageError) {
        console.warn("localStorage quota exceeded, pruning data before saving");
        
        // Reduce the dataset size
        const reducedData = {
          namePatterns: Array.from(chatLearning.namePatterns.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30),
          messagePatterns: Array.from(chatLearning.messagePatterns.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30),
          nameCache: Array.from(chatLearning.nameCache.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30),
          messageCache: Array.from(chatLearning.messageCache.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30),
          usernameStats: {
            avgLength: chatLearning.usernameStats.avgLength,
            totalNames: chatLearning.usernameStats.totalNames
          },
          messageStats: {
            avgLength: chatLearning.messageStats.avgLength,
            totalMessages: chatLearning.messageStats.totalMessages
          },
          lastUpdated: new Date().toISOString(),
          isPruned: true
        };
        
        try {
          localStorage.setItem(storageKey, JSON.stringify(reducedData));
        } catch (finalError) {
          console.error("Still couldn't save to localStorage after pruning");
        }
      }
      
      // Update domains index
      try {
        const domainsIndex = JSON.parse(localStorage.getItem('chatLearningDomains') || '[]');
        if (!domainsIndex.includes(domain)) {
          domainsIndex.push(domain);
          localStorage.setItem('chatLearningDomains', JSON.stringify(domainsIndex));
        }
      } catch (e) {}
    } catch(e) {
      console.error("Error saving learning data:", e);
    }
  }

  // Improved learning data loading
  function loadLearningData() {
    try {
      const domain = window.location.hostname;
      const storageKey = `chatLearning_${domain}`;
      
      // First try loading from localStorage
      const localData = localStorage.getItem(storageKey);
      let loadedFromLocal = false;
      
      if (localData) {
        try {
          const data = JSON.parse(localData);
          applyLearningData(data);
          loadedFromLocal = true;
        } catch(e) {
          console.error("Error parsing local learning data:", e);
        }
      }
      
      // Then try loading from extension storage
      chrome.runtime.sendMessage(chrome.runtime.id, { 
        "getLearningData": true,
        "domain": domain
      }, function(response) {
        if (response && response.learningData) {
          // Only apply if newer than what we loaded locally or if we didn't load locally
          if (!loadedFromLocal || 
              (response.learningData.lastUpdated && 
               (!loadedFromLocal.lastUpdated || 
                new Date(response.learningData.lastUpdated) > new Date(loadedFromLocal.lastUpdated)))) {
            applyLearningData(response.learningData);
          }
        }
      });
      
      // Load data from similar domains
      loadSimilarDomainData(domain);
    } catch(e) {
      console.error("Error in loadLearningData:", e);
    }
  }

  // Load data from similar domains
  function loadSimilarDomainData(currentDomain) {
    try {
      // Get stored domains index
      const domainsIndex = JSON.parse(localStorage.getItem('chatLearningDomains') || '[]');
      
      // Extract the base domain
      const baseDomainMatch = currentDomain.match(/([^.]+)\.\w+$/);
      if (!baseDomainMatch) return;
      
      const baseDomain = baseDomainMatch[1].toLowerCase();
      
      // Look for similar domains
      const similarDomains = domainsIndex.filter(domain => {
        // Skip current domain
        if (domain === currentDomain) return false;
        
        // Check for similar domains
        return domain.toLowerCase().includes(baseDomain);
      });
      
      if (similarDomains.length === 0) return;
      
      // Combine data from similar domains
      const mergedData = {
        namePatterns: new Map(),
        messagePatterns: new Map(),
        nameCache: new Map(),
        messageCache: new Map(),
        usernameStats: { avgLength: 0, totalNames: 0 },
        messageStats: { avgLength: 0, totalMessages: 0 }
      };
      
      let totalDomainsLoaded = 0;
      
      similarDomains.forEach(domain => {
        try {
          const data = JSON.parse(localStorage.getItem(`chatLearning_${domain}`));
          if (!data) return;
          
          // Merge patterns with weighted importance
          if (data.namePatterns) {
            data.namePatterns.forEach(([selector, count]) => {
              mergedData.namePatterns.set(
                selector, 
                (mergedData.namePatterns.get(selector) || 0) + Math.ceil(count * 0.7)
              );
            });
          }
          
          if (data.messagePatterns) {
            data.messagePatterns.forEach(([selector, count]) => {
              mergedData.messagePatterns.set(
                selector, 
                (mergedData.messagePatterns.get(selector) || 0) + Math.ceil(count * 0.7)
              );
            });
          }
          
          // Update stats with weighted values
          if (data.usernameStats) {
            mergedData.usernameStats.totalNames += data.usernameStats.totalNames * 0.5;
            
            if (data.usernameStats.totalNames > 0) {
              mergedData.usernameStats.avgLength = 
                (mergedData.usernameStats.avgLength * mergedData.usernameStats.totalNames + 
                 data.usernameStats.avgLength * data.usernameStats.totalNames * 0.5) /
                (mergedData.usernameStats.totalNames + data.usernameStats.totalNames * 0.5);
            }
          }
          
          if (data.messageStats) {
            mergedData.messageStats.totalMessages += data.messageStats.totalMessages * 0.5;
            
            if (data.messageStats.totalMessages > 0) {
              mergedData.messageStats.avgLength = 
                (mergedData.messageStats.avgLength * mergedData.messageStats.totalMessages + 
                 data.messageStats.avgLength * data.messageStats.totalMessages * 0.5) /
                (mergedData.messageStats.totalMessages + data.messageStats.totalMessages * 0.5);
            }
          }
          
          totalDomainsLoaded++;
        } catch (e) {}
      });
      
      if (totalDomainsLoaded > 0) {
        // Apply the merged data with lower weight
        applyLearningData(mergedData, 0.5);
      }
    } catch (e) {
      console.error("Error in loadSimilarDomainData:", e);
    }
  }

  // Apply learning data with weighted merging
  function applyLearningData(data, weight = 1.0) {
    try {
      if (data.namePatterns) {
        if (weight === 1.0) {
          // Full replacement
          chatLearning.namePatterns = new Map(data.namePatterns);
        } else {
          // Weighted merge
          data.namePatterns.forEach(([selector, count]) => {
            const weightedCount = Math.ceil(count * weight);
            chatLearning.namePatterns.set(
              selector, 
              (chatLearning.namePatterns.get(selector) || 0) + weightedCount
            );
          });
        }
      }
      
      if (data.messagePatterns) {
        if (weight === 1.0) {
          // Full replacement
          chatLearning.messagePatterns = new Map(data.messagePatterns);
        } else {
          // Weighted merge
          data.messagePatterns.forEach(([selector, count]) => {
            const weightedCount = Math.ceil(count * weight);
            chatLearning.messagePatterns.set(
              selector, 
              (chatLearning.messagePatterns.get(selector) || 0) + weightedCount
            );
          });
        }
      }
      
      if (data.nameCache) {
        if (weight === 1.0) {
          // Full replacement
          chatLearning.nameCache = new Map(data.nameCache);
        } else {
          // Weighted merge
          data.nameCache.forEach(([name, count]) => {
            const weightedCount = Math.ceil(count * weight);
            chatLearning.nameCache.set(
              name, 
              (chatLearning.nameCache.get(name) || 0) + weightedCount
            );
          });
        }
      }
      
      if (data.messageCache) {
        if (weight === 1.0) {
          // Full replacement
          chatLearning.messageCache = new Map(data.messageCache);
        } else {
          // Weighted merge
          data.messageCache.forEach(([signature, count]) => {
            const weightedCount = Math.ceil(count * weight);
            chatLearning.messageCache.set(
              signature, 
              (chatLearning.messageCache.get(signature) || 0) + weightedCount
            );
          });
        }
      }
      
      if (data.usernameStats) {
        if (weight === 1.0 || chatLearning.usernameStats.totalNames === 0) {
          // Full replacement
          chatLearning.usernameStats.avgLength = data.usernameStats.avgLength;
          chatLearning.usernameStats.totalNames = data.usernameStats.totalNames;
        } else {
          // Weighted merge for statistics
          const totalCurrentNames = chatLearning.usernameStats.totalNames;
          const totalNewNames = data.usernameStats.totalNames * weight;
          const totalCombined = totalCurrentNames + totalNewNames;
          
          if (totalCombined > 0) {
            chatLearning.usernameStats.avgLength = (
              (chatLearning.usernameStats.avgLength * totalCurrentNames) +
              (data.usernameStats.avgLength * totalNewNames)
            ) / totalCombined;
            
            chatLearning.usernameStats.totalNames = totalCombined;
          }
        }
      }
      
      if (data.messageStats) {
        if (weight === 1.0 || chatLearning.messageStats.totalMessages === 0) {
          // Full replacement
          chatLearning.messageStats.avgLength = data.messageStats.avgLength;
          chatLearning.messageStats.totalMessages = data.messageStats.totalMessages;
        } else {
          // Weighted merge for statistics
          const totalCurrentMessages = chatLearning.messageStats.totalMessages;
          const totalNewMessages = data.messageStats.totalMessages * weight;
          const totalCombined = totalCurrentMessages + totalNewMessages;
          
          if (totalCombined > 0) {
            chatLearning.messageStats.avgLength = (
              (chatLearning.messageStats.avgLength * totalCurrentMessages) +
              (data.messageStats.avgLength * totalNewMessages)
            ) / totalCombined;
            
            chatLearning.messageStats.totalMessages = totalCombined;
          }
        }
      }
    } catch(e) {
      console.error("Error applying learning data:", e);
    }
  }

  // Enhanced time pattern stripping
  function stripTimePatterns(text) {
    if (!text) return "";
    
    // Expanded time patterns
    const timePatterns = [
      // Standard time formats
      /\b\d{1,2}:\d{2}(?::\d{2})?(?: ?(?:AM|PM|am|pm))?\b/g,
      // "X time ago" patterns
      /\b(?:a few |just |about |around )?\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b/gi,
      /\b(?:just|a moment|a few moments|seconds|minutes) ago\b/gi,
      /\bSeconds ago\b/gi,
      // Time words
      /\byesterday\b/gi,
      /\b(?:today|this morning|this afternoon|this evening|tonight)\b/gi,
      // Date formats
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,?(?:\s+\d{4})?\b/gi,
      /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
      /\b\d{4}-\d{2}-\d{2}\b/g,
      // Common platform patterns
      /(?:^|\s+)[-–—]\s+(?:Seconds|Minutes|Hours|Days|Weeks|Months|Years) ago(?:\s+|$)/gi,
      /\s*<i><small>.*?<\/small><\/i>\s*/gi,
      /\s*<small>.*?<\/small>\s*/gi,
      /\s*-\s+Seconds ago\s*/gi,
      // Additional time formats
      /\b\d{1,2}\s*(?:hr|min|sec|h|m|s)\b/gi,
      /\bjust now\b/gi,
      /\bmoments? ago\b/gi,
      /\b(?:a|one) (?:second|minute|hour|day|week|month|year) ago\b/gi,
      // Time elements
      /\s*<time[^>]*>.*?<\/time>\s*/gi,
      /\s*<span[^>]*(?:time|date)[^>]*>.*?<\/span>\s*/gi,
      // Platform-specific
      /\bstreamed \d+ (?:minutes?|hours?) ago\b/gi,
      /\bposted \d+ (?:minutes?|hours?) ago\b/gi,
      /\b\(\d+\)\s*$/g // Counting indicators like (3) at the end
    ];
    
    // Replace all time patterns with empty string
    timePatterns.forEach(pattern => {
      text = text.replace(pattern, '');
    });
    
    return text.trim();
  }

  // Improved name cleaning
  function cleanName(name) {
    if (!name) return "";
    
    // Handle special case time patterns
    if (name.match(/\s+-\s+Seconds ago/i) || name.match(/\s+[-–—]\s+.*ago/i)) {
      name = name.split(/\s+[-–—]\s+/)[0];
    }
    
    // Remove common suffix patterns
    const suffixPatterns = [
      /You$/i, 
      /Me$/i, 
      /\(You\)$/i,
      /\(Author\)$/i,
      /\(mod\)$/i,
      /\(moderator\)$/i,
      /\(admin\)$/i,
      /\(bot\)$/i
    ];
    
    suffixPatterns.forEach(pattern => {
      name = name.replace(pattern, '');
    });
    
    // Remove leading/trailing punctuation
    name = name.replace(/^[-:•.]+|[-:•.]+$/g, '');
    
    // Remove any time patterns
    name = stripTimePatterns(name);
    
    // Trim and clean whitespace
    name = name.trim().replace(/\s+/g, ' ');
    
    return name;
  }

  // Improved message cleaning
  function cleanMessage(message) {
    if (!message) return "";
    
    // Remove any time patterns
    message = stripTimePatterns(message);
    
    // Remove leading punctuation that often appears after username extraction
    message = message.replace(/^[-:•.]+/g, '');
    
    // Handle messages with leading name duplications
    if (message.match(/^.+:\s+/)) {
      // Check for "Name: actual message" pattern
      const colonParts = message.split(/:\s+/, 2);
      if (colonParts.length === 2 && colonParts[1].trim()) {
        const potentialName = colonParts[0].trim();
        // If the name part is reasonable length, treat the rest as the message
        if (potentialName.length < 30) {
          message = colonParts[1].trim();
        }
      }
    }
    
    // Cleanup extra whitespace
    message = message.trim().replace(/\s+/g, ' ');
    
    return message;
  }
  
  // Enhanced tab keep-alive
  function keepAlive() {
    try {
      var receiveChannelCallback = function(e) {
        remoteConnection.datachannel = e.channel;
        remoteConnection.datachannel.onmessage = function() {};
        remoteConnection.datachannel.onopen = function() {};
        remoteConnection.datachannel.onclose = function() {};
        setInterval(function() {
          if (document.hidden) {
            remoteConnection.datachannel.send("KEEPALIVE");
          }
        }, 800);
      };
      
      var errorHandle = function(e) {}
      var localConnection = new RTCPeerConnection();
      var remoteConnection = new RTCPeerConnection();
      localConnection.onicecandidate = (e) => !e.candidate || remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
      remoteConnection.onicecandidate = (e) => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
      remoteConnection.ondatachannel = receiveChannelCallback;
      localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
      localConnection.sendChannel.onopen = function() { localConnection.sendChannel.send("CONNECTED"); };
      localConnection.sendChannel.onclose = function() {};
      localConnection.sendChannel.onmessage = function() {};
      
      localConnection.createOffer()
        .then((offer) => localConnection.setLocalDescription(offer))
        .then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
        .then(() => remoteConnection.createAnswer())
        .then((answer) => remoteConnection.setLocalDescription(answer))
        .then(() => {
          localConnection.setRemoteDescription(remoteConnection.localDescription);
        })
        .catch(errorHandle);
    } catch(e) {
      console.error("Keep alive setup failed:", e);
    }
  }

  // Improved visibility state prevention
  function preventVisibilityThrottling() {
    try {
      // Override document visibility properties
      Object.defineProperty(document, "hidden", { value: false, writable: false });
      Object.defineProperty(document, "visibilityState", { 
        get: function() { return "visible"; },
        configurable: false 
      });
      
      // Intercept visibility change events
      ["visibilitychange", "webkitvisibilitychange", "mozvisibilitychange", "msvisibilitychange"].forEach(event => {
        window.addEventListener(event, e => {
          e.stopImmediatePropagation();
        }, true);
      });
      
      // Override focus/blur methods
      document.hasFocus = function() { return true; };
      window.onblur = null;
      window.blurred = false;
      
      // Periodic checking to ensure overrides persist
      setInterval(function() {
        if (document.hidden || document.visibilityState !== "visible") {
          Object.defineProperty(document, "hidden", { value: false });
          Object.defineProperty(document, "visibilityState", { 
            get: function() { return "visible"; }
          });
        }
      }, 5000);
    } catch(e) {}
  }
  
  // Initialization with improved sequence
  console.log("Enhanced social stream chat scraper injected");
  
  // Load learning data first
  loadLearningData();
  
  // Set up performance optimizations
  keepAlive();
  preventVisibilityThrottling();
  
  // Set up initial observers after a slight delay to let the page load
  setTimeout(() => {
    setupMutationObservers();
    
    // Process any existing messages
    MESSAGE_SELECTORS.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(message => {
          if (!message.processed && !message.skip) {
            setTimeout(() => processMessage(message), 100);
            message.skip = true;
          }
        });
      } catch (e) {}
    });
  }, 500);
  
  // Save learning data periodically
  setInterval(saveLearningData, 60000);
})();