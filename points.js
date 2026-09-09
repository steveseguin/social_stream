const POINTS_MS_PER_MINUTE = 60 * 1000;
const POINTS_MS_PER_HOUR = 60 * POINTS_MS_PER_MINUTE;
const DEFAULT_POINTS_LEADERBOARD_LIMIT = 50;
const POINTS_LEADERBOARD_BROADCAST_DELAY = 2500;

function getSettingsStoreSnapshot() {
    if (typeof window !== 'undefined' && window.settings) {
        return window.settings;
    }
    if (typeof settings !== 'undefined') {
        return settings;
    }
    return {};
}

function extractSettingValue(raw) {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    if (typeof raw === 'object') {
        if (raw.setting !== undefined) return raw.setting;
        if (raw.numbersetting !== undefined) return raw.numbersetting;
        if (raw.optionsetting !== undefined) return raw.optionsetting;
        if (raw.textsetting !== undefined) return raw.textsetting;
        if (raw.value !== undefined) return raw.value;
    }
    return raw;
}

function getBooleanSettingValue(key, defaultValue = false) {
    const snapshot = getSettingsStoreSnapshot();
    const value = extractSettingValue(snapshot ? snapshot[key] : undefined);
    if (value === undefined) {
        return defaultValue;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no', 'off'].includes(normalized)) {
            return false;
        }
    }
    return Boolean(value);
}

function getNumericSettingValue(key, defaultValue) {
    const snapshot = getSettingsStoreSnapshot();
    const value = extractSettingValue(snapshot ? snapshot[key] : undefined);
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) {
        return numberValue;
    }
    return defaultValue;
}

function normalizePositiveNumber(value, fallback) {
    if (Number.isFinite(value) && value > 0) {
        return value;
    }
    return fallback;
}

const pointsSettingsHelpers = {
    getSettingsSnapshot: getSettingsStoreSnapshot,
    getBooleanSetting: getBooleanSettingValue,
    getNumericSetting: getNumericSettingValue
};

if (typeof window !== 'undefined') {
    window.pointsSettingsHelpers = Object.assign(
        {},
        window.pointsSettingsHelpers || {},
        pointsSettingsHelpers
    );
}

class PointsSystem {
    constructor(options = {}) {
        this.dbName = options.dbName || 'pointsSystemDB';
        this.storeName = options.storeName || 'userPoints';
        this.pointsPerEngagement = options.pointsPerEngagement || 1;
        this.engagementWindow = options.engagementWindow || 15 * POINTS_MS_PER_MINUTE;
        this.streakWindow = options.streakWindow || POINTS_MS_PER_HOUR;
        this.streakBreakTime = options.streakBreakTime || POINTS_MS_PER_HOUR;
        this.streakMultiplierBase = options.streakMultiplierBase || 0.1;
        this.streakCap = options.streakCap || 10;
        this.messageStore = options.messageStore;
        
        this.db = null;
        this.cache = new Map();
        this.userLocks = new Map(); // Per-user operation locks to prevent race conditions
        this.initPromise = this.initDatabase();
        this.migrationComplete = false;
        this.migrationInProgress = false;
    }
    
