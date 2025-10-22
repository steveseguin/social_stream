// Proper Piper TTS implementation using the actual phonemizer
(function(window) {
  'use strict';
  
  const DEFAULT_REMOTE_PIPER_BASE = 'https://steveseguin.github.io/piper';
  const trimTrailingSlash = (value) => typeof value === 'string' ? value.replace(/\/+$/, '') : '';
  
  class ProperPiperTTS {
    constructor(voiceId = 'en_US-hfc_female-medium') {
      this.initialized = false;
      this.initializing = false;
      this.initPromise = null;
      this.session = null;
      this.voiceConfig = null;
      this.createPiperPhonemize = null;
      this.phonemizerModule = null;
      this.phonemizerBusy = false;
      this.synthesisQueue = [];
      this.isProcessingQueue = false;
      const extensionBase = typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function'
        ? trimTrailingSlash(chrome.runtime.getURL(''))
        : null;
      const locationBase = trimTrailingSlash(window.location.href.substring(0, window.location.href.lastIndexOf('/')));
      this.baseUrl = locationBase;
      this.extensionBaseUrl = extensionBase && extensionBase !== locationBase ? extensionBase : null;
      this.remoteBaseUrl = ProperPiperTTS.getRemoteBaseUrl();
      this.localPiperBase = this.baseUrl + '/thirdparty/piper';
      this.extensionPiperBase = this.extensionBaseUrl ? this.extensionBaseUrl + '/thirdparty/piper' : null;
      this.updateVoicePaths(voiceId);
      
      // Available voices
      this.availableVoices = {
        // US English voices
        'en_US-hfc_female-medium': 'US Female (HFC) - Medium',
        'en_US-amy-medium': 'US Female (Amy) - Medium',
        'en_US-danny-low': 'US Male (Danny) - Low',
        'en_US-ryan-high': 'US Male (Ryan) - High Quality',
        // British English voices
        'en_GB-alan-low': 'British Male (Alan) - Low',
        'en_GB-alba-medium': 'British Female (Alba) - Medium'
      };
    }

    async init() {
      if (this.initialized) return true;
      
      // If already initializing, wait for it to complete
      if (this.initializing && this.initPromise) {
        return this.initPromise;
      }
      
      this.initializing = true;
      this.initPromise = this._doInit();
      
      try {
        await this.initPromise;
        return true;
      } catch (error) {
        this.initializing = false;
        this.initPromise = null;
        throw error;
      }
    }
    
    async _doInit() {
      try {
        // Check ONNX Runtime
        if (!window.ort) {
          throw new Error('ONNX Runtime not loaded');
        }

        // Load the phonemizer module
        console.log('Loading Piper phonemizer module...');
        await this.loadPhonemizer();

        // Load voice configuration
        console.log('Loading voice configuration...');
        const configResult = await this.fetchWithFallback(this.voiceConfigCandidates, 'json');
        this.voiceConfig = configResult.data;
        this.voiceConfigPath = configResult.url;
        console.log('Voice config loaded:', this.voiceConfig);
        console.log('Voice config source:', this.voiceConfigPath);

        // Load ONNX model
        console.log('Loading ONNX model...');
        const modelResult = await this.fetchWithFallback(this.voiceModelCandidates, 'arrayBuffer');
        const modelBuffer = modelResult.data;
        this.voiceModelPath = modelResult.url;
        console.log('Using Piper voice model from:', this.voiceModelPath);
        
        // Configure ONNX Runtime
        const wasmRoot = this.baseUrl + '/thirdparty/';
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.simd = true;
        ort.env.wasm.wasmPaths = wasmRoot;
        
        // Create ONNX session
        const sessionOptions = {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          enableCpuMemArena: true,
          enableMemPattern: true,
          executionMode: 'sequential',
          interOpNumThreads: 1,
          intraOpNumThreads: 1
        };
        
        this.session = await ort.InferenceSession.create(modelBuffer, sessionOptions);
        console.log('ONNX session created successfully');
        
        this.initialized = true;
        this.initializing = false;
        console.log('Piper TTS initialized successfully!');
      } catch (error) {
        console.error('Piper TTS initialization failed:', error);
        this.initializing = false;
        throw error;
      }
    }

    async loadPhonemizer() {
      // Load piper-o91UDS6e.js as text and convert to function
      const response = await fetch(this.baseUrl + '/thirdparty/piper/piper-o91UDS6e.js');
      const moduleText = await response.text();
      
      // Extract the createPiperPhonemize function
      // Remove the ES6 export and make it available
      const modifiedText = moduleText.replace(
        /export\s*{\s*createPiperPhonemize\s*};?/,
        'window.__createPiperPhonemize = createPiperPhonemize;'
      );
      
      // Execute the module code
      const script = document.createElement('script');
      script.textContent = modifiedText;
      document.head.appendChild(script);
      
      // Wait for it to be available
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!window.__createPiperPhonemize) {
        throw new Error('Failed to load createPiperPhonemize');
      }
      
      this.createPiperPhonemize = window.__createPiperPhonemize;
      delete window.__createPiperPhonemize;
      console.log('Phonemizer module loaded');
    }

    async initPhonemizer() {
      if (this.phonemizerModule) return;
      
      const input = JSON.stringify([{ text: "test" }]);
      const wasmPaths = {
        piperWasm: this.baseUrl + '/thirdparty/piper/piper_phonemize.wasm',
        piperData: this.baseUrl + '/thirdparty/piper/piper_phonemize.data'
      };
      
      // Create a single instance of the phonemizer module
      this.phonemizerModule = await this.createPiperPhonemize({
        print: (data) => {
          if (this.phonemizerCallback) {
            this.phonemizerCallback(data);
          }
        },
        printErr: (message) => {
          console.error('Phonemizer error:', message);
          if (this.phonemizerErrorCallback) {
            this.phonemizerErrorCallback(message);
          }
        },
        locateFile: (url) => {
          if (url.endsWith(".wasm")) {
            return wasmPaths.piperWasm;
          }
          if (url.endsWith(".data")) {
            return wasmPaths.piperData;
          }
          return url;
        }
      });
      
      console.log('Phonemizer module initialized');
    }

    async phonemize(text) {
      if (!this.createPiperPhonemize) {
        throw new Error('Phonemizer not loaded');
      }
      
      // Initialize phonemizer module if needed
      if (!this.phonemizerModule) {
        await this.initPhonemizer();
      }
      
      // Wait if phonemizer is busy
      while (this.phonemizerBusy) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      this.phonemizerBusy = true;
      
      try {
        const input = JSON.stringify([{ text: text.trim() }]);
        
        return new Promise((resolve, reject) => {
          let resolved = false;
          
          // Set up callbacks
          this.phonemizerCallback = (data) => {
            if (!resolved) {
              try {
                const result = JSON.parse(data);
                if (result.phoneme_ids) {
                  resolved = true;
                  resolve(result.phoneme_ids);
                }
              } catch (e) {
                console.error('Failed to parse phonemizer output:', e);
              }
            }
          };
          
          this.phonemizerErrorCallback = (message) => {
            if (!resolved) {
              resolved = true;
              reject(new Error(message));
            }
          };
          
          // Call the phonemizer
          const espeakVoice = this.voiceConfig?.espeak?.voice || 'en-us';
          this.phonemizerModule.callMain([
            "-l", espeakVoice,
            "--input", input,
            "--espeak_data", "/espeak-ng-data"
          ]);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              reject(new Error('Phonemizer timeout'));
            }
          }, 5000);
        });
      } finally {
        this.phonemizerBusy = false;
        this.phonemizerCallback = null;
        this.phonemizerErrorCallback = null;
      }
    }

    async synthesize(text, speed = 1.0) {
      // Ensure initialization is complete
      if (!this.initialized) {
        console.log('Waiting for Piper TTS initialization...');
        await this.init();
      }

      try {
        // Get phoneme IDs using the real phonemizer
        console.log('Phonemizing text:', text);
        const phonemeIds = await this.phonemize(text);
        console.log('Phoneme IDs:', phonemeIds);

        // Create input tensors
        const inputs = {
          'input': new ort.Tensor('int64', 
            new BigInt64Array(phonemeIds.map(id => BigInt(id))), 
            [1, phonemeIds.length]
          ),
          'input_lengths': new ort.Tensor('int64', 
            new BigInt64Array([BigInt(phonemeIds.length)]), 
            [1]
          ),
          'scales': new ort.Tensor('float32', 
            new Float32Array([0.667, speed, 0.8]), 
            [3]
          )
        };

        console.log('Running inference...');
        const startTime = performance.now();
        let results;
        
        try {
          results = await this.session.run(inputs);
        } catch (error) {
          // Handle numeric error codes
          if (typeof error === 'number') {
            console.error(`ONNX Runtime error code: ${error}`);
            throw new Error(`ONNX inference failed with code ${error}. This often means the session is corrupted or out of memory.`);
          }
          throw error;
        }
        
        const inferenceTime = performance.now() - startTime;
        console.log(`Inference completed in ${inferenceTime.toFixed(2)}ms`);
        
        // Get audio output
        if (!results || !results.output || !results.output.data) {
          throw new Error('No audio output from model');
        }
        
        const audioData = results.output.data;
        console.log(`Generated audio: ${audioData.length} samples`);

        // Convert to WAV format
        const sampleRate = this.voiceConfig.audio?.sample_rate || 22050;
        const wav = this.createWAV(audioData, sampleRate);
        
        return wav;
        
      } catch (error) {
        console.error('Synthesis failed:', error);
        throw error;
      }
    }

    createWAV(audioData, sampleRate) {
      const length = audioData.length;
      const arrayBuffer = new ArrayBuffer(44 + length * 2);
      const view = new DataView(arrayBuffer);
      
      // WAV header
      const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + length * 2, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true); // fmt chunk size
      view.setUint16(20, 1, true); // PCM format
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true); // byte rate
      view.setUint16(32, 2, true); // block align
      view.setUint16(34, 16, true); // bits per sample
      writeString(36, 'data');
      view.setUint32(40, length * 2, true);
      
      // Convert float samples to 16-bit PCM
      let offset = 44;
      for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
      
      return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    async speak(text, speed = 1.0) {
      // Add to queue
      return new Promise((resolve, reject) => {
        this.synthesisQueue.push({ text, speed, resolve, reject });
        
        // If not initialized yet, wait for initialization before processing
        if (!this.initialized && !this.initializing) {
          console.log('Piper TTS not initialized, initializing now...');
          this.init().then(() => {
            this.processQueue();
          }).catch(error => {
            console.error('Failed to initialize Piper TTS:', error);
            // Reject all queued items
            while (this.synthesisQueue.length > 0) {
              const item = this.synthesisQueue.shift();
              item.reject(error);
            }
          });
        } else {
          this.processQueue();
        }
      });
    }
    
    async processQueue() {
      if (this.isProcessingQueue || this.synthesisQueue.length === 0) {
        return;
      }
      
      // Wait for initialization if needed
      if (!this.initialized) {
        if (!this.initializing) {
          // Should not happen, but just in case
          await this.init();
        } else {
          // Wait for ongoing initialization
          await this.initPromise;
        }
      }
      
      this.isProcessingQueue = true;
      
      while (this.synthesisQueue.length > 0) {
        const { text, speed, resolve, reject } = this.synthesisQueue.shift();
        
        try {
          console.log(`Processing TTS for: "${text}"`);
          const wav = await this.synthesize(text, speed);
          
          // Create audio element and play
          const audio = new Audio();
          audio.src = URL.createObjectURL(wav);
          
          // Set volume if available from TTS settings
          if (window.TTS && window.TTS.volume) {
            audio.volume = window.TTS.volume;
          }
          
          // Resume audio context if needed - use shared TTS audioContext
          try {
            if (window.TTS && window.TTS.audioContext) {
              if (window.TTS.audioContext.state === 'suspended') {
                await window.TTS.audioContext.resume();
              }
            } else if (window.TTS && window.TTS.initAudioContext) {
              // Initialize audio context if not already done
              window.TTS.initAudioContext();
              if (window.TTS.audioContext && window.TTS.audioContext.state === 'suspended') {
                await window.TTS.audioContext.resume();
              }
            }
            
            await audio.play();
          } catch (e) {
            console.error("REMEMBER TO CLICK THE PAGE FIRST - audio won't play until you do");
            console.error("Audio playback error:", e);
            throw e;
          }
          
          await new Promise((audioResolve, audioReject) => {
            audio.onended = () => {
              URL.revokeObjectURL(audio.src);
              audioResolve();
            };
            audio.onerror = (e) => {
              URL.revokeObjectURL(audio.src);
              console.error('Audio playback error:', e);
              audioReject(new Error('Audio playback failed'));
            };
          });
          
          resolve();
          
        } catch (error) {
          console.error('Failed to speak:', error);
          reject(error);
        }
        
        // Small delay between utterances
        if (this.synthesisQueue.length > 0) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
      
      this.isProcessingQueue = false;
    }
    
    // Clear pending speech queue
    clearQueue() {
      const queueLength = this.synthesisQueue.length;
      this.synthesisQueue.forEach(item => {
        item.reject(new Error('Queue cleared'));
      });
      this.synthesisQueue = [];
      console.log(`Cleared ${queueLength} pending TTS requests`);
    }
    
    // Get queue status
    getQueueLength() {
      return this.synthesisQueue.length;
    }
    
    // Change voice (requires re-initialization)
    async changeVoice(voiceId) {
      if (!this.availableVoices[voiceId]) {
        throw new Error(`Unknown voice: ${voiceId}. Available voices: ${Object.keys(this.availableVoices).join(', ')}`);
      }
      
      console.log(`Changing voice from ${this.voiceId} to ${voiceId}`);
      
      // Clear any pending speech
      this.clearQueue();
      
      // Update voice paths
      this.updateVoicePaths(voiceId);
      
      // Reset initialization state
      this.initialized = false;
      this.initializing = false;
      this.initPromise = null;
      this.session = null;
      this.voiceConfig = null;
      
      // Re-initialize with new voice
      await this.init();
      
      console.log(`Voice changed to ${voiceId} successfully`);
    }
    
    // Get available voices
    getAvailableVoices() {
      return this.availableVoices;
    }
    
    // Get current voice
    getCurrentVoice() {
      return this.voiceId;
    }

    static getRemoteBaseUrl() {
      if (typeof ProperPiperTTS.remoteBaseUrl === 'string' && ProperPiperTTS.remoteBaseUrl.trim()) {
        return ProperPiperTTS.remoteBaseUrl.trim().replace(/\/+$/, '');
      }
      if (typeof window !== 'undefined') {
        const override = window.ProperPiperRemoteBaseUrl || window.PIPER_REMOTE_BASE_URL;
        if (typeof override === 'string' && override.trim()) {
          return override.trim().replace(/\/+$/, '');
        }
      }
      return DEFAULT_REMOTE_PIPER_BASE;
    }

    updateVoicePaths(voiceId) {
      this.voiceId = voiceId;
      this.remoteBaseUrl = ProperPiperTTS.getRemoteBaseUrl();
      const { model, config } = this.buildVoiceAssetPaths(voiceId);
      this.voiceModelCandidates = model;
      this.voiceConfigCandidates = config;
      this.voiceModelPath = null;
      this.voiceConfigPath = null;
    }

    buildVoiceAssetPaths(voiceId) {
      const candidates = this.buildVoiceAssetBases(voiceId).map(base => trimTrailingSlash(base)).filter(Boolean);
      const uniqueBases = [...new Set(candidates)];
      return {
        model: uniqueBases.map(base => `${base}.onnx`),
        config: uniqueBases.map(base => `${base}.onnx.json`)
      };
    }

    buildVoiceAssetBases(voiceId) {
      const bases = [];
      const addBase = (root) => {
        if (!root || typeof root !== 'string') return;
        const trimmed = trimTrailingSlash(root.trim());
        bases.push(`${trimmed}/piper-voices/${voiceId}`);
        bases.push(`${trimmed}/piper-voices/${voiceId}/${voiceId}`);
      };
      addBase(this.localPiperBase);
      addBase(this.extensionPiperBase);
      addBase(this.remoteBaseUrl);
      if (this.remoteBaseUrl !== DEFAULT_REMOTE_PIPER_BASE) {
        addBase(DEFAULT_REMOTE_PIPER_BASE);
      }
      return bases;
    }

    async fetchWithFallback(urls, responseType) {
      if (!Array.isArray(urls) || urls.length === 0) {
        throw new Error('No URLs provided for fetchWithFallback');
      }
      let lastError = null;
      for (const url of urls) {
        if (!url) continue;
        try {
          const fetchOptions = { cache: 'no-store' };
          try {
            const parsed = new URL(url, window.location.href);
            if (parsed.protocol === 'chrome-extension:') {
              // leave mode undefined for extension resources
            } else {
              fetchOptions.mode = 'cors';
            }
          } catch (_urlError) {
            fetchOptions.mode = 'cors';
          }
          const response = await fetch(url, fetchOptions);
          if (!response || !response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response ? response.status : 'no response'}`);
          }
          const contentType = (response.headers && response.headers.get && response.headers.get('content-type')) || '';
          let data;
          if (responseType === 'json') {
            if (contentType && !contentType.includes('application/json')) {
              throw new Error(`Unexpected content-type for JSON fetch: ${contentType}`);
            }
            data = await response.json();
          } else if (responseType === 'arrayBuffer') {
            if (contentType && contentType.includes('text/html')) {
              throw new Error(`Unexpected HTML response when expecting binary: ${contentType}`);
            }
            data = await response.arrayBuffer();
          } else if (responseType === 'text') {
            data = await response.text();
          } else {
            data = await response.blob();
          }
          return { data, url };
        } catch (error) {
          lastError = error;
          console.warn('Piper asset fetch failed, trying next candidate:', url, error);
        }
      }
      throw lastError || new Error('All fetch attempts failed');
    }
  }

  ProperPiperTTS.remoteBaseUrl = null;
  ProperPiperTTS.DEFAULT_REMOTE_BASE = DEFAULT_REMOTE_PIPER_BASE;
  ProperPiperTTS.setRemoteBaseUrl = function(url) {
    if (typeof url === 'string' && url.trim()) {
      ProperPiperTTS.remoteBaseUrl = url.trim();
    } else {
      ProperPiperTTS.remoteBaseUrl = null;
    }
  };

  // Export to window
  window.ProperPiperTTS = ProperPiperTTS;
  
})(window);
