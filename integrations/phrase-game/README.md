# SSN Phrase Guessing Game

A phrase guessing game integration for Social Stream Ninja that reads phrases from a file and lets chat participants guess them with progressive reveals.

## Features

- Reads phrases from a text file (one per line)
- Progressively reveals more of the phrase over time
- Configurable masking percentage and reveal intervals
- Fuzzy matching for guesses (word-based matching)
- Automatic game flow with breaks between rounds
- HTTP API for monitoring and control
- Automatic reconnection to SSN
- Customizable bot name and settings

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure the game:**
   - Copy `.env.example` to `.env`
   - Set your SSN session ID in the `.env` file
   - Create a `phrases.txt` file with phrases (one per line)

3. **Run the game:**
   ```bash
   npm start
   ```

## How It Works

1. The game connects to SSN via WebSocket using your session ID
2. It reads phrases from `phrases.txt` (creates sample file if missing)
3. Each round:
   - Displays a masked phrase (e.g., `Th* q**** **own f** j**** o*** *** l*** d**`)
   - Every 10 seconds, reveals more letters
   - First person to guess correctly (70% word match) wins
   - After a round ends, waits 15 seconds before starting the next

## Configuration

### Environment Variables

Create a `.env` file with:

```env
# Required
SSN_SESSION=your_session_id_here

# Optional (defaults shown)
SSN_WS_URL=wss://io.socialstream.ninja
HTTP_PORT=3000
PHRASES_FILE=./phrases.txt
```

### Game Settings

Modify these in the CONFIG object in `server.js`:

- `INITIAL_MASK_PERCENT`: Starting mask percentage (default: 80%)
- `REDUCTION_STEP`: How much to reveal each interval (default: 10%)
- `MATCH_PERCENT`: Required match percentage to win (default: 70%)
- `REVEAL_INTERVAL`: Time between reveals in ms (default: 10000)
- `BOT_NAME`: Name shown in chat (default: "🎵 Music Bot")

### Channel Configuration

- `IN_CHANNEL`: Which SSN channel to listen on (default: 2 - dock)
- `OUT_CHANNEL`: Which SSN channel to send to (default: 1 - main)

## HTTP API Endpoints

The server provides these endpoints for monitoring and control:

- `GET /status` - Get current game status
- `POST /reload-phrases` - Reload phrases from file
- `POST /start` - Manually start a new round
- `POST /stop` - Stop the current game
- `POST /send-message` - Send a custom message to chat

Example:
```bash
curl http://localhost:3000/status
```

## Phrases File Format

Create a `phrases.txt` file with one phrase per line:

```
The quick brown fox jumps over the lazy dog
To be or not to be that is the question
May the force be with you
Houston we have a problem
```

## Customization Guide

### Matching Algorithm

The game uses word-based matching. To customize:

1. Find the `calculateMatchPercent` function
2. Adjust the matching logic (currently counts matching words)
3. Consider adding:
   - Case sensitivity options
   - Partial word matching
   - Typo tolerance

### Visual Customization

Modify the bot messages in these functions:
- `revealPhrase()` - The reveal message format
- `endRound()` - Win/lose announcement format
- `sendToChat()` - Add emoji or formatting

### Game Flow

Adjust timing in:
- `REVEAL_INTERVAL` - Time between reveals
- `setTimeout` in `endRound()` - Break between rounds
- Initial delay in WebSocket `open` event

## Integration with SSN

This game integrates with SSN by:
1. Connecting to the SSN WebSocket server
2. Listening for messages on the configured channel
3. Sending bot responses back through the same connection
4. Using the `extContent` action to send formatted messages

## Troubleshooting

1. **Can't connect to SSN:**
   - Verify your session ID is correct
   - Check that SSN is running and accessible
   - Ensure WebSocket port isn't blocked

2. **Phrases not loading:**
   - Check file path in PHRASES_FILE
   - Ensure file has proper line endings
   - Verify read permissions

3. **Messages not appearing:**
   - Check channel configuration
   - Verify bot messages aren't being filtered
   - Look at console logs for errors

## Development

To run in development mode with auto-restart:
```bash
npm run dev
```

## Extending the Game

This codebase serves as a template for SSN integrations. You can:

1. **Change the game mechanic:**
   - Replace phrase guessing with trivia
   - Add multiple choice options
   - Implement scoring system

2. **Add persistence:**
   - Track high scores
   - Remember players between rounds
   - Store game statistics

3. **Enhanced features:**
   - Multiple difficulty levels
   - Category selection
   - Team play modes
   - Special power-ups

4. **Different data sources:**
   - Database instead of text file
   - API integration for dynamic content
   - RSS feeds for current events

## License

MIT