    // Generate a unique key for a user based on username and type
    getUserKey(username, type) {
        return `${username}:${type || 'default'}`;
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2);
            
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'userKey' });
                    store.createIndex('points', 'points');
                    store.createIndex('lastActive', 'lastActive');
                    store.createIndex('username', 'username');
                    store.createIndex('type', 'type');
                    store.createIndex('username_type', ['username', 'type']);
                }
                if (!db.objectStoreNames.contains('economyRecords')) {
                    db.createObjectStore('economyRecords', { keyPath: 'id' });
                }
            };
            
            request.onsuccess = event => {
                this.db = event.target.result;
                this.db.onversionchange = () => {
                    this.db.close();
                    this.db = null;
                    this.initPromise = null;
                };
                resolve();
            };
            
            request.onerror = () => reject(request.error);
            request.onblocked = () => console.warn('Points database upgrade is waiting for another SSN window to close.');
        });
    }

    async ensureDB() {
        if (!this.db) await (this.initPromise || (this.initPromise = this.initDatabase()));
        return this.db;
    }

    // Lock mechanism to prevent race conditions on per-user operations
    async withUserLock(userKey, operation) {
        // Wait for any existing lock on this user
        while (this.userLocks.get(userKey)) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Acquire lock
        this.userLocks.set(userKey, true);

        try {
            return await operation();
        } finally {
            // Release lock
            this.userLocks.delete(userKey);
        }
    }

    async getUserPoints(username, type = 'default') {
        const userKey = this.getUserKey(username, type);
        
        // Another host window may have committed an update. The database is authoritative.

        const db = await this.ensureDB();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(userKey);
            
            request.onsuccess = () => {
                const userData = request.result || this.createDefaultUserData(username, type);
                this.cache.set(userKey, userData);
                resolve(userData);
            };
            
            // A failed read is not a missing user; never replace their balance with zero.
            request.onerror = () => reject(request.error);
            tx.onabort = () => reject(tx.error || new Error('Points read aborted'));
        });
    }

    createDefaultUserData(username, type = 'default') {
        const userKey = this.getUserKey(username, type);
        return {
            userKey,
            username,
            type,
            points: 0,
            pointsSpent: 0,
            lastEngagement: 0,
            currentStreak: 0,
            lastActive: 0,
            engagementHistory: []
        };
    }

    async saveUserPoints(userData) {
        if(!Number.isFinite(userData.points) || !Number.isFinite(userData.pointsSpent) || Math.abs(userData.points)>Number.MAX_SAFE_INTEGER || userData.pointsSpent<0 || userData.pointsSpent>Number.MAX_SAFE_INTEGER)throw new Error('Invalid points balance.');
        const userKey = userData.userKey || this.getUserKey(userData.username, userData.type);
        // Callers may have changed the cached object. Keep it out of the cache until committed.
        this.cache.delete(userKey);
        const db = await this.ensureDB();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.get(userKey);
            let writeError;
            request.onsuccess = () => {
                const current = request.result;
                if (current && ((current.revision || 0) !== (userData.revision || 0) || current.pointsReserved > 0)) {
                    writeError = new Error('Balance changed or points are reserved. Refresh before editing.');
                    tx.abort();
                    return;
                }
                userData = Object.assign({}, userData, { revision: (current && current.revision || 0) + 1 });
                store.put(userData);
            };
            
            tx.oncomplete = () => {
                this.cache.set(userKey, userData);
                resolve(userData);
            };
            const fail = () => {
                this.cache.delete(userKey);
                reject(writeError || tx.error || request.error || new Error('Points write failed'));
            };
            request.onerror = fail;
            tx.onerror = fail;
            tx.onabort = fail;
        });
    }

    // The callback is synchronous: read, validate, and write inside one transaction.
    // This serializes *all* instances, unlike a per-window lock or cached read.
    async mutateUserPoints(username, type, mutate) {
        const db = await this.ensureDB();
        const userKey = this.getUserKey(username, type);
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.get(userKey);
            let result, committed, failure;
            request.onsuccess = () => {
                try {
                    const user = request.result || this.createDefaultUserData(username, type);
                    result = mutate(user);
                    if (result && result.success === false) return;
                    if (!Number.isFinite(user.points) || !Number.isFinite(user.pointsSpent) ||
                        Math.abs(user.points) > Number.MAX_SAFE_INTEGER || Math.abs(user.pointsSpent) > Number.MAX_SAFE_INTEGER) {
                        throw new Error('Points balance exceeds the supported range.');
                    }
                    user.revision = (user.revision || 0) + 1;
                    store.put(user);
                    committed = user;
                } catch (error) { failure = error; tx.abort(); }
            };
            tx.oncomplete = () => {
                if (committed) this.cache.set(userKey, committed);
                resolve(result);
            };
            const fail = () => { this.cache.delete(userKey); reject(failure || tx.error || request.error || new Error('Points update failed')); };
            request.onerror = fail;
            tx.onerror = fail; tx.onabort = fail;
        });
    }

    async recordEngagement(username, type = 'default', timestamp = Date.now()) {
        if (!username) return null;

        const userKey = this.getUserKey(username, type);

        // Use lock to prevent race conditions with concurrent messages
        return this.mutateUserPoints(username, type, userData => {
            const now = timestamp;

            // Check if this engagement is in a new window from the last one
            const timeSinceLastEngagement = now - userData.lastEngagement;

            if (timeSinceLastEngagement >= this.engagementWindow) {
                // Award points for a new engagement
                userData.points += this.pointsPerEngagement;

                // Update streak logic
                if (timeSinceLastEngagement <= this.streakBreakTime) {
                    // Continue streak
                    userData.currentStreak++;

                    // Calculate streak bonus capped at streakCap
                    const streakMultiplier = Math.min(userData.currentStreak * this.streakMultiplierBase, this.streakCap);
                    const streakBonus = Math.floor(this.pointsPerEngagement * streakMultiplier);

                    // Add streak bonus if applicable
                    if (streakBonus > 0) {
                        userData.points += streakBonus;
                    }
                } else {
                    // Break streak if too much time has passed
                    userData.currentStreak = 1;
                }

                // Keep track of engagement for history
                userData.engagementHistory.push(now);

                // Trim history to keep only last 100 entries
                if (userData.engagementHistory.length > 100) {
                    userData.engagementHistory = userData.engagementHistory.slice(-100);
                }
                // Only credited engagements start a new award window.
                userData.lastEngagement = now;
            }

            userData.lastActive = now;

            return userData;
        });
    }

    async addPoints(username, type = 'default', amount) {
        if (!Number.isFinite(amount) || amount <= 0) return { success: false, message: "Amount must be a positive number" };

        const userKey = this.getUserKey(username, type);

        // Use lock to prevent race conditions
        return this.mutateUserPoints(username, type, userData => {

            userData.points += amount;
            userData.lastActive = Date.now();

            return {
                success: true,
                message: "Points added successfully",
                added: amount,
                points: userData.points,
                available: userData.points - userData.pointsSpent
            };
        });
    }
    
    async spendPoints(username, type = 'default', amount, operationId) {
        if (!Number.isFinite(amount) || amount <= 0) return { success: false, message: "Amount must be a positive number" };
        if (operationId) return this.pointRedemption(username,type,amount,operationId,'reserve');

        const userKey = this.getUserKey(username, type);

        // Use lock to prevent race conditions (critical for spending to prevent double-spend)
        return this.mutateUserPoints(username, type, userData => {

            // Calculate available points
            const availablePoints = userData.points - userData.pointsSpent;

            if (availablePoints < amount) {
                return {
                    success: false,
                    message: "Not enough points",
                    available: availablePoints,
                    requested: amount
                };
            }

            userData.pointsSpent += amount;

            return {
                success: true,
                message: "Points spent successfully",
                spent: amount,
                remaining: userData.points - userData.pointsSpent
            };
        });
    }

    async refundPoints(username, type = 'default', amount, operationId) {
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid refund amount');
        if (operationId) return this.pointRedemption(username,type,amount,operationId,'refund');
        return this.mutateUserPoints(username, type, userData => {
            userData.pointsSpent = Math.max(userData.pointsReserved || 0, userData.pointsSpent - amount);
            return { success: true, remaining: userData.points - userData.pointsSpent };
        });
    }

    async pointRedemption(username,type,amount,operationId,action) {
        if(!Number.isFinite(amount) || amount<=0 || !['reserve','refund','complete'].includes(action))throw new Error('Invalid redemption operation.');
        const db=await this.ensureDB(), key=this.getUserKey(username,type), id='redemption:'+operationId;
        if(typeof operationId!=='string' || operationId.length>600)throw new Error('Invalid redemption ID.');
        return new Promise((resolve,reject)=>{
            const tx=db.transaction([this.storeName,'economyRecords'],'readwrite'),users=tx.objectStore(this.storeName),records=tx.objectStore('economyRecords');
            const account=users.get(key),receipt=records.get(id);let ready=0,result,failure;
            const apply=()=>{if(++ready!==2)return;try{
                const user=account.result || this.createDefaultUserData(username,type),prior=receipt.result;
                if(prior && (prior.userKey!==key || prior.amount!==amount))throw new Error('Redemption parameters changed.');
                if(action==='reserve'){
                    if(prior){result={success:false,duplicate:true,message:'This redemption was already processed.'};return;}
                    if(user.points-user.pointsSpent<amount){result={success:false,available:user.points-user.pointsSpent,message:'Not enough points'};return;}
                    user.pointsSpent+=amount;user.pointsReserved=(user.pointsReserved||0)+amount;
                    records.put({id:id,version:1,userKey:key,username:username,type:type,amount:amount,status:'pending',expiresAt:Date.now()+45000});
                }else{
                    if(!prior)throw new Error('Redemption receipt missing.');
                    if(prior.status!=='pending'){result={success:prior.status===(action==='refund'?'refunded':'completed'),duplicate:true};return;}
                    user.pointsReserved=(user.pointsReserved||0)-amount;
                    if(action==='refund')user.pointsSpent-=amount;
                    prior.status=action==='refund'?'refunded':'completed';prior.completedAt=Date.now();records.put(prior);
                }
                if(user.pointsReserved<0 || !Number.isFinite(user.pointsSpent) || user.pointsSpent>Number.MAX_SAFE_INTEGER)throw new Error('Invalid redemption balance.');
                user.revision=(user.revision||0)+1;users.put(user);result={success:true,spent:amount,remaining:user.points-user.pointsSpent};
            }catch(error){failure=error;tx.abort();}};
            account.onsuccess=apply;receipt.onsuccess=apply;
            tx.oncomplete=()=>{this.cache.delete(key);resolve(result);if(action==='reserve' && result.success)this.recoverPendingRedemptions().catch(error=>console.warn('Pending redemption recovery unavailable',error));};
            tx.onabort=()=>{this.cache.delete(key);reject(failure||tx.error||new Error('Redemption write aborted'));};
        });
    }

    async recoverPendingRedemptions() {
        const db=await this.ensureDB();
        const pending=await new Promise((resolve,reject)=>{const tx=db.transaction('economyRecords','readonly'),req=tx.objectStore('economyRecords').getAll(IDBKeyRange.bound('redemption:','redemption:\uffff'));req.onsuccess=()=>resolve(req.result.filter(r=>r.status==='pending'));req.onerror=()=>reject(req.error);});
        let next=Infinity;
        for(const receipt of pending){
            if(receipt.expiresAt<=Date.now())await this.pointRedemption(receipt.username,receipt.type,receipt.amount,receipt.id.slice(11),'refund');
            else next=Math.min(next,receipt.expiresAt);
        }
        if(this.redemptionRecoveryTimer)clearTimeout(this.redemptionRecoveryTimer);
        if(Number.isFinite(next))this.redemptionRecoveryTimer=setTimeout(()=>this.recoverPendingRedemptions().catch(error=>console.warn('Redemption recovery failed',error)),Math.max(100,next-Date.now()+100));
    }

    async getLeaderboard(limit = 10, type = null) {
        const db = await this.ensureDB();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const index = store.index('points');
            const users = [];
            
            const request = index.openCursor(null, 'prev');
            request.onerror = () => reject(request.error);
            tx.onabort = () => reject(tx.error || new Error('Points leaderboard read aborted'));
            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor && users.length < limit) {
                    const userData = cursor.value;
                    
                    // Filter by type if specified
                    if (type && userData.type !== type) {
                        cursor.continue();
                        return;
                    }
                    
                    users.push({
                        username: userData.username,
                        type: userData.type,
                        points: userData.points,
                        pointsSpent: userData.pointsSpent,
                        available: userData.points - userData.pointsSpent,
                        currentStreak: userData.currentStreak
                    });
                    cursor.continue();
                } else {
                    resolve(users);
                }
            };
        });
    }

    async resetAllPoints() {
        const db = await this.ensureDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.storeName, 'economyRecords'], 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.getAll();
            let failure;
            request.onsuccess = () => {
                if (request.result.some(user => user.pointsReserved > 0)) {
                    failure = new Error('Cancel or settle paid rounds before resetting points.');
                    tx.abort(); return;
                }
                store.clear();
                tx.objectStore('economyRecords').put({ id: 'migration', version: 1, complete: true, resetAt: Date.now() });
            };

            tx.oncomplete = () => {
                this.cache.clear();
                resolve(true);
            };

            request.onerror = () => reject(request.error);
            tx.onerror = () => reject(tx.error || new Error('Points reset failed'));
            tx.onabort = () => reject(failure || tx.error || new Error('Points reset aborted'));
        });
    }

    // Export all points data to JSON for backup
    async exportAllPoints() {
        const db = await this.ensureDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.storeName, 'economyRecords'], 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.getAll();
            const recordsRequest = tx.objectStore('economyRecords').getAll();

            tx.oncomplete = () => {
                const users = request.result || [];
                const exportData = {
                    version: 2,
                    exported: Date.now(),
                    exportedDate: new Date().toISOString(),
                    userCount: users.length,
                    users: users,
                    economyRecords: recordsRequest.result || []
                };
                resolve(JSON.stringify(exportData, null, 2));
            };

            request.onerror = () => reject(request.error);
            tx.onabort = () => reject(tx.error || new Error('Backup read aborted'));
        });
    }

    // Import points data from JSON backup
    async importPoints(jsonString, mode = 'merge') {
        let data;
        try {
            data = JSON.parse(jsonString);
        } catch (e) {
            return { success: false, message: 'Invalid JSON format', error: e.message };
        }

        if (!data || !Array.isArray(data.users)) {
            return { success: false, message: 'Invalid backup format: missing users array' };
        }
        if (data.users.some(user => user && user.pointsReserved > 0)) {
            return {success:false,message:'This backup contains reserved points. Use complete recovery on a fresh host, not a balance-only import.'};
        }

        const db = await this.ensureDB();
        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (let user of data.users) {
            try {
                if (!user || typeof user.username !== 'string' || !user.username.trim() ||
                    (user.type !== undefined && typeof user.type !== 'string') ||
                    user.userKey !== this.getUserKey(user.username, user.type) || !Number.isFinite(user.points)) {
                    skipped++;
                    continue;
                }

                // Older backups may omit activity fields, but malformed values must not reach live scoring.
                user = Object.assign(this.createDefaultUserData(user.username, user.type || 'default'), user);
                user.pointsReserved = 0;
                const invalidActivity = ['pointsSpent', 'lastEngagement', 'currentStreak', 'lastActive'].some(key =>
                    !Number.isFinite(user[key]) || user[key] < 0);
                if (invalidActivity || !Array.isArray(user.engagementHistory) ||
                    user.engagementHistory.some(value => !Number.isFinite(value) || value < 0)) {
                    skipped++;
                    continue;
                }

                if (mode === 'replace') {
                    // Replace mode: overwrite all data
                    const current = await this.getUserPoints(user.username, user.type);
                    user.revision = current.revision || 0;
                    await this.saveUserPoints(user);
                    imported++;
                } else {
                    // Merge mode: keep higher point values
                    const existing = await this.getUserPoints(user.username, user.type || 'default');
                    user.revision = existing.revision || 0;

                    if (user.points > existing.points) {
                        // Import has more points, use imported data
                        await this.saveUserPoints(user);
                        imported++;
                    } else if (user.points === existing.points && user.pointsSpent < existing.pointsSpent) {
                        // Same points but less spent (more available), use imported
                        await this.saveUserPoints(user);
                        imported++;
                    } else {
                        skipped++;
                    }
                }
            } catch (e) {
                console.error('Error importing points user:', user && user.username, e);
                errors++;
            }
        }

        // Clear cache to ensure fresh data
        this.cache.clear();

        return {
            success: true,
            message: `Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`,
            imported,
            skipped,
            errors,
            total: data.users.length
        };
    }

    // Full recovery only into an empty host. Never merge journals or silently rewind balances.
    async recoverEconomyBackup(jsonString) {
        const data = JSON.parse(jsonString);
        if (!data || data.version !== 2 || !Array.isArray(data.users) || !Array.isArray(data.economyRecords)) throw new Error('Choose a complete version 2 backup.');
        const users = new Map(), records = new Set(), reserved = new Map();
        for (const user of data.users) {
            if (!user || typeof user.username !== 'string' || !user.username || typeof user.type !== 'string' ||
                user.userKey !== this.getUserKey(user.username,user.type) || users.has(user.userKey) ||
                ['points','pointsSpent','lastEngagement','currentStreak','lastActive'].some(k=>!Number.isFinite(user[k]) || Math.abs(user[k])>Number.MAX_SAFE_INTEGER) ||
                !Number.isSafeInteger(user.pointsReserved || 0) || (user.pointsReserved || 0)<0 || user.pointsSpent<(user.pointsReserved || 0) || !Array.isArray(user.engagementHistory)) throw new Error('Invalid account in backup.');
            users.set(user.userKey,user);
        }
        for (const record of data.economyRecords) {
            if (!record || typeof record.id !== 'string' || records.has(record.id) || !/^(giveaway:|summary:|archive:|operation:|redemption:|migration$)/.test(record.id)) throw new Error('Invalid economy record in backup.');
            records.add(record.id);
            if(record.id.startsWith('redemption:') && record.status==='pending'){
                if(!Number.isFinite(record.amount) || record.amount<=0 || !Number.isFinite(record.expiresAt))throw new Error('Invalid pending redemption.');
                reserved.set(record.userKey,(reserved.get(record.userKey)||0)+record.amount);
            }
            if (record.id.startsWith('giveaway:') || record.id.startsWith('archive:')) {
                if (!record.config || !Array.isArray(record.entries) || !Array.isArray(record.winners) || !Array.isArray(record.won) || !record.roundId || !record.session ||
                    !['draft','open','locked','cancelled','completed'].includes(record.status) || record.entries.length>10000) throw new Error('Invalid round in backup.');
                const config=record.config;
                if(!['giveaway','coin','number'].includes(config.kind) || typeof config.keyword!=='string' || !['exact','word'].includes(config.match) ||
                    !Number.isSafeInteger(config.ticketCost) || config.ticketCost<0 || config.ticketCost>10000 || !Number.isSafeInteger(config.maxTickets) || config.maxTickets<1 || config.maxTickets>10000 ||
                    !Number.isSafeInteger(config.prizePoints) || config.prizePoints<0 || config.prizePoints>1000000 || !Number.isSafeInteger(config.winnerCount) || config.winnerCount<1 || config.winnerCount>20)throw new Error('Invalid rules in backup.');
                const identities=new Set();
                for(const entry of record.entries){
                    if (!entry || identities.has(entry.id) || entry.accountKey!==this.getUserKey(entry.name,entry.platform) || !Number.isSafeInteger(entry.tickets) || entry.tickets<1 ||
                        !Number.isSafeInteger(entry.reserved) || entry.reserved<0) throw new Error('Invalid ticket record.');
                    identities.add(entry.id);
                    if(record.id.startsWith('giveaway:'))reserved.set(entry.accountKey,(reserved.get(entry.accountKey)||0)+entry.reserved);
                    else if(entry.reserved) throw new Error('Archived rounds cannot reserve points.');
                }
            }
        }
        for(const [key,amount] of reserved){if(amount && (!users.has(key) || users.get(key).pointsReserved!==amount))throw new Error('Reserved points do not match tickets.');}
        for(const [key,user] of users){if((user.pointsReserved||0)!==(reserved.get(key)||0))throw new Error('Account reservations do not match rounds.');}
        const db=await this.ensureDB();
        return new Promise((resolve,reject)=>{
            const tx=db.transaction([this.storeName,'economyRecords'],'readwrite'), userStore=tx.objectStore(this.storeName), recordStore=tx.objectStore('economyRecords');
            const count=userStore.count(), current=recordStore.getAll();let ready=0,failure;
            const load=()=>{if(++ready!==2)return;if(count.result || current.result.some(r=>r.id!=='migration')){failure=new Error('Recovery requires a fresh host with no balances or giveaway records. Existing data was not changed.');tx.abort();return;}
                for(const user of data.users)userStore.put(user);
                for(const record of data.economyRecords){if(record.status==='open')record.status='locked';if(record.id.startsWith('summary:') && record.state){record.state.open=false;if(record.state.status==='open')record.state.status='locked';}recordStore.put(record);}
                recordStore.put({id:'migration',version:1,complete:true});
            };
            count.onsuccess=load;current.onsuccess=load;
            tx.oncomplete=()=>{this.cache.clear();this.migrationComplete=true;resolve({success:true,users:data.users.length});};
            tx.onabort=()=>reject(failure||tx.error||new Error('Recovery aborted; nothing was changed.'));
        });
    }

    // Get users with the same name across different platforms
    async getUsersWithSameName(username) {
        const db = await this.ensureDB();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const index = store.index('username');
            const range = IDBKeyRange.only(username);
            const results = [];
            
            const request = index.openCursor(range);
            request.onerror = () => reject(request.error);
            tx.onabort = () => reject(tx.error || new Error('Points user lookup aborted'));
            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
        });
    }

    async checkIfMigrationNeeded() {
        if (this.migrationComplete || this.migrationInProgress || !this.messageStore) {
            return false;
        }
        
        const db = await this.ensureDB();
        const marker = await new Promise((resolve, reject) => {
            const tx = db.transaction('economyRecords', 'readonly');
            const request = tx.objectStore('economyRecords').get('migration');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        if (marker && marker.complete) return false;
        // Check if we need to migrate (if the store is empty)
        const leaderboard = await this.getLeaderboard(1);
        return leaderboard.length === 0;
    }

    async migrateFromMessageStore() {
        if (this.migrationComplete || this.migrationInProgress || !this.messageStore) {
            return false;
        }
        
        const migrationNeeded = await this.checkIfMigrationNeeded();
        if (!migrationNeeded) {
            this.migrationComplete = true;
            return false;
        }

        this.migrationInProgress = true;
        console.log('Starting points migration from message history...');
        
        try {
            // Get all message history - increased limit to ensure we get more historical data
            const recentMessages = await this.messageStore.getRecentMessages(50000);
            
            // Group messages by username, type and timestamp
            const userEngagements = {};
            
            for (const message of recentMessages) {
                if (!message.chatname || message.bot) continue;
                
                const username = message.chatname;
                const type = message.type || 'default';
                const timestamp = message.timestamp;
                
                const key = `${username}:${type}`;
                if (!userEngagements[key]) {
                    userEngagements[key] = {
                        username,
                        type,
                        timestamps: []
                    };
                }
                
                userEngagements[key].timestamps.push(timestamp);
            }
            
            // Process each user's engagements
            let processedCount = 0;
            for (const key in userEngagements) {
                const { username, type, timestamps } = userEngagements[key];
                
                // Sort timestamps chronologically
                timestamps.sort((a, b) => a - b);
                
                let lastEngagementTime = 0;
                let currentStreak = 0;
                let totalPoints = 0;
                let engagementHistory = [];
                
                for (const timestamp of timestamps) {
                    const timeSince = timestamp - lastEngagementTime;
                    
                    if (timeSince >= this.engagementWindow || lastEngagementTime === 0) {
                        // New engagement window
                        totalPoints += this.pointsPerEngagement;
                        engagementHistory.push(timestamp);
                        
                        if (timeSince <= this.streakBreakTime || lastEngagementTime === 0) {
                            // Continue or start streak
                            currentStreak++;
                            
                            // Calculate streak bonus
                            const streakMultiplier = Math.min(currentStreak * this.streakMultiplierBase, this.streakCap);
                            const streakBonus = Math.floor(this.pointsPerEngagement * streakMultiplier);
                            
                            if (streakBonus > 0) {
                                totalPoints += streakBonus;
                            }
                        } else {
                            // Break streak
                            currentStreak = 1;
                        }
                        
                        lastEngagementTime = timestamp;
                    }
                }
                
                // Only save if user has points
                if (totalPoints > 0) {
                    const userData = this.createDefaultUserData(username, type);
                    userData.points = totalPoints;
                    userData.lastEngagement = lastEngagementTime;
                    userData.lastActive = lastEngagementTime;
                    userData.currentStreak = currentStreak;
                    
                    // Keep only the last 100 engagements in history
                    userData.engagementHistory = engagementHistory.slice(-100);
                    
                    // Compare-and-set prevents migration overwriting engagement earned meanwhile.
                    await this.saveUserPoints(userData);
                    processedCount++;
                    
                    // Log progress intermittently
                    if (processedCount % 50 === 0) {
                        console.log(`Processed ${processedCount} users so far...`);
                    }
                }
            }
            
            console.log(`Points migration complete! Processed ${processedCount} users.`);
            const db = await this.ensureDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction('economyRecords', 'readwrite');
                tx.objectStore('economyRecords').put({ id: 'migration', version: 1, complete: true });
                tx.oncomplete = resolve;
                tx.onabort = () => reject(tx.error || new Error('Migration marker write failed'));
            });
            this.migrationComplete = true;
            this.migrationInProgress = false;
            return true;
            
        } catch (error) {
            console.error('Points migration failed:', error);
            this.migrationInProgress = false;
            return false;
        }
    }

    async forceMigration() {
        if (this.migrationInProgress) {
            console.log('Migration already in progress');
            return false;
        }
        
        this.migrationComplete = false;
        return await this.migrateFromMessageStore();
    }

    async processNewMessage(message) {
        if (!message || !message.chatname || message.bot) return null;
        
        const type = message.type || 'default';
        const username = message.chatname;
        const timestamp = message.timestamp || Date.now();
        
        return await this.recordEngagement(username, type, timestamp);
    }
}

