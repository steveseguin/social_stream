// tts.js - Text-to-Speech functions (Non-Module Version)
// This file is designed to be included with a regular script tag

// Create global TTS namespace
window.TTS = {};

// Initialize variables
TTS.speechLang = "en-US";
TTS.speech = false;
TTS.English = true;
TTS.voice = false;
TTS.voices = null;

// Initialize audio context
TTS.audioContext = null;
try {
    TTS.audioContext = new (window.AudioContext || window.webkitAudioContext)();
} catch(e) {
    console.error("Web Audio API not supported", e);
}


TTS.initAudioContext = function() {
    try {
        if (!TTS.audioContext) {
            TTS.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume context if suspended
        if (TTS.audioContext.state === 'suspended') {
            TTS.audioContext.resume().catch(err => {
                console.warn("Could not resume audio context:", err);
            });
        }
        
        return TTS.audioContext;
    } catch(e) {
        console.error("Web Audio API not supported", e);
        return null;
    }
};

document.addEventListener('click', function() {
    TTS.initAudioContext();
}, { once: true });

document.addEventListener('keydown', function() {
    TTS.initAudioContext();
}, { once: true });

TTS.isSafari = function() {
	const userAgent = navigator.userAgent;
	const isChrome = userAgent.indexOf("Chrome") > -1;
	const isSafari = userAgent.indexOf("Safari") > -1;
	const vendor = navigator.vendor;

	return isSafari && !isChrome && vendor.indexOf("Apple") > -1;
}

// Check for available voices
try {
    TTS.voices = window.speechSynthesis.getVoices();
    if (!TTS.voices.length) {
        if (TTS.isSafari()) {
            console.warn("Safari doesn't really support automatic TTS");
        }
		if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = function() {
                TTS.voices = window.speechSynthesis.getVoices();
                console.log("Voices loaded:", TTS.voices.length);
            };
        }
    }
} catch (e) {
    // Handle lack of TTS support
	console.warn(e);
    if (document.getElementById("tts") && e.name !== "InvalidStateError") {
        document.getElementById("tts").style.display = "none";
    }
}

TTS.voiceGender = false;
TTS.audio = false;
TTS.premiumQueueTTS = [];
TTS.premiumQueueActive = false;
TTS.volume = 1;
TTS.pitch = 0;
TTS.rate = 1;
TTS.voiceLatency = 4;

// Provider settings
TTS.googleSettings = {
    rate: 1,
    pitch: 0,
    audioProfile: false,
    voiceName: false
};

TTS.elevenLabsSettings = {
    latency: 4,
    stability: 0.5,
    similarity: 0.75,
    style: 0.5,
    speakerBoost: false,
    voiceName: false,
    speakingRate: 1.0,
    model: "eleven_multilingual_v2"
};

TTS.speechifySettings = {
    speed: 1.0,
    model: 'simba-english',
    voiceName: false
};

TTS.kokoroDownloadInProgress = null;
TTS.kokoroTtsInstance = null;
TTS.kokoroSettings = {
    rate: false,
    voiceName: false,
    model: "kokoro-82M-v1.0"
};

// TTS providers
TTS.GoogleAPIKey = false;
TTS.ElevenLabsKey = false;
TTS.SpeechifyAPIKey = false;
TTS.useKokoroTTS = false;
TTS.KokoroTTS = false;
TTS.TextSplitterStream = null;
TTS.TTSProvider = "system";

// Configuration flags
TTS.ttsSpeakChatname = true;
TTS.replaceURLInLink = true;
TTS.ttscommand = false;
TTS.ttscommandmembersonly = false;
TTS.doNotReadEvents = true;
TTS.neuroSyncEnabled = false;
TTS.bottts = false;
TTS.modtts = false;
TTS.hosttts = false;
TTS.admintts = false;
TTS.viptts = false;
TTS.allowbottss = false;
TTS.norelfectionstts = false;
TTS.allowhosttss = false;
TTS.allowmodtss = false;
TTS.allowadmintss = false;
TTS.allowviptss = false;
TTS.voiceName = false;
TTS.skipTTSMessages = false;
TTS.beepwords = false;
TTS.ttsSources = null;
TTS.readDonos = false;

/**
 * Check if the browser is Safari
 * @returns {boolean}
 */
TTS.isSafari = function() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

/**
 * Handle the end of audio playback
 */
TTS.finishedAudio = function(e) {
    TTS.premiumQueueActive = false;
    if (TTS.premiumQueueTTS.length) {
        TTS.speak(TTS.premiumQueueTTS.shift()); // play next
    }
};

/**
 * Send audio to NeuroSync for processing
 * @param {*} input - Audio data (Blob, ArrayBuffer, HTMLAudioElement, URL string)
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Processed data from NeuroSync
 */
