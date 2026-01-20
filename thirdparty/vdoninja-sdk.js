// VDO.Ninja SDK v1.3.18 — AGPL-3.0-only + SDK Exception; see LICENSE-SDK-EXCEPTION

const MEDIA_STREAM_TRACK_ENABLED_DESCRIPTOR =
    (typeof MediaStreamTrack !== 'undefined' && MediaStreamTrack?.prototype)
        ? Object.getOwnPropertyDescriptor(MediaStreamTrack.prototype, 'enabled')
        : null;

const OUTBOUND_VIDEO_STOP_MUTE_DELAY_MS = 500;
/**
 * VDO.Ninja SDK - OFFICIAL SDK FOR VDO.NINJA WEBSOCKET API
 * Copyright (C) 2025 Steve Seguin and contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, version 3 of the License only (AGPL-3.0-only).
 *
 * Additional Permission:
 * Unmodified official builds of `vdoninja-sdk.js` and `vdoninja-sdk.min.js` may
 * be used and distributed as part of proprietary works under the terms in
 * `LICENSE-SDK-EXCEPTION`.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 * 
 * IMPORTANT USAGE NOTICE:
 * =======================
 * 
 * 1. Direct WebSocket API access is NOT APPROVED and may result in blocking
 * 2. Always use this SDK - it ensures proper usage patterns and handles API updates
 * 3. The WebSocket API may change without notice, breaking direct integrations
 * 4. Rate limiting is enforced - excessive requests will be throttled or blocked
 * 5. The service follows a serverless philosophy - no state management or data relay
 * 6. Sending non-handshake data through the WebSocket server is prohibited
 * 7. Rooms are limited to ~80 connections, viewer connections may also be limited
 * 8. Higher rate limits available on request for legitimate use cases
 * 
 * By using this SDK, you agree to respect these guidelines to keep the service
 * free and available for everyone. Abuse hurts the entire ecosystem.
 * 
 * WebSocket Client-Server Communication Protocol for VDO.Ninja
 *
 * This document outlines the structure of messages sent between the client (e.g., web browser)
 * and the VDO.Ninja signaling server. All messages are JSON objects.
 *
 * UUIDs are used for direct client-to-client messaging within the signaling server.
 * When a client sends a message that is routed to another client, the 'UUID' field
 * in the outgoing message indicates the original sender's UUID.
 */

// Global state tracking (server-side context for understanding message logic):
// clients: { [clientUUID]: WebSocketConnection }
// streams: { [streamID]: clientUUID } // Tracks the original publisher of a stream
// streamIDs: { [clientUUID]: streamID } // Inverse of 'streams' for quick lookup by client
// myRooms: { [clientUUID]: roomID } // Which room a client is currently in
// roomList: { [roomID]: [clientUUID, ...] } // List of clients in a room
// roomStreams: { [roomID]: { [streamID]: clientUUID } } // NEW: Stream IDs active within a specific room

/**
 * INCOMING CLIENT REQUESTS (Messages from Client to Server)
 * =========================================================
 */

/**
 * 1. Direct Message Routing (Default/Catch-all)
 * Used for WebRTC signaling data (ICE candidates, SDP answers/offers that are not initial 'play' or 'seed').
 * The server acts as a pass-through for these messages.
 */
/*
{
  // No explicit 'request' field for direct routing.
  // The server checks for 'request' field first. If not present, it assumes direct routing.
  "UUID": "targetClientUUID", // REQUIRED: The UUID of the client this message is intended for.
  // ... other WebRTC signaling data (e.g., "sdp", "candidate", "type") ...
  // Example:
  // "sdp": "v=0\r\no=- 12345...",
  // "type": "answer"
}
*/

/**
 * 2. 'play' Request
 * A client requests to view a stream. The server will attempt to find a seeder for the stream
 * and instruct the seeder to send an offer SDP to the requesting client.
 */
/*
{
  "request": "play",            // REQUIRED: Indicates a request to play a stream.
  "streamID": "desiredStreamID" // REQUIRED: The identifier of the stream the client wants to view.
}
*/

