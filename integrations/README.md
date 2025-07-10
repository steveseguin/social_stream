# Social Stream Ninja Integration Guide

This guide provides multiple approaches for creating custom integrations with Social Stream Ninja (SSN).

## Integration Approaches

### 1. Node.js Server Integration (Most Flexible)

**Best for:** Complex integrations requiring file access, databases, or external APIs.

See `phrase-game/` for a complete example that:
- Connects via WebSocket to SSN
- Reads phrases from local files
- Manages game state persistently
- Provides HTTP API for control
- Auto-reconnects on disconnection

**Setup:**
```bash
cd phrase-game
npm install
cp .env.example .env
# Edit .env with your session ID
npm start
```

### 2. Browser-Based Game (Simplest)

**Best for:** Quick deployments without server requirements.

See `/games/phraseguess.html` for an example that:
- Runs entirely in the browser
- Supports both iframe (default) and WebSocket modes
- Stores phrases in localStorage
- Includes demo mode for testing
- Full configuration UI

**Usage:**
```
# Default iframe mode (recommended)
https://socialstream.ninja/games/phraseguess.html?session=YOUR_SESSION_ID

# WebSocket mode (for API server)
https://socialstream.ninja/games/phraseguess.html?session=YOUR_SESSION_ID&server=wss://io.socialstream.ninja

# Demo mode (no connection needed)
https://socialstream.ninja/games/phraseguess.html?demo
```

### 3. Custom.js Integration (Limited)

**Best for:** Simple auto-responses and triggers.

Create a `custom.js` file from `custom_sample.js`:
- Only works with local `dock.html`
- Limited to simple message responses
- Cannot access files or maintain state

### 4. API-Only Integration

**Best for:** Existing applications adding SSN support.

Connect to SSN's WebSocket or HTTP API:
```javascript
// WebSocket
const ws = new WebSocket('wss://io.socialstream.ninja');
ws.send(JSON.stringify({ join: 'SESSION_ID', in: 2, out: 1 }));

// HTTP
fetch('https://io.socialstream.ninja/SESSION_ID/sendChat/null/Hello%20World');
```

## Key Concepts

### Sessions
- Each SSN instance has a unique session ID
- Find it in the extension popup or dock URL
- All integrations need this to connect

### Channels
- Channel 1: Main communication (default)
- Channel 2: Dock messages
- Channel 3: Extension messages
- Channel 4: Featured content
- Channel 5: Waitlist
- Channels 6-10: Custom use

### Message Format
```javascript
{
  chatname: "Username",
  chatmessage: "Message text",
  type: "platform", // twitch, youtube, etc.
  id: 12345,
  timestamp: Date.now()
}
```

### Sending Messages

**Via WebSocket:**
```javascript
ws.send(JSON.stringify({
  action: 'extContent',
  value: JSON.stringify({
    chatname: 'Bot Name',
    chatmessage: 'Hello!',
    type: 'bot'
  })
}));
```

**Via HTTP:**
```javascript
fetch(`https://io.socialstream.ninja/${sessionId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'sendChat',
    value: 'Hello!'
  })
});
```

## Best Practices

1. **Error Handling**
   - Always implement reconnection logic
   - Handle parse errors gracefully
   - Log errors for debugging

2. **Rate Limiting**
   - Don't flood chat with messages
   - Implement cooldowns between responses
   - Respect platform rate limits

3. **User Experience**
   - Provide clear bot identification
   - Include help commands
   - Give feedback for actions

4. **Security**
   - Never expose session IDs publicly
   - Validate all user input
   - Use environment variables for secrets

## Common Patterns

### Dual-Mode Support (iframe + WebSocket)
```javascript
// Check URL parameters
const serverUrl = urlParams.get('server');

if (serverUrl) {
  // WebSocket mode
  const ws = new WebSocket(serverUrl);
  ws.send(JSON.stringify({ join: sessionId, in: 2, out: 1 }));
} else {
  // iframe mode (default)
  const iframe = document.createElement("iframe");
  iframe.src = `https://vdo.socialstream.ninja/?ln&view=${sessionId}...`;
  
  window.addEventListener("message", (e) => {
    if (e.source !== iframe.contentWindow) return;
    if (e.data.dataReceived?.overlayNinja) {
      processData(e.data.dataReceived.overlayNinja);
    }
  });
}
```

### Sending Responses
```javascript
function sendResponse(message) {
  const response = {
    chatname: 'Bot Name',
    chatmessage: message,
    type: 'bot'
  };
  
  if (window.parent !== window) {
    // iframe mode - postMessage to parent
    window.parent.postMessage({
      overlay: 'mygame',
      response: response
    }, '*');
  } else if (ws && ws.readyState === WebSocket.OPEN) {
    // WebSocket mode
    ws.send(JSON.stringify({
      action: 'extContent',
      value: JSON.stringify(response)
    }));
  }
}
```

### Auto-Reconnection
```javascript
function connect() {
  ws = new WebSocket(url);
  ws.onclose = () => {
    setTimeout(connect, 5000);
  };
}
```

### Message Filtering
```javascript
function processMessage(data) {
  // Skip bot messages
  if (data.type === 'bot') return;
  
  // Platform-specific handling
  if (data.type === 'twitch') {
    // Twitch-specific logic
  }
}
```

### State Management
```javascript
const state = {
  users: new Map(),
  cooldowns: new Map(),
  
  isOnCooldown(user) {
    const last = this.cooldowns.get(user);
    return last && (Date.now() - last < 60000);
  }
};
```

## Testing Your Integration

1. **Use Demo Mode**
   - Test without connecting to SSN
   - Simulate different scenarios
   - Verify logic before deployment

2. **Test Session**
   - Create a dedicated test session
   - Use a test stream/chat
   - Monitor console logs

3. **Error Scenarios**
   - Test disconnections
   - Invalid messages
   - Rate limiting

## Resources

- [SSN API Documentation](../api.md)
- [WebSocket API Reference](https://socialstream.ninja/api)
- [Sample API Page](https://socialstream.ninja/sampleapi.html)
- [Discord Community](https://discord.gg/socialstream)

## Contributing

Share your integrations with the community! Consider:
- Creating reusable templates
- Documenting your approach
- Submitting to the SSN examples