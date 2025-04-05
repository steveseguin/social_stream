<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SocialStream</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
    }
    #frame1 {
      width: 100%;
      height: 100%;
      border: none;
    }
  </style>
</head>
<body>

<iframe id="frame1"></iframe>

<script>
(function (w) {
	w.URLSearchParams = w.URLSearchParams || function (searchString) {
		var self = this;
		self.searchString = searchString;
		self.get = function (name) {
			var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(self.searchString);
			if (results == null) {
				return null;
			} else {
				return decodeURI(results[1]) || 0;
			}
		};
	};
})(window);
var urlParams = new URLSearchParams(window.location.search);
const devmode = urlParams.has("devmode");
ssapp = urlParams.has("ssapp") || ssapp;
var baseURL = "https://socialstream.ninja/";
if (devmode) {
    if (location.protocol === "file:") {
        baseURL = location.href.substring(0, location.href.lastIndexOf('/') + 1);
    } else {
        baseURL = "file:///C:/Users/steve/Code/social_stream/";
    }
} else if (location.protocol !== "chrome-extension:") {
    baseURL = `${location.protocol}//${location.host}/`;
	if (Beta){
		if (baseURL == "https://socialstream.ninja/"){
			baseURL = "https://beta.socialstream.ninja/"
		}
	}
}


if (devmode) {
	iframesrc = "file:///C:/Users/steve/Code/social_stream/popup.html?devmode&ssapp" + localServer + "&basePath=" + encodeURIComponent(basePath);
} else if (sourcemode) {
	iframesrc = sourcemode + "popup.html?sourcemode=" + encodeURIComponent(sourcemode) + "&ssapp" + localServer + "&basePath=" + encodeURIComponent(basePath);
} else if (isBetaMode) {
	iframesrc = "https://beta.socialstream.ninja/popup.html?v=2&ssapp" + localServer + "&basePath=" + encodeURIComponent(basePath);
} else {
	iframesrc = "https://socialstream.ninja/popup.html?v=2&ssapp" + localServer + "&basePath=" + encodeURIComponent(basePath);
}

// Setup for iframe domain access to IndexedDB
(function() {
    // Check if we're in Electron
    const isElectron = window.navigator.userAgent.indexOf('Electron') !== -1;
    
    // Force same-origin for IndexedDB sharing
    if (isElectron) {
        // For Electron, we can use a custom protocol to ensure same origin
        if (iframesrc.startsWith("file://")) {
            // If this is an Electron app and we're trying to use file:// in the iframe
            // We need to switch to the app:// protocol or similar
            try {
                // This assumes you've registered the app:// protocol in your main process
                const path = iframesrc.replace("file:///", "");
                iframesrc = "https://socialstream.ninja/popup.html" + iframesrc.substring(iframesrc.indexOf("?"));
            } catch (e) {
                console.error("Error modifying iframe source:", e);
            }
        }
    } else {
        // For regular browser, ensure same origin
        if (iframesrc.startsWith("file://") || 
            !iframesrc.startsWith(window.location.origin)) {
            // If the iframe source doesn't match our origin, modify it
            const queryParams = iframesrc.substring(iframesrc.indexOf("?"));
            iframesrc = window.location.origin + "/popup.html" + queryParams;
        }
    }
    
    // Add messaging for explicit data sharing if needed
    window.addEventListener('message', function(event) {
        // Only accept messages from our known origins
        const allowedOrigins = [
            "https://socialstream.ninja", 
            "https://beta.socialstream.ninja"
        ];
        
        if (devmode || allowedOrigins.includes(event.origin)) {
            if (event.data && event.data.type === 'indexeddb-sync') {
                // Handle IndexedDB sync requests between frames if needed
                console.log("Received IndexedDB sync request:", event.data);
                // Implement your sync logic here
            }
        }
    });
})();

if (!document.getElementById("frame1").src || (iframesrc !== document.getElementById("frame1").src)) {
	document.getElementById("frame1").src = iframesrc;
}
</script>

</body>
</html>