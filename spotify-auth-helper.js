// Spotify Auth Helper for Electron App
// This file helps complete the Spotify OAuth flow in the Electron app

function completeSpotifyAuth(callbackUrl) {
    if (!callbackUrl) {
        console.error("Please provide the callback URL from Spotify");
        return;
    }
    
    // Send the callback to background.js
    chrome.runtime.sendMessage({
        cmd: "spotifyManualCallback",
        url: callbackUrl
    }, response => {
        if (response && response.success) {
            console.log("✅ Spotify authentication successful!");
            console.log("You can now close this console and use Spotify features.");
        } else {
            console.error("❌ Spotify authentication failed:", response ? response.error : "Unknown error");
            console.log("Please check the background page console for more details.");
        }
    });
}

// Make the function globally available
window.completeSpotifyAuth = completeSpotifyAuth;

console.log("Spotify Auth Helper loaded!");
console.log("To complete authentication, run:");
console.log('completeSpotifyAuth("YOUR_CALLBACK_URL_HERE")');
console.log("\nExample:");
console.log('completeSpotifyAuth("https://socialstream.ninja/spotify.html?code=AQD...&state=...")');