
/**
 * VDO.Ninja SDK v1.0 - STILL IN DEVELOPMENT AND MAY CONTAIN BUGS
 * @author Steve Seguin
 * @license AGPLv3
 */

(function (global) {
    'use strict';

    class VDONinjaSDK extends EventTarget {
        /**
         * Sanitize stream ID
         * @private
         * @param {string} streamID - Stream ID to sanitize
         * @returns {string} Sanitized stream ID
         */
        _sanitizeStreamID(streamID) {
            if (!streamID || typeof streamID !== 'string') {
                streamID = this._generateStreamID();
                this._log('No streamID provided, generated:', streamID);
                return streamID;
            }

            streamID = streamID.trim();

            if (streamID.length < 1) {
                streamID = this._generateStreamID();
                this._log('Empty streamID provided, generated:', streamID);
                return streamID;
            }

            const streamID_sanitized = streamID.replace(/[\W]+/g, "_");
            if (streamID !== streamID_sanitized) {
                this._log('StreamID contained non-alphanumeric characters, sanitized:', streamID_sanitized);
            }

            if (streamID_sanitized.length > 64) {
                const truncated = streamID_sanitized.substring(0, 64);
                this._log('StreamID too long, truncated to 64 characters:', truncated);
                return truncated;
            }

            return streamID_sanitized;
        }

        /**
         * Sanitize room name
         * @private
         * @param {string} roomid - Room ID to sanitize
         * @returns {string|false} Sanitized room ID or false if explicitly false
         */
        _sanitizeRoomName(roomid) {
            if (roomid === false || roomid === null || roomid === undefined) {
                return false;
            }

            if (typeof roomid !== 'string') {
                roomid = String(roomid);
            }

            roomid = roomid.trim();
            
            if (roomid === "") {
                return "";
            }

            const sanitized = roomid.replace(/[\W]+/g, "_");
            if (roomid !== sanitized) {
                this._log('Room name contained non-alphanumeric characters, sanitized:', sanitized);
            }

            if (sanitized.length > 30) {
                const truncated = sanitized.substring(0, 30);
                this._log('Room name too long, truncated to 30 characters:', truncated);
                return truncated;
            }

            return sanitized;
        }

        /**
         * Sanitize label
         * @private
         * @param {string} label - Label to sanitize
         * @returns {string} Sanitized label
         */
        _sanitizeLabel(label) {
            if (!label || typeof label !== 'string') {
                return "";
            }

            // Remove any HTML/script tags for security
            const temp = document.createElement("div");
            temp.innerText = label;
            let sanitized = temp.textContent || temp.innerText || "";
            
            // Truncate to 100 characters
            sanitized = sanitized.substring(0, Math.min(sanitized.length, 100));
            
            return sanitized.trim();
        }

        /**
         * Sanitize password
         * @private
         * @param {string|boolean|null} password - Password to sanitize
         * @returns {string|boolean|null} Sanitized password
         */
        _sanitizePassword(password) {
            if (password === false || password === null) {
                return password;
            }

            if (password === undefined || password === "") {
                return "";
            }

            if (typeof password !== 'string') {
                password = String(password);
            }

            password = password.trim();
            
            if (password.length < 1) {
                this._log('Empty password provided');
                return "";
            }

            // Encode special characters for safe transmission
            const sanitized = encodeURIComponent(password);
            
            return sanitized;
        }
        
        /**
         * Create a new VDONinjaSDK instance
         * @param {Object} options - Configuration options
         * @param {string} options.host - WebSocket signaling server URL (default: 'wss://wss.vdo.ninja')
         * @param {string} options.room - Room name to join (optional)
         * @param {string|false} options.password - Room password (default: "someEncryptionKey123", false to disable)
         * @param {boolean} options.debug - Enable debug logging (default: false)
         * @param {Array|false|null} options.turnServers - TURN server configuration:
         *   - null/undefined: Auto-fetch optimal TURN servers from API (default)
         *   - false: Disable TURN servers, use only STUN
         *   - Array: Custom TURN server configuration
         * @param {boolean} options.forceTURN - Force relay mode through TURN servers for privacy (default: false)
         * @param {number} options.turnCacheTTL - TURN server cache time-to-live in minutes (default: 5)
         * @param {Array} options.stunServers - STUN server configuration (default: Google & VDO.Ninja STUN)
         * @param {number} options.maxReconnectAttempts - Maximum reconnection attempts (default: 5)
         * @param {number} options.reconnectDelay - Initial reconnection delay in ms (default: 1000)
         */
        constructor(options = {}) {
            super();
            
            // Core configuration
            this.host = options.host || options.wss || 'wss://wss.vdo.ninja';
            this.room = this._sanitizeRoomName(options.room || null);
            // Handle password: false explicitly disables, undefined/null/empty uses default
            if (options.password === false) {
                this.password = false;
            } else if (options.password === undefined || options.password === null || options.password === '') {
                this.password = this._sanitizePassword("someEncryptionKey123");
            } else {
                this.password = this._sanitizePassword(options.password);
            }
            this.debug = options.debug || false;
            
            // State management
            this.state = {
                connected: false,
                room: null,
                streamID: null,
                uuid: null,
                roomJoined: false,
                publishing: false
            };
            
            // Connection management - Initialize all required properties
            this.signaling = null;
            this.connections = new Map(); // UUID -> { viewer: connection, publisher: connection }
            this._pendingViews = new Map();
            this._failedViewerConnections = new Map(); // Track failed connections for retry
            this._intentionalDisconnect = false; // Flag for intentional disconnections
            this._passwordHash = null;  // Cached hash for streamID
            this._viewHandlers = new Map();
            this._sessionIDs = {};
            this._remoteSessionIDs = {};
            this._streamToUUID = {};
            this.messageHandlers = new Map();
            
            // Media management
            this.localStream = null;
            this.videoElement = options.videoElement || null;
            
            // Configuration
            this.turnServers = options.turnServers !== undefined ? options.turnServers : null; // null = auto fetch, false = none, array = custom
            this.forceTURN = options.forceTURN || false; // Force relay mode for privacy
            this.turnCacheTTL = options.turnCacheTTL || 5; // TURN cache time-to-live in minutes
            this.stunServers = options.stunServers || [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' }
            ];
            
            // Will be populated with TURN servers
            this.configuration = options.configuration || {
                iceServers: this.stunServers.slice() // Start with STUN servers
            };
            
            this._turnPromise = null; // For caching TURN server fetch
            this._turnList = null; // Cached TURN servers
            
            // Reconnection settings
            this._reconnectAttempts = 0;
            this._maxReconnectAttempts = options.maxReconnectAttempts || 5;
            this._reconnectDelay = options.reconnectDelay || 1000;
            this._reconnectTimer = null;
            
            // Internal flags
            this._isReconnecting = false;
            this._intentionalDisconnect = false;
            
            // Initialize salt before setting up crypto
            this.salt = "vdo.ninja";
            
            // Setup crypto utilities
            this._setupCryptoUtils();
            
            this._log('SDK initialized with host:', this.host);
        }

        // ============================================================================
        // CONNECTION MANAGEMENT
        // ============================================================================

        /**
         * Connect to the signaling server
         * @param {Object} options - Connection options
         * @returns {Promise} Resolves when connected
         */
        async connect(options = {}) {
            // Initialize required properties if missing
            if (!this.connections) this.connections = new Map();
            if (!this.state) this.state = {};
            if (!this._viewHandlers) this._viewHandlers = new Map();
            if (!this._sessionIDs) this._sessionIDs = {};
            if (!this._remoteSessionIDs) this._remoteSessionIDs = {};
            if (!this._streamToUUID) this._streamToUUID = {};
            if (!this._pendingViews) this._pendingViews = new Map();
            if (!this.messageHandlers) this.messageHandlers = new Map();
            
            if (this.state.connected) {
                this._log('Already connected');
                return;
            }

            this._intentionalDisconnect = false;
            
            // Merge options
            if (options.host) this.host = options.host;
            if (options.room) this.room = options.room;
            if (options.password !== undefined) this.password = options.password;
            
            return new Promise((resolve, reject) => {
                try {
                    this.signaling = new WebSocket(this.host);
                    
                    this.signaling.onopen = () => {
                        this._log('WebSocket connected');
                        this.state.connected = true;
                        this._reconnectAttempts = 0;
                        
                        this._emit('connected');
                        
                        resolve();
                    };
                    
                    this.signaling.onmessage = async (event) => {
                        try {
                            const msg = JSON.parse(event.data);
                            this._logMessage('IN', msg, 'WebSocket');
                            await this._handleSignalingMessage(msg);
                        } catch (error) {
                            this._log('Error parsing message:', error);
                        }
                    };
                    
                    this.signaling.onerror = (error) => {
                        this._log('WebSocket error:', error);
                        this._emit('error', { error: 'WebSocket error', details: error });
                        reject(error);
                    };
                    
                    this.signaling.onclose = () => {
                        this._log('WebSocket closed');
                        this.state.connected = false;
                        // Reset per-connection states
                        this.state.roomJoined = false;
                        this.state.publishing = false;
                        
                        this._emit('disconnected');
                        
                        if (!this._intentionalDisconnect && this._reconnectAttempts < this._maxReconnectAttempts) {
                            this._attemptReconnect();
                        }
                    };
                    
                } catch (error) {
                    this._log('Connection error:', error);
                    reject(error);
                }
            });
        }

        /**
         * Disconnect from the signaling server
         */
        disconnect() {
            this._log('Disconnecting...');
            this._intentionalDisconnect = true;
            
            // Clear reconnect timer
            if (this._reconnectTimer) {
                clearTimeout(this._reconnectTimer);
                this._reconnectTimer = null;
            }
            
            // Send bye message to all connected peers via data channels
            this._log('Connections count:', this.connections.size);
            const byePromises = [];
            
            for (const [uuid, connections] of this.connections) {
                for (const type of ['viewer', 'publisher']) {
                    const connection = connections[type];
                    if (!connection) continue;
                    
                    this._log(`Connection ${uuid}:${type}: dataChannel=${!!connection.dataChannel}, state=${connection.dataChannel?.readyState}`);
                    if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
                        try {
                            const byeMsg = { bye: true };
                            // Send directly through the data channel
                            connection.dataChannel.send(JSON.stringify(byeMsg));
                            this._log('Sent bye message to:', uuid, 'type:', type);
                        
                        // Create a promise that resolves when bufferedAmount reaches 0
                        const flushPromise = new Promise((resolve) => {
                            const checkBuffer = () => {
                                if (!connection.dataChannel || 
                                    connection.dataChannel.readyState !== 'open' || 
                                    connection.dataChannel.bufferedAmount === 0) {
                                    resolve();
                                } else {
                                    setTimeout(checkBuffer, 10);
                                }
                            };
                            checkBuffer();
                        });
                        
                        // Add timeout to prevent hanging
                        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 100));
                        byePromises.push(Promise.race([flushPromise, timeoutPromise]));
                        
                        } catch (error) {
                            this._log('Error sending bye message:', error);
                        }
                    }
                }
            }
            
            // Wait for all bye messages to be sent or timeout
            Promise.all(byePromises).then(() => {
                // Close all peer connections
                for (const [uuid, connections] of this.connections) {
                    for (const type of ['viewer', 'publisher']) {
                        const connection = connections[type];
                        if (connection) {
                            // Stop ping monitoring
                            this._stopPingMonitoring(connection);
                            // Close peer connection
                            if (connection.pc) {
                                connection.pc.close();
                            }
                        }
                    }
                }
                this.connections.clear();
                
                // Close WebSocket
                if (this.signaling) {
                    this.signaling.close();
                    this.signaling = null;
                }
                
                // Reset state
                this.state = {
                    connected: false,
                    room: null,
                    streamID: null,
                    uuid: null,
                    roomJoined: false,
                    publishing: false
                };
                
                this._emit('disconnected');
            });
        }

        /**
         * Attempt to reconnect to the signaling server
         * @private
         */
        async _attemptReconnect() {
            if (this._isReconnecting) return;
            
            this._isReconnecting = true;
            this._reconnectAttempts++;
            
            const delay = Math.min(this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1), 30000);
            this._log(`Attempting reconnection ${this._reconnectAttempts}/${this._maxReconnectAttempts} in ${delay}ms`);
            
            this._emit('reconnecting', { 
                attempt: this._reconnectAttempts, 
                maxAttempts: this._maxReconnectAttempts 
            });
            
            this._reconnectTimer = setTimeout(async () => {
                try {
                    await this.connect();
                    
                    // Rejoin room if we were in one
                    if (this.state.room) {
                        await this.joinRoom({ 
                            room: this.state.room, 
                            password: this.password 
                        });
                    }
                    
                    // Re-publish if we were publishing
                    if (this.state.publishing && this.localStream) {
                        await this.publish(this.localStream, { 
                            streamID: this.state.streamID 
                        });
                    }
                    
                    this._emit('reconnected');
                    this._isReconnecting = false;
                    
                } catch (error) {
                    this._log('Reconnection failed:', error);
                    this._isReconnecting = false;
                    
                    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
                        this._emit('reconnectFailed');
                    } else {
                        this._attemptReconnect();
                    }
                }
            }, delay);
        }


        // ============================================================================
        // ROOM MANAGEMENT
        // ============================================================================

        /**
         * Join a room
         * @param {Object} options - Room options
         * @param {string} options.room - Room name
         * @param {string|null} options.password - Room password (null to disable hashing)
         * @returns {Promise} Resolves when room is joined
         */
        async joinRoom(options = {}) {
            if (!this.state.connected) {
                throw new Error('Not connected to signaling server');
            }

            // Prevent multiple room joins per connection
            if (this.state.roomJoined) {
                this._log('Already joined a room on this connection');
                return Promise.resolve();
            }

            const room = this._sanitizeRoomName(options.room || this.room);
            const password = this._sanitizePassword(options.password !== undefined ? options.password : this.password);
            
            if (!room) {
                throw new Error('Room name is required');
            }

            // Store password for later use, converting empty string to default
            if (password === '') {
                this.password = this._sanitizePassword("someEncryptionKey123");
            } else {
                this.password = password;
            }

            // Hash room name if password is not explicitly false
            let hashedRoom = room;
            if (this.password !== false && this.password !== null) {
                hashedRoom = await this._hashRoom(room, this.password);
            }

            this._log('Joining room:', room, 'with hash:', hashedRoom);

            // Join room without streamID in the message
            const joinMessage = {
                request: "joinroom",
                roomid: hashedRoom
            };
            
            // Add claim if specified
            if (options.claim) {
                joinMessage.claim = true;
            }

            this._sendMessageWS(joinMessage);

            // Wait for room join confirmation (listing message)
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Room join timeout'));
                }, 10000);

                const handleListing = (event) => {
                    clearTimeout(timeout);
                    this.removeEventListener('_roomJoined', handleListing);
                    
                    this.state.room = room;
                    this.state.roomJoined = true;
                    
                    this._emit('roomJoined', { room });
                    resolve();
                };

                this.addEventListener('_roomJoined', handleListing);
            });
        }

        /**
         * Leave the current room
         */
        leaveRoom() {
            if (!this.state.room) {
                this._log('Not in a room');
                return;
            }

            // Send leave message
            this._sendMessageWS({ leave: true });

            const previousRoom = this.state.room;
            this.state.room = null;
            this.state.roomJoined = false;

            this._emit('roomLeft', { room: previousRoom });
        }

        // ============================================================================
        // PUBLISHING
        // ============================================================================

        /**
         * Publish a media stream
         * @param {MediaStream} stream - The media stream to publish
         * @param {Object} options - Publishing options
         * @returns {Promise} Resolves when publishing starts
         */
        async publish(stream, options = {}) {
            if (!this.state.connected) {
                throw new Error('Not connected to signaling server');
            }

            if (!stream || !(stream instanceof MediaStream)) {
                throw new Error('Valid MediaStream required');
            }

            // Prevent multiple publishes per connection
            if (this.state.publishing) {
                throw new Error('Already publishing on this connection. Disconnect and reconnect to publish a different stream.');
            }

            this.localStream = stream;
            const streamID = this._sanitizeStreamID(options.streamID) || this._generateStreamID();

            // Handle room join if needed
            if (!this.state.roomJoined && options.room) {
                await this.joinRoom({ 
                    room: options.room, 
                    password: options.password !== undefined ? options.password : this.password 
                });
            }

            // Generate hashed streamID
            let hashedStreamID = streamID;
            if (this.password !== false && this.password !== null) {
                // Use default password if empty string
                const effectivePassword = (this.password === '' || this.password === undefined) ? "someEncryptionKey123" : this.password;
                hashedStreamID = await this._hashStreamID(streamID, effectivePassword);
            }

            this._log('Publishing with streamID:', streamID, 'as:', hashedStreamID);

            // Store state
            this.state.streamID = streamID;
            this.state.publishing = true;

            // Send seed message
            const seedMessage = {
                request: "seed",
                streamID: hashedStreamID
            };

            this._log('Sending seed message for streamID:', hashedStreamID);
            this._sendMessageWS(seedMessage);

            this._emit('publishing', { streamID, hashedStreamID });

            return streamID;
        }

        /**
         * Announce availability without publishing media (data-only connection)
         * This allows establishing peer connections for data channel communication only
         * @param {Object} options - Announcement options
         * @param {string} options.streamID - Stream identifier
         * @param {string} options.room - Room to join (optional)
         * @param {string} options.label - Label for the stream (optional)
         * @param {string|boolean} options.password - Password for encryption (optional)
         * @returns {Promise<string>} Stream ID
         */
        async announce(options = {}) {
            if (!this.state.connected) {
                throw new Error('Not connected to signaling server');
            }

            const streamID = this._sanitizeStreamID(options.streamID) || this._generateStreamID();

            // Handle room join if needed
            if (!this.state.roomJoined && options.room) {
                await this.joinRoom({ 
                    room: options.room, 
                    password: options.password !== undefined ? options.password : this.password 
                });
            }

            // Generate hashed streamID
            let hashedStreamID = streamID;
            if (this.password !== false && this.password !== null) {
                // Use default password if empty string
                const effectivePassword = (this.password === '' || this.password === undefined) ? "someEncryptionKey123" : this.password;
                hashedStreamID = await this._hashStreamID(streamID, effectivePassword);
            }

            this._log('Announcing availability with streamID:', streamID, 'as:', hashedStreamID);

            // Store state
            this.state.streamID = streamID;
            this.state.publishing = true;

            // Send seed message
            const seedMessage = {
                request: "seed",
                streamID: hashedStreamID
            };

            //if (options.label) {
           //     seedMessage.label = this._sanitizeLabel(options.label);
           // }

            this._sendMessageWS(seedMessage);

            this._emit('publishing', { streamID, hashedStreamID, dataOnly: true });

            return streamID;
        }

        /**
         * Stop publishing
         */
        stopPublishing() {
            if (!this.state.publishing) {
                this._log('Not currently publishing');
                return;
            }

            // Send bye message to all viewers via data channels
            const byePromises = [];
            
            for (const [uuid, connections] of this.connections) {
                const connection = connections.publisher;
                if (connection && connection.dataChannel && 
                    connection.dataChannel.readyState === 'open') {
                    try {
                        const byeMsg = { bye: true };
                        this._sendDataInternal(byeMsg, uuid);
                        this._log('Sent bye message to viewer:', uuid);
                        
                        // Create a promise that resolves when bufferedAmount reaches 0
                        const flushPromise = new Promise((resolve) => {
                            const checkBuffer = () => {
                                if (!connection.dataChannel || 
                                    connection.dataChannel.readyState !== 'open' || 
                                    connection.dataChannel.bufferedAmount === 0) {
                                    resolve();
                                } else {
                                    setTimeout(checkBuffer, 10);
                                }
                            };
                            checkBuffer();
                        });
                        
                        // Add timeout to prevent hanging
                        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 100));
                        byePromises.push(Promise.race([flushPromise, timeoutPromise]));
                        
                    } catch (error) {
                        this._log('Error sending bye message:', error);
                    }
                }
            }

            // Wait for all bye messages to be sent or timeout
            Promise.all(byePromises).then(() => {
                // Close all publisher connections
                for (const [uuid, connections] of this.connections) {
                    const connection = connections.publisher;
                    if (connection) {
                        // Stop ping monitoring
                        this._stopPingMonitoring(connection);
                        
                        if (connection.pc) {
                            connection.pc.close();
                        }
                        // Remove only the publisher connection
                        delete connections.publisher;
                        // If no connections left for this UUID, remove the entry
                        if (!connections.viewer && !connections.publisher) {
                            this.connections.delete(uuid);
                        }
                    }
                }

                // Stop local stream tracks
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => track.stop());
                    this.localStream = null;
                }

                this.state.publishing = false;
                this.state.streamID = null;

                this._emit('publishingStopped');
            });
        }

        // ============================================================================
        // VIEWING
        // ============================================================================

        /**
         * View a stream
         * @param {string} streamID - The stream ID to view
         * @param {Object} options - Viewing options
         * @returns {Promise<RTCPeerConnection>} The peer connection
         */
        async view(streamID, options = {}) {
            if (!this.state.connected) {
                throw new Error('Not connected to signaling server');
            }

            // Sanitize streamID
            streamID = this._sanitizeStreamID(streamID);
            
            // Sanitize label if provided
            if (options.label) {
                options.label = this._sanitizeLabel(options.label);
            }

            this._log('View request for:', streamID, 'with options:', options);

            try {
                // Hash the streamID if password is set
                let hashedStreamID = streamID;
                if (this.password !== false && this.password !== null) {
                    // Use default password if empty string
                    const effectivePassword = (this.password === '' || this.password === undefined) ? "someEncryptionKey123" : this.password;
                    hashedStreamID = await this._hashStreamID(streamID, effectivePassword);
                }
                
                // Track pending view so we know we initiated this
                this._pendingViews.set(streamID, {
                    options: options,
                    timestamp: Date.now(),
                    hashedStreamID: hashedStreamID  // Store the hashed version for comparison
                });
                
                // Store view options for potential reconnection
                this._lastViewOptions = this._lastViewOptions || {};
                this._lastViewOptions[streamID] = options;

                // Send view request first (don't create connection yet)
                const viewRequest = {
                    request: "play",
                    streamID: hashedStreamID
                };

                // Send the request
                if (this.signaling && this.signaling.readyState === WebSocket.OPEN) {
                    this._logMessage('OUT', viewRequest, 'WebSocket');
                    this.signaling.send(JSON.stringify(viewRequest));
                    this._log('Sent view request for:', streamID, 'as:', hashedStreamID);
                } else {
                    throw new Error('WebSocket not connected');
                }

                // The connection will be created when we receive the offer
                // For now, return a promise that resolves when connection is ready
                return new Promise((resolve, reject) => {
                    const checkConnection = setInterval(() => {
                        // Look for a connection with this streamID
                        for (const [uuid, connections] of this.connections) {
                            const conn = connections.viewer;
                            if (conn && conn.streamID === streamID && conn.pc) {
                                clearInterval(checkConnection);
                                clearTimeout(timeout);
                                this._pendingViews.delete(streamID);
                                resolve(conn.pc);
                                return;
                            }
                        }
                    }, 100);

                    const timeout = setTimeout(() => {
                        clearInterval(checkConnection);
                        this._pendingViews.delete(streamID);
                        reject(new Error(`Timeout waiting for stream: ${streamID}`));
                    }, 15000);
                });

            } catch (error) {
                this._log('Error in view:', error.message);
                this._pendingViews.delete(streamID);
                throw error;
            }
        }

        /**
         * Stop viewing a stream
         * @param {string} streamID - The stream ID to stop viewing
         */
        stopViewing(streamID) {
            // Mark as intentional disconnect
            this._intentionalDisconnect = true;
            
            // Remove from failed connections if present
            if (this._failedViewerConnections) {
                this._failedViewerConnections.delete(streamID);
            }
            
            // Send bye message to publishers we're viewing
            const byePromises = [];
            
            const viewerConnections = this._getConnections({ streamID, type: 'viewer' });
            
            for (const connection of viewerConnections) {
                if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
                    try {
                        const byeMsg = { bye: true };
                        connection.dataChannel.send(JSON.stringify(byeMsg));
                        this._log('Sent bye message to publisher:', connection.uuid);
                        
                        // Create a promise that resolves when bufferedAmount reaches 0
                        const flushPromise = new Promise((resolve) => {
                            const checkBuffer = () => {
                                if (!connection.dataChannel || 
                                    connection.dataChannel.readyState !== 'open' || 
                                    connection.dataChannel.bufferedAmount === 0) {
                                    resolve();
                                } else {
                                    setTimeout(checkBuffer, 10);
                                }
                            };
                            checkBuffer();
                        });
                        
                        // Add timeout to prevent hanging
                        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 100));
                        byePromises.push(Promise.race([flushPromise, timeoutPromise]));
                        
                    } catch (error) {
                        this._log('Error sending bye message:', error);
                    }
                }
            }

            // Wait for all bye messages to be sent or timeout
            Promise.all(byePromises).then(() => {
                // Close and remove viewer connections for this stream
                for (const [uuid, connections] of this.connections) {
                    const viewerConnection = connections.viewer;
                    if (viewerConnection && viewerConnection.streamID === streamID) {
                        if (viewerConnection.pc) {
                            viewerConnection.pc.close();
                        }
                        delete connections.viewer;
                        
                        // If no connections left for this UUID, remove the entry
                        if (!connections.viewer && !connections.publisher) {
                            this.connections.delete(uuid);
                        }
                    }
                }

                this._emit('viewingStopped', { streamID });
                
                // Reset the intentional disconnect flag
                this._intentionalDisconnect = false;
            });
        }

        // ============================================================================
        // WEBRTC CONNECTION MANAGEMENT
        // ============================================================================

        /**
         * Create a new peer connection
         * @private
         * @param {string|Object} uuidOrOptions - UUID or options object
         * @param {string} type - Connection type (viewer/publisher)
         * @returns {Promise<Object>} Connection object
         */
        async _createConnection(uuidOrOptions, type = 'viewer') {
            // Handle both signatures: (uuid, type) and (options)
            let uuid, options;

            if (typeof uuidOrOptions === 'string') {
                // Original signature: (uuid, type)
                uuid = uuidOrOptions;
                this._log('Creating connection to remote peer UUID:', uuid, 'type:', type);
            } else {
                // New signature: (options)
                options = uuidOrOptions || {};
                uuid = options.uuid;
                type = options.type || type;
                this._log('Creating connection with options:', options);
            }

            // Get ICE configuration with TURN servers
            const iceConfig = await this._getICEConfiguration();

            const connection = {
                uuid: uuid,
                type: type,
                pc: new RTCPeerConnection(iceConfig),
                dataChannel: null,
                streamID: null,
                session: null,  // Session ID for this WebRTC connection
                info: {label: options?.label || null},
                allowAudio: true,
                allowVideo: true,
                viewOptions: {},
                stats: {
                    packetsReceived: 0,
                    packetsLost: 0,
                    bytesReceived: 0,
                    lastStatsTime: Date.now()
                },
                // Automated ping tracking
                lastMessageTime: Date.now(),
                pingTimer: null,
                missedPings: 0,
                pendingPing: null
            };

            // Add any additional properties from options
            if (options) {
                if (options.streamID) connection.streamID = options.streamID;
                if (options.viewPreferences) connection.viewPreferences = options.viewPreferences;
            }

            // Setup ICE bundling
            connection.iceTimer = null;
            connection.iceBundle = [];
            connection.iceBundleDelay = 70; // Initial delay for host candidates
            
            // Setup peer connection event handlers
            connection.pc.onicecandidate = (event) => {
                this._handleICECandidate(event, connection);
            };

            connection.pc.oniceconnectionstatechange = () => {
                this._log(`ICE state for ${uuid}:`, connection.pc.iceConnectionState);
                
                if (connection.pc.iceConnectionState === 'connected') {
                    this._emit('peerConnected', { uuid, connection });
                } else if (connection.pc.iceConnectionState === 'failed' || 
                           connection.pc.iceConnectionState === 'disconnected') {
                    this._handleConnectionFailed(connection);
                }
            };

            connection.pc.ontrack = (event) => {
                this._log('Track received:', event.track.kind, 'from:', uuid);
                this._emit('track', { 
                    track: event.track, 
                    streams: event.streams,
                    uuid: uuid,
                    streamID: connection.streamID
                });
            };

            // Setup data channel for publishers
            if (type === 'publisher') {
                const dc = connection.pc.createDataChannel('vdoninja', { 
                    ordered: true 
                });
                connection.dataChannel = dc;
                this._setupDataChannel(connection, dc);
            }

            // Handle data channel for viewers (and publishers receiving from other publishers)
            connection.pc.ondatachannel = (event) => {
                this._log('Data channel received from:', uuid);
                connection.dataChannel = event.channel;
                this._setupDataChannel(connection, event.channel);
            };

            // Store connection in nested structure
            if (!this.connections.has(uuid)) {
                this.connections.set(uuid, {});
            }
            
            const connections = this.connections.get(uuid);
            connections[type] = connection;
            
            return connection;
        }

        /**
         * Get connection by UUID and optional type
         * @private
         * @param {string} uuid - Peer UUID
         * @param {string} type - Connection type (viewer/publisher) or null for any
         * @returns {Object|null} Connection object or null
         */
        _getConnection(uuid, type = null) {
            const connections = this.connections.get(uuid);
            if (!connections) return null;
            
            if (type) {
                return connections[type] || null;
            }
            
            // Return any available connection if no type specified
            return connections.viewer || connections.publisher || null;
        }

        /**
         * Get all connections matching filters
         * @private
         * @param {Object} filters - Filter options
         * @param {string} filters.uuid - Filter by UUID
         * @param {string} filters.type - Filter by type (viewer/publisher)
         * @param {string} filters.streamID - Filter by stream ID
         * @returns {Array} Array of matching connections
         */
        _getConnections(filters = {}) {
            const results = [];
            
            for (const [uuid, connections] of this.connections) {
                // Apply UUID filter
                if (filters.uuid && uuid !== filters.uuid) continue;
                
                // Check each connection type
                for (const type of ['viewer', 'publisher']) {
                    const connection = connections[type];
                    if (!connection) continue;
                    
                    // Apply type filter
                    if (filters.type && type !== filters.type) continue;
                    
                    // Apply streamID filter
                    if (filters.streamID && connection.streamID !== filters.streamID) continue;
                    
                    results.push(connection);
                }
            }
            
            return results;
        }

        /**
         * Setup data channel event handlers
         * @private
         * @param {Object} connection - Connection object
         * @param {RTCDataChannel} channel - Data channel
         */
        _setupDataChannel(connection, channel) {
            this._log(`Setting up data channel for ${connection.uuid}, initial state: ${channel.readyState}`);
            
            channel.onopen = () => {
                this._log(`Data channel opened for ${connection.uuid}`);

                // Send track preferences for viewers
                if (connection.type === 'viewer' && connection.viewPreferences) {
                    try {
                        this._sendDataInternal(connection.viewPreferences, connection.uuid);
                        this._log('Sent track preferences:', connection.viewPreferences);
                    } catch (error) {
                        this._log('Failed to send preferences:', error.message);
                    }
                }
                
                // Start ping monitoring for publisher connections
                if (connection.type === 'publisher') {
                    this._startPingMonitoring(connection);
                }
                
                this._emit('dataChannelOpen', {
                    uuid: connection.uuid,
                    type: connection.type,
                    streamID: connection.streamID
                });
            };
            
            channel.onerror = (error) => {
                this._log(`Data channel error for ${connection.uuid}:`, error);
            };
            
            channel.onclose = () => {
                this._log(`Data channel closed for ${connection.uuid}, was in state: ${channel.readyState}`);
                
                // Stop ping monitoring
                this._stopPingMonitoring(connection);
            };

            channel.onmessage = async (event) => {
                // Update last message time for ping monitoring
                connection.lastMessageTime = Date.now();
                
                try {
                    const msg = JSON.parse(event.data);
                    this._logMessage('IN', msg, 'DataChannel');

                    // Handle encrypted descriptions
                    if (msg.description && msg.vector && typeof msg.description === 'string') {
                        try {
                            const decrypted = await this._decryptMessage(msg.description, msg.vector);
                            msg.description = JSON.parse(decrypted);
                            this._log('Decrypted SDP description from data channel');
                        } catch (error) {
                            this._log('Failed to decrypt SDP description from data channel:', error);
                            return;
                        }
                    }

                    // Handle encrypted candidates
                    if (msg.candidates && msg.vector && typeof msg.candidates === 'string') {
                        try {
                            const decrypted = await this._decryptMessage(msg.candidates, msg.vector);
                            msg.candidates = JSON.parse(decrypted);
                            this._log('Decrypted ICE candidates from data channel');
                        } catch (error) {
                            this._log('Failed to decrypt ICE candidates from data channel:', error);
                            return;
                        }
                    }

                    // Handle encrypted single candidate
                    if (msg.candidate && msg.vector && typeof msg.candidate === 'string') {
                        try {
                            const decrypted = await this._decryptMessage(msg.candidate, msg.vector);
                            msg.candidate = JSON.parse(decrypted);
                            this._log('Decrypted ICE candidate from data channel');
                        } catch (error) {
                            this._log('Failed to decrypt ICE candidate from data channel:', error);
                            return;
                        }
                    }

                    // Handle different message types
                    if (msg.description) {
                        this._log('Received SDP via data channel');
                        msg.UUID = connection.uuid;
                        msg.session = msg.session || connection.session;
                        await this._handleSDP(msg);
                    } else if (msg.candidate) {
                        this._log('Received ICE candidate via data channel');
                        msg.UUID = connection.uuid;
                        await this._handleRemoteICECandidate(msg);
                    } else if (msg.candidates) {
                        this._log('Received ICE candidates via data channel');
                        msg.UUID = connection.uuid;
                        await this._handleRemoteICECandidates(msg);
                    } else if (typeof msg.audio === 'boolean' || typeof msg.video === 'boolean') {
                        this._log('Received track preferences:', msg);
                        connection.allowAudio = msg.audio !== false;
                        connection.allowVideo = msg.video !== false;

                        if (this.localStream && this._updateTracksForConnection) {
                            await this._updateTracksForConnection(connection);
                        }
                    } else if (msg.ping) {
                        // Viewers respond to publisher pings with pong
                        if (connection.type === 'viewer') {
                            try {
                                this._sendDataInternal({ pong: msg.ping }, connection.uuid);
                                this._log('Sent pong response to publisher');
                            } catch (error) {
                                this._log('Failed to send pong:', error.message);
                            }
                        }
                    } else if (msg.pong) {
                        // Publishers receive pong responses from viewers
                        if (connection.type === 'publisher') {
                            const latency = Date.now() - msg.pong;
                            
                            // Clear pending ping and reset missed counter
                            if (connection.pendingPing === msg.pong) {
                                connection.pendingPing = null;
                                connection.missedPings = 0;
                            }
                            
                            this._emit('peerLatency', { 
                                uuid: connection.uuid, 
                                latency: latency,
                                streamID: connection.streamID 
                            });
                            this._log(`Latency to viewer ${connection.uuid}: ${latency}ms`);
                        }
                    } else if (msg.bye) {
                        this._log('Received bye message via data channel');
                        this._handleBye({ UUID: connection.uuid });
                    } else if (msg.pipe) {
                        // Handle generic data sent via pipe protocol
                        this._log('Received generic data via pipe');
                        
                        // Check if this is a pub/sub or request/response message
                        if (msg.pipe && typeof msg.pipe === 'object' && 
                            (msg.pipe.type === 'subscribe' || msg.pipe.type === 'unsubscribe' ||
                             msg.pipe.type === 'channelMessage' || msg.pipe.type === 'request' ||
                             msg.pipe.type === 'response')) {
                            this._handleDataChannelMessage(msg.pipe, connection.uuid);
                        } else {
                            // Regular data message
                            this._emit('dataReceived', {
                                data: msg.pipe,
                                uuid: connection.uuid,
                                streamID: connection.streamID
                            });
                        }
                    } else if (msg.iceRestartRequest) {
                        this._log('Received ICE restart request via data channel');
                        // Handle ICE restart
                        if (connection.pc && connection.pc.restartIce) {
                            connection.pc.restartIce();
                        } else {
                            // Create new offer with ICE restart
                            const offer = await connection.pc.createOffer({ iceRestart: true });
                            await connection.pc.setLocalDescription(offer);
                            
                            const offerMsg = {
                                UUID: connection.uuid,
                                session: connection.session,
                                streamID: connection.streamID
                            };
                            
                            // Encrypt and send via data channel
                            if (this.password && this.password !== false) {
                                try {
                                    const [encrypted, vector] = await this._encryptMessage(JSON.stringify(offer));
                                    const restartMsg = { 
                                        description: encrypted,
                                        vector: vector,
                                        session: connection.session
                                    };
                                    this._logMessage('OUT', restartMsg, 'DataChannel');
                                    channel.send(JSON.stringify(restartMsg));
                                } catch (error) {
                                    this._log('Failed to encrypt offer for ICE restart:', error);
                                }
                            } else {
                                const restartMsg = { 
                                    description: offer,
                                    session: connection.session
                                };
                                this._logMessage('OUT', restartMsg, 'DataChannel');
                                channel.send(JSON.stringify(restartMsg));
                            }
                        }
                    }
                } catch (error) {
                    // Not JSON, treat as regular data
                    this._emit('data', {
                        data: event.data,
                        uuid: connection.uuid,
                        streamID: connection.streamID
                    });
                }
            };

            channel.onerror = (error) => {
                this._log('Data channel error:', error);
            };

            channel.onclose = () => {
                this._log('Data channel closed');
            };
        }

        /**
         * Update tracks for a connection based on preferences
         * @private
         * @param {Object} connection - Connection object
         */
        async _updateTracksForConnection(connection) {
            if (!this.localStream || !connection.pc) return;

            const senders = connection.pc.getSenders();
            
            // Update audio tracks
            const audioTracks = this.localStream.getAudioTracks();
            const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
            
            if (audioSender) {
                if (!connection.allowAudio) {
                    await audioSender.replaceTrack(null);
                } else if (audioTracks.length > 0) {
                    await audioSender.replaceTrack(audioTracks[0]);
                }
            }

            // Update video tracks
            const videoTracks = this.localStream.getVideoTracks();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            
            if (videoSender) {
                if (!connection.allowVideo) {
                    await videoSender.replaceTrack(null);
                } else if (videoTracks.length > 0) {
                    await videoSender.replaceTrack(videoTracks[0]);
                }
            }
        }

        /**
         * Create an offer for a connection
         * @private
         * @param {Object} connection - Connection object
         * @returns {Promise<RTCSessionDescription>} The offer
         */
        async _createOffer(connection) {
            if (!connection) {
                throw new Error('No connection provided to _createOffer');
            }

            if (!connection.pc) {
                this._log('ERROR: No peer connection in connection object');
                throw new Error('No peer connection available');
            }

            try {
                // Add tracks if we're publishing
                if (this.localStream && connection.type === 'publisher') {
                    const audioTracks = this.localStream.getAudioTracks();
                    const videoTracks = this.localStream.getVideoTracks();

                    // Add tracks based on viewer preferences
                    if (connection.allowAudio && audioTracks.length > 0) {
                        audioTracks.forEach(track => {
                            connection.pc.addTrack(track, this.localStream);
                        });
                    }

                    if (connection.allowVideo && videoTracks.length > 0) {
                        videoTracks.forEach(track => {
                            connection.pc.addTrack(track, this.localStream);
                        });
                    }
                }

                // Create offer
                const offer = await connection.pc.createOffer();
                await connection.pc.setLocalDescription(offer);

                this._log('Created offer successfully');
                return offer;

            } catch (error) {
                this._log('Error creating offer:', error.message);
                throw error;
            }
        }

        /**
         * Create an answer for a connection
         * @private
         * @param {Object} connection - Connection object
         * @returns {Promise<RTCSessionDescription>} The answer
         */
        async _createAnswer(connection) {
            if (!connection.pc) {
                throw new Error('No peer connection available');
            }

            const answer = await connection.pc.createAnswer();
            await connection.pc.setLocalDescription(answer);

            return answer;
        }

        /**
         * Handle ICE candidate
         * @private
         * @param {RTCPeerConnectionIceEvent} event - ICE candidate event
         * @param {Object} connection - Connection object
         */
        async _handleICECandidate(event, connection) {
            if (!event.candidate) {
                this._log('Empty ICE candidate, gathering complete');
                return;
            }

            // Try data channel first for individual candidates
            if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
                try {
                    const msg = {
                        // IMPORTANT: Set type field based on our role:
                    // - If we are a VIEWER, we send type:'remote' (going TO publisher's pcs)
                    // - If we are a PUBLISHER, we send type:'local' (going TO viewer's rpcs)
                    type: connection.type === 'viewer' ? 'remote' : 'local',
                        candidates: [{
                            candidate: event.candidate.candidate,
                            sdpMLineIndex: event.candidate.sdpMLineIndex,
                            sdpMid: event.candidate.sdpMid
                        }],
                        session: connection.session
                    };
                    this._logMessage('OUT', msg, 'DataChannel');
                    connection.dataChannel.send(JSON.stringify(msg));
                    this._log('Sent ICE via data channel');
                    return;
                } catch (error) {
                    this._log('Failed to send ICE via data channel:', error.message);
                }
            }

            // Add to bundle for WebSocket transmission
            connection.iceBundle.push(event.candidate);

            // If timer is running, just add to bundle
            if (connection.iceTimer !== null) {
                return;
            }

            // Start new bundle timer
            connection.iceTimer = setTimeout(async () => {
                connection.iceTimer = null;
                
                // Prepare the bundle message
                const bundleMsg = {
                    UUID: connection.uuid,
                    // IMPORTANT: Set type field based on our role:
                    // - If we are a VIEWER, we send type:'remote' (going TO publisher's pcs)
                    // - If we are a PUBLISHER, we send type:'local' (going TO viewer's rpcs)
                    type: connection.type === 'viewer' ? 'remote' : 'local',
                    candidates: connection.iceBundle,
                    session: connection.session
                };
                
                // NOTE: We do NOT include streamID in ICE candidate messages
                // UUID + type is sufficient for routing

                // Clear the bundle
                const candidates = connection.iceBundle;
                connection.iceBundle = [];
                
                // Increase delay for future bundles
                connection.iceBundleDelay = Math.min(1000, connection.iceBundleDelay * 2);

                // Encrypt candidates if password is set
                if (this.password && this.password !== false && this.password !== null && this.password !== '') {
                    try {
                        const [encrypted, vector] = await this._encryptMessage(JSON.stringify(candidates));
                        bundleMsg.candidates = encrypted;
                        bundleMsg.vector = vector;
                        this._log('Encrypted ICE candidates bundle');
                    } catch (error) {
                        this._log('Failed to encrypt ICE candidates:', error);
                        bundleMsg.candidates = candidates;
                    }
                }

                this._sendMessageWS(bundleMsg);
                this._log(`Sent ICE bundle with ${candidates.length} candidates`);
                
            }, connection.iceBundleDelay);
        }

        /**
         * Handle connection failure
         * @private
         * @param {Object} connection - Connection object
         */
        _handleConnectionFailed(connection) {
            this._log('Connection failed:', connection.uuid, 'type:', connection.type);

            // Stop ping monitoring
            this._stopPingMonitoring(connection);

            if (connection.pc) {
                connection.pc.close();
            }

            // For viewer connections, check if we should retry
            if (connection.type === 'viewer' && connection.streamID && !this._intentionalDisconnect) {
                this._log('Viewer connection failed for stream:', connection.streamID);
                
                // Store the stream we were viewing for retry
                if (!this._failedViewerConnections) {
                    this._failedViewerConnections = new Map();
                }
                
                // Track the failed connection with retry info
                this._failedViewerConnections.set(connection.streamID, {
                    uuid: connection.uuid,
                    viewOptions: connection.viewOptions || {},
                    retryCount: 0,
                    lastRetry: Date.now()
                });
                
                // Schedule a retry after a short delay
                setTimeout(() => {
                    this._retryFailedViewerConnection(connection.streamID);
                }, 2000); // Wait 2 seconds before retry
            }

            // Remove the specific connection type
            const connections = this.connections.get(connection.uuid);
            if (connections) {
                delete connections[connection.type];
                
                // If no connections left for this UUID, remove the entry
                if (!connections.viewer && !connections.publisher) {
                    this.connections.delete(connection.uuid);
                }
            }

            this._emit('connectionFailed', {
                uuid: connection.uuid,
                type: connection.type,
                streamID: connection.streamID
            });
        }

        /**
         * Retry a failed viewer connection
         * @private
         * @param {string} streamID - Stream ID to retry
         */
        async _retryFailedViewerConnection(streamID) {
            const failedConnection = this._failedViewerConnections.get(streamID);
            if (!failedConnection) return;

            // Check if we should still retry
            if (this._intentionalDisconnect) {
                this._failedViewerConnections.delete(streamID);
                return;
            }

            this._log('Retrying viewer connection for stream:', streamID);
            failedConnection.retryCount++;

            try {
                // Re-request the stream
                await this.view(streamID, failedConnection.viewOptions);
                
                // Success - remove from failed connections
                this._failedViewerConnections.delete(streamID);
                this._log('Successfully reconnected to stream:', streamID);
            } catch (error) {
                this._log('Retry failed for stream:', streamID, error.message);
                
                // Schedule another retry with exponential backoff
                const nextDelay = Math.min(30000, 2000 * Math.pow(2, Math.min(failedConnection.retryCount - 1, 5)));
                
                setTimeout(() => {
                    this._retryFailedViewerConnection(streamID);
                }, nextDelay);
            }
        }

        // ============================================================================
        // SESSION MANAGEMENT
        // ============================================================================

        /**
         * Generate a random session ID
         * @private
         * @returns {string} 8-character session ID
         */
        _generateSession() {
            // Generate 8-character alphanumeric session ID
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let session = '';
            for (let i = 0; i < 8; i++) {
                session += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return session;
        }

        // ============================================================================
        // MESSAGE HANDLING
        // ============================================================================

        /**
         * Handle signaling messages
         * @private
         * @param {Object} msg - Message from signaling server
         */
        async _handleSignalingMessage(msg) {
            // Capture UUID from server
            if (msg && msg.id && !this.state.uuid) {
                this.state.uuid = msg.id;
                this._log('Captured UUID:', msg.id);
            }

            // Log incoming messages for debugging
            if (msg.request || msg.description || msg.candidate || msg.candidates) {
                this._log('Incoming message type:', msg.request || (msg.description ? 'description' : 'other'));
            }

            // Handle different message types
            if (msg.description) {
                await this._handleSDP(msg);
            } else if (msg.candidate) {
                await this._handleRemoteICECandidate(msg);
            } else if (msg.candidates) {
                await this._handleRemoteICECandidates(msg);
            } else if (msg.request === "joinroom") {
                await this._handleJoinRoom(msg);
            } else if (msg.request === "play") {
                await this._handlePlayRequest(msg);
            } else if (msg.request === "listing") {
                this._handleListing(msg);
            } else if (msg.request === "videoaddedtoroom") {
                this._handleVideoAddedToRoom(msg);
            } else if (msg.request === "someonejoined") {
                this._handleSomeoneJoined(msg);
            } else if (msg.request === "error") {
                this._handleError(msg);
            } else if (msg.request === "alert") {
                this._handleAlert(msg);
            } else if (msg.request === "transferred") {
                this._handleTransferred(msg);
            } else if (msg.request === "offerSDP") {
                this._handleOfferSDPRequest(msg);
            } else if (msg.rejected) {
                this._handleRejected(msg);
            } else if (msg.approved !== undefined) {
                this._handleApproved(msg);
            } else if (msg.bye) {
                this._handleBye(msg);
            } else if (msg.hangup) {
                this._handleHangup(msg);
            } else if (msg.pipe !== undefined && msg.__fallback) {
                // Handle fallback data message from WebSocket
                this._handleFallbackData(msg);
            }
        }

        /**
         * Handle SDP messages
         * @private
         * @param {Object} msg - SDP message
         */
        async _handleSDP(msg) {
            // Check if description is encrypted
            if (this.password && msg.vector && typeof msg.description === 'string') {
                try {
                    const decrypted = await this._decryptMessage(msg.description, msg.vector);
                    msg.description = JSON.parse(decrypted);
                    this._log('Decrypted SDP description');
                } catch (error) {
                    this._log('Failed to decrypt SDP description:', error);
                    return;
                }
            }

            if (msg.description.type === 'offer') {
                await this._handleOfferSDP(msg);
            } else if (msg.description.type === 'answer') {
                await this._handleAnswerSDP(msg);
            }
        }

        /**
         * Handle offer SDP
         * @private
         * @param {Object} msg - Offer message
         */
        async _handleOfferSDP(msg) {
            this._log('Handling offer from:', msg.UUID, 'session:', msg.session);

            // Check if we have an existing viewer connection with different session
            const existingConnections = this.connections.get(msg.UUID);
            if (existingConnections && existingConnections.viewer) {
                const existingConnection = existingConnections.viewer;
                if (existingConnection.streamID === msg.streamID && 
                    existingConnection.session && existingConnection.session !== msg.session) {
                    this._log('Found existing connection with different session:', existingConnection.session, 'vs', msg.session);
                    this._log('Closing old connection due to session mismatch');
                    
                    if (existingConnection.pc) {
                        existingConnection.pc.close();
                    }
                    delete existingConnections.viewer;
                }
            }

            // Create new connection
            const connection = await this._createConnection(msg.UUID, 'viewer');
            connection.streamID = msg.streamID;
            connection.session = msg.session;  // Store the publisher's session
            
            // Check if we have pending view preferences for this streamID
            const pendingView = this._pendingViews.get(msg.streamID);
            if (pendingView && pendingView.options) {
                connection.viewPreferences = {
                    audio: pendingView.options.audio !== false,
                    video: pendingView.options.video !== false
                };
                if (pendingView.options.label) {
                    connection.viewPreferences.label = pendingView.options.label;
                }
                // Store viewOptions for reconnection handling
                connection.viewOptions = pendingView.options;
                this._log('Attached view preferences to connection:', connection.viewPreferences);
            } else {
                // Default to requesting both audio and video if no preferences specified
                connection.viewPreferences = {
                    audio: true,
                    video: true
                };
                // Store default viewOptions for reconnection handling
                connection.viewOptions = { audio: true, video: true };
                this._log('No pending view found, using default preferences:', connection.viewPreferences);
            }
            
            this._log(`Created viewer connection for offer - UUID: ${msg.UUID}, streamID: ${msg.streamID}, session: ${msg.session}`);

            try {
                // Set remote description
                await connection.pc.setRemoteDescription(new RTCSessionDescription(msg.description));

                // Create and send answer
                const answer = await this._createAnswer(connection);

                const answerMsg = {
                    UUID: msg.UUID,  // Target UUID for routing
                    session: msg.session,  // Echo back the publisher's session
                    streamID: msg.streamID
                };

                // Encrypt description if password is set
                if (this.password && this.password !== false && this.password !== null && this.password !== '') {
                    try {
                        const [encrypted, vector] = await this._encryptMessage(JSON.stringify(answer));
                        answerMsg.description = encrypted;
                        answerMsg.vector = vector;
                        this._log('Encrypted answer SDP');
                    } catch (error) {
                        this._log('Failed to encrypt answer:', error);
                        answerMsg.description = answer;
                    }
                } else {
                    answerMsg.description = answer;
                }

                // Try data channel first, fall back to WebSocket
                if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
                    // For data channel, we need to handle encryption differently
                    if (this.password && this.password !== false && this.password !== null && this.password !== '') {
                        const dcMsg = { 
                            description: answerMsg.description,
                            vector: answerMsg.vector 
                        };
                        this._logMessage('OUT', dcMsg, 'DataChannel');
                        connection.dataChannel.send(JSON.stringify(dcMsg));
                    } else {
                        const dcMsg = { description: answer };
                        this._logMessage('OUT', dcMsg, 'DataChannel');
                        connection.dataChannel.send(JSON.stringify(dcMsg));
                    }
                    this._log('Sent answer via data channel');
                } else {
                    this._sendMessageWS(answerMsg);
                    this._log('Sent answer via WebSocket with session:', msg.session);
                }

            } catch (error) {
                this._log('Error handling offer:', error);
                this._emit('error', { 
                    error: 'Failed to handle offer', 
                    details: error.message 
                });
            }
        }

        /**
         * Handle answer SDP
         * @private
         * @param {Object} msg - Answer message
         */
        async _handleAnswerSDP(msg) {
            this._log('Handling answer from:', msg.UUID, 'session:', msg.session);

            // For answers, we need to find the publisher connection
            let connection = this._getConnection(msg.UUID, 'publisher');
            if (!connection) {
                // Try to find any connection for this UUID
                connection = this._findConnection(msg.UUID);
                if (!connection) {
                    this._log('No connection found for answer');
                    return;
                }
            }

            // Validate session if present
            if (msg.session && connection.session && msg.session !== connection.session) {
                this._log('Session mismatch - ignoring answer. Expected:', connection.session, 'Got:', msg.session);
                return;
            }

            try {
                await connection.pc.setRemoteDescription(new RTCSessionDescription(msg.description));
                this._log('Remote description set successfully');
            } catch (error) {
                this._log('Error handling answer:', error);
                this._emit('error', { 
                    error: 'Failed to handle answer', 
                    details: error.message 
                });
            }
        }

        /**
         * Handle remote ICE candidate
         * @private
         * @param {Object} msg - ICE candidate message
         */
        async _handleRemoteICECandidate(msg) {
            // Check if candidate is encrypted
            if (this.password && msg.vector && typeof msg.candidate === 'string') {
                try {
                    const decrypted = await this._decryptMessage(msg.candidate, msg.vector);
                    msg.candidate = JSON.parse(decrypted);
                    this._log('Decrypted ICE candidate');
                } catch (error) {
                    this._log('Failed to decrypt ICE candidate:', error);
                    return;
                }
            }

            // Find the correct connection based on type field
            // IMPORTANT: VDO.Ninja uses the 'type' field to route messages when you have both 
            // viewing and publishing connections to the same peer UUID.
            //
            // msg.type "remote" = ICE candidate FROM a viewer TO a publisher
            //   - If we are publishing, we receive "remote" type from viewers
            //   - In VDO.Ninja terms: goes to session.pcs[UUID] (publisher's connection)
            //
            // msg.type "local" = ICE candidate FROM a publisher TO a viewer  
            //   - If we are viewing, we receive "local" type from publishers
            //   - In VDO.Ninja terms: goes to session.rpcs[UUID] (viewer's connection)
            //
            // This routing happens BEFORE session validation because each connection
            // has its own session ID
            let connection = null;
            
            // Determine the connection type based on the message type
            if (msg.type === "remote") {
                // We are publisher, receiving from viewer
                connection = this._getConnection(msg.UUID, 'publisher');
            } else if (msg.type === "local") {
                // We are viewer, receiving from publisher
                connection = this._getConnection(msg.UUID, 'viewer');
            } else {
                // No type specified, try to find any connection
                connection = this._getConnection(msg.UUID);
            }

            if (!connection || !connection.pc) {
                this._log(`No connection found for ICE candidate with type: ${msg.type}, UUID: ${msg.UUID}`);
                this._log('Available connections:', Array.from(this.connections.entries()).map(([k, v]) => 
                    `UUID: ${v.uuid}, type: ${v.type}, streamID: ${v.streamID}`
                ));
                return;
            }

            // Validate session if present
            if (msg.session && connection.session && msg.session !== connection.session) {
                this._log('Session mismatch - ignoring ICE candidate. Expected:', connection.session, 'Got:', msg.session);
                return;
            }

            try {
                // Add type field if missing
                if (msg.candidate && !msg.candidate.type) {
                    msg.candidate.type = 'host';
                }
                
                await connection.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                this._log('Added ICE candidate');
            } catch (error) {
                this._log('Error adding ICE candidate:', error);
            }
        }

        /**
         * Handle multiple remote ICE candidates
         * @private
         * @param {Object} msg - ICE candidates message
         */
        async _handleRemoteICECandidates(msg) {
            // Check if candidates are encrypted
            if (this.password && msg.vector && typeof msg.candidates === 'string') {
                try {
                    const decrypted = await this._decryptMessage(msg.candidates, msg.vector);
                    msg.candidates = JSON.parse(decrypted);
                    this._log('Decrypted ICE candidates bundle');
                } catch (error) {
                    this._log('Failed to decrypt ICE candidates:', error);
                    return;
                }
            }
            
            this._log(`Received ICE candidates bundle - type: ${msg.type}, UUID: ${msg.UUID}, session: ${msg.session}`);
            this._log(`Candidates count: ${msg.candidates ? msg.candidates.length : 0}`);

            // Find the correct connection based on type field
            // IMPORTANT: VDO.Ninja uses the 'type' field to route messages when you have both 
            // viewing and publishing connections to the same peer UUID.
            //
            // msg.type "remote" = ICE candidate FROM a viewer TO a publisher
            //   - If we are publishing, we receive "remote" type from viewers
            //   - In VDO.Ninja terms: goes to session.pcs[UUID] (publisher's connection)
            //
            // msg.type "local" = ICE candidate FROM a publisher TO a viewer  
            //   - If we are viewing, we receive "local" type from publishers
            //   - In VDO.Ninja terms: goes to session.rpcs[UUID] (viewer's connection)
            //
            // This routing happens BEFORE session validation because each connection
            // has its own session ID
            let connection = null;
            
            // Determine the connection type based on the message type
            if (msg.type === "remote") {
                // We are publisher, receiving from viewer
                connection = this._getConnection(msg.UUID, 'publisher');
            } else if (msg.type === "local") {
                // We are viewer, receiving from publisher
                connection = this._getConnection(msg.UUID, 'viewer');
            } else {
                // No type specified, try to find any connection
                connection = this._getConnection(msg.UUID);
            }

            if (!connection || !connection.pc) {
                this._log(`No connection found for ICE candidates bundle with type: ${msg.type}, UUID: ${msg.UUID}`);
                this._log('Available connections:', Array.from(this.connections.entries()).map(([k, v]) => 
                    `UUID: ${v.uuid}, type: ${v.type}, streamID: ${v.streamID}`
                ));
                return;
            }

            // Validate session if present
            if (msg.session && connection.session && msg.session !== connection.session) {
                this._log('Session mismatch - ignoring ICE candidates. Expected:', connection.session, 'Got:', msg.session);
                return;
            }

            for (const candidate of msg.candidates) {
                try {
                    if (candidate.candidate) {
                        await connection.pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                } catch (error) {
                    this._log('Error adding ICE candidate:', error);
                }
            }
        }

        /**
         * Handle join room request
         * @private
         * @param {Object} msg - Join room message
         */
        async _handleJoinRoom(msg) {
            this._log('Received join room request:', msg);

            if (!this.state.publishing) {
                this._log('Not publishing, ignoring join request');
                return;
            }

            // Create connection for the viewer
            const connection = await this._createConnection(msg.UUID, 'publisher');
            connection.streamID = this.state.streamID;

            // Store track preferences from viewer
            if (msg.audio !== undefined || msg.video !== undefined) {
                connection.allowAudio = msg.audio !== false;
                connection.allowVideo = msg.video !== false;
            }

            // Create offer and send it
            try {
                const offer = await this._createOffer(connection);

                const offerMsg = {
                    UUID: this.state.uuid,
                    session: msg.session || connection.uuid,
                    streamID: this.state.streamID
                };

                // Store session IDs
                if (msg.session) {
                    this._sessionIDs[msg.UUID] = msg.session;
                    this._remoteSessionIDs[msg.UUID] = msg.session;
                }

                // Encrypt description if password is set
                if (this.password && this.password !== false && this.password !== null && this.password !== '') {
                    try {
                        const [encrypted, vector] = await this._encryptMessage(JSON.stringify(offer));
                        offerMsg.description = encrypted;
                        offerMsg.vector = vector;
                        this._log('Encrypted offer SDP');
                    } catch (error) {
                        this._log('Failed to encrypt offer:', error);
                        offerMsg.description = offer;
                    }
                } else {
                    offerMsg.description = offer;
                }

                this._sendMessageWS(offerMsg);
                this._log('Sent offer to viewer');

            } catch (error) {
                this._log('Error creating offer for viewer:', error);
            }
        }

        /**
         * Handle play request
         * @private
         * @param {Object} msg - Play request message
         */
        async _handlePlayRequest(msg) {
            this._log('Received play request for:', msg.streamID, 'from:', msg.UUID);

            if (!this.state.publishing || this.state.streamID !== msg.streamID) {
                this._log('Not publishing this stream');
                return;
            }

            // Create connection for the viewer
            const connection = await this._createConnection(msg.UUID, 'publisher');
            connection.streamID = this.state.streamID;
            
            // Generate a new session for this connection (publisher creates session)
            connection.session = this._generateSession();

            // Store track preferences
            if (msg.audio !== undefined || msg.video !== undefined) {
                connection.allowAudio = msg.audio !== false;
                connection.allowVideo = msg.video !== false;
            }

            // Create offer
            try {
                const offer = await this._createOffer(connection);

                const offerMsg = {
                    UUID: msg.UUID,  // Target UUID for routing
                    session: connection.session,  // Use the connection's session
                    streamID: this.state.streamID
                };

                // Encrypt description if password is set
                if (this.password && this.password !== false && this.password !== null && this.password !== '') {
                    try {
                        const [encrypted, vector] = await this._encryptMessage(JSON.stringify(offer));
                        offerMsg.description = encrypted;
                        offerMsg.vector = vector;
                        this._log('Encrypted offer SDP');
                    } catch (error) {
                        this._log('Failed to encrypt offer:', error);
                        offerMsg.description = offer;
                    }
                } else {
                    offerMsg.description = offer;
                }

                this._sendMessageWS(offerMsg);
                this._log('Sent offer to viewer with session:', connection.session);

            } catch (error) {
                this._log('Error creating offer for play request:', error);
            }
        }

        /**
         * Strip hash suffix from stream ID
         * @private
         * @param {string} streamID - Stream ID potentially with hash suffix
         * @returns {string} Clean stream ID without hash
         */
        _stripHashFromStreamID(streamID) {
            if (!streamID || typeof streamID !== 'string') return streamID;
            
            // Hash suffixes are 6 characters long and are lowercase hex
            if (streamID.length > 6) {
                const lastSix = streamID.slice(-6);
                // Check if last 6 chars are hex (0-9, a-f)
                if (/^[a-f0-9]{6}$/.test(lastSix)) {
                    return streamID.slice(0, -6);
                }
            }
            
            return streamID;
        }

        /**
         * Handle listing message
         * @private
         * @param {Object} msg - Listing message
         */
        _handleListing(msg) {
            this._log('Processing listing');

            // Emit internal event for room joined
            this._emit('_roomJoined');

            // Emit listing event for compatibility with Gemini example
            if (msg.list && Array.isArray(msg.list)) {
                // Process the list to strip hash suffixes
                const cleanList = msg.list.map(item => {
                    if (typeof item === 'string') {
                        return this._stripHashFromStreamID(item);
                    } else if (item && item.streamID) {
                        return {
                            ...item,
                            streamID: this._stripHashFromStreamID(item.streamID)
                        };
                    }
                    return item;
                });
                
                // Emit for the whole list
                this._emit('listing', { list: cleanList, raw: msg });

                // Also emit for each item
                cleanList.forEach((item, index) => {
                    const originalItem = msg.list[index];
                    if (item && (item.streamID || typeof item === 'string')) {
                        this._emit('listing', {
                            streamID: item.streamID || item,
                            uuid: (originalItem && originalItem.UUID) || (originalItem && originalItem.uuid),
                            label: item.label,
                            list: cleanList
                        });
                    }
                });
            } else {
                // Single item format
                this._emit('listing', {
                    streamID: this._stripHashFromStreamID(msg.streamID),
                    uuid: msg.UUID,
                    label: msg.label,
                    raw: msg
                });
            }

            // Original peerListing event for backward compatibility
            this._emit('peerListing', msg);
        }

        /**
         * Handle video added to room
         * @private
         * @param {Object} msg - Video added message
         */
        _handleVideoAddedToRoom(msg) {
            const cleanStreamID = this._stripHashFromStreamID(msg.streamID);
            this._log('Video added to room:', cleanStreamID);

            // Check if we have a pending view for this stream
            if (this._pendingViews.has(cleanStreamID)) {
                this._log('Found pending view for newly available stream:', cleanStreamID);
                const pendingView = this._pendingViews.get(cleanStreamID);
                
                // For room-based streams, the server doesn't auto-connect
                // We need to send a new play request
                this._log('Re-requesting stream that just became available:', cleanStreamID);
                
                // Remove from pending views to avoid loops
                this._pendingViews.delete(cleanStreamID);
                
                // Re-request the stream
                setTimeout(async () => {
                    try {
                        await this.view(cleanStreamID, pendingView.options);
                        this._log('Successfully connected to newly available stream:', cleanStreamID);
                    } catch (error) {
                        this._log('Failed to connect to newly available stream:', error.message);
                    }
                }, 100); // Small delay to ensure proper sequencing
            }

            // Emit the event that Gemini example expects
            this._emit('videoaddedtoroom', {
                streamID: cleanStreamID,
                uuid: msg.UUID || msg.uuid,
                raw: msg
            });

            // Also emit streamAdded for our internal use
            this._emit('streamAdded', {
                streamID: cleanStreamID,
                uuid: msg.UUID || msg.uuid
            });
        }

        /**
         * Handle someone joined
         * @private
         * @param {Object} msg - User joined message
         */
        _handleSomeoneJoined(msg) {
            const cleanStreamID = msg.streamID ? this._stripHashFromStreamID(msg.streamID) : null;
            this._log('Someone joined:', cleanStreamID || msg.UUID);

            // Also emit as videoaddedtoroom for compatibility
            this._emit('videoaddedtoroom', {
                streamID: cleanStreamID,
                uuid: msg.UUID || msg.uuid,
                raw: msg
            });

            this._emit('userJoined', msg);
        }

        /**
         * Handle user left
         * @private
         * @param {Object} msg - User left message
         */
        _handleUserLeft(msg) {
            this._log('User left:', msg.UUID);

            // Remove all connections for this user
            const connections = this.connections.get(msg.UUID);
            if (connections) {
                // Close all connection types
                for (const type of ['viewer', 'publisher']) {
                    const connection = connections[type];
                    if (connection && connection.pc) {
                        connection.pc.close();
                    }
                }
                this.connections.delete(msg.UUID);
            }

            this._emit('userLeft', msg);
        }


        /**
         * Handle error message
         * @private
         * @param {Object} msg - Error message
         */
        _handleError(msg) {
            this._log('Error from server:', msg.message, 'Code:', msg.code);
            this._emit('error', { 
                error: msg.message, 
                code: msg.code,
                details: msg 
            });
        }

        /**
         * Handle alert message
         * @private
         * @param {Object} msg - Alert message
         */
        _handleAlert(msg) {
            this._log('Alert from server:', msg.message);
            
            // Handle specific alerts
            if (msg.message && msg.message.includes('Stream ID is already in use')) {
                // Publishing failed - reset state
                this.state.publishing = false;
                this.state.streamID = null;
                this._log('Publishing failed due to stream ID conflict');
            }
            
            this._emit('alert', { 
                message: msg.message,
                raw: msg 
            });
        }

        /**
         * Handle transferred message
         * @private
         * @param {Object} msg - Transferred message
         */
        _handleTransferred(msg) {
            this._log('Transferred to new room');
            // Similar to listing, but indicates we were moved
            this._emit('transferred', {
                list: msg.list,
                director: msg.director,
                raw: msg
            });
            // Also emit as listing for compatibility
            this._handleListing(msg);
        }

        /**
         * Handle offerSDP request (server asking us to send offer)
         * @private
         * @param {Object} msg - OfferSDP request
         */
        async _handleOfferSDPRequest(msg) {
            this._log('Server requesting offer SDP for viewer:', msg.UUID);
            
            if (!this.state.publishing) {
                this._log('Not publishing, ignoring offerSDP request');
                return;
            }

            // Create connection for the viewer
            const connection = await this._createConnection(msg.UUID, 'publisher');
            connection.streamID = this.state.streamID;
            
            // Generate a new session for this connection (publisher creates session)
            connection.session = this._generateSession();

            // Create and send offer
            try {
                const offer = await this._createOffer(connection);

                const offerMsg = {
                    description: offer,
                    UUID: msg.UUID,  // Target UUID for routing
                    session: connection.session,  // Use the connection's session
                    streamID: this.state.streamID
                };

                this._sendMessageWS(offerMsg);
                this._log('Sent offer to viewer with session:', connection.session);

            } catch (error) {
                this._log('Error creating offer for viewer:', error);
            }
        }

        /**
         * Handle rejected message
         * @private
         * @param {Object} msg - Rejected message
         */
        _handleRejected(msg) {
            this._log('Connection rejected:', msg.rejected);
            this._emit('rejected', msg);
        }

        /**
         * Handle approved message
         * @private
         * @param {Object} msg - Approved message
         */
        _handleApproved(msg) {
            this._log('Connection approved');
            this._emit('approved', msg);
        }

        /**
         * Handle bye message
         * @private
         * @param {Object} msg - Bye message
         */
        _handleBye(msg) {
            this._log('Received bye from:', msg.UUID);

            // Close all connections for this UUID
            const connections = this.connections.get(msg.UUID);
            if (connections) {
                // Check if we have a viewer connection that should be retried
                const viewerConnection = connections.viewer;
                let shouldRetryViewer = false;
                let streamID = null;
                let viewOptions = null;
                
                if (viewerConnection && viewerConnection.streamID && !this._intentionalDisconnect) {
                    shouldRetryViewer = true;
                    streamID = viewerConnection.streamID;
                    viewOptions = viewerConnection.viewOptions || { audio: true, video: true };
                    this._log('Viewer connection will be retried after bye from publisher:', streamID);
                }
                
                for (const type of ['viewer', 'publisher']) {
                    const connection = connections[type];
                    if (connection) {
                        // Stop ping monitoring
                        this._stopPingMonitoring(connection);
                        // Close peer connection
                        if (connection.pc) {
                            connection.pc.close();
                        }
                    }
                }
                this.connections.delete(msg.UUID);
                
                // If we had a viewer connection and it's not an intentional disconnect,
                // store it for retry
                if (shouldRetryViewer) {
                    if (!this._failedViewerConnections) {
                        this._failedViewerConnections = new Map();
                    }
                    
                    this._failedViewerConnections.set(streamID, {
                        uuid: msg.UUID,
                        viewOptions: viewOptions,
                        retryCount: 0,
                        lastRetry: Date.now()
                    });
                    
                    // Schedule a retry after 2 seconds
                    this._log('Scheduling viewer reconnection after bye message');
                    setTimeout(() => {
                        this._retryFailedViewerConnection(streamID);
                    }, 2000);
                }
            }

            this._emit('bye', msg);
        }

        /**
         * Handle hangup message
         * @private
         * @param {Object} msg - Hangup message
         */
        _handleHangup(msg) {
            this._log('Received hangup from:', msg.UUID);

            // Close all connections for this UUID
            const connections = this.connections.get(msg.UUID);
            if (connections) {
                for (const type of ['viewer', 'publisher']) {
                    const connection = connections[type];
                    if (connection) {
                        // Stop ping monitoring
                        this._stopPingMonitoring(connection);
                        // Close peer connection
                        if (connection.pc) {
                            connection.pc.close();
                        }
                    }
                }
                this.connections.delete(msg.UUID);
            }

            this._emit('hangup', msg);
        }

        /**
         * Handle fallback data message received via WebSocket
         * @private
         * @param {Object} msg - Fallback data message
         */
        _handleFallbackData(msg) {
            this._log('Received fallback data via WebSocket from:', msg.UUID);
            
            // Remove the fallback marker before emitting
            const cleanMsg = { ...msg };
            delete cleanMsg.__fallback;
            
            // Emit the same events as regular data channel messages
            this._emit('dataReceived', {
                data: cleanMsg.pipe,
                uuid: msg.UUID,
                fallback: true
            });
            
            // Also emit the original format for compatibility
            this._emit('data', {
                UUID: msg.UUID,
                data: cleanMsg
            });
        }


        // ============================================================================
        // UTILITIES
        // ============================================================================

        /**
         * Send a message via WebSocket
         * @private
         * @param {Object} msg - Message to send
         */
        _sendMessageWS(msg) {
            if (this.signaling && this.signaling.readyState === WebSocket.OPEN) {
                this._logMessage('OUT', msg, 'WebSocket');
                this.signaling.send(JSON.stringify(msg));
            } else {
                this._log('WebSocket not ready, queuing message');
                // TODO: Implement message queue
            }
        }

        /**
         * Emit an event
         * @private
         * @param {string} eventName - Event name
         * @param {*} detail - Event detail
         */
        _emit(eventName, detail = {}) {
            this.dispatchEvent(new CustomEvent(eventName, { detail }));
        }

        /**
         * Log a message if debug is enabled
         * @private
         * @param {...*} args - Arguments to log
         */
        _log(...args) {
            if (this.debug) {
                console.log('[VDONinjaSDK]', ...args);
            }
        }

        /**
         * Log message traffic with color coding
         * @private
         * @param {string} direction - 'IN' or 'OUT'
         * @param {Object} msg - Message object
         * @param {string} transport - 'WebSocket' or 'DataChannel'
         */
        _logMessage(direction, msg, transport) {
            if (!this.debug) return;
            
            // Clone message to avoid modifying original
            const logMsg = JSON.parse(JSON.stringify(msg));
            
            // Trim long fields
            if (logMsg.description) {
                if (typeof logMsg.description === 'string') {
                    logMsg.description = logMsg.description.substring(0, 10) + '...';
                } else if (logMsg.description.sdp) {
                    logMsg.description.sdp = logMsg.description.sdp.substring(0, 10) + '...';
                }
            }
            
            if (logMsg.candidate) {
                if (typeof logMsg.candidate === 'string') {
                    logMsg.candidate = logMsg.candidate.substring(0, 10) + '...';
                } else if (logMsg.candidate.candidate) {
                    logMsg.candidate.candidate = logMsg.candidate.candidate.substring(0, 10) + '...';
                }
            }
            
            if (logMsg.candidates) {
                if (typeof logMsg.candidates === 'string') {
                    logMsg.candidates = logMsg.candidates.substring(0, 10) + '...';
                } else if (Array.isArray(logMsg.candidates)) {
                    logMsg.candidates = logMsg.candidates.map(c => {
                        if (typeof c === 'string') return c.substring(0, 10) + '...';
                        if (c.candidate) return { ...c, candidate: c.candidate.substring(0, 10) + '...' };
                        return c;
                    });
                }
            }
            
            // Color coding
            const color = direction === 'IN' ? 'color: green' : 'color: blue';
            const prefix = direction === 'IN' ? '← INBOUND' : '→ OUTBOUND';
            
            console.log(`%c${prefix} [${transport}]:`, color, JSON.stringify(logMsg, null, 2));
        }

        /**
         * Generate a random stream ID
         * @private
         * @returns {string} Random stream ID
         */
        _generateStreamID() {
            return Math.random().toString(36).substring(2, 15);
        }

        /**
         * Generate a session ID for WebRTC connections
         * Session IDs are used to track and validate messages for specific connections
         * @private
         * @returns {string} Session ID (8 characters)
         */
        _generateSession() {
            return Math.random().toString(36).substring(2, 10);
        }

        /**
         * Generate a unique identifier (UUID)
         * @private
         * @returns {string} UUID string
         */
        _generateUUID() {
            // Generate a v4 UUID
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            // Fallback for environments without crypto.randomUUID
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        /**
         * Setup crypto utilities
         * @private
         */
        _setupCryptoUtils() {
            this._encoder = new TextEncoder();
            this._decoder = new TextDecoder();
            
            // Set salt based on environment
            if (typeof window !== 'undefined' && window.location) {
                const hostname = window.location.hostname;
                this._log('Setting salt based on hostname:', hostname);
                
                if (hostname === "vdo.ninja" || hostname === "steveseguin.github.io") {
                    this.salt = "vdo.ninja";
                } else if (["vdo.ninja", "rtc.ninja", "versus.cam", "socialstream.ninja"].includes(
                    hostname.split(".").slice(-2).join(".")
                )) {
                    this.salt = hostname.split(".").slice(-2).join(".");
                } else {
                    // Check if IP address
                    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
                    if (ipRegex.test(hostname) || hostname === "localhost" || hostname === "") {
                        this.salt = "vdo.ninja";
                    } else {
                        this.salt = hostname;
                    }
                }
            } else {
                // Node.js environment or no location available
                this.salt = "vdo.ninja";
            }
            
            this._log('Salt set to:', this.salt);
        }

        /**
         * Convert string to ArrayBuffer
         * @private
         * @param {string} str - String to convert
         * @returns {Uint8Array} Array buffer
         */
        _convertStringToArrayBufferView(str) {
            return this._encoder.encode(str);
        }

        /**
         * Convert byte array to hex string
         * @private
         * @param {Uint8Array} byteArray - Byte array
         * @returns {string} Hex string
         */
        _toHexString(byteArray) {
            return Array.from(byteArray, byte => 
                ('0' + (byte & 0xFF).toString(16)).slice(-2)
            ).join('');
        }

        /**
         * Convert hex string to byte array
         * @private
         * @param {string} hexString - Hex string
         * @returns {Uint8Array} Byte array
         */
        _toByteArray(hexString) {
            const result = new Uint8Array(hexString.length / 2);
            for (let i = 0; i < hexString.length; i += 2) {
                result[i / 2] = parseInt(hexString.substr(i, 2), 16);
            }
            return result;
        }

        /**
         * Encrypt a message
         * @private
         * @param {string} message - Message to encrypt
         * @param {string} phrase - Encryption phrase (default: password + salt)
         * @returns {Promise<[string, string]>} [encrypted data, vector] as hex strings
         */
        async _encryptMessage(message, phrase = null) {
            if (!this.password || this.password === false || this.password === null || this.password === '') {
                throw new Error('Password not set for encryption');
            }

            if (!phrase) {
                phrase = this.password + this.salt;
            }

            const vector = crypto.getRandomValues(new Uint8Array(16));
            
            try {
                const keyMaterial = await crypto.subtle.digest(
                    { name: "SHA-256" }, 
                    this._convertStringToArrayBufferView(phrase)
                );
                
                const key = await crypto.subtle.importKey(
                    "raw", 
                    keyMaterial, 
                    { name: "AES-CBC" }, 
                    false, 
                    ["encrypt", "decrypt"]
                );
                
                const encrypted = await crypto.subtle.encrypt(
                    { name: "AES-CBC", iv: vector }, 
                    key, 
                    this._convertStringToArrayBufferView(message)
                );
                
                const encryptedData = new Uint8Array(encrypted);
                return [this._toHexString(encryptedData), this._toHexString(vector)];
                
            } catch (error) {
                this._log('Encryption error:', error);
                throw error;
            }
        }

        /**
         * Decrypt a message
         * @private
         * @param {string} encryptedData - Encrypted data as hex string
         * @param {string} vector - Initialization vector as hex string
         * @param {string} phrase - Decryption phrase (default: password + salt)
         * @returns {Promise<string>} Decrypted message
         */
        async _decryptMessage(encryptedData, vector, phrase = null) {
            if (!this.password || this.password === false || this.password === null || this.password === '') {
                throw new Error('Password not set for decryption');
            }

            if (!phrase) {
                phrase = this.password + this.salt;
            }

            const encryptedBytes = this._toByteArray(encryptedData);
            const vectorBytes = this._toByteArray(vector);
            
            try {
                const keyMaterial = await crypto.subtle.digest(
                    { name: "SHA-256" }, 
                    this._convertStringToArrayBufferView(phrase)
                );
                
                const key = await crypto.subtle.importKey(
                    "raw", 
                    keyMaterial, 
                    { name: "AES-CBC" }, 
                    false, 
                    ["encrypt", "decrypt"]
                );
                
                const decrypted = await crypto.subtle.decrypt(
                    { name: "AES-CBC", iv: vectorBytes }, 
                    key, 
                    encryptedBytes
                );
                
                return this._decoder.decode(new Uint8Array(decrypted));
                
            } catch (error) {
                this._log('Decryption error:', error);
                throw error;
            }
        }

        /**
         * Generate hash from string
         * @private
         * @param {string} str - String to hash
         * @param {number} length - Length of hash to return (in hex characters)
         * @returns {Promise<string>} Hash string
         */
		 
		 
        async _generateHash(str, length = false) {
            const buffer = this._encoder.encode(str);
            const hash = await crypto.subtle.digest("SHA-256", buffer);
            let hashArray = new Uint8Array(hash);
            if (length) {
                // Slice to length/2 bytes to get 'length' hex characters
                hashArray = hashArray.slice(0, parseInt(parseInt(length) / 2));
            }
            return this._toHexString(hashArray);
        }

        /**
         * Hash a room name with password
         * @private
         * @param {string} room - Room name
         * @param {string} password - Password
         * @returns {Promise<string>} Hashed room name
         */
        async _hashRoom(room, password) {
            // Generate the full room hash (room + password + salt)
            this._log(`Hashing room: "${room}" with password: "${password}" and salt: "${this.salt}"`);
            const hash = await this._generateHash(room + password + this.salt, 16);
            this._log(`Room hash result: ${hash}`);
            return hash;
        }

        /**
         * Hash a stream ID with password
         * @private
         * @param {string} streamID - Stream ID
         * @param {string} password - Password
         * @returns {Promise<string>} Hashed stream ID
         */
        async _hashStreamID(streamID, password) {
            // For stream IDs, we need to generate a hash from password + salt
            // and append it to the streamID (no underscore)
            if (!this._passwordHash) {
                this._passwordHash = await this._generateHash(password + this.salt, 6);
            }
            return streamID + this._passwordHash;
        }

        /**
         * Get the hashed room name
         * @private
         * @returns {Promise<string|null>} Hashed room name
         */
        async _getHashedRoom() {
            if (!this.state.room) return null;
            if (this.password === false || this.password === null) return this.state.room;
            return await this._hashRoom(this.state.room, this.password);
        }

        // ============================================================================
        // TURN SERVER MANAGEMENT
        // ============================================================================

        /**
         * Get timezone offset in minutes
         * @private
         * @returns {number} Timezone offset in minutes
         */
        _getTimezone() {
            try {
                return new Date().getTimezoneOffset() * -1;
            } catch (e) {
                return 0;
            }
        }

        /**
         * Compare TURN servers by timezone delta
         * @private
         */
        _compareTurnDeltas(a, b) {
            return a.delta - b.delta;
        }

        /**
         * Process TURN server list based on proximity and preferences
         * @private
         * @param {Array} turnlist - List of TURN servers
         * @returns {Array} Processed TURN servers
         */
        _processTURNs(turnlist) {
            const tz = this._getTimezone();
            
            // Calculate timezone deltas
            for (let i = 0; i < turnlist.length; i++) {
                let delta = Math.abs(turnlist[i].tz - tz);
                if (Math.abs(delta - 60 * 24) < delta) {
                    delta = Math.abs(delta - 60 * 24);
                }
                turnlist[i].delta = delta;
            }
            
            // Sort by proximity
            turnlist.sort(this._compareTurnDeltas);

            const turnResult = [];
            let tcp = 0;
            let udp = 0;
            
            for (let i = 0; i < turnlist.length; i++) {
                const turn = turnlist[i];
                
                // Skip based on preferences
                if (this.forceTcpMode && turn.udp) {
                    continue; // Skip UDP if forcing TCP
                }
                
                // Add up to 2 UDP and 1 TCP server
                if (turn.udp && udp < 2) {
                    turnResult.push(turn);
                    udp += 1;
                } else if (!turn.udp && tcp < 1) {
                    turnResult.push(turn);
                    tcp += 1;
                }
            }

            return turnResult;
        }

        /**
         * Get from local storage
         * @private
         * @param {string} key - Storage key
         * @returns {any} Stored value or null
         */
        _getStorage(key) {
            if (typeof localStorage === 'undefined') return null;
            
            try {
                const item = localStorage.getItem(key);
                if (!item) return null;
                
                const data = JSON.parse(item);
                
                // Check if expired
                if (data.expiry && Date.now() > data.expiry) {
                    localStorage.removeItem(key);
                    return null;
                }
                
                return data.value;
            } catch (e) {
                this._log('Storage read error:', e);
                return null;
            }
        }

        /**
         * Set to local storage with expiry
         * @private
         * @param {string} key - Storage key
         * @param {any} value - Value to store
         * @param {number} ttlMinutes - Time to live in minutes
         */
        _setStorage(key, value, ttlMinutes = 60) {
            if (typeof localStorage === 'undefined') return;
            
            try {
                const data = {
                    value: value,
                    expiry: Date.now() + (ttlMinutes * 60 * 1000)
                };
                localStorage.setItem(key, JSON.stringify(data));
            } catch (e) {
                this._log('Storage write error:', e);
            }
        }

        /**
         * Fetch TURN servers from API
         * @private
         * @returns {Promise<Array>} TURN server list
         */
        async _fetchTURNServers() {
            // Check cache first
            const cached = this._getStorage('turnlist');
            if (cached) {
                this._log('Using cached TURN servers');
                return cached;
            }

            const timestamp = Date.now();
            let getTurnURL = "https://turnservers.vdo.ninja/";
            
            // Adjust URL based on hostname if available
            if (typeof window !== 'undefined' && window.location) {
                const hostname = window.location.hostname;
                if (hostname === "rtc.ninja") {
                    getTurnURL = "https://turnservers.rtc.ninja/";
                } else if (hostname === "vdo.socialstream.ninja") {
                    getTurnURL = "https://turnservers.socialstream.ninja/";
                }
            }

            try {
                // Fetch with timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                const response = await fetch(`${getTurnURL}?ts=${timestamp}`, {
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (!data.servers || !Array.isArray(data.servers)) {
                    throw new Error('Invalid server response');
                }
                
                // Cache using configured TTL
                this._setStorage('turnlist', data.servers, this.turnCacheTTL);
                
                return data.servers;
                
            } catch (error) {
                this._log('Failed to fetch TURN servers, using fallback:', error.message);
                
                // Fallback TURN servers
                return [
                    {
                        username: "steve",
                        credential: "setupYourOwnPlease",
                        urls: ["turns:www.turn.obs.ninja:443"],
                        tz: 300,
                        udp: false,
                        locale: "cae1"
                    },
                    {
                        username: "steve",
                        credential: "setupYourOwnPlease",
                        urls: ["turn:turn-cae1.vdo.ninja:3478"],
                        tz: 300,
                        udp: true,
                        locale: "cae1"
                    },
                    {
                        username: "vdoninja",
                        credential: "theyBeSharksHere",
                        urls: ["turn:turn-usw2.vdo.ninja:3478"],
                        tz: 480,
                        udp: true,
                        locale: "usw2"
                    },
                    {
                        username: "vdoninja",
                        credential: "PolandPirat",
                        urls: ["turn:turn-eu4.vdo.ninja:3478"],
                        tz: -70,
                        udp: true,
                        locale: "pol1"
                    },
                    {
                        username: "steve",
                        credential: "setupYourOwnPlease",
                        urls: ["turns:turn.obs.ninja:443"],
                        tz: -60,
                        udp: false,
                        locale: "de1"
                    },
                    {
                        username: "steve",
                        credential: "setupYourOwnPlease",
                        urls: ["turn:turn-eu1.vdo.ninja:3478"],
                        tz: -60,
                        udp: true,
                        locale: "de1"
                    },
                    {
                        username: "vdoninja",
                        credential: "EastSideRepresentZ",
                        urls: ["turn:turn-use1.vdo.ninja:3478"],
                        tz: 300,
                        udp: true,
                        locale: "use1"
                    }
                ];
            }
        }

        /**
         * Get TURN server configuration
         * @private
         * @returns {Promise<void>}
         */
        async _setupTURNServers() {
            // If TURN servers are explicitly disabled
            if (this.turnServers === false) {
                this._log('TURN servers disabled');
                this._turnList = [];
                return;
            }

            // If custom TURN servers provided
            if (Array.isArray(this.turnServers)) {
                this._log('Using custom TURN servers');
                this._turnList = this.turnServers;
                return;
            }

            // Otherwise, fetch from API
            if (!this._turnPromise) {
                this._turnPromise = this._fetchTURNServers().then(servers => {
                    this._turnList = this._processTURNs(servers);
                    this._log('TURN servers loaded:', this._turnList.length);
                    return this._turnList;
                });
            }

            await this._turnPromise;
        }

        /**
         * Get ICE configuration with TURN servers
         * @private
         * @returns {Promise<Object>} RTCConfiguration object
         */
        async _getICEConfiguration() {
            // Setup TURN servers if not already done
            if (this._turnList === null) {
                await this._setupTURNServers();
            }

            const iceServers = [...this.stunServers];
            
            // Add TURN servers
            if (this._turnList && this._turnList.length > 0) {
                iceServers.push(...this._turnList);
            }

            const config = {
                iceServers: iceServers,
                sdpSemantics: 'unified-plan'
            };

            // Force relay mode if requested
            if (this.forceTURN) {
                config.iceTransportPolicy = 'relay';
                this._log('Forcing TURN relay mode for privacy');
            }

            return config;
        }

        /**
         * Clear TURN server cache
         * Forces fresh fetch on next connection
         */
        clearTURNCache() {
            if (typeof localStorage !== 'undefined') {
                try {
                    localStorage.removeItem('turnlist');
                    this._log('TURN server cache cleared');
                } catch (e) {
                    this._log('Failed to clear TURN cache:', e);
                }
            }
            this._turnList = null;
            this._turnPromise = null;
        }

        // ============================================================================
        // PUBLIC API METHODS
        // ============================================================================

        /**
         * Add a track to existing connections
         * @param {MediaStreamTrack} track - Track to add
         * @param {MediaStream} stream - Stream containing the track
         * @returns {Promise<void>}
         */
        async addTrack(track, stream) {
            if (!track || !stream) {
                throw new Error('Track and stream are required');
            }

            if (!this.state.publishing) {
                throw new Error('Must be publishing to add tracks');
            }

            // Add to local stream
            if (!this.localStream) {
                this.localStream = stream;
            } else {
                this.localStream.addTrack(track);
            }

            // Add to all publisher connections (connections we're publishing to)
            for (const [uuid, connections] of this.connections) {
                const connection = connections.publisher;
                if (connection && connection.pc) {
                    // Check if we should add this track based on viewer preferences
                    if ((track.kind === 'audio' && !connection.allowAudio) ||
                        (track.kind === 'video' && !connection.allowVideo)) {
                        continue;
                    }

                    try {
                        // Add the track and create a new offer
                        connection.pc.addTrack(track, stream);
                        
                        // Renegotiate connection
                        const offer = await connection.pc.createOffer();
                        await connection.pc.setLocalDescription(offer);
                        
                        const offerMsg = {
                            UUID: connection.uuid,
                            session: connection.session
                        };
                        
                        // Encrypt if needed
                        if (this.password && this.password !== false && this.password !== null && this.password !== '') {
                            try {
                                const [encrypted, vector] = await this._encryptMessage(JSON.stringify(offer));
                                offerMsg.description = encrypted;
                                offerMsg.vector = vector;
                            } catch (error) {
                                this._log('Failed to encrypt offer:', error);
                                offerMsg.description = offer;
                            }
                        } else {
                            offerMsg.description = offer;
                        }
                        
                        this._sendMessageWS(offerMsg);
                        this._log(`Added ${track.kind} track to connection: ${uuid}`);
                        
                        // Emit event
                        this._emit('trackAdded', {
                            track: track,
                            uuid: connection.uuid,
                            streamID: connection.streamID
                        });
                    } catch (error) {
                        this._log('Error adding track:', error);
                    }
                }
            }
        }

        /**
         * Remove a track from existing connections
         * @param {MediaStreamTrack} track - Track to remove
         * @returns {Promise<void>}
         */
        async removeTrack(track) {
            if (!track) {
                throw new Error('Track is required');
            }

            // Remove from local stream
            if (this.localStream) {
                this.localStream.removeTrack(track);
            }

            // Stop the track
            track.stop();

            // Remove from all connections
            for (const [uuid, connections] of this.connections) {
                const connection = connections.publisher;
                if (connection && connection.pc) {
                    const senders = connection.pc.getSenders();
                    const sender = senders.find(s => s.track === track);
                    
                    if (sender) {
                        try {
                            connection.pc.removeTrack(sender);
                            
                            // Renegotiate connection
                            const offer = await connection.pc.createOffer();
                            await connection.pc.setLocalDescription(offer);
                            
                            const offerMsg = {
                                UUID: connection.uuid,
                                session: connection.session
                            };
                            
                            // Encrypt if needed
                            if (this.password && this.password !== false && this.password !== null && this.password !== '') {
                                try {
                                    const [encrypted, vector] = await this._encryptMessage(JSON.stringify(offer));
                                    offerMsg.description = encrypted;
                                    offerMsg.vector = vector;
                                } catch (error) {
                                    this._log('Failed to encrypt offer:', error);
                                    offerMsg.description = offer;
                                }
                            } else {
                                offerMsg.description = offer;
                            }
                            
                            this._sendMessageWS(offerMsg);
                            this._log(`Removed ${track.kind} track from connection: ${uuid}`);
                            
                            // Emit event
                            this._emit('trackRemoved', {
                                track: track,
                                uuid: connection.uuid,
                                streamID: connection.streamID
                            });
                        } catch (error) {
                            this._log('Error removing track:', error);
                        }
                    }
                }
            }
        }

        /**
         * Replace a track in existing connections
         * @param {MediaStreamTrack} oldTrack - Track to replace
         * @param {MediaStreamTrack} newTrack - New track
         * @returns {Promise<void>}
         */
        async replaceTrack(oldTrack, newTrack) {
            if (!oldTrack || !newTrack) {
                throw new Error('Both old and new tracks are required');
            }

            if (oldTrack.kind !== newTrack.kind) {
                throw new Error('Tracks must be of the same kind (audio/video)');
            }

            // Update local stream
            if (this.localStream) {
                this.localStream.removeTrack(oldTrack);
                this.localStream.addTrack(newTrack);
            }

            // Replace in all connections
            for (const [uuid, connections] of this.connections) {
                const connection = connections.publisher;
                if (connection && connection.pc) {
                    const senders = connection.pc.getSenders();
                    const sender = senders.find(s => s.track === oldTrack);
                    
                    if (sender) {
                        try {
                            // Use replaceTrack for seamless switching (no renegotiation needed)
                            await sender.replaceTrack(newTrack);
                            this._log(`Replaced ${newTrack.kind} track in connection: ${uuid}`);
                            
                            // Emit event
                            this._emit('trackReplaced', {
                                oldTrack: oldTrack,
                                newTrack: newTrack,
                                uuid: connection.uuid,
                                streamID: connection.streamID
                            });
                        } catch (error) {
                            this._log('Error replacing track:', error);
                        }
                    }
                }
            }

            // Stop the old track
            oldTrack.stop();
        }

        /**
         * Get connection statistics
         * @param {string} uuid - Connection UUID (optional)
         * @returns {Promise<Object>} Statistics
         */
        async getStats(uuid = null) {
            const stats = {};

            const connections = uuid ? 
                [this.connections.get(uuid)].filter(Boolean) : 
                Array.from(this.connections.values());

            for (const connection of connections) {
                if (connection && connection.pc) {
                    try {
                        const pcStats = await connection.pc.getStats();
                        stats[connection.uuid] = Array.from(pcStats.values());
                    } catch (error) {
                        this._log('Error getting stats:', error);
                    }
                }
            }

            return stats;
        }

        /**
         * Internal method to send raw data via data channel with WebSocket fallback
         * @private
         * @param {*} data - Data to send
         * @param {string} uuid - Target UUID (optional)
         * @param {string} type - Connection type (optional)
         * @param {boolean} allowFallback - Whether to use WebSocket fallback (default: false)
         */
        _sendDataInternal(data, uuid = null, type = null, allowFallback = false) {
            let sent = false;
            const message = typeof data === 'string' ? data : JSON.stringify(data);

            if (uuid && !type) {
                // When UUID is specified but no type, try to send through ANY available connection
                // with preference order: viewer first (more likely to have data channel), then publisher
                const connections = this.connections.get(uuid);
                if (connections) {
                    // Try viewer connection first
                    if (connections.viewer && connections.viewer.dataChannel && 
                        connections.viewer.dataChannel.readyState === 'open') {
                        try {
                            this._logMessage('OUT', data, 'DataChannel');
                            connections.viewer.dataChannel.send(message);
                            sent = true;
                            this._log(`Sent to ${uuid} via viewer connection`);
                        } catch (error) {
                            this._log('Error sending via viewer connection:', error);
                        }
                    }
                    
                    // If viewer failed or doesn't exist, try publisher
                    if (!sent && connections.publisher && connections.publisher.dataChannel && 
                        connections.publisher.dataChannel.readyState === 'open') {
                        try {
                            this._logMessage('OUT', data, 'DataChannel');
                            connections.publisher.dataChannel.send(message);
                            sent = true;
                            this._log(`Sent to ${uuid} via publisher connection`);
                        } catch (error) {
                            this._log('Error sending via publisher connection:', error);
                        }
                    }
                }
            } else {
                // Original behavior: get specific connections based on filters
                const connections = this._getConnections({ uuid, type });
                
                for (const connection of connections) {
                    if (connection && connection.dataChannel && 
                        connection.dataChannel.readyState === 'open') {
                        try {
                            this._logMessage('OUT', data, 'DataChannel');
                            connection.dataChannel.send(message);
                            sent = true;
                        } catch (error) {
                            this._log('Error sending data:', error);
                        }
                    }
                }
            }

            // Fallback to WebSocket if data channel is not available
            if (!sent && allowFallback && this.state.connected && this.signaling && this.signaling.readyState === WebSocket.OPEN) {
                try {
                    // Prepare WebSocket fallback message
                    const fallbackMsg = {
                        ...data,
                        __fallback: true  // Mark as fallback message
                    };
                    
                    if (uuid) {
                        // Send to specific peer via WebSocket
                        fallbackMsg.UUID = uuid;
                    }
                    
                    this._sendMessageWS(fallbackMsg);
                    sent = true;
                    this._log(`Sent via WebSocket fallback${uuid ? ` to ${uuid}` : ' (broadcast)'}`);
                } catch (error) {
                    this._log('Error sending via WebSocket fallback:', error);
                }
            }

            if (!sent && uuid) {
                this._log(`Failed to send data to UUID: ${uuid}, type: ${type || 'any'} - no data channel or WebSocket available`);
            } else if (!sent) {
                this._log('Failed to send data - no data channels or WebSocket available');
            }

            return sent;
        }
        
        /**
         * Send generic data using VDO.Ninja's pipe protocol
         * @param {*} data - Data to send
         * @param {string|Object} target - Target UUID or options object
         * @returns {boolean} True if data was sent to at least one peer
         * 
         * Options object can contain:
         * - uuid: Target specific UUID
         * - type: Connection type ('viewer' or 'publisher')
         * - streamID: Target specific stream ID
         * - allowFallback: Whether to use WebSocket fallback if data channel unavailable (default: true)
         * 
         * Behavior:
         * - When UUID is specified without type, tries viewer connection first, then publisher
         * - When type is specified, only tries that specific connection type
         * - If data channel is not available and allowFallback is true, uses WebSocket signaling
         * - This ensures messages reach the peer even in mesh scenarios or when data channels fail
         * 
         * Examples:
         * - sendData(data) // Send to all with fallback
         * - sendData(data, "uuid123") // Try viewer first, fallback to publisher, then WebSocket
         * - sendData(data, { uuid: "uuid123", type: "viewer" }) // Send to viewer connection only
         * - sendData(data, { type: "publisher" }) // Send to all publisher connections
         * - sendData(data, { streamID: "stream1" }) // Send to all connections for stream
         * - sendData(data, { uuid: "uuid123", allowFallback: false }) // No WebSocket fallback
         */
        sendData(data, target = null) {
            const msg = { pipe: data };
            let allowFallback = false;  // Default to false for true P2P
            
            // Handle different parameter formats
            if (typeof target === 'string') {
                // Simple UUID string
                return this._sendDataInternal(msg, target, null, allowFallback);
            } else if (typeof target === 'object' && target !== null) {
                // Extract fallback option if present
                if (target.hasOwnProperty('allowFallback')) {
                    allowFallback = target.allowFallback;
                }
                
                // Options object
                if (target.uuid || target.type || target.streamID) {
                    const connections = this._getConnections(target);
                    let sent = false;
                    
                    for (const connection of connections) {
                        if (connection && connection.dataChannel && 
                            connection.dataChannel.readyState === 'open') {
                            try {
                                this._logMessage('OUT', msg, 'DataChannel');
                                connection.dataChannel.send(JSON.stringify(msg));
                                sent = true;
                            } catch (error) {
                                this._log('Error sending data:', error);
                            }
                        }
                    }
                    
                    // If no data channel available and fallback is allowed, use WebSocket
                    if (!sent && allowFallback && this.state.connected && this.signaling && this.signaling.readyState === WebSocket.OPEN) {
                        try {
                            const fallbackMsg = {
                                ...msg,
                                __fallback: true
                            };
                            
                            if (target.uuid) {
                                fallbackMsg.UUID = target.uuid;
                            }
                            
                            this._sendMessageWS(fallbackMsg);
                            sent = true;
                            this._log(`Sent via WebSocket fallback${target.uuid ? ` to ${target.uuid}` : ''}`);
                        } catch (error) {
                            this._log('Error sending via WebSocket fallback:', error);
                        }
                    }
                    
                    return sent;
                }
            }
            
            // Default: send to all
            return this._sendDataInternal(msg, null, null, allowFallback);
        }
        
        /**
         * Send a ping to measure latency (PUBLISHER ONLY)
         * Publishers can ping viewers to measure latency
         * @param {string} uuid - Target UUID (optional, null = all viewers)
         * @returns {boolean} True if ping was sent
         * 
         * Note: Ping/pong messages are NEVER sent via WebSocket fallback
         * as they are specifically for testing WebRTC data channel connectivity
         */
        sendPing(uuid = null) {
            // Only publishers should send pings
            if (!this.state.publishing) {
                this._log('Warning: Only publishers should send pings');
                return false;
            }
            
            const timestamp = Date.now();
            
            // If targeting specific viewer, update their pending ping
            if (uuid) {
                const connections = this.connections.get(uuid);
                if (connections && connections.publisher) {
                    connections.publisher.pendingPing = timestamp;
                }
            } else {
                // Update all publisher connections
                for (const [connUuid, connections] of this.connections) {
                    if (connections.publisher) {
                        connections.publisher.pendingPing = timestamp;
                    }
                }
            }
            
            // IMPORTANT: Never use fallback for ping/pong
            // The whole point is to test the WebRTC connection
            return this._sendDataInternal({ ping: timestamp }, uuid, null, false);
        }

        // ============================================================================
        // PUB/SUB SYSTEM
        // ============================================================================

        /**
         * Subscribe to a channel for receiving messages
         * @param {string|Array<string>} channels - Channel name(s) to subscribe to
         * @returns {void}
         */
        subscribe(channels) {
            if (!this._subscriptions) {
                this._subscriptions = new Set();
            }

            // Convert to array if single channel
            const channelList = Array.isArray(channels) ? channels : [channels];
            
            for (const channel of channelList) {
                this._subscriptions.add(channel);
            }

            // Only notify connected peers if we're connected
            // Don't require peer connections as subscriptions can be sent before peers connect
            if (this.state.connected) {
                this.sendData({
                    type: 'subscribe',
                    channels: channelList
                }, { allowFallback: true });
            }

            this._emit('subscribed', { channels: channelList });
        }

        /**
         * Unsubscribe from a channel
         * @param {string|Array<string>} channels - Channel name(s) to unsubscribe from
         * @returns {void}
         */
        unsubscribe(channels) {
            if (!this._subscriptions) {
                return;
            }

            // Convert to array if single channel
            const channelList = Array.isArray(channels) ? channels : [channels];
            
            for (const channel of channelList) {
                this._subscriptions.delete(channel);
            }

            // Only notify connected peers if we're connected
            if (this.state.connected) {
                this.sendData({
                    type: 'unsubscribe',
                    channels: channelList
                }, { allowFallback: true });
            }

            this._emit('unsubscribed', { channels: channelList });
        }

        /**
         * Get current subscriptions
         * @returns {Array<string>} List of subscribed channels
         */
        getSubscriptions() {
            return this._subscriptions ? Array.from(this._subscriptions) : [];
        }

        /**
         * Publish a message to a channel
         * @param {string} channel - Channel to publish to
         * @param {*} data - Data to publish
         * @param {string} target - Optional target UUID or 'all' (default: 'all')
         * @returns {boolean} True if message was sent
         */
        publishToChannel(channel, data, target = 'all') {
            const message = {
                type: 'channelMessage',
                channel: channel,
                data: data,
                timestamp: Date.now()
            };

            if (target === 'all') {
                return this.sendData(message);
            } else {
                return this.sendData(message, target);
            }
        }

        /**
         * Request data from a peer and wait for response
         * @param {string} requestType - Type of request
         * @param {*} data - Request data
         * @param {string} targetUUID - Target peer UUID
         * @param {number} timeout - Timeout in milliseconds (default: 5000)
         * @returns {Promise<*>} Response data
         */
        async request(requestType, data, targetUUID, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const requestId = this._generateUUID();
                const timeoutId = setTimeout(() => {
                    // Clean up listener
                    delete this._pendingRequests[requestId];
                    reject(new Error(`Request timeout: ${requestType}`));
                }, timeout);

                // Store pending request
                if (!this._pendingRequests) {
                    this._pendingRequests = {};
                }
                
                this._pendingRequests[requestId] = {
                    resolve: resolve,
                    reject: reject,
                    timeoutId: timeoutId
                };

                // Send request
                const success = this.sendData({
                    type: 'request',
                    requestType: requestType,
                    requestId: requestId,
                    data: data
                }, targetUUID);

                if (!success) {
                    clearTimeout(timeoutId);
                    delete this._pendingRequests[requestId];
                    reject(new Error('Failed to send request'));
                }
            });
        }

        /**
         * Send a response to a request
         * @param {string} requestId - Request ID to respond to
         * @param {*} data - Response data
         * @param {string} targetUUID - Target peer UUID
         * @returns {boolean} True if response was sent
         */
        respond(requestId, data, targetUUID) {
            return this.sendData({
                type: 'response',
                requestId: requestId,
                data: data
            }, targetUUID);
        }

        /**
         * Set up a request handler
         * @param {string} requestType - Type of request to handle
         * @param {Function} handler - Handler function (async allowed)
         * @returns {void}
         */
        onRequest(requestType, handler) {
            if (!this._requestHandlers) {
                this._requestHandlers = {};
            }
            this._requestHandlers[requestType] = handler;
        }

        /**
         * Internal method to handle pub/sub and request/response messages
         * @private
         * @param {Object} data - Received data
         * @param {string} uuid - Sender UUID
         */
        _handleDataChannelMessage(data, uuid) {
            // Handle subscription updates
            if (data.type === 'subscribe' || data.type === 'unsubscribe') {
                // Track peer subscriptions if needed
                if (!this._peerSubscriptions) {
                    this._peerSubscriptions = new Map();
                }
                
                if (data.type === 'subscribe') {
                    const peerSubs = this._peerSubscriptions.get(uuid) || new Set();
                    data.channels.forEach(ch => peerSubs.add(ch));
                    this._peerSubscriptions.set(uuid, peerSubs);
                } else {
                    const peerSubs = this._peerSubscriptions.get(uuid);
                    if (peerSubs) {
                        data.channels.forEach(ch => peerSubs.delete(ch));
                    }
                }
                return;
            }

            // Handle channel messages
            if (data.type === 'channelMessage') {
                // Only process if we're subscribed to the channel
                if (this._subscriptions && this._subscriptions.has(data.channel)) {
                    this._emit('channelMessage', {
                        channel: data.channel,
                        data: data.data,
                        timestamp: data.timestamp,
                        uuid: uuid
                    });
                }
                return;
            }

            // Handle requests
            if (data.type === 'request') {
                if (this._requestHandlers && this._requestHandlers[data.requestType]) {
                    const handler = this._requestHandlers[data.requestType];
                    
                    // Execute handler (may be async)
                    Promise.resolve(handler(data.data, uuid))
                        .then(responseData => {
                            // Send response
                            this.respond(data.requestId, responseData, uuid);
                        })
                        .catch(error => {
                            // Send error response
                            this.respond(data.requestId, {
                                error: error.message || 'Request handler error'
                            }, uuid);
                        });
                }
                return;
            }

            // Handle responses
            if (data.type === 'response') {
                if (this._pendingRequests && this._pendingRequests[data.requestId]) {
                    const pending = this._pendingRequests[data.requestId];
                    clearTimeout(pending.timeoutId);
                    
                    if (data.data && data.data.error) {
                        pending.reject(new Error(data.data.error));
                    } else {
                        pending.resolve(data.data);
                    }
                    
                    delete this._pendingRequests[data.requestId];
                }
                return;
            }

            // Pass through other messages
            this._emit('dataReceived', { data, uuid });
        }

        /**
         * Start automated ping monitoring for a connection
         * @private
         * @param {Object} connection - Connection to monitor
         */
        _startPingMonitoring(connection) {
            // Only monitor publisher connections (viewers we're publishing to)
            if (connection.type !== 'publisher' || !this.state.publishing) {
                return;
            }
            
            // Clear any existing timer
            if (connection.pingTimer) {
                clearInterval(connection.pingTimer);
            }
            
            connection.pingTimer = setInterval(() => {
                const now = Date.now();
                const timeSinceLastMessage = now - connection.lastMessageTime;
                
                // If we haven't received any message in 10 seconds
                if (timeSinceLastMessage >= 10000) {
                    // Check if we have a pending ping that wasn't answered
                    if (connection.pendingPing) {
                        connection.missedPings++;
                        this._log(`Missed ping #${connection.missedPings} for viewer ${connection.uuid}`);
                        
                        if (connection.missedPings >= 2) {
                            // After 2 missed pings (30 seconds), initiate ICE restart
                            this._log(`Initiating ICE restart for viewer ${connection.uuid} after ${connection.missedPings} missed pings`);
                            this._initiateICERestart(connection);
                            
                            // Reset counters
                            connection.missedPings = 0;
                            connection.pendingPing = null;
                            return;
                        }
                    }
                    
                    // Send a ping
                    this._log(`Sending automated ping to viewer ${connection.uuid} (${timeSinceLastMessage}ms since last message)`);
                    this.sendPing(connection.uuid);
                }
            }, 10000); // Check every 10 seconds
        }

        /**
         * Stop ping monitoring for a connection
         * @private
         * @param {Object} connection - Connection to stop monitoring
         */
        _stopPingMonitoring(connection) {
            if (connection.pingTimer) {
                clearInterval(connection.pingTimer);
                connection.pingTimer = null;
            }
        }

        /**
         * Initiate ICE restart for a connection
         * @private
         * @param {Object} connection - Connection to restart
         */
        async _initiateICERestart(connection) {
            if (!connection.pc) {
                this._log('Cannot restart ICE - no peer connection');
                return;
            }
            
            try {
                // Request ICE restart via data channel if available
                if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
                    connection.dataChannel.send(JSON.stringify({ iceRestartRequest: true }));
                    this._log('Sent ICE restart request via data channel');
                }
                
                // Also initiate from our side
                const offer = await connection.pc.createOffer({ iceRestart: true });
                await connection.pc.setLocalDescription(offer);
                
                const offerMsg = {
                    UUID: connection.uuid,
                    session: connection.session,
                    streamID: connection.streamID
                };
                
                // Send the new offer
                if (this.password && this.password !== false && this.password !== null && this.password !== '') {
                    try {
                        const [encrypted, vector] = await this._encryptMessage(JSON.stringify(offer));
                        offerMsg.description = encrypted;
                        offerMsg.vector = vector;
                    } catch (error) {
                        this._log('Failed to encrypt ICE restart offer:', error);
                        offerMsg.description = offer;
                    }
                } else {
                    offerMsg.description = offer;
                }
                
                this._sendMessageWS(offerMsg);
                this._log('Sent ICE restart offer');
                
                // Emit event
                this._emit('iceRestart', {
                    uuid: connection.uuid,
                    streamID: connection.streamID,
                    reason: 'missed_pings'
                });
                
            } catch (error) {
                this._log('Error initiating ICE restart:', error);
            }
        }

        // ============================================================================
        // QUICK METHODS
        // ============================================================================

        /**
         * Quick publish method - connects, joins room, and publishes in one call
         * @param {Object} options - Publishing options
         * @returns {Promise<string>} Stream ID
         */
        async quickPublish(options = {}) {
            // Connect if not connected
            if (!this.state.connected) {
                await this.connect();
            }

            // Join room if specified
            if (options.room && !this.state.roomJoined) {
                await this.joinRoom({ 
                    room: options.room, 
                    password: options.password 
                });
            }

            // Publish stream
            return await this.publish(options.stream, options);
        }

        /**
         * Quick view method - connects, joins room, and views in one call
         * @param {Object} options - Viewing options
         * @returns {Promise<RTCPeerConnection>} Peer connection
         */
        async quickView(options = {}) {
            if (!options.streamID) {
                throw new Error('streamID is required');
            }

            // Connect if not connected
            if (!this.state.connected) {
                await this.connect();
            }

            // Join room if specified
            if (options.room && !this.state.roomJoined) {
                await this.joinRoom({ 
                    room: options.room, 
                    password: options.password 
                });
            }

            // View stream
            return await this.view(options.streamID, {
                audio: options.audio,
                video: options.video,
                label: options.label
            });
        }
    }

    // ============================================================================
    // EXPORT
    // ============================================================================

    // Export for different environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = VDONinjaSDK;
    } else if (typeof define === 'function' && define.amd) {
        define([], function() {
            return VDONinjaSDK;
        });
    } else {
        global.VDONinjaSDK = VDONinjaSDK;
    }

})(typeof window !== 'undefined' ? window : global);

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
                room: ROOM_ID,
                // password not specified - will use default password
                debug: false // Enable debug logging
            });
            
            // Override the salt to ensure compatibility with VDO.Ninja
            // This ensures room hashing matches VDO.Ninja's expectations
            vdo.salt = "vdo.ninja";
            console.log('Overriding salt to:', vdo.salt);
            
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
            
            
            // Room is already set in constructor, so joinRoom is optional
            // But we'll call it anyway for clarity
            console.log('Joining room:', ROOM_ID);
            await vdo.joinRoom(ROOM_ID);
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