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
    
    // Configuration
    const ROOM_ID = 'autopublish_' + Math.random().toString(36).substring(7);
    const VDO_NINJA_URL = 'https://vdo.ninja';
    
    // Map to track published videos and their VDO instances
    const publishedVideos = new Map();
    
    console.log('VDO.Ninja Direct WebRTC Auto-Publisher initialized');
    console.log('Room ID:', ROOM_ID);
    console.log(`View URL: ${VDO_NINJA_URL}/?room=${ROOM_ID}&scene`);
    
    function generateStreamId() {
        return 'video_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    }
    
    async function publishVideo(videoElement) {
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
        console.log('Publishing video:', streamId, {
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
            duration: videoElement.duration,
            muted: videoElement.muted,
            paused: videoElement.paused
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
                if (stream.getAudioTracks().length === 0 && !videoElement.muted) {
                    console.log('No audio tracks captured, trying Web Audio API');
                    
                    // Try to add audio using Web Audio API
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
                            console.log('Added audio track via Web Audio API');
                        }
                    } catch (audioErr) {
                        console.warn('Could not add audio track:', audioErr);
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
            
            // Publish the stream
            console.log('Publishing stream...');
            await vdo.publish(stream, { streamID: streamId });
            console.log('Published stream:', streamId);
            
            // Join room
            console.log('Joining room:', ROOM_ID);
            await vdo.joinRoom({
                room: ROOM_ID,
                streamID: streamId,
                push: streamId // Alias for streamID
            });
            console.log('Joined room successfully');
            
            // Add visual indicator
            addPublishingIndicator(videoElement, streamId, stream);
            
            // Monitor video element for removal or state changes
            monitorVideoElement(videoElement);
            
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
                console.log('Video element removed from DOM');
                unpublishVideo(videoElement);
                observer.disconnect();
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
            
            // Stop media stream tracks
            if (publishInfo.stream) {
                publishInfo.stream.getTracks().forEach(track => {
                    track.stop();
                });
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
            
        } catch (error) {
            console.error('Error unpublishing video:', error);
        }
    }
    
    function addPublishingIndicator(videoElement, streamId, stream) {
        const indicator = document.createElement('div');
        indicator.className = 'vdo-publishing-indicator';
        indicator.dataset.streamId = streamId;
        
        const hasVideo = stream.getVideoTracks().length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;
        const videoIcon = hasVideo ? '📹' : '❌';
        const audioIcon = hasAudio ? '🔊' : '🔇';
        
        indicator.innerHTML = `
            <div style="font-weight: bold;">📡 VDO.Ninja</div>
            <div style="font-size: 10px;">${streamId}</div>
            <div>${videoIcon} ${audioIcon}</div>
        `;
        
        indicator.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px;
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
        }
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
            processExistingVideos();
            setupMutationObserver();
        });
    } else {
        // DOM already loaded
        processExistingVideos();
        setupMutationObserver();
    }
    
})();