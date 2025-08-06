function log(msg) {
	if (devmode) { // only show log if in dev mode; else it will just spam the log and cause higher resource usage
		console.log(msg);
	}
}
window.onerror = function(message, source, lineno, colno, error) {
	console.error("Global error:", message, "at", source, ":", lineno);
	return true;
};
window.addEventListener('unhandledrejection', (event) => {
	console.error('Unhandled promise rejection:', event.reason);
});

function getOperatingSystem() {
	const platform = navigator.platform.toLowerCase();
	if (platform.includes('mac')) return 'mac';
	if (platform.includes('linux')) return 'linux';
	return 'windows'; // Default to Windows for other cases
}

function getConfigFileName(os) {
	switch (os) {
		case 'mac':
			return 'config_mac_0.json';
		case 'linux':
			return 'config_linux_0.json';
		default:
			return 'config_0.json';
	}
}

function compareVersions(version1, version2) {
	const parts1 = version1.split('.').map(Number);
	const parts2 = version2.split('.').map(Number);

	for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
		const num1 = parts1[i] || 0;
		const num2 = parts2[i] || 0;

		if (num1 > num2) return 1;
		if (num2 > num1) return -1;
	}

	return 0;
}
async function getRumbleVideoId(url) {
	var videoID = "";
	await fetch(url)
		.then(res => res.text())
		.then(res => {
			res.split("video_id: ").forEach(bit => {
				if (parseInt(bit.split(", ")[0]) == bit.split(", ")[0]) {
					if (bit.split(", ")[0]) {
						videoID = bit.split(", ")[0];
					}
				}
			});
		}).catch(e => {
			console.error(e);
		});
	return videoID
}

async function getRumbleChatId(videoId) {
	// Convert video ID to full URL if needed
	const url = videoId.startsWith('http') ? videoId : `https://rumble.com/${videoId}.html`;
	
	try {
		const response = await fetch(url);
		const html = await response.text();
		
		// Look for video_id in the page (which is actually the chat ID)
		const match = html.match(/video_id:\s*(\d+)/);
		if (match && match[1]) {
			console.log(`Found Rumble chat ID: ${match[1]} for video: ${videoId}`);
			return match[1];
		}
		
		console.warn(`Could not find chat ID for Rumble video: ${videoId}`);
		return null;
	} catch (e) {
		console.error('Error fetching Rumble chat ID:', e);
		return null;
	}
}
function matchRuleShort(str, rule) {
	var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
	return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str);
}
function getPrimaryDomain(url) {
	try {
		url = url.trim();
		if (!url.startsWith('http://') && !url.startsWith('https://')) {
			url = 'https://' + url;
		}
		const parsedUrl = new URL(url);
		const hostParts = parsedUrl.hostname.split('.');
		if (hostParts.length > 2 && hostParts[0] === 'www') {
			return hostParts.slice(-2).join('.');
		}
		return hostParts.slice(-2).join('.');
	} catch (error) {
		console.error('Invalid URL:', error);
		return null;
	}
}
function checkSupported(str) {
	var matches = [];
	manifest.content_scripts.forEach(dom => {
		dom.matches.forEach(dom2 => {
			if (matchRuleShort(str, dom2)) {
				log(dom2);
				if (!matches.includes(dom.js[0])) {
					matches.push(dom.js[0]);
				}
			}
		});
	});
	return matches;
}

