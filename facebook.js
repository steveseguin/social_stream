(function() {
	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, {
				"message": data
			}, function(e) {});
		} catch (e) {}
	}

	function toDataURL(url, callback) { // not needed with Facebook I think.
		var xhr = new XMLHttpRequest();
		xhr.onload = function() {
			var reader = new FileReader();
			reader.onloadend = function() {
				callback(reader.result);
			}
			reader.readAsDataURL(xhr.response);
		};
		xhr.open('GET', url);
		xhr.responseType = 'blob';
		xhr.send();
	}

	function processMessage(ele) {
		if (ele == window) {
			return;
		}
		
		var chatimg = "";
		try {
			var imgele = ele.childNodes[0].querySelector("image");//.href.baseVal; // xlink:href
			chatimg = imgele.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
		} catch(e){
			//console.log(e);
		}
		var badges = [];
		var name = "";
		try {
			var nameElement = ele.childNodes[1].childNodes[0].querySelector('span[dir="auto"]');
			name = nameElement.innerText;
			try {
				nameElement.parentNode.parentNode.childNodes[1].querySelectorAll('img[src]').forEach(img=>{
					if (!img.src.startsWith("data:image/svg+xml,")){
						badges.push(img.src);
					}
				});
			} catch (e) {
				
			}
		} catch (e) {
			try {
				name = ele.childNodes[1].childNodes[0].querySelector('a[role="link"]').innerText;
			} catch (e) {
				return;
			}
		}

		
		/* if (name && !badges.length) {
			name = name.trim();
			ele.childNodes[1].childNodes[0].querySelectorAll('img[src]').forEach(img=>{
				if (!img.src.startsWith("data:image/svg+xml,")){
					badges.push(img.src);
				}
			});
		} */

		var msg = "";

		if (textOnlyMode) {
			try {
				ele.childNodes[1].querySelector('a[role="link"]').parentNode.parentNode.parentNode.querySelector('span[lang]').querySelectorAll('*').forEach(function(node) {

					if (node.nodeName == "IMG") {
						//msg+=node.outerHTML;
					} else {
						node.childNodes.forEach(function(nn) {
							try {
								if (nn.nodeName === "#text") {
									msg += nn.textContent;
								}
							} catch (e) {}
						});
					}
				});
			} catch (e) {
				try {
					ele.childNodes[1].querySelector('a[role="link"]').parentNode.parentNode.parentNode.querySelectorAll('*').forEach(function(node) {
						if (node.nodeName == "IMG") {
							//msg+=node.outerHTML;
						} else {
							node.childNodes.forEach(function(nn) {
								try {
									if (nn.nodeName === "#text") {
										msg += nn.textContent;
									}
								} catch (e) {}
							});
						}
					});
				} catch (e) {}
			}
		} else {
			try {
				ele.childNodes[1].querySelector('a[role="link"]').parentNode.parentNode.parentNode.querySelector('span[lang]').querySelectorAll('*').forEach(function(node) {

					if (node.nodeName == "IMG") {
						msg += node.outerHTML; //////////////
					} else {
						node.childNodes.forEach(function(nn) {
							try {
								if (nn.nodeName === "#text") {
									msg += nn.textContent;
								}
							} catch (e) {}
						});
					}
				});
			} catch (e) {
				try {
					var sister = ele.childNodes[1].querySelectorAll('a[role="link"]');
					if (sister.length){
						try {
							sister[sister.length-1].parentNode.parentNode.previousSibling.querySelector('span[lang]').querySelectorAll('*').forEach(function(node) {
								if (node.nodeName == "IMG") {
									msg += node.outerHTML; ////////////////
								} else {
									node.childNodes.forEach(function(nn) {
										try {
											if (nn.nodeName === "#text") {
												msg += nn.textContent;
											}
										} catch (e) {}
									});
								}
							});
						} catch(e){
							var test = sister[sister.length-1].parentNode.parentNode.previousSibling.querySelectorAll('[dir="auto"]');
							if (test.length>2){
								test[1].querySelectorAll('*').forEach(function(node) {
									if (node.nodeName == "IMG") {
										msg += node.outerHTML; ///////////////
									} else {
										node.childNodes.forEach(function(nn) {
											try {
												if (nn.nodeName === "#text") {
													msg += nn.textContent;
												}
											} catch (e) {}
										});
									}
								});
							} else {
								sister[sister.length-1].parentNode.parentNode.previousSibling.querySelectorAll('*').forEach(function(node) {
									if (node.nodeName == "IMG") {
										msg += node.outerHTML; ///////////////
									} else {
										node.childNodes.forEach(function(nn) {
											try {
												if (nn.nodeName === "#text") {
													msg += nn.textContent;
												}
											} catch (e) {}
										});
									}
								});
							}
						}
					}
				} catch(e){errorlog(e);}
			}
		}

		if (msg) {
			msg = msg.trim();
			if (name) {
				if (msg.startsWith(name)) {
					msg = msg.replace(name, '');
					msg = msg.trim();
				}
			}
		}

		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "facebook";
		
		//console.log(data);
		
		pushMessage(data);
	}

	var dupCheck = [];

	setTimeout(function() { // clear existing messages; just too much for a stream.
		try {
			if (window.location.href.includes("facebook.com/live/producer/") || window.location.href.includes("/videos/")) {
				var main = document.querySelectorAll("[role='article']");
				for (var j = 0; j < main.length; j++) {
					try {
						if (!main[j].dataset.set123) {
							main[j].dataset.set123 = "true";
							if (main[j].id){
								if (main[j].id.startsWith("client:")) {
									continue;
								}
								if (dupCheck.includes(main[j].id)) {
									continue;
								}
								dupCheck.push(main[j].id);
							//	processMessage(main[j]);
							} else if (main[j].parentNode && main[j].parentNode.id) {
								if (dupCheck.includes(main[j].parentNode.id)){
									continue;
								}
								if (main[j].parentNode.id.startsWith("client:")) {
									continue;
								}
								dupCheck.push(main[j].parentNode.id);
							//	processMessage(main[j]);
							} else if (main[j].parentNode && !main[j].id && !main[j].parentNode.id) {
								var id = main[j].querySelector("[id]"); // an archived video
								if (id && !(dupCheck.includes(id))) {
									dupCheck.push(id);
							//		processMessage(main[j]);
								}
							}
						}
					} catch (e) {}
				}
			}
		} catch (e) {}

		console.log("LOADED SocialStream EXTENSION");

		var ttt = setInterval(function() {
			dupCheck = dupCheck.slice(-60); // facebook seems to keep around 40 messages, so this is overkill?
			try {
				if (window.location.href.includes("facebook.com/live/producer/") || window.location.href.includes("/videos/")) {
					var main = document.querySelectorAll("[role='article']");
					for (var j = 0; j < main.length; j++) {
						try {
							if (!main[j].dataset.set123) {
								main[j].dataset.set123 = "true";
								if (main[j].id){
									if (main[j].id.startsWith("client:")) {
										continue;
									}
									if (dupCheck.includes(main[j].id)) {
										continue;
									}
									dupCheck.push(main[j].id);
									processMessage(main[j]);
								} else if (main[j].parentNode && main[j].parentNode.id) {
									if (dupCheck.includes(main[j].parentNode.id)){
										continue;
									}
									if (main[j].parentNode.id.startsWith("client:")) {
										continue;
									}
									dupCheck.push(main[j].parentNode.id);
									processMessage(main[j]);
								} else if (main[j].parentNode && !main[j].id && !main[j].parentNode.id) {
									var id = main[j].querySelector("[id]"); // an archived video
									if (id && !(dupCheck.includes(id))) {
										dupCheck.push(id);
										processMessage(main[j]);
									}
								}
							}
						} catch (e) {}
					}
				}
			} catch (e) {}
		}, 800);
	}, 1500);

	var textOnlyMode = false;
	chrome.runtime.sendMessage(chrome.runtime.id, {
		"getSettings": true
	}, function(response) { // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response) {
			if ("textonlymode" in response.settings) {
				textOnlyMode = response.settings.textonlymode;
			}
		}
	});

	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse) {
			try {
				if ("focusChat" == request) {

					var eles = document.querySelectorAll('[contenteditable="true"]');
					if (eles.length) {
						for (var i = 0; i < eles.length; i++) {
							try {
								eles[i].childNodes[0].childNodes[0].childNodes[0].focus();
							} catch (e) {
								if (document.querySelector("[data-editor]>[data-offset-key]")) {
									document.querySelector("[data-editor]>[data-offset-key]").focus();
									continue;
								}
								try {
									eles[i].childNodes[0].focus();
								} catch (e) {
									try {
										eles[i].querySelector("p").focus();
									} catch (e) {}
								}
							}
						}
					} else if (document.querySelector("[data-editor]>[data-offset-key]")) {
						document.querySelector("[data-editor]>[data-offset-key]").focus();
					} else {
						sendResponse(true);
						return;
					}
					sendResponse(true);
					return;
				}
				if ("textOnlyMode" == request) {
					textOnlyMode = true;
					sendResponse(true);
					return;
				} else if ("richTextMode" == request) {
					textOnlyMode = false;
					sendResponse(true);
					return;
				}
			} catch (e) {}

			sendResponse(false);
		}
	);


})();