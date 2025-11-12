# Building Custom Overlays for Social Stream Ninja

## 1\. Introduction

Social Stream Ninja (SSN) is a versatile application for consolidating and managing live social media streams. While it offers several built-in overlay pages (like `dock.html`, `featured.html`, `events.html`, etc.), users and developers can create their own custom HTML/CSS/JavaScript-based overlays to tailor the visual experience and functionality to specific needs.

This guide explains how to build such custom pages, focusing on connecting to the SSN backend, receiving and processing messages, and displaying them, all *without* modifying the core `background.js` application.

## 2\. Prerequisites

  - Basic understanding of HTML, CSS, and JavaScript.
  - Familiarity with JSON data structures.
  - A running instance of the Social Stream Ninja extension or standalone application.

## 3\. Core Concepts Recap

Before diving into custom page creation, let's revisit some core SSN concepts from the "Understanding Social Stream Ninja for AI Integration" document:

  - **`streamID` (Session ID):** Your unique session identifier. This is crucial and will be needed to connect your custom page. It's typically found in the SSN extension's settings.
  - **`password` (Optional):** If your SSN session is password-protected, you'll need this.
  - **Message Structure:** Incoming data will be JSON objects. Refer to the "Message Structure" section in the AI integration document for a detailed list of common fields (e.g., `id`, `type`, `chatname`, `chatmessage`, `hasDonation`, `event`).

## 4\. Connection Methods for Custom Overlays

Custom overlay pages primarily connect to the Social Stream Ninja backend to receive messages. There are two main ways:

### 4.1. VDO.Ninja Iframe (Recommended for Overlays)

