// state-manager.js
class StateManager {
    constructor() {
        this.state = {
            sources: new Map(), // Map of sourceId -> source state
            groups: new Map(),  // Map of groupId -> group state
            global: {
                betaMode: false,
                youtubeAutoAdd: false,
                youtubeAutoCleanup: false,
                youtubeCheckInterval: 300000,
                currentPage: 'streams'
            }
        };
        
        this.listeners = new Map(); // event -> Set of callbacks
        this.initialized = false;
        this.persistenceKey = 'socialStreamState';
    }

    // Helper to check if platform supports WebSockets
    checkWebSocketSupport(target) {
        if (!target) return false;
        
        // TikTok has special built-in websocket support in the electron layer
        if (target === 'tiktok') {
            return true;
        }
        
        // Check if a websocket file exists in the manifest
        if (typeof manifest !== 'undefined' && manifest?.content_scripts) {
            return manifest.content_scripts.some(cs => 
                cs.js?.some(jsFile => jsFile.includes(`websocket/${target}.js`))
            );
        }
        
        return false;
    }

    // Initialize state from localStorage
    async init() {
        if (this.initialized) return;
        
        try {
            const saved = localStorage.getItem(this.persistenceKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Convert arrays back to Maps
                if (parsed.sources) {
                    this.state.sources = new Map(parsed.sources);
                    // Add supportsWSS to existing sources if missing
                    this.state.sources.forEach((source, id) => {
                        if (source.supportsWSS === undefined) {
                            source.supportsWSS = this.checkWebSocketSupport(source.target);
                        }
                    });
                }
                if (parsed.groups) {
                    this.state.groups = new Map(parsed.groups);
                }
                if (parsed.global) {
                    this.state.global = { ...this.state.global, ...parsed.global };
                }
            }
            
            // Also migrate old settings format if exists
            this.migrateOldSettings();
            
        } catch (e) {
            console.error('Error loading state:', e);
        }
        
        this.initialized = true;
        this.emit('initialized');
    }

    // Migrate from old settings format
    migrateOldSettings() {
        try {
            const oldSettings = localStorage.getItem('settings');
            if (!oldSettings) return;
            
            // Don't migrate if we already have sources in the new format
            if (this.state.sources.size > 0) {
                console.log('Skipping migration - already have sources in new format');
                return;
            }
            
            const parsed = JSON.parse(oldSettings);
            
            // Migrate URLs (sources)
            if (parsed.urls?.length) {
                parsed.urls.forEach(source => {
                    const id = this.generateSourceId(source);
                    this.state.sources.set(id, {
                        id,
                        target: source.target,
                        url: source.URL || '',
                        username: source.username || '',
                        videoId: source.videoId || '',
                        isAutoDiscovered: false,
                        connectionMode: source.state?.connectionMode || (source.target === 'tiktok' ? 'tiktok-websocket' : 'classic'),
                        isVisible: source.state?.togglehtml !== "false",
                        isMuted: source.state?.togglemute === "true",
                        autoActivate: source.state?.togglelock === "true",
                        vid: null, // Window ID when active
                        wssId: null, // WebSocket ID when active
                        status: 'inactive',
                        supportsWSS: this.checkWebSocketSupport(source.target)
                    });
                });
            }
            
            // Migrate groups
            if (parsed.groups?.length) {
                parsed.groups.forEach(group => {
                    const id = `${group.target}-${group.username}`;
                    this.state.groups.set(id, {
                        id,
                        target: group.target,
                        username: group.username,
                        isChannel: group.isChannel !== "false",
                        connectionMode: group.state?.connectionMode || (group.target === 'tiktok' ? 'tiktok-websocket' : 'classic'),
                        autoActivate: group.state?.togglelock === "true",
                        groupVisible: group.state?.groupVisible !== "false",
                        groupMuted: group.state?.groupMuted === "true",
                        streams: [] // Will be populated with source IDs
                    });
                });
            }
            
            // Migrate global settings
            this.state.global.betaMode = localStorage.getItem('betaMode') === 'true';
            this.state.global.youtubeAutoAdd = localStorage.getItem('youtubeAutoAdd') === 'true';
            this.state.global.youtubeAutoCleanup = localStorage.getItem('youtubeAutoCleanup') === 'true';
            const checkInterval = localStorage.getItem('youtubeCheckInterval');
            if (checkInterval) {
                this.state.global.youtubeCheckInterval = parseInt(checkInterval);
            }
            
            this.persist();
            
            // Optionally remove old settings after successful migration
            // localStorage.removeItem('settings');
            
        } catch (e) {
            console.error('Error migrating old settings:', e);
        }
    }

