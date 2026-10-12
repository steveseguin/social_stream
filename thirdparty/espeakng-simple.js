/*
 * espeakng-simple.js - Simple wrapper for eSpeak-ng
 */

(function(window) {
  'use strict';

  function SimpleTTS(options) {
    options = options || {};
    this.workerPath = options.workerPath || 'js/espeakng.worker.js';
    this.defaultVoice = options.defaultVoice || 'en';  // Changed from 'en-us' to 'en'
    this.defaultRate = options.defaultRate || 175;
    this.defaultPitch = options.defaultPitch || 50;
    this.defaultVolume = options.defaultVolume || 1.0;
    this.enhanceAudio = options.enhanceAudio === true; // Disabled by default
    this.sampleRate = 44100; // Default, will be updated from worker
    this.ready = false;
    this.readyCallbacks = [];
    this._initWorker();
  }

  SimpleTTS.prototype._initWorker = function() {
    var self = this;
    try {
      this.worker = new Worker(this.workerPath);
      this.worker.onmessage = function(e) {
        if (e.data === 'ready') {
          self.ready = true;
          self.worker.onmessage = self._handleMessage.bind(self);
          // Get the actual sample rate from the worker
          self._sendMessage('get_samplerate', [], function(rate) {
            if (rate) {
              self.sampleRate = rate;
            }
          });
          self._executeReadyCallbacks();
        }
      };
      this.worker.onerror = function(error) {
        console.error('SimpleTTS Worker Error:', error);
        self._executeReadyCallbacks(error);
      };
    } catch (error) {
      console.error('SimpleTTS Init Error:', error);
      setTimeout(function() {
        self._executeReadyCallbacks(error);
      }, 0);
    }
  };

  SimpleTTS.prototype._handleMessage = function(evt) {
    var callback = evt.data.callback;
    if (callback && this[callback]) {
      this[callback].apply(this, evt.data.result);
      if (evt.data.done) {
        delete this[callback];
      }
    }
  };

  SimpleTTS.prototype._executeReadyCallbacks = function(error) {
    while (this.readyCallbacks.length) {
      this.readyCallbacks.shift()(error);
    }
  };

  SimpleTTS.prototype.onReady = function(callback) {
    if (this.ready) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  };

  SimpleTTS.prototype.getVoices = function(callback) {
    if (!this.ready) {
      callback([]);
      return;
    }
    this._sendMessage('list_voices', [], callback);
  };

  SimpleTTS.prototype.getSampleRate = function() {
    return this.sampleRate;
  };

  SimpleTTS.prototype.speak = function(text, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    options = options || {};
    
    if (!this.ready) {
      console.error('SimpleTTS: Not ready yet');
      callback(null);
      return;
    }
    
    var self = this;
    var audioChunks = [];
    
    // Apply options with defaults
    var voice = options.voice || this.defaultVoice;
    var rate = options.rate !== undefined ? options.rate : this.defaultRate;
    var pitch = options.pitch !== undefined ? options.pitch : this.defaultPitch;
    var volume = options.volume !== undefined ? options.volume : this.defaultVolume;
    var enhance = options.enhance !== undefined ? options.enhance : this.enhanceAudio;
    
    // Set voice parameters
    this._sendMessage('set_voice', [voice]);
    this._sendMessage('set_rate', [rate]);
    this._sendMessage('set_pitch', [pitch]);
    
    // Synthesize speech
    this._sendMessage('synthesize', [text], function(samples, events) {
      if (samples) {
        // The worker returns stereo data (each sample is duplicated)
        // We need to extract just the mono channel
        var stereoData = new Float32Array(samples);
        var monoData = new Float32Array(stereoData.length / 2);
        for (var i = 0; i < monoData.length; i++) {
          monoData[i] = stereoData[i * 2];
        }
        audioChunks.push(monoData);
      } else {
        // Done - process audio
        var audioData = self._mergeAudioChunks(audioChunks);
        
        // Apply enhancement if enabled
        if (enhance) {
          audioData = self._enhanceAudio(audioData);
        }
        
        // Apply volume and normalization
        audioData = self._processAudio(audioData, volume);
        
        callback(audioData, self.sampleRate);
      }
    });
  };

  // Simplified audio enhancement
  SimpleTTS.prototype._enhanceAudio = function(audioData) {
    // Apply gentle high-frequency boost for clarity
    var enhanced = this._applyHighFreqBoost(audioData);
    
    // Apply noise gate
    var gated = this._applyNoiseGate(enhanced);
    
    return gated;
  };

  // Gentle high frequency boost
  SimpleTTS.prototype._applyHighFreqBoost = function(input) {
    var output = new Float32Array(input.length);
    var alpha = 0.7; // Gentler than before
    
    output[0] = input[0];
    for (var i = 1; i < input.length; i++) {
      // Simple high-pass filter mixed with original
      var highFreq = input[i] - input[i - 1];
      output[i] = input[i] + highFreq * 0.2; // Subtle boost
    }
    
    return output;
  };

  // Simple noise gate
  SimpleTTS.prototype._applyNoiseGate = function(input) {
    var output = new Float32Array(input.length);
    var threshold = 0.01;
    var holdTime = 220; // ~10ms at 22050Hz
    var holdCounter = 0;
    
    for (var i = 0; i < input.length; i++) {
      if (Math.abs(input[i]) > threshold) {
        output[i] = input[i];
        holdCounter = holdTime;
      } else if (holdCounter > 0) {
        output[i] = input[i];
        holdCounter--;
      } else {
        output[i] = 0;
      }
    }
    
    return output;
  };

  // Simple volume adjustment
  SimpleTTS.prototype._processAudio = function(audioData, volume) {
    if (volume === 1.0) {
      return audioData;
    }
    
    var output = new Float32Array(audioData.length);
    for (var i = 0; i < audioData.length; i++) {
      output[i] = audioData[i] * volume;
    }
    
    return output;
  };

  SimpleTTS.prototype._mergeAudioChunks = function(chunks) {
    var totalLength = chunks.reduce(function(sum, chunk) {
      return sum + chunk.length;
    }, 0);
    
    var result = new Float32Array(totalLength);
    var offset = 0;
    
    chunks.forEach(function(chunk) {
      result.set(chunk, offset);
      offset += chunk.length;
    });
    
    return result;
  };

  SimpleTTS.prototype._sendMessage = function(method, args, callback) {
    var message = { 
      method: method, 
      args: args || []
    };
    
    if (callback) {
      var callbackId = '_' + method + '_' + Math.random().toString().substring(2) + '_cb';
      this[callbackId] = callback;
      message.callback = callbackId;
    }
    
    try {
      this.worker.postMessage(message);
    } catch (error) {
      console.error('SimpleTTS postMessage error:', error);
      if (callback) {
        delete this[callbackId];
        callback(null);
      }
    }
  };

  // Utility function to create AudioBuffer
  SimpleTTS.createAudioBuffer = function(audioData, sampleRate) {
    if (!window.AudioContext && !window.webkitAudioContext) {
      console.error('AudioContext not supported');
      return null;
    }
    
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var buffer = ctx.createBuffer(1, audioData.length, sampleRate);
    buffer.getChannelData(0).set(audioData);
    
    return buffer;
  };

  // Utility function to play audio data
  SimpleTTS.playAudioData = function(audioData, sampleRate) {
    if (!window.AudioContext && !window.webkitAudioContext) {
      console.error('AudioContext not supported');
      return null;
    }
    
    // If sampleRate is an options object, extract it
    if (typeof sampleRate === 'object' && sampleRate !== null) {
      sampleRate = sampleRate.sampleRate;
    }
    
    if (!sampleRate) {
      console.error('Sample rate is required');
      return null;
    }
    
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    var buffer = ctx.createBuffer(1, audioData.length, sampleRate);
    buffer.getChannelData(0).set(audioData);
    
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    
    return {
      context: ctx,
      source: source,
      stop: function() {
        try {
          source.stop();
        } catch (e) {}
      }
    };
  };

  window.SimpleTTS = SimpleTTS;

})(window);