This is the most common and straightforward method for overlay pages. Your custom HTML page will embed a VDO.Ninja iframe. This iframe acts as a bridge, receiving data from the SSN `background.js` (via VDO.Ninja's WebRTC or WebSocket infrastructure) and then passing it to your parent HTML page (your custom overlay) using `window.postMessage()`.

**How it works:**

1.  The SSN `background.js` sends messages to a VDO.Ninja room associated with your `streamID`.
2.  Your custom overlay page includes an iframe whose `src` is a VDO.Ninja URL pointing to the *same* `streamID`. This iframe is configured typically as a "view-only" or specific-label client.
3.  When the iframe receives data from SSN, it uses `parent.postMessage()` to send the data to your custom HTML page.
4.  Your custom page listens for these messages using `window.addEventListener('message', callbackFunction)`.

**Example Iframe Setup:**

```html
<iframe id="ssn_bridge" style="display:none;"></iframe>

<script>
    const urlParams = new URLSearchParams(window.location.search);
    const roomID = urlParams.get("session") || "test"; // Get streamID from URL param
    const password = urlParams.get("password") || "false"; // Get password from URL param
    const label = urlParams.get("label") || "custom_overlay"; // Unique label for this overlay

    const iframe = document.getElementById('ssn_bridge');
    // &view=roomID ensures it only receives data. &label is important for targeted messages.
    // &noaudio &novideo &cleanoutput are typical for data-only VDO.Ninja clients.
    iframe.src = `https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=${password}&view=${roomID}&label=${label}&noaudio&novideo&cleanoutput&room=${roomID}`;

    // Listen for messages from the iframe
    window.addEventListener('message', function(event) {
        // IMPORTANT: Check event.source to ensure the message is from your iframe
        if (event.source !== iframe.contentWindow) {
            return;
        }

        if (event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja) {
            const ssnMessage = event.data.dataReceived.overlayNinja;
            // Now, ssnMessage contains the data from Social Stream Ninja
            processIncomingSSNMessage(ssnMessage);
        } else if (event.data && event.data.actionType) { // For specific action payloads
             processIncomingSSNMessage(event.data);
        }
    });

    function processIncomingSSNMessage(data) {
        console.log("Received SSN Data:", data);
        // Your custom logic to display/filter/process the message
        // Example: displayMessage(data);
    }
</script>
```

**Key Iframe URL Parameters for VDO.Ninja:**

  - `&room=STREAM_ID`: Specifies the main VDO.Ninja room to connect to.
  - `&view=STREAM_ID`: Makes this client a viewer in the specified room, receiving data sent to that room.
  - `&label=YOUR_LABEL`: Assigns a unique label to this iframe instance. This is crucial if you want `background.js` or `dock.html` to send targeted messages specifically to this overlay.
  - `&password=PASSWORD`: If your SSN session is password protected.
  - `&novideo`, `&noaudio`: Ensures no accidental camera/mic activation.
  - `&cleanoutput`: Simplifies the VDO.Ninja interface within the iframe.
  - `&ln`: (Light Ninja) a more performant version of VDO.Ninja, for viewing.

See `dock.html`, `featured.html`, `events.html` etc. for more examples of iframe setups. They often use `label=dock`, `label=overlay`, `label=actions` respectively.

### 4.2. WebSocket API (Advanced)

For more direct control or server-side integrations, you can connect to the SSN WebSocket server (`wss://io.socialstream.ninja`). This bypasses the need for an iframe but requires handling the WebSocket connection and message parsing directly in your JavaScript.

**Connection:**

```javascript
const urlParams = new URLSearchParams(window.location.search);
const roomID = urlParams.get("session") || "test";
// Choose appropriate IN_CHANNEL and OUT_CHANNEL based on your needs.
// For a simple overlay listening to general messages, IN_CHANNEL 3 or 4 might be suitable.
const inChannel = urlParams.get("in_channel") || "4"; // Channel to listen on
const outChannel = urlParams.get("out_channel") || "3"; // Channel to send to (if needed)

const socketServerURL = urlParams.get("server") || "wss://io.socialstream.ninja";
const socket = new WebSocket(socketServerURL);

socket.onopen = function() {
    console.log("WebSocket Connected!");
    const joinMessage = {
        join: roomID,
        in: parseInt(inChannel),  // Channel(s) this client wants to receive messages from
        out: parseInt(outChannel) // Default channel this client will send messages to
    };
    socket.send(JSON.stringify(joinMessage));
};

socket.onmessage = function(event) {
    try {
        const data = JSON.parse(event.data);
        // Messages from SSN are often wrapped.
        if (data.overlayNinja) {
            processIncomingSSNMessage(data.overlayNinja);
        } else if (data.action && data.value) { // Simple command format
            // Less common for overlays to receive this directly unless targeted
            console.log("Received command:", data);
        } else {
            // Potentially direct message data if not wrapped
            processIncomingSSNMessage(data);
        }
    } catch (e) {
        console.error("Error parsing WebSocket message:", e);
    }
};

socket.onerror = function(error) {
    console.error("WebSocket Error:", error);
};

socket.onclose = function() {
    console.log("WebSocket Disconnected. Attempting to reconnect...");
    // Implement reconnection logic if needed
};

function processIncomingSSNMessage(data) {
    console.log("Received SSN Data via WebSocket:", data);
    // Your custom logic
}
```

This method is more common for tools that interact with SSN rather than purely visual overlays, but it's an option. The `dock.html` uses a similar WebSocket connection for its primary communication.

## 5\. Receiving and Processing Messages

Once connected, your custom page will receive message objects.

### Message Structure (Recap)

A typical message object might look like this (fields vary based on source and event):

```json
{
    "id": 1678886400000,
    "type": "twitch",
    "chatname": "StreamFan123",
    "chatmessage": "Great stream! 🎉",
    "chatimg": "url_to_avatar.png",
    "timestamp": 1678886400000,
    "hasDonation": null, // Or "$5.00"
    "membership": null, // Or "Tier 1 Subscriber"
    "event": null, // Or "follow"
    "userid": "123456789",
    "nameColor": "#FF00FF",
    "chatbadges": ["url_to_badge.png"],
    "contentimg": null, // Or "url_to_image_in_chat.gif"
    "karma": 0.85,
    "bot": false,
    "mod": false,
    "host": false,
    "vip": true,
    "tid": 101 // Browser tab ID
}
```

Refer to `about.md` for more details on these fields.

> **Note:** Reserve the `event` field for true system notifications (follows, raids, /me actions, etc.). Regular chat messages should leave `event` unset/false so they are never mistaken for events.

### Client-Side Filtering and Logic

Your JavaScript code will be responsible for deciding what to do with each incoming message.

```javascript
function processIncomingSSNMessage(data) {
    // --- Basic Filtering Examples ---

    // 1. Filter by message type (source platform)
    if (data.type === 'youtube') {
        // console.log("This is a YouTube message:", data.chatname, data.chatmessage);
        // displayYouTubeMessage(data);
    } else if (data.type === 'twitch') {
        // console.log("This is a Twitch message:", data.chatname, data.chatmessage);
        // displayTwitchMessage(data);
    }

    // 2. Filter by event type
    if (data.event === 'follow') {
        // console.log("New Follower:", data.chatname, "on", data.type);
        // displayFollowAlert(data);
    } else if (data.event === 'subscriber') {
        // console.log("New Subscriber:", data.chatname, "on", data.type);
        // displaySubscriberAlert(data);
    }

    // 3. Filter for donations
    if (data.hasDonation) {
        // console.log("Donation Received:", data.chatname, "donated", data.hasDonation, "on", data.type);
        // displayDonation(data);
    }

    // 4. Filter for messages from VIPs
    if (data.vip) {
        // console.log("VIP Message from", data.chatname, ":", data.chatmessage);
        // highlightVIPMessage(data);
    }

    // 5. Filter out messages from bots (if identified)
    if (data.bot) {
        // console.log("Ignoring bot message from", data.chatname);
        return; // Don't process further
    }

    // --- More Complex Filtering ---
    const urlParams = new URLSearchParams(window.location.search);
    const onlyShowType = urlParams.get('onlytype'); // e.g., &onlytype=twitch
    const hideType = urlParams.get('hidetype');     // e.g., &hidetype=youtube
    const showEventsOnly = urlParams.has('eventsonly'); // &eventsonly
    const donationsOnly = urlParams.has('donationsonly'); // &donationsonly

    if (onlyShowType && data.type !== onlyShowType) {
        return;
    }
    if (hideType && data.type === hideType) {
        return;
    }
    if (showEventsOnly && !data.event) {
        return;
    }
    if (donationsOnly && !data.hasDonation) {
        return;
    }

    // --- Fallback: Display all other messages or specific content ---
    displayGenericMessage(data);
}

function displayGenericMessage(data) {
    const messageList = document.getElementById('message-list'); // Assuming you have this element
    if (!messageList) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message-item message-type-${data.type || 'unknown'}`;
    if (data.event) {
        messageElement.classList.add(`event-${data.event}`);
    }

    let content = '';
    if (data.chatimg) {
        content += `<img src="${data.chatimg}" alt="${data.chatname || 'User'}" class="avatar"> `;
    }
    content += `<strong style="color:${data.nameColor || '#FFF'};">${data.chatname || 'Anonymous'}</strong>: `;
    content += `<span>${data.chatmessage || ''}</span>`;

    if (data.hasDonation) {
        content += `<span class="donation-info"> ❤️ ${data.hasDonation}</span>`;
    }
    if (data.membership) {
        content += `<span class="membership-info"> ⭐ ${data.membership}</span>`;
    }
    if (data.contentimg) {
        content += `<div><img src="${data.contentimg}" class="content-image"></div>`;
    }

    messageElement.innerHTML = content;
    messageList.appendChild(messageElement);

    // Optional: Auto-scroll
    messageList.scrollTop = messageList.scrollHeight;

    // Optional: Limit number of messages displayed
    const maxMessages = parseInt(urlParams.get('limit')) || 50;
    while (messageList.children.length > maxMessages) {
        messageList.removeChild(messageList.firstChild);
    }
}
```

## 6\. Displaying Messages

How you display messages is entirely up to your HTML and CSS design.

**Basic HTML Structure:**

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Custom SSN Overlay</title>
    <style>
        body { background-color: transparent; color: white; font-family: sans-serif; }
        .message-list { list-style: none; padding: 10px; }
        .message-item { margin-bottom: 8px; padding: 5px; background-color: rgba(0,0,0,0.5); border-radius: 4px; }
        .avatar { width: 24px; height: 24px; border-radius: 50%; vertical-align: middle; margin-right: 5px; }
        .donation-info { color: #FFD700; font-weight: bold; }
        .membership-info { color: #ADFF2F; font-weight: bold; }
        .content-image { max-width: 100px; max-height: 100px; display: block; margin-top: 5px;}
    </style>
</head>
<body>
    <ul id="message-list">
        </ul>

    <iframe id="ssn_bridge" style="display:none;"></iframe>
    <script>
        // JavaScript from Section 4.1 and 5 (processIncomingSSNMessage, displayGenericMessage)
        // would go here.
        const urlParams = new URLSearchParams(window.location.search);
        const roomID = urlParams.get("session") || "test";
        const password = urlParams.get("password") || "false";
        const label = urlParams.get("label") || "custom_overlay_" + Date.now(); // Ensure unique label

        const iframe = document.getElementById('ssn_bridge');
        iframe.src = `https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=${password}&view=${roomID}&label=${label}&noaudio&novideo&cleanoutput&room=${roomID}`;

        window.addEventListener('message', function(event) {
            if (event.source !== iframe.contentWindow) { return; }
            if (event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja) {
                processIncomingSSNMessage(event.data.dataReceived.overlayNinja);
            } else if (event.data && event.data.actionType) {
                 processIncomingSSNMessage(event.data);
            }
        });

        function processIncomingSSNMessage(data) {
            // Add any filtering specific to this overlay
            // For example, if this overlay should only show donations from YouTube:
            // if (data.type !== 'youtube' || !data.hasDonation) {
            //    return;
            // }
            displayGenericMessage(data); // Use the display function from above
        }

        // Definition of displayGenericMessage from previous section
        function displayGenericMessage(data) {
            const messageList = document.getElementById('message-list');
            if (!messageList) return;

            const messageElement = document.createElement('li'); // Changed to <li> for <ul>
            messageElement.className = `message-item message-type-${data.type || 'unknown'}`;
            if (data.event) {
                messageElement.classList.add(`event-${data.event}`);
            }

            let content = '';
            if (data.chatimg) {
                content += `<img src="${data.chatimg}" alt="${data.chatname || 'User'}" class="avatar"> `;
            }
            content += `<strong style="color:${data.nameColor || '#FFF'};">${data.chatname || 'Anonymous'}</strong>: `;
            
            // Sanitize chatmessage before inserting as HTML if it's not pre-sanitized
            // For simplicity, assuming data.chatmessage is safe or using textContent assignment later
            let chatMessageContent = data.chatmessage || '';

            // Basic XSS prevention if inserting as HTML (better to use a library or careful construction)
            // const tempDiv = document.createElement('div');
            // tempDiv.textContent = data.chatmessage || '';
            // chatMessageContent = tempDiv.innerHTML;
            
            content += `<span>${chatMessageContent}</span>`;


            if (data.hasDonation) {
                content += `<span class="donation-info"> ❤️ ${data.hasDonation}</span>`;
            }
            if (data.membership) {
                content += `<span class="membership-info"> ⭐ ${data.membership}</span>`;
            }
             if (data.contentimg) {
                content += `<div><img src="${data.contentimg}" class="content-image" alt="User content"></div>`;
            }


            messageElement.innerHTML = content;
            
            // If you want to process URLs in the message content:
            // processURLs(messageElement.querySelector('span'), { makeClickable: true, shortenURLs: true });


            messageList.appendChild(messageElement);
            messageList.scrollTop = messageList.scrollHeight;

            const maxMessages = parseInt(urlParams.get('limit')) || 50;
            while (messageList.children.length > maxMessages) {
                messageList.removeChild(messageList.firstChild);
            }
        }
         // Placeholder for processURLs and isValidTLD if you use them
        function isValidTLD(tld) { /* ... implementation ... */ return true; }
        function processURLs(element, options) { /* ... implementation ... */ }


    </script>
</body>
</html>
```

