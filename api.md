
# Social Stream Ninja API Documentation

## WebSocket API

The WebSocket API allows real-time, bidirectional communication between your application and the Social Stream Ninja server.

### Connecting to the API Server

Connect to the WebSocket server at `wss://io.socialstream.ninja`.

There are two methods to connect and join a session:

1.  Direct connection with parameters:

`ws =  new  WebSocket("wss://io.socialstream.ninja/join/SESSION_ID/IN_CHANNEL/OUT_CHANNEL");`

2.  Connect first, then send a join message:

```
ws =  new  WebSocket("wss://io.socialstream.ninja");
ws.onopen  =  function()  {   
    ws.send(JSON.stringify({  join:  "SESSION_ID",  in:  IN_CHANNEL,  out:  OUT_CHANNEL  }));
};
```

Parameters:

-   `SESSION_ID`: Your unique session identifier (same as used in dock.html or featured.html URL)
-   `IN_CHANNEL`: Channel number to receive messages (optional)
-   `OUT_CHANNEL`: Channel number to send messages (optional)

### Channel System Explained

The channel system allows for more granular control over message routing:

-   Channel 1: Main communication channel (default)
-   Channel 2: Typically used for dock.html communication
-   Channel 3: Often used for extension communication
-   Channel 4: Commonly used for featured.html communication
-   Channel 5: Used for waitlist.html communication
-   Channel 6: Reserved for future use
-   Channel 7: Reserved for future use

When specifying channels, you're defining which channels to receive messages from (IN_CHANNEL) and which to send messages to (OUT_CHANNEL). This allows different components of your setup to communicate on separate channels, reducing noise and improving organization. You can send a content message just to the featured.html page, bypassing the need to send to the dock.html page first, for example.

### Available Commands

1.  **Send Chat Message**
    -   Action: `sendChat`
    -   Example: `{"action": "sendChat", "value": "Hello, world!"}`
2.  **Send Encoded Chat Message**
    -   Action: `sendEncodedChat`
    -   Example: `{"action": "sendEncodedChat", "value": "Hello%2C%20world%21"}`
3.  **Block User**
    -   Action: `blockUser`
    -   Example: `{"action": "blockUser", "value": {"chatname": "username", "type": "twitch"}}`
4.  **Send External Content**
    -   Action: `extContent`
    -   Example: `{"action": "extContent", "value": "{\"chatname\":\"User\",\"chatmessage\":\"Hello\"}"}`
5.  **Waitlist Operations**
    -   Remove: `{"action": "removefromwaitlist", "value": 1}`
    -   Highlight: `{"action": "highlightwaitlist", "value": 2}`
    -   Reset: `{"action": "resetwaitlist"}`
    -   Download: `{"action": "downloadwaitlist"}`
    -   Select Winner: `{"action": "selectwinner", "value": 1}`
6.  **Clear Messages**
    -   All: `{"action": "clear"}` or `{"action": "clearAll"}`
    -   Overlay: `{"action": "clearOverlay"}`
7.  **Queue Operations**
    -   Next: `{"action": "nextInQueue"}`
    -   Get Size: `{"action": "getQueueSize"}`
8.  **Auto-show Toggle**
    -   `{"action": "autoShow", "value": "toggle"}`
9.  **Feature Next Message**
    -   `{"action": "feature"}`
10.  **Get Chat Sources**
    -   `{"action": "getChatSources"}`
11.  **VIP User Operations**
    -   Toggle: `{"action": "toggleVIPUser", "value": {"chatname": "username", "type": "twitch"}}`
12.  **Get User History**
    -   `{"action": "getUserHistory", "value": {"chatname": "username", "type": "twitch"}}`
13.  **Waitlist Message**
    -   `{"action": "waitlistmessage", "value": "Your custom message"}`
14.  **Draw Mode**
    -   `{"action": "drawmode", "value": true}`

### Channel-Specific Messaging

You can send messages to specific channels using the `content` action with a channel number:

-   Channel 1: `{"action": "content", ...}`
-   Channel 2: `{"action": "content2", ...}`
-   Channel 3: `{"action": "content3", ...}`
-   Channel 4: `{"action": "content4", ...}`
-   Channel 5: `{"action": "content5", ...}`
-   Channel 6: `{"action": "content6", ...}`
-   Channel 7: `{"action": "content7", ...}`

### HTTP API

The server also supports HTTP GET, POST, and PUT requests for the same actions. Replace `SESSION_ID` with your actual session ID.

-   GET: `https://io.socialstream.ninja/SESSION_ID/ACTION/TARGET/VALUE`
-   POST/PUT: `https://io.socialstream.ninja/SESSION_ID` (with JSON body)
-   POST/PUT: `https://io.socialstream.ninja/SESSION_ID/ACTION` (with JSON body)

### Server-Sent Events (SSE)

Connect to the SSE endpoint to receive real-time updates:

``const eventSource =  new  EventSource(`https://io.socialstream.ninja/sse/SESSION_ID`);``

### Receiving Responses

Include a `get` parameter in your request for actions that require a response:

`{   "action":  "yourAction", "value":  "yourValue", "get":  "uniqueIdentifier" }`

The server will respond with:


`{   "callback":  { "get":  "uniqueIdentifier", "result":  true } }`

Note: Not all commands support or require this callback mechanism.

### Special Pages and Features

1.  **Emotes Page (emotes.html)**
    -   Displays emojis/emotes/icons dancing on the screen
    -   Can receive content via WebRTC or the WebSocket API
    -   To send content via API: Use the `content` action on channel 1
2.  **Waitlist Page (waitlist.html)**
    -   Manages draws and waitlists for giveaways
    -   Communicates on channel 5
    -   Supports actions like selecting winners and managing the waitlist
3.  **Custom Actions**
    -   Create custom auto-responding triggers or actions using a `custom.js` file
    -   Example: `auto1` trigger responds "1" to any message that is "1"
4.  **Queuing and Pinning Messages**
    -   Queue: Hold CTRL (cmd on Mac) and click messages in the dock
    -   Pin: Hold ALT and click messages to pin them at the top
5.  **MIDI Hotkey Support**
    -   Toggle in the extension menu
    -   Allows predefined chat messages to be sent to all social destinations
    -   MIDI actions available on Control Change channel 1
