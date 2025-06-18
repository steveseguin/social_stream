/**
 * VDO.Ninja SDK v11 - Fixed Connection Flow
 * 
 * Key fixes:
 * 1. NO streamID in joinroom message
 * 2. NO password field in joinroom (password is used to hash roomid)
 * 3. Seed sent AFTER room join completes (after listing received)
 * 4. StreamID hashed correctly with 6-char suffix
 * 5. Proper message ordering: connect → joinroom → listing → seed
 * 
 * @author Steve Seguin
 * @license AGPLv3
 */

class VDONinjaSDK extends EventTarget {
    constructor(config = {}) {
        super();
        
        // Configuration with defaults
        this.config = {
            wss: config.wss || 'wss://apibackup.vdo.ninja/',
            mode: config.mode || 'vdoninja', // 'vdoninja' or 'custom'
            iceServers: config.iceServers || [
                { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
                { urls: 'stun:stun.vdo.ninja:3478' },
                // Include TURN servers for better connectivity
                {
                    username: 'steve',
                    credential: 'setupYourOwnPlease',
                    urls: ['turns:www.turn.obs.ninja:443']
                },
                {
                    username: 'vdoninja',
                    credential: 'theyBeSharksHere',
                    urls: ['turn:turn-usw2.vdo.ninja:3478']
                },
                {
                    username: 'vdoninja',
                    credential: 'IchBinSteveDerNinja',
                    urls: ['turn:www.turn.vdo.ninja:3478']
                }
            ],
            turnServers: config.turnServers || [],
            bitrate: config.bitrate || null,
            codec: config.codec || null,
            reconnectDelay: config.reconnectDelay || 1000,
            maxReconnectAttempts: config.maxReconnectAttempts || 5,
            debug: config.debug || false,
            salt: config.salt || null,
            encryptionEnabled: config.encryptionEnabled !== false,
            defaultPassword: config.defaultPassword || 'someEncryptionKey123',
            // Custom mode specific
            customUUID: config.customUUID || null,
            customHandshake: config.customHandshake || null,
            customAuth: config.customAuth || null
        };
        
        // Validate mode
        if (!['vdoninja', 'custom'].includes(this.config.mode)) {
            throw new Error('Invalid mode. Must be "vdoninja" or "custom"');
        }
        
        // Core state
        this.state = {
            room: null,
            roomHash: null,
            streamID: null,
            streamIDOriginal: null, // Original unhashed streamID
            password: null,
            directorPassword: null,
            connected: false,
            connecting: false,
            salt: null,
            hash: null, // StreamID hash suffix
            uuid: this.config.customUUID || this._generateUUID(),
            isCustomMode: this.config.mode === 'custom',
            hasSeeded: false, // Track if we've sent seed message
            joiningRoom: false, // Track room join state
            needsSeeding: false // Track if we need to seed after room join
        };
        
        // Connection managers
        this.signaling = null;
        this.connections = new Map(); // UUID -> Connection
        this.streams = new Map(); // streamID -> MediaStream
        this.tracks = new Map(); // trackID -> Track info
        this.roomParticipants = new Map(); // streamID -> participant info
        
        // Message handling
        this.messageHandlers = new Map();
        this.messageQueue = [];
        this.messageCache = new Map(); // For deduplication with TTL
        
        // Pending operations
        this._pendingViews = new Map(); // streamID -> Promise resolver
        
        // Initialize
        this._setupMessageHandlers();
        this._initializeSalt();
        this._setupCryptoUtils();
        
        this._log(`SDK initialized in ${this.config.mode} mode`);
    }
    
    // ========== Crypto Utilities ==========
    
    /**
     * Initialize salt based on domain or config
     */
    _initializeSalt() {
        if (this.config.salt) {
            this.state.salt = this.config.salt;
        } else if (this.state.isCustomMode) {
            // Custom mode uses a simpler salt strategy
            this.state.salt = 'custom';
        } else {
            // Extract domain from WSS URL for VDO.Ninja mode
            try {
                const url = new URL(this.config.wss);
                const hostname = url.hostname;
                
                if (hostname === 'wss.vdo.ninja' || hostname === 'apibackup.vdo.ninja') {
                    this.state.salt = 'vdo.ninja';
                } else {
                    // Use domain parts as salt
                    const parts = hostname.split('.');
                    this.state.salt = parts.slice(-2).join('.');
                }
            } catch (e) {
                this.state.salt = 'vdo.ninja';
            }
        }
    }
    
    /**
     * Setup crypto utility functions
     */
    _setupCryptoUtils() {
        // Convert string to Uint8Array
        this._stringToArrayBuffer = (str) => {
            return new TextEncoder().encode(str);
        };
        
        // Convert ArrayBuffer to string
        this._arrayBufferToString = (buffer) => {
            return new TextDecoder().decode(buffer);
        };
        
        // Convert bytes to hex string
        this._toHexString = (bytes) => {
            return Array.from(bytes, byte => ('0' + byte.toString(16)).slice(-2)).join('');
        };
        
        // Convert hex string to bytes
        this._fromHexString = (hex) => {
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
                bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
            }
            return bytes;
        };
    }
    
