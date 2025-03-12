(function() {
	
	
	const avatarCache = {
		_cache: {},
		MAX_SIZE: 300,
		CLEANUP_COUNT: 50,
		
		add(chatname, chatimg) {
			if (!chatname || !chatimg) return;
			
			this._cache[chatname] = {
				url: chatimg,
				timestamp: Date.now()
			};
			
			this.cleanup();
		},
		
		get(chatname) {
			const avatar = this._cache[chatname];
			return avatar ? avatar.url : null;
		},
		
		cleanup() {
			const cacheSize = Object.keys(this._cache).length;
			if (cacheSize > this.MAX_SIZE) {
				// Sort by timestamp and remove oldest entries
				const sorted = Object.entries(this._cache)
					.sort(([,a], [,b]) => a.timestamp - b.timestamp);
					
				for (let i = 0; i < this.CLEANUP_COUNT; i++) {
					if (sorted[i]) {
						delete this._cache[sorted[i][0]];
					}
				}
			}
		}
	};

	const messageLog = {
		_log: {},
		_cleanupInterval: null,
		
		init() {
			// Clear any existing interval
			if (this._cleanupInterval) {
				clearInterval(this._cleanupInterval);
			}
			// Set up periodic cleanup
			this._cleanupInterval = setInterval(() => this.cleanup(), 5000);
		},
		
		cleanup() {
			const currentTime = Date.now();
			Object.keys(this._log).forEach(key => {
				if ((currentTime - this._log[key].currentTime) > 3000) {
					delete this._log[key];
				}
			});
		},
		
		isDuplicate(name, message, ele) {
			const currentTime = Date.now();
			const messageKey = `${name}:${message}`;
			
			if (this._log[messageKey] && 
				(currentTime - this._log[messageKey].currentTime) <= 3000) {
				if (this._log[messageKey].ele && !this._log[messageKey].ele.isConnected) {
					return true;
				}
			}
			
			this._log[messageKey] = {
				currentTime: currentTime,
				ele: ele
			};
			
			return false;
		},
		
		destroy() {
			if (this._cleanupInterval) {
				clearInterval(this._cleanupInterval);
				this._cleanupInterval = null;
			}
			this._log = {};
		}
	};

	// Initialize when script starts
	messageLog.init();


    function pushMessage(data) {
        try {
            chrome.runtime.sendMessage(chrome.runtime.id, {
                "message": data
            }, function(e) {});
        } catch (e) {}
    }

    function getTranslation(key, value = false) {
        if (settings.translation && settings.translation.innerHTML && (key in settings.translation.innerHTML)) { // these are the proper translations
            return settings.translation.innerHTML[key];
        } else if (settings.translation && settings.translation.miscellaneous && settings.translation.miscellaneous && (key in settings.translation.miscellaneous)) {
            return settings.translation.miscellaneous[key];
        } else if (value !== false) {
            return value;
        } else {
            return key.replaceAll("-", " "); //
        }
    }

    function toDataURL(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {

            var blob = xhr.response;

            if (blob.size > (55 * 1024)) {
                callback(url); // Image size is larger than 25kb.
                return;
            }

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

    function getAllContentNodes(element) { // takes an element.
        var resp = "";
        if (!element) {
            return resp;
        }
        if (!element.childNodes || !element.childNodes.length) {
            if (element.textContent) {
                return escapeHtml(element.textContent) || "";
            } else {
                return "";
            }
        }
        element.childNodes.forEach(node => {
            if (node.childNodes.length) {
                resp += getAllContentNodes(node)
            } else if ((node.nodeType === 3) && node.textContent) {
                resp += escapeHtml(node.textContent);
            } else if (node.nodeType === 1) {
                if (!settings.textonlymode) {
                    if ((node.nodeName == "IMG") && node.src) {
                        node.src = node.src + "";
                        resp += "<img src='" + node.src + "' />";
                    } else {
                        resp += node.outerHTML;
                    }
                }
            }
        });
        return resp;
    }

    function rankToColor(rank, maxRank = 40) {
        const startColor = {
            r: 197,
            g: 204,
            b: 218
        }; // #4F6692
        const midColor = {
            r: 100,
            g: 115,
            b: 225
        }; // #2026B0
        const endColor = {
            r: 81,
            g: 85,
            b: 255
        }; // #0000FF

        const midRank = parseInt(maxRank / 2);
        let colorStop;


        if (rank <= midRank) {
            const ratio = (rank - 1) / (midRank - 1);
            colorStop = {
                r: startColor.r + ratio * (midColor.r - startColor.r),
                g: startColor.g + ratio * (midColor.g - startColor.g),
                b: startColor.b + ratio * (midColor.b - startColor.b),
            };
        } else {
            const ratio = (rank - midRank) / (maxRank - midRank);
            colorStop = {
                r: midColor.r + ratio * (endColor.r - midColor.r),
                g: midColor.g + ratio * (endColor.g - midColor.g),
                b: midColor.b + ratio * (endColor.b - midColor.b),
            };
        }

        const hexColor = `#${Math.round(colorStop.r).toString(16).padStart(2, '0')}` +
            `${Math.round(colorStop.g).toString(16).padStart(2, '0')}` +
            `${Math.round(colorStop.b).toString(16).padStart(2, '0')}`;
        return hexColor;
    }
    var lut = [];
    for (var i = 1; i <= 40; i++) {
        lut.push(rankToColor(i, 40));
    }

    var savedavatars = {};
    var channelName = false;
    var msgCount = 0;
	
	function isDuplicateMessage(name, message, ele) {
		return messageLog.isDuplicate(name, message, ele);
	}
	
	function parseDonationMessage(message) {
		if (!validateTikTokDonationMessage(message)) return null;
		
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = message.trim();
		
		const nodes = Array.from(tempDiv.childNodes);
		const word = nodes[0].textContent.trim();
		const imageSrc = nodes[1].getAttribute('src');
		const quantity = parseInt(nodes[2].textContent.slice(1), 10);
		
		return {
			word,
			imageSrc,
			quantity,
			isValid: true
		};
	}
	
	function validateTikTokDonationMessage(message) {
		// Create a temporary div to parse the HTML
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = message.trim();
		
		// Get all nodes in the message
		const nodes = Array.from(tempDiv.childNodes);
		
		// Message should have exactly 3 parts: text, img, text
		if (nodes.length !== 3) return false;
		
		// First node should be text
		if (nodes[0].nodeType !== Node.TEXT_NODE) return false;
		
		// Second node should be an img
		const imgElement = nodes[1];
		if (!(imgElement instanceof HTMLImageElement)) return false;
		
		// Validate image source - must be from tiktokcdn
		const imgSrc = imgElement.getAttribute('src');
		if (!imgSrc || !imgSrc.includes('tiktokcdn.com')) return false;
		
		// Last node should be text in format "xN" where N is a number
		const lastText = nodes[2].textContent.trim();
		const xNumberPattern = /^x\d+$/;
		if (!xNumberPattern.test(lastText)) return false;
		
		return true;
	}
	
	function cleanupOldMessages() {
		try {
			// Find all chat message elements with skip dataset
			const messageElements = document.querySelectorAll('[data-skip]:not([data-done])');
			const maxMessages = 30;
			
			if (messageElements.length > maxMessages) {
				// Convert to array and sort by skip value (which is our message count)
				const messages = Array.from(messageElements);
				messages.sort((a, b) => {
					return parseInt(a.dataset.skip) - parseInt(b.dataset.skip);
				});
				
				// Remove oldest messages, keeping the last 30
				const numToRemove = messages.length - maxMessages;
				for (let i = 0; i < numToRemove; i++) {
					if (messages[i] && messages[i].parentNode) {
						messages[i].innerHTML = "";
						messages[i].dataset.done = true;
					}
				}
			}
		} catch (e) {
			console.error("Error cleaning up messages:", e);
		}
	}
	
	let giftMapping = {
		"485175fda92f4d2f862e915cbcf8f5c4": {
			"name": "Star",
			"coins": 99
		},
		"eba3a9bb85c33e017f3648eaf88d7189": {
			"name": "Rose",
			"coins": 1
		},
		"ab0a7b44bfc140923bb74164f6f880ab": {
			"name": "Love you",
			"coins": 1
		},
		"6cd022271dc4669d182cad856384870f": {
			"name": "Hand Hearts",
			"coins": 100
		},
		"4e7ad6bdf0a1d860c538f38026d4e812": {
			"name": "Doughnut",
			"coins": 30
		},
		"a4c4dc437fd3a6632aba149769491f49": {
			"name": "Finger Heart",
			"coins": 5
		},
		"0f158a08f7886189cdabf496e8a07c21": {
			"name": "Paper Crane",
			"coins": 99
		},
		"d72381e125ad0c1ed70f6ef2aff6c8bc": {
			"name": "Little Ghost",
			"coins": 10
		},
		"e45927083072ffe0015253d11e11a3b3": {
			"name": "Pho",
			"coins": 10
		},
		"c2413f87d3d27ac0a616ac99ccaa9278": {
			"name": "Spooky Cat",
			"coins": 1200
		},
		"1bdf0b38142a94af0f71ea53da82a3b1": {
			"name": "Bouquet",
			"coins": 100
		},
		"802a21ae29f9fae5abe3693de9f874bd": {
			"name": "TikTok",
			"coins": 1
		},
		"3ac5ec732f6f4ba7b1492248bfea83d6": {
			"name": "Birthday Cake",
			"coins": 1
		},
		"148eef0884fdb12058d1c6897d1e02b9": {
			"name": "Corgi",
			"coins": 299
		},
		"c836c81cc6e899fe392a3d11f69fafa3": {
			"name": "Boo's Town",
			"coins": 15000
		},
		"d53125bd5416e6f2f6ab61da02ddd302": {
			"name": "Lucky Pig",
			"coins": 10
		},
		"e0589e95a2b41970f0f30f6202f5fce6": {
			"name": "Money Gun",
			"coins": 500
		},
		"c2cd98b5d3147b983fcbf35d6dd38e36": {
			"name": "Balloon Gift Box",
			"coins": 100
		},
		"79a02148079526539f7599150da9fd28": {
			"name": "Galaxy",
			"coins": 1000
		},
		"863e7947bc793f694acbe970d70440a1": {
			"name": "Forever Rosa",
			"coins": 399
		},
		"968820bc85e274713c795a6aef3f7c67": {
			"name": "Ice Cream Cone",
			"coins": 1
		},
		"d244d4810758c3227e46074676e33ec8": {
			"name": "Trick or Treat",
			"coins": 299
		},
		"c9734b74f0e4e79bdfa2ef07c393d8ee": {
			"name": "Pumpkin",
			"coins": 1
		},
		"eb77ead5c3abb6da6034d3cf6cfeb438": {
			"name": "Rosa",
			"coins": 10
		},
		"ff861a220649506452e3dc35c58266ea": {
			"name": "Peach",
			"coins": 5
		},
		"30063f6bc45aecc575c49ff3dbc33831": {
			"name": "Star Throne",
			"coins": 7999
		},
		"cb909c78f2412e4927ea68d6af8e048f": {
			"name": "Boo the Ghost",
			"coins": 88
		},
		"20b8f61246c7b6032777bb81bf4ee055": {
			"name": "Perfume",
			"coins": 20
		},
		"0573114db41d2cf9c7dd70c8b0fab38e": {
			"name": "Okay",
			"coins": 5
		},
		"312f721603de550519983ca22f5cc445": {
			"name": "Shamrock",
			"coins": 10
		},
		"a40b91f7a11d4cbce780989e2d20a1f4": {
			"name": "Ice cream",
			"coins": 5
		},
		"2db38e8f2a9fb804cb7d3bd2a0ba635c": {
			"name": "Love Balloon",
			"coins": 500
		},
		"3f02fa9594bd1495ff4e8aa5ae265eef": {
			"name": "GG",
			"coins": 1
		},
		"0183cfcfc0dac56580cdc43956b73bfe": {
			"name": "Gimme The Vote",
			"coins": 1
		},
		"3c5e5fc699ed9bee71e79cc90bc5ab37": {
			"name": "Drip Brewing",
			"coins": 10
		},
		"43e1dee87ec71c57ab578cb861bbd749": {
			"name": "Music Play",
			"coins": 1
		},
		"b48c69f4df49c28391bcc069bbc31b41": {
			"name": "You're Amazing",
			"coins": 500
		},
		"e033c3f28632e233bebac1668ff66a2f": {
			"name": "Friendship Necklace",
			"coins": 10
		},
		"cb4e11b3834e149f08e1cdcc93870b26": {
			"name": "Confetti",
			"coins": 100
		},
		"909e256029f1649a9e7e339ef71c6896": {
			"name": "Potato",
			"coins": 5
		},
		"d4faa402c32bf4f92bee654b2663d9f1": {
			"name": "Coral",
			"coins": 499
		},
		"97a26919dbf6afe262c97e22a83f4bf1": {
			"name": "Swan",
			"coins": 699
		},
		"a03bf81f5759ed3ffb048e1ca71b2b5e": {
			"name": "Good Night",
			"coins": 10
		},
		"01d07ef5d45eeedce64482be2ee10a74": {
			"name": "Dumplings",
			"coins": 10
		},
		"90a405cf917cce27a8261739ecd84b89": {
			"name": "Phoenix Flower",
			"coins": 5
		},
		"2c9cec686b98281f7319b1a02ba2864a": {
			"name": "Lock and Key",
			"coins": 199
		},
		"d990849e0435271bc1e66397ab1dec35": {
			"name": "Singing Mic",
			"coins": 399
		},
		"0115cb20f6629dc50d39f6b747bddf73": {
			"name": "Wedding",
			"coins": 1500
		},
		"96d9226ef1c33784a24d0779ad3029d3": {
			"name": "Glowing Jellyfish",
			"coins": 1000
		},
		"af980f4ec9ed73f3229df8dfb583abe6": {
			"name": "Future Encounter",
			"coins": 1500
		},
		"4227ed71f2c494b554f9cbe2147d4899": {
			"name": "Train",
			"coins": 899
		},
		"1d1650cd9bb0e39d72a6e759525ffe59": {
			"name": "Watermelon Love",
			"coins": 1000
		},
		"ed2cc456ab1a8619c5093eb8cfd3d303": {
			"name": "Sage the Smart Bean",
			"coins": 399
		},
		"9494c8a0bc5c03521ef65368e59cc2b8": {
			"name": "Fireworks",
			"coins": 1088
		},
		"3cbaea405cc61e8eaab6f5a14d127511": {
			"name": "Rosie the Rose Bean",
			"coins": 399
		},
		"767d7ea90f58f3676bbc5b1ae3c9851d": {
			"name": "Rocky the Rock Bean",
			"coins": 399
		},
		"9f8bd92363c400c284179f6719b6ba9c": {
			"name": "Boxing Gloves",
			"coins": 299
		},
		"f76750ab58ee30fc022c9e4e11d25c9d": {
			"name": "Blooming Ribbons",
			"coins": 1000
		},
		"0e3769575f5b7b27b67c6330376961a4": {
			"name": "Jollie the Joy Bean",
			"coins": 399
		},
		"1153dd51308c556cb4fcc48c7d62209f": {
			"name": "Fruit Friends",
			"coins": 299
		},
		"fa6bd8486df33dbe732381fa5c6cf441": {
			"name": "Lovely Music",
			"coins": 999
		},
		"af67b28480c552fd8e8c0ae088d07a1d": {
			"name": "Under Control",
			"coins": 1500
		},
		"71883933511237f7eaa1bf8cd12ed575": {
			"name": "Meteor Shower",
			"coins": 3000
		},
		"6517b8f2f76dc75ff0f4f73107f8780e": {
			"name": "Motorcycle",
			"coins": 2988
		},
		"3f1945b0d96e665a759f747e5e0cf7a9": {
			"name": "Cooper Flies Home",
			"coins": 1999
		},
		"1ea8dbb805466c4ced19f29e9590040f": {
			"name": "Chasing the Dream",
			"coins": 1500
		},
		"1420cc77d628c49516b9330095101496": {
			"name": "Love Explosion",
			"coins": 1500
		},
		"5d456e52403cefb87d6d78c9cabb03db": {
			"name": "The Running 9",
			"coins": 1399
		},
		"6b103f9ea6c313b8df68be92e54202cc": {
			"name": "Shaking Drum",
			"coins": 2500
		},
		"e7ce188da898772f18aaffe49a7bd7db": {
			"name": "Sports Car",
			"coins": 7000
		},
		"1d067d13988e8754ed6adbebd89b9ee8": {
			"name": "Flying Jets",
			"coins": 5000
		},
		"f334260276d5fa0de91c5fb61e26d07d": {
			"name": "Lantern Road",
			"coins": 5000
		},
		"921c6084acaa2339792052058cbd3fd3": {
			"name": "Private Jet",
			"coins": 4888
		},
		"universe": {
			"name": "Universe",
			"coins": 34999
		},
		"lion": {
			"name": "Lion",
			"coins": 29999
		},
		"drama-king": {
			"name": "Drama King",
			"coins": 49999
		},
		"donut-tower": {
			"name": "Donut Tower",
			"coins": 4999
		},
		"diamond-crown": {
			"name": "Diamond Crown",
			"coins": 5999
		},
		"tiktok-crown": {
			"name": "TikTok Crown",
			"coins": 8999
		},
		"fans_starter_upgraded_gift": {
			"name": "upgraded gift"
		}
	}
	
	function getIdFromUrl(url) {
		// Try to find a resource ID first
		let resourceMatch = url.match(/resource\/([^.]+)(?:\.png|\.webp)/);
		if (resourceMatch) return resourceMatch[1];
		
		resourceMatch = url.match(/webcast-sg\/([^.]+)(?:\.png|\.webp)/);
		if (resourceMatch) return resourceMatch[1];
		
		// If no resource ID, get the ID from the main part of the URL
		const directMatch = url.match(/webcast-va\/([^~.]+)/);
		return directMatch ? directMatch[1] : url;
	}

    function processMessage(ele, ital = false) {

        if (ele && ele.dataset.skip) {
            return;
        }

        if (!settings.capturejoinedevent && ital) {
            if (ital == "enter-message") { // xxx joined the room
                return;
            }
        }

        ele.dataset.skip = ++msgCount;

        var chatimg = "";
        try {
            chatimg = ele.children[0].querySelector("img");
            if (!chatimg) {
                chatimg = "";
            } else {
                chatimg = chatimg.src;
            }
        } catch (e) {}


        if (ele.querySelector("[class*='DivTopGiverContainer']")) {
            return;
        }
		
		updateLastInputTime();

        var membership = "";
        var chatbadges = "";
        var rank = 0;

        var nameColor = "";

        try {
            var cb = ele.children[1].querySelectorAll("img[class*='ImgBadgeChatMessage'], img[class*='ImgCombineBadgeIcon']");
            if (cb.length) {
                chatbadges = [];
                cb.forEach(cbimg => {
                    try {
                        if (cbimg.src) {
                            chatbadges.push(cbimg.src);
                            if (cbimg.src.includes("/moderator_")) {
                                if (!settings.nosubcolor) {
                                    nameColor = "#F5D5D1";
                                }
                            } else if (cbimg.src.includes("/moderater_")) {
                                if (!settings.nosubcolor) {
                                    nameColor = "#F5D5D1";
                                }
                            } else if (cbimg.src.includes("/sub_")) {
                                membership = getTranslation("subscriber", "SUBSCRIBER");
                                if (!settings.nosubcolor) {
                                    nameColor = "#139F1D";
                                }
                            } else if (cbimg.src.includes("/subs_")) {
                                membership = getTranslation("subscriber", "SUBSCRIBER");
                                if (!settings.nosubcolor) {
                                    nameColor = "#139F1D";
                                }
                            } else if (!rank && !nameColor && cbimg.src.includes("/grade_")) {
                                try {
                                    rank = parseInt(cbimg.nextElementSibling.innerText) || 1;
                                    if (!settings.nosubcolor) {
                                        if (rank > 40) {
                                            rank = 40;
                                        }
                                        nameColor = lut[rank];
                                    }
                                } catch (e) {}
                            }
                        }
                    } catch (e) {}
                });
            }
        } catch (e) {}

        var chatname = "";


        try {
            chatname = ele.querySelector("span[data-e2e='message-owner-name']").textContent;
            chatname = escapeHtml(chatname);
        } catch (e) {}

        try {
            if (!chatname) {
                if (ele.childNodes[1].childNodes[0].children.length) {
                    chatname = escapeHtml(ele.childNodes[1].childNodes[0].childNodes[0].innerText);
                } else {
                    chatname = escapeHtml(ele.childNodes[1].childNodes[0].innerText);
                }
            }

        } catch (e) {}

        var chatmessage = "";
        try {
            chatmessage = getAllContentNodes(ele.querySelector("div[class*='-DivUserInfo'], span[data-e2e='message-owner-name']").nextSibling);
            //live-shared-ui-chat-list-chat-message-comment
            if (!chatmessage) {
                try {
                    chatmessage = getAllContentNodes(ele.querySelector(".live-shared-ui-chat-list-chat-message-comment"));
                } catch (e) {
                    chatmessage = "";
                }
            }
        } catch (e) {
            try {
                chatmessage = getAllContentNodes(ele.querySelector(".live-shared-ui-chat-list-chat-message-comment"));
            } catch (e) {
                chatmessage = "";
            }
        }

        if (chatmessage == "Moderator") {
            chatmessage = "";
        }
		
		var hasdonation = "";
		try {
			if (settings.tiktokdonations && chatmessage.includes("x") && chatmessage.includes("<img src=") && chatmessage.includes(".tiktokcdn.com/img/")){
				//console.log(chatmessage);
				if (validateTikTokDonationMessage(chatmessage)){
					var donation = parseDonationMessage(chatmessage);
					//console.log(donation);
					if (donation.isValid && donation.imageSrc){
						var giftid = getIdFromUrl(donation.imageSrc);
						if (giftid){
							if (giftMapping[giftid]){
								var valuea = giftMapping[giftid].coins || giftMapping[giftid].name;
							} else {
								try {
									var valuea = document.querySelector("img[src*='"+giftid+"']").parentNode.querySelector("svg").nextSibling.textContent.trim();
									if (parseInt(valuea) == valuea){
										giftMapping[giftid] = {coins: parseInt(valuea)};
										//console.log(giftMapping);
									}
								} catch(e){
									//console.log("Unknown item", donation);
									if (donation.quantity>1){
										var valuea = "gifts";
									} else {
										var valuea = "gift";
									}
								}
							}
							if (parseInt(valuea) == valuea){
								valuea = (donation.quantity * parseInt(valuea));
								if (valuea>1){
									hasdonation = valuea + " coins";
								} else {
									hasdonation = valuea + " coin";
								}
							} else {
								hasdonation = donation.quantity + " "+valuea;
							}
						}
						
						// https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png
						// https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp
						
					}
				}
				//console.log("hasdonation: "+hasdonation);
				
			}
		} catch(e){
			//console.log(e);
		}
		
        try {
            if (!chatmessage) {
                var eles = ele.childNodes[1].childNodes;
                if (eles.length > 1) {
                    for (var i = 1; i < eles.length; i++) {
                        if (eles[i].nodeName === "#text") {
                            chatmessage = escapeHtml(eles[i].textContent);
                        } else if (settings.textonlymode) {
                            chatmessage = escapeHtml(eles[i].textContent);
                        } else {
                            chatmessage = eles[i].innerHTML;
                        }
                    }
                } else if (eles.length == 1) {
                    for (var i = 1; i < eles[0].childNodes.length; i++) {
                        if (settings.textonlymode) {
                            chatmessage = escapeHtml(eles[0].childNodes[i].textContent);
                        } else {
                            chatmessage = eles[0].childNodes[i].innerHTML;
                        }
                    }
                }
            }
        } catch (e) {}

        if (!chatmessage && !chatbadges) {
            return;
        } else if (chatmessage) {
            chatmessage = chatmessage.trim();
        }

        if (chatmessage == "Moderator") {
            //console.log(ele);
            return;
            //alert("!!");
        }

        if (chatname && chatimg) {
			avatarCache.add(chatname, chatimg);
		} else if (chatname) {
			chatimg = avatarCache.get(chatname);
        } else if (chatmessage && (chatmessage === "----")) { // no chat name
            return;
        }

        if (ital && chatmessage && (chatmessage === "joined")) { // no chat name
            if (!settings.capturejoinedevent) {
                return;
            }
        }
		
		if (ital && chatmessage && chatmessage.includes("shared")) { // no sharing events
             return;
        }

        if (settings.customtiktokstate) {
            var channel = window.location.pathname.split("/@");
            if (channel.length > 1) {
                channel = channel[1].split("/")[0].trim();
            }
            if (!channel) {
                return;
            }
            if (settings.customtiktokaccount && settings.customtiktokaccount.textsetting && ((settings.customtiktokaccount.textsetting.toLowerCase() !== channel.toLowerCase()) && (settings.customtiktokaccount.textsetting.toLowerCase() !== "@" + channel.toLowerCase()))) {
                return;
            } else if (!settings.customtiktokaccount) {
                return;
            }
        }

        if (isDuplicateMessage(chatname, chatmessage, ele)) {
            //console.log("duplicate message; skipping");
            return;
        }

        var data = {};
        data.chatname = chatname;
        data.chatbadges = chatbadges;
        data.backgroundColor = "";
        data.nameColor = nameColor;
        data.textColor = "";
        data.chatmessage = chatmessage;
        data.chatimg = chatimg;
        data.hasDonation = hasdonation;
        data.membership = membership;
        data.contentimg = "";
        // data.metaClass = "";
        data.textonly = settings.textonlymode || false;
        data.type = "tiktok";
        data.event = ital; // if an event or actual message

        //console.log(data);
		
		if (!StreamState.isValid() && StreamState.getCurrentChannel()){
			console.log("Has the channel changed? If so, click the page to validate it");
			return;
		}

        pushMessage(data);
    }


	function start() {
		if (!isExtensionOn) {
			return;
		}
		
		let target = null;
		let subtree = false;
		
		// First try for chat room
		if (window.location.href.startsWith("https://livecenter.tiktok.com/common_live_chat")) {
			target = document.querySelector('[data-e2e]');
			if (target) {
				target = target.parentNode;
			}
		} else {
			// Try main selectors for chat container
			target = document.querySelector('[data-item="list-message-list"]');
			
			if (!target){
				target = document.querySelector('[class*="DivChatMessageList"], .live-shared-ui-chat-list-scrolling-list, [data-e2e="chat-room"], [data-e2e="chat-room"]');
				if (target){
					subtree = true;
				}
			}
		}
		
		if (!target) {
			target = document.querySelector('[role="heading"][tabindex]');
			if (target && window.location.href.includes("/live") && target.nodeType==1){
				// we will see.
			} else {
				return;
			}
		}
		
		if (!window.location.href.includes("livecenter") && 
			!(window.location.pathname.includes("@") && 
			  window.location.pathname.includes("live"))) {
			return;
		}
		
		// Prevent multiple observers on the same target
		if (target.hasObserver) {
			return;
		}
		
		document.querySelectorAll('[data-e2e="chat-message"]').forEach(ele=>{
			ele.dataset.skip = ++msgCount;
		});
		
		target.hasObserver = true;
		console.log("Starting social stream");
		
		// Create mutation observer with original configuration
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.addedNodes.length) {
					for (let i = 0; i < mutation.addedNodes.length; i++) {
						try {
							const node = mutation.addedNodes[i];
							//console.log(node);
							if (!subtree && node.dataset && node.dataset.e2e === "chat-message") {
								setTimeout((node) => {
									if (node.isConnected) {
										//console.log(node);
										processMessage(node);
									}
								}, 300, node);
							} else if (subtree){
								
								let msg = node.querySelector('[data-e2e="chat-message"]');
								if (msg || (node.dataset && node.dataset.e2e === "chat-message")){
									setTimeout((msg) => {
										if (msg.isConnected) {
											processMessage(msg);
										}
									}, 300, msg);
								} else if (settings.captureevents) {
									setTimeout(() => {
										if (node.isConnected) {
											if (node.dataset && node.dataset.e2e) {
												processMessage(node.cloneNode(true), node.dataset.e2e);
											} else {
												processMessage(node);
											}
										}
									}, 300);
								}
							} else if (settings.captureevents) {
								setTimeout((node) => {
									if (node.isConnected) {
										if (node.dataset && node.dataset.e2e) {
											processMessage(node.cloneNode(true), node.dataset.e2e);
										} else {
											processMessage(node);
										}
									}
								}, 300, node);
							}
						} catch (e) {
							//console.error("Error processing node:", e);
						}
					}
				}
			});
		});
		
		observer.observe(target, {
			childList: true,
			subtree: subtree
		});
	}

	var counter = 0;
	function start2() {
		if (!isExtensionOn || !settings.captureevents) {
			return;
		}
		
		const target2 = document.querySelector('[class*="DivBottomStickyMessageContainer"]');
		
		if (!target2) {
			return;
		}
		
		if (!window.location.href.includes("livecenter") && 
			!(window.location.pathname.includes("@") && 
			  window.location.pathname.includes("live"))) {
			return;
		}
		
		
		if (settings.showviewercount || settings.hypemode){
			try {
				if (counter%5==0){
					try {
						var viewerCount = document.querySelector("[data-e2e='live-people-count']");
						
						if (viewerCount && viewerCount.textContent){
							if (viewerCount.textContent == parseInt(viewerCount.textContent)){
								chrome.runtime.sendMessage(
									chrome.runtime.id,
									({message:{
											type: 'tiktok',
											event: 'viewer_update',
											meta: parseInt(viewerCount.textContent)
										}
									}),
									function (e) {}
								);
							}
						}
					} catch(e){}
				}
				
			} catch(e){
				//console.error(e);
			}
			counter+=1;
		}
		
		
		if (target2.hasObserver) {
			return;
		}
		
		target2.hasObserver = true;
		console.log("Starting event observer");
		
		const observer2 = new MutationObserver((mutations) => {
			if (!settings.captureevents) return;
			
			mutations.forEach((mutation) => {
				if (mutation.addedNodes.length) {
					for (let i = 0; i < mutation.addedNodes.length; i++) {
						try {
							const node = mutation.addedNodes[i];
							if (node.nodeName === "DIV") {
								setTimeout(() => {
									if (!node.isConnected) return;
									
									const typeOfEvent = node.querySelector("[data-e2e]");
									if (typeOfEvent) {
										if (!settings.capturejoinedevent && 
											typeOfEvent.dataset.e2e === "enter-message") {
											return;
										}
										processMessage(node.cloneNode(true), typeOfEvent.dataset.e2e || true);
									} else {
										processMessage(node.cloneNode(true), true);
									}
								}, 200);
							}
						} catch (e) {
							console.error("Error processing event:", e);
						}
					}
				}
			});
		});
		
		observer2.observe(target2, {
			childList: true,
			subtree: true
		});
	}

	// Initialize observers
	setInterval(start, 2000);
	setInterval(start2, 2000);

    var settings = {};
    var isExtensionOn = false;


    try {
        chrome.runtime.sendMessage(chrome.runtime.id, {
            "getSettings": true,
			"tabId": chrome.runtime.id
        }, function(response) { // {"state":isExtensionOn,"streamID":channel, "settings":settings}
            if (response) {
                if ("settings" in response) {
                    settings = response.settings;
                }
                if ("state" in response) {
                    isExtensionOn = response.state;
                }
            }
        });
    } catch (e) {}

	let pokeTimeout = 27;
	if (window.electronApi){
		pokeTimeout = 10; // we can be more annoying in this case.
	}
    var pokeMe = setInterval(function() {
        try {
            //if (chrome.runtime.id !== 1){
            chrome.runtime.sendMessage(chrome.runtime.id, {
                "pokeMe": true
            }, function(response) { // {"state":isExtensionOn,"streamID":channel, "settings":settings}
                console.log("POKED");
            });
            //}
        } catch (e) {}
    }, 1000 * 60 * pokeTimeout);

    var videosMuted = false;

    try {
        chrome.runtime.onMessage.addListener(
            function(request, sender, sendResponse) {
                try {
                    if ("focusChat" == request) {
						
						if (settings.customtiktokstate) {
							var channel = window.location.pathname.split("/@");
							if (channel.length > 1) {
								channel = channel[1].split("/")[0].trim();
							}
							if (!channel) {
								return;
							}
							if (settings.customtiktokaccount && settings.customtiktokaccount.textsetting && ((settings.customtiktokaccount.textsetting.toLowerCase() !== channel.toLowerCase()) && (settings.customtiktokaccount.textsetting.toLowerCase() !== "@" + channel.toLowerCase()))) {
								return;
							} else if (!settings.customtiktokaccount) {
								return;
							}
						}
						
                        if (document.querySelector('.public-DraftEditorPlaceholder-inner')) {
                            document.querySelector(".public-DraftEditorPlaceholder-inner").focus();
                            sendResponse(true);
                            clearInterval(pokeMe);
                            pokeMe = setInterval(function() {
                                chrome.runtime.sendMessage(chrome.runtime.id, {
                                    "pokeMe": true
                                }, function(response) { // {"state":isExtensionOn,"streamID":channel, "settings":settings}

                                });
                            }, 1000 * 60 * pokeTimeout);
                        } else if (document.querySelector("[contenteditable][placeholder]")) {

                            document.querySelector("[contenteditable][placeholder]").focus();
                            sendResponse(true);
                            setTimeout(function() {
                                if (document.querySelector("[contenteditable][placeholder]").textContent == "") {
                                    document.querySelector("[contenteditable][placeholder]").innerHTML = "";
                                }
                            }, 300);
                            clearInterval(pokeMe);
                            pokeMe = setInterval(function() {
                                chrome.runtime.sendMessage(chrome.runtime.id, {
                                    "pokeMe": true
                                }, function(response) { // {"state":isExtensionOn,"streamID":channel, "settings":settings}

                                });
                            }, 1000 * 60 * pokeTimeout);
                        } else {
                            sendResponse(false);
                        }
                        return;
                    }
                    if (typeof request === "object") {
                        if ("state" in request) {
                            isExtensionOn = request.state;
                        }
                        if ("settings" in request) {
                            settings = request.settings;
                            sendResponse(true);
                            return;
                        }
                        if ("muteWindow" in request) {

                            if (request.muteWindow) {
                                clearInterval(videosMuted);

                                videosMuted = setInterval(function() {
                                    document.querySelectorAll("video").forEach(v => {
                                        v.muted = true;
                                        v.pause();
                                    });
                                }, 1000);
                                document.querySelectorAll("video").forEach(v => {
                                    v.muted = true;
                                    v.pause();
                                });
                                sendResponse(true);
                                return;
                            } else {
                                if (videosMuted) {
                                    clearInterval(videosMuted);
                                    document.querySelectorAll("video").forEach(v => {
                                        v.muted = false;
                                        v.play();
                                    });
                                } else {
                                    clearInterval(videosMuted);
                                }
                                videosMuted = false;
                                sendResponse(true);
                                return;
                            }
                        }
                    }
                } catch (e) {}

                sendResponse(false);
            }
        );
    } catch (e) {}
	
	
	const StreamState = {
		initialUrl: null,
		lastUserInteraction: 0,
		navigationTimeout: 10000,

		init() {
			this.initialUrl = location.href;
			this.lastUserInteraction = Date.now();
			
			document.addEventListener('click', () => {
				this.lastUserInteraction = Date.now();
				console.log(this.lastUserInteraction);
			});
			document.addEventListener('keydown', () => {
				this.lastUserInteraction = Date.now();
				console.log(this.lastUserInteraction);
			});
			document.addEventListener('touchstart', () => {
				this.lastUserInteraction = Date.now();
				console.log(this.lastUserInteraction);
			});
		},

		isValid() {
			const currentUrl = location.href;
			
			// Initial page load is always valid
			if (currentUrl === this.initialUrl) {
				return true;
			}

			// Check if recent navigation was user-initiated
			const timeSinceInteraction = Date.now() - this.lastUserInteraction;
			return timeSinceInteraction <= this.navigationTimeout;
		},

		getCurrentChannel() {
			const match = location.href.match(/@([^/]+)/);
			return match ? match[1] : null;
		}
	};

	// Usage
	StreamState.init();
	
	
	let lastUserInputTime = Date.now();

	// Function to update the last input time
	function updateLastInputTime() {
	  lastUserInputTime = Date.now();
	}

	
	// Function to check for inactivity and click the element if needed
	function checkInactivityAndClick() {
	  const currentTime = Date.now();
	  const timeElapsed = currentTime - lastUserInputTime;
	  
	  if (timeElapsed >= 10000) { // 10 seconds in milliseconds
		const unreadTipsElement = document.querySelector("[class*='DivUnreadTipsContent']");
		if (unreadTipsElement) {
		  unreadTipsElement.click();
		  // Reset the timer after clicking
		  lastUserInputTime = currentTime;
		}
	  }
	}

	// Add event listener for mouse wheel
	window.addEventListener('wheel', updateLastInputTime);

	// Set up interval to check for inactivity (checks every second)
	setInterval(checkInactivityAndClick, 5000);

})();

// try reloading the page if no activitiy for a while?
