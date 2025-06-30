# Understanding Social Stream Ninja for AI Integration

This document provides an overview of the Social Stream Ninja (SSN) application, focusing on aspects relevant for AI integration, custom development, and API interaction.

## 1. Introduction

Social Stream Ninja is an application designed to consolidate live social media messaging streams and provide various tools for streamers. It supports numerous platforms like Twitch, YouTube, Facebook, TikTok, and more, capturing chat messages, events, and donations. The system consists of a browser extension (or standalone app), a dock/dashboard page (`dock.html`), and various overlay pages (`featured.html`, `actions.html`, etc.). Communication between these components primarily uses WebSockets via VDO.Ninja's infrastructure, but also supports direct HTTP/POST/SSE interactions.

## 2. Core Concepts

### Session ID & Password

-   **`streamID`**: A unique identifier for a user's session. It's crucial for connecting different components (dock, overlays, API clients) to the correct session. It's typically auto-generated if not set.
-   **`password`**: An optional password to secure the session connection.

### Message Structure

Messages within the SSN system generally follow a JSON object structure. Key fields often include:

-   `id`: Unique identifier for the message (often timestamp-based or incremental).
-   `type`: Source platform (e.g., `twitch`, `youtube`, `facebook`).
-   `chatname`: Display name of the user sending the message.
-   `chatmessage`: The actual message content (can contain HTML or plain text).
-   `chatimg`: URL of the user's avatar.
-   `timestamp`: Time the message was received or generated.
-   `hasDonation`: String describing a donation amount/type (e.g., "$5.00", "100 bits").
-   `membership`: Information about user membership/subscription status.
-   `event`: Indicates if the message represents a stream event (e.g., "follow", "viewer_update").
-   `userid`: Platform-specific user identifier.
-   `nameColor`: User's name color (if available/enabled).
-   `chatbadges`: Array of badge URLs or objects representing user badges.
-   `contentimg`: URL for attached images or videos in the message.
-   `karma`: Sentiment score (if enabled).
-   `bot`: Boolean indicating if the user is identified as a bot.
-   `mod`: Boolean indicating if the user is identified as a moderator.
-   `host`: Boolean indicating if the user is identified as the host.
-   `vip`: Boolean indicating if the user is identified as a VIP.
-   `private`: Boolean indicating if the message is private/direct.
-   `tid`: Tab ID from which the message originated in the browser extension.

### Event Types

The system captures various events beyond simple chat messages, such as follows, subscriptions, viewer count updates, donations, etc.. These often have an `event` field in the message structure.

## 3. Overlays and Customization

SSN provides several HTML-based overlays:

-   **`dock.html`**: The main dashboard for viewing all incoming messages, managing queues, pinning messages, and controlling features.
-   **`featured.html`**: An overlay designed to show *one* featured message at a time, often selected from the dock.
-   **`actions.html`**: An overlay for handling specific actions triggered by points or commands (e.g., showing media).
-   **Other Overlays**: Emotes wall, hype meter, waitlist, ticker, word cloud, poll, credits roll, etc. are also available (`README.md`).

**Customization:**

-   **URL Parameters:** Most overlay pages support extensive customization via URL parameters (e.g., `&scale=`, `&compact`, `&font=`, `&speech=`, `&hidesource`, `&showtime=`). Refer to `popup.html` code and `README.md` for examples.
-   **CSS:** Custom styling can be applied directly using OBS browser source CSS injection or via the `&css` or `&b64css` URL parameters.

## 4. API Interaction

SSN offers multiple ways for external applications or AI to interact with it.

### Connection Methods

-   **WebSocket (WSS):** Recommended for real-time, bidirectional communication.
    -   Endpoint: `wss://io.socialstream.ninja`
    -   Join via URL path: `wss://io.socialstream.ninja/join/SESSION_ID/IN_CHANNEL/OUT_CHANNEL`
    -   Join via message: Connect to the base URL and send `{"join": "SESSION_ID", "in": IN_CHANNEL, "out": OUT_CHANNEL}`.
-   **HTTP (GET/POST/PUT):** For sending commands.
    -   GET: `https://io.socialstream.ninja/SESSION_ID/ACTION/TARGET/VALUE`
    -   POST/PUT: `https://io.socialstream.ninja/SESSION_ID` (with JSON body)
-   **Server-Sent Events (SSE):** For receiving real-time updates from the server.
    -   Endpoint: `https://io.socialstream.ninja/sse/SESSION_ID`

### Channel System

-   Allows routing messages between specific components using numeric channels (1-9).
-   Default channel is 1.
-   `IN_CHANNEL`: Specifies which channel(s) to listen to.
-   `OUT_CHANNEL`: Specifies which channel to send messages to.
-   Example channels:
    -   1: Main/Default
    -   2: Dock Input
    -   3: Dock Output / Extension Input
    -   4: Featured Overlay Input / Extension Output
    -   5: Waitlist Output / Extension Input

### Common API Commands