    /**
     * Generate SHA-256 hash
     * @param {string} str - String to hash
     * @param {number} hexLength - Desired hex string length (e.g., 6 or 16 characters)
     * @returns {Promise<string>} Hex string hash
     */
    async _generateHash(str, hexLength = null) {
        try {
            const buffer = this._stringToArrayBuffer(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            let hashArray = new Uint8Array(hashBuffer);
            
            if (hexLength) {
                // Convert hex length to bytes (2 hex chars = 1 byte)
                const byteLength = Math.ceil(hexLength / 2);
                hashArray = hashArray.slice(0, byteLength);
            }
            
            const hex = this._toHexString(hashArray);
            // Ensure exact hex length if specified
            return hexLength ? hex.substring(0, hexLength) : hex;
        } catch (error) {
            this._log('Hash generation error:', error);
            throw error;
        }
    }
    
    /**
     * Update streamID with hash if password is set
     */
    async _updateStreamIDHash() {
        if (!this.state.streamIDOriginal) return;
        
        // Only hash in VDO.Ninja mode with password
        if (!this.state.isCustomMode && this.state.password !== false && this.state.password) {
            // Generate hash if not already done
            if (this.state.hash === null) {
                this.state.hash = await this._generateHash(this.state.password + this.state.salt, 6);
            }
            
            // Update streamID with hash
            this.state.streamID = this.state.streamIDOriginal.substring(0, 44) + this.state.hash;
        } else {
            // No hashing needed
            this.state.streamID = this.state.streamIDOriginal;
        }
    }
    
    /**
     * Encrypt message using AES-CBC
     * @param {string} message - Message to encrypt
     * @param {string} passphrase - Encryption passphrase
     * @returns {Promise<[string, string]>} [encrypted_hex, iv_hex]
     */
    async _encryptMessage(message, passphrase = null) {
        if (!this.config.encryptionEnabled) {
            return [message, null];
        }
        
        const phrase = passphrase || (this.state.password + this.state.salt);
        const vector = crypto.getRandomValues(new Uint8Array(16));
        
        try {
            // Generate key from passphrase
            const keyBuffer = await crypto.subtle.digest('SHA-256', this._stringToArrayBuffer(phrase));
            const key = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-CBC' },
                false,
                ['encrypt', 'decrypt']
            );
            
            // Encrypt
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-CBC', iv: vector },
                key,
                this._stringToArrayBuffer(message)
            );
            
            return [
                this._toHexString(new Uint8Array(encrypted)),
                this._toHexString(vector)
            ];
        } catch (error) {
            this._log('Encryption error:', error);
            throw error;
        }
    }
    
    /**
     * Decrypt message using AES-CBC
     * @param {string} encryptedHex - Encrypted data as hex string
     * @param {string} ivHex - IV as hex string
     * @param {string} passphrase - Decryption passphrase
     * @returns {Promise<string>} Decrypted message
     */
    async _decryptMessage(encryptedHex, ivHex, passphrase = null) {
        if (!this.config.encryptionEnabled || !ivHex) {
            return encryptedHex;
        }
        
        const phrase = passphrase || (this.state.password + this.state.salt);
        
        try {
            const encrypted = this._fromHexString(encryptedHex);
            const vector = this._fromHexString(ivHex);
            
            // Generate key from passphrase
            const keyBuffer = await crypto.subtle.digest('SHA-256', this._stringToArrayBuffer(phrase));
            const key = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-CBC' },
                false,
                ['encrypt', 'decrypt']
            );
            
            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: vector },
                key,
                encrypted
            );
            
            return this._arrayBufferToString(decrypted);
        } catch (error) {
            this._log('Decryption error:', error);
            return encryptedHex; // Return original if decryption fails
        }
    }
    
    // ========== Public API ==========
    
    /**
     * Connect to VDO.Ninja signaling server
     * @returns {Promise<void>}
     */
    async connect() {
        if (this.state.connected || this.state.connecting) {
            throw new Error('Already connected or connecting');
        }
        
        this.state.connecting = true;
        
        try {
            await this._connectSignaling();
            this.state.connected = true;
            this.state.connecting = false;
            this._emit('connected');
        } catch (error) {
            this.state.connecting = false;
            this._emit('error', { type: 'connection', error });
            throw error;
        }
    }
    
    /**
     * Join a room as publisher or viewer
     * @param {Object} options
     * @param {string} options.room - Room name
     * @param {string} options.streamID - Your stream ID (optional for viewers)
     * @param {string} options.password - Room password (optional)
     * @param {string} options.directorPassword - Director password (optional)
     * @param {string} options.view - Stream ID to view (for viewer mode)
     * @param {string} options.push - Alias for streamID (VDO.Ninja compatibility)
     * @param {string} options.token - Additional token for room hash (optional)
     * @returns {Promise<void>}
     */
    async joinRoom(options = {}) {
        if (!this.state.connected) {
            throw new Error('Not connected to signaling server');
        }
        
        const { room, streamID, push, password, directorPassword, view, token } = options;
        
        if (!room) {
            throw new Error('Room name is required');
        }
        
        // If already in a room, leave it first
        if (this.state.room) {
            await this.leaveRoom();
        }
        
        // Mark as joining room
        this.state.joiningRoom = true;
        
        this.state.room = room;
        
        // Set password FIRST before setting streamID
        // Handle password disable values
        if (password === 'false' || password === '0' || password === 'off' || password === false || password === 0) {
            this.state.password = false;
        } else {
            this.state.password = password || this.config.defaultPassword;
        }
        
        // Now set streamID and it will be hashed if needed
        if (!this.state.streamIDOriginal && (streamID || push)) {
            this.state.streamIDOriginal = streamID || push;
            await this._updateStreamIDHash();
        } else if (streamID && streamID !== this.state.streamIDOriginal) {
            this._log(`Warning: Already publishing as ${this.state.streamIDOriginal}, ignoring provided streamID ${streamID}`);
        }
        
        this.state.directorPassword = directorPassword;
        
        // Clear room participants for new room
        this.roomParticipants.clear();
        
        // Handle room based on mode
        if (this.state.isCustomMode) {
            await this._joinRoomCustom(options);
        } else {
            await this._joinRoomVDONinja(options);
        }
    }
    
    /**
     * Join room in VDO.Ninja mode
     */
    async _joinRoomVDONinja(options) {
        const { room, directorPassword, view, token } = options;
        
        // Generate room hash if password provided
        let roomHash = room;
        if (this.state.password !== false && this.state.password && this.config.encryptionEnabled) {
            // Room hash includes: room + password + salt + token, 16 characters
            // Token is optional, defaults to empty string
            const tokenValue = token || '';
            roomHash = await this._generateHash(room + this.state.password + this.state.salt + tokenValue, 16);
        }
        this.state.roomHash = roomHash;
        
        // Prepare join message - NO streamID, NO password field!
        const msg = {
            request: 'joinroom',
            roomid: roomHash // This IS the hashed room name
        };
        
        // Add director password if provided
        if (directorPassword) {
            msg.director = await this._generateHash(directorPassword + this.state.salt + 'abc123', 12);
        }
        
        // Add view target if specified
        if (view) {
            msg.view = view;
        }
        
        await this._sendSignaling(msg);
        
        // Don't mark as complete yet - wait for listing response
        // The listing handler will complete the join and send seed if needed
        
        this._emit('roomJoined', { room, roomHash, streamID: this.state.streamID });
    }
    
    /**
     * Join room in custom mode
     */
    async _joinRoomCustom(options) {
        const { room, view } = options;
        
        this.state.roomHash = room; // No hashing in custom mode
        
        // Prepare join message for custom mode
        const msg = {
            request: 'joinroom',
            roomid: room,
            streamID: this.state.streamIDOriginal, // Use original in custom mode
            UUID: this.state.uuid
        };
        
        // Add custom authentication if provided
        if (this.config.customAuth) {
            msg.auth = this.config.customAuth;
        } else if (this.state.password) {
            msg.password = this.state.password; // Plain password in custom mode
        }
        
        // Add view target if specified
        if (view) {
            msg.view = view;
        }
        
        // Add any custom fields
        if (this.config.customJoinFields) {
            Object.assign(msg, this.config.customJoinFields);
        }
        
        await this._sendSignaling(msg);
        
        // Custom mode might not wait for listing
        this.state.joiningRoom = false;
        
        // Send seed if needed
        if (this.state.needsSeeding && this.state.streamIDOriginal && !this.state.hasSeeded) {
            await this._sendSignaling({ 
                request: 'seed', 
                streamID: this.state.streamIDOriginal // Use original in custom mode
            });
            this.state.hasSeeded = true;
            this.state.needsSeeding = false;
        }
        
        this._emit('roomJoined', { room, roomHash: room, streamID: this.state.streamIDOriginal });
    }
    
    /**
     * Leave the current room
     * @returns {Promise<void>}
     */
    async leaveRoom() {
        if (!this.state.room) {
            return; // Not in a room
        }
        
        // Send bye message to notify we're leaving the room
        const byeMsg = {
            bye: true,
            streamID: this.state.isCustomMode ? this.state.streamIDOriginal : this.state.streamID
        };
        
        if (this.state.isCustomMode) {
            byeMsg.from = this.state.uuid;
            byeMsg.UUID = '*'; // Broadcast to all peers in room
        }
        
        await this._sendSignaling(byeMsg);
        
        // Close all peer connections
        for (const [uuid, conn] of this.connections.entries()) {
            this._closeConnection(uuid);
        }
        
        // Clear room state
        this.state.room = null;
        this.state.roomHash = null;
        this.state.joiningRoom = false;
        this.state.needsSeeding = false;
        this.roomParticipants.clear();
        
        this._emit('roomLeft');
    }
    
    /**
     * Publish media stream
     * @param {MediaStream} stream - Media stream to publish
     * @param {Object} options - Publishing options
     * @returns {Promise<void>}
     */
    async publish(stream, options = {}) {
        if (!this.state.connected) {
            throw new Error('Not connected to signaling server');
        }
        
        if (!stream || !(stream instanceof MediaStream)) {
            throw new Error('Valid MediaStream required');
        }
        
        // If no streamID set yet, generate one and hash it
        if (!this.state.streamIDOriginal) {
            this.state.streamIDOriginal = options.streamID || this._generateStreamID();
            await this._updateStreamIDHash();
            this._log('Publishing with streamID:', this.state.streamID);
        }
        
        // Store stream
        this.streams.set(this.state.streamID, stream);
        
        // Store publish options for later use in info message
        this.state.publishOptions = options;
        
        // Store tracks
        stream.getTracks().forEach(track => {
            this.tracks.set(track.id, { track, stream, added: Date.now() });
        });
        
        // Check if we should seed now or wait for room join
        if (this.state.joiningRoom) {
            this._log('Marking for seeding after room join');
            this.state.needsSeeding = true;
        } else if (this.state.room && !this.state.hasSeeded) {
            // Already in a room, send seed now
            await this._sendSignaling({ 
                request: 'seed', 
                streamID: this.state.isCustomMode ? this.state.streamIDOriginal : this.state.streamID
            });
            this.state.hasSeeded = true;
        } else if (!this.state.room) {
            // Publishing without room - seed immediately
            await this._sendSignaling({ 
                request: 'seed', 
                streamID: this.state.isCustomMode ? this.state.streamIDOriginal : this.state.streamID
            });
            this.state.hasSeeded = true;
        }
        
        this._emit('publishing', { streamID: this.state.streamID, stream });
    }
    
    /**
     * View a remote stream
     * @param {string} streamID - Stream ID to view
     * @param {Object} options - Viewing options
     * @returns {Promise<RTCPeerConnection>}
     */
    async view(streamID, options = {}) {
        if (!this.state.connected) {
            throw new Error('Not connected to signaling server');
        }
        
        // Check if already viewing
        const existing = Array.from(this.connections.values())
            .find(conn => conn.streamID === streamID);
        
        if (existing) {
            return existing.pc;
        }
        
        // If no streamID set yet (viewer only), generate one
        if (!this.state.streamIDOriginal) {
            this.state.streamIDOriginal = this._generateStreamID();
            await this._updateStreamIDHash();
            this._log('Viewing as streamID:', this.state.streamID);
        }
        
        // Create pending view promise
        const viewPromise = new Promise((resolve, reject) => {
            this._pendingViews.set(streamID, { resolve, reject, timestamp: Date.now() });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this._pendingViews.has(streamID)) {
                    this._pendingViews.delete(streamID);
                    reject(new Error('View request timeout'));
                }
            }, 30000);
        });
        
        // Request connection
        const playMsg = {
            request: 'play',
            streamID: streamID
            // NOTE: Don't include UUID in non-custom mode - server rewrites it
        };
        
        // Only add roomid if we're in a room
        if (this.state.roomHash) {
            playMsg.roomid = this.state.roomHash;
        }
        
        if (this.state.isCustomMode) {
            playMsg.from = this.state.uuid;
            playMsg.to = streamID; // In custom mode, streamID might be UUID
        } else {
            // In VDO.Ninja mode, server handles UUID rewriting
            // Don't include UUID field - it would be interpreted as destination
        }
        
        await this._sendSignaling(playMsg);
        
        return viewPromise;
    }
    
    /**
     * Send data to peer(s) via data channel
     * @param {*} data - Data to send
     * @param {string} target - Target UUID or 'all' for broadcast
     * @returns {Promise<void>}
     */
    async sendData(data, target = 'all') {
        // VDO.Ninja expects messages to be sent directly as JSON strings
        // Include minimal metadata for routing
        const message = {
            ...data,
            UUID: this.state.uuid,
            streamID: this.state.isCustomMode ? this.state.streamIDOriginal : this.state.streamID,
            mid: this._generateMessageID()
        };
        
        const payload = JSON.stringify(message);
        
        if (target === 'all') {
            // Broadcast to all connected peers
            let sent = 0;
            for (const conn of this.connections.values()) {
                if (conn.dataChannel?.readyState === 'open') {
                    try {
                        conn.dataChannel.send(payload);
                        sent++;
                    } catch (err) {
                        this._log('Failed to send to data channel:', err);
                    }
                }
            }
            
            if (sent === 0) {
                throw new Error('No open data channels available');
            }
        } else {
            // Send to specific peer
            const conn = this.connections.get(target);
            if (conn?.dataChannel?.readyState === 'open') {
                conn.dataChannel.send(payload);
            } else {
                throw new Error(`No open data channel to peer ${target}`);
            }
        }
    }
    
    /**
     * Send via pipe (through signaling server)
     * @param {*} data - Data to send
     * @param {string} target - Target UUID or streamID
     * @param {boolean} encrypt - Whether to encrypt
     * @returns {Promise<void>}
     */
    async sendPipe(data, target, encrypt = true) {
        const pipeMsg = {
            pipe: data,
            UUID: target, // This is the destination UUID
            streamID: this.state.isCustomMode ? this.state.streamIDOriginal : this.state.streamID,
            mid: this._generateMessageID()
        };
        
        if (this.state.isCustomMode) {
            pipeMsg.from = this.state.uuid;
            pipeMsg.to = target;
        }
        
        if (encrypt && this.state.password && !this.state.isCustomMode) {
            const dataStr = JSON.stringify(data);
            const [encrypted, iv] = await this._encryptMessage(dataStr);
            pipeMsg.pipe = encrypted;
            pipeMsg.vector = iv;
        }
        
        await this._sendSignaling(pipeMsg);
    }
    
    /**
     * Add track to existing connections
     * @param {MediaStreamTrack} track - Track to add
     * @param {MediaStream} stream - Stream containing track
     * @returns {Promise<void>}
     */
    async addTrack(track, stream) {
        if (!track || !stream) {
            throw new Error('Track and stream required');
        }
        
        // Store track info
        this.tracks.set(track.id, { track, stream, added: Date.now() });
        
        // Add to all publisher connections
        for (const conn of this.connections.values()) {
            if (conn.type === 'publisher' && conn.pc.connectionState === 'connected') {
                await this._addTrackToConnection(conn, track, stream);
            }
        }
        
        this._emit('trackAdded', { track, stream });
    }
    
    /**
     * Remove track from connections
     * @param {MediaStreamTrack} track - Track to remove
     * @returns {Promise<void>}
     */
    async removeTrack(track) {
        if (!track) {
            throw new Error('Track required');
        }
        
        // Remove from all connections
        for (const conn of this.connections.values()) {
            const sender = conn.pc.getSenders().find(s => s.track === track);
            if (sender) {
                conn.pc.removeTrack(sender);
            }
        }
        
        // Remove from storage
        this.tracks.delete(track.id);
        
        this._emit('trackRemoved', { track });
    }
    
    /**
     * Replace track in connections
     * @param {MediaStreamTrack} oldTrack - Track to replace
     * @param {MediaStreamTrack} newTrack - New track
     * @returns {Promise<void>}
     */
    async replaceTrack(oldTrack, newTrack) {
        if (!oldTrack || !newTrack) {
            throw new Error('Both old and new tracks required');
        }
        
        // Replace in all connections
        for (const conn of this.connections.values()) {
            const sender = conn.pc.getSenders().find(s => s.track === oldTrack);
            if (sender) {
                await sender.replaceTrack(newTrack);
            }
        }
        
        // Update storage
        const trackInfo = this.tracks.get(oldTrack.id);
        if (trackInfo) {
            this.tracks.delete(oldTrack.id);
            this.tracks.set(newTrack.id, { ...trackInfo, track: newTrack });
        }
        
        this._emit('trackReplaced', { oldTrack, newTrack });
    }
    
    /**
     * Get connection statistics
     * @param {string} uuid - Connection UUID (optional)
     * @returns {Promise<Object>}
     */
    async getStats(uuid = null) {
        if (uuid) {
            const conn = this.connections.get(uuid);
            if (!conn) {
                throw new Error(`Connection ${uuid} not found`);
            }
            return await conn.pc.getStats();
        }
        
        // Get stats for all connections
        const stats = {};
        for (const [uuid, conn] of this.connections) {
            stats[uuid] = await conn.pc.getStats();
        }
        return stats;
    }
    
    /**
     * Get list of current room participants
     * @returns {Array} List of participants with streamID and UUID
     */
    getRoomParticipants() {
        const participants = [];
        
        // Include discovered participants
        for (const [streamID, info] of this.roomParticipants) {
            participants.push({
                streamID: streamID,
                uuid: info.uuid,
                label: info.label,
                director: info.director,
                codirector: info.codirector,
                discovered: true,
                connected: this.connections.has(info.uuid)
            });
        }
        
        // Include any connected peers not in room participants
        for (const [uuid, conn] of this.connections) {
            if (!Array.from(this.roomParticipants.values()).some(p => p.uuid === uuid)) {
                participants.push({
                    uuid: uuid,
                    streamID: conn.streamID || 'unknown',
                    type: conn.type,
                    connected: conn.pc.connectionState === 'connected',
                    discovered: false
                });
            }
        }
        
        return participants;
    }
    
    /**
     * Set bitrate for video
     * @param {number} bitrate - Bitrate in kbps
     * @param {string} uuid - Connection UUID (optional, applies to all if not specified)
     */
    async setBitrate(bitrate, uuid = null) {
        const connections = uuid ? [this.connections.get(uuid)].filter(Boolean) : Array.from(this.connections.values());
        
        for (const conn of connections) {
            const senders = conn.pc.getSenders();
            for (const sender of senders) {
                if (sender.track?.kind === 'video') {
                    const params = sender.getParameters();
                    if (!params.encodings) {
                        params.encodings = [{}];
                    }
                    params.encodings[0].maxBitrate = bitrate * 1000;
                    await sender.setParameters(params);
                }
            }
        }
        
        this.config.bitrate = bitrate;
    }
    
    /**
     * Disconnect and cleanup
     */
    async disconnect() {
        // Close all peer connections
        for (const conn of this.connections.values()) {
            this._closeConnection(conn.uuid);
        }
        
        // Close signaling
        if (this.signaling) {
            this.signaling.close();
            this.signaling = null;
        }
        
        // Clear state
        this.state = {
            room: null,
            roomHash: null,
            streamID: null,
            streamIDOriginal: null,
            password: null,
            directorPassword: null,
            connected: false,
            connecting: false,
            salt: this.state.salt,
            hash: null,
            uuid: this.state.uuid,
            isCustomMode: this.state.isCustomMode,
            hasSeeded: false,
            joiningRoom: false,
            needsSeeding: false
        };
        
        // Clear storage
        this.connections.clear();
        this.streams.clear();
        this.tracks.clear();
        this.messageCache.clear();
        this.messageQueue = [];
        this._pendingViews.clear();
        this.roomParticipants.clear();
        
        this._emit('disconnected');
    }
    
    // ========== Private Methods ==========
    
    /**
     * Connect to signaling server
     */
    async _connectSignaling() {
        return new Promise((resolve, reject) => {
            this.signaling = new WebSocket(this.config.wss);
            
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
                this.signaling.close();
            }, 10000);
            
            this.signaling.onopen = () => {
                clearTimeout(timeout);
                this._log('Signaling connected');
                
                // Send handshake based on mode
                if (this.state.isCustomMode) {
                    this._sendCustomHandshake();
                } else {
                    this._sendVDONinjaHandshake();
                }
                
                // Send queued messages
                while (this.messageQueue.length > 0) {
                    const msg = this.messageQueue.shift();
                    this.signaling.send(JSON.stringify(msg));
                }
                
                resolve();
            };
            
            this.signaling.onclose = () => {
                this._log('Signaling disconnected');
                this.state.connected = false;
                this._handleSignalingDisconnect();
            };
            
            this.signaling.onerror = (error) => {
                clearTimeout(timeout);
                this._log('Signaling error:', error);
                reject(error);
            };
            
            this.signaling.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    this._handleSignalingMessage(msg);
                } catch (error) {
                    this._log('Message parse error:', error);
                }
            };
        });
    }
    
    /**
     * Send VDO.Ninja handshake
     */
    _sendVDONinjaHandshake() {
        // VDO.Ninja doesn't require an initial handshake message
        // The connection is established and we send messages as needed
        // Seed messages are only sent when we have a streamID to announce
        this._log('WebSocket connected - ready for VDO.Ninja protocol');
    }
    
    /**
     * Send custom handshake
     */
    _sendCustomHandshake() {
        if (this.config.customHandshake) {
            // Use provided custom handshake
            this._sendSignaling(this.config.customHandshake);
        } else {
            // Default custom handshake
            this._sendSignaling({ 
                request: 'init',
                UUID: this.state.uuid,
                streamID: this.state.uuid,
                mode: 'custom'
            });
        }
    }
    
    /**
     * Send signaling message
     */
    async _sendSignaling(msg) {
        // Add message ID for duplicate prevention (VDO.Ninja mode)
        if (!this.state.isCustomMode && !msg.mid) {
            msg.mid = this._generateMessageID();
        }
        
        // StreamID should already be hashed if needed - don't hash again
        // The streamID is pre-hashed in _updateStreamIDHash()
        
        if (this.signaling?.readyState === WebSocket.OPEN) {
            this.signaling.send(JSON.stringify(msg));
        } else {
            this.messageQueue.push(msg);
            if (!this.state.connecting) {
                await this.connect();
            }
        }
    }
    
    /**
     * Handle signaling messages
     */
    async _handleSignalingMessage(msg) {
        this._log('Signaling message:', msg);
        
        // Decrypt if needed (VDO.Ninja mode)
        if (msg.vector && this.state.password && !this.state.isCustomMode) {
            try {
                // Find encrypted field
                const encryptedField = msg.description || msg.candidates || msg.pipe || msg.request;
                if (encryptedField && typeof encryptedField === 'string') {
                    const decrypted = await this._decryptMessage(encryptedField, msg.vector);
                    
                    // Replace encrypted field
                    if (msg.description) msg.description = JSON.parse(decrypted);
                    else if (msg.candidates) msg.candidates = JSON.parse(decrypted);
                    else if (msg.pipe) msg.pipe = JSON.parse(decrypted);
                    else if (msg.request) msg.request = decrypted;
                }
            } catch (error) {
                this._log('Decryption failed:', error);
            }
        }
        
        // Route to handler
        const handler = this.messageHandlers.get(msg.request || msg.type || msg.cmd);
        if (handler) {
            handler.call(this, msg);
        } else if (msg.description) {
            this._handleDescription(msg);
        } else if (msg.candidates) {
            this._handleCandidates(msg);
        } else if (msg.pipe !== undefined) {
            this._handlePipe(msg);
        } else {
            this._log('Unknown message type:', msg);
            // Emit for custom handling
            this._emit('signalingMessage', { message: msg });
        }
    }
    
    /**
     * Setup message handlers
     */
    _setupMessageHandlers() {
        // Room events
        this.messageHandlers.set('joinroom', this._handleJoinRoom);
        this.messageHandlers.set('joined', this._handleRoomJoined);
        this.messageHandlers.set('roomfull', this._handleRoomFull);
        this.messageHandlers.set('rejected', this._handleRejected);
        
        // Peer events - CRITICAL: listing handler completes room join
        this.messageHandlers.set('listing', this._handleListing);
        this.messageHandlers.set('list', this._handleListing); // Alternative format
        this.messageHandlers.set('play', this._handlePlayRequest);
        this.messageHandlers.set('offerSDP', this._handleOfferSDP); // KEY FIX: Handle offerSDP
        this.messageHandlers.set('playerready', this._handlePlayerReady);
        this.messageHandlers.set('someonejoined', this._handleSomeoneJoined);
        this.messageHandlers.set('videoaddedtoroom', this._handleVideoAddedToRoom);
        
        // Connection events
        this.messageHandlers.set('peerconnection', this._handlePeerConnection);
        this.messageHandlers.set('peerclose', this._handlePeerClose);
        this.messageHandlers.set('bye', this._handleBye);
        
        // ICE events
        this.messageHandlers.set('icecandidate', this._handleCandidates);
        this.messageHandlers.set('icerestart', this._handleIceRestart);
        
        // Data events
        this.messageHandlers.set('datachannel', this._handleDataChannel);
        this.messageHandlers.set('pipe', this._handlePipe);
        
        // Control events
        this.messageHandlers.set('migrate', this._handleMigrate);
        this.messageHandlers.set('bitrate', this._handleBitrate);
        this.messageHandlers.set('requeststats', this._handleRequestStats);
        
        // Custom mode might have additional handlers
        if (this.state.isCustomMode && this.config.customHandlers) {
            for (const [type, handler] of Object.entries(this.config.customHandlers)) {
                this.messageHandlers.set(type, handler.bind(this));
            }
        }
    }
    
    /**
     * Create peer connection
     */
    _createConnection(uuid, type = 'viewer') {
        // In custom mode, handle UUID differently
        if (this.state.isCustomMode && type === 'publisher') {
            uuid = uuid || this.state.uuid;
        }
        
        // Build ICE servers configuration
        const iceServers = [...this.config.iceServers];
        
        // Add TURN servers if available
        if (this.config.turnServers && this.config.turnServers.length > 0) {
            iceServers.push(...this.config.turnServers);
        }
        
        const pc = new RTCPeerConnection({
            iceServers,
            sdpSemantics: 'unified-plan',
            bundlePolicy: 'max-bundle'
        });
        
        const connection = {
            uuid,
            pc,
            type, // 'publisher' or 'viewer'
            streamID: null,
            session: this._generateSessionID(),
            startTime: Date.now(),
            iceBundle: [],
            iceTimer: null,
            dataChannel: null,
            stats: {
                bytesReceived: 0,
                bytesSent: 0,
                packetsLost: 0
            }
        };
        
        // Setup event handlers
        this._setupConnectionHandlers(connection);
        
        // Store connection
        this.connections.set(uuid, connection);
        
        this._log(`Created ${type} connection:`, uuid);
        
        return connection;
    }
    
    /**
     * Setup connection event handlers
     */
    _setupConnectionHandlers(connection) {
        const { pc, uuid } = connection;
        
        // ICE handling
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                connection.iceBundle.push(event.candidate);
                
                // Bundle candidates
                clearTimeout(connection.iceTimer);
                connection.iceTimer = setTimeout(() => {
                    this._sendCandidates(connection);
                }, 10);
            }
        };
        
        // Connection state
        pc.onconnectionstatechange = () => {
            this._log(`Connection state [${uuid}]:`, pc.connectionState);
            
            switch (pc.connectionState) {
                case 'connected':
                    this._emit('peerConnected', { uuid, connection });
                    if (connection.streamID) {
                        this._emit(`peer:${connection.streamID}:connected`, { connection });
                    }
                    break;
                    
                case 'disconnected':
                    setTimeout(() => {
                        if (pc.connectionState === 'disconnected') {
                            this._closeConnection(uuid);
                        }
                    }, this.config.reconnectDelay);
                    break;
                    
                case 'failed':
                    this._handleConnectionFailed(connection);
                    break;
                    
                case 'closed':
                    this._emit('peerDisconnected', { uuid });
                    break;
            }
        };
        
        // Track handling
        pc.ontrack = (event) => {
            this._log(`Track received [${uuid}]:`, event.track.kind);
            
            this._emit('track', {
                track: event.track,
                streams: event.streams,
                uuid,
                connection
            });
        };
        
        // Data channel for viewers (will receive from publisher)
        if (connection.type === 'viewer') {
            pc.ondatachannel = (event) => {
                this._setupDataChannel(connection, event.channel);
            };
        }
    }
    
    /**
     * Setup data channel
     */
    _setupDataChannel(connection, channel) {
        connection.dataChannel = channel;
        
        channel.onopen = () => {
            this._log(`Data channel open [${connection.uuid}]`);
            
            // Send info message for publisher connections
            if (connection.type === 'publisher') {
                const msg = {
                    info: {}
                };
                
                // Add label from publish options if available
                if (this.state.publishOptions?.label) {
                    msg.info.label = this.state.publishOptions.label;
                }
                
                // Add basic info
                msg.info.version = 'VDO.Ninja SDK v11';
                msg.info.muted = false;
                msg.info.video_muted_init = false;
                msg.info.room_init = !!this.state.room;
                
                // Add stream info
                const stream = this.streams.get(this.state.streamID);
                if (stream) {
                    const videoTracks = stream.getVideoTracks();
                    const audioTracks = stream.getAudioTracks();
                    
                    if (videoTracks.length > 0) {
                        const settings = videoTracks[0].getSettings();
                        msg.info.video_init_width = settings.width || false;
                        msg.info.video_init_height = settings.height || false;
                        msg.info.video_init_frameRate = parseInt(settings.frameRate) || false;
                    }
                }
                
                // Add browser info
                try {
                    if (navigator && navigator.userAgent) {
                        msg.info.useragent = navigator.userAgent;
                    }
                    if (navigator && navigator.platform) {
                        msg.info.platform = navigator.platform;
                    }
                } catch (e) {}
                
                // Send the info message
                this.sendData(msg, connection.uuid);
            }
            
            this._emit('dataChannelOpen', { uuid: connection.uuid, connection });
        };
        
        channel.onmessage = async (event) => {
            try {
                const msg = JSON.parse(event.data);
                
                
                // Emit data event with the full message
                this._emit('data', {
                    data: msg,
                    uuid: connection.uuid,
                    streamID: connection.streamID,
                    timestamp: msg.time || Date.now(),
                    from: msg.UUID || msg.streamID || connection.uuid
                });
                
            } catch (error) {
                // Handle binary data or parse errors
                this._emit('data', {
                    data: event.data,
                    uuid: connection.uuid,
                    binary: true,
                    from: connection.uuid
                });
            }
        };
        
        channel.onerror = (error) => {
            this._log(`Data channel error [${connection.uuid}]:`, error);
            this._emit('dataChannelError', { uuid: connection.uuid, error });
        };
        
        channel.onclose = () => {
            this._log(`Data channel closed [${connection.uuid}]`);
            this._emit('dataChannelClosed', { uuid: connection.uuid });
        };
    }
    
    /**
     * Create offer
     */
    async _createOffer(connection) {
        const { pc } = connection;
        
        // Add data channel for publishers (sendChannel in VDO.Ninja terminology)
        if (connection.type === 'publisher') {
            const channel = pc.createDataChannel('sendChannel', {
                ordered: true
            });
            this._setupDataChannel(connection, channel);
        }
        
        // Add tracks if publishing
        const stream = this.streams.get(this.state.streamID);
        if (stream && connection.type === 'publisher') {
            for (const track of stream.getTracks()) {
                await this._addTrackToConnection(connection, track, stream);
            }
        }
        
        // Create offer
        const offer = await pc.createOffer({
            offerToReceiveAudio: connection.type === 'viewer',
            offerToReceiveVideo: connection.type === 'viewer'
        });
        
        // Apply codec preferences
        if (this.config.codec) {
            offer.sdp = this._applyCodecPreferences(offer.sdp, this.config.codec);
        }
        
        await pc.setLocalDescription(offer);
        
        return offer;
    }
    
    /**
     * Handle offer/answer descriptions
     */
    async _handleDescription(msg) {
        try {
            let connection = this.connections.get(msg.UUID);
            
            // Determine connection type based on whether we have a pending view
            const pendingStreamID = msg.streamID;
            const hasPendingView = this._pendingViews.has(pendingStreamID);
            
            // Create connection if needed
            if (!connection && msg.description.type === 'offer') {
                // If we have a pending view for this stream, we're the viewer
                const type = hasPendingView ? 'viewer' : 'publisher';
                connection = this._createConnection(msg.UUID, type);
                connection.streamID = msg.streamID;
            }
            
            if (!connection) {
                this._log('No connection for description:', msg.UUID);
                return;
            }
            
            const { pc } = connection;
            
            // Set remote description
            await pc.setRemoteDescription(msg.description);
            
            // Create answer for offers
            if (msg.description.type === 'offer') {
                const answer = await pc.createAnswer();
                
                if (this.config.codec) {
                    answer.sdp = this._applyCodecPreferences(answer.sdp, this.config.codec);
                }
                
                await pc.setLocalDescription(answer);
                
                // Prepare answer message
                const answerMsg = {
                    description: answer,
                    UUID: msg.UUID, // Destination UUID (who sent offer)
                    streamID: this.state.isCustomMode ? this.state.streamIDOriginal : this.state.streamID,
                    session: connection.session
                };
                
                if (this.state.isCustomMode) {
                    answerMsg.from = this.state.uuid;
                    answerMsg.to = msg.UUID;
                } else {
                    // Encrypt if password is set (VDO.Ninja mode)
                    if (this.state.password && this.config.encryptionEnabled) {
                        const [encrypted, iv] = await this._encryptMessage(JSON.stringify(answer));
                        answerMsg.description = encrypted;
                        answerMsg.vector = iv;
                    }
                }
                
                await this._sendSignaling(answerMsg);
                
                // If this was a pending view, resolve it
                if (hasPendingView) {
                    const pending = this._pendingViews.get(pendingStreamID);
                    if (pending) {
                        this._pendingViews.delete(pendingStreamID);
                        pending.resolve(pc);
                    }
                }
            }
        } catch (error) {
            this._log('Description handling error:', error);
            this._emit('error', { type: 'description', error, uuid: msg.UUID });
        }
    }
    
    /**
     * Handle ICE candidates
     */
    async _handleCandidates(msg) {
        const connection = this.connections.get(msg.UUID);
        if (!connection) {
            this._log('No connection for candidates:', msg.UUID);
            return;
        }
        
        const { pc } = connection;
        
        try {
            for (const candidate of msg.candidates) {
                await pc.addIceCandidate(candidate);
            }
        } catch (error) {
            this._log('ICE candidate error:', error);
        }
    }
    
    /**
     * Send bundled ICE candidates
     */
    async _sendCandidates(connection) {
        if (connection.iceBundle.length === 0) return;
        
        const candidatesMsg = {
            candidates: connection.iceBundle,
            UUID: connection.uuid, // Destination UUID
            session: connection.session
        };
        
        if (this.state.isCustomMode) {
            candidatesMsg.from = this.state.uuid;
            candidatesMsg.to = connection.uuid;
        } else {
            // Encrypt if password is set (VDO.Ninja mode)
            if (this.state.password && this.config.encryptionEnabled) {
                const [encrypted, iv] = await this._encryptMessage(JSON.stringify(connection.iceBundle));
                candidatesMsg.candidates = encrypted;
                candidatesMsg.vector = iv;
            }
        }
        
        await this._sendSignaling(candidatesMsg);
        
        connection.iceBundle = [];
    }
    
    /**
     * Handle connection failure
     */
    async _handleConnectionFailed(connection) {
        this._log(`Connection failed [${connection.uuid}]`);
        
        // Try ICE restart for publishers
        if (connection.type === 'publisher') {
            try {
                const offer = await connection.pc.createOffer({ iceRestart: true });
                await connection.pc.setLocalDescription(offer);
                
                const offerMsg = {
                    description: offer,
                    UUID: connection.uuid, // Destination UUID
                    streamID: this.state.isCustomMode ? this.state.streamIDOriginal : this.state.streamID,
                    session: connection.session,
                    iceRestart: true
                };
                
                if (this.state.isCustomMode) {
                    offerMsg.from = this.state.uuid;
                    offerMsg.to = connection.uuid;
                } else {
                    // Encrypt if needed
                    if (this.state.password && this.config.encryptionEnabled) {
                        const [encrypted, iv] = await this._encryptMessage(JSON.stringify(offer));
                        offerMsg.description = encrypted;
                        offerMsg.vector = iv;
                    }
                }
                
                await this._sendSignaling(offerMsg);
            } catch (error) {
                this._log('ICE restart failed:', error);
                this._closeConnection(connection.uuid);
            }
        } else {
            // Request ICE restart from publisher
            const restartMsg = {
                request: 'icerestart',
                UUID: connection.uuid // Destination UUID
            };
            
            if (this.state.isCustomMode) {
                restartMsg.from = this.state.uuid;
                restartMsg.to = connection.uuid;
            }
            
            await this._sendSignaling(restartMsg);
        }
    }
    
    /**
     * Close connection
     */
    _closeConnection(uuid) {
        const connection = this.connections.get(uuid);
        if (!connection) return;
        
        // Send bye message
        const byeMsg = {
            bye: true,
            UUID: uuid, // Destination UUID (who to disconnect from)
            streamID: this.state.isCustomMode ? this.state.streamIDOriginal : this.state.streamID
        };
        
        if (this.state.isCustomMode) {
            byeMsg.from = this.state.uuid;
        }
        
        this._sendSignaling(byeMsg);
        
        // Clean up
        clearTimeout(connection.iceTimer);
        
        if (connection.dataChannel) {
            connection.dataChannel.close();
        }
        
        connection.pc.close();
        
        this.connections.delete(uuid);
        
        this._log(`Connection closed [${uuid}]`);
        this._emit('peerDisconnected', { uuid });
    }
    
    /**
     * Handle signaling disconnect
     */
    _handleSignalingDisconnect() {
        if (this.state.connected) {
            this._emit('disconnected');
            
            // Attempt reconnection
            this._attemptReconnect();
        }
    }
    
    /**
     * Attempt to reconnect
     */
    async _attemptReconnect() {
        let attempts = 0;
        const maxAttempts = this.config.maxReconnectAttempts;
        
        while (attempts < maxAttempts && !this.state.connected) {
            attempts++;
            this._log(`Reconnection attempt ${attempts}/${maxAttempts}`);
            
            try {
                await new Promise(resolve => setTimeout(resolve, this.config.reconnectDelay * attempts));
                await this.connect();
                
                // Rejoin room if we were in one
                if (this.state.room) {
                    await this.joinRoom({
                        room: this.state.room,
                        streamID: this.state.streamIDOriginal,
                        password: this.state.password,
                        directorPassword: this.state.directorPassword
                    });
                }
                
                break;
            } catch (error) {
                this._log('Reconnection failed:', error);
            }
        }
        
        if (!this.state.connected) {
            this._emit('reconnectFailed');
        }
    }
    
    /**
     * Add track to connection
     */
    async _addTrackToConnection(connection, track, stream) {
        const sender = connection.pc.addTrack(track, stream);
        
        // Apply bitrate limits
        if (track.kind === 'video' && this.config.bitrate) {
            const params = sender.getParameters();
            if (!params.encodings) {
                params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = this.config.bitrate * 1000;
            await sender.setParameters(params);
        }
        
        return sender;
    }
    
    /**
     * Apply codec preferences to SDP
     */
    _applyCodecPreferences(sdp, codec) {
        const lines = sdp.split('\r\n');
        const codecMap = {
            'h264': { video: ['42e01f', '42001f', '4d001f', '64001f'], name: 'H264' },
            'vp8': { video: ['VP8'], name: 'VP8' },
            'vp9': { video: ['VP9'], name: 'VP9' },
            'av1': { video: ['AV1X', 'AV1'], name: 'AV1' },
            'opus': { audio: ['opus'], name: 'opus' },
            'pcmu': { audio: ['PCMU'], name: 'PCMU' },
            'pcma': { audio: ['PCMA'], name: 'PCMA' }
        };
        
        const preferred = codecMap[codec.toLowerCase()];
        if (!preferred) return sdp;
        
        // Find m= lines
        const mLineIndexes = [];
        lines.forEach((line, i) => {
            if (line.startsWith('m=')) {
                mLineIndexes.push(i);
            }
        });
        
        // Process each m= line
        mLineIndexes.forEach(mLineIndex => {
            const mLine = lines[mLineIndex];
            const type = mLine.split(' ')[0].split('=')[1];
            
            if ((type === 'video' && preferred.video) || (type === 'audio' && preferred.audio)) {
                // Get payload types for this m= line
                const payloads = [];
                const preferredPayloads = [];
                
                // Find rtpmap lines
                for (let i = mLineIndex + 1; i < lines.length && !lines[i].startsWith('m='); i++) {
                    if (lines[i].startsWith('a=rtpmap:')) {
                        const payload = lines[i].split(' ')[0].split(':')[1];
                        const codecName = lines[i].split(' ')[1];
                        
                        payloads.push(payload);
                        
                        // Check if this is our preferred codec
                        const codecList = type === 'video' ? preferred.video : preferred.audio;
                        if (codecList.some(c => codecName.toUpperCase().includes(c.toUpperCase()))) {
                            preferredPayloads.push(payload);
                        }
                    }
                }
                
                // Reorder payloads
                if (preferredPayloads.length > 0) {
                    const otherPayloads = payloads.filter(p => !preferredPayloads.includes(p));
                    const newPayloads = [...preferredPayloads, ...otherPayloads];
                    
                    // Update m= line
                    const mLineParts = lines[mLineIndex].split(' ');
                    mLineParts.splice(3); // Keep only m=<type> <port> <proto>
                    lines[mLineIndex] = mLineParts.join(' ') + ' ' + newPayloads.join(' ');
                }
            }
        });
        
        return lines.join('\r\n');
    }
    
    // ========== Message Handlers ==========
    
    _handleJoinRoom(msg) {
        this._log('Join room response:', msg);
    }
    
    _handleRoomJoined(msg) {
        this._emit('roomConfirmed', { room: msg.roomid });
    }
    
    _handleRoomFull(msg) {
        this._emit('error', { type: 'roomFull', message: 'Room is full' });
    }
    
    _handleRejected(msg) {
        this._emit('error', { type: 'rejected', message: msg.rejected || 'Connection rejected' });
    }
    
    /**
     * Handle listing - CRITICAL: This completes the room join sequence
     */
    _handleListing(msg) {
        // Mark room join as complete
        if (this.state.joiningRoom) {
            this.state.joiningRoom = false;
            
            // Send seed if we were waiting
            if (this.state.needsSeeding && this.state.streamID && !this.state.hasSeeded) {
                this._sendSignaling({ 
                    request: 'seed', 
                    streamID: this.state.streamID // Already hashed
                }).then(() => {
                    this.state.hasSeeded = true;
                    this.state.needsSeeding = false;
                });
            }
        }
        
        // Handle listing with a list of peers
        if (msg.list && Array.isArray(msg.list)) {
            msg.list.forEach(peer => {
                // Store room participant info
                if (peer.streamID && peer.streamID !== this.state.streamID) {
                    this.roomParticipants.set(peer.streamID, {
                        streamID: peer.streamID,
                        uuid: peer.UUID,
                        label: peer.label,
                        director: peer.director,
                        codirector: peer.codirector,
                        timestamp: Date.now()
                    });
                }
                
                this._emit('peerListing', {
                    streamID: peer.streamID,
                    uuid: peer.UUID,
                    label: peer.label,
                    director: peer.director,
                    codirector: peer.codirector,
                    info: peer
                });
            });
        } else {
            // Single peer listing (old format)
            if (msg.streamID && msg.streamID !== this.state.streamID) {
                this.roomParticipants.set(msg.streamID, {
                    streamID: msg.streamID,
                    uuid: msg.UUID,
                    label: msg.label,
                    director: msg.director,
                    codirector: msg.codirector,
                    timestamp: Date.now()
                });
            }
            
            this._emit('peerListing', {
                streamID: msg.streamID,
                uuid: msg.UUID,
                label: msg.label,
                director: msg.director,
                codirector: msg.codirector,
                info: msg
            });
        }
    }
    
    _handleSomeoneJoined(msg) {
        // Store new participant
        if (msg.streamID && msg.streamID !== this.state.streamID) {
            this.roomParticipants.set(msg.streamID, {
                streamID: msg.streamID,
                uuid: msg.UUID,
                timestamp: Date.now()
            });
        }
        
        this._emit('someoneJoined', {
            streamID: msg.streamID,
            uuid: msg.UUID
        });
    }
    
    _handleVideoAddedToRoom(msg) {
        // Store new participant
        if (msg.streamID && msg.streamID !== this.state.streamID) {
            this.roomParticipants.set(msg.streamID, {
                streamID: msg.streamID,
                uuid: msg.UUID,
                timestamp: Date.now()
            });
        }
        
        this._emit('videoAddedToRoom', {
            streamID: msg.streamID,
            uuid: msg.UUID
        });
    }
    
    /**
     * Handle play request from server (viewer wants to view us)
     * NOTE: In VDO.Ninja, this is typically not received directly
     * Instead, the server transforms it to offerSDP
     */
    async _handlePlayRequest(msg) {
        this._log('Play request received (unexpected - should be offerSDP):', msg);
        // Treat it as offerSDP
        await this._handleOfferSDP(msg);
    }
    
    /**
     * Handle offerSDP request - KEY FIX
     * This is what the server sends when someone wants to view our stream
     */
    async _handleOfferSDP(msg) {
        this._log('OfferSDP request received from:', msg.UUID);
        
        // Create connection and send offer
        const connection = this._createConnection(msg.UUID, 'publisher');
        connection.streamID = msg.streamID;
        
        // Create offer
        const offer = await this._createOffer(connection);
        
        // Prepare offer message
        const offerMsg = {
            description: offer,
            UUID: msg.UUID, // Destination UUID (who requested)
            streamID: this.state.isCustomMode ? this.state.streamIDOriginal : this.state.streamID,
            session: connection.session
        };
        
        if (this.state.isCustomMode) {
            offerMsg.from = this.state.uuid;
            offerMsg.to = msg.UUID;
        } else {
            // Encrypt if needed
            if (this.state.password && this.config.encryptionEnabled) {
                const [encrypted, iv] = await this._encryptMessage(JSON.stringify(offer));
                offerMsg.description = encrypted;
                offerMsg.vector = iv;
            }
        }
        
        await this._sendSignaling(offerMsg);
    }
    
    async _handlePlayerReady(msg) {
        // Publisher is ready for us to connect
        this._log('Player ready from:', msg.streamID);
        
        // Check if we have a pending view for this stream
        const pending = this._pendingViews.get(msg.streamID);
        if (!pending) {
            this._log('No pending view for stream:', msg.streamID);
            return;
        }
        
        // The publisher will send an offer after playerready, so we just wait
        // The offer will be handled in _handleDescription which will resolve the pending promise
    }
    
    _handlePeerConnection(msg) {
        this._log('Peer connection event:', msg);
    }
    
    _handlePeerClose(msg) {
        this._closeConnection(msg.UUID);
    }
    
    _handleBye(msg) {
        this._closeConnection(msg.UUID);
    }
    
    _handleIceRestart(msg) {
        const connection = this.connections.get(msg.UUID);
        if (connection) {
            this._handleConnectionFailed(connection);
        }
    }
    
    _handleDataChannel(msg) {
        this._log('Data channel message:', msg);
    }
    
    _handlePipe(msg) {
        // Pipe messages are forwarded through signaling
        this._emit('pipe', {
            data: msg.pipe,
            uuid: msg.UUID,
            streamID: msg.streamID
        });
    }
    
    _handleMigrate(msg) {
        this._emit('migrate', {
            room: msg.roomid,
            serverURL: msg.webrtcserver
        });
    }
    
    async _handleBitrate(msg) {
        if (msg.bitrate !== undefined) {
            await this.setBitrate(msg.bitrate, msg.UUID);
        }
    }
    
    async _handleRequestStats(msg) {
        const stats = await this.getStats(msg.UUID);
        // TODO: Send stats back
    }
    
    // ========== Utility Methods ==========
    
    /**
     * Generate UUID
     */
    _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    /**
     * Generate stream ID
     */
    _generateStreamID() {
        return Math.random().toString(36).substring(2, 9);
    }
    
    /**
     * Generate session ID
     */
    _generateSessionID() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
    
    /**
     * Generate message ID
     */
    _generateMessageID() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    }
    
    /**
     * Emit event
     */
    _emit(event, data = {}) {
        this.dispatchEvent(new CustomEvent(event, { detail: data }));
    }
    
    /**
     * Debug logging
     */
    _log(...args) {
        if (this.config.debug) {
            console.log(`[VDONinja-SDK:${this.config.mode}]`, ...args);
        }
    }
    
    /**
     * Add one-time event listener
     */
    once(event, callback) {
        const handler = (e) => {
            callback(e.detail);
            this.removeEventListener(event, handler);
        };
        this.addEventListener(event, handler);
    }
}