## 7\. Sending Commands (Optional)

If your custom page needs to send commands back to SSN (e.g., to feature a message, clear the overlay, similar to what `dock.html` does), you can use `iframe.contentWindow.postMessage()`.

```javascript
// In your custom_overlay.html, assuming 'iframe' is your VDO.Ninja bridge iframe
function sendCommandToSSN(commandObject) {
    if (iframe && iframe.contentWindow) {
        // The command needs to be wrapped for the VDO.Ninja iframe to relay it as a "data send"
        // The target for these commands is usually the SSN background script itself,
        // or other components listening on the main room feed.
        iframe.contentWindow.postMessage({
            sendData: { overlayNinja: commandObject },
            type: "pcs" // "pcs" is often used for sending data to all peers in the room
            // Optionally add a UUID if targeting a specific peer, though less common for overlay->background commands
        }, "*"); // Target origin should be restricted in production
    }
}

// Example: Command to feature a message (if your custom page were a dock replacement)
function featureMessageOnOverlay(messageData) {
    // 'messageData' should be the full SSN message object you want to feature
    sendCommandToSSN(messageData); // SSN background.js's sendToDestinations will pick this up
                                   // if it's sent to the main room or a specific label it listens to.
                                   // featured.html listens for any message.
}

// Example: Command to clear the featured overlay
function clearFeaturedOverlay() {
    // Sending 'false' or an object with a 'clear' action can work.
    // The exact payload depends on what featured.html (or your custom featured display) expects.
    // A common pattern is that `featured.html` clears its display when it receives `false`.
    sendCommandToSSN(false);
    // OR, more explicitly if your featured overlay handles it:
    // sendCommandToSSN({ action: "clearOverlay" });
}
```