    // Generate unique ID for a source
    generateSourceId(source) {
        if (source.videoId) {
            return `${source.target}-vid-${source.videoId}`;
        } else if (source.username) {
            return `${source.target}-user-${source.username}`;
        } else if (source.url || source.URL) {
            const url = source.url || source.URL;
            return `${source.target}-url-${btoa(url).substring(0, 10)}`;
        }
        return `${source.target}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Add a new source
    addSource(sourceData) {
        const id = sourceData.id || this.generateSourceId(sourceData);
        const source = {
            id,
            target: sourceData.target,
            url: sourceData.url || '',
            username: sourceData.username || '',
            videoId: sourceData.videoId || '',
            isAutoDiscovered: sourceData.isAutoDiscovered || false,
            connectionMode: sourceData.connectionMode || (sourceData.target === 'tiktok' ? 'tiktok-websocket' : 'classic'),
            isVisible: sourceData.isVisible !== false,
            isMuted: sourceData.isMuted || false,
            autoActivate: sourceData.autoActivate || false,
            vid: null,
            wssId: null,
            status: 'inactive',
            groupId: sourceData.groupId || null,
            ...sourceData // Allow additional properties
        };
        
        this.state.sources.set(id, source);
        
        // If part of a group, add to group's streams
        if (source.groupId) {
            const group = this.state.groups.get(source.groupId);
            if (group && !group.streams.includes(id)) {
                group.streams.push(id);
            }
        }
        
        this.emit('sourceAdded', { source });
        this.persist();
        return id;
    }

    // Update source state
    updateSource(sourceId, updates) {
        const source = this.state.sources.get(sourceId);
        if (!source) {
            console.error('Source not found:', sourceId);
            return false;
        }
        
        const oldState = { ...source };
        Object.assign(source, updates);
        
        this.emit('sourceUpdated', { sourceId, updates, oldState });
        this.persist();
        return true;
    }

    // Remove a source
    removeSource(sourceId) {
        const source = this.state.sources.get(sourceId);
        if (!source) return false;
        
        // Remove from group if part of one
        if (source.groupId) {
            const group = this.state.groups.get(source.groupId);
            if (group) {
                group.streams = group.streams.filter(id => id !== sourceId);
            }
        }
        
        this.state.sources.delete(sourceId);
        this.emit('sourceRemoved', { sourceId, source });
        this.persist();
        return true;
    }

    // Add a new group
    addGroup(groupData) {
        const id = groupData.id || `${groupData.target}-${groupData.username}`;
        const group = {
            id,
            target: groupData.target,
            username: groupData.username,
            isChannel: groupData.isChannel !== false,
            connectionMode: groupData.connectionMode || (groupData.target === 'tiktok' ? 'tiktok-websocket' : 'classic'),
            autoActivate: groupData.autoActivate || false,
            groupVisible: groupData.groupVisible !== false,
            groupMuted: groupData.groupMuted || false,
            streams: groupData.streams || [],
            ...groupData
        };
        
        this.state.groups.set(id, group);
        this.emit('groupAdded', { group });
        this.persist();
        return id;
    }

    // Update group state
    updateGroup(groupId, updates) {
        const group = this.state.groups.get(groupId);
        if (!group) return false;
        
        const oldState = { ...group };
        Object.assign(group, updates);
        
        // If visibility/mute changed, update all child streams
        if ('groupVisible' in updates || 'groupMuted' in updates) {
            group.streams.forEach(sourceId => {
                const source = this.state.sources.get(sourceId);
                if (source) {
                    if ('groupVisible' in updates) {
                        this.updateSource(sourceId, { isVisible: updates.groupVisible });
                    }
                    if ('groupMuted' in updates) {
                        this.updateSource(sourceId, { isMuted: updates.groupMuted });
                    }
                }
            });
        }
        
        this.emit('groupUpdated', { groupId, updates, oldState });
        this.persist();
        return true;
    }

    // Remove a group
    removeGroup(groupId) {
        const group = this.state.groups.get(groupId);
        if (!group) return false;
        
        // Remove all sources in the group
        group.streams.forEach(sourceId => {
            this.removeSource(sourceId);
        });
        
        this.state.groups.delete(groupId);
        this.emit('groupRemoved', { groupId, group });
        this.persist();
        return true;
    }

    // Update global settings
    updateGlobal(updates) {
        const oldState = { ...this.state.global };
        Object.assign(this.state.global, updates);
        
        // Update individual localStorage items for compatibility
        if ('betaMode' in updates) {
            localStorage.setItem('betaMode', updates.betaMode.toString());
        }
        if ('youtubeAutoAdd' in updates) {
            localStorage.setItem('youtubeAutoAdd', updates.youtubeAutoAdd.toString());
        }
        if ('youtubeAutoCleanup' in updates) {
            localStorage.setItem('youtubeAutoCleanup', updates.youtubeAutoCleanup.toString());
        }
        if ('youtubeCheckInterval' in updates) {
            localStorage.setItem('youtubeCheckInterval', updates.youtubeCheckInterval.toString());
        }
        
        this.emit('globalUpdated', { updates, oldState });
        this.persist();
    }

    // Get source by various criteria
    getSource(criteria) {
        if (typeof criteria === 'string') {
            return this.state.sources.get(criteria);
        }
        
        for (const [id, source] of this.state.sources) {
            let matches = true;
            for (const [key, value] of Object.entries(criteria)) {
                if (source[key] !== value) {
                    matches = false;
                    break;
                }
            }
            if (matches) return source;
        }
        return null;
    }

    // Get all sources matching criteria
    getSources(criteria = {}) {
        const results = [];
        for (const [id, source] of this.state.sources) {
            let matches = true;
            for (const [key, value] of Object.entries(criteria)) {
                if (source[key] !== value) {
                    matches = false;
                    break;
                }
            }
            if (matches) results.push(source);
        }
        return results;
    }

    // Get group
    getGroup(groupId) {
        return this.state.groups.get(groupId);
    }

    // Get all groups
    getGroups() {
        return Array.from(this.state.groups.values());
    }
    
    // Get all sources that belong to a specific group
    getSourcesByGroup(groupId) {
        const group = this.getGroup(groupId);
        if (!group) return [];
        
        return group.streams.map(sourceId => this.getSource(sourceId)).filter(Boolean);
    }

    // Check if a video ID is already added
    isVideoIdAdded(videoId) {
        return this.getSources({ videoId }).length > 0;
    }
    
    // Move source to a different group
    moveSourceToGroup(sourceId, newGroupId) {
        const source = this.getSource(sourceId);
        if (!source) return false;
        
        const newGroup = this.getGroup(newGroupId);
        if (!newGroup) return false;
        
        const oldGroupId = source.groupId; // Store old group ID before updating
        
        // Remove from old group if it has one
        if (oldGroupId) {
            const oldGroup = this.getGroup(oldGroupId);
            if (oldGroup) {
                const index = oldGroup.streams.indexOf(sourceId);
                if (index > -1) {
                    oldGroup.streams.splice(index, 1);
                }
            }
        }
        
        // Update source's group ID
        source.groupId = newGroupId;
        
        // Add to new group
        if (!newGroup.streams.includes(sourceId)) {
            newGroup.streams.push(sourceId);
        }
        
        this.emit('sourceMoved', { sourceId, oldGroupId, newGroupId });
        this.persist();
        return true;
    }

    // Persist state to localStorage
    persist() {
        try {
            const toSave = {
                sources: Array.from(this.state.sources.entries()),
                groups: Array.from(this.state.groups.entries()),
                global: this.state.global
            };
            localStorage.setItem(this.persistenceKey, JSON.stringify(toSave));
            
            // Also save in old format for compatibility
            this.saveOldFormat();
            
        } catch (e) {
            console.error('Error persisting state:', e);
        }
    }

    // Save in old format for compatibility
    saveOldFormat() {
        const settings = {
            urls: [],
            groups: []
        };
        
        // Convert sources
        for (const [id, source] of this.state.sources) {
            if (!source.isAutoDiscovered && !source.groupId) {
                settings.urls.push({
                    target: source.target,
                    URL: source.url,
                    username: source.username,
                    videoId: source.videoId,
                    state: {
                        connectionMode: source.connectionMode,
                        togglehtml: source.isVisible ? "true" : "false",
                        togglemute: source.isMuted ? "true" : "false",
                        togglelock: source.autoActivate ? "true" : "false"
                    }
                });
            }
        }
        
        // Convert groups
        for (const [id, group] of this.state.groups) {
            settings.groups.push({
                target: group.target,
                username: group.username,
                isChannel: group.isChannel ? "true" : "false",
                state: {
                    connectionMode: group.connectionMode,
                    togglelock: group.autoActivate ? "true" : "false",
                    groupVisible: group.groupVisible ? "true" : "false",
                    groupMuted: group.groupMuted ? "true" : "false"
                }
            });
        }
        
        localStorage.setItem('settings', JSON.stringify(settings));
    }

    // Event handling
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback); // Return unsubscribe function
    }

    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    emit(event, data = {}) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Error in ${event} listener:`, e);
                }
            });
        }
    }

    // Export current state (for debugging)
    exportState() {
        return {
            sources: Object.fromEntries(this.state.sources),
            groups: Object.fromEntries(this.state.groups),
            global: { ...this.state.global }
        };
    }

    // Import state (for debugging/testing)
    importState(stateData) {
        if (stateData.sources) {
            this.state.sources = new Map(Object.entries(stateData.sources));
        }
        if (stateData.groups) {
            this.state.groups = new Map(Object.entries(stateData.groups));
        }
        if (stateData.global) {
            this.state.global = { ...this.state.global, ...stateData.global };
        }
        this.persist();
        this.emit('stateImported');
    }
}

// Create singleton instance
const stateManager = new StateManager();

// Export for use in other files
window.stateManager = stateManager;