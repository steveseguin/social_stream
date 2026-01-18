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

            // Handle room join if needed
            if (!this.state.roomJoined && options.room) {
                await this.joinRoom({ 
                    room: options.room, 
                    password: options.password !== undefined ? options.password : this.password 
                });
            }

            // Generate hashed streamID
            let hashedStreamID = streamID;
            {
                const __effectivePassword = this._getEffectivePassword();
                if (__effectivePassword !== null) {
                    hashedStreamID = await this._hashStreamID(streamID, __effectivePassword);
                }
            }

            this._log('Publishing with streamID:', streamID, 'as:', hashedStreamID);

            // Store state
            this.state.streamID = streamID;
            this.state.publishing = true;

            // Start monitoring outbound video tracks for mute state changes
            this._clearAllVideoTrackMonitors();
            if (this.localStream) {
                const videoTracks = this.localStream.getVideoTracks ? this.localStream.getVideoTracks() : [];
                videoTracks.forEach(track => this._monitorOutboundVideoTrack(track));
            }

            // Send seed message
            const seedMessage = {
                request: "seed",
                streamID: hashedStreamID
            };

            this._log('Sending seed message for streamID:', hashedStreamID);
            this._sendMessageWS(seedMessage);

            this._emit('publishing', { streamID, hashedStreamID });
            
            // Add our own stream to tracking
            if (this.streams) {
                const now = Date.now();
                this.streams.set(streamID, {
                    firstSeen: now,
                    lastSeen: now,
                    uuid: this.state.uuid,
                    state: 'connected' // Our own stream is connected
                });
            }

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
            // Warn on unexpected fields
            if (options.role !== undefined) {
                console.warn('[VDONinja SDK] announce({ role }) is not used. Remove role and just call announce().');
                this._emit('alert', { message: 'announce({ role }) is ignored. Remove role and call announce({ streamID }).' });
            }

            // Persist label if provided for downstream DC open
            if (options.label) this._pendingLabel = this._sanitizeLabel(options.label);
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

            // Use provided streamID, fall back to pending value from constructor/property, then generate
            const streamID = this._sanitizeStreamID(options.streamID || this._pendingStreamID) || this._generateStreamID();

            // Handle room join if needed
            if (!this.state.roomJoined && options.room) {
                await this.joinRoom({ 
                    room: options.room, 
                    password: options.password !== undefined ? options.password : this.password 
                });
            }

            // Generate hashed streamID
            let hashedStreamID = streamID;
            {
                const __effectivePassword = this._getEffectivePassword();
                if (__effectivePassword !== null) {
                    hashedStreamID = await this._hashStreamID(streamID, __effectivePassword);
                }
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

            if (this._outboundVideoMonitors && this._outboundVideoMonitors.size) {
                for (const monitor of this._outboundVideoMonitors.values()) {
                    this._sendVideoMutedState(monitor.track, true, null, 'stopPublishing');
                }
            }

            // Send bye message to all viewers via data channels
            const byePromises = [];
            
            for (const [uuid, connections] of this.connections) {
                const connection = connections.publisher;
                if (connection && connection.dataChannel && 
                    connection.dataChannel.readyState === 'open') {
                    try {
                        const byeMsg = { bye: true };
                        this._sendDataInternal(byeMsg, uuid, null, 'publisher');
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

                this._clearAllVideoTrackMonitors();

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
            
            // Track stream as pending
            const now = Date.now();
            const existing = this.streams.get(streamID);
            this.streams.set(streamID, {
                firstSeen: existing?.firstSeen || now,
                lastSeen: now,
                uuid: existing?.uuid || null,
                state: 'pending',
                viewRequestTime: now
            });

            try {
                // Hash the streamID if password is set
                let hashedStreamID = streamID;
                {
                    const __effectivePassword = this._getEffectivePassword();
                    if (__effectivePassword !== null) {
                        hashedStreamID = await this._hashStreamID(streamID, __effectivePassword);
                    }
                }
                
                // Normalize legacy dataOnly into audio/video flags for pending view
                const normalizedOptions = (() => {
                    if (options && options.dataOnly === true) {
                        return { ...options, audio: false, video: false };
                    }
                    return options || {};
                })();

                // Track pending view so we know we initiated this
                this._pendingViews.set(streamID, {
                    options: normalizedOptions,
                    timestamp: Date.now(),
                    hashedStreamID: hashedStreamID  // Store the hashed version for comparison
                });
                
                // Store view options for potential reconnection
                this._lastViewOptions = this._lastViewOptions || {};
                this._lastViewOptions[streamID] = normalizedOptions;

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
                        // Don't reject - instead set up retry mechanism
                        this._log(`Stream ${streamID} not available yet, will retry in 15 minutes`);
                        this._setupViewRetry(streamID, options);
                        resolve(null); // Resolve without error - we're still waiting
                    }, 15000);
                });

            } catch (error) {
                this._log('Error in view:', error.message);
                this._pendingViews.delete(streamID);
                throw error;
            }
        }
        
        /**
         * Set up automatic retry for viewing a stream
         * @private
         * @param {string} streamID - The stream ID to retry
         * @param {Object} options - View options
         */
        _setupViewRetry(streamID, options) {
            // Clear any existing retry timer for this stream
            if (this._viewRetryTimers.has(streamID)) {
                clearTimeout(this._viewRetryTimers.get(streamID));
            }
            
            // Set up new retry timer
            const retryTimer = setTimeout(() => {
                this._log(`Retrying view for stream: ${streamID}`);
                this._viewRetryTimers.delete(streamID);
                
                // Only retry if we're still connected and haven't manually stopped viewing
                if (this.state.connected && !this._intentionalDisconnect) {
                    this.view(streamID, options).catch(err => {
                        this._log('Retry view error:', err.message);
                    });
                }
            }, this._viewRetryInterval);
            
            this._viewRetryTimers.set(streamID, retryTimer);
        }

        /**
         * Stop viewing a stream
         * @param {string} streamID - The stream ID to stop viewing
         */
        stopViewing(streamID) {
            // Mark as intentional disconnect
            this._intentionalDisconnect = true;
            
            // Cancel any retry timer for this stream
            if (this._viewRetryTimers.has(streamID)) {
                clearTimeout(this._viewRetryTimers.get(streamID));
                this._viewRetryTimers.delete(streamID);
            }
            
            // Remove from pending views
            this._pendingViews.delete(streamID);
            
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
                    // Update stream state to connected
                    if (connection.streamID && this.streams.has(connection.streamID)) {
                        const stream = this.streams.get(connection.streamID);
                        stream.state = 'connected';
                        stream.lastSeen = Date.now();
                        if (connection.uuid) stream.uuid = connection.uuid;
                    }
                    this._emit('peerConnected', { uuid, connection });
                } else if (connection.pc.iceConnectionState === 'failed' || 
                           connection.pc.iceConnectionState === 'disconnected') {
                    // Update stream state to disconnected/failed
                    if (connection.streamID && this.streams.has(connection.streamID)) {
                        const stream = this.streams.get(connection.streamID);
                        stream.state = connection.pc.iceConnectionState === 'failed' ? 'failed' : 'disconnected';
                        stream.lastSeen = Date.now();
                    }
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
                const dc = connection.pc.createDataChannel('sendChannel', { 
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
         * Determine if a track is effectively muted for viewers.
         * @private
         * @param {MediaStreamTrack} track
         * @returns {boolean}
         */
        _isTrackEffectivelyMuted(track) {
            if (!track) return true;
            if (track.readyState === 'ended') return true;
            if (track.enabled === false) return true;
            if (track.muted === true) return true;
            return false;
        }

        /**
         * Broadcast publisher video mute state to viewers.
         * @private
         * @param {MediaStreamTrack} track
         * @param {boolean} muted
         * @param {string|null} targetUuid
         */
        _sendVideoMutedState(track, muted, targetUuid = null, reason = null) {
            if (!this.state || !this.state.publishing) {
                return;
            }

            const payload = { videoMuted: !!muted };
            if (track && typeof track.id === 'string') {
                payload.trackId = track.id;
            }
            if (reason) {
                this._log(`Broadcasting videoMuted:${payload.videoMuted} (${reason})`);
            }

            if (targetUuid) {
                this._sendDataInternal(payload, targetUuid, null, 'publisher');
            } else {
                this._sendDataInternal(payload, null, 'publisher', 'publisher');
            }
        }

        /**
         * Start monitoring an outbound video track for mute state changes.
         * @private
         * @param {MediaStreamTrack} track
         */
        _monitorOutboundVideoTrack(track) {
            if (!track || track.kind !== 'video') return;
            if (this._pendingVideoMuteFinalizers && this._pendingVideoMuteFinalizers.size) {
                this._cancelPendingVideoMuteFinalizers();
            }
            if (!this._outboundVideoMonitors) {
                this._outboundVideoMonitors = new Map();
            }
            if (this._outboundVideoMonitors.has(track)) {
                // Refresh state in case external code toggled before monitoring
                const monitor = this._outboundVideoMonitors.get(track);
                const currentState = this._isTrackEffectivelyMuted(track);
                if (monitor) {
                    monitor.lastState = currentState;
                }
                if (this.state?.publishing) {
                    this._sendVideoMutedState(track, currentState, null, 'refresh');
                }
                return;
            }

            const monitor = {
                track,
                lastState: this._isTrackEffectivelyMuted(track),
                restoreEnabled: null,
                restoreStop: null,
                listeners: [],
                poller: null,
                pendingFinalizer: null,
                finalizing: false
            };

            const broadcastState = (muted, reasonLabel) => {
                const label = reasonLabel || 'update';
                this._sendVideoMutedState(track, muted, null, label);
                this._emit('publisherVideoMuteState', {
                    track,
                    muted,
                    reason: label
                });
            };

            const emitState = (reason, options = {}) => {
                const { force = false, delay = 0, cleanup = false } = options;
                const evaluateMuted = () => this._isTrackEffectivelyMuted(track);

                const dispatch = () => {
                    if (monitor.pendingFinalizer) {
                        monitor.pendingFinalizer = null;
                    }
                    const mutedNow = evaluateMuted();
                    if (!force && mutedNow === monitor.lastState) {
                        if (cleanup) {
                            this._unmonitorOutboundVideoTrack(track, { skipSend: true });
                        }
                        return;
                    }

                    monitor.lastState = mutedNow;
                    broadcastState(mutedNow, reason || 'update');

                    if (cleanup) {
                        this._unmonitorOutboundVideoTrack(track, { skipSend: true });
                    }
                };

                if (monitor.pendingFinalizer) {
                    try {
                        monitor.pendingFinalizer.cancel();
                    } catch (err) {
                        this._log('Error cancelling pending mute finalizer:', err);
                    }
                    monitor.pendingFinalizer = null;
                }

                if (delay > 0) {
                    monitor.pendingFinalizer = this._scheduleVideoMuteFinalizer(delay, dispatch, () => {
                        monitor.pendingFinalizer = null;
                    });
                } else {
                    dispatch();
                }
            };

            const finalizeOnce = (reasonLabel) => {
                if (monitor.finalizing) return;
                monitor.finalizing = true;
                emitState(reasonLabel, {
                    force: true,
                    delay: OUTBOUND_VIDEO_STOP_MUTE_DELAY_MS,
                    cleanup: true
                });
            };

            const handleMute = () => emitState('mute');
            const handleUnmute = () => emitState('unmute');
            const handleEnded = () => finalizeOnce('ended');

            if (typeof track.addEventListener === 'function') {
                track.addEventListener('mute', handleMute);
                track.addEventListener('unmute', handleUnmute);
                track.addEventListener('ended', handleEnded);
                monitor.listeners.push(['mute', handleMute], ['unmute', handleUnmute], ['ended', handleEnded]);
            }

            if (typeof track.stop === 'function') {
                const originalStop = track.stop.bind(track);
                try {
                    track.stop = (...args) => {
                        finalizeOnce('stop');
                        return originalStop(...args);
                    };
                    monitor.restoreStop = () => {
                        try {
                            track.stop = originalStop;
                        } catch (err) {
                            this._log('Failed to restore track.stop:', err);
                        }
                    };
                } catch (error) {
                    this._log('Unable to wrap MediaStreamTrack.stop for monitoring:', error);
                }
            }

            let trackExtensible = false;
            try {
                trackExtensible = Object.isExtensible(track);
            } catch (err) {
                this._log('Unable to inspect MediaStreamTrack extensibility:', err);
            }

            const canRedefineEnabled =
                !!MEDIA_STREAM_TRACK_ENABLED_DESCRIPTOR &&
                typeof MEDIA_STREAM_TRACK_ENABLED_DESCRIPTOR.get === 'function' &&
                typeof MEDIA_STREAM_TRACK_ENABLED_DESCRIPTOR.set === 'function' &&
                (MEDIA_STREAM_TRACK_ENABLED_DESCRIPTOR.configurable !== false) &&
                trackExtensible;

            if (canRedefineEnabled) {
                const { get: baseGet, set: baseSet } = MEDIA_STREAM_TRACK_ENABLED_DESCRIPTOR;
                try {
                    Object.defineProperty(track, 'enabled', {
                        configurable: true,
                        enumerable: true,
                        get() {
                            return baseGet.call(track);
                        },
                        set: (value) => {
                            const before = baseGet.call(track);
                            baseSet.call(track, value);
                            const after = baseGet.call(track);
                            if (before !== after) {
                                emitState('enabled-toggle');
                            }
                        }
                    });
                    monitor.restoreEnabled = () => {
                        try {
                            delete track.enabled;
                        } catch (err) {
                            this._log('Failed to restore track.enabled descriptor:', err);
                        }
                    };
                } catch (error) {
                    this._log('Unable to wrap MediaStreamTrack.enabled for monitoring:', error);
                }
            } else {
                this._log('Skipping MediaStreamTrack.enabled override; falling back to polling.');
            }

            if (!monitor.restoreEnabled) {
                // Poll as a Safari/iOS fallback so we still detect state updates when redefine fails.
                monitor.poller = setInterval(() => emitState('poll'), 250);
            }

            this._outboundVideoMonitors.set(track, monitor);

            // Send initial state so viewers immediately know current mute status
            if (this.state?.publishing) {
                broadcastState(monitor.lastState, 'initial');
            } else {
                this._emit('publisherVideoMuteState', {
                    track,
                    muted: monitor.lastState,
                    reason: 'initial'
                });
            }
        }

        /**
         * Stop monitoring an outbound video track.
         * @private
         * @param {MediaStreamTrack} track
         * @param {Object} options
         * @param {boolean} options.skipSend - If true, do not send final state
         * @param {boolean} options.forceMuted - Optional final state override
         */
        _unmonitorOutboundVideoTrack(track, options = {}) {
            if (!track || !this._outboundVideoMonitors || !this._outboundVideoMonitors.has(track)) {
                return;
            }

            const monitor = this._outboundVideoMonitors.get(track);

            if (monitor) {
                if (monitor.pendingFinalizer) {
                    try {
                        monitor.pendingFinalizer.cancel();
                    } catch (err) {
                        this._log('Error cancelling monitor pending finalizer:', err);
                    }
                    monitor.pendingFinalizer = null;
                }

                const shouldSendFinal = !options.skipSend && this.state?.publishing && !monitor.finalizing;
                if (shouldSendFinal) {
                    const finalMuted = typeof options.forceMuted === 'boolean'
                        ? options.forceMuted
                        : true;
                    const finalReason = typeof options.forceMuted === 'boolean'
                        ? 'force-muted'
                        : 'monitor-stopped';
                    const delayMs = typeof options.delayMs === 'number'
                        ? Math.max(0, options.delayMs)
                        : (finalMuted ? OUTBOUND_VIDEO_STOP_MUTE_DELAY_MS : 0);

                    const dispatch = () => {
                        this._sendVideoMutedState(track, finalMuted, null, finalReason);
                        this._emit('publisherVideoMuteState', {
                            track,
                            muted: finalMuted,
                            reason: finalReason
                        });
                    };

                    if (delayMs > 0) {
                        monitor.pendingFinalizer = this._scheduleVideoMuteFinalizer(delayMs, dispatch, () => {
                            monitor.pendingFinalizer = null;
                        });
                    } else {
                        dispatch();
                    }
                }
                if (monitor.restoreEnabled) {
                    try {
                        monitor.restoreEnabled();
                    } catch (err) {
                        this._log('Failed to restore track.enabled descriptor:', err);
                    }
                }
                if (monitor.restoreStop) {
                    try {
                        monitor.restoreStop();
                    } catch (err) {
                        this._log('Failed to restore track.stop override:', err);
                    }
                }
                if (monitor.poller) {
                    clearInterval(monitor.poller);
                    monitor.poller = null;
                }
                if (monitor.listeners && typeof track.removeEventListener === 'function') {
                    for (const [evt, handler] of monitor.listeners) {
                        try {
                            track.removeEventListener(evt, handler);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            }

            this._outboundVideoMonitors.delete(track);
        }

        /**
         * Schedule a delayed videoMute broadcast that can be flushed later.
         * @private
         * @param {number} delayMs
         * @param {Function} dispatch
         * @param {Function} onFinish
         * @returns {Object} finalizer handle with flush() and cancel()
         */
        _scheduleVideoMuteFinalizer(delayMs, dispatch, onFinish) {
            if (!this._pendingVideoMuteFinalizers) {
                this._pendingVideoMuteFinalizers = new Set();
            }

            const self = this;
            const finalizer = {
                timerId: null,
                finished: false,
                flush() {
                    if (finalizer.finished) return;
                    finalizer.finished = true;
                    if (finalizer.timerId) {
                        clearTimeout(finalizer.timerId);
                        finalizer.timerId = null;
                    }
                    self._pendingVideoMuteFinalizers.delete(finalizer);
                    try {
                        dispatch();
                    } catch (err) {
                        self._log('Error dispatching videoMuted finalizer:', err);
                    }
                    if (typeof onFinish === 'function') {
                        try {
                            onFinish(true);
                        } catch (err) {
                            self._log('Error running mute finalizer onFinish handler:', err);
                        }
                    }
                },
                cancel() {
                    if (finalizer.finished) return;
                    finalizer.finished = true;
                    if (finalizer.timerId) {
                        clearTimeout(finalizer.timerId);
                        finalizer.timerId = null;
                    }
                    self._pendingVideoMuteFinalizers.delete(finalizer);
                    if (typeof onFinish === 'function') {
                        try {
                            onFinish(false);
                        } catch (err) {
                            self._log('Error running mute finalizer cancel handler:', err);
                        }
                    }
                }
            };

            finalizer.timerId = setTimeout(() => finalizer.flush(), delayMs);
            this._pendingVideoMuteFinalizers.add(finalizer);
            return finalizer;
        }

        /**
         * Cancel any pending delayed mute broadcasts.
         * @private
         */
        _cancelPendingVideoMuteFinalizers() {
            if (!this._pendingVideoMuteFinalizers || this._pendingVideoMuteFinalizers.size === 0) {
                return;
            }
            const pending = Array.from(this._pendingVideoMuteFinalizers);
            for (const finalizer of pending) {
                try {
                    finalizer.flush();
                } catch (err) {
                    this._log('Error flushing pending mute finalizer:', err);
                }
            }
        }

        /**
         * Clear all outbound track monitors.
         * @private
         */
        _clearAllVideoTrackMonitors() {
            if (!this._outboundVideoMonitors || this._outboundVideoMonitors.size === 0) {
                if (this._pendingVideoMuteFinalizers && this._pendingVideoMuteFinalizers.size) {
                    this._cancelPendingVideoMuteFinalizers();
                }
                return;
            }
            this._cancelPendingVideoMuteFinalizers();
            const tracks = Array.from(this._outboundVideoMonitors.keys());
            for (const track of tracks) {
                this._unmonitorOutboundVideoTrack(track, { skipSend: true });
            }
            this._outboundVideoMonitors.clear();
            if (this._pendingVideoMuteFinalizers) {
                this._pendingVideoMuteFinalizers.clear();
            }
        }

        /**
         * Synchronize current mute states with a newly opened data channel.
         * @private
         * @param {Object} connection
         */
        _syncVideoMuteStateToConnection(connection) {
            if (!connection || connection.type !== 'publisher') return;
            if (!this.state || !this.state.publishing) return;
            if (!this._outboundVideoMonitors || this._outboundVideoMonitors.size === 0) return;

            for (const monitor of this._outboundVideoMonitors.values()) {
                const track = monitor.track;
                const muted = typeof monitor.lastState === 'boolean'
                    ? monitor.lastState
                    : this._isTrackEffectivelyMuted(track);
                this._sendVideoMutedState(track, muted, connection.uuid, 'sync');
            }
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
                        // Send strictly via the viewer-side data channel to the publisher (VDO.Ninja compatibility)
                        this._sendDataInternal(connection.viewPreferences, connection.uuid, null, 'viewer');
                        this._log('Sent track preferences:', connection.viewPreferences);
                    } catch (error) {
                        this._log('Failed to send preferences:', error.message);
                    }
                }

                // Send publisher info (label, meta, etc) to viewer when DC opens
                if (connection.type === 'publisher') {
                    try {
                        // Merge connection.info and _pendingInfo to build outbound info payload
                        const infoCombined = Object.assign({}, this._pendingInfo || {}, connection.info || {});
                        // Sanitize string fields
                        if (infoCombined.label) infoCombined.label = this._sanitizeLabel(infoCombined.label);
                        if (infoCombined.meta) infoCombined.meta = this._sanitizeLabel(infoCombined.meta);
                        if (infoCombined.order) infoCombined.order = this._sanitizeLabel(infoCombined.order);

                        if (Object.keys(infoCombined).length > 0) {
                            const infoMsg = { info: infoCombined };
                            this._logMessage('OUT', infoMsg, 'DataChannel');
                            channel.send(JSON.stringify(infoMsg));
                            this._log('Sent publisher info to viewer:', infoCombined);
                        }
                    } catch (e) {
                        this._log('Failed to send publisher info:', e.message || e);
                    }

                    // Sync current mute state so the viewer blanks immediately if needed
                    this._syncVideoMuteStateToConnection(connection);
                }
                
                // Start ping monitoring based on role/flags
                this._startPingMonitoring(connection);
                
                this._emit('dataChannelOpen', {
                    uuid: connection.uuid,
                    type: connection.type,
                    streamID: connection.streamID,
                    // Provide a 'data' alias for handlers expecting event.detail.data
                    data: { uuid: connection.uuid, type: connection.type, streamID: connection.streamID }
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
                    } else if (msg.info && typeof msg.info === 'object') {
                        // Update connection info (e.g., label) and emit event
                        connection.info = Object.assign(connection.info || {}, msg.info);
                        this._emit('peerInfo', {
                            uuid: connection.uuid,
                            streamID: connection.streamID,
                            info: connection.info
                        });
                    } else if (msg.ping) {
                        // Respond to ping regardless of role, matching reference behavior
                        try {
                            this._sendDataInternal({ pong: msg.ping }, connection.uuid, null, 'any');
                            this._log('Sent pong response');
                        } catch (error) {
                            this._log('Failed to send pong:', error.message);
                        }
                    } else if (msg.pong) {
                        // Handle pong for either role (whoever initiated ping)
                        const latency = Date.now() - msg.pong;
                        if (connection.pendingPing === msg.pong) {
                            connection.pendingPing = null;
                            connection.missedPings = 0;
                        }
                        this._emit('peerLatency', { 
                            uuid: connection.uuid, 
                            latency: latency,
                            streamID: connection.streamID 
                        });
                        this._log(`Latency to ${connection.type === 'publisher' ? 'viewer' : 'publisher'} ${connection.uuid}: ${latency}ms`);
                    } else if (msg.bye) {
                        this._log('Received bye message via data channel');
                        this._handleBye({ UUID: connection.uuid });
                    } else if (Object.prototype.hasOwnProperty.call(msg, 'videoMuted')) {
                        const detail = {
                            muted: !!msg.videoMuted,
                            trackId: (typeof msg.trackId === 'string') ? msg.trackId : null,
                            streamID: connection.streamID || null,
                            uuid: connection.uuid,
                            connectionType: connection.type || 'unknown',
                            timestamp: Date.now(),
                            raw: msg
                        };
                        this._emit('remoteVideoMuteState', detail);
                        this._emit('dataReceived', {
                            data: msg,
                            uuid: connection.uuid,
                            streamID: connection.streamID
                        });
                        // Typo compatibility: also emit 'dataRecieved'
                        this._emit('dataRecieved', {
                            data: msg,
                            uuid: connection.uuid,
                            streamID: connection.streamID
                        });
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
                            // Typo compatibility: also emit 'dataRecieved'
                            this._emit('dataRecieved', {
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
                            if (this._getEffectivePassword() !== null) {
                                try {
                                    const [encrypted, vector] = await this._encryptMessage(JSON.stringify(offer));
                            const restartMsg = { 
                                UUID: connection.uuid,
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
                                UUID: connection.uuid,
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
                try {
                    this._emit('dataChannelClose', {
                        uuid: connection.uuid,
                        type: connection.type,
                        streamID: connection.streamID
                    });
                } catch (e) {}
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
                
                // Apply encoding preferences (bitrate/codec) if requested
                await this._applyEncodingPreferencesToConnection(connection);

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
         * Apply codec and encoding preferences to outgoing senders for a connection.
         * @private
         * @param {Object} connection - Connection object
         * @param {Object} [configOverride] - Optional override config
         */
        async _applyEncodingPreferencesToConnection(connection, configOverride) {
            if (!connection || !connection.pc || connection.type !== 'publisher') return;

            const config = configOverride || this._publishMediaConfig;
            if (!config) return;
            if (typeof connection.pc.getSenders !== 'function') return;

            const senders = connection.pc.getSenders();
            if (!Array.isArray(senders) || senders.length === 0) return;

            const transceivers = (typeof connection.pc.getTransceivers === 'function')
                ? connection.pc.getTransceivers()
                : [];

            const tasks = [];

            for (const sender of senders) {
                if (!sender || !sender.track) continue;
                const kind = sender.track.kind;
                if (!kind) continue;

                const mediaConfig = kind === 'video' ? config.video : (kind === 'audio' ? config.audio : null);
                if (!mediaConfig) continue;

                if (mediaConfig.codec) {
                    this._preferCodecOnSender(sender, mediaConfig.codec, kind, transceivers);
                }

                if (typeof mediaConfig.maxBitrate === 'number' ||
                    typeof mediaConfig.minBitrate === 'number' ||
                    typeof mediaConfig.maxFramerate === 'number' ||
                    typeof mediaConfig.scaleResolutionDownBy === 'number') {
                    tasks.push(this._applySenderEncodingParameters(sender, mediaConfig, kind));
                }
            }

            if (tasks.length > 0) {
                await Promise.all(
                    tasks.map(task => task.catch(error => this._log('Failed to apply RTP sender parameters:', error)))
                );
            }
        }

        /**
         * Reset any explicit encoding preferences applied to a connection.
         * @private
         * @param {Object} connection - Connection to reset
         */
        async _resetEncodingPreferencesForConnection(connection) {
            if (!connection || !connection.pc || typeof connection.pc.getSenders !== 'function') return;

            const senders = connection.pc.getSenders();
            if (!Array.isArray(senders) || senders.length === 0) return;

            const tasks = senders.map(sender => this._clearSenderEncodingParameters(sender));
            await Promise.all(
                tasks.map(task => task.catch(error => this._log('Failed to clear RTP sender parameters:', error)))
            );
        }

        /**
         * Prioritize a codec on a transceiver when supported.
         * @private
         * @param {RTCRtpSender} sender - Sender to adjust
         * @param {string} codecName - Desired codec (e.g. "VP9", "video/VP9")
         * @param {string} kind - "audio" or "video"
         * @param {RTCRtpTransceiver[]} transceivers - Available transceivers
         */
        _preferCodecOnSender(sender, codecName, kind, transceivers = []) {
            if (!sender || !codecName) return;
            if (typeof RTCRtpSender === 'undefined' || typeof RTCRtpSender.getCapabilities !== 'function') return;

            const normalizedCodec = this._normalizeCodecName(codecName, kind);
            if (!normalizedCodec) return;

            const transceiver = Array.isArray(transceivers)
                ? transceivers.find(t => t && t.sender === sender)
                : null;

            if (!transceiver || typeof transceiver.setCodecPreferences !== 'function') return;

            const capabilities = RTCRtpSender.getCapabilities(kind);
            if (!capabilities || !Array.isArray(capabilities.codecs) || capabilities.codecs.length === 0) return;

            const preferenceList = this._buildCodecPreferenceList(capabilities.codecs, normalizedCodec);
            if (!preferenceList) return;

            try {
                transceiver.setCodecPreferences(preferenceList);
                this._log(`Applied codec preference ${normalizedCodec} for ${kind}`);
            } catch (error) {
                this._log('Codec preference application failed:', error);
            }
        }

        /**
         * Apply RTP sender encoding parameters such as bitrate.
         * @private
         * @param {RTCRtpSender} sender - Sender to adjust
         * @param {Object} mediaConfig - Media configuration
         * @param {string} kind - "audio" or "video"
         */
        async _applySenderEncodingParameters(sender, mediaConfig, kind) {
            if (!sender || typeof sender.getParameters !== 'function' || typeof sender.setParameters !== 'function') return;

            let params;
            try {
                params = sender.getParameters();
            } catch (error) {
                this._log('Unable to read RTP sender parameters:', error);
                return;
            }

            if (!params) return;

            if (!Array.isArray(params.encodings) || params.encodings.length === 0) {
                params.encodings = [{}];
            }

            const encoding = params.encodings[0];
            let changed = false;

            if (typeof mediaConfig.maxBitrate === 'number') {
                encoding.maxBitrate = mediaConfig.maxBitrate;
                changed = true;
            }

            if (typeof mediaConfig.minBitrate === 'number') {
                encoding.minBitrate = mediaConfig.minBitrate;
                changed = true;
            }

            if (typeof mediaConfig.maxFramerate === 'number') {
                encoding.maxFramerate = mediaConfig.maxFramerate;
                changed = true;
            }

            if (typeof mediaConfig.scaleResolutionDownBy === 'number') {
                encoding.scaleResolutionDownBy = mediaConfig.scaleResolutionDownBy;
                changed = true;
            }

            if (!changed) return;

            try {
                await sender.setParameters(params);
            } catch (error) {
                this._log('Failed to set RTP sender parameters:', error);
            }
        }

        /**
         * Clear custom RTP sender parameters.
         * @private
         * @param {RTCRtpSender} sender - Sender to reset
         */
        async _clearSenderEncodingParameters(sender) {
            if (!sender || typeof sender.getParameters !== 'function' || typeof sender.setParameters !== 'function') return;

            let params;
            try {
                params = sender.getParameters();
            } catch (error) {
                this._log('Unable to read RTP sender parameters:', error);
                return;
            }

            if (!params || !Array.isArray(params.encodings) || params.encodings.length === 0) return;

            const encoding = params.encodings[0];
            let changed = false;

            for (const key of ['maxBitrate', 'minBitrate', 'maxFramerate', 'scaleResolutionDownBy']) {
                if (encoding[key] !== undefined) {
                    delete encoding[key];
                    changed = true;
                }
            }

            if (!changed) return;

            try {
                await sender.setParameters(params);
            } catch (error) {
                this._log('Failed to clear RTP sender parameters:', error);
            }
        }

        /**
         * Normalize codec name to match the format used by WebRTC capabilities.
         * @private
         * @param {string} codecName - Codec identifier
         * @param {string} kind - "audio" or "video"
         * @returns {string|null} Normalized codec string
         */
        _normalizeCodecName(codecName, kind) {
            if (typeof codecName !== 'string') return null;

            let normalized = codecName.trim();
            if (!normalized) return null;

            if (normalized.startsWith('/')) {
                normalized = `${kind}${normalized}`;
            } else if (!normalized.includes('/')) {
                normalized = `${kind}/${normalized}`;
            }

            const parts = normalized.split('/');
            if (parts.length !== 2) return null;

            const prefix = parts[0].toLowerCase();
            const suffix = parts[1].trim().toUpperCase();

            if (!prefix || !suffix) return null;

            return `${prefix}/${suffix}`;
        }

        /**
         * Build a codec preference list prioritizing the requested codec.
         * @private
         * @param {Array} codecs - Codec capabilities
         * @param {string} requestedCodec - Normalized codec string
         * @returns {Array|null} Reordered codec list
         */
        _buildCodecPreferenceList(codecs, requestedCodec) {
            if (!Array.isArray(codecs) || !requestedCodec) return null;

            const target = requestedCodec.toLowerCase();
            const primary = [];
            const associated = [];
            const fallback = [];

            for (const codec of codecs) {
                const mime = (codec && codec.mimeType ? codec.mimeType : '').toLowerCase();
                if (!mime) {
                    fallback.push(codec);
                    continue;
                }

                if (mime === target) {
                    primary.push(codec);
                } else if (mime.endsWith('/rtx')) {
                    associated.push(codec);
                } else {
                    fallback.push(codec);
                }
            }

            if (primary.length === 0) return null;

            const payloads = new Set(
                primary
                    .map(codec => codec && codec.preferredPayloadType)
                    .filter(value => value !== undefined)
            );

            const orderedAssociated = associated.filter(codec => {
                if (!codec || !codec.sdpFmtpLine) return false;
                const match = codec.sdpFmtpLine.match(/apt=(\d+)/);
                if (!match) return false;
                return payloads.has(Number(match[1]));
            });

            return [...primary, ...orderedAssociated, ...fallback];
        }

        /**
         * Apply local media constraints such as resolution.
         * @private
         * @param {MediaStream} stream - Local media stream
         * @param {Object} config - Media configuration
         */
        async _applyLocalMediaPreferences(stream, config) {
            if (!stream || !config) return;

            const videoSettings = config.video;
            if (!videoSettings || !videoSettings.resolution) return;

            const constraints = {};
            const { width, height, frameRate } = videoSettings.resolution;

            if (typeof width === 'number' && width > 0) {
                constraints.width = { ideal: width };
            }

            if (typeof height === 'number' && height > 0) {
                constraints.height = { ideal: height };
            }

            if (typeof frameRate === 'number' && frameRate > 0) {
                constraints.frameRate = { ideal: frameRate };
            }

            if (Object.keys(constraints).length === 0) return;

            const videoTracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
            for (const track of videoTracks) {
                if (!track || typeof track.applyConstraints !== 'function') continue;
                try {
                    await track.applyConstraints(constraints);
                    this._log('Applied video constraints:', constraints);
                } catch (error) {
                    this._log('Failed to apply video constraints:', error);
                }
            }
        }

        /**
         * Extract and normalize publisher media preferences from options.
         * Accepts the same shape as publish() options (media/webrtc).
         * @private
         * @param {Object} options - Options provided to publish()/updatePublisherMedia()
         * @returns {Object|null} Normalized configuration
         */
        async _extractPublisherMediaOptions(options = {}) {
            if (!options) return null;

            const sources = [];
            if (options.media && typeof options.media === 'object') sources.push(options.media);
            if (options.mediaSettings && typeof options.mediaSettings === 'object') sources.push(options.mediaSettings);
            if (options.webrtc && typeof options.webrtc === 'object') sources.push(options.webrtc);
            if (options.encoding && typeof options.encoding === 'object') sources.push(options.encoding);

            const collected = { video: {}, audio: {} };
            let hasValues = false;

            const applySource = (source) => {
                if (!source || typeof source !== 'object') return;

                if (typeof source.video === 'object' && source.video !== null) {
                    if (source.video.codec !== undefined) { collected.video.codec = source.video.codec; hasValues = true; }
                    if (source.video.bitrate !== undefined) { collected.video.maxBitrate = source.video.bitrate; hasValues = true; }
                    if (source.video.maxBitrate !== undefined) { collected.video.maxBitrate = source.video.maxBitrate; hasValues = true; }
                    if (source.video.minBitrate !== undefined) { collected.video.minBitrate = source.video.minBitrate; hasValues = true; }
                    if (source.video.resolution !== undefined) { collected.video.resolution = source.video.resolution; hasValues = true; }
                    if (source.video.width !== undefined) { collected.video.width = source.video.width; hasValues = true; }
                    if (source.video.height !== undefined) { collected.video.height = source.video.height; hasValues = true; }
                    if (source.video.frameRate !== undefined) { collected.video.frameRate = source.video.frameRate; hasValues = true; }
                }

                if (source.videoCodec !== undefined) { collected.video.codec = source.videoCodec; hasValues = true; }
                if (source.videoBitrate !== undefined) { collected.video.maxBitrate = source.videoBitrate; hasValues = true; }
                if (source.videoResolution !== undefined) { collected.video.resolution = source.videoResolution; hasValues = true; }
                if (source.videoWidth !== undefined) { collected.video.width = source.videoWidth; hasValues = true; }
                if (source.videoHeight !== undefined) { collected.video.height = source.videoHeight; hasValues = true; }
                if (source.videoFrameRate !== undefined) { collected.video.frameRate = source.videoFrameRate; hasValues = true; }

                if (typeof source.audio === 'object' && source.audio !== null) {
                    if (source.audio.codec !== undefined) { collected.audio.codec = source.audio.codec; hasValues = true; }
                    if (source.audio.bitrate !== undefined) { collected.audio.maxBitrate = source.audio.bitrate; hasValues = true; }
                    if (source.audio.maxBitrate !== undefined) { collected.audio.maxBitrate = source.audio.maxBitrate; hasValues = true; }
                    if (source.audio.minBitrate !== undefined) { collected.audio.minBitrate = source.audio.minBitrate; hasValues = true; }
                }

                if (source.audioCodec !== undefined) { collected.audio.codec = source.audioCodec; hasValues = true; }
                if (source.audioBitrate !== undefined) { collected.audio.maxBitrate = source.audioBitrate; hasValues = true; }
            };

            sources.forEach(applySource);

            if (options.videoCodec !== undefined) { collected.video.codec = options.videoCodec; hasValues = true; }
            if (options.videoBitrate !== undefined) { collected.video.maxBitrate = options.videoBitrate; hasValues = true; }
            if (options.videoResolution !== undefined) { collected.video.resolution = options.videoResolution; hasValues = true; }
            if (options.videoWidth !== undefined) { collected.video.width = options.videoWidth; hasValues = true; }
            if (options.videoHeight !== undefined) { collected.video.height = options.videoHeight; hasValues = true; }
            if (options.videoFrameRate !== undefined) { collected.video.frameRate = options.videoFrameRate; hasValues = true; }
            if (options.audioCodec !== undefined) { collected.audio.codec = options.audioCodec; hasValues = true; }
            if (options.audioBitrate !== undefined) { collected.audio.maxBitrate = options.audioBitrate; hasValues = true; }

            if (!hasValues) return null;

            const normalized = {};

            const videoConfig = {};
            if (collected.video.codec !== undefined) {
                videoConfig.codec = collected.video.codec;
            }
            const parsedVideoBitrate = this._parseBitrateSetting(collected.video.maxBitrate);
            if (parsedVideoBitrate !== null) {
                videoConfig.maxBitrate = parsedVideoBitrate;
            }
            const parsedVideoMinBitrate = this._parseBitrateSetting(collected.video.minBitrate);
            if (parsedVideoMinBitrate !== null) {
                videoConfig.minBitrate = parsedVideoMinBitrate;
            }
            const parsedResolution = this._parseResolutionSetting(
                collected.video.resolution,
                collected.video.width,
                collected.video.height,
                collected.video.frameRate
            );
            if (parsedResolution) {
                videoConfig.resolution = parsedResolution;
            }

            if (Object.keys(videoConfig).length > 0) {
                normalized.video = videoConfig;
            }

            const audioConfig = {};
            if (collected.audio.codec !== undefined) {
                audioConfig.codec = collected.audio.codec;
            }
            const parsedAudioBitrate = this._parseBitrateSetting(collected.audio.maxBitrate);
            if (parsedAudioBitrate !== null) {
                audioConfig.maxBitrate = parsedAudioBitrate;
            }
            const parsedAudioMinBitrate = this._parseBitrateSetting(collected.audio.minBitrate);
            if (parsedAudioMinBitrate !== null) {
                audioConfig.minBitrate = parsedAudioMinBitrate;
            }

            if (Object.keys(audioConfig).length > 0) {
                normalized.audio = audioConfig;
            }

            return Object.keys(normalized).length > 0 ? normalized : null;
        }

        /**
         * Parse bitrate values provided in various formats and normalize to bits per second.
         * @private
         * @param {number|string} value - Bitrate input
         * @returns {number|null} Normalized bitrate in bps
         */
        _parseBitrateSetting(value) {
            if (value === undefined || value === null || value === '') return null;

            let numericValue = value;
            let multiplier = 1;

            if (typeof value === 'string') {
                const trimmed = value.trim().toLowerCase();
                const match = trimmed.match(/^([\d.]+)\s*(kbps|mbps|bps|k|m)?$/);
                if (!match) return null;
                numericValue = parseFloat(match[1]);
                if (Number.isNaN(numericValue)) return null;

                const unit = match[2];
                if (!unit) {
                    multiplier = numericValue < 10000 ? 1000 : 1;
                } else if (unit === 'mbps' || unit === 'm') {
                    multiplier = 1000000;
                } else if (unit === 'kbps' || unit === 'k') {
                    multiplier = 1000;
                } else {
                    multiplier = 1;
                }
            } else if (typeof value === 'number') {
                numericValue = value;
                if (numericValue < 0) return null;
                if (numericValue > 0 && numericValue < 10000) {
                    multiplier = 1000;
                }
            } else {
                return null;
            }

            const result = Math.round(numericValue * multiplier);
            return result > 0 ? result : null;
        }

        /**
         * Normalize resolution values expressed as objects or strings.
         * @private
         * @param {Object|string} resolution - Resolution descriptor
         * @param {number} [widthAlias] - Explicit width override
         * @param {number} [heightAlias] - Explicit height override
         * @param {number} [frameRateAlias] - Explicit frame rate override
         * @returns {Object|null} Normalized resolution constraints
         */
        _parseResolutionSetting(resolution, widthAlias, heightAlias, frameRateAlias) {
            let width = widthAlias !== undefined ? Number(widthAlias) : undefined;
            let height = heightAlias !== undefined ? Number(heightAlias) : undefined;
            let frameRate = frameRateAlias !== undefined ? Number(frameRateAlias) : undefined;

            if (resolution && typeof resolution === 'string') {
                const trimmed = resolution.trim().toLowerCase();
                const match = trimmed.match(/(\d+)x(\d+)(?:@([\d.]+))?/);
                if (match) {
                    width = Number(match[1]);
                    height = Number(match[2]);
                    if (match[3] !== undefined) {
                        frameRate = Number(match[3]);
                    }
                }
            } else if (resolution && typeof resolution === 'object') {
                if (resolution.width !== undefined) width = Number(resolution.width);
                if (resolution.height !== undefined) height = Number(resolution.height);
                if (resolution.frameRate !== undefined) frameRate = Number(resolution.frameRate);
                if (resolution.fps !== undefined && frameRate === undefined) frameRate = Number(resolution.fps);
            }

            const normalized = {};
            if (Number.isFinite(width) && width > 0) normalized.width = Math.round(width);
            if (Number.isFinite(height) && height > 0) normalized.height = Math.round(height);
            if (Number.isFinite(frameRate) && frameRate > 0) normalized.frameRate = Math.round(frameRate);

            return Object.keys(normalized).length > 0 ? normalized : null;
        }

        /**
         * Merge existing media configuration with updates.
         * @private
         * @param {Object|null} baseConfig - Existing configuration
         * @param {Object|null} updateConfig - New configuration
         * @returns {Object|null} Merged configuration
         */
        _mergeMediaConfigs(baseConfig, updateConfig) {
            const result = {};

            if (baseConfig && baseConfig.video) {
                result.video = { ...baseConfig.video };
            }
            if (baseConfig && baseConfig.audio) {
                result.audio = { ...baseConfig.audio };
            }

            if (updateConfig) {
                const mergeSection = (sectionName) => {
                    const updateSection = updateConfig[sectionName];
                    if (updateSection === null) {
                        delete result[sectionName];
                        return;
                    }
                    if (!updateSection || typeof updateSection !== 'object') return;

                    if (!result[sectionName]) {
                        result[sectionName] = {};
                    }

                    for (const [key, value] of Object.entries(updateSection)) {
                        if (value === undefined) continue;
                        if (value === null) {
                            delete result[sectionName][key];
                        } else {
                            result[sectionName][key] = value;
                        }
                    }

                    if (Object.keys(result[sectionName]).length === 0) {
                        delete result[sectionName];
                    }
                };

                mergeSection('video');
                mergeSection('audio');
            }

            return Object.keys(result).length > 0 ? result : null;
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

            // Try data channel first for individual candidates; if it succeeds, do NOT also send via WebSocket.
            // This matches reference webrtc.js behavior: once DC is open, signaling uses DC instead of WSS.
            if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
                try {
                    const msg = {
                        // IMPORTANT: Set type field based on our role:
                    // - If we are a VIEWER, we send type:'remote' (going TO publisher's pcs)
                    // - If we are a PUBLISHER, we send type:'local' (going TO viewer's rpcs)
                    type: connection.type === 'viewer' ? 'remote' : 'local',
                        UUID: connection.uuid,
                        candidates: null,
                        session: connection.session
                    };
                    // Encrypt candidates for DC if password set (match webrtc.js behavior)
                    const candidatesArr = [{
                        candidate: event.candidate.candidate,
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                        sdpMid: event.candidate.sdpMid
                    }];
                    if (this._getEffectivePassword() !== null) {
                        try {
                            const [encrypted, vector] = await this._encryptMessage(JSON.stringify(candidatesArr));
                            msg.candidates = encrypted;
                            msg.vector = vector;
                        } catch (e) {
                            // Fall back to plaintext if encryption fails
                            msg.candidates = candidatesArr;
                        }
                    } else {
                        msg.candidates = candidatesArr;
                    }
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
                if (this._getEffectivePassword() !== null) {
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

            // Emit peerDisconnected for this connection
            try {
                this._emit('peerDisconnected', {
                    uuid: connection.uuid,
                    type: connection.type,
                    streamID: connection.streamID
                });
            } catch (e) {}

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
                await this._handleListing(msg);
            } else if (msg.request === "videoaddedtoroom") {
                await this._handleVideoAddedToRoom(msg);
            } else if (msg.request === "someonejoined") {
                await this._handleSomeoneJoined(msg);
            } else if (msg.request === "error") {
                this._handleError(msg);
            } else if (msg.request === "alert") {
                this._handleAlert(msg);
            } else if (msg.request === "transferred") {
                await this._handleTransferred(msg);
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
            if (this._getEffectivePassword() !== null && msg.vector && typeof msg.description === 'string') {
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

            if (msg.streamID !== undefined) {
                await this._ensurePasswordHash();
            }

            // Normalize streamID to original (strip hash suffix if present), if provided
            const cleanStreamID = (msg.streamID !== undefined) ? this._stripHashFromStreamID(msg.streamID) : undefined;

            // Reuse existing viewer connection when renegotiating; create only if needed
            const existingConnections = this.connections.get(msg.UUID);
            let connection = (existingConnections && existingConnections.viewer) ? existingConnections.viewer : null;

            if (connection && connection.session && msg.session && connection.session !== msg.session) {
                // Session mismatch: close and drop, then recreate
                this._log('Found existing connection with different session:', connection.session, 'vs', msg.session);
                this._log('Closing old connection due to session mismatch');
                try { connection.pc && connection.pc.close(); } catch (e) {}
                if (existingConnections) delete existingConnections.viewer;
                connection = null;
            }

            if (!connection) {
                // Create new connection
                connection = await this._createConnection(msg.UUID, 'viewer');
                // Only set streamID if supplied in this offer; otherwise leave as default/previous
                if (cleanStreamID !== undefined) connection.streamID = cleanStreamID;
                connection.session = msg.session;  // Store the publisher's session

                // Attach view preferences if we initiated a view for this streamID
                const pendingView = cleanStreamID !== undefined ? this._pendingViews.get(cleanStreamID) : null;
                if (pendingView && pendingView.options) {
                    connection.viewPreferences = {
                        audio: pendingView.options.audio !== false,
                        video: pendingView.options.video !== false
                    };
                    if (pendingView.options.label) {
                        connection.viewPreferences.info = { label: pendingView.options.label };
                    }
                    connection.viewOptions = pendingView.options;
                    this._log('Attached view preferences to connection:', connection.viewPreferences);
                } else {
                    // Default to requesting both audio and video if no preferences specified
                    connection.viewPreferences = { audio: true, video: true };
                    connection.viewOptions = { audio: true, video: true };
                    this._log('No pending view found, using default preferences:', connection.viewPreferences);
                }

                this._log(`Created viewer connection for offer - UUID: ${msg.UUID}, streamID: ${connection.streamID}, session: ${msg.session}`);
            } else {
                // Existing connection: keep streamID and preferences as-is; ensure session recorded
                if (!connection.session && msg.session) connection.session = msg.session;
                if (!connection.streamID && cleanStreamID !== undefined) connection.streamID = cleanStreamID;
            }

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
                if (this._getEffectivePassword() !== null) {
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
                    if (this._getEffectivePassword() !== null) {
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
            if (this._getEffectivePassword() !== null && msg.vector && typeof msg.candidate === 'string') {
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
            if (this._getEffectivePassword() !== null && msg.vector && typeof msg.candidates === 'string') {
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
            // Propagate pending info/label into connection
            if (this._pendingLabel && typeof this._pendingLabel === 'string') {
                connection.info = connection.info || {};
                connection.info.label = this._sanitizeLabel(this._pendingLabel);
            }
            if (this._pendingInfo && typeof this._pendingInfo === 'object') {
                connection.info = Object.assign(connection.info || {}, this._pendingInfo);
            }
            connection.streamID = this.state.streamID;

            // Store track preferences from viewer
            if (msg.audio !== undefined || msg.video !== undefined) {
                connection.allowAudio = msg.audio !== false;
                connection.allowVideo = msg.video !== false;
            }

            // Create offer and send it
            try {
                const offer = await this._createOffer(connection);

                // Compute streamID to send (append hash suffix if encryption is enabled)
                let streamIDToSend = this.state.streamID;
                {
                    const __effectivePassword = this._getEffectivePassword();
                    if (__effectivePassword !== null) {
                        // Ensure password hash exists
                        if (!this._passwordHash) {
                            this._passwordHash = await this._generateHash(__effectivePassword + this.salt, 6);
                        }
                        streamIDToSend = this.state.streamID + this._passwordHash;
                    }
                }

                const offerMsg = {
                    UUID: this.state.uuid,
                    session: msg.session || connection.uuid,
                    streamID: streamIDToSend
                };

                // Store session IDs
                if (msg.session) {
                    this._sessionIDs[msg.UUID] = msg.session;
                    this._remoteSessionIDs[msg.UUID] = msg.session;
                }

                // Encrypt description if password is set
                if (this._getEffectivePassword() !== null) {
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

            await this._ensurePasswordHash();

            // Normalize requested streamID (strip hash suffix if present)
            const requestedStream = this._stripHashFromStreamID(msg.streamID);

            if (!this.state.publishing || this.state.streamID !== requestedStream) {
                this._log('Not publishing this stream');
                return;
            }

            // Create connection for the viewer
            const connection = await this._createConnection(msg.UUID, 'publisher');
            if (this._pendingLabel && typeof this._pendingLabel === 'string') {
                connection.info = connection.info || {};
                connection.info.label = this._sanitizeLabel(this._pendingLabel);
            }
            if (this._pendingInfo && typeof this._pendingInfo === 'object') {
                connection.info = Object.assign(connection.info || {}, this._pendingInfo);
            }
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

                // Compute streamID to send (append hash suffix if encryption is enabled)
                let streamIDToSend2 = this.state.streamID;
                {
                    const __effectivePassword = this._getEffectivePassword();
                    if (__effectivePassword !== null) {
                        if (!this._passwordHash) {
                            this._passwordHash = await this._generateHash(__effectivePassword + this.salt, 6);
                        }
                        streamIDToSend2 = this.state.streamID + this._passwordHash;
                    }
                }

                const offerMsg = {
                    UUID: msg.UUID,  // Target UUID for routing
                    session: connection.session,  // Use the connection's session
                    streamID: streamIDToSend2
                };

                // Encrypt description if password is set
                if (this._getEffectivePassword() !== null) {
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
         * Ensure cached password hash is ready before stripping hashed stream IDs
         * @private
         * @returns {Promise<void>}
         */
        async _ensurePasswordHash() {
            if (this.password === false || this.password === null) {
                this._passwordHash = null;
                this._passwordHashKey = null;
                this._passwordHashPromise = null;
                this._passwordHashPromiseKey = null;
                return;
            }

            const effectivePassword = this._getEffectivePassword();
            if (effectivePassword === null) {
                this._passwordHash = null;
                this._passwordHashKey = null;
                this._passwordHashPromise = null;
                this._passwordHashPromiseKey = null;
                return;
            }

            const saltForHash = this.salt;
            const hashKey = `${effectivePassword}:${saltForHash}`;

            if (this._passwordHashKey && this._passwordHashKey !== hashKey) {
                this._passwordHash = null;
                this._passwordHashKey = null;
            }

            if (this._passwordHash && this._passwordHashKey === hashKey && typeof this._passwordHash === 'string' && this._passwordHash.length > 0) {
                return;
            }

            if (this._passwordHashPromise) {
                try {
                    await this._passwordHashPromise;
                } catch (error) {
                    this._log('Failed to ensure password hash:', error);
                }
                if (this._passwordHash && this._passwordHashKey === hashKey && typeof this._passwordHash === 'string' && this._passwordHash.length > 0) {
                    return;
                }
            }

            const passwordForHash = effectivePassword;

            const promise = this._generateHash(passwordForHash + saltForHash, 6);

            this._passwordHashPromise = promise;
            this._passwordHashPromiseKey = hashKey;

            try {
                const hash = await promise;
                if (this._passwordHashPromise === promise && this._passwordHashPromiseKey === hashKey) {
                    this._passwordHash = hash;
                    this._passwordHashKey = hashKey;
                }
            } catch (error) {
                this._log('Failed to precompute password hash:', error);
            } finally {
                if (this._passwordHashPromise === promise) {
                    this._passwordHashPromise = null;
                    this._passwordHashPromiseKey = null;
                }
            }
        }

        /**
         * Strip hash suffix from stream ID
         * @private
         * @param {string} streamID - Stream ID potentially with hash suffix
         * @returns {string} Clean stream ID without hash
         */
        _stripHashFromStreamID(streamID) {
            if (!streamID || typeof streamID !== 'string') {
                return streamID;
            }

            // Only strip when we have a cached password hash to compare against
            if (!this._passwordHash || typeof this._passwordHash !== 'string') {
                return streamID;
            }

            const suffixLength = this._passwordHash.length;
            if (suffixLength === 0 || streamID.length <= suffixLength) {
                return streamID;
            }

            const possibleHash = streamID.slice(-suffixLength);
            if (possibleHash === this._passwordHash) {
                return streamID.slice(0, -suffixLength);
            }

            return streamID;
        }

        /**
         * Handle listing message
         * @private
         * @param {Object} msg - Listing message
         */
        async _handleListing(msg) {
            this._log('Processing listing');

            await this._ensurePasswordHash();

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
                
                // Update stream tracking
                const now = Date.now();
                cleanList.forEach(item => {
                    const streamID = typeof item === 'string' ? item : item.streamID;
                    if (streamID) {
                        const existing = this.streams.get(streamID);
                        this.streams.set(streamID, {
                            firstSeen: existing?.firstSeen || now,
                            lastSeen: now,
                            uuid: item.UUID || item.uuid || existing?.uuid || null,
                            state: 'available'
                        });
                    }
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
        async _handleVideoAddedToRoom(msg) {
            await this._ensurePasswordHash();

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
            
            // Update stream tracking
            if (cleanStreamID && this.streams) {
                const now = Date.now();
                const existing = this.streams.get(cleanStreamID);
                this.streams.set(cleanStreamID, {
                    firstSeen: existing?.firstSeen || now,
                    lastSeen: now,
                    uuid: msg.UUID || msg.uuid || existing?.uuid || null,
                    state: existing?.state || 'available'
                });
            }
        }

        /**
         * Handle someone joined
         * @private
         * @param {Object} msg - User joined message
         */
        async _handleSomeoneJoined(msg) {
            await this._ensurePasswordHash();

            const cleanStreamID = msg.streamID ? this._stripHashFromStreamID(msg.streamID) : null;
            this._log('Someone joined:', cleanStreamID || msg.UUID);

            // Also emit as videoaddedtoroom for compatibility
            this._emit('videoaddedtoroom', {
                streamID: cleanStreamID,
                uuid: msg.UUID || msg.uuid,
                raw: msg
            });

            this._emit('userJoined', msg);
            // Backward-compatibility alias for common handler name typo
            this._emit('someoneJoined', msg);
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
        async _handleTransferred(msg) {
            this._log('Transferred to new room');
            // Similar to listing, but indicates we were moved
            this._emit('transferred', {
                list: msg.list,
                director: msg.director,
                raw: msg
            });
            // Also emit as listing for compatibility
            await this._handleListing(msg);
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
            if (this._pendingLabel && typeof this._pendingLabel === 'string') {
                connection.info = connection.info || {};
                connection.info.label = this._sanitizeLabel(this._pendingLabel);
            }
            if (this._pendingInfo && typeof this._pendingInfo === 'object') {
                connection.info = Object.assign(connection.info || {}, this._pendingInfo);
            }
            connection.streamID = this.state.streamID;
            
            // Generate a new session for this connection (publisher creates session)
            connection.session = this._generateSession();

            // Create and send offer
            try {
                const offer = await this._createOffer(connection);

                // Compute streamID to send (append hash suffix if encryption is enabled)
                let streamIDToSend3 = this.state.streamID;
                {
                    const __effectivePassword = this._getEffectivePassword();
                    if (__effectivePassword !== null) {
                        if (!this._passwordHash) {
                            this._passwordHash = await this._generateHash(__effectivePassword + this.salt, 6);
                        }
                        streamIDToSend3 = this.state.streamID + this._passwordHash;
                    }
                }

                const offerMsg = {
                    UUID: msg.UUID,  // Target UUID for routing
                    session: connection.session,  // Use the connection's session
                    streamID: streamIDToSend3
                };

                // Encrypt description if password is set
                if (this._getEffectivePassword() !== null) {
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
            // Also emit peerDisconnected for convenience
            try {
                this._emit('peerDisconnected', {
                    uuid: msg.UUID
                });
            } catch (e) {}
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
            // Also emit peerDisconnected for convenience
            try {
                this._emit('peerDisconnected', {
                    uuid: msg.UUID
                });
            } catch (e) {}
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
            
            // If this is a pub/sub subscription update, mirror DC handling to emit peer events
            try {
                if (cleanMsg && cleanMsg.pipe && typeof cleanMsg.pipe === 'object') {
                    const t = cleanMsg.pipe.type;
                    if (t === 'subscribe' || t === 'unsubscribe') {
                        this._handleDataChannelMessage(cleanMsg.pipe, msg.UUID);
                    }
                }
            } catch (e) {}
            
            // Emit the same events as regular data channel messages
            this._emit('dataReceived', {
                data: cleanMsg.pipe,
                uuid: msg.UUID,
                fallback: true
            });
            // Typo compatibility
            this._emit('dataRecieved', {
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
            try {
                // Prefer cryptographically strong randomness when available
                if (typeof crypto !== 'undefined') {
                    if (typeof crypto.randomUUID === 'function') {
                        // Use UUID v4 and trim; ensures good entropy and distribution
                        return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
                    }
                    if (typeof crypto.getRandomValues === 'function') {
                        const bytes = new Uint8Array(9); // 9 bytes ~ 12 base36 chars
                        crypto.getRandomValues(bytes);
                        let out = '';
                        for (let i = 0; i < bytes.length; i++) {
                            // Map byte to base36 (0-9a-z) using lower 5 bits to reduce bias
                            out += (bytes[i] & 31).toString(36);
                        }
                        return out;
                    }
                }
            } catch (e) { /* fall back below */ }
            // Fallback
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
            
            // Only set salt based on environment if not explicitly provided via options
            if (!this._saltProvidedViaOptions && typeof window !== 'undefined' && window.location) {
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
            } else if (!this._saltProvidedViaOptions) {
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
            // Determine effective password unless a custom phrase is provided
            if (!phrase) {
                const pass = this._getEffectivePassword();
                if (pass === null) {
                    throw new Error('Password not set for encryption');
                }
                phrase = pass + this.salt;
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
            // Determine effective password unless a custom phrase is provided
            if (!phrase) {
                const pass = this._getEffectivePassword();
                if (pass === null) {
                    throw new Error('Password not set for decryption');
                }
                phrase = pass + this.salt;
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
            const pass = this._getEffectivePassword();
            if (pass === null) return this.state.room;
            return await this._hashRoom(this.state.room, pass);
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

            if (track.kind === 'video') {
                this._monitorOutboundVideoTrack(track);
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
                        await this._applyEncodingPreferencesToConnection(connection);
                        
                        // Renegotiate connection
                        const offer = await connection.pc.createOffer();
                        await connection.pc.setLocalDescription(offer);
                        
                        const offerMsg = {
                            UUID: connection.uuid,
                            session: connection.session
                        };
                        
                        // Encrypt if needed
                        if (this._getEffectivePassword() !== null) {
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

            if (track.kind === 'video') {
                this._unmonitorOutboundVideoTrack(track, { forceMuted: true });
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
                            if (this._getEffectivePassword() !== null) {
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

            if (oldTrack.kind === 'video') {
                this._unmonitorOutboundVideoTrack(oldTrack, { skipSend: true });
            }

            // Update local stream
            if (this.localStream) {
                this.localStream.removeTrack(oldTrack);
                this.localStream.addTrack(newTrack);
            }

            if (newTrack.kind === 'video') {
                this._monitorOutboundVideoTrack(newTrack);
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
                            await this._applyEncodingPreferencesToConnection(connection);
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
         * Update media encoding preferences for the active publisher.
         * Accepts the same structure as publish() media options.
         * @param {Object} options - Media configuration overrides
         * @returns {Promise<Object|null>} Applied configuration
         */
        async updatePublisherMedia(options = {}) {
            if (options === null || options === undefined) {
                return this._publishMediaConfig;
            }

            const shouldClear = options.clear === true || options.reset === true || options.media === null;
            if (shouldClear) {
                this._publishMediaConfig = null;

                if (this.state && this.state.publishing && this.connections && typeof this.connections.values === 'function') {
                    const tasks = [];
                    for (const connectionGroup of this.connections.values()) {
                        if (connectionGroup && connectionGroup.publisher) {
                            tasks.push(this._resetEncodingPreferencesForConnection(connectionGroup.publisher));
                        }
                    }
                    if (tasks.length > 0) {
                        await Promise.all(
                            tasks.map(task => task.catch(error => this._log('Failed to reset encoding preferences:', error)))
                        );
                    }
                }

                return null;
            }

            const newConfig = await this._extractPublisherMediaOptions(options);
            if (!newConfig) {
                return this._publishMediaConfig;
            }

            this._publishMediaConfig = this._mergeMediaConfigs(this._publishMediaConfig, newConfig);

            if (this.localStream) {
                await this._applyLocalMediaPreferences(this.localStream, this._publishMediaConfig);
            }

            if (this.state && this.state.publishing && this.connections && typeof this.connections.values === 'function') {
                const tasks = [];
                for (const connectionGroup of this.connections.values()) {
                    if (connectionGroup && connectionGroup.publisher) {
                        tasks.push(this._applyEncodingPreferencesToConnection(connectionGroup.publisher));
                    }
                }
                if (tasks.length > 0) {
                    await Promise.all(
                        tasks.map(task => task.catch(error => this._log('Failed to update encoding preferences:', error)))
                    );
                }
            }

            return this._publishMediaConfig;
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
        _sendDataInternal(data, uuid = null, type = null, preference = 'any', allowFallback = false) {
            let sent = false;
            const message = typeof data === 'string' ? data : JSON.stringify(data);

            const sentConnections = new Set(); // Track which connections we've sent to

            if (uuid && !type) {
                // When UUID is specified but no type, use preference to determine order
                const connections = this.connections.get(uuid);
                if (connections) {
                    const tryConnection = (connType) => {
                        const conn = connections[connType];
                        if (conn && conn.dataChannel && 
                            conn.dataChannel.readyState === 'open' &&
                            !sentConnections.has(conn)) {
                            try {
                                this._logMessage('OUT', data, 'DataChannel');
                                conn.dataChannel.send(message);
                                sentConnections.add(conn);
                                sent = true;
                                this._log(`Sent to ${uuid} via ${connType} connection`);
                                return true;
                            } catch (error) {
                                this._log(`Error sending via ${connType} connection:`, error);
                            }
                        }
                        return false;
                    };

                    if (preference === 'publisher') {
                        // ONLY use publisher channel, no fallback
                        tryConnection('publisher');
                    } else if (preference === 'viewer') {
                        // ONLY use viewer channel, no fallback
                        tryConnection('viewer');
                    } else if (preference === 'any') {
                        // Default: Try publisher first, then viewer if needed
                        if (!tryConnection('publisher')) {
                            tryConnection('viewer');
                        }
                    } else if (preference === 'all') {
                        // Send to both connections if they exist
                        tryConnection('publisher');
                        tryConnection('viewer');
                    }
                }
            } else {
                // Get connections based on filters
                const connections = this._getConnections({ uuid, type });
                
                if (preference === 'all') {
                    // Send to all matching connections
                    for (const connection of connections) {
                        if (connection && connection.dataChannel && 
                            connection.dataChannel.readyState === 'open' &&
                            !sentConnections.has(connection)) {
                            try {
                                this._logMessage('OUT', data, 'DataChannel');
                                connection.dataChannel.send(message);
                                sentConnections.add(connection);
                                sent = true;
                            } catch (error) {
                                this._log('Error sending data:', error);
                            }
                        }
                    }
                } else {
                    // Group connections by UUID to avoid duplicates
                    const connectionsByUuid = new Map();
                    for (const conn of connections) {
                        if (!connectionsByUuid.has(conn.uuid)) {
                            connectionsByUuid.set(conn.uuid, {});
                        }
                        connectionsByUuid.get(conn.uuid)[conn.type] = conn;
                    }

                    // Send to each UUID using preference
                    for (const [connUuid, conns] of connectionsByUuid) {
                        const tryConnection = (connType) => {
                            const conn = conns[connType];
                            if (conn && conn.dataChannel && 
                                conn.dataChannel.readyState === 'open' &&
                                !sentConnections.has(conn)) {
                                try {
                                    this._logMessage('OUT', data, 'DataChannel');
                                    conn.dataChannel.send(message);
                                    sentConnections.add(conn);
                                    sent = true;
                                    return true;
                                } catch (error) {
                                    this._log('Error sending data:', error);
                                }
                            }
                            return false;
                        };

                        if (preference === 'publisher') {
                            // ONLY use publisher channel
                            tryConnection('publisher');
                        } else if (preference === 'viewer') {
                            // ONLY use viewer channel
                            tryConnection('viewer');
                        } else if (preference === 'any' || !preference) {
                            // Default: Try publisher first, then viewer if needed
                            if (!tryConnection('publisher')) {
                                tryConnection('viewer');
                            }
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
         * - sendData(data) // Send to all via publisher connections (no duplicates)
         * - sendData(data, "uuid123") // Send to specific peer (publisher channel preferred)
         * - sendData(data, { preference: 'all' }) // Send via ALL connections (may duplicate)
         * - sendData(data, { uuid: "uuid123", preference: 'viewer' }) // Use viewer channel
         * - sendData(data, { type: 'publisher' }) // Send to all publisher connections
         * - sendData(data, { uuid: "uuid123", allowFallback: false }) // No WebSocket fallback
         */
        sendData(data, target = null) {
            const msg = { pipe: data };
            let allowFallback = false;  // Default to false for true P2P
            // Default to any-channel; SDK will try publisher first, then viewer.
            let preference = 'any';

            // Guidance if sending before DC is ready
            const anyOpenDC = (() => {
                for (const [, conns] of this.connections || []) {
                    for (const t of ['viewer', 'publisher']) {
                        if (conns[t] && conns[t].dataChannel && conns[t].dataChannel.readyState === 'open') return true;
                    }
                }
                return false;
            })();
            if (!this.state || !this.state.connected) {
                console.warn('[VDONinja SDK] sendData() called while not connected. Call connect() first.');
                this._emit('error', { error: 'sendData() called while not connected. Call connect() before sending data.' });
            } else if (!anyOpenDC && !(target && target.allowFallback)) {
                console.warn('[VDONinja SDK] No open data channels yet. Wait for "dataChannelOpen" before sendData(), or pass { allowFallback: true } to use WebSocket fallback.');
                this._emit('alert', { message: 'No open data channels yet. Wait for dataChannelOpen or set allowFallback: true.' });
            }

            // Handle different parameter formats
            if (typeof target === 'string') {
                // Simple UUID string - use default preference
                return this._sendDataInternal(msg, target, null, preference, allowFallback);
            } else if (typeof target === 'object' && target !== null) {
                const t = { ...target };

                // Normalize common variants/mistakes
                if (t.UUID && !t.uuid) t.uuid = t.UUID;
                if (t.channel && !t.preference) t.preference = t.channel; // alias
                if (t.prefer && !t.preference) t.preference = t.prefer;
                if (t.type === 'pcs') t.type = 'publisher';
                if (t.type === 'rpcs') t.type = 'viewer';
                if ((t.type === 'any' || t.type === 'all') && !t.uuid && !t.streamID) {
                    // Users sometimes put route into type; treat as preference
                    if (!t.preference) t.preference = t.type;
                    delete t.type;
                }
                if (t.preference === 'pcs') t.preference = 'publisher';
                if (t.preference === 'rpcs') t.preference = 'viewer';

                if (Object.prototype.hasOwnProperty.call(t, 'allowFallback')) {
                    allowFallback = t.allowFallback;
                }
                if (Object.prototype.hasOwnProperty.call(t, 'preference')) {
                    preference = t.preference;
                }

                // Options object
                if (t.uuid && !t.type && !t.streamID) {
                    // Simple UUID case
                    return this._sendDataInternal(msg, t.uuid, null, preference, allowFallback);
                } else if (t.uuid || t.type || t.streamID) {
                    // Complex filtering - need to handle streamID case
                    if (t.streamID && !t.uuid) {
                        // Get all connections for this streamID and send using preference
                        const connections = this._getConnections({ streamID: t.streamID, type: t.type });

                        // Group by UUID to handle preference correctly
                        const connectionsByUuid = new Map();
                        for (const conn of connections) {
                            if (!connectionsByUuid.has(conn.uuid)) {
                                connectionsByUuid.set(conn.uuid, []);
                            }
                            connectionsByUuid.get(conn.uuid).push(conn);
                        }

                        let sent = false;
                        for (const [uuid] of connectionsByUuid) {
                            // For each UUID, send according to preference
                            if (this._sendDataInternal(msg, uuid, null, preference, allowFallback)) {
                                sent = true;
                            }
                        }

                        return sent;
                    } else {
                        // UUID with optional type (type must be 'viewer' or 'publisher')
                        const normalizedType = (t.type === 'viewer' || t.type === 'publisher') ? t.type : null;
                        return this._sendDataInternal(msg, t.uuid, normalizedType, preference, allowFallback);
                    }
                }
            }

            // Default: send to all with preference
            return this._sendDataInternal(msg, null, null, preference, allowFallback);
        }
        
        /**
         * Send a ping to measure latency (manual)
         * By convention, viewers ping publishers; publishers reply with pong.
         * This helper sends a ping on the data channel; use from the appropriate side.
         * @param {string} uuid - Target UUID (optional, null = all peers by preference)
         * @returns {boolean} True if ping was sent
         * Note: Never uses WebSocket fallback.
         */
        sendPing(uuid = null) {
            const timestamp = Date.now();
            
            // If targeting specific viewer, update their pending ping
            if (uuid) {
                const connections = this.connections.get(uuid);
                if (connections && connections.publisher) connections.publisher.pendingPing = timestamp;
                if (connections && connections.viewer) connections.viewer.pendingPing = timestamp;
            } else {
                // Update all publisher connections
                for (const [connUuid, connections] of this.connections) {
                    if (connections.publisher) connections.publisher.pendingPing = timestamp;
                    if (connections.viewer) connections.viewer.pendingPing = timestamp;
                }
            }
            
            // IMPORTANT: Never use fallback for ping/pong
            // The whole point is to test the WebRTC connection
            return this._sendDataInternal({ ping: timestamp }, uuid, null, 'any', false);
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
         * Get current subscriptions for a connected peer by UUID
         * @param {string} uuid - Peer UUID
         * @returns {Array<string>} List of channels the peer is subscribed to (empty if none/unknown)
         */
        getPeerSubscriptions(uuid) {
            if (!uuid || !this._peerSubscriptions) return [];
            const set = this._peerSubscriptions.get(uuid);
            return set ? Array.from(set) : [];
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
                
                const list = Array.isArray(data.channels)
                    ? data.channels
                    : (data.channels != null ? [data.channels] : []);
                if (data.type === 'subscribe') {
                    const peerSubs = this._peerSubscriptions.get(uuid) || new Set();
                    list.forEach(ch => peerSubs.add(ch));
                    this._peerSubscriptions.set(uuid, peerSubs);
                    // Emit non-breaking peer subscription event
                    try {
                        this._emit('peerSubscribed', {
                            uuid,
                            channels: list.slice(),
                            allChannels: Array.from(peerSubs)
                        });
                    } catch (e) {}
                } else {
                    const peerSubs = this._peerSubscriptions.get(uuid) || new Set();
                    list.forEach(ch => peerSubs.delete(ch));
                    this._peerSubscriptions.set(uuid, peerSubs);
                    // Emit non-breaking peer unsubscription event
                    try {
                        this._emit('peerUnsubscribed', {
                            uuid,
                            channels: list.slice(),
                            allChannels: Array.from(peerSubs)
                        });
                    } catch (e) {}
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
            // Typo compatibility
            this._emit('dataRecieved', { data, uuid });
        }

        /**
         * Start automated ping monitoring for a connection
         * @private
         * @param {Object} connection - Connection to monitor
         */
        _startPingMonitoring(connection) {
            // Only auto-ping from viewer connections when enabled
            if (!this.autoPingViewer) return;
            if (!connection || connection.type !== 'viewer') return;

            // Clear any existing timer
            if (connection.pingTimer) {
                clearInterval(connection.pingTimer);
            }

            connection.pingTimer = setInterval(() => {
                // Only if data channel is open
                if (!connection.dataChannel || connection.dataChannel.readyState !== 'open') return;

                const now = Date.now();

                // If we have an unanswered ping for too long, count as missed and maybe restart ICE
                if (connection.pendingPing) {
                    const elapsed = now - connection.pendingPing;
                    const timeoutMs = Math.max(this.autoPingInterval * 1.5, this.autoPingInterval + 5000);
                    if (elapsed >= timeoutMs) {
                        connection.missedPings = (connection.missedPings || 0) + 1;
                        this._log(`Viewer auto-ping missed #${connection.missedPings} for ${connection.uuid}`);

                        if (connection.missedPings >= 2) {
                            this._log(`Viewer initiating ICE restart after ${connection.missedPings} missed pings for ${connection.uuid}`);
                            this._initiateICERestart(connection);
                            // Reset counters so we don't thrash
                            connection.missedPings = 0;
                            connection.pendingPing = null;
                            return;
                        }
                        // Clear pendingPing to allow a new ping to be sent on next tick
                        connection.pendingPing = null;
                    } else {
                        // Still waiting for pong
                        return;
                    }
                }

                // No pending ping; send a new one
                this.sendPing(connection.uuid);
            }, Math.max(1000, this.autoPingInterval));
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
                
                // Compute streamID to send for ICE restart via WebSocket
                let streamIDToSend = connection.streamID;
                {
                    const __effectivePassword = this._getEffectivePassword();
                    if (__effectivePassword !== null) {
                        if (!this._passwordHash) {
                            this._passwordHash = await this._generateHash(__effectivePassword + this.salt, 6);
                        }
                        streamIDToSend = connection.streamID + this._passwordHash;
                    }
                }

                const offerMsg = {
                    UUID: connection.uuid,
                    session: connection.session,
                    streamID: streamIDToSend
                };
                
                // Send the new offer
                if (this._getEffectivePassword() !== null) {
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
            // Support legacy dataOnly: true (maps to audio:false, video:false)
            const audio = options && options.dataOnly === true ? false : options.audio;
            const video = options && options.dataOnly === true ? false : options.video;
            return await this.view(options.streamID, {
                audio,
                video,
                label: options.label
            });
        }

        /**
         * Auto-connect mesh helper
         * - Connects, joins a room, announces a streamID, and views peers in the room.
         * - mode 'half' (default): single data channel per pair (best for data-only). Views only a deterministic subset to avoid dual connections.
         * - mode 'full': dual connections per pair (needed for audio/video exchange).
         * 
         * Usage:
         *   sdk.autoConnect('roomName')
         *   sdk.autoConnect({ room: 'roomName', mode: 'full', streamID: 'me', view: { audio:true, video:true } })
         *   const ctl = sdk.autoConnect(room, (item) => item.label === 'chat'); // returns controller with stop()
         * 
         * @param {string|Object} roomOrOptions - Room name or options object
         * @param {Function|RegExp|string|Object} [maybeFilter] - Optional filter when using shorthand
         * @returns {Promise<{ stop: Function, streamID: string }>} Controller
         */
        async autoConnect(roomOrOptions, maybeFilter) {
            const defaults = {
                mode: 'half', // 'half' | 'full'
                view: undefined, // e.g., { audio:false, video:false }
                label: undefined,
                password: undefined,
                streamID: undefined,
                filter: undefined
            };
            let options;
            if (typeof roomOrOptions === 'string') {
                options = { ...defaults, room: roomOrOptions, filter: maybeFilter };
            } else {
                options = { ...defaults, ...(roomOrOptions || {}) };
            }

            if (!options || !options.room) {
                throw new Error('autoConnect: room is required');
            }

            // Resolve view defaults based on mode if not provided
            const viewDefaults = options.mode === 'full' ? { audio: true, video: true } : { audio: false, video: false };
            const viewOptions = options.view ? { ...viewDefaults, ...options.view } : viewDefaults;

            // Track streams we have already viewed to avoid duplicates
            const viewed = new Set();
            const connecting = new Set();

            // Declare myStreamID upfront to avoid TDZ in event handlers
            let myStreamID = null;

            // Build filter function
            const normalizeItem = (item) => {
                if (typeof item === 'string') return { streamID: item };
                return { streamID: item?.streamID, uuid: item?.UUID || item?.uuid, label: item?.label };
            };
            const userFilter = options.filter;
            const applyFilter = (item) => {
                const norm = normalizeItem(item);
                if (!norm.streamID) return false;
                if (norm.streamID === myStreamID) return false;

                // User-provided filter
                if (typeof userFilter === 'function') {
                    try { if (!userFilter(norm)) return false; } catch (e) { /* ignore */ }
                } else if (userFilter instanceof RegExp) {
                    if (!userFilter.test(norm.streamID)) return false;
                } else if (typeof userFilter === 'string') {
                    if (norm.streamID !== userFilter) return false;
                } else if (userFilter && typeof userFilter === 'object') {
                    if (Array.isArray(userFilter.include) && !userFilter.include.includes(norm.streamID)) return false;
                    if (Array.isArray(userFilter.exclude) && userFilter.exclude.includes(norm.streamID)) return false;
                    if (userFilter.prefix && typeof userFilter.prefix === 'string' && !norm.streamID.startsWith(userFilter.prefix)) return false;
                }

                // Mode-based deterministic selection to avoid dual connections in 'half'
                if (options.mode === 'half') {
                    // Connect only if remote streamID is lexicographically less than ours
                    // Ensures exactly one DC per pair across the mesh
                    if (!(norm.streamID < myStreamID)) return false;
                }
                return true;
            };

            const tryView = async (sid) => {
                if (!sid || viewed.has(sid) || connecting.has(sid)) return;
                viewed.add(sid); // optimistic to prevent duplicate calls
                connecting.add(sid);
                try {
                    await this.quickView({ streamID: sid, audio: viewOptions.audio, video: viewOptions.video, label: viewOptions.label });
                } catch (e) {
                    // If it fails immediately, allow a future retry on event triggers
                    viewed.delete(sid);
                } finally {
                    connecting.delete(sid);
                }
            };

            const handleListing = async (event) => {
                if (typeof myStreamID !== 'string') return; // Wait until after we announce
                const list = event?.detail?.list;
                if (Array.isArray(list)) {
                    for (const item of list) {
                        if (applyFilter(item)) await tryView(typeof item === 'string' ? item : item.streamID);
                    }
                } else if (event?.detail?.streamID) {
                    // Per-item listing form
                    const sid = event.detail.streamID;
                    if (applyFilter({ streamID: sid, uuid: event.detail.uuid, label: event.detail.label })) await tryView(sid);
                }
            };

            const handleNew = async (event) => {
                if (typeof myStreamID !== 'string') return;
                const sid = event?.detail?.streamID;
                if (applyFilter({ streamID: sid })) await tryView(sid);
            };

            // Wire listeners BEFORE joining/announcing to not miss initial listing/events
            this.addEventListener('listing', handleListing);
            this.addEventListener('videoaddedtoroom', handleNew);

            // Connect and join
            if (!this.state.connected) {
                await this.connect();
            }
            if (!this.state.roomJoined || this.state.room !== options.room) {
                await this.joinRoom({ room: options.room, password: options.password });
            }

            // Announce our presence (data-only by default); returns our final plaintext streamID
            myStreamID = await this.announce({ streamID: options.streamID, label: options.label });

            // After announcing, proactively process any already-known streams
            try {
                if (this.streams && this.streams.size > 0) {
                    for (const [sid, data] of this.streams) {
                        if (applyFilter({ streamID: sid, uuid: data?.uuid })) await tryView(sid);
                    }
                }
            } catch (e) { /* ignore */ }

            // Return controller to stop auto-connect
            const stop = () => {
                this.removeEventListener('listing', handleListing);
                this.removeEventListener('videoaddedtoroom', handleNew);
            };

            return { stop, streamID: myStreamID };
        }

        // ============================================================================
        // METHOD ALIASES - For AI/LLM compatibility and common naming patterns
        // ============================================================================
        
        /**
         * Aliases for common method names that AI systems might hallucinate or expect
         * These provide alternative names for the same functionality
         */
        
        // Viewing/Playing aliases
        play(streamID, options) { return this.view(streamID, options); }
        watch(streamID, options) { return this.view(streamID, options); }
        startViewing(streamID, options) { return this.view(streamID, options); }
        
        // Publishing/Streaming aliases  
        stream(mediaStream, options) { return this.publish(mediaStream, options); }
        broadcast(mediaStream, options) { return this.publish(mediaStream, options); }
        startPublishing(mediaStream, options) { return this.publish(mediaStream, options); }
        share(mediaStream, options) { return this.publish(mediaStream, options); }
        
        // Stop viewing aliases
        stop(streamID) { return this.stopViewing(streamID); }
        stopPlaying(streamID) { return this.stopViewing(streamID); }
        stopWatching(streamID) { return this.stopViewing(streamID); }
        
        // Stop publishing aliases
        stopStreaming() { return this.stopPublishing(); }
        stopBroadcasting() { return this.stopPublishing(); }
        stopSharing() { return this.stopPublishing(); }
        unpublish() { return this.stopPublishing(); }
        
        // Connection aliases
        join(options) { return this.joinRoom(options); }
        enterRoom(options) { return this.joinRoom(options); }
        enter(options) { return this.joinRoom(options); }
        
        leave() { return this.leaveRoom(); }
        exitRoom() { return this.leaveRoom(); }
        exit() { return this.leaveRoom(); }
        
        // Data sending aliases
        send(data, target) { return this.sendData(data, target); }
        sendMessage(data, target) { return this.sendData(data, target); }
        emit(data, target) { return this.sendData(data, target); }
        broadcast(data, target) { 
            // Special case: if first arg is MediaStream, use publish
            if (data instanceof MediaStream) {
                return this.publish(data, target);
            }
            return this.sendData(data, target); 
        }
        
        // Quick method aliases
        quickPlay(options) { return this.quickView(options); }
        quickWatch(options) { return this.quickView(options); }
        // Quick subscribe helper: defaults to dataOnly unless explicitly overridden
        quickSubscribe(options = {}) {
            const opts = { ...options };
            if (!('dataOnly' in opts) && !('audio' in opts) && !('video' in opts)) {
                opts.dataOnly = true;
            }
            return this.quickView(opts);
        }
        
        quickStream(options) { return this.quickPublish(options); }
        quickBroadcast(options) { return this.quickPublish(options); }
        quickShare(options) { return this.quickPublish(options); }
    }

    // ============================================================================
    // EXPORT
    // ============================================================================

    // Export for different environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = VDONinjaSDK;
        module.exports.VDONinja = VDONinjaSDK; // Also expose as VDONinja
    } else if (typeof define === 'function' && define.amd) {
        define([], function() {
            return VDONinjaSDK;
        });
    } else {
        // Browser global - expose as both VDONinjaSDK and VDONinja
        global.VDONinjaSDK = VDONinjaSDK;
        global.VDONinja = VDONinjaSDK;
    }

})(typeof window !== 'undefined' ? window : global);
