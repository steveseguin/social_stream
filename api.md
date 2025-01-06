# Social Stream Ninja API Documentation

The API allows real-time, bidirectional communication between your application and the Social Stream Ninja extension/app, the dock page, and the overlay pages.

There is an easy to use sandbox to play with some of the common API commands and options [over here](sampleapi.html).

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

  - [WebSocket API](#websocket-api)
    - [Connecting to the API Server](#connecting-to-the-api-server)
    - [Channel System Explained](#channel-system-explained)
    - [Available Commands](#available-commands)
    - [Channel-Specific Messaging](#channel-specific-messaging)
  - [HTTP API](#http-api)
    - [Channel Parameter](#channel-parameter)
    - [Server-Sent Events (SSE)](#server-sent-events-sse)
    - [Receiving Responses](#receiving-responses)
    - [Response Types](#response-types)
  - [Special Pages and Features](#special-pages-and-features)
  - [Message Targeting System](#message-targeting-system)
    - [How it works](#how-it-works)
    - [Use Cases](#use-cases)
  - [Best Practices](#best-practices)
- [Featured Page (featured.html)](#featured-page-featuredhtml)
    - [Connection Options](#connection-options)
    - [Content Filtering Options](#content-filtering-options)
    - [API Actions](#api-actions)
    - [Content Object Structure](#content-object-structure)
    - [Additional Features](#additional-features)
    - [Best Practices and Improvements](#best-practices-and-improvements)
    - [Example API Usage](#example-api-usage)
- [Dock Page (dock.html)](#dock-page-dockhtml)
    - [Connection Options](#connection-options-1)
    - [URL Parameters](#url-parameters)
    - [WebSocket Message Processing](#websocket-message-processing)
    - [Key Features](#key-features)
    - [API Actions](#api-actions-1)
    - [Example API Usage](#example-api-usage-1)
    - [Best Practices and Improvements](#best-practices-and-improvements-1)
- [Social Stream Ninja API Documentation](#social-stream-ninja-api-documentation)
- [Extension](#extension)
    - [WebSocket Connections](#websocket-connections)
    - [Message Flow](#message-flow)
    - [API Actions](#api-actions-2)
    - [Example API Usage](#example-api-usage-2)
    - [Best Practices and Improvements](#best-practices-and-improvements-2)
    - [Integration with Other Components](#integration-with-other-components)
- [Waitlist Page (waitlist.html)](#waitlist-page-waitlisthtml)
    - [WebSocket Connection](#websocket-connection)
    - [Key Functions](#key-functions)
    - [Waitlist Display Modes](#waitlist-display-modes)
    - [Message Types and Actions](#message-types-and-actions)
    - [Key Features](#key-features-1)
    - [CSS Classes for Styling](#css-classes-for-styling)
    - [API Actions](#api-actions-3)
    - [Best Practices and Improvements](#best-practices-and-improvements-3)
    - [Integration with Other Components](#integration-with-other-components-1)
- [Battle royale, Polls, etc](#battle-royale-polls-etc)
  - [Battle Page (battle.html)](#battle-page-battlehtml)
    - [Communication Method](#communication-method)
    - [Game Features](#game-features)
    - [Message Types](#message-types)
    - [API Actions](#api-actions-4)
    - [Integration with Extension](#integration-with-extension)
- [StreamDeck Integration Guide for Social Stream Ninja](#streamdeck-integration-guide-for-social-stream-ninja)
  - [Quick Setup Method](#quick-setup-method)
  - [Advanced Setup with Multi Actions](#advanced-setup-with-multi-actions)
  - [Tips for StreamDeck Setup](#tips-for-streamdeck-setup)
  - [Testing Your Setup](#testing-your-setup)
  - [Channel-Specific Messages](#channel-specific-messages)
- [Using Bitfocus Companion with Social Stream Ninja](#using-bitfocus-companion-with-social-stream-ninja)
  - [Initial Setup](#initial-setup)
  - [Available Actions](#available-actions)
  - [Variables](#variables)
  - [Comparison with StreamDeck](#comparison-with-streamdeck)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## WebSocket API

The WebSocket API allows real-time, bidirectional communication between your application and the Social Stream Ninja server.

### Connecting to the API Server

Connect to the WebSocket server at `wss://io.socialstream.ninja`.

There are two methods to connect and join a session:

1. Direct connection with parameters:

```javascript
ws = new WebSocket("wss://io.socialstream.ninja/join/SESSION_ID/IN_CHANNEL/OUT_CHANNEL");
```

2. Connect first, then send a join message:

```javascript
ws = new WebSocket("wss://io.socialstream.ninja");
ws.onopen = function() {   
    ws.send(JSON.stringify({ join: "SESSION_ID", in: IN_CHANNEL, out: OUT_CHANNEL }));
};
```

Parameters:
- `SESSION_ID`: Your unique session identifier (same as used in dock.html or featured.html URL)
- `IN_CHANNEL`: Channel number to receive messages (optional)
- `OUT_CHANNEL`: Channel number to send messages (optional)

The default channel value is used if not specified

### Channel System Explained

The channel system allows for more granular control over message routing:

- Channel 1: Main communication channel (default)
- Channel 2: Typically used for dock.html communication
- Channel 3: Often used for extension communication
- Channel 4: Commonly used for featured.html communication
- Channel 5: Used for waitlist.html communication
- Channel 6: Reserved for future use
- Channel 7: Reserved for future use
- Channel 8: Reserved for future use
- Channel 9: Reserved for future use

When specifying channels, you're defining which channels to receive messages from (IN_CHANNEL) and which to send messages to (OUT_CHANNEL). This allows different components of your setup to communicate on separate channels, reducing noise and improving organization.

When a message is sent, it goes to the specified output channel. Those who have that channel set as their input channel will recieve the message.

### Available Commands

1. **Send Chat Message**
   - Action: `sendChat`
   - Example: `{"action": "sendChat", "value": "Hello, world!"}`

2. **Send Encoded Chat Message**
   - Action: `sendEncodedChat`
   - Example: `{"action": "sendEncodedChat", "value": "Hello%2C%20world%21"}`

3. **Block User**
   - Action: `blockUser`
   - Example: `{"action": "blockUser", "value": {"chatname": "username", "type": "twitch"}}`

4. **Send External Content**
   - Action: `extContent`
   - Example: `{"action": "extContent", "value": "{\"chatname\":\"User\",\"chatmessage\":\"Hello\"}"}`

5. **Waitlist Operations**
   - Remove: `{"action": "removefromwaitlist", "value": 1}`
   - Highlight: `{"action": "highlightwaitlist", "value": 2}`
   - Reset: `{"action": "resetwaitlist"}`
   - Download: `{"action": "downloadwaitlist"}`
   - Select Winner: `{"action": "selectwinner", "value": 1}`

6. **Clear Messages**
   - All: `{"action": "clear"}` or `{"action": "clearAll"}`
   - Overlay: `{"action": "clearOverlay"}`

7. **Queue Operations**
   - Next: `{"action": "nextInQueue"}`
   - Get Size: `{"action": "getQueueSize"}`

8. **Auto-show Toggle**
   - `{"action": "autoShow", "value": "toggle"}`

9. **Feature Next Message**
   - `{"action": "feature"}`

10. **Get Chat Sources**
    - `{"action": "getChatSources"}`

11. **VIP User Operations**
    - Toggle: `{"action": "toggleVIPUser", "value": {"chatname": "username", "type": "twitch"}}`

12. **Get User History**
    - `{"action": "getUserHistory", "value": {"chatname": "username", "type": "twitch"}}`

13. **Waitlist Message**
    - `{"action": "waitlistmessage", "value": "Your custom message"}`

14. **Draw Mode**
    - `{"action": "drawmode", "value": true}`

### Channel-Specific Messaging

You can send messages to specific channels using the `content` action with a channel number:

- Channel 1: `{"action": "content", ...}`
- Channel 2: `{"action": "content2", ...}`
- Channel 3: `{"action": "content3", ...}`
- Channel 4: `{"action": "content4", ...}`
- Channel 5: `{"action": "content5", ...}`
- Channel 6: `{"action": "content6", ...}`
- Channel 7: `{"action": "content7", ...}`

## HTTP API

The server also supports HTTP GET, POST, and PUT requests for the same actions. Replace `SESSION_ID` with your actual session ID.

- GET: `https://io.socialstream.ninja/SESSION_ID/ACTION/TARGET/VALUE`
- POST/PUT: `https://io.socialstream.ninja/SESSION_ID` (with JSON body)
- POST/PUT: `https://io.socialstream.ninja/SESSION_ID/ACTION` (with JSON body)

### Channel Parameter

You can specify the output channel for HTTP requests using the `channel` query parameter:

```
https://io.socialstream.ninja/SESSION_ID/ACTION/TARGET/VALUE?channel=2
```

This will send the message to channel 2. If not specified, it defaults to channel 1.

### Server-Sent Events (SSE)

Connect to the SSE endpoint to receive real-time updates:

```javascript
const eventSource = new EventSource(`https://io.socialstream.ninja/sse/SESSION_ID`);
```

### Receiving Responses

Include a `get` parameter in your request for actions that require a response:

```json
{
  "action": "yourAction",
  "value": "yourValue",
  "get": "uniqueIdentifier"
}
```

The server will respond with:

```json
{
  "callback": {
    "get": "uniqueIdentifier",
    "result": true
  }
}
```

Note: Not all commands support or require this callback mechanism.

### Response Types

- **Success**: The server will typically respond with the result of the action.
- **Failed**: If the action couldn't be performed (e.g., no clients connected to the specified room), the server responds with "failed".
- **Timeout**: If the server doesn't receive a response from the clients within 5 seconds, it responds with "timeout".
- **Special**: For non-default channels (2-7), if no clients are connected, the server responds with "special" instead of "failed".

## Special Pages and Features

1. **Emotes Page (emotes.html)**
   - Displays emojis/emotes/icons dancing on the screen
   - Can receive content via WebRTC or the WebSocket API
   - To send content via API: Use the `content` action on channel 1

2. **Waitlist Page (waitlist.html)**
   - Manages draws and waitlists for giveaways
   - Communicates on channel 5
   - Supports actions like selecting winners and managing the waitlist

3. **Custom Actions**
   - Create custom auto-responding triggers or actions using a `custom.js` file
   - Example: `auto1` trigger responds "1" to any message that is "1"

4. **Queuing and Pinning Messages**
   - Queue: Hold CTRL (cmd on Mac) and click messages in the dock
   - Pin: Hold ALT and click messages to pin them at the top

5. **MIDI Hotkey Support**
   - Toggle in the extension menu
   - Allows predefined chat messages to be sent to all social destinations
   - MIDI actions available on Control Change channel 1

## Message Targeting System

Social Stream Ninja implements a targeting system that allows messages to be directed to specific instances of the dock or featured pages if multiple of either are open.

### How it works

1. **URL Parameter**: Each instance (featured/dock) can be given a unique label using the `label` URL parameter.
   
   Example: `featured.html?label=stream1` or `dock.html?label=controlpanel1`

2. **Message Structure**: When sending a message through the API, include a `target` field with the label of the intended recipient.

   Example:
   ```json
   {
     "action": "someAction",
     "target": "stream1",
     "value": "someValue"
   }
   ```

3. **Message Processing**: The application checks each incoming message for a target. If the message has a target that doesn't match the instance's label, the message is ignored.

### Use Cases

- Running multiple streams with different configurations
- Sending commands to specific control panels
- Updating particular displays without affecting others

This targeting system allows for more flexible and powerful setups, especially in complex streaming environments.

## Best Practices

1. Always handle potential errors and timeouts in your application.
2. Use appropriate channels for different types of messages to keep your communication organized.
3. Leverage the targeting system when working with multiple instances to ensure messages reach the intended recipients.
4. Regularly check for updates to the API as new features may be added over time.

# Featured Page (featured.html)

The featured.html page is designed to display featured content, typically used for showcasing selected messages or donations in a stream overlay. It communicates primarily on channel 3 for output and channels 1 and 2 for input, depending on the configuration.

### Connection Options

The featured.html page can be configured to connect to the WebSocket server in three different ways:

1. Default (server): Connects to `wss://io.socialstream.ninja`, joins the room, and sets output to channel 3 and input to channel 2.
2. Server2: Sets output to channel 3 and input to default channel.
3. Server3: Sets output to channel 3 and input to channel 1.

In all cases, channel 3 is reserved for output from the featured.html page.

These can be set using URL parameters:
- `?server`: Default connection
- `?server2`: Server2 connection
- `?server3`: Server3 connection

### Content Filtering Options

The featured page offers several filtering options that can be controlled via the API:

1. `onlyshowdonos`: Only show messages with donations
2. `hideDonations`: Hide donation information
3. `hideTwitch`: Hide messages from Twitch
4. `onlyTwitch`: Only show messages from Twitch
5. `onlyFrom`: Only show messages from a specific source
6. `hideFrom`: Hide messages from specific sources
7. `filterfeaturedusers`: Only show messages from whitelisted users

### API Actions

The featured page responds to the following API actions:

1. `content`: Display new content
   - Example: `{"action": "content", "value": {...contentObject...}}`
2. `clear`: Clear the currently displayed content
   - Example: `{"action": "clear"}`
3. `toggleTTS` or `tts`: Toggle or set Text-to-Speech
   - Example: `{"action": "toggleTTS", "value": "toggle"}` or `{"action": "tts", "value": "on"}`

### Content Object Structure

When sending content to be displayed, the content object should have the following structure:

```json
{
  "chatname": "Username",
  "chatmessage": "Message content",
  "chatimg": "URL to user avatar",
  "contentimg": "URL to content image",
  "subtitle": "Subtitle text",
  "membership": "Membership information",
  "hasDonation": "Donation information",
  "type": "Source type (e.g., twitch, youtube)",
  "id": "Unique message ID"
}
```

### Additional Features

1. **Queue System**: If `queuetime` is set, messages are added to a queue and displayed sequentially.
2. **Image Preloading**: The page attempts to preload user avatars and source type images for smoother display.
3. **IFrame Support**: The page can adjust its height when embedded in an IFrame.
4. **Transition Effects**: Content transitions can be customized using CSS classes.

### Best Practices and Improvements

1. **Error Handling**: Implement more robust error handling for WebSocket connections and message parsing.
2. **Configuration Options**: Consider adding more configuration options via URL parameters or API calls to control filtering and display behavior.
3. **Performance Optimization**: For high-traffic streams, implement rate limiting or batching of messages to prevent overwhelming the display.
4. **Accessibility**: Add options for controlling text size, contrast, and display duration to improve readability for viewers.
5. **Analytics**: Implement tracking for displayed messages and user interactions to gather insights on engagement.

### Example API Usage

To display a new featured message:

```javascript
socketserver.send(JSON.stringify({
  action: "content",
  value: {
    chatname: "ExampleUser",
    chatmessage: "Hello, featured chat!",
    type: "twitch",
    hasDonation: "$5.00"
  }
}));
```

To clear the current featured message:

```javascript
socketserver.send(JSON.stringify({ action: "clear" }));
```

To toggle Text-to-Speech:

```javascript
socketserver.send(JSON.stringify({ action: "toggleTTS", value: "toggle" }));
```

# Dock Page (dock.html)

The dock.html page serves as a control center for managing chat messages and interactions. It connects to multiple WebSocket servers and processes incoming messages.

### Connection Options

The dock page can be configured to connect to different WebSocket servers:

1. Main Server (default): 
   - URL: `wss://io.socialstream.ninja/api`
   - Configurable via the `server` URL parameter
   - Joins room with `out: 2, in: 1`

2. Extension Server:
   - URL: `wss://io.socialstream.ninja/extension`
   - Configurable via the `server2` or `server3` URL parameters
   - Joins room with `out: 3, in: 4`

### URL Parameters

- `server`: Sets the main server URL
- `server2`: Enables connection to the extension server and sets its URL
- `server3`: Enables connection to both main and extension servers

### WebSocket Message Processing

The dock page processes incoming WebSocket messages using the `processInput` function. This function handles various types of messages and actions, including:

1. Message management (pin, unpin, queue)
2. User actions (block, delete messages)
3. Content display and filtering
4. Chat source management
5. User history retrieval
6. Payment processing (Stripe, Ko-fi, Buy Me a Coffee)
7. OBS commands
8. TTS (Text-to-Speech) control

### Key Features

1. **Message Queue**: Manages a queue of messages for display
2. **Pinned Messages**: Allows pinning and unpinning of messages
3. **User Blocking**: Supports blocking users across different platforms
4. **Content Filtering**: Provides options to filter content based on various criteria
5. **Payment Integration**: Processes donations from Stripe, Ko-fi, and Buy Me a Coffee
6. **OBS Integration**: Allows control of OBS scenes
7. **TTS Control**: Enables toggling and control of Text-to-Speech functionality

### API Actions

The dock page responds to various API actions, including:

1. `clear` or `clearAll`: Clears all messages except pinned ones
2. `clearOverlay`: Clears the overlay without affecting the dock
3. `nextInQueue`: Moves to the next message in the queue
4. `getQueueSize`: Returns the current queue size
5. `autoShow`: Controls automatic message display
6. `content`: Processes and displays new content
7. `feature`: Features the next unfeatured message
8. `toggleTTS` or `tts`: Controls Text-to-Speech functionality

### Example API Usage

To clear all messages:

```javascript
socketserver.send(JSON.stringify({ action: "clear" }));
```

To feature the next message:

```javascript
socketserver.send(JSON.stringify({ action: "feature" }));
```

To toggle Text-to-Speech:

```javascript
socketserver.send(JSON.stringify({ action: "toggleTTS", value: "toggle" }));
```

### Best Practices and Improvements

1. **Error Handling**: Implement more robust error handling for WebSocket connections and message parsing.
2. **Modularization**: Consider splitting the `processInput` function into smaller, more manageable functions for easier maintenance.
3. **Configuration Options**: Add more configuration options via URL parameters to control filtering and display behavior.
4. **Security**: Implement authentication and encryption for sensitive operations, especially those involving payment processing.
5. **Performance Optimization**: For high-traffic scenarios, implement batching of messages and more efficient DOM manipulation.
6. **Accessibility**: Add keyboard shortcuts and screen reader support for better accessibility.
7. **Documentation**: Maintain detailed inline documentation for complex functions and processes.

# Social Stream Ninja API Documentation

[Previous content remains the same]

# Extension

The extension is a critical component of the Social Stream Ninja system, acting as the primary source of messages and managing communication between different parts of the system.

### WebSocket Connections

The extension maintains two WebSocket connections:

1. Dock Connection:
   - URL: `wss://io.socialstream.ninja/dock`
   - Joins room with `out: 4, in: 3`
   - Controlled by `settings.server2` or `settings.server3`

2. API Connection:
   - URL: `wss://io.socialstream.ninja/api`
   - Joins room with `out: 2, in: 1`
   - Controlled by `settings.socketserver`

### Message Flow

1. The extension receives messages from various sources (e.g., chat platforms).
2. Messages are processed and can be modified by `applyBotActions()`.
3. Processed messages are sent to the dock or featured pages using `sendToDestinations()`.
4. Responses or user actions from the dock/featured pages are received by the extension.
5. The extension can then send responses back to the original platforms using `processResponse()`.

### API Actions

The extension processes various API actions, including:

1. `sendChat`: Sends a chat message to the specified destination.
2. `sendEncodedChat`: Sends an encoded chat message to the specified destination.
3. `blockUser`: Blocks a user from a specific source or all sources.
4. `extContent`: Processes external content, applying bot actions before sending.
5. `removefromwaitlist`: Removes an entry from the waitlist.
6. `highlightwaitlist`: Highlights an entry in the waitlist.
7. `resetwaitlist`: Resets the entire waitlist.
8. `stopentries`: Stops accepting new entries.
9. `downloadwaitlist`: Initiates a download of the waitlist.
10. `selectwinner`: Selects a random winner from the waitlist.

### Example API Usage

To send a chat message:

```javascript
socketserver.send(JSON.stringify({
  action: "sendChat",
  value: "Hello, world!",
  target: "twitch" // optional, specifies the destination platform
}));
```

To block a user:

```javascript
socketserver.send(JSON.stringify({
  action: "blockUser",
  value: "username",
  target: "youtube" // optional, "*" for all platforms
}));
```

To process external content:

```javascript
socketserver.send(JSON.stringify({
  action: "extContent",
  value: JSON.stringify({
    chatname: "User",
    chatmessage: "Hello from an external source!",
    type: "external"
  })
}));
```

### Best Practices and Improvements

1. **Error Handling**: Implement more robust error handling for WebSocket connections and message parsing.
2. **Rate Limiting**: Implement rate limiting to prevent flooding of messages to destinations.
3. **Modularization**: Consider splitting the message processing logic into smaller, more manageable functions.
4. **Logging**: Implement comprehensive logging for easier debugging and monitoring.
5. **Security**: Implement authentication and encryption for sensitive operations.
6. **Configurability**: Allow more fine-grained control over which actions are enabled or disabled.
7. **Documentation**: Maintain detailed inline documentation for complex functions and processes.
8. **Testing**: Implement unit and integration tests to ensure reliability of the extension.

### Integration with Other Components

The extension plays a central role in the Social Stream Ninja system:

1. It receives messages from external chat platforms.
2. Processes and optionally modifies these messages.
3. Sends the processed messages to the dock.html or featured.html pages for display.
4. Receives user actions or responses from the dock/featured pages.
5. Can send responses back to the original chat platforms.

This central position allows the extension to act as a powerful intermediary, enabling features like chat moderation, custom bot actions, and cross-platform interactions.

# Waitlist Page (waitlist.html)

The waitlist.html page is designed to manage and display waitlists or giveaways within the Social Stream Ninja system. It connects to a WebSocket server and processes incoming messages to update the waitlist display.

### WebSocket Connection

- URL: `wss://io.socialstream.ninja/extension`
- Joins room with `out: 5, in: 6`

### Key Functions

1. `setupSocket()`: Establishes and manages the WebSocket connection.
2. `processInput(data)`: Processes incoming WebSocket messages and updates the waitlist display.

### Waitlist Display Modes

1. **Draw Mode**: Displays entries in a draw or giveaway.
2. **Regular Mode**: Displays a standard waitlist.

### Message Types and Actions

The waitlist page processes various types of messages:

1. `waitlistmessage`: Updates the waitlist title.
2. `drawmode`: Toggles draw mode and displays winners.
3. `drawPoolSize`: Updates the number of entries in the draw.
4. `waitlist`: Updates the entire waitlist display.

### Key Features

1. **Winner Selection**: Displays selected winners with confetti animation.
2. **Entry Count**: Shows the number of entries in the draw.
3. **Customizable Messages**: Allows setting custom messages for the waitlist title.
4. **Source Display**: Option to show the source (e.g., Twitch, YouTube) of each entry.
5. **Randomization**: Option to randomize the order of entries in the display.

### CSS Classes for Styling

- `.winner`: Applied to winning entries.
- `.loser`: Applied to non-winning entries in draw mode.
- `.selected`: Applied to highlighted entries.
- `.guestListHolder`: Container for each waitlist entry.

### API Actions

The waitlist page responds to various API actions, including:

1. `waitlistmessage`: Sets a custom message for the waitlist.
   ```javascript
   {
     "waitlistmessage": "Welcome to the giveaway!"
   }
   ```

2. `drawmode`: Toggles draw mode and can display winners.
   ```javascript
   {
     "drawmode": true,
     "winlist": [
       {"chatname": "Winner1", "type": "twitch", "chatimg": "URL"},
       {"chatname": "Winner2", "type": "youtube", "chatimg": "URL"}
     ]
   }
   ```

3. `drawPoolSize`: Updates the number of entries in the draw.
   ```javascript
   {
     "drawPoolSize": 100
   }
   ```

4. `waitlist`: Updates the entire waitlist.
   ```javascript
   {
     "waitlist": [
       {"chatname": "User1", "type": "twitch", "chatimg": "URL", "waitStatus": 0},
       {"chatname": "User2", "type": "youtube", "chatimg": "URL", "waitStatus": 2}
     ]
   }
   ```

### Best Practices and Improvements

1. **Error Handling**: Implement more robust error handling for WebSocket connections and message parsing.
2. **Performance Optimization**: For large waitlists, implement virtualization or pagination to improve performance.
3. **Accessibility**: Ensure the waitlist is accessible, including keyboard navigation and screen reader support.
4. **Customization Options**: Allow more customization of the waitlist appearance through API calls or configuration options.
5. **Animation Options**: Provide options to customize or disable animations for different use cases.
6. **Localization**: Add support for multiple languages in the waitlist display.
7. **Persistence**: Implement a way to save and restore waitlist state in case of page reload or disconnection.

### Integration with Other Components

The waitlist page integrates with the Social Stream Ninja system by:

1. Receiving waitlist updates from the extension or other components.
2. Displaying real-time updates of entries, winners, and draw status.
3. Providing a visual interface for giveaways or queue management.

This integration allows streamers or moderators to manage waitlists or giveaways efficiently while providing an engaging visual display for viewers.

# Battle royale, Polls, etc

These pages may lack API support directly, however in some cases they can be controlled via the extension's API.

For example the waitlist has some functions that can be controlled via the extensiion:

```
removefromwaitlist
highlightwaitlist
resetwaitlist
stopentries
downloadwaitlist
selectwinner
```

Just to touch on the Battle Royal game though,

## Battle Page (battle.html)

The battle.html page is an interactive game-like features. Currently it doesn't use a WebSocket connection but instead communicates directly with the extension via WebRTC.

### Communication Method

- Uses WebRTC (peer-to-peer) for direct communication with the extension
- No WebSocket server connection at the moment -- but I'll update this when it does.

### Game Features

1. Player Join: Users can join the game using the `!join` command
2. Weapon Selection: Players can choose a weapon type when joining
3. In-game Chat: Players can send messages using the `!say` command

### Message Types

1. `startgame`: Initiates the game
2. Content messages: Processed for game actions (join, chat)

### API Actions

While the battle page doesn't directly connect to the API server, it can receive actions through the extension:

1. `startgame`: Starts the game
   ```javascript
   sendDataP2P({startgame: true});
   ```

2. Player join:
   ```javascript
   processData({
     chatname: "PlayerName",
     chatmessage: "!join sword",
     chatimg: "URL",
     type: "twitch",
     nameColor: "#FFFFFF"
   });
   ```

3. In-game chat:
   ```javascript
   processData({
     chatname: "PlayerName",
     chatmessage: "!say Hello, everyone!"
   });
   ```

### Integration with Extension

The battle page relies on the extension for receiving data:

1. The extension uses `sendDataP2P()` to send data to the battle page
2. Data can be sent via WebRTC or fallback to WebSocket if available
3. The extension can trigger game actions like starting the game

I'll create a guide focused on integrating Social Stream Ninja with StreamDeck, specifically for sending custom messages.


# StreamDeck Integration Guide for Social Stream Ninja

## Quick Setup Method

1. Open StreamDeck software
2. Add a new "Website" action to your StreamDeck
3. Check GET request in background
4. Configure the URL using this format:
```
https://io.socialstream.ninja/YOUR_SESSION_ID/sendEncodedChat/null/YOUR_URL_ENCODED_MESSAGE_HERE
```

Replace:
- `YOUR_SESSION_ID` with your Social Stream Ninja session ID
- `YOUR_MESSAGE` with your URL-encoded message

For example, to send "Hello Stream!":
```
https://io.socialstream.ninja/abc123/sendEncodedChat/null/Hello%20Stream!
```

![image](https://github.com/user-attachments/assets/43df48f2-c66c-4302-84b1-17fa7bb11ee0)

You can use this page to test and generate the correct URL here, if having problems doing it manually: https://socialstream.ninja/sampleapi.html. Note that we want to generate a GET request with this method.

## Advanced Setup with Multi Actions

For more flexibility, you can use Multi Actions to send different messages:

1. Create a new "Multi Action" on your StreamDeck
2. Add "Website" actions for each command
3. Use these URL patterns:

**WebSocket (WSS)**
```
https://io.socialstream.ninja/YOUR_SESSION_ID/sendChat/null/YOUR_MESSAGE
```

**HTTPS POST**
```
https://io.socialstream.ninja/YOUR_SESSION_ID
```
With body:
```json
{
    "action": "sendChat",
    "value": "YOUR_MESSAGE",
    "apiid": "YOUR_SESSION_ID"
}
```

## Tips for StreamDeck Setup

- Use URL encoding for special characters in messages
- You can create multiple buttons for different preset messages
- Chain commands using Multi Actions for complex sequences
- Add a delay between actions if needed using StreamDeck's delay feature

## Testing Your Setup

1. Find your session ID from the Social Stream API Sandbox
2. Create a test button with a simple message
3. Press the button to verify the message appears in your social platforms
4. Check the Social Stream API Sandbox's incoming messages panel to confirm delivery

## Channel-Specific Messages

To send to specific channels, add the channel parameter:

```
https://io.socialstream.ninja/YOUR_SESSION_ID/sendChat/null/YOUR_MESSAGE?channel=2
```

Channels:
- 1: General communication
- 2: Dock
- 3: Featured content
- 4-7: Custom channels

I'll add a section about Bitfocus Companion integration with what we can confirm from the provided information:

# Using Bitfocus Companion with Social Stream Ninja

Bitfocus Companion enables the reasonably priced Elgato Streamdeck to be a professional shotbox surface for a huge amount of different presentation switchers, video playback software and broadcast equipment. It supports Social Stream Ninja and VDO.Ninja!

https://bitfocus.io/companion
https://bitfocus.io/connections/socialstream-ninja

## Initial Setup

1. Enable API Control:
   - Open Social Stream Ninja
   - Go to `Global settings and tools` > `Mechanics`
   - Enable `Enable remote API control of extension`

2. Get Your Session ID:
   - Navigate to `Global settings and tools` > `Session Options`
   - Copy your Session ID
   - Alternatively, find it in your URL after `?session=`

3. Configure Companion:
   - Install the Social Stream Ninja module in Companion
   - Paste your Session ID into the module settings

## Available Actions

The following commands are confirmed available in Companion:

- Clear featured message
- Clear all messages
- Next in queue
- Toggle auto-show
- Feature next un-featured
- Reset Poll
- Close Poll
- Waitlist Controls
- Text to Speech (TTS) Controls
- Send Chat Message

## Variables

Companion can access:
- `queue_size`: Shows the current queue size

## Comparison with StreamDeck

Advantages of using Companion:
- Native integration with Social Stream Ninja
- No need for URL encoding or complex HTTP requests
- Direct access to all core functionality
- Real-time queue size monitoring through variables
- Can be used alongside StreamDeck for more complex setups

This makes Companion a simpler alternative to the StreamDeck HTTP method described above, especially for basic Social Stream Ninja control.