/**
 * 3. 'seed' Request
 * A client announces that it is publishing a stream with a given stream ID.
 * This registers the client as the source for that stream.
 * The server will validate for conflicts within rooms and globally.
 */
/*
{
  "request": "seed",             // REQUIRED: Indicates the client is seeding a stream.
  "streamID": "yourStreamID"     // REQUIRED: The unique identifier for the stream this client is publishing.
}
*/

/**
 * 4. 'joinroom' Request
 * A client requests to join a specific room. This updates the client's room membership
 * and triggers a listing of existing members and their streams in that room.
 * It also handles claiming director status for the room.
 */
/*
{
  "request": "joinroom",         // REQUIRED: Indicates a request to join a room.
  "roomid": "roomIdentifier",    // REQUIRED: The identifier of the room to join.
  "claim"?: true                 // OPTIONAL: If present and true, attempts to claim director status for the room.
                                 //           If the room is already claimed, the server will alert the client.
}
*/

/**
 * 5. 'migrate' Request (Director-only)
 * A room director can use this request to transfer another user from their current room
 * to a different target room.
 */
/*
{
  "request": "migrate",          // REQUIRED: Indicates a request to migrate a user.
  "roomid": "targetRoomID",      // REQUIRED: The ID of the room to transfer the target user to.
  "target": "targetClientUUID"   // REQUIRED: The UUID of the client to be migrated.
}
*/


/**
 * OUTGOING SERVER RESPONSES (Messages from Server to Client)
 * ==========================================================
 */

/**
 * 1. 'offerSDP' Request (Server initiated to a seeder)
 * Sent by the server to a stream seeder, instructing them to send an SDP offer
 * to the specified 'UUID' (the client requesting to view the stream).
 */
/*
{
  "request": "offerSDP", // Indicates a request for an SDP offer.
  "UUID": "viewerClientUUID" // REQUIRED: The UUID of the client who wants to receive the SDP offer.
                             // This is the 'from' UUID for the seeder to send their offer to.
}
*/

/**
 * 2. 'alert' Response
 * General purpose alert messages from the server to the client.
 */
/*
{
  "request": "alert", // Indicates an alert message.
  "message": "A descriptive message about the alert, e.g., 'Stream ID is already in use.'" // REQUIRED: The alert message.
}
*/

/**
 * 3. 'videoaddedtoroom' Response
 * Sent to clients in a room when another client in that room starts seeding a new stream.
 */
/*
{
  "request": "videoaddedtoroom", // Indicates a new video stream has been added to the room.
  "UUID": "publisherClientUUID", // REQUIRED: The UUID of the client who started publishing.
  "streamID": "newStreamID"      // REQUIRED: The stream ID that was added.
}
*/

/**
 * 4. 'error' Response
 * Sent when a specific error condition occurs, often with a unique error code.
 */
/*
{
  "request": "error", // Indicates an error message.
  "message": "A descriptive message about the error.", // REQUIRED: The error message.
  "code": "ERROR_CODE" // OPTIONAL: A specific error code for programmatic handling (e.g., "STREAMID_IN_USE", "TRANSFER_STREAMID_CONFLICT").
}
*/

/**
 * 5. 'listing' Response
 * Sent to a client upon successfully joining a room, providing a list of other
 * members in that room and their associated stream IDs.
 */
/*
{
  "request": "listing", // Indicates a listing of room members.
  "list": [             // REQUIRED: An array of objects, each representing a room member.
    {
      "UUID": "memberClientUUID", // The UUID of a member in the room.
      "streamID"?: "memberStreamID" // OPTIONAL: The stream ID published by this member, if any.
    },
    // ... more member objects ...
  ],
  "director"?: "directorClientUUID", // OPTIONAL: The UUID of the current director of the room, if one exists.
  "claim"?: true | false             // OPTIONAL: Only present if the 'joinroom' request included 'claim: true'.
                                     //           True if the client successfully claimed director status, false otherwise.
}
*/

/**
 * 6. 'someonejoined' Response
 * Sent to existing members of a room when a new client joins that room.
 */