The `background.js` listens for messages from the VDO.Ninja iframe. When it receives a message structured like `{ sendData: { overlayNinja: actualPayload } }`, it processes `actualPayload` via its `processIncomingRequest` function, which can then trigger `sendToDestinations`. If `actualPayload` is a message object, it gets sent to other overlays like `featured.html`.

## 8\. URL Parameters for Customization

Remember that SSN overlays are highly customizable via URL parameters. Your custom page can also implement its own URL parameters for styling and behavior.

\*\*Common SSN URL Parameters your custom page might want to *respect* or *replicate*: \*\*

  - `&session=STREAM_ID`: **Required** for connection.
  - `&password=PASSWORD`: Optional.
  - `&label=YOUR_LABEL`: For targeted messaging.
  - `&css=URL_TO_CSS_FILE` or `&b64css=BASE64_ENCODED_CSS`: For custom styling.
  - `&font=FONT_NAME`: Specify a font.
  - `&googlefont=FONT_NAME`: Specify a Google Font.
  - `&scale=FLOAT`: Scale the entire overlay.
  - `&limit=NUMBER`: Limit the number of messages displayed.
  - `&hidesource=1`: To hide the source platform icon/name.
  - `&showtime=MILLISECONDS`: How long to display a message before auto-hiding (if implemented).
  - `&fadeout=1`: To enable fade-out animations.
  - Filtering params: `&onlytype=`, `&hidetype=`, `&donationsonly=1`, `&eventsonly=1`, `&hidebots=1`, etc.

