// Custom User Function Template for SocialStream.ninja
// Override the default customUserFunction with your own custom processing logic
// This is to be uploaded via the menu.

window.customUserFunction = function(data) {
  // Log incoming data for debugging (remove in production)
  console.log("Custom function processing data:", data);

  // SECTION 1: MESSAGE SOURCE FILTERING
  // Process messages differently based on their source
  if (data.type === "twitch") {
    // Special handling for Twitch messages
    if (data.chatmessage && data.chatmessage.toLowerCase().includes("hello stream")) {
      // Automatically respond to greetings from Twitch
      sendCustomReply(data, "Hey there, welcome to the stream!");
      return data; // handled specially
    }
  } else if (data.type === "youtube") {
    // Handle YouTube messages differently
    if (data.chatmessage && data.chatmessage.toLowerCase().includes("new subscriber")) {
      // Highlight new subscriber messages
      data.highlightColor = "#ff9966";
    }
  }

  // SECTION 2: CUSTOM COMMAND HANDLING
  if (data.chatmessage && data.chatmessage.startsWith("!")) {
    // Handle custom commands
    const commandParts = data.chatmessage.split(" ");
    const command = commandParts[0].toLowerCase();
    
    switch (command) {
      case "!hello":
        sendCustomReply(data, `Hello, @${data.chatname}!`);
        return data;
      case "!time":
        sendCustomReply(data, `Current time is ${new Date().toLocaleTimeString()}`);
        return data;
      case "!shoutout":
        if (data.mod || data.admin) { // Only mods/admins can use this
          const username = commandParts[1];
          if (username) {
            sendCustomReply(data, `Check out @${username} at https://twitch.tv/${username}`);
          }
        }
        return data;
    }
  }

  // SECTION 3: MESSAGE FILTERING/BLOCKING
  // Block messages with specific patterns
  if (data.chatmessage) {
    // Block messages with too many capital letters (shouting)
    const uppercase = data.chatmessage.replace(/[^A-Z]/g, "").length;
    const totalChars = data.chatmessage.replace(/\s/g, "").length;
    
    if (totalChars > 10 && uppercase / totalChars > 0.7) {
      console.log("Blocking message with excessive caps");
      return false; // Block the message
    }
    
    // Block messages with specific words (in addition to the built-in blocklist)
    const customBadWords = ["badword1", "badword2", "badword3"];
    if (customBadWords.some(word => data.chatmessage.toLowerCase().includes(word))) {
      console.log("Blocking message with banned words");
      return false; // Block the message
    }
  }

  // SECTION 4: CUSTOM USER RECOGNITION
  // Special handling for regular viewers/supporters
  if (data.chatname) {
    const regulars = ["regular1", "regular2", "supporter1"];
    const vips = ["vip1", "vip2", "vip3"];
    
    if (regulars.includes(data.chatname.toLowerCase())) {
      // Add special styling for regular viewers
      data.backgroundNameColor = "background-color: #3498db;";
      data.textNameColor = "color: #ffffff;";
    } else if (vips.includes(data.chatname.toLowerCase())) {
      // Add VIP styling
      data.backgroundNameColor = "background-color: #9b59b6;";
      data.textNameColor = "color: #ffffff;";
      
      // Add a crown emoji before VIP names
      data.chatname = "👑 " + data.chatname;
    }
  }

  // SECTION 5: CUSTOM CONTENT ENHANCEMENT
  // Replace keywords with richer content
  if (data.chatmessage) {
    // Replace emotion keywords with emojis
    const emotionMap = {
      ":smile:": "😊",
      ":laugh:": "😂",
      ":sad:": "😢",
      ":heart:": "❤️"
    };
    
    Object.keys(emotionMap).forEach(keyword => {
      data.chatmessage = data.chatmessage.replace(
        new RegExp(keyword, "g"), 
        emotionMap[keyword]
      );
    });
    
    // Highlight specific product mentions
    if (data.chatmessage.toLowerCase().includes("product123")) {
      data.chatmessage = data.chatmessage.replace(
        /product123/gi, 
        "<span style='color:#ff0000;font-weight:bold;'>Product123™</span>"
      );
	  data.textonly = false;
    }
  }

  // SECTION 6: EVENT TRACKING
  // Track messages containing specific keywords and trigger actions
  if (data.chatmessage) {
    // Track questions for later follow-up
    const messageText = data.textContent || data.chatmessage;
    if (messageText.includes("?") && !data.bot) {
      // You could store these questions in a global array
      if (!window.pendingQuestions) window.pendingQuestions = [];
      window.pendingQuestions.push({
        name: data.chatname,
        question: data.chatmessage,
        time: new Date()
      });
      
      // If using as host, you could get a notification
      if (data.host) {
        console.log("New question from viewer:", data.chatmessage);
      }
    }
  }

  // SECTION 7: INTEGRATION WITH EXTERNAL APIS
  // Example of how you could integrate with external services
  if (data.hasDonation && parseFloat(data.hasDonation) >= 10) {
    // Track large donations in a database or send to webhook
    const donationData = {
      username: data.chatname,
      amount: data.hasDonation,
      message: data.chatmessage,
      platform: data.type,
      timestamp: new Date().toISOString()
    };
    
    // Example webhook call (commented out)
    /*
    fetch('https://your-webhook-url.com/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donationData)
    }).catch(err => console.error('Failed to log donation:', err));
    */
    
    // Thank big donors
    sendCustomReply(data, `Wow! Thank you so much for the ${data.hasDonation} donation, @${data.chatname}!`);
  }

  // Return data to allow normal processing to continue
  return data;
};

// Helper function to send replies
function sendCustomReply(data, message) {
  const msg = {};
  if (data.tid) {
    msg.tid = data.tid;
  }
  msg.response = message;
  sendMessageToTabs(msg, false, null, false, false, 0);
}

// Helper function to check regex patterns against messages
function matchesPattern(text, pattern) {
  return new RegExp(pattern, "i").test(text);
}

// Helper function to format time
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Example of a more complex response system using a queue
// This avoids flooding chat with too many responses
window.responseQueue = [];
window.processingQueue = false;

function queueResponse(message, delay = 3000) {
  window.responseQueue.push({ message, timestamp: Date.now() + delay });
  
  if (!window.processingQueue) {
    window.processingQueue = true;
    processResponseQueue();
  }
}

function processResponseQueue() {
  if (window.responseQueue.length === 0) {
    window.processingQueue = false;
    return;
  }
  
  const now = Date.now();
  const nextItem = window.responseQueue[0];
  
  if (now >= nextItem.timestamp) {
    window.responseQueue.shift();
    
    const msg = {};
    msg.response = nextItem.message;
    sendMessageToTabs(msg, false, null, false, false, 0);
    
    setTimeout(processResponseQueue, 1000); // Process next item in 1 second
  } else {
    setTimeout(processResponseQueue, 500); // Check again in 500ms
  }
}