const configuredPointsPerEngagement = normalizePositiveNumber(
    getNumericSettingValue('pointsPerEngagement', NaN),
    1
);
const configuredEngagementWindowMinutes = normalizePositiveNumber(
    getNumericSettingValue('engagementWindow', NaN),
    15
);

// Create the points system instance
const pointsSystem = new PointsSystem({
    pointsPerEngagement: configuredPointsPerEngagement,
    engagementWindow: configuredEngagementWindowMinutes * POINTS_MS_PER_MINUTE,  // minutes -> ms
    streakWindow: POINTS_MS_PER_HOUR,             // 1 hour window for streaks
    streakBreakTime: POINTS_MS_PER_HOUR,          // Break streak if no activity for 1 hour
    streakMultiplierBase: 0.1,             // 10% bonus per streak hour, so 10 hours = 2x points
    streakCap: 10,                         // Cap multiplier at 10x (100% bonus)
    messageStore: messageStoreDB           // Link to existing message store
});

function isPointsSystemEnabled() {
    return getBooleanSettingValue('enablePointsSystem', false);
}

function syncPointsSystemConfigFromSettings() {
    const nextPointsPerEngagement = normalizePositiveNumber(
        getNumericSettingValue('pointsPerEngagement', pointsSystem.pointsPerEngagement),
        pointsSystem.pointsPerEngagement || 1
    );
    if (pointsSystem.pointsPerEngagement !== nextPointsPerEngagement) {
        pointsSystem.pointsPerEngagement = nextPointsPerEngagement;
    }

    const currentWindowMinutes = pointsSystem.engagementWindow / POINTS_MS_PER_MINUTE;
    const nextWindowMinutes = normalizePositiveNumber(
        getNumericSettingValue('engagementWindow', currentWindowMinutes),
        currentWindowMinutes || 15
    );
    const nextWindowMs = nextWindowMinutes * POINTS_MS_PER_MINUTE;
    if (pointsSystem.engagementWindow !== nextWindowMs) {
        pointsSystem.engagementWindow = nextWindowMs;
    }
}

