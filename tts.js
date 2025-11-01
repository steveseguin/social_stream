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
TTS.kokoroDevice = null;

// eSpeak TTS variables
TTS.espeakLoaded = false;
TTS.espeakInstance = null;
TTS.espeakSettings = {
    voice: 'en',
    speed: 175,
    pitch: 50,
    variant: 0
};

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
            //console.log("New AudioContext created:", TTS.audioContext.state);
        }
        
        // Resume context if suspended
        if (TTS.audioContext.state === 'suspended') {
            //console.log("Attempting to resume suspended AudioContext");
            TTS.audioContext.resume().then(() => {
                //console.log("AudioContext resumed successfully");
            }).catch(err => {
                console.warn("Could not resume audio context:", err);
            });
        } else {
            //console.log("AudioContext state:", TTS.audioContext.state);
        }
        
        return TTS.audioContext;
    } catch(e) {
        console.error("Web Audio API not supported", e);
        return null;
    }
};

document.addEventListener('click', function() {
    //console.log("Document clicked, initializing AudioContext");
    TTS.initAudioContext();
    // Try to play a silent sound to unblock audio
    try {
        const silentSound = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
        const audioBuffer = TTS.audioContext.createBuffer(1, 8, 44100);
        const source = TTS.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(TTS.audioContext.destination);
        source.start(0);
        //console.log("Silent sound played to unblock audio");
    } catch (e) {
        console.warn("Failed to play silent sound:", e);
    }
}, { once: true });

