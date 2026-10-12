(function (global) {
    'use strict';
    // Derived vectors only; the original knowledge documents remain in LunrDBLLM.
    function open() {
        return new Promise(function (resolve, reject) {
            var request = indexedDB.open('SSNRagSemantic', 1);
            request.onupgradeneeded = function () { request.result.createObjectStore('vectors', { keyPath: 'ref' }); };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
        });
    }
    async function transaction(mode, action) {
        var db = await open();
        return new Promise(function (resolve, reject) {
            var tx = db.transaction('vectors', mode), result;
            tx.oncomplete = function () { db.close(); resolve(result); };
            tx.onerror = tx.onabort = function () { db.close(); reject(tx.error || new Error('Search cache unavailable.')); };
            try { action(tx.objectStore('vectors'), function (value) { result = value; }); }
            catch (error) { db.close(); reject(error); }
        });
    }
    global.SSNRagCache = {
        read: function () {
            return transaction('readonly', function (store, done) { store.getAll().onsuccess = function (e) { done(e.target.result); }; });
        },
        put: function (entry) { return transaction('readwrite', function (store) { store.put(entry); }); },
        remove: function (docId) {
            return transaction('readwrite', function (store) {
                if (docId === undefined) { store.clear(); return; }
                store.openCursor().onsuccess = function (e) {
                    var cursor = e.target.result;
                    if (!cursor) return;
                    if (cursor.value.docId === docId) cursor.delete();
                    cursor.continue();
                };
            });
        },
        prune: function (refs) {
            var keep = new Set(refs);
            return transaction('readwrite', function (store) {
                store.openCursor().onsuccess = function (e) {
                    var cursor = e.target.result;
                    if (!cursor) return;
                    if (!keep.has(cursor.key)) cursor.delete();
                    cursor.continue();
                };
            });
        }
    };
}(typeof self !== 'undefined' ? self : globalThis));