/*
{
  "request": "someonejoined", // Indicates a new client has joined the room.
  "UUID": "newClientUUID",    // REQUIRED: The UUID of the client who just joined.
  "director"?: true,          // OPTIONAL: True if the joining client is also the new director of the room.
  "streamID"?: "newClientStreamID" // OPTIONAL: The stream ID published by the joining client, if any.
}
*/

/**
 * 7. 'transferred' Response (To the transferred user)
 * Sent to a client who has been successfully migrated to a new room by a director.
 * Similar to a 'listing' response for the new room.
 */
/*
{
  "request": "transferred", // Indicates the client has been transferred to a new room.
  "list": [                 // REQUIRED: An array of objects, each representing a member in the new room.
    {
      "UUID": "memberClientUUID",
      "streamID"?: "memberStreamID"
    },
    // ... more member objects ...
  ],
  "director"?: "newRoomDirectorUUID" // OPTIONAL: The UUID of the director of the new room, if one exists.
}
*/

/**
 * 8. 'roomclaimed' Response (OBSOLETE in V17.3, replaced by 'joinroom' with 'claim')
 * Sent to clients in a room when a director successfully claims director status for that room.
 */
/*
{
  "request": "roomclaimed", // Indicates a room has been claimed by a director.
  "director": "directorClientUUID" // REQUIRED: The UUID of the client who claimed director status.
}
*/

/**
 * 9. 'sendroom' Response (OBSOLETE in v17.2)
 * Provides room information to the requesting client.
 */
/*
{
  "request": "sendroom", // Indicates room information.
  "director": true | false // True if the requesting client is the director, false otherwise.
  // ... other room-specific data, likely related to member list, etc.
}
*/


/**
 * VDO.Ninja SDK - STILL IN DEVELOPMENT AND MAY CONTAIN BUGS
 * 
 * This version incorporates all fixes from vdoninja-sdk-fix-final.js directly into the SDK.
 * 
 * ICE Candidate Type Field Routing:
 * When you have both viewing and publishing connections to the same peer UUID, VDO.Ninja uses
 * the 'type' field in ICE candidate messages to route them to the correct connection:
 * 
 * - type: "remote" = FROM viewer TO publisher (routes to publisher's pcs connection)
 * - type: "local" = FROM publisher TO viewer (routes to viewer's rpcs connection)
 * 
 * Example: If you're viewing a stream, you send ICE candidates with type:"remote" to the publisher.
 * The publisher receives these and routes them to their pcs[UUID] connection.
 * 
 * Key features:
 * 1. NO streamID in joinroom message
 * 2. NO password field in joinroom (password is used to hash roomid)
 * 3. Seed sent AFTER room join completes (after listing received)
 * 4. StreamID hashed correctly with 6-char suffix
 * 5. Proper message ordering: connect → joinroom → listing → seed
 * 6. Data channel track negotiation - viewers specify audio/video preferences
 * 7. Publishers respect viewer preferences when attaching tracks
 * 8. Session management - each WebRTC connection has a unique session ID
 * 9. All initialization fixes for missing properties
 * 10. Proper event emission for listing and videoaddedtoroom
 * 11. Fixed _createConnection to handle both signatures
 * 12. Full encryption/decryption support for SDP and ICE candidates
 * 13. Mesh networking support - multiple connections per peer UUID
 * 14. rpcs/pcs targeting for data channel messages
 * 
 * Session Management:
 * - Publishers generate a new 8-character session ID for each WebRTC connection
 * - Session IDs are included in offers, answers, and ICE candidates
 * - Viewers echo back the publisher's session ID in their responses
 * - When a new offer arrives with a different session, old connections are closed
 * - Messages with mismatched sessions are ignored to prevent stale signaling
 * 
 * Encryption:
 * - Default password is "someEncryptionKey123" for undefined, null, or empty string
 * - Password must be explicitly set to false to disable encryption
 * - Custom passwords are used when any non-empty string is provided
 * - Salt is determined by hostname (vdo.ninja for official domains)
 * - SDP descriptions and ICE candidates are encrypted with AES-CBC
 * - Messages with 'vector' field are automatically decrypted
 * - ICE candidates are bundled for efficiency with exponential backoff
 * 
 * Mesh Networking & Data Channel Targeting:
 * - Supports multiple connections per peer UUID (publisher + viewer)
 * - Uses nested Map structure: UUID → { viewer: connection, publisher: connection }
 * - sendData support type-based targeting:
 *   - { type: "viewer" } → Send to viewer connections only
 *   - { type: "publisher" } → Send to publisher connections only
 *   - Examples:
 *     sdk.sendData(data, { uuid: "abc123", type: "viewer" })  // To specific viewer connection
 *     sdk.sendData(data, { type: "publisher" })  // To all publisher connections
 *     sdk.sendData(data, { streamID: "user1", type: "viewer" })  // To viewers of stream
 * 
 * @author Steve Seguin
 * @license AGPL-3.0-only (with additional permission; see LICENSE-SDK-EXCEPTION)
 */