document.addEventListener('keydown', function() {
    //console.log("Key pressed, initializing AudioContext");
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
                //console.log("Voices loaded:", TTS.voices.length);
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
    model: "eleven_flash_v2_5" // Default to fastest model for streaming
};

TTS.speechifySettings = {
    speed: 1.0,
    model: 'simba-english',
    voiceName: false
};

TTS.openAISettings = {
    apiKey: false,
    endpoint: "https://api.openai.com/v1/audio/speech",
    model: "tts-1",
    voice: "alloy",
    responseFormat: "mp3",
    speed: 1.0
};

TTS.kokoroDownloadInProgress = null;
TTS.kokoroTtsInstance = null;
TTS.kokoroSettings = {
    rate: false,
    voiceName: false,
    model: "kokoro-82M-v1.0"
};

TTS.piperLoaded = false;
TTS.piperInstance = null;
TTS.piperSettings = {
    voice: 'en_US-hfc_female-medium',
    speed: 1.0
};

TTS.kittenLoaded = false;
TTS.kittenInstance = null;
TTS.kittenSettings = {
    voice: 'af_aoede',
    speed: 1.0,
    sampleRate: 24000
};

// TTS providers
TTS.GoogleAPIKey = false;
TTS.ElevenLabsKey = false;
TTS.SpeechifyAPIKey = false;
TTS.OpenAIAPIKey = false;
TTS.useKokoroTTS = false;
TTS.usePiper = false;
TTS.useEspeak = false;
TTS.useKitten = false;
TTS.KokoroTTS = false;
TTS.PiperModule = null;
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
TTS.membertts = false;
TTS.allowbottts = false;
TTS.norelfectionstts = false;
TTS.allowhosttts = false;
TTS.allowmodtts = false;
TTS.allowadmintts = false;
TTS.allowviptts = false;
TTS.allowmembertts = false;
TTS.voiceName = false;
TTS.skipTTSMessages = false;
TTS.beepwords = false;
TTS.readDonos = false;
TTS.disableTTS = false;
TTS.ttsSources = false;
TTS.ttsQuick = false;
TTS.newmembertts = false;
TTS.ttsclicked = false;

/**
 * Check if the browser is Safari
 * @returns {boolean}
 */
TTS.isSafari = function() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

/**
 * Check Kokoro TTS acceleration status
 * @returns {string} - Status message about Kokoro acceleration
 */
TTS.checkKokoroAcceleration = function() {
    if (!TTS.useKokoroTTS) {
        return "Kokoro TTS is not enabled";
    }
    if (!TTS.kokoroTtsInstance) {
        return "Kokoro TTS is not initialized yet";
    }
    if (TTS.kokoroDevice === "webgpu") {
        return "✅ Kokoro TTS is using WebGPU acceleration (fp32 precision)";
    } else if (TTS.kokoroDevice === "wasm") {
        return "⚠️ Kokoro TTS is using WebAssembly (WASM) fallback (q8 quantized)";
    } else {
        return "❓ Kokoro TTS device type unknown";
    }
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
	
	if (urlParams.has("notts")) {
        TTS.disableTTS = true;
    }
	
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
	
	if (urlParams.get("ttssources")) {
		TTS.ttsSources = urlParams.get("ttssources").toLowerCase().split(",").map(element => element.trim());
	}
	
	if (urlParams.has("ttsquick")) {
		TTS.ttsQuick = parseInt(urlParams.get("ttsquick")) || 80;
	}
	
	
	if (urlParams.has("ttsdonos")) {
        TTS.readDonos  = urlParams.get("ttsdonos").trim() || "en-US";;
    }
	
	if (urlParams.has("ttsnewmembers")) {
		TTS.newmembertts = urlParams.get("ttsnewmembers") || "en-US";
	}
	
	if (urlParams.has("ttsclicked")) {
		TTS.ttsclicked = urlParams.get("ttsclicked") || "en-US";
	}
	
    // API Keys
    TTS.GoogleAPIKey = urlParams.get("ttskey") || urlParams.get("googlettskey") || false;
    TTS.ElevenLabsKey = urlParams.get("elevenlabskey") || false;
    TTS.SpeechifyAPIKey = urlParams.get("speechifykey") || false;
    TTS.OpenAIAPIKey = urlParams.get("openaikey") || false;
    TTS.useKokoroTTS = urlParams.has("kokorotts") || urlParams.has("kokoro") || false;
    TTS.usePiper = urlParams.has("piper") || urlParams.has("pipertts") || false;
    TTS.useEspeak = urlParams.has("espeak") || urlParams.has("espeaktts") || false;
    TTS.useKitten = urlParams.has("kitten") || urlParams.has("kittentts") || false;

    // Provider selection
    TTS.TTSProvider = urlParams.get("ttsprovider") || "system";

    // Validate provider selection
    if (TTS.TTSProvider !== "system") {
        if (TTS.TTSProvider === "kokoro") {
            TTS.useKokoroTTS = true;
        } else if (TTS.TTSProvider === "piper") {
            TTS.usePiper = true;
        } else if (TTS.TTSProvider === "espeak") {
            TTS.useEspeak = true;
        } else if (TTS.TTSProvider === "kitten") {
            TTS.useKitten = true;
        } else if (TTS.TTSProvider === "elevenlabs" && !TTS.ElevenLabsKey) {
            console.warn("ElevenLabs selected but no API key provided. Falling back to system TTS.");
            TTS.TTSProvider = "system";
        } else if (TTS.TTSProvider === "google" && !TTS.GoogleAPIKey) {
            console.warn("Google Cloud selected but no API key provided. Falling back to system TTS.");
            TTS.TTSProvider = "system";
        } else if (TTS.TTSProvider === "speechify" && !TTS.SpeechifyAPIKey) {
            console.warn("Speechify selected but no API key provided. Falling back to system TTS.");
            TTS.TTSProvider = "system";
        } else if (TTS.TTSProvider === "openai" && !TTS.OpenAIAPIKey) {
            console.warn("OpenAI selected but no API key provided. Falling back to system TTS.");
            TTS.TTSProvider = "system";
        }
    } else {
        // Backwards compatibility
        if (TTS.useEspeak) {
            TTS.TTSProvider = "espeak";
        } else if (TTS.useKitten) {
            TTS.TTSProvider = "kitten";
        } else if (TTS.usePiper) {
            TTS.TTSProvider = "piper";
        } else if (TTS.useKokoroTTS) {
            TTS.TTSProvider = "kokoro";
        } else if (TTS.GoogleAPIKey) {
            TTS.TTSProvider = "google";
        } else if (TTS.ElevenLabsKey) {
            TTS.TTSProvider = "elevenlabs";
        } else if (TTS.SpeechifyAPIKey) {
            TTS.TTSProvider = "speechify";
        } else if (TTS.OpenAIAPIKey) {
            TTS.TTSProvider = "openai";
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

    // Piper TTS settings  
    TTS.piperSettings.speed = urlParams.has("piperspeed") ? parseFloat(urlParams.get("piperspeed")) || 1.0 : 1.0;
    TTS.piperSettings.voice = urlParams.get("pipervoice") || "en_US-hfc_female-medium";
    
    // Available Piper voices for reference:
    // en_US-hfc_female-medium (default female voice)
    // en_US-amy-medium (alternative female voice)
    // en_US-danny-low (male voice, lower quality)
    // en_US-ryan-high (male voice, high quality)
    // en_GB-alan-low (British male)
    // en_GB-alba-medium (British female)

    // eSpeak TTS settings
    TTS.espeakSettings.voice = urlParams.get("espeakvoice") || "en";
    TTS.espeakSettings.speed = urlParams.has("espeakspeed") ? parseInt(urlParams.get("espeakspeed")) || 140 : 140; // Slower for clarity
    TTS.espeakSettings.pitch = urlParams.has("espeakpitch") ? parseInt(urlParams.get("espeakpitch")) || 50 : 50;
    TTS.espeakSettings.variant = urlParams.has("espeakvariant") ? parseInt(urlParams.get("espeakvariant")) || 0 : 0;

    // Kitten TTS settings
    TTS.kittenSettings.voice = urlParams.get("kittenvoice") || "expr-voice-4-f";
    TTS.kittenSettings.speed = urlParams.has("kittenspeed") ? parseFloat(urlParams.get("kittenspeed")) || 1.0 : 1.0;
    TTS.kittenSettings.sampleRate = urlParams.has("kittensamplerate") ? parseInt(urlParams.get("kittensamplerate")) || 24000 : 24000;

    // Google Cloud settings
    TTS.googleSettings.rate = urlParams.has("googlerate") ? parseFloat(urlParams.get("googlerate")) || 1 : TTS.rate;
    TTS.googleSettings.pitch = urlParams.has("googlepitch") ? parseFloat(urlParams.get("googlepitch")) || 0 : 0;
    TTS.googleSettings.audioProfile = urlParams.get("googleaudioprofile") || false;
    TTS.googleSettings.voiceName = urlParams.get("voicegoogle") || false;
	TTS.googleSettings.lang = urlParams.get("googlelang") || false;

    // ElevenLabs settings
    TTS.elevenLabsSettings.latency = urlParams.has("elevenlatency") ? parseInt(urlParams.get("elevenlatency")) || 0 : TTS.voiceLatency;
    TTS.elevenLabsSettings.stability = urlParams.has("elevenstability") ? parseFloat(urlParams.get("elevenstability")) || 0.5 : 0.5;
    TTS.elevenLabsSettings.similarity = urlParams.has("elevensimilarity") ? parseFloat(urlParams.get("elevensimilarity")) || 0.75 : 0.75;
    TTS.elevenLabsSettings.style = urlParams.has("elevenstyle") ? parseFloat(urlParams.get("elevenstyle")) || 0.5 : 0.5;
    TTS.elevenLabsSettings.speakingRate = urlParams.has("elevenrate") ? parseFloat(urlParams.get("elevenrate")) || 1.0 : 1.0;
    TTS.elevenLabsSettings.speakerBoost = urlParams.has("elevenspeakerboost");
    TTS.elevenLabsSettings.voiceName = urlParams.get("voice11") || urlParams.get("elevenlabsvoice") || false;
    TTS.elevenLabsSettings.model = urlParams.get("elevenlabsmodel") || "eleven_flash_v2_5";

    // Speechify settings
    TTS.speechifySettings.speed = urlParams.has("speechifyspeed") ? parseFloat(urlParams.get("speechifyspeed")) || 1.0 : TTS.rate;
    TTS.speechifySettings.model = urlParams.get("speechifymodel") || 'simba-english';
    TTS.speechifySettings.voiceName = urlParams.get("voicespeechify") || false;

    // OpenAI settings
    TTS.openAISettings.apiKey = TTS.OpenAIAPIKey;
    TTS.openAISettings.endpoint = urlParams.get("openaiendpoint") || "https://api.openai.com/v1/audio/speech";
    TTS.openAISettings.model = urlParams.get("openaimodel") || "tts-1";
    TTS.openAISettings.voice = urlParams.get("voiceopenai") || "alloy";
    TTS.openAISettings.responseFormat = urlParams.get("openaiformat") || "mp3";
    TTS.openAISettings.speed = urlParams.has("openaispeed") ? parseFloat(urlParams.get("openaispeed")) || 1.0 : TTS.rate;

    // Enable speech if specified
    if (TTS.readDonos || TTS.newmembertts || TTS.ttsclicked || urlParams.has("speech") || urlParams.has("speak") || urlParams.has("tts")) {
        if (document.getElementById("tts")) {
            document.getElementById("tts").dataset.state = 1;
            document.getElementById("tts").classList.remove("hidden");
            document.getElementById("tts").style["background-image"] = "url(./icons/tts_incoming_messages_on.png)";
            document.getElementById("tts").title = "Text-to-speech — 🔊⏹ Stop reading incoming messages out-loud with text-to-speech";
        }
        TTS.speech = true;
        TTS.speechLang = urlParams.get("speech") || urlParams.get("speak") || urlParams.get("tts") || TTS.readDonos || TTS.newmembertts || TTS.ttsclicked || TTS.speechLang;

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
	
	if (urlParams.has("readouturls")) {
        TTS.replaceURLInLink = false;
    }
	
    if (urlParams.has("neurosync")) {
        TTS.neuroSyncEnabled = true;
    }

    if (urlParams.has("beepwords")) {
        TTS.beepwords = true;
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
	
	if (urlParams.has("membertts")) {
        TTS.membertts = true;
    }

    if (urlParams.has("allowbottts")) {
        TTS.allowbottts = true;
    }

    if (urlParams.has("norelfectionstts")) {
        TTS.norelfectionstts = true;
    }

    if (urlParams.has("allowhosttts")) {
        TTS.allowhosttts = true;
    }

    if (urlParams.has("allowmodtts")) {
        TTS.allowmodtts = true;
    }

    if (urlParams.has("allowadmintts")) {
        TTS.allowadmintts = true;
    }

    if (urlParams.has("allowviptts")) {
        TTS.allowviptts = true;
    }
	
	if (urlParams.has("allowmembertts")) {
        TTS.allowmembertts = true;
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

    // Initialize Piper TTS if needed
    if (TTS.usePiper) {
        try {
            TTS.initPiper();
        } catch(e) {
            console.error("Failed to load Piper TTS", e);
        }
    }
    
    // Initialize eSpeak TTS if needed
    if (TTS.useEspeak) {
        try {
            TTS.initEspeak();
        } catch(e) {
            console.error("Failed to load eSpeak TTS", e);
        }
    }
    
    // Initialize Kitten TTS if needed
    if (TTS.useKitten) {
        try {
            TTS.initKitten();
        } catch(e) {
            console.error("Failed to load Kitten TTS", e);
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
    //console.log("TTS.speak called with:", text, "Allow:", allow, "TTS.speech:", TTS.speech);
    
    if (!TTS.speech && !allow) {
        //console.log("Speech is disabled and not forced, aborting");
        return;
    }
	
	if (TTS.disableTTS){
		//console.log("TTS is disabled globally, aborting");
		return;
	}
    
    text = TTS.cleanPunctuation(text);
    
    if (!text) {
        //console.log("No text to speak after cleaning");
        return;
    }
    
    if (text.startsWith("!")) {
        //console.log("Text starts with !, aborting");
        return;
    } // do not TTS commands.

    if (TTS.replaceURLInLink) { 
        text = TTS.replaceURLsWithSubstring(text, "Link");
    }
	
	if (TTS.ttsQuick){
		if (text.length > TTS.ttsQuick){
			text = text.substring(0, TTS.ttsQuick);
		}
	}
    
    //console.log("About to speak:", text);
	
	TTS.initAudioContext();

    // Use the selected provider
	switch (TTS.TTSProvider) {
		case "piper":
			if (!TTS.premiumQueueActive) {
				TTS.piperTTS(text);
			} else {
				TTS.premiumQueueTTS.push(text);
			}
			return;
		case "espeak":
			if (!TTS.premiumQueueActive) {
				TTS.espeakTTS(text);
			} else {
				TTS.premiumQueueTTS.push(text);
			}
			return;
		case "kitten":
			if (!TTS.premiumQueueActive) {
				// Call async function without awaiting to avoid blocking
				TTS.kittenTTS(text).catch(error => {
					console.error("Kitten TTS error:", error);
					TTS.finishedAudio();
				});
			} else {
				TTS.premiumQueueTTS.push(text);
			}
			return;
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
			return; // Change from break to return
		case "elevenlabs":
			if (TTS.ElevenLabsKey) {
				if (!TTS.premiumQueueActive) {
					TTS.ElevenLabsTTS(text);
				} else {
					TTS.premiumQueueTTS.push(text);
				}
				return;
			}
			return; // Change from break to return
		case "speechify":
			if (TTS.SpeechifyAPIKey) {
				if (!TTS.premiumQueueActive) {
					TTS.SpeechifyTTS(text);
				} else {
					TTS.premiumQueueTTS.push(text);
				}
				return;
			}
			return; // Change from break to return
		case "openai":
			if (TTS.OpenAIAPIKey) {
				if (!TTS.premiumQueueActive) {
					TTS.openAITTS(text);
				} else {
					TTS.premiumQueueTTS.push(text);
				}
				return;
			}
			return; // Change from break to return
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
 * Skip the currently playing TTS message and play the next one in queue
 */
TTS.skipCurrent = function() {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
        // For system TTS
        window.speechSynthesis.cancel();
        // If there are queued messages, the browser will automatically play the next queued utterance
    } else if (TTS.premiumQueueActive && TTS.audio) {
        // For premium TTS providers
        try {
            TTS.audio.pause();
            TTS.audio.currentTime = 0;
            TTS.finishedAudio(); // This will play the next item in queue
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
    //console.log("TTS.speechMeta called with data:", data, "Allow:", allow);
    
    if (!data) {
        console.error("TTS.speechMeta: No data provided");
        return;
    }
    
    if (TTS.skipTTSMessages && !data.hasDonation) {
        if (parseInt(data.id||0) % TTS.skipTTSMessages !== 0) {
            //console.log("Message skipped due to skipTTSMessages filter");
            return;
        }
    }
	
	if (TTS.disableTTS){
		//console.log("TTS is disabled globally, aborting");
		return;
	}
	
    if (!data.bot && TTS.bottts) {
        //console.log("Filter: Only bot messages allowed and this is not a bot message");
        return;
    } 
    else if (!data.host && TTS.hosttts) {
        //console.log("Filter: Only host messages allowed and this is not a host message");
        return;
    } 
    else if (!data.mod && TTS.modtts) {
        //console.log("Filter: Only mod messages allowed and this is not a mod message");
        return;
    }
    else if (!data.vip && TTS.viptts) {
        //console.log("Filter: Only VIP messages allowed and this is not a VIP message");
        return;
    } 
	else if (!(data.membership || data.hasMembership) && TTS.membertts) {
        //console.log("Filter: Only Member messages allowed and this is not a member message");
        return;
    } 
    else if (!data.admin && TTS.admintts) {
        //console.log("Filter: Only admin messages allowed and this is not an admin message");
        return;
    }
    
    else if (data.bot && !(TTS.allowbottts || TTS.bottts)) {
        //console.log("Filter: Bot messages not allowed");
        return;
    } 
    else if (data.host && !(TTS.allowhosttts || TTS.hosttts)) {
        //console.log("Filter: Host messages not allowed");
        return;
    }
//	else if (data.mod && !(TTS.allowmodtts || TTS.modtts)) {  // enabling this will prevent these from working.
 //       return;
 //   }
//	else if (data.admin && !(TTS.allowadmintts || TTS.admintts)) {
 //       //console.log("Filter: Host messages not allowed");
 //       return;
 //   }
//	else if (data.vip && !(TTS.allowviptts || TTS.viptts)) {
 //       //console.log("Filter: Host messages not allowed");
 //       return;
 //   }
//	else if ((data.membership || data.hasMembership) && !(TTS.allowmembertts || TTS.membertts)) {
 //       //console.log("Filter: Host messages not allowed");
 //       return;
 //   } 
    
    else if (data.reflection && TTS.norelfectionstts) {
        //console.log("Filter: Reflection messages not allowed");
        return;
    }
    
    else if (TTS.ttsSources && !TTS.ttsSources.includes(data.type)) {
        //console.log(`Filter: Source type ${data.type} not in allowed sources list`);
        return;
    }
    
    // Handle multiple TTS filters
    const isDonation = data.hasDonation || data.donation;
    const isNewMember = data.event === "newmember";
    const isClicked = data.clicked;
   
    const filters = [];
   
    // Only evaluate conditions if the corresponding TTS filter is enabled
    if (TTS.readDonos) {
        filters.push(isDonation);
    }
   
    if (TTS.newmembertts) {
        filters.push(isNewMember);
     }
   
    if (TTS.ttsclicked) {
        filters.push(isClicked);
    }
   
    // If there are active filters and none of them passed, skip processing
    if (filters.length > 0 && filters.every(passed => !passed)) {
        //console.log("Filter: none of the active TTS filters passed");
        return;
    }

    if (TTS.doNotReadEvents && data.event) {
        //console.log("Filter: Events not allowed and this is an event");
        return;
    }
    try {
        var isCommand = false;
        var msgPlainElement = document.getElementById("content_" + data.id);
        var msgPlain = "";

        if (msgPlainElement) {
            msgPlain = msgPlainElement.textContent || msgPlainElement.innerText || "";
        } else if (data.chatmessage) {
            var tempContainer = document.createElement("div");
            tempContainer.innerHTML = data.chatmessage;

            // Drop embedded media so TTS never reads their attributes or data URLs
            tempContainer.querySelectorAll("img, video, audio, source, picture, canvas, svg, iframe, object, embed, lottie-player").forEach(function(node) {
                if (node && node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            });

            msgPlain = tempContainer.textContent || tempContainer.innerText || "";

            if (!msgPlain.trim()) {
                msgPlain = "";
            }
        }

        msgPlain = msgPlain || "";
        msgPlain = msgPlain
            .replace(/[\u2700-\u27BF\uE000-\uF8FF\uD83C\uD800-\uDFFF\uD83E\uD810-\uDFFF\u2011-\u26FF]/g, "")
            .replace(/_/g, " ")
            .replace(/@/g, " ");

        msgPlain = msgPlain.replace(/data:[^\s]+;base64,[^\s]*/gi, " ");
        msgPlain = msgPlain.replace(/base64,[^\s]*/gi, " ");

        if (TTS.ttscommand && msgPlain.includes(TTS.ttscommand+" ")) {
            msgPlain = msgPlain.split(TTS.ttscommand+" " )[1].trim();
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
        msgPlain = msgPlain.replace(/\s{2,}/g, " ");

        msgPlain = msgPlain.trim();

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
    if ((window.ninjafy || window.electronApi)) {
        return true; // Electron already handles this
    }
    if (TTS.kokoroDownloadInProgress) return false;
    if (TTS.kokoroTtsInstance) return true;
    
    try {
        TTS.kokoroDownloadInProgress = true;
        //console.log("Loading Kokoro dependencies...");
        
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
        //console.log("Kokoro TTS using device:", device);
        
        // Store the device type for checking later
        TTS.kokoroDevice = device;
        
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
        
        //console.log("Checking cache for model...");
        let modelData = await getCachedModel();
        
        if (!modelData) {
            //console.log("Downloading model...");
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
                //console.log(`Downloading model: ${percentage.toFixed(1)}%`);
            }
            
            const modelBlob = new Blob(chunks);
            modelData = new Uint8Array(await modelBlob.arrayBuffer());
            
            //console.log("Caching model...");
            await cacheModel(modelData);
        } else {
            //console.log("Loading model from cache");
        }
        
        //console.log("Initializing Kokoro TTS...");
        const customLoadFn = async () => modelData;
        
        // Use the same model initialization parameters as working version
        const dtype = device === "wasm" ? "q8" : "fp32";
        //console.log(`Kokoro TTS initializing with dtype: ${dtype} on ${device}`);
        
        TTS.kokoroTtsInstance = await TTS.KokoroTTS.from_pretrained(
            "onnx-community/Kokoro-82M-v1.0-ONNX",
            {
                dtype: dtype,
                device,
                load_fn: customLoadFn
            }
        );
        
        //console.log("Kokoro TTS ready!");
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
                      //console.log(`Received ${result.blendshapes.length} blendshape frames`);
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
        
        // Smart language code extraction from voice name
        let languageCode = TTS.googleSettings.lang || TTS.speechLang;
        const voiceName = TTS.googleSettings.voiceName || "en-GB-Standard-A";
        
        // If no explicit language is set but we have a voice name, extract language from it
        if (!TTS.googleSettings.lang && TTS.googleSettings.voiceName) {
            // Voice names follow pattern: languageCode-variantName (e.g., en-GB-Chirp3-HD-Laomedeia)
            const voiceMatch = voiceName.match(/^([a-z]{2}-[A-Z]{2})/);
            if (voiceMatch) {
                languageCode = voiceMatch[1];
            }
        }
        
        var data = {
            input: {
                text: tts
            },
            voice: {
                languageCode: languageCode,
                name: voiceName,
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
                      //console.log(`Received ${result.blendshapes.length} blendshape frames`);
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
    if ((window.ninjafy || window.electronApi)) {
      try {
        // Electron implementation remains the same
		let ninjafy = window.ninjafy || window.electronApi;
        const wavBuffer = await ninjafy.tts(text, TTS.kokoroSettings);
        const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
        
        if (TTS.neuroSyncEnabled) {
          TTS.sendToNeuroSync(audioBlob, { 
            isKokoroAudio: true,
            onProgress: (progress) => {
              //console.log(`NeuroSync processing: ${Math.round(progress * 100)}%`);
            }
          }).then(result => {
            if (result && result.blendshapes) {
              //console.log(`Received ${result.blendshapes.length} blendshape frames`);
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
              //console.log(`NeuroSync processing: ${Math.round(progress * 100)}%`);
            }
          }).then(result => {
            if (result && result.blendshapes) {
              //console.log(`Received ${result.blendshapes.length} blendshape frames`);
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

/**
 * Initialize eSpeak TTS
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
TTS.initEspeak = async function() {
    if (TTS.espeakLoaded) return true;
    
    try {
        //console.log("Loading real eSpeak-NG TTS module...");
        
        // Load real eSpeak-NG implementation
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = './thirdparty/espeak-ng-real.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        // Wait for RealESpeakTTS to be available
        if (!window.RealESpeakTTS) {
            throw new Error('RealESpeakTTS not found');
        }
        
        // Create real eSpeak-NG instance
        //console.log('Creating real eSpeak-NG instance');
        TTS.espeakInstance = new window.RealESpeakTTS();
        await TTS.espeakInstance.init();
        
        TTS.espeakLoaded = true;
        //console.log("Real eSpeak-NG TTS ready!");
        return true;
    } catch (error) {
        console.error('Failed to initialize real eSpeak-NG TTS:', error);
        if (error.message && error.message.includes('Wrong version of espeak-ng-data')) {
            console.error('eSpeak-NG data version mismatch detected. The eSpeak TTS engine requires compatible data files.');
            console.error('Please use the browser\'s built-in TTS or another TTS provider instead.');
        }
        TTS.espeakLoaded = false;
        TTS.espeakInstance = null;
        return false;
    }
};

/**
 * eSpeak TTS implementation
 * @param {string} text - Text to speak
 */
TTS.espeakTTS = async function(text) {
    try {
        // Initialize if needed
        if (!TTS.espeakLoaded || !TTS.espeakInstance) {
            const initialized = await TTS.initEspeak();
            if (!initialized) {
                console.error("Failed to initialize eSpeak TTS - please use a different TTS provider");
                TTS.finishedAudio();
                return;
            }
        }
        
        TTS.premiumQueueActive = true;
        
        // Initialize audio context if needed
        TTS.initAudioContext();
        
        // Generate speech using real eSpeak-NG TTS
        const wavArrayBuffer = await TTS.espeakInstance.speak(text, {
            voice: TTS.espeakSettings.voice,
            speed: TTS.espeakSettings.speed,
            pitch: TTS.espeakSettings.pitch,
            amplitude: 100,  // Volume 0-200
            variant: TTS.espeakSettings.variant
        });
        
        // The real eSpeak returns WAV data directly
        const audioBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
        
        // Send to NeuroSync if enabled
        if (TTS.neuroSyncEnabled) {
            TTS.sendToNeuroSync(audioBlob).then(result => {
                if (result && result.blendshapes) {
                    //console.log(`Received ${result.blendshapes.length} blendshape frames`);
                }
            }).catch(err => {
                console.error("NeuroSync error:", err);
            });
            TTS.finishedAudio();
            return;
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (!TTS.audio) {
            TTS.audio = document.createElement("audio");
            TTS.audio.onended = TTS.finishedAudio;
        }
        
        TTS.audio.src = audioUrl;
        if (TTS.volume) {
            TTS.audio.volume = TTS.volume;
        }
        
        // Resume audio context if suspended
        if (TTS.audioContext && TTS.audioContext.state === 'suspended') {
            await TTS.audioContext.resume();
        }
        
        // Play the audio
        TTS.audio.play().catch(err => {
            console.error("Audio play failed, user interaction required", err);
            TTS.finishedAudio();
        });
        
    } catch (e) {
        console.error('eSpeak TTS error:', e);
        TTS.finishedAudio();
        if (e.message && e.message.includes('interaction')) {
            console.error("REMEMBER TO CLICK THE PAGE FIRST - audio won't play until you do");
        }
    }
};

/**
 * Initialize Piper TTS
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
TTS.initPiper = async function() {
    if (TTS.piperLoaded) return true;
    
    try {
        //console.log("Loading Piper TTS module...");
        
        // Load dependencies in order
        const scripts = [
            './thirdparty/ort.min.js',
            './thirdparty/piper/piper-tts-proper.js'
        ];
        
        for (const src of scripts) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = () => reject(new Error(`Failed to load ${src}`));
                document.head.appendChild(script);
            });
        }
        
        // Wait for ProperPiperTTS to be available
        if (!window.ProperPiperTTS) {
            throw new Error('ProperPiperTTS not found');
        }
        
        // Create Piper instance with selected voice
        //console.log('Creating Piper instance with voice:', TTS.piperSettings.voice);
        TTS.piperInstance = new window.ProperPiperTTS(TTS.piperSettings.voice);
        await TTS.piperInstance.init();
        
        TTS.piperLoaded = true;
        //console.log("Piper TTS ready!");
        return true;
    } catch (error) {
        console.error('Failed to initialize Piper TTS:', error);
        return false;
    }
};

/**
 * Piper TTS implementation
 * @param {string} text - Text to speak
 */
TTS.piperTTS = async function(text) {
    try {
        // Initialize if needed
        if (!TTS.piperLoaded || !TTS.piperInstance) {
            const initialized = await TTS.initPiper();
            if (!initialized) {
                console.error("Failed to initialize Piper TTS");
                TTS.finishedAudio();
                return;
            }
        }
        
        TTS.premiumQueueActive = true;
        
        // Use Piper TTS with speed setting
        await TTS.piperInstance.speak(text, TTS.piperSettings.speed);
        
        // Finished playing
        TTS.finishedAudio();
        
    } catch (e) {
        console.error('Piper TTS error:', e);
        TTS.finishedAudio();
    }
};

/**
 * Initialize Kitten TTS
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
TTS.initKitten = async function() {
    if (TTS.kittenLoaded) return true;
    
    // Prevent double initialization
    if (TTS.kittenInitializing) {
        // Wait for existing initialization to complete
        while (TTS.kittenInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return TTS.kittenLoaded;
    }
    
    TTS.kittenInitializing = true;
    
    try {
        //console.log("Loading Kitten TTS module...");
        
        // Calculate base URL once
        const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
        
        // Load ONNX Runtime first if not loaded
        if (typeof ort === 'undefined') {
            await new Promise((resolve, reject) => {
                const ortScript = document.createElement('script');
                ortScript.src = './thirdparty/ort.min.js';
                ortScript.onload = resolve;
                ortScript.onerror = reject;
                document.head.appendChild(ortScript);
            });
        }
        
        // Configure WASM paths after loading
        if (typeof ort !== 'undefined' && ort.env && ort.env.wasm) {
            // Point to kitten-tts folder where we have all the required files
            ort.env.wasm.wasmPaths = baseUrl + '/thirdparty/kitten-tts/';
            ort.env.wasm.numThreads = 1;
            ort.env.wasm.simd = false;
            
            console.log("Configured ONNX Runtime WASM paths for TTS:", ort.env.wasm.wasmPaths);
        }
        
        // Load Kitten TTS module - use absolute URL to avoid CORS issues
        const moduleUrl = baseUrl + '/thirdparty/kitten-tts/kitten-tts-lib.js';
        
        const { KittenTTS } = await import(moduleUrl);
        
        // Create Kitten instance
        //console.log('Creating Kitten TTS instance');
        TTS.kittenInstance = new KittenTTS();
        
        // Initialize with model and voices - use absolute URLs
        const modelUrl = baseUrl + '/thirdparty/kitten-tts/kitten_tts_nano_v0_1.onnx';
        const voicesUrl = baseUrl + '/thirdparty/kitten-tts/voices.json';
        
        // Initialize without wasmPath parameter - let ONNX runtime use its configured path
        await TTS.kittenInstance.init(modelUrl, voicesUrl);
        
        // Get available voices
        TTS.kittenVoices = TTS.kittenInstance.getVoices();
        
        // Set initial voice if not already set or invalid
        if (!TTS.kittenSettings.voice || !TTS.kittenVoices.includes(TTS.kittenSettings.voice)) {
            TTS.kittenSettings.voice = TTS.kittenVoices[0] || 'en_US-male-1';
        }
        
        TTS.kittenLoaded = true;
        TTS.kittenInitializing = false;
        //console.log("Kitten TTS ready!");
        return true;
    } catch (error) {
        console.error('Failed to initialize Kitten TTS:', error);
        TTS.kittenInitializing = false;
        return false;
    }
};

/**
 * Kitten TTS implementation
 * @param {string} text - Text to speak
 */
TTS.kittenTTS = async function(text) {
    try {
        // Initialize if needed
        if (!TTS.kittenLoaded || !TTS.kittenInstance) {
            const initialized = await TTS.initKitten();
            if (!initialized) {
                console.error("Failed to initialize Kitten TTS");
                TTS.finishedAudio();
                return;
            }
        }
        
        TTS.premiumQueueActive = true;
        
        // Initialize audio context if needed
        TTS.initAudioContext();
        
        // Generate speech with selected voice and speed
        const audioBlob = await TTS.kittenInstance.generateSpeech(
            text, 
            TTS.kittenSettings.voice,
            TTS.kittenSettings.speed || 1.0
        );
        
        // Send to NeuroSync if enabled
        if (TTS.neuroSyncEnabled) {
            TTS.sendToNeuroSync(audioBlob).then(result => {
                if (result && result.blendshapes) {
                    //console.log(`Received ${result.blendshapes.length} blendshape frames`);
                }
            }).catch(err => {
                console.error("NeuroSync error:", err);
            });
            TTS.finishedAudio();
            return;
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (!TTS.audio) {
            TTS.audio = document.createElement("audio");
            TTS.audio.onended = TTS.finishedAudio;
        }
        
        TTS.audio.src = audioUrl;
        if (TTS.volume) {
            TTS.audio.volume = TTS.volume;
        }
        
        // Resume audio context if suspended
        if (TTS.audioContext && TTS.audioContext.state === 'suspended') {
            await TTS.audioContext.resume();
        }
        
        // Play the audio
        TTS.audio.play().catch(err => {
            console.error("Audio play failed, user interaction required", err);
            TTS.finishedAudio();
        });
        
    } catch (e) {
        console.error('Kitten TTS error:', e);
        TTS.finishedAudio();
        if (e.message && e.message.includes('interaction')) {
            console.error("REMEMBER TO CLICK THE PAGE FIRST - audio won't play until you do");
        }
    }
};

/**
 * OpenAI TTS implementation
 * @param {string} text - Text to speak
 */
TTS.openAITTS = function(text) {
    try {
        TTS.premiumQueueActive = true;
        const url = TTS.openAISettings.endpoint;
        
        // API key is optional for custom endpoints, required for OpenAI's official API
        const apiKey = TTS.openAISettings.apiKey || TTS.OpenAIAPIKey;
        const isOfficialEndpoint = !url || url.includes('api.openai.com');
        
        if (!apiKey && isOfficialEndpoint) {
            console.error("OpenAI API key is required for the official OpenAI API");
            TTS.finishedAudio();
            return;
        }

        var data = {
            model: TTS.openAISettings.model,
            input: text,
            voice: TTS.openAISettings.voice,
            response_format: TTS.openAISettings.responseFormat,
            speed: TTS.openAISettings.speed
        };

        const headers = {
            "Content-Type": "application/json"
        };
        
        // Only add Authorization header if API key is provided
        if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
        }
        
        const otherparam = {
            headers: headers,
            body: JSON.stringify(data),
            method: "POST"
        };

        fetch(url, otherparam)
            .then(async response => {
                if (!response.ok) {
                    // Try to get detailed error message
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        const errorData = await response.json();
                        throw new Error(errorData?.error?.message || errorData?.message || `HTTP error! status: ${response.status}`);
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(async res => {
                const newBlob = new Blob([res], { type: `audio/${TTS.openAISettings.responseFormat}` });
                
                // Send to NeuroSync in parallel
                if (TTS.neuroSyncEnabled) {
                  TTS.sendToNeuroSync(newBlob).then(result => {
                    if (result && result.blendshapes) {
                      //console.log(`Received ${result.blendshapes.length} blendshape frames`);
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
                console.error("OpenAI TTS error:", error);
            });
    } catch (e) {
        TTS.finishedAudio();
        console.error("OpenAI TTS error:", e);
    }
};