let pointsMessageHookInstalled = false;
let pointsSystemInitPromise = null;
let pointsLeaderboardBroadcastTimeout = null;
let pendingLeaderboardReason = 'update';

async function broadcastPointsLeaderboard(reason = 'update', limit = DEFAULT_POINTS_LEADERBOARD_LIMIT) {
    if (!isPointsSystemEnabled()) {
        return;
    }

    try {
        await ensurePointsSystemInitialized();
        const leaderboardEntries = await pointsSystem.getLeaderboard(limit);
        const snapshotId = Date.now();
        const payload = {
            event: 'points_leaderboard',
            reason,
            snapshotId,
            timestamp: snapshotId,
            leaderboard: leaderboardEntries.map((entry, index) => ({
                chatname: entry.username,
                type: entry.type || 'default',
                points: entry.points,
                pointsSpent: entry.pointsSpent,
                available: entry.available,
                currentStreak: entry.currentStreak || 0,
                rank: index + 1
            }))
        };

        const transport = (typeof sendDataP2P === 'function')
            ? sendDataP2P
            : (typeof window !== 'undefined' && typeof window.sendDataP2P === 'function'
                ? window.sendDataP2P
                : null);

        if (transport) {
            transport(payload);
        } else if (typeof window !== 'undefined' && typeof window.sendToDestinations === 'function') {
            window.sendToDestinations({ overlayNinja: payload });
        } else {
            console.warn('Points leaderboard payload dropped; no transport available');
        }
    } catch (error) {
        console.error('Failed to broadcast points leaderboard:', error);
    }
}

