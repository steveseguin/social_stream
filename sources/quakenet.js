// quakenet.js
(function() {
  const scriptName = '[QuakeNet CS Using Ninjafy IPC]';
  console.log(`${scriptName} Initializing.`);
  let settings = {}; // Define settings in a scope accessible by later functions

  function applySettingsAndObserve() {
    // console.log(`${scriptName} Settings applied:`, settings);
    // All your original logic that depends on settings (like processMessage, onElementInserted)
    // would go here or be called from here.
    // For example, to start observing after settings are fetched:
    // if (document.querySelector('.ircwindow') && !document.querySelector('.ircwindow').marked) {
    //   document.querySelector('.ircwindow').marked = true;
    //   onElementInserted(document.querySelector('.ircwindow')); // Make sure onElementInserted is defined
    // }
  }

  if (typeof window.ninjafy !== 'undefined' && typeof window.ninjafy.invokeInMain === 'function') {
    console.log(`${scriptName} Ninjafy bridge found. Using ninjafy.invokeInMain for getSettings.`);
    alert(`${scriptName} Ninjafy bridge found. Using ninjafy.invokeInMain for getSettings.`); // For testing

    window.ninjafy.invokeInMain('ninjafy:getSettings', { forSite: "quakenet" })
      .then(response => {
        console.log(`${scriptName} ninjafy:getSettings response:`, response);
        alert(`${scriptName} ninjafy:getSettings response: ${JSON.stringify(response)}`); // For testing

        if (response && response.settings) {
          settings = response.settings;
          applySettingsAndObserve();
        } else {
          console.error(`${scriptName} Failed to get settings via ninjafy.invokeInMain or invalid response format.`);
          alert(`${scriptName} Failed to get settings via ninjafy.invokeInMain or invalid response format.`);
        }
      })
      .catch(err => {
        console.error(`${scriptName} Error invoking ninjafy:getSettings:`, err);
        alert(`${scriptName} Error invoking ninjafy:getSettings: ${err.message}`);
      });
  } else {
    // Fallback or error if Ninjafy is not available - though it should be if preload ran.
    console.error(`${scriptName} Ninjafy IPC bridge (window.ninjafy.invokeInMain) is not available! Cannot get settings.`);
    alert(`${scriptName} Ninjafy IPC bridge not available!`);
    // You might still try chrome.runtime.sendMessage here as a last resort if this script
    // is used on other sites, but for QuakeNet it's the problem.
  }

  // Your other functions (toDataURL, escapeHtml, getAllContentNodes, processMessage, pushMessage, onElementInserted)
  // would remain here. processMessage would use the `settings` variable.
  // Make sure `pushMessage` is also adapted if it used chrome.runtime.sendMessage.
  // It could use `window.ninjafy.sendToMain('ninjafy:chatMessage', data);`
  // and you'd have an `ipcMain.on('ninjafy:chatMessage', (event, data) => {...});`

  // Example:
  // function pushMessage(data){
  //   if (typeof window.ninjafy !== 'undefined' && typeof window.ninjafy.sendToMain === 'function') {
  //     window.ninjafy.sendToMain('ninjafy:chatMessage', { "message": data });
  //   } else {
  //     // Fallback or error
  //     try { // Original attempt
  //       chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
  //     } catch(e){}
  //   }
  // }

  // The MutationObserver setup via setInterval would be called from applySettingsAndObserve
  // or after settings are confirmed.
  // setInterval(function(){
  //   if (settings.captureevents && document.querySelector('.ircwindow')){ // Check settings
  //     if (!document.querySelector('.ircwindow').marked){
  //       document.querySelector('.ircwindow').marked=true;
  //       onElementInserted(document.querySelector('.ircwindow'));
  //     }
  //   }
  // },1000);

})();