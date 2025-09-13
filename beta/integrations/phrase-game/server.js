const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configuration
const CONFIG = {
  SSN_SESSION: process.env.SSN_SESSION || 'test123',
  SSN_WS_URL: process.env.SSN_WS_URL || 'wss://io.socialstream.ninja',
  HTTP_PORT: process.env.HTTP_PORT || 3000,
  PHRASES_FILE: process.env.PHRASES_FILE || './phrases.txt',
  
  // Game settings
  INITIAL_MASK_PERCENT: 80,
  REDUCTION_STEP: 10,
  MIN_MASK_PERCENT: 0,
  MATCH_PERCENT: 70,
  REVEAL_INTERVAL: 10000, // 10 seconds
  
  // Channel configuration
  IN_CHANNEL: 2,  // Listen to dock messages
  OUT_CHANNEL: 1, // Send to main channel
  
  // Bot settings
  BOT_NAME: '🎵 Music Bot',
  BOT_TYPE: 'bot'
};

// Game state
let gameState = {
  currentPhrase: '',
  normalizedPhrase: '',
  maskedPhrase: '',
  maskPercent: CONFIG.INITIAL_MASK_PERCENT,
  isActive: false,
  winner: null,
  revealTimer: null,
  lastPhraseIndex: -1,
  phrases: []
};

// WebSocket connection
let ws = null;
let reconnectInterval = null;

// Utility functions
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function calculateMatchPercent(guess, target) {
  const guessWords = guess.split(/\s+/);
  const targetWords = target.split(/\s+/);
  let matchCount = 0;

  for (const guessWord of guessWords) {
    for (const targetWord of targetWords) {
      if (guessWord === targetWord) {
        matchCount++;
        break;
      }
    }
  }

  const maxLength = Math.max(guessWords.length, targetWords.length);
  return Math.floor((matchCount / maxLength) * 100);
}

function maskText(text, maskPercent) {
  const chars = [...text];
  const maskableIndices = [];

  // Collect indices of maskable characters (not spaces)
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== ' ') {
      maskableIndices.push(i);
    }
  }

  // Calculate how many characters to mask
  const maskCount = Math.ceil(maskableIndices.length * (maskPercent / 100));

  // Shuffle indices
  for (let i = maskableIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [maskableIndices[i], maskableIndices[j]] = [maskableIndices[j], maskableIndices[i]];
  }

  // Mask the selected characters
  for (let i = 0; i < maskCount && i < maskableIndices.length; i++) {
    chars[maskableIndices[i]] = '*';
  }

  return chars.join('');
}

// Load phrases from file
async function loadPhrases() {
  try {
    const data = await fs.readFile(CONFIG.PHRASES_FILE, 'utf8');
    gameState.phrases = data
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    log(`Loaded ${gameState.phrases.length} phrases from file`);
    return true;
  } catch (error) {
    log('Error loading phrases file:', error.message);
    // Create sample file if it doesn't exist
    if (error.code === 'ENOENT') {
      const samplePhrases = [
        'The quick brown fox jumps over the lazy dog',
        'To be or not to be that is the question',
        'May the force be with you',
        'Houston we have a problem',
        'E.T. phone home',
        'I\'ll be back',
        'Life is like a box of chocolates',
        'Show me the money',
        'You can\'t handle the truth',
        'I\'m the king of the world'
      ];
      
      await fs.writeFile(CONFIG.PHRASES_FILE, samplePhrases.join('\n'), 'utf8');
      log('Created sample phrases file');
      gameState.phrases = samplePhrases;
      return true;
    }
    return false;
  }
}

// Get next phrase
function getNextPhrase() {
  if (gameState.phrases.length === 0) return null;
  
  // Simple sequential selection, wrapping around
  gameState.lastPhraseIndex = (gameState.lastPhraseIndex + 1) % gameState.phrases.length;
  return gameState.phrases[gameState.lastPhraseIndex];
}

// Send message to SSN
function sendToChat(message, messageType = 'game') {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log('WebSocket not connected, cannot send message');
    return;
  }

  const messageData = {
    action: 'extContent',
    value: JSON.stringify({
      chatname: CONFIG.BOT_NAME,
      chatmessage: message,
      type: CONFIG.BOT_TYPE,
      id: Date.now(),
      timestamp: Date.now()
    })
  };

  ws.send(JSON.stringify(messageData));
  log('Sent to chat:', message);
}

// Start a new game round
async function startNewRound() {
  // Load or reload phrases
  if (gameState.phrases.length === 0) {
    await loadPhrases();
  }

  const phrase = getNextPhrase();
  if (!phrase) {
    log('No phrases available');
    return;
  }

  gameState.currentPhrase = phrase;
  gameState.normalizedPhrase = normalizeText(phrase);
  gameState.maskPercent = CONFIG.INITIAL_MASK_PERCENT;
  gameState.isActive = true;
  gameState.winner = null;

  log('Starting new round with phrase:', phrase);
  
  // Initial reveal
  revealPhrase();
  
  // Start reveal timer
  gameState.revealTimer = setInterval(revealPhrase, CONFIG.REVEAL_INTERVAL);
}

// Reveal more of the phrase
function revealPhrase() {
  if (!gameState.isActive) return;

  gameState.maskedPhrase = maskText(gameState.currentPhrase, gameState.maskPercent);
  
  sendToChat(`🎵 What's Playing?: ${gameState.maskedPhrase}`);
  
  // Reduce mask for next reveal
  gameState.maskPercent = Math.max(CONFIG.MIN_MASK_PERCENT, gameState.maskPercent - CONFIG.REDUCTION_STEP);
  
  // If fully revealed and no winner
  if (gameState.maskPercent === 0 && !gameState.winner) {
    endRound(null);
  }
}

