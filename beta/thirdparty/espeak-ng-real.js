// Real eSpeak-NG TTS implementation using Steve's SimpleTTS
// https://github.com/steveseguin/espeakng.js

(function(window) {
  'use strict';
  
  class RealESpeakTTS {
    constructor() {
      this.initialized = false;
      this.initializing = false;
      this.initPromise = null;
      this.tts = null;
      this.audioContext = null;
      this.lastSampleRate = 22050;
      this.initError = null;
    }

    async init() {
      if (this.initialized) return true;
      
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
        console.log('Initializing real eSpeak-NG TTS...');
        
        // Wait for SimpleTTS to be available
        await this.waitForSimpleTTS();
        
        // Initialize audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Determine the correct worker path based on the protocol
        let workerPath = './thirdparty/espeakng.worker.js';
        
        // If we're running from a file:// URL, we need to use a different approach
        if (window.location.protocol === 'file:') {
          console.warn('Running from file:// - eSpeak may have limitations due to CORS');
          // Try to use a relative path that might work
          workerPath = 'thirdparty/espeakng.worker.js';
        }
        
        // Initialize SimpleTTS with proper options
        this.tts = new SimpleTTS({
          workerPath: workerPath,
          defaultVoice: 'en',
          defaultRate: 175,
          defaultPitch: 50,
          defaultVolume: 1.0
        });
        
        // Wait for TTS to be ready
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.initError = 'eSpeak-NG initialization timeout';
            reject(new Error('eSpeak-NG initialization timeout'));
          }, 10000);
          
          this.tts.onReady(() => {
            clearTimeout(timeout);
            this.initialized = true;
            this.initializing = false;
            console.log('Real eSpeak-NG TTS ready!');
            resolve();
          });
          
          // Handle initialization errors
          if (this.tts.worker) {
            this.tts.worker.onerror = (error) => {
              clearTimeout(timeout);
              this.initError = 'eSpeak worker error: ' + error;
              console.error('eSpeak worker error:', error);
              this.initialized = false;
              this.initializing = false;
              reject(error);
            };
          }
          
          // Also handle the case where onReady might have already been called
          if (this.tts.ready) {
            clearTimeout(timeout);
            this.initialized = true;
            this.initializing = false;
            console.log('Real eSpeak-NG TTS ready! (already initialized)');
            resolve();
          }
        });
        
      } catch (error) {
        console.error('Failed to initialize eSpeak-NG:', error);
        this.initialized = false;
        this.initializing = false;
        this.initError = error.message;
        throw error;
      }
    }
    
    async waitForSimpleTTS() {
      // If SimpleTTS is already loaded, return immediately
      if (window.SimpleTTS) return;
      
      // Load the SimpleTTS script
      const script = document.createElement('script');
      script.src = './thirdparty/espeakng-simple.js';
      
      const loadPromise = new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load SimpleTTS'));
      });
      
      document.head.appendChild(script);
      await loadPromise;
      
      // Wait a bit for SimpleTTS to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!window.SimpleTTS) {
        throw new Error('SimpleTTS not found after loading');
      }
    }

    async speak(text, settings = {}) {
      if (!this.initialized) {
        throw new Error('eSpeak-NG not initialized: ' + (this.initError || 'Unknown error'));
      }
      
      return new Promise((resolve, reject) => {
        try {
          // Map settings to SimpleTTS format
          const options = {
            voice: settings.voice || 'en',
            rate: settings.speed || 175,
            pitch: settings.pitch || 50,
            volume: settings.amplitude ? settings.amplitude / 100 : 1.0
          };
          
          // Handle variant
          if (settings.variant && settings.variant > 0) {
            // SimpleTTS might support variants differently
            // For now, we'll append it to the voice name
            options.voice = `${options.voice}+${settings.variant}`;
          }
          
          // Use SimpleTTS speak method with callback to get audio data
          this.tts.speak(text, options, (audioData, sampleRate) => {
            try {
              // Check if we received valid audio data
              if (!audioData) {
                reject(new Error('No audio data received from SimpleTTS'));
                return;
              }
              
              // Store the sample rate for WAV conversion
              this.lastSampleRate = sampleRate || 22050;
              
              // Convert to WAV format if needed
              const wavBuffer = this.ensureWAVFormat(audioData);
              resolve(wavBuffer);
            } catch (error) {
              reject(error);
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    }
    
    ensureWAVFormat(audioData) {
      // If already WAV, return as-is
      if (audioData instanceof ArrayBuffer) {
        const view = new DataView(audioData);
        if (view.byteLength > 4 && view.getUint32(0, false) === 0x52494646) { // "RIFF"
          return audioData;
        }
      }
      
      // Check if it's an AudioBuffer
      if (audioData && typeof audioData.getChannelData === 'function') {
        return this.audioBufferToWAV(audioData);
      }
      
      // Otherwise, assume it's raw audio data and convert to WAV
      return this.createWAVFromAudioData(audioData);
    }
    
    audioBufferToWAV(audioBuffer) {
      const length = audioBuffer.length;
      const numberOfChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const bitsPerSample = 16;
      
      // Create WAV file
      const wavLength = 44 + length * numberOfChannels * 2;
      const arrayBuffer = new ArrayBuffer(wavLength);
      const view = new DataView(arrayBuffer);
      
      // WAV header
      const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, wavLength - 8, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numberOfChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numberOfChannels * bitsPerSample / 8, true);
      view.setUint16(32, numberOfChannels * bitsPerSample / 8, true);
      view.setUint16(34, bitsPerSample, true);
      writeString(36, 'data');
      view.setUint32(40, length * numberOfChannels * 2, true);
      
      // Write audio data
      let offset = 44;
      for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          let sample = audioBuffer.getChannelData(channel)[i];
          // Clamp sample
          sample = Math.max(-1, Math.min(1, sample));
          // Convert to 16-bit PCM
          view.setInt16(offset, sample * 0x7FFF, true);
          offset += 2;
        }
      }
      
      return arrayBuffer;
    }
    
    createWAVFromAudioData(audioData) {
      // Assume audioData is a Float32Array or similar
      const sampleRate = this.lastSampleRate;
      const numberOfChannels = 1;
      const bitsPerSample = 16;
      
      let samples;
      if (audioData instanceof Float32Array) {
        samples = audioData;
      } else if (audioData instanceof ArrayBuffer) {
        samples = new Float32Array(audioData);
      } else {
        throw new Error('Unsupported audio data format');
      }
      
      const length = samples.length;
      const wavLength = 44 + length * 2;
      const arrayBuffer = new ArrayBuffer(wavLength);
      const view = new DataView(arrayBuffer);
      
      // WAV header
      const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, wavLength - 8, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numberOfChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numberOfChannels * bitsPerSample / 8, true);
      view.setUint16(32, numberOfChannels * bitsPerSample / 8, true);
      view.setUint16(34, bitsPerSample, true);
      writeString(36, 'data');
      view.setUint32(40, length * 2, true);
      
      // Write audio data
      let offset = 44;
      for (let i = 0; i < length; i++) {
        let sample = samples[i];
        // Clamp sample
        sample = Math.max(-1, Math.min(1, sample));
        // Convert to 16-bit PCM
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
      
      return arrayBuffer;
    }
  }
  
  // Export to window
  window.RealESpeakTTS = RealESpeakTTS;
  
})(window);