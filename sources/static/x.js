(function() {

    function toDataURL(url, callback) {
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



    var isExtensionOn = false;

    function pushMessage(data) {
        try {
            chrome.runtime.sendMessage(chrome.runtime.id, {
                "message": data
            }, function(e) {});
        } catch (e) {}
    }

    var settings = {};
    // settings.textonlymode
    // settings.captureevents
    chrome.runtime.sendMessage(chrome.runtime.id, {
        "getSettings": true
    }, function(response) { // {"state":isExtensionOn,"streamID":channel, "settings":settings}
        if ("settings" in response) {
            settings = response.settings;
            deTweet();
        }
        if ("state" in response) {
            isExtensionOn = response.state;
            if (document.getElementById("startupbutton")) {
                if (isExtensionOn) {
                    document.getElementById("startupbutton").style.display = "inline-block";
                } else {
                    document.getElementById("startupbutton").style.display = "none";
                }
            }
        }
    });
	
	function findTwitterXLogos() {
		const path = 'M2.205 7.423L11.745 21h4.241L6.446 7.423H2.204zm4.237 7.541L2.2 21h4.243l2.12-3.017-2.121-3.02zM16.957 0L9.624 10.435l2.122 3.02L21.2 0h-4.243zm.767 6.456V21H21.2V1.51l-3.476 4.946z';
		const svgs = document.getElementsByTagName('svg');
		return Array.from(svgs).filter(svg => {
			const pathElements = svg.getElementsByTagName('path');
			return Array.from(pathElements).some(p => p.getAttribute('d') === path);
		});
	}

    var grabbedTweets = localStorage.getItem('grabbedTweets') || false;
    if (grabbedTweets) {
        try {
            grabbedTweets = JSON.parse(grabbedTweets);
        } catch (e) {
            grabbedTweets = [];
        }
    } else {
        grabbedTweets = [];
    }

    var enabledSSN = localStorage.getItem('enabledSSN') === 'true';
    console.log("enabledSSN :" + enabledSSN);

    if (enabledSSN) {
        var autoGrabTweets = localStorage.getItem('autoGrabTweets') === 'true';
        console.log("autoGrabTweets :" + autoGrabTweets);
    } else {
        var autoGrabTweets = false;
        localStorage.setItem('autoGrabTweets', "false");
    }

    var blockingAds = localStorage.getItem('blockingAds') === 'true';

    localStorage.setItem('blockingAds', blockingAds.toString());


    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            try {
                if ("focusChat" == request) { // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
                    return;
                }
                if (typeof request === "object") {
                    if ("settings" in request) {
                        settings = request.settings;
                        deTweet();
                    }
                    if ("state" in request) {
                        isExtensionOn = request.state;

                        if (document.getElementById("startupbutton")) {
                            if (isExtensionOn && settings.xcapture) {
                                document.getElementById("startupbutton").style.display = "inline-block";
                                document.getElementById("youaresuperfunnybutton").style.display = "inline-block";
                            } else {
                                document.getElementById("startupbutton").style.display = "none";
                                document.getElementById("youaresuperfunnybutton").style.display = "none";
                            }
                            if (enabledSSN) {
                                document.getElementById("startupbutton").style.backgroundColor = "#af5454";
                            }
                        }

                    }
                    sendResponse(true);
                    return;
                }
            } catch (e) {}
            sendResponse(false);
        }
    );

    function escapeHtml(unsafe) {
        try {
            if (settings.textonlymode) { // we can escape things later, as needed instead I guess.
                return unsafe;
            }
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;") || "";
        } catch (e) {
            return "";
        }
    }


    function isEmoji(char) {
        const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;
        return emojiRegex.test(char);
    }

	function getAllContentNodes(element, textonly = false) {
		var resp = "";
		
		if (!element) return resp;
		
		if (!element.childNodes || !element.childNodes.length) {
			if (element.textContent) {
				return cleanText(element.textContent);
			}
			return "";
		}

		element.childNodes.forEach(node => {
			if (node.childNodes.length) {
				if (node.nodeName === "A") {
					let linkText = "";
					const spans = node.querySelectorAll('span[aria-hidden="true"]');
					if (spans.length) {
						linkText = Array.from(spans)
							.map(span => span.textContent)
							.join('');
					} else {
						linkText = node.href || node.textContent;
					}
					resp += " " + linkText +" ";
				} else {
					resp += getAllContentNodes(node, textonly);
				}
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)) {
				let text = cleanText(node.textContent);
				if (text.match(/^https?:\/\//)) {
					resp += " " + text +" ";
				} else {
					resp += text;
				}
			} else if (node.nodeType === 1) {
				if (node.nodeName === "A") {
					let linkText = "";
					const spans = node.querySelectorAll('span[aria-hidden="true"]');
					if (spans.length) {
						linkText = Array.from(spans)
							.map(span => span.textContent)
							.join('');
					} else {
						linkText = node.href || node.textContent;
					}
					resp += " " + linkText + " ";
				} else if (node.nodeName === "IMG") {
					if (node.alt && isEmoji(node.alt)) {
						resp += cleanText(node.alt);
					} else if (!settings.textonlymode && !textonly) {
						node.src = node.src + "";
						resp += node.outerHTML;
					}
				} else if (!settings.textonlymode && !textonly) {
					resp += node.outerHTML;
				}
			}
		});
		return cleanText(resp);
	}

	function cleanText(text) {
		return escapeHtml(text)
			.replace(/…/g, '')
			.replace(/&#039;/g, "'")
			.replace(/\s+/g, ' ')
			.trim();
	}
    function prepMessage(ele) {
        if (ele == window) {
            return;
        }

        if (this.targetEle) {
            ele = this.targetEle.parentNode;;
            var base = ele.querySelector("[data-testid='tweet']");
        } else if (this && this.parentNode) {
            ele = this.parentNode;
            var base = ele.querySelector("[data-testid='tweet']");
        } else {
            base = ele;
        }

        if (!base) {
            console.log("no base");
            return;
        }
        var userid = "";
        try {
            userid = base.querySelector("div[id][data-testid='User-Name'] a[href][role='link']").href.split("/").pop();
        } catch (e) {
            userid = "";
        }
        try {
            var chatname = base.querySelectorAll("a[role='link']")[1].childNodes[0].childNodes[0].innerText.trim();

            if (!chatname.length) {
                chatname = base.querySelectorAll("a[role='link']")[1].querySelector("[id]").childNodes[0].innerText.trim();
            }
        } catch (e) {
            var chatname = "";
        }


        if (!chatname) {
            try {
                if (base.querySelectorAll("a[role='link']")[0].id) {
                    chatname = base.querySelectorAll("a[role='link']")[2].childNodes[0].childNodes[0].innerText.trim();

                    if (!chatname.length) {
                        chatname = base.querySelectorAll("a[role='link']")[2].querySelector("[id]").childNodes[0].innerText.trim();
                    }
                }
            } catch (e) {
                chatname = "";
            }
        }

        var chatimg = false;
        var contentimg = false;
        try {
            chatimg = base.childNodes[0].querySelector("img").src
        } catch (e) {}

        var chatmessage = "";
        try {

            chatmessage = base.querySelector("[lang]");
            if (chatmessage) {
               /*  var links = chatmessage.querySelectorAll("a");
                for (var i = 0; i < links.length; i++) {
                    if (links[i].innerText.length > 15) {
                        links[i].innerText = links[i].innerText.substring(0, 15) + "...";
                    }
                } */
				try {
					chatmessage = getAllContentNodes(chatmessage);
				} catch(e){
					console.error(e);
				}
            }

            if (!chatmessage.length) {
                chatmessage = getAllContentNodes(base.childNodes[1].childNodes[1].childNodes[1].innerText);
            }
            try {
                contentimg = base.querySelector("video").getAttribute("poster");
            } catch (e) {

                try {
                    contentimg = base.querySelector("[lang]").parentNode.nextElementSibling.querySelector("img").src;
                } catch (e) {
                    contentimg = "";
                }
            }

        } catch (e) {
            if (!chatmessage) {
                try {
                    if (ele.parentNode.querySelectorAll("[lang]").length) {
                        chatmessage = getAllContentNodes(ele.parentNode.querySelector("[lang]").innerText);
                    }
                } catch (e) {}
            } else {}

            try {
                contentimg = ele.parentNode.querySelector("video").getAttribute("poster"); //tweetPhoto
            } catch (e) {
                try {
                    contentimg = ele.parentNode.querySelector("[data-testid='tweetPhoto']").querySelector("img").src;
                } catch (e) {
                    try {
                        contentimg = base.parentNode.childNodes[1].childNodes[1].childNodes[1].parentNode.nextElementSibling.querySelector("img").src;
                    } catch (e) {}
                }
            }
        }

        if (!contentimg) {
            try {
                contentimg = base.querySelector("[data-testid='card.wrapper'] img[src], [data-testid='tweetPhoto'] img[src]").src;
            } catch (e) {}
        }


        if (!chatmessage) {
            chatmessage = "";
        }
		
		chatmessage = chatmessage.replaceAll("  "," ");


        var chatdonation = false;
        var chatmembership = false;
        var chatsticker = false;


        base.style.backgroundColor = "#CCC!important";

        ele.classList.add("shown-comment");

        var hasDonation = '';

        var hasMembership = '';

        var backgroundColor = "";
        var textColor = "";

        /* try {
            var msglink = ele.querySelector("a[href] > time").parentNode.href;
            if (autoGrabTweets) {
                if (grabbedTweets.includes(msglink)) {
                    return;
                }
            }
            grabbedTweets.push(msglink);
            grabbedTweets = grabbedTweets.slice(-250);
            localStorage.setItem('grabbedTweets', JSON.stringify(grabbedTweets));
        } catch (e) {
            if (autoGrabTweets) {
                return;
            }
        } */


        var data = {};
        data.chatname = chatname;
        data.chatbadges = "";
        data.backgroundColor = backgroundColor;
        data.textColor = textColor;
        data.chatmessage = chatmessage;
        data.chatimg = chatimg;
        data.hasDonation = hasDonation;
        data.hasMembership = hasMembership;
        data.contentimg = contentimg;
        data.textonly = settings.textonlymode || false;
        data.userid = userid;

        if (settings.detweet) {
            data.type = "twitter";
        } else {
            data.type = "x";
        }
		
        pushMessage(data);
    };

    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.altKey && event.shiftKey && event.key === 'V') {
            console.log('Ctrl + Alt + Shift + V pressed!');
            downloadCurrentVideo();
        }
    });

    function downloadCurrentVideo() {
        let videoElement = document.querySelector('video');
        let recorder;
        let data = [];

        function createRecorder() {
            let stream = videoElement.captureStream();
            recorder = new MediaRecorder(stream);
            recorder.ondataavailable = event => data.push(event.data);
            recorder.onstop = downloadVideo;
        }

        function isVideoPlaying(video) {
            return !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
        }

        function downloadVideo() {
            console.log("finished saving video");

            let blob = new Blob(data, {
                type: 'video/mp4'
            });
            let url = URL.createObjectURL(blob);
            let a = document.createElement("a");
            a.href = url;
            let segments = location.href.split('/');
            let filename = segments[segments.length - 1];
            a.download = filename + '.mp4';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            recorder = null;
            data = [];
            videoElement.pause();
        }

        ['pause', 'ended', 'error'].forEach(event => {
            videoElement.addEventListener(event, () => {
                if (recorder && recorder.state === 'recording') {
                    recorder.stop();
                }
            });
        });

        data = [];
        createRecorder();
        videoElement.currentTime = 0;
        console.log("started saving video");
        if (!isVideoPlaying(videoElement)) {
            videoElement.play().then(() => {
                recorder.start();
            });
        } else {
            recorder.start();
        }

    }

    function checkButtons() {

        if (!isExtensionOn || !enabledSSN || !settings.xcapture) {
            return;
        }
        try {
            var bases = document.querySelector('main[role="main"]').querySelectorAll('article[role="article"]');
            bases = [...bases].reverse();
        } catch (e) {
            return;
        }

        for (var i = 0; i < bases.length; i++) {

            try {
                if (autoGrabTweets) {
                    prepMessage(bases[i]);
                } else {
                    if (!bases[i].dataset.set) {
                        bases[i].dataset.set = true;
                        var button = document.createElement("button");
                        button.onclick = prepMessage;
                        button.innerHTML = "Grab";
                        button.style = "text-align: center;font-family:Tahoma;transition: all 0.2s linear; border:1px solid #0007; width: 48px; height: 48px; border-radius: 50px; padding: 4px; margin: 8px 10px 10px 6px; background-color: rgb(117 153 117); cursor:pointer;"
                        button.className = "btn-push-twitter";
                        button.targetEle = bases[i];
                        //bases[i].appendChild(button);

                        try {
                            bases[i].querySelector('[data-testid="Tweet-User-Avatar"]').parentNode.appendChild(button);
                        } catch (e) {
                            try {
                                bases[i].querySelector('[data-testid="tweet"]').childNodes[0].appendChild(button);
                            } catch (e) {
                                bases[i].appendChild(button);
                            }
                        }
                    }

                }
            } catch (e) {}
        }
		if (settings.storeBSky && autoGrabTweets){
			try {
				bases = document.querySelector('main[role="main"]').querySelectorAll('[data-testid="UserCell"]:not([data-set])');
				bases = [...bases].reverse();
				for (var i = 0; i < bases.length; i++) {
					if (autoGrabTweets) {
						
						try {
							bases[i].dataset.set = "true";
							let base = bases[i].querySelector("[data-testid^='UserAvatar']").parentNode.parentNode.parentNode;
							
							var data = {};
							data.chatname = base.querySelector("a[role][href^='/']:not([tabindex]").textContent;
							
							
							try {
								data.chatmessage = base.childNodes[1].childNodes[1].textContent;
							} catch(e){
								
								data.chatmessage = "";
							}
							try {
								data.chatimg = base.querySelector("[data-testid^='UserAvatar'] img[src]").src;
							} catch(e){}
							
							data.textonly = settings.textonlymode || false;
							data.userid = base.querySelector("a[href]").href.split("/").pop();

							if (settings.detweet) {
								data.type = "twitter";
							} else {
								data.type = "x";
							}
							
							pushMessage(data);
						} catch(e){console.error(e);}
					};
				}
			} catch (e) {
				return;
			}
			
		}
    }

    function startup() {
        checkButtons();
        setInterval(function() {
            checkButtons();
        }, 2000);
    }

    function preStartup() {
        if (!document.getElementById("startupbutton")) {

            clearTimeout(preStartupInteval);
            startup();

            if (!document.querySelector('header[role="banner"]')) {
                return;
            }

            var elesMain = document.querySelector('header[role="banner"]').querySelectorAll('a[aria-label][role="link"]');
            try {
                elesMain[elesMain.length - 1].querySelector("a > div").innerText = "Tweet";
            } catch (e) {}

            var button = elesMain[elesMain.length - 1].cloneNode(true);
            button.href = "";
            button.href = "javascript:void(0);"
            button.id = "startupbutton";
            button.onclick = function() {
                //document.getElementById("startupbutton").remove();
                event.preventDefault();
                enabledSSN = !enabledSSN;
                localStorage.setItem('enabledSSN', enabledSSN.toString());

                if (enabledSSN) {
                    document.getElementById("startupbutton").style.backgroundColor = "#af5454";
                    document.getElementById("grabmodebutton").style.display = "inline-block";

                } else {
                    document.getElementById("startupbutton").style.backgroundColor = "#54af54";

                    document.querySelectorAll(".btn-push-twitter").forEach(ele => {
                        ele.style.display = "none";
                    });

                }
                return false;
            };

            button.querySelector("a > div").innerText = "Overlay Service";
            button.querySelector("a > div").style.height = "100%";


            if (!isExtensionOn || !settings.xcapture) {
                button.style.display = "none";
            }

            elesMain[elesMain.length - 1].parentNode.insertBefore(button, elesMain[elesMain.length - 1].nextSibling);
            if (enabledSSN) {
                document.getElementById("startupbutton").style.backgroundColor = "#af5454";
            } else {
                document.getElementById("startupbutton").style.backgroundColor = "#54af54";
            }

            var button3 = button.cloneNode(true);
            button3.onclick = function() {
                event.preventDefault();
                autoGrabTweets = !autoGrabTweets;
                console.log("switch to auto mode: " + autoGrabTweets.toString());

                localStorage.setItem('autoGrabTweets', autoGrabTweets.toString());
                if (!autoGrabTweets) {
                    this.querySelector("div").innerText = "Auto-grab Mode";
                    document.querySelectorAll(".btn-push-twitter").forEach(ele => {
                        ele.style.display = "inline-block";
                    });


                } else {

                    this.querySelector("div").innerText = "Manual Mode";

                    document.querySelectorAll(".btn-push-twitter").forEach(ele => {
                        ele.click();
                        ele.style.display = "none";
                    });

                }
                return false;
            };

            button3.id = "grabmodebutton";
            if (!autoGrabTweets) {
                button3.querySelector("a > div").innerHTML = "Auto-grab Mode";
            } else {
                button3.querySelector("a > div").innerHTML = "Manual Mode";
            }

            if (!isExtensionOn || !enabledSSN || !settings.xcapture) {
                button3.style.display = "none";
            }

            button.parentNode.insertBefore(button3, button.nextSibling);
            document.getElementById("grabmodebutton").style.backgroundColor = "#6254af";
            var button2 = button.cloneNode(true);
            button2.onclick = function() {
                event.preventDefault();
                document.getElementById("youaresuperfunnybutton").remove();

                blockingAds = !blockingAds;
                localStorage.setItem('blockingAds', blockingAds.toString());

                const styleEl = document.createElement("style");
                document.head.appendChild(styleEl);
                styleEl.sheet.insertRule("div[data-testid='Dropdown']{ height:0; opacity:0; }", 0);
                styleEl.sheet.insertRule("[data-testid='sheetDialog'] { animation: fadeIn 3s ease-out forwards;}", 0);
                styleEl.sheet.insertRule("[data-testid='mask'] { opacity: 0;}", 0);
                styleEl.sheet.insertRule(".fade-in { animation: fadeIn 1s ease-out forwards;}", 0);
                styleEl.sheet.insertRule("@keyframes fadeIn {    from {        opacity: 0;    }    to {        opacity: .5;    }}", 0);
                styleEl.sheet.insertRule("article div[data-testid='caret']{ height:0; opacity:0; }", 0);
                styleEl.sheet.insertRule("[data-testid='confirmationSheetConfirm'] div{ height:0; opacity:0; }", 0);
                styleEl.sheet.insertRule("#layers [role='alert'], #layers [role='alertdialog']{ height:0; opacity:0; z-Index:0;}", 0);
			

                setInterval(function() {

                    try {
                        document.querySelector("[data-testid='confirmationSheetConfirm'] div").click();
                        console.log("Blocked an ad");
                    } catch (e) {
                        try {
                            document.querySelector("[data-testid='block'] div span").click();
                        } catch (e) {
                            try {
                                document.querySelector("[data-testid='placementTracking'] article button[data-testid='caret']").click();
                                setTimeout(function() {
                                    try {
                                        document.querySelector("[data-testid='block'] div span").click();
                                        try {
                                            document.querySelector('div > [href="/i/premium_sign_up"]').nextElementSibling.click();
                                        } catch (e) {

                                            setTimeout(function() {
                                                try {
                                                    document.querySelector('div > [href="/i/premium_sign_up"]').nextElementSibling.click();
                                                } catch (e) {}
                                            }, 100);
                                        }



                                    } catch (e) {}
                                }, 250);
                            } catch (e) {}
                        }
                    }
                    try {
                        document.querySelector('div > [href="/i/premium_sign_up"]').nextElementSibling.click();
                    } catch (e) {}
					
                }, 500);
                return false;
            };

            button2.id = "youaresuperfunnybutton";
            button2.querySelector("a > div").innerHTML = "Block Promoted";
            button2.querySelector("a > div").style.height = "100%";


            if (!isExtensionOn || !settings.xcapture) {
                button2.style.display = "none";
            }

            button.parentNode.insertBefore(button2, button.nextSibling);

            document.getElementById("youaresuperfunnybutton").style.backgroundColor = "rgb(151 151 151)";


        }
    }
    var observer = null;

    function monitorTitle() {
        if (observer) {
            return;
        }
        document.title = document.title.replace("/ X", "/ Twitter");
        observer = new MutationObserver(function(mutations) {
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            document.title = document.title.replace("/ X", "/ Twitter");
            setTimeout(function() {
                monitorTitle();
            }, 50);
        });
        observer.observe(
            document.querySelector('title'), {
                subtree: true,
                characterData: true,
                childList: true
            }
        );
    }

    var checkTwitter = null;

    function deTweet() {
        if (!settings.detweet) {
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            return;
        }
        monitorTitle();

        try {
			let testme = document.querySelector("header div > h1[role='heading'] > a[href='/home'] svg:not([data-done])");
			if (testme){
				testme.outerHTML = '\
				<svg dataset-done="true" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 248 204">\
				  <path fill="#1d9bf0" d="M221.95 51.29c.15 2.17.15 4.34.15 6.53 0 66.73-50.8 143.69-143.69 143.69v-.04c-27.44.04-54.31-7.82-77.41-22.64 3.99.48 8 .72 12.02.73 22.74.02\ 44.83-7.61 62.72-21.66-21.61-.41-40.56-14.5-47.18-35.07 7.57 1.46 15.37 1.16 22.8-.87-23.56-4.76-40.51-25.46-40.51-49.5v-.64c7.02 3.91 14.88 6.08 22.92 6.32C11.58 63.31\ 4.74 33.79 18.14 10.71c25.64 31.55 63.47 50.73 104.08 52.76-4.07-17.54 1.49-35.92 14.61-48.25 20.34-19.12 52.33-18.14 71.45 2.19 11.31-2.23 22.15-6.38 32.07-12.26-3.77 11.69-11.66 21.62-22.2 27.93 10.01-1.18 19.79-3.86 29-7.95-6.78 10.16-15.32 19.01-25.2 26.16z"/>\
				</svg>\
			';
			}
			
			const styleEl = document.createElement("style");
			document.head.appendChild(styleEl);
			styleEl.sheet.insertRule('[data-testid="GrokDrawer"]{height:0; opacity:0; z-Index:0;}');
			
			let otherSVG = document.querySelector('[href="/i/premium_sign_up"] svg:not([data-done])');
			if (otherSVG){
				otherSVG.dataset.done = true;
				//otherSVG.done = true;
				otherSVG.innerHTML = '<path d="M221.95 51.29c.15 2.17.15 4.34.15 6.53 0 66.73-50.8 143.69-143.69 143.69v-.04c-27.44.04-54.31-7.82-77.41-22.64 3.99.48 8 .72 12.02.73 22.74.02\ 44.83-7.61 62.72-21.66-21.61-.41-40.56-14.5-47.18-35.07 7.57 1.46 15.37 1.16 22.8-.87-23.56-4.76-40.51-25.46-40.51-49.5v-.64c7.02 3.91 14.88 6.08 22.92 6.32C11.58 63.31\ 4.74 33.79 18.14 10.71c25.64 31.55 63.47 50.73 104.08 52.76-4.07-17.54 1.49-35.92 14.61-48.25 20.34-19.12 52.33-18.14 71.45 2.19 11.31-2.23 22.15-6.38 32.07-12.26-3.77 11.69-11.66 21.62-22.2 27.93 10.01-1.18 19.79-3.86 29-7.95-6.78 10.16-15.32 19.01-25.2 26.16z"/>';
				otherSVG.setAttribute("viewBox","0 0 240 240");
			}
			
			var svgs = findTwitterXLogos();
			svgs.forEach(svg => {
				try {
					// Find the closest ancestor that's an article or div
					let container = svg;
					
					container.innerHTML = '<path d="M221.95 51.29c.15 2.17.15 4.34.15 6.53 0 66.73-50.8 143.69-143.69 143.69v-.04c-27.44.04-54.31-7.82-77.41-22.64 3.99.48 8 .72 12.02.73 22.74.02 44.83-7.61 62.72-21.66-21.61-.41-40.56-14.5-47.18-35.07 7.57 1.46 15.37 1.16 22.8-.87-23.56-4.76-40.51-25.46-40.51-49.5v-.64c7.02 3.91 14.88 6.08 22.92 6.32C11.58 63.31 4.74 33.79 18.14 10.71c25.64 31.55 63.47 50.73 104.08 52.76-4.07-17.54 1.49-35.92 14.61-48.25 20.34-19.12 52.33-18.14 71.45 2.19 11.31-2.23 22.15-6.38 32.07-12.26-3.77 11.69-11.66 21.62-22.2 27.93 10.01-1.18 19.79-3.86 29-7.95-6.78 10.16-15.32 19.01-25.2 26.16z"/>';
					container.setAttribute("viewBox","0 0 240 240");
					container.style.opacity = "0.0";
					
					
				} catch(e) {
					console.error('Error handling SVG:', e);
				}
			});
            var link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = "data:image/png;base64,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";

            
        } catch (e) {
		}
		checkTwitter = setInterval(function() {
			try {
				document.querySelector("header div > h1[role='heading'] > a[href='/home'] svg:not([data-done])").outerHTML = '\
					<svg dataset-done="true" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 248 204">\
					  <path fill="#1d9bf0" d="M221.95 51.29c.15 2.17.15 4.34.15 6.53 0 66.73-50.8 143.69-143.69 143.69v-.04c-27.44.04-54.31-7.82-77.41-22.64 3.99.48 8 .72 12.02.73 22.74.02\ 44.83-7.61 62.72-21.66-21.61-.41-40.56-14.5-47.18-35.07 7.57 1.46 15.37 1.16 22.8-.87-23.56-4.76-40.51-25.46-40.51-49.5v-.64c7.02 3.91 14.88 6.08 22.92 6.32C11.58 63.31\ 4.74 33.79 18.14 10.71c25.64 31.55 63.47 50.73 104.08 52.76-4.07-17.54 1.49-35.92 14.61-48.25 20.34-19.12 52.33-18.14 71.45 2.19 11.31-2.23 22.15-6.38 32.07-12.26-3.77 11.69-11.66 21.62-22.2 27.93 10.01-1.18 19.79-3.86 29-7.95-6.78 10.16-15.32 19.01-25.2 26.16z"/>\
					</svg>\
				';
				
				let otherSVG = document.querySelector('[href="/i/premium_sign_up"] svg:not([data-done])');
				if (otherSVG){
					otherSVG.dataset.done = true;
					//otherSVG.done = true;
					otherSVG.innerHTML = '<path d="M221.95 51.29c.15 2.17.15 4.34.15 6.53 0 66.73-50.8 143.69-143.69 143.69v-.04c-27.44.04-54.31-7.82-77.41-22.64 3.99.48 8 .72 12.02.73 22.74.02\ 44.83-7.61 62.72-21.66-21.61-.41-40.56-14.5-47.18-35.07 7.57 1.46 15.37 1.16 22.8-.87-23.56-4.76-40.51-25.46-40.51-49.5v-.64c7.02 3.91 14.88 6.08 22.92 6.32C11.58 63.31\ 4.74 33.79 18.14 10.71c25.64 31.55 63.47 50.73 104.08 52.76-4.07-17.54 1.49-35.92 14.61-48.25 20.34-19.12 52.33-18.14 71.45 2.19 11.31-2.23 22.15-6.38 32.07-12.26-3.77 11.69-11.66 21.62-22.2 27.93 10.01-1.18 19.79-3.86 29-7.95-6.78 10.16-15.32 19.01-25.2 26.16z"/>';
					otherSVG.setAttribute("viewBox","0 0 240 240");
				}
				
				var svgs = findTwitterXLogos();
				svgs.forEach(svg => {
					try {
						// Find the closest ancestor that's an article or div
						let container = svg;
						container.innerHTML = '<path d="M221.95 51.29c.15 2.17.15 4.34.15 6.53 0 66.73-50.8 143.69-143.69 143.69v-.04c-27.44.04-54.31-7.82-77.41-22.64 3.99.48 8 .72 12.02.73 22.74.02 44.83-7.61 62.72-21.66-21.61-.41-40.56-14.5-47.18-35.07 7.57 1.46 15.37 1.16 22.8-.87-23.56-4.76-40.51-25.46-40.51-49.5v-.64c7.02 3.91 14.88 6.08 22.92 6.32C11.58 63.31 4.74 33.79 18.14 10.71c25.64 31.55 63.47 50.73 104.08 52.76-4.07-17.54 1.49-35.92 14.61-48.25 20.34-19.12 52.33-18.14 71.45 2.19 11.31-2.23 22.15-6.38 32.07-12.26-3.77 11.69-11.66 21.62-22.2 27.93 10.01-1.18 19.79-3.86 29-7.95-6.78 10.16-15.32 19.01-25.2 26.16z"/>';
						container.setAttribute("viewBox","0 0 240 240");
						container.style.opacity = "0.0";
				
						
					} catch(e) {
						console.error('Error handling SVG:', e);
					}
				});
				//clearInterval(checkTwitter);
			} catch (e) {

			}
		}, 1000);
    }

    setTimeout(function() {
        preStartup();
    }, 1000);

    var preStartupInteval = setInterval(function() {
        preStartup();
    }, 5000);

})();