// To use, rename custom_sample.js to custom.js



// You'll need to open the locally hosted dock.html file, such as:
// file:///C:/Users/XXXXXXXXXX/Downloads/social_stream/dock.html?session=xxxxxxxxxx&auto1
//
// This will not work if you try to run the dock from https://socialstream.ninja/dock.html
// You can however host the code on your own domain, or run it off github as a fork, instead though
// This specific function is triggered in the dock.html page only
function applyCustomActions(data){
	var tid = false;
	if (data.tid){tid = data.tid;}
	
	if (urlParams.has("auto1")){
		if (data.chatmessage === "1"){
			if (Date.now() - messageTimeout > 60000){ // respond to "1" with a "1" automatically; at most 1 time per minute.
				messageTimeout = Date.now();
				if (data.chatname.toLowerCase() === "pyka"){
					respondP2P("1 <3 <3 <3", tid);
				} else if (data.chatname.toLowerCase() !== "evarate"){
					respondP2P("1", tid);
				}
			}
		}
	}
	
	if (urlParams.has("obscontrol")){
		if (data.chatmessage === "!cycle"){
			if (Date.now() - messageTimeout > 10000){ // Lets someone change the scene once every 10 seconds
				messageTimeout = Date.now();
				cycleScenes();
			}
		}
	}
	
	return data; // return the data, if you want to modify it. If you return "null", it will stop the processing. (also false works, but I'll deprecate that I think)
}

///////

// this next example is specific for the featured chat overlay, instead of the dock
// file:///C:/Users/XXXXXXXXXX/Downloads/social_stream/index.html?session=xxxxxxxxxx
function applyCustomFeatureActions(data){
	var tid = false;
	if (data.tid){tid = data.tid;}
	
	if (!tid) {
	   console.log("Featured overlay cleared.");
	} else {
	   console.log("Message from " + data.chatname + " was featured." );
	}
}



// Below will cycle your OBS scenes when a user enter !cycle into chat.
//
// You also need to have the dock.html in your OBS, 
// with your OBS set to "Advanced access" page permissions, 
// and have &obscontrol added to the dock.html URL
//
function getOBSDetails() {
  return new Promise((resolve, reject) => {
    if (!window.obsstudio) {
      reject(new Error('obsstudio is not available'));
      return;
    }

    let details = {};
    let readOnlyFuncs = [
      //"getControlLevel",
      //"getStatus",
      "getCurrentScene",
      "getScenes",
      //"getTransitions",
      //"getCurrentTransition",
      //"pluginVersion"
    ];

    let promises = [];

    Object.keys(window.obsstudio).forEach((key) => {
      if (typeof window.obsstudio[key] === 'function' && readOnlyFuncs.includes(key)) {
        let promise = new Promise((resolveFunc) => {
          try {
            window.obsstudio[key](function(out) {
              var shortkey = key.replace("get", "");
              shortkey = shortkey[0].toLowerCase() + shortkey.slice(1);
              details[shortkey] = out;
              resolveFunc();
            });
          } catch (e) {
            console.error(e);
            resolveFunc();
          }
        });
        promises.push(promise);
      }
    });

    Promise.all(promises).then(() => {
      resolve(details);
    }).catch((error) => {
      reject(error);
    });
  });
}
function cycleScenes() {
  getOBSDetails().then((details) => {
    if (details && details.scenes && details.currentScene && details.currentScene.name && (details.scenes.length > 1)) {
      let currentIndex = details.scenes.indexOf(details.currentScene.name);
      if (currentIndex !== -1) {
        let nextIndex = (currentIndex + 1) % details.scenes.length;
        let nextScene = details.scenes[nextIndex];
        if (window.obsstudio["setCurrentScene"]) {
          window.obsstudio["setCurrentScene"](nextScene, function() {
          });
        }
      }
    }
  }).catch((error) => {
	console.error(error);
  });
}