function schedulePointsLeaderboardBroadcast(reason = 'update', options = {}) {
    if (!isPointsSystemEnabled()) {
        return;
    }

    pendingLeaderboardReason = reason || 'update';

    if (options.immediate) {
        if (pointsLeaderboardBroadcastTimeout) {
            clearTimeout(pointsLeaderboardBroadcastTimeout);
            pointsLeaderboardBroadcastTimeout = null;
        }

        broadcastPointsLeaderboard(pendingLeaderboardReason).catch(error => {
            console.error('Failed to broadcast points leaderboard immediately:', error);
        });
        pendingLeaderboardReason = 'update';
        return;
    }

    if (pointsLeaderboardBroadcastTimeout) {
        return;
    }

    pointsLeaderboardBroadcastTimeout = setTimeout(() => {
        const reasonToSend = pendingLeaderboardReason;
        pendingLeaderboardReason = 'update';
        pointsLeaderboardBroadcastTimeout = null;
        broadcastPointsLeaderboard(reasonToSend).catch(error => {
            console.error('Failed to broadcast points leaderboard:', error);
        });
    }, POINTS_LEADERBOARD_BROADCAST_DELAY);
}

if (typeof window !== 'undefined') {
    window.pointsSystem = pointsSystem;
    window.pointsSystemReady = ensurePointsSystemInitialized;
    window.requestPointsLeaderboardBroadcast = schedulePointsLeaderboardBroadcast;

    if (window.eventFlowSystem && !window.eventFlowSystem.pointsSystem) {
        window.eventFlowSystem.pointsSystem = pointsSystem;
    }
}

