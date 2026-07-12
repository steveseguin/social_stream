
(function() {
    'use strict';
    
    // Check if SDK is available
    if (typeof VDONinjaSDK === 'undefined') {
        console.error('VDONinjaSDK not found! Ensure thirdparty/vdoninja-sdk.js loads before capturevideo.js.');
        return;
    }
    
    // Early initialization: Hook RTCPeerConnection to capture audio streams
    (function setupRTCHook() {
        if (window._rtcHookInstalled) return;
        window._rtcHookInstalled = true;
        window._rtcAudioStreams = new Set();
        window._rtcPeerConnections = new Set();
        
        const OriginalRTCPeerConnection = window.RTCPeerConnection;
        
        window.RTCPeerConnection = function(...args) {
            const pc = new OriginalRTCPeerConnection(...args);
            window._rtcPeerConnections.add(pc);
            
            // Listen for remote streams
            pc.addEventListener('track', (event) => {
                if (event.track.kind === 'audio' && event.streams[0]) {
                    console.log('[RTC Hook] Captured remote audio track:', event.track.label);
                    window._rtcAudioStreams.add(event.streams[0]);
                }
            });
            
            // Also capture local streams when added
            const originalAddStream = pc.addStream;
            if (originalAddStream) {
                pc.addStream = function(stream) {
                    if (stream.getAudioTracks().length > 0) {
                        console.log('[RTC Hook] Captured local audio stream');
                        window._rtcAudioStreams.add(stream);
                    }
                    return originalAddStream.apply(this, arguments);
                };
            }
            
            const originalAddTrack = pc.addTrack;
            if (originalAddTrack) {
                pc.addTrack = function(track, ...streams) {
                    if (track.kind === 'audio' && streams[0]) {
                        console.log('[RTC Hook] Captured local audio track:', track.label);
                        window._rtcAudioStreams.add(streams[0]);
                    }
                    return originalAddTrack.apply(this, arguments);
                };
            }
            
            return pc;
        };
        
        // Copy static methods and properties
        Object.setPrototypeOf(window.RTCPeerConnection, OriginalRTCPeerConnection);
        Object.setPrototypeOf(window.RTCPeerConnection.prototype, OriginalRTCPeerConnection.prototype);
        
        console.log('[RTC Hook] RTCPeerConnection hook installed');
    })();
    
    // Configuration
    const ROOM_ID = 'autopublish_' + Math.random().toString(36).substring(7);
    const VDO_NINJA_URL = 'https://vdo.ninja';
    
    // Map to track published videos and their VDO instances
    const publishedVideos = new Map();
    
    // Group scene overlay element
    let groupSceneOverlay = null;
    
    // Track when page loaded to delay overlays
    const pageLoadTime = Date.now();
    const OVERLAY_DELAY = 3000; // 3 seconds
    
    // Track if VDO.Ninja is enabled
    let vdoNinjaEnabled = false;
    
    // Settings from background script
    let settings = {};
    
    // Check initial state
    chrome.storage.local.get(['vdoninjadiscord'], function(result) {
        vdoNinjaEnabled = result.vdoninjadiscord === true;
        if (vdoNinjaEnabled) {
            console.log('VDO.Ninja Direct WebRTC Auto-Publisher initialized');
            console.log('Room ID:', ROOM_ID);
            console.log(`View URL: ${VDO_NINJA_URL}/?room=${ROOM_ID}&scene`);
            // Process any videos that loaded before we got the setting
            processExistingVideos();
        } else {
            console.log('VDO.Ninja Discord integration is disabled');
        }
    });
    
    // Listen for changes to the setting
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.vdoninjadiscord) {
            const wasEnabled = vdoNinjaEnabled;
            vdoNinjaEnabled = changes.vdoninjadiscord.newValue === true;
            
            console.log('VDO.Ninja Discord setting changed:', vdoNinjaEnabled);
            
            if (!wasEnabled && vdoNinjaEnabled) {
                // Just enabled - start processing videos
                console.log('VDO.Ninja enabled, starting video processing');
                processExistingVideos();
            } else if (wasEnabled && !vdoNinjaEnabled) {
                // Just disabled - clean up everything
                console.log('VDO.Ninja disabled, cleaning up');
                cleanupAllVideos();
            }
        }
    });
    
    function generateStreamId() {
        return 'video_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    }
    
    // Helper function to analyze audio sources on the page
    function analyzeAudioSources() {
        console.log('=== Analyzing Audio Sources ===');
        
        // Check all video elements
        const videos = document.querySelectorAll('video');
        console.log(`Found ${videos.length} video elements:`);
        videos.forEach((video, i) => {
            console.log(`Video ${i}:`, {
                hasAudio: video.mozHasAudio || video.webkitAudioDecodedByteCount > 0 || false,
                muted: video.muted,
                volume: video.volume,
                paused: video.paused,
                src: video.src || video.currentSrc,
                audioTracks: video.audioTracks?.length || 'N/A'
            });
        });
        
        // Check all audio elements
        const audios = document.querySelectorAll('audio');
        console.log(`\nFound ${audios.length} audio elements:`);
        audios.forEach((audio, i) => {
            console.log(`Audio ${i}:`, {
                muted: audio.muted,
                volume: audio.volume,
                paused: audio.paused,
                src: audio.src || audio.currentSrc
            });

        });
        
        // Check for Web Audio API nodes
        if (window.AudioContext || window.webkitAudioContext) {
            console.log('\nWeb Audio API is available');
        }
        
        // Check for any iframe that might contain media
        const iframes = document.querySelectorAll('iframe');
        console.log(`\nFound ${iframes.length} iframes (may contain media)`);
        
        console.log('=== End Audio Analysis ===');
    }
    
    // Helper function to capture tab audio properly
    async function captureTabAudioStream() {
        return new Promise((resolve) => {
            // Check if we have chrome.tabCapture available (we're in extension context)
            if (typeof chrome !== 'undefined' && chrome.tabCapture && chrome.tabCapture.capture) {
                chrome.tabCapture.capture({
                    audio: true,
                    video: false
                }, (stream) => {
                    if (chrome.runtime.lastError) {
                        console.error('Direct tab capture failed:', chrome.runtime.lastError);
                        resolve(null);
                    } else {
                        console.log('Successfully captured tab audio directly');
                        resolve(stream);
                    }
                });
            } else {
                // We're in content script, need to request from background
                console.log('Requesting tab audio capture from background...');
                chrome.runtime.sendMessage({
                    type: 'captureTabAudio'
                }, (response) => {
                    if (response && response.error) {
                        console.error('Background tab capture failed:', response.error);
                        resolve(null);
                    } else {
                        // Note: We can't actually get the stream this way
                        // This is a limitation of Chrome extensions
                        console.log('Tab capture initiated but stream not accessible from content script');
                        resolve(null);
                    }
                });
            }
        });
    }
    
    // Clean up all published videos
    function cleanupAllVideos() {
        console.log('Cleaning up all published videos...');
        const videosCopy = [...publishedVideos.keys()];
        videosCopy.forEach(video => {
            unpublishVideo(video);
        });
        
        // Remove group scene overlay
        if (groupSceneOverlay && groupSceneOverlay.parentNode) {
            groupSceneOverlay.remove();
            groupSceneOverlay = null;
        }
    }
    
    async function publishVideo(videoElement) {
        // Check if VDO Ninja is enabled
        if (!vdoNinjaEnabled) {
            console.log('VDO.Ninja is disabled, skipping video publish');
            return;
        }
        
        // Skip if already published
        if (publishedVideos.has(videoElement)) {
            console.log('Video already published, skipping');
            return;
        }
        
        // Wait for video to be ready
        if (videoElement.readyState < 2) { // HAVE_CURRENT_DATA
            console.log('Video not ready, waiting for data');
            videoElement.addEventListener('loadeddata', () => {
                publishVideo(videoElement);
            }, { once: true });
            return;
        }
        
        // Wait for video dimensions
        if (!videoElement.videoWidth || !videoElement.videoHeight) {
            console.log('Video dimensions not available, waiting');
            videoElement.addEventListener('loadedmetadata', () => {
                publishVideo(videoElement);
            }, { once: true });
            return;
        }
        
        const streamId = generateStreamId();
        
        // Try to extract label from various sources
        let label = null;
        
        // Helper to clean up labels
        const cleanLabel = (text) => {
            if (!text) return null;
            // Remove extra whitespace and limit length
            return text.trim().replace(/\s+/g, ' ').substring(0, 50);
        };
        
        try {
            // Strategy 1: Microsoft Teams - Call tile aria-label
            if (!label) {
                const callTile = videoElement.parentElement?.parentElement?.querySelector('[aria-label^="Call tile,"]');
                if (callTile) {
                    const ariaLabel = callTile.getAttribute("aria-label");
                    if (ariaLabel && ariaLabel.startsWith("Call tile, ")) {
                        label = ariaLabel.split("Call tile, ")[1];
                        console.log('Found Teams call tile label:', label);
                    }
                }
            }
            
            // Strategy 2: Zoom - Various label locations
            if (!label) {
                // Zoom participant name
                const zoomName = videoElement.parentElement?.querySelector('.participant-name, .video-avatar__participant-name, [class*="participant-name"]');
                if (zoomName && zoomName.textContent) {
                    label = cleanLabel(zoomName.textContent);
                    console.log('Found Zoom participant name:', label);
                }
            }
            
            // Strategy 3: Google Meet - Name overlays
            if (!label) {
                const meetName = videoElement.parentElement?.querySelector('[jsname*="name"], [data-participant-id], .rG0ybd');
                if (meetName && meetName.textContent) {
                    label = cleanLabel(meetName.textContent);
                    console.log('Found Google Meet name:', label);
                }
            }
            
            // Strategy 4: YouTube - Video title
            if (!label && window.location.hostname.includes('youtube.com')) {
                // Try various YouTube title selectors
                const ytTitle = document.querySelector('h1.ytd-video-primary-info-renderer, h1.title, ytd-video-primary-info-renderer h1, #title h1');
                if (ytTitle && ytTitle.textContent) {
                    label = cleanLabel(ytTitle.textContent);
                    console.log('Found YouTube title:', label);
                }
            }

            
            // Strategy 5: Data attributes on video element
            if (!label) {
                // Common data attributes that might contain names/titles
                const dataAttrs = ['data-name', 'data-title', 'data-participant-name', 'data-user-name', 'data-display-name', 'data-label'];
                for (const attr of dataAttrs) {
                    if (videoElement.hasAttribute(attr)) {
                        label = cleanLabel(videoElement.getAttribute(attr));
                        if (label) {
                            console.log(`Found label in ${attr}:`, label);
                            break;
                        }
                    }
                }
            }
            
            // Strategy 6: Title attribute on video or parent elements
            if (!label) {
                // Check video element first
                if (videoElement.title) {
                    label = cleanLabel(videoElement.title);
                    console.log('Found video title attribute:', label);
                } else {
                    // Check immediate parent only
                    const parent = videoElement.parentElement;
                    if (parent && parent.title) {
                        label = cleanLabel(parent.title);
                        console.log('Found parent title attribute:', label);
                    }
                }
            }
            
            // Strategy 7: Twitch - Stream title or username
            if (!label && window.location.hostname.includes('twitch.tv')) {
                const streamTitle = document.querySelector('[data-a-target="stream-title"], .stream-title, h2[title]');
                if (streamTitle && streamTitle.textContent) {
                    label = cleanLabel(streamTitle.textContent);
                    console.log('Found Twitch stream title:', label);
                }
            }
            
            // Strategy 8: Generic overlay text
            if (!label) {
                // Look for text overlays that might contain names
                const overlay = videoElement.parentElement?.querySelector('.name, .username, .display-name, .participant, [class*="name"]:not(script)');
                if (overlay && overlay.textContent && overlay.textContent.length < 50) {
                    label = cleanLabel(overlay.textContent);
                    console.log('Found overlay text:', label);
                }
            }
            
            // Strategy 9: Vimeo - Video title
            if (!label && window.location.hostname.includes('vimeo.com')) {
                const vimeoTitle = document.querySelector('.vp-title, h1[class*="Title"]');
                if (vimeoTitle && vimeoTitle.textContent) {
                    label = cleanLabel(vimeoTitle.textContent);
                    console.log('Found Vimeo title:', label);
                }
            }
            
            // Strategy 10: Discord - Username in video call
            if (!label) {
                const discordName = videoElement.parentElement?.querySelector('[class*="nameTag"], [class*="username"]');
                if (discordName && discordName.textContent) {
                    label = cleanLabel(discordName.textContent);
                    console.log('Found Discord username:', label);
                }
            }
            
        } catch (e) {
            console.log('Error extracting label:', e);
        }
        
        console.log('Publishing video:', streamId, {
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
            duration: videoElement.duration,
            muted: videoElement.muted,
            paused: videoElement.paused,
            label: label || ''
        });
        
        try {
            // Create a new SDK instance for this video
            const vdo = new VDONinjaSDK({
                room: ROOM_ID,
                // password not specified - will use default password
                debug: false // Enable debug logging
            });
            
            // Override the salt to ensure compatibility with VDO.Ninja
            // This ensures room hashing matches VDO.Ninja's expectations
            vdo.salt = "vdo.ninja";
            console.log('Overriding salt to:', vdo.salt);
            
            // Add event listeners
            vdo.addEventListener('error', (e) => {
                console.error('SDK Error:', e.detail);
            });
            
            vdo.addEventListener('peerConnected', (e) => {
                console.log('Peer connected:', e.detail);
            });
            
            vdo.addEventListener('track', (e) => {
                console.log('Track received:', e.detail);
            });
            
            // Create media stream from video element
            let stream = null;
            let captureMethod = 'direct';
            
            try {
                // Try to capture both video and audio
                if (videoElement.captureStream) {
                    stream = videoElement.captureStream(30);
                } else if (videoElement.mozCaptureStream) {
                    stream = videoElement.mozCaptureStream(30);
                } else {
                    throw new Error('captureStream not supported');
                }
                
                console.log('Captured stream:', {
                    videoTracks: stream.getVideoTracks().length,
                    audioTracks: stream.getAudioTracks().length
                });
                
                // If video is muted or has no audio track, stream might not have audio
                if (stream.getAudioTracks().length === 0) {
                    console.log('No audio tracks captured, trying multiple audio capture methods...');
                    
                    // Strategy 1: Try to capture from the video element itself using Web Audio API
                    if (!videoElement.muted && videoElement.volume > 0) {
                        try {
                            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                            const source = audioContext.createMediaElementSource(videoElement);
                            const destination = audioContext.createMediaStreamDestination();
                            
                            // Connect audio graph
                            source.connect(destination);
                            source.connect(audioContext.destination); // Also play audio normally
                            
                            // Add audio track to stream
                            const audioTrack = destination.stream.getAudioTracks()[0];
                            if (audioTrack) {
                                stream.addTrack(audioTrack);
                                console.log('Added audio track from video element via Web Audio API');
                            }
                        } catch (audioErr) {
                            console.warn('Could not add audio track from video element:', audioErr);

                        }
                    }
                    
                    // Strategy 2: Look for nearby audio elements
                    if (stream.getAudioTracks().length === 0) {
                        try {
                            // Look for audio elements in the same container or nearby
                            const parent = videoElement.closest('div, section, article') || document.body;
                            const audioElements = parent.querySelectorAll('audio');
                            
                            for (const audioEl of audioElements) {
                                if (!audioEl.paused && !audioEl.muted && audioEl.volume > 0) {
                                    console.log('Found playing audio element:', audioEl);
                                    
                                    try {
                                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                        const source = audioContext.createMediaElementSource(audioEl);
                                        const destination = audioContext.createMediaStreamDestination();
                                        
                                        source.connect(destination);
                                        source.connect(audioContext.destination);
                                        
                                        const audioTrack = destination.stream.getAudioTracks()[0];
                                        if (audioTrack) {
                                            stream.addTrack(audioTrack);
                                            console.log('Added audio track from nearby audio element');
                                            break;
                                        }
                                    } catch (e) {
                                        console.warn('Could not capture from audio element:', e);
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Error searching for audio elements:', e);
                        }
                    }
                    
                    // Strategy 3: Try to find any media elements with audio
                    if (stream.getAudioTracks().length === 0) {
                        try {
                            // Find all media elements on the page
                            const allMedia = [...document.querySelectorAll('video, audio')];
                            
                            for (const mediaEl of allMedia) {
                                // Skip the current video element and check if media has audio
                                if (mediaEl !== videoElement && !mediaEl.paused && !mediaEl.muted && mediaEl.volume > 0) {
                                    try {
                                        // Try to capture stream directly first
                                        let mediaStream = null;
                                        if (mediaEl.captureStream) {
                                            mediaStream = mediaEl.captureStream();
                                        } else if (mediaEl.mozCaptureStream) {
                                            mediaStream = mediaEl.mozCaptureStream();
                                        }
                                        
                                        if (mediaStream && mediaStream.getAudioTracks().length > 0) {
                                            const audioTrack = mediaStream.getAudioTracks()[0];
                                            stream.addTrack(audioTrack);
                                            console.log('Added audio track from another media element:', mediaEl);
                                            break;
                                        }
                                    } catch (e) {
                                        console.warn('Could not capture from media element:', e);
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Error searching for media elements:', e);
                        }
                    }
                    
                    // Strategy 4: WebRTC-based audio capture (Discord, Teams, etc.)
                    if (stream.getAudioTracks().length === 0) {
                        console.log('Attempting WebRTC audio capture...');
                        try {
                            // Method 1: Look for audio elements with MediaStream sources
                            const audioElements = document.querySelectorAll('audio');
                            for (const audioEl of audioElements) {
                                if (audioEl.srcObject && audioEl.srcObject instanceof MediaStream) {
                                    const audioTracks = audioEl.srcObject.getAudioTracks();
                                    if (audioTracks.length > 0) {
                                        const clonedTrack = audioTracks[0].clone();
                                        stream.addTrack(clonedTrack);
                                        console.log('Added WebRTC audio track from audio element');
                                        
                                        if (!publishInfo.additionalTracks) {
                                            publishInfo.additionalTracks = [];
                                        }
                                        publishInfo.additionalTracks.push(clonedTrack);
                                        break;
                                    }
                                }
                            }
                            
                            // Method 2: Check already captured RTC audio streams
                            if (stream.getAudioTracks().length === 0 && window._rtcAudioStreams && window._rtcAudioStreams.size > 0) {
                                console.log(`Found ${window._rtcAudioStreams.size} captured RTC audio streams`);
                                for (const rtcStream of window._rtcAudioStreams) {
                                    const audioTracks = rtcStream.getAudioTracks();
                                    if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
                                        const clonedTrack = audioTracks[0].clone();
                                        stream.addTrack(clonedTrack);
                                        console.log('Added WebRTC audio track from captured peer connection');
                                        
                                        if (!publishInfo.additionalTracks) {
                                            publishInfo.additionalTracks = [];
                                        }
                                        publishInfo.additionalTracks.push(clonedTrack);
                                        break;
                                    }
                                }
                            }
                            
                            // Method 3: Check existing RTCPeerConnections for streams
                            if (stream.getAudioTracks().length === 0 && window._rtcPeerConnections && window._rtcPeerConnections.size > 0) {
                                console.log(`Checking ${window._rtcPeerConnections.size} peer connections for audio`);
                                for (const pc of window._rtcPeerConnections) {
                                    // Check remote streams
                                    const receivers = pc.getReceivers();
                                    for (const receiver of receivers) {
                                        if (receiver.track && receiver.track.kind === 'audio' && receiver.track.readyState === 'live') {
                                            const clonedTrack = receiver.track.clone();
                                            stream.addTrack(clonedTrack);
                                            console.log('Added audio track from peer connection receiver');
                                            
                                            if (!publishInfo.additionalTracks) {
                                                publishInfo.additionalTracks = [];
                                            }
                                            publishInfo.additionalTracks.push(clonedTrack);
                                            break;
                                        }
                                    }
                                    if (stream.getAudioTracks().length > 0) break;
                                }
                            }
                        } catch (e) {
                            console.warn('WebRTC audio capture failed:', e);
                        }
                    }
                    
                    // Strategy 5: Check if video element has audio but it's not in the stream
                    if (stream.getAudioTracks().length === 0) {
                        try {
                            // Some video elements report having audio differently
                            const hasAudioTrack = videoElement.audioTracks && videoElement.audioTracks.length > 0;
                            const hasDecodedAudio = videoElement.webkitAudioDecodedByteCount > 0;
                            const hasMozAudio = videoElement.mozHasAudio === true;
                            
                            console.log('Video audio detection:', {

                                hasAudioTrack,
                                hasDecodedAudio,
                                hasMozAudio,
                                readyState: videoElement.readyState,
                                networkState: videoElement.networkState
                            });
                            
                            // If video reports having audio, try creating a new stream
                            if (hasAudioTrack || hasDecodedAudio || hasMozAudio) {
                                console.log('Video reports having audio, attempting alternative capture...');
                                
                                // Clone the video element and try to capture from it
                                const clonedVideo = videoElement.cloneNode(true);
                                clonedVideo.style.display = 'none';
                                document.body.appendChild(clonedVideo);
                                clonedVideo.muted = false;
                                clonedVideo.volume = 1;
                                
                                await clonedVideo.play();
                                
                                const clonedStream = clonedVideo.captureStream ? 
                                    clonedVideo.captureStream() : 
                                    clonedVideo.mozCaptureStream ? 
                                        clonedVideo.mozCaptureStream() : 
                                        null;
                                
                                if (clonedStream && clonedStream.getAudioTracks().length > 0) {
                                    const audioTrack = clonedStream.getAudioTracks()[0];
                                    stream.addTrack(audioTrack);
                                    console.log('Added audio track from cloned video element');
                                    
                                    // Clean up after a delay
                                    setTimeout(() => {
                                        clonedVideo.pause();
                                        clonedVideo.remove();
                                    }, 1000);
                                } else {
                                    clonedVideo.remove();
                                }
                            }
                        } catch (e) {
                            console.warn('Error with alternative audio capture:', e);
                        }
                    }
					
					// Strategy 6: Try to unmute video and recapture if it's muted
					if (stream.getAudioTracks().length === 0 && videoElement.muted) {
						console.log('Video is muted, attempting to unmute and recapture...');
						try {
							// Store original muted state
							const wasMuted = videoElement.muted;
							videoElement.muted = false;
							videoElement.volume = 1;
							
							// Wait a bit for audio to start
							await new Promise(resolve => setTimeout(resolve, 100));
							
							// Try to recapture with audio
							const newStream = videoElement.captureStream ? 
								videoElement.captureStream(30) : 
								videoElement.mozCaptureStream ? 
									videoElement.mozCaptureStream(30) : 
									null;
							
							if (newStream && newStream.getAudioTracks().length > 0) {
								// Replace the stream's tracks
								const newAudioTrack = newStream.getAudioTracks()[0];
								stream.addTrack(newAudioTrack);
								console.log('Added audio track after unmuting video');
								
								// Keep video unmuted for continuous audio
							} else {
								// Restore muted state if it didn't work
								videoElement.muted = wasMuted;
							}
						} catch (e) {
							console.warn('Unmute strategy failed:', e);
						}
					}
					
					// Strategy 7: Use Web Audio API to capture tab audio from AudioContext
					if (stream.getAudioTracks().length === 0) {
						console.log('Attempting to capture tab audio using AudioContext...');
						try {
							// Create an audio context
							const audioContext = new (window.AudioContext || window.webkitAudioContext)();
							
							// For Discord/Teams, try to find any active AudioContext sources
							// This is a bit hacky but might work
							const destination = audioContext.createMediaStreamDestination();
							
							// Try to capture from all media elements on the page
							const allMedia = [...document.querySelectorAll('video, audio')];
							let connectedSources = 0;
							
							for (const mediaEl of allMedia) {
								if (!mediaEl.paused || mediaEl.srcObject) {
									try {
										const source = audioContext.createMediaElementSource(mediaEl);
										source.connect(destination);
										source.connect(audioContext.destination); // Also output to speakers
										connectedSources++;
										console.log('Connected media element to audio graph:', mediaEl);
									} catch (e) {
										// Element might already be connected to another context
										console.log('Could not connect media element:', e.message);
									}
								}
							}
							
							if (connectedSources > 0 && destination.stream.getAudioTracks().length > 0) {
								const audioTrack = destination.stream.getAudioTracks()[0];
								stream.addTrack(audioTrack);
								console.log(`Added merged audio from ${connectedSources} sources`);
								
								// Store these for later when publishInfo is created
								if (!videoElement._pendingAudioResources) {
									videoElement._pendingAudioResources = {
										tracks: [],
										contexts: []
									};
								}
								videoElement._pendingAudioResources.tracks.push(audioTrack);
								videoElement._pendingAudioResources.contexts.push(audioContext);
							}
						} catch (e) {
							console.warn('AudioContext capture failed:', e);
						}
					}
                    
                    // Log final audio status
                    if (stream.getAudioTracks().length > 0) {
                        console.log('Successfully added audio to stream');
                        // Log detailed audio track info
                        stream.getAudioTracks().forEach((track, i) => {
                            console.log(`Audio track ${i}:`, {
                                id: track.id,
                                label: track.label,
                                kind: track.kind,
                                enabled: track.enabled,
                                muted: track.muted,
                                readyState: track.readyState,
                                settings: track.getSettings ? track.getSettings() : 'N/A'
                            });
                        });
                    } else {
                        console.warn('No audio tracks could be added to the stream');
                        console.log('Debugging info:');
                        console.log('- Video element muted:', videoElement.muted);
                        console.log('- Video element volume:', videoElement.volume);

                        console.log('- Video element has audio track:', videoElement.audioTracks?.length);
                        console.log('- WebRTC audio streams captured:', window._rtcAudioStreams?.size || 0);
                        
                        // Try one last manual approach for Discord
                        if (window.location.hostname.includes('discord.com')) {
                            console.log('Attempting Discord-specific manual audio capture...');
                            // Discord uses specific class names for video containers
                            const videoContainer = videoElement.closest('[class*="videoWrapper"]') || videoElement.parentElement;
                            if (videoContainer) {
                                const allAudio = videoContainer.querySelectorAll('audio');
                                console.log(`Found ${allAudio.length} audio elements in video container`);
                            }
                        }
                    }
                }
                
            } catch (captureErr) {
                console.error('Failed to capture stream from video, using canvas fallback:', captureErr);
                captureMethod = 'canvas';
                
                // Fallback: Create canvas and capture from it
                const canvas = document.createElement('canvas');
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                const ctx = canvas.getContext('2d');
                
                // Draw video to canvas at interval
                const fps = 30;
                const drawInterval = setInterval(() => {
                    if (videoElement.paused || videoElement.ended) {
                        return;
                    }
                    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                }, 1000 / fps);
                
                // Get stream from canvas
                stream = canvas.captureStream(fps);
                
                // Store canvas info for cleanup
                publishedVideos.set(videoElement, { 
                    canvas, 
                    drawInterval,
                    fallbackMode: true 
                });
            }
            
            // Validate we have a stream
            if (!stream || !(stream instanceof MediaStream)) {
                throw new Error('Failed to create MediaStream from video element');
            }
            
            // Store publish info
            const publishInfo = publishedVideos.get(videoElement) || {};
            publishInfo.vdo = vdo;
            publishInfo.streamId = streamId;
            publishInfo.stream = stream;
            publishInfo.captureMethod = captureMethod;
            publishInfo.label = label || '';
            
            // Add any pending audio resources
            if (videoElement._pendingAudioResources) {
                publishInfo.additionalTracks = videoElement._pendingAudioResources.tracks;
                publishInfo.audioContext = videoElement._pendingAudioResources.contexts[0];
                delete videoElement._pendingAudioResources;
            }
            
            publishedVideos.set(videoElement, publishInfo);
            
            // Connect to signaling server
            console.log('Connecting to VDO.Ninja signaling...');
            await vdo.connect();
            console.log('Connected to signaling');
            
            // Store the stream first
            console.log('Stream details:', { 
                stream, 
                streamId, 
                isMediaStream: stream instanceof MediaStream,
                tracks: stream ? stream.getTracks().map(t => ({kind: t.kind, enabled: t.enabled, readyState: t.readyState})) : null
            });
            
            
            // Room is already set in constructor, so joinRoom is optional
            // But we'll call it anyway for clarity
            console.log('Joining room:', ROOM_ID);
            await vdo.joinRoom({ room: ROOM_ID });
            console.log('Joined room successfully');
			
			
            // Publish the stream
            console.log('Publishing stream...');
            await vdo.publish(stream, { 
                streamID: streamId,
                label: label || ''
            });
            console.log('Published stream:', streamId, 'with label:', label || '');
            
            
            // Add visual indicator
            addPublishingIndicator(videoElement, streamId, stream, label);
            
            // Monitor video element for removal or state changes
            monitorVideoElement(videoElement);
            
            // Update group scene overlay
            createOrUpdateGroupSceneOverlay();
            
        } catch (error) {
            console.error('Error publishing video:', error);
            // Clean up on error
            const publishInfo = publishedVideos.get(videoElement);
            if (publishInfo) {
                if (publishInfo.vdo) {
                    publishInfo.vdo.disconnect();
                }
                if (publishInfo.drawInterval) {
                    clearInterval(publishInfo.drawInterval);
                }
                if (publishInfo.canvas) {
                    publishInfo.canvas.remove();
                }
                publishedVideos.delete(videoElement);
            }
        }
    }
    
    function monitorVideoElement(videoElement) {
        const publishInfo = publishedVideos.get(videoElement);
        if (!publishInfo) return;
        
        // Monitor for video element removal
        const observer = new MutationObserver(() => {
            if (!document.contains(videoElement)) {
                // Check if this is a temporary removal (e.g., due to page interaction)
                // Wait a bit before unpublishing to avoid false positives
                setTimeout(() => {
                    if (!document.contains(videoElement) && publishedVideos.has(videoElement)) {
                        console.log('Video element removed from DOM');
                        unpublishVideo(videoElement);
                        observer.disconnect();
                    }
                }, 1000);
            }
        });
        
        observer.observe(videoElement.parentElement || document.body, {
            childList: true,
            subtree: true
        });
        

        // Monitor video events
        const handleVideoEnd = () => {
            console.log('Video ended');
            unpublishVideo(videoElement);
        };
        
        const handleVideoError = (e) => {
            console.error('Video error:', e);
            unpublishVideo(videoElement);
        };
        
        const handleVideoSourceChange = () => {
            console.log('Video source changed, republishing...');
            unpublishVideo(videoElement).then(() => {
                setTimeout(() => publishVideo(videoElement), 500);
            });
        };
        
        const handleVideoPlay = () => {
            console.log('Video started playing');
            // If not already published, publish it
            if (!publishedVideos.has(videoElement)) {
                publishVideo(videoElement);
            }
        };
        
        const handleVideoPause = () => {
            console.log('Video paused');
            // Keep publishing even when paused
        };
        
        videoElement.addEventListener('ended', handleVideoEnd);
        videoElement.addEventListener('error', handleVideoError);
        videoElement.addEventListener('emptied', handleVideoSourceChange);
        videoElement.addEventListener('play', handleVideoPlay);
        videoElement.addEventListener('pause', handleVideoPause);
        
        // Store cleanup info
        publishInfo.observer = observer;
        publishInfo.eventHandlers = {
            ended: handleVideoEnd,
            error: handleVideoError,
            emptied: handleVideoSourceChange,
            play: handleVideoPlay,
            pause: handleVideoPause
        };
    }
    
    async function unpublishVideo(videoElement) {
        const publishInfo = publishedVideos.get(videoElement);
        if (!publishInfo) {
            return;
        }
        
        console.log('Unpublishing video:', publishInfo.streamId);
        
        try {
            // Disconnect this video's SDK instance
            if (publishInfo.vdo) {
                await publishInfo.vdo.disconnect();
            }
            
            // Only stop tracks if we're using canvas fallback
            // Don't stop tracks from captureStream as it will stop the video
            if (publishInfo.captureMethod === 'canvas' && publishInfo.stream) {
                publishInfo.stream.getTracks().forEach(track => {
                    track.stop();
                });
            }
            
            // Stop any additional tracks (like tab audio) that we created
            if (publishInfo.additionalTracks) {
                publishInfo.additionalTracks.forEach(track => {
                    track.stop();
                });
            }
            
            // Close audio context if we created one
            if (publishInfo.audioContext) {
                publishInfo.audioContext.close();
            }
            
            // Clean up canvas fallback if used
            if (publishInfo.drawInterval) {
                clearInterval(publishInfo.drawInterval);
            }
            if (publishInfo.canvas) {
                publishInfo.canvas.remove();
            }
            
            // Remove event handlers
            if (publishInfo.eventHandlers) {
                for (const [event, handler] of Object.entries(publishInfo.eventHandlers)) {
                    videoElement.removeEventListener(event, handler);
                }
            }
            
            // Disconnect observer
            if (publishInfo.observer) {
                publishInfo.observer.disconnect();
            }
            
            // Remove visual indicator
            removePublishingIndicator(videoElement);
            
            // Remove from tracking
            publishedVideos.delete(videoElement);
            
            // Update group scene overlay
            createOrUpdateGroupSceneOverlay();
            
        } catch (error) {
            console.error('Error unpublishing video:', error);
        }
    }
    
    function addPublishingIndicator(videoElement, streamId, stream, label) {
        // Check if we should delay showing the overlay
        const timeSinceLoad = Date.now() - pageLoadTime;
        const delay = timeSinceLoad < OVERLAY_DELAY ? OVERLAY_DELAY - timeSinceLoad : 0;
        
        setTimeout(() => {
            // Check if video is still published before adding indicator
            if (!publishedVideos.has(videoElement)) {
                return;
            }
            
            const indicator = document.createElement('div');
            indicator.className = 'vdo-publishing-indicator';
            indicator.dataset.streamId = streamId;
            
            const hasVideo = stream.getVideoTracks().length > 0;
            const hasAudio = stream.getAudioTracks().length > 0;
            const videoIcon = hasVideo ? '📹' : '❌';
            const audioIcon = hasAudio ? '🔊' : '🔇';
            
            const displayLabel = label || '';
            
            // Generate solo view link
            const soloLink = `${VDO_NINJA_URL}/?room=${ROOM_ID}&view=${streamId}&solo`;
        
        indicator.innerHTML = `
            <div style="font-weight: bold;">📡 VDO.Ninja</div>
            <div style="font-size: 14px; margin: 4px 0;">${displayLabel}</div>
            <div style="font-size: 10px;">${streamId}</div>
            <div>${videoIcon} ${audioIcon}</div>
            <div style="margin-top: 6px; display: flex; gap: 4px; justify-content: center; pointer-events: auto;">
                <a id="vdo-view-${streamId}" href="${soloLink}" target="_blank" style="
                    color: #4CAF50;
                    text-decoration: none;

                    font-size: 11px;
                    background: rgba(76, 175, 80, 0.2);
                    padding: 2px 6px;
                    border-radius: 3px;
                    display: inline-block;
                    border: 1px solid rgba(76, 175, 80, 0.5);
                    pointer-events: auto;
                ">
                    🔗 View
                </a>
                <button id="vdo-copy-${streamId}" style="
                    color: #4CAF50;
                    background: rgba(76, 175, 80, 0.2);
                    border: 1px solid rgba(76, 175, 80, 0.5);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 11px;
                    cursor: pointer;
                    font-family: monospace;
                    pointer-events: auto;
                ">
                    📋 Copy
                </button>
            </div>
        `;
        
        indicator.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            font-family: monospace;
            pointer-events: none;
            z-index: 10000;
            text-align: center;
            line-height: 1.4;
            border: 2px solid #4CAF50;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        `;
        
        // Make parent relative if needed
        const parent = videoElement.parentElement;
        if (parent) {
            const position = window.getComputedStyle(parent).position;
            if (position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(indicator);
            videoElement.dataset.vdoIndicatorId = streamId;
            
            // Add event listeners after DOM insertion
            const viewLink = indicator.querySelector(`#vdo-view-${streamId}`);
            const copyBtn = indicator.querySelector(`#vdo-copy-${streamId}`);
            
            if (viewLink) {
                viewLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    window.open(soloLink, '_blank');
                    return false;
                }, true);
                
                // Prevent all other events
                ['mousedown', 'mouseup', 'contextmenu'].forEach(eventType => {
                    viewLink.addEventListener(eventType, (e) => {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }, true);
                });
            }
            
            if (copyBtn) {
                copyBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    navigator.clipboard.writeText(soloLink).then(() => {
                        copyBtn.textContent = '✅ Copied!';
                        setTimeout(() => {
                            copyBtn.textContent = '📋 Copy';
                        }, 2000);
                    });
                    return false;
                }, true);
                
                // Prevent all other events
                ['mousedown', 'mouseup', 'contextmenu'].forEach(eventType => {
                    copyBtn.addEventListener(eventType, (e) => {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }, true);
                });
            }
        }
        }, delay); // Add the missing closing parenthesis and delay parameter
    }
    
    function removePublishingIndicator(videoElement) {
        const parent = videoElement.parentElement;
        if (parent) {
            const indicator = parent.querySelector('.vdo-publishing-indicator');
            if (indicator) {
                indicator.remove();
            }
        }
        delete videoElement.dataset.vdoIndicatorId;
    }
    
    function createOrUpdateGroupSceneOverlay() {
        // Remove existing overlay if present
        if (groupSceneOverlay && groupSceneOverlay.parentNode) {
            groupSceneOverlay.remove();
        }
        
        // Only create if we have published videos
        if (publishedVideos.size === 0) {
            return;
        }
        
        // Check if we should delay showing the overlay
        const timeSinceLoad = Date.now() - pageLoadTime;
        const delay = timeSinceLoad < OVERLAY_DELAY ? OVERLAY_DELAY - timeSinceLoad : 0;
        
        console.log(`Group scene overlay delay: ${delay}ms (time since load: ${timeSinceLoad}ms)`);
        
        setTimeout(() => {
            // Double-check we still have published videos
            if (publishedVideos.size === 0) {
                return;
            }
            
            // Create new overlay
            groupSceneOverlay = document.createElement('div');
            groupSceneOverlay.className = 'vdo-group-scene-overlay';
        
        const sceneLink = `${VDO_NINJA_URL}/?room=${ROOM_ID}&scene`;
        const streamCount = publishedVideos.size;
        
        groupSceneOverlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div>
                    <div style="font-weight: bold; font-size: 14px;">📡 VDO.Ninja Group Scene</div>
                    <div style="font-size: 11px; opacity: 0.8;">${streamCount} stream${streamCount !== 1 ? 's' : ''} active • Room: ${ROOM_ID}</div>
                </div>
                <div style="display: flex; gap: 6px;">

                    <a href="${sceneLink}" target="_blank" style="
                        color: white;
                        text-decoration: none;
                        font-size: 12px;
                        background: #4CAF50;
                        padding: 6px 12px;
                        border-radius: 4px;
                        display: inline-block;
                        font-weight: bold;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#45a049'" onmouseout="this.style.background='#4CAF50'">
                        🎬 Open Scene
                    </a>
                    <button style="
                        color: white;
                        background: rgba(255, 255, 255, 0.2);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        padding: 6px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        cursor: pointer;
                        font-family: monospace;
                        font-weight: bold;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" 
                       onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'"
                       onclick="navigator.clipboard.writeText('${sceneLink}').then(() => { this.textContent = '✅ Copied!'; setTimeout(() => { this.textContent = '📋 Copy Link'; }, 2000); });">
                        📋 Copy Link
                    </button>
                </div>
            </div>
        `;
        
        groupSceneOverlay.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: monospace;
            z-index: 10001;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            border: 2px solid #4CAF50;
            backdrop-filter: blur(10px);
        `;
        
        document.body.appendChild(groupSceneOverlay);
        
        // Auto-hide after 10 seconds, show again on hover
        setTimeout(() => {
            if (groupSceneOverlay) {
                groupSceneOverlay.style.opacity = '0.3';
                groupSceneOverlay.style.transition = 'opacity 0.3s';
                
                groupSceneOverlay.addEventListener('mouseenter', () => {
                    groupSceneOverlay.style.opacity = '1';
                });
                
                groupSceneOverlay.addEventListener('mouseleave', () => {
                    groupSceneOverlay.style.opacity = '0.3';
                });
            }
        }, 10000);
        }, delay); // Add the missing closing for setTimeout
    }
    
    // Process existing videos
    function processExistingVideos() {
        const videos = document.querySelectorAll('video');
        console.log(`Found ${videos.length} existing videos`);
        videos.forEach(video => {
            publishVideo(video);
        });
    }
    
    // Set up mutation observer for new videos
    function setupMutationObserver() {
        const observer = new MutationObserver(mutations => {
            // Only process if VDO Ninja is enabled
            if (!vdoNinjaEnabled) return;
            
            mutations.forEach(mutation => {
                // Check added nodes
                mutation.addedNodes.forEach(node => {
                    if (node.nodeName === 'VIDEO') {
                        console.log('New video element detected');
                        publishVideo(node);
                    } else if (node.querySelectorAll) {
                        const videos = node.querySelectorAll('video');
                        videos.forEach(video => {
                            console.log('New video element detected in subtree');
                            publishVideo(video);
                        });
                    }
                });
            });
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('Mutation observer setup complete');
    }
    
    // Handle page cleanup
    window.addEventListener('beforeunload', () => {
        console.log('Page unloading, cleaning up...');
        publishedVideos.forEach((info, video) => {
            unpublishVideo(video);
        });
    });
    
    // Initialize
    console.log('Waiting for DOM to be ready...');
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            analyzeAudioSources(); // Always analyze audio sources for debugging
            setupMutationObserver(); // Set up observer (it will check vdoNinjaEnabled internally)
            // Don't process videos here - wait for settings to load
        });
    } else {
        // DOM already loaded
        analyzeAudioSources(); // Always analyze audio sources for debugging
        setupMutationObserver(); // Set up observer (it will check vdoNinjaEnabled internally)
        // Don't process videos here - wait for settings to load
    }
	
	// Handle settings from background script
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){
		if (response && "settings" in response){
			settings = response.settings;
			const newState = settings?.vdoninjadiscord ? true : false;
			if (newState !== vdoNinjaEnabled) {
				vdoNinjaEnabled = newState;
				console.log('VDO.Ninja state from settings:', vdoNinjaEnabled);
				if (vdoNinjaEnabled) {
					console.log('VDO.Ninja Direct WebRTC Auto-Publisher initialized');
					console.log('Room ID:', ROOM_ID);
					console.log(`View URL: ${VDO_NINJA_URL}/?room=${ROOM_ID}&scene`);
					processExistingVideos();
				}
			}
		}
	});


	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try {
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						// Check if vdoninjadiscord changed
						const newState = settings?.vdoninjadiscord ? true : false;
						if (newState !== vdoNinjaEnabled) {
							const wasEnabled = vdoNinjaEnabled;
							vdoNinjaEnabled = newState;
							console.log('VDO.Ninja setting changed via message:', vdoNinjaEnabled);
							
							if (!wasEnabled && vdoNinjaEnabled) {
								// Just enabled
								console.log('VDO.Ninja enabled, starting video processing');
								processExistingVideos();
							} else if (wasEnabled && !vdoNinjaEnabled) {
								// Just disabled
								console.log('VDO.Ninja disabled, cleaning up');
								cleanupAllVideos();
							}
						}
					
						sendResponse(true);
						return;
					}
				}
			} catch(e){
				console.error('Error handling settings message:', e);
			}
			sendResponse(false);
		}
	);
    
})();
