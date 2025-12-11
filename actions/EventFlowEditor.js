// Predefined flow templates for quick setup
const FLOW_TEMPLATES = {
    // === SIMPLE TEMPLATES ===
    'chat-relay': {
        name: 'Chat Relay to Discord',
        description: 'Forward chat messages to a Discord webhook',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'anyMessage', x: 100, y: 150, config: {} },
            { id: 'action_1', type: 'action', actionType: 'webhook', x: 400, y: 150, config: { url: 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN', method: 'POST', body: '{"content": "{username}: {message}"}', includeMessage: false, syncMode: false, blockOnFailure: false } }
        ],
        connections: [{ from: 'trigger_1', to: 'action_1' }]
    },
    'song-request': {
        name: 'Song Request (!sr)',
        description: 'Queue Spotify tracks from chat with !sr command',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'messageStartsWith', x: 100, y: 150, config: { text: '!sr ' } },
            { id: 'action_1', type: 'action', actionType: 'spotifyQueue', x: 400, y: 150, config: { extractFromMessage: true, announceResult: true } }
        ],
        connections: [{ from: 'trigger_1', to: 'action_1' }]
    },
    'channel-points': {
        name: 'Channel Points Sound',
        description: 'Play a sound when channel points are redeemed',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'channelPointRedemption', x: 100, y: 150, config: { rewardName: '' } },
            { id: 'action_1', type: 'action', actionType: 'playAudioClip', x: 400, y: 150, config: { audioUrl: 'https://vdo.ninja/media/join.wav', volume: 1.0 } }
        ],
        connections: [{ from: 'trigger_1', to: 'action_1' }]
    },
    'tts-chat': {
        name: 'TTS for Chat',
        description: 'Read chat messages aloud with text-to-speech',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'anyMessage', x: 100, y: 150, config: {} },
            { id: 'action_1', type: 'action', actionType: 'ttsSpeak', x: 400, y: 150, config: { text: '{username} says {message}', voice: '', rate: 1, pitch: 1, volume: 1 } }
        ],
        connections: [{ from: 'trigger_1', to: 'action_1' }]
    },
    'donation-alert': {
        name: 'Donation Alert',
        description: 'Play sound and show text when someone donates',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'hasDonation', x: 100, y: 150, config: {} },
            { id: 'action_1', type: 'action', actionType: 'playAudioClip', x: 350, y: 100, config: { audioUrl: 'https://vdo.ninja/media/join.wav', volume: 1.0 } },
            { id: 'action_2', type: 'action', actionType: 'showText', x: 350, y: 200, config: { text: '💰 {username} donated!', x: 50, y: 50, width: 50, fontSize: 48, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', color: '#FFD700', backgroundColor: 'rgba(0,0,0,0.8)', padding: 20, borderRadius: 10, animation: 'bounceIn', animationDuration: 500, duration: 5000 } }
        ],
        connections: [
            { from: 'trigger_1', to: 'action_1' },
            { from: 'trigger_1', to: 'action_2' }
        ]
    },
    'skip-song': {
        name: 'Skip Song Command',
        description: 'Let mods skip the current Spotify track with !skip',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'messageEquals', x: 100, y: 100, config: { text: '!skip' } },
            { id: 'trigger_2', type: 'trigger', triggerType: 'userRole', x: 100, y: 200, config: { role: 'mod' } },
            { id: 'logic_1', type: 'logic', logicType: 'AND', x: 300, y: 150, config: {} },
            { id: 'action_1', type: 'action', actionType: 'spotifySkip', x: 500, y: 150, config: {} }
        ],
        connections: [
            { from: 'trigger_1', to: 'logic_1' },
            { from: 'trigger_2', to: 'logic_1' },
            { from: 'logic_1', to: 'action_1' }
        ]
    },

    // === INTERMEDIATE TEMPLATES ===
    'bad-words-filter': {
        name: 'Bad Words Filter',
        description: 'Block messages containing profanity',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'anyMessage', x: 100, y: 150, config: {} },
            { id: 'logic_1', type: 'logic', logicType: 'CHECK_BAD_WORDS', x: 300, y: 150, config: {} },
            { id: 'action_1', type: 'action', actionType: 'blockMessage', x: 500, y: 150, config: {} }
        ],
        connections: [
            { from: 'trigger_1', to: 'logic_1' },
            { from: 'logic_1', to: 'action_1' }
        ]
    },
    'alert-overlay': {
        name: 'Chat Alert Overlay',
        description: 'Show avatar and text overlay for new messages',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'anyMessage', x: 50, y: 150, config: {} },
            { id: 'action_1', type: 'action', actionType: 'continueAsync', x: 200, y: 150, config: {} },
            { id: 'action_2', type: 'action', actionType: 'showAvatar', x: 350, y: 100, config: { avatarUrl: '', width: 15, height: 15, x: 5, y: 5, randomX: false, randomY: false, borderRadius: 50, borderWidth: 3, borderColor: '#ffffff', shadow: true, duration: 5000, clearFirst: true } },
            { id: 'action_3', type: 'action', actionType: 'showText', x: 500, y: 100, config: { text: '{username}: {message}', x: 25, y: 5, width: 70, fontSize: 32, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'left', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.7)', padding: 15, borderRadius: 10, outlineWidth: 0, outlineColor: '#000000', animation: 'fadeIn', animationDuration: 300, duration: 5000, clearFirst: false } },
            { id: 'action_4', type: 'action', actionType: 'delay', x: 650, y: 150, config: { delayMs: 5000 } },
            { id: 'action_5', type: 'action', actionType: 'clearLayer', x: 800, y: 150, config: { layer: 'all' } }
        ],
        connections: [
            { from: 'trigger_1', to: 'action_1' },
            { from: 'action_1', to: 'action_2' },
            { from: 'action_2', to: 'action_3' },
            { from: 'action_3', to: 'action_4' },
            { from: 'action_4', to: 'action_5' }
        ]
    },
    'vip-highlight': {
        name: 'VIP Message Highlight',
        description: 'Show special overlay for VIP/sub messages',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'userRole', x: 100, y: 150, config: { role: 'vip' } },
            { id: 'action_1', type: 'action', actionType: 'showText', x: 400, y: 150, config: { text: '⭐ {username}: {message}', x: 10, y: 80, width: 80, fontSize: 36, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'left', color: '#FFD700', backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 10, animation: 'slideInLeft', animationDuration: 300, duration: 6000 } }
        ],
        connections: [{ from: 'trigger_1', to: 'action_1' }]
    },
    'link-blocker': {
        name: 'Block Links (Non-Mods)',
        description: 'Block messages with links unless from mods',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'containsLink', x: 100, y: 100, config: {} },
            { id: 'trigger_2', type: 'trigger', triggerType: 'userRole', x: 100, y: 200, config: { role: 'mod' } },
            { id: 'logic_1', type: 'logic', logicType: 'NOT', x: 300, y: 200, config: {} },
            { id: 'logic_2', type: 'logic', logicType: 'AND', x: 450, y: 150, config: {} },
            { id: 'action_1', type: 'action', actionType: 'blockMessage', x: 650, y: 150, config: {} }
        ],
        connections: [
            { from: 'trigger_1', to: 'logic_2' },
            { from: 'trigger_2', to: 'logic_1' },
            { from: 'logic_1', to: 'logic_2' },
            { from: 'logic_2', to: 'action_1' }
        ]
    },
    'now-playing': {
        name: 'Now Playing Command',
        description: 'Show current Spotify track with !np or !song',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'messageEquals', x: 100, y: 100, config: { text: '!np' } },
            { id: 'trigger_2', type: 'trigger', triggerType: 'messageEquals', x: 100, y: 200, config: { text: '!song' } },
            { id: 'logic_1', type: 'logic', logicType: 'OR', x: 300, y: 150, config: {} },
            { id: 'action_1', type: 'action', actionType: 'spotifyNowPlaying', x: 500, y: 150, config: { format: '🎵 Now playing: {song} by {artist}' } }
        ],
        connections: [
            { from: 'trigger_1', to: 'logic_1' },
            { from: 'trigger_2', to: 'logic_1' },
            { from: 'logic_1', to: 'action_1' }
        ]
    },

    // === ADVANCED TEMPLATES ===
    'song-request-filtered': {
        name: 'Safe Song Requests',
        description: 'Song requests with bad words filter',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'messageStartsWith', x: 50, y: 150, config: { text: '!sr ' } },
            { id: 'logic_1', type: 'logic', logicType: 'CHECK_BAD_WORDS', x: 250, y: 150, config: {} },
            { id: 'logic_2', type: 'logic', logicType: 'NOT', x: 400, y: 200, config: {} },
            { id: 'action_1', type: 'action', actionType: 'blockMessage', x: 550, y: 100, config: {} },
            { id: 'action_2', type: 'action', actionType: 'spotifyQueue', x: 550, y: 200, config: { extractFromMessage: true, announceResult: true } }
        ],
        connections: [
            { from: 'trigger_1', to: 'logic_1' },
            { from: 'logic_1', to: 'action_1' },
            { from: 'logic_1', to: 'logic_2' },
            { from: 'logic_2', to: 'action_2' }
        ]
    },
    'raid-welcome': {
        name: 'Raid Welcome',
        description: 'Welcome raiders with sound and overlay',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'eventType', x: 100, y: 150, config: { eventType: 'raid' } },
            { id: 'action_1', type: 'action', actionType: 'playAudioClip', x: 350, y: 80, config: { audioUrl: 'https://vdo.ninja/media/join.wav', volume: 1.0 } },
            { id: 'action_2', type: 'action', actionType: 'showText', x: 350, y: 180, config: { text: '🎉 RAID! Welcome {username} and their community!', x: 10, y: 40, width: 80, fontSize: 42, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', color: '#FF6B6B', backgroundColor: 'rgba(0,0,0,0.9)', padding: 25, borderRadius: 15, animation: 'bounceIn', animationDuration: 500, duration: 10000 } },
            { id: 'action_3', type: 'action', actionType: 'ttsSpeak', x: 350, y: 280, config: { text: 'Welcome raiders from {username}!', voice: '', rate: 1, pitch: 1, volume: 1 } }
        ],
        connections: [
            { from: 'trigger_1', to: 'action_1' },
            { from: 'trigger_1', to: 'action_2' },
            { from: 'trigger_1', to: 'action_3' }
        ]
    },
    'random-highlight': {
        name: 'Random Message Highlight',
        description: 'Randomly highlight 10% of chat messages',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'anyMessage', x: 100, y: 150, config: {} },
            { id: 'logic_1', type: 'logic', logicType: 'RANDOM', x: 300, y: 150, config: { probability: 10 } },
            { id: 'action_1', type: 'action', actionType: 'playAudioClip', x: 500, y: 100, config: { audioUrl: 'https://vdo.ninja/media/join.wav', volume: 0.5 } },
            { id: 'action_2', type: 'action', actionType: 'showText', x: 500, y: 200, config: { text: '✨ {username}: {message}', x: 10, y: 10, width: 80, fontSize: 36, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'left', color: '#00FF00', backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 10, animation: 'pulse', animationDuration: 300, duration: 5000 } }
        ],
        connections: [
            { from: 'trigger_1', to: 'logic_1' },
            { from: 'logic_1', to: 'action_1' },
            { from: 'logic_1', to: 'action_2' }
        ]
    },
    'big-donation': {
        name: 'Big Donation Alert',
        description: 'Special alert for donations over $10',
        nodes: [
            { id: 'trigger_1', type: 'trigger', triggerType: 'hasDonation', x: 100, y: 100, config: {} },
            { id: 'trigger_2', type: 'trigger', triggerType: 'compareProperty', x: 100, y: 200, config: { property: 'donationAmount', operator: 'gte', value: 10 } },
            { id: 'logic_1', type: 'logic', logicType: 'AND', x: 300, y: 150, config: {} },
            { id: 'action_1', type: 'action', actionType: 'playAudioClip', x: 500, y: 100, config: { audioUrl: 'https://vdo.ninja/media/join.wav', volume: 1.0 } },
            { id: 'action_2', type: 'action', actionType: 'showText', x: 500, y: 200, config: { text: '🎉 BIG DONATION! {username} donated ${donationAmount}!', x: 20, y: 30, width: 60, fontSize: 48, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', color: '#FFD700', backgroundColor: 'rgba(139,0,0,0.9)', padding: 30, borderRadius: 15, animation: 'bounceIn', animationDuration: 500, duration: 10000 } },
            { id: 'action_3', type: 'action', actionType: 'ttsSpeak', x: 700, y: 150, config: { text: 'Wow! {username} just donated ${donationAmount}! Thank you so much!', voice: '', rate: 1, pitch: 1, volume: 1 } }
        ],
        connections: [
            { from: 'trigger_1', to: 'logic_1' },
            { from: 'trigger_2', to: 'logic_1' },
            { from: 'logic_1', to: 'action_1' },
            { from: 'logic_1', to: 'action_2' },
            { from: 'action_2', to: 'action_3' }
        ]
    }
};

class EventFlowEditor {
    constructor(container, eventFlowSystem) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.eventFlowSystem = eventFlowSystem;
        this.currentFlow = {
            id: null,
            name: 'New Flow',
            description: '',
            active: true,
            nodes: [],
            connections: []
        };
		this.draggedFlowItem = null;
        this.selectedNode = null;
        this.draggedNode = null;
        this.draggedConnection = null;
        this.dragOffset = { x: 0, y: 0 };
        this.unsavedChanges = false;
        try {
            this.noFlowHelpDismissed = window.localStorage.getItem('ssn-eventflow-help-dismissed') === '1';
        } catch (error) {
            console.debug('Unable to read Event Flow help dismissal state', error);
            this.noFlowHelpDismissed = false;
        }
		
        // Initialize all node type definitions here
        this.triggerTypes = [
            { id: 'anyMessage', name: '💬 Any Message' },
            { id: 'messageContains', name: '🔍 Message Contains' },
            { id: 'messageStartsWith', name: '▶️ Message Starts With' },
            { id: 'messageEndsWith', name: '⏹️ Message Ends With' },
            { id: 'messageEquals', name: '🟰 Message Equals' },
            { id: 'messageRegex', name: '🔤 Message Regex' },
            { id: 'messageLength', name: '📏 Message Length' },
            { id: 'wordCount', name: '🔢 Word Count' },
            { id: 'containsEmoji', name: '😀 Contains Emoji' },
            { id: 'containsLink', name: '🔗 Contains Link' },
            { id: 'fromSource', name: '📡 From Source' },
            { id: 'fromChannelName', name: '📺 From Channel Name' },
            { id: 'fromUser', name: '👤 From User' },
            { id: 'userRole', name: '👑 User Role' },
            { id: 'hasDonation', name: '💰 Has Donation' },
            { id: 'channelPointRedemption', name: '🎁 Channel Point Redemption' },
            { id: 'eventType', name: '📣 Event Type' },
            { id: 'compareProperty', name: '⚖️ Compare Property' },
            { id: 'randomChance', name: '🎲 Random Chance' },
            { id: 'timeInterval', name: '⏰ Time Interval' },
            { id: 'timeOfDay', name: '🕐 Time of Day' },
            { id: 'midiNoteOn', name: '🎹 MIDI Note On' },
            { id: 'midiNoteOff', name: '🎹 MIDI Note Off' },
            { id: 'midiCC', name: '🎛️ MIDI Control Change' },
            { id: 'messageProperties', name: '⚙️ Message Properties Filter' }
        ];

        // Grouped action types for collapsible sections
        this.actionGroups = [
            {
                id: 'message',
                name: '💬 Message Actions',
                expanded: true,
                actions: [
                    { id: 'blockMessage', name: '🚫 Block Message' },
                    { id: 'returnMessage', name: '✅ Return Message' },
                    { id: 'continueAsync', name: '⚡ Continue Async' },
                    { id: 'modifyMessage', name: '✏️ Modify Message' },
                    { id: 'addPrefix', name: '⬅️ Add Prefix' },
                    { id: 'addSuffix', name: '➡️ Add Suffix' },
                    { id: 'findReplace', name: '🔄 Find & Replace' },
                    { id: 'removeText', name: '✂️ Remove Text' },
                    { id: 'setProperty', name: '🎨 Set Property' },
                    { id: 'sendMessage', name: '💬 Send Message' },
                    { id: 'relay', name: '📢 Relay Chat' },
                    { id: 'reflectionFilter', name: '🪞 Reflection Filter' }
                ]
            },
            {
                id: 'integrations',
                name: '🔌 Integrations',
                expanded: true,
                actions: [
                    { id: 'webhook', name: '🌐 Call Webhook' },
                    { id: 'addPoints', name: '⬆️ Add Points' },
                    { id: 'spendPoints', name: '⬇️ Spend Points' }
                ]
            },
            {
                id: 'media',
                name: '🎨 Media & Effects',
                expanded: true,
                actions: [
                    { id: 'playTenorGiphy', name: '🖼️ Display Media Overlay' },
                    { id: 'showAvatar', name: '👤 Show Avatar' },
                    { id: 'showText', name: '📝 Show Text' },
                    { id: 'clearLayer', name: '🗑️ Clear Layer' },
                    { id: 'playAudioClip', name: '🔊 Play Audio Clip' },
                    { id: 'delay', name: '⏱️ Delay' }
                ]
            },
            {
                id: 'obs',
                name: '🎬 OBS Studio',
                expanded: false,
                actions: [
                    { id: 'triggerOBSScene', name: '🎬 Trigger OBS Scene' },
                    { id: 'obsChangeScene', name: '🎬 Change Scene' },
                    { id: 'obsToggleSource', name: '👁️ Toggle Source' },
                    { id: 'obsSetSourceFilter', name: '🎨 Toggle Filter' },
                    { id: 'obsMuteSource', name: '🔇 Mute/Unmute Audio' },
                    { id: 'obsStartRecording', name: '🔴 Start Recording' },
                    { id: 'obsStopRecording', name: '⏹️ Stop Recording' },
                    { id: 'obsStartStreaming', name: '📡 Start Streaming' },
                    { id: 'obsStopStreaming', name: '⏹️ Stop Streaming' },
                    { id: 'obsReplayBuffer', name: '💾 Save Replay Buffer' }
                ]
            },
            {
                id: 'spotify',
                name: '🎵 Spotify',
                expanded: false,
                actions: [
                    { id: 'spotifySkip', name: '⏭️ Skip Track' },
                    { id: 'spotifyPrevious', name: '⏮️ Previous Track' },
                    { id: 'spotifyPause', name: '⏸️ Pause' },
                    { id: 'spotifyResume', name: '▶️ Resume' },
                    { id: 'spotifyToggle', name: '⏯️ Toggle Play/Pause' },
                    { id: 'spotifyVolume', name: '🔊 Set Volume' },
                    { id: 'spotifyQueue', name: '📋 Add to Queue' },
                    { id: 'spotifyNowPlaying', name: '🎵 Announce Now Playing' },
                    { id: 'spotifyShuffle', name: '🔀 Toggle Shuffle' },
                    { id: 'spotifyRepeat', name: '🔁 Set Repeat Mode' }
                ]
            },
            {
                id: 'tts',
                name: '🔊 Text to Speech',
                expanded: false,
                actions: [
                    { id: 'ttsSpeak', name: '🗣️ Speak Text' },
                    { id: 'ttsToggle', name: '🔇 Toggle TTS' },
                    { id: 'ttsSkip', name: '⏭️ Skip TTS' },
                    { id: 'ttsClear', name: '🗑️ Clear TTS Queue' },
                    { id: 'ttsVolume', name: '🔊 Set TTS Volume' }
                ]
            },
            {
                id: 'midi',
                name: '🎹 MIDI',
                expanded: false,
                actions: [
                    { id: 'midiSendNote', name: '🎹 Send Note' },
                    { id: 'midiSendCC', name: '🎛️ Send Control Change' }
                ]
            },
            {
                id: 'state',
                name: '🔧 State Control',
                expanded: false,
                actions: [
                    { id: 'setGateState', name: '🚦 Set Gate State' },
                    { id: 'resetStateNode', name: '🔄 Reset State Node' },
                    { id: 'setCounter', name: '🔢 Set Counter Value' },
                    { id: 'incrementCounter', name: '➕ Increment Counter' }
                ]
            }
        ];

        // Flatten for backward compatibility
        this.actionTypes = this.actionGroups.flatMap(group => group.actions);

        // Check if we're in ssapp context for cross-origin communication
        const urlParams = new URLSearchParams(window.location.search);
        this.isSSApp = urlParams.has('ssapp');
        
        // Ensure logicNodeTypes is initialized HERE
        this.logicNodeTypes = [
            { id: 'AND', name: '🔀 AND Gate', type: 'logic', logicType: 'AND' }, // Added type/logicType for consistency if needed elsewhere
            { id: 'OR', name: '🔄 OR Gate', type: 'logic', logicType: 'OR' },
            { id: 'NOT', name: '🚫 NOT Gate', type: 'logic', logicType: 'NOT' },
            { id: 'RANDOM', name: '🎲 RANDOM Gate', type: 'logic', logicType: 'RANDOM' },
            { id: 'CHECK_BAD_WORDS', name: '🚫 Check Bad Words', type: 'logic', logicType: 'CHECK_BAD_WORDS' }
        ];
        
        // State management nodes - maintain state between messages
        this.stateNodeTypes = [
            { id: 'GATE', name: '🚦 On/Off Switch', type: 'state', stateType: 'GATE' },
            { id: 'COUNTER', name: '🔢 Counter', type: 'state', stateType: 'COUNTER' },
            { id: 'THROTTLE', name: '⏲️ Rate Limiter', type: 'state', stateType: 'THROTTLE' }
        ];

        this.init(); // init() will call createEditorLayout()
    }

    // Helper method to escape HTML special characters to prevent XSS
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    init() {
        this.createEditorLayout(); // Now this.logicNodeTypes will be defined
        this.initEventListeners();
        this.loadFlowList();
    }

    createEditorLayout() {
        this.container.innerHTML = `
            <div class="flow-editor-container">
                <div class="flow-sidebar">
                    <div class="flow-list-container">
                        <h3>Flows</h3>
                        <div class="flow-list" id="flow-list"></div>
                        <button id="new-flow-btn" class="btn"><span style="color: #4CAF50; margin-right: 5px;">+</span>Create New Flow</button>
                        <div class="flow-import-export" style="display: flex; gap: 5px; margin-top: 10px;">
                            <button id="import-flow-btn" class="btn" style="flex: 1; min-width: 0; padding: 8px 12px; font-size: 14px;">📥 Import</button>
                            <button id="export-all-btn" class="btn" style="flex: 1; min-width: 0; padding: 8px 12px; font-size: 14px;">📤 Export All</button>
                        </div>
                        <select id="template-select" class="btn" style="width: 100%; margin-top: 10px; padding: 8px 12px; font-size: 14px; cursor: pointer;">
                            <option value="">📋 Load Template...</option>
                            <optgroup label="Simple">
                                <option value="chat-relay">Chat Relay to Discord</option>
                                <option value="song-request">Song Request (!sr)</option>
                                <option value="channel-points">Channel Points Sound</option>
                                <option value="tts-chat">TTS for Chat</option>
                                <option value="donation-alert">Donation Alert</option>
                                <option value="skip-song">Skip Song Command (Mods)</option>
                            </optgroup>
                            <optgroup label="Intermediate">
                                <option value="bad-words-filter">Bad Words Filter</option>
                                <option value="alert-overlay">Chat Alert Overlay</option>
                                <option value="vip-highlight">VIP Message Highlight</option>
                                <option value="link-blocker">Block Links (Non-Mods)</option>
                                <option value="now-playing">Now Playing Command</option>
                            </optgroup>
                            <optgroup label="Advanced">
                                <option value="song-request-filtered">Safe Song Requests</option>
                                <option value="raid-welcome">Raid Welcome</option>
                                <option value="random-highlight">Random Message Highlight</option>
                                <option value="big-donation">Big Donation Alert</option>
                            </optgroup>
                        </select>
                    </div>
                    <div class="node-palette">
                        <h3>Triggers</h3>
                        <div class="node-list" id="trigger-list">
                            ${this.triggerTypes.map(trigger => `
                                <div class="node-item trigger" data-nodetype="trigger" data-subtype="${trigger.id}" draggable="true" ${trigger.id === 'customJs' ? 'style="display: none;"' : ''}>
                                    ${trigger.name}
                                </div>
                            `).join('')}
                        </div>
                        <h3>Actions</h3>
                        <div class="node-list" id="action-list">
                            ${this.actionGroups.map(group => `
                                <div class="action-group" data-group="${group.id}">
                                    <div class="action-group-header ${group.expanded ? 'expanded' : 'collapsed'}" data-group="${group.id}">
                                        <span class="action-group-toggle">${group.expanded ? '▼' : '▶'}</span>
                                        <span class="action-group-name">${group.name}</span>
                                    </div>
                                    <div class="action-group-items" style="${group.expanded ? '' : 'display: none;'}">
                                        ${group.actions.map(action => `
                                            <div class="node-item action" data-nodetype="action" data-subtype="${action.id}" draggable="true">
                                                ${action.name}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <h3>Logic Gates</h3>
                        <div class="node-list" id="logic-list">
                            ${this.logicNodeTypes.map(logicNode => `
                                <div class="node-item logic" data-nodetype="logic" data-subtype="${logicNode.id}" draggable="true">
                                    ${logicNode.name}
                                </div>
                            `).join('')}
                        </div>
                        <h3>State Nodes</h3>
                        <div class="node-list" id="state-list">
                            ${this.stateNodeTypes.map(stateNode => `
                                <div class="node-item state" data-nodetype="state" data-subtype="${stateNode.id}" draggable="true">
                                    ${stateNode.name}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="flow-editor">
                    <div class="flow-editor-header">
						<input type="text" id="flow-name" placeholder="Flow Name">
						<div class="flow-controls">
							<button id="save-flow-btn" class="btn btn-primary">Save Flow</button>
							<button id="duplicate-flow-btn" class="btn">Duplicate</button>
							<label class="flow-active-toggle">
								<input type="checkbox" id="flow-active">
								<span class="slider round"></span>
								Active
							</label>
						</div>
					</div>
                    <div class="flow-help-banner" id="flow-help-banner">
                        <div class="flow-help-banner-text">
                            <strong>New to Event Flow?</strong> Start by reviewing the quick guide or create your first automation.
                        </div>
                        <div class="flow-help-banner-actions">
                            <button class="btn btn-primary" data-guide-link="event-flow">Open Guide</button>
                            <button class="btn btn-ghost" id="flow-help-create-btn">Create Flow</button>
                        </div>
                        <button class="flow-help-dismiss" id="flow-help-dismiss" aria-label="Dismiss help banner">×</button>
                    </div>
                    <div class="flow-canvas-container">
                        <div class="flow-canvas" id="flow-canvas"></div>
                    </div>
                </div>
                <div class="node-properties" id="node-properties">
                    <h3>Node Properties</h3>
                    <div class="node-properties-content" id="node-properties-content">
                        <p>Select a node to view properties</p>
                    </div>
                </div>
            </div>
        `;
		const saveButton = document.getElementById('save-flow-btn');
		if (saveButton) {
			saveButton.classList.add('disabled'); // Start with disabled state
		}
        this.renderNodePropertiesPlaceholder();
    }

    initEventListeners() {
        document.getElementById('new-flow-btn').addEventListener('click', () => this.createNewFlow());
        document.getElementById('save-flow-btn').addEventListener('click', () => this.saveCurrentFlow());
        document.getElementById('duplicate-flow-btn').addEventListener('click', () => this.duplicateCurrentFlow());
        document.getElementById('import-flow-btn').addEventListener('click', () => this.importFlows());
        document.getElementById('export-all-btn').addEventListener('click', () => this.exportAllFlows());
        document.getElementById('template-select').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadTemplate(e.target.value);
                e.target.value = ''; // Reset dropdown
            }
        });
        this.container.addEventListener('click', (e) => {
            const guideButton = e.target.closest('[data-guide-link]');
            if (guideButton) {
                e.preventDefault();
                this.openGuide(guideButton.dataset.guideLink);
                return;
            }
        });
        const helpBannerDismiss = document.getElementById('flow-help-dismiss');
        if (helpBannerDismiss) {
            helpBannerDismiss.addEventListener('click', () => this.dismissFlowHelpBanner());
        }
        const helpCreateBtn = document.getElementById('flow-help-create-btn');
        if (helpCreateBtn) {
            helpCreateBtn.addEventListener('click', () => this.createNewFlow());
        }

        document.getElementById('flow-active').addEventListener('change', (e) => {
            if (this.currentFlow) {
                this.currentFlow.active = e.target.checked;
                this.markUnsavedChanges(true);
            }
        });
		document.getElementById('flow-name').addEventListener('input', (e) => {
			if (this.currentFlow) {
				// Store the raw input value as the flow name (no asterisks)
				this.currentFlow.name = e.target.value;
				
				// Only mark as unsaved if the name has actually changed
				if (this.currentFlow.id && this.currentFlow.name !== this.originalFlowName) {
					this.markUnsavedChanges(true);
				}
			}
		});

        const triggerItems = document.querySelectorAll('#trigger-list .node-item');
        triggerItems.forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleNodeDragStart(e, 'trigger', item.dataset.subtype)); // Changed to subtype
        });
        const actionItems = document.querySelectorAll('#action-list .node-item');
        actionItems.forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleNodeDragStart(e, 'action', item.dataset.subtype)); // Changed to subtype
        });

        // Add click handlers for collapsible action groups
        const actionGroupHeaders = document.querySelectorAll('.action-group-header');
        actionGroupHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const groupId = header.dataset.group;
                const group = this.actionGroups.find(g => g.id === groupId);
                if (group) {
                    group.expanded = !group.expanded;
                    const toggle = header.querySelector('.action-group-toggle');
                    const items = header.nextElementSibling;
                    if (group.expanded) {
                        header.classList.remove('collapsed');
                        header.classList.add('expanded');
                        toggle.textContent = '▼';
                        items.style.display = '';
                    } else {
                        header.classList.remove('expanded');
                        header.classList.add('collapsed');
                        toggle.textContent = '▶';
                        items.style.display = 'none';
                    }
                }
            });
        });

		const logicItems = document.querySelectorAll('#logic-list .node-item');
        logicItems.forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleNodeDragStart(e, 'logic', item.dataset.subtype));
        });
        const stateItems = document.querySelectorAll('#state-list .node-item');
        stateItems.forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleNodeDragStart(e, 'state', item.dataset.subtype));
        });
		
        const canvas = document.getElementById('flow-canvas');
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        canvas.addEventListener('drop', (e) => this.handleCanvasDrop(e));
        canvas.addEventListener('click', (e) => {
            if (e.target === canvas) {
                this.selectNode(null);
            }
        });

        ['input', 'change'].forEach(eventType => {
            this.container.addEventListener(eventType, (e) => {
                if (e.target.closest('.node-properties') || e.target.closest('.flow-canvas')) {
                    // More specific checks might be needed if this is too broad
                    // For now, assume direct interaction implies a change
                    if (this.currentFlow && this.currentFlow.id) { // Only mark if a flow is loaded
                        this.markUnsavedChanges(true);
                    }
                }
            });
        });
    }
    
    renderNodePropertiesPlaceholder() {
        const propsContainer = document.getElementById('node-properties-content');
        if (!propsContainer) return;
        propsContainer.innerHTML = `
            <p>Select a node to view its properties.</p>
            <div class="node-help-links">
                <p class="node-help-question">Need some help?</p>
                <div class="node-help-buttons">
                    <button class="btn btn-ghost" data-guide-link="event-flow">📘 Event Flow Guide</button>
                    <button class="btn btn-ghost" data-guide-link="state-nodes">🎮 State Nodes Guide</button>
                </div>
            </div>
        `;
    }

    openGuide(guideKey) {
        const guideMap = {
            'event-flow': 'actions/event-flow-guide.html',
            'state-nodes': 'actions/state-nodes-guide.html',
            'event-flow-about': 'actions/event-flow-guide.html#what-is-event-flow'
        };
        let target = guideMap[guideKey];
        if (!target) return;
        if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
            target = chrome.runtime.getURL(target);
        }
        try {
			if (window.location.href.includes("/actions/")){
				window.open(target.replace("actions/",""), '_blank');
			} else {
				window.open(target, '_blank');
			}
        } catch (error) {
            console.error('Failed to open guide', error);
        }
    }

    toggleFlowHelpBanner(showBanner) {
        const banner = document.getElementById('flow-help-banner');
        if (!banner) return;
        if (showBanner && !this.noFlowHelpDismissed) {
            banner.classList.add('visible');
        } else {
            banner.classList.remove('visible');
        }
    }

    dismissFlowHelpBanner() {
        this.noFlowHelpDismissed = true;
        try {
            window.localStorage.setItem('ssn-eventflow-help-dismissed', '1');
        } catch (error) {
            console.debug('Unable to persist Event Flow help dismissal', error);
        }
        this.toggleFlowHelpBanner(false);
    }
    
	markUnsavedChanges(hasChanges) {
		this.unsavedChanges = hasChanges;
		const flowNameInput = document.getElementById('flow-name');
		const saveButton = document.getElementById('save-flow-btn');
		
		if (!flowNameInput || !saveButton || !this.currentFlow) return;
		
		// Update the visual indicator without modifying the input value
		if (hasChanges) {
			flowNameInput.classList.add('unsaved');
			saveButton.classList.remove('disabled');
		} else {
			flowNameInput.classList.remove('unsaved');
			saveButton.classList.add('disabled');
		}
	}

    async loadFlowList() {
        const flows = await this.eventFlowSystem.getAllFlows(); // Should be pre-sorted by order
        const flowListEl = document.getElementById('flow-list');
        flowListEl.innerHTML = ''; // Clear previous list

        flows.forEach(flow => {
            const item = document.createElement('div');
            item.className = `flow-item ${this.currentFlow && this.currentFlow.id === flow.id ? 'selected-flow' : ''}`;
            item.dataset.id = flow.id;
            item.dataset.order = flow.order; // Store order for reference if needed
            item.draggable = true;

            item.innerHTML = `
                <span class="drag-handle">⠿</span>
                <div class="flow-item-name">${this.escapeHtml(flow.name || 'Unnamed Flow')}</div>
                <div class="flow-item-controls">
                    <span class="flow-item-status ${flow.active ? 'active' : 'inactive'}" title="${flow.active ? 'Active' : 'Inactive'}">
                        ${flow.active ? '✓' : '◯'}
                    </span>
                    <span class="flow-item-export" data-id="${this.escapeHtml(flow.id)}" title="Export Flow" style="cursor: pointer; margin: 0 5px;">📤</span>
                    <span class="flow-item-delete" data-id="${this.escapeHtml(flow.id)}" title="Delete Flow">×</span>
                </div>
            `;
            flowListEl.appendChild(item);

            // Event listeners for each item
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('flow-item-delete') || (e.target.parentElement && e.target.parentElement.classList.contains('flow-item-delete'))) {
                    return; // Deletion handled by its own listener
                }
                if (e.target.classList.contains('flow-item-export')) {
                    e.stopPropagation();
                    this.exportFlow(flow.id);
                    return;
                }
                if (e.target.classList.contains('drag-handle')) return; // Don't load if interacting with drag handle
                this.loadFlow(item.dataset.id);
            });

            item.addEventListener('dragstart', this.handleFlowDragStart.bind(this));
            item.addEventListener('dragover', this.handleFlowDragOver.bind(this));
            item.addEventListener('dragleave', this.handleFlowDragLeave.bind(this));
            item.addEventListener('drop', this.handleFlowDrop.bind(this));
            item.addEventListener('dragend', this.handleFlowDragEnd.bind(this));
        });

        if (flows.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'flow-list-empty';
            emptyState.innerHTML = `
                <div class="flow-list-empty-title">No flows yet</div>
                <div class="flow-list-empty-copy">Create your first automation or open the Event Flow Guide for inspiration.</div>
            `;
            flowListEl.appendChild(emptyState);
        }
        this.toggleFlowHelpBanner(flows.length === 0);

        flowListEl.querySelectorAll('.flow-item-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteFlow(button.dataset.id); // Calls system's deleteFlow
            });
        });
    }
	
	handleFlowDragStart(e) {
        const targetItem = e.target.closest('.flow-item');
        if (!targetItem) return;
        this.draggedFlowItem = targetItem;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', targetItem.dataset.id);
        targetItem.classList.add('dragging');
    }
	
	handleFlowDragOver(e) {
        e.preventDefault();
        const targetItem = e.target.closest('.flow-item');
        if (!targetItem || targetItem === this.draggedFlowItem) return;
        
        targetItem.classList.remove('drag-over-top', 'drag-over-bottom'); // Clear previous
        const rect = targetItem.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        if (offsetY < rect.height / 2) {
            targetItem.classList.add('drag-over-top');
        } else {
            targetItem.classList.add('drag-over-bottom');
        }
    }
	
	handleFlowDragLeave(e) {
        const targetItem = e.target.closest('.flow-item');
        if (targetItem) {
            targetItem.classList.remove('drag-over-top', 'drag-over-bottom');
        }
    }

    async handleFlowDrop(e) {
        e.preventDefault();
        if (!this.draggedFlowItem) return;

        const targetItem = e.target.closest('.flow-item');
        if (targetItem) {
            targetItem.classList.remove('drag-over-top', 'drag-over-bottom');
        }
        
        if (!targetItem || targetItem === this.draggedFlowItem) {
            this.draggedFlowItem.classList.remove('dragging');
            this.draggedFlowItem = null;
            return;
        }

        const flowListEl = document.getElementById('flow-list');
        const rect = targetItem.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;

        if (offsetY < rect.height / 2) {
            flowListEl.insertBefore(this.draggedFlowItem, targetItem);
        } else {
            flowListEl.insertBefore(this.draggedFlowItem, targetItem.nextSibling);
        }
        
        this.draggedFlowItem.classList.remove('dragging');

        // Get the new order of flow IDs from the DOM
        const orderedFlowElements = Array.from(flowListEl.querySelectorAll('.flow-item'));
        const orderedFlowIds = orderedFlowElements.map(item => item.dataset.id);

        try {
            const result = await this.eventFlowSystem.updateFlowsOrder(orderedFlowIds);
            if (result.success) {
                console.log('Flows reordered and saved successfully.');
            } else {
                console.error("Failed to save new flow order:", result.message, result.error || '');
                // Optionally, show an alert to the user.
            }
        } catch (error) {
            console.error('Error during flow order update process:', error);
        } finally {
            this.draggedFlowItem = null;
            await this.loadFlowList(); // Refresh list from the source of truth (system)
                                       // to ensure UI consistency with DB state.
        }
    }

    handleFlowDragEnd(e) {
        if (this.draggedFlowItem) {
            this.draggedFlowItem.classList.remove('dragging');
        }
        document.querySelectorAll('.flow-item.drag-over-top, .flow-item.drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        this.draggedFlowItem = null;
    }

    async loadFlow(flowId) {
        if (this.unsavedChanges) {
            if (!confirm("You have unsaved changes. Are you sure you want to load another flow? Your current changes will be lost.")) {
                return;
            }
        }
        const flow = await this.eventFlowSystem.getFlowById(flowId);
        if (!flow) return;

        this.currentFlow = JSON.parse(JSON.stringify(flow)); // Deep copy
        document.getElementById('flow-name').value = this.currentFlow.name || '';
        document.getElementById('flow-active').checked = this.currentFlow.active;

        document.querySelectorAll('.flow-item').forEach(item => {
            item.classList.toggle('selected-flow', item.dataset.id === flowId);
        });
        this.originalFlowName = this.currentFlow.name || '';
        this.markUnsavedChanges(false);
        this.renderFlow();
        this.selectNode(null);
    }

    createNewFlow() {
        if (this.unsavedChanges) {
            if (!confirm("Create a new flow? Any unsaved changes to the current flow will be lost.")) {
                return;
            }
        }
        
        // Determine the next order number
        // getAllFlows() from the system should give the current, sorted list
        const currentFlows = this.eventFlowSystem.flows; // Access the internal, sorted array
        let maxOrder = -1;
        if (currentFlows && currentFlows.length > 0) {
             currentFlows.forEach(f => {
                if (typeof f.order === 'number' && f.order > maxOrder) {
                    maxOrder = f.order;
                }
            });
        }
        const newOrder = (currentFlows.length > 0 && maxOrder > -1) ? maxOrder + 1 : 0;

        this.currentFlow = {
            id: null, 
            name: 'New Flow', 
            description: '', 
            active: true, 
            nodes: [], 
            connections: [],
            order: newOrder // Assign new order
        };
        this.markUnsavedChanges(false); 
		this.originalFlowName = 'New Flow';
		this.markUnsavedChanges(false); 

        document.getElementById('flow-name').value = this.currentFlow.name;
        document.getElementById('flow-active').checked = this.currentFlow.active;
        document.querySelectorAll('.flow-item.selected-flow').forEach(item => item.classList.remove('selected-flow'));
        
        this.renderFlow();
        this.selectNode(null);
        this.toggleFlowHelpBanner(false);
    }

    async generateFlowName() {
        if (!this.currentFlow || !this.currentFlow.nodes) {
            return `Untitled Flow - ${new Date().toLocaleTimeString()}`;
        }

        const firstTrigger = this.currentFlow.nodes.find(node => node.type === 'trigger');
        let firstActionOrLogic = this.currentFlow.nodes.find(node => node.type === 'action' || node.type === 'logic');

        let baseName = "";
        if (firstTrigger) {
            baseName += `${this.getNodeTitle(firstTrigger).replace('Message ', '')}`; // Shorten
            if (firstActionOrLogic) {
                 // Try to find an action/logic connected to this trigger
                const findConnectedNode = (startNodeId) => {
                    const connection = this.currentFlow.connections.find(c => c.from === startNodeId);
                    if (connection) {
                        return this.currentFlow.nodes.find(n => n.id === connection.to && (n.type === 'action' || n.type === 'logic'));
                    }
                    return null;
                };
                const connectedActionLogic = findConnectedNode(firstTrigger.id);
                if (connectedActionLogic) {
                    firstActionOrLogic = connectedActionLogic;
                }
                baseName += ` to ${this.getNodeTitle(firstActionOrLogic)}`;
            }
        } else if (firstActionOrLogic) { // No trigger, but has action/logic
            baseName += `${this.getNodeTitle(firstActionOrLogic)}`;
        } else { // Empty flow
            baseName = `Untitled Flow`;
        }
        
        // Ensure name is not overly long
        if (baseName.length > 50) {
            baseName = baseName.substring(0, 47) + "...";
        }

        // Ensure uniqueness
        const allFlows = await this.eventFlowSystem.getAllFlows();
        let finalName = baseName;
        let counter = 1;
        // Check against current name too if it's an edit of an existing flow but name was cleared
        while (allFlows.some(flow => flow.name === finalName && (!this.currentFlow.id || flow.id !== this.currentFlow.id))) {
            finalName = `${baseName} ${counter}`;
            counter++;
        }
        return finalName;
    }

    // Helper method to safely notify parent window about flow changes
    async populateMIDIInputDevices(selectId, currentValue) {
        // Initialize MIDI if needed
        if (!this.eventFlowSystem.midiEnabled) {
            await this.eventFlowSystem.initializeMIDI();
        }
        
        setTimeout(() => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            // Clear existing options except the first
            while (select.options.length > 1) {
                select.remove(1);
            }
            
            // Add MIDI input devices
            const inputs = this.eventFlowSystem.midiInputs || [];
            inputs.forEach(input => {
                const option = document.createElement('option');
                option.value = input.id;
                option.textContent = input.name || `MIDI Input ${input.id}`;
                if (input.id === currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            if (inputs.length === 0) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "No MIDI input devices found";
                option.disabled = true;
                select.appendChild(option);
            }
        }, 100);
    }
    
    async populateMIDIOutputDevices(selectId, currentValue) {
        // Initialize MIDI if needed
        if (!this.eventFlowSystem.midiEnabled) {
            await this.eventFlowSystem.initializeMIDI();
        }
        
        setTimeout(() => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            // Clear existing options except the first
            while (select.options.length > 1) {
                select.remove(1);
            }
            
            // Add MIDI output devices
            const outputs = this.eventFlowSystem.midiOutputs || [];
            outputs.forEach(output => {
                const option = document.createElement('option');
                option.value = output.id;
                option.textContent = output.name || `MIDI Output ${output.id}`;
                if (output.id === currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            if (outputs.length === 0) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "No MIDI output devices found";
                option.disabled = true;
                select.appendChild(option);
            }
        }, 100);
    }
    
    notifyParentToReloadFlows() {
        try {
            if (this.isSSApp) {
                // In SSApp context, use postMessage for cross-origin communication
                console.log('[EventFlowEditor] Using postMessage to notify parent (SSApp mode)');
                window.parent.postMessage({
                    type: 'eventFlowRequest',
                    action: 'reloadFlows',
                    data: null
                }, '*');
            } else {
                // In regular context, try direct access
                if (window.parent && window.parent.eventFlowSystem && window.parent.eventFlowSystem !== this.eventFlowSystem) {
                    console.log('[EventFlowEditor] Notifying parent window to reload flows');
                    window.parent.eventFlowSystem.reloadFlows();
                }
            }
        } catch (error) {
            console.warn('[EventFlowEditor] Could not notify parent window:', error);
            // This is expected in cross-origin situations, not a critical error
        }
    }

    async saveCurrentFlow() {
        if (!this.currentFlow) {
            alert('No flow is currently active to save.'); return;
        }

        // Auto-generate name if current name is empty, whitespace, or the default "New Flow"
        let currentNameTrimmed = this.currentFlow.name ? this.currentFlow.name.trim() : '';
        if (currentNameTrimmed === '' || currentNameTrimmed === 'New Flow' || currentNameTrimmed === 'New Flow*') {
            this.currentFlow.name = await this.generateFlowName();
            document.getElementById('flow-name').value = this.currentFlow.name; // Update UI immediately
            // No asterisk needed yet as it's a "new" name until saved
        } else if (document.getElementById('flow-name').value.trim() === '') { // User manually cleared the name
            this.currentFlow.name = await this.generateFlowName();
            document.getElementById('flow-name').value = this.currentFlow.name;
        }


        let flowToSave = JSON.parse(JSON.stringify(this.currentFlow)); // Deep copy


        try {
            const savedFlow = await this.eventFlowSystem.saveFlow(flowToSave);
            this.currentFlow.id = savedFlow.id; // Update current flow with ID from DB
            this.currentFlow.name = savedFlow.name; // Reflect cleaned name from DB (e.g. if system modified it)
            
            document.getElementById('flow-name').value = this.currentFlow.name; // Update input field without asterisk AFTER save
            this.markUnsavedChanges(false); // Reset flag AFTER successful save

           // alert('Flow saved successfully!');
            await this.loadFlowList(); // Refresh list
            
            // Notify background instance to reload flows
            this.notifyParentToReloadFlows();
            
            // Re-select the current flow in the list
            document.querySelectorAll('.flow-item').forEach(item => {
                item.classList.toggle('selected-flow', item.dataset.id === this.currentFlow.id);
            });
        } catch (error) {
            console.error('Error saving flow:', error);
            alert('Failed to save flow. Check console for details.');
        }
    }

    async duplicateCurrentFlow() {
        if (!this.currentFlow || !this.currentFlow.id) {
            alert('Please save the current flow first or select a flow to duplicate.'); return;
        }
        if (this.unsavedChanges) {
            if (!confirm("You have unsaved changes. Duplicate the saved version of the flow? Current unsaved changes will be lost from the new duplicated flow's perspective.")) {
                return;
            }
        }
        try {
            const duplicatedFlow = await this.eventFlowSystem.duplicateFlow(this.currentFlow.id);
            if (duplicatedFlow) {
                await this.loadFlowList();
                this.loadFlow(duplicatedFlow.id); // This will reset unsavedChanges flag
               // alert('Flow duplicated successfully!');
            } else {
                alert('Error duplicating flow.');
            }
        } catch (error) {
            console.error('Error duplicating flow:', error);
            alert('Failed to duplicate flow. Check console for details.');
        }
    }

    async deleteFlow(flowId) {
        if (!confirm('Are you sure you want to delete this flow? This action cannot be undone.')) return;
        try {
            await this.eventFlowSystem.deleteFlow(flowId);
            if (this.currentFlow && flowId === this.currentFlow.id) {
                this.createNewFlow(); // Will ask for confirmation if current flow has unsaved changes
            }
            this.loadFlowList();
           // alert('Flow deleted successfully.');
           
            // Notify background instance to reload flows
            this.notifyParentToReloadFlows();
        } catch (error) {
            console.error('Error deleting flow:', error);
            alert('Failed to delete flow. Check console for details.');
        }
    }

    async exportFlow(flowId) {
        try {
            const flow = await this.eventFlowSystem.getFlowById(flowId);
            if (!flow) {
                alert('Flow not found');
                return;
            }

            // Add metadata
            const exportData = {
                ...flow,
                exportDate: new Date().toISOString(),
                version: '1.0.0',
                exportedBy: 'Social Stream Event Flow System'
            };

            // Create downloadable JSON
            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = `flow_${flow.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Show success notification
            this.showNotification(`Flow "${flow.name}" exported successfully!`, 'success');
        } catch (error) {
            console.error('Error exporting flow:', error);
            alert('Failed to export flow. Check console for details.');
        }
    }

    async exportAllFlows() {
        try {
            const flows = await this.eventFlowSystem.getAllFlows();
            if (!flows || flows.length === 0) {
                alert('No flows to export');
                return;
            }

            // Add metadata
            const exportData = {
                flows: flows,
                exportDate: new Date().toISOString(),
                version: '1.0.0',
                exportedBy: 'Social Stream Event Flow System',
                totalFlows: flows.length
            };

            // Create downloadable JSON
            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = `all_flows_backup_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Show success notification
            this.showNotification(`Exported ${flows.length} flow(s) successfully!`, 'success');
        } catch (error) {
            console.error('Error exporting flows:', error);
            alert('Failed to export flows. Check console for details.');
        }
    }

    async importFlows() {
        try {
            // Create file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.multiple = true;

            input.onchange = async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                let totalImported = 0;
                let totalFailed = 0;

                for (const file of files) {
                    try {
                        const text = await file.text();
                        const data = JSON.parse(text);

                        // Check if it's a single flow or multiple flows
                        if (data.flows && Array.isArray(data.flows)) {
                            // Multiple flows export
                            for (const flow of data.flows) {
                                const success = await this.importSingleFlow(flow);
                                if (success) totalImported++;
                                else totalFailed++;
                            }
                        } else {
                            // Single flow export
                            const success = await this.importSingleFlow(data);
                            if (success) totalImported++;
                            else totalFailed++;
                        }
                    } catch (error) {
                        console.error('Error importing file:', file.name, error);
                        totalFailed++;
                    }
                }

                // Refresh flow list
                await this.loadFlowList();
                
                // Notify background to reload
                this.notifyParentToReloadFlows();

                // Show results
                let message = `Import complete! `;
                if (totalImported > 0) message += `${totalImported} flow(s) imported. `;
                if (totalFailed > 0) message += `${totalFailed} flow(s) failed.`;
                
                this.showNotification(message, totalFailed > 0 ? 'warning' : 'success');
            };

            input.click();
        } catch (error) {
            console.error('Error in import process:', error);
            alert('Failed to import flows. Check console for details.');
        }
    }

    async importSingleFlow(flowData) {
        try {
            // Remove metadata fields
            const cleanFlow = { ...flowData };
            delete cleanFlow.exportDate;
            delete cleanFlow.version;
            delete cleanFlow.exportedBy;
            delete cleanFlow.totalFlows;
            
            // Clear ID to force new one
            delete cleanFlow.id;
            
            // Check for duplicate names
            const flows = await this.eventFlowSystem.getAllFlows();
            const existingNames = flows.map(f => f.name);
            
            if (existingNames.includes(cleanFlow.name)) {
                // Add suffix to make unique
                let suffix = 1;
                const baseName = cleanFlow.name;
                while (existingNames.includes(`${baseName} (${suffix})`)) {
                    suffix++;
                }
                cleanFlow.name = `${baseName} (${suffix})`;
            }

            // Import the flow
            const savedFlow = await this.eventFlowSystem.saveFlow(cleanFlow);
            return savedFlow !== null;
        } catch (error) {
            console.error('Error importing single flow:', error);
            return false;
        }
    }

    async loadTemplate(templateId) {
        const template = FLOW_TEMPLATES[templateId];
        if (!template) return;

        try {
            // Deep copy the template to avoid modifying the original
            const flowData = JSON.parse(JSON.stringify(template));

            // Generate unique node IDs for this instance
            const idMap = {};
            flowData.nodes = flowData.nodes.map(node => {
                const newId = `node_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                idMap[node.id] = newId;
                return { ...node, id: newId };
            });

            // Update connection references with new IDs
            flowData.connections = flowData.connections.map(conn => ({
                from: idMap[conn.from] || conn.from,
                to: idMap[conn.to] || conn.to
            }));

            // Import using existing method
            const success = await this.importSingleFlow(flowData);
            if (success) {
                await this.loadFlows();
                this.showNotification(`Template "${template.name}" loaded!`, 'success');
            } else {
                this.showNotification('Failed to load template', 'warning');
            }
        } catch (error) {
            console.error('Error loading template:', error);
            this.showNotification('Error loading template', 'warning');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `flow-notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#FF9800' : '#2196F3'};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    renderFlow() {
        const canvas = document.getElementById('flow-canvas');
        canvas.innerHTML = '';
        if (!this.currentFlow || !this.currentFlow.nodes) return;
        this.currentFlow.nodes.forEach(node => this.renderNode(node));
        this.currentFlow.connections.forEach(connection => this.renderConnection(connection));
    }

	renderNode(node) {
		const canvas = document.getElementById('flow-canvas');
		
		// It's good practice to remove the old element if re-rendering a specific node
		// However, if renderNode is always called as part of a full renderFlow that clears the canvas, this might not be strictly necessary.
		// For robustness if you later call renderNode to update a single node:
		const existingNodeEl = canvas.querySelector(`.node[data-id="${node.id}"]`);
		if (existingNodeEl) {
			existingNodeEl.remove();
		}

		const nodeEl = document.createElement('div');
		// Add 'logic' class for general styling of logic nodes if node.type is 'logic'
		nodeEl.className = `node ${node.type}`; 
		if (this.selectedNode === node.id) {
			nodeEl.classList.add('selected');
		}
		nodeEl.dataset.id = node.id;
		nodeEl.style.left = `${node.x}px`;
		nodeEl.style.top = `${node.y}px`;

		let inputPointsHTML = '';
		let outputPointsHTML = '';

		if (node.type === 'trigger') {
			// Triggers that don't have a message get async output
			const noMessageTriggers = ['timeInterval', 'timeOfDay', 'midiNoteOn', 'midiNoteOff', 'midiCC'];
			if (noMessageTriggers.includes(node.triggerType)) {
				outputPointsHTML = '<div class="connection-point output async-output" data-point-type="output"></div>';
			} else {
				outputPointsHTML = '<div class="connection-point output" data-point-type="output"></div>';
			}
		} else if (node.type === 'action') {
			inputPointsHTML = '<div class="connection-point input" data-point-type="input"></div>';
			// Actions that continue asynchronously - downstream runs in background
			const asyncActions = [
				'returnMessage', 'blockMessage', 'continueAsync'
			];
			if (asyncActions.includes(node.actionType)) {
				outputPointsHTML = '<div class="connection-point output async-output" data-point-type="output"></div>';
			} else {
				outputPointsHTML = '<div class="connection-point output" data-point-type="output"></div>'; // Actions can lead to other nodes
			}
		} else if (node.type === 'logic') {
			let pointClasses = "connection-point input"; // Base classes for the input point
			
			// Check for AND/OR gates and count incoming connections
			if (node.logicType === 'AND' || node.logicType === 'OR') {
				let incomingConnectionsCount = 0;
				if (this.currentFlow && this.currentFlow.connections) {
					incomingConnectionsCount = this.currentFlow.connections.filter(conn => conn.to === node.id).length;
				}

				if (incomingConnectionsCount > 1) {
					pointClasses += " logic-input-multiple"; // Add class for multiple connections
				} else {
					pointClasses += " logic-input-single"; // Class for single or zero connections
				}
			} else if (node.logicType === 'NOT') {
				pointClasses += " logic-input-single"; // NOT gates expect a single input
			}
			
			inputPointsHTML = `<div class="${pointClasses}" data-point-type="input" data-logic-type="${node.logicType}"></div>`;
			outputPointsHTML = '<div class="connection-point output" data-point-type="output"></div>';
		} else if (node.type === 'state') {
			// State nodes have input and output points
			inputPointsHTML = '<div class="connection-point input" data-point-type="input"></div>';
			
			// Determine if this state node blocks or delays messages
			// Queue and Sequencer delay messages (async), others pass through synchronously
			const asyncStateNodes = ['QUEUE', 'SEQUENCER'];
			if (asyncStateNodes.includes(node.stateType)) {
				outputPointsHTML = '<div class="connection-point output async-output" data-point-type="output"></div>';
			} else {
				// Gate, Semaphore, Latch, Throttle can pass messages through synchronously
				outputPointsHTML = '<div class="connection-point output" data-point-type="output"></div>';
			}
		}

		nodeEl.innerHTML = `
			<div class="node-header">
				<div class="node-title">${this.escapeHtml(this.getNodeTitle(node))}</div>
				<div class="node-delete" title="Delete Node">×</div>
			</div>
			<div class="node-body">${this.escapeHtml(this.getNodeDescription(node))}</div>
			${inputPointsHTML}
			${outputPointsHTML}
		`;
		canvas.appendChild(nodeEl);

		// Attach event listeners for the new node
		nodeEl.addEventListener('mousedown', (e) => {
			if (e.target.classList.contains('node-delete')) {
				this.deleteNode(node.id);
				return;
			}
			if (e.target.classList.contains('connection-point')) {
				 if (e.target.dataset.pointType === 'output') { // Only start dragging from output points
					this.startConnection(node.id, e.target.dataset.pointType, e);
					return;
				 }
				// Don't return for input points - allow drag to continue
			}
			this.selectNode(node.id);

			if (!e.target.classList.contains('connection-point') && !e.target.classList.contains('node-delete')) {
				this.draggedNode = node.id;
				const rect = nodeEl.getBoundingClientRect();
				this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
				document.addEventListener('mousemove', this.handleNodeDragMove);
				document.addEventListener('mouseup', this.handleNodeDragEnd);
			}
		});
	}

    getNodeTitle(node) {
        let typesArray;
        let subtypeField;

        if (node.type === 'trigger') {
            typesArray = this.triggerTypes;
            subtypeField = 'triggerType';
        } else if (node.type === 'action') {
            typesArray = this.actionTypes;
            subtypeField = 'actionType';
        } else if (node.type === 'logic') { // NEW
            typesArray = this.logicNodeTypes;
            subtypeField = 'logicType';
        } else if (node.type === 'state') {
            typesArray = this.stateNodeTypes;
            subtypeField = 'stateType';
        } else {
            return 'Unknown Type';
        }
        const typeDef = typesArray.find(t => t.id === node[subtypeField]);
        return typeDef ? typeDef.name : 'Unknown Node';
    }

    // Check if a connection comes after a terminal action (message won't be returned)
    isPostTerminalConnection(connection) {
        if (!this.currentFlow || !this.currentFlow.nodes) return false;
        
        // Terminal actions are those that consume/block the message
        const terminalActions = ['blockMessage']; // Add more terminal actions here as needed
        
        // Check if the source node is a terminal action
        const sourceNode = this.currentFlow.nodes.find(n => n.id === connection.from);
        if (sourceNode && sourceNode.type === 'action' && terminalActions.includes(sourceNode.actionType)) {
            return true;
        }
        
        // Recursively check if any upstream node is a terminal action
        const visited = new Set();
        const checkUpstream = (nodeId) => {
            if (visited.has(nodeId)) return false;
            visited.add(nodeId);
            
            const node = this.currentFlow.nodes.find(n => n.id === nodeId);
            if (node && node.type === 'action' && terminalActions.includes(node.actionType)) {
                return true;
            }
            
            // Check all connections leading to this node
            const upstreamConnections = this.currentFlow.connections.filter(c => c.to === nodeId);
            for (const conn of upstreamConnections) {
                if (checkUpstream(conn.from)) {
                    return true;
                }
            }
            
            return false;
        };
        
        return checkUpstream(connection.from);
    }
    
    getNodeDescription(node) {
        if (!node.config) node.config = {}; // Ensure config exists
        if (node.type === 'trigger') {
            switch (node.triggerType) {
                case 'messageContains': return `Text: "${(node.config.text || '').substring(0,15)}${(node.config.text || '').length > 15 ? '...' : ''}"`;
                case 'messageStartsWith': return `Text: "${(node.config.text || '').substring(0,15)}${(node.config.text || '').length > 15 ? '...' : ''}"`;
                case 'messageEndsWith': return `Text: "${(node.config.text || '').substring(0,15)}${(node.config.text || '').length > 15 ? '...' : ''}"`;
                case 'messageEquals': return `Text: "${(node.config.text || '').substring(0,15)}${(node.config.text || '').length > 15 ? '...' : ''}"`;
                case 'messageRegex': return `Pattern: "${(node.config.pattern || '').substring(0,15)}${(node.config.pattern || '').length > 15 ? '...' : ''}"`;
                case 'messageLength': return `Length ${node.config.comparison || 'gt'} ${node.config.length || 100}`;
                case 'wordCount': return `Words ${node.config.comparison || 'gt'} ${node.config.count || 5}`;
                case 'containsEmoji': return 'Has emoji';
                case 'containsLink': return 'Contains URL';
                case 'fromSource': return `Source: ${node.config.source === '*' ? 'Any' : (node.config.source || 'Any')}`;
                case 'fromChannelName': return `Channel: ${node.config.channelName || 'Any'}`;
                case 'fromUser': return `User: ${node.config.username || 'Any'}`;
                case 'userRole': return `Role: ${node.config.role || 'Any'}`;
                case 'hasDonation': return 'Has donation';
                case 'channelPointRedemption': {
                    const rewardName = node.config.rewardName || '';
                    if (rewardName) return `Redeem: "${rewardName}"`;
                    return 'Any redemption';
                }
                case 'eventType': {
                    const eventType = node.config.eventType || '';
                    if (eventType) return `Event: ${eventType}`;
                    return 'Any event';
                }
                case 'compareProperty': {
                    const prop = node.config.property || 'donationAmount';
                    const op = node.config.operator || 'gt';
                    const val = node.config.value ?? 0;
                    const opSymbols = { gt: '>', lt: '<', eq: '=', gte: '>=', lte: '<=', ne: '!=' };
                    return `${prop} ${opSymbols[op] || op} ${val}`;
                }
                case 'randomChance': {
                    const prob = Math.round((node.config.probability || 0.1) * 100);
                    const cooldown = node.config.cooldownMs ? ` (${node.config.cooldownMs/1000}s cooldown)` : '';
                    const rateLimit = node.config.maxPerMinute ? ` max ${node.config.maxPerMinute}/min` : '';
                    return `${prob}% chance${cooldown}${rateLimit}`;
                }
                case 'messageProperties': {
                    const req = node.config.requiredProperties?.length || 0;
                    const forb = node.config.forbiddenProperties?.length || 0;
                    const mode = node.config.requireAll ? 'ALL' : 'ANY';
                    const parts = [];
                    if (req && forb) parts.push(`${mode}: ${req} required, ${forb} forbidden`);
                    else if (req) parts.push(`${mode}: ${req} required`);
                    else if (forb) parts.push(`${forb} forbidden`);
                    else parts.push('No property filters');

                    if (node.config.lastActivityFilter?.enabled) {
                        const lastCfg = node.config.lastActivityFilter;
                        const amount = lastCfg.amount ?? 0;
                        const unit = lastCfg.unit || 'minutes';
                        const modeLabel = lastCfg.mode === 'older' ? 'older than' : 'within';
                        parts.push(`Last activity ${modeLabel} ${amount} ${unit}`);
                    }

                    return parts.join('; ');
                }
                default: return `${this.getNodeTitle(node)}`;
            }
        } else if (node.type === 'action') {
             switch (node.actionType) {
                case 'blockMessage': return 'Block message (async continue)';
                case 'returnMessage': return 'Return message (async continue)';
                case 'continueAsync': return 'Fork to background';
                case 'modifyMessage': return `New: "${(node.config.newMessage || '').substring(0,15)}${(node.config.newMessage || '').length > 15 ? '...' : ''}"`;
                case 'addPrefix': return `Prefix: "${(node.config.prefix || '').substring(0,15)}${(node.config.prefix || '').length > 15 ? '...' : ''}"`;
                case 'addSuffix': return `Suffix: "${(node.config.suffix || '').substring(0,15)}${(node.config.suffix || '').length > 15 ? '...' : ''}"`;
                case 'findReplace': return `Find: "${(node.config.find || '').substring(0,10)}..." → "${(node.config.replace || '').substring(0,10)}..."`;
                case 'removeText': 
                    switch(node.config.removeType) {
                        case 'removeFirst': return `Remove first ${node.config.count || 1} char(s)`;
                        case 'removeCommand': return 'Remove first word';
                        case 'removeUntil': return `Remove until "${(node.config.untilText || '').substring(0,10)}..."`;
                        case 'removePrefix': return `Remove prefix "${(node.config.prefix || '').substring(0,10)}..."`;
                        case 'trimWhitespace': return 'Trim whitespace';
                        default: return 'Remove text';
                    }
                case 'setProperty': {
                    const prop = node.config.property || 'nameColor';
                    const value = node.config.value || '';
                    const shortValue = value.length > 15 ? value.substring(0, 15) + '...' : value;
                    return `${prop} = ${shortValue}`;
                }
                case 'sendMessage': return `Send to: ${node.config.destination || 'All'}`;
                case 'relay': return `Relay to: ${node.config.destination || 'All'}`;
                case 'reflectionFilter': {
                    const policyMap = { 'block-all': 'Block All', 'allow-first': 'Allow First', 'allow-all': 'Allow All' };
                    const srcMode = node.config.sourceMode || 'none';
                    const srcList = (node.config.sourceTypes || '').toString();
                    const pol = policyMap[node.config.policy] || policyMap['block-all'];
                    if (srcMode === 'none') return `Reflections: ${pol}`;
                    return `Reflections: ${pol} (${srcMode}: ${srcList || '—'})`;
                }
                case 'addPoints': return `Add: ${node.config.amount || 100} points`;
                case 'spendPoints': return `Spend: ${node.config.amount || 100} points`;
                case 'delay': return `Delay: ${node.config.delayMs || 1000}ms`;
                case 'obsChangeScene': return `Scene: ${node.config.sceneName || 'Not set'}`;
                case 'obsToggleSource': return `${node.config.sourceName || 'Source'}: ${node.config.visible === false ? 'Hide' : node.config.visible === true ? 'Show' : 'Toggle'}`;
                case 'obsSetSourceFilter': return `Filter: ${node.config.filterName || 'Not set'}`;
                case 'obsMuteSource': return `${node.config.sourceName || 'Source'}: ${node.config.muted === true ? 'Mute' : node.config.muted === false ? 'Unmute' : 'Toggle'}`;
                case 'obsStartRecording': return 'Start Recording';
                case 'obsStopRecording': return 'Stop Recording';
                case 'obsStartStreaming': return 'Start Streaming';
                case 'obsStopStreaming': return 'Stop Streaming';
                case 'obsReplayBuffer': return 'Save Replay Buffer';
                // Spotify actions
                case 'spotifySkip': return 'Skip to next track';
                case 'spotifyPrevious': return 'Go to previous track';
                case 'spotifyPause': return 'Pause playback';
                case 'spotifyResume': return 'Resume playback';
                case 'spotifyVolume': return `Volume: ${node.config.volume || 50}%`;
                case 'spotifyQueue': {
                    const query = node.config.query || '';
                    const useMsg = node.config.useMessageText;
                    if (useMsg) return 'Queue: (from chat message)';
                    if (!query) return 'Queue: Not configured';
                    return `Queue: ${query.substring(0,20)}${query.length > 20 ? '...' : ''}`;
                }
                case 'spotifyToggle': return 'Toggle play/pause';
                case 'spotifyNowPlaying': {
                    const format = node.config.format || '';
                    if (!format) return 'Announce current track';
                    return `Announce: "${format.substring(0,25)}${format.length > 25 ? '...' : ''}"`;
                }
                case 'spotifyShuffle': {
                    const state = node.config.state;
                    if (state === true || state === 'true') return 'Shuffle: Enable';
                    if (state === false || state === 'false') return 'Shuffle: Disable';
                    return 'Shuffle: Toggle';
                }
                case 'spotifyRepeat': {
                    const mode = node.config.mode || 'off';
                    if (mode === 'track') return 'Repeat: Track';
                    if (mode === 'context') return 'Repeat: Playlist';
                    return 'Repeat: Off';
                }
                // Media & Layer actions
                case 'playTenorGiphy': {
                    const url = node.config.mediaUrl || '';
                    const duration = node.config.duration || 10000;
                    const shortUrl = url.length > 25 ? url.substring(0, 25) + '...' : url;
                    return `${shortUrl} (${duration}ms)`;
                }
                case 'showAvatar': {
                    const duration = node.config.duration || 5000;
                    const pos = `${node.config.x ?? 5}%,${node.config.y ?? 5}%`;
                    return `Avatar at ${pos} (${duration}ms)`;
                }
                case 'showText': {
                    const text = node.config.text || '';
                    const shortText = text.length > 20 ? text.substring(0, 20) + '...' : text;
                    return `"${shortText}"`;
                }
                case 'clearLayer': {
                    const layer = node.config.layer || 'all';
                    if (layer === 'all') return 'Clear all layers';
                    return `Clear ${layer} layer`;
                }
                // TTS actions
                case 'ttsSpeak': {
                    if (node.config.useMessageText) return 'Speak: (chat message)';
                    const text = node.config.text || '';
                    if (!text) return 'Speak: Not configured';
                    return `Speak: "${text.substring(0,20)}${text.length > 20 ? '...' : ''}"`;
                }
                case 'ttsToggle': {
                    const mode = node.config.enabled;
                    if (mode === true || mode === 'true') return 'TTS: Enable';
                    if (mode === false || mode === 'false') return 'TTS: Disable';
                    return 'TTS: Toggle';
                }
                case 'ttsSkip': return 'Skip current TTS';
                case 'ttsClear': return 'Clear TTS queue';
                case 'ttsVolume': return `TTS Volume: ${node.config.volume ?? 100}%`;
                default: return `${this.getNodeTitle(node)}`;
            }
        } else if (node.type === 'logic') { // NEW
            switch (node.logicType) {
                case 'AND': return 'All inputs must be true.';
                case 'OR': return 'Any input can be true.';
                case 'NOT': return 'Inverts the input signal.';
                case 'RANDOM': return `${node.config?.probability || 50}% chance`;
                case 'CHECK_BAD_WORDS': return 'Bad words? → TRUE/FALSE';
                default: return 'Logic Gate';
            }
        } else if (node.type === 'state') {
            switch (node.stateType) {
                case 'GATE': return `${node.config?.name || 'Switch'}: ${node.config?.defaultState === 'BLOCK' ? 'OFF' : 'ON'}`;
                case 'QUEUE': return `Max: ${node.config?.maxSize || 10}, ${node.config?.overflowStrategy || 'DROP_OLDEST'}`;
                case 'SEMAPHORE': return `Max concurrent: ${node.config?.maxConcurrent || 1}`;
                case 'LATCH': return node.config?.autoResetMs > 0 ? `Auto-reset: ${node.config.autoResetMs/1000}s` : 'Manual reset';
                case 'THROTTLE': return `${node.config?.name || 'Limiter'}: ${node.config?.messagesPerSecond || 1} msg/s`;
                case 'SEQUENCER': return `Delay: ${(node.config?.sequenceDelayMs || 1000)/1000}s`;
                case 'COUNTER': {
                    const name = node.config?.name || 'Counter';
                    const target = node.config?.targetCount || 5;
                    return `${name}: Triggers at ${target}`;
                }
                case 'USERPOOL': {
                    const name = node.config?.poolName || 'default';
                    const max = node.config?.maxUsers || 10;
                    return `${name}: ${max} users max`;
                }
                case 'ACCUMULATOR': {
                    const thresh = node.config?.threshold || 100;
                    const op = node.config?.operation || 'sum';
                    return `${op} until ${thresh}`;
                }
                default: return 'State Node';
            }
        }
        return '';
    }

    renderConnection(connection) {
        const canvas = document.getElementById('flow-canvas');
        if (!this.currentFlow || !this.currentFlow.nodes) return;
        const sourceNodeData = this.currentFlow.nodes.find(n => n.id === connection.from);
        const targetNodeData = this.currentFlow.nodes.find(n => n.id === connection.to);
        if (!sourceNodeData || !targetNodeData) return;

        const sourceNodeEl = document.querySelector(`.node[data-id="${connection.from}"]`);
        const targetNodeEl = document.querySelector(`.node[data-id="${connection.to}"]`);
        if (!sourceNodeEl || !targetNodeEl) return;

        const sourcePoint = sourceNodeEl.querySelector('.connection-point.output');
        const targetPoint = targetNodeEl.querySelector('.connection-point.input');
        if (!sourcePoint || !targetPoint) return;
        
        const canvasRect = canvas.getBoundingClientRect();
        const sourceRect = sourcePoint.getBoundingClientRect();
        const targetRect = targetPoint.getBoundingClientRect();

        const startX = (sourceRect.left + sourceRect.width / 2) - canvasRect.left + canvas.scrollLeft;
        const startY = (sourceRect.top + sourceRect.height / 2) - canvasRect.top + canvas.scrollTop;
        const endX = (targetRect.left + targetRect.width / 2) - canvasRect.left + canvas.scrollLeft;
        const endY = (targetRect.top + targetRect.height / 2) - canvasRect.top + canvas.scrollTop;
        
        // Check if this connection comes after a terminal action (message already consumed)
        const isPostTerminal = this.isPostTerminalConnection(connection);

        let svgEl = canvas.querySelector(`svg.connection[data-from="${connection.from}"][data-to="${connection.to}"]`);
        if (svgEl) svgEl.remove();

        svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('class', 'connection');
        svgEl.dataset.from = connection.from;
        svgEl.dataset.to = connection.to;
        svgEl.style.position = 'absolute';
        svgEl.style.left = '0'; svgEl.style.top = '0';
        svgEl.style.width = canvas.scrollWidth + 'px'; 
        svgEl.style.height = canvas.scrollHeight + 'px';
        svgEl.style.pointerEvents = 'none'; // Disable pointer events on the SVG container
        
        // Create a wider invisible path for easier clicking
        const clickPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const controlYOffset = Math.max(50, Math.abs(endY - startY) * 0.3);
        const pathData = `M ${startX},${startY} C ${startX},${startY + controlYOffset} ${endX},${endY - controlYOffset} ${endX},${endY}`;
        clickPath.setAttribute('d', pathData);
        clickPath.setAttribute('stroke', 'transparent');
        clickPath.setAttribute('stroke-width', '30'); // Wide invisible area for clicking
        clickPath.setAttribute('fill', 'none');
        clickPath.style.cursor = 'pointer';
        clickPath.style.pointerEvents = 'stroke'; // Only respond to clicks on the stroke
        
        // Visible path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        // Use purple (#9b59b6) for post-terminal connections, green for normal
        path.setAttribute('stroke', isPostTerminal ? '#9b59b6' : 'var(--primary-color)');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.style.pointerEvents = 'none';
        
        // If post-terminal, add a dashed pattern to make it more distinctive
        if (isPostTerminal) {
            path.setAttribute('stroke-dasharray', '10,5');
        }
        
        // Add hover effect to clickPath
        clickPath.addEventListener('mouseenter', () => {
            path.setAttribute('stroke', 'var(--alert-color)');
            path.setAttribute('stroke-width', '4');
        });
        
        clickPath.addEventListener('mouseleave', () => {
            // Restore the appropriate color based on post-terminal status
            path.setAttribute('stroke', isPostTerminal ? '#9b59b6' : 'var(--primary-color)');
            path.setAttribute('stroke-width', '3');
        });
        
        // Add click handler to clickPath (not the entire SVG)
        clickPath.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this connection?')) {
                this.deleteConnection(connection.from, connection.to);
            }
        });
        
        svgEl.appendChild(clickPath); // Add invisible click area first
        svgEl.appendChild(path); // Add visible path on top
        canvas.insertBefore(svgEl, canvas.firstChild);
    }

    handleNodeDragStart(e, nodeType, nodeSubtype) { // Added nodeType and nodeSubtype parameters
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: nodeType, // Use the passed nodeType
            subtype: nodeSubtype, // Use the passed nodeSubtype
            name: e.target.textContent.trim() 
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }

    handleCanvasDrop(e) { // For dropping new nodes from palette
        e.preventDefault();
        const dataString = e.dataTransfer.getData('text/plain'); // Reverted to text/plain
        if (!dataString) return;
        try {
            const nodeInfo = JSON.parse(dataString);
            const canvas = document.getElementById('flow-canvas');
            const canvasRect = canvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left + canvas.scrollLeft;
            const y = e.clientY - canvasRect.top + canvas.scrollTop;
            this.createNode(nodeInfo.type, nodeInfo.subtype, x, y);
            // No need to markUnsavedChanges here, createNode does it.
        } catch (err) {
            console.error('Error dropping node:', err);
        }
    }
	
	runTestFlow(testMessage) {
		if (!this.currentFlow) {
			alert('No flow is currently active. Please create or select a flow to test.');
			return { success: false, message: 'No active flow' };
		}

		// Create a temporary copy of the flow for testing
		const testFlow = JSON.parse(JSON.stringify(this.currentFlow));
		
		// Ensure it's active for testing
		testFlow.active = true;
		
		let testResult = { success: false, message: 'Test not run' };
		
		// Determine if we should test just this flow or all flows
		const testAllActiveFlows = document.getElementById('test-all-active-flows').checked;
		
		if (testAllActiveFlows) {
			// Test against all active flows in the system
			this.eventFlowSystem.processMessage(testMessage)
				.then(result => {
					testResult = {
						success: true,
						message: result ? 'Message was processed successfully' : 'Message was blocked',
						result: result
					};
					this.displayTestResults(testResult, testMessage);
				})
				.catch(error => {
					testResult = {
						success: false,
						message: 'Error testing flows: ' + error.message,
						error: error
					};
					this.displayTestResults(testResult, testMessage);
				});
		} else {
			// Test the flow directly - evaluateFlow takes the flow as a parameter
			// and doesn't need this.flows to be modified
			this.eventFlowSystem.evaluateFlow(testFlow, testMessage)
				.then(result => {
					testResult = {
						success: true,
						message: result.blocked ? 'Message was blocked by this flow' :
								 result.modified ? 'Message was modified by this flow' :
								 'Flow triggered but no actions affected the message',
						result: result
					};
					this.displayTestResults(testResult, testMessage);
				})
				.catch(error => {
					testResult = {
						success: false,
						message: 'Error testing flow: ' + error.message,
						error: error
					};
					this.displayTestResults(testResult, testMessage);
				});
		}
		
		return testResult;
	}
	
	initTestPanel() {
		const testOverlay = document.getElementById('test-overlay');
		const testPanel = document.getElementById('test-panel');
		const openTestBtn = document.getElementById('open-test-panel');
		const closeTestBtn = document.getElementById('close-test-btn');
		const runTestBtn = document.getElementById('run-test-btn');
		const donationCheckbox = document.getElementById('test-donation');
		const donationAmountField = document.getElementById('donation-amount');
		const firstTimeCheckbox = document.getElementById('test-firsttime');
		const lastActivityToggle = document.getElementById('test-lastactivity');
		const lastActivityControls = document.getElementById('lastactivity-controls');
		const lastActivityValue = document.getElementById('test-lastactivity-value');
		const lastActivityUnit = document.getElementById('test-lastactivity-unit');

		// Show/hide donation amount field based on checkbox
		donationCheckbox.addEventListener('change', function() {
			donationAmountField.style.display = this.checked ? 'block' : 'none';
		});

		// Toggle last-activity inputs
		if (lastActivityToggle) {
			lastActivityToggle.addEventListener('change', function() {
				if (lastActivityControls) {
					lastActivityControls.style.display = this.checked ? 'block' : 'none';
				}
			});
		}

		// Open test panel
		openTestBtn.addEventListener('click', function() {
			testOverlay.style.display = 'block';
			testPanel.style.display = 'flex';
		});

		// Close test panel
		closeTestBtn.addEventListener('click', function() {
			testOverlay.style.display = 'none';
			testPanel.style.display = 'none';
		});

		// Click outside to close
		testOverlay.addEventListener('click', function() {
			testOverlay.style.display = 'none';
			testPanel.style.display = 'none';
		});

		// Run test
		runTestBtn.addEventListener('click', () => {
			// Show warning if flow has unsaved changes
			document.getElementById('unsaved-flow-warning').style.display = 
				this.unsavedChanges ? 'block' : 'none';
			
			// Create test message from form inputs
			const testMessage = {
				type: document.getElementById('test-source').value,
				chatname: document.getElementById('test-username').value,
				userid: document.getElementById('test-username').value.toLowerCase(),
				chatmessage: document.getElementById('test-message').value,
				mod: document.getElementById('test-mod').checked,
				vip: document.getElementById('test-vip').checked,
				admin: document.getElementById('test-admin').checked,
				hasDonation: document.getElementById('test-donation').checked,
				// Add other required properties
				timestamp: Date.now(),
			};

			// Apply first-time chatter flag
			if (firstTimeCheckbox?.checked) {
				testMessage.firsttime = true;
			}

			// Apply last-activity timestamp if requested
			if (lastActivityToggle?.checked) {
				const amount = Math.max(0, parseFloat(lastActivityValue?.value) || 0);
				const unit = lastActivityUnit?.value || 'minutes';
				const unitMap = { minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000 };
				const windowMs = unitMap[unit] || unitMap.minutes;
				const ts = Math.max(0, Date.now() - (amount * windowMs));
				testMessage.lastactivity = ts;
				testMessage.lastActivity = ts; // support either casing
			}
			
			// Add donation amount if donation checkbox is checked
			if (testMessage.hasDonation) {
				testMessage.donationAmount = document.getElementById('test-donation-amount').value;
			}
			
			// Run the test
			this.runTestFlow(testMessage);
		});
	}

	displayTestResults(testResult, originalMessage = {}) {
		const resultsEl = document.getElementById('test-results');
		if (!resultsEl) return;

		let html = `<h4>Test Results</h4>`;

		if (!testResult.success) {
			html += `<p class="test-error">${this.escapeHtml(testResult.message)}</p>`;
		} else {
			const result = testResult.result;

			if (result === null) {
				html += `<p class="test-blocked">Message was BLOCKED by a flow.</p>`;
			} else if (result.blocked) {
				html += `<p class="test-blocked">Message was BLOCKED by this flow.</p>`;
			} else if (result.modified) {
				html += `
					<p class="test-modified">Message was MODIFIED.</p>
					<div class="test-result-detail">
						<strong>New Message:</strong> ${this.escapeHtml(result.message.chatmessage || '')}
					</div>
				`;

				// Show any properties that were modified
				const originalKeys = Object.keys(originalMessage || {});
				const modifiedKeys = Object.keys(result.message || {}).filter(key =>
					!originalKeys.includes(key) || result.message[key] !== originalMessage[key]
				);

				if (modifiedKeys.length > 0) {
					html += `<div class="test-result-detail"><strong>Modified Properties:</strong><ul>`;
					modifiedKeys.forEach(key => {
						html += `<li>${this.escapeHtml(key)}: ${this.escapeHtml(JSON.stringify(result.message[key]))}</li>`;
					});
					html += `</ul></div>`;
				}
			} else {
				html += `<p class="test-passed">Flow was triggered but did not modify or block the message.</p>`;
			}
		}

		resultsEl.innerHTML = html;
	}

    createNode(type, subtype, x, y) {
        const id = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const node = { id, type, x: Math.round(x), y: Math.round(y), config: {} };

        if (type === 'trigger') {
            node.triggerType = subtype;
            switch (subtype) { /* Populate default configs */ 
                case 'anyMessage': node.config = {}; break;
                case 'messageContains': node.config = { text: 'keyword' }; break;
                case 'messageStartsWith': node.config = { text: '!' }; break;
                case 'messageEndsWith': node.config = { text: '?' }; break;
                case 'messageEquals': node.config = { text: 'hello' }; break;
                case 'messageRegex': node.config = { pattern: 'pattern', flags: 'i' }; break;
                case 'messageLength': node.config = { comparison: 'gt', length: 100 }; break;
                case 'wordCount': node.config = { comparison: 'gt', count: 5 }; break;
                case 'containsEmoji': node.config = {}; break;
                case 'containsLink': node.config = {}; break;
                case 'fromSource': node.config = { source: '*' }; break;
                case 'fromChannelName': node.config = { channelName: '' }; break;
                case 'fromUser': node.config = { username: 'user' }; break;
                case 'userRole': node.config = { role: 'mod' }; break;
                case 'hasDonation': node.config = {}; break;
                case 'channelPointRedemption': node.config = { rewardName: '' }; break;
                case 'eventType': node.config = { eventType: 'reward' }; break;
                case 'compareProperty': node.config = { property: 'donationAmount', operator: 'gt', value: 0 }; break;
                case 'randomChance': node.config = { probability: 0.1, cooldownMs: 0, maxPerMinute: 0, requireMessage: true }; break;
                case 'timeInterval': node.config = { interval: 60 }; break;
                case 'timeOfDay': node.config = { times: ['12:00'] }; break;
                case 'midiNoteOn': node.config = { deviceId: '', note: '', channel: 1 }; break;
                case 'midiNoteOff': node.config = { deviceId: '', note: '', channel: 1 }; break;
                case 'midiCC': node.config = { deviceId: '', controller: '', channel: 1 }; break;
                case 'messageProperties': node.config = { requiredProperties: [], forbiddenProperties: [], requireAll: true, lastActivityFilter: { enabled: false, mode: 'within', amount: 10, unit: 'minutes' } }; break;
            }
        } else if (type === 'action') {
            node.actionType = subtype;
            switch (subtype) { /* Populate default configs */
                case 'blockMessage':
					node.config = {}; break;
                case 'returnMessage':
					node.config = {}; break;
                case 'continueAsync':
					node.config = {}; break;
                case 'modifyMessage':
					node.config = { newMessage: 'modified text' }; break;
                case 'addPrefix':
					node.config = { prefix: '[{source}] ' }; break;
                case 'addSuffix':
					node.config = { suffix: ' - sent via Social Stream' }; break;
                case 'findReplace':
					node.config = { find: 'bad', replace: 'good', caseSensitive: false }; break;
                case 'removeText':
					node.config = { removeType: 'removeCommand' }; break;
                case 'setProperty':
					node.config = { property: 'nameColor', value: '#FF0000' }; break;
            case 'sendMessage':
					node.config = { destination: 'reply', template: 'Thank you {username}!', timeout: 0 }; break;
            case 'relay':
					node.config = { destination: '', template: '[{source}] {username}: {message}', timeout: 0 }; break;
                case 'webhook':
					node.config = { url: 'https://example.com/hook', method: 'POST', body: '{}', includeMessage: true, syncMode: false, blockOnFailure: false }; break;
                case 'addPoints':
					node.config = { amount: 100 }; break;
                case 'spendPoints':
					node.config = { amount: 100 }; break;
				case 'playTenorGiphy':
					node.config = { mediaUrl: 'https://giphy.com/embed/X9izlczKyCpmCSZu0l', mediaType: 'iframe', duration: 10000, width: 100, height: 100, x: 0, y: 0, randomX: false, randomY: false, useLayer: false, clearFirst: true };
					break;
				case 'showAvatar':
					node.config = { avatarUrl: '', width: 15, height: 15, x: 5, y: 5, randomX: false, randomY: false, borderRadius: 50, borderWidth: 3, borderColor: '#ffffff', shadow: true, duration: 5000, clearFirst: false };
					break;
				case 'showText':
					node.config = { text: 'Hello {username}!', x: 50, y: 50, width: 80, fontSize: 48, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20, borderRadius: 10, outlineWidth: 2, outlineColor: '#000000', animation: 'fadeIn', animationDuration: 500, duration: 5000, clearFirst: false };
					break;
				case 'clearLayer':
					node.config = { layer: 'all' };
					break;
				case 'triggerOBSScene':
					node.config = { sceneName: 'Your Scene Name' };
					break;
				case 'playAudioClip':
					node.config = { audioUrl: 'https://vdo.ninja/media/join.wav', volume: 1.0 };
					break;
				case 'delay':
					node.config = { delayMs: 1000 };
					break;
				case 'obsChangeScene':
					node.config = { sceneName: 'Scene 1' };
					break;
				case 'obsToggleSource':
					node.config = { sourceName: 'Source 1', visible: 'toggle' };
					break;
				case 'obsSetSourceFilter':
					node.config = { sourceName: 'Source 1', filterName: 'Filter 1', enabled: 'toggle' };
					break;
				case 'obsMuteSource':
					node.config = { sourceName: 'Audio Source', muted: 'toggle' };
					break;
				case 'obsStartRecording':
					node.config = {};
					break;
				case 'obsStopRecording':
					node.config = {};
					break;
				case 'obsStartStreaming':
					node.config = {};
					break;
				case 'obsStopStreaming':
					node.config = {};
					break;
				case 'obsReplayBuffer':
					node.config = {};
					break;
				case 'midiSendNote':
					node.config = { deviceId: '', note: 'C4', velocity: 127, duration: 100, channel: 1 };
					break;
				case 'midiSendCC':
					node.config = { deviceId: '', controller: 1, value: 64, channel: 1 };
					break;
				case 'setGateState':
					node.config = { targetNodeId: '', state: 'ALLOW' };
					break;
				case 'resetStateNode':
					node.config = { targetNodeId: '' };
					break;
				case 'setCounter':
					node.config = { targetNodeId: '', value: 0 };
					break;
				case 'incrementCounter':
					node.config = { targetNodeId: '', delta: 1 };
					break;
				case 'checkCounter':
					node.config = { targetNodeId: '' };
					break;
            }
        } else if (type === 'logic') { // NEW
            node.logicType = subtype; // subtype will be 'AND', 'OR', 'NOT', 'RANDOM'
            // Add default configs for configurable logic gates
            switch (subtype) {
                case 'RANDOM':
                    node.config = { probability: 50 }; // 50% chance by default
                    break;
                default:
                    node.config = {};
                    break;
            }
        } else if (type === 'state') {
            node.stateType = subtype;
            switch (subtype) {
                case 'GATE':
                    node.config = { name: 'Gate 1', defaultState: 'ALLOW', autoResetMs: 0 };
                    break;
                case 'QUEUE':
                    node.config = { name: 'Queue 1', maxSize: 10, overflowStrategy: 'DROP_OLDEST', processingDelayMs: 1000, ttlMs: 60000, autoDequeue: true };
                    break;
                case 'SEMAPHORE':
                    node.config = { maxConcurrent: 1, timeoutMs: 30000, queueOverflow: false };
                    break;
                case 'LATCH':
                    node.config = { autoResetMs: 0, resetOnFlow: false };
                    break;
                case 'THROTTLE':
                    node.config = { messagesPerSecond: 1, burstSize: 1, dropStrategy: 'DROP_NEWEST' };
                    break;
                case 'SEQUENCER':
                    node.config = { sequenceDelayMs: 1000, resetOnTimeout: true, timeoutMs: 60000 };
                    break;
                case 'COUNTER':
                    node.config = { name: 'Counter 1', initialCount: 0, targetCount: 5, resetOnTarget: true, mode: 'INCREMENT' };
                    break;
                case 'USERPOOL':
                    node.config = { poolName: 'default', maxUsers: 10, requireEntry: true, entryKeyword: '!enter', resetOnFull: false, resetAfterMs: 0, allowReentry: false, scope: 'global' };
                    break;
                case 'ACCUMULATOR':
                    node.config = { accumulatorName: 'default', threshold: 100, propertyName: 'amount', operation: 'sum', triggerMode: 'gte', autoReset: false, scope: 'global', resetAfterMs: 0 };
                    break;
                default:
                    node.config = {};
            }
        }
        this.currentFlow.nodes.push(node);
        this.renderNode(node);
        this.selectNode(id);
        this.markUnsavedChanges(true);
    }

    deleteNode(nodeId) {
        if (!this.currentFlow) return;
        this.currentFlow.nodes = this.currentFlow.nodes.filter(node => node.id !== nodeId);
        this.currentFlow.connections = this.currentFlow.connections.filter(
            conn => conn.from !== nodeId && conn.to !== nodeId
        );
        this.markUnsavedChanges(true);
        this.renderFlow();
        if (this.selectedNode === nodeId) {
            this.selectNode(null);
        }
    }

    deleteConnection(fromNodeId, toNodeId) {
        if (!this.currentFlow) return;
        this.currentFlow.connections = this.currentFlow.connections.filter(
            conn => !(conn.from === fromNodeId && conn.to === toNodeId)
        );
        this.markUnsavedChanges(true);
        this.renderFlow();
    }

    startConnection(nodeId, connPointType, event) {
        if (!this.currentFlow || connPointType !== 'output') return; // Only drag from output

        this.draggedConnection = { from: nodeId, tempLine: null };
        const canvas = document.getElementById('flow-canvas');
        
        const sourcePointEl = event.target; // The output connection point element
        const sourceRect = sourcePointEl.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();

        const initialX = sourceRect.left + sourceRect.width / 2; 
        const initialY = sourceRect.top + sourceRect.height / 2;

        this.draggedConnection.tempLine = this.createTemporaryLine(canvas, initialX, initialY, event.clientX, event.clientY);

        document.addEventListener('mousemove', this.handleConnectionDragMove);
        document.addEventListener('mouseup', this.handleConnectionDragEnd);
        event.stopPropagation();
    }
    
    createTemporaryLine(canvas, x1, y1, x2, y2) {
        let svg = canvas.querySelector('svg.temp-connection');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'temp-connection');
            Object.assign(svg.style, { position: 'absolute', left: '0px', top: '0px', width: canvas.scrollWidth + 'px', height: canvas.scrollHeight + 'px', pointerEvents: 'none', zIndex: '100'});
            canvas.appendChild(svg);
        }
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const canvasRect = canvas.getBoundingClientRect();
        const relativeX1 = x1 - canvasRect.left + canvas.scrollLeft;
        const relativeY1 = y1 - canvasRect.top + canvas.scrollTop;
        const relativeX2 = x2 - canvasRect.left + canvas.scrollLeft;
        const relativeY2 = y2 - canvasRect.top + canvas.scrollTop;
        const controlYOffset = Math.max(30, Math.abs(relativeY2 - relativeY1) * 0.3);
        path.setAttribute('d', `M ${relativeX1},${relativeY1} C ${relativeX1},${relativeY1 + controlYOffset} ${relativeX2},${relativeY2 - controlYOffset} ${relativeX2},${relativeY2}`);
        Object.assign(path, { stroke: 'var(--secondary-color)', 'stroke-width': '2', fill: 'none', 'stroke-dasharray': '5,5' });
        svg.innerHTML = ''; 
        svg.appendChild(path);
        return svg;
    }

    handleConnectionDragMove = (e) => {
        if (!this.draggedConnection || !this.draggedConnection.tempLine) return;
        const canvas = document.getElementById('flow-canvas');
        const sourceNodeEl = document.querySelector(`.node[data-id="${this.draggedConnection.from}"] .connection-point.output`);
        if(!sourceNodeEl) return;
        const sourceRect = sourceNodeEl.getBoundingClientRect();
        const startX = sourceRect.left + sourceRect.width / 2;
        const startY = sourceRect.top + sourceRect.height / 2;
        this.createTemporaryLine(canvas, startX, startY, e.clientX, e.clientY);
    };

    handleConnectionDragEnd = (e) => {
        document.removeEventListener('mousemove', this.handleConnectionDragMove);
        document.removeEventListener('mouseup', this.handleConnectionDragEnd);
        if (this.draggedConnection && this.draggedConnection.tempLine) {
            this.draggedConnection.tempLine.remove();
        }

        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        // Only allow dropping on input points (we started from output)
        if (targetElement && targetElement.classList.contains('connection-point') && targetElement.dataset.pointType === 'input') {
            const targetNodeElement = targetElement.closest('.node');
            if (targetNodeElement) {
                const toNodeId = targetNodeElement.dataset.id;
                const fromNodeId = this.draggedConnection.from;
                
                if (fromNodeId !== toNodeId) {
                    const fromNodeData = this.currentFlow.nodes.find(n => n.id === fromNodeId);
                    const toNodeData = this.currentFlow.nodes.find(n => n.id === toNodeId);

                    let isValidConnection = false;
                    if (fromNodeData && toNodeData) {
                        // Check if this would be a post-terminal connection to Return Message
                        if (toNodeData.type === 'action' && toNodeData.actionType === 'returnMessage') {
                            // Check if the source is post-terminal (after a block)
                            const wouldBePostTerminal = this.isPostTerminalConnection({ from: fromNodeId, to: toNodeId });
                            if (wouldBePostTerminal) {
                                // Show error message
                                this.showNotification('Cannot connect to Return Message after a terminal action (Block Message)', 'error');
                                isValidConnection = false;
                            } else {
                                isValidConnection = true;
                            }
                        } else {
                            // Valid connections:
                            // - Trigger -> Action, Logic, or State
                            // - Logic -> Action, Logic, or State
                            // - Action -> Action, Logic, or State
                            // - State -> Action, Logic, or State
                            if ((fromNodeData.type === 'trigger' || fromNodeData.type === 'logic' || fromNodeData.type === 'action' || fromNodeData.type === 'state') &&
                                (toNodeData.type === 'action' || toNodeData.type === 'logic' || toNodeData.type === 'state')) {
                                isValidConnection = true;
                            }
                        }
                    }
                    
                    if (isValidConnection) {
                         this.createConnection(fromNodeId, toNodeId);
                    }
                }
            }
        }
        this.draggedConnection = null;
    };

    createConnection(fromNodeId, toNodeId) {
        if (!this.currentFlow) return;
        const existing = this.currentFlow.connections.find(c => c.from === fromNodeId && c.to === toNodeId);
        if (existing || fromNodeId === toNodeId) return;
        this.currentFlow.connections.push({
            id: `conn_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            from: fromNodeId, to: toNodeId
        });
        this.markUnsavedChanges(true);
        this.renderFlow();
    }

    selectNode(nodeId) {
        const previouslySelected = document.querySelector('.node.selected');
        if (previouslySelected) previouslySelected.classList.remove('selected');
        this.selectedNode = nodeId; // Store ID
        if (!nodeId) {
            this.renderNodePropertiesPlaceholder();
            return;
        }
        const nodeEl = document.querySelector(`.node[data-id="${nodeId}"]`);
        if (nodeEl) nodeEl.classList.add('selected');
        const nodeData = this.currentFlow.nodes.find(n => n.id === nodeId);
        if (!nodeData) {
             document.getElementById('node-properties-content').innerHTML = '<p>Error: Node data not found.</p>';
            return;
        }
        this.showNodeProperties(nodeData);
    }

	showNodeProperties(node) {
		const propertiesContent = document.getElementById('node-properties-content');
		let html = `<h4>${this.escapeHtml(this.getNodeTitle(node))} Properties</h4>
					<input type="hidden" id="node-id-prop" value="${this.escapeHtml(node.id)}">`;

		let typeArray, subtypeField; // Use subtypeField to get the specific type (triggerType, actionType, logicType)
		
		if (node.type === 'trigger') {
			typeArray = this.triggerTypes;
			subtypeField = 'triggerType';
		} else if (node.type === 'action') {
			typeArray = this.actionTypes;
			subtypeField = 'actionType';
		} else if (node.type === 'logic') {
			typeArray = this.logicNodeTypes; // Ensure this.logicNodeTypes is defined in your constructor
			subtypeField = 'logicType';
		} else if (node.type === 'state') {
			typeArray = this.stateNodeTypes;
			subtypeField = 'stateType';
		} else {
			propertiesContent.innerHTML = '<p>Unknown node type selected.</p>';
			return;
		}

		// Dropdown to change the subtype of the node (e.g., change a 'messageContains' to 'messageStartsWith')
		html += `<div class="property-group">
					<label class="property-label">Type</label>
					<select class="property-input" id="node-subtype-prop" data-nodetype="${node.type}">
						${typeArray.map(opt => `<option value="${opt.id}" ${node[subtypeField] === opt.id ? 'selected' : ''}>${opt.name}</option>`).join('')}
					</select></div>`;

		if (!node.config) {
			node.config = {}; // Ensure config object exists
		}

		// Use node[subtypeField] for the switch, as it holds the actual subtype id like 'messageContains', 'AND', etc.
		switch (node[subtypeField]) {
			// --- Trigger Cases ---
			case 'messageContains':
			case 'messageStartsWith':
			case 'messageEndsWith':
			case 'messageEquals':
				html += `<div class="property-group"><label class="property-label">Text to Match</label><input type="text" class="property-input" id="prop-text" value="${node.config.text || ''}"></div>`;
				break;
			case 'messageRegex':
				html += `<div class="property-group"><label class="property-label">Regex Pattern</label><input type="text" class="property-input" id="prop-pattern" value="${node.config.pattern || ''}"></div>
						 <div class="property-group"><label class="property-label">Regex Flags</label><input type="text" class="property-input" id="prop-flags" value="${node.config.flags || 'i'}"></div>`;
				break;
			case 'messageLength':
				html += `<div class="property-group"><label class="property-label">Comparison</label><select class="property-input" id="prop-comparison">
						   <option value="gt" ${node.config.comparison === 'gt' ? 'selected' : ''}>Greater than</option>
						   <option value="lt" ${node.config.comparison === 'lt' ? 'selected' : ''}>Less than</option>
						   <option value="eq" ${node.config.comparison === 'eq' ? 'selected' : ''}>Equals</option>
						 </select></div>
						 <div class="property-group"><label class="property-label">Length</label><input type="number" class="property-input" id="prop-length" value="${node.config.length || 100}" min="0"></div>`;
				break;
			case 'wordCount':
				html += `<div class="property-group"><label class="property-label">Comparison</label><select class="property-input" id="prop-comparison">
						   <option value="gt" ${node.config.comparison === 'gt' ? 'selected' : ''}>Greater than</option>
						   <option value="lt" ${node.config.comparison === 'lt' ? 'selected' : ''}>Less than</option>
						   <option value="eq" ${node.config.comparison === 'eq' ? 'selected' : ''}>Equals</option>
						 </select></div>
						 <div class="property-group"><label class="property-label">Word Count</label><input type="number" class="property-input" id="prop-count" value="${node.config.count || 5}" min="0"></div>`;
				break;
			case 'containsEmoji':
				html += `<p class="property-help">Triggers when the message contains any emoji character.</p>`;
				break;
			case 'containsLink':
				html += `<p class="property-help">Triggers when a message contains a URL (http://, https://, or www.)</p>`;
				break;
			case 'anyMessage':
				html += `<p class="property-help">Triggers on any message regardless of content.</p>`;
				break;
			case 'timeInterval':
				html += `<div class="property-group">
					<label class="property-label">Interval (seconds)</label>
					<input type="number" class="property-input" id="prop-interval" value="${node.config.interval || 60}" min="1">
				</div>
				<p class="property-help">Triggers at regular intervals.</p>`;
				break;
			case 'timeOfDay':
				html += `<div class="property-group">
					<label class="property-label">Times (HH:MM format, comma separated)</label>
					<input type="text" class="property-input" id="prop-times" value="${(node.config.times || ['12:00']).join(', ')}" placeholder="09:00, 12:00, 18:00">
				</div>
				<p class="property-help">Triggers at specific times of day.</p>`;
				break;
			case 'midiNoteOn':
			case 'midiNoteOff':
				html += `<div class="property-group">
					<label class="property-label">MIDI Input Device</label>
					<select class="property-input" id="prop-deviceId">
						<option value="">Select MIDI Input Device...</option>
					</select>
				</div>
				<div class="property-group">
					<label class="property-label">Note (e.g., C4, D#5, or leave empty for any)</label>
					<input type="text" class="property-input" id="prop-note" value="${node.config.note || ''}" placeholder="C4">
				</div>
				<div class="property-group">
					<label class="property-label">Channel (1-16)</label>
					<input type="number" class="property-input" id="prop-channel" value="${node.config.channel || 1}" min="1" max="16">
				</div>
				<p class="property-help">Triggers on MIDI ${node.triggerType === 'midiNoteOn' ? 'Note On' : 'Note Off'} events.</p>`;
				// Populate MIDI devices asynchronously
				this.populateMIDIInputDevices('prop-deviceId', node.config.deviceId);
				break;
			case 'midiCC':
				html += `<div class="property-group">
					<label class="property-label">MIDI Input Device</label>
					<select class="property-input" id="prop-deviceId">
						<option value="">Select MIDI Input Device...</option>
					</select>
				</div>
				<div class="property-group">
					<label class="property-label">Controller Number (0-127, or leave empty for any)</label>
					<input type="number" class="property-input" id="prop-controller" value="${node.config.controller || ''}" min="0" max="127" placeholder="1">
				</div>
				<div class="property-group">
					<label class="property-label">Channel (1-16)</label>
					<input type="number" class="property-input" id="prop-channel" value="${node.config.channel || 1}" min="1" max="16">
				</div>
				<p class="property-help">Triggers on MIDI Control Change events.</p>`;
				this.populateMIDIInputDevices('prop-deviceId', node.config.deviceId);
				break;
			case 'fromSource':
				const isCustomSource = node.config.source && !['*', 'afreecatv', 'amazon', 'arena', 'arenasocial', 'bandlab', 'beamstream', 'bigo', 'bilibili', 'bilibilicom',
  'bitchute', 'boltplus', 'buzzit', 'castr', 'cbox', 'chatroll', 'chaturbate', 'cherrytv', 'chime', 'chzzk',
  'circle', 'cloudhub', 'cozy', 'crowdcast', 'discord', 'dlive', 'estrim', 'facebook', 'fansly', 'favorited',
  'fc2', 'floatplane', 'gala', 'generic', 'instafeed', 'instagram', 'instagramlive', 'jaco', 'joystick', 'kick',
  'kiwiirc', 'linkedin', 'livepush', 'livestorm', 'livestream', 'locals', 'loco', 'meetme', 'meets',
  'megaphonetv', 'minnit', 'mixcloud', 'mixlr', 'mobcrush', 'moonbeam', 'nextcloud', 'nicovideo', 'nimo', 'noice',
  'nonolive', 'odysee', 'on24', 'onlinechurch', 'openai', 'openstreamingplatform', 'owncast', 'parti', 'patreon',
  'peertube', 'picarto', 'piczel', 'pilled', 'quakenet', 'quickchannel', 'restream', 'riverside', 'rokfin',
  'roll20', 'rooter', 'rumble', 'rutube', 'sessions', 'shareplay', 'slack', 'slido', 'sooplive', 'soopliveco',
  'soulbound', 'stageten', 'steam', 'substack', 'teams', 'telegram', 'telegramk', 'tellonym', 'tiktok',
  'tradingview', 'trovo', 'truffle', 'twitcasting', 'twitch', 'uscreen', 'vdoninja', 'vercel', 'verticalpixelzone',
   'vimeo', 'vklive', 'vkplay', 'vkvideo', 'wavevideo', 'webex', 'webinargeek', 'whatnot', 'whatsapp', 'whop',
  'wix', 'wix2', 'workplace', 'x', 'xeenon', 'younow', 'youtube', 'youtubeshorts', 'youtube_comments', 'zapstream', 'zoom',
  'other'].includes(node.config.source);
				
				html += `<div class="property-group"><label class="property-label">Source Platform</label><select class="property-input" id="prop-source">
						   <option value="*" ${node.config.source === '*' ? 'selected' : ''}>Any Source</option>
						    ${['afreecatv', 'amazon', 'arena', 'arenasocial', 'bandlab', 'beamstream', 'bigo', 'bilibili', 'bilibilicom',
  'bitchute', 'boltplus', 'buzzit', 'castr', 'cbox', 'chatroll', 'chaturbate', 'cherrytv', 'chime', 'chzzk',
  'circle', 'cloudhub', 'cozy', 'crowdcast', 'discord', 'dlive', 'estrim', 'facebook', 'fansly', 'favorited',
  'fc2', 'floatplane', 'gala', 'generic', 'instafeed', 'instagram', 'instagramlive', 'jaco', 'joystick', 'kick',
  'kiwiirc', 'linkedin', 'livepush', 'livestorm', 'livestream', 'locals', 'loco', 'meetme', 'meets',
  'megaphonetv', 'minnit', 'mixcloud', 'mixlr', 'mobcrush', 'moonbeam', 'nextcloud', 'nicovideo', 'nimo', 'noice',
  'nonolive', 'odysee', 'on24', 'onlinechurch', 'openai', 'openstreamingplatform', 'owncast', 'parti', 'patreon',
  'peertube', 'picarto', 'piczel', 'pilled', 'quakenet', 'quickchannel', 'restream', 'riverside', 'rokfin',
  'roll20', 'rooter', 'rumble', 'rutube', 'sessions', 'shareplay', 'slack', 'slido', 'sooplive', 'soopliveco',
  'soulbound', 'stageten', 'steam', 'substack', 'teams', 'telegram', 'telegramk', 'tellonym', 'tiktok',
  'tradingview', 'trovo', 'truffle', 'twitcasting', 'twitch', 'uscreen', 'vdoninja', 'vercel', 'verticalpixelzone',
   'vimeo', 'vklive', 'vkplay', 'vkvideo', 'wavevideo', 'webex', 'webinargeek', 'whatnot', 'whatsapp', 'whop',
  'wix', 'wix2', 'workplace', 'x', 'xeenon', 'younow', 'youtube', 'youtubeshorts', 'youtube_comments', 'zapstream', 'zoom',
  'other'].map(s => `<option value="${s}" ${node.config.source === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()
   + s.slice(1).replace(/_/g, ' ')}</option>`).join('')}
   						<option value="custom" ${isCustomSource ? 'selected' : ''}>🔧 Custom...</option>
						 </select></div>`;
				
				if (isCustomSource) {
					html += `<div class="property-group"><label class="property-label">Custom Source</label><input type="text" class="property-input" id="prop-source-custom" value="${node.config.source || ''}" placeholder="Enter custom source"></div>`;
				}
				break;
			case 'fromChannelName':
				html += `<div class="property-group"><label class="property-label">Channel Name</label><input type="text" class="property-input" id="prop-channelName" value="${node.config.channelName || ''}" placeholder="Enter channel name"></div>
						 <div class="property-help">Match messages from a specific channel name or host username</div>`;
				break;
			case 'fromUser':
				html += `<div class="property-group"><label class="property-label">Username</label><input type="text" class="property-input" id="prop-username" value="${node.config.username || ''}"></div>`;
				break;
			case 'userRole':
				html += `<div class="property-group"><label class="property-label">User Role</label><select class="property-input" id="prop-role">
						   ${['mod', 'vip', 'admin', 'subscriber', 'follower'].map(r => `<option value="${r}" ${node.config.role === r ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('')}
						 </select></div>`;
				break;
			case 'hasDonation': // Trigger type
				html += `<p class="property-help">Fires if the message includes donation information.</p>`;
				break;
			case 'channelPointRedemption':
				html += `
					<div class="property-group">
						<label class="property-label">Reward Name (optional)</label>
						<input type="text" class="property-input" id="prop-rewardName"
							value="${this.escapeHtml(node.config.rewardName || '')}" placeholder="Leave empty for any redemption">
						<div class="property-help">Filter by specific reward name. Leave empty to match any channel point redemption.</div>
					</div>
					<div class="property-group" style="background: #e8f5e9; color: #333; padding: 10px; border-radius: 4px;">
						<strong>🎁 Channel Point Redemption</strong><br>
						Triggers when a viewer redeems channel points (Twitch, Kick, etc.).<br><br>
						<strong>💡 Song Request Setup:</strong><br>
						1. Create a channel point reward like "Song Request"<br>
						2. Add this trigger with the reward name<br>
						3. Connect to "Add to Queue" action with "Use chat message" checked<br>
						4. Viewers redeem points with a song name to add it!
					</div>`;
				break;
			case 'eventType':
				const eventTypes = [
					{ value: 'reward', label: 'Channel Point Redemption' },
					{ value: 'newmember', label: 'New Member/Subscriber' },
					{ value: 'giftpurchase', label: 'Gift Sub Purchase' },
					{ value: 'raid', label: 'Raid' },
					{ value: 'follow', label: 'Follow' },
					{ value: 'host', label: 'Host' },
					{ value: 'cheer', label: 'Cheer/Bits' },
					{ value: 'superchat', label: 'Super Chat' },
					{ value: 'membership', label: 'Membership' },
					{ value: '_custom', label: '-- Custom Event --' }
				];
				const isCustomEvent = !eventTypes.some(e => e.value === node.config.eventType && e.value !== '_custom');
				html += `
					<div class="property-group">
						<label class="property-label">Event Type</label>
						<select class="property-input" id="prop-eventType-select">
							${eventTypes.map(e => `<option value="${e.value}" ${(node.config.eventType === e.value || (isCustomEvent && e.value === '_custom')) ? 'selected' : ''}>${e.label}</option>`).join('')}
						</select>
					</div>
					<div class="property-group" id="custom-event-group" style="${isCustomEvent ? '' : 'display: none;'}">
						<label class="property-label">Custom Event Name</label>
						<input type="text" class="property-input" id="prop-eventType" value="${isCustomEvent ? (node.config.eventType || '') : ''}" placeholder="e.g., reaction">
						<div class="property-help">Enter the exact event type from the message object</div>
					</div>
					<div class="property-group" style="background: #fff3e0; color: #333; padding: 10px; border-radius: 4px;">
						<strong>📣 Event Types</strong><br>
						Triggers on specific stream events like raids, follows, subs, etc.
					</div>`;
				break;
			case 'compareProperty':
				const commonProperties = [
					{ value: 'donationAmount', label: 'Donation Amount' },
					{ value: 'karma', label: 'Karma Score (0-1)' },
					{ value: 'memberMonths', label: 'Member Months' },
					{ value: 'bitsAmount', label: 'Bits Amount (Twitch)' },
					{ value: 'superChatAmount', label: 'Super Chat Amount (YouTube)' },
					{ value: 'viewerCount', label: 'Viewer Count' },
					{ value: 'messageLength', label: 'Message Length' },
					{ value: 'wordCount', label: 'Word Count' },
					{ value: '_custom', label: '-- Custom Property --' }
				];
				const operators = [
					{ value: 'gt', label: 'Greater than (>)' },
					{ value: 'gte', label: 'Greater or equal (>=)' },
					{ value: 'lt', label: 'Less than (<)' },
					{ value: 'lte', label: 'Less or equal (<=)' },
					{ value: 'eq', label: 'Equals (=)' },
					{ value: 'ne', label: 'Not equals (!=)' }
				];
				const isCustomProp = !commonProperties.some(p => p.value === node.config.property && p.value !== '_custom');
				html += `
					<div class="property-group">
						<label class="property-label">Property to Compare</label>
						<select class="property-input" id="prop-property-select">
							${commonProperties.map(p => `<option value="${p.value}" ${(node.config.property === p.value || (isCustomProp && p.value === '_custom')) ? 'selected' : ''}>${p.label}</option>`).join('')}
						</select>
					</div>
					<div class="property-group" id="custom-property-group" style="${isCustomProp ? '' : 'display: none;'}">
						<label class="property-label">Custom Property Name</label>
						<input type="text" class="property-input" id="prop-property" value="${isCustomProp ? (node.config.property || '') : ''}" placeholder="e.g., customField">
						<div class="property-help">Enter the exact property name from the message object</div>
					</div>
					<div class="property-group">
						<label class="property-label">Operator</label>
						<select class="property-input" id="prop-operator">
							${operators.map(o => `<option value="${o.value}" ${node.config.operator === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
						</select>
					</div>
					<div class="property-group">
						<label class="property-label">Compare Value</label>
						<input type="number" class="property-input" id="prop-value" value="${node.config.value ?? 0}" step="any">
						<div class="property-help">The value to compare against</div>
					</div>
					<div class="property-group" style="background: #e3f2fd; color: #333; padding: 10px; border-radius: 4px;">
						<strong>💡 Examples:</strong><br>
						• donationAmount > 50 (tips over $50)<br>
						• karma < 0.3 (low karma users)<br>
						• memberMonths >= 12 (1 year+ members)
					</div>`;
				break;
			case 'randomChance': // Random trigger
				const probability = (node.config.probability || 0.1) * 100; // Convert to percentage for display
				html += `
					<div class="property-group">
						<label class="property-label">Trigger Probability</label>
						<div style="display: flex; align-items: center; gap: 10px;">
							<input type="range" class="property-input" id="prop-probability-slider" 
								min="0" max="100" step="1" value="${probability}">
							<input type="number" class="property-input" id="prop-probability" 
								min="0" max="100" step="1" value="${probability}" style="width: 80px;">
							<span>%</span>
						</div>
						<div class="property-help">Chance this trigger will fire (0-100%)</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Cooldown (seconds)</label>
						<input type="number" class="property-input" id="prop-cooldownMs" 
							value="${(node.config.cooldownMs || 0) / 1000}" min="0" step="0.1">
						<div class="property-help">Minimum time between triggers (0 = no cooldown)</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Max Triggers Per Minute</label>
						<input type="number" class="property-input" id="prop-maxPerMinute" 
							value="${node.config.maxPerMinute || 0}" min="0" step="1">
						<div class="property-help">Rate limit (0 = unlimited)</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">
							<input type="checkbox" id="prop-requireMessage" 
								${node.config.requireMessage !== false ? 'checked' : ''}>
							Require Chat Message
						</label>
						<div class="property-help">Only trigger on actual chat messages (skip metadata updates)</div>
					</div>
					
					<details style="margin-top: 10px;">
						<summary style="cursor: pointer; color: #888;">Use Cases & Examples</summary>
						<div style="margin-top: 10px; padding: 10px; background: #2a2a2a; border-radius: 4px;">
							<strong>Giveaway Entry:</strong> 10% chance, 1 per minute max<br>
							<strong>Random Highlight:</strong> 5% chance, 30 second cooldown<br>
							<strong>A/B Testing:</strong> 50% chance for feature A vs B<br>
							<strong>Lottery System:</strong> 1% chance, once per user<br>
							<strong>Random Moderation:</strong> 20% chance to check for spam
						</div>
					</details>`;
				break;
			case 'messageProperties': // Advanced property filter
				const messagePropertyOptions = [
					// Basic Properties
					{ value: 'chatname', label: 'Username (chatname)', group: 'Basic' },
					{ value: 'chatmessage', label: 'Chat Message', group: 'Basic' },
					{ value: 'type', label: 'Source Type', group: 'Basic' },
					{ value: 'sourceName', label: 'Channel Name', group: 'Basic' },
					// Media Properties
					{ value: 'chatimg', label: 'User Avatar', group: 'Media' },
					{ value: 'contentimg', label: 'Content Image/Video', group: 'Media' },
					{ value: 'sourceImg', label: 'Source Image', group: 'Media' },
					// Status Properties
					{ value: 'moderator', label: 'Is Moderator', group: 'Status' },
					{ value: 'admin', label: 'Is Admin', group: 'Status' },
					{ value: 'bot', label: 'Is Bot', group: 'Status' },
					{ value: 'verified', label: 'Is Verified', group: 'Status' },
					{ value: 'firsttime', label: 'First-time chatter', group: 'Status', tooltip: 'Requires First timers enabled in global settings' },
					// Event Properties
					{ value: 'hasDonation', label: 'Has Donation', group: 'Events' },
					{ value: 'membership', label: 'Membership Event', group: 'Events' },
					{ value: 'event', label: 'Is Event', group: 'Events' },
					{ value: 'title', label: 'Event Title', group: 'Events' },
					{ value: 'subtitle', label: 'Event Subtitle', group: 'Events' },
					// Interaction Properties
					{ value: 'question', label: 'Is Question', group: 'Interaction' },
					{ value: 'private', label: 'Is Private', group: 'Interaction' },
					{ value: 'highKarma', label: 'High Karma (≥0.7)', group: 'Interaction', tooltip: 'Requires Add karma enabled in global settings' },
					{ value: 'lowKarma', label: 'Low Karma (<0.3)', group: 'Interaction', tooltip: 'Requires Add karma enabled in global settings' },
					// Metadata
					{ value: 'userid', label: 'User ID', group: 'Metadata' },
					{ value: 'textonly', label: 'Text Only', group: 'Metadata' },
					{ value: 'chatbadges', label: 'Has Badges', group: 'Metadata' }
				];
				
				const currentRequired = node.config.requiredProperties || [];
				const currentForbidden = node.config.forbiddenProperties || [];
				const requireAll = node.config.requireAll !== false;
				const lastActivityConfig = node.config.lastActivityFilter || {};
				let lastActivityEnabled = !!lastActivityConfig.enabled;
				const lastActivityMode = lastActivityConfig.mode === 'older' ? 'older' : 'within';
				const lastActivityAmount = lastActivityConfig.amount ?? 10;
				const lastActivityUnit = lastActivityConfig.unit || 'minutes';
				const firstTimeChecked = currentRequired.includes('firsttime');

				// If first-time chatter is required, disable last-activity filter to keep mutual exclusivity
				if (firstTimeChecked && lastActivityEnabled) {
					lastActivityEnabled = false;
					if (node.config && node.config.lastActivityFilter) {
						node.config.lastActivityFilter.enabled = false;
					}
				}
				
				// Group properties by category
				const groupedProps = {};
				messagePropertyOptions.forEach(opt => {
					if (!groupedProps[opt.group]) groupedProps[opt.group] = [];
					groupedProps[opt.group].push(opt);
				});
				
				html += `
					<div class="property-group">
						<label class="property-label">Logic Mode</label>
						<div style="margin: 5px 0;">
							<label><input type="radio" name="prop-requireAll" value="true" ${requireAll ? 'checked' : ''}> Require ALL checked properties</label><br>
							<label><input type="radio" name="prop-requireAll" value="false" ${!requireAll ? 'checked' : ''}> Require ANY checked property</label>
						</div>
					</div>
					<div class="property-group">
						<label class="property-label">✓ Required Properties (must exist)</label>
						<div style="max-height: 200px; overflow-y: auto; border: 1px solid #444; padding: 5px; background: #2a2a2a;">`;
				
				Object.entries(groupedProps).forEach(([group, props]) => {
					html += `<div style="margin-bottom: 10px;"><strong style="color: #888;">${group}:</strong><br>`;
					props.forEach(prop => {
						const isChecked = currentRequired.includes(prop.value);
						const tooltip = prop.tooltip ? ` title="${prop.tooltip}"` : '';
						const infoIcon = prop.tooltip ? ` <span style="opacity:0.7; cursor: help;" title="${prop.tooltip}">ℹ️</span>` : '';
						html += `<label style="display: block; margin: 2px 0;">
							<input type="checkbox" class="prop-required" value="${prop.value}" ${isChecked ? 'checked' : ''}> 
							<span${tooltip}>${prop.label}</span>${infoIcon}
						</label>`;
					});
					html += `</div>`;
				});
				
				html += `</div></div>
					<div class="property-group">
						<label class="property-label">✗ Forbidden Properties (must NOT exist)</label>
						<div style="max-height: 200px; overflow-y: auto; border: 1px solid #444; padding: 5px; background: #2a2a2a;">`;
				
				Object.entries(groupedProps).forEach(([group, props]) => {
					html += `<div style="margin-bottom: 10px;"><strong style="color: #888;">${group}:</strong><br>`;
					props.forEach(prop => {
						const isChecked = currentForbidden.includes(prop.value);
						const tooltip = prop.tooltip ? ` title="${prop.tooltip}"` : '';
						const infoIcon = prop.tooltip ? ` <span style="opacity:0.7; cursor: help;" title="${prop.tooltip}">ℹ️</span>` : '';
						html += `<label style="display: block; margin: 2px 0;">
							<input type="checkbox" class="prop-forbidden" value="${prop.value}" ${isChecked ? 'checked' : ''}> 
							<span${tooltip}>${prop.label}</span>${infoIcon}
						</label>`;
					});
					html += `</div>`;
				});
				
				html += `</div></div>
					<div class="property-group">
						<label class="property-label">Last Activity (optional)</label>
						<label style="display: block; margin-bottom: 6px;">
							<input type="checkbox" id="prop-lastActivity-enabled" ${lastActivityEnabled ? 'checked' : ''}> Require last activity window
						</label>
						<div id="last-activity-controls" style="display: flex; flex-direction: column; gap: 8px; ${lastActivityEnabled ? '' : 'opacity: 0.6; pointer-events: none;'}">
							<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
								<label><input type="radio" name="prop-lastActivity-mode" value="within" ${lastActivityMode === 'within' ? 'checked' : ''}> Within</label>
								<label><input type="radio" name="prop-lastActivity-mode" value="older" ${lastActivityMode === 'older' ? 'checked' : ''}> Older than</label>
								<input type="number" class="property-input" id="prop-lastActivity-value" value="${lastActivityAmount}" min="0" step="1" style="width: 90px;">
								<select class="property-input" id="prop-lastActivity-unit" style="width: 120px;">
									<option value="minutes" ${lastActivityUnit === 'minutes' ? 'selected' : ''}>Minutes</option>
									<option value="hours" ${lastActivityUnit === 'hours' ? 'selected' : ''}>Hours</option>
									<option value="days" ${lastActivityUnit === 'days' ? 'selected' : ''}>Days</option>
								</select>
							</div>
							<div style="display: flex; flex-wrap: wrap; gap: 6px;">
								<button type="button" class="btn btn-ghost btn-small quick-last-activity" data-amount="10" data-unit="minutes">10 min</button>
								<button type="button" class="btn btn-ghost btn-small quick-last-activity" data-amount="30" data-unit="minutes">30 min</button>
								<button type="button" class="btn btn-ghost btn-small quick-last-activity" data-amount="3" data-unit="hours">3 hours</button>
								<button type="button" class="btn btn-ghost btn-small quick-last-activity" data-amount="12" data-unit="hours">12 hours</button>
								<button type="button" class="btn btn-ghost btn-small quick-last-activity" data-amount="1" data-unit="days">1 day</button>
							</div>
							<div class="property-help">Filter by how recently a user last chatted (uses stored lastActivity timestamps; requires “First timers” enabled in global settings). First-time chatters fail this requirement because they have no prior activity timestamp.</div>
						</div>
					</div>
					<div class="property-group">
						<label class="property-label">First-time chatter</label>
						<label style="display: block; margin-bottom: 6px;">
							<input type="checkbox" id="prop-firsttime-only" ${firstTimeChecked ? 'checked' : ''} ${lastActivityEnabled ? 'disabled' : ''}> Require first-time chatter
						</label>
						<div class="property-help">Mutually exclusive with “Require last activity window”. Enabling one disables the other.</div>
					</div>
					<div class="property-help">Filter messages based on presence/absence of properties. Required properties must exist and be truthy. Forbidden properties must not exist or be falsy.</div>`;
				break;
			case 'counter': // Counter trigger
				html += `
					<div class="property-group">
						<label class="property-label">Counter Name</label>
						<input type="text" class="property-input" id="prop-counterName" 
							value="${node.config.counterName || 'default'}" placeholder="e.g., donations, messages">
						<div class="property-help">Unique identifier for this counter</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Scope</label>
						<select class="property-input" id="prop-scope">
							<option value="global" ${node.config.scope === 'global' ? 'selected' : ''}>Global (all users)</option>
							<option value="perUser" ${(!node.config.scope || node.config.scope === 'perUser') ? 'selected' : ''}>Per User</option>
							<option value="perSource" ${node.config.scope === 'perSource' ? 'selected' : ''}>Per Source/Channel</option>
							<option value="perUserPerSource" ${node.config.scope === 'perUserPerSource' ? 'selected' : ''}>Per User Per Source</option>
						</select>
						<div class="property-help">How to track counts - globally or separately</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Trigger At Count</label>
						<input type="number" class="property-input" id="prop-threshold" 
							value="${node.config.threshold || 10}" min="1" step="1">
						<div class="property-help">Fire when counter reaches this value</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Trigger Mode</label>
						<select class="property-input" id="prop-triggerMode">
							<option value="exact" ${(!node.config.triggerMode || node.config.triggerMode === 'exact') ? 'selected' : ''}>Exact match (==)</option>
							<option value="multiple" ${node.config.triggerMode === 'multiple' ? 'selected' : ''}>Every multiple of</option>
							<option value="gte" ${node.config.triggerMode === 'gte' ? 'selected' : ''}>Greater or equal (≥)</option>
						</select>
						<div class="property-help">When to trigger based on count value</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">
							<input type="checkbox" id="prop-autoReset" 
								${node.config.autoReset ? 'checked' : ''}>
							Auto-reset after trigger
						</label>
						<div class="property-help">Reset counter to 0 after triggering</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Count What</label>
						<select class="property-input" id="prop-countType">
							<option value="messages" ${(!node.config.countType || node.config.countType === 'messages') ? 'selected' : ''}>All messages</option>
							<option value="property" ${node.config.countType === 'property' ? 'selected' : ''}>Messages with property</option>
							<option value="value" ${node.config.countType === 'value' ? 'selected' : ''}>Property value sum</option>
						</select>
					</div>
					
					<div class="property-group" id="counter-property-group" style="${node.config.countType === 'property' || node.config.countType === 'value' ? '' : 'display: none;'}">
						<label class="property-label">Property Name</label>
						<input type="text" class="property-input" id="prop-propertyName" 
							value="${node.config.propertyName || 'hasDonation'}" placeholder="e.g., hasDonation, amount">
						<div class="property-help">Which property to check/sum</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Reset After (seconds)</label>
						<input type="number" class="property-input" id="prop-resetAfterMs" 
							value="${(node.config.resetAfterMs || 0) / 1000}" min="0" step="1">
						<div class="property-help">Auto-reset after inactivity (0 = never)</div>
					</div>
					
					<details style="margin-top: 10px;">
						<summary style="cursor: pointer; color: #888;">Use Cases & Examples</summary>
						<div style="margin-top: 10px; padding: 10px; background: #2a2a2a; border-radius: 4px;">
							<strong>10th Message Reward:</strong> Every 10 messages from a user<br>
							<strong>Donation Goal:</strong> Sum donations until $100 reached<br>
							<strong>Spam Detection:</strong> User sends 5+ messages in 30 seconds<br>
							<strong>Engagement Milestone:</strong> 100 total chat messages<br>
							<strong>Command Cooldown:</strong> Allow command every 3 uses
						</div>
					</details>`;
				break;
			case 'userPool': // User Pool trigger
				html += `
					<div class="property-group">
						<label class="property-label">Pool Name</label>
						<input type="text" class="property-input" id="prop-poolName" 
							value="${node.config.poolName || 'default'}" placeholder="e.g., giveaway, raffle">
						<div class="property-help">Unique identifier for this pool</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Maximum Users</label>
						<input type="number" class="property-input" id="prop-maxUsers" 
							value="${node.config.maxUsers || 10}" min="1" step="1">
						<div class="property-help">Trigger when pool reaches this many users</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">
							<input type="checkbox" id="prop-requireEntry" 
								${node.config.requireEntry !== false ? 'checked' : ''}>
							Require Entry Keyword
						</label>
						<div class="property-help">Users must use keyword to enter pool</div>
					</div>
					
					<div class="property-group" id="pool-keyword-group" style="${node.config.requireEntry !== false ? '' : 'display: none;'}">
						<label class="property-label">Entry Keyword</label>
						<input type="text" class="property-input" id="prop-entryKeyword" 
							value="${node.config.entryKeyword || '!enter'}" placeholder="e.g., !enter, !join">
						<div class="property-help">Keyword users must type to enter pool</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Scope</label>
						<select class="property-input" id="prop-scope">
							<option value="global" ${(!node.config.scope || node.config.scope === 'global') ? 'selected' : ''}>Global (all sources)</option>
							<option value="perSource" ${node.config.scope === 'perSource' ? 'selected' : ''}>Per Source/Channel</option>
						</select>
						<div class="property-help">Track pool globally or per channel</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">
							<input type="checkbox" id="prop-resetOnFull" 
								${node.config.resetOnFull ? 'checked' : ''}>
							Auto-reset when full
						</label>
						<div class="property-help">Clear pool after triggering</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">
							<input type="checkbox" id="prop-allowReentry" 
								${node.config.allowReentry ? 'checked' : ''}>
							Allow Re-entry
						</label>
						<div class="property-help">Let users enter pool multiple times</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Reset After (seconds)</label>
						<input type="number" class="property-input" id="prop-resetAfterMs" 
							value="${(node.config.resetAfterMs || 0) / 1000}" min="0" step="1">
						<div class="property-help">Clear pool after inactivity (0 = never)</div>
					</div>
					
					<details style="margin-top: 10px;">
						<summary style="cursor: pointer; color: #888;">Use Cases & Examples</summary>
						<div style="margin-top: 10px; padding: 10px; background: #2a2a2a; border-radius: 4px;">
							<strong>Giveaway:</strong> 10 users, !enter keyword, reset on full<br>
							<strong>Waiting List:</strong> 5 users, no keyword, per source<br>
							<strong>Team Selection:</strong> 2 teams of 5, different pool names<br>
							<strong>Raffle:</strong> 100 users, !raffle keyword, allow reentry<br>
							<strong>Queue System:</strong> 3 users, !next keyword, auto-reset
						</div>
					</details>`;
				break;
			case 'accumulator': // Accumulator trigger
				html += `
					<div class="property-group">
						<label class="property-label">Accumulator Name</label>
						<input type="text" class="property-input" id="prop-accumulatorName" 
							value="${node.config.accumulatorName || 'default'}" placeholder="e.g., donations, points">
						<div class="property-help">Unique identifier for this accumulator</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Operation</label>
						<select class="property-input" id="prop-operation">
							<option value="sum" ${(!node.config.operation || node.config.operation === 'sum') ? 'selected' : ''}>Sum</option>
							<option value="avg" ${node.config.operation === 'avg' ? 'selected' : ''}>Average</option>
							<option value="max" ${node.config.operation === 'max' ? 'selected' : ''}>Maximum</option>
							<option value="min" ${node.config.operation === 'min' ? 'selected' : ''}>Minimum</option>
							<option value="count" ${node.config.operation === 'count' ? 'selected' : ''}>Count</option>
						</select>
						<div class="property-help">How to accumulate values</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Property Name</label>
						<input type="text" class="property-input" id="prop-propertyName" 
							value="${node.config.propertyName || 'amount'}" placeholder="e.g., amount, donationAmount">
						<div class="property-help">Message property to accumulate</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Trigger Condition</label>
						<div style="display: flex; gap: 10px; align-items: center;">
							<select class="property-input" id="prop-triggerMode" style="width: auto;">
								<option value="gte" ${(!node.config.triggerMode || node.config.triggerMode === 'gte') ? 'selected' : ''}>≥ Greater or equal</option>
								<option value="exact" ${node.config.triggerMode === 'exact' ? 'selected' : ''}>= Exactly equal</option>
								<option value="lte" ${node.config.triggerMode === 'lte' ? 'selected' : ''}>≤ Less or equal</option>
							</select>
							<input type="number" class="property-input" id="prop-threshold" 
								value="${node.config.threshold || 100}" min="0" step="1" style="width: 100px;">
						</div>
						<div class="property-help">Trigger when accumulated value meets condition</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Scope</label>
						<select class="property-input" id="prop-scope">
							<option value="global" ${(!node.config.scope || node.config.scope === 'global') ? 'selected' : ''}>Global (all users)</option>
							<option value="perUser" ${node.config.scope === 'perUser' ? 'selected' : ''}>Per User</option>
							<option value="perSource" ${node.config.scope === 'perSource' ? 'selected' : ''}>Per Source/Channel</option>
							<option value="perUserPerSource" ${node.config.scope === 'perUserPerSource' ? 'selected' : ''}>Per User Per Source</option>
						</select>
						<div class="property-help">Track accumulation globally or separately</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">
							<input type="checkbox" id="prop-autoReset" 
								${node.config.autoReset ? 'checked' : ''}>
							Auto-reset after trigger
						</label>
						<div class="property-help">Reset accumulator to 0 after triggering</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Reset After (seconds)</label>
						<input type="number" class="property-input" id="prop-resetAfterMs" 
							value="${(node.config.resetAfterMs || 0) / 1000}" min="0" step="1">
						<div class="property-help">Auto-reset after inactivity (0 = never)</div>
					</div>
					
					<details style="margin-top: 10px;">
						<summary style="cursor: pointer; color: #888;">Use Cases & Examples</summary>
						<div style="margin-top: 10px; padding: 10px; background: #2a2a2a; border-radius: 4px;">
							<strong>Donation Goal:</strong> Sum donations until $100 reached<br>
							<strong>Average Viewer Time:</strong> Track average time property<br>
							<strong>Peak Viewers:</strong> Track maximum viewer count<br>
							<strong>Minimum Bid:</strong> Track lowest bid amount<br>
							<strong>Total Messages:</strong> Count all messages (operation: count)
						</div>
					</details>`;
				break;
			// --- Custom JS Trigger ---
			case 'customJs': // Assuming 'customJs' can be a trigger, action, or logic type based on context
				if (node.type === 'trigger') {
					 html += `<div class="property-group"><label class="property-label">JavaScript Code</label><textarea class="property-input" id="prop-code" rows="10" spellcheck="false">${node.config.code || 'return message.chatmessage.includes("test");'}</textarea>
							 <div class="property-help">Return true/false. \`message\` object is available.</div></div>`;
				} else if (node.type === 'action') { // Custom JS Action
					 html += `<div class="property-group"><label class="property-label">JavaScript Code</label><textarea class="property-input" id="prop-code" rows="10" spellcheck="false">${node.config.code || 'message.chatmessage += " (edited)";\nreturn { modified: true, message };'}</textarea>
							 <div class="property-help">\`message\` and \`result\` objects are available. Return an object like \`{ modified: boolean, message: object, blocked: boolean }\`.</div></div>`;
				}
				// Potentially add a case for customJs if it were a logic node type
				break;

			// --- Action Cases ---
			case 'blockMessage':
				html += `<p class="property-help">Blocks the message immediately and continues processing downstream actions asynchronously in the background. The message will not be displayed.</p>`;
				break;
			case 'returnMessage':
				html += `<p class="property-help">Returns the message immediately for display, then continues processing downstream actions asynchronously in the background. Use this when you want the message to appear right away while other actions (like delays, OBS toggles) continue running.</p>`;
				break;
			case 'continueAsync':
				html += `<p class="property-help">Forks execution: the rest of this flow continues asynchronously in the background while other flows can proceed. Does not return or block the message - use this when you want parallel processing without affecting message display.</p>`;
				break;
			case 'modifyMessage':
				html += `<div class="property-group"><label class="property-label">New Message Content</label><textarea class="property-input" id="prop-newMessage" rows="3">${node.config.newMessage || ''}</textarea><div class="property-help">Placeholders like {username}, {message}, etc. can be used.</div></div>`;
				break;
			case 'addPrefix':
				html += `<div class="property-group"><label class="property-label">Prefix Text</label><input type="text" class="property-input" id="prop-prefix" value="${node.config.prefix || ''}"><div class="property-help">Text to add before the message. Supports {username}, {source} placeholders.</div></div>`;
				break;
			case 'addSuffix':
				html += `<div class="property-group"><label class="property-label">Suffix Text</label><input type="text" class="property-input" id="prop-suffix" value="${node.config.suffix || ''}"><div class="property-help">Text to add after the message. Supports {username}, {source} placeholders.</div></div>`;
				break;
			case 'findReplace':
				html += `<div class="property-group"><label class="property-label">Find Text</label><input type="text" class="property-input" id="prop-find" value="${node.config.find || ''}"></div>
						 <div class="property-group"><label class="property-label">Replace With</label><input type="text" class="property-input" id="prop-replace" value="${node.config.replace || ''}"></div>
						 <div class="property-group"><label class="property-label"><input type="checkbox" id="prop-caseSensitive" ${node.config.caseSensitive ? 'checked' : ''}> Case Sensitive</label></div>`;
				break;
			case 'removeText':
				html += `<div class="property-group">
							<label class="property-label">Remove Type</label>
							<select class="property-input" id="prop-removeType">
								<option value="removeFirst" ${node.config.removeType === 'removeFirst' ? 'selected' : ''}>Remove First Characters</option>
								<option value="removeCommand" ${node.config.removeType === 'removeCommand' ? 'selected' : ''}>Remove First Word/Command</option>
								<option value="removeUntil" ${node.config.removeType === 'removeUntil' ? 'selected' : ''}>Remove Until Text</option>
								<option value="removePrefix" ${node.config.removeType === 'removePrefix' ? 'selected' : ''}>Remove Specific Prefix</option>
								<option value="trimWhitespace" ${node.config.removeType === 'trimWhitespace' ? 'selected' : ''}>Trim Whitespace</option>
							</select>
							<div class="property-help">Choose how to remove text from the message</div>
						</div>`;
				
				// Show additional fields based on removeType
				if (node.config.removeType === 'removeFirst') {
					html += `<div class="property-group">
								<label class="property-label">Number of Characters</label>
								<input type="number" class="property-input" id="prop-count" value="${node.config.count || 1}" min="1">
								<div class="property-help">How many characters to remove from the start</div>
							</div>`;
				} else if (node.config.removeType === 'removeUntil') {
					html += `<div class="property-group">
								<label class="property-label">Remove Until (and including)</label>
								<input type="text" class="property-input" id="prop-untilText" value="${node.config.untilText || ''}">
								<div class="property-help">Remove everything up to and including this text</div>
							</div>`;
				} else if (node.config.removeType === 'removePrefix') {
					html += `<div class="property-group">
								<label class="property-label">Prefix to Remove</label>
								<input type="text" class="property-input" id="prop-prefix" value="${node.config.prefix || ''}">
								<div class="property-help">Only removes if message starts with this exact text</div>
							</div>`;
				}
				break;
			case 'setProperty': {
				const commonProperties = [
					{ value: 'custom', label: '-- Custom Property --' },
					// Styling
					{ value: 'nameColor', label: 'Name Color', type: 'color' },
					{ value: 'backgroundColor', label: 'Background Color', type: 'color' },
					{ value: 'textColor', label: 'Text Color', type: 'color' },
					// Message basics
					{ value: 'chatmessage', label: 'Chat Message', type: 'text' },
					{ value: 'chatname', label: 'Username (chatname)', type: 'text' },
					{ value: 'type', label: 'Source Type (platform)', type: 'text' },
					{ value: 'sourceName', label: 'Source / Channel Name', type: 'text' },
					{ value: 'userid', label: 'User ID', type: 'text' },
					// Media
					{ value: 'chatimg', label: 'Avatar URL (chatimg)', type: 'url' },
					{ value: 'contentimg', label: 'Content Image / Video (contentimg)', type: 'url' },
					{ value: 'sourceImg', label: 'Source Icon URL', type: 'url' },
					// Event & metadata
					{ value: 'title', label: 'Event Title', type: 'text' },
					{ value: 'subtitle', label: 'Event Subtitle', type: 'text' },
					{ value: 'membership', label: 'Membership Details', type: 'text' },
					{ value: 'hasDonation', label: 'Donation Amount (hasDonation)', type: 'text' },
					{ value: 'event', label: 'Event Flag / Name', type: 'text' },
					// Status flags
					{ value: 'mod', label: 'Is Moderator', type: 'boolean' },
					{ value: 'vip', label: 'Is VIP', type: 'boolean' },
					{ value: 'verified', label: 'Is Verified', type: 'boolean' },
					{ value: 'bot', label: 'Is Bot', type: 'boolean' },
					{ value: 'host', label: 'Is Host', type: 'boolean' },
					{ value: 'admin', label: 'Is Admin', type: 'boolean' },
					{ value: 'question', label: 'Is Question', type: 'boolean' },
					{ value: 'private', label: 'Is Private / DM', type: 'boolean' },
					{ value: 'textonly', label: 'Text-only Message', type: 'boolean' }
				];
				
				const selectedProp = commonProperties.find(p => p.value === node.config.property);
				const isCustom = !selectedProp || node.config.property === 'custom';
				const propType = selectedProp?.type || 'text';
				
				html += `
					<div class="property-group">
						<label class="property-label">Property to Set</label>
						<select class="property-input" id="prop-property-select">
							${commonProperties.map(prop => 
								`<option value="${prop.value}" ${node.config.property === prop.value ? 'selected' : ''}>
									${prop.label}
								</option>`
							).join('')}
						</select>
					</div>
					
					<div class="property-group" id="custom-property-name" style="${isCustom ? '' : 'display: none;'}">
						<label class="property-label">Custom Property Name</label>
						<input type="text" class="property-input" id="prop-property" 
							value="${isCustom ? (node.config.property || '') : ''}" 
							placeholder="e.g., customBadge, priority">
						<div class="property-help">Enter the exact property name</div>
					</div>
					
					<div class="property-group">
						<label class="property-label">Value</label>`;
				
				// Different input types based on property type
				if (propType === 'color' && node.config.property !== 'custom') {
					const colorPresets = [
						{ color: '#FF0000', name: 'Red' },
						{ color: '#00FF00', name: 'Green' },
						{ color: '#0000FF', name: 'Blue' },
						{ color: '#FFFF00', name: 'Yellow' },
						{ color: '#FF00FF', name: 'Magenta' },
						{ color: '#00FFFF', name: 'Cyan' },
						{ color: '#FFA500', name: 'Orange' },
						{ color: '#800080', name: 'Purple' },
						{ color: '#FFC0CB', name: 'Pink' },
						{ color: '#FFFFFF', name: 'White' },
						{ color: '#000000', name: 'Black' },
						{ color: '#808080', name: 'Gray' }
					];
					
					html += `
						<div style="display: flex; gap: 10px; align-items: center;">
							<input type="color" class="property-input" id="prop-value-color" 
								value="${node.config.value?.startsWith('#') ? node.config.value : '#FF0000'}" 
								style="width: 60px; height: 35px;">
							<input type="text" class="property-input" id="prop-value" 
								value="${node.config.value || '#FF0000'}" 
								placeholder="#FF0000 or red or {source}_color"
								style="flex: 1;">
						</div>
						<div class="property-help">Pick a color, use hex code, color name, or template like "{source}_color"</div>
						<div style="margin-top: 10px;">
							<label class="property-label">Quick Colors:</label>
							<div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;">
								${colorPresets.map(preset => 
									`<button type="button" class="color-preset-btn" 
										data-color="${preset.color}" 
										style="background: ${preset.color}; width: 30px; height: 30px; border: 1px solid #555; cursor: pointer; border-radius: 4px;"
										title="${preset.name}"></button>`
								).join('')}
							</div>
						</div>`;
				} else if (propType === 'boolean') {
					html += `
						<select class="property-input" id="prop-value">
							<option value="true" ${node.config.value === true || node.config.value === 'true' ? 'selected' : ''}>True</option>
							<option value="false" ${node.config.value === false || node.config.value === 'false' ? 'selected' : ''}>False</option>
						</select>
						<div class="property-help">Set boolean flag</div>`;
				} else {
					html += `
						<input type="text" class="property-input" id="prop-value" 
							value="${node.config.value || ''}" 
							placeholder="${propType === 'url' ? 'https://example.com/image.png' : 'Enter value or use {username}, {source}, etc.'}">
						<div class="property-help">Can use template variables: {username}, {source}, {message}, {type}</div>`;
				}
				
				html += `</div>
					
					<details style="margin-top: 10px;">
						<summary style="cursor: pointer; color: #888;">Examples & Use Cases</summary>
						<div style="margin-top: 10px; padding: 10px; background: #2a2a2a; border-radius: 4px;">
							<strong>Platform Colors:</strong><br>
							• YouTube → nameColor: #FF0000<br>
							• Twitch → nameColor: #9146FF<br>
							• Discord → nameColor: #5865F2<br><br>
							
							<strong>Role-based Colors:</strong><br>
							• Moderators → backgroundColor: #FFD700<br>
							• VIPs → nameColor: #FF69B4<br>
							• Donors → textColor: #00FF00<br><br>
							
						<strong>Dynamic Values:</strong><br>
						• Property: chatimg<br>
						• Value: https://api.example.com/avatar/{username}.png<br><br>
						
						<strong>Event Metadata:</strong><br>
						• Property: event → Value: raid_start<br>
						• Property: membership → Value: gifted-5<br>
						• Property: contentimg → Value: https://cdn.example.com/alerts/{userid}.png<br><br>
						
						<strong>Conditional Styling:</strong><br>
						• Use with "From Source" trigger<br>
						• Set different colors per platform
					</div>
					</details>`;
				break;
			}
			case 'sendMessage':
				// Send Message allows sending generated messages (e.g., thank you messages, announcements)
				const sendDestinations = [
					{ value: 'reply', label: '↩️ Reply to Source' },
					{ value: 'all', label: '📢 All Platforms (Including Source)' },
					{ value: 'all-except-source', label: '🔄 All Platforms (Excluding Source)' },
					{ value: 'youtube', label: 'YouTube' },
					{ value: 'youtubeshorts', label: 'YouTube Shorts' },
					{ value: 'discord', label: 'Discord' },
					{ value: 'twitch', label: 'Twitch' },
					{ value: 'kick', label: 'Kick' },
					{ value: 'facebook', label: 'Facebook' },
					{ value: 'instagram', label: 'Instagram' },
					{ value: 'instagramlive', label: 'Instagram Live' },
					{ value: 'tiktok', label: 'TikTok' },
					{ value: 'x', label: 'X (Twitter)' },
					{ value: 'rumble', label: 'Rumble' },
					{ value: 'odysee', label: 'Odysee' },
					{ value: 'dlive', label: 'DLive' },
					{ value: 'trovo', label: 'Trovo' },
					{ value: 'telegram', label: 'Telegram' },
					{ value: 'whatsapp', label: 'WhatsApp' },
					{ value: 'zoom', label: 'Zoom' },
					{ value: 'teams', label: 'Teams' },
					{ value: 'slack', label: 'Slack' },
					{ value: 'vimeo', label: 'Vimeo' },
					{ value: 'afreecatv', label: 'AfreecaTV' },
					{ value: 'bigo', label: 'Bigo Live' },
					{ value: 'bilibili', label: 'Bilibili' },
					{ value: 'chzzk', label: 'CHZZK' },
					{ value: 'nicovideo', label: 'Niconico' },
					{ value: 'picarto', label: 'Picarto' },
					{ value: 'chaturbate', label: 'Chaturbate' },
					{ value: 'custom', label: '🔧 Custom...' }
				];
				
				const isCustomSend = node.config.destination && !sendDestinations.find(p => p.value === node.config.destination);
				const currentSendDestination = isCustomSend ? 'custom' : (node.config.destination || 'reply');
				
				html += `<div class="property-group">
							<label class="property-label">Send To</label>
							<select class="property-input" id="prop-destination-select">
								${sendDestinations.map(p => `<option value="${p.value}" ${currentSendDestination === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
							</select>
							<input type="text" class="property-input" id="prop-destination-custom" 
								   value="${isCustomSend ? node.config.destination : ''}" 
								   style="display: ${currentSendDestination === 'custom' ? 'block' : 'none'}; margin-top: 5px;"
								   placeholder="Enter custom destination (e.g., 'arenasocial', 'channel_name')">
                    <div class="property-help">Send generated messages (e.g., "Thank you" for donations, announcements, bot responses).</div>
                </div>
                <div class="property-group"><label class="property-label">Message Template</label><textarea class="property-input" id="prop-template" rows="3">${node.config.template || 'Thank you {username}!'}</textarea><div class="property-help">Use {username}, {message}, {source} placeholders</div></div>
                <div class="property-group"><label class="property-label">Timeout (ms)</label><input type="number" class="property-input" id="prop-timeout" value="${node.config.timeout || 0}"><div class="property-help">Delay before sending (0 for immediate).</div></div>
                <div class="property-help">Destinations: <strong>Reply to Source</strong> posts back only to the originating tab; <strong>All</strong> includes the source; <strong>All (Excluding Source)</strong> prevents posting back to the origin.</div>
                <div class="property-help">Reflections: Sent messages are tagged as reflections when they re‑enter via the extension (to avoid loops). Add a <strong>Reflection Filter</strong> node in this flow to control whether those reflected posts appear in the dock/overlays: <em>Block All</em> hides them, <em>Allow First</em> lets only the first show within the window, <em>Allow All</em> shows all. The filter does not change sending; it only controls display on re‑ingest.</div>`;
				break;
            case 'relay':
                // Relay is for forwarding chat messages to other platforms
				const relayPlatforms = [
					{ value: '', label: 'All Platforms (Excluding Source)' },
					{ value: 'youtube', label: 'YouTube' },
					{ value: 'youtubeshorts', label: 'YouTube Shorts' },
					{ value: 'discord', label: 'Discord' },
					{ value: 'twitch', label: 'Twitch' },
					{ value: 'kick', label: 'Kick' },
					{ value: 'facebook', label: 'Facebook' },
					{ value: 'instagram', label: 'Instagram' },
					{ value: 'instagramlive', label: 'Instagram Live' },
					{ value: 'tiktok', label: 'TikTok' },
					{ value: 'x', label: 'X (Twitter)' },
					{ value: 'rumble', label: 'Rumble' },
					{ value: 'odysee', label: 'Odysee' },
					{ value: 'dlive', label: 'DLive' },
					{ value: 'trovo', label: 'Trovo' },
					{ value: 'telegram', label: 'Telegram' },
					{ value: 'whatsapp', label: 'WhatsApp' },
					{ value: 'zoom', label: 'Zoom' },
					{ value: 'teams', label: 'Teams' },
					{ value: 'slack', label: 'Slack' },
					{ value: 'vimeo', label: 'Vimeo' },
					{ value: 'afreecatv', label: 'AfreecaTV' },
					{ value: 'bigo', label: 'Bigo Live' },
					{ value: 'bilibili', label: 'Bilibili' },
					{ value: 'chzzk', label: 'CHZZK' },
					{ value: 'nicovideo', label: 'Niconico' },
					{ value: 'picarto', label: 'Picarto' },
					{ value: 'chaturbate', label: 'Chaturbate' },
					{ value: 'custom', label: '🔧 Custom...' }
				];
				
				const isCustomRelayDest = node.config.destination && !relayPlatforms.find(p => p.value === node.config.destination);
				const currentDestination = isCustomRelayDest ? 'custom' : (node.config.destination || '');
				
				html += `<div class="property-group">
							<label class="property-label">Relay Destination</label>
							<select class="property-input" id="prop-destination-select">
								${relayPlatforms.map(p => `<option value="${p.value}" ${currentDestination === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
							</select>
							<input type="text" class="property-input" id="prop-destination-custom" 
								   value="${isCustomRelayDest ? node.config.destination : ''}" 
								   style="display: ${currentDestination === 'custom' ? 'block' : 'none'}; margin-top: 5px;"
								   placeholder="Enter custom destination (e.g., 'arenasocial', 'channel_name')">
                    <div class="property-help">Relays chat messages to other platforms. Source is always excluded to prevent loops.</div>
                </div>
                <div class="property-group"><label class="property-label">Message Template</label><textarea class="property-input" id="prop-template" rows="3">${node.config.template || '[{source}] {username}: {message}'}</textarea></div>
                <div class="property-group"><label class="property-label">Timeout (ms)</label><input type="number" class="property-input" id="prop-timeout" value="${node.config.timeout || 0}"><div class="property-help">Delay before sending (0 for immediate).</div></div>
                <div class="property-help">Behavior: Relayed chats are injected to target platform(s) and are tagged as reflections when read back by the extension. They won’t be re‑relayed. To control whether those reflections appear in the dock/overlays, add a <strong>Reflection Filter</strong> node to this flow. The filter doesn’t change what gets relayed; it only decides if the “echo” is shown after it comes back.</div>
                <div class="property-help">Destinations: Default <strong>All Platforms (Excluding Source)</strong> prevents echo loops. When targeting a specific platform, the origin tab is still excluded (using the source tab ID) to avoid posting back to origin.</div>`;
                break;

            case 'reflectionFilter':
                // Reflection control for Event Flow
                {
                    const policy = node.config.policy || 'block-all';
                    const sourceMode = node.config.sourceMode || 'none';
                    const windowMs = node.config.windowMs ?? 10000;
                    const sourceTypesText = (node.config.sourceTypes || '').toString();
                    html += `
                        <div class="property-group">
                            <label class="property-label">Reflection Policy</label>
                            <select class="property-input" id="prop-policy">
                                <option value="block-all" ${policy === 'block-all' ? 'selected' : ''}>Block All Reflections</option>
                                <option value="allow-first" ${policy === 'allow-first' ? 'selected' : ''}>Allow First Only (windowed)</option>
                                <option value="allow-all" ${policy === 'allow-all' ? 'selected' : ''}>Allow All Reflections</option>
                            </select>
                        </div>
                        <div class="property-group" id="reflection-window-group" style="${policy === 'allow-first' ? '' : 'display:none;'}">
                            <label class="property-label">First-Only Window (ms)</label>
                            <input type="number" class="property-input" id="prop-windowMs" value="${windowMs}" min="100" step="100">
                            <div class="property-help">How long to treat the first matching reflection as allowed before blocking repeats.</div>
                        </div>
                        <div class="property-group">
                            <label class="property-label">Source Type Filter</label>
                            <select class="property-input" id="prop-sourceMode">
                                <option value="none" ${sourceMode === 'none' ? 'selected' : ''}>No Source Filter</option>
                                <option value="allow" ${sourceMode === 'allow' ? 'selected' : ''}>Allow Only Listed</option>
                                <option value="block" ${sourceMode === 'block' ? 'selected' : ''}>Block Listed</option>
                            </select>
                            <input type="text" class="property-input" id="prop-sourceTypes" value="${sourceTypesText}" placeholder="Comma-separated types (e.g., youtube,twitch)">
                            <div class="property-help">Type values match message.type (youtube, twitch, kick, discord, etc.).</div>
                        </div>
                        <div class="property-group">
                            <div class="property-help"><strong>How it works with Relay/Send:</strong> This action applies only to <em>reflections</em> — messages previously sent/relayed by this system and then re‑ingested. Place it early in the flow to control dock/overlay visibility of relayed posts: <em>Block All</em> hides every reflection; <em>Allow First</em> shows one per window; <em>Allow All</em> shows all. It does not affect original incoming messages, and it does not change what Relay/Send transmit — those actions already skip when processing reflections.</div>
                            <div class="property-help">Global filters (e.g., “First Source Only”) remain unchanged and apply independently.</div>
                        </div>`;
                }
                break;
			case 'webhook':
				html += `<div class="property-group"><label class="property-label">URL</label><input type="url" class="property-input" id="prop-url" value="${node.config.url || ''}"></div>
						 <div class="property-group"><label class="property-label">Method</label><select class="property-input" id="prop-method">${['POST', 'GET', 'PUT', 'DELETE', 'PATCH'].map(m => `<option value="${m}" ${node.config.method === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
						 <div class="property-group"><label class="property-label"><input type="checkbox" class="property-input" id="prop-includeMessage" ${node.config.includeMessage !== false ? 'checked' : ''}> Include full message object as JSON body</label></div>
						 <div class="property-group" id="webhook-body-group" style="${node.config.includeMessage !== false ? 'display: none;' : ''};"><label class="property-label">Custom Body (JSON)</label><textarea class="property-input" id="prop-body" rows="5">${node.config.body || '{}'}</textarea><div class="property-help">Used if "Include full message" is unchecked.</div></div>
						 <div class="property-group"><label class="property-label"><input type="checkbox" class="property-input" id="prop-syncMode" ${node.config.syncMode ? 'checked' : ''}> Synchronous mode (await webhook)</label><div class="property-help">When enabled, the flow waits for the webhook to finish. With "Block on error" enabled, a non-2xx or network error blocks this message; otherwise it proceeds and attaches any response.</div></div>
						 <div class="property-group"><label class="property-label"><input type="checkbox" class="property-input" id="prop-blockOnFailure" ${node.config.blockOnFailure ? 'checked' : ''}> Block on error (4xx/5xx or network)</label><div class="property-help">If "Synchronous mode" is OFF, the message is never blocked by webhook results. If ON, failures block the message when this is enabled.</div></div>`;
				break;
			case 'addPoints':
				html += `<div class="property-group"><label class="property-label">Amount to Add</label><input type="number" class="property-input" id="prop-amount" value="${node.config.amount || 100}" min="0"></div>`;
				break;
			case 'spendPoints':
				html += `<div class="property-group"><label class="property-label">Amount to Spend</label><input type="number" class="property-input" id="prop-amount" value="${node.config.amount || 100}" min="0"></div>`;
				break;
			
			// --- Logic Node Cases ---
			case 'AND':
				html += `<p class="property-help">This gate outputs TRUE only if all of its connected inputs are TRUE.</p>`;
				// Future enhancement: List connected input nodes.
				break;
			case 'OR':
				html += `<p class="property-help">This gate outputs TRUE if at least one of its connected inputs is TRUE.</p>`;
				// Future enhancement: List connected input nodes.
				break;
			case 'NOT':
				html += `<p class="property-help">This gate inverts its single input. It outputs TRUE if the input is FALSE, and FALSE if the input is TRUE.</p>`;
				break;
			case 'RANDOM':
				html += `<div class="property-group">
					<label class="property-label">Probability (%)</label>
					<input type="number" class="property-input" id="prop-probability" value="${node.config?.probability || 50}" min="0" max="100">
				</div>
				<p class="property-help">This gate randomly passes or blocks the input signal based on the probability. For example, 25% means the signal will pass through roughly 1 in 4 times.</p>`;
				break;
			case 'CHECK_BAD_WORDS':
				html += `
					<div class="property-group" style="background: #ffebee; color: #333; padding: 10px; border-radius: 4px;">
						<strong>🚫 Bad Words Check</strong><br>
						Outputs TRUE if the message contains bad words, FALSE if clean.<br><br>
						<strong>Configure your word list:</strong><br>
						Extension popup → Filter Settings → Blocked Words
					</div>
					<div class="property-group" style="background: #e3f2fd; color: #333; padding: 10px; border-radius: 4px; margin-top: 10px;">
						<strong>💡 Use Case:</strong> Filter song requests<br><br>
						<code>Channel Point Redemption</code> → <code>Check Bad Words</code><br>
						• TRUE path → Block Message<br>
						• FALSE path (via NOT gate) → Add to Queue
					</div>`;
				break;

			// State Node Configurations
			case 'GATE':
				html += `<div class="property-group">
					<label class="property-label">Variable Name</label>
					<input type="text" class="property-input" id="prop-name" value="${node.config?.name || 'Switch 1'}" placeholder="e.g., Scene Active, Cooldown">
					<div class="property-help">Give this switch a meaningful name</div>
				</div>
				<div class="property-group">
					<label class="property-label">Default State</label>
					<select class="property-input" id="prop-defaultState">
						<option value="ALLOW" ${node.config?.defaultState === 'ALLOW' ? 'selected' : ''}>ON (Messages pass)</option>
						<option value="BLOCK" ${node.config?.defaultState === 'BLOCK' ? 'selected' : ''}>OFF (Messages blocked)</option>
					</select>
				</div>
				<p class="property-help">💡 <strong>Simple switch:</strong> ON = messages pass through, OFF = messages stop. Use "Set Gate State" action to flip the switch.</p>`;
				break;
				
			case 'QUEUE':
				html += `<div class="property-group">
					<label class="property-label">Max Queue Size</label>
					<input type="number" class="property-input" id="prop-maxSize" value="${node.config?.maxSize || 10}" min="1">
				</div>
				<div class="property-group">
					<label class="property-label">Overflow Strategy</label>
					<select class="property-input" id="prop-overflowStrategy">
						<option value="DROP_OLDEST" ${node.config?.overflowStrategy === 'DROP_OLDEST' ? 'selected' : ''}>Drop Oldest (Leaky)</option>
						<option value="DROP_NEWEST" ${node.config?.overflowStrategy === 'DROP_NEWEST' ? 'selected' : ''}>Drop Newest</option>
						<option value="DROP_RANDOM" ${node.config?.overflowStrategy === 'DROP_RANDOM' ? 'selected' : ''}>Drop Random</option>
					</select>
				</div>
				<div class="property-group">
					<label class="property-label">Processing Delay (ms)</label>
					<input type="number" class="property-input" id="prop-processingDelayMs" value="${node.config?.processingDelayMs || 1000}" min="0">
				</div>
				<div class="property-group">
					<label class="property-label">Message TTL (ms)</label>
					<input type="number" class="property-input" id="prop-ttlMs" value="${node.config?.ttlMs || 60000}" min="1000">
				</div>
				<div class="property-group">
					<label class="property-label">Auto Dequeue</label>
					<input type="checkbox" class="property-input" id="prop-autoDequeue" ${node.config?.autoDequeue ? 'checked' : ''}>
				</div>
				<p class="property-help">Queues messages and releases them sequentially. Perfect for preventing overlapping animations.</p>`;
				break;
				
			case 'SEMAPHORE':
				html += `<div class="property-group">
					<label class="property-label">Max Concurrent</label>
					<input type="number" class="property-input" id="prop-maxConcurrent" value="${node.config?.maxConcurrent || 1}" min="1">
				</div>
				<div class="property-group">
					<label class="property-label">Timeout (ms, 0 = no timeout)</label>
					<input type="number" class="property-input" id="prop-timeoutMs" value="${node.config?.timeoutMs || 30000}" min="0">
				</div>
				<div class="property-group">
					<label class="property-label">Queue on Overflow</label>
					<input type="checkbox" class="property-input" id="prop-queueOverflow" ${node.config?.queueOverflow ? 'checked' : ''}>
				</div>
				<p class="property-help">Limits how many operations can run simultaneously. E.g., allow only 2 scene effects at once.</p>`;
				break;
				
			case 'LATCH':
				html += `<div class="property-group">
					<label class="property-label">Auto Reset (ms, 0 = manual reset)</label>
					<input type="number" class="property-input" id="prop-autoResetMs" value="${node.config?.autoResetMs || 0}" min="0">
				</div>
				<div class="property-group">
					<label class="property-label">Reset on Flow Reload</label>
					<input type="checkbox" class="property-input" id="prop-resetOnFlow" ${node.config?.resetOnFlow ? 'checked' : ''}>
				</div>
				<p class="property-help">Triggers once and stays triggered until reset. Useful for one-shot events.</p>`;
				break;
				
			case 'THROTTLE':
				html += `<div class="property-group">
					<label class="property-label">Messages Per Second</label>
					<input type="number" class="property-input" id="prop-messagesPerSecond" value="${node.config?.messagesPerSecond || 1}" min="0.1" step="0.1">
				</div>
				<div class="property-group">
					<label class="property-label">Burst Size</label>
					<input type="number" class="property-input" id="prop-burstSize" value="${node.config?.burstSize || 1}" min="1">
				</div>
				<div class="property-group">
					<label class="property-label">Drop Strategy</label>
					<select class="property-input" id="prop-dropStrategy">
						<option value="DROP_NEWEST" ${node.config?.dropStrategy === 'DROP_NEWEST' ? 'selected' : ''}>Drop Newest</option>
						<option value="DROP_OLDEST" ${node.config?.dropStrategy === 'DROP_OLDEST' ? 'selected' : ''}>Drop Oldest</option>
					</select>
				</div>
				<p class="property-help">Limits message rate. Prevents spam and controls flow speed.</p>`;
				break;
				
			case 'SEQUENCER':
				html += `<div class="property-group">
					<label class="property-label">Sequence Delay (ms)</label>
					<input type="number" class="property-input" id="prop-sequenceDelayMs" value="${node.config?.sequenceDelayMs || 1000}" min="0">
				</div>
				<div class="property-group">
					<label class="property-label">Reset on Timeout</label>
					<input type="checkbox" class="property-input" id="prop-resetOnTimeout" ${node.config?.resetOnTimeout ? 'checked' : ''}>
				</div>
				<div class="property-group">
					<label class="property-label">Timeout (ms)</label>
					<input type="number" class="property-input" id="prop-timeoutMs" value="${node.config?.timeoutMs || 60000}" min="1000">
				</div>
				<p class="property-help">Enforces sequential execution with delays. Good for step-by-step processes.</p>`;
				break;
				
			case 'COUNTER':
				html += `<div class="property-group">
					<label class="property-label">Variable Name</label>
					<input type="text" class="property-input" id="prop-name" value="${node.config?.name || 'Counter 1'}" placeholder="e.g., Hello Count, Points">
					<div class="property-help">Give this counter a meaningful name</div>
				</div>
				<div class="property-group">
					<label class="property-label">Trigger at Count</label>
					<input type="number" class="property-input" id="prop-targetCount" value="${node.config?.targetCount || 5}">
					<div class="property-help">Activates connected nodes when this number is reached</div>
				</div>
				<div class="property-group">
					<label class="property-label">Auto-Reset</label>
					<input type="checkbox" class="property-input" id="prop-resetOnTarget" ${node.config?.resetOnTarget ? 'checked' : ''}>
					<div class="property-help">Start over from 0 after triggering</div>
				</div>
				<p class="property-help">💡 <strong>Simple counter:</strong> Counts up by 1 each time a message passes. Triggers at your target number. Example: "Every 5th !hello"</p>`;
				break;
				case 'playTenorGiphy': // This is node.actionType if node.type is 'action'
					html += `<div class="property-group">
							 <label class="property-label">Media URL (TENOR/GIPHY)</label>
							 <div style="display: flex; gap: 5px;">
								 <input type="url" class="property-input" id="prop-mediaUrl" value="${node.config.mediaUrl || ''}" style="flex: 1;">
								 <button type="button" id="uploadMediaBtn" style="padding: 5px 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Upload</button>
							 </div>
							 <div class="property-help">Direct URL to the GIF or video. For GIPHY, use the embed link or direct GIF link.</div>
						 </div>
						 <div class="property-group">
							 <label class="property-label">Media Type</label>
							 <select class="property-input" id="prop-mediaType">
								 <option value="iframe" ${node.config.mediaType === 'iframe' ? 'selected' : ''}>Video/Embed (iframe)</option>
								 <option value="image" ${node.config.mediaType === 'image' ? 'selected' : ''}>Image (direct GIF/image link)</option>
							 </select>
						 </div>
						 <div class="property-group">
							<label class="property-label">Duration (ms, 0 for manual close)</label>
							<input type="number" class="property-input" id="prop-duration" value="${node.config.duration || 10000}" min="0">
							<div class="property-help">How long the media stays on screen. 0 means it stays until the next 'play_media' action or manual intervention.</div>
						</div>
						<div class="property-group">
							<label class="property-label">Position and Size (0–100)</label>
							<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: center;">
								<div>
									<label style="display:block; font-size: 12px; opacity: 0.8;">Width (%)</label>
									<input type="number" class="property-input" id="prop-width" value="${(node.config.width ?? 100)}" min="0" max="100">
								</div>
								<div>
									<label style="display:block; font-size: 12px; opacity: 0.8;">Height (%)</label>
									<input type="number" class="property-input" id="prop-height" value="${(node.config.height ?? 100)}" min="0" max="100">
								</div>
								<div>
									<label style="display:block; font-size: 12px; opacity: 0.8;">X (%)</label>
									<input type="number" class="property-input" id="prop-x" value="${(node.config.x ?? 0)}" min="0" max="100">
								</div>
								<div>
									<label style="display:block; font-size: 12px; opacity: 0.8;">Y (%)</label>
									<input type="number" class="property-input" id="prop-y" value="${(node.config.y ?? 0)}" min="0" max="100">
								</div>
							</div>
							<div style="display:flex; gap: 16px; margin-top: 8px;">
								<label style="display:flex; align-items:center; gap:6px;">
									<input type="checkbox" class="property-input" id="prop-randomX" ${node.config.randomX ? 'checked' : ''}>
									<span>Randomize X</span>
								</label>
								<label style="display:flex; align-items:center; gap:6px;">
									<input type="checkbox" class="property-input" id="prop-randomY" ${node.config.randomY ? 'checked' : ''}>
									<span>Randomize Y</span>
								</label>
							</div>
							<div class="property-help">Percent values are relative to the page. Randomize X/Y keeps the media within bounds based on its width/height.</div>
						</div>
						<div class="property-group">
							<label style="display:flex; align-items:center; gap:6px;">
								<input type="checkbox" class="property-input" id="prop-useLayer" ${node.config.useLayer ? 'checked' : ''}>
								<span>Use Layer System</span>
							</label>
							<div class="property-help">Enable to display on the media layer (allows simultaneous avatar/text overlays)</div>
						</div>
						<div class="property-group">
							<label style="display:flex; align-items:center; gap:6px;">
								<input type="checkbox" class="property-input" id="prop-clearFirst" ${node.config.clearFirst !== false ? 'checked' : ''}>
								<span>Clear Layer First</span>
							</label>
							<div class="property-help">Clear existing media before showing new content</div>
						</div>`;
					break;

			case 'showAvatar':
				html += `<div class="property-group">
						 <label class="property-label">Avatar URL (optional)</label>
						 <input type="url" class="property-input" id="prop-avatarUrl" value="${node.config.avatarUrl || ''}" placeholder="Leave empty to use message avatar">
						 <div class="property-help">Override the avatar image. Leave empty to use the sender's avatar (chatimg).</div>
					 </div>
					 <div class="property-group">
						<label class="property-label">Position and Size (%)</label>
						<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: center;">
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Width (%)</label>
								<input type="number" class="property-input" id="prop-width" value="${(node.config.width ?? 15)}" min="1" max="100">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Height (%)</label>
								<input type="number" class="property-input" id="prop-height" value="${(node.config.height ?? 15)}" min="1" max="100">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">X (%)</label>
								<input type="number" class="property-input" id="prop-x" value="${(node.config.x ?? 5)}" min="0" max="100">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Y (%)</label>
								<input type="number" class="property-input" id="prop-y" value="${(node.config.y ?? 5)}" min="0" max="100">
							</div>
						</div>
						<div style="display:flex; gap: 16px; margin-top: 8px;">
							<label style="display:flex; align-items:center; gap:6px;">
								<input type="checkbox" class="property-input" id="prop-randomX" ${node.config.randomX ? 'checked' : ''}>
								<span>Randomize X</span>
							</label>
							<label style="display:flex; align-items:center; gap:6px;">
								<input type="checkbox" class="property-input" id="prop-randomY" ${node.config.randomY ? 'checked' : ''}>
								<span>Randomize Y</span>
							</label>
						</div>
					</div>
					<div class="property-group">
						<label class="property-label">Appearance</label>
						<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: center;">
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Border Radius (%)</label>
								<input type="number" class="property-input" id="prop-borderRadius" value="${(node.config.borderRadius ?? 50)}" min="0" max="50">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Border Width (px)</label>
								<input type="number" class="property-input" id="prop-borderWidth" value="${(node.config.borderWidth ?? 3)}" min="0" max="20">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Border Color</label>
								<input type="color" class="property-input" id="prop-borderColor" value="${node.config.borderColor || '#ffffff'}">
							</div>
							<div>
								<label style="display:flex; align-items:center; gap:6px; margin-top: 16px;">
									<input type="checkbox" class="property-input" id="prop-shadow" ${node.config.shadow !== false ? 'checked' : ''}>
									<span>Drop Shadow</span>
								</label>
							</div>
						</div>
						<div class="property-help">50% border radius = circle</div>
					</div>
					<div class="property-group">
						<label class="property-label">Duration (ms, 0 = stay until cleared)</label>
						<input type="number" class="property-input" id="prop-duration" value="${node.config.duration || 5000}" min="0" step="100">
					</div>
					<div class="property-group">
						<label style="display:flex; align-items:center; gap:6px;">
							<input type="checkbox" class="property-input" id="prop-clearFirst" ${node.config.clearFirst ? 'checked' : ''}>
							<span>Clear Avatar Layer First</span>
						</label>
					</div>`;
				break;

			case 'showText':
				html += `<div class="property-group">
						 <label class="property-label">Text</label>
						 <textarea class="property-input" id="prop-text" rows="3" style="resize: vertical;">${node.config.text || 'Hello {username}!'}</textarea>
						 <div class="property-help">Use placeholders: {username}, {message}, {source}, {donation}</div>
					 </div>
					 <div class="property-group">
						<label class="property-label">Position (%)</label>
						<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: center;">
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">X (%)</label>
								<input type="number" class="property-input" id="prop-x" value="${(node.config.x ?? 50)}" min="0" max="100">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Y (%)</label>
								<input type="number" class="property-input" id="prop-y" value="${(node.config.y ?? 50)}" min="0" max="100">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Max Width (%)</label>
								<input type="number" class="property-input" id="prop-width" value="${(node.config.width ?? 80)}" min="1" max="100">
							</div>
						</div>
					</div>
					<div class="property-group">
						<label class="property-label">Font</label>
						<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: center;">
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Size (px)</label>
								<input type="number" class="property-input" id="prop-fontSize" value="${(node.config.fontSize ?? 48)}" min="8" max="200">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Weight</label>
								<select class="property-input" id="prop-fontWeight">
									<option value="normal" ${node.config.fontWeight === 'normal' ? 'selected' : ''}>Normal</option>
									<option value="bold" ${node.config.fontWeight === 'bold' ? 'selected' : ''}>Bold</option>
									<option value="100" ${node.config.fontWeight === '100' ? 'selected' : ''}>100</option>
									<option value="300" ${node.config.fontWeight === '300' ? 'selected' : ''}>300</option>
									<option value="500" ${node.config.fontWeight === '500' ? 'selected' : ''}>500</option>
									<option value="700" ${node.config.fontWeight === '700' ? 'selected' : ''}>700</option>
									<option value="900" ${node.config.fontWeight === '900' ? 'selected' : ''}>900</option>
								</select>
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Family</label>
								<input type="text" class="property-input" id="prop-fontFamily" value="${node.config.fontFamily || 'Arial'}">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Align</label>
								<select class="property-input" id="prop-textAlign">
									<option value="left" ${node.config.textAlign === 'left' ? 'selected' : ''}>Left</option>
									<option value="center" ${node.config.textAlign === 'center' ? 'selected' : ''}>Center</option>
									<option value="right" ${node.config.textAlign === 'right' ? 'selected' : ''}>Right</option>
								</select>
							</div>
						</div>
					</div>
					<div class="property-group">
						<label class="property-label">Colors</label>
						<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: center;">
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Text Color</label>
								<input type="color" class="property-input" id="prop-color" value="${node.config.color || '#ffffff'}">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Outline Color</label>
								<input type="color" class="property-input" id="prop-outlineColor" value="${node.config.outlineColor || '#000000'}">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Outline Width (px)</label>
								<input type="number" class="property-input" id="prop-outlineWidth" value="${(node.config.outlineWidth ?? 2)}" min="0" max="20">
							</div>
						</div>
					</div>
					<div class="property-group">
						<label class="property-label">Background</label>
						<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: center;">
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Background</label>
								<input type="text" class="property-input" id="prop-backgroundColor" value="${node.config.backgroundColor || 'rgba(0,0,0,0.5)'}" placeholder="rgba(0,0,0,0.5) or transparent">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Padding (px)</label>
								<input type="number" class="property-input" id="prop-padding" value="${(node.config.padding ?? 20)}" min="0" max="100">
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Border Radius (px)</label>
								<input type="number" class="property-input" id="prop-borderRadius" value="${(node.config.borderRadius ?? 10)}" min="0" max="50">
							</div>
						</div>
					</div>
					<div class="property-group">
						<label class="property-label">Animation</label>
						<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: center;">
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Effect</label>
								<select class="property-input" id="prop-animation">
									<option value="none" ${node.config.animation === 'none' ? 'selected' : ''}>None</option>
									<option value="fadeIn" ${node.config.animation === 'fadeIn' ? 'selected' : ''}>Fade In</option>
									<option value="slideInLeft" ${node.config.animation === 'slideInLeft' ? 'selected' : ''}>Slide In Left</option>
									<option value="slideInRight" ${node.config.animation === 'slideInRight' ? 'selected' : ''}>Slide In Right</option>
									<option value="slideInTop" ${node.config.animation === 'slideInTop' ? 'selected' : ''}>Slide In Top</option>
									<option value="slideInBottom" ${node.config.animation === 'slideInBottom' ? 'selected' : ''}>Slide In Bottom</option>
									<option value="bounce" ${node.config.animation === 'bounce' ? 'selected' : ''}>Bounce</option>
									<option value="pulse" ${node.config.animation === 'pulse' ? 'selected' : ''}>Pulse</option>
									<option value="shake" ${node.config.animation === 'shake' ? 'selected' : ''}>Shake</option>
								</select>
							</div>
							<div>
								<label style="display:block; font-size: 12px; opacity: 0.8;">Animation Duration (ms)</label>
								<input type="number" class="property-input" id="prop-animationDuration" value="${(node.config.animationDuration ?? 500)}" min="0" max="5000" step="100">
							</div>
						</div>
					</div>
					<div class="property-group">
						<label class="property-label">Duration (ms, 0 = stay until cleared)</label>
						<input type="number" class="property-input" id="prop-duration" value="${node.config.duration || 5000}" min="0" step="100">
					</div>
					<div class="property-group">
						<label style="display:flex; align-items:center; gap:6px;">
							<input type="checkbox" class="property-input" id="prop-clearFirst" ${node.config.clearFirst ? 'checked' : ''}>
							<span>Clear Text Layer First</span>
						</label>
					</div>`;
				break;

			case 'clearLayer':
				html += `<div class="property-group">
						 <label class="property-label">Layer to Clear</label>
						 <select class="property-input" id="prop-layer">
							 <option value="all" ${node.config.layer === 'all' ? 'selected' : ''}>All Layers</option>
							 <option value="avatar" ${node.config.layer === 'avatar' ? 'selected' : ''}>Avatar Layer</option>
							 <option value="media" ${node.config.layer === 'media' ? 'selected' : ''}>Media Layer</option>
							 <option value="text" ${node.config.layer === 'text' ? 'selected' : ''}>Text Layer</option>
						 </select>
						 <div class="property-help">Choose which overlay layer(s) to clear.</div>
					 </div>`;
				break;

			case 'triggerOBSScene':
				html += `<div class="property-group">
							 <label class="property-label">OBS Scene Name</label>
							 <input type="text" class="property-input" id="prop-sceneName" value="${node.config.sceneName || ''}">
							 <div class="property-help">The exact name of the OBS scene to switch to.</div>
						 </div>`;
				break;

			case 'delay':
				html += `<div class="property-group">
							 <label class="property-label">Delay Time (milliseconds)</label>
							 <input type="number" class="property-input" id="prop-delayMs" value="${node.config.delayMs || 1000}" min="0" step="100">
							 <div class="property-help">Delays the message by the specified time before continuing. 1000ms = 1 second.</div>
						 </div>`;
				break;
			
			// OBS Browser Source API Actions
			case 'obsChangeScene':
				html += `
					<div class="property-group">
						<label class="property-label">Scene Name</label>
						<input type="text" class="property-input" id="prop-sceneName" 
							value="${node.config.sceneName || ''}" placeholder="e.g., Game Scene, Starting Soon">
						<div class="property-help">The exact name of the OBS scene to switch to</div>
					</div>
					<div class="property-group" style="background: #ff9800; color: #333; padding: 10px; border-radius: 4px;">
						<strong>⚠️ OBS Permission Required:</strong><br>
						Set your Browser Source permissions to "Advanced Access Level" to enable OBS control.
					</div>`;
				break;
				
			case 'obsToggleSource':
				html += `
					<div class="property-group">
						<label class="property-label">Source Name</label>
						<input type="text" class="property-input" id="prop-sourceName" 
							value="${node.config.sourceName || ''}" placeholder="e.g., Webcam, Alert Box">
						<div class="property-help">The exact name of the OBS source to toggle</div>
					</div>
					<div class="property-group">
						<label class="property-label">Visibility</label>
						<select class="property-input" id="prop-visible">
							<option value="toggle" ${node.config.visible === 'toggle' ? 'selected' : ''}>Toggle</option>
							<option value="true" ${node.config.visible === true || node.config.visible === 'true' ? 'selected' : ''}>Show</option>
							<option value="false" ${node.config.visible === false || node.config.visible === 'false' ? 'selected' : ''}>Hide</option>
						</select>
						<div class="property-help">Set whether to show, hide, or toggle the source</div>
					</div>
					<div class="property-group" style="background: #2196F3; color: #fff; padding: 10px; border-radius: 4px;">
						<strong>ℹ️ Requires OBS WebSocket:</strong><br>
						1. Enable in OBS: Tools → WebSocket Server Settings<br>
						2. Note your password (required by OBS)<br>
						3. Add to actions.html URL: <code>&obspw=yourpassword</code><br>
						Example: <code>actions.html?session=test&obspw=abc123</code>
					</div>`;
				break;
				
			case 'obsSetSourceFilter':
				html += `
					<div class="property-group">
						<label class="property-label">Source Name</label>
						<input type="text" class="property-input" id="prop-sourceName" 
							value="${node.config.sourceName || ''}" placeholder="e.g., Webcam, Game Capture">
						<div class="property-help">The source that has the filter</div>
					</div>
					<div class="property-group">
						<label class="property-label">Filter Name</label>
						<input type="text" class="property-input" id="prop-filterName" 
							value="${node.config.filterName || ''}" placeholder="e.g., Color Correction, Blur">
						<div class="property-help">The exact name of the filter to toggle</div>
					</div>
					<div class="property-group">
						<label class="property-label">State</label>
						<select class="property-input" id="prop-enabled">
							<option value="toggle" ${node.config.enabled === 'toggle' ? 'selected' : ''}>Toggle</option>
							<option value="true" ${node.config.enabled === true || node.config.enabled === 'true' ? 'selected' : ''}>Enable</option>
							<option value="false" ${node.config.enabled === false || node.config.enabled === 'false' ? 'selected' : ''}>Disable</option>
						</select>
					</div>
					<div class="property-group" style="background: #2196F3; color: #fff; padding: 10px; border-radius: 4px;">
						<strong>ℹ️ Requires OBS WebSocket:</strong><br>
						1. Enable in OBS: Tools → WebSocket Server Settings<br>
						2. Add password to actions.html URL: <code>&obspw=yourpassword</code>
					</div>`;
				break;
				
			case 'obsMuteSource':
				html += `
					<div class="property-group">
						<label class="property-label">Audio Source Name</label>
						<input type="text" class="property-input" id="prop-sourceName" 
							value="${node.config.sourceName || ''}" placeholder="e.g., Mic/Aux, Desktop Audio">
						<div class="property-help">The exact name of the audio source</div>
					</div>
					<div class="property-group">
						<label class="property-label">Mute State</label>
						<select class="property-input" id="prop-muted">
							<option value="toggle" ${node.config.muted === 'toggle' ? 'selected' : ''}>Toggle</option>
							<option value="true" ${node.config.muted === true || node.config.muted === 'true' ? 'selected' : ''}>Mute</option>
							<option value="false" ${node.config.muted === false || node.config.muted === 'false' ? 'selected' : ''}>Unmute</option>
						</select>
					</div>
					<div class="property-group" style="background: #2196F3; color: #fff; padding: 10px; border-radius: 4px;">
						<strong>ℹ️ Requires OBS WebSocket:</strong><br>
						1. Enable in OBS: Tools → WebSocket Server Settings<br>
						2. Add password to actions.html URL: <code>&obspw=yourpassword</code>
					</div>`;
				break;
				
			case 'obsStartRecording':
				html += `
					<div class="property-group">
						<div class="property-help">Starts recording in OBS. Make sure recording is configured in OBS settings.</div>
					</div>
					<div class="property-group" style="background: #ff9800; color: #333; padding: 10px; border-radius: 4px;">
						<strong>⚠️ OBS Permission Required:</strong><br>
						Browser Source needs "Advanced Access Level" permissions.
					</div>`;
				break;
				
			case 'obsStopRecording':
				html += `
					<div class="property-group">
						<div class="property-help">Stops the current recording in OBS.</div>
					</div>
					<div class="property-group" style="background: #ff9800; color: #333; padding: 10px; border-radius: 4px;">
						<strong>⚠️ OBS Permission Required:</strong><br>
						Browser Source needs "Advanced Access Level" permissions.
					</div>`;
				break;
				
			case 'obsStartStreaming':
				html += `
					<div class="property-group">
						<div class="property-help">Starts streaming in OBS. Make sure stream settings are configured.</div>
					</div>
					<div class="property-group" style="background: #ff9800; color: #333; padding: 10px; border-radius: 4px;">
						<strong>⚠️ OBS Permission Required:</strong><br>
						Browser Source needs "Advanced Access Level" permissions.
					</div>`;
				break;
				
			case 'obsStopStreaming':
				html += `
					<div class="property-group">
						<div class="property-help">Stops the current stream in OBS.</div>
					</div>
					<div class="property-group" style="background: #ff9800; color: #333; padding: 10px; border-radius: 4px;">
						<strong>⚠️ OBS Permission Required:</strong><br>
						Browser Source needs "Advanced Access Level" permissions.
					</div>`;
				break;
				
			case 'obsReplayBuffer':
				html += `
					<div class="property-group">
						<div class="property-help">Saves the replay buffer. Replay buffer must be enabled and running in OBS.</div>
					</div>
					<div class="property-group" style="background: #ff9800; color: #333; padding: 10px; border-radius: 4px;">
						<strong>⚠️ OBS Permission Required:</strong><br>
						Browser Source needs "Advanced Access Level" permissions.
					</div>
					<div class="property-group" style="background: #4CAF50; color: #fff; padding: 10px; border-radius: 4px;">
						<strong>💡 Tip:</strong> Perfect for saving highlight moments triggered by donations or special messages!
					</div>`;
				break;

			// Spotify Actions
			case 'spotifySkip':
				html += `
					<div class="property-group">
						<div class="property-help">Skips to the next track in the current playlist or queue.</div>
					</div>
					<div class="property-group" style="background: #1DB954; padding: 10px; border-radius: 4px; color: white;">
						<strong>🎵 Spotify Integration:</strong><br>
						Requires Spotify to be connected in Social Stream settings with playback permissions.
					</div>`;
				break;

			case 'spotifyPrevious':
				html += `
					<div class="property-group">
						<div class="property-help">Goes back to the previous track.</div>
					</div>
					<div class="property-group" style="background: #1DB954; padding: 10px; border-radius: 4px; color: white;">
						<strong>🎵 Spotify Integration:</strong><br>
						Requires Spotify to be connected in Social Stream settings with playback permissions.
					</div>`;
				break;

			case 'spotifyPause':
				html += `
					<div class="property-group">
						<div class="property-help">Pauses the current playback.</div>
					</div>
					<div class="property-group" style="background: #1DB954; padding: 10px; border-radius: 4px; color: white;">
						<strong>🎵 Spotify Integration:</strong><br>
						Requires Spotify to be connected in Social Stream settings with playback permissions.
					</div>`;
				break;

			case 'spotifyResume':
				html += `
					<div class="property-group">
						<div class="property-help">Resumes playback if paused.</div>
					</div>
					<div class="property-group" style="background: #1DB954; padding: 10px; border-radius: 4px; color: white;">
						<strong>🎵 Spotify Integration:</strong><br>
						Requires Spotify to be connected in Social Stream settings with playback permissions.
					</div>`;
				break;

			case 'spotifyVolume':
				html += `
					<div class="property-group">
						<label class="property-label">Volume Level</label>
						<input type="range" class="property-input" id="prop-volume"
							value="${node.config.volume || 50}" min="0" max="100" step="5"
							oninput="document.getElementById('volume-display').textContent = this.value + '%'">
						<div style="text-align: center; margin-top: 5px;">
							<span id="volume-display">${node.config.volume || 50}%</span>
						</div>
						<div class="property-help">Set the playback volume (0-100%)</div>
					</div>
					<div class="property-group" style="background: #1DB954; padding: 10px; border-radius: 4px; color: white;">
						<strong>🎵 Spotify Integration:</strong><br>
						Requires Spotify to be connected in Social Stream settings with playback permissions.
					</div>`;
				break;

			case 'spotifyQueue':
				html += `
					<div class="property-group">
						<label class="property-label">Song Search Query</label>
						<input type="text" class="property-input" id="prop-query"
							value="${node.config.query || ''}" placeholder="e.g., Never Gonna Give You Up">
						<div class="property-help">Enter a song name, artist, or both. The top search result will be added to the queue.</div>
					</div>
					<div class="property-group">
						<label class="property-label">
							<input type="checkbox" class="property-input" id="prop-useMessageText"
								${node.config.useMessageText ? 'checked' : ''}>
							Use chat message as search query
						</label>
						<div class="property-help">If checked, the triggering chat message will be used as the song search query instead of the text above.</div>
					</div>
					<div class="property-group" style="background: #1DB954; padding: 10px; border-radius: 4px; color: white;">
						<strong>🎵 Spotify Integration:</strong><br>
						Requires Spotify to be connected in Social Stream settings with playback permissions.
					</div>
					<div class="property-group" style="background: #2196F3; color: #fff; padding: 10px; border-radius: 4px;">
						<strong>💡 Tip:</strong> Combine with a "Message Starts With" trigger (e.g., "!sr") to let viewers request songs!
					</div>`;
				break;

			case 'spotifyToggle':
				html += `
					<div class="property-group">
						<div class="property-help">Toggles between play and pause based on current playback state.</div>
					</div>
					<div class="property-group" style="background: #1DB954; padding: 10px; border-radius: 4px; color: white;">
						<strong>🎵 Spotify Integration:</strong><br>
						Requires Spotify to be connected in Social Stream settings with playback permissions.
					</div>
					<div class="property-group" style="background: #2196F3; color: #fff; padding: 10px; border-radius: 4px;">
						<strong>💡 Tip:</strong> Great for a "!pause" command that toggles playback!
					</div>`;
				break;

			case 'spotifyNowPlaying':
				html += `
					<div class="property-group">
						<label class="property-label">Announcement Format</label>
						<input type="text" class="property-input" id="prop-format"
							value="${this.escapeHtml(node.config.format || '')}" placeholder="🎵 Now playing: {song} by {artist}">
						<div class="property-help">
							Use placeholders: <code>{song}</code>, <code>{artist}</code>, <code>{album}</code>
						</div>
					</div>
					<div class="property-group">
						<label class="property-label">
							<input type="checkbox" class="property-input" id="prop-sendToDock"
								${node.config.sendToDock !== false ? 'checked' : ''}>
							Send to dock/overlay
						</label>
						<div class="property-help">Sends the announcement to the dock as a chat message.</div>
					</div>
					<div class="property-group" style="background: #1DB954; padding: 10px; border-radius: 4px; color: white;">
						<strong>🎵 Spotify Integration:</strong><br>
						Requires Spotify to be connected in Social Stream settings.
					</div>
					<div class="property-group" style="background: #2196F3; color: #fff; padding: 10px; border-radius: 4px;">
						<strong>💡 Tip:</strong> Create a custom "!song" response with your own format!
					</div>`;
				break;

			case 'spotifyShuffle':
				html += `
					<div class="property-group">
						<label class="property-label">Shuffle Mode</label>
						<select class="property-input" id="prop-state">
							<option value="toggle" ${!node.config.state || node.config.state === 'toggle' ? 'selected' : ''}>Toggle (flip current state)</option>
							<option value="true" ${node.config.state === 'true' || node.config.state === true ? 'selected' : ''}>Enable shuffle</option>
							<option value="false" ${node.config.state === 'false' || node.config.state === false ? 'selected' : ''}>Disable shuffle</option>
						</select>
						<div class="property-help">Choose whether to toggle, enable, or disable shuffle mode.</div>
					</div>
					<div class="property-group" style="background: #1DB954; padding: 10px; border-radius: 4px; color: white;">
						<strong>🎵 Spotify Integration:</strong><br>
						Requires Spotify to be connected in Social Stream settings with playback permissions.
					</div>`;
				break;

			case 'spotifyRepeat':
				html += `
					<div class="property-group">
						<label class="property-label">Repeat Mode</label>
						<select class="property-input" id="prop-mode">
							<option value="off" ${!node.config.mode || node.config.mode === 'off' ? 'selected' : ''}>Off (no repeat)</option>
							<option value="track" ${node.config.mode === 'track' ? 'selected' : ''}>Repeat Track (loop current song)</option>
							<option value="context" ${node.config.mode === 'context' ? 'selected' : ''}>Repeat Playlist (loop playlist/album)</option>
						</select>
						<div class="property-help">Set the repeat mode for playback.</div>
					</div>
					<div class="property-group" style="background: #1DB954; padding: 10px; border-radius: 4px; color: white;">
						<strong>🎵 Spotify Integration:</strong><br>
						Requires Spotify to be connected in Social Stream settings with playback permissions.
					</div>`;
				break;

			// TTS Actions
			case 'ttsSpeak':
				html += `
					<div class="property-group">
						<label class="property-label">Text to Speak</label>
						<textarea class="property-input" id="prop-text" rows="3" placeholder="Enter text to speak...">${node.config.text || ''}</textarea>
						<div class="property-help">The text that will be spoken aloud</div>
					</div>
					<div class="property-group">
						<label class="property-label">
							<input type="checkbox" class="property-input" id="prop-useMessageText"
								${node.config.useMessageText ? 'checked' : ''}>
							Use chat message as text
						</label>
						<div class="property-help">If checked, the triggering chat message will be spoken instead of the text above.</div>
					</div>
					<div class="property-group">
						<label class="property-label">
							<input type="checkbox" class="property-input" id="prop-force"
								${node.config.force ? 'checked' : ''}>
							Force speak (even if TTS is disabled)
						</label>
						<div class="property-help">Will speak even when TTS is globally disabled.</div>
					</div>
					<div class="property-group" style="background: #9C27B0; padding: 10px; border-radius: 4px; color: white;">
						<strong>🔊 TTS Integration:</strong><br>
						Requires TTS to be enabled on the actions.html overlay page.
					</div>`;
				break;

			case 'ttsToggle':
				html += `
					<div class="property-group">
						<label class="property-label">TTS State</label>
						<select class="property-input" id="prop-enabled">
							<option value="toggle" ${node.config.enabled === 'toggle' || node.config.enabled === undefined ? 'selected' : ''}>Toggle</option>
							<option value="true" ${node.config.enabled === true || node.config.enabled === 'true' ? 'selected' : ''}>Enable</option>
							<option value="false" ${node.config.enabled === false || node.config.enabled === 'false' ? 'selected' : ''}>Disable</option>
						</select>
						<div class="property-help">Enable, disable, or toggle TTS on the actions overlay.</div>
					</div>`;
				break;

			case 'ttsSkip':
				html += `
					<div class="property-group">
						<div class="property-help">Skips the currently speaking TTS message and moves to the next in queue.</div>
					</div>
					<div class="property-group" style="background: #9C27B0; padding: 10px; border-radius: 4px; color: white;">
						<strong>🔊 TTS Integration:</strong><br>
						Requires TTS to be enabled on the actions.html overlay page.
					</div>`;
				break;

			case 'ttsClear':
				html += `
					<div class="property-group">
						<div class="property-help">Clears all queued TTS messages. The current message will finish playing.</div>
					</div>
					<div class="property-group" style="background: #9C27B0; padding: 10px; border-radius: 4px; color: white;">
						<strong>🔊 TTS Integration:</strong><br>
						Requires TTS to be enabled on the actions.html overlay page.
					</div>`;
				break;

			case 'ttsVolume':
				html += `
					<div class="property-group">
						<label class="property-label">Volume Level</label>
						<input type="range" class="property-input" id="prop-volume"
							value="${node.config.volume ?? 100}" min="0" max="100" step="5"
							oninput="document.getElementById('tts-volume-display').textContent = this.value + '%'">
						<div style="text-align: center; margin-top: 5px;">
							<span id="tts-volume-display">${node.config.volume ?? 100}%</span>
						</div>
						<div class="property-help">Set the TTS volume (0-100%)</div>
					</div>
					<div class="property-group" style="background: #9C27B0; padding: 10px; border-radius: 4px; color: white;">
						<strong>🔊 TTS Integration:</strong><br>
						Requires TTS to be enabled on the actions.html overlay page.
					</div>`;
				break;

			case 'midiSendNote':
				html += `<div class="property-group">
					<label class="property-label">MIDI Output Device</label>
					<select class="property-input" id="prop-deviceId">
						<option value="">Select MIDI Output Device...</option>
					</select>
				</div>
				<div class="property-group">
					<label class="property-label">Note (e.g., C4, D#5)</label>
					<input type="text" class="property-input" id="prop-note" value="${node.config.note || 'C4'}" placeholder="C4">
				</div>
				<div class="property-group">
					<label class="property-label">Velocity (0-127)</label>
					<input type="number" class="property-input" id="prop-velocity" value="${node.config.velocity || 127}" min="0" max="127">
				</div>
				<div class="property-group">
					<label class="property-label">Duration (ms)</label>
					<input type="number" class="property-input" id="prop-duration" value="${node.config.duration || 100}" min="1">
				</div>
				<div class="property-group">
					<label class="property-label">Channel (1-16)</label>
					<input type="number" class="property-input" id="prop-channel" value="${node.config.channel || 1}" min="1" max="16">
				</div>
				<p class="property-help">Sends a MIDI note to the selected output device.</p>`;
				this.populateMIDIOutputDevices('prop-deviceId', node.config.deviceId);
				break;
			case 'midiSendCC':
				html += `<div class="property-group">
					<label class="property-label">MIDI Output Device</label>
					<select class="property-input" id="prop-deviceId">
						<option value="">Select MIDI Output Device...</option>
					</select>
				</div>
				<div class="property-group">
					<label class="property-label">Controller Number (0-127)</label>
					<input type="number" class="property-input" id="prop-controller" value="${node.config.controller || 1}" min="0" max="127">
				</div>
				<div class="property-group">
					<label class="property-label">Value (0-127)</label>
					<input type="number" class="property-input" id="prop-value" value="${node.config.value || 64}" min="0" max="127">
				</div>
				<div class="property-group">
					<label class="property-label">Channel (1-16)</label>
					<input type="number" class="property-input" id="prop-channel" value="${node.config.channel || 1}" min="1" max="16">
				</div>
				<p class="property-help">Sends a MIDI Control Change message to the selected output device.</p>`;
				this.populateMIDIOutputDevices('prop-deviceId', node.config.deviceId);
				break;
				
			case 'setGateState':
				html += `
					<div class="property-group" style="background: #f0f8ff; color: #333; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
						<strong>💡 How this works:</strong><br>
						Controls an <strong>ON/OFF Switch</strong> node. First add a 🚦 ON/OFF Switch to your flow, then use this action to flip it ON or OFF.
					</div>
					<div class="property-group">
						<label class="property-label">Target Switch</label>
						<select class="property-input" id="prop-targetNodeId">
							<option value="">Select ON/OFF Switch...</option>
							${this.currentFlow?.nodes
								?.filter(n => n.type === 'state' && n.stateType === 'GATE')
								?.map(n => `<option value="${n.id}" ${node.config.targetNodeId === n.id ? 'selected' : ''}>${n.config?.name || 'Unnamed Gate'}</option>`)
								?.join('') || ''}
						</select>
						${!this.currentFlow?.nodes?.some(n => n.type === 'state' && n.stateType === 'GATE') ? 
							'<div class="property-help" style="color: #ff6b6b;">⚠️ No ON/OFF Switch nodes found! Add one from the State Nodes section.</div>' : 
							'<div class="property-help">Select which switch to control</div>'}
					</div>
					<div class="property-group">
						<label class="property-label">Set State To</label>
						<select class="property-input" id="prop-state">
							<option value="ALLOW" ${node.config.state === 'ALLOW' ? 'selected' : ''}>ON - Let messages through</option>
							<option value="BLOCK" ${node.config.state === 'BLOCK' ? 'selected' : ''}>OFF - Block messages</option>
						</select>
					</div>`;
				break;
				
			case 'resetStateNode':
				html += `
					<div class="property-group">
						<label class="property-label">Target State Node</label>
						<select class="property-input" id="prop-targetNodeId">
							<option value="">Select State Node...</option>
							${this.currentFlow?.nodes
								?.filter(n => n.type === 'state')
								?.map(n => `<option value="${n.id}" ${node.config.targetNodeId === n.id ? 'selected' : ''}>${n.config?.name || 'Unnamed'} (${n.stateType})</option>`)
								?.join('') || ''}
						</select>
						<div class="property-help">Resets the selected state node to its initial configuration</div>
					</div>`;
				break;
				
			case 'setCounter':
				html += `
					<div class="property-group" style="background: #f0f8ff; color: #333; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
						<strong>💡 How this works:</strong><br>
						Sets a <strong>Counter</strong> node to a specific value. First add a 🔢 Counter to your flow, then use this to reset it or set it to any number.
					</div>
					<div class="property-group">
						<label class="property-label">Target Counter</label>
						<select class="property-input" id="prop-targetNodeId">
							<option value="">Select Counter...</option>
							${this.currentFlow?.nodes
								?.filter(n => n.type === 'state' && n.stateType === 'COUNTER')
								?.map(n => `<option value="${n.id}" ${node.config.targetNodeId === n.id ? 'selected' : ''}>${n.config?.name || 'Unnamed Counter'}</option>`)
								?.join('') || ''}
						</select>
						${!this.currentFlow?.nodes?.some(n => n.type === 'state' && n.stateType === 'COUNTER') ? 
							'<div class="property-help" style="color: #ff6b6b;">⚠️ No Counter nodes found! Add one from the State Nodes section.</div>' : 
							'<div class="property-help">Select which counter to modify</div>'}
					</div>
					<div class="property-group">
						<label class="property-label">Set Value To</label>
						<input type="number" class="property-input" id="prop-value" 
							value="${node.config.value || 0}">
						<div class="property-help">Example: Set to 0 to reset the counter</div>
					</div>`;
				break;
				
			case 'incrementCounter':
				html += `
					<div class="property-group" style="background: #f0f8ff; color: #333; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
						<strong>💡 How this works:</strong><br>
						Adds or subtracts from a <strong>Counter</strong> node. Use this when you want to add points, track multiple items, or count down.
					</div>
					<div class="property-group">
						<label class="property-label">Target Counter</label>
						<select class="property-input" id="prop-targetNodeId">
							<option value="">Select Counter...</option>
							${this.currentFlow?.nodes
								?.filter(n => n.type === 'state' && n.stateType === 'COUNTER')
								?.map(n => `<option value="${n.id}" ${node.config.targetNodeId === n.id ? 'selected' : ''}>${n.config?.name || 'Unnamed Counter'}</option>`)
								?.join('') || ''}
						</select>
						${!this.currentFlow?.nodes?.some(n => n.type === 'state' && n.stateType === 'COUNTER') ? 
							'<div class="property-help" style="color: #ff6b6b;">⚠️ No Counter nodes found! Add one from the State Nodes section.</div>' : 
							'<div class="property-help">Select which counter to change</div>'}
					</div>
					<div class="property-group">
						<label class="property-label">Change Amount</label>
						<input type="number" class="property-input" id="prop-delta" 
							value="${node.config.delta || 1}">
						<div class="property-help">Examples: 1 to add one, -1 to subtract one, 10 to add ten points</div>
					</div>`;
				break;
				
			case 'checkCounter':
				html += `
					<div class="property-group">
						<label class="property-label">Target Counter Node</label>
						<select class="property-input" id="prop-targetNodeId">
							<option value="">Select Counter Node...</option>
							${this.currentFlow?.nodes
								?.filter(n => n.type === 'state' && n.stateType === 'COUNTER')
								?.map(n => `<option value="${n.id}" ${node.config.targetNodeId === n.id ? 'selected' : ''}>${n.config?.name || 'Unnamed Counter'}</option>`)
								?.join('') || ''}
						</select>
						<div class="property-help">Adds counter value to message for downstream nodes</div>
					</div>`;
				break;
				
			case 'playAudioClip':
				html += `<div class="property-group">
							 <label class="property-label">Audio File URL</label>
							 <div style="display: flex; gap: 5px;">
								 <input type="url" class="property-input" id="prop-audioUrl" value="${node.config.audioUrl || ''}" style="flex: 1;">
								 <button type="button" id="uploadAudioBtn" style="padding: 5px 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Upload</button>
							 </div>
						 </div>
						 <div class="property-group">
							<label class="property-label">Volume (0.0 to 1.0)</label>
							<input type="number" class="property-input" id="prop-volume" value="${node.config.volume || 1.0}" min="0" max="1" step="0.1">
						</div>`;
				break;

			default:
				html += `<p class="property-help">This node type (${node[subtypeField]}) has no specific configurable properties.</p>`;
		}

		propertiesContent.innerHTML = html;
		this.addPropertiesEventListeners(node.id); // Pass node.id to correctly re-attach listeners
	}

    addPropertiesEventListeners(nodeId) {
        const nodeData = this.currentFlow.nodes.find(n => n.id === nodeId);
        if (!nodeData) return;

        const subtypeSelect = document.getElementById('node-subtype-prop');
        if (subtypeSelect) {
            subtypeSelect.addEventListener('change', (e) => {
                const newSubtype = e.target.value;
                const nodeType = e.target.dataset.nodetype; // Should be 'trigger', 'action', or 'logic'
                
                if (nodeType === 'trigger') nodeData.triggerType = newSubtype;
                else if (nodeType === 'action') nodeData.actionType = newSubtype;
                else if (nodeType === 'logic') nodeData.logicType = newSubtype;
                
                nodeData.config = {}; // Reset config when subtype changes
                // TODO: Populate with default config for newSubtype if applicable
                this.markUnsavedChanges(true);
                this.showNodeProperties(nodeData); // Rerender properties for the new subtype
                this.renderNodeOnCanvas(nodeData.id); // Rerender the node itself on canvas
            });
        }
        document.querySelectorAll('#node-properties-content .property-input').forEach(input => {
            const propId = input.id.replace('prop-', '');
            input.addEventListener('input', (e) => { // 'change' for select/checkbox, 'input' for text/textarea
                if (e.target.type === 'checkbox') {
                    nodeData.config[propId] = e.target.checked;
                    if (propId === 'includeMessage' && document.getElementById('webhook-body-group')) {
                        document.getElementById('webhook-body-group').style.display = e.target.checked ? 'none' : 'block';
                    }
                } else if (e.target.type === 'number') {
                    nodeData.config[propId] = parseFloat(e.target.value) || 0;
                } else {
                    nodeData.config[propId] = e.target.value;
                }
                this.markUnsavedChanges(true);
                this.renderNodeOnCanvas(nodeData.id);
            });
             if (input.type === 'checkbox' || input.tagName === 'SELECT') { // Also listen for change for these
                input.addEventListener('change', (e) => { // Ensure changes are captured
                    if (e.target.type === 'checkbox') nodeData.config[propId] = e.target.checked;
                    else nodeData.config[propId] = e.target.value;
                     if (propId === 'includeMessage' && document.getElementById('webhook-body-group')) {
                        document.getElementById('webhook-body-group').style.display = e.target.checked ? 'none' : 'block';
                    }
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
        });

        // Special handling for relay destination dropdown
        const destinationSelect = document.getElementById('prop-destination-select');
        const destinationCustom = document.getElementById('prop-destination-custom');
        
        if (destinationSelect && destinationCustom) {
            destinationSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    destinationCustom.style.display = 'block';
                    nodeData.config.destination = destinationCustom.value || '';
                } else {
                    destinationCustom.style.display = 'none';
                    nodeData.config.destination = e.target.value;
                }
                this.markUnsavedChanges(true);
                this.renderNodeOnCanvas(nodeData.id);
            });
            
            destinationCustom.addEventListener('input', (e) => {
                nodeData.config.destination = e.target.value;
                this.markUnsavedChanges(true);
                this.renderNodeOnCanvas(nodeData.id);
            });
        }

        // Special handling for reflectionFilter window visibility
        const policySelect = document.getElementById('prop-policy');
        const windowGroup = document.getElementById('reflection-window-group');
        if (policySelect && windowGroup) {
            policySelect.addEventListener('change', (e) => {
                windowGroup.style.display = (e.target.value === 'allow-first') ? '' : 'none';
                // ensure config refresh
                if (nodeData && nodeData.config) {
                    nodeData.config.policy = e.target.value;
                }
                this.markUnsavedChanges(true);
                this.renderNodeOnCanvas(nodeData.id);
            });
        }

        // Special handling for compareProperty - show/hide custom property input
        const propertySelect = document.getElementById('prop-property-select');
        const customPropertyGroup = document.getElementById('custom-property-group');
        const customPropertyInput = document.getElementById('prop-property');
        if (propertySelect && customPropertyGroup) {
            propertySelect.addEventListener('change', (e) => {
                if (e.target.value === '_custom') {
                    customPropertyGroup.style.display = '';
                    // Use the custom input value
                    nodeData.config.property = customPropertyInput?.value || '';
                } else {
                    customPropertyGroup.style.display = 'none';
                    nodeData.config.property = e.target.value;
                }
                this.markUnsavedChanges(true);
                this.renderNodeOnCanvas(nodeData.id);
            });
        }

        // Special handling for eventType - show/hide custom event input
        const eventTypeSelect = document.getElementById('prop-eventType-select');
        const customEventGroup = document.getElementById('custom-event-group');
        const customEventInput = document.getElementById('prop-eventType');
        if (eventTypeSelect && customEventGroup) {
            eventTypeSelect.addEventListener('change', (e) => {
                if (e.target.value === '_custom') {
                    customEventGroup.style.display = '';
                    // Use the custom input value
                    nodeData.config.eventType = customEventInput?.value || '';
                } else {
                    customEventGroup.style.display = 'none';
                    nodeData.config.eventType = e.target.value;
                }
                this.markUnsavedChanges(true);
                this.renderNodeOnCanvas(nodeData.id);
            });
        }

        // Special handling for randomChance probability slider
        if (nodeData.triggerType === 'randomChance' || nodeData.type === 'trigger' && this.selectedNode?.triggerType === 'randomChance') {
            const slider = document.getElementById('prop-probability-slider');
            const input = document.getElementById('prop-probability');
            const cooldownInput = document.getElementById('prop-cooldownMs');
            
            if (slider && input) {
                // Sync slider and input
                slider.addEventListener('input', (e) => {
                    const percentage = parseFloat(e.target.value);
                    input.value = percentage;
                    nodeData.config.probability = percentage / 100; // Store as decimal
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
                
                input.addEventListener('input', (e) => {
                    const percentage = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                    slider.value = percentage;
                    input.value = percentage;
                    nodeData.config.probability = percentage / 100; // Store as decimal
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
            
            // Convert cooldown from seconds to milliseconds
            if (cooldownInput) {
                cooldownInput.addEventListener('input', (e) => {
                    const seconds = parseFloat(e.target.value) || 0;
                    nodeData.config.cooldownMs = seconds * 1000; // Convert to ms
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
        }

        // Special handling for messageProperties checkboxes
        if (nodeData.triggerType === 'messageProperties' || nodeData.type === 'trigger' && this.selectedNode?.triggerType === 'messageProperties') {
            // Handle requireAll radio buttons
            document.querySelectorAll('input[name="prop-requireAll"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    nodeData.config.requireAll = e.target.value === 'true';
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            });
            
            // Handle required properties checkboxes
            document.querySelectorAll('.prop-required').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    if (!nodeData.config.requiredProperties) nodeData.config.requiredProperties = [];
                    
                    if (e.target.checked) {
                        if (!nodeData.config.requiredProperties.includes(e.target.value)) {
                            nodeData.config.requiredProperties.push(e.target.value);
                        }
                    } else {
                        nodeData.config.requiredProperties = nodeData.config.requiredProperties.filter(p => p !== e.target.value);
                    }

                    // Keep first-time chatter toggle and last-activity mutual exclusion in sync
                    if (e.target.value === 'firsttime') {
                        if (e.target.checked) {
                            if (firstTimeToggle) firstTimeToggle.checked = true;
                            if (lastToggle) {
                                lastToggle.checked = false;
                                ensureLastActivityConfig();
                                nodeData.config.lastActivityFilter.enabled = false;
                            }
                        } else {
                            if (firstTimeToggle) firstTimeToggle.checked = false;
                        }
                        updateMutualExclusion();
                    }
                    
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            });
            
            // Handle forbidden properties checkboxes
            document.querySelectorAll('.prop-forbidden').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    if (!nodeData.config.forbiddenProperties) nodeData.config.forbiddenProperties = [];
                    
                    if (e.target.checked) {
                        if (!nodeData.config.forbiddenProperties.includes(e.target.value)) {
                            nodeData.config.forbiddenProperties.push(e.target.value);
                        }
                    } else {
                        nodeData.config.forbiddenProperties = nodeData.config.forbiddenProperties.filter(p => p !== e.target.value);
                    }
                    
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            });

            const ensureLastActivityConfig = () => {
                if (!nodeData.config.lastActivityFilter) {
                    nodeData.config.lastActivityFilter = { enabled: false, mode: 'within', amount: 10, unit: 'minutes' };
                }
            };

            const lastToggle = document.getElementById('prop-lastActivity-enabled');
            const lastControls = document.getElementById('last-activity-controls');
            const lastValue = document.getElementById('prop-lastActivity-value');
            const lastUnit = document.getElementById('prop-lastActivity-unit');
            const lastModeRadios = document.querySelectorAll('input[name="prop-lastActivity-mode"]');
            const quickButtons = document.querySelectorAll('.quick-last-activity');
            const firstTimeToggle = document.getElementById('prop-firsttime-only');

            const addRequiredProperty = (prop) => {
                if (!nodeData.config.requiredProperties) nodeData.config.requiredProperties = [];
                if (!nodeData.config.requiredProperties.includes(prop)) {
                    nodeData.config.requiredProperties.push(prop);
                }
            };

            const removeRequiredProperty = (prop) => {
                if (!nodeData.config.requiredProperties) nodeData.config.requiredProperties = [];
                nodeData.config.requiredProperties = nodeData.config.requiredProperties.filter(p => p !== prop);
            };

            const updateMutualExclusion = () => {
                const firstTimeActive = firstTimeToggle && firstTimeToggle.checked;
                const lastActiveEnabled = lastToggle && lastToggle.checked;

                if (firstTimeToggle) {
                    firstTimeToggle.disabled = Boolean(lastActiveEnabled);
                }
                if (lastToggle) {
                    lastToggle.disabled = Boolean(firstTimeActive);
                }
                if (lastControls) {
                    const disabled = firstTimeActive || !lastActiveEnabled;
                    lastControls.style.opacity = disabled ? '0.6' : '';
                    lastControls.style.pointerEvents = disabled ? 'none' : 'auto';
                }
            };

            if (lastToggle) {
                lastToggle.addEventListener('change', (e) => {
                    ensureLastActivityConfig();
                    nodeData.config.lastActivityFilter.enabled = e.target.checked;
                    if (e.target.checked && firstTimeToggle) {
                        firstTimeToggle.checked = false;
                        removeRequiredProperty('firsttime');
                    }
                    if (lastControls) {
                        lastControls.style.opacity = e.target.checked ? '' : '0.6';
                        lastControls.style.pointerEvents = e.target.checked ? 'auto' : 'none';
                    }
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                    updateMutualExclusion();
                });
            }

            if (lastValue) {
                lastValue.addEventListener('input', (e) => {
                    ensureLastActivityConfig();
                    const amount = Math.max(0, parseFloat(e.target.value) || 0);
                    nodeData.config.lastActivityFilter.amount = amount;
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }

            if (lastUnit) {
                lastUnit.addEventListener('change', (e) => {
                    ensureLastActivityConfig();
                    nodeData.config.lastActivityFilter.unit = e.target.value;
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                    updateMutualExclusion();
                });
            }

            if (lastModeRadios.length) {
                lastModeRadios.forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        if (!e.target.checked) return;
                        ensureLastActivityConfig();
                        nodeData.config.lastActivityFilter.mode = e.target.value;
                        this.markUnsavedChanges(true);
                        this.renderNodeOnCanvas(nodeData.id);
                    });
                });
            }

            if (quickButtons.length) {
                quickButtons.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        ensureLastActivityConfig();
                        const amount = parseFloat(btn.dataset.amount) || 0;
                        const unit = btn.dataset.unit || 'minutes';
                        nodeData.config.lastActivityFilter.amount = amount;
                        nodeData.config.lastActivityFilter.unit = unit;
                        nodeData.config.lastActivityFilter.enabled = true;
                        if (firstTimeToggle) {
                            firstTimeToggle.checked = false;
                            removeRequiredProperty('firsttime');
                        }
                        if (lastValue) lastValue.value = amount;
                        if (lastUnit) lastUnit.value = unit;
                        if (lastToggle) lastToggle.checked = true;
                        if (lastControls) {
                            lastControls.style.opacity = '';
                            lastControls.style.pointerEvents = 'auto';
                        }
                        this.markUnsavedChanges(true);
                        this.renderNodeOnCanvas(nodeData.id);
                        updateMutualExclusion();
                    });
                });
            }

            if (firstTimeToggle) {
                firstTimeToggle.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        addRequiredProperty('firsttime');
                        if (lastToggle) {
                            lastToggle.checked = false;
                            ensureLastActivityConfig();
                            nodeData.config.lastActivityFilter.enabled = false;
                        }
                    } else {
                        removeRequiredProperty('firsttime');
                    }
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                    updateMutualExclusion();
                });
            }

            // Initialize mutual exclusion state on load
            updateMutualExclusion();
        }

        // Special handling for counter trigger
        if (nodeData.triggerType === 'counter' || nodeData.type === 'trigger' && this.selectedNode?.triggerType === 'counter') {
            const countTypeSelect = document.getElementById('prop-countType');
            const propertyGroup = document.getElementById('counter-property-group');
            
            if (countTypeSelect) {
                countTypeSelect.addEventListener('change', (e) => {
                    nodeData.config.countType = e.target.value;
                    
                    // Show/hide property name field based on count type
                    if (propertyGroup) {
                        if (e.target.value === 'property' || e.target.value === 'value') {
                            propertyGroup.style.display = '';
                        } else {
                            propertyGroup.style.display = 'none';
                        }
                    }
                    
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
            
            // Handle reset after conversion from seconds to milliseconds
            const resetAfterInput = document.getElementById('prop-resetAfterMs');
            if (resetAfterInput) {
                resetAfterInput.addEventListener('input', (e) => {
                    const seconds = parseFloat(e.target.value) || 0;
                    nodeData.config.resetAfterMs = seconds * 1000; // Convert to ms
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
        }
        
        // Special handling for userPool trigger
        if (nodeData.triggerType === 'userPool' || nodeData.type === 'trigger' && this.selectedNode?.triggerType === 'userPool') {
            const requireEntryCheckbox = document.getElementById('prop-requireEntry');
            const keywordGroup = document.getElementById('pool-keyword-group');
            const resetAfterInput = document.getElementById('prop-resetAfterMs');
            
            if (requireEntryCheckbox) {
                requireEntryCheckbox.addEventListener('change', (e) => {
                    nodeData.config.requireEntry = e.target.checked;
                    
                    // Show/hide keyword field
                    if (keywordGroup) {
                        keywordGroup.style.display = e.target.checked ? '' : 'none';
                    }
                    
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
            
            // Handle reset after conversion from seconds to milliseconds
            if (resetAfterInput) {
                resetAfterInput.addEventListener('input', (e) => {
                    const seconds = parseFloat(e.target.value) || 0;
                    nodeData.config.resetAfterMs = seconds * 1000; // Convert to ms
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
        }
        
        // Special handling for accumulator trigger
        if (nodeData.triggerType === 'accumulator' || nodeData.type === 'trigger' && this.selectedNode?.triggerType === 'accumulator') {
            const resetAfterInput = document.getElementById('prop-resetAfterMs');
            
            // Handle reset after conversion from seconds to milliseconds
            if (resetAfterInput) {
                resetAfterInput.addEventListener('input', (e) => {
                    const seconds = parseFloat(e.target.value) || 0;
                    nodeData.config.resetAfterMs = seconds * 1000; // Convert to ms
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
        }

        // Special handling for setProperty action
        if (nodeData.actionType === 'setProperty' || nodeData.type === 'action' && this.selectedNode?.actionType === 'setProperty') {
            const propertySelect = document.getElementById('prop-property-select');
            const customPropertyDiv = document.getElementById('custom-property-name');
            const customPropertyInput = document.getElementById('prop-property');
            const valueInput = document.getElementById('prop-value');
            const colorInput = document.getElementById('prop-value-color');
            
            // Handle property dropdown change
            if (propertySelect) {
                propertySelect.addEventListener('change', (e) => {
                    const selectedValue = e.target.value;
                    
                    // Show/hide custom property name input
                    if (customPropertyDiv) {
                        customPropertyDiv.style.display = selectedValue === 'custom' ? '' : 'none';
                    }
                    
                    // Update the property value
                    if (selectedValue !== 'custom') {
                        nodeData.config.property = selectedValue;
                    } else if (customPropertyInput) {
                        nodeData.config.property = customPropertyInput.value || 'customProperty';
                    }
                    
                    // Refresh the properties panel to show appropriate value input
                    this.markUnsavedChanges(true);
                    this.showNodeProperties(nodeData);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
            
            // Handle custom property name input
            if (customPropertyInput) {
                customPropertyInput.addEventListener('input', (e) => {
                    nodeData.config.property = e.target.value;
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
            
            // Handle color picker
            if (colorInput) {
                colorInput.addEventListener('input', (e) => {
                    const color = e.target.value;
                    if (valueInput) {
                        valueInput.value = color;
                    }
                    nodeData.config.value = color;
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
            
            // Handle color preset buttons
            document.querySelectorAll('.color-preset-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const color = e.target.dataset.color;
                    if (valueInput) {
                        valueInput.value = color;
                    }
                    if (colorInput) {
                        colorInput.value = color;
                    }
                    nodeData.config.value = color;
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            });
        }

        // Special handling for source dropdown
        const sourceSelect = document.getElementById('prop-source');
        const sourceCustomInput = document.getElementById('prop-source-custom');
        
        if (sourceSelect) {
            sourceSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    // Show custom input
                    if (!sourceCustomInput) {
                        // Need to re-render the properties to show the custom input
                        nodeData.config.source = '';
                        this.showNodeProperties(nodeData);
                    }
                } else {
                    // Hide custom input and use dropdown value
                    nodeData.config.source = e.target.value;
                    if (sourceCustomInput) {
                        // Re-render to hide the custom input
                        this.showNodeProperties(nodeData);
                    }
                }
                this.markUnsavedChanges(true);
                this.renderNodeOnCanvas(nodeData.id);
            });
        }
        
        if (sourceCustomInput) {
            sourceCustomInput.addEventListener('input', (e) => {
                nodeData.config.source = e.target.value;
                this.markUnsavedChanges(true);
                this.renderNodeOnCanvas(nodeData.id);
            });
        }

        // Add upload button handlers
        const uploadMediaBtn = document.getElementById('uploadMediaBtn');
        if (uploadMediaBtn) {
            uploadMediaBtn.addEventListener('click', () => {
                const popup = window.open('https://fileuploads.socialstream.ninja/popup/upload', 'uploadMedia', 'width=640,height=640');
                
                window.addEventListener('message', function handleMessage(event) {
                    if (event.origin !== 'https://fileuploads.socialstream.ninja') return;
                    
                    if (event.data && event.data.type === 'media-uploaded') {
                        const mediaUrlInput = document.getElementById('prop-mediaUrl');
                        if (mediaUrlInput) {
                            mediaUrlInput.value = event.data.url;
                            mediaUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
                            nodeData.config.mediaUrl = event.data.url;
                            this.markUnsavedChanges(true);
                            this.renderNodeOnCanvas(nodeData.id);
                        }
                        window.removeEventListener('message', handleMessage);
                    }
                }.bind(this));
            });
        }

        // Handle removeType dropdown changes
        const removeTypeSelect = document.getElementById('prop-removeType');
        if (removeTypeSelect) {
            removeTypeSelect.addEventListener('change', (e) => {
                nodeData.config.removeType = e.target.value;
                this.markUnsavedChanges(true);
                this.showNodeProperties(nodeData); // Refresh to show/hide relevant fields
                this.renderNodeOnCanvas(nodeData.id);
            });
        }

        const uploadAudioBtn = document.getElementById('uploadAudioBtn');
        if (uploadAudioBtn) {
            uploadAudioBtn.addEventListener('click', () => {
                const popup = window.open('https://fileuploads.socialstream.ninja/popup/upload', 'uploadAudio', 'width=640,height=640');
                
                window.addEventListener('message', function handleMessage(event) {
                    if (event.origin !== 'https://fileuploads.socialstream.ninja') return;
                    
                    if (event.data && event.data.type === 'media-uploaded') {
                        const audioUrlInput = document.getElementById('prop-audioUrl');
                        if (audioUrlInput) {
                            audioUrlInput.value = event.data.url;
                            audioUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
                            nodeData.config.audioUrl = event.data.url;
                            this.markUnsavedChanges(true);
                            this.renderNodeOnCanvas(nodeData.id);
                        }
                        window.removeEventListener('message', handleMessage);
                    }
                }.bind(this));
            });
        }
    }
    
    renderNodeOnCanvas(nodeId) {
        const nodeData = this.currentFlow.nodes.find(n => n.id === nodeId);
        if (!nodeData) return;
        const existingNodeEl = document.querySelector(`.node[data-id="${nodeId}"]`);
        if (existingNodeEl) {
            const titleEl = existingNodeEl.querySelector('.node-title');
            if (titleEl) titleEl.textContent = this.getNodeTitle(nodeData);
            const bodyEl = existingNodeEl.querySelector('.node-body');
            if (bodyEl) bodyEl.innerHTML = this.getNodeDescription(nodeData);
        }
    }

    handleNodeDragMove = (e) => {
        if (!this.draggedNode || !this.currentFlow) return; // draggedNode is an ID
        const nodeEl = document.querySelector(`.node[data-id="${this.draggedNode}"]`);
        if (!nodeEl) return;

        const canvas = document.getElementById('flow-canvas');
        const canvasRect = canvas.getBoundingClientRect();
        let newX = e.clientX - canvasRect.left + canvas.scrollLeft - this.dragOffset.x;
        let newY = e.clientY - canvasRect.top + canvas.scrollTop - this.dragOffset.y;
        
        // Optional: Add boundary checks here if needed
        // newX = Math.max(0, Math.min(newX, canvas.scrollWidth - nodeEl.offsetWidth));
        // newY = Math.max(0, Math.min(newY, canvas.scrollHeight - nodeEl.offsetHeight));

        nodeEl.style.left = `${newX}px`;
        nodeEl.style.top = `${newY}px`;

        const nodeData = this.currentFlow.nodes.find(n => n.id === this.draggedNode);
        if (nodeData) {
            nodeData.x = newX;
            nodeData.y = newY;
        }
        // No need to mark unsaved changes on every move, do it on dragEnd
        this.redrawConnectionsForNode(this.draggedNode);
    };

    redrawConnectionsForNode(nodeId) {
        if (!this.currentFlow || !this.currentFlow.connections) return;
        this.currentFlow.connections.forEach(conn => {
            if (conn.from === nodeId || conn.to === nodeId) {
                const oldSvg = document.querySelector(`svg.connection[data-from="${conn.from}"][data-to="${conn.to}"]`);
                if (oldSvg) oldSvg.remove();
                this.renderConnection(conn);
            }
        });
    }

    handleNodeDragEnd = () => {
        document.removeEventListener('mousemove', this.handleNodeDragMove);
        document.removeEventListener('mouseup', this.handleNodeDragEnd);
        if (this.draggedNode) { // draggedNode is an ID
            const nodeData = this.currentFlow.nodes.find(n => n.id === this.draggedNode);
            const nodeEl = document.querySelector(`.node[data-id="${this.draggedNode}"]`);
            if (nodeData && nodeEl) { // Ensure both data and element exist
                nodeData.x = parseInt(nodeEl.style.left, 10);
                nodeData.y = parseInt(nodeEl.style.top, 10);
                this.markUnsavedChanges(true); // Mark changes at the end of drag
            }
        }
        this.draggedNode = null;
    };
}
