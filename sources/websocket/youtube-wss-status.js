/*
  YouTube WebSocket status hooks for Social Stream
  - Sends lightweight status signals (signin_required, connected, disconnected, error)
  - Works without modifying upstream logic; can be included after youtube.js
  Usage:
    1) Add to sources/websocket/youtube.html after existing scripts:
         <script src="./youtube-wss-status.js"></script>
       or
    2) Append the contents of this file to the end of sources/websocket/youtube.js
*/
(function(){
  try {
    const TAB_ID = (typeof window.__SSAPP_TAB_ID__ !== 'undefined') ? window.__SSAPP_TAB_ID__ : null;

    function notifyApp(status, message){
      try {
        const payload = { wssStatus: { platform: 'youtube', status, message } };
        if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) {
          window.chrome.runtime.sendMessage(window.chrome.runtime.id, payload, function(){});
        } else if (window.ninjafy && window.ninjafy.sendMessage) {
          window.ninjafy.sendMessage(null, payload, null, TAB_ID);
        } else {
          // Plain postMessage fallback
          const data = { ...payload };
          if (TAB_ID !== null) data.__tabID__ = TAB_ID;
          window.postMessage(data, '*');
        }
      } catch(e){ /* swallow */ }
    }

    // Expose for manual/advanced usage
    window.ssWssNotify = notifyApp;

    // On load: if no OAuth token, request sign-in
    const initialCheck = () => {
      try {
        const hasToken = !!localStorage.getItem('youtubeOAuthToken');
        if (!hasToken) notifyApp('signin_required','Sign in with YouTube to continue');
      } catch(_){}
    };

    // Watch for live chat connect/disconnect via global variable
    function watchLiveChat(){
      try {
        let prev = null;
        setInterval(() => {
          try {
            const cur = (typeof window.liveChatId !== 'undefined') ? window.liveChatId : null;
            if (cur && !prev) notifyApp('connected','Connected to YouTube live chat');
            if (!cur && prev) notifyApp('disconnected','Disconnected from YouTube live chat');
            prev = cur;
          } catch(_){}
        }, 1500);
      } catch(_){}
    }

    // Intercept YouTube Data API errors and forward as error status
    function patchFetchErrors(){
      try {
        if (window.__ss_fetch_patched__) return; window.__ss_fetch_patched__ = true;
        const _orig = window.fetch;
        if (typeof _orig !== 'function') return;
        let lastAt = 0;
        const throttle = 3000; // 3s
        const ping = (status, msg) => {
          const now = Date.now();
          if (now - lastAt > throttle) { notifyApp('error', msg || ('YouTube API error: ' + status)); lastAt = now; }
        };
        window.fetch = async function(input, init){
          try {
            const res = await _orig(input, init);
            const url = (typeof input === 'string') ? input : (input && input.url) || '';
            if (url.includes('googleapis.com/youtube') || url.includes('youtube.googleapis.com')){
              if (!res.ok){
                let msg = `YouTube API ${res.status}`;
                try {
                  const body = await res.clone().json().catch(()=>null);
                  if (body && body.error) {
                    const emsg = body.error.message || '';
                    const reason = (body.error.errors && body.error.errors[0] && body.error.errors[0].reason) || '';
                    if (emsg) msg = emsg;
                    if (reason) msg += ` (${reason})`;
                  }
                } catch(_){ }
                ping(res.status, msg);
              }
            }
            return res;
          } catch(e){
            ping('network_error', e && e.message ? e.message : 'Network error');
            throw e;
          }
        };
      } catch(_){ }
    }

    // Bootstrap
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(initialCheck, 0);
      patchFetchErrors();
      watchLiveChat();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initialCheck, 0);
        patchFetchErrors();
        watchLiveChat();
      });
    }
  } catch(e){}
})();