Your JavaScript can parse these using `URLSearchParams` and adjust behavior accordingly.

## 9\. Example: Minimalist Event Notification Overlay

This example shows an overlay that only displays new follower and subscriber events.

```html
<!DOCTYPE html>
<html>
<head>
    <title>Event Notifications</title>
    <style>
        body { background-color: transparent; color: white; font-family: Arial, sans-serif; overflow: hidden; }
        .event-notification-container {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
        }
        .event-alert {
            background-color: rgba(30, 144, 255, 0.8); /* DodgerBlue */
            color: white;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            opacity: 0;
            transform: translateX(100%);
            animation: slideInAndFadeOut 5s forwards; /* Show for 5 seconds */
        }
        .event-alert.follow { background-color: rgba(50, 205, 50, 0.8); } /* LimeGreen */
        .event-alert.subscriber { background-color: rgba(138, 43, 226, 0.8); } /* BlueViolet */

        @keyframes slideInAndFadeOut {
            0% { opacity: 0; transform: translateX(100%); }
            10% { opacity: 1; transform: translateX(0); }
            90% { opacity: 1; transform: translateX(0); }
            100% { opacity: 0; transform: translateX(100%); }
        }
    </style>
</head>
<body>
    <div id="event-notification-container"></div>
    <iframe id="ssn_bridge" style="display:none;"></iframe>

    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const roomID = urlParams.get("session") || "test_events";
        const password = urlParams.get("password") || "false";
        const label = "event_notifier_" + Date.now();

        const iframe = document.getElementById('ssn_bridge');
        iframe.src = `https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=${password}&view=${roomID}&label=${label}&noaudio&novideo&cleanoutput&room=${roomID}`;

        const notificationContainer = document.getElementById('event-notification-container');

        window.addEventListener('message', function(event) {
            if (event.source !== iframe.contentWindow) { return; }
            if (event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja) {
                processEvent(event.data.dataReceived.overlayNinja);
            }
        });

        function processEvent(data) {
            if (!data.event) return; // Only process actual events

            let messageText = '';
            let eventClass = '';

            switch(data.event) {
                case 'follow':
                    messageText = `${data.chatname || 'Someone'} just followed on ${data.type}!`;
                    eventClass = 'follow';
                    break;
                case 'subscriber': // Assuming 'subscriber' is the event name for new subs
                    messageText = `${data.chatname || 'Someone'} just subscribed on ${data.type}!`;
                    if (data.membership) { // If tier info is available
                        messageText += ` (${data.membership})`;
                    }
                    eventClass = 'subscriber';
                    break;
                // Add more cases for other events you want to display
                // case 'raid':
                //    messageText = `${data.chatname} is raiding with ${data.viewers || 'viewers'}!`;
                //    eventClass = 'raid';
                //    break;
                default:
                    return; // Ignore other events
            }

            displayNotification(messageText, eventClass);
        }

        function displayNotification(text, typeClass) {
            const alertDiv = document.createElement('div');
            alertDiv.className = `event-alert ${typeClass}`;
            alertDiv.textContent = text;
            notificationContainer.appendChild(alertDiv);

            // Automatically remove the element after the animation (plus a small buffer)
            setTimeout(() => {
                alertDiv.remove();
            }, 5100); // Animation is 5s
        }
    </script>
</body>
</html>
```

## 10\. Best Practices

  - **Unique Labels:** If using multiple custom overlays, ensure each has a unique `&label=` in its VDO.Ninja iframe URL. This allows for targeted messaging if needed.
  - **Security:** Always validate `event.source` when listening to `postMessage` events to ensure messages are coming from your trusted iframe.
  - **Performance:** Keep client-side processing efficient, especially if displaying many messages. Minimize complex DOM manipulations.
  - **Styling:** Leverage CSS for styling. Use URL parameters for dynamic style changes where appropriate.
  - **Error Handling:** Implement basic error handling in your JavaScript.
  - **No `background.js` Modification:** Design your custom page to work with the existing SSN message structure and API. Avoid solutions that would require changing the core extension code.
  - **Consult Examples:** The existing `dock.html`, `featured.html`, `events.html`, `hype.html`, `waitlist.html`, `confetti.html`, and `credits.html` files in the Social Stream Ninja project are excellent resources for seeing how these principles are applied.

By following this guide, you can create powerful and customized overlay experiences for Social Stream Ninja.