function ensurePointsSystemInitialized() {
    if (pointsSystemInitPromise) {
        return pointsSystemInitPromise;
    }

    pointsSystemInitPromise = (async () => {
        try {
            await pointsSystem.ensureDB();
            pointsSystem.recoverPendingRedemptions().catch(error=>console.warn('Point redemption recovery failed',error));
            syncPointsSystemConfigFromSettings();

            // Attempt migration if needed, but don't block initialization
            const migrationNeeded = await pointsSystem.checkIfMigrationNeeded();
            if (migrationNeeded) {
                console.log('Migration needed, starting in background...');
                setTimeout(() => pointsSystem.migrateFromMessageStore(), 3000);
            } else {
                console.log('No migration needed, points system ready');
            }

            if (!pointsMessageHookInstalled && messageStoreDB && typeof messageStoreDB.addMessage === 'function') {
                const originalAddMessage = messageStoreDB.addMessage;
                messageStoreDB.addMessage = async function(message) {
                    const result = await originalAddMessage.call(this, message);
                    if (isPointsSystemEnabled()) {
                        try {
                            syncPointsSystemConfigFromSettings();
                            await pointsSystem.processNewMessage(message);
                            schedulePointsLeaderboardBroadcast('message');
                        } catch (error) {
                            // Points are optional; the chat message was already saved successfully.
                            console.error('Failed to update points for saved chat message:', error);
                        }
                    }
                    return result;
                };
                pointsMessageHookInstalled = true;
            }

            console.log('Points system initialized');
            schedulePointsLeaderboardBroadcast('initialized', { immediate: true });
            return pointsSystem;
        } catch (error) {
            console.error('Failed to initialize points system:', error);
            pointsSystemInitPromise = null;
            throw error;
        }
    })();

    return pointsSystemInitPromise;
}