const tipsContent = {
	tiktok: `
	<div class="tips-section">
	  <h3>Connection Issues</h3>
	  <p>If the standard activation doesn't work, try these solutions:</p>
	  <ul>
		<li><span class="tips-highlight">Use WebSocket Mode</span> - Click the settings gear icon and select "TikTok WebSocket (read-only)" in the Connection Mode section.</li>
		<li><span class="tips-highlight">Clear Cache</span> - Click the settings gear icon and select "Clear cache & storage" to reset any problematic data.</li>
		<li><span class="tips-highlight">Try Sign-in</span> - Use the Sign-in button to authenticate to TikTok.</li>
	  </ul>
	</div>
	<div class="tips-section">
	  <h3>Common Issues</h3>
	  <p><span class="tips-warning">Multiple Viewers:</span> If you're viewing TikTok in your browser or from the same IP elsewhere, it may cause the video/chat to stop working.</p>
	  <p><span class="tips-warning">Multiple Sign-ins:</span> If you are signed into TikTok multiple times with the same account, TikTok might stop working.</p>
	  <p><span class="tips-warning">Rate Limiting:</span> TikTok may restrict access if you make too many connection attempts in a short period.</p>
	  <p>Solutions:</p>
	  <ul>
		<li>Avoid watching the same stream in multiple places</li>
		<li>Create a secondary TikTok account to sign in with instead</li>
		<li>Clear cache and try again after a few minutes</li>
		<li>Try using the WebSocket connection mode</li>
	  </ul>
	</div>
  `
};
function showTips(ele) {
	showTipsModal(ele.parentNode.dataset.target || ele.dataset.target || ele.parentNode.parentNode.dataset.target);
}
function showTipsModal(platform) {
	if (!tipsContent[platform]) return;
	const modal = document.getElementById('tipsModal');
	const modalTitle = document.getElementById('tipsModalTitle');
	const modalContent = document.getElementById('tipsModalContent');
	modalTitle.textContent = `Tips for ${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
	modalContent.innerHTML = tipsContent[platform];
	modal.classList.remove('hidden');
}
function closeTipsModal() {
	document.getElementById('tipsModal').classList.add('hidden');
}
window.closeTipsModal = closeTipsModal;
	
const Toast = {
	container: null,

	init() {
		this.container = document.getElementById('toastContainer');
		if (!this.container) {
			this.container = document.createElement('div');
			this.container.id = 'toastContainer';
			this.container.className = 'toast-container';
			document.body.appendChild(this.container);
		}
	},

	show(options) {
		this.init();

		// Handle when show is called with just strings
		if (typeof options === 'string') {
			options = {
				message: options
			};
		}

		const defaults = {
			title: '',
			message: '',
			type: 'info', // info, success, warning, error
			duration: 5000, // ms
			showProgress: true,
			onClose: null
		};

		const settings = {
			...defaults,
			...options
		};

		// Create toast element
		const toast = document.createElement('div');
		toast.className = `toast toast-${settings.type}`;

		// Create content
		let iconClass = '';
		switch (settings.type) {
			case 'success':
				iconClass = 'la-check-circle';
				break;
			case 'warning':
				iconClass = 'la-exclamation-triangle';
				break;
			case 'error':
				iconClass = 'la-exclamation-circle';
				break;
			default:
				iconClass = 'la-info-circle';
		}

		// Debug
		console.log("Creating toast with:", {
			title: settings.title,
			message: settings.message,
			type: settings.type
		});

		toast.innerHTML = `
	  <div class="toast-icon">
		<i class="las ${iconClass}"></i>
	  </div>
	  <div class="toast-content">
		${settings.title ? `<div class="toast-title">${settings.title}</div>` : ''}
		<p class="toast-message">${String(settings.message)}</p>
	  </div>
	  <button class="toast-close">
		<i class="las la-times"></i>
	  </button>
	  ${settings.showProgress ? '<div class="toast-progress"><div class="toast-progress-bar"></div></div>' : ''}
	`;

		// Add to container
		this.container.appendChild(toast);

		// Animate progress bar
		const progressBar = toast.querySelector('.toast-progress-bar');
		if (progressBar && settings.showProgress && settings.duration > 0) {
			progressBar.style.animation = `progress ${settings.duration / 1000}s linear forwards`;
		}

		// Show toast with slight delay to trigger animation
		setTimeout(() => {
			toast.classList.add('show');
		}, 10);

		// Set up close button
		const closeBtn = toast.querySelector('.toast-close');
		if (closeBtn) {
			closeBtn.addEventListener('click', () => {
				this.hide(toast);
				if (typeof settings.onClose === 'function') {
					settings.onClose();
				}
			});
		}

		// Auto-close after duration
		if (settings.duration > 0) {
			setTimeout(() => {
				if (toast.parentNode) {
					this.hide(toast);
					if (typeof settings.onClose === 'function') {
						settings.onClose();
					}
				}
			}, settings.duration);
		}

		return toast;
	},

	hide(toast) {
		toast.classList.remove('show');

		// Remove element after animation
		setTimeout(() => {
			if (toast.parentNode) {
				toast.parentNode.removeChild(toast);
			}
		}, 300);
	},

	success(message, title = '', options = {}) {
		if (typeof title === 'object') {
			options = title;
			title = '';
		}
		return this.show({
			...options,
			title,
			message,
			type: 'success'
		});
	},

	info(message, title = '', options = {}) {
		if (typeof title === 'object') {
			options = title;
			title = '';
		}
		return this.show({
			...options,
			title,
			message,
			type: 'info'
		});
	},

	warning(message, title = '', options = {}) {
		if (typeof title === 'object') {
			options = title;
			title = '';
		}
		return this.show({
			...options,
			title,
			message,
			type: 'warning'
		});
	},

	error(message, title = '', options = {}) {
		if (typeof title === 'object') {
			options = title;
			title = '';
		}
		return this.show({
			...options,
			title,
			message,
			type: 'error'
		});
	}
};
function getDefaultConfig() {
	const platform = navigator.platform.toLowerCase();
	const baseConfig = {
		"global": {
			"userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
			"size": {
				"width": 600,
				"height": 450
			},
			"signin": {
				"userAgent": "Chrome",
				"size": {
					"width": 600,
					"height": 600
				}
			}
		}
	};
	if (platform.includes('mac')) {
		baseConfig.global.userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
	} else if (platform.includes('linux')) {
		baseConfig.global.userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
	} else { // Default to Windows NT 10
		baseConfig.global.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
	}
	return baseConfig;
}
function manageWelcomePage() {
  const hasEntries = document.querySelectorAll('#sources .entry:not(#sourceTemplate)').length > 0;
  let welcomeFrame = document.getElementById('welcomeFrame');
  if (!hasEntries) {
	if (!welcomeFrame) {
	  welcomeFrame = document.createElement('iframe');
	  welcomeFrame.style.cssText = 'width: 100%; height: calc(100vh - 130px); border: none; margin-top: 15px;';
	  welcomeFrame.id = 'welcomeFrame';
	  welcomeFrame.setAttribute("allowtransparency", "true");
	  welcomeFrame.allow = "clipboard-write;document-domain;encrypted-media;sync-xhr;usb;web-share;cross-origin-isolated;accelerometer;midi *;geolocation;autoplay;camera;microphone;fullscreen;gyroscope;shared-array-buffer;";
	  const welcomeURL =
			sourcemode ?
			`${sourcemode}/docs/ssapp.html` : devmode ?
			`file:///C:/Users/steve/Code/social_stream/docs/ssapp.html` :
			isBetaMode ?
			`https://socialstream.ninja/beta/docs/ssapp.html` :
			`https://socialstream.ninja/docs/ssapp.html`;
	  welcomeFrame.src = welcomeURL;
	  welcomeFrame.onerror = ()=>{
		  welcomeFrame.style.display = "none";
	  }
	  const insertAfter = document.querySelector('#sources p');
	  if (insertAfter && insertAfter.nextSibling) {
		insertAfter.parentNode.insertBefore(welcomeFrame, insertAfter.nextSibling);
	  } else if (document.getElementById('sources')) { // Ensure #sources exists
		document.getElementById('sources').appendChild(welcomeFrame);
	  }
	}
  } else if (welcomeFrame) {
	welcomeFrame.remove();
  }
}