-   **Sending Messages:**
    -   `sendChat`: Sends a plain text message. `{"action": "sendChat", "value": "message text", "target": "twitch"}`
    -   `sendEncodedChat`: Sends a URL-encoded message.
    -   `extContent`: Ingests a fully formed message object (useful for external sources). `{"action": "extContent", "value": "{JSON message object}"}`
-   **Control Commands:**
    -   `clear`, `clearAll`, `clearOverlay`: Clears messages from dock/overlay.
    -   `nextInQueue`: Advances the message queue.
    -   `autoShow`: Toggles auto-featuring messages.
    -   `toggleTTS`: Toggles text-to-speech.
-   **User Management:**
    -   `blockUser`: Blocks a user. `{"action": "blockUser", "value": {"chatname": "spammer", "type": "youtube"}}`
    -   `toggleVIPUser`: Toggles VIP status for a user.
    -   `getUserHistory`: Requests message history for a user.
-   **Targeting:** Use the `target` field in the JSON payload (or URL for GET) to specify a `label` assigned to a specific dock/overlay instance. `{"action": "...", "target": "overlay1", "value": "..."}`
-   **Channel-Specific Send:** Use actions like `content2`, `content3`, etc., to send directly to specific channels.

### Message Flow

1.  **Capture:** Extension captures messages/events from social platforms.
2.  **Processing (Extension):** `background.js` processes messages, applies bot actions (`applyBotActions`), filters, adds metadata.
3.  **Distribution (Extension):** `sendToDestinations` sends messages via P2P (`sendDataP2P`) or WebSocket server (if configured) to docks, overlays, and potentially external APIs (POST/PUT/H2R/Singular).
4.  **Dock Interaction:** Dock (`dock.html`) receives messages, displays them, allows user interaction (clicking, queuing, pinning).
5.  **Dock Actions:** Dock sends commands back to the Extension (via P2P or server) to feature messages, block users, send replies, etc..
6.  **Overlay Display:** Overlays (`featured.html`, etc.) receive featured content or specific data (like waitlist updates) and display it.
7.  **API Interaction:** External applications/AI can send commands via WebSocket/HTTP to control the system or ingest messages.

## 5. Relay Messages

-   Allows messages from one platform to be automatically re-posted to others.
-   Enabled via settings like `relayall` (relays all messages - **NOT RECOMMENDED** due to spam potential) or `relaydonos` (relays only donation messages).
-   The `relaytargets` setting allows specifying which source types (e.g., `twitch,youtube`) should receive relayed messages.
-   Messages identified as "reflections" (echos of relayed messages) are typically filtered out by the receiving end to prevent loops.

## 6. Text-to-Speech (TTS)

-   SSN supports TTS for incoming messages or featured messages.
-   **Providers:**
    -   System TTS (Free, browser/OS dependent).
    -   Kokoro (Premium FREE, local processing, requires powerful computer).
    -   ElevenLabs (Premium, requires API key).
    -   Google Cloud (Premium, requires API key).
    -   Speechify (Premium, requires API key).
-   **Configuration:** Language, voice, rate, pitch, volume can often be customized via URL parameters or settings.
    -   Examples: `&speech=en-GB`, `&voice=google`, `&rate=1.2`, `&ttsprovider=elevenlabs`, `&elevenlabskey=API_KEY`.
-   **Control:** TTS can be toggled on/off via the dock menu or API (`toggleTTS` action).
-   **Filtering:** Options exist to only TTS donations, members, specific user types, or messages containing a command (e.g., `!say`).

## 7. Other Features

SSN includes many other features, such as:

-   **Points System:** Award points for engagement, track streaks, allow spending points on actions (`points.js`, `pointsactions.js`).
-   **AI Integration:** LLM support (Ollama, ChatGPT, etc.) for chat responses, message censoring, RAG knowledge base (`ai.js`).
-   **Custom Actions:** Scriptable actions via `custom.js`.
-   **MIDI Hotkeys:** Trigger actions via MIDI devices.
-   **Webhooks:** Integrate with external services via webhooks.
-   **Game Overlays:** Battle Royale game, Polls, Word Clouds, etc. (`README.md`).

## 8. Conclusion for AI Integration

Social Stream Ninja offers a robust system for managing multi-platform chat and events. For AI integration:

-   **Connect via WebSocket API:** Use `wss://io.socialstream.ninja` with your `SESSION_ID` to send and receive messages/commands in real-time.
-   **Understand Message Structure:** Parse incoming JSON messages to extract user info, content, and event types.
-   **Ingest Messages:** Use the `extContent` action to push messages from external AI sources into the SSN ecosystem.
-   **Send Replies:** Use `sendChat` to send AI-generated responses back to specific chat platforms.
-   **Control Overlays:** Use `content`, `clear`, and other actions to control what's displayed on featured overlays.
-   **Utilize TTS:** Leverage the TTS system (especially premium providers via API keys) for voice output.
-   **Leverage LLM Features:** Integrate with the built-in LLM capabilities for context-aware responses, moderation, or RAG-based knowledge retrieval.
-   **Targeting:** Use labels and the `target` parameter for precise control in multi-instance setups.

By understanding these components and APIs, an AI can effectively interact with and enhance the Social Stream Ninja experience.