// Initialize points system after message store is ready
setTimeout(ensurePointsSystemInitialized, 2000);

// Command handler functions
async function handlePointsCommand(username, type = 'default') {
    const userData = await pointsSystem.getUserPoints(username, type);
    const availablePoints = userData.points - userData.pointsSpent;
    
    return {
        username,
        type,
        pointsTotal: userData.points,
        pointsSpent: userData.pointsSpent,
        pointsAvailable: availablePoints,
        currentStreak: userData.currentStreak
    };
}

async function checkMigrationStatus() {
    return {
        migrationComplete: pointsSystem.migrationComplete,
        migrationInProgress: pointsSystem.migrationInProgress
    };
}
// Diagnostic functions for the points system

// Function to check if migration ran successfully
async function checkMigrationStatus() {
    return {
        migrationComplete: pointsSystem.migrationComplete,
        migrationInProgress: pointsSystem.migrationInProgress
    };
}

// Function to search for similar usernames (case insensitive)
async function searchSimilarUsernames(partialName) {
    const db = await pointsSystem.ensureDB();
    
    return new Promise((resolve) => {
        const tx = db.transaction(pointsSystem.storeName, 'readonly');
        const store = tx.objectStore(pointsSystem.storeName);
        const users = [];
        
        // We need to scan all records since we're doing a partial/case-insensitive match
        store.openCursor().onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                const userData = cursor.value;
                // Case insensitive search
                if (userData.username.toLowerCase().includes(partialName.toLowerCase())) {
                    users.push({
                        userKey: userData.userKey,
                        username: userData.username,
                        type: userData.type,
                        points: userData.points,
                        pointsSpent: userData.pointsSpent,
                        lastActive: new Date(userData.lastActive),
                        currentStreak: userData.currentStreak
                    });
                }
                cursor.continue();
            } else {
                resolve(users);
            }
        };
    });
}

