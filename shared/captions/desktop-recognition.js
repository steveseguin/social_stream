// Speech recognition for the captions page inside the Social Stream Ninja desktop app.
//
// The app's windows have the browser speech recognition API but no speech service behind it, so
// listening that way never works there. The app does run Whisper locally (the AI cohost uses it),
// and this wraps it in the same shape as the browser's recogniser: start(), stop(), abort(),
// onresult, onerror, onend. It also reports progress through onstatus.
//
// Audio is cut into phrases by listening for pauses, and each phrase is transcribed in the app.
// The capture set-up mirrors DesktopWhisperRecognition in cohost.html, which was tuned for
// Electron: keep the two in step when changing either. English only, for now (whisper-tiny.en).
(function () {
	"use strict";

	var WHISPER_SAMPLE_RATE = 16000;
	var MAX_PHRASE_SECONDS = 15; // The app accepts up to 20 seconds at a time.
	var PAUSE_SECONDS = 0.7; // This much quiet ends a phrase.
	var MAX_WAITING = 2; // Phrases allowed to wait for Whisper before new ones are skipped.

	function available() {
		return !!(window.ninjafy && typeof window.ninjafy.getSttCapabilities === "function" && typeof window.ninjafy.transcribeAudio === "function");
	}

	// Resolves with the app's capabilities when this page may use its speech recognition, or null
	// when it may not (an older app, or a page the app does not trust with it).
	function check() {
		if (!available()) {
			return Promise.resolve(null);
		}
		return Promise.resolve()
			.then(function () {
				return window.ninjafy.getSttCapabilities();
			})
			.then(
				function (capabilities) {
					return capabilities && capabilities.available === true ? capabilities : null;
				},
				function () {
					return null;
				}
			);
	}

	function resample(input, inputRate, outputRate) {
		if (!input || !input.length) {
			return new Float32Array(0);
		}
		if (!isFinite(inputRate) || inputRate <= 0 || inputRate === outputRate) {
			return new Float32Array(input);
		}
		var outputLength = Math.max(1, Math.round((input.length * outputRate) / inputRate));
		var output = new Float32Array(outputLength);
		var ratio = inputRate / outputRate;
		for (var index = 0; index < outputLength; index++) {
			var position = index * ratio;
			var left = Math.floor(position);
			var right = Math.min(input.length - 1, left + 1);
			var fraction = position - left;
			output[index] = input[left] * (1 - fraction) + input[right] * fraction;
		}
		return output;
	}

	function Recognition(capabilities) {
		var self = this;
		capabilities = capabilities || {};
		self.lang = "en-US";
		self.continuous = true;
		self.interimResults = false;
		self.onresult = null;
		self.onerror = null;
		self.onend = null;
		self.onstatus = null;

		var generation = 0;
		var starting = false;
		var capturing = false;
		var stream = null;
		var audioContext = null;
		var sourceNode = null;
		var captureNode = null;
		var keepAliveContext = null;
		var keepAliveSource = null;
		var keepAliveAnalyser = null;
		var keepAliveSamples = null;
		var keepAliveTimer = null;
		var statusSubscription = "";
		var noiseFloor = 0.003;
		var preRoll = [];
		var preRollSamples = 0;
		var startChunks = 0;
		var speaking = false;
		var phrase = [];
		var phraseSamples = 0;
		var voicedSamples = 0;
		var silentSamples = 0;
		var waiting = 0;
		var chain = Promise.resolve();

		function status(phase, detail) {
			if (typeof self.onstatus === "function") {
				var report = { phase: phase };
				if (detail && isFinite(detail.progress)) {
					report.progress = detail.progress;
				}
				self.onstatus(report);
			}
		}

		function fail(code, message) {
			if (typeof self.onerror === "function") {
				self.onerror({ error: code, message: message || "" });
			}
		}

		function rate() {
			return audioContext ? audioContext.sampleRate : WHISPER_SAMPLE_RATE;
		}

		function close(fireEnd) {
			var wasActive = starting || capturing;
			starting = false;
			capturing = false;
			speaking = false;
			preRoll = [];
			preRollSamples = 0;
			startChunks = 0;
			phrase = [];
			phraseSamples = 0;
			voicedSamples = 0;
			silentSamples = 0;
			if (statusSubscription && typeof window.ninjafy.offSttStatus === "function") {
				window.ninjafy.offSttStatus(statusSubscription);
			}
			statusSubscription = "";
			if (captureNode) {
				captureNode.onaudioprocess = null;
				try {
					captureNode.disconnect();
				} catch (e) {}
				captureNode = null;
			}
			if (sourceNode) {
				try {
					sourceNode.disconnect();
				} catch (e) {}
				sourceNode = null;
			}
			if (keepAliveTimer) {
				clearInterval(keepAliveTimer);
				keepAliveTimer = null;
			}
			if (keepAliveSource) {
				try {
					keepAliveSource.disconnect();
				} catch (e) {}
				keepAliveSource = null;
			}
			keepAliveAnalyser = null;
			keepAliveSamples = null;
			[keepAliveContext, audioContext].forEach(function (context) {
				if (context) {
					try {
						Promise.resolve(context.close()).catch(function () {});
					} catch (e) {}
				}
			});
			keepAliveContext = null;
			audioContext = null;
			if (stream) {
				stream.getTracks().forEach(function (track) {
					try {
						track.stop();
					} catch (e) {}
				});
				stream = null;
			}
			if (fireEnd && wasActive) {
				setTimeout(function () {
					if (typeof self.onend === "function") {
						self.onend({ type: "end" });
					}
				}, 0);
			}
		}

		function transcribe(audio, run) {
			if (run !== generation || !capturing) {
				return Promise.resolve();
			}
			status(capabilities.modelCached ? "transcribing" : "model-download-needed");
			return window.ninjafy.transcribeAudio(audio.buffer, { sampleRate: WHISPER_SAMPLE_RATE }).then(
				function (result) {
					if (run !== generation || !capturing) {
						return;
					}
					capabilities.modelCached = true;
					var transcript = String(result && result.text ? result.text : "").replace(/\s+/g, " ").trim();
					if (transcript && typeof self.onresult === "function") {
						var alternative = { transcript: transcript, confidence: 1 };
						var entry = [alternative];
						entry.isFinal = true;
						self.onresult({ resultIndex: 0, results: [entry] });
					}
					status("listening");
				},
				function (error) {
					if (run !== generation) {
						return;
					}
					var message = String(error && error.message ? error.message : error || "");
					// Too busy, or a clip the app would not take: that phrase is lost, listening goes on.
					if (/SSAPP_STT_(?:BUSY|AUDIO_SHORT|AUDIO_LONG)/.test(message)) {
						status(/SSAPP_STT_BUSY/.test(message) ? "busy" : "listening");
						return;
					}
					fail(/network|fetch|download|ENOTFOUND|ECONN/i.test(message) ? "network" : "local-failed", message);
					close(true);
				}
			);
		}

		function queue(audio, run) {
			if (!audio.length || run !== generation) {
				return;
			}
			if (waiting >= MAX_WAITING) {
				status("busy");
				return;
			}
			waiting += 1;
			chain = chain
				.then(function () {
					return transcribe(audio, run);
				})
				.catch(function () {})
				.then(function () {
					waiting = Math.max(0, waiting - 1);
				});
		}

		function finishPhrase() {
			var chunks = phrase;
			var total = phraseSamples;
			var voiced = voicedSamples;
			var trailing = silentSamples;
			var inputRate = rate();
			speaking = false;
			phrase = [];
			phraseSamples = 0;
			voicedSamples = 0;
			silentSamples = 0;
			if (!chunks.length || voiced < inputRate * 0.16 || total < inputRate * 0.35) {
				status("listening");
				return;
			}
			var audio = new Float32Array(total);
			var offset = 0;
			chunks.forEach(function (chunk) {
				audio.set(chunk, offset);
				offset += chunk.length;
			});
			var keep = Math.round(inputRate * 0.25);
			if (trailing > keep && audio.length > trailing - keep) {
				audio = audio.slice(0, audio.length - (trailing - keep));
			}
			queue(resample(audio, inputRate, WHISPER_SAMPLE_RATE), generation);
		}

		function hear(chunk) {
			if (!capturing || !chunk || !chunk.length) {
				return;
			}
			var sumSquares = 0;
			var peak = 0;
			for (var index = 0; index < chunk.length; index++) {
				var sample = isFinite(chunk[index]) ? chunk[index] : 0;
				sumSquares += sample * sample;
				peak = Math.max(peak, Math.abs(sample));
			}
			var rms = Math.sqrt(sumSquares / chunk.length);
			var startThreshold = Math.max(0.007, Math.min(0.04, noiseFloor * 3.2));
			var endThreshold = Math.max(0.005, startThreshold * 0.7);
			var hasVoice = rms >= startThreshold || peak >= startThreshold * 3;
			var inputRate = rate();

			if (!speaking) {
				if (!hasVoice) {
					noiseFloor = Math.max(0.001, Math.min(0.02, noiseFloor * 0.97 + rms * 0.03));
				}
				// A little audio from before speech is noticed is kept, so first words are not clipped.
				preRoll.push(chunk);
				preRollSamples += chunk.length;
				var maxPreRoll = Math.round(inputRate * 0.35);
				while (preRollSamples > maxPreRoll && preRoll.length > 1) {
					preRollSamples -= preRoll.shift().length;
				}
				if (hasVoice) {
					startChunks += 1;
					if (startChunks >= 2) {
						speaking = true;
						phrase = preRoll.slice();
						phraseSamples = preRollSamples;
						voicedSamples = startChunks * chunk.length;
						silentSamples = 0;
						preRoll = [];
						preRollSamples = 0;
						startChunks = 0;
						status("speech");
					}
				} else {
					startChunks = 0;
				}
				return;
			}

			phrase.push(chunk);
			phraseSamples += chunk.length;
			if (rms >= endThreshold || peak >= endThreshold * 3) {
				voicedSamples += chunk.length;
				silentSamples = 0;
			} else {
				silentSamples += chunk.length;
			}
			if (silentSamples >= inputRate * PAUSE_SECONDS || phraseSamples >= inputRate * MAX_PHRASE_SECONDS) {
				finishPhrase();
			}
		}

		function onBridgeStatus(report) {
			if (!capturing || !report || typeof report !== "object") {
				return;
			}
			var phase = String(report.phase || "");
			if (phase === "model-ready") {
				capabilities.modelCached = true;
			}
			if (["download", "model-download-needed", "model-loading", "model-ready", "queued", "transcribing"].indexOf(phase) !== -1) {
				status(phase, report);
			}
		}

		function capture(run) {
			var AudioContextClass = window.AudioContext || window.webkitAudioContext;
			if (!AudioContextClass || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				return Promise.reject(new Error("This desktop app cannot capture a microphone."));
			}
			return navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (input) {
				if (run !== generation) {
					input.getTracks().forEach(function (track) {
						track.stop();
					});
					return;
				}
				stream = input;
				// Captured at the device's own rate: forcing a 16 kHz context can give silent input in
				// Electron. Each phrase is brought down to Whisper's 16 kHz once it has been cut out.
				audioContext = new AudioContextClass();
				var context = audioContext;
				return Promise.resolve(context.state === "suspended" ? context.resume() : null)
					.then(function () {
						if (run !== generation || audioContext !== context) {
							return;
						}
						sourceNode = context.createMediaStreamSource(stream);
						captureNode = context.createScriptProcessor(2048, 1, 1);
						captureNode.onaudioprocess = function (event) {
							var samples = event.inputBuffer && event.inputBuffer.numberOfChannels ? event.inputBuffer.getChannelData(0) : null;
							if (samples) {
								hear(new Float32Array(samples));
							}
							if (event.outputBuffer) {
								for (var channel = 0; channel < event.outputBuffer.numberOfChannels; channel++) {
									event.outputBuffer.getChannelData(channel).fill(0);
								}
							}
						};
						sourceNode.connect(captureNode);
						// The silent connected output keeps Electron pulling the microphone without playing it.
						captureNode.connect(context.destination);
						// Some Electron audio set-ups stop a healthy input after its first block. Reading the
						// same track from a second context keeps the device active.
						keepAliveContext = new AudioContextClass();
						var keepAlive = keepAliveContext;
						return Promise.resolve(keepAlive.state === "suspended" ? keepAlive.resume() : null).then(function () {
							if (run !== generation || keepAliveContext !== keepAlive) {
								return;
							}
							keepAliveSource = keepAlive.createMediaStreamSource(stream);
							keepAliveAnalyser = keepAlive.createAnalyser();
							keepAliveAnalyser.fftSize = 2048;
							keepAliveSamples = new Float32Array(keepAliveAnalyser.fftSize);
							keepAliveSource.connect(keepAliveAnalyser);
							keepAliveTimer = setInterval(function () {
								if (keepAliveAnalyser && keepAliveSamples) {
									keepAliveAnalyser.getFloatTimeDomainData(keepAliveSamples);
								}
							}, 50);
							if (typeof window.ninjafy.onSttStatus === "function") {
								statusSubscription = window.ninjafy.onSttStatus(onBridgeStatus) || "";
							}
							starting = false;
							capturing = true;
							status("listening");
						});
					});
			});
		}

		self.start = function () {
			if (starting || capturing) {
				var busy = new Error("Already listening.");
				busy.name = "InvalidStateError";
				throw busy;
			}
			generation += 1;
			var run = generation;
			starting = true;
			capture(run).catch(function (error) {
				if (run !== generation) {
					return;
				}
				var name = String((error && error.name) || "");
				if (name === "NotAllowedError" || name === "SecurityError") {
					fail("not-allowed", "");
				} else if (name === "NotFoundError" || name === "NotReadableError" || name === "OverconstrainedError") {
					fail("audio-capture", "");
				} else {
					fail("local-failed", String((error && error.message) || error || ""));
				}
				close(true);
			});
		};

		// Stop asked for by the host: a phrase already being spoken is finished off first.
		self.stop = function () {
			if (!starting && !capturing) {
				return;
			}
			if (capturing && speaking) {
				finishPhrase();
			}
			var run = generation;
			var finish = function () {
				if (run !== generation) {
					return;
				}
				generation += 1;
				close(true);
			};
			// Phrases already cut out are transcribed before listening ends.
			if (waiting > 0) {
				if (captureNode) {
					captureNode.onaudioprocess = null;
				}
				chain.then(finish, finish);
			} else {
				finish();
			}
		};

		self.abort = function () {
			if (!starting && !capturing) {
				return;
			}
			generation += 1;
			close(true);
		};
	}

	window.SSNDesktopCaptionRecognition = Recognition;
	window.SSNDesktopCaptionRecognition.available = available;
	window.SSNDesktopCaptionRecognition.check = check;
})();