TTS.sendToNeuroSync = async function(input, options = {}) {
  // Default options
  const apiUrl = options.apiUrl || 'http://127.0.0.1:5000/audio_to_blendshapes';
  const targetSampleRate = options.targetSampleRate || 88200;
  const onProgress = options.onProgress || (() => {});
  const isKokoroAudio = options.isKokoroAudio || false;
  
  try {
    // Step 1: Get audio data as ArrayBuffer
    let audioData;
    
    // Special handling for Kokoro TTS audio
    if (isKokoroAudio && input) {
      // Direct handling for Kokoro TTS audio blob
      // This could be from const audioBlob = audio.toBlob() or new Blob([wavBuffer], { type: 'audio/wav' })
      if (input instanceof Blob) {
        audioData = await getArrayBufferFromBlob(input);
      } else if (input.toBlob && typeof input.toBlob === 'function') {
        // For Kokoro audio objects with toBlob method
        const audioBlob = input.toBlob();
        audioData = await getArrayBufferFromBlob(audioBlob);
      } else if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
        // For wavBuffer from electron or raw audio data
        audioData = input instanceof ArrayBuffer ? input : input.buffer;
      } else {
        throw new Error('Unsupported Kokoro audio format');
      }
    }
    else if (input instanceof HTMLAudioElement) {
      // Handle audio element
      const audioSrc = input.src || input.currentSrc;
      if (!audioSrc) throw new Error('Audio element has no source');
      
      const response = await fetch(audioSrc);
      const blob = await response.blob();
      audioData = await getArrayBufferFromBlob(blob);
    } 
    else if (typeof input === 'string') {
      // Handle URL string
      const response = await fetch(input);
      const blob = await response.blob();
      audioData = await getArrayBufferFromBlob(blob);
    }
    else if (input instanceof Blob || input instanceof File) {
      // Handle Blob or File
      audioData = await getArrayBufferFromBlob(input);
    }
    else if (input instanceof ArrayBuffer) {
      // Already an ArrayBuffer
      audioData = input;
    }
    else {
      throw new Error('Unsupported input type');
    }
    
    onProgress(0.5); // 50% - got the data, now process and send
    
    // Step 2: Process the audio data
    const processedData = await processAudioData(audioData, targetSampleRate);
    
    onProgress(0.7); // 70% - processed, now sending
    
    // Step 3: Send to API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      body: processedData
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    onProgress(1.0); // 100% - done
    
    return await response.json();
  } catch (error) {
    console.error('NeuroSync error:', error);
    throw error;
  }
  
  // Helper: Get ArrayBuffer from Blob
  async function getArrayBufferFromBlob(blob) {
    // For audio files, we need to decode them properly
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }
  
  // Helper: Process audio data for the API
  async function processAudioData(arrayBuffer, targetSampleRate) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    try {
      // Decode the audio
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get raw audio data
      const rawData = audioBuffer.getChannelData(0);
      
      // Resample if needed
      const resampledData = 
        audioBuffer.sampleRate !== targetSampleRate 
          ? resampleAudio(rawData, audioBuffer.sampleRate, targetSampleRate)
          : rawData;
      
      // Convert to 16-bit PCM (the format the API expects)
      const pcmData = floatTo16BitPCM(resampledData);
      
      return pcmData.buffer;
    } finally {
      // Close the audio context when done
      if (audioContext.state !== 'closed') {
        await audioContext.close();
      }
    }
  }
  
  // Helper: Resample audio
  function resampleAudio(audioData, originalSampleRate, targetSampleRate) {
    if (originalSampleRate === targetSampleRate) {
      return audioData;
    }
    
    const ratio = targetSampleRate / originalSampleRate;
    const newLength = Math.round(audioData.length * ratio);
    const result = new Float32Array(newLength);
    
    // Linear interpolation resampling
    for (let i = 0; i < newLength; i++) {
      const position = i / ratio;
      const lowerIndex = Math.floor(position);
      const upperIndex = Math.min(lowerIndex + 1, audioData.length - 1);
      const alpha = position - lowerIndex;
      
      result[i] = audioData[lowerIndex] * (1 - alpha) + audioData[upperIndex] * alpha;
    }
    
    return result;
  }
  
  // Helper: Convert Float32Array to Int16Array
  function floatTo16BitPCM(floatData) {
    const pcmData = new Int16Array(floatData.length);
    
    for (let i = 0; i < floatData.length; i++) {
      const s = Math.max(-1, Math.min(1, floatData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    return pcmData;
  }
};

// Initialize TTS with URL parameters on script load
document.addEventListener('DOMContentLoaded', function() {
    TTS.configure(new URLSearchParams(window.location.search));
	
	const volumeSlider = document.getElementById('volumeSlider');
	if (volumeSlider) {
		volumeSlider.value = TTS.volume * 100;
		
		// Add event listener to update TTS.volume when slider changes
		volumeSlider.addEventListener('input', function() {
			TTS.volume = this.value / 100;
			
			// Also update any current audio element
			if (TTS.audio) {
				TTS.audio.volume = TTS.volume;
			}
		});
	}
	
	const ttsButton = document.getElementById('tts');
    if (ttsButton) {
        ttsButton.addEventListener('click', function() {
            TTS.toggle();
        });
    }
});

/**
 * Configure the TTS system based on URL parameters
 * @param {URLSearchParams} urlParams - URL parameters
 */
TTS.configure = function(urlParams) {
    // Voice gender
    if (urlParams.has("gender")) {
        TTS.voiceGender = urlParams.get("gender") || "MALE";
    }

    // Volume
    if (urlParams.has("volume")) {
        TTS.volume = urlParams.get("volume") || 1;
        TTS.volume = parseFloat(TTS.volume);
        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) volumeSlider.value = TTS.volume * 100;
    }

    // Pitch
    if (urlParams.has("pitch")) {
        TTS.pitch = urlParams.get("pitch") || 1;
        TTS.pitch = parseFloat(TTS.pitch);
    }

    // Rate
    if (urlParams.has("rate")) {
        TTS.rate = urlParams.get("rate") || 1;
        TTS.rate = parseFloat(TTS.rate);
    }

    // Voice latency
    if (urlParams.has("latency")) {
        TTS.voiceLatency = urlParams.get("latency") || 0;
        TTS.voiceLatency = parseInt(TTS.voiceLatency) || 0;
    }
	
	// Voice latency
    if (urlParams.has("latency")) {
        TTS.voiceLatency = urlParams.get("latency") || 0;
        TTS.voiceLatency = parseInt(TTS.voiceLatency) || 0;
    }
	
	if (urlParams.get("ttssources").trim()) {
		TTS.ttsSources = urlParams.get("ttssources").toLowerCase().split(",").map(element => element.trim());
	}
	
	if (urlParams.has("latency")) {
        TTS.readDonos  = urlParams.get("ttsdonos").trim() || "en-US";;
    }
	
    // API Keys
    TTS.GoogleAPIKey = urlParams.get("ttskey") || urlParams.get("googlettskey") || false;
    TTS.ElevenLabsKey = urlParams.get("elevenlabskey") || false;
    TTS.SpeechifyAPIKey = urlParams.get("speechifykey") || false;
    TTS.useKokoroTTS = urlParams.has("kokorotts") || urlParams.has("kokoro") || false;

    // Provider selection
    TTS.TTSProvider = urlParams.get("ttsprovider") || "system";

    // Validate provider selection
    if (TTS.TTSProvider !== "system") {
        if (TTS.TTSProvider === "kokoro") {
            TTS.useKokoroTTS = true;
        } else if (TTS.TTSProvider === "elevenlabs" && !TTS.ElevenLabsKey) {
            console.warn("ElevenLabs selected but no API key provided. Falling back to system TTS.");
            TTS.TTSProvider = "system";
        } else if (TTS.TTSProvider === "google" && !TTS.GoogleAPIKey) {
            console.warn("Google Cloud selected but no API key provided. Falling back to system TTS.");
            TTS.TTSProvider = "system";
        } else if (TTS.TTSProvider === "speechify" && !TTS.SpeechifyAPIKey) {
            console.warn("Speechify selected but no API key provided. Falling back to system TTS.");
            TTS.TTSProvider = "system";
        }
    } else {
        // Backwards compatibility
        if (TTS.useKokoroTTS) {
            TTS.TTSProvider = "kokoro";
        } else if (TTS.GoogleAPIKey) {
            TTS.TTSProvider = "google";
        } else if (TTS.ElevenLabsKey) {
            TTS.TTSProvider = "elevenlabs";
        } else if (TTS.SpeechifyAPIKey) {
            TTS.TTSProvider = "speechify";
        }
    }

    // Create audio element for non-system TTS providers
    if (TTS.TTSProvider !== "system") {
        TTS.audio = document.createElement("audio");
        TTS.audio.onended = TTS.finishedAudio;
    }

    // Kokoro settings
    TTS.kokoroSettings.speed = urlParams.has("korospeed") ? parseFloat(urlParams.get("korospeed")) || 1.0 : TTS.rate;
    TTS.kokoroSettings.voiceName = urlParams.get("voicekokoro") || "af_aoede";

    // Google Cloud settings
    TTS.googleSettings.rate = urlParams.has("googlerate") ? parseFloat(urlParams.get("googlerate")) || 1 : TTS.rate;
    TTS.googleSettings.pitch = urlParams.has("googlepitch") ? parseFloat(urlParams.get("googlepitch")) || 0 : 0;
    TTS.googleSettings.audioProfile = urlParams.get("googleaudioprofile") || false;
    TTS.googleSettings.voiceName = urlParams.get("voicegoogle") || false;

    // ElevenLabs settings
    TTS.elevenLabsSettings.latency = urlParams.has("elevenlatency") ? parseInt(urlParams.get("elevenlatency")) || 0 : TTS.voiceLatency;
    TTS.elevenLabsSettings.stability = urlParams.has("elevenstability") ? parseFloat(urlParams.get("elevenstability")) || 0.5 : 0.5;
    TTS.elevenLabsSettings.similarity = urlParams.has("elevensimilarity") ? parseFloat(urlParams.get("elevensimilarity")) || 0.75 : 0.75;
    TTS.elevenLabsSettings.style = urlParams.has("elevenstyle") ? parseFloat(urlParams.get("elevenstyle")) || 0.5 : 0.5;
    TTS.elevenLabsSettings.speakingRate = urlParams.has("elevenrate") ? parseFloat(urlParams.get("elevenrate")) || 1.0 : 1.0;
    TTS.elevenLabsSettings.speakerBoost = urlParams.has("elevenspeakerboost");
    TTS.elevenLabsSettings.voiceName = urlParams.get("voice11") || urlParams.get("elevenlabsvoice") || false;
    TTS.elevenLabsSettings.model = urlParams.get("elevenlabsmodel") || "eleven_multilingual_v2";

    // Speechify settings
    TTS.speechifySettings.speed = urlParams.has("speechifyspeed") ? parseFloat(urlParams.get("speechifyspeed")) || 1.0 : TTS.rate;
    TTS.speechifySettings.model = urlParams.get("speechifymodel") || 'simba-english';
    TTS.speechifySettings.voiceName = urlParams.get("voicespeechify") || false;

    // Enable speech if specified
    if (urlParams.has("speech") || urlParams.has("speak") || urlParams.has("tts")) {
        if (document.getElementById("tts")) {
            document.getElementById("tts").dataset.state = 1;
            document.getElementById("tts").classList.remove("hidden");
            document.getElementById("tts").style["background-image"] = "url(./icons/tts_incoming_messages_on.png)";
            document.getElementById("tts").title = "Text-to-speech — 🔊⏹ Stop reading incoming messages out-loud with text-to-speech";
        }
        TTS.speech = true;
        TTS.speechLang = urlParams.get("speech") || urlParams.get("speak") || urlParams.get("tts") || TTS.speechLang;

        if (TTS.speechLang.split("-")[0].toLowerCase() == "en") {
            TTS.English = true;
        } else {
            TTS.English = false;
        }
    }

    // Language settings
    if (urlParams.get("language") || urlParams.get("lang") || urlParams.get("ln")) {
        TTS.speechLang = urlParams.get("language") || urlParams.get("lang") || urlParams.get("ln");
        if (TTS.speechLang.split("-")[0].toLowerCase() == "en") {
            TTS.English = true;
        } else {
            TTS.English = false;
        }
    }

    // Simplified TTS
    if (urlParams.has("simpletts")) {
        TTS.English = false;
    }


    if (urlParams.has("skipmessages")) {
        TTS.skipTTSMessages = parseInt(urlParams.get("skipmessages")) || 3;
    }

    if (urlParams.has("readevents")) {
        TTS.doNotReadEvents = false;
    }

    if (urlParams.has("neurosync")) {
        TTS.neuroSyncEnabled = true;
    }

    if (urlParams.has("bottts")) {
        TTS.bottts = true;
    }

    if (urlParams.has("modtts")) {
        TTS.modtts = true;
    }

    if (urlParams.has("hosttts")) {
        TTS.hosttts = true;
    }

    if (urlParams.has("admintts")) {
        TTS.admintts = true;
    }

    if (urlParams.has("viptts")) {
        TTS.viptts = true;
    }

    if (urlParams.has("allowbottss")) {
        TTS.allowbottss = true;
    }

    if (urlParams.has("norelfectionstts")) {
        TTS.norelfectionstts = true;
    }

    if (urlParams.has("allowhosttss")) {
        TTS.allowhosttss = true;
    }

    if (urlParams.has("allowmodtss")) {
        TTS.allowmodtss = true;
    }

    if (urlParams.has("allowadmintss")) {
        TTS.allowadmintss = true;
    }

    if (urlParams.has("allowviptss")) {
        TTS.allowviptss = true;
    }

    // Voice names
    if (urlParams.has("voice")) {
        TTS.voiceName = urlParams.get("voice") || "google";
    }

    if (urlParams.has("voicegoogle")) {
        TTS.googleSettings.voiceName = urlParams.get("voicegoogle");
    }

    if (urlParams.has("voice11") || urlParams.has("elevenlabsvoice")) {
        TTS.elevenLabsSettings.voiceName = urlParams.get("voice11") || urlParams.get("elevenlabsvoice");
    }

    if (urlParams.has("voicespeechify")) {
        TTS.speechifySettings.voiceName = urlParams.get("voicespeechify");
    }

    // Simplified TTS chatname
    if (urlParams.has("simpletts2")) {
        TTS.ttsSpeakChatname = false;
        TTS.English = false;
    }

    // TTS command
    if (urlParams.has("ttscommand")) {
        TTS.ttscommand = urlParams.get("ttscommand") || "!say";
    }

    if (urlParams.has("ttscommandmembersonly")) {
        TTS.ttscommandmembersonly = true;
    }

    // Initialize Kokoro if needed
    if (TTS.useKokoroTTS) {
        try {
            TTS.initKokoro();
        } catch(e) {
            console.error("Failed to load Kokoro TTS", e);
        }
    }
	
	if (document.getElementById("tts")) {
		document.getElementById("tts").classList.remove("hidden");
		document.getElementById("tts").style.display = "";
		
		// Update button state based on current settings
		if (TTS.speech) {
			TTS.updateButtonState('on');
		} else {
			TTS.updateButtonState('off');
		}
	}
};

/**
 * Replace URLs in text with a replacement string
 * @param {string} text - Text to process
 * @param {string} replacement - Replacement text for URLs
 * @returns {string} - Processed text
 */
TTS.replaceURLsWithSubstring = function(text, replacement = "[Link]") {
    if (typeof text !== "string") return text;
    
    try {
        const urlPattern = /(?:(?:https?:\/\/)?(?:www\.)?)?(?!-)[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s]*)?(?=\s|$)|(?:https?:\/\/)[^\s]+/g;
        
        return text.replace(urlPattern, (match) => {
            // Skip emoticons and similar patterns
            if (/^[a-zA-Z0-9](?:\.[a-zA-Z0-9]){1,2}$/.test(match) && 
                match.length <= 5 && 
                !match.includes('/')) {
                return match;
            }
            
            // Always replace if it has a protocol or www
            if (match.startsWith('http') || match.startsWith('www.')) {
                return replacement;
            }
            
            // Check TLD for bare domains
            const parts = match.split('.');
            const potentialTLD = parts[parts.length - 1].split(/[/?#]/)[0];
            
            // Replace if it has a valid TLD or contains a path
            if (match.includes('/') || TTS.isValidTLD(potentialTLD)) {
                return replacement;
            }
            
            return match;
        });
    } catch (e) {
        console.error(e);
        return text;
    }
};

/**
 * Check if a string is a valid TLD
 * @param {string} tld - TLD to check
 * @returns {boolean} - Whether it's a valid TLD
 */
TTS.isValidTLD = function(tld) {
    // This is a simplified check
    const commonTLDs = ['com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'ai', 'app', 'dev'];
    return commonTLDs.includes(tld.toLowerCase());
};

/**
 * Clean up excessive punctuation
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text
 */
TTS.cleanPunctuation = function(text) {
    if (!text) return text;
    
    return text
        .replace(/[.]{2,}/g, '.')
        .replace(/[?]{2,}/g, '?')
        .replace(/[!]{2,}/g, '!')
        .replace(/[,]{2,}/g, ',')
        .replace(/[:]{2,}/g, ':')
        .replace(/[;]{2,}/g, ';')
        .replace(/[-]{2,}/g, '-')
        .replace(/^[\s.!?,;:-]+$/, '')
        .trim();
};

/**
 * Update the TTS button state
 * @param {string} state - 'speaking', 'on', or 'off'
 */
TTS.updateButtonState = function(state) {
    const ttsButton = document.getElementById("tts");
    if (!ttsButton) return;
    
    switch(state) {
        case 'speaking':
            ttsButton.style["background-image"] = "url(./icons/tts_stop.png)";
            ttsButton.title = "Text-to-speech — ⏹🔊 Stop reading out-loud with text-to-speech";
            break;
        case 'on':
            ttsButton.style["background-image"] = "url(./icons/tts_incoming_messages_on.png)";
            ttsButton.title = "Text-to-speech — 🔊⏹ Stop reading incoming messages out-loud with text-to-speech";
            break;
        case 'off':
            ttsButton.style["background-image"] = "url(./icons/tts_incoming_messages_off.png)";
            ttsButton.title = "Text-to-speech — 🔊 Start reading incoming messages out-loud with text-to-speech";
            break;
    }
};

/**
 * Speak text using the configured TTS system
 * @param {string} text - Text to speak
 * @param {boolean} allow - Whether to allow speech even if speech is disabled
 */
TTS.speak = function(text, allow = false) {
    if (!TTS.speech && !allow) {
        return;
    }
    
    text = TTS.cleanPunctuation(text);
    
    if (!text) {
        return;
    }
    
    if (text.startsWith("!")) {
        return;
    } // do not TTS commands.

    if (TTS.replaceURLInLink) { 
        text = TTS.replaceURLsWithSubstring(text, "Link");
    }
	
	TTS.initAudioContext();

    // Use the selected provider
    switch (TTS.TTSProvider) {
        case "kokoro":
            if (!TTS.premiumQueueActive) {
                TTS.kokoroTTS(text);
            } else {
                TTS.premiumQueueTTS.push(text);
            }
            return;
        case "google":
            if (TTS.GoogleAPIKey) {
                if (!TTS.premiumQueueActive) {
                    TTS.googleTTS(text);
                } else {
                    TTS.premiumQueueTTS.push(text);
                }
                return;
            }
            break;
        case "elevenlabs":
            if (TTS.ElevenLabsKey) {
                if (!TTS.premiumQueueActive) {
                    TTS.ElevenLabsTTS(text);
                } else {
                    TTS.premiumQueueTTS.push(text);
                }
                return;
            }
            break;
        case "speechify":
            if (TTS.SpeechifyAPIKey) {
                if (!TTS.premiumQueueActive) {
                    TTS.SpeechifyTTS(text);
                } else {
                    TTS.premiumQueueTTS.push(text);
                }
                return;
            }
            break;
    }

    if (!TTS.voices && TTS.voices === null) {
        return;
    }
    // system tts instead
    if (!TTS.voice) {
        if (!TTS.voices || !TTS.voices.length) {
            if (window.speechSynthesis) {
                TTS.voices = window.speechSynthesis.getVoices();
            }
        }
        if (TTS.voices) {
            TTS.voices.forEach(vce => {
                if (vce.name && TTS.voiceName && vce.name.toLowerCase().includes(TTS.voiceName.toLowerCase())) {
                    if (vce.lang && vce.lang.toLowerCase() == TTS.speechLang.toLowerCase()) {
                        TTS.voice = vce;
                    } else if (!TTS.voice && vce.lang && vce.lang.split("-")[0].toLowerCase() == TTS.speechLang.split("-")[0].toLowerCase()) {
                        TTS.voice = vce;
                    }
                } else if (vce.name && vce.name.includes("Siri")) {
                    // SIRI sucks and breaks a lot, so lets skip if possible.
                    return;
                } else if (!TTS.voice && vce.lang && vce.lang.toLowerCase() == TTS.speechLang.toLowerCase()) {
                    TTS.voice = vce;
                } else if (!TTS.voice && vce.lang && vce.lang.split("-")[0].toLowerCase() == TTS.speechLang.split("-")[0].toLowerCase()) {
                    TTS.voice = vce;
                }
            });
        }
        if (!TTS.voice && TTS.voices?.length) {
            TTS.voice = TTS.voices.shift(); // take the first/default voice
        }
        if (TTS.voice) {
            if (TTS.voice.lang && TTS.voice.lang.split("-")[0].toLowerCase() != "en") {
                TTS.English = false;
            }
        }
    }
    
    if (!window.SpeechSynthesisUtterance) {
        return;
    }

    var speechInput = new SpeechSynthesisUtterance();
    if (!TTS.voice) {
        speechInput.lang = TTS.speechLang;
    } else {
        speechInput.voice = TTS.voice;
    }
    speechInput.volume = TTS.volume;
    speechInput.rate = TTS.rate;
    speechInput.pitch = TTS.pitch;
    speechInput.text = text;

    if (window.speechSynthesis) {
        window.speechSynthesis.speak(speechInput);
        TTS.updateButtonState('speaking');
    }

    try {
        speechInput.addEventListener("end", function (e) {
            if (window.speechSynthesis.pending || window.speechSynthesis.speaking) {
                TTS.updateButtonState('speaking');
            } else if (!TTS.speech) {
                TTS.updateButtonState('off');
            } else {
                TTS.updateButtonState('on');
            }
        });
    } catch (e) {
        console.error(e);
    }
};

/**
 * Clear the TTS queue without stopping
 */
TTS.clearQueue = function() {
    // clear but don't stop tts
    if (window.speechSynthesis && (window.speechSynthesis.pending || window.speechSynthesis.speaking)) {
        window.speechSynthesis.cancel();
    } else if (TTS.premiumQueueActive) {
        TTS.premiumQueueTTS = [];
        try {
            if (TTS.audio) {
                TTS.audio.pause();
            }
        } catch (e) {
			console.warn(e);
		}
    }
};

/**
 * Toggle TTS on/off
 */
TTS.toggle = function() {
    var ele = document.getElementById("tts");

    if (window.speechSynthesis && (window.speechSynthesis.pending || window.speechSynthesis.speaking)) {
        // clear and stop tts
        TTS.speech = false;
        window.speechSynthesis.cancel();
    } else if (TTS.premiumQueueActive) {
        TTS.speech = false;
        TTS.premiumQueueTTS = [];
        try {
            if (TTS.audio) {
                TTS.audio.pause();
            }
        } catch (e) {
			console.warn(e);
		}
        TTS.premiumQueueActive = false;
    } else {
        TTS.speech = !TTS.speech;
    }

    if (TTS.speech) {
        TTS.updateButtonState('on');
    } else {
        TTS.updateButtonState('off');
    }
};

/**
 * Process chat message data and speak it
 * @param {Object} data - Message data with properties like id, chatname, hasDonation, etc.
 * @param {boolean} allow - Whether to allow speech even if speech is disabled
 */
TTS.speechMeta = function(data, allow = false) {
    if (TTS.skipTTSMessages && !data.hasDonation) {
        if (parseInt(data.id||0) % TTS.skipTTSMessages !== 0) {
            return;
        }
    }
    
    if (!data.bot && TTS.bottts) return; // only allow bot messages
    else if (!data.host && TTS.hosttts) return; 
    else if (!data.mod && TTS.modtts) return;
    else if (!data.vip && TTS.viptts) return; 
    else if (!data.admin && TTS.admintts) return;
    
    else if (data.bot && !(TTS.allowbottss || TTS.bottts)) return; // do not read out bot messages
    else if (data.host && !(TTS.allowhosttss || TTS.hosttts)) return; 
    
    else if (data.reflection && TTS.norelfectionstts) return;
    
    else if (TTS.ttsSources && !TTS.ttsSources.includes(data.type)) return;
    
    if (TTS.readDonos && !(data.hasDonation || data.donation)) return;

    if (TTS.doNotReadEvents && data.event) {
        return;
    }
    try {
        var isCommand = false;
        var msgPlain = document.getElementById("content_" + data.id);

        if (msgPlain) {
            msgPlain = (msgPlain.textContent || msgPlain.innerText || "") // Remove emojis, underscores, and @ symbols
                .replace(/[\u2700-\u27BF\uE000-\uF8FF\uD83C\uD800-\uDFFF\uD83E\uD810-\uDFFF\u2011-\u26FF]/g, "")
                .replace(/_/g, " ")
                .replace(/@/g, " ")
                
            if (TTS.ttscommand && msgPlain.includes(TTS.ttscommand+" ")) {
                msgPlain = msgPlain.split(TTS.ttscommand+" ")[1].trim();
                allow = true;
            }
            
            msgPlain = msgPlain.replace(/^!/, ""); // check if it starts with '!'
            msgPlain = msgPlain.replace(/!+/g, " "); // Replace multiple '!' with a single space
            msgPlain = msgPlain.replace(/catJAM/gi, ""); // Remove 'catJAM' case-insensitively
            if (TTS.beepwords) {
                msgPlain = msgPlain.replace(/\*+/g, ' beep ');
            } else {
                msgPlain = msgPlain.replace(/\*/g, '');
            }
            msgPlain = msgPlain.trim();
        } else if (data.chatmessage){
			msgPlain = data.chatmessage;
		}

        var chatname = "";
        if (TTS.ttsSpeakChatname && data.chatname) {
            chatname = data.chatname.toLowerCase().replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, "");
            chatname = chatname.replaceAll("_", " ");
            chatname = chatname.replaceAll("@", " ");
            chatname = chatname.replaceAll("!", " ");
        }

        if (data.hasDonation) {
            var donoText = document.createElement("div");
            donoText.innerHTML = data.hasDonation;
            donoText = donoText.textContent || donoText.innerText || "";
            donoText = donoText.toLowerCase().replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, "");
            donoText = donoText.replaceAll("_", " ");
            donoText = donoText.replaceAll("@", " ");
            donoText = donoText.replaceAll("!", " ");

            if (chatname) {
                ///// NAME
                if (TTS.English) {
                    if (msgPlain) {
                        TTS.speak(chatname + " has donated " + donoText + " and says " + msgPlain, allow);
                    } else {
                        TTS.speak(chatname + " has donated " + donoText, allow);
                    }
                } else if (msgPlain) {
                    TTS.speak(chatname + "! ! .. " + donoText + "! ! .. " + msgPlain, allow);
                } else {
                    TTS.speak(chatname + "! ! .. " + donoText, allow);
                }
            } else if (TTS.English) {
                // no name but english
                if (msgPlain) {
                    TTS.speak("Someone has donated " + donoText + " and says " + msgPlain, allow);
                } else {
                    TTS.speak("Someone has donated " + donoText, allow);
                }
            } else if (msgPlain) {
                // no name; not english
                TTS.speak(donoText + "! ! .. " + msgPlain, allow);
            } else {
                TTS.speak(donoText, allow);
            }
        } else if (msgPlain) {
            // NO DONATION
            if (chatname) {
                // NAME
                if (TTS.English) {
                    TTS.speak(chatname + " says! " + msgPlain, allow);
                } else {
                    TTS.speak(chatname + "! ! .. " + msgPlain, allow);
                }
            } else if (TTS.English) {
                // NO NAME
                TTS.speak("Someone says! " + msgPlain, allow);
            } else {
                TTS.speak(msgPlain, allow);
            }
        }
    } catch(e){
        console.error(e);
    }
};

/**
 * Initialize the Kokoro TTS system
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
TTS.initKokoro = async function() {
    if (window.electronApi) {
        return true; // Electron already handles this
    }
    if (TTS.kokoroDownloadInProgress) return false;
    if (TTS.kokoroTtsInstance) return true;
    
    try {
        TTS.kokoroDownloadInProgress = true;
        console.log("Loading Kokoro dependencies...");
        
        // Import the module using the same path pattern as the working version
        const relativePath = window.location.href.startsWith("chrome-extension://") 
            ? './thirdparty/kokoro-bundle.es.ext.js'
            : './thirdparty/kokoro-bundle.es.js'; // Changed to match working version path
        
        const module = await import(relativePath);
        
        TTS.KokoroTTS = module.KokoroTTS;
        TTS.TextSplitterStream = module.TextSplitterStream;
        const detectWebGPU = module.detectWebGPU;
        
        // Use the same WebGPU detection as the working version
        const device = (await detectWebGPU()) ? "webgpu" : "wasm";
        console.log("Using device:", device);
        
        // Open indexedDB to check for cached model
        async function openDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('kokoroTTS', 1);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('models')) {
                        db.createObjectStore('models');
                    }
                };
            });
        }

        async function getCachedModel() {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('models', 'readonly');
                const store = transaction.objectStore('models');
                const request = store.get('kokoro-82M-v1.0');
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
        }

        async function cacheModel(modelData) {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('models', 'readwrite');
                const store = transaction.objectStore('models');
                const request = store.put(modelData, 'kokoro-82M-v1.0');
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        }
        
        console.log("Checking cache for model...");
        let modelData = await getCachedModel();
        
        if (!modelData) {
            console.log("Downloading model...");
            const modelUrl = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx';
            const response = await fetch(modelUrl);
            const total = +response.headers.get('Content-Length');
            let loaded = 0;
            
            const reader = response.body.getReader();
            const chunks = [];
            
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                
                chunks.push(value);
                loaded += value.length;
                
                const percentage = (loaded / total) * 100;
                console.log(`Downloading model: ${percentage.toFixed(1)}%`);
            }
            
            const modelBlob = new Blob(chunks);
            modelData = new Uint8Array(await modelBlob.arrayBuffer());
            
            console.log("Caching model...");
            await cacheModel(modelData);
        } else {
            console.log("Loading model from cache");
        }
        
        console.log("Initializing Kokoro TTS...");
        const customLoadFn = async () => modelData;
        
        // Use the same model initialization parameters as working version
        TTS.kokoroTtsInstance = await TTS.KokoroTTS.from_pretrained(
            "onnx-community/Kokoro-82M-v1.0-ONNX",
            {
                dtype: device === "wasm" ? "q8" : "fp32", // Match working version
                device,
                load_fn: customLoadFn
            }
        );
        
        console.log("Kokoro TTS ready!");
        TTS.kokoroDownloadInProgress = false;
        return true;
    } catch (error) {
        console.error('Failed to initialize Kokoro:', error);
        TTS.kokoroDownloadInProgress = false;
        return false;
    }
};

/**
 * ElevenLabs TTS implementation
 * @param {string} tts - Text to speak
 */
TTS.ElevenLabsTTS = function(tts) {
    try {
        TTS.premiumQueueActive = true;
        const voiceid = TTS.elevenLabsSettings.voiceName || "VR6AewLTigWG4xSOukaG";
        const url = "https://api.elevenlabs.io/v1/text-to-speech/" + voiceid + "/stream?optimize_streaming_latency=" + TTS.elevenLabsSettings.latency;

        var data = {
            text: tts,
            model_id: TTS.elevenLabsSettings.model,
            voice_settings: {
                stability: TTS.elevenLabsSettings.stability,
                similarity_boost: TTS.elevenLabsSettings.similarity,
                style: TTS.elevenLabsSettings.style,
                use_speaker_boost: TTS.elevenLabsSettings.speakerBoost,
                speaking_rate: TTS.elevenLabsSettings.speakingRate
            }
        };

        const otherparam = {
            headers: {
                "content-type": "application/json",
                "xi-api-key": TTS.ElevenLabsKey,
                accept: "*/*"
            },
            body: JSON.stringify(data),
            method: "POST"
        };

        fetch(url, otherparam)
            .then(data => data.blob())
            .then(async res => {
                const newBlob = new Blob([res]);
                
                // Send to NeuroSync in parallel
                if (TTS.neuroSyncEnabled) {
                  TTS.sendToNeuroSync(newBlob).then(result => {
                    if (result && result.blendshapes) {
                      console.log(`Received ${result.blendshapes.length} blendshape frames`);
                    }
                  }).catch(err => {
                    console.error("NeuroSync error:", err);
                  });
                  return;
                }
                
                const blobUrl = window.URL.createObjectURL(newBlob);
                if (!TTS.audio) {
                    TTS.audio = document.createElement("audio");
                    TTS.audio.onended = TTS.finishedAudio;
                }
                TTS.audio.src = blobUrl;
                if (TTS.volume) {
                    TTS.audio.volume = TTS.volume;
                }
                
                try {
                    if (TTS.audioContext.state === 'suspended') {
                        await TTS.audioContext.resume();
                    }
                    TTS.audio.play();
                } catch (e) {
                    TTS.finishedAudio();
                    console.error("REMEMBER TO CLICK THE PAGE FIRST - audio won't play until you do");
                }
            })
            .catch(error => {
                TTS.finishedAudio();
                console.error(error);
            });
    } catch (e) {
        TTS.finishedAudio();
    }
};

/**
 * Google Cloud TTS implementation
 * @param {string} tts - Text to speak
 */
TTS.googleTTS = function(tts) {
    TTS.premiumQueueActive = true;

    try {
        const url = "https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=" + TTS.GoogleAPIKey;
        var data = {
            input: {
                text: tts
            },
            voice: {
                languageCode: TTS.speechLang.toLowerCase(),
                name: TTS.googleSettings.voiceName || "en-GB-Standard-A",
                ssmlGender: TTS.voiceGender ? TTS.voiceGender.toUpperCase() : "FEMALE"
            },
            audioConfig: {
                audioEncoding: "MP3",
                speakingRate: TTS.googleSettings.rate,
                pitch: TTS.googleSettings.pitch
            }
        };

        if (TTS.googleSettings.audioProfile) {
            data.audioConfig.effectsProfileId = [TTS.googleSettings.audioProfile];
        } else {
            data.audioConfig.effectsProfileId = ['handset-class-device'];
        }

        const otherparam = {
            headers: {
                "content-type": "application/json; charset=UTF-8"
            },
            body: JSON.stringify(data),
            method: "POST"
        };

        fetch(url, otherparam)
            .then(data => data.json())
            .then(async res => {
                
                // Send to NeuroSync in parallel
                if (TTS.neuroSyncEnabled) {
                  // Convert base64 to blob
                  const byteCharacters = atob(res.audioContent);
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  const audioBlob = new Blob([byteArray], {type: 'audio/mp3'});
                  
                  // Send to NeuroSync
                  TTS.sendToNeuroSync(audioBlob).then(result => {
                    if (result && result.blendshapes) {
                      // Do something with the blendshapes
                      console.log(`Received ${result.blendshapes.length} blendshape frames`);
                    }
                  }).catch(err => {
                    console.error("NeuroSync error:", err);
                  });
                  return;
                }
                
                if (!TTS.audio) {
                    TTS.audio = document.createElement("audio");
                    TTS.audio.onended = TTS.finishedAudio;
                }
                TTS.audio.src = "data:audio/mp3;base64," + res.audioContent;
                
                if (TTS.volume) {
                    TTS.audio.volume = TTS.volume;
                }
                try {
                    if (TTS.audioContext.state === 'suspended') {
                        await TTS.audioContext.resume();
                    }
                    TTS.audio.play();
                } catch (e) {
                    TTS.finishedAudio();
                    console.error("REMEMBER TO CLICK THE PAGE FIRST - audio won't play until you do");
                }
            })
            .catch(error => {
                TTS.finishedAudio();
                console.error(error);
            });
    } catch (e) {
        TTS.finishedAudio();
    }
};

/**
 * Speechify TTS implementation
 * @param {string} tts - Text to speak
 */
TTS.SpeechifyTTS = function(tts) {
    TTS.premiumQueueActive = true;
    try {
        const url = "https://api.sws.speechify.com/v1/audio/speech";
        let model = TTS.speechifySettings.model;
        const data = {
            input: "<speak>" + tts + "</speak>",
            voice_id: TTS.speechifySettings.voiceName || "henry",
            model: model,
            audio_format: "mp3",
            speed: TTS.speechifySettings.speed
        };
        
        const otherparam = {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${TTS.SpeechifyAPIKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        };
        
        fetch(url, otherparam)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(async json => {
                if (!json.audio_data) {
                    TTS.finishedAudio();
                    throw new Error("No audio data in JSON response");
                }
                try {
                    if (!TTS.audio) {
                        TTS.audio = document.createElement("audio");
                        TTS.audio.onended = TTS.finishedAudio;
                    }
                    TTS.audio.src = "data:audio/mp3;base64," + json.audio_data;
                    if (TTS.volume) {
                        TTS.audio.volume = TTS.volume;
                    }
                    if (TTS.audioContext.state === 'suspended') {
                        await TTS.audioContext.resume();
                    }
                    TTS.audio.play().catch(err => {
                        console.error("Audio play failed, user interaction required", err);
                        TTS.finishedAudio();
                    });
                } catch (e) {
                    console.error(e);
                    TTS.finishedAudio();
                    console.error("REMEMBER TO CLICK THE PAGE FIRST - audio won't play until you do");
                }
            })
            .catch(error => {
                TTS.finishedAudio();
                console.error("Error with Speechify TTS:", error);
            });
    } catch (e) {
        TTS.finishedAudio();
        console.error("Error in SpeechifyTTS function:", e);
    }
};

/**
 * Kokoro TTS implementation
 * @param {string} text - Text to speak
 */
TTS.kokoroTTS = async function(text) {
  try {
    if (window.electronApi) {
      try {
        // Electron implementation remains the same
        const wavBuffer = await window.electronApi.tts(text, TTS.kokoroSettings);
        const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
        
        if (TTS.neuroSyncEnabled) {
          TTS.sendToNeuroSync(audioBlob, { 
            isKokoroAudio: true,
            onProgress: (progress) => {
              console.log(`NeuroSync processing: ${Math.round(progress * 100)}%`);
            }
          }).then(result => {
            if (result && result.blendshapes) {
              console.log(`Received ${result.blendshapes.length} blendshape frames`);
            }
          }).catch(err => {
            console.error("NeuroSync error:", err);
          });
          return;
        }
        
        if (!TTS.audio) {
			TTS.audio = document.createElement("audio");
			TTS.audio.onended = TTS.finishedAudio;
		}
        TTS.audio.src = URL.createObjectURL(audioBlob);
        
        if (TTS.volume) TTS.audio.volume = TTS.volume;
        
        TTS.audio.play();
        return;
      } catch (error) {
        console.error("Error playing TTS:", error);
        throw new Error("Error playing TTS. Try upgrading your app or perhaps your system isn't compatible");
      }
    }

    // Web implementation with fixes aligned to working version
    if (!TTS.kokoroTtsInstance) {
      const initialized = await TTS.initKokoro();
      if (!initialized || !TTS.kokoroTtsInstance) {
        console.error("Failed to initialize Kokoro TTS");
        TTS.finishedAudio();
        return;
      }
    }
    
    TTS.premiumQueueActive = true;
    
    // Create a new streamer for each text processing
    const streamer = new TTS.TextSplitterStream();
    streamer.push(text);
    streamer.close();
    
    if (!TTS.audio) {
		TTS.audio = document.createElement("audio");
		TTS.audio.onended = TTS.finishedAudio;
	}
    
    // Use the same stream options as the working version
    const speed = TTS.kokoroSettings.speed || 1.0;
    const selectedVoice = TTS.kokoroSettings.voiceName || "af_aoede"; // Use a specific default
    
    try {
      const stream = TTS.kokoroTtsInstance.stream(streamer, { 
        voice: selectedVoice,
        speed: speed,
        streamAudio: false
      });
      
      for await (const { audio } of stream) {
        if (!audio) continue;
        
        if (TTS.neuroSyncEnabled) {
          TTS.sendToNeuroSync(audio, { 
            isKokoroAudio: true,
            onProgress: (progress) => {
              console.log(`NeuroSync processing: ${Math.round(progress * 100)}%`);
            }
          }).then(result => {
            if (result && result.blendshapes) {
              console.log(`Received ${result.blendshapes.length} blendshape frames`);
            }
          }).catch(err => {
            console.error("NeuroSync error:", err);
          });
          TTS.finishedAudio();
          return;
        }
        
        const audioBlob = audio.toBlob();
        TTS.audio.src = URL.createObjectURL(audioBlob);
        if (TTS.volume) TTS.audio.volume = TTS.volume;
        
        try {
          if (TTS.audioContext && TTS.audioContext.state === 'suspended') {
            await TTS.audioContext.resume();
          }
          await TTS.audio.play();
        } catch (e) {
          console.error("Audio playback failed:", e);
          TTS.finishedAudio();
        }
      }
    } catch (err) {
      console.error("Stream processing error:", err);
      TTS.finishedAudio();
    }
  } catch (e) {
    console.error("Kokoro TTS error:", e);
    TTS.finishedAudio();
  }
};