"use strict";

// Mozilla/Bergamot runtime adapter. MPL 2.0; see the accompanying notice.
function loadBergamotRuntime(modernBase, legacyBase) {
    var modern = false;
    try {
        modern = typeof Intl.Segmenter === "function" && WebAssembly.validate(new Uint8Array([
            0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,9,1,7,0,65,0,253,15,26,11
        ]));
    } catch (_) {}

    function load(useModern, compiledModule) {
        return new Promise(function (resolve, reject) {
            var base = useModern ? modernBase : legacyBase;
            self.Module = {
                locateFile: function (file) { return base + file; },
                print: function () {},
                printErr: function (message) { console.warn("[Bergamot]", message); },
                onRuntimeInitialized: function () { resolve({ module: self.Module, modern: useModern }); },
                onAbort: function (reason) { reject(new Error(String(reason))); }
            };
            if (useModern) {
                // Handle load/compile errors here instead of an uncaught runtime abort.
                self.Module.instantiateWasm = function (imports, receiveInstance) {
                    WebAssembly.instantiate(compiledModule, imports).then(function (instance) {
                        receiveInstance(instance, compiledModule);
                    }).catch(reject);
                    return {};
                };
            }
            try {
                if (useModern) {
                    importScripts(base + "bergamot-translator.js");
                    self.Module = loadBergamot(self.Module);
                } else {
                    importScripts(base + "bergamot-translator-worker.js");
                }
            } catch (error) { reject(error); }
        });
    }

    var preparation = modern ? fetch(modernBase + "bergamot-translator.wasm").then(function (response) {
        if (!response.ok) throw new Error("Translation engine download failed: " + response.status);
        return response.arrayBuffer();
    }).then(function (bytes) {
        return WebAssembly.compile(bytes);
    }) : Promise.resolve(null);

    return preparation.then(function (compiledModule) {
        return load(modern, compiledModule);
    }).catch(function (error) {
        if (!modern) throw error;
        console.warn("[Bergamot] Using compatibility engine:", error.message);
        return load(false);
    });
}