// Export for various environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VDONinjaSDK;
} else if (typeof define === 'function' && define.amd) {
    define([], () => VDONinjaSDK);
} else {
    window.VDONinjaSDK = VDONinjaSDK;
}

(function() {
    'use strict';
    
    // Check if SDK is available
    if (typeof VDONinjaSDK === 'undefined') {
        console.error('VDONinjaSDK not found! Make sure the SDK is loaded properly.');
        return;
    }
    
    // Early initialization: Hook RTCPeerConnection to capture audio streams
    (function setupRTCHook() {
        if (window._rtcHookInstalled) return;
        window._rtcHookInstalled = true;
        window._rtcAudioStreams = new Set();
        window._rtcPeerConnections = new Set();
        
        const OriginalRTCPeerConnection = window.RTCPeerConnection;
        
        window.RTCPeerConnection = function(...args) {
            const pc = new OriginalRTCPeerConnection(...args);
            window._rtcPeerConnections.add(pc);
            
            // Listen for remote streams
            pc.addEventListener('track', (event) => {
                if (event.track.kind === 'audio' && event.streams[0]) {
                    console.log('[RTC Hook] Captured remote audio track:', event.track.label);
                    window._rtcAudioStreams.add(event.streams[0]);
                }
            });
            
            // Also capture local streams when added
            const originalAddStream = pc.addStream;
            if (originalAddStream) {
                pc.addStream = function(stream) {
                    if (stream.getAudioTracks().length > 0) {
                        console.log('[RTC Hook] Captured local audio stream');
                        window._rtcAudioStreams.add(stream);
                    }
                    return originalAddStream.apply(this, arguments);
                };
            }
            
            const originalAddTrack = pc.addTrack;
            if (originalAddTrack) {
                pc.addTrack = function(track, ...streams) {
                    if (track.kind === 'audio' && streams[0]) {
                        console.log('[RTC Hook] Captured local audio track:', track.label);
                        window._rtcAudioStreams.add(streams[0]);
                    }
                    return originalAddTrack.apply(this, arguments);
                };
            }
            
            return pc;
        };
        
        // Copy static methods and properties
        Object.setPrototypeOf(window.RTCPeerConnection, OriginalRTCPeerConnection);
        Object.setPrototypeOf(window.RTCPeerConnection.prototype, OriginalRTCPeerConnection.prototype);
        
        console.log('[RTC Hook] RTCPeerConnection hook installed');
    })();
    
    // Configuration
    const ROOM_ID = 'autopublish_' + Math.random().toString(36).substring(7);
    const VDO_NINJA_URL = 'https://vdo.ninja';
    
    // Map to track published videos and their VDO instances
    const publishedVideos = new Map();
    
    // Group scene overlay element
    let groupSceneOverlay = null;
    
    // Track when page loaded to delay overlays
    const pageLoadTime = Date.now();
    const OVERLAY_DELAY = 3000; // 3 seconds
    
    // Track if VDO.Ninja is enabled
    let vdoNinjaEnabled = false;
    
    // Settings from background script
    let settings = {};
    
    // Check initial state
    chrome.storage.local.get(['vdoninjadiscord'], function(result) {
        vdoNinjaEnabled = result.vdoninjadiscord === true;
        if (vdoNinjaEnabled) {
            console.log('VDO.Ninja Direct WebRTC Auto-Publisher initialized');
            console.log('Room ID:', ROOM_ID);
            console.log(`View URL: ${VDO_NINJA_URL}/?room=${ROOM_ID}&scene`);
            // Process any videos that loaded before we got the setting
            processExistingVideos();
        } else {
            console.log('VDO.Ninja Discord integration is disabled');
        }
    });
    
    // Listen for changes to the setting
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.vdoninjadiscord) {
            const wasEnabled = vdoNinjaEnabled;
            vdoNinjaEnabled = changes.vdoninjadiscord.newValue === true;
            
            console.log('VDO.Ninja Discord setting changed:', vdoNinjaEnabled);
            
            if (!wasEnabled && vdoNinjaEnabled) {
                // Just enabled - start processing videos
                console.log('VDO.Ninja enabled, starting video processing');
                processExistingVideos();
            } else if (wasEnabled && !vdoNinjaEnabled) {
                // Just disabled - clean up everything
                console.log('VDO.Ninja disabled, cleaning up');
                cleanupAllVideos();
            }
        }
    });
    
    function generateStreamId() {
        return 'video_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    }
    
    // Helper function to analyze audio sources on the page
    function analyzeAudioSources() {
        console.log('=== Analyzing Audio Sources ===');
        
        // Check all video elements
        const videos = document.querySelectorAll('video');
        console.log(`Found ${videos.length} video elements:`);
        videos.forEach((video, i) => {
            console.log(`Video ${i}:`, {
                hasAudio: video.mozHasAudio || video.webkitAudioDecodedByteCount > 0 || false,
                muted: video.muted,
                volume: video.volume,
                paused: video.paused,
                src: video.src || video.currentSrc,
                audioTracks: video.audioTracks?.length || 'N/A'
            });
        });
        
        // Check all audio elements
        const audios = document.querySelectorAll('audio');
        console.log(`\nFound ${audios.length} audio elements:`);
        audios.forEach((audio, i) => {
            console.log(`Audio ${i}:`, {
                muted: audio.muted,
                volume: audio.volume,
                paused: audio.paused,
                src: audio.src || audio.currentSrc
            });
        });
        
        // Check for Web Audio API nodes
        if (window.AudioContext || window.webkitAudioContext) {
            console.log('\nWeb Audio API is available');
        }
        
        // Check for any iframe that might contain media
        const iframes = document.querySelectorAll('iframe');
        console.log(`\nFound ${iframes.length} iframes (may contain media)`);
        
        console.log('=== End Audio Analysis ===');
    }
    
    // Helper function to capture tab audio properly
    async function captureTabAudioStream() {
        return new Promise((resolve) => {
            // Check if we have chrome.tabCapture available (we're in extension context)
            if (typeof chrome !== 'undefined' && chrome.tabCapture && chrome.tabCapture.capture) {
                chrome.tabCapture.capture({
                    audio: true,
                    video: false
                }, (stream) => {
                    if (chrome.runtime.lastError) {
                        console.error('Direct tab capture failed:', chrome.runtime.lastError);
                        resolve(null);
                    } else {
                        console.log('Successfully captured tab audio directly');
                        resolve(stream);
                    }
                });
            } else {
                // We're in content script, need to request from background
                console.log('Requesting tab audio capture from background...');
                chrome.runtime.sendMessage({
                    type: 'captureTabAudio'
                }, (response) => {
                    if (response && response.error) {
                        console.error('Background tab capture failed:', response.error);
                        resolve(null);
                    } else {
                        // Note: We can't actually get the stream this way
                        // This is a limitation of Chrome extensions
                        console.log('Tab capture initiated but stream not accessible from content script');
                        resolve(null);
                    }
                });
            }
        });
    }
    
    // Clean up all published videos
    function cleanupAllVideos() {
        console.log('Cleaning up all published videos...');
        const videosCopy = [...publishedVideos.keys()];
        videosCopy.forEach(video => {
            unpublishVideo(video);
        });
        
        // Remove group scene overlay
        if (groupSceneOverlay && groupSceneOverlay.parentNode) {
            groupSceneOverlay.remove();
            groupSceneOverlay = null;
        }
    }
    
    async function publishVideo(videoElement) {
        // Check if VDO Ninja is enabled
        if (!vdoNinjaEnabled) {
            console.log('VDO.Ninja is disabled, skipping video publish');
            return;
        }
        
        // Skip if already published
        if (publishedVideos.has(videoElement)) {
            console.log('Video already published, skipping');
            return;
        }
        
        // Wait for video to be ready
        if (videoElement.readyState < 2) { // HAVE_CURRENT_DATA
            console.log('Video not ready, waiting for data');
            videoElement.addEventListener('loadeddata', () => {
                publishVideo(videoElement);
            }, { once: true });
            return;
        }
        
        // Wait for video dimensions
        if (!videoElement.videoWidth || !videoElement.videoHeight) {
            console.log('Video dimensions not available, waiting');
            videoElement.addEventListener('loadedmetadata', () => {
                publishVideo(videoElement);
            }, { once: true });
            return;
        }
        
        const streamId = generateStreamId();
        
        // Try to extract label from various sources
        let label = null;
        
        // Helper to clean up labels
        const cleanLabel = (text) => {
            if (!text) return null;
            // Remove extra whitespace and limit length
            return text.trim().replace(/\s+/g, ' ').substring(0, 50);
        };
        
        try {
            // Strategy 1: Microsoft Teams - Call tile aria-label
            if (!label) {
                const callTile = videoElement.parentElement?.parentElement?.querySelector('[aria-label^="Call tile,"]');
                if (callTile) {
                    const ariaLabel = callTile.getAttribute("aria-label");
                    if (ariaLabel && ariaLabel.startsWith("Call tile, ")) {
                        label = ariaLabel.split("Call tile, ")[1];
                        console.log('Found Teams call tile label:', label);
                    }
                }
            }
            
            // Strategy 2: Zoom - Various label locations
            if (!label) {
                // Zoom participant name
                const zoomName = videoElement.parentElement?.querySelector('.participant-name, .video-avatar__participant-name, [class*="participant-name"]');
                if (zoomName && zoomName.textContent) {
                    label = cleanLabel(zoomName.textContent);
                    console.log('Found Zoom participant name:', label);
                }
            }
            
            // Strategy 3: Google Meet - Name overlays
            if (!label) {
                const meetName = videoElement.parentElement?.querySelector('[jsname*="name"], [data-participant-id], .rG0ybd');
                if (meetName && meetName.textContent) {
                    label = cleanLabel(meetName.textContent);
                    console.log('Found Google Meet name:', label);
                }
            }
            
            // Strategy 4: YouTube - Video title
            if (!label && window.location.hostname.includes('youtube.com')) {
                // Try various YouTube title selectors
                const ytTitle = document.querySelector('h1.ytd-video-primary-info-renderer, h1.title, ytd-video-primary-info-renderer h1, #title h1');
                if (ytTitle && ytTitle.textContent) {
                    label = cleanLabel(ytTitle.textContent);
                    console.log('Found YouTube title:', label);
                }
            }
            
            // Strategy 5: Data attributes on video element
            if (!label) {
                // Common data attributes that might contain names/titles
                const dataAttrs = ['data-name', 'data-title', 'data-participant-name', 'data-user-name', 'data-display-name', 'data-label'];
                for (const attr of dataAttrs) {
                    if (videoElement.hasAttribute(attr)) {
                        label = cleanLabel(videoElement.getAttribute(attr));
                        if (label) {
                            console.log(`Found label in ${attr}:`, label);
                            break;
                        }
                    }
                }
            }
            
            // Strategy 6: Title attribute on video or parent elements
            if (!label) {
                // Check video element first
                if (videoElement.title) {
                    label = cleanLabel(videoElement.title);
                    console.log('Found video title attribute:', label);
                } else {
                    // Check immediate parent only
                    const parent = videoElement.parentElement;
                    if (parent && parent.title) {
                        label = cleanLabel(parent.title);
                        console.log('Found parent title attribute:', label);
                    }
                }
            }
            
            // Strategy 7: Twitch - Stream title or username
            if (!label && window.location.hostname.includes('twitch.tv')) {
                const streamTitle = document.querySelector('[data-a-target="stream-title"], .stream-title, h2[title]');
                if (streamTitle && streamTitle.textContent) {
                    label = cleanLabel(streamTitle.textContent);
                    console.log('Found Twitch stream title:', label);
                }
            }
            
            // Strategy 8: Generic overlay text
            if (!label) {
                // Look for text overlays that might contain names
                const overlay = videoElement.parentElement?.querySelector('.name, .username, .display-name, .participant, [class*="name"]:not(script)');
                if (overlay && overlay.textContent && overlay.textContent.length < 50) {
                    label = cleanLabel(overlay.textContent);
                    console.log('Found overlay text:', label);
                }
            }
            
            // Strategy 9: Vimeo - Video title
            if (!label && window.location.hostname.includes('vimeo.com')) {
                const vimeoTitle = document.querySelector('.vp-title, h1[class*="Title"]');
                if (vimeoTitle && vimeoTitle.textContent) {
                    label = cleanLabel(vimeoTitle.textContent);
                    console.log('Found Vimeo title:', label);
                }
            }
            
            // Strategy 10: Discord - Username in video call
            if (!label) {
                const discordName = videoElement.parentElement?.querySelector('[class*="nameTag"], [class*="username"]');
                if (discordName && discordName.textContent) {
                    label = cleanLabel(discordName.textContent);
                    console.log('Found Discord username:', label);
                }
            }
            
        } catch (e) {
            console.log('Error extracting label:', e);
        }
        
        console.log('Publishing video:', streamId, {
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
            duration: videoElement.duration,
            muted: videoElement.muted,
            paused: videoElement.paused,
            label: label || ''
        });
        
        try {
            // Create a new SDK instance for this video
            const vdo = new VDONinjaSDK({
                bitrate: 2500, // Video bitrate in kbps
                codec: 'h264', // Better compatibility
                debug: true, // Enable debug logging
                wss: 'wss://wss.vdo.ninja:443', // Use main WSS server
                mode: 'vdoninja' // Use VDO.Ninja mode (not custom)
            });
            
            // Add event listeners
            vdo.addEventListener('error', (e) => {
                console.error('SDK Error:', e.detail);
            });
            
            vdo.addEventListener('peerConnected', (e) => {
                console.log('Peer connected:', e.detail);
            });
            
            vdo.addEventListener('track', (e) => {
                console.log('Track received:', e.detail);
            });
            
            // Create media stream from video element
            let stream = null;
            let captureMethod = 'direct';
            
            try {
                // Try to capture both video and audio
                if (videoElement.captureStream) {
                    stream = videoElement.captureStream(30);
                } else if (videoElement.mozCaptureStream) {
                    stream = videoElement.mozCaptureStream(30);
                } else {
                    throw new Error('captureStream not supported');
                }
                
                console.log('Captured stream:', {
                    videoTracks: stream.getVideoTracks().length,
                    audioTracks: stream.getAudioTracks().length
                });
                
                // If video is muted or has no audio track, stream might not have audio
                if (stream.getAudioTracks().length === 0) {
                    console.log('No audio tracks captured, trying multiple audio capture methods...');
                    
                    // Strategy 1: Try to capture from the video element itself using Web Audio API
                    if (!videoElement.muted && videoElement.volume > 0) {
                        try {
                            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                            const source = audioContext.createMediaElementSource(videoElement);
                            const destination = audioContext.createMediaStreamDestination();
                            
                            // Connect audio graph
                            source.connect(destination);
                            source.connect(audioContext.destination); // Also play audio normally
                            
                            // Add audio track to stream
                            const audioTrack = destination.stream.getAudioTracks()[0];
                            if (audioTrack) {
                                stream.addTrack(audioTrack);
                                console.log('Added audio track from video element via Web Audio API');
                            }
                        } catch (audioErr) {
                            console.warn('Could not add audio track from video element:', audioErr);
                        }
                    }
                    
                    // Strategy 2: Look for nearby audio elements
                    if (stream.getAudioTracks().length === 0) {
                        try {
                            // Look for audio elements in the same container or nearby
                            const parent = videoElement.closest('div, section, article') || document.body;
                            const audioElements = parent.querySelectorAll('audio');
                            
                            for (const audioEl of audioElements) {
                                if (!audioEl.paused && !audioEl.muted && audioEl.volume > 0) {
                                    console.log('Found playing audio element:', audioEl);
                                    
                                    try {
                                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                        const source = audioContext.createMediaElementSource(audioEl);
                                        const destination = audioContext.createMediaStreamDestination();
                                        
                                        source.connect(destination);
                                        source.connect(audioContext.destination);
                                        
                                        const audioTrack = destination.stream.getAudioTracks()[0];
                                        if (audioTrack) {
                                            stream.addTrack(audioTrack);
                                            console.log('Added audio track from nearby audio element');
                                            break;
                                        }
                                    } catch (e) {
                                        console.warn('Could not capture from audio element:', e);
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Error searching for audio elements:', e);
                        }
                    }
                    
                    // Strategy 3: Try to find any media elements with audio
                    if (stream.getAudioTracks().length === 0) {
                        try {
                            // Find all media elements on the page
                            const allMedia = [...document.querySelectorAll('video, audio')];
                            
                            for (const mediaEl of allMedia) {
                                // Skip the current video element and check if media has audio
                                if (mediaEl !== videoElement && !mediaEl.paused && !mediaEl.muted && mediaEl.volume > 0) {
                                    try {
                                        // Try to capture stream directly first
                                        let mediaStream = null;
                                        if (mediaEl.captureStream) {
                                            mediaStream = mediaEl.captureStream();
                                        } else if (mediaEl.mozCaptureStream) {
                                            mediaStream = mediaEl.mozCaptureStream();
                                        }
                                        
                                        if (mediaStream && mediaStream.getAudioTracks().length > 0) {
                                            const audioTrack = mediaStream.getAudioTracks()[0];
                                            stream.addTrack(audioTrack);
                                            console.log('Added audio track from another media element:', mediaEl);
                                            break;
                                        }
                                    } catch (e) {
                                        console.warn('Could not capture from media element:', e);
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Error searching for media elements:', e);
                        }
                    }
                    
                    // Strategy 4: WebRTC-based audio capture (Discord, Teams, etc.)
                    if (stream.getAudioTracks().length === 0) {
                        console.log('Attempting WebRTC audio capture...');
                        try {
                            // Method 1: Look for audio elements with MediaStream sources
                            const audioElements = document.querySelectorAll('audio');
                            for (const audioEl of audioElements) {
                                if (audioEl.srcObject && audioEl.srcObject instanceof MediaStream) {
                                    const audioTracks = audioEl.srcObject.getAudioTracks();
                                    if (audioTracks.length > 0) {
                                        const clonedTrack = audioTracks[0].clone();
                                        stream.addTrack(clonedTrack);
                                        console.log('Added WebRTC audio track from audio element');
                                        
                                        if (!publishInfo.additionalTracks) {
                                            publishInfo.additionalTracks = [];
                                        }
                                        publishInfo.additionalTracks.push(clonedTrack);
                                        break;
                                    }
                                }
                            }
                            
                            // Method 2: Check already captured RTC audio streams
                            if (stream.getAudioTracks().length === 0 && window._rtcAudioStreams && window._rtcAudioStreams.size > 0) {
                                console.log(`Found ${window._rtcAudioStreams.size} captured RTC audio streams`);
                                for (const rtcStream of window._rtcAudioStreams) {
                                    const audioTracks = rtcStream.getAudioTracks();
                                    if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
                                        const clonedTrack = audioTracks[0].clone();
                                        stream.addTrack(clonedTrack);
                                        console.log('Added WebRTC audio track from captured peer connection');
                                        
                                        if (!publishInfo.additionalTracks) {
                                            publishInfo.additionalTracks = [];
                                        }
                                        publishInfo.additionalTracks.push(clonedTrack);
                                        break;
                                    }
                                }
                            }
                            
                            // Method 3: Check existing RTCPeerConnections for streams
                            if (stream.getAudioTracks().length === 0 && window._rtcPeerConnections && window._rtcPeerConnections.size > 0) {
                                console.log(`Checking ${window._rtcPeerConnections.size} peer connections for audio`);
                                for (const pc of window._rtcPeerConnections) {
                                    // Check remote streams
                                    const receivers = pc.getReceivers();
                                    for (const receiver of receivers) {
                                        if (receiver.track && receiver.track.kind === 'audio' && receiver.track.readyState === 'live') {
                                            const clonedTrack = receiver.track.clone();
                                            stream.addTrack(clonedTrack);
                                            console.log('Added audio track from peer connection receiver');
                                            
                                            if (!publishInfo.additionalTracks) {
                                                publishInfo.additionalTracks = [];
                                            }
                                            publishInfo.additionalTracks.push(clonedTrack);
                                            break;
                                        }
                                    }
                                    if (stream.getAudioTracks().length > 0) break;
                                }
                            }
                        } catch (e) {
                            console.warn('WebRTC audio capture failed:', e);
                        }
                    }
                    
                    // Strategy 5: Check if video element has audio but it's not in the stream
                    if (stream.getAudioTracks().length === 0) {
                        try {
                            // Some video elements report having audio differently
                            const hasAudioTrack = videoElement.audioTracks && videoElement.audioTracks.length > 0;
                            const hasDecodedAudio = videoElement.webkitAudioDecodedByteCount > 0;
                            const hasMozAudio = videoElement.mozHasAudio === true;
                            
                            console.log('Video audio detection:', {
                                hasAudioTrack,
                                hasDecodedAudio,
                                hasMozAudio,
                                readyState: videoElement.readyState,
                                networkState: videoElement.networkState
                            });
                            
                            // If video reports having audio, try creating a new stream
                            if (hasAudioTrack || hasDecodedAudio || hasMozAudio) {
                                console.log('Video reports having audio, attempting alternative capture...');
                                
                                // Clone the video element and try to capture from it
                                const clonedVideo = videoElement.cloneNode(true);
                                clonedVideo.style.display = 'none';
                                document.body.appendChild(clonedVideo);
                                clonedVideo.muted = false;
                                clonedVideo.volume = 1;
                                
                                await clonedVideo.play();
                                
                                const clonedStream = clonedVideo.captureStream ? 
                                    clonedVideo.captureStream() : 
                                    clonedVideo.mozCaptureStream ? 
                                        clonedVideo.mozCaptureStream() : 
                                        null;
                                
                                if (clonedStream && clonedStream.getAudioTracks().length > 0) {
                                    const audioTrack = clonedStream.getAudioTracks()[0];
                                    stream.addTrack(audioTrack);
                                    console.log('Added audio track from cloned video element');
                                    
                                    // Clean up after a delay
                                    setTimeout(() => {
                                        clonedVideo.pause();
                                        clonedVideo.remove();
                                    }, 1000);
                                } else {
                                    clonedVideo.remove();
                                }
                            }
                        } catch (e) {
                            console.warn('Error with alternative audio capture:', e);
                        }
                    }
					
					// Strategy 6: Try to unmute video and recapture if it's muted
					if (stream.getAudioTracks().length === 0 && videoElement.muted) {
						console.log('Video is muted, attempting to unmute and recapture...');
						try {
							// Store original muted state
							const wasMuted = videoElement.muted;
							videoElement.muted = false;
							videoElement.volume = 1;
							
							// Wait a bit for audio to start
							await new Promise(resolve => setTimeout(resolve, 100));
							
							// Try to recapture with audio
							const newStream = videoElement.captureStream ? 
								videoElement.captureStream(30) : 
								videoElement.mozCaptureStream ? 
									videoElement.mozCaptureStream(30) : 
									null;
							
							if (newStream && newStream.getAudioTracks().length > 0) {
								// Replace the stream's tracks
								const newAudioTrack = newStream.getAudioTracks()[0];
								stream.addTrack(newAudioTrack);
								console.log('Added audio track after unmuting video');
								
								// Keep video unmuted for continuous audio
							} else {
								// Restore muted state if it didn't work
								videoElement.muted = wasMuted;
							}
						} catch (e) {
							console.warn('Unmute strategy failed:', e);
						}
					}
					
					// Strategy 7: Use Web Audio API to capture tab audio from AudioContext
					if (stream.getAudioTracks().length === 0) {
						console.log('Attempting to capture tab audio using AudioContext...');
						try {
							// Create an audio context
							const audioContext = new (window.AudioContext || window.webkitAudioContext)();
							
							// For Discord/Teams, try to find any active AudioContext sources
							// This is a bit hacky but might work
							const destination = audioContext.createMediaStreamDestination();
							
							// Try to capture from all media elements on the page
							const allMedia = [...document.querySelectorAll('video, audio')];
							let connectedSources = 0;
							
							for (const mediaEl of allMedia) {
								if (!mediaEl.paused || mediaEl.srcObject) {
									try {
										const source = audioContext.createMediaElementSource(mediaEl);
										source.connect(destination);
										source.connect(audioContext.destination); // Also output to speakers
										connectedSources++;
										console.log('Connected media element to audio graph:', mediaEl);
									} catch (e) {
										// Element might already be connected to another context
										console.log('Could not connect media element:', e.message);
									}
								}
							}
							
							if (connectedSources > 0 && destination.stream.getAudioTracks().length > 0) {
								const audioTrack = destination.stream.getAudioTracks()[0];
								stream.addTrack(audioTrack);
								console.log(`Added merged audio from ${connectedSources} sources`);
								
								// Store these for later when publishInfo is created
								if (!videoElement._pendingAudioResources) {
									videoElement._pendingAudioResources = {
										tracks: [],
										contexts: []
									};
								}
								videoElement._pendingAudioResources.tracks.push(audioTrack);
								videoElement._pendingAudioResources.contexts.push(audioContext);
							}
						} catch (e) {
							console.warn('AudioContext capture failed:', e);
						}
					}
                    
                    // Log final audio status
                    if (stream.getAudioTracks().length > 0) {
                        console.log('Successfully added audio to stream');
                        // Log detailed audio track info
                        stream.getAudioTracks().forEach((track, i) => {
                            console.log(`Audio track ${i}:`, {
                                id: track.id,
                                label: track.label,
                                kind: track.kind,
                                enabled: track.enabled,
                                muted: track.muted,
                                readyState: track.readyState,
                                settings: track.getSettings ? track.getSettings() : 'N/A'
                            });
                        });
                    } else {
                        console.warn('No audio tracks could be added to the stream');
                        console.log('Debugging info:');
                        console.log('- Video element muted:', videoElement.muted);
                        console.log('- Video element volume:', videoElement.volume);
                        console.log('- Video element has audio track:', videoElement.audioTracks?.length);
                        console.log('- WebRTC audio streams captured:', window._rtcAudioStreams?.size || 0);
                        
                        // Try one last manual approach for Discord
                        if (window.location.hostname.includes('discord.com')) {
                            console.log('Attempting Discord-specific manual audio capture...');
                            // Discord uses specific class names for video containers
                            const videoContainer = videoElement.closest('[class*="videoWrapper"]') || videoElement.parentElement;
                            if (videoContainer) {
                                const allAudio = videoContainer.querySelectorAll('audio');
                                console.log(`Found ${allAudio.length} audio elements in video container`);
                            }
                        }
                    }
                }
                
            } catch (captureErr) {
                console.error('Failed to capture stream from video, using canvas fallback:', captureErr);
                captureMethod = 'canvas';
                
                // Fallback: Create canvas and capture from it
                const canvas = document.createElement('canvas');
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                const ctx = canvas.getContext('2d');
                
                // Draw video to canvas at interval
                const fps = 30;
                const drawInterval = setInterval(() => {
                    if (videoElement.paused || videoElement.ended) {
                        return;
                    }
                    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                }, 1000 / fps);
                
                // Get stream from canvas
                stream = canvas.captureStream(fps);
                
                // Store canvas info for cleanup
                publishedVideos.set(videoElement, { 
                    canvas, 
                    drawInterval,
                    fallbackMode: true 
                });
            }
            
            // Validate we have a stream
            if (!stream || !(stream instanceof MediaStream)) {
                throw new Error('Failed to create MediaStream from video element');
            }
            
            // Store publish info
            const publishInfo = publishedVideos.get(videoElement) || {};
            publishInfo.vdo = vdo;
            publishInfo.streamId = streamId;
            publishInfo.stream = stream;
            publishInfo.captureMethod = captureMethod;
            publishInfo.label = label || '';
            
            // Add any pending audio resources
            if (videoElement._pendingAudioResources) {
                publishInfo.additionalTracks = videoElement._pendingAudioResources.tracks;
                publishInfo.audioContext = videoElement._pendingAudioResources.contexts[0];
                delete videoElement._pendingAudioResources;
            }
            
            publishedVideos.set(videoElement, publishInfo);
            
            // Connect to signaling server
            console.log('Connecting to VDO.Ninja signaling...');
            await vdo.connect();
            console.log('Connected to signaling');
            
            // Store the stream first
            console.log('Stream details:', { 
                stream, 
                streamId, 
                isMediaStream: stream instanceof MediaStream,
                tracks: stream ? stream.getTracks().map(t => ({kind: t.kind, enabled: t.enabled, readyState: t.readyState})) : null
            });
            
            
            // Join room
            console.log('Joining room:', ROOM_ID);
            await vdo.joinRoom({
                room: ROOM_ID,
                streamID: streamId,
                push: streamId // Alias for streamID
            });
            console.log('Joined room successfully');
			
			
            // Publish the stream
            console.log('Publishing stream...');
            await vdo.publish(stream, { 
                streamID: streamId,
                label: label || ''
            });
            console.log('Published stream:', streamId, 'with label:', label || '');
            
            
            // Add visual indicator
            addPublishingIndicator(videoElement, streamId, stream, label);
            
            // Monitor video element for removal or state changes
            monitorVideoElement(videoElement);
            
            // Update group scene overlay
            createOrUpdateGroupSceneOverlay();
            
        } catch (error) {
            console.error('Error publishing video:', error);
            // Clean up on error
            const publishInfo = publishedVideos.get(videoElement);
            if (publishInfo) {
                if (publishInfo.vdo) {
                    publishInfo.vdo.disconnect();
                }
                if (publishInfo.drawInterval) {
                    clearInterval(publishInfo.drawInterval);
                }
                if (publishInfo.canvas) {
                    publishInfo.canvas.remove();
                }
                publishedVideos.delete(videoElement);
            }
        }
    }
    
    function monitorVideoElement(videoElement) {
        const publishInfo = publishedVideos.get(videoElement);
        if (!publishInfo) return;
        
        // Monitor for video element removal
        const observer = new MutationObserver(() => {
            if (!document.contains(videoElement)) {
                // Check if this is a temporary removal (e.g., due to page interaction)
                // Wait a bit before unpublishing to avoid false positives
                setTimeout(() => {
                    if (!document.contains(videoElement) && publishedVideos.has(videoElement)) {
                        console.log('Video element removed from DOM');
                        unpublishVideo(videoElement);
                        observer.disconnect();
                    }
                }, 1000);
            }
        });
        
        observer.observe(videoElement.parentElement || document.body, {
            childList: true,
            subtree: true
        });
        
        // Monitor video events
        const handleVideoEnd = () => {
            console.log('Video ended');
            unpublishVideo(videoElement);
        };
        
        const handleVideoError = (e) => {
            console.error('Video error:', e);
            unpublishVideo(videoElement);
        };
        
        const handleVideoSourceChange = () => {
            console.log('Video source changed, republishing...');
            unpublishVideo(videoElement).then(() => {
                setTimeout(() => publishVideo(videoElement), 500);
            });
        };
        
        const handleVideoPlay = () => {
            console.log('Video started playing');
            // If not already published, publish it
            if (!publishedVideos.has(videoElement)) {
                publishVideo(videoElement);
            }
        };
        
        const handleVideoPause = () => {
            console.log('Video paused');
            // Keep publishing even when paused
        };
        
        videoElement.addEventListener('ended', handleVideoEnd);
        videoElement.addEventListener('error', handleVideoError);
        videoElement.addEventListener('emptied', handleVideoSourceChange);
        videoElement.addEventListener('play', handleVideoPlay);
        videoElement.addEventListener('pause', handleVideoPause);
        
        // Store cleanup info
        publishInfo.observer = observer;
        publishInfo.eventHandlers = {
            ended: handleVideoEnd,
            error: handleVideoError,
            emptied: handleVideoSourceChange,
            play: handleVideoPlay,
            pause: handleVideoPause
        };
    }
    
    async function unpublishVideo(videoElement) {
        const publishInfo = publishedVideos.get(videoElement);
        if (!publishInfo) {
            return;
        }
        
        console.log('Unpublishing video:', publishInfo.streamId);
        
        try {
            // Disconnect this video's SDK instance
            if (publishInfo.vdo) {
                await publishInfo.vdo.disconnect();
            }
            
            // Only stop tracks if we're using canvas fallback
            // Don't stop tracks from captureStream as it will stop the video
            if (publishInfo.captureMethod === 'canvas' && publishInfo.stream) {
                publishInfo.stream.getTracks().forEach(track => {
                    track.stop();
                });
            }
            
            // Stop any additional tracks (like tab audio) that we created
            if (publishInfo.additionalTracks) {
                publishInfo.additionalTracks.forEach(track => {
                    track.stop();
                });
            }
            
            // Close audio context if we created one
            if (publishInfo.audioContext) {
                publishInfo.audioContext.close();
            }
            
            // Clean up canvas fallback if used
            if (publishInfo.drawInterval) {
                clearInterval(publishInfo.drawInterval);
            }
            if (publishInfo.canvas) {
                publishInfo.canvas.remove();
            }
            
            // Remove event handlers
            if (publishInfo.eventHandlers) {
                for (const [event, handler] of Object.entries(publishInfo.eventHandlers)) {
                    videoElement.removeEventListener(event, handler);
                }
            }
            
            // Disconnect observer
            if (publishInfo.observer) {
                publishInfo.observer.disconnect();
            }
            
            // Remove visual indicator
            removePublishingIndicator(videoElement);
            
            // Remove from tracking
            publishedVideos.delete(videoElement);
            
            // Update group scene overlay
            createOrUpdateGroupSceneOverlay();
            
        } catch (error) {
            console.error('Error unpublishing video:', error);
        }
    }
    
    function addPublishingIndicator(videoElement, streamId, stream, label) {
        // Check if we should delay showing the overlay
        const timeSinceLoad = Date.now() - pageLoadTime;
        const delay = timeSinceLoad < OVERLAY_DELAY ? OVERLAY_DELAY - timeSinceLoad : 0;
        
        setTimeout(() => {
            // Check if video is still published before adding indicator
            if (!publishedVideos.has(videoElement)) {
                return;
            }
            
            const indicator = document.createElement('div');
            indicator.className = 'vdo-publishing-indicator';
            indicator.dataset.streamId = streamId;
            
            const hasVideo = stream.getVideoTracks().length > 0;
            const hasAudio = stream.getAudioTracks().length > 0;
            const videoIcon = hasVideo ? '📹' : '❌';
            const audioIcon = hasAudio ? '🔊' : '🔇';
            
            const displayLabel = label || '';
            
            // Generate solo view link
            const soloLink = `${VDO_NINJA_URL}/?room=${ROOM_ID}&view=${streamId}&solo`;
        
        indicator.innerHTML = `
            <div style="font-weight: bold;">📡 VDO.Ninja</div>
            <div style="font-size: 14px; margin: 4px 0;">${displayLabel}</div>
            <div style="font-size: 10px;">${streamId}</div>
            <div>${videoIcon} ${audioIcon}</div>
            <div style="margin-top: 6px; display: flex; gap: 4px; justify-content: center; pointer-events: auto;">
                <a id="vdo-view-${streamId}" href="${soloLink}" target="_blank" style="
                    color: #4CAF50;
                    text-decoration: none;
                    font-size: 11px;
                    background: rgba(76, 175, 80, 0.2);
                    padding: 2px 6px;
                    border-radius: 3px;
                    display: inline-block;
                    border: 1px solid rgba(76, 175, 80, 0.5);
                    pointer-events: auto;
                ">
                    🔗 View
                </a>
                <button id="vdo-copy-${streamId}" style="
                    color: #4CAF50;
                    background: rgba(76, 175, 80, 0.2);
                    border: 1px solid rgba(76, 175, 80, 0.5);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 11px;
                    cursor: pointer;
                    font-family: monospace;
                    pointer-events: auto;
                ">
                    📋 Copy
                </button>
            </div>
        `;
        
        indicator.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            font-family: monospace;
            pointer-events: none;
            z-index: 10000;
            text-align: center;
            line-height: 1.4;
            border: 2px solid #4CAF50;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        `;
        
        // Make parent relative if needed
        const parent = videoElement.parentElement;
        if (parent) {
            const position = window.getComputedStyle(parent).position;
            if (position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(indicator);
            videoElement.dataset.vdoIndicatorId = streamId;
            
            // Add event listeners after DOM insertion
            const viewLink = indicator.querySelector(`#vdo-view-${streamId}`);
            const copyBtn = indicator.querySelector(`#vdo-copy-${streamId}`);
            
            if (viewLink) {
                viewLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    window.open(soloLink, '_blank');
                    return false;
                }, true);
                
                // Prevent all other events
                ['mousedown', 'mouseup', 'contextmenu'].forEach(eventType => {
                    viewLink.addEventListener(eventType, (e) => {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }, true);
                });
            }
            
            if (copyBtn) {
                copyBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    navigator.clipboard.writeText(soloLink).then(() => {
                        copyBtn.textContent = '✅ Copied!';
                        setTimeout(() => {
                            copyBtn.textContent = '📋 Copy';
                        }, 2000);
                    });
                    return false;
                }, true);
                
                // Prevent all other events
                ['mousedown', 'mouseup', 'contextmenu'].forEach(eventType => {
                    copyBtn.addEventListener(eventType, (e) => {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }, true);
                });
            }
        }
        }, delay); // Add the missing closing parenthesis and delay parameter
    }
    
    function removePublishingIndicator(videoElement) {
        const parent = videoElement.parentElement;
        if (parent) {
            const indicator = parent.querySelector('.vdo-publishing-indicator');
            if (indicator) {
                indicator.remove();
            }
        }
        delete videoElement.dataset.vdoIndicatorId;
    }
    
    function createOrUpdateGroupSceneOverlay() {
        // Remove existing overlay if present
        if (groupSceneOverlay && groupSceneOverlay.parentNode) {
            groupSceneOverlay.remove();
        }
        
        // Only create if we have published videos
        if (publishedVideos.size === 0) {
            return;
        }
        
        // Check if we should delay showing the overlay
        const timeSinceLoad = Date.now() - pageLoadTime;
        const delay = timeSinceLoad < OVERLAY_DELAY ? OVERLAY_DELAY - timeSinceLoad : 0;
        
        console.log(`Group scene overlay delay: ${delay}ms (time since load: ${timeSinceLoad}ms)`);
        
        setTimeout(() => {
            // Double-check we still have published videos
            if (publishedVideos.size === 0) {
                return;
            }
            
            // Create new overlay
            groupSceneOverlay = document.createElement('div');
            groupSceneOverlay.className = 'vdo-group-scene-overlay';
        
        const sceneLink = `${VDO_NINJA_URL}/?room=${ROOM_ID}&scene`;
        const streamCount = publishedVideos.size;
        
        groupSceneOverlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div>
                    <div style="font-weight: bold; font-size: 14px;">📡 VDO.Ninja Group Scene</div>
                    <div style="font-size: 11px; opacity: 0.8;">${streamCount} stream${streamCount !== 1 ? 's' : ''} active • Room: ${ROOM_ID}</div>
                </div>
                <div style="display: flex; gap: 6px;">
                    <a href="${sceneLink}" target="_blank" style="
                        color: white;
                        text-decoration: none;
                        font-size: 12px;
                        background: #4CAF50;
                        padding: 6px 12px;
                        border-radius: 4px;
                        display: inline-block;
                        font-weight: bold;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#45a049'" onmouseout="this.style.background='#4CAF50'">
                        🎬 Open Scene
                    </a>
                    <button style="
                        color: white;
                        background: rgba(255, 255, 255, 0.2);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        padding: 6px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        cursor: pointer;
                        font-family: monospace;
                        font-weight: bold;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" 
                       onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'"
                       onclick="navigator.clipboard.writeText('${sceneLink}').then(() => { this.textContent = '✅ Copied!'; setTimeout(() => { this.textContent = '📋 Copy Link'; }, 2000); });">
                        📋 Copy Link
                    </button>
                </div>
            </div>
        `;
        
        groupSceneOverlay.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: monospace;
            z-index: 10001;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            border: 2px solid #4CAF50;
            backdrop-filter: blur(10px);
        `;
        
        document.body.appendChild(groupSceneOverlay);
        
        // Auto-hide after 10 seconds, show again on hover
        setTimeout(() => {
            if (groupSceneOverlay) {
                groupSceneOverlay.style.opacity = '0.3';
                groupSceneOverlay.style.transition = 'opacity 0.3s';
                
                groupSceneOverlay.addEventListener('mouseenter', () => {
                    groupSceneOverlay.style.opacity = '1';
                });
                
                groupSceneOverlay.addEventListener('mouseleave', () => {
                    groupSceneOverlay.style.opacity = '0.3';
                });
            }
        }, 10000);
        }, delay); // Add the missing closing for setTimeout
    }
    
    // Process existing videos
    function processExistingVideos() {
        const videos = document.querySelectorAll('video');
        console.log(`Found ${videos.length} existing videos`);
        videos.forEach(video => {
            publishVideo(video);
        });
    }
    
    // Set up mutation observer for new videos
    function setupMutationObserver() {
        const observer = new MutationObserver(mutations => {
            // Only process if VDO Ninja is enabled
            if (!vdoNinjaEnabled) return;
            
            mutations.forEach(mutation => {
                // Check added nodes
                mutation.addedNodes.forEach(node => {
                    if (node.nodeName === 'VIDEO') {
                        console.log('New video element detected');
                        publishVideo(node);
                    } else if (node.querySelectorAll) {
                        const videos = node.querySelectorAll('video');
                        videos.forEach(video => {
                            console.log('New video element detected in subtree');
                            publishVideo(video);
                        });
                    }
                });
            });
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('Mutation observer setup complete');
    }
    
    // Handle page cleanup
    window.addEventListener('beforeunload', () => {
        console.log('Page unloading, cleaning up...');
        publishedVideos.forEach((info, video) => {
            unpublishVideo(video);
        });
    });
    
    // Initialize
    console.log('Waiting for DOM to be ready...');
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            analyzeAudioSources(); // Always analyze audio sources for debugging
            setupMutationObserver(); // Set up observer (it will check vdoNinjaEnabled internally)
            // Don't process videos here - wait for settings to load
        });
    } else {
        // DOM already loaded
        analyzeAudioSources(); // Always analyze audio sources for debugging
        setupMutationObserver(); // Set up observer (it will check vdoNinjaEnabled internally)
        // Don't process videos here - wait for settings to load
    }
	
	// Handle settings from background script
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){
		if (response && "settings" in response){
			settings = response.settings;
			const newState = settings?.vdoninjadiscord ? true : false;
			if (newState !== vdoNinjaEnabled) {
				vdoNinjaEnabled = newState;
				console.log('VDO.Ninja state from settings:', vdoNinjaEnabled);
				if (vdoNinjaEnabled) {
					console.log('VDO.Ninja Direct WebRTC Auto-Publisher initialized');
					console.log('Room ID:', ROOM_ID);
					console.log(`View URL: ${VDO_NINJA_URL}/?room=${ROOM_ID}&scene`);
					processExistingVideos();
				}
			}
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try {
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						// Check if vdoninjadiscord changed
						const newState = settings?.vdoninjadiscord ? true : false;
						if (newState !== vdoNinjaEnabled) {
							const wasEnabled = vdoNinjaEnabled;
							vdoNinjaEnabled = newState;
							console.log('VDO.Ninja setting changed via message:', vdoNinjaEnabled);
							
							if (!wasEnabled && vdoNinjaEnabled) {
								// Just enabled
								console.log('VDO.Ninja enabled, starting video processing');
								processExistingVideos();
							} else if (wasEnabled && !vdoNinjaEnabled) {
								// Just disabled
								console.log('VDO.Ninja disabled, cleaning up');
								cleanupAllVideos();
							}
						}
					
						sendResponse(true);
						return;
					}
				}
			} catch(e){
				console.error('Error handling settings message:', e);
			}
			sendResponse(false);
		}
	);
    
})();