// End the current round
function endRound(winner) {
  if (!gameState.isActive) return;

  clearInterval(gameState.revealTimer);
  gameState.isActive = false;
  
  if (winner) {
    sendToChat(`🎉 |||| ${winner} |||| is correct! The answer was: ${gameState.currentPhrase}`);
    gameState.winner = winner;
  } else {
    sendToChat(`⏰ Time's up! The answer was: ${gameState.currentPhrase}`);
  }
  
  // Start new round after delay
  setTimeout(startNewRound, 15000); // 15 second break between rounds
}

// Process incoming chat message
function processMessage(data) {
  if (!gameState.isActive || !data.chatmessage || !data.chatname) return;
  
  // Skip bot messages
  if (data.type === 'bot' || data.chatname === CONFIG.BOT_NAME) return;
  
  const guess = normalizeText(data.chatmessage);
  const matchPercent = calculateMatchPercent(guess, gameState.normalizedPhrase);
  
  log(`Match check for ${data.chatname}: ${matchPercent}% (threshold: ${CONFIG.MATCH_PERCENT}%)`);
  
  if (matchPercent >= CONFIG.MATCH_PERCENT) {
    endRound(data.chatname);
  }
}

// WebSocket connection management
function connectWebSocket() {
  const wsUrl = `${CONFIG.SSN_WS_URL}/join/${CONFIG.SSN_SESSION}/${CONFIG.IN_CHANNEL}/${CONFIG.OUT_CHANNEL}`;
  
  log('Connecting to SSN WebSocket:', wsUrl);
  
  ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    log('Connected to SSN WebSocket');
    clearInterval(reconnectInterval);
    
    // Send initial message
    sendToChat('🎮 Phrase Guessing Game is online! Get ready to guess the phrases!');
    
    // Start first round after a delay
    setTimeout(startNewRound, 5000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Process chat messages
      if (message.chatmessage) {
        processMessage(message);
      }
      
      // Handle other message types if needed
      if (message.action) {
        log('Received action:', message.action);
      }
    } catch (error) {
      log('Error parsing message:', error.message);
    }
  });
  
  ws.on('error', (error) => {
    log('WebSocket error:', error.message);
  });
  
  ws.on('close', () => {
    log('WebSocket connection closed');
    
    // Clear game state
    clearInterval(gameState.revealTimer);
    gameState.isActive = false;
    
    // Reconnect after delay
    if (!reconnectInterval) {
      reconnectInterval = setInterval(() => {
        log('Attempting to reconnect...');
        connectWebSocket();
      }, 5000);
    }
  });
}

// Express server for HTTP API (optional)
const app = express();
app.use(cors());
app.use(express.json());

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    connected: ws && ws.readyState === WebSocket.OPEN,
    gameActive: gameState.isActive,
    currentPhrase: gameState.isActive ? gameState.maskedPhrase : null,
    phrasesLoaded: gameState.phrases.length,
    config: {
      session: CONFIG.SSN_SESSION,
      revealInterval: CONFIG.REVEAL_INTERVAL,
      matchPercent: CONFIG.MATCH_PERCENT
    }
  });
});

// Reload phrases endpoint
app.post('/reload-phrases', async (req, res) => {
  const loaded = await loadPhrases();
  res.json({ 
    success: loaded, 
    count: gameState.phrases.length 
  });
});

// Manual game control endpoints
app.post('/start', (req, res) => {
  if (!gameState.isActive) {
    startNewRound();
    res.json({ success: true, message: 'Game started' });
  } else {
    res.json({ success: false, message: 'Game already active' });
  }
});

app.post('/stop', (req, res) => {
  if (gameState.isActive) {
    clearInterval(gameState.revealTimer);
    gameState.isActive = false;
    sendToChat('🛑 Game stopped by administrator');
    res.json({ success: true, message: 'Game stopped' });
  } else {
    res.json({ success: false, message: 'No game active' });
  }
});

// Send custom message
app.post('/send-message', (req, res) => {
  const { message } = req.body;
  if (message) {
    sendToChat(message);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Message required' });
  }
});

// Start server
app.listen(CONFIG.HTTP_PORT, () => {
  log(`HTTP API server running on port ${CONFIG.HTTP_PORT}`);
  log('Endpoints:');
  log(`  GET  http://localhost:${CONFIG.HTTP_PORT}/status`);
  log(`  POST http://localhost:${CONFIG.HTTP_PORT}/reload-phrases`);
  log(`  POST http://localhost:${CONFIG.HTTP_PORT}/start`);
  log(`  POST http://localhost:${CONFIG.HTTP_PORT}/stop`);
  log(`  POST http://localhost:${CONFIG.HTTP_PORT}/send-message`);
});

// Initialize
async function init() {
  log('Starting SSN Phrase Game Integration...');
  log('Configuration:', CONFIG);
  
  // Load phrases
  await loadPhrases();
  
  // Connect to SSN
  connectWebSocket();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down...');
  
  if (gameState.isActive) {
    sendToChat('🛑 Game server shutting down. Thanks for playing!');
  }
  
  clearInterval(gameState.revealTimer);
  clearInterval(reconnectInterval);
  
  if (ws) {
    ws.close();
  }
  
  process.exit(0);
});

// Start the integration
init();