(function (global) {
    'use strict';

    class VDONinjaSDK extends EventTarget {
        /**
         * SDK Version
         * @static
         * @returns {string} Current SDK version
         */
        static get VERSION() {
            return '1.3.18';
        }
        
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
         * Determine the effective password to use for hashing/encryption
         * - false or null: explicitly disabled -> return null
         * - undefined or empty string: use default "someEncryptionKey123"
         * - otherwise: use current password string
         * @private
         * @returns {string|null} Effective password or null if disabled
         */
        _getEffectivePassword() {
            if (this.password === false || this.password === null) {
                return null; // explicitly disabled
            }
            if (this.password === undefined || this.password === "") {
                return "someEncryptionKey123";
            }
            // Ensure string and trimmed
            let pwd = this.password;
            if (typeof pwd !== 'string') {
                pwd = String(pwd);
            }
            pwd = pwd.trim();
            if (pwd.length < 1) {
                return "someEncryptionKey123";
            }
            return pwd;
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
         * @param {boolean} options.autoPingViewer - Enable viewer-side auto ping (default: false)
         * @param {number} options.autoPingInterval - Auto ping interval in ms (default: 10000)
         */
        constructor(options = {}) {
            super();
            
            // SDK Version
            this.version = VDONinjaSDK.VERSION;
            
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
            
            // Store options that might be incorrectly set as properties by LLMs
            this._pendingStreamID = options.streamID || null;
            this._pendingLabel = options.label || null;
            // Optional publisher info fields to send on DC open
            this._pendingInfo = {};
            if (options.label) this._pendingInfo.label = this._sanitizeLabel(options.label);
            if (options.meta) this._pendingInfo.meta = this._sanitizeLabel(options.meta);
            if (options.order) this._pendingInfo.order = this._sanitizeLabel(options.order);
            if (typeof options.broadcast === 'boolean') this._pendingInfo.broadcast = !!options.broadcast;
            if (typeof options.allowdrawing === 'boolean') this._pendingInfo.allowdrawing = !!options.allowdrawing;
            if (typeof options.iframe === 'boolean') this._pendingInfo.iframe = !!options.iframe;
            if (typeof options.widget === 'boolean') this._pendingInfo.widget = !!options.widget;
            if (typeof options.allowmidi === 'boolean') this._pendingInfo.allowmidi = !!options.allowmidi;
            if (typeof options.allowresources === 'boolean') this._pendingInfo.allowresources = !!options.allowresources;
            if (typeof options.allowchunked === 'boolean' || typeof options.allowchunked === 'number') this._pendingInfo.allowchunked = options.allowchunked;
            // Also accept a nested info object for convenience
            if (options.info && typeof options.info === 'object') {
                const inf = options.info;
                if (inf.label) { this._pendingInfo.label = this._sanitizeLabel(inf.label); this._pendingLabel = this._pendingInfo.label; }
                if (inf.meta) this._pendingInfo.meta = this._sanitizeLabel(inf.meta);
                if (inf.order) this._pendingInfo.order = this._sanitizeLabel(inf.order);
                if (typeof inf.broadcast === 'boolean') this._pendingInfo.broadcast = !!inf.broadcast;
                if (typeof inf.allowdrawing === 'boolean') this._pendingInfo.allowdrawing = !!inf.allowdrawing;
                if (typeof inf.iframe === 'boolean') this._pendingInfo.iframe = !!inf.iframe;
                if (typeof inf.widget === 'boolean') this._pendingInfo.widget = !!inf.widget;
                if (typeof inf.allowmidi === 'boolean') this._pendingInfo.allowmidi = !!inf.allowmidi;
                if (typeof inf.allowresources === 'boolean') this._pendingInfo.allowresources = !!inf.allowresources;
                if (typeof inf.allowchunked === 'boolean' || typeof inf.allowchunked === 'number') this._pendingInfo.allowchunked = inf.allowchunked;
            }
            this._pendingRoomID = options.roomid || options.roomID || null;  // Support both cases
            
            // Preferred media configuration for outgoing WebRTC tracks
            this._publishMediaConfig = null;
            
            // Convenience event aliases for common patterns (Node-style)
            // sdk.on('event', handler), sdk.off('event', handler), sdk.once('event', handler)
            this.on = (evt, handler) => { try { this.addEventListener(evt, handler); } catch (e) {} return this; };
            this.off = (evt, handler) => { try { this.removeEventListener(evt, handler); } catch (e) {} return this; };
            this.once = (evt, handler) => {
                try {
                    const wrap = (e) => { this.removeEventListener(evt, wrap); handler(e); };
                    this.addEventListener(evt, wrap);
                } catch (e) {}
                return this;
            };
            
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
            this._passwordHashPromise = null; // Tracks in-flight hash computation
            this._passwordHashKey = null; // Password+salt signature for cached hash
            this._passwordHashPromiseKey = null; // Signature for in-flight hash
            this._viewHandlers = new Map();
            this._sessionIDs = {};
            this._remoteSessionIDs = {};
            this._streamToUUID = {};
            this.messageHandlers = new Map();
            
            // Stream tracking
            this.streams = new Map(); // streamID -> { firstSeen, lastSeen, uuid, state }
            
            // Media management
            this.localStream = null;
            this.videoElement = options.videoElement || null;
            
            // Configuration
            this.turnServers = options.turnServers !== undefined ? options.turnServers : null; // null = auto fetch, false = none, array = custom
            this.forceTURN = options.forceTURN || false; // Force relay mode for privacy
            this.turnCacheTTL = options.turnCacheTTL || 5; // TURN server cache time-to-live in minutes
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
            
            // View retry mechanism
            this._viewRetryTimers = new Map();
            this._viewRetryInterval = 15 * 60 * 1000; // 15 minutes
            
            // Track monitoring for outbound video tracks
            this._outboundVideoMonitors = new Map();
            this._pendingVideoMuteFinalizers = new Set();
            
            // Initialize salt before setting up crypto
            this.salt = options.salt || "vdo.ninja";
            this._saltProvidedViaOptions = !!options.salt;
            
            // Auto-ping settings (viewer-only)
            this.autoPingViewer = options.autoPingViewer || false;
            this.autoPingInterval = options.autoPingInterval || 10000;
            
            // Setup crypto utilities
            this._setupCryptoUtils();
            
            this._log('SDK initialized with host:', this.host);
            
            // Add property setters to help LLMs use the SDK correctly
            this._addPropertyHelpers();
        }
        
        /**
         * Add property setters that guide users to correct usage
         * These properties are commonly misused by LLMs trying to set them directly
         * @private
         */
        _addPropertyHelpers() {
            // Define property descriptors for commonly misused properties
            Object.defineProperty(this, 'streamID', {
                get: function() {
                    return this.state.streamID;
                },
                set: function(value) {
                    console.warn(`[VDONinja SDK] Setting streamID as a property is not recommended.\n` +
                        `Please use the streamID option in publish() or announce() methods:\n` +
                        `  await vdo.publish(stream, { streamID: '${value}' })\n` +
                        `  await vdo.announce({ streamID: '${value}' })\n` +
                        `The streamID has been stored and will be used if not specified in the method call.`);
                    this._pendingStreamID = value;
                },
                configurable: true
            });
            
            Object.defineProperty(this, 'roomid', {
                get: function() {
                    return this.room;
                },
                set: function(value) {
                    console.warn(`[VDONinja SDK] Setting roomid as a property is not recommended.\n` +
                        `Please use the room option in connect() or joinRoom() methods:\n` +
                        `  await vdo.connect({ room: '${value}' })\n` +
                        `  await vdo.joinRoom({ room: '${value}' })\n` +
                        `The room has been stored and will be used if not specified in the method call.`);
                    this._pendingRoomID = value;
                    this.room = this._sanitizeRoomName(value);
                },
                configurable: true
            });
            
            Object.defineProperty(this, 'label', {
                get: function() {
                    return this._pendingLabel;
                },
                set: function(value) {
                    console.warn(`[VDONinja SDK] Setting label as a property is not recommended.\n` +
                        `Please use the label option in publish() or announce() methods:\n` +
                        `  await vdo.publish(stream, { label: '${value}' })\n` +
                        `  await vdo.announce({ label: '${value}' })\n` +
                        `The label has been stored and will be used if not specified in the method call.`);
                    this._pendingLabel = value;
                },
                configurable: true
            });
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
            if (!this.streams) this.streams = new Map();
            if (!this._viewRetryTimers) this._viewRetryTimers = new Map();
            
            if (this.state.connected) {
                this._log('Already connected');
                return;
            }

            this._intentionalDisconnect = false;
            
            // Merge options
            if (options.host) this.host = options.host;
            if (options.room) this.room = this._sanitizeRoomName(options.room);
            else if (this._pendingRoomID) this.room = this._sanitizeRoomName(this._pendingRoomID);
            // Sanitize and apply password only if explicitly provided
            if (options.password !== undefined) {
                if (options.password === false) {
                    this.password = false;
                } else if (options.password === null || options.password === '') {
                    this.password = this._sanitizePassword("someEncryptionKey123");
                } else {
                    this.password = this._sanitizePassword(options.password);
                }
            }
            
            // Handle common-but-ignored options gracefully with guidance
            if (options.datamode !== undefined) {
                console.warn('[VDONinja SDK] connect({ datamode }) is not used. Establish data channels via announce() (publisher) and/or view() (viewer).');
                this._emit('alert', { message: 'connect({ datamode }) has no effect. Use announce()/view() to create data channels.' });
            }
            
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

                this._clearAllVideoTrackMonitors();

                // Clear all retry timers
                for (const [streamID, timer] of this._viewRetryTimers) {
                    clearTimeout(timer);
                }
                this._viewRetryTimers.clear();

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
        // STREAM TRACKING
        // ============================================================================
        
        /**
         * Get all tracked streams
         * @returns {Array} Array of stream objects with metadata
         */
        getStreams() {
            const streams = [];
            const now = Date.now();
            
            for (const [streamID, data] of this.streams) {
                streams.push({
                    streamID,
                    firstSeen: data.firstSeen,
                    lastSeen: data.lastSeen,
                    timeSinceLastSeen: now - data.lastSeen,
                    uuid: data.uuid,
                    state: data.state,
                    viewRequestTime: data.viewRequestTime,
                    waitingTime: data.state === 'pending' && data.viewRequestTime ? 
                        now - data.viewRequestTime : null
                });
            }
            
            return streams.sort((a, b) => b.lastSeen - a.lastSeen);
        }

        /**
         * Get info about a specific stream
         * @param {string} streamID - Stream ID to look up
         * @returns {Object|null} Stream info or null if not found
         */
        getStreamInfo(streamID) {
            const data = this.streams.get(streamID);
            if (!data) return null;
            
            const now = Date.now();
            return {
                streamID,
                firstSeen: data.firstSeen,
                lastSeen: data.lastSeen,
                timeSinceLastSeen: now - data.lastSeen,
                uuid: data.uuid,
                state: data.state,
                viewRequestTime: data.viewRequestTime,
                waitingTime: data.state === 'pending' && data.viewRequestTime ? 
                    now - data.viewRequestTime : null
            };
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
            const __effectivePasswordForRoom = this._getEffectivePassword();
            if (__effectivePasswordForRoom !== null) {
                hashedRoom = await this._hashRoom(room, __effectivePasswordForRoom);
            }

            this._log('Joining room:', room, 'with hash:', hashedRoom);

            // Handle common-but-ignored options gracefully with guidance
            if (options.role !== undefined) {
                console.warn('[VDONinja SDK] joinRoom({ role }) is not used. Your role is determined by calling announce() (publisher) and/or view() (viewer).');
                this._emit('alert', { message: 'joinRoom({ role }) is ignored. Use announce() to publish and view() to view.' });
            }

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
            
            // Resolve desired media preferences for outgoing tracks
            const mediaPreferences = await this._extractPublisherMediaOptions(options);
            if (mediaPreferences) {
                this._publishMediaConfig = mediaPreferences;
            }
            if (this._publishMediaConfig) {
                await this._applyLocalMediaPreferences(this.localStream, this._publishMediaConfig);
            }

            // Use provided streamID, fall back to pending value from constructor/property, then generate
            const streamID = this._sanitizeStreamID(options.streamID || this._pendingStreamID) || this._generateStreamID();

            // Persist label if provided for downstream DC open
            if (options.label) this._pendingLabel = this._sanitizeLabel(options.label);
            // Capture optional info fields for publisher
            this._pendingInfo = this._pendingInfo || {};
            if (options.label) this._pendingInfo.label = this._sanitizeLabel(options.label);
            if (options.meta) this._pendingInfo.meta = this._sanitizeLabel(options.meta);
            if (options.order) this._pendingInfo.order = this._sanitizeLabel(options.order);
            if (typeof options.broadcast === 'boolean') this._pendingInfo.broadcast = !!options.broadcast;
            if (typeof options.allowdrawing === 'boolean') this._pendingInfo.allowdrawing = !!options.allowdrawing;
            if (typeof options.iframe === 'boolean') this._pendingInfo.iframe = !!options.iframe;
            if (typeof options.widget === 'boolean') this._pendingInfo.widget = !!options.widget;
            if (typeof options.allowmidi === 'boolean') this._pendingInfo.allowmidi = !!options.allowmidi;
            if (typeof options.allowresources === 'boolean') this._pendingInfo.allowresources = !!options.allowresources;
            if (typeof options.allowchunked === 'boolean' || typeof options.allowchunked === 'number') this._pendingInfo.allowchunked = options.allowchunked;
            // Also accept a nested info object for convenience
            if (options.info && typeof options.info === 'object') {
                const inf = options.info;
                if (inf.label) { this._pendingInfo.label = this._sanitizeLabel(inf.label); this._pendingLabel = this._pendingInfo.label; }
                if (inf.meta) this._pendingInfo.meta = this._sanitizeLabel(inf.meta);
                if (inf.order) this._pendingInfo.order = this._sanitizeLabel(inf.order);
                if (typeof inf.broadcast === 'boolean') this._pendingInfo.broadcast = !!inf.broadcast;
                if (typeof inf.allowdrawing === 'boolean') this._pendingInfo.allowdrawing = !!inf.allowdrawing;
                if (typeof inf.iframe === 'boolean') this._pendingInfo.iframe = !!inf.iframe;
                if (typeof inf.widget === 'boolean') this._pendingInfo.widget = !!inf.widget;
                if (typeof inf.allowmidi === 'boolean') this._pendingInfo.allowmidi = !!inf.allowmidi;
                if (typeof inf.allowresources === 'boolean') this._pendingInfo.allowresources = !!inf.allowresources;
                if (typeof inf.allowchunked === 'boolean' || typeof inf.allowchunked === 'number') this._pendingInfo.allowchunked = inf.allowchunked;
            }

            // ... remainder of SDK file omitted for brevity