// Function to check for recent messages from a specific user
async function checkRecentMessagesForUser(username, type = null, limit = 10) {
    if (!messageStoreDB) {
        return { error: "Message store not available" };
    }
    
    try {
        // First check if we can find messages for this exact user
        let messages;
        if (type) {
            messages = await messageStoreDB.getUserMessages(username, type, 0, limit);
        } else {
            // Try to get any messages from this username regardless of type
            messages = await messageStoreDB.getRecentMessages(500);
            messages = messages.filter(msg => 
                msg.chatname && msg.chatname.toLowerCase() === username.toLowerCase()
            ).slice(0, limit);
        }
        
        return {
            messagesFound: messages.length,
            sampleMessages: messages.map(msg => ({
                id: msg.id,
                chatname: msg.chatname,
                type: msg.type,
                timestamp: new Date(msg.timestamp),
                message: msg.chatmessage ? msg.chatmessage.substring(0, 30) + '...' : '[no message]'
            }))
        };
    } catch (error) {
        return { error: error.toString() };
    }
}

async function searchSimilarUsernames(partialName) {
    const db = await pointsSystem.ensureDB();
    
    return new Promise((resolve) => {
        const tx = db.transaction(pointsSystem.storeName, 'readonly');
        const store = tx.objectStore(pointsSystem.storeName);
        const users = [];
        
        // We need to scan all records since we're doing a partial/case-insensitive match
        store.openCursor().onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                const userData = cursor.value;
                // Case insensitive search
                if (userData.username.toLowerCase().includes(partialName.toLowerCase())) {
                    users.push({
                        userKey: userData.userKey,
                        username: userData.username,
                        type: userData.type,
                        points: userData.points,
                        pointsSpent: userData.pointsSpent,
                        lastActive: new Date(userData.lastActive),
                        currentStreak: userData.currentStreak
                    });
                }
                cursor.continue();
            } else {
                resolve(users);
            }
        };
    });
}

async function handleSearchUsersByName(username) {
    return await pointsSystem.getUsersWithSameName(username);
}

async function handleSpendPointsCommand(username, amount, type = 'default') {
    const result = await pointsSystem.spendPoints(username, type, amount);
    if (result && result.success) {
        schedulePointsLeaderboardBroadcast('spend', { immediate: true });
    }
    return result;
}

async function handleLeaderboardCommand(limit = 10, type = null) {
    return await pointsSystem.getLeaderboard(limit, type);
}

async function handleForceMigration() {
    return await pointsSystem.forceMigration();
}

async function listAllUsers(limit = 100) {
    const db = await pointsSystem.ensureDB();
    
    return new Promise((resolve) => {
        const tx = db.transaction(pointsSystem.storeName, 'readonly');
        const store = tx.objectStore(pointsSystem.storeName);
        const users = [];
        
        store.openCursor().onsuccess = event => {
            const cursor = event.target.result;
            if (cursor && users.length < limit) {
                const userData = cursor.value;
                users.push({
                    userKey: userData.userKey,
                    username: userData.username, 
                    type: userData.type,
                    points: userData.points,
                    lastActive: new Date(userData.lastActive)
                });
                cursor.continue();
            } else {
                resolve(users);
            }
        };
    });
}

// Function to manually award points to a user
async function manuallyAwardPoints(username, type, points) {
    const userData = await pointsSystem.getUserPoints(username, type);
    userData.points += points;
    userData.lastActive = Date.now();
    await pointsSystem.saveUserPoints(userData);
    schedulePointsLeaderboardBroadcast('manual-award', { immediate: true });
    return userData;
}

// Function to force a re-process of historical messages for a specific user
async function reprocessUserHistory(username, type = null) {
    if (!messageStoreDB) {
        return { error: "Message store not available" };
    }
    
    try {
        // Get messages for this user
        let messages = await messageStoreDB.getRecentMessages(5000);
        
        // Filter for the specific user
        messages = messages.filter(msg => {
            if (!msg.chatname) return false;
            
            const nameMatch = msg.chatname.toLowerCase() === username.toLowerCase();
            const typeMatch = type ? msg.type === type : true;
            
            return nameMatch && typeMatch;
        });
        
        console.log(`Found ${messages.length} messages for ${username} ${type ? `(${type})` : ''}`);
        
        // Sort by timestamp ascending
        messages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Process each message
        let processed = 0;
        for (const message of messages) {
            await pointsSystem.processNewMessage(message);
            processed++;
        }
        schedulePointsLeaderboardBroadcast('reprocess', { immediate: true });

        return {
            processed,
            messagesFound: messages.length
        };
    } catch (error) {
        return { error: error.toString() };
    }
}

// Add diagnostic functions to window for console use
window.pointsDiagnostic = {
    checkMigrationStatus,
    searchSimilarUsernames,
    checkRecentMessagesForUser,
    listAllUsers,
    manuallyAwardPoints,
    reprocessUserHistory
};
