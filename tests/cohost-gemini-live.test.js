const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const cohost = fs.readFileSync(path.join(root, "cohost.html"), "utf8");
const gemini = cohost.slice(cohost.indexOf("class GoogleLivePublisher"), cohost.indexOf("class AudioPlayer"));

assert(gemini.includes("this.setupComplete && this.ws?.readyState === WebSocket.OPEN"), "Gemini media must wait for setupComplete");
assert(gemini.includes('? { realtimeInput: { text } }'), "Gemini 3.1 Live text turns should use realtimeInput");
assert(gemini.includes('indexOf("gemini-3.1-flash-live") === 0'), "Gemini 3.1 protocol handling should be model-gated");
assert(gemini.includes("serverContent?.generationComplete"), "Gemini should finalize generationComplete responses");
assert(gemini.includes("serverContent.interrupted === true"), "Gemini should handle server interruption events");
assert(gemini.includes("outputAudioTranscription: {}"), "Gemini should request output transcripts for native-audio responses");
assert(gemini.includes('responseModalities: ["AUDIO"]'), "Gemini native-audio models must always use the AUDIO response modality");
assert(gemini.includes("part.text && part.thought !== true"), "Gemini must not expose model thinking as the assistant reply");
assert(gemini.includes("outputTranscription?.text"), "Gemini should render the output-audio transcript");
assert(gemini.includes("this.audioPlayer.stop();"), "Gemini interruption handling should discard queued audio");
assert(gemini.includes("this.hasCompletedInitialSetup"), "Gemini should only greet on the initial setup");
assert(gemini.includes("this.isQuotaCloseReason(event.reason)"), "Gemini quota errors should be identified from the close reason");
assert(!gemini.includes("event.code === 1011 ||"), "A generic 1011 internal error must not be mislabeled as quota");
assert(gemini.includes("Gemini reported an internal service error."), "Generic 1011 errors should use transient recovery");
assert(!gemini.includes("No heartbeat response for 60 seconds"), "Quiet Gemini sessions must not be forcibly reconnected");
assert(!gemini.includes("Connection inactive for"), "Gemini inactivity alone must not stop a healthy session");
assert(gemini.includes("realtimeInput: { audioStreamEnd: true }"), "Gemini should close a replaced audio stream cleanly");
assert(gemini.includes("this.stopAudioProcessing(true);"), "Gemini should replace rather than duplicate audio processors");
assert(gemini.includes("this.stopVideoProcessing();"), "Gemini should replace rather than duplicate video capture loops");
assert(cohost.includes("buffer = new Int16Array(512);"), "Gemini should send 32 ms PCM chunks at 16 kHz");
assert(cohost.includes("setGeminiOutputPlaybackActive"), "Gemini playback should suppress shared-audio feedback");
assert(cohost.includes("mixedAudioResources.systemTracks || []"), "The system-audio meter should inspect the original system tracks");
assert(cohost.includes("videoTrack.__ssnCohostPlaceholder = true"), "Placeholder video must be distinguishable from selected visual input");
assert(gemini.includes("videoTrack.__ssnCohostPlaceholder === true"), "Gemini must not upload placeholder video frames");
assert(gemini.includes("!this.responseActive && now - this.lastImageTime >= this.imageInterval"), "Gemini should pause video uploads while the model is replying");

console.log("Gemini Live co-host contract passed.");
