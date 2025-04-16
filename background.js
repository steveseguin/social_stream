try {
	if (document.title=="Keep Open - Social Stream Ninja"){
		window.close();
	}
	if (document.title == "Close me - Social Stream Ninja"){
		window.close();
	}
} catch(e){}

var isExtensionOn = false;
var iframe = null;

var settings = {};
var messageTimeout = {};
var lastSentMessage = "";
var lastSentTimestamp = 0;
var lastMessageCounter = 0;
var sentimentAnalysisLoaded = false;

var messageCounterBase = Math.floor(Math.random() * 90000);
var messageCounter = messageCounterBase;
var lastAntiSpam = 0;

var connectedPeers = {};
var isSSAPP = false;

var urlParams = new URLSearchParams(window.location.search);
var devmode = urlParams.has("devmode") || false;

var FacebookDupes = "";
var FacebookDupesTime = null;

var fetchNode = false;
var postNode = false;
var putNode = false;

var properties = ["streamID", "password", "state", "settings"];
var streamID = false;
var password = false;

function log(msg, msg2 = null) {
	if (devmode) {
		if (msg2 !== null) {
			console.log(msg, msg2);
		} else {
			console.log(msg);
		}
	}
}
function warnlog(msg) {
  console.warn(msg);
}
function errorlog(msg) {
  console.error(msg);
}
var priorityTabs = new Set();

function generateStreamID() {
	var text = "";
	var possible = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
	for (var i = 0; i < 10; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	try {
		text = text.replaceAll("AD", "vDAv"); // avoiding adblockers
		text = text.replaceAll("Ad", "vdAv");
		text = text.replaceAll("ad", "vdav");
		text = text.replaceAll("aD", "vDav");
	} catch (e) {}
	return text;
}

if (typeof chrome.runtime == "undefined") {
	if (typeof require !== "undefined"){
		var { ipcRenderer, contextBridge } = require("electron");
		isSSAPP = true;
	} else {
		var ipcRenderer = {};
		ipcRenderer.sendSync = function(){};
		ipcRenderer.invoke = function(){};
		ipcRenderer.on = function(){};
		console.warn("This isn't a functional mode; not yet at least.");
	}
	
	chrome = {};
	chrome.browserAction = {};
	chrome.browserAction.setIcon = function (icon) {}; // there is no icon in the ssapp
	chrome.runtime = {};
	chrome.runtime.lastError = false;
	//chrome.runtime.lastError.message = "";

	chrome.runtime.sendMessage = async function(data, callback){ // uncomment if I need to use it.
		let response = await ipcRenderer.sendSync('fromBackground',data);
		if (typeof(callback) == "function"){
			callback(response);
			log(response);
		}
	};

	chrome.runtime.getManifest = function () {
		return false; // I'll need to add version info eventually
	};
	chrome.storage = {};
	chrome.storage.sync = {};
	chrome.storage.sync.set = function (data) {
		ipcRenderer.sendSync("storageSave", data);
		log("ipcRenderer.sendSync('storageSave',data);");
	};
	chrome.storage.sync.get = async function (arg, callback) {
		var response = await ipcRenderer.sendSync("storageGet", arg);
		callback(response);
	};
	chrome.storage.sync.remove = async function (arg, callback) {
		// only used for upgrading; not important atm.
		callback({});
	};

	chrome.storage.local = {};
	chrome.storage.local.get = async function (arg, callback) {
		log("LOCAL SYNC GET");
		var response = await ipcRenderer.sendSync("storageGet", arg);
		callback(response);
	};
	chrome.storage.local.set = function (data) {
		log("LOCAL SYNC SET", data);
		ipcRenderer.sendSync("storageSave", data);
		log("ipcRenderer.sendSync('storageSave',data);");
	};

	chrome.tabs = {};
	chrome.tabs.query = async function (a, callback) {
		var response = await ipcRenderer.sendSync("getTabs", {});

		log("chrome.tabs.query");
		log(response);
		if (callback) {
			callback(response);
		}
	};

	chrome.debugger = {};
	chrome.debugger.detach = function (a = null, b = null, c = null) {};
	chrome.debugger.onDetach = {};
	chrome.debugger.onDetach.addListener = function () {};
	chrome.debugger.attach = function (a, b, c) {
		log("chrome.debugger.attach", c);
		c();
	};

	chrome.tabs.sendMessage = async function (tab = null, message = null, callback = null) {
		var response = await ipcRenderer.sendSync("sendToTab", { message: message, tab: tab });
		if (callback) {
			callback(response);
		}
	};

	chrome.debugger.sendCommand = async function (a = null, b = null, c = null, callback = null) {
	  if (!c || !a?.tabId) {
		log("Missing required parameters");
		return;
	  }

	  const eventData = {
		...c,
		tab: a.tabId
	  };

	  // Preserve the exact Input.dispatchKeyEvent type
	  if (b === "Input.dispatchKeyEvent") {
		const response = await ipcRenderer.sendSync("sendInputToTab", eventData);
		callback?.(response);
	  } else {
		c.tab = a.tabId;
		const response = await ipcRenderer.sendSync("sendInputToTab", c); // sendInputToTab
		callback?.(response);
	  }
	};

	chrome.runtime.onMessage = {};

	chrome.notifications = {};
	chrome.notifications.create = function (data) {
		alert(data.message);
	};

	window.showSaveFilePicker = async function (opts) {
		const filePath = await ipcRenderer.invoke("show-save-dialog", opts);
		//console.log(filePath);
		return filePath;
	};

	var onMessageCallback = function (a, b, c) {};

	chrome.runtime.onMessage.addListener = function (callback) {
		onMessageCallback = callback;
	};

	ipcRenderer.on("fromMain", (event, ...args) => {
		log("FROM MAIN", args);

		var sender = {};
		sender.tab = {};
		sender.tab.id = null;

		if (args[0]) {
			onMessageCallback(args[0], sender, function (response) {
				if (event.returnValue) {
					event.returnValue = response;
				}
				ipcRenderer.send("fromBackgroundResponse", response);
			});
		}
	});
	ipcRenderer.on("fromMainSender", (event, args) => {
		log("FROM MAINS SENDER", args);

		if (args.length) {
			if (args[1]) {
				var sender = args[1];
			} else {
				var sender = {};
				sender.tab = {};
				sender.tab.id = null;
			}
			onMessageCallback(args[0], sender, function (response) {
				if (event.returnValue) {
					event.returnValue = response;
				}
				ipcRenderer.send("fromBackgroundResponse", response);
			});
		}
	});

	ipcRenderer.on("fromPopup", (event, ...args) => {
		//log("FROM POP UP (redirected)", args[0]);
		var sender = {};
		sender.tab = {};
		sender.tab.id = null;
		onMessageCallback(args[0], sender, function (response) {
			// (request, sender, sendResponse)
			//log("sending response to pop up:",response);
			ipcRenderer.send("fromBackgroundPopupResponse", response);
		});
	});

	fetchNode = function (URL, headers = {}, method = 'GET', body = null) {
		return ipcRenderer.sendSync("nodefetch", {
			url: URL,
			headers: headers,
			method: method,
			body: body
		});
	};

	/* 	ipcMain.on('nodepost', function(eventRet, args2) {
		log("NODE POSTING!");
		fetch(args2.url, {
			method: 'POST',
			headers: args2.headers,
			body: JSON.stringify(args2.body) 
		})
		.then(response => response.text())
		.then(data => {
			eventRet.returnValue = data;
		})
		.catch(error => {
			eventRet.returnValue = null;
		});
	}); */

	postNode = async function (URL, body, headers = {}) {
		return await ipcRenderer.sendSync("nodepost", {
			url: URL,
			body: body,
			headers: headers
		});
	};

	putNode = async function (URL, body, headers = {}) {
		return await ipcRenderer.sendSync("nodepost", {
			url: URL,
			body: body,
			headers: headers
		});
	};

	window.showOpenFilePicker = async function (a = null, c = null) {
		var importFile = await ipcRenderer.sendSync("showOpenDialog", "");
		return importFile;
	}; 

	//ipcRenderer.send('backgroundLoaded');

	//chrome.runtime.onMessage.addListener(
	//async function (request, sender, sendResponse) {
} else {
	window.alert = alert = function (msg) {
		console.warn(new Date().toUTCString() + " : " + msg);
	};
	if (!chrome.browserAction){
		chrome.browserAction = {};
		chrome.browserAction.setIcon = function (icon) {};
	}
}

log("isSSAPP: " + isSSAPP);

String.prototype.replaceAllCase = function (strReplace, strWith) {
	// See http://stackoverflow.com/a/3561711/556609
	var esc = strReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
	var reg = new RegExp(esc, "ig");
	return this.replace(reg, strWith);
};

const validTLDs = new Set(["a","aaa","aarp","abb","abbott","abbvie","abc","able","abogado","abudhabi","ac","academy","accenture","accountant","accountants","aco","actor","ad","ads","adult","ae","aeg","aero","aetna","af","afl","africa","ag","agakhan","agency","ai","aig","airbus","airforce","airtel","akdn","al","alibaba","alipay","allfinanz","allstate","ally","alsace","alstom","am","amazon","americanexpress","americanfamily","amex","amfam","amica","amsterdam","analytics","android","anquan","anz","ao","aol","apartments","app","apple","aq","aquarelle","ar","arab","aramco","archi","army","arpa","art","arte","as","asda","asia","associates","at","athleta","attorney","au","auction","audi","audible","audio","auspost","author","auto","autos","aw","aws","ax","axa","az","azure","b","ba","baby","baidu","banamex","band","bank","bar","barcelona","barclaycard","barclays","barefoot","bargains","baseball","basketball","bauhaus","bayern","bb","bbc","bbt","bbva","bcg","bcn","bd","be","beats","beauty","beer","bentley","berlin","best","bestbuy","bet","bf","bg","bh","bharti","bi","bible","bid","bike","bing","bingo","bio","biz","bj","black","blackfriday","blockbuster","blog","bloomberg","blue","bm","bms","bmw","bn","bnpparibas","bo","boats","boehringer","bofa","bom","bond","boo","book","booking","bosch","bostik","boston","bot","boutique","box","br","bradesco","bridgestone","broadway","broker","brother","brussels","bs","bt","build","builders","business","buy","buzz","bv","bw","by","bz","bzh","c","ca","cab","cafe","cal","call","calvinklein","cam","camera","camp","canon","capetown","capital","capitalone","car","caravan","cards","care","career","careers","cars","casa","case","cash","casino","cat","catering","catholic","cba","cbn","cbre","cc","cd","center","ceo","cern","cf","cfa","cfd","cg","ch","chanel","channel","charity","chase","chat","cheap","chintai","christmas","chrome","church","ci","cipriani","circle","cisco","citadel","citi","citic","city","ck","cl","claims","cleaning","click","clinic","clinique","clothing","cloud","club","clubmed","cm","cn","co","coach","codes","coffee","college","cologne","com","commbank","community","company","compare","computer","comsec","condos","construction","consulting","contact","contractors","cooking","cool","coop","corsica","country","coupon","coupons","courses","cpa","cr","credit","creditcard","creditunion","cricket","crown","crs","cruise","cruises","cu","cuisinella","cv","cw","cx","cy","cymru","cyou","cz","d","dabur","dad","dance","data","date","dating","datsun","day","dclk","dds","de","deal","dealer","deals","degree","delivery","dell","deloitte","delta","democrat","dental","dentist","desi","design","dev","dhl","diamonds","diet","digital","direct","directory","discount","discover","dish","diy","dj","dk","dm","dnp","do","docs","doctor","dog","domains","dot","download","drive","dtv","dubai","dunlop","dupont","durban","dvag","dvr","dz","e","earth","eat","ec","eco","edeka","edu","education","ee","eg","email","emerck","energy","engineer","engineering","enterprises","epson","equipment","er","ericsson","erni","es","esq","estate","et","eu","eurovision","eus","events","exchange","expert","exposed","express","extraspace","f","fage","fail","fairwinds","faith","family","fan","fans","farm","farmers","fashion","fast","fedex","feedback","ferrari","ferrero","fi","fidelity","fido","film","final","finance","financial","fire","firestone","firmdale","fish","fishing","fit","fitness","fj","fk","flickr","flights","flir","florist","flowers","fly","fm","fo","foo","food","football","ford","forex","forsale","forum","foundation","fox","fr","free","fresenius","frl","frogans","frontier","ftr","fujitsu","fun","fund","furniture","futbol","fyi","g","ga","gal","gallery","gallo","gallup","game","games","gap","garden","gay","gb","gbiz","gd","gdn","ge","gea","gent","genting","george","gf","gg","ggee","gh","gi","gift","gifts","gives","giving","gl","glass","gle","global","globo","gm","gmail","gmbh","gmo","gmx","gn","godaddy","gold","goldpoint","golf","goo","goodyear","goog","google","gop","got","gov","gp","gq","gr","grainger","graphics","gratis","green","gripe","grocery","group","gs","gt","gu","gucci","guge","guide","guitars","guru","gw","gy","h","hair","hamburg","hangout","haus","hbo","hdfc","hdfcbank","health","healthcare","help","helsinki","here","hermes","hiphop","hisamitsu","hitachi","hiv","hk","hkt","hm","hn","hockey","holdings","holiday","homedepot","homegoods","homes","homesense","honda","horse","hospital","host","hosting","hot","hotels","hotmail","house","how","hr","hsbc","ht","hu","hughes","hyatt","hyundai","i","ibm","icbc","ice","icu","id","ie","ieee","ifm","ikano","il","im","imamat","imdb","immo","immobilien","in","inc","industries","infiniti","info","ing","ink","institute","insurance","insure","int","international","intuit","investments","io","ipiranga","iq","ir","irish","is","ismaili","ist","istanbul","it","itau","itv","j","jaguar","java","jcb","je","jeep","jetzt","jewelry","jio","jll","jm","jmp","jnj","jo","jobs","joburg","jot","joy","jp","jpmorgan","jprs","juegos","juniper","k","kaufen","kddi","ke","kerryhotels","kerrylogistics","kerryproperties","kfh","kg","kh","ki","kia","kids","kim","kindle","kitchen","kiwi","km","kn","koeln","komatsu","kosher","kp","kpmg","kpn","kr","krd","kred","kuokgroup","kw","ky","kyoto","kz","l","la","lacaixa","lamborghini","lamer","lancaster","land","landrover","lanxess","lasalle","lat","latino","latrobe","law","lawyer","lb","lc","lds","lease","leclerc","lefrak","legal","lego","lexus","lgbt","li","lidl","life","lifeinsurance","lifestyle","lighting","like","lilly","limited","limo","lincoln","link","lipsy","live","living","lk","llc","llp","loan","loans","locker","locus","lol","london","lotte","lotto","love","lpl","lplfinancial","lr","ls","lt","ltd","ltda","lu","lundbeck","luxe","luxury","lv","ly","m","ma","madrid","maif","maison","makeup","man","management","mango","map","market","marketing","markets","marriott","marshalls","mattel","mba","mc","mckinsey","md","me","med","media","meet","melbourne","meme","memorial","men","menu","merckmsd","mg","mh","miami","microsoft","mil","mini","mint","mit","mitsubishi","mk","ml","mlb","mls","mm","mma","mn","mo","mobi","mobile","moda","moe","moi","mom","monash","money","monster","mormon","mortgage","moscow","moto","motorcycles","mov","movie","mp","mq","mr","ms","msd","mt","mtn","mtr","mu","museum","music","mv","mw","mx","my","mz","n","na","nab","nagoya","name","navy","nba","nc","ne","nec","net","netbank","netflix","network","neustar","new","news","next","nextdirect","nexus","nf","nfl","ng","ngo","nhk","ni","nico","nike","nikon","ninja","nissan","nissay","nl","no","nokia","norton","now","nowruz","nowtv","np","nr","nra","nrw","ntt","nu","nyc","nz","o","obi","observer","office","okinawa","olayan","olayangroup","ollo","om","omega","one","ong","onl","online","ooo","open","oracle","orange","org","organic","origins","osaka","otsuka","ott","ovh","p","pa","page","panasonic","paris","pars","partners","parts","party","pay","pccw","pe","pet","pf","pfizer","pg","ph","pharmacy","phd","philips","phone","photo","photography","photos","physio","pics","pictet","pictures","pid","pin","ping","pink","pioneer","pizza","pk","pl","place","play","playstation","plumbing","plus","pm","pn","pnc","pohl","poker","politie","porn","post","pr","pramerica","praxi","press","prime","pro","prod","productions","prof","progressive","promo","properties","property","protection","pru","prudential","ps","pt","pub","pw","pwc","py","q","qa","qpon","quebec","quest","r","racing","radio","re","read","realestate","realtor","realty","recipes","red","redstone","redumbrella","rehab","reise","reisen","reit","reliance","ren","rent","rentals","repair","report","republican","rest","restaurant","review","reviews","rexroth","rich","richardli","ricoh","ril","rio","rip","ro","rocks","rodeo","rogers","room","rs","rsvp","ru","rugby","ruhr","run","rw","rwe","ryukyu","s","sa","saarland","safe","safety","sakura","sale","salon","samsclub","samsung","sandvik","sandvikcoromant","sanofi","sap","sarl","sas","save","saxo","sb","sbi","sbs","sc","scb","schaeffler","schmidt","scholarships","school","schule","schwarz","science","scot","sd","se","search","seat","secure","security","seek","select","sener","services","seven","sew","sex","sexy","sfr","sg","sh","shangrila","sharp","shell","shia","shiksha","shoes","shop","shopping","shouji","show","si","silk","sina","singles","site","sj","sk","ski","skin","sky","skype","sl","sling","sm","smart","smile","sn","sncf","so","soccer","social","softbank","software","sohu","solar","solutions","song","sony","soy","spa","space","sport","spot","sr","srl","ss","st","stada","staples","star","statebank","statefarm","stc","stcgroup","stockholm","storage","store","stream","studio","study","style","su","sucks","supplies","supply","support","surf","surgery","suzuki","sv","swatch","swiss","sx","sy","sydney","systems","sz","t","tab","taipei","talk","taobao","target","tatamotors","tatar","tattoo","tax","taxi","tc","tci","td","tdk","team","tech","technology","tel","temasek","tennis","teva","tf","tg","th","thd","theater","theatre","tiaa","tickets","tienda","tips","tires","tirol","tj","tjmaxx","tjx","tk","tkmaxx","tl","tm","tmall","tn","to","today","tokyo","tools","top","toray","toshiba","total","tours","town","toyota","toys","tr","trade","trading","training","travel","travelers","travelersinsurance","trust","trv","tt","tube","tui","tunes","tushu","tv","tvs","tw","tz","u","ua","ubank","ubs","ug","uk","unicom","university","uno","uol","ups","us","uy","uz","v","va","vacations","vana","vanguard","vc","ve","vegas","ventures","verisign","vermögensberater","vermögensberatung","versicherung","vet","vg","vi","viajes","video","vig","viking","villas","vin","vip","virgin","visa","vision","viva","vivo","vlaanderen","vn","vodka","volvo","vote","voting","voto","voyage","vu","w","wales","walmart","walter","wang","wanggou","watch","watches","weather","weatherchannel","webcam","weber","website","wed","wedding","weibo","weir","wf","whoswho","wien","wiki","williamhill","win","windows","wine","winners","wme","wolterskluwer","woodside","work","works","world","wow","ws","wtc","wtf","x","xbox","xerox","xihuan","xin","xxx","xyz","y","yachts","yahoo","yamaxun","yandex","ye","yodobashi","yoga","yokohama","you","youtube","yt","yun","z","za","zappos","zara","zero","zip","zm","zone","zuerich","zw","IDNs","ελ","ευ","бг","бел","дети","ею","католик","ком","мкд","мон","москва","онлайн","орг","рус","рф","сайт","срб","укр","қаз","հայ","ישראל","קום","ابوظبي","ارامكو","الاردن","البحرين","الجزائر","السعودية","العليان","المغرب","امارات","ایران","بارت","بازار","بيتك","بھارت","تونس","سودان","سورية","شبكة","عراق","عرب","عمان","فلسطين","قطر","كاثوليك","كوم","مصر","مليسيا","موريتانيا","موقع","همراه","پاكستان","پاکستان","ڀارت","कॉम","नेट","भारत","भारतम्","भारोत","संगठन","বাংলা","ভারত","ভাৰত","ਭਾਰਤ","ભારત","ଭାରତ","இந்தியா","இலங்கை","சிங்கப்பூர்","భారత్","ಭಾರತ","ഭാരതം","ලංකා","คอม","ไทย","ລາວ","გე","みんな","アマゾン","クラウド","グーグル","コム","ストア","セール","ファッション","ポイント","世界","中信","中国","中國","中文网","亚马逊","企业","佛山","信息","健康","八卦","公司","公益","台湾","台灣","商城","商店","商标","嘉里","嘉里大酒店","在线","大拿","天主教","娱乐","家電","广东","微博","慈善","我爱你","手机","招聘","政务","政府","新加坡","新闻","时尚","書籍","机构","淡马锡","游戏","澳門","点看","移动","组织机构","网址","网店","网站","网络","联通","谷歌","购物","通販","集团","電訊盈科","飞利浦","食品","餐厅","香格里拉","香港","닷넷","닷컴","삼성","한국"]);
			
function isValidTLD(tld) {
  return validTLDs.has(tld.toLowerCase());
}

function filterXSS(unsafe) {
	// this is not foolproof, but it might catch some basic probe attacks that sneak in
	try {
		return unsafe
			.replaceAll("prompt(", "**")
			.replaceAll("eval(", "**")
			.replaceAll("onclick(", "**")
			.replaceAll("alert(", "**")
			.replaceAll("onload=", "**")
			.replaceAll("onerror=", "**")
			.replaceAll(" onmouse", "**") // onmousedown, onmouseup, etc
			.replaceAll("onfocusin=", "**")
			.replaceAll("onfocusout=", "**")
			.replaceAll("onfocus=", "**")
			.replaceAll("onblur=", "**")
			.replaceAll("oninput=", "**")
			.replaceAll("onkeydown=", "**")
			.replaceAll("onkeyup=", "**")
			.replaceAll("onkeypress=", "**")
			.replaceAll("onkeyup", "**")
			.replaceAll("=alert", "**")
			.replaceAll("=prompt", "**")
			.replaceAll("=confirm", "**")
			.replaceAll("confirm(", "**")
			.replaceAll("=eval", "**")
			.replaceAll("ondblclick=", "**")
			.replaceAll("javascript:", "**")
			.replaceAll("srcdoc=", "**")
			.replaceAll("xlink:href=", "**")
			.replaceAll("xmlns:xlink=", "**")
			.replaceAll("ontouchstart=", "**")
			.replaceAll("ontouchend=", "**")
			.replaceAll("ontouchmove=", "**")
			.replaceAll("ontouchcancel=", "**")
			.replaceAll("onchange=", "**")
			.replaceAll("src=data:", "*,*")
			.replaceAll("data:text/html", "*,*")
			.replaceAll("onpageshow=", "**")
			.replaceAll("href=//0", "**")
			.replaceAll("onhashchange=", "**")
			.replaceAll("onscroll=", "**")
			.replaceAll("onresize=", "**")
			.replaceAll("onhelp=", "**")
			.replaceAll("onstart=", "**")
			.replaceAll("onfinish=", "**")
			.replaceAll("onloadstart=", "**")
			.replaceAll("onend=", "**")
			.replaceAll("onsubmit=", "**")
			.replaceAll("onshow=", "**")
			.replaceAll("alert`", "**")
			.replaceAll("alert&", "**")
			.replaceAll("(alert)(", "**")
			.replaceAll("innerHTML", "**")
			.replaceAll(" ondrag", "**")
			.replaceAll("activate=", "**")
			.replaceAll(" onbefore", "**")
			.replaceAll("oncopy=", "**")
			.replaceAll("oncut=", "**")
			.replaceAll("onpaste=", "**")
			.replaceAll("onpopstate=", "**")
			.replaceAll("onunhandledrejection=", "**")
			.replaceAll("onwheel=", "**")
			.replaceAll("oncontextmenu=", "**")
			.replaceAll("XMLHttpRequest(", "**")
			.replaceAll("Object.defineProperty", "**")
			.replaceAll("document.createElement(", "**")
			.replaceAll("MouseEvent(", "**")
			.replaceAll("unescape(", "**")
			.replaceAll("onreadystatechange", "**")
			.replaceAll("document.write(", "**")
			.replaceAll("write(", "**")
			.replaceAllCase("<textarea", "**")
			.replaceAllCase("<embed", "**")
			.replaceAllCase("<iframe", "**")
			.replaceAllCase("<input", "**")
			.replaceAllCase("<link", "**")
			.replaceAllCase("<meta", "**")
			.replaceAllCase("<style", "**")
			.replaceAllCase("<table", "**")
			.replaceAllCase("<layer", "**")
			.replaceAllCase("<body", "**")
			.replaceAllCase("<object", "**")
			.replaceAllCase("<html", "**")
			.replaceAllCase("<animation", "**")
			.replaceAllCase("<listener", "**")
			.replaceAllCase("<handler", "**")
			.replaceAllCase("<form", "**")
			.replaceAllCase("<?xml", "**")
			.replaceAllCase("<stylesheet", "**")
			.replaceAllCase("<eval", "**")
			.replaceAll("=javascript", "**")
			.replaceAll(" formaction=", "**")
			.replaceAll("'';!--", "**")
			.replaceAllCase("<script", "**")
			.replaceAllCase("<audio", "**")
			.replaceAllCase("<bgsound", "**")
			.replaceAllCase("<blink", "**")
			.replaceAllCase("<br><br><br>", "")
			.replaceAllCase("<video", "**");
	} catch (e) {
		return unsafe;
	}
}


/////////////// bad word filter
// I welcome updates/additions. The raw list can be found here: https://gist.github.com/steveseguin/da09a700e4fccd7ff82e68f32e384c9d
var badWords = ["fuck","shit","cunt","bitch","nigger","fag","retard","rape","pussy","cock","asshole","whore","slut","gay","lesbian","transgender","transsexual","tranny","chink","spic","kike","jap","wop","redneck","hillbilly","white trash","douche","dick","bastard","fucker","motherfucker","ass","anus","vagina","penis","testicles","masturbate","orgasm","ejaculate","clitoris","pubic","genital","erect","erotic","porn","xxx","dildo","butt plug","anal","sodomy","pedophile","bestiality","necrophilia","incest","suicide","murder","terrorism","drugs","alcohol","smoking","weed","meth","crack","heroin","cocaine","opiate","opium","benzodiazepine","xanax","adderall","ritalin","steroids","viagra","cialis","prostitution","escort"];

const alternativeChars = {
	a: ["@", "4"],
	e: ["3"],
	i: ["1", "!"],
	o: ["0"],
	s: ["$", "5"],
	t: ["7"],
	c: ["<"]
};
function generateVariations(word) {
  // Skip empty words
  if (!word || !word.trim()) return [word];
  
  // Limit word length to prevent memory issues
  const maxLength = 20;
  if (word.length > maxLength) return [word];
  
  let variations = [word];
  
  // Limit total variations to prevent exponential growth
  const maxVariations = 100;
  
  for (let i = 0; i < word.length && variations.length < maxVariations; i++) {
    const char = word[i].toLowerCase();
    if (alternativeChars.hasOwnProperty(char)) {
      const charVariations = alternativeChars[char];
      const newVariations = [];
      
      // Only process a reasonable number of existing variations
      const variationsToProcess = variations.slice(0, 10);
      
      for (const variation of variationsToProcess) {
        for (const altChar of charVariations) {
          if (newVariations.length + variations.length >= maxVariations) break;
          const newWord = variation.slice(0, i) + altChar + variation.slice(i + 1);
          newVariations.push(newWord);
        }
      }
      variations.push(...newVariations);
    }
  }
  
  // Limit final result size
  return variations.slice(0, maxVariations).filter(word => !word.match(/[A-Z]/));
}

function generateVariationsList(words) {
  // Cap input size
  const maxWordList = 1000;
  const wordsTrimmed = words.slice(0, maxWordList);
  
  const variationsList = [];
  const maxTotalVariations = 10000;
  
  for (const word of wordsTrimmed) {
    if (variationsList.length >= maxTotalVariations) break;
    const wordVariations = generateVariations(word);
    
    // Add variations up to the limit
    const remainingSlots = maxTotalVariations - variationsList.length;
    variationsList.push(...wordVariations.slice(0, remainingSlots));
  }
  
  return variationsList.filter(word => word && !word.match(/[A-Z]/));
}

function createProfanityHashTable(profanityVariationsList) {
  // Limit size to prevent memory issues
  const maxEntries = 20000;
  const limitedList = profanityVariationsList.slice(0, maxEntries);
  
  const hashTable = {};
  for (let word of limitedList) {
    word = word.trim().toLowerCase();
    if (!word) continue;
    
    const firstChar = word.charAt(0);
    if (!hashTable[firstChar]) {
      hashTable[firstChar] = {};
    }
    hashTable[firstChar][word] = true;
  }
  return hashTable;
}
function isProfanity(word) {
	if (!profanityHashTable) {
		return false;
	}
	const wordLower = word.toLowerCase();
	const firstChar = wordLower[0];
	const words = profanityHashTable[firstChar];
	if (!words) {
		return false;
	}
	return Boolean(words[wordLower]);
}

function filterProfanity(sentence) {
    let filteredSentence = sentence;
    
    // Handle multi-word phrases first
    if (profanityHashTable) {
        Object.values(profanityHashTable)
            .flatMap(obj => Object.keys(obj))
            .filter(word => word.includes(' '))
            .sort((a, b) => b.length - a.length)
            .forEach(phrase => {
                const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const phraseRegex = new RegExp(escapedPhrase, 'gi');
                filteredSentence = filteredSentence.replace(phraseRegex, match => '*'.repeat(match.length));
            });
    }
    
    // Handle single words
    const words = filteredSentence.split(/[\s\.\-_!?,]+/);
    const uniqueWords = [...new Set(words)];
    
    for (let word of uniqueWords) {
        if (word && isProfanity(word)) {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Updated regex to handle punctuation
            const wordRegex = new RegExp(`(?<!\\w)(${escapedWord}(?:${escapedWord})*?)(?:[\\s\\.,!\\?]|$)`, 'gi');
            filteredSentence = filteredSentence.replace(wordRegex, match => '*'.repeat(match.length));
        }
    }
    
    return filteredSentence;
}

var profanityHashTable = false;

function initialLoadBadWords(){
	try {
		// use a custom file named badwords.txt to replace the badWords that are hard-coded. one per line.
		fetch("./badwords.txt")
			.then(response => response.text())
			.then(text => {
				let customBadWords = text.split(/\r?\n|\r|\n/g);
				customBadWords = generateVariationsList(customBadWords);
				profanityHashTable = createProfanityHashTable(customBadWords);
			})
			.catch(error => {
				try {
					  const customBadwords = localStorage.getItem('customBadwords');
					  if (customBadwords) {
						let customBadWordsList = customBadwords.split(/\r?\n|\r|\n/g);
						customBadWordsList = generateVariationsList(customBadWordsList);
						profanityHashTable = createProfanityHashTable(customBadWordsList);
					  } else {
						// Use default badwords if no custom file is present
						badWords = generateVariationsList(badWords);
						profanityHashTable = createProfanityHashTable(badWords);
					  }
				} catch (e) {
				  badWords = generateVariationsList(badWords);
				  profanityHashTable = createProfanityHashTable(badWords);
				}

			});
	} catch (e) {
		badWords = generateVariationsList(badWords);
		profanityHashTable = createProfanityHashTable(badWords);
	}
}
initialLoadBadWords();

/////// end of bad word filter


var goodWordsHashTable = false;
function isGoodWord(word) {
	const wordLower = word.toLowerCase();
	const firstChar = wordLower[0];
	const words = goodWordsHashTable[firstChar];
	if (!words) {
		return false;
	}
	return Boolean(words[wordLower]);
}
function passGoodWords(sentence) {
	let words = sentence.toLowerCase().split(/[\s\.\-_!?,]+/);
	const uniqueWords = new Set(words);
	for (let word of uniqueWords) {
		if (!isGoodWord(word)) {
			sentence = sentence.replace(new RegExp("\\b" + word + "\\b", "gi"), "*".repeat(word.length));
		}
	}
	return sentence;
}
try {
	// use a custom file named goodwords.txt to replace the badWords that are hard-coded. one per line.
	fetch("./goodwords.txt")
		.then(response => response.text())
		.then(text => {
			let customGoodWords = text.split(/\r?\n|\r|\n/g);
			goodWordsHashTable = createProfanityHashTable(customGoodWords);
		})
		.catch(error => {
			// no file found or error
		});
} catch (e) {}


function replaceURLsWithSubstring(text, replacement = "[Link]") {
  if (typeof text !== "string") return text;
  
  try {
    // First pattern for traditional URLs
    const urlPattern = /\b(?:https?:\/\/)?(?![\d.]+\b(?!\.[a-z]))[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s]*)?/g;
    
    // Second pattern specifically for IP addresses
    const ipPattern = /\b(?:https?:\/\/)?(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d+)?(?:\/[^\s]*)?/g;
    
    // Apply both replacements
    return text
      .replace(urlPattern, (match) => {
        if (match.startsWith('http://') || match.startsWith('https://')) {
          return replacement;
        }
        const parts = match.split('.');
        const potentialTLD = parts[parts.length - 1].split(/[/?#]/)[0];
        if (match.includes('/') || isValidTLD(potentialTLD)) {
          return replacement;
        }
        return match;
      })
      .replace(ipPattern, replacement);
  } catch (e) {
    console.error(e);
    return text;
  }
}

function validateRoomId(roomId) {
	if (roomId == null || roomId === '') {
		return false;
	}
	let sanitizedId = String(roomId).trim();

	if (sanitizedId.length < 1) {
		return false;
	}
	const reservedValues = [
		'undefined',
		'null',
		'false',
		'true',
		'NaN',
		'default',
		'room',
		'lobby',
		'test',
		'nothing',
		'0',
		'1',
		'none'
	];
	if (reservedValues.includes(sanitizedId.toLowerCase())) {
		return false;
	}
	sanitizedId = sanitizedId.replace(/[^a-zA-Z0-9]/g, '_');
	if (/^_+$/.test(sanitizedId)) {
		return false;
	}
	if (sanitizedId.length < 2) {
		return false;
	}
	const MAX_LENGTH = 80;
	if (sanitizedId.length > MAX_LENGTH) {
		return false;
	}
	// throw new Error('Invalid room ID');
	return sanitizedId;
}

var loadedFirst = false;
function loadSettings(item, resave = false) {
	log("loadSettings (or saving new settings)", item);
	let reloadNeeded = false;

	if (item && item.streamID) {
		if (streamID != item.streamID) {
			streamID = item.streamID;
			streamID = validateRoomId(streamID);
			if (!streamID){
				try {
					chrome.notifications.create({
						type: "basic",
						iconUrl: "./icons/icon-128.png",
						title: "Invalid session ID",
						message: "Your session ID is invalid.\n\nPlease correct it to continue"
					});
					throw new Error('Invalid session ID');
				} catch (e) {
					console.error(e);
					throw new Error('Invalid session ID');
				}
			}
			reloadNeeded = true;
			chrome.storage.sync.set({ streamID});
			chrome.runtime.lastError;
		}
	} else if (!streamID) {
		
		streamID = generateStreamID(); // not stream ID, so lets generate one; then lets save it.
		streamID = validateRoomId(streamID);
		if (!streamID){
			streamID = generateStreamID();
		}
		streamID = validateRoomId(streamID);
		if (!streamID){
			try {
				chrome.notifications.create({
					type: "basic",
					iconUrl: "./icons/icon-128.png",
					title: "Invalid session ID",
					message: "Your session ID is invalid.\n\nPlease correct it to continue"
				});
				throw new Error('Invalid session ID');
			} catch (e) {
				console.error(e);
				throw new Error('Invalid session ID');
			}
		}
		
		if (item) {
			item.streamID = streamID;
		} else {
			item = {};
			item.streamID = streamID;
		}
		
		reloadNeeded = true;
		chrome.storage.sync.set({ streamID});
		chrome.runtime.lastError;
	}

	if (item && "password" in item) {
		if (password != item.password) {
			password = item.password;
			
			reloadNeeded = true;
			chrome.storage.sync.set({ password});
			chrome.runtime.lastError;
		}
	}

	if (item && item.settings) {
		settings = item.settings;
		
		Object.keys(patterns).forEach(pattern=>{
			settings[pattern] = findExistingEvents(pattern,{ settings });
		})
	}

	if (item && "state" in item) {
		if (isExtensionOn != item.state) {
			isExtensionOn = item.state;
			reloadNeeded = true;
			// we're saving below instead
		}
	}
	if (reloadNeeded) {
		updateExtensionState(false);
	}
	
	try {
		if (isSSAPP && ipcRenderer) {
			ipcRenderer.sendSync("fromBackground", { streamID, password, settings, state: isExtensionOn }); 
			//ipcRenderer.send('backgroundLoaded');
			if (resave && settings){
				chrome.storage.sync.set({ settings});
				chrome.runtime.lastError;
			}
		}
	} catch (e) {
		console.error(e);
	}

	toggleMidi();

	if (settings.addkarma) {
		if (!sentimentAnalysisLoaded) {
			loadSentimentAnalysis();
		}
	}

	const timedMessage = settings['timedMessage'] || [];
	for (const i of timedMessage) {
		if (settings["timemessageevent" + i]) {
			if (settings["timemessagecommand" + i]) {
				checkIntervalState(i);
			}
		}
	}

	if (settings.translationlanguage) {
		changeLg(settings.translationlanguage.optionsetting);
	}
	
	setupSocket();
	setupSocketDock();
	loadedFirst = true;
}
////////////

var miscTranslations = {
	// we won't use after the first load
	start: "START",
	said: " said: ",
	someonesaid: "Someone said: ",
	someone: "Someone"
};
async function fetchWithTimeout(URL, timeout = 8000) {
	// ref: https://dmitripavlutin.com/timeout-fetch-request/
	try {
		const controller = new AbortController();
		const timeout_id = setTimeout(() => controller.abort(), timeout);
		const response = await fetch(URL, { ...{ timeout: timeout }, signal: controller.signal });
		clearTimeout(timeout_id);
		return response;
	} catch (e) {
		errorlog(e);
		return await fetch(URL);
	}
}
async function changeLg(lang) {
	log("changeLg: " + lang);
	if (!lang) {
		log("DISABLING TRANSLATIONS");
		settings.translation = false;
		chrome.storage.local.set({
			settings: settings
		});
		chrome.runtime.lastError;
		pushSettingChange();
		return;
	}
	return await fetchWithTimeout("./translations/" + lang + ".json", 2000)
		.then(async function (response) {
			try {
				if (response.status !== 200) {
					return;
				}
				await response
					.json()
					.then(function (data) {
						if (data.miscellaneous) {
							Object.keys(data.miscellaneous).forEach(key => {
								miscTranslations[key] = data.miscellaneous[key];
							});
						}
						data.miscellaneous = miscTranslations;
						settings.translation = data;
						chrome.storage.local.set({
							settings: settings
						});
						chrome.runtime.lastError;
						pushSettingChange();
					})
					.catch(function (e) {
						log(e);
					});
			} catch (e) {
				log(e);
			}
		})
		.catch(function (err) {
			log(err);
		});
}
//////
function checkIntervalState(i) {
	if (intervalMessages[i]) {
		clearInterval(intervalMessages[i]);
	}

	if (!isExtensionOn) {
		return;
	}
	if (!i){
		return;
	}

	var offset = 0;
	if (settings["timemessageoffset" + i]) {
		offset = settings["timemessageoffset" + i].numbersetting;
	}

	intervalMessages[i] = setTimeout(
		function (i) {
			let antispam = true;
			
			if ("timemessageinterval" + i in settings) {
				if (settings["timemessageinterval" + i].numbersetting == 0) {
					if (!isExtensionOn) {
						return;
					}
					if (!settings["timemessagecommand" + i] || !settings["timemessagecommand" + i].textsetting) {
						return;
					} // failsafe
					if (!settings["timemessageevent" + i]) {
						return;
					} // failsafe
					//messageTimeout = Date.now();
					var msg = {};
					msg.response = settings["timemessagecommand" + i].textsetting;
					//sendMessageToTabs(msg, false, null, false, antispam);
					sendMessageToTabs(msg, false, null, false, antispam, false);
					
				} else if (settings["timemessageinterval" + i].numbersetting) {
					clearInterval(intervalMessages[i]);
					intervalMessages[i] = setInterval(
						function (i) {
							if (!isExtensionOn) {
								return;
							}
							if (!settings["timemessagecommand" + i] || !settings["timemessagecommand" + i].textsetting) {
								return;
							} // failsafe
							if (!settings["timemessageevent" + i]) {
								return;
							} // failsafe
							//messageTimeout = Date.now();
							var msg = {};
							msg.response = settings["timemessagecommand" + i].textsetting;
							//sendMessageToTabs(msg, false, null, false, antispam);
							sendMessageToTabs(msg, false, null, false, antispam, false);
						},
						settings["timemessageinterval" + i].numbersetting * 60000,
						i
					);
				}
			} else {
				clearInterval(intervalMessages[i]);
				intervalMessages[i] = setInterval(
					function (i) {
						if (!isExtensionOn) {
							return;
						}
						if (!settings["timemessagecommand" + i] || !settings["timemessagecommand" + i].textsetting) {
							return;
						} // failsafe
						if (!settings["timemessageevent" + i]) {
							return;
						} // failsafe
						//messageTimeout = Date.now();
						var msg = {};
						msg.response = settings["timemessagecommand" + i].textsetting;
						sendMessageToTabs(msg, false, null, false, antispam, false);
					},
					15 * 60000,
					i
				);
			}
		},
		offset * 60000 || 0,
		i
	);
}

function pushSettingChange() {
	chrome.tabs.query({}, function (tabs) {
		chrome.runtime.lastError;
		for (var i = 0; i < tabs.length; i++) {
			if (!tabs[i].url) {
				continue;
			}
			chrome.tabs.sendMessage(tabs[i].id, { settings: settings, state: isExtensionOn }, function (response = false) {
				chrome.runtime.lastError;
			});
		}
	});
}

function sleep(ms = 0) {
	return new Promise(r => setTimeout(r, ms)); // LOLz!
}
async function loadmidi() {
	const opts = {
		types: [
			{
				description: "JSON file",
				accept: { "text/plain": [".json", ".txt", ".data", ".midi"] }
			}
		]
	};
	var midiConfigFile = await window.showOpenFilePicker();

	try {
		midiConfigFile = await midiConfigFile[0].getFile();
		midiConfigFile = await midiConfigFile.text();
	} catch (e) {}

	try {
		settings.midiConfig = JSON.parse(midiConfigFile);
	} catch (e) {
		settings.midiConfig = false;
		log(e);
		messagePopup({alert: "File does not contain a valid JSON structure"});
	}
	chrome.storage.local.set({
		settings: settings
	});
	chrome.runtime.lastError;
}

var newFileHandle = false;
async function overwriteFile(data = false) {
	if (data == "setup") {
		const opts = {
			types: [
				{
					description: "JSON data",
					accept: { "text/plain": [".txt"], "application/json": [".json"] }
				}
			]
		};

		if (!window.showSaveFilePicker) {
			console.warn("Open `brave://flags/#file-system-access-api` and enable to use the File API");
		}
		newFileHandle = await window.showSaveFilePicker(opts);
	} else if (newFileHandle && data) {
		if (typeof newFileHandle == "string") {
			ipcRenderer.send("write-to-file", { filePath: newFileHandle, data: data });
		} else {
			const writableStream = await newFileHandle.createWritable();
			await writableStream.write(data);
			await writableStream.close();
		}
	}
}

var newSavedNamesFileHandle = false;
var uniqueNameSet = [];
async function overwriteSavedNames(data = false) {
	if (data == "setup") {
		uniqueNameSet = [];

		const opts = {
			types: [
				{
					description: "Text file",
					accept: { "text/plain": [".txt"] }
				}
			]
		};
		if (!window.showSaveFilePicker) {
			console.warn("Open `brave://flags/#file-system-access-api` and enable to use the File API");
		}
		newSavedNamesFileHandle = await window.showSaveFilePicker(opts);
	} else if (data == "clear") {
		uniqueNameSet = [];
		
	} else if (data == "stop") {
		newSavedNamesFileHandle = false;
		uniqueNameSet = [];
		
	} else if (newSavedNamesFileHandle && data) {
		if (uniqueNameSet.includes(data)) {
			return;
		}
		uniqueNameSet.push(data);
		if (typeof newSavedNamesFileHandle == "string") {
			ipcRenderer.send("write-to-file", { filePath: newSavedNamesFileHandle, data: uniqueNameSet.join("\r\n") });
		} else {
			const writableStream = await newSavedNamesFileHandle.createWritable();
			await writableStream.write(uniqueNameSet.join("\r\n"));
			await writableStream.close();
		}
	}
}

/* var newFileHandleExcel = false;
async function overwriteFileExcel(data=false) {
  if (data=="setup"){
	  newFileHandleExcel = await window.showSaveFilePicker();
  } else if (newFileHandleExcel && data){
	  const size = (await newFileHandleExcel.getFile()).size;
	  const writableStream = await newFileHandleExcel.createWritable();
	  await writableStream.write( type: "write",
		  data: data,
		  position: size // Set the position to the current file size.
	  });
	  await writableStream.close();
  }
} */

var workbook = false;
var worksheet = false;
var table = [];

var newFileHandleExcel = false;
async function overwriteFileExcel(data = false) {
	if (data == "setup") {
		const opts = {
			types: [
				{
					description: "Excel file",
					accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }
				}
			]
		};
		if (!window.showSaveFilePicker) {
			console.warn("Open `brave://flags/#file-system-access-api` and enable to use the File API");
		}
		newFileHandleExcel = await window.showSaveFilePicker(opts);
		workbook = XLSX.utils.book_new();

		data = [];

		worksheet = XLSX.utils.aoa_to_sheet(data);
		workbook.SheetNames.push("SocialStream-" + streamID);
		workbook.Sheets["SocialStream-" + streamID] = worksheet;

		var xlsbin = XLSX.write(workbook, {
			bookType: "xlsx",
			type: "binary"
		});

		var buffer = new ArrayBuffer(xlsbin.length),
			array = new Uint8Array(buffer);
		for (var i = 0; i < xlsbin.length; i++) {
			array[i] = xlsbin.charCodeAt(i) & 0xff;
		}
		var xlsblob = new Blob([buffer], { type: "application/octet-stream" });
		delete array;
		delete buffer;
		delete xlsbin;

		if (typeof newFileHandleExcel == "string") {
			ipcRenderer.send("write-to-file", { filePath: newFileHandleExcel, data: xlsblob });
		} else {
			const writableStream = await newFileHandleExcel.createWritable();
			await writableStream.write(xlsblob);
			await writableStream.close();
		}
	} else if (newFileHandleExcel && data) {
		for (var key in data) {
			if (!table.includes(key)) {
				table.push(key);
			}
		}
		var column = [];
		table.forEach(key => {
			if (key in data) {
				if (data[key] === undefined) {
					column.push("");
				} else if (typeof data[key] === "object") {
					column.push(JSON.stringify(data[key]));
				} else {
					column.push(data[key]);
				}
			} else {
				column.push("");
			}
		});

		XLSX.utils.sheet_add_aoa(worksheet, [table], { origin: 0 }); // replace header
		XLSX.utils.sheet_add_aoa(worksheet, [column], { origin: -1 }); // append new line

		var xlsbin = XLSX.write(workbook, {
			bookType: "xlsx",
			type: "binary"
		});

		var buffer = new ArrayBuffer(xlsbin.length),
			array = new Uint8Array(buffer);
		for (var i = 0; i < xlsbin.length; i++) {
			array[i] = xlsbin.charCodeAt(i) & 0xff;
		}
		var xlsblob = new Blob([buffer], { type: "application/octet-stream" });
		delete array;
		delete buffer;
		delete xlsbin;

		const writableStream = await newFileHandleExcel.createWritable();
		await writableStream.write(xlsblob);
		await writableStream.close();
	}
}

async function resetSettings(item = false) {
	log("reset settings");
	//alert("Settings reset");
	chrome.storage.sync.get(properties, async function (item) {
		if (!item) {
			item = {};
		}
		item.settings = {};
		loadSettings(item, true);
		// window.location.reload()
	});
}

async function exportSettings() {
	chrome.storage.sync.get(properties, async function (item) {
		item.settings = settings;
		const opts = {
			types: [
				{
					description: "Data file",
					accept: { "application/data": [".data"] }
				}
			]
		};
		if (!window.showSaveFilePicker) {
			console.warn("Open `brave://flags/#file-system-access-api` and enable to use the File API");
		}
		fileExportHandler = await window.showSaveFilePicker(opts);

		if (typeof fileExportHandler == "string") {
			ipcRenderer.send("write-to-file", { filePath: fileExportHandler, data: JSON.stringify(item) });
		} else {
			const writableStream = await fileExportHandler.createWritable();
			await writableStream.write(JSON.stringify(item));
			await writableStream.close();
		}
	});
}

async function importSettings(item = false) {
	/* const opts = {
		types: [{
		  description: 'JSON file',
		  accept: {'text/plain': ['.data']},
		}],
	}; */

	var importFile = await window.showOpenFilePicker();
	log(importFile);
	try {
		importFile = await importFile[0].getFile();
		importFile = await importFile.text(); // fail if IPC
	} catch (e) {}

	try {
		loadSettings(JSON.parse(importFile), true);
	} catch (e) {
		messagePopup({alert: "File does not contain a valid JSON structure"});
	}
}

var Url2ChannelImg = {};
var vid2ChannelImg = {};

function getYoutubeAvatarImageFallback(videoid, url) {
	// getting it from scraping youtube as fallback
	log("getYoutubeAvatarImageFallback triggered");
	fetch("https://www.youtube.com/watch?v=" + videoid)
		.then(response => response.text())
		.then(data => {
			try {
				let avatarURL = data.split('thumbnails":[{"url":"')[1].split('"')[0];
				if (avatarURL.startsWith("https://")) {
					Url2ChannelImg[url] = avatarURL;
					vid2ChannelImg[videoid] = avatarURL;
					log("getYoutubeAvatarImageFallback: " + avatarURL);
				}
			} catch (e) {}
		})
		.catch(error => {});
}

function getYoutubeAvatarImageMain(videoid, url) {
	// steves api server
	const xhttp = new XMLHttpRequest();
	xhttp.onload = function () {
		if (this.responseText.startsWith("https://")) {
			Url2ChannelImg[url] = this.responseText;
			vid2ChannelImg[videoid] = this.responseText;
			log("getYoutubeAvatarImageMain: " + this.responseText);
		} else {
			getYoutubeAvatarImageFallback(videoid, url);
		}
	};
	xhttp.onerror = function () {
		getYoutubeAvatarImageFallback(videoid, url);
	};
	xhttp.open("GET", "https://api.socialstream.ninja/youtube/channel?video=" + encodeURIComponent(videoid), true);
	xhttp.send();
}

function getYoutubeAvatarImage(url, skip = false) {
	try {
		if (url in Url2ChannelImg) {
			return Url2ChannelImg[url];
		}
		Url2ChannelImg[url] = ""; // prevent spamming of the API

		var videoid = YouTubeGetID(url);
		log("videoid: " + videoid);
		if (videoid) {
			if (videoid in vid2ChannelImg) {
				return vid2ChannelImg[videoid];
			}
			vid2ChannelImg[videoid] = "";

			getYoutubeAvatarImageMain(videoid, url);

			if (skip) {
				return;
			}

			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			} // a hacky/lazy way to wait for the response to complete
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
		}
	} catch (e) {
		console.error(e);
	}
	return false;
}

function YouTubeGetID(url) {
	var ID = "";
	url = url.replace(/(>|<)/gi, "").split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
	if (url[2] !== undefined) {
		ID = url[2].split(/[^0-9a-z_\-]/i);
		ID = ID[0];
	}
	return ID;
}

var colours = 167772;
function rainbow(step) {
	var r, g, b;
	var h = 1 - step / colours;
	var i = ~~(h * 6);
	var f = h * 6 - i;
	var q = 1 - f;
	switch (i % 6) {
		case 0:
			(r = 1), (g = f), (b = 0);
			break;
		case 1:
			(r = q), (g = 1), (b = 0);
			break;
		case 2:
			(r = 0), (g = 1), (b = f);
			break;
		case 3:
			(r = 0), (g = q), (b = 1);
			break;
		case 4:
			(r = f), (g = 0), (b = 1);
			break;
		case 5:
			(r = 1), (g = 0), (b = q);
			break;
	}
	var c = "#" + ("00" + (~~(r * 200 + 35)).toString(16)).slice(-2) + ("00" + (~~(g * 200 + 35)).toString(16)).slice(-2) + ("00" + (~~(b * 200 + 35)).toString(16)).slice(-2);
	return c;
}

function getColorFromType(source) {
    switch (source.toLowerCase()) {
        // Well-known, established brand colors
        case "youtube":
        case "youtubeshorts":
            return "#FF0000"; // YouTube Red
        case "twitch":
            return "#9147FF"; // Official Twitch Purple
        case "facebook":
            return "#1877F2"; // Official Facebook Blue
        case "twitter":
            return "#1DA1F2"; // Official Twitter Blue
        case "instagram":
        case "instagramlive":
            return "#E1306C"; // Instagram primary color
        case "linkedin":
            return "#0077B5"; // LinkedIn Blue
        case "telegram":
        case "telegramk":
            return "#229ED9"; // Telegram Blue
        case "whatsapp":
            return "#25D366"; // WhatsApp Green
        case "tiktok":
            return "#000000"; // TikTok often uses black + accent colors
        case "discord":
            return "#5865F2"; // Discord Blurple
        case "reddit": 
            return "#FF5700"; // If added in future
        
        // Some other well-known streaming or content platforms
        case "amazon":
            return "#FF9900";
        case "steam":
            return "#00AEEF"; // Steam Blue
        case "stripe":
            return "#635BFF"; // Stripe brand color
        case "teams":
            return "#6264A7"; // Microsoft Teams Purple
        case "chaturbate":
            return "#2A8BEE"; // Approx from their logo
        case "vimeo":
            return "#1AB7EA"; // Vimeo Blue
        case "kick":
        case "kick_new":
            return "#00AB00"; // Kick’s bright green
        case "trovo":
            return "#1FBF4E"; // Trovo Green
        case "dlive":
            return "#FDF300"; // DLive Yellow
        case "odyssey":
        case "odysee": 
            return "#E95796"; // Odysee Pink
        case "restream":
            return "#FF5E54"; // Restream Orange-Red
        case "tiktok":
            return "#000000"; 
        case "twitchcasting":
        case "twitcasting":
            return "#00B7FF"; // TwitCasting Blue
        case "tradingview":
            return "#2962FF"; 
        case "zoom":
            return "#2D8CFF"; // Zoom Blue
        case "cozy":
            return "#FF8989"; 
        case "facebookgaming":
        case "fb.gg":
            return "#1877F2"; // same as Facebook
        case "openai":
            return "#00A67E"; // OpenAI’s older primary green (or #8B5CF6 from new branding)
        
        // Lesser-known platforms: best guesses from logos or branding
        case "afreecatv":
            return "#0055C9"; 
        case "arena":
            return "#A200FF";
        case "bandlab":
            return "#FF0000";
        case "beamstream":
            return "#00A4C6";
        case "bigo":
            return "#2EC1D3";
        case "bilibili":
            return "#00A1D6";
        case "bmac": // Buy Me A Coffee?
            return "#FFDD00";
        case "boltplus":
            return "#FFCC00";
        case "buzzit":
            return "#FFC300";
        case "castr":
            return "#0C0D6A";
        case "cbox":
            return "#D9763E";
        case "chatroll":
            return "#2196F3";
        case "cherrytv":
            return "#FF6C6C";
        case "chime":
            return "#2F3C5C";
        case "chzzk":
            return "#00CCEE";
        case "cloudhub":
            return "#1A82D2";
        case "crowdcast":
            return "#F15E59";
        case "estrim":
            return "#00A8E6";
        case "fc2":
            return "#FF0000";
        case "floatplane":
            return "#1E90FF";
        case "gala":
            return "#FF3700";
        case "generic":
            return "#CCCCCC";
        case "jaco":
            return "#F7701D";
        case "kiwiirc":
            return "#1AB7EA";
        case "kofi":
            return "#29ABE0";
        case "livepush":
            return "#00B2FF";
        case "livestorm":
            return "#7C4DFF";
        case "livestream":
            return "#E41B13";
        case "locals":
            return "#999999";
        case "loco":
            return "#2C2D2E";
        case "meet":
            return "#00897B";
        case "meetme":
            return "#65398F";
        case "megaphonetv":
            return "#000000";
        case "minnit":
            return "#3AA757";
        case "mixcloud":
            return "#273A5C";
        case "mixlr":
            return "#ED5553";
        case "nicovideo":
            return "#000000";
        case "nimo":
            return "#F34C4C";
        case "noice":
            return "#F3F3F3";
        case "nonolive":
            return "#FF3E53";
        case "on24":
            return "#0072C6";
        case "openstreamingplatform":
            return "#444444";
        case "owncast":
            return "#9147FF"; // Similar to Twitch purple
        case "parti":
            return "#FFD700";
        case "peertube":
            return "#FF9900";
        case "picarto":
            return "#00B0FF";
        case "piczel":
            return "#FF5555";
        case "pilled":
            return "#A80000";
        case "quickchannel":
            return "#1E73BE";
        case "riverside":
            return "#181EDD";
        case "rokfin":
            return "#1997F0";
        case "roll20":
            return "#A4478E";
        case "rooter":
            return "#FF5500";
        case "rumble":
            return "#19A463";
        case "rutube":
            return "#000000";
        case "sessions":
            return "#4D9F0C";
        case "shareplay":
            return "#0FACF3";
        case "slack":
            return "#611F69";
        case "slido":
            return "#4A8C64";
        case "socialstream":
            return "#BADA55";
        case "sooplive":
        case "soopliveco":
            return "#FF66CC";
        case "stageten":
            return "#FF9800";
        case "threads":
            return "#000000";
        case "vdoninja":
            return "#000000";
        case "vk":
        case "vkvideo":
            return "#4A76A8";
        case "vkplay":
            return "#0077EE";
        case "wavevideo":
            return "#41B6E6";
        case "webex":
            return "#00A478";
        case "webinargeek":
            return "#FA6400";
        case "whatnot":
            return "#FFD300";
        case "wix":
            return "#0C6EFA";
        case "x": // formerly Twitter as "X"
            return "#000000";
        case "younow":
            return "#2DC100";
        case "zapstream":
            return "#663399";
		case "":
		case undefined:
		case null:
			"#CCCCCC";
        default:
            // Fallback for unknown sources
            return getColorFromName(source)
    }
}


// Utility function: Hex to RGB
function hexToRgb(hex) {
    // Remove leading '#'
    hex = hex.replace(/^#/, '');
    let bigint = parseInt(hex, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    return {r, g, b};
}

// Utility function: RGB to Hex
function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
        const hexVal = x.toString(16);
        return hexVal.length === 1 ? '0' + hexVal : hexVal;
    }).join('');
}

// Utility function: RGB to HSL
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return {h, s, l};
}

// Utility function: HSL to RGB
function hslToRgb(h, s, l) {
    let r, g, b;

    function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    }

    if (s === 0) {
        // achromatic
        r = g = b = l;
    } else {
        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

const colorCache = new Map();
const MAX_CACHE_SIZE = 1000;
// This function brightens and slightly desaturates the given hex color
function adjustColorForOverlay(hexColor) {
    if (colorCache.has(hexColor)) return colorCache.get(hexColor);
    
    const {r, g, b} = hexToRgb(hexColor);
    let {h, s, l} = rgbToHsl(r, g, b);
    const lightnessAdjust = 0.2;
    const saturationAdjust = -0.2;
    l = Math.min(1, l + lightnessAdjust);
    s = Math.max(0, s + saturationAdjust);
    const {r: nr, g: ng, b: nb} = hslToRgb(h, s, l);
    const result = rgbToHex(nr, ng, nb);
    
    if (colorCache.size >= MAX_CACHE_SIZE) {
        const firstKey = colorCache.keys().next().value;
        colorCache.delete(firstKey);
    }
    
    colorCache.set(hexColor, result);
    return result;
}

function getColorFromName(str) {
	var out = 0,
		len = str.length;
	if (len > 6) {
		len = 6;
	}

	if (settings.colorseed) {
		var seed = parseInt(settings.colorseed.numbersetting) || 1;
	} else {
		var seed = 26;
	}

	for (var pos = 0; pos < len; pos++) {
		out += (str.charCodeAt(pos) - 64) * Math.pow(seed, len - pos - 1);
	}

	if (settings.totalcolors) {
		colours = parseInt(settings.totalcolors.numbersetting);
		if (colours > 167772) {
			colours = 167772;
		} else if (colours < 1) {
			colours = 1;
		}
	} else {
		colours = 167772;
	}

	out = parseInt(out % colours); // get modulus

	if (colours === 1) {
		return "#F00";
	} else if (colours === 2) {
		switch (out) {
			case 0:
				return "#F00";
			case 1:
				return "#00ABFA";
		}
	} else if (colours === 3) {
		switch (out) {
			case 0:
				return "#F00";
			case 1:
				return "#00A800";
			case 2:
				return "#00ABFA";
		}
	} else if (colours === 4) {
		switch (out) {
			case 0:
				return "#F00";
			case 1:
				return "#FFA500";
			case 2:
				return "#00A800";
			case 3:
				return "#00ABFA";
		}
	} else if (colours === 5) {
		switch (out) {
			case 0:
				return "#F00";
			case 1:
				return "#FFA500";
			case 2:
				return "#00A800";
			case 3:
				return "#00ABFA";
			case 4:
				return "#FF39C5";
		}
	} else {
		out = rainbow(out);
	}
	return out;
}

var intervalMessages = {};

function updateExtensionState(sync = true) {
	log("updateExtensionState", isExtensionOn);
	
	document.title = "Keep Open - Social Stream Ninja";

	if (isExtensionOn) {
		
		if (chrome.browserAction && chrome.browserAction.setIcon){
			chrome.browserAction.setIcon({ path: "/icons/on.png" });
		}
		if (chrome.action && chrome.action.setIcon){
			chrome.action.setIcon({ path: "/icons/on.png" });
		}
		if (streamID) {
			loadIframe(streamID, password);
		}
		setupSocket();
		setupSocketDock();
	} else {
		
		// document.title = "Idle - Social Stream Ninja";
		
		if (iframe) {
			iframe.src = null;
			iframe.remove();
			iframe = null;
		}

		if (socketserver) {
			socketserver.close();
		}

		if (socketserverDock) {
			socketserverDock.close();
		}

		if (intervalMessages) {
			for (i in intervalMessages) {
				clearInterval(intervalMessages[i]);
			}
		}
		if (chrome.browserAction && chrome.browserAction.setIcon){
			chrome.browserAction.setIcon({ path: "/icons/off.png" });
		}
		if (chrome.action && chrome.action.setIcon){
			chrome.action.setIcon({ path: "/icons/off.png" });
		}
	}

	if (sync) {
		chrome.storage.sync.set({
			state: isExtensionOn
		});
		chrome.runtime.lastError;
	}

	toggleMidi();
	pushSettingChange();
}

function setItemWithExpiry(key, value, expiryInMinutes = 1440) {
	const now = new Date();
	const item = {
		value: value,
		expiry: now.getTime() + expiryInMinutes * 60000
	};
	localStorage.setItem(key, JSON.stringify(item));
}

function getItemWithExpiry(key) {
	const itemStr = localStorage.getItem(key);

	if (!itemStr) {
		return null;
	}

	const item = JSON.parse(itemStr);
	const now = new Date();

	if (now.getTime() > item.expiry) {
		localStorage.removeItem(key);
		return null;
	}

	return item.value;
}

function clearAllWithPrefix(prefix) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(prefix)) {
      localStorage.removeItem(key);
	  //console.log("Cleared "+key);
      i--;
    }
  }
}

var Pronouns = false;
async function getPronouns() {
    if (!Pronouns) {
		try{
			Pronouns = getItemWithExpiry("Pronouns");

			if (!Pronouns) {
				Pronouns = await fetch("https://api.pronouns.alejo.io/v1/pronouns")
					.then(response => {
						const cacheControl = response.headers.get('Cache-Control');
						let maxAge = 3600; // Default to 60 minutes

						if (cacheControl) {
							const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
							if (maxAgeMatch && maxAgeMatch[1]) {
								maxAge = parseInt(maxAgeMatch[1]);
							}
						}

						return response.json().then(result => {
							for (const key in result) {
								if (result.hasOwnProperty(key)) {
									const { subject, object } = result[key];
									result[key] = `${subject}/${object}`;
									
									result[key] = result[key]
									.replace(/&/g, "&amp;") // i guess this counts as html
									.replace(/</g, "&lt;")
									.replace(/>/g, "&gt;")
									.replace(/"/g, "&quot;")
									.replace(/'/g, "&#039;") || ""
								}
							}
							
							setItemWithExpiry("Pronouns", result, maxAge / 60);
							return result;
						});
					})
					.catch(err => {
						// console.error(err);
						return {};
					});

				if (!Pronouns) {
					Pronouns = {};
				}
			} else {
				log("Pronouns recovered from storage");
			}
		} catch(e){
			Pronouns = {};
		}
    }
}
var PronounsNames = {};

async function getPronounsNames(username = "") {
    if (!username) {
        return false;
    }
	try{
		if (!(username in PronounsNames)) {
			PronounsNames[username] = getItemWithExpiry("Pronouns:" + username);

			if (!PronounsNames[username]) {
				PronounsNames[username] = await fetch("https://api.pronouns.alejo.io/v1/users/" + username)
					.then(response => {
						const cacheControl = response.headers.get('Cache-Control');
						let maxAge = 3600; // Default to 60 minutes

						if (cacheControl) {
							const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
							if (maxAgeMatch && maxAgeMatch[1]) {
								maxAge = parseInt(maxAgeMatch[1]);
							}
						}
						//console.log(response);
						return response.json().then(result => {
							//console.log(result);
							setItemWithExpiry("Pronouns:" + username, result, maxAge / 60);
							return result;
						});
					})
					.catch(err => {
						//console.error(err);
						return false;
					});

				if (!PronounsNames[username]) {
					PronounsNames[username] = false;
				}
			}
		}
	} catch(e){
		 return false;
	}
    return PronounsNames[username];
}

var Globalbttv = false;
var Globalseventv = false;
var Globalffz = false;

async function getBTTVEmotes(url = false, type=null, channel=null) {
	var bttv = {};
	var userID = false;
	// console.log(url, type, channel);
	try {
		if (type){
			type = type.toLowerCase();
		} else if (url && url.includes("youtube.com/")) {
			type = "youtube";
		} else if (url && url.includes("twitch.tv/")) {
			type = "twitch";
		}

		if (type == "youtube") {
			var vid = false;
			if (url) {
				vid = YouTubeGetID(url);
			}

			if (vid) {
				userID = localStorage.getItem("vid2uid:" + vid);
				
				if (!userID) {
					userID = await fetch("https://api.socialstream.ninja/youtube/user?video=" + vid)
						.then(result => {
							return result.text();
						})
						.then(result => {
							return result;
						})
						.catch(err => {
							//	log(err);
						});
					if (userID) {
						localStorage.setItem("vid2uid:" + vid, userID);
					} else {
						return false;
					}
				}
				if (userID) {
					bttv = getItemWithExpiry("uid2bttv2.youtube:" + userID);

					if (!bttv) {
						bttv = await fetch("https://api.betterttv.net/3/cached/users/youtube/" + userID)
							.then(result => {
								return result.json();
							})
							.then(result => {
								return result;
							})
							.catch(err => {
								//	log(err);
							});
						if (bttv) {
							if (bttv.channelEmotes) {
								bttv.channelEmotes = bttv.channelEmotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.betterttv.net/emote/${emote.id}/2x`;
									acc[emote.code] = imageUrl;
									return acc;
								}, {});
							}
							if (bttv.sharedEmotes) {
								bttv.sharedEmotes = bttv.sharedEmotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.betterttv.net/emote/${emote.id}/2x`;
									acc[emote.code] = imageUrl;
									return acc;
								}, {});
							}
							setItemWithExpiry("uid2bttv2.youtube:" + userID, bttv);
						} else {
							bttv = {};
						}
					} else {
						log("bttv recovererd from storage");
					}
				}
			}
		} else if (type == "twitch") {
			try {
			var username = "";
			if (channel){
				username = channel;
			} else if (url && url.startsWith("https://dashboard.twitch.tv/popout/u/")){
				username = url.replace("https://dashboard.twitch.tv/popout/u/","").split("/")[0];
			} else if (url){
				username =  url.split("popout/");
				if (username.length > 1) {
					username = username[1].split("/")[0];
				} else {
					username = "";
				}
			}
			} catch(e){errorlog(e);}

			if (username) {
				bttv = getItemWithExpiry("uid2bttv2.twitch:" + username.toLowerCase());
				log("BTTV2", bttv);
				if (!bttv || bttv.message) {
					bttv = {};
					userID = localStorage.getItem("twitch2uid." + username.toLowerCase());
					if (!userID) {
						const response = await fetch("https://api.socialstream.ninja/twitch/user?username=" + username);

						if (!response.ok) {
							return {};
						}
						const data = await response.json();

						//log(data);
						if (data && data.data && data.data[0] && data.data[0].id) {
							userID = data.data[0].id;

							if (userID) {
								localStorage.setItem("twitch2uid." + username.toLowerCase(), userID);
							}
						} else {
							userID = false;
						}
					}
					if (userID) {
						bttv = await fetch("https://api.betterttv.net/3/cached/users/twitch/" + userID)
							.then(result => {
								return result.json();
							})
							.then(result => {
								return result;
							})
							.catch(err => {
								console.error(err);
							});
						if (bttv) {
							if (bttv.channelEmotes) {
								bttv.channelEmotes = bttv.channelEmotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.betterttv.net/emote/${emote.id}/2x`;
									acc[emote.code] = imageUrl;
									return acc;
								}, {});
							}
							if (bttv.sharedEmotes) {
								bttv.sharedEmotes = bttv.sharedEmotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.betterttv.net/emote/${emote.id}/2x`;
									acc[emote.code] = imageUrl;
									return acc;
								}, {});
							}
							setItemWithExpiry("uid2bttv2.twitch:" + username.toLowerCase(), bttv);
						} else {
							bttv = {};
						}
						log("BTTV", bttv);
					}
				} else {
					log("bttv recovererd from storage");
				}
			}
		}

		if (!Globalbttv) {
			Globalbttv = getItemWithExpiry("globalbttv2");

			if (!Globalbttv) {
				Globalbttv = await fetch("https://api.betterttv.net/3/cached/emotes/global")
					.then(result => {
						return result.json();
					})
					.then(result => {
						return result;
					})
					.catch(err => {
						//log(err);
					});
				if (Globalbttv) {
					Globalbttv = Globalbttv.reduce((acc, emote) => {
						const imageUrl = `https://cdn.betterttv.net/emote/${emote.id}/2x`;
						acc[emote.code] = imageUrl;
						return acc;
					}, {});
					setItemWithExpiry("globalbttv2", Globalbttv);
				} else {
					Globalbttv = [];
				}
			} else {
				log("Globalbttv recovererd from storage");
			}
			
		}
		
		if (Globalbttv){
			if (!bttv){bttv = {};}
			bttv.globalEmotes = Globalbttv;
		}
		bttv.url = url;
		bttv.type = type;
		bttv.user = userID;
		//log(Globalbttv);
	} catch (e) {
		console.error(e);
	}
	return bttv;
}


async function getSEVENTVEmotes(url = false, type=null, channel=null) {
	var seventv = {};
	var userID = false;

	try {
		if (type){
			type = type.toLowerCase();
		} else if (url && url.includes("youtube.com/")) {
			type = "youtube";
		} else if (url && url.includes("twitch.tv/")) {
			type = "twitch";
		}

		if (type == "youtube") {
			var vid = false;
			if (url) {
				vid = YouTubeGetID(url);
			}

			if (vid) {
				userID = localStorage.getItem("vid2uid:" + vid);

				if (!userID) {
					userID = await fetch("https://api.socialstream.ninja/youtube/user?video=" + vid)
						.then(result => {
							return result.text();
						})
						.then(result => {
							return result;
						})
						.catch(err => {
							console.error(err);
						});
					if (userID) {
						localStorage.setItem("vid2uid:" + vid, userID);
					} else {
						return false;
					}
				}
				if (userID) {
					seventv = getItemWithExpiry("uid2seventv.youtube:" + userID);
					if (!seventv) {
						seventv = await fetch("https://7tv.io/v3/users/youtube/" + userID)
							.then(result => {
								return result.json();
							})
							.then(result => {
								return result;
							})
							.catch(err => {
								console.error(err);
							});

						if (seventv) {
							if (seventv.emote_set && seventv.emote_set.emotes) {
								seventv.channelEmotes = seventv.emote_set.emotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.7tv.app/emote/${emote.id}/2x.webp`; // https://cdn.7tv.app/emote/63f11c0d5dccf65d6e8d13ff/4x.webp
									if ((emote.data && emote.data.flags) || emote.flags) {
										acc[emote.name] = { url: imageUrl, zw: true };
									} else {
										acc[emote.name] = imageUrl;
									}
									return acc;
								}, {});
							}

							setItemWithExpiry("uid2seventv.youtube:" + userID, seventv);
						}
					}
				}
			}
		} else if (type == "twitch") {
			
			var username = "";
			if (channel){
				username = channel;
			} else if (url && url.startsWith("https://dashboard.twitch.tv/popout/u/")){
				username = url.replace("https://dashboard.twitch.tv/popout/u/","").split("/")[0];
			} else if (url){
				username =  url.split("popout/");
				if (username.length > 1) {
					username = username[1].split("/")[0];
				} else {
					username = "";
				}
			}

			log("username: " + username);
			if (username) {
				seventv = getItemWithExpiry("uid2seventv.twitch:" + username.toLowerCase());
				log("SEVENTV2", seventv);
				if (!seventv || seventv.message) {
					seventv = {};
					userID = localStorage.getItem("twitch2uid." + username.toLowerCase());
					if (!userID) {
						const response = await fetch("https://api.socialstream.ninja/twitch/user?username=" + username);

						if (!response.ok) {
							return {};
						}
						const data = await response.json();

						//log(data);
						if (data && data.data && data.data[0] && data.data[0].id) {
							userID = data.data[0].id;

							if (userID) {
								localStorage.setItem("twitch2uid." + username.toLowerCase(), userID);
							}
						} else {
							userID = false;
						}
					}
					if (userID) {
						seventv = await fetch("https://7tv.io/v3/users/twitch/" + userID)
							.then(result => {
								return result.json();
							})
							.then(result => {
								return result;
							})
							.catch(err => {
								console.error(err);
							});
						if (seventv) {
							if (seventv.emote_set && seventv.emote_set.emotes) {
								seventv.channelEmotes = seventv.emote_set.emotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.7tv.app/emote/${emote.id}/2x.webp`; // https://cdn.7tv.app/emote/63f11c0d5dccf65d6e8d13ff/4x.webp
									if ((emote.data && emote.data.flags) || emote.flags) {
										acc[emote.name] = { url: imageUrl, zw: true };
									} else {
										acc[emote.name] = imageUrl;
									}
									return acc;
								}, {});
							}

							setItemWithExpiry("uid2seventv.twitch:" + username.toLowerCase(), seventv);
						} else {
							seventv = {};
						}
						log("SEVENTV", seventv);
					}
				} else {
					log("seventv recovererd from storage");
				}
			}
		}

		if (!Globalseventv) {
			Globalseventv = getItemWithExpiry("globalseventv");

			if (!Globalseventv) {
				Globalseventv = await fetch("https://7tv.io/v3/emote-sets/global")
					.then(result => {
						return result.json();
					})
					.then(result => {
						return result;
					})
					.catch(err => {
						console.error(err);
					});
				if (Globalseventv && Globalseventv.emotes) {
					Globalseventv = Globalseventv.emotes.reduce((acc, emote) => {
						const imageUrl = `https://cdn.7tv.app/emote/${emote.id}/2x.webp`; // https://cdn.7tv.app/emote/63f11c0d5dccf65d6e8d13ff/4x.webp
						if (emote.flags) {
							acc[emote.name] = { url: imageUrl, zw: true };
						} else {
							acc[emote.name] = imageUrl;
						}
						return acc;
					}, {});
					setItemWithExpiry("globalseventv", Globalseventv);
				} else {
					Globalseventv = [];
				}
			} else {
				log("Globalseventv recovererd from storage");
			}
		}
		if (Globalseventv){
			if (!seventv){seventv = {};}
			seventv.globalEmotes = Globalseventv;
		}
		seventv.url = url;
		seventv.type = type;
		seventv.user = userID;
		//log(Globalseventv);
	} catch (e) {
		console.error(e);
	}
	return seventv;
}

async function getFFZEmotes(url = false, type=null, channel=null) {
	var ffz = {};
	var userID = false;

	try {
		if (type){
			type = type.toLowerCase();
		} else if (url && url.includes("youtube.com/")) {
			type = "youtube";
		} else if (url && url.includes("twitch.tv/")) {
			type = "twitch";
		}

		if (type == "youtube") {
			// YouTube functionality remains largely the same
			var vid = false;
			if (url) {
				vid = YouTubeGetID(url);
			}

			if (vid) {
				userID = localStorage.getItem("vid2uid:" + vid);

				if (!userID) {
					userID = await fetch("https://api.socialstream.ninja/youtube/user?video=" + vid)
						.then(result => result.text())
						.catch(err => {
							console.error(err);
						});
					if (userID) {
						localStorage.setItem("vid2uid:" + vid, userID);
					} else {
						return false;
					}
				}
				if (userID) {
					ffz = getItemWithExpiry("uid2ffz.youtube:" + userID);
					if (!ffz) {
						// Use FFZ API to get user's emotes
						ffz = await fetch(`https://api.frankerfacez.com/v1/room/yt/${userID}`)
							.then(result => result.json())
							.catch(err => {
								console.error(err);
							});

						if (ffz && ffz.sets) {
							ffz.channelEmotes = Object.values(ffz.sets).flatMap(set => 
								set.emoticons.map(emote => ({
									[emote.name]: {
										url: emote.urls["1"], // Use 1x size as default
										zw: emote.modifier // FFZ uses 'modifier' flag for zero-width emotes
									}
								}))
							).reduce((acc, curr) => Object.assign(acc, curr), {});

							setItemWithExpiry("uid2ffz.youtube:" + userID, ffz);
						}
					}
				}
			}
		} else if (type == "twitch") {
			
			var username = "";
			if (channel){
				username = channel;
			} else if (url && url.startsWith("https://dashboard.twitch.tv/popout/u/")){
				username = url.replace("https://dashboard.twitch.tv/popout/u/","").split("/")[0];
			} else if (url){
				username =  url.split("popout/");
				if (username.length > 1) {
					username = username[1].split("/")[0];
				} else {
					username = "";
				}
			}

			log("username: " + username);
			if (username) {
				ffz = getItemWithExpiry("uid2ffz.twitch:" + username.toLowerCase());
				log("FFZ2", ffz);
				if (!ffz || ffz.message) {
					// Use FFZ API to get user's emotes
					ffz = await fetch(`https://api.frankerfacez.com/v1/room/${username}`)
						.then(result => result.json())
						.catch(err => {
							console.error(err);
						});

					if (ffz && ffz.sets) {
						ffz.channelEmotes = Object.values(ffz.sets).flatMap(set => 
							set.emoticons.map(emote => ({
								[emote.name]: {
									url: emote.urls["3"] || emote.urls["2"] || emote.urls["1"], // Use 1x size as default
									zw: emote.modifier // FFZ uses 'modifier' flag for zero-width emotes
								}
							}))
						).reduce((acc, curr) => Object.assign(acc, curr), {});

						setItemWithExpiry("uid2ffz.twitch:" + username.toLowerCase(), ffz);
					} else {
						ffz = {};
					}
					log("FFZ", ffz);
				} else {
					log("ffz recovered from storage");
				}
			}
		}

		if (!Globalffz) {
			Globalffz = getItemWithExpiry("globalffz");

			if (!Globalffz) {
				// Use FFZ API to get global emotes
				Globalffz = await fetch("https://api.frankerfacez.com/v1/set/global")
					.then(result => result.json())
					.catch(err => {
						console.error(err);
					});
				if (Globalffz && Globalffz.sets) {
					Globalffz = Object.values(Globalffz.sets).flatMap(set => 
						set.emoticons.map(emote => ({
							[emote.name]: {
								url: emote.urls["1"], // Use 1x size as default
								zw: emote.modifier // FFZ uses 'modifier' flag for zero-width emotes
							}
						}))
					).reduce((acc, curr) => Object.assign(acc, curr), {});
					setItemWithExpiry("globalffz", Globalffz);
				} else {
					Globalffz = {};
				}
			} else {
				log("Globalffz recovered from storage");
			}
		}
		if (Globalffz){
			if (!ffz){ffz = {};}
			ffz.globalEmotes = Globalffz;
		}
		ffz.url = url;
		ffz.type = type;
		ffz.user = userID;
	} catch (e) {
		console.error(e);
	}
	return ffz;
}

const emoteRegex = /(?<=^|\s)(\S+?)(?=$|\s)/g;

function replaceEmotesWithImages(message, emotesMap, zw = false) {
  return message.replace(emoteRegex, (match, emoteMatch) => {
	const emote = emotesMap[emoteMatch];
	if (emote) {
	  const escapedMatch = escapeHtml(match);
	  if (!zw || typeof emote === "string") {
		return `<img src="${emote}" alt="${escapedMatch}" class='zero-width-friendly'/>`;
	  } else if (emote.url) {
		return `<span class="zero-width-span"><img src="${emote.url}" alt="${escapedMatch}" class="zero-width-emote" /></span>`;
	  }
	}
	return match;
  });
}
	

class CheckDuplicateSources { // doesn't need to be text-only, as from the same source / site, so expected the same formating
  constructor() {
    this.messages = new Map();
    this.expireTime = 6000;
  }

  generateKey(channel, user, text) {
    return `${channel}-${user}-${text}`;
  }

  isDuplicate(channel, user, text) {
    const currentTime = Date.now();
    const key = this.generateKey(channel, user, text);

    if (this.messages.has(key)) {
      const lastTime = this.messages.get(key);
      if (currentTime - lastTime < this.expireTime) {
        return true;
      }
    }

    this.messages.set(key, currentTime);
    this.cleanUp(currentTime);

    return false;
  }

  cleanUp(currentTime) {
    for (const [key, time] of this.messages.entries()) {
      if (currentTime - time > this.expireTime) {
        this.messages.delete(key);
      }
    }
  }
}




function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

let activeChatSources = new Map();

try {
	if (chrome.tabs.onRemoved){
		chrome.tabs.onRemoved.addListener((tabId) => {
		  for (let key of activeChatSources.keys()) {
			if (key.startsWith(`${tabId}-`)) {
			  activeChatSources.delete(key);
			}
		  }
		});
	}
	if (chrome.tabs.onUpdated){
		chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
		  if (changeInfo.status === 'complete' && tab.url) {
			const videoId = extractVideoId(tab.url);
			if (videoId && (
			  tab.url.includes('https://studio.youtube.com/live_chat?') ||
			   tab.url.includes('https://www.youtube.com/live_chat?') ||
			  (tab.url.includes('https://studio.youtube.com/video/') && tab.url.includes('/livestreaming'))
			)) {
			  const isPopout = tab.url.includes('live_chat?is_popout=1');
			  activeChatSources.set(`${tabId}-0`, { url: tab.url, videoId: videoId, isPopout: isPopout });
			} else {
			  for (let key of activeChatSources.keys()) {
				if (key.startsWith(`${tabId}-`)) {
				  activeChatSources.delete(key);
				}
			  }
			}
		  }
		});
	}
} catch(e){
	console.warn(e);
}

function shouldAllowYouTubeMessage(tabId, tabUrl, msg, frameId = 0) {
  const videoId = msg.videoid || extractVideoId(tabUrl);
  if (!videoId) return true;

  const sourceId = `${tabId}-${frameId}`;
  
  const isPopout = tabUrl.includes('live_chat?is_popout=1');
  
  activeChatSources.set(sourceId, { 
    url: tabUrl, 
    videoId: videoId, 
    isPopout: isPopout
  });

  const sourcesForThisVideo = Array.from(activeChatSources.entries())
    .filter(([, data]) => data.videoId === videoId);

  if (sourcesForThisVideo.length === 1) {
    return true; 
  }

  const hasPopout = sourcesForThisVideo.some(([, data]) => data.isPopout);

  if (hasPopout) {
    return isPopout; 
  }

  return sourceId === sourcesForThisVideo[0][0];
}

const checkDuplicateSources = new CheckDuplicateSources();

async function processIncomingMessage(message, sender=null){
	
	try {
		if (sender?.tab){
			message.tid = sender.tab.id; // including the source (tab id) of the social media site the data was pulled from
		}
	} catch (e) {}

	if (isExtensionOn && message?.type) {
		if (!checkIfAllowed(message.type)) {
			return;
		}

		if (settings.filtercommands && message.chatmessage && message.chatmessage.startsWith("!")) {
			return;
		}

		if (settings.filtercommandscustomtoggle && message.chatmessage && settings.filtercommandscustomwords && settings.filtercommandscustomwords.textsetting) {
			if (settings.filtercommandscustomwords.textsetting.split(",").some(v => v.trim() && message.chatmessage.startsWith(v.trim()))) {
				return;
			}
		}
		
		let reflection = false;
		
		// checkExactDuplicateAlreadyReceived only does work if there was a message responsein the last 10 seconds.
		reflection = checkExactDuplicateAlreadyReceived(message.chatmessage,message.textonly, message.tid, message.type);
		if (reflection && (settings.firstsourceonly || settings.hideallreplies || settings.thissourceonly)){
			return;
		}
		
		if (reflection===null){
			reflection = true;
		}
		
		if (reflection){
			message.reflection = true;
		}
		
		if (settings.noduplicates && // filters echos if same TYPE, USERID, and MESSAGE 
			checkDuplicateSources.isDuplicate(message.type, (message.userid || message.chatname), 
				(message.chatmessage || message.hasDonation || (message.membership && message.event)))) {
					return;
		}
		
		if ((message.type == "youtube") || (message.type == "youtubeshorts")){
			if (settings.blockpremiumshorts && (message.type == "youtubeshorts")){
				if (message.hasDonation || (message.membership && message.event)){
					return;
				}
			}
			try {
				if (sender?.tab){
					const shouldAllowMessage = shouldAllowYouTubeMessage(sender.tab.id, sender.tab.url, message, sender.frameId);
					if (!shouldAllowMessage) {
					  return;
					}
				}
			  } catch(e) {
				//console.warn("Error in shouldAllowYouTubeMessage:", e);
			  }
			
			if (sender?.tab?.url) {
				var brandURL = getYoutubeAvatarImage(sender.tab.url); // query my API to see if I can resolve the Channel avatar from the video ID
				if (brandURL) {
					message.sourceImg = brandURL;
				}
			}
		} 

		if (message.type == "facebook") {
			// since Facebook dupes are a common issue
			if (sender?.tab?.url) {
				if (message.chatname && message.chatmessage) {
					clearInterval(FacebookDupesTime);
					if (FacebookDupes == message.chatname + ":" + message.chatmessage) {
						return;
					} else {
						FacebookDupes = message.chatname + ":" + message.chatmessage;
						FacebookDupesTime = setTimeout(function () {
							FacebookDupes = "";
						}, 15000);
					}
				}
			}
		}
		
		if (!message.id) {
			messageCounter += 1;
			message.id = messageCounter;
		}
		
		try {
			message = await applyBotActions(message, sender?.tab); // perform any immediate actions
		} catch (e) {
			console.warn(e);
		}
		if (!message) {
			return message;
		}
		
		sendToDestinations(message); // send the data to the dock
	}
	return message;
}

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponseReal) {
	var response = {};
	var alreadySet = false;
	
	function sendResponse(msg) {
		if (alreadySet) {
		  console.error("Shouldn't run sendResponse twice");
		} else if (sendResponseReal) {
		  alreadySet = true;
		  // Always include current state in responses
		  msg.state = isExtensionOn;
		  sendResponseReal(msg);
		}
		response = msg;
	}
	
	if (!loadedFirst){
		for (var i = 0 ;i < 100;i++){
			await sleep(100);
			if (loadedFirst){
				break;
			}
		}
		// add a stall here instead if this actually happens
		if (!loadedFirst){
			return sendResponse({"tryAgain":true});
		}
	}
	
	try {
		if (typeof request !== "object") {
			//sendResponse({"state": isExtensionOn});
			return response;
		}

		if (request.cmd && request.cmd === "setOnOffState") {
			// toggle the IFRAME (stream to the remote dock) on or off
			isExtensionOn = request.data.value;

			updateExtensionState();
			sendResponse({ state: isExtensionOn, streamID: streamID, password: password, settings: settings });
		} else if (request.cmd && request.cmd === "getOnOffState") {
			sendResponse({ state: isExtensionOn, streamID: streamID, password: password, settings: settings });
		} else if (request.cmd && request.cmd === "getSettings") {
			try { 
				sendResponse({ state: isExtensionOn, streamID: streamID, password: password, settings: settings, documents: documentsRAG});
			} catch(e){
				sendResponse({ state: isExtensionOn, streamID: streamID, password: password, settings: settings});
			}
		} else if (request.cmd && request.cmd === "saveSetting") {
			if (typeof settings[request.setting] == "object") {
				if (!request.value) {
					// pretty risky if something shares the same name.
					delete settings[request.setting];
				} else {
					settings[request.setting][request.type] = request.value;
					if (request.type == "json"){
						settings[request.setting]["object"] = JSON.parse(request.value); // convert to object for use
					}
				}
			} else if ("type" in request) {
				if (!request.value) {
					delete settings[request.setting];
				} else {
					settings[request.setting] = {};
					settings[request.setting][request.type] = request.value;
					if (request.type == "json"){
						settings[request.setting]["object"] = JSON.parse(request.value); // convert to object for use
					}
					//settings[request.setting].value = request.value; // I'll use request.value instead
				}
			} else {
				settings[request.setting] = request.value;
			}
			
			Object.keys(patterns).forEach(pattern=>{
				settings[pattern] = findExistingEvents(pattern,{ settings });
			})

			chrome.storage.local.set({
				settings: settings
			});
			chrome.runtime.lastError;

			sendResponse({ state: isExtensionOn });
			
			if (request.target){
				sendTargetP2P(request, request.target);
			}

			if (request.setting == "midi") {
				toggleMidi();
			}
			
			// if (request.setting == "customGifCommands") {
				// if (request.setting["customGifCommands"].array){
					// request.setting["customGifCommands"].array
				// }
			// }

			if (request.setting == "socketserver") {
				if (request.value) {
					if (!socketserver) {
						setupSocket();
					}
				} else {
					if (socketserver) {
						socketserver.close();
					}
				}
			}

			if (request.setting == "lanonly") {
				if (request.value) {
					if (iframe) {
						if (iframe.src) {
							iframe.src = null;
						}

						iframe.remove();
						iframe = null;
					}
					if (isExtensionOn) {
						loadIframe(streamID, password);
					}
				} else {
					if (iframe) {
						if (iframe.src) {
							iframe.src = null;
						}

						iframe.remove();
						iframe = null;
					}
					if (isExtensionOn) {
						loadIframe(streamID, password);
					}
				}
			}

			if (request.setting == "server2") {
				if (request.value) {
					if (!socketserverDock) {
						setupSocketDock();
					}
				} else {
					if (socketserverDock && !settings.server3) {
						// server 3 also needs to be off
						socketserverDock.close();
					}
				}
			} else if (request.setting == "server3") {
				if (request.value) {
					if (!socketserverDock) {
						setupSocketDock();
					}
				} else {
					if (socketserverDock && !settings.server2) {
						// server 2 also needs to be off
						socketserverDock.close();
					}
				}
			}
			if (request.setting == "textonlymode") {
				pushSettingChange();
			}
			if (request.setting == "ignorealternatives") {
				pushSettingChange();
			}
			if (request.setting == "tiktokdonations") {
				pushSettingChange();
			}
			if (request.setting == "notiktokdonations") {
				pushSettingChange();
			}
			if (request.setting == "twichadmute") {
				pushSettingChange();
			} 
			if (request.setting == "twichadannounce") {
				pushSettingChange();
			}
			if (request.setting == "autoLiveYoutube") {
				pushSettingChange();
			}
			if (request.setting == "ticker") {
				try {
					await loadFileTicker();
				} catch(e){}
			}
			if (request.setting == "discord") {
				pushSettingChange();
			}
			if (request.setting == "customdiscordchannel") {
				pushSettingChange();
			}
			if (request.setting == "flipYoutube") {
				pushSettingChange();
			}
			if (request.setting == "hidePaidPromotion") {
				pushSettingChange();
			}
			if (request.setting == "fancystageten") {
				pushSettingChange();
			}
			if (request.setting == "allmemberchat") {
				pushSettingChange();
			}
			if (request.setting == "limitedyoutubememberchat") {
				pushSettingChange();
			}
			if (request.setting == "drawmode") {
				sendWaitlistConfig(null, true);
			}
			if (request.setting == "collecttwitchpoints") {
				pushSettingChange();
			}
			if (request.setting == "detweet") {
				pushSettingChange();
			}
			if (request.setting == "xcapture") {
				pushSettingChange();
			}
			if (request.setting == "memberchatonly") {
				pushSettingChange();
			}
			if (request.setting == "customtwitchstate") {
				pushSettingChange();
			}
			if (request.setting == "replyingto") {
				pushSettingChange();
			}
			if (request.setting == "delayyoutube") {
				pushSettingChange();
			}
			if (request.setting == "delaykick") {
				pushSettingChange();
			}
			if (request.setting == "delaytwitch") {
				pushSettingChange();
			}
			if (request.setting == "customtwitchaccount") {
				pushSettingChange();
			}
			if (request.setting == "customtiktokstate") {
				pushSettingChange();
			}
			if (request.setting == "customtiktokaccount") {
				pushSettingChange();
			}
			if (request.setting == "customyoutubestate") {
				pushSettingChange();
			}
			if (request.setting == "customkickstate") {
				pushSettingChange();
			}
			if (request.setting == "customriversidestate") {
				pushSettingChange();
			}
			if (request.setting == "customlivespacestate") {
				pushSettingChange();
			}
			if (request.setting == "customlivespaceaccount") {
				pushSettingChange();
			}
			if (request.setting == "customyoutubeaccount") {
				pushSettingChange();
			}
			//if (request.setting == "mynameext") {
			//	request.setting = "hostnamesext"
			//}
			if (request.setting == "hostnamesext") {
				pushSettingChange();
			}
			if (request.setting == "nosubcolor") {
				pushSettingChange();
			}
			if (request.setting == "captureevents") {
				pushSettingChange();
			}
			if (request.setting == "capturejoinedevent") {
				pushSettingChange();
			} 
			if (request.setting == "bttv") {
				if (settings.bttv) {
					clearAllWithPrefix("uid2bttv2.twitch:");
					clearAllWithPrefix("uid2bttv2.youtube:");
					await getBTTVEmotes();
				}
				pushSettingChange();
			}
			if (request.setting == "seventv") {
				if (settings.seventv) {
					clearAllWithPrefix("uid2seventv.twitch:");
					clearAllWithPrefix("uid2seventv.youtube:");
					await getSEVENTVEmotes();
				}
				pushSettingChange();
			}
			if (request.setting == "ffz") {
				if (settings.ffz) {
					clearAllWithPrefix("uid2ffz.twitch:");
					clearAllWithPrefix("uid2ffz.youtube:");
					await getFFZEmotes();
				}
				pushSettingChange();
			}
			if (request.setting == "pronouns") {
				if (settings.pronouns) {
					clearAllWithPrefix("Pronouns");
					Pronouns = false;
					await getPronouns();
				}
			}
			if (request.setting == "addkarma") {
				if (request.value) {
					if (!sentimentAnalysisLoaded) {
						loadSentimentAnalysis();
					}
				}
			}

			if (request.setting == "hypemode") {
				if (!request.value) {
					processHype2(); // stop hype and clear old hype
				}
				pushSettingChange();
			} 
			
			if (request.setting == "showviewercount") {
				pushSettingChange();
			}
			
			if (request.setting == "waitlistmode") {
				initializeWaitlist();
			}
			
			if (request.setting == "pollEnabled") {
				initializePoll();
			}
			
			//if (request.setting == "ollamatts") {
			//	sendTargetP2P({settings:settings}, "bot");
			//}
			
			if (request.setting == "wordcloud") {
				setWordcloud(request.value);
			}

			if (request.setting == "customwaitlistmessagetoggle" || request.setting == "customwaitlistmessage" || request.setting == "customwaitlistcommand") {
				sendWaitlistConfig(null, true); // stop hype and clear old hype
			}

			if (request.setting == "translationlanguage") {
				changeLg(request.value);
			}

			if (request.setting.startsWith("timemessage")) {
				if (request.setting.startsWith("timemessageevent")) {
					var i = parseInt(request.setting.split("timemessageevent")[1]);
					if (i){
						if (!request.value) {
							// turn off
							if (intervalMessages[i]) {
								clearInterval(intervalMessages[i]);
								delete intervalMessages[i];
							}
						} else {
							checkIntervalState(i);
						}
					}
				} else {
					var i = 0;
					if (request.setting.startsWith("timemessageoffset")) {
						i = parseInt(request.setting.split("timemessageoffset")[1]);
					} else if (request.setting.startsWith("timemessagecommand")) {
						i = parseInt(request.setting.split("timemessagecommand")[1]);
					} else if (request.setting.startsWith("timemessageinterval")) {
						i = parseInt(request.setting.split("timemessageinterval")[1]);
					}
					if (i) {
						checkIntervalState(i);
					}
				}
			}

			if (isExtensionOn) {
				if (request.setting == "blacklistuserstoggle" || request.setting == "blacklistusers") {
					if (settings.blacklistusers && settings.blacklistuserstoggle) {
						settings.blacklistusers.textsetting.split(",").forEach(user => {
							user = user.trim();
							sendToDestinations({ delete: { chatname: user } });
						});
					}
				}
				// if ((request.setting == "viplistuserstoggle") || (request.setting == "viplistusers")){
				// if (settings.viplistusers && settings.viplistuserstoggle){
				// settings.viplistusers.textsetting.split(",").forEach(user=>{
				// user = user.trim();
				// sendToDestinations({"vipUser": {chatname:user}});
				// });
				// }
				// }
			}
		} else if ("inject" in request) {
			if (request.inject == "mobcrush") {
				chrome.webNavigation.getAllFrames({ tabId: sender.tab.id }, frames => {
					frames.forEach(f => {
						if (f.frameId && f.frameType === "sub_frame" && f.url.includes("https://www.mobcrush.com/")) {
							chrome.tabs.executeScript(sender.tab.id, {
								frameId: f.frameId,
								file: "mobcrush.js"
							});
						}
					});
				});
			}
			sendResponse({ state: isExtensionOn });
		} else if ("delete" in request) {
			sendResponse({ state: isExtensionOn });
			if (isExtensionOn && (request.delete.type || request.delete.chatname || request.delete.id)) {
				sendToDestinations({ delete: request.delete });
			}
		} else if ("message" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			var letsGo = await processIncomingMessage(request.message, sender);
			if (letsGo && letsGo.id){
				sendResponse({ state: isExtensionOn, id: letsGo.id });
			} else {
				sendResponse({ state: isExtensionOn});
			}
		} else if ("getBTTV" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			//console.log(JSON.stringify(request));
			sendResponse({ state: isExtensionOn });
			if (sender.tab.url) {
				var BTTV2 = await getBTTVEmotes(sender.tab.url, request.type, request.channel); // query my API to see if I can resolve the Channel avatar from the video ID
				if (BTTV2) {
					//console.log(sender);
					//console.log(BTTV2);
					chrome.tabs.sendMessage(sender.tab.id, { BTTV: BTTV2 }, function (response = false) {
						chrome.runtime.lastError;
					});
				}
			}
		} else if ("getSEVENTV" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			//console.log("getSEVENTV");
			sendResponse({ state: isExtensionOn });
			if (sender.tab.url) {
				var SEVENTV2 = await getSEVENTVEmotes(sender.tab.url, request.type, request.channel); // query my API to see if I can resolve the Channel avatar from the video ID
				if (SEVENTV2) {
					//	//console.logsender);
					//	//console.logSEVENTV2);
					chrome.tabs.sendMessage(sender.tab.id, { SEVENTV: SEVENTV2 }, function (response = false) {
						chrome.runtime.lastError;
					});
				}
			}
		} else if ("getFFZ" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			////console.log"getFFZ");
			sendResponse({ state: isExtensionOn });
			if (sender.tab.url) {
				var FFZ2 = await getFFZEmotes(sender.tab.url, request.type, request.channel); // query my API to see if I can resolve the Channel avatar from the video ID
				if (FFZ2) {
					//	//console.logsender);
					//	//console.logFFZ2);
					chrome.tabs.sendMessage(sender.tab.id, { FFZ: FFZ2 }, function (response = false) {
						chrome.runtime.lastError;
					});
				}
			}
		} else if ("getSettings" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			sendResponse({ state: isExtensionOn, streamID: streamID, password: password, settings: settings }); // respond to Youtube/Twitch/Facebook with the current state of the plugin; just as possible confirmation.
			try {
				priorityTabs.add(sender.tab.id);
			} catch (e) {
				console.error(e);
			}
		} else if ("pokeMe" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			sendResponse({ state: isExtensionOn }); // respond to Youtube/Twitch/Facebook with the current state of the plugin; just as possible confirmation.
			pokeSite(sender.tab.url, sender.tab.id);
		} else if ("keepAlive" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			var action = {};
			action.tid = sender.tab.id; // including the source (tab id) of the social media site the data was pulled from
			action.response = ""; // empty response, as we just want to keep alive
			//sendMessageToTabs(action);
			sendMessageToTabs(action, false, null, false, false, false);
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "tellajoke") {
			tellAJoke();
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "enableYouTube") {
			enableYouTube();
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "openchat") {
			openchat(request.value, true);
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "startgame") {
			//startgame(request.value, true);
			sendDataP2P({startgame:true}); 
			sendResponse({ state: isExtensionOn });	
		} else if (request.cmd && request.cmd === "singlesave") {
			sendResponse({ state: isExtensionOn });
			overwriteFile("setup");
		} else if (request.cmd && request.cmd === "excelsave") {
			sendResponse({ state: isExtensionOn });
			overwriteFileExcel("setup");
		} else if (request.cmd && request.cmd === "loadtickerfile") {
			sendResponse({ state: isExtensionOn });
			selectTickerFile();
		} else if (request.cmd && request.cmd === "savenames") {
			sendResponse({ state: isExtensionOn });
			overwriteSavedNames("setup");
		} else if (request.cmd && request.cmd === "savenamesStop") {
			sendResponse({ state: isExtensionOn });
			overwriteSavedNames("stop");
		} else if (request.cmd && request.cmd === "savenamesClear") {
			sendResponse({ state: isExtensionOn });
			overwriteSavedNames("clear");
		} else if (request.cmd && request.cmd === "loadmidi") {
			await loadmidi();
			sendResponse({ settings: settings, state: isExtensionOn });
		} else if (request.cmd && request.cmd === "export") {
			sendResponse({ state: isExtensionOn });
			await exportSettings();
		} else if (request.cmd && request.cmd === "import") {
			sendResponse({ state: isExtensionOn });
			await importSettings();
		} else if (request.cmd && request.cmd === "bigwipe") {
			sendResponse({ state: isExtensionOn });
			await resetSettings();
		} else if (request.cmd && request.cmd === "excelsaveStop") {
			sendResponse({ state: isExtensionOn });
			newFileHandleExcel = false;
		} else if (request.cmd && request.cmd === "singlesaveStop") {
			sendResponse({ state: isExtensionOn });
			newFileHandle = false;
		} else if (request.cmd && request.cmd === "selectwinner") {
			////console.logrequest);
			if ("value" in request) {
				resp = selectRandomWaitlist(parseInt(request.value) || 1);
			} else {
				resp = selectRandomWaitlist();
			}
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "resetwaitlist") {
			resetWaitlist();
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "stopentries") {
			toggleEntries(false);
			sendResponse({ state: isExtensionOn });	
		} else if (request.cmd && request.cmd === "removefromwaitlist") {
			removeWaitlist(parseInt(request.value) || 0);
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "highlightwaitlist") {
			highlightWaitlist(parseInt(request.value) || 0);
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "downloadwaitlist") {
			downloadWaitlist();
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "cleardock") {
			sendResponse({ state: isExtensionOn });
			var data = {};
			data.action = "clearAll";
			if (request.ctrl) {
				data.ctrl = true;
			}
			try {
				sendDataP2P(data);
			} catch (e) {
				console.error(e);
			}
		} else if (request.cmd && request.cmd === "uploadRAGfile") {
			sendResponse({ state: isExtensionOn });
			await importSettingsLLM(request.enhancedProcessing || false);
			try {
				messagePopup({documents: documentsRAG});
			} catch(e){}
		} else if (request.cmd && request.cmd === "clearRag") {
			sendResponse({ state: isExtensionOn });
			try {
				await clearLunrDatabase();
				messagePopup({documents: documentsRAG});
			} catch(e){}
		} else if (request.cmd === "deleteRAGfile") {
			try {
				await deleteDocument(request.docId);
				messagePopup({documents: documentsRAG});
			} catch(e){}
		} else if (request.cmd && request.cmd === "fakemsg") {
			sendResponse({ state: isExtensionOn });
			var data = {};
			data.chatname = "John Doe";
			data.nameColor = "";
			data.chatbadges = "";
			data.backgroundColor = "";
			data.textColor = "";
			data.chatmessage = "Looking good! 😘😘😊  This is a test message. 🎶🎵🎵🔨 ";
			data.chatimg = "";
			data.type = "youtube";
			if (Math.random() > 0.9) {
				data.hasDonation = "2500 gold";
				data.membership = "";
				data.chatname = "Bob";
				data.chatbadges = [];
				var html = {};
				html.html = '<svg viewBox="0 0 16 16" preserveAspectRatio="xMidYMid meet" focusable="false" class="style-scope yt-icon" style="pointer-events: none; display: block; width: 100%; height: 100%; fill: rgb(95, 132, 241);"><g class="style-scope yt-icon"><path d="M9.64589146,7.05569719 C9.83346524,6.562372 9.93617022,6.02722257 9.93617022,5.46808511 C9.93617022,3.00042984 7.93574038,1 5.46808511,1 C4.90894765,1 4.37379823,1.10270499 3.88047304,1.29027875 L6.95744681,4.36725249 L4.36725255,6.95744681 L1.29027875,3.88047305 C1.10270498,4.37379824 1,4.90894766 1,5.46808511 C1,7.93574038 3.00042984,9.93617022 5.46808511,9.93617022 C6.02722256,9.93617022 6.56237198,9.83346524 7.05569716,9.64589147 L12.4098057,15 L15,12.4098057 L9.64589146,7.05569719 Z" class="style-scope yt-icon"></path></g></svg>';
				html.type = "svg";
				data.chatbadges.push(html);
			} else if (Math.random() > 0.83 ){
				data.hasDonation = "3 hearts";
				data.membership = "";
				data.chatmessage = "";
				data.chatimg = parseInt(Math.random() * 2) ? "" : "https://static-cdn.jtvnw.net/jtv_user_pictures/52f459a5-7f13-4430-8684-b6b43d1e6bba-profile_image-50x50.png";
				data.chatname = "Lucy";
				data.type = "youtubeshorts";
			} else if (Math.random() > 0.7) {
				data.hasDonation = "";
				data.membership = "";
				data.chatimg = "https://static-cdn.jtvnw.net/jtv_user_pictures/52f459a5-7f13-4430-8684-b6b43d1e6bba-profile_image-50x50.png";
				data.chatname = "vdoninja";
				data.type = "twitch";
				data.event = "test";
				var score = parseInt(Math.random() * 378);
				data.chatmessage = jokes[score]["setup"] + "..  " + jokes[score]["punchline"] + " 😊";
			} else if (Math.random() > 0.6) {
				data.hasDonation = "";
				data.membership = "";
				data.chatimg = "https://socialstream.ninja/sampleavatar.png";
				data.chatname = "Steve";
				data.vip = true;
				var score = parseInt(Math.random() * 378);
				data.chatmessage = '<img src="https://github.com/steveseguin/social_stream/raw/main/icons/icon-128.png">😁 🇨🇦 https://vdo.ninja/';
			} else if (Math.random() > 0.5) {
				data.hasDonation = "";
				data.nameColor = "#107516";
				data.membership = "SPONSORSHIP";
				data.chatimg = parseInt(Math.random() * 2) ? "" : "https://socialstream.ninja/sampleavatar.png";
				data.chatname = "Steve_" + randomDigits();
				data.type = parseInt(Math.random() * 2) ? "slack" : "facebook";
				data.chatmessage = "!join The only way 2 do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle. As with all matters of the heart, you'll know when you find it.";
			} else if (Math.random() > 0.45) {
				data.hasDonation = "";
				data.highlightColor = "pink";
				data.nameColor = "lightblue";
				data.chatname = "NewGuest";
				data.type = "twitch";
				data.chatmessage = "hi";
				data.chatbadges = ["https://vdo.ninja/media/icon.png","https://yt4.ggpht.com/ytc/AL5GRJVWK__Edij5fA9Gh-aD7wSBCe_zZOI4jjZ1RQ=s32-c-k-c0x00ffffff-no-rj","https://socialstream.ninja/icons/announcement.png"];
			} else if (Math.random() > 0.40) {
				data.membership = "Coffee Addiction";
				data.hasDonation = "";
				data.subtitle = "32 Years";
				data.highlightColor = "pink";
				data.nameColor = "";
				data.private = true;
				data.chatname = "Sir Drinks-a-lot";
				data.type = "youtube";
				data.chatmessage = "☕☕☕ COFFEE!";
				data.chatbadges = ["https://socialstream.ninja/icons/bot.png","https://socialstream.ninja/icons/announcement.png"];
			} else if (Math.random() > 0.3) {
				data.hasDonation = "";
				data.membership = "";
				data.chatmessage = "";
				data.contentimg = "https://images-ext-1.discordapp.net/external/6FdtQ1kYY4futdm0dYQOld6yq-JbbtvNnQ_szqyW4sc/https/media.tenor.com/iVKEjb8t5fcAAAPo/cat-cat-kiss.mp4";
				data.chatname = "User123";
				data.chatimg = "https://yt4.ggpht.com/ytc/AL5GRJVWK__Edij5fA9Gh-aD7wSBCe_zZOI4jjZ1RQ=s32-c-k-c0x00ffffff-no-rj";
				data.type = "discord";
			} else if (Math.random() > 0.2) {
				data.hasDonation = "";
				data.membership = "";
				data.question = true;
				data.chatmessage = "Is this a test question?  🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓";
				data.chatname = "Nich Lass";
				data.chatimg = "https://yt4.ggpht.com/ytc/AL5GRJVWK__Edij5fA9Gh-aD7wSBCe_zZOI4jjZ1RQ=s32-c-k-c0x00ffffff-no-rj";
				data.type = "zoom";
			} else {
				data.hasDonation = "";
				data.membership = "SPONSORSHIP";
			}

			data = await applyBotActions(data); // perform any immediate (custom) actions, including modifying the message before sending it out
			if (!data) {
				return response;
			}
			sendToDestinations(data);
		} else if (request.cmd && request.cmd === "sidUpdated") {
			if (request.streamID) {
				streamID = request.streamID;
				
				streamID = validateRoomId(streamID);
				if (!streamID){
					try {
						chrome.notifications.create({
							type: "basic",
							iconUrl: "./icons/icon-128.png",
							title: "Invalid session ID",
							message: "Your session ID is invalid.\n\nPlease correct it to continue"
						});
						throw new Error('Invalid session ID');
					} catch (e) {
						console.error(e);
						throw new Error('Invalid session ID');
					}
				}
				
				if (isSSAPP) {
					if (chrome && chrome.storage && chrome.storage.sync && chrome.storage.sync.set) {
						chrome.storage.sync.set({
							streamID: streamID || ""
						});
					}
				}
			}
			if ("password" in request) {
				password = request.password;
				if (isSSAPP) {
					if (chrome && chrome.storage && chrome.storage.sync && chrome.storage.sync.set) {
						chrome.storage.sync.set({
							password: password || ""
						});
					}
				}
			}

			if ("state" in request) {
				isExtensionOn = request.state;
			}
			if (iframe) {
				if (iframe.src) {
					iframe.src = null;
				}

				iframe.remove();
				iframe = null;
			}
			if (isExtensionOn) {
				loadIframe(streamID, password);
			}
			
			if (isSSAPP){
				sendResponse({ state: isExtensionOn});
			} else {
				sendResponse({ state: isExtensionOn, streamID: streamID, password: password });
			}
			
		} else if (request.cmd && (request.cmd === 'uploadBadwords')) {
			localStorage.setItem('customBadwords', request.data);
			try {
				let customBadWordsList = request.data.split(/\r?\n|\r|\n/g);
				customBadWordsList = generateVariationsList(customBadWordsList);
				profanityHashTable = createProfanityHashTable(customBadWordsList);
				sendResponse({success: true, state: isExtensionOn });
			} catch(e){
				sendResponse({success: false, state: isExtensionOn });
			}
		} else if (request.cmd && (request.cmd === 'deleteBadwords')) {
			localStorage.removeItem('customBadwords');
			initialLoadBadWords();
			sendResponse({success: true, state: isExtensionOn });
		} else if (request.cmd && request.target){
			sendResponse({ state: isExtensionOn });
			sendTargetP2P(request, request.target);
		} else {
			sendResponse({ state: isExtensionOn });
		}
	} catch (e) {
		console.warn(e);
	}
	return response;
});

const randomDigits = () => {
  const length = Math.floor(Math.random() * 21) + 5;
  const firstDigit = Math.floor(Math.random() * 9) + 1;
  const remainingDigits = Array(length - 1).fill().map(() => Math.floor(Math.random() * 10));
  return parseInt([firstDigit, ...remainingDigits].join(''));
};

function verifyOriginalNewIncomingMessage(msg, cleaned=false) {
	
	if (Date.now() - lastSentTimestamp > 5000) {
		// 2 seconds has passed; assume good.
		return true;
	}
	
	// //console.logmsg,lastSentMessage);
	
	try {
		if (!cleaned){
			msg = decodeAndCleanHtml(msg);
		}
		
		var score = fastMessageSimilarity(msg, lastSentMessage);
		// //console.logmsg, score);
		if (score > 0.5) { // same message
			
			lastMessageCounter += 1;
			if (lastMessageCounter>1) {
				// //console.log"1");
				return false;
			}
			if (settings.hideallreplies){
				// //console.log"2");
				return false;
			}
		}
	} catch(e){
		errorlog(e);
	}
		
	return true;
	
}

function fastMessageSimilarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;

    const normalize = str => str
        .toLowerCase()
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/\s+/g, '')
        .trim();

    const normA = normalize(a);
    const normB = normalize(b);
    
    // Handle exact match after normalization
    if (normA === normB) return 1;
    
    const maxLen = Math.max(normA.length, normB.length);
    const minLen = Math.min(normA.length, normB.length);
    
    // Check if one is prefix of the other
    const shorter = normA.length < normB.length ? normA : normB;
    const longer = normA.length < normB.length ? normB : normA;
    
    // For messages > 50 chars, if one is a prefix of the other
    // and covers at least 90% of the shorter message, consider it similar
    if (maxLen > 50 && longer.startsWith(shorter) && minLen / maxLen > 0.9) {
        return 0.95;
    }

    // For very short strings
    if (maxLen < 10) {
        const matched = [...normA].filter(char => normB.includes(char)).length;
        return matched / maxLen;
    }

    // Compute similarity based on character matches for position-sensitive comparison
    let matches = 0;
    const compareLen = Math.min(normA.length, normB.length);
    
    for (let i = 0; i < compareLen; i++) {
        if (normA[i] === normB[i]) matches++;
    }

    return matches / maxLen;
}

function ajax(object2send, url, ajaxType = "PUT", type = "application/json; charset=utf-8") {
	try {
		if (ajaxType == "PUT" && putNode) {
			putNode(url, object2send, (headers = { "Content-Type": type }));
		} else if (ajaxType == "POST" && postNode) {
			postNode(url, object2send, (headers = { "Content-Type": type }));
		} else {
			var xhttp = new XMLHttpRequest();
			xhttp.onreadystatechange = function () {
				if (this.readyState == 4 && this.status == 200) {
					// success
				} else {
				}
			};
			xhttp.open(ajaxType, url, true); // async = true
			xhttp.setRequestHeader("Content-Type", type);
			xhttp.send(JSON.stringify(object2send));
		}
	} catch (e) {}
}

const metaDataStore = new Map(); // Using Map instead of {} for better cleanup
let cleanUpLastTabs;

async function sendToDestinations(message) {
	if (typeof message == "object") {
		
		if (message.chatname) {
			message.chatname = filterXSS(message.chatname); // I do escapeHtml at the point of capture instead
		}

		if (message.chatmessage) {
			if (!message.textonly) {
				if (settings.bttv) {
					if (!Globalbttv) {
						await getBTTVEmotes();
					}
					if (Globalbttv) {
						message.chatmessage = replaceEmotesWithImages(message.chatmessage, Globalbttv);
					}
				}
				if (settings.seventv) {
					if (!Globalseventv) {
						await getSEVENTVEmotes();
					}
					if (Globalseventv) {
						message.chatmessage = replaceEmotesWithImages(message.chatmessage, Globalseventv, true);
					}
				}
				if (settings.ffz) {
					if (!Globalffz) {
						await getFFZEmotes();
					}
					if (Globalffz) {
						message.chatmessage = replaceEmotesWithImages(message.chatmessage, Globalffz, true);
					}
				}
				message.chatmessage = filterXSS(message.chatmessage);
			} //else {
			// replaceEmotesWithImagesText( ...  ); // maybe someday
			//}
		}
		
		
		if (settings.pronouns && (message.type == "twitch") && message.chatname) {
			let pronoun = await getPronounsNames(message.chatname);
			if (!Pronouns && pronoun){
				await getPronouns();
			}
			if (Pronouns && pronoun && pronoun.pronoun_id){
				if (pronoun.pronoun_id in Pronouns){
					if (!message.chatbadges){
						message.chatbadges = [];
					}
					var bage = {};
					bage.text = Pronouns[pronoun.pronoun_id];
					bage.type = "text";
					bage.bgcolor = "#000";
					bage.color = "#FFF";
					message.chatbadges.push(bage);
				}
			}
		}
		

		if (settings.randomcolor && message && !message.nameColor && message.chatname) {
			message.nameColor = getColorFromName(message.chatname);
		} else if (settings.randomcolorall && message && message.chatname) {
			message.nameColor = getColorFromName(message.chatname);
		} else if (settings.colorofsource && message && message.chatname) {
			message.nameColor = getColorFromType(message.type);
		}
		if (message.nameColor && settings.lightencolorname){
			message.nameColor = adjustColorForOverlay(message.nameColor)
		}

		if (settings.filtereventstoggle && settings.filterevents && settings.filterevents.textsetting && message.chatmessage && message.event) {
			if (settings.filterevents.textsetting.split(",").some(v => (v.trim() && message.chatmessage.includes(v)))) {
				return false;
			}
		}
		
		if (message.event && message.tid && ("meta" in message)) {
			if (["viewer_update", "follower_update"].includes(message.event)){
				let tabData = metaDataStore.get(message.tid);
				if (!tabData) {
					tabData = {};
					metaDataStore.set(message.tid, tabData);
				}
				
				tabData[message.event] = message;
				
				if (!cleanUpLastTabs) {
					cleanUpLastTabs = setTimeout(() => {
						cleanUpLastTabs = null;
						chrome.tabs.query({}, (tabs) => {
							const activeTabIds = new Set(
								tabs
									.map(tab => tab.id)
									.filter(Boolean)
							);

							// Cleanup closed tabs
							for (const [tabId] of metaDataStore) {
								if (!activeTabIds.has(tabId)) {
									metaDataStore.delete(tabId);
								}
							}
						});
					}, 600000); 
				}
				
				if (settings.hypemode){
					sendTargetP2P(message, "hype");
				}
			
				try {
					sendDataP2P(message); 
				} catch (e) {
					console.error(e);
				}
				return true;
			}
		}
	}
	
	try {
		sendDataP2P(message); 
	} catch (e) {
		console.error(e);
	}
	try {
		if (settings.pollEnabled){
			sendTargetP2P(message, "poll");
		}
	} catch (e) {
		console.error(e);
	}
	
	try {
		if (settings.wordcloud){
			sendTargetP2P(message, "wordcloud");
		}
	} catch (e) {
		console.error(e);
	}
	
	try {
		if (settings.enableCustomGifCommands && settings["customGifCommands"]){
			// settings.enableCustomGifCommands.object = JSON.stringify([{command,url},{command,url},{command,url})
			settings["customGifCommands"]["object"].forEach(values=>{
				if (message && message.chatmessage && values.url && values.command && (message.chatmessage.split(" ")[0] === values.command)){
					//  || "https://picsum.photos/1280/720?random="+values.command
					sendTargetP2P({...message,...{contentimg: values.url}}, "gif"); // overwrite any existing contentimg. leave the rest of the meta data tho
				}
			});
		}
	} catch (e) {
		console.error(e);
	}

	sendToDisk(message);
	sendToH2R(message);
	sendToPost(message);
	sendToDiscord(message);  // donos only
	sendToStreamerBot(message);
	if (message.chatmessage || message.hasDonation || message.chatname){
		message.idx = await addMessageDB(message);
	}
	return true;
}

async function replayMessagesFromTimestamp(startTimestamp) {
    const db = await messageStoreDB.ensureDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([messageStoreDB.storeName], "readonly");
        const store = transaction.objectStore(messageStoreDB.storeName);
        const index = store.index("timestamp");
        const messages = [];
        
        const range = IDBKeyRange.lowerBound(startTimestamp);
        const cursorRequest = index.openCursor(range);
        
        cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                messages.push(cursor.value);
                cursor.continue();
            } else {
                if (messages.length === 0) {
                    resolve(0);
                    return;
                }

                messages.sort((a, b) => a.timestamp - b.timestamp);
                const baseTime = messages[0].timestamp;

                messages.forEach(message => {
					
                    const relativeDelay = message.timestamp - baseTime;
					delete message.mid; // only found in messages restored from db.
					
                    setTimeout(() => {
                        sendDataP2P(message);
                    }, relativeDelay);
                });

                resolve(messages.length);
            }
        };
        
        cursorRequest.onerror = (event) => reject(event.target.error);
    });
}


function unescapeHtml(safe) {
	return safe
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'");
}

function escapeHtml(unsafe) {
	try {
		return unsafe.replace(/[&<>"']/g, function(m) {
			return {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#039;'
			}[m];
		}) || "";
	} catch (e) {
		return "";
	}
}

function sendToH2R(data) {
	if (settings.h2r && settings.h2rserver && settings.h2rserver.textsetting) {
		try {
			var postServer = "http://127.0.0.1:4001/data/";

			if (settings.h2rserver.textsetting.startsWith("http")) {
				// full URL provided
				postServer = settings.h2rserver.textsetting;
			} else if (settings.h2rserver.textsetting.startsWith("127.0.0.1")) {
				// missing the HTTP, so assume what they mean
				postServer = "http://" + settings.h2rserver.textsetting;
			} else {
				postServer += settings.h2rserver.textsetting; // Just going to assume they gave the token
			}

			var msg = {};

			if ("id" in data) {
				msg.id = data.id;
			}

			if (data.timestamp) {
				msg.timestamp = data.timestamp;
			}

			if (!data.textonly) {
				data.chatmessage = unescapeHtml(data.chatmessage);
			}

			msg.snippet = {};
			msg.snippet.displayMessage = data.chatmessage.replace(/(<([^>]+)>)/gi, "") || "";

			if (!msg.snippet.displayMessage) {
				return;
			}

			msg.authorDetails = {};
			msg.authorDetails.displayName = data.chatname || "";

			if (data.type && (data.type == "twitch") && !data.chatimg && data.chatname) {
				msg.authorDetails.profileImageUrl = "https://api.socialstream.ninja/twitch/large?username=" + encodeURIComponent(data.chatname); // 150x150
			} else if (data.type && ((data.type == "youtube") || (data.type == "youtubeshorts")) && data.chatimg) {
				let chatimg = data.chatimg.replace("=s32-", "=s256-");
				msg.authorDetails.profileImageUrl = chatimg.replace("=s64-", "=s256-");
			} else {
				msg.authorDetails.profileImageUrl = data.chatimg || "https://socialstream.ninja/sources/images/unknown.png";
			}

			if (data.type && data.sourceImg && data.type == "restream") {
				msg.platform = {};
				msg.platform.name = data.type || "";
				if (data.sourceImg === "restream.png") {
					msg.platform.logoUrl = "https://socialstream.ninja/sources/images/" + data.sourceImg;
				} else {
					msg.platform.logoUrl = data.sourceImg;
				}
			} else if (data.type) {
				msg.platform = {};
				msg.platform.name = data.type || "";
				msg.platform.logoUrl = "https://socialstream.ninja/sources/images/" + data.type + ".png";
			}

			var h2r = {};
			h2r.messages = [];
			h2r.messages.push(msg);
			ajax(h2r, postServer, "POST");
		} catch (e) {
			console.warn(e);
		}
	}
}


function sanitizeRelay(text, textonly=false, alt = false) {
	if (!text.trim()) {
		return text;
	}
	if (!textonly){
		// convert to text from html if not text only mode
		var textArea = document.createElement('textarea');
		textArea.innerHTML = text;
		text = textArea.value;
	}
	
	text = text.replace(/(<([^>]+)>)/gi, "");
	text = text.replace(/[!#@]/g, "");
	text = text.replace(/cheer\d+/gi, " ");
	text = text.replace(/\.(?=\S(?!$))/g, " ");
	
	if (!text.trim() && alt) {
		return alt;
	}
	return text;
}

const messageStore = {};
function checkExactDuplicateAlreadyRelayed(msg, sanitized=true, tabid=false, save=true) { // FOR RELAY PURPOSES ONLY.

	const now = Date.now();
	if (!save){
		if (now - lastSentTimestamp > 10000) { // 10 seconds has passed; assume good.
			return false;
		}
	}
	
	if (!sanitized){
		var textArea = document.createElement('textarea');
		textArea.innerHTML = msg;
		msg = textArea.value.replace(/\s\s+/g, " ").trim();
	} else {
		msg = msg.replace(/<\/?[^>]+(>|$)/g, ""); // clean up; remove HTML tags, etc.
		msg = msg.replace(/\s\s+/g, " ").trim();
	}
	
	if (save){
		return msg;
	}
	
	if (!msg || !tabid) {
		return false;
	}
	
	if (!messageStore[tabid]){
		return false;
	}
	
    while (messageStore[tabid].length > 0 && now - messageStore[tabid][0].timestamp > 10000) {
        messageStore[tabid].shift();
    }
	
	return messageStore[tabid].some(entry => entry.message === msg && entry.relayMode);
}

// settings.firstsourceonly || settings.hideallreplies


var alreadyCaptured = [];
function checkExactDuplicateAlreadyReceived(msg, sanitized=true, tabid=false, type=null) { // FOR RELAY PURPOSES ONLY.
	const now = Date.now();
	if (now - lastSentTimestamp > 10000) {// 10 seconds has passed; assume good.
		return false;
	}

	if (!sanitized){
		var textArea = document.createElement('textarea');
		textArea.innerHTML = msg;
		msg = textArea.value.replace(/\s\s+/g, " ").trim();
	} else {
		msg = msg.replace(/<\/?[^>]+(>|$)/g, ""); // clean up; remove HTML tags, etc.
		msg = msg.replace(/\s\s+/g, " ").trim();
	}
	
	if (!msg || !tabid) {
		return false;
	}
	
	if (!messageStore[tabid]){
		return false;
	}
	
	if (settings.thissourceonly && !settings.hideallreplies){
		for (var mm in alreadyCaptured){
			if (now - alreadyCaptured[mm] > 10000){
				delete alreadyCaptured[mm];
			}
		}
		while (messageStore[tabid].length > 0 && (now - messageStore[tabid][0].timestamp > 10000)) {
			messageStore[tabid].shift();
		}
		if (messageStore[tabid].some(entry => entry.message === msg)){
			if (alreadyCaptured[msg]){
				return true;
			} else if (type && (settings.thissourceonlytype && type === (settings.thissourceonlytype.optionsetting)) || (!settings.thissourceonlytype && type === "twitch")){ // twitch is the default
				alreadyCaptured[msg] = now;
				return null;
			} else {
				return true;
			}
		} else {
			return false;
		}
	} else if (settings.firstsourceonly && !settings.hideallreplies){
		for (var mm in alreadyCaptured){
			if (now - alreadyCaptured[mm] > 10000){
				delete alreadyCaptured[mm];
			}
		}
		while (messageStore[tabid].length > 0 && (now - messageStore[tabid][0].timestamp > 10000)) {
			messageStore[tabid].shift();
		}
		if (messageStore[tabid].some(entry => entry.message === msg)){
			if (alreadyCaptured[msg]){
				return true;
			}
			alreadyCaptured[msg] = now;
			return null; // null !== false
		} else {
			return false;
		}
	}
	
    while (messageStore[tabid].length > 0 && now - messageStore[tabid][0].timestamp > 10000) {
        messageStore[tabid].shift();
    }
	return messageStore[tabid].some(entry => entry.message === msg);
}

function sendToS10(data, fakechat=false, relayed=false) {
	//console.log"sendToS10",data);
	if (settings.s10 && settings.s10apikey && settings.s10apikey.textsetting) {
		try {
			// msg =  '{
				// "userId": "my-external-id",
				// "displayName": "Tyler",
				// "messageBody": "Testing 123",
				// "sourceName": "twitch",
				// "sourceIconUrl": "https://cdn.shopify.com/app-store/listing_images/715abff73d9178aa7f665d7feadf7edf/icon/CPTw1Y2Mp4UDEAE=.png"
			// }';
			
			if (data.type && data.type === "stageten") {
				return;
			}
			
			if (data.chatmessage.includes(miscTranslations.said)){
				return null;
			}

			let cleaned = data.chatmessage;
			if (data.textonly){
				cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, ""); // keep a cleaned copy
				cleaned = cleaned.replace(/\s\s+/g, " "); 
			} else {
				cleaned = decodeAndCleanHtml(cleaned);
			}
			if (!cleaned){
				return;
			}
			
			if (relayed && !verifyOriginalNewIncomingMessage(cleaned, true)){
				if (data.bot) {
					return null;
				}
				////console.log".");
				// checkExactDuplicateAlreadyRelayed(msg, sanitized=true, tabid=false, save=true) 
				if (checkExactDuplicateAlreadyRelayed(cleaned, data.textonly, data.tid, false)){
					////console.log"--");
					return;
				}
			} else if (!fakechat && checkExactDuplicateAlreadyRelayed(cleaned, data.textonly, data.tid, false)){
				return null;
			}
			
			if (fakechat){
				lastSentMessage = cleaned; 
				lastSentTimestamp = Date.now();
				lastMessageCounter = 0;
			}
			
			let botname = "🤖💬";
			if (settings.ollamabotname && settings.ollamabotname.textsetting){
				botname = settings.ollamabotname.textsetting.trim();
			}
			
			let username = "";
			let isBot = false;
			if (!settings.noollamabotname && cleaned.startsWith(botname+":")){
				cleaned = cleaned.replace(botname+":","").trim();
				username = botname;
				isBot = true;
			}
			
			var msg = {};
			msg.sourceName = data.type || "stageten";
			msg.sourceIconUrl = "https://socialstream.ninja/sources/images/"+msg.sourceName+".png";
			msg.displayName = username || data.chatname || data.userid || "Host⚡";
			msg.userId = "socialstream";
			msg.messageBody = cleaned;
			
			if (isBot){
				msg.sourceIconUrl = "https://socialstream.ninja/icons/bot.png";
			}
			
			if (false){ // this is a backup, just in case.
				if (data.type == "stageten"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/stageten_200x200.png";
				}
				if (data.type == "youtube"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/youtube_200x200.png";
				}
				if (data.type == "youtubeshorts"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/youtubeshorts_200x200.png";
				}
				if (data.type == "twitch"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/twitch_200x200.png";
				}
				if (data.type == "twitch"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/twitch_200x200.png";
				}
				if (data.type == "socialstream"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/socialstream_200x200.png";
				}
				if (data.type == "twitch"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/twitch_200x200.png";
				}
			}
			
			// console.error(msg, fakechat);
			try {
				let xhr = new XMLHttpRequest();
				xhr.open("POST", "https://demo.stageten.tv/apis/plugin-service/chat/message/send");
				xhr.setRequestHeader("content-type", "application/json");
				xhr.setRequestHeader("x-s10-chat-api-key", settings.s10apikey.textsetting);
				//xhr.withCredentials = true;
				xhr.onload = function () {
					//log(xhr.response);
				};
				xhr.onerror = function (e) {
					//log("error sending to stageten");
				};
				xhr.send(JSON.stringify(msg));
			} catch(e){}
			
			try {
				let xhr2 = new XMLHttpRequest();
				xhr2.open("POST", "https://app.stageten.tv/apis/plugin-service/chat/message/send");
				xhr2.setRequestHeader("content-type", "application/json");
				xhr2.setRequestHeader("x-s10-chat-api-key", settings.s10apikey.textsetting);
				xhr2.onload = function () {
					//log(xhr2.response);
				};
				xhr2.onerror = function (e) {
					//log("error sending to stageten");
				};
				xhr2.send(JSON.stringify(msg));
			} catch(e){}
			
		} catch (e) {
			console.warn(e);
		}
	}
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function sendToStreamerBot(data, fakechat = false, relayed = false) {
    // Ensure Streamer.bot integration is enabled in settings
    if (!settings.streamerbot) {
        // console.log("Streamer.bot integration disabled or endpoint URL not set.");
        return;
    }

    try {
        // --- Existing Pre-Checks (Assuming these functions exist elsewhere) ---
        if (data.type && data.type === "streamerbot") {
            // console.log("Avoiding loopback to Streamer.bot");
            return; // Avoid potential loops if Streamer.bot itself sent a message
        }

        let cleaned = data.chatmessage || "";
        if (typeof cleaned !== 'string') {
             cleaned = String(cleaned); // Ensure it's a string
        }

        // --- Existing Message Cleaning (Assuming these functions exist elsewhere) ---
        if (data.textonly) {
            cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, ""); // Strip HTML tags
            cleaned = cleaned.replace(/\s\s+/g, " "); // Collapse whitespace
        } else {
             // Assume decodeAndCleanHtml exists and returns a string
            cleaned = typeof decodeAndCleanHtml === 'function' ? decodeAndCleanHtml(cleaned) : cleaned;
        }

        if (!cleaned.trim() && !data.hasDonation) {
             // console.log("Skipping empty message after cleaning.");
            return; // Don't send empty messages
        }

        // --- Existing Duplicate Handling (Assuming these functions exist elsewhere) ---
        if (relayed && typeof verifyOriginalNewIncomingMessage === 'function' && !verifyOriginalNewIncomingMessage(cleaned, true)) {
            if (data.bot) {
                // console.log("Skipping relayed bot message.");
                return;
            }
            if (typeof checkExactDuplicateAlreadyRelayed === 'function' && checkExactDuplicateAlreadyRelayed(cleaned, data.textonly, data.tid, false)) {
                // console.log("Skipping already relayed duplicate message.");
                return;
            }
        } else if (!fakechat && typeof checkExactDuplicateAlreadyRelayed === 'function' && checkExactDuplicateAlreadyRelayed(cleaned, data.textonly, data.tid, false)) {
            // console.log("Skipping non-fake duplicate message.");
            return;
        }

        // --- Existing Bot Handling ---
        let botname = "🤖💬";
        if (settings.ollamabotname?.textsetting) {
            botname = settings.ollamabotname.textsetting.trim();
        }

        let derivedUsername = data.chatname || data.userid || "UnknownUser"; // Start with original name
        let isBot = data.bot || false; // Use original bot flag if available
        if (!settings.noollamabotname && cleaned.startsWith(botname + ":")) {
            cleaned = cleaned.replace(botname + ":", "").trim();
            derivedUsername = botname; // Override username if bot prefix matches
            isBot = true; // Mark as bot if prefix matches
        }

        // --- Construct Payload for Streamer.bot ---
        // Map your 'data' fields to keys that will appear in Streamer.bot's '%args%'
        const payload = {
            // Core chat info
            userName: derivedUsername,
            userId: data.userid || null, // Send null if not available
            displayName: data.chatname || derivedUsername, // Often same as userName, but can differ
            message: cleaned,
            platform: data.type || "socialstream", // Your 'type' field
            userAvatarUrl: data.chatimg || null, // Your 'chatimg'
            platformImageUrl: data.sourceImg || `https://socialstream.ninja/sources/images/${data.type || 'socialstream'}.png`, // Your 'sourceImg' or default

            // Flags & Status
            isModerator: data.moderator || false,
            isAdmin: data.admin || false, // Your 'admin' field
            isBot: isBot, // Use the derived bot status
            isQuestion: data.question || false, // Your 'question' field
            isPrivate: data.private || false, // Your 'private' field
            isTextOnly: data.textonly || false, // Your 'textonly' field

            // Event & Donation related
            isEvent: data.event || false, // Treat boolean true as a generic event, or use the string type
            eventType: typeof data.event === 'string' ? data.event : null, // Specific event type if string
            donationAmount: data.hasDonation || null, // Your 'hasDonation' field
            membershipInfo: data.membership || null, // Your 'membership' field
            eventTitle: data.title || null, // Your 'title' field (e.g., CHEERS)
            eventSubtitle: data.subtitle || null, // Your 'subtitle' (e.g., months)
            contentImageUrl: data.contentimg || null, // Your 'contentimg'

            // Metadata & Custom
            badges: data.chatbadges || [], // Send as array
            karmaScore: data.karma !== undefined ? parseFloat(data.karma) : null, // Your 'karma', ensure float
            internalMsgId: data.id !== undefined ? parseInt(data.id) : null, // Your 'id', ensure int
            nameColor: data.nameColor || null,
            textColor: data.textColor || null,
            backgroundColor: data.backgroundColor || null,

            // Include the original raw data object if needed for complex logic in Streamer.bot
            originalRawData: data // Consider JSON.stringify(data) if SB has issues with nested objects
        };

        // --- Send to Streamer.bot ---
        const endpointUrl = settings.streamerbotEndpointUrl?.textsetting || "http://127.0.0.1:8080/socialstream/chat";

        // Use fetch API for the POST request
        fetch(endpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add Authentication header if you configured it in Streamer.bot
                // 'Authorization': 'Basic ' + btoa('username:password') // Example for Basic Auth
            },
            body: JSON.stringify({ args: payload }) // *** IMPORTANT: Wrap the payload in an 'args' object ***
                                                   // This ensures it matches how Streamer.bot expects data
                                                   // for custom HTTP endpoints to populate the %args% dictionary.
        })
        .then(response => {
            if (!response.ok) {
                 // Log more detailed error for debugging
                console.warn(`Error sending to Streamer.bot: ${response.status} ${response.statusText}`);
                 return response.text().then(text => { console.warn("Response body:", text); }); // Log response body if possible
            } else {
                // console.log("Successfully sent message to Streamer.bot."); // Optional success log
                return response.json().catch(() => {}); // Attempt to parse JSON, ignore if no body/not JSON
            }
        })
        // .then(responseData => {
        //     if (responseData) {
        //          console.log("Streamer.bot response:", responseData); // Optional: log response if needed
        //     }
        // })
        .catch(error => {
            console.error("Network or other error sending to Streamer.bot:", error);
        });

        // --- Existing Fake Chat Handling ---
         if (fakechat && typeof setLastSentMessage === 'function') { // Assuming setLastSentMessage exists
             setLastSentMessage(cleaned);
         }

    } catch (e) {
        console.error("Error within sendToStreamerBot function:", e);
    }
}


function sendAllToDiscord(data) {
	
    if (!settings.postalldiscord || !settings.postallserverdiscord) {
        return;
    }
	if (!data.chatmessage){
		return;
	}

    try {
        let postServerDiscord = normalizeWebhookUrl(settings.postallserverdiscord.textsetting);
        
        const avatarUrl = validateImageUrl(data.chatimg);
        
        const payload = {
            username: (data.chatname || "Unknown") + " @ "+capitalizeFirstLetter(data.type), // Custom webhook name
            avatar_url: avatarUrl || "https://socialstream.ninja/unknown.png", 
            embeds: [{
                description: decodeAndCleanHtml(data.chatmessage||""),
                color: 0xFFFFFF, // Green color for donations
                timestamp: new Date().toISOString(),
                thumbnail: {
                    url: data.type ? `https://socialstream.ninja/sources/images/${data.type}.png` : null
                },
                fields: []
            }]
        };
        fetch(postServerDiscord, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        }).catch(error => console.warn('Discord webhook error:', error));

    } catch (e) {
        console.warn('Error sending Discord webhook:', e);
    }
}
function sendToDiscord(data) {
	
	sendAllToDiscord(data); // << generic
	//.. donations only .. vv
	
    if (!settings.postdiscord || !settings.postserverdiscord) {
        return;
    }
	if (!data.hasDonation && !data.donation){
		return;
	}
	console.log(data);
    try {
        let postServerDiscord = normalizeWebhookUrl(settings.postserverdiscord.textsetting);
        
        const avatarUrl = validateImageUrl(data.chatimg);
        
        const payload = {
            username: "Donation Alert", // Custom webhook name
            avatar_url: "https://socialstream.ninja/icons/bot.png", 
            embeds: [{
                title: formatTitle(data),
                description: formatDescription(data),
                color: 0x00ff00, // Green color for donations
                timestamp: new Date().toISOString(),
                thumbnail: {
                    url: data.type ? `https://socialstream.ninja/sources/images/${data.type}.png` : null
                },
                author: {
                    name: data.chatname,
                    icon_url: avatarUrl || undefined
                },
                fields: buildFields(data)
            }]
        };
        fetch(postServerDiscord, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        }).catch(error => console.warn('Discord webhook error:', error));

    } catch (e) {
        console.warn('Error sending Discord webhook:', e);
    }
}
function normalizeWebhookUrl(url) {
    if (!url) return null;
    
    if (url.startsWith("http")) {
        return url;
    } else if (url.startsWith("127.0.0.1")) {
        return "http://" + url;
    }
    return "https://" + url;
}

function validateImageUrl(url) {
    if (!url) return null;
    
    // Reject data URLs
    if (url.startsWith('data:')) return null;
    
    // Allowed image domains
    const allowedDomains = [
        // Original domains
        'cdn.discordapp.com',
        'i.imgur.com',
        'socialstream.ninja',
        'static-cdn.jtvnw.net', // Twitch CDN
        
        // YouTube domains
        'yt3.ggpht.com',        // YouTube profile pictures
        'i.ytimg.com',          // YouTube thumbnails
        'img.youtube.com',
        
        // Facebook domains
        'scontent.xx.fbcdn.net',    // Facebook CDN
        'platform-lookaside.fbsbx.com',
        'graph.facebook.com',
        
        // Google domains
        'lh3.googleusercontent.com', // Google user content (including profile pictures)
        'storage.googleapis.com',
		
		// socialstream
		'socialstream.ninja',
        
        // Kick domains
        'files.kick.com',
        'images.kick.com',
        'stream.kick.com'
    ];
    
    try {
        const urlObj = new URL(url);
        if (allowedDomains.some(domain => urlObj.hostname.endsWith(domain))) {
            return url;
        }
    } catch (e) {
        return null;
    }
    
    return null;
}
function formatTitle(data, type="donation") {
    if (data.title) {
        return data.title;
    }
    return `New ${type} from ${(data.type.charAt(0).toUpperCase() + data.type.slice(1)) || 'unknown'}!`;
}
function formatDescription(data) {
    let description = '';
    
    if (data.chatmessage) { 
        if (!data.textonly) {
            // Convert HTML to plain text
            description += `>>> ${decodeAndCleanHtml(data.chatmessage)}\n\n`;
        } else {
            description += `>>> ${data.chatmessage.trim()}\n\n`;
        }
    }
    
    return description || undefined;
}

function buildFields(data) {
    const fields = [];
    
    if (data.hasDonation || data.donation) {
        fields.push({
            name: '💰 Donation Amount',
            value: data.hasDonation || data.donation,
            inline: true
        });
    }
    
    if (data.membership) {
        fields.push({
            name: '🌟 Membership',
            value: data.membership,
            inline: true
        });
    }
    
    if (data.subtitle) {
        fields.push({
            name: '📝 Details',
            value: data.subtitle,
            inline: true
        });
    }
    
    return fields;
}

function sendToPost(data) {
	if (settings.post) {
		try {
			var postServer = "http://127.0.0.1:80";

			if (settings.postserver && settings.postserver.textsetting && settings.postserver.textsetting.startsWith("http")) {
				// full URL provided
				postServer = settings.postserver.textsetting;
			} else if (settings.postserver && settings.postserver.textsetting && settings.postserver.textsetting.startsWith("127.0.0.1")) {
				// missing the HTTP, so assume what they mean
				postServer = "http://" + settings.postserver.textsetting;
			} else if (settings.postserver && settings.postserver.textsetting && settings.postserver.textsetting){
				postServer = "https://"+settings.postserver.textsetting; // Just going to assume they meant https
			}

			if (data.type && !data.chatimg && (data.type == "twitch") && data.chatname) {
				data.chatimg = "https://api.socialstream.ninja/twitch/large?username=" + encodeURIComponent(data.chatname); // 150x150
			} else if (data.type && ((data.type == "youtube") || (data.type == "youtubeshorts")) && data.chatimg) {
				let chatimg = data.chatimg.replace("=s32-", "=s256-");
				data.chatimg = chatimg.replace("=s64-", "=s256-");
			} else {
				data.chatimg = data.chatimg || "https://socialstream.ninja/sources/images/unknown.png";
			}

			if (data.type) {
				data.logo = "https://socialstream.ninja/sources/images/" + data.type + ".png";
			}

			ajax(data, postServer, "POST");
		} catch (e) {
			console.warn(e);
		}
	}
}

var socketserverDock = false;
var serverURLDock = urlParams.has("localserver") ? "ws://127.0.0.1:3000" : "wss://io.socialstream.ninja/dock";
var conConDock = 0; 
var reconnectionTimeoutDock = null;

function setupSocketDock() {
	if (!settings.server2 && !settings.server3) {
		return;
	} else if (!isExtensionOn) {
		return;
	}
	
	if (reconnectionTimeoutDock) {
		clearTimeout(reconnectionTimeoutDock);
		reconnectionTimeoutDock = null;
	}

	if (socketserverDock) {
		socketserverDock.onclose = null;
		socketserverDock.close();
		socketserverDock = null;
	}

	socketserverDock = new WebSocket(serverURLDock);

	socketserverDock.onerror = function (error) {
		console.error("WebSocket error:", error);
		socketserverDock.close();
	};

	socketserverDock.onclose = function () {
		if ((settings.server2 || settings.server3) && isExtensionOn) {
			reconnectionTimeoutDock = setTimeout(function () {
				if ((settings.server2 || settings.server3) && isExtensionOn) {
					conConDock += 1;
					socketserverDock = new WebSocket(serverURLDock);
					setupSocketDock();
				} else {
					socketserverDock = false;
				}
			}, 100 * conConDock);
		} else {
			socketserverDock = false;
		}
	};
	socketserverDock.onopen = function () {
		conConDock = 0;
		socketserverDock.send(JSON.stringify({ join: streamID, out: 4, in: 3 }));
	};
	socketserverDock.addEventListener("message", async function (event) {
		if (event.data) {
			try {
				if (settings.server3 && isExtensionOn) {
					try {
						var data = JSON.parse(event.data);
						processIncomingRequest(data);
					} catch (e) {
						console.error(e);
					}
				}
			} catch (e) {
				log(e);
			}
		}
	});
}
//

var socketserver = false;
var serverURL = urlParams.has("localserver") ? "ws://127.0.0.1:3000" : "wss://io.socialstream.ninja/api";
var conCon = 0;
var reconnectionTimeout = null;

function setupSocket() {
	if (!settings.socketserver) {
		return;
	} else if (!isExtensionOn) {
		return;
	}
	
	if (reconnectionTimeout) {
		clearTimeout(reconnectionTimeout);
		reconnectionTimeout = null;
	}

	if (socketserver) {
		socketserver.onclose = null;
		socketserver.close();
		socketserver = null;
	}

	socketserver = new WebSocket(serverURL);

	socketserver.onerror = function (error) {
		console.error("WebSocket error:", error);
		socketserver.close();
	};

	socketserver.onclose = function () {
		if (settings.socketserver && isExtensionOn) {
			reconnectionTimeout = setTimeout(function () {
				if (settings.socketserver && isExtensionOn) {
					conCon += 1;
					setupSocket();
				} else {
					socketserver = false;
				}
			}, 100 * conCon);
		} else {
			socketserver = false;
		}
	};
	socketserver.onopen = function () {
		conCon = 0;
		socketserver.send(JSON.stringify({ join: streamID, out: 2, in: 1 }));
	};
	socketserver.addEventListener("message", async function (event) {
		if (event.data) {
			var resp = false;

			try {
				var data = JSON.parse(event.data);
			} catch (e) {
				console.error(e);
				return;
			}
			
			if (data.target && (data.target==='null')){
				data.target = "";
			}

			if (data.action && data.action === "sendChat" && data.value) {
				var msg = {};
				msg.response = data.value;
				if (data.target) {
					msg.destination = data.target;
				}
				resp = sendMessageToTabs(msg, false, null, false, false, false);
			} else if (data.action && data.action === "sendEncodedChat" && data.value) {
				var msg = {};
				msg.response = decodeURIComponent(data.value);
				if (data.target) {
					msg.destination = decodeURIComponent(data.target);
				}
				resp = sendMessageToTabs(msg, false, null, false, false, false);
			} else if (data.action && data.action === "blockUser" && data.value) {
				var msg = {};
				let source = data.target.trim().toLowerCase() || "*";
				let username = data.value.trim();
				resp = blockUser({chatname:username, type:source});
			} else if (!data.action && data?.extContent) {
				try {
					if (!data.extContent.type){
						resp  = ({ state: isExtensionOn, error: "Must include message type"});
					} else {
						var letsGo = await processIncomingMessage(data.extContent, false);
						if (letsGo && letsGo.id){
							resp  = ({ state: isExtensionOn, id: letsGo.id });
						} else{
							resp  = ({ state: isExtensionOn});
						}
					}
				} catch (e) {
					console.error(e);
					resp  = ({ state: isExtensionOn, error:"exception"});
				}
			} else if (data.action && data.action === "extContent" && data.value) {
				// flattened
				try {
					let msg = JSON.parse(data.value);
					msg = await applyBotActions(msg); // perform any immediate actions, including modifying the message before sending it out
					if (msg) {
						resp = await sendToDestinations(msg);
					}
				} catch (e) {
					console.error(e);
				}
			} else if (data.action && data.action === "removefromwaitlist") {
				removeWaitlist(parseInt(data.value) || 0);
				resp = true;
			} else if (data.action && data.action === "highlightwaitlist") {
				highlightWaitlist(parseInt(data.value) || 0);
				resp = true;
			} else if (data.action && data.action === "resetwaitlist") {
				resetWaitlist();
				resp = true;
			} else if (data.action && data.action === "resetpoll") {
				sendTargetP2P({cmd:"resetpoll"},"poll");
				resp = true;
			} else if (data.action && data.action === "closepoll") {
				sendTargetP2P({cmd:"closepoll"},"poll");
				resp = true;
			} else if (data.action && data.action === "stopentries") {
				toggleEntries(false);
				resp = true;
				//sendResponse({ state: isExtensionOn });
			} else if (data.action && data.action === "downloadwaitlist") {
				downloadWaitlist();
				resp = true;
			} else if (data.action && data.action === "selectwinner") {
				////console.logdata);
				if ("value" in data) {
					resp = selectRandomWaitlist(parseInt(data.value) || 1);
				} else {
					resp = selectRandomWaitlist();
				}
			} else if (data.action){
				try {
					if (data.target && (data.target.toLowerCase!=="null")){
						sendTargetP2P(data, data.target);
					} else {
						sendDataP2P(data);
					}
					resp = true;
				} catch (e) {
					console.error(e);
				}
			}

			if (typeof resp == "object") {
				resp = true;
			}
			if (data.get) {
				var ret = {};
				ret.callback = {};
				ret.callback.get = data.get;
				ret.callback.result = resp;
				socketserver.send(JSON.stringify(ret));
			}
		}
	});
}

function enableYouTube() {
	// function to send data to the DOCk via the VDO.Ninja API
	try {
		iframe.contentWindow.postMessage({ enableYouTube: settings.youtubeapikey.textsetting }, "*"); // send only to 'viewers' of this stream
	} catch (e) {
		console.error(e);
	}
}

const pendingRequests = new Map();

// Helper to clean up old pending requests
function cleanupPendingRequests() {
    const now = Date.now();
    for (const [url, timestamp] of pendingRequests.entries()) {
        if (now - timestamp > 10000) { // 10 seconds timeout
            pendingRequests.delete(url);
        }
    }
}

async function openchat(target = null, force = false) {
    if (!settings.openchat && !target && !force) {
        console.log("Open Chat is toggled off - no auto open all");
        return;
    }

    // Clean up old pending requests first
    cleanupPendingRequests();

    var res;
    var promise = new Promise((resolve, reject) => {
        res = resolve;
    });

    chrome.tabs.query({}, function(tabs) {
        if (chrome.runtime.lastError) {
            //console.warn(chrome.runtime.lastError.message);
        }
        let urls = [];
        tabs.forEach(tab => {
            if (tab.url) {
                urls.push(tab.url);
            }
        });
        res(urls);
    });

    var activeurls = await promise;
    log(activeurls);

    function openURL(input, newWindow = false, poke = false) {
        // Check if URL is already pending or active
        if (pendingRequests.has(input)) {
            console.log(`Request for ${input} is already pending`);
            return;
        }

        var matched = false;
        activeurls.forEach(url2 => {
            if (url2.startsWith(input)) {
                matched = true;
            }
        });

        if (!matched) {
            // Add to pending requests before opening
            pendingRequests.set(input, Date.now());

            try {
                if (newWindow) {
                    var popup = window.open(input, "_blank", "toolbar=0,location=0,menubar=0,fullscreen=0");
                    popup.moveTo(0, 0);
                    popup.resizeTo(100, 100);
                } else {
                    window.open(input, "_blank");
                }

                if (poke) {
                    setTimeout(() => pokeSite(input), 3000);
                    setTimeout(() => pokeSite(input), 6000);
                }

                // Remove from pending after a short delay to ensure window is opened
                setTimeout(() => {
                    pendingRequests.delete(input);
                }, 2000);
            } catch (error) {
                // Remove from pending if there's an error
                pendingRequests.delete(input);
                console.error(`Error opening ${input}:`, error);
            }
        }
    }
	
	
	async function openYouTubeLiveChats(settings) {
		// Ensure username starts with @
		if (!settings.youtube_username.textsetting.startsWith("@")) {
			settings.youtube_username.textsetting = "@" + settings.youtube_username.textsetting;
		}

		try {
			// Try our API first
			const response = await fetch(`https://api.socialstream.ninja/youtube/streams?username=${encodeURIComponent(settings.youtube_username.textsetting)}`);
			const data = await response.json();

			if (response.ok && Array.isArray(data) && data.length > 0) {
				// We found live streams, open chat for each one
				data.forEach(stream => {
					if (stream.videoId) {
						let url = "https://www.youtube.com/live_chat?is_popout=1&v=" + stream.videoId;
						if (stream.isShort) {
							url += "&shorts";
						}
						openURL(url, true);
					}
				});
				return; // Successfully handled via API
			}

			// If API returns error or no streams, fall back to old method
			await fallbackYouTubeLiveChat(settings);

		} catch (error) {
			console.error("API Error:", error);
			// API failed, fall back to old method
			await fallbackYouTubeLiveChat(settings);
		}
	}

	async function fallbackYouTubeLiveChat(settings) {
		try {
			// Try first URL format
			const response1 = await fetch("https://www.youtube.com/c/" + settings.youtube_username.textsetting + "/live");
			const data1 = await response1.text();
			const videoID = data1.split('{"videoId":"')[1].split('"')[0];
			
			if (videoID) {
				let url = "https://www.youtube.com/live_chat?is_popout=1&v=" + videoID;
				openURL(url, true);
				return;
			}
		} catch (e) {
			try {
				// Try second URL format
				const response2 = await fetch("https://www.youtube.com/" + settings.youtube_username.textsetting + "/live");
				const data2 = await response2.text();
				const videoID = data2.split('{"videoId":"')[1].split('"')[0];
				
				if (videoID) {
					let url = "https://www.youtube.com/live_chat?is_popout=1&v=" + videoID;
					openURL(url, true);
					return;
				}
			} catch (e) {
				console.log("No live streams found");
			}
		}
	}


	if ((target == "twitch" || !target) && settings.twitch_username) {
		let url = "https://www.twitch.tv/popout/" + settings.twitch_username.textsetting + "/chat?popout=";
		openURL(url, true);
	}

	if ((target == "kick" || !target) && settings.kick_username) {
		let url = "https://kick.com/" + settings.kick_username.textsetting + "/chatroom";
		openURL(url);
	}

	if ((target == "instagramlive" || !target) && settings.instagramlive_username && settings.instagramlive_username.textsetting) {
		let url = "https://www.instagram.com/" + settings.instagramlive_username.textsetting + "/live/";
		try {
			fetch(url, { method: "GET", redirect: "error" })
				.then(response => response.text())
				.then(data => {
					openURL(url, false, true);
				})
				.catch(error => {
					// not live?
				});
		} catch (e) {
			// not live
		}
	}

	if ((target == "facebook" || !target) && settings.facebook_username) {
		let url = "https://www.facebook.com/" + settings.facebook_username.textsetting + "/live";
		openURL(url);
	}

	if ((target == "discord" || !target) && settings.discord_serverid && settings.discord_channelid && settings.discord_serverid.textsetting && settings.discord_channelid.textsetting) {
		openURL("https://discord.com/channels/" + settings.discord_serverid.textsetting + "/" + settings.discord_channelid.textsetting);
	}

	// Opened in new window

	if (((target == "youtube") || (target == "youtubeshorts") || !target) && settings.youtube_username) {
		await openYouTubeLiveChats(settings);
	}

	if ((target == "tiktok" || !target) && settings.tiktok_username) {
		if (!settings.tiktok_username.textsetting.startsWith("@")) {
			settings.tiktok_username.textsetting = "@" + settings.tiktok_username.textsetting;
		}
		let url = "https://www.tiktok.com/" + settings.tiktok_username.textsetting + "/live";
		openURL(url, true);
	}

	if ((target == "trovo" || !target) && settings.trovo_username) {
		let url = "https://trovo.live/chat/" + settings.trovo_username.textsetting;
		openURL(url, true);
	}

	if ((target == "picarto" || !target) && settings.picarto_username) {
		let url = "https://picarto.tv/chatpopout/" + settings.picarto_username.textsetting + "/public";
		openURL(url, true);
	}

	if ((target == "dlive" || !target) && settings.dlive_username) {
		let url = "https://dlive.tv/c/" + settings.dlive_username.textsetting + "/" + settings.dlive_username.textsetting;
		openURL(url, true);
	}

	if ((target == "custom1" || !target) && settings.custom1_url) {
		let url = settings.custom1_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom1_url_newwindow);
	}

	if ((target == "custom2" || !target) && settings.custom2_url) {
		let url = settings.custom2_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom2_url_newwindow);
	}

	if ((target == "custom3" || !target) && settings.custom3_url) {
		let url = settings.custom3_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom3_url_newwindow);
	}

	if ((target == "custom4" || !target) && settings.custom4_url) {
		let url = settings.custom4_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom4_url_newwindow);
	}

	if ((target == "custom5" || !target) && settings.custom5_url) {
		let url = settings.custom5_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom5_url_newwindow);
	}

	if ((target == "custom6" || !target) && settings.custom6_url) {
		let url = settings.custom6_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom6_url_newwindow);
	}

	if ((target == "custom7" || !target) && settings.custom7_url) {
		let url = settings.custom7_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom7_url_newwindow);
	}

	if ((target == "custom8" || !target) && settings.custom8_url) {
		let url = settings.custom8_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom8_url_newwindow);
	}

	if ((target == "custom9" || !target) && settings.custom9_url) {
		let url = settings.custom9_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom9_url_newwindow);
	}
}

function sendDataP2P(data, UUID = false) {
	// function to send data to the DOCk via the VDO.Ninja API

	if (!UUID && settings.server2 && socketserverDock && (socketserverDock.readyState===1)) {
		try {
			socketserverDock.send(JSON.stringify(data));
			return;
		} catch (e) {
			console.error(e);
			// lets try to send it via P2P as a backup option
		}
	}

	var msg = {};
	msg.overlayNinja = data;

	if (iframe) {
		if (UUID && connectedPeers) {
			try {
				iframe.contentWindow.postMessage({ sendData: { overlayNinja: data }, type: "pcs", UUID: UUID }, "*");
			} catch (e) {
				console.error(e);
			}
		} else if (connectedPeers) {
			var keys = Object.keys(connectedPeers);
			for (var i = 0; i < keys.length; i++) {
				try {
					UUID = keys[i];
					var label = connectedPeers[UUID] || false;
					if (!label || label === "dock") {
						iframe.contentWindow.postMessage({ sendData: { overlayNinja: data }, type: "pcs", UUID: UUID }, "*"); // the docks and emotes page are VIEWERS, since backend is PUSH-only
					}
				} catch (e) {
					console.error(e);
				}
			}
		} else {
			iframe.contentWindow.postMessage({ sendData: msg, type: "pcs" }, "*"); // send only to 'viewers' of this stream
		}
	}
}

var users = {};
var hype = {};
var hypeInterval = null;
function processHype(data) {
	if (!settings.hypemode) {
		return;
	}
	if (!hypeInterval) {
		hypeInterval = setInterval(processHype2, 10000);
	}
	if (users[data.type]) {
		if (!users[data.type][data.chatname]) {
			if (hype[data.type]) {
				hype[data.type] += 1;
			} else {
				hype[data.type] = 1;
			}
		}
		users[data.type][data.chatname] = Date.now() + 60000 * 5;
	} else {
		var site = {};
		site[data.chatname] = Date.now() + 60000 * 5;
		users[data.type] = site;
		hype[data.type] = 1;
	}
	sendHypeP2P(hype);
}
function processHype2() {
	hype = {};
	if (!settings.hypemode) {
		clearInterval(hypeInterval);
		// users = {};
	} else {
		var now = Date.now();
		var sites = Object.keys(users);
		for (var i = 0; i < sites.length; i++) {
			var user = Object.keys(users[sites[i]]);
			if (user.length) {
				hype[sites[i]] = 0;
				for (var j = 0; j < user.length; j++) {
					if (users[sites[i]][user[j]] < now) {
						delete users[sites[i]][user[j]];
					} else {
						hype[sites[i]] += 1;
					}
				}
			}
		}
	}
	sendHypeP2P(hype);
}
function sendHypeP2P(data, uid = null) {
	// function to send data to the DOCk via the VDO.Ninja API

	if (iframe) {
		if (!uid) {
			var keys = Object.keys(connectedPeers);
			for (var i = 0; i < keys.length; i++) {
				try {
					var UUID = keys[i];
					var label = connectedPeers[UUID];
					if (label === "hype") {
						iframe.contentWindow.postMessage({ sendData: { overlayNinja: { hype: data } }, type: "pcs", UUID: UUID }, "*");
					}
				} catch (e) {}
			}
		} else {
			var label = connectedPeers[uid];
			if (label === "hype") {
				iframe.contentWindow.postMessage({ sendData: { overlayNinja: { hype: data } }, type: "pcs", UUID: uid }, "*");
			}
		}
	}
}
function sendTargetP2P(data, target) {
	// function to send data to the DOCk via the VDO.Ninja API

	if (iframe) {
		var keys = Object.keys(connectedPeers);
		for (var i = 0; i < keys.length; i++) {
			try {
				var UUID = keys[i];
				var label = connectedPeers[UUID];
				if (label === target) {
					iframe.contentWindow.postMessage({ sendData: { overlayNinja: data }, type: "pcs", UUID: UUID }, "*");
				}
			} catch (e) {}
		}
	
	}
}
function sendTickerP2P(data, uid = null) {
	// function to send data to the DOCk via the VDO.Ninja API

	if (iframe) {
		if (!uid) {
			var keys = Object.keys(connectedPeers);
			for (var i = 0; i < keys.length; i++) {
				try {
					var UUID = keys[i];
					var label = connectedPeers[UUID];
					if (label === "ticker") {
						iframe.contentWindow.postMessage({ sendData: { overlayNinja: { ticker: data } }, type: "pcs", UUID: UUID }, "*");
					}
				} catch (e) {}
			}
		} else {
			var label = connectedPeers[uid];
			if (label === "ticker") {
				iframe.contentWindow.postMessage({ sendData: { overlayNinja: { ticker: data } }, type: "pcs", UUID: uid }, "*");
			}
		}
	}
}

//////////

var drawListCount = 0;
var allowNewEntries = true;
var waitListUsers = {};
var waitlist = [];

function processWaitlist(data) {
	try {
		if (!allowNewEntries){
			return;
		}
		if (settings.waitlistmembersonly && !(data.membership || data.hasMembership)){
			return;
		}
		var trigger = "!join";
		if (settings.customwaitlistcommand && settings.customwaitlistcommand.textsetting.trim()) {
			trigger = settings.customwaitlistcommand.textsetting.trim() || trigger;
		}
		if (!data.chatmessage || !data.chatmessage.trim().toLowerCase().startsWith(trigger.toLowerCase())) {
			return;
		}
		var update = false;
		if (waitListUsers[data.type]) {
			if (!waitListUsers[data.type][data.chatname]) {
				update = true;
				waitListUsers[data.type][data.chatname] = Date.now();
				waitlist.push(data);
			}
		} else {
			var site = {};
			site[data.chatname] = Date.now();
			waitListUsers[data.type] = site;
			waitlist.push(data);
			update = true;
		}
		if (update){
			drawListCount+=1;
			
			if (settings.drawmode){
				var keys = Object.keys(connectedPeers);
				for (var i = 0; i < keys.length; i++) {
					try {
						var UUID = keys[i];
						var label = connectedPeers[UUID];
						if (label === "waitlist") {
							iframe.contentWindow.postMessage({ sendData: { overlayNinja: { "drawPoolSize":drawListCount } }, type: "pcs", UUID: UUID }, "*");
						}
					} catch (e) {}
				}
			} else {
				sendWaitlistConfig(waitlist, false);
			}
			
		}
	} catch (e) {
		console.error(e);
	}
}

function setWordcloud(state=true) {
	try {
		if (isExtensionOn){
			sendTargetP2P({state:state}, "wordcloud");
		}
	} catch (e) {}
}

function initializePoll() {
	try {
		//if (!settings.pollEnabled) { // stop and clear
		//	return;
		//}
		if (isExtensionOn){
			//console.log("initializePoll");
			sendTargetP2P({settings:settings}, "poll");
		}
	} catch (e) {}
}

function initializeWaitlist() {
	try {
		if (!settings.waitlistmode) { // stop and clear
			waitlist = [];
			waitListUsers = {};
			
			drawListCount = 0;

			sendWaitlistConfig(false, true);
			return;
		}
		//log("initializeWaitlist");
		sendWaitlistConfig(waitlist, true);
	} catch (e) {}
}
function removeWaitlist(n = 0) {
	log("removeWaitlist");
	try {
		var cc = 1;
		for (var i = 0; i < waitlist.length; i++) {
			if (waitlist[i].waitStatus !== 1) {
				if (n == 0) {
					waitlist[i].waitStatus = 1;
					sendWaitlistConfig(waitlist, true);
					break;
				} else if (cc == n) {
					waitlist[i].waitStatus = 1;
					sendWaitlistConfig(waitlist, true);
					break;
				} else {
					cc += 1;
				}
			}
		}
	} catch (e) {}
}
function highlightWaitlist(n = 0) {
	log("highlightWaitlist");
	try {
		var cc = 1;
		for (var i = 0; i < waitlist.length; i++) {
			if (waitlist[i].waitStatus !== 1) {
				if (n == 0) {
					if (waitlist[i].waitStatus !== 2) {
						// selected
						waitlist[i].waitStatus = 2;
						sendWaitlistConfig(waitlist, true);
						break;
					}
				} else if (cc == n) {
					waitlist[i].waitStatus = 2;
					sendWaitlistConfig(waitlist, true);
					break;
				} else {
					cc += 1;
				}
			}
		}
	} catch (e) {}
}
function shuffle(array) {
	// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
	var currentIndex = array.length,
		randomIndex;
	while (currentIndex > 0) {
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;
		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
	}
	return array;
}
function selectRandomWaitlist(n = 1) {
	log("selectRandomWaitlist: "+n);
	try {
		var cc = 1;
		var selectable = [];
		for (var i = 0; i < waitlist.length; i++) {
			if (waitlist[i].waitStatus !== 1) {
				// removed form wait list already
				if (!waitlist[i].randomStatus) {
					waitlist[i].randomStatus = 0; // not yet a winner
					selectable.push(i);
				} else if (waitlist[i].randomStatus === 1) {
					// already selected
					waitlist[i].randomStatus = 2;
				}
			}
		}
		shuffle(selectable);
		var winners = [];
		//console.log(selectable);
		let count = Math.min(selectable.length,n);
		for (var i = 0; i < count; i++) {
			try {
				if (waitlist[selectable[i]]) {
					waitlist[selectable[i]].randomStatus = 1;
					winners.push({...waitlist[selectable[i]]});
				}
			} catch(e){
				console.log(e);
			}
		}
		//console.log("SENDING WINNDERS");
		//console.log(winners);
		
		drawListCount = selectable.length - count;
		sendWaitlistConfig(winners, true);
		return winners;
		
	} catch (e) {}
	return false;
}

function resetWaitlist() {
	waitListUsers = {};
	waitlist = [];
	drawListCount = 0;
	allowNewEntries = true;
	sendWaitlistConfig(waitlist, true, true);
}

function toggleEntries(state=false){
	allowNewEntries = state;
	sendWaitlistConfig();
}
function objectArrayToCSV(data, delimiter = ",") {
	if (!data || !Array.isArray(data) || data.length === 0) {
		return "";
	}
	const header = Object.keys(data[0]).join(delimiter);

	const rows = data.map(obj =>
		Object.values(obj)
			.map(value => (typeof value === "string" && value.includes(delimiter) ? `"${value}"` : value))
			.join(delimiter)
	);

	return [header, ...rows].join("\n");
}

async function downloadWaitlist() {
	const opts = {
		types: [
			{
				description: "Data file",
				accept: { "application/data": [".tsv"] }
			}
		]
	};
	if (!window.showSaveFilePicker) {
		console.warn("Open `brave://flags/#file-system-access-api` and enable to use the File API");
	}
	fileExportHandler = await window.showSaveFilePicker(opts);
	var filesContent = objectArrayToCSV(waitlist, "\t");

	if (typeof fileExportHandler == "string") {
		ipcRenderer.send("write-to-file", { filePath: fileExportHandler, data: filesContent });
	} else {
		const writableStream = await fileExportHandler.createWritable();
		await writableStream.write(filesContent);
		await writableStream.close();
	}
}

function sendWaitlistConfig(data = null, sendMessage = true, clear=false) {
	//console.warn("sendWaitlistConfig");
	if (iframe) {
		if (sendMessage) {
			var trigger = "!join";
			if (settings.customwaitlistcommand && settings.customwaitlistcommand.textsetting.trim()) {
				trigger = settings.customwaitlistcommand.textsetting.trim();
			}
			var message = "Type " + trigger + " to join this wait list";
			if (settings.drawmode) {
				if (!allowNewEntries){
					message = "No new entries allowed";
				} else {
					message = "Type " + trigger + " to join the random draw";
				}
			}
			if (settings.customwaitlistmessagetoggle) {
				if (settings.customwaitlistmessage) {
					message = settings.customwaitlistmessage.textsetting.trim();
					message = message.replace(/{trigger}/g, trigger);
				} else {
					message = "";
				}
			}
		}

		//console.log(data);

		var keys = Object.keys(connectedPeers);
		for (var i = 0; i < keys.length; i++) {
			try {
				var UUID = keys[i];
				var label = connectedPeers[UUID];
				if (label === "waitlist") {
					if (sendMessage) {
						if (data === null) {
							if (settings.drawmode){
								iframe.contentWindow.postMessage({ sendData: { overlayNinja: {
									waitlistmessage: message, 
									drawPoolSize: drawListCount,
									drawmode: true,
									clearWinner:clear,
								} }, type: "pcs", UUID: UUID}, "*");
							} else {
								iframe.contentWindow.postMessage({ sendData: { overlayNinja: {
									waitlistmessage: message, 
									drawmode: false
								} }, type: "pcs", UUID: UUID}, "*");
							}
						} else if (settings.drawmode){
							iframe.contentWindow.postMessage({ sendData: { overlayNinja: {
								waitlistmessage: message, 
								winlist: data,
								drawPoolSize: drawListCount,
								drawmode: true,
								clearWinner:clear
							}}, type: "pcs", UUID: UUID }, "*");
						} else {
							iframe.contentWindow.postMessage({ sendData: { overlayNinja: {
								waitlist: data, 
								waitlistmessage: message, 
								drawmode: false
							}}, type: "pcs", UUID: UUID }, "*");
						}
					} else if (data !== null) {
						
						if (settings.drawmode){
							iframe.contentWindow.postMessage({ sendData: { overlayNinja: {
								drawPoolSize: drawListCount,
								drawmode: true,
								clearWinner:clear,
								waitlist: data
							} }, type: "pcs", UUID: UUID }, "*");
						} else {
							iframe.contentWindow.postMessage({ sendData: { overlayNinja: { 
								drawmode: false,
								waitlist: data
							} }, type: "pcs", UUID: UUID }, "*");
						}
					}
				}
			} catch (e) {}
		}
	}
}

///

function sendToDisk(data) {
	if (newFileHandle) {
		try {
			if (typeof data == "object") {
				data.timestamp = data.timestamp || (new Date().getTime());

				if (data.type && data.chatimg && ((data.type == "youtube") || (data.type == "youtubeshorts"))) {
					data.chatimg = data.chatimg.replace("=s32-", "=s512-"); // high, but meh.
					data.chatimg = data.chatimg.replace("=s64-", "=s512-");
				}

				if (data.type && (data.type == "twitch") && !data.chatimg && data.chatname) {
					data.chatimg = "https://api.socialstream.ninja/twitch/large?username=" + encodeURIComponent(data.chatname); // 150x150
				}

				overwriteFile(JSON.stringify(data));
			}
		} catch (e) {}
	}
	if (newFileHandleExcel) {
		try {
			if (typeof data == "object") {
				data.timestamp = data.timestamp || (new Date().getTime());

				if (data.type && data.chatimg && ((data.type == "youtube") || (data.type == "youtubeshorts"))) {
					data.chatimg = data.chatimg.replace("=s32-", "=s256-");
					data.chatimg = data.chatimg.replace("=s64-", "=s256-");
				}

				if (data.type && (data.type == "twitch") && !data.chatimg && data.chatname) {
					data.chatimg = "https://api.socialstream.ninja/twitch/large?username=" + encodeURIComponent(data.chatname); // 150x150
				}
				overwriteFileExcel(data);
			}
		} catch (e) {}
	}

	if (newSavedNamesFileHandle && data.chatname) {
		overwriteSavedNames(data.chatname);
	}
}

function loadIframe(streamID, pass = false) {
	// this is pretty important if you want to avoid camera permission popup problems.  You can also call it automatically via: <body onload=>loadIframe();"> , but don't call it before the page loads.
	log("LOAD IFRAME VDON BG");

	var lanonly = "";
	if (settings["lanonly"]) {
		lanonly = "&lanonly";
	}

	if (iframe) {
		if (!pass) {
			pass = "false";
		}
		//iframe.allow = "document-domain;encrypted-media;sync-xhr;usb;web-share;cross-origin-isolated;accelerometer;midi;geolocation;autoplay;camera;microphone;fullscreen;picture-in-picture;display-capture;";
		iframe.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=" + pass + lanonly + "&room=" + streamID + "&push=" + streamID + "&vd=0&ad=0&autostart&cleanoutput&view&label=SocialStream"; // don't listen to any inbound events
	} else {
		iframe = document.createElement("iframe");
		//iframe.allow =  "document-domain;encrypted-media;sync-xhr;usb;web-share;cross-origin-isolated;accelerometer;midi;geolocation;autoplay;camera;microphone;fullscreen;picture-in-picture;display-capture;";
		if (!pass) {
			pass = "false";
		}
		iframe.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=" + pass + lanonly + "&room=" + streamID + "&push=" + streamID + "&vd=0&ad=0&autostart&cleanoutput&view&label=SocialStream"; // don't listen to any inbound events
		document.body.appendChild(iframe);
	}
}

var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent"; // lets us listen to the VDO.Ninja IFRAME API; ie: lets us talk to the dock
var eventer = window[eventMethod];
var messageEvent = eventMethod === "attachEvent" ? "onmessage" : "message";
var commandCounter = 0;

const debuggerState = {
  attachments: {}, // Track active debugger attachments
  timeouts: {}    // Track detach timeouts
};


function safeDebuggerAttach(tabId, version, callback) {
  if (debuggerState.attachments[tabId]) {
    // Already attached, just call the callback
    callback();
    return;
  }

  // Clear any pending detach timeout
  if (debuggerState.timeouts[tabId]) {
    clearTimeout(debuggerState.timeouts[tabId]);
    delete debuggerState.timeouts[tabId];
  }

  try {
    chrome.debugger.attach({ tabId: tabId }, version, () => {
      if (chrome.runtime.lastError) {
        //console.log'Debugger attach error:', chrome.runtime.lastError);
        callback(chrome.runtime.lastError);
        return;
      }
      debuggerState.attachments[tabId] = true;
      callback();
    });
  } catch(e) {
    //console.log'Debugger attach exception:', e);
    callback(e);
  }
}

function onDetach(debuggeeId) {
    try {
        chrome.runtime.lastError;
    } catch(e) {}

    if (debuggeeId.tabId) {
        // Clear any existing timeout
        if (debuggerState.timeouts[debuggeeId.tabId]) {
            clearTimeout(debuggerState.timeouts[debuggeeId.tabId]);
            delete debuggerState.timeouts[debuggeeId.tabId];
        }
        
        // Clear the attachment state
        debuggerState.attachments[debuggeeId.tabId] = false;
	}
}

try {
	chrome.debugger.onDetach.addListener(onDetach);
} catch (e) {
	log("'chrome.debugger' not supported by this browser");
}


async function processIncomingRequest(request, UUID = false) { // from the dock or chat bot, etc.
	if (settings.disablehost) {
		return;
	}

	if ("response" in request) {
		// we receieved a response from the dock
		//sendMessageToTabs(request);
		sendMessageToTabs(request, false, null, false, false, false);
	} else if ("action" in request) {
		if (request.action === "openChat") {
			openchat(request.value || null);
		} else if (request.action === "getUserHistory" && request.value && request.value.chatname && request.value.type) {
			if (isExtensionOn) {
				getMessagesDB(request.value.chatname, request.value.type, (page = 0), (pageSize = 100), function (response) {
					if (isExtensionOn) {
						sendDataP2P({ userHistory: response }, UUID);
					}
				});
			}
		} else if (request.action === "getRecentHistory" && request.value) {
			if (isExtensionOn) {
				var res = await getLastMessagesDB(request.value);
				if (isExtensionOn) {
					sendDataP2P({ recentHistory: res }, UUID);
				}
			}
		} else if (request.action === "toggleVIPUser" && request.value && request.value.chatname && request.value.type) {
			// Initialize viplist settings if not present
			if (!settings.viplistusers) {
				settings.viplistusers = { textsetting: "" };
			}

			const viplist = settings.viplistusers.textsetting.split(",").map(user => {
				const parts = user.split(":").map(part => part.trim());
				return { username: parts[0], type: parts[1] || "" };
			}); 
			
			var altSourceType = request.value.type || "";
			if (altSourceType == "youtubeshorts"){
				altSourceType = "youtube";
			}

			const userToVIP = { username: (request.value.userid || request.value.chatname), type: altSourceType };
			const isAlreadyVIP = viplist.some(({ username, type }) => userToVIP.username === username && (userToVIP.type === type || type === ""));

			if (!isAlreadyVIP) {
				settings.viplistusers.textsetting += (settings.viplistusers.textsetting ? "," : "") + userToVIP.username + ":" + userToVIP.type;
				chrome.storage.local.set({ settings: settings });
				// Check for errors in chrome storage operations
				if (chrome.runtime.lastError) {
					console.error("Error updating settings:", chrome.runtime.lastError.message);
				}
			}

			if (isExtensionOn) {
				sendToDestinations({ vipUser: userToVIP });
			}
		} else if (request.action === "getChatSources") {
			if (isExtensionOn && chrome.debugger) {
				chrome.tabs.query({}, function (tabs) {
					chrome.runtime.lastError;
					var tabsList = [];
					for (var i = 0; i < tabs.length; i++) {
						try {
							if (!tabs[i].url) {
								continue;
							}
							if (tabs[i].url.startsWith("https://socialstream.ninja/")) {
								continue;
							}
							if (tabs[i].url.startsWith("https://www.youtube.com/watch") && !tabs[i].url.includes("&socialstream")) {
								continue;
							}
							if (tabs[i].url.startsWith("https://twitch.tv") && !tabs[i].url.startsWith("https://twitch.tv/popout/")) {
								continue;
							}
							if (tabs[i].url.startsWith("https://www.twitch.tv") && !tabs[i].url.startsWith("https://www.twitch.tv/popout/")) {
								continue;
							}
							if (tabs[i].url.startsWith("file://") && tabs[i].url.includes("dock.html?")) {
								continue;
							}
							if (tabs[i].url.startsWith("file://") && tabs[i].url.includes("index.html?")) {
								continue;
							}
							if (tabs[i].url.startsWith("chrome-extension")) {
								continue;
							}
							if (tabs[i].id && priorityTabs.has(tabs[i].id)) {
								tabsList.unshift(tabs[i]);
							} else {
								tabsList.push(tabs[i]);
							}
						} catch (e) {}
					}
					
					let ttsTab = {};
					ttsTab.url = "";
					ttsTab.id = "TTS";
					ttsTab.title = "Text to Speech your message";
					ttsTab.favIconUrl = "./icons/tts_incoming_messages_on.png";
					
					tabsList.push(ttsTab)

					sendDataP2P({ tabsList: tabsList }, UUID);
				});
			}
		} else if (request.action === "blockUser") {
			blockUser(request.value);
		} else if (request.action === "obsCommand") {
			if (isExtensionOn){
				fowardOBSCommand(request);
			}
		} else if (request.value && ("target" in request) && UUID && request.action === "chatbot"){ // target is the callback ID
			if (isExtensionOn && settings.allowChatBot){ // private chat bot
				
				try {
				  // ollama run technobyte/Llama-3.3-70B-Abliterated:IQ2_XS
				  // let model = "technobyte/Llama-3.3-70B-Abliterated:IQ2_XS"
				  let prompt = request.value || "";
				  if (request.turbo) {
						prompt = "You're an AI assistant. Keep responses limited to a few sentences.\n" + prompt;
				  }
				  let model = request.model || null;
				  const controller = new AbortController();
				  
				  callLLMAPI(prompt, model, (chunk) => {
					sendDataP2P({ chatbotChunk: {value: chunk, target: request.target}}, UUID);
				  }, controller, UUID, (request.images || null)).then((fullResponse) => {
					sendDataP2P({ chatbotResponse: {value: fullResponse, target: request.target}}, UUID);
				  }).catch((error) => {
					console.error('Error in callLLMAPI:', error);
					sendDataP2P({ chatbotResponse: {value: JSON.stringify(error), target: request.target}}, UUID);
				  });
				} catch(e) {
				  console.error('Unexpected error:', e);
				  sendDataP2P({ chatbotResponse: {value: JSON.stringify(e), target: request.target}}, UUID);
				}
			}
		}
	}
}

function fowardOBSCommand(data){
	// data.value = {value:{action: 'setCurrentScene', value: sceneName}}
	if (isExtensionOn && data.value) {
		sendToDestinations({obsCommand: data.value});
	}
}

function blockUser(data){
	// Initialize blacklist settings if not present
	
	if (!(data && data.chatname && data.type)){
		console.warn("Block request doesn't contain chatname and type. '*' can be used for all types.");
		return false;
	}
	try {
		if (!settings.blacklistusers) {
			settings.blacklistusers = { textsetting: "" };
		}
		let resave = false;
		if (!settings.blacklistuserstoggle){
			settings.blacklistuserstoggle = {};
			settings.blacklistuserstoggle.setting = true;
			resave = true;
		}

		const blacklist = settings.blacklistusers.textsetting.split(",").map(user => {
			const parts = user.split(":").map(part => part.trim());
			return { username: parts[0], type: parts[1] || "*" };
		});
		
		var altSourceType = data.type || "";
		if (altSourceType == "youtubeshorts"){
			altSourceType = "youtube";
		}

		const userToBlock = { username: (data.userid || data.chatname), type: altSourceType };
		
		if (data.chatimg && !data.chatimg.endsWith("/unknown.png")){
			userToBlock.chatimg = data.chatimg;
		}
		
		const isAlreadyBlocked = blacklist.some(({ username, type }) => userToBlock.username === username && (userToBlock.type === type || type === "*"));

		if (!isAlreadyBlocked) {
			// Update blacklist settings
			settings.blacklistusers.textsetting += (settings.blacklistusers.textsetting ? "," : "") + userToBlock.username + ":" + userToBlock.type;
			chrome.storage.local.set({ settings: settings });
			// Check for errors in chrome storage operations
			if (chrome.runtime.lastError) {
				console.error("Error updating settings:", chrome.runtime.lastError.message);
			}
		} else if (resave){
			chrome.storage.local.set({ settings: settings });
		}

		if (isExtensionOn) {
			sendToDestinations({ blockUser: userToBlock });
		}
	} catch(e){
		console.error(e);
		return false;
	}
	
	return true;
}

eventer(messageEvent, async function (e) {
	// iframe wno't be enabled if isExtensionOn is off, so allow this.
	if (!iframe) {
		return;
	}
	if (e.source != iframe.contentWindow) {
		return;
	}
	if (e.data && typeof e.data == "object") {
		if ("dataReceived" in e.data && "overlayNinja" in e.data.dataReceived) {
			processIncomingRequest(e.data.dataReceived.overlayNinja, e.data.UUID);
		} else if ("action" in e.data) {
			// this is from vdo.ninja, not socialstream.
			if (e.data.action === "YoutubeChat") {
				// I never got around to completing this, so ignore it
				if (e.data.value && data.value.snippet && data.value.authorDetails) {
					var data = {};
					data.chatname = e.data.value.authorDetails.displayName || "";
					data.chatimg = e.data.value.authorDetails.profileImageUrl || "";
					data.nameColor = "";
					data.chatbadges = "";
					data.backgroundColor = "";
					data.textColor = "";
					data.chatmessage = data.value.snippet.displayMessage || "";
					data.hasDonation = "";
					data.membership = "";
					data.type = "youtube";

					data = await applyBotActions(data); // perform any immediate (custom) actions, including modifying the message before sending it out
					if (data) {
						sendToDestinations(data);
					}
				}
			} else if (e.data.action == "view-stats-updated") {
				return;
			} else if (e.data.UUID && e.data.value && e.data.action == "push-connection-info") {
				// flip this
				if ("label" in e.data.value) {
					connectedPeers[e.data.UUID] = e.data.value.label;
					if (connectedPeers[e.data.UUID] == "hype") {
						processHype2();
					} else if (connectedPeers[e.data.UUID] == "ticker") {
						processTicker();
					} else if (connectedPeers[e.data.UUID] == "waitlist") {
						initializeWaitlist();
					} else if (connectedPeers[e.data.UUID] == "poll") {
						initializePoll();
					}
				}
			} else if (e.data.UUID && e.data.value && e.data.action == "view-connection-info") {
				// flip this
				if ("label" in e.data.value) {
					connectedPeers[e.data.UUID] = e.data.value.label;
					if (connectedPeers[e.data.UUID] == "hype") {
						processHype2();
					} else if (connectedPeers[e.data.UUID] == "ticker") {
						processTicker();
					} else if (connectedPeers[e.data.UUID] == "waitlist") {
						initializeWaitlist();
					} else if (connectedPeers[e.data.UUID] == "poll") {
						initializePoll();
					}
				}
			} else if (e.data.UUID && "value" in e.data && !e.data.value && e.data.action == "push-connection") {
				// flip this
				if (e.data.UUID in connectedPeers) {
					delete connectedPeers[e.data.UUID];
				}
				//log(connectedPeers);
			} else if (e.data.UUID && "value" in e.data && !e.data.value && e.data.action == "view-connection") {
				// flip this
				if (e.data.UUID in connectedPeers) {
					delete connectedPeers[e.data.UUID];
				}
			} else if (e.data.action === "alert") {
				if (e.data.value && e.data.value == "Stream ID is already in use.") {
					document.title = "Close me? - Social Stream Ninja";
					isExtensionOn = false;
					updateExtensionState();
					try {
						chrome.notifications.create({
							type: "basic",
							iconUrl: "./icons/icon-128.png",
							title: "Cannot enable Social Stream",
							message: "Your specified Session ID is already in use.\n\nDisable Social Stream elsewhere if already in use first, or change your session ID to something unique."
						});
						messagePopup({alert: "Your specified Session ID is already in use.\n\nDisable Social Stream elsewhere if already in use first, or change your session ID to something unique."});
					} catch (e) {
						console.error(e);
					}
					if (!isSSAPP){
						window.close();
					}
				}
			}
		}
	}
});

function checkIfAllowed(sitename) {
	if (isSSAPP){return true;}
	
	if (!settings.discord) {
		try {
			if (sitename == "discord") {
				return false;
			}
			if (sitename.startsWith("https://discord.com/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.slack) {
		try {
			if (sitename == "slack") {
				return false;
			}
			if (sitename.startsWith("https://app.slack.com/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.teams) {
		try {
			if (sitename == "teams") {
				return false;
			}
			if (sitename.startsWith("https://teams.microsoft.com/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.openai) {
		try {
			if (sitename == "openai") {
				return false;
			}
			if (sitename.startsWith("https://chat.openai.com/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.chime) {
		try {
			if (sitename == "chime") {
				return false;
			}
			if (sitename.startsWith("https://app.chime.aws/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.meet) {
		try {
			if (sitename == "meet") {
				return false;
			}
			if (sitename.startsWith("https://meet.google.com/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.telegram) { 
		try {
			if (sitename == "telegram") {
				return false;
			}
			if (sitename.includes(".telegram.org/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.whatsapp) {
		try {
			if (sitename == "whatsapp") {
				return false;
			}
			if (sitename.startsWith("https://web.whatsapp.com/")) {
				return false;
			}
		} catch (e) {}
	}

	if (!settings.instagram) {
		try {
			if (sitename == "instagram") {
				// "instagram live" is allowed still, just not comments
				return false;
			}
			//if (sitename.startsWith("https://www.instagram.com/") && !sitename.includes("/live/")) {
			//	return false;
			//}
		} catch (e) {}
	}
	return true;
}

function messagePopup(data) {
    const popupMessage = {
        forPopup: data
    };
    chrome.runtime.sendMessage(popupMessage, function(response) {
        if (chrome.runtime.lastError) {
            // console.warn("Error sending message:", chrome.runtime.lastError.message);
        } else {
            // //console.log"Message sent successfully:", response);
        }
    });
    return true;
}

function pokeSite(url = false, tabid = false) {
    if (!chrome.debugger) {
        return false;
    }
    if (!isExtensionOn) {
        return false;
    }

    chrome.tabs.query({}, function (tabs) {
        if (chrome.runtime.lastError) {
            //console.warn(chrome.runtime.lastError.message);
        }
        var published = {};
        for (var i = 0; i < tabs.length; i++) {
            try {
                const currentTab = tabs[i];
                
                if (!currentTab.url) continue;
                if (currentTab.url.startsWith("chrome://")) continue;  // Add this line
                if (currentTab.url in published) continue;
                if (currentTab.url.startsWith("https://socialstream.ninja/")) continue;
                if (currentTab.url.startsWith("chrome-extension")) continue;
                // if (!checkIfAllowed((currentTab.url))){continue;}
                
                published[currentTab.url] = true;
                
                if (tabid && tabid == currentTab.id) {
                    safeDebuggerAttach(currentTab.id, "1.3", (error) => {
                        if (error) {
                            console.warn(`Failed to attach debugger to tab ${currentTab.id}:`, error);
                            return;
                        }
                        generalFakePoke(currentTab.id);
                    });
                } else if (url) {
                    if (currentTab.url.startsWith(url)) {
                        safeDebuggerAttach(currentTab.id, "1.3", (error) => {
                            if (error) {
                                console.warn(`Failed to attach debugger to tab ${currentTab.id}:`, error);
                                return;
                            }
                            generalFakePoke(currentTab.id);
                        });
                    }
                }
            } catch (e) {
                chrome.runtime.lastError;
            }
        }
    });
    return true;
}

function generalFakePoke(tabid) {
	// fake a user input
	try {
		chrome.debugger.sendCommand(
			{ tabId: tabid },
			"Input.dispatchKeyEvent",
			{
				type: "keyDown",
				key: "Enter",
				code: "Enter",
				nativeVirtualKeyCode: 13,
				windowsVirtualKeyCode: 13
			},
			function (e) {
				chrome.debugger.sendCommand(
					{ tabId: tabid },
					"Input.dispatchKeyEvent",
					{
						type: "keyUp",
						key: "Enter",
						code: "Enter",
						nativeVirtualKeyCode: 13,
						windowsVirtualKeyCode: 13
					},
					function (e) {
						chrome.debugger.sendCommand(
							{ tabId: tabid },
							"Input.dispatchMouseEvent",
							{
								type: "mousePressed",
								x: 1,
								y: 1,
								button: "left",
								clickCount: 1
							},
							function (e) {
								chrome.debugger.sendCommand(
									{ tabId: tabid },
									"Input.dispatchMouseEvent",
									{
										type: "mouseReleased",
										x: 1,
										y: 1,
										button: "left",
										clickCount: 1
									},
									(e) => {
										delayedDetach(tabid);
									}
								);
							}
						);
					}
				);
			}
		);
	} catch (e) {
		//console.loge);
		delayedDetach(tabid);
	}
}

function delayedDetach(tabid) {
  try {
    chrome.runtime.lastError;
  } catch(e) {}
  
  // Clear any existing timeout
  if (debuggerState.timeouts[tabid]) {
    clearTimeout(debuggerState.timeouts[tabid]);
  }
  
  // Set new timeout
  debuggerState.timeouts[tabid] = setTimeout(function(tabid) {
    try {
      debuggerState.attachments[tabid] = false;
      chrome.debugger.detach({ tabId: tabid }, onDetach.bind(null, { tabId: tabid }));
    } catch(e) {
      errorlog(e);
    }
  }, 1000, tabid);
}

async function sendMessageToTabs(data, reverse = false, metadata = null, relayMode = false, antispam = false, overrideTimeout = 3500) {
    if (!chrome.debugger || !isExtensionOn || settings.disablehost) {
        return false;
    }

    if (antispam && settings["dynamictiming"] && lastAntiSpam + 10 > messageCounter) {
        return false;
    }
    
    if (antispam && settings["dynamictiming"]) {
        if (lastAntiSpam + 10 > messageCounter) {
            return;
        }
    }
    const now = Date.now();
    
    if (!reverse && !overrideTimeout && data.tid) { // we do this early to avoid the blue bar if not needed
        if (data.tid in messageTimeout) {
            if (now - messageTimeout[data.tid] < overrideTimeout) {
                return;
            }
        }
    }
    
    lastAntiSpam = messageCounter;
    
    var msg2Save = checkExactDuplicateAlreadyRelayed(data.response, false, false, true);  // this might be more efficient if I do it after, rather than before
    
	if (settings.s10apikey && settings.s10) {
		try {
			handleStageTen(data, metadata);
		} catch(e){}
	}
	
    try {
		
        const tabs = await new Promise(resolve => chrome.tabs.query({}, resolve));
        var published = {};
		
        
        for (const tab of tabs) {
            try {
                // Skip invalid tabs
                if (!isValidTab(tab, data, reverse, published, now, overrideTimeout)) {
                    continue;
                }

                // Handle message store
                if (msg2Save) {  
                    handleMessageStore(tab.id, msg2Save, now, relayMode);
                }

                published[tab.url] = true;
                
                // Handle different site types
                if (tab.url.includes(".stageten.tv") && settings.s10apikey && settings.s10) {
					// we will handle this on its own.
					continue;
                } else if (tab.url.startsWith("https://www.twitch.tv/popout/")) {
					let restxt = data.response.length > 500 ? data.response.substring(0, 500) : data.response;
					await attachAndChat(tab.id, restxt, false, true, false, false, overrideTimeout);
					
                } else if (tab.url.startsWith("https://boltplus.tv/")) {
                    await attachAndChat(tab.id, data.response, false, true, true, true, overrideTimeout);
					
				} else if (tab.url.startsWith("https://rumble.com/")) {
                    await attachAndChat(tab.id, data.response, true, true, false, false, overrideTimeout);	
					
                } else if (tab.url.startsWith("https://app.chime.aws/meetings/")) {
                    await attachAndChat(tab.id, data.response, false, true, true, false, overrideTimeout);
					//  middle, keypress, backspace, delayedPress, overrideTimeout
               //     await attachAndChat(tab.id, data.response, true, true, true, true, overrideTimeout); 
			   
				} else if (tab.url.startsWith("https://kick.com/")) {
					let restxt = data.response.length > 500 ? data.response.substring(0, 500) : data.response;
					if (isSSAPP){
						await attachAndChat(tab.id, " "+restxt, false, true, true, false, overrideTimeout);
					} else {
						await attachAndChat(tab.id, restxt, false, true, true, false, overrideTimeout);
					}
                } else if (tab.url.startsWith("https://app.slack.com")) {
                    await attachAndChat(tab.id, data.response, true, true, true, false, overrideTimeout); 
                } else if (tab.url.startsWith("https://app.zoom.us/")) {
                    await attachAndChat(tab.id, data.response, false, true, false, false, overrideTimeout, zoomFakeChat);
                    continue;
                } else {
                    // Generic handler
                    if (tab.url.includes("youtube.com/live_chat")) {
                        getYoutubeAvatarImage(tab.url, true);
						let restxt = data.response;
						
						if (restxt.length > 200){
							restxt = restxt.substring(0, 200);
							var ignore = checkExactDuplicateAlreadyRelayed(restxt, false, false, true); 
							if (ignore) {  
								handleMessageStore(tab.id, ignore, now, relayMode);
							}
						}
						
						await attachAndChat(tab.id, restxt, true, true, false, false, overrideTimeout);
						continue;
                    }
                    
                    if (tab.url.includes("tiktok.com")) {
						let tiktokMessage = data.response;
						
						if (settings.notiktoklinks){
							tiktokMessage = replaceURLsWithSubstring(tiktokMessage, "");
						}
						let restxt = tiktokMessage.length > 150 ? tiktokMessage.substring(0, 150) : tiktokMessage;
						
						if (restxt!==data.response){
							var ignore = checkExactDuplicateAlreadyRelayed(restxt, false, false, true); 
							if (ignore) {  
								handleMessageStore(tab.id, ignore, now, relayMode);
							}
						}
						
						await attachAndChat(tab.id, restxt, true, true, false, false, overrideTimeout);
						continue;
                    }
					
                    await attachAndChat(tab.id, data.response, true, true, false, false, overrideTimeout);
                }
            } catch (e) {
                chrome.runtime.lastError;
                //console.loge, tab);
            }
        }
    } catch (error) {
        //console.log'Error in sendMessageToTabs:', error);
        return false;
    }
    
    return true;
}

// Helper function to check if a tab is valid for processing
function isValidTab(tab, data, reverse, published, now, overrideTimeout) {
    // First check URLs that we can't or shouldn't process
    if (!tab.url) return false;
    if (tab.url.startsWith("chrome://")) return false;  // Add this line
    if (tab.url.startsWith("chrome-extension")) return false;
    if (tab.url.startsWith("https://socialstream.ninja/")) return false;
    if (tab.url in published) return false;
    if (!checkIfAllowed(tab.url)) return false;
    
    // Check TID conditions
    if ("tid" in data && data.tid !== false && data.tid !== null) {
        if (typeof data.tid == "object") {
            if (reverse && data.tid.includes(tab.id.toString())) return false;
            if (!reverse && !data.tid.includes(tab.id.toString())) return false;
        } else {
            if (reverse) {
                if (data.tid === tab.id) return false;
                if (data.url && tab.url && data.url === tab.url) return false;
            } else if (data.tid !== tab.id) return false;
        }
    }
    
    // Check destination and timeout conditions
    if (data.destination && !tab.url.includes(data.destination)) return false;
    if (reverse && !overrideTimeout && tab.id) {
        if (tab.id in messageTimeout && now - messageTimeout[tab.id] < overrideTimeout) {
            return false;
        }
    }
    
    return true;
}

// Helper function to handle message store
function handleMessageStore(tabId, msg2Save, now, relayMode) {
    try {
        if (!messageStore[tabId]) {
            messageStore[tabId] = [];
        } else {
            while (messageStore[tabId].length > 0 && now - messageStore[tabId][0].timestamp > 10000) {
                messageStore[tabId].shift();
            }
        }
        messageStore[tabId].push({
            message: msg2Save,
            timestamp: now,
            relayMode: relayMode
        });
    } catch(e) {
        errorlog(e);
    }
}
function messageExistsInTimeWindow(tabId, messageToFind, timeWindowMs = 1000) {
    try {
        if (!messageStore[tabId]) {
            return false;
        }

        const now = Date.now();
        
        return messageStore[tabId].some(entry => {
            const isWithinTimeWindow = (now - entry.timestamp) <= timeWindowMs;
            const messageMatches = entry.message === messageToFind;
            
            return isWithinTimeWindow && messageMatches;
        });
    } catch(e) {
        errorlog(e);
        return false;
    }
}


// Helper function to handle StageTen
function handleStageTen(data, metadata) {
    if (!data.response) return;
    if (metadata) {
        sendToS10(metadata, true);
    } else {
        var msg = {
            chatmessage: data.response,
            type: "socialstream",
            chatimg: "https://socialstream.ninja/icons/icon-128.png"
        };
        sendToS10(msg, true);
    }
}

// Helper function to attach debugger and send chat
async function attachAndChat(tabId, message, middle, keypress, backspace, delayedPress, overrideTimeout, chatFunction = generalFakeChat) {
    return new Promise((resolve, reject) => {
        safeDebuggerAttach(tabId, "1.3", (error) => {
            if (error) {
                console.warn(`Failed to attach debugger to tab ${tabId}:`, error);
                reject(error);
                return;
            }
            chatFunction(tabId, message, middle, keypress, backspace, delayedPress, overrideTimeout);
            resolve();
        });
    });
}
 
function zoomFakeChat(tabid, message, middle = false, keypress = true, backspace = false) {
    chrome.tabs.sendMessage(tabid, "focusChat", function (response = false) {
        try {
            chrome.runtime.lastError; // Clear any runtime errors
            
            if (!response) {
                delayedDetach(tabid);
                return;
            }

            // Check if debugger is still attached before sending commands
            if (!debuggerState.attachments[tabid]) {
                console.warn(`Debugger not attached for tab ${tabid}`);
                return;
            }

            chrome.debugger.sendCommand({ tabId: tabid }, "Input.insertText", { text: message }, function (e) {
                if (chrome.runtime.lastError) {
                    console.warn(`Error inserting text for tab ${tabid}:`, chrome.runtime.lastError);
                    delayedDetach(tabid);
                    return;
                }

                chrome.debugger.sendCommand(
                    { tabId: tabid },
                    "Input.dispatchKeyEvent",
                    {
                        type: "keyDown",
                        key: "Enter",
                        code: "Enter",
                        nativeVirtualKeyCode: 13,
                        windowsVirtualKeyCode: 13
                    },
                    (e) => {
                        if (chrome.runtime.lastError) {
                            console.warn(`Error sending keyDown for tab ${tabid}:`, chrome.runtime.lastError);
                        }
                        delayedDetach(tabid);
                    }
                );
            });
        } catch (e) {
            console.error(`Error in zoomFakeChat for tab ${tabid}:`, e);
            delayedDetach(tabid);
        }
    });
}

function limitString(string, maxLength) {
	let count = 0;
	let result = "";

	for (let i = 0; i < string.length; ) {
		let char = string[i];
		let charCode = string.charCodeAt(i);

		if (charCode >= 0xd800 && charCode <= 0xdbff) {
			i++;
			char += string[i];
		}

		let charLength = char.length;

		if (count + charLength <= maxLength) {
			result += char;
			count += charLength;
			i++;
		} else {
			break;
		}
	}
	return result;
}
const KEY_EVENTS = {
  ENTER: {
    key: "Enter",
    code: "Enter",
    nativeVirtualKeyCode: 13,
    windowsVirtualKeyCode: 13,
    isComposing: false,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false
  },
  BACKSPACE: {
    key: "Backspace",
    code: "Backspace", 
    nativeVirtualKeyCode: 8,
    windowsVirtualKeyCode: 8,
    text: "",
    unmodifiedText: ""
  }
};

async function sendKeyEvent(tabId, type, keyConfig) {
  await chrome.debugger.sendCommand(
    { tabId },
    "Input.dispatchKeyEvent",
    { type, ...keyConfig }
  );
}

async function insertText(tabId, text) {
  await chrome.debugger.sendCommand(
    { tabId },
    "Input.insertText",
    { text }
  );
}

async function focusChat(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, "focusChat", (response = false) => {
      chrome.runtime.lastError;
      resolve(response);
    });
  });
}

async function generalFakeChat(tabId, message, middle = true, keypress = true, backspace = false, delayedPress = false, overrideTimeout = false) {
  try {
    if (!overrideTimeout && messageTimeout[tabId]) {
      if (Date.now() - messageTimeout[tabId] < overrideTimeout) {
        return;
      }
    }

    const isFocused = await focusChat(tabId);
    if (!isFocused) {
      await delayedDetach(tabId);
      return;
    }

    lastSentMessage = message.replace(/<\/?[^>]+(>|$)/g, "").replace(/\s\s+/g, " ");
    lastSentTimestamp = Date.now();
    lastMessageCounter = 0;
    messageTimeout[tabId] = Date.now();

    if (settings.limitcharactersstate) {
      const limit = settings.limitcharacters?.numbersetting || 200;
      message = limitString(message, limit);
    }

    if (backspace) {
      await sendKeyEvent(tabId, "rawKeyDown", KEY_EVENTS.BACKSPACE);
    }

    await insertText(tabId, message);

	if (keypress) {
	  await sendKeyEvent(tabId, "keyDown", KEY_EVENTS.ENTER);
	  await new Promise(resolve => setTimeout(resolve, 10));
	}

	if (middle) {
	  await sendKeyEvent(tabId, "char", { ...KEY_EVENTS.ENTER, text: "\r" });
	}

	if (keypress) {
	  await sendKeyEvent(tabId, "keyUp", KEY_EVENTS.ENTER);
	}
	
	if (delayedPress) {
        await sendKeyEvent(tabId, "keyDown", KEY_EVENTS.ENTER);
		await new Promise(resolve => setTimeout(resolve, 500));
		if (middle){
			await sendKeyEvent(tabId, "char", { ...KEY_EVENTS.ENTER, text: "\r" });
		}
        await sendKeyEvent(tabId, "keyUp", KEY_EVENTS.ENTER);
    }
	
	if (backspace) {
      await sendKeyEvent(tabId, "rawKeyDown", KEY_EVENTS.BACKSPACE);
    }

    await delayedDetach(tabId);

  } catch (e) {
    chrome.runtime.lastError;
    log(e);
    await delayedDetach(tabId);
  }
}

function createTab(url) {
	return new Promise(resolve => {
		chrome.windows.create({ focused: false, height: 200, width: 400, left: 0, top: 0, type: "popup", url: url }, async tab => {
			if (chrome.tabs.onUpdated){
				chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
					if (info.status === "complete" && tabId === tab.id) {
						chrome.tabs.onUpdated.removeListener(listener);
						resolve(tab);
					}
				});
			}
	 					  
		});
	});
}


function sanitizeRelay(text, textonly=false, alt = false) {
	if (!text.trim()) {
		return text;
	}
	if (!textonly){
		// convert to text from html if not text only mode
		var textArea = document.createElement('textarea');
		textArea.innerHTML = text;
		text = textArea.value;
	}
	
	text = text.replace(/(<([^>]+)>)/gi, "");
	text = text.replace(/[!#@]/g, "");
	text = text.replace(/cheer\d+/gi, " ");
	text = text.replace(/\.(?=\S(?!$))/g, " ");
	
	if (!text.trim() && alt) {
		return alt;
	}
	return text;
}

const commandLastExecuted = {};
/* 
function extractBskyUsername(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Clean up the input text but preserve case for pattern matching
  const cleanText = text.trim();

  // Handle various URL patterns
  const patterns = [
    // bsky.app/profile/username.domain format
    {
      pattern: /(?:https?:\/\/)?(?:www\.)?bsky\.app\/profile\/([a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]+)*)/i,
      transform: (match) => match[1].includes('.') ? match[1] : `${match[1]}.bsky.social`
    },
    // bsky.app/username.domain format (without /profile/)
    {
      pattern: /(?:https?:\/\/)?(?:www\.)?bsky\.app\/([a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]+)*)/i,
      transform: (match) => match[1].includes('.') ? match[1] : `${match[1]}.bsky.social`
    },
    // username.bsky.app format
    {
      pattern: /\b([a-zA-Z0-9-_]+)\.bsky\.app\b/i,
      transform: (match) => `${match[1]}.bsky.social`
    },
    // Just "Bsky.app" text (common in descriptions)
    {
      pattern: /\b(?:on\s+)?bsky\.app\b/i,
      transform: () => false
    },
    // @username format (matches even within text)
    {
      pattern: /\B@([a-zA-Z0-9-_]+)\b/i,
      transform: (match) => `${match[1].toLowerCase()}.bsky.social`
    },
    // username@bsky.social format
    {
      pattern: /\b([a-zA-Z0-9-_]+)@bsky\.social\b/i,
      transform: (match) => `${match[1].toLowerCase()}.bsky.social`
    }
  ];

  // Try each pattern in order
  for (const { pattern, transform } of patterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const result = transform(match);
      // Skip if transform returned false (for ignored patterns)
      if (result === false) continue;
      
      // Validate the final result
      if (/^[a-z0-9-_]+(?:\.[a-z0-9-_]+)+$/.test(result.toLowerCase())) {
        return result.toLowerCase();
      }
    }
  }

  return false;
}
 */
/* var BSky = {};
try {
	BSky = localStorage.getItem("x2bsky")
	if (BSky){
		BSky = JSON.parse(BSky);
		BSky = JSON.parse(BSky);
	}
} catch(e){}

 */
const patterns = {
	botReply: {
	  prefixes: ['botReplyMessageEvent', 'botReplyMessageCommand', 'botReplyMessageValue', 'botReplyMessageTimeout', 'botReplyMessageSource', 'botReplyAll'],
	  type: 'botReply'
	},
	chatCommand: {
	  prefixes: ['chatevent', 'chatcommand', 'chatwebhook', 'chatcommandtimeout'],
	  type: 'chatCommand'
	},
	timedMessage: {
	  prefixes: ['timemessageevent', 'timemessagecommand', 'timemessageinterval', 'timemessageoffset'],
	  type: 'timedMessage'
	},
	midiCommand: {
	  prefixes: ['midievent', 'midicommand', 'midinote',  'mididevice'],
	  type: 'midiCommand'
	},
};
function findExistingEvents(eventType, response) {
  const events = new Set();
  const settings = response?.settings || {};
  const pattern = patterns[eventType];
  if (!pattern) return [];

  // Check all possible settings for this event type
  Object.keys(settings).forEach(key => {
	pattern.prefixes.forEach(prefix => {
	  if (key.startsWith(prefix)) {
		const id = key.replace(prefix, '');
		if (settings[key]?.setting !== undefined || 
			settings[key]?.textsetting !== undefined || 
			settings[key]?.numbersetting !== undefined) {
		  events.add(parseInt(id));
		}
	  }
	});
  });

  return Array.from(events).sort((a, b) => a - b);
}

// expects an object; not False/Null/undefined
async function applyBotActions(data, tab = false) {
	
	if (!data.id) {
		messageCounter += 1;
		data.id = messageCounter;
	}

	try {
		
		if (settings.memberchatonly && !(data.membership || data.hasMembership)) {
			return false;
		}
		
		var altSourceType = data.type || "";
		if (altSourceType == "youtubeshorts"){
			altSourceType = "youtube";
		}
		
		if (settings.blacklistuserstoggle && settings.blacklistusers?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return null;

				const blacklist = settings.blacklistusers.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				const isBlocked = blacklist.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});

				if (isBlocked) {
					return null;
				}
			} catch(e) {
				errorlog(e);
				return null;
			}
		}
		
		if (settings.whitelistuserstoggle && settings.whitelistusers?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return null;

				const whitelist = settings.whitelistusers.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				const isWhitelisted = whitelist.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});

				if (!isWhitelisted) {
					return null;
				}
			} catch(e) {
				errorlog(e);
				return null;
			}
		}

		if (settings.mynameext){
			if (!settings.botnamesext){
				settings.botnamesext = settings.mynameext;
			}
			delete settings.mynameext;
		}
		if (!data.bot && settings.botnamesext?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return;

				const bots = settings.botnamesext.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				data.bot = bots.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});
			} catch(e) {
				errorlog(e);
				data.bot = false;
			}
		}
		if (data.bot && settings.hidebotsext) {
			return false;
		}
		if (data.bot && data.chatname && settings.hidebotnamesext) {
			data.chatname = "";
		}
		
		if (!data.host && settings.hostnamesext?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return;

				const hosts = settings.hostnamesext.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				data.host = hosts.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});
			} catch(e) {
				errorlog(e);
				data.host = false;
			}
		}
		if (data.host && settings.hidehostsext) {
			return false;
		}
		if (data.host && data.chatname && settings.hidehostnamesext) {
			data.chatname = "";
		}
		
		if (!data.mod && settings.modnamesext?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return;

				const mods = settings.modnamesext.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				data.mod = mods.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});
			} catch(e) {
				errorlog(e);
				data.mod = false;
			}
		}
		
		if (data.mod && settings.hidemodsext) {
			return false;
		}
		if (data.mod && data.chatname && settings.hidemodnamesext) {
			data.chatname = "";
		}
		
		if (!data.admin && settings.adminnames?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return;

				const admins = settings.adminnames.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				data.admin = admins.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});
			} catch(e) {
				errorlog(e);
			}
		}
		
		if (!data.vip && settings.viplistusers?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return;

				const vips = settings.viplistusers.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				data.vip = vips.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});
			} catch(e) {
				errorlog(e);
			}
		}

		if (settings.removeContentImage) {
			data.contentimg = "";
			if (!data.chatmessage && !data.hasDonation) {
				// there's no content worth sending I'm assuming
				return false;
			}
		}
		
		//
		var skipRelay = false;
		
		if (!data.timestamp) {
			data.timestamp = Date.now();
		}
		
		
		if (settings.joke && data.chatmessage && data.chatmessage.toLowerCase() === "!joke") {
			////console.log".");
			//if (Date.now() - messageTimeout > 5100) {
				var score = parseInt(Math.random() * 378);
				var joke = jokes[score];

				//messageTimeout = Date.now();
				var msg = {};
				
				if (data.reflection){
					msg.response = joke["setup"];
					sendMessageToTabs(msg, false, null, true, false, 5100);
					
					var dashboardMsg = {
						chatname: data.chatname,
						chatmessage: joke["setup"],
						chatimg: data.chatimg,
						type: data.type,
						tid: data.tid
					};
					setTimeout(
						function (dashboardMsg) {
							sendToDestinations(dashboardMsg);
						},
						100,
						dashboardMsg
					);
					
				} else {
					if (data.tid){
						msg.tid = data.tid;
					}
					msg.response = "@" + data.chatname + ", " + joke["setup"];
					sendMessageToTabs(msg, false, null, false, false, 5100);
				}
				
				skipRelay= true; // lets not relay "!joke"
				
				let punch = "@" + data.chatname + ".. " + joke["punchline"];
				
				
				if (data.reflection){
					punch =  ".. " + joke["punchline"];
					var dashboardMsg = {
						chatname: data.chatname,
						chatmessage: punch,
						chatimg: data.chatimg,
						type: data.type,
						tid: data.tid
					};
					setTimeout(
						function (dashboardMsg) {
							sendToDestinations(dashboardMsg);
						},
						5000,
						dashboardMsg
					);
				}
				
				setTimeout(
					function (tId, punchline, reflection) {
						var message = {};
						if (tId && !reflection){
							message.tid = tId;
						}
						message.response = punchline;
						sendMessageToTabs(message, false, null, reflection, false, false);
					},
					5000,
					data.tid,
					punch,
					data.reflection
				);
			//}
		}
		
		if (settings.autohi && data.chatname && data.chatmessage && !data.reflection) {
			if (["hi", "sup", "hello", "hey", "yo", "hi!", "hey!"].includes(data.chatmessage.toLowerCase())) {
				var msg = {};
				if (data.tid){
					msg.tid = data.tid;
				}
				msg.response = "Hi, @" + data.chatname + " !";
				sendMessageToTabs(msg, false, null, false, false, 60000); 
			}
		}
		
		if (settings.queuecommand && data.chatmessage && data.chatmessage.startsWith("!queue ")) {
			try {
				data.chatmessage = data.chatmessage.split("!queue ")[1].trim();
				data.queueme = true;
			} catch (e) {
				errorlog(e);
			}
		}
		
		if (settings.dice && data.chatname && data.chatmessage && (data.chatmessage.toLowerCase().startsWith("!dice ") || data.chatmessage.toLowerCase() === "!dice")) {
			//	//console.log"dice detected");
			//if (Date.now() - messageTimeout > 5100) {
				
			let maxRoll = data.chatmessage.toLowerCase().split(" ");
			if (maxRoll.length == 1) {
				maxRoll = 6;
			} else {
				maxRoll = parseInt(maxRoll[1]) || 6;
			}
			
			let roll = Math.floor(Math.random() * maxRoll) + 1;

			//messageTimeout = Date.now();
			var msg = {};
			
			if (data.tid){
				msg.tid = data.tid;
				msg.response = "@" + data.chatname + ", the bot rolled you a " + roll +".";
				sendMessageToTabs(msg, false, null, true, false, 5100); 
			}
			
			var msg2 = {};
			if (data.tid){
				msg2.tid = data.tid;
			}
			msg2.response = data.chatname +" was rolled a "+roll+" (out of "+maxRoll+")";
			sendMessageToTabs(msg2, true, null, true, false, 5100);  
			skipRelay = true;
			
			if (data.reflection){
				setTimeout(()=>{
					let diceBotMessage = {};
					diceBotMessage.chatmessage = data.chatname +" was rolled a "+roll+" (out of "+maxRoll+")";
					diceBotMessage.chatimg = "https://socialstream.ninja/icons/bot.png";
					diceBotMessage.bot = "dice";
					diceBotMessage.type = "socialstream";
					diceBotMessage.chatname = "🎲 Dice Roll";
					sendToDestinations(diceBotMessage);
				},50);
			}
			// if we send the normal messages, it will screw things up.
			//}
		}
		
		
		if (settings.relayall && data.chatmessage && !data.event && tab && data.chatmessage.includes(miscTranslations.said)){
			return null;
			
		} else if (settings.relayall && !data.reflection && !skipRelay && data.chatmessage && !data.event && tab) {
			
			if (checkExactDuplicateAlreadyRelayed(data.chatmessage, data.textonly, tab.id, false)) { 
				return null;
			}
			
			if (!data.bot) {
				//messageTimeout = Date.now();
				var msg = {};
				
				if (data.tid){
					msg.tid = data.tid;
				}
				// this should be ideall HTML stripped
				if (tab) {
					msg.url = tab.url;
				}

				let tmpmsg = sanitizeRelay(data.chatmessage, data.textonly).trim();
				if (tmpmsg) {  
					if (data.chatname){
						msg.response = sanitizeRelay(data.chatname, true, miscTranslations.someone) + miscTranslations.said + tmpmsg; 
					} else if (data.type){
						msg.response = data.type.replace(/\b\w/g, c => c.toUpperCase())+": " + tmpmsg;
					} else {
						msg.response = miscTranslations.someonesaid + tmpmsg;
					}
					sendMessageToTabs(msg, true, data, true, false, 1000); // this should be the first and only message
				}
			} else {
				sendToDestinations(data);
				return null;
			}
		} else if (settings.s10relay && !data.bot && data.chatmessage && data.chatname && !data.event){
			sendToS10(data, false, true); // we'll handle the relay logic here instead
		}
		//console.logdata);
		
		if (settings.forwardcommands2twitch && data.type && (data.type !== "twitch") && !data.reflection && !skipRelay && data.chatmessage && data.chatname && !data.event && tab && data.tid) {
			if (!data.bot && data.chatmessage.startsWith("!")) {
				//messageTimeout = Date.now();
				var msg = {};
				
				msg.tid = data.tid;
				msg.url = tab.url;
				
				msg.destination = "twitch.tv"; // sent to twitch tabs only

				msg.response =  data.chatmessage;
				
				if (!data.textonly){
					var textArea = document.createElement('textarea');
					textArea.innerHTML = msg.response;
					msg.response = textArea.value;
				}
				msg.response = msg.response.replace(/(<([^>]+)>)/gi, "");
				msg.response = msg.response.replace(/[#@]/g, "");
				msg.response = msg.response.replace(/\.(?=\S(?!$))/g, " ");
				msg.response = msg.response.trim();
				
				if (msg.response){
					sendMessageToTabs(msg, true, data, true, false, 1000);
				}
				
			} 
		} else if (settings.forwardcommands2twitch && data.type && (data.type === "twitch") && data.reflection && !skipRelay && data.chatmessage && data.chatname && !data.event && tab && data.tid) {
			if (!data.bot && data.chatmessage.startsWith("!")) {
				return null;
			}
		}

		if (data.chatmessage) {
			const botReplyEvents = settings['botReply'] || [];
			for (const id of botReplyEvents) {
				const event = settings[`botReplyMessageEvent${id}`];
				const command = settings[`botReplyMessageCommand${id}`]?.textsetting;
				const response = settings[`botReplyMessageValue${id}`]?.textsetting;
				
				if (!event?.setting || !command || !response) continue;
				
				const isFullMatch = settings.botReplyMessageFull;
				const messageMatches = isFullMatch ? 
				  data.chatmessage === command :
				  data.chatmessage.includes(command);
				  
				if (!messageMatches) continue;
				
				// Check source restrictions
				const sources = settings[`botReplyMessageSource${id}`]?.textsetting;
				if (sources?.trim()) {
				  const sourceList = sources.split(',').map(s => s.trim().toLowerCase());
				  if (!sourceList.includes(data.type?.trim().toLowerCase())) {
					continue;
				  }
				}
				
				// Send response
				const timeout = settings[`botReplyMessageTimeout${id}`]?.numbersetting || 0;
				const msg = {
				  response,
				  ...(data.tid && !settings[`botReplyAll${id}`] && { tid: data.tid })
				};
				
				sendMessageToTabs(msg, false, null, false, false, timeout);
				break; // Stop after first match
			}
			  
			const midiEvents = settings['midiCommand'] || [];
			for (const id of midiEvents) {
				const event = settings[`midievent${id}`];
				const command = settings[`midicommand${id}`]?.textsetting;
				const note = settings[`midinote${id}`]?.numbersetting;
				const device = settings[`mididevice${id}`]?.numbersetting || "";
				
				if (!event?.setting || !command || !note) continue;
				
				const escapedCommand = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const regex = new RegExp(`^${escapedCommand}\\b|\\s${escapedCommand}\\b`, 'i');
				
				if (regex.test(data.chatmessage)) {
					triggerMidiNote(parseInt(note), device);
					break;
				}
			}
		}

		if (settings.blacklist && data.chatmessage) {
			try {
				data.chatmessage = filterProfanity(data.chatmessage);
			} catch (e) {
				console.error(e);
			}
		}
		if (settings.blacklistname && data.chatname) {
			try {
				data.chatname = filterProfanity(data.chatname);
			} catch (e) {
				console.error(e);
			}
		}

		if (settings.goodwordslist) {
			if (goodWordsHashTable) {
				try {
					data.chatmessage = passGoodWords(data.chatmessage);
				} catch (e) {
					console.error(e);
				}
			}
		}
		
		if (settings.highlightevent && settings.highlightevent.textsetting.trim() && data.chatmessage && data.event) {
			const eventTexts = settings.highlightevent.textsetting.split(',').map(text => text.trim());
			if (eventTexts.some(text => data.chatmessage.includes(text))) {
				data.highlightColor = "#fff387";
			}
		}

		if (settings.highlightword && settings.highlightword.textsetting.trim() && data.chatmessage) {
			const wordTexts = settings.highlightword.textsetting.split(',').map(text => text.trim());
			if (wordTexts.some(text => data.chatmessage.includes(text))) {
				data.highlightColor = "#fff387";
			}
		}

		// applyBotActions nor applyCustomActions ; I'm going to allow for copy/paste here I think instead.

		if (settings.relaydonos && data.hasDonation && data.chatname && data.type) {
			//if (Date.now() - messageTimeout > 100) {
				// respond to "1" with a "1" automatically; at most 1 time per 100ms.

				if (data.chatmessage.includes(". Thank you") && data.chatmessage.includes(" donated ")) {
					return null;
				} // probably a reply

				//messageTimeout = Date.now();
				var msg = {};
				if (data.tid){
					msg.tid = data.tid;
				}
				if (tab) {
					msg.url = tab.url;
				}

				msg.response = sanitizeRelay(data.chatname, true, "Someone") + " on " + data.type + " donated " + sanitizeRelay(data.hasDonation, true) + ". Thank you";
				sendMessageToTabs(msg, true, null, false, false, 100);
			//}
		}
		

		if (settings.giphyKey && settings.giphyKey.textsetting && settings.giphy && data.chatmessage && data.chatmessage.indexOf("!giphy") != -1 && !data.contentimg) {
			var searchGif = data.chatmessage;
			searchGif = searchGif.replaceAll("!giphy", "").trim();
			if (searchGif) {
				var order = 0;
				if (settings.randomgif) {
					order = parseInt(Math.random() * 15);
				}
				var gurl = await fetch("https://api.giphy.com/v1/gifs/search?q=" + encodeURIComponent(searchGif) + "&api_key=" + settings.giphyKey.textsetting + "&limit=1&offset=" + order)
					.then(response => response.json())
					.then(response => {
						try {
							return response.data[0].images.downsized_large.url;
						} catch (e) {
							console.error(e);
							return false;
						}
					});
				if (gurl) {
					data.contentimg = gurl;
					if (settings.hidegiphytrigger) {
						data.chatmessage = "";
					}
				} else if (!data.hasDonation && !data.contentimg) {
					return false;
				}
			}
		} else if (settings.giphyKey && settings.giphyKey.textsetting && settings.giphy2 && data.chatmessage && data.chatmessage.indexOf("#") != -1 && !data.contentimg) {
			var xx = data.chatmessage.split(" ");
			for (var i = 0; i < xx.length; i++) {
				var word = xx[i];
				if (!word.startsWith("#")) {
					continue;
				}
				word = word.replaceAll("#", " ").trim();
				if (word) {
					var order = 0;
					if (i + 1 < xx.length) {
						order = parseInt(xx[i + 1]) || 0;
					}

					if (settings.hidegiphytrigger) {
						if (data.chatmessage.includes("#" + word + " " + order)) {
							data.chatmessage = data.chatmessage.replace("#" + word + " " + order, "");
						} else if (data.chatmessage.includes("#" + word + " ")) {
							data.chatmessage = data.chatmessage.replace("#" + word + " ", "");
						} else {
							data.chatmessage = data.chatmessage.replace("#" + word, "");
						}
						data.chatmessage = data.chatmessage.trim();
					}

					if (settings.randomgif) {
						order = parseInt(Math.random() * 15);
					}
					var gurl = await fetch("https://api.giphy.com/v1/gifs/search?q=" + encodeURIComponent(word) + "&api_key=" + settings.giphyKey.textsetting + "&limit=1&offset=" + order)
						.then(response => response.json())
						.then(response => {
							try {
								return response.data[0].images.downsized_large.url;
							} catch (e) {
								return false;
							}
						});

					if (gurl) {
						data.contentimg = gurl;
						break;
					}

					if (!data.contentimg && !data.chatmessage && !data.hasDonation) {
						return false;
					}
				}
			}
			// curl "https://tenor.googleapis.com/v2/search?q=excited&key=&client_key=my_test_app&limit=8"
		} else if (settings.tenorKey && settings.tenorKey.textsetting && settings.tenor && data.chatmessage && data.chatmessage.indexOf("!tenor") != -1 && !data.contentimg) {
			var searchGif = data.chatmessage;
			searchGif = searchGif.replaceAll("!tenor", "").trim();
			if (searchGif) {
				var order = 1;
				if (settings.randomgif) {
					order = parseInt(Math.random() * 15) + 1;
				}
				var gurl = await fetch("https://tenor.googleapis.com/v2/search?media_filter=tinygif,tinywebp_transparent&q=" + encodeURIComponent(searchGif) + "&key=" + settings.tenorKey.textsetting + "&limit=" + order)
					.then(response => response.json())
					.then(response => {
						try {
							if (response.results.length < order - 1) {
								order = response.results.length;
							}
							if (response.results[order - 1].media_formats.tinywebp_transparent) {
								return response.results[order - 1].media_formats.tinywebp_transparent.url;
							} else if (response.results[order - 1].media_formats.tinygif) {
								return response.results[order - 1].media_formats.tinygif.url;
							} else {
								return false;
							}
						} catch (e) {
							console.error(e);
							return false;
						}
					});
				if (gurl) {
					data.contentimg = gurl;
					if (settings.hidegiphytrigger) {
						data.chatmessage = "";
					}
				} else if (!data.hasDonation && !data.contentimg) {
					return false;
				}
			}
		} else if (settings.tenorKey && settings.tenorKey.textsetting && settings.giphy2 && data.chatmessage && data.chatmessage.indexOf("##") != -1 && !data.contentimg) {
			var xx = data.chatmessage.split(" ");
			for (var i = 0; i < xx.length; i++) {
				var word = xx[i];
				if (!word.startsWith("##")) {
					continue;
				}
				word = word.trim();
				search_word = word.replace(/[-_]/g, " ");
				search_word = search_word.replace(/[^\w\s]/g, "");

				if (word) {
					var order = 1; // Start from 1
					if (i + 1 < xx.length) {
						order = parseInt(xx[i + 1]) || 1;
					}

					if (settings.hidegiphytrigger) {
						var re = new RegExp(word + " " + order, "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						re = new RegExp(word + " ", "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						re = new RegExp(word, "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						data.chatmessage = data.chatmessage.trim();
					}
					var skip = false;
					if (i + 1 < xx.length) {
						if (xx[i + 1] == order) {
							skip = true;
						}
					}
					if (!skip && settings.randomgif) {
						order = parseInt(Math.random() * 8) + 1; // Adjust for 1-based indexing and 8 stickers randomization, because less actual amount
					}
					if (order > 40) {
						order = 40;
					}
					var gurl = await fetch("https://tenor.googleapis.com/v2/search?&searchfilter=sticker&media_filter=tinygif,tinywebp_transparent&q=" + encodeURIComponent(search_word) + "&key=" + settings.tenorKey.textsetting + "&limit=" + order)
						.then(response => response.json())
						.then(response => {
							try {
								if (response.results.length < order - 1) {
									order = response.results.length;
								}
								if (response.results[order - 1].media_formats.tinywebp_transparent) {
									return response.results[order - 1].media_formats.tinywebp_transparent.url;
								} else if (response.results[order - 1].media_formats.tinygif) {
									return response.results[order - 1].media_formats.tinygif.url;
								} else {
									return false;
								}
							} catch (e) {
								console.error(e);
								return false;
							}
						});

					if (gurl) {
						data.contentimg = gurl;
						break;
					}

					if (!data.contentimg && !data.chatmessage && !data.hasDonation) {
						return false;
					}
				}
			}
		} else if (settings.tenorKey && settings.tenorKey.textsetting && settings.giphy2 && data.chatmessage && data.chatmessage.indexOf("#") != -1 && !data.contentimg) {
			var xx = data.chatmessage.split(" ");
			for (var i = 0; i < xx.length; i++) {
				var word = xx[i];
				if (!word.startsWith("#")) {
					continue;
				}
				word = word.trim();
				search_word = word.replace(/[-_]/g, " ");
				search_word = search_word.replace(/[^\w\s]/g, "");

				if (word) {
					var order = 1; // Start from 1
					if (i + 1 < xx.length) {
						order = parseInt(xx[i + 1]) || 1;
					}

					if (settings.hidegiphytrigger) {
						var re = new RegExp(word + " " + order, "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						re = new RegExp(word + " ", "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						re = new RegExp(word, "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						data.chatmessage = data.chatmessage.trim();
					}
					var skip = false;
					if (i + 1 < xx.length) {
						if (xx[i + 1] == order) {
							skip = true;
						}
					}
					if (!skip && settings.randomgif) {
						order = parseInt(Math.random() * 15) + 1; // Adjust for 1-based indexing
					}
					if (order > 40) {
						order = 40;
					}
					var gurl = await fetch("https://tenor.googleapis.com/v2/search?media_filter=tinygif,tinywebp_transparent&q=" + encodeURIComponent(search_word) + "&key=" + settings.tenorKey.textsetting + "&limit=" + order)
						.then(response => response.json())
						.then(response => {
							try {
								if (response.results.length < order - 1) {
									order = response.results.length;
								}
								if (response.results[order - 1].media_formats.tinywebp_transparent) {
									return response.results[order - 1].media_formats.tinywebp_transparent.url;
								} else if (response.results[order - 1].media_formats.tinygif) {
									return response.results[order - 1].media_formats.tinygif.url;
								} else {
									return false;
								}
							} catch (e) {
								console.error(e);
								return false;
							}
						});

					if (gurl) {
						data.contentimg = gurl;
						break;
					}

					if (!data.contentimg && !data.chatmessage && !data.hasDonation) {
						return false;
					}
				}
			}
		}


	} catch (e) {
		console.error(e);
	}

	if (settings.addkarma) {
		try {
			if (!sentimentAnalysisLoaded) {
				loadSentimentAnalysis();
				data.karma = inferSentiment(data.chatmessage);
			} else {
				data.karma = inferSentiment(data.chatmessage);
			}
		} catch (e) {}
	}

	if (settings.comment_background) {
		if (!data.backgroundColor) {
			data.backgroundColor = settings.comment_background.textsetting;
		}
	}
	if (settings.comment_color) {
		if (!data.textColor) {
			data.textColor = settings.comment_color.textsetting;
		}
	}
	if (settings.name_background) {
		if (!data.backgroundNameColor) {
			data.backgroundNameColor = "background-color:" + settings.name_background.textsetting + ";";
		}
	}
	if (settings.name_color) {
		if (!data.textNameColor) {
			data.textNameColor = "color:" + settings.name_color.textsetting + ";";
		}
	}

	if (settings.defaultavatar) {
		if (settings.defaultavatar.textsetting && !data.chatimg) {
			data.chatimg = settings.defaultavatar.textsetting;
		}
	}

	try {
		// webhook for configured custom chat commands
		// 'chatevent', 'chatcommand', 'chatwebhook', 'chatcommandtimeout'
		const chatCommand = settings['chatCommand'] || [];
		for (const i of chatCommand) {
			if (data.chatmessage && settings["chatevent" + i] && settings["chatcommand" + i] && settings["chatwebhook" + i]) {
				let matches = false;
				if (settings.chatwebhookstrict && (data.chatmessage === settings["chatcommand" + i].textsetting)) {
					matches = true;
				} else if (!settings.chatwebhookstrict && (data.chatmessage.toLowerCase().startsWith(settings["chatcommand" + i].textsetting.toLowerCase()))) {
					matches = true;
				}
				
				if (matches) {
					const now = Date.now();
					const commandTimeout = settings["chatcommandtimeout" + i] ? parseInt(settings["chatcommandtimeout" + i].numbersetting) : 0; 
					
					// Check if enough time has passed since last execution
					if (!commandLastExecuted[i] || (now - commandLastExecuted[i] >= commandTimeout)) {
						// Update last execution time
						commandLastExecuted[i] = now;
						
						let URL = settings["chatwebhook" + i].textsetting;
						if (settings.chatwebhookpost) {
							if (!URL.startsWith("http")) {
								if (!URL.includes("://")) {
									URL = "https://" + URL;
								}
							}
							ajax(data, URL, "POST");
						} else {
							if (!URL.startsWith("http")) {
								if (!URL.includes("://")) {
									URL = "https://" + URL;
									fetch(URL).catch(console.error);
								} else {
									window.open(URL, "_blank");
								}
							} else {
								fetch(URL).catch(console.error);
							}
						}
					}
				}
			}
		}
	} catch (e) {
		console.error(e);
	}
	try {
		if (settings.hypemode) {
			processHype(data);
		}
	} catch (e) {
		console.error(e);
	}
	try {
		if (settings.waitlistmode) {
			processWaitlist(data);
		}
	} catch (e) {
		console.error(e);
	}
	try {
		
		if (settings.allowLLMSummary && data.chatmessage && data.chatmessage.startsWith("!summary")){
			if (settings.modLLMonly){
				if (data.mod){
					return await processSummary(data);
				}
			} else {
				return await processSummary(data);
			}
		}
		if (settings.ollamaCensorBot){
			try{
				if (settings.ollamaCensorBotBlockMode){
					let good = false;
					if (data.chatmessage && data.chatmessage.length <= 3) {
						// For very short messages, use the history-aware censoring
						//try {
							good = await censorMessageWithLLM(data); // # TODO: IMPROVE AND FIX.
							//good = await censorMessageWithHistory(data);
						//} catch(e){
						//	good = await censorMessageWithLLM(data);
						//}
					} else {
						// For longer messages, use the existing single-message censoring
						good = await censorMessageWithLLM(data);
					}					
					
					if (!good){
						return false;
					}
				} else {
					censorMessageWithLLM(data);
				}
			} catch(e){
				console.log(e); // ai.js file missing?
			}
		}
		if (settings.ollama){
			try{
				if (settings.modLLMonly){
					if (data.mod){
						processMessageWithOllama(data);
					}
				} else {
					processMessageWithOllama(data);
				}
			} catch(e){
				console.log(e); // ai.js file missing?
			}
		}
	} catch (e) {
		console.error(e);
	}
	
	return data;
}

function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function ensureFunction(functionName, scriptUrl) {
    if (typeof window[functionName] === 'function') {
        return Promise.resolve();
    }
    
    return loadScript(scriptUrl).then(() => {
        if (typeof window[functionName] !== 'function') {
            throw new Error(`Function ${functionName} not found after loading script`);
        }
    });
}


function decodeAndCleanHtml(input, spaces=false) {
    var doc = new DOMParser().parseFromString(input, 'text/html');
    doc.querySelectorAll('img[alt]').forEach(img => {
        var alt = img.getAttribute('alt');
        img.parentNode.replaceChild(doc.createTextNode(alt), img);
    });
	if (spaces){
		doc.querySelectorAll('br').forEach(br => {
			br.replaceWith(doc.createTextNode('\n'));
		});
	}
    var decodedInput = doc.body.textContent || "";
    return decodedInput.replace(/\s\s+/g, " ").trim();
}

var store = [];

var MidiInit = false;

try {
	function setupMIDI(MidiInput = false) {
		// setting up MIDI hotkey support.
		var midiChannel = 1;
		if (MidiInput) {
			MidiInput.addListener("controlchange", function (e) {
				midiHotkeysCommand(e.controller.number, e.rawValue);
			});

			MidiInput.addListener("noteon", function (e) {
				var note = e.note.name + e.note.octave;
				var velocity = e.velocity || false;
				midiHotkeysNote(note, velocity);
			});
		} else {
			for (var i = 0; i < WebMidi.inputs.length; i++) {
				MidiInput = WebMidi.inputs[i];

				MidiInput.addListener("controlchange", function (e) {
					if (settings.midi && isExtensionOn) {
						midiHotkeysCommand(e.controller.number, e.rawValue);
					}
				});

				MidiInput.addListener("noteon", function (e) {
					if (settings.midi && isExtensionOn) {
						var note = e.note.name + e.note.octave;
						var velocity = e.velocity || false;
						midiHotkeysNote(note, velocity);
					}
				});
			}
		}
	}

	function toggleMidi() {
		if (!("midi" in settings)) {
			return;
		}
		if (settings.midi) {
			if (MidiInit === false) {
				MidiInit = true;

				WebMidi.enable().then(() => {
					setupMIDI();
					WebMidi.addListener("connected", function (e) {
						setupMIDI(e.target._midiInput);
					});
					WebMidi.addListener("disconnected", function (e) {});
					// Your MIDI outputs are now ready for triggering
				});
			} else {
				try {
					WebMidi.enable();
				} catch (e) {}
			}
		} else if (MidiInit) {
			try {
				WebMidi.disable();
			} catch (e) {}
		}
	}
} catch (e) {
	log(e);
}

function triggerMidiNote(note = 64, device=false) {
    if (!WebMidi.enabled) {
		try {
			WebMidi.enable();
			console.log("Midi enabled");
		} catch (e) {
			console.warn(e);
		}
	}
    try {
		if (settings.midiDeviceSelect?.optionsetting || device){
			const selectedOutput = WebMidi.outputs.find(
				(output) => output.name === (device || settings.midiDeviceSelect.optionsetting)
			);
			if (selectedOutput) {
				selectedOutput.send([0x90, note, 127]);  // Note On
				selectedOutput.send([0x80, note, 0]);    // Note Off
			} else {
				console.warn("MIDI device not found: "+(device || settings.midiDeviceSelect.optionsetting));
			}
		} else {
			WebMidi.outputs.forEach(output => {
				//output.playNote(note);
				output.send([0x90, note, 127]);  // Note On
				output.send([0x80, note, 0]);    // Note Off
			});
		}
	} catch(e){
		console.warn(e);
	}
}

function midiHotkeysCommand(number, value) {
	// MIDI control change commands
	if (number == 102 && value == 1) {
		respondToAll("1");
	} else if (number == 102 && value == 2) {
		respondToAll("LUL");
	} else if (number == 102 && value == 3) {
		tellAJoke();
	} else if (number == 102 && value == 4) {
		var msg = {};
		msg.forward = false; // clears our featured chat overlay
		sendDataP2P(msg);
	} else if (number == 102 && value == 5) {
        selectRandomWaitlist();
	} else if (number == 102) {
		if (settings.midiConfig && value + "" in settings.midiConfig) {
			var msg = settings.midiConfig[value + ""];
			respondToAll(msg);
		}
	}
}

function respondToAll(msg, timeout=false) {
	//messageTimeout = Date.now();
	var data = {};
	data.response = msg;
	sendMessageToTabs(data, false, null, false, false, timeout);
	//sendMessageToTabs(data);
}

function midiHotkeysNote(note, velocity) {
	// In case you want to use NOTES instead of Control Change commands; like if you have a MIDI piano
}

function tellAJoke() { 
	var score = parseInt(Math.random() * 378);
	var joke = jokes[score];
	//messageTimeout = Date.now();
	var data = {};
	data.response = joke["setup"] + "..  " + joke["punchline"] + " LUL";
	//sendMessageToTabs(data);
	sendMessageToTabs(data, false, null, false, false, false);
}

if (chrome.browserAction && chrome.browserAction.setIcon){
	chrome.browserAction.setIcon({ path: "/icons/off.png" });
}
if (chrome.action && chrome.action.setIcon){
	chrome.action.setIcon({ path: "/icons/off.png" });
}

async function fetchData(url) {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			return false;
		}
		return await response.json();
	} catch (error) {
		return false;
	}
}

window.onload = async function () {
	let programmedSettings = await fetchData("settings.json"); // allows you to load the settings from a file.
	if (programmedSettings && typeof programmedSettings === "object") {
		log("Loading override settings via settongs.json");
		loadSettings(programmedSettings, true);
	} else {
		log("Loading settings from the main file into the background.js");
		chrome.storage.sync.get(properties, function (item) { // sync shouldn't have our settings ; just stream ID and current extension state
			// we load this at the end, so not to have a race condition loading MIDI or whatever else. (essentially, __main__)
			
			//console.warn(item);
			
			//log("properties", item);
			if (isSSAPP && item) {
				loadSettings(item, false); 
				return;
			}
			
			if (item?.settings) {
				// ssapp
				alert("upgrading from old storage structure format to new...");
				chrome.storage.sync.remove(["settings"], function (Items) {
					// ignored
					log("upgrading from sync to local storage");
				});
				chrome.storage.local.get(["settings"], function (item2) {
					if (item2?.settings){
						item = [...item, ...item2];
					}
					if (item?.settings){
						chrome.storage.local.set({
							settings: item.settings
						});
					}
					if (item){
						loadSettings(item, false);
					}
				});
				
			} else {
				loadSettings(item, false);
				chrome.storage.local.get(["settings"], function (item2) {
					if (item2){
						//console.warn(item2);
						loadSettings(item2, false);
					}
				});
			}
		});
	}
};

var jokes = [
	// jokes from reddit; sourced from github.
	{
		id: 1,
		type: "general",
		setup: "What did the fish say when it hit the wall?",
		punchline: "Dam."
	},
	{
		id: 2,
		type: "general",
		setup: "How do you make a tissue dance?",
		punchline: "You put a little boogie on it."
	},
	{
		id: 3,
		type: "general",
		setup: "What's Forrest Gump's password?",
		punchline: "1Forrest1"
	},
	{
		id: 4,
		type: "general",
		setup: "What do you call a belt made out of watches?",
		punchline: "A waist of time."
	},
	{
		id: 5,
		type: "general",
		setup: "Why can't bicycles stand on their own?",
		punchline: "They are two tired"
	},
	{
		id: 6,
		type: "general",
		setup: "How does a train eat?",
		punchline: "It goes chew, chew"
	},
	{
		id: 7,
		type: "general",
		setup: "What do you call a singing Laptop",
		punchline: "A Dell"
	},
	{
		id: 8,
		type: "general",
		setup: "How many lips does a flower have?",
		punchline: "Tulips"
	},
	{
		id: 9,
		type: "general",
		setup: "How do you organize an outer space party?",
		punchline: "You planet"
	},
	{
		id: 10,
		type: "general",
		setup: "What kind of shoes does a thief wear?",
		punchline: "Sneakers"
	},
	{
		id: 11,
		type: "general",
		setup: "What's the best time to go to the dentist?",
		punchline: "Tooth hurty."
	},
	{
		id: 12,
		type: "knock-knock",
		setup: "Knock knock. \n Who's there? \n A broken pencil. \n A broken pencil who?",
		punchline: "Never mind. It's pointless."
	},
	{
		id: 13,
		type: "knock-knock",
		setup: "Knock knock. \n Who's there? \n Cows go. \n Cows go who?",
		punchline: "No, cows go moo."
	},
	{
		id: 14,
		type: "knock-knock",
		setup: "Knock knock. \n Who's there? \n Little old lady. \n Little old lady who?",
		punchline: "I didn't know you could yodel!"
	},
	{
		id: 15,
		type: "programming",
		setup: "What's the best thing about a Boolean?",
		punchline: "Even if you're wrong, you're only off by a bit."
	},
	{
		id: 16,
		type: "programming",
		setup: "What's the object-oriented way to become wealthy?",
		punchline: "Inheritance"
	},
	{
		id: 17,
		type: "programming",
		setup: "Where do programmers like to hangout?",
		punchline: "The Foo Bar."
	},
	{
		id: 18,
		type: "programming",
		setup: "Why did the programmer quit his job?",
		punchline: "Because he didn't get arrays."
	},
	{
		id: 19,
		type: "general",
		setup: "Did you hear about the two silk worms in a race?",
		punchline: "It ended in a tie."
	},
	{
		id: 20,
		type: "general",
		setup: "What do you call a laughing motorcycle?",
		punchline: "A Yamahahahaha."
	},
	{
		id: 21,
		type: "general",
		setup: "A termite walks into a bar and says...",
		punchline: "'Where is the bar tended?'"
	},
	{
		id: 22,
		type: "general",
		setup: "What does C.S. Lewis keep at the back of his wardrobe?",
		punchline: "Narnia business!"
	},
	{
		id: 23,
		type: "programming",
		setup: "Why do programmers always mix up Halloween and Christmas?",
		punchline: "Because Oct 31 == Dec 25"
	},
	{
		id: 24,
		type: "programming",
		setup: "A SQL query walks into a bar, walks up to two tables and asks...",
		punchline: "'Can I join you?'"
	},
	{
		id: 25,
		type: "programming",
		setup: "How many programmers does it take to change a lightbulb?",
		punchline: "None that's a hardware problem"
	},
	{
		id: 26,
		type: "programming",
		setup: "If you put a million monkeys at a million keyboards, one of them will eventually write a Java program",
		punchline: "the rest of them will write Perl"
	},
	{
		id: 27,
		type: "programming",
		setup: "['hip', 'hip']",
		punchline: "(hip hip array)"
	},
	{
		id: 28,
		type: "programming",
		setup: "To understand what recursion is...",
		punchline: "You must first understand what recursion is"
	},
	{
		id: 29,
		type: "programming",
		setup: "There are 10 types of people in this world...",
		punchline: "Those who understand binary and those who don't"
	},
	{
		id: 30,
		type: "general",
		setup: "What did the duck say when he bought lipstick?",
		punchline: "Put it on my bill"
	},
	{
		id: 31,
		type: "general",
		setup: "What happens to a frog's car when it breaks down?",
		punchline: "It gets toad away"
	},
	{
		id: 32,
		type: "general",
		setup: "did you know the first French fries weren't cooked in France?",
		punchline: "they were cooked in Greece"
	},
	{
		id: 33,
		type: "programming",
		setup: "Which song would an exception sing?",
		punchline: "Can't catch me - Avicii"
	},
	{
		id: 34,
		type: "knock-knock",
		setup: "Knock knock. \n Who's there? \n Opportunity.",
		punchline: "That is impossible. Opportunity doesn’t come knocking twice!"
	},
	{
		id: 35,
		type: "programming",
		setup: "Why do Java programmers wear glasses?",
		punchline: "Because they don't C#"
	},
	{
		id: 36,
		type: "general",
		setup: "Why did the mushroom get invited to the party?",
		punchline: "Because he was a fungi."
	},
	{
		id: 37,
		type: "general",
		setup: "Why did the mushroom get invited to the party?",
		punchline: "Because he was a fungi."
	},
	{
		id: 38,
		type: "general",
		setup: "I'm reading a book about anti-gravity...",
		punchline: "It's impossible to put down"
	},
	{
		id: 39,
		type: "general",
		setup: "If you're American when you go into the bathroom, and American when you come out, what are you when you're in there?",
		punchline: "European"
	},
	{
		id: 40,
		type: "general",
		setup: "Want to hear a joke about a piece of paper?",
		punchline: "Never mind...it's tearable"
	},
	{
		id: 41,
		type: "general",
		setup: "I just watched a documentary about beavers.",
		punchline: "It was the best dam show I ever saw"
	},
	{
		id: 42,
		type: "general",
		setup: "If you see a robbery at an Apple Store...",
		punchline: "Does that make you an iWitness?"
	},
	{
		id: 43,
		type: "general",
		setup: "A ham sandwhich walks into a bar and orders a beer. The bartender says...",
		punchline: "I'm sorry, we don't serve food here"
	},
	{
		id: 44,
		type: "general",
		setup: "Why did the Clydesdale give the pony a glass of water?",
		punchline: "Because he was a little horse"
	},
	{
		id: 45,
		type: "general",
		setup: "If you boil a clown...",
		punchline: "Do you get a laughing stock?"
	},
	{
		id: 46,
		type: "general",
		setup: "Finally realized why my plant sits around doing nothing all day...",
		punchline: "He loves his pot."
	},
	{
		id: 47,
		type: "general",
		setup: "Don't look at the eclipse through a colander.",
		punchline: "You'll strain your eyes."
	},
	{
		id: 48,
		type: "general",
		setup: "I bought some shoes from a drug dealer.",
		punchline: "I don't know what he laced them with, but I was tripping all day!"
	},
	{
		id: 49,
		type: "general",
		setup: "Why do chicken coops only have two doors?",
		punchline: "Because if they had four, they would be chicken sedans"
	},
	{
		id: 50,
		type: "general",
		setup: "What do you call a factory that sells passable products?",
		punchline: "A satisfactory"
	},
	{
		id: 51,
		type: "general",
		setup: "When a dad drives past a graveyard: Did you know that's a popular cemetery?",
		punchline: "Yep, people are just dying to get in there"
	},
	{
		id: 52,
		type: "general",
		setup: "Why did the invisible man turn down the job offer?",
		punchline: "He couldn't see himself doing it"
	},
	{
		id: 53,
		type: "general",
		setup: "How do you make holy water?",
		punchline: "You boil the hell out of it"
	},
	{
		id: 54,
		type: "general",
		setup: "I had a dream that I was a muffler last night.",
		punchline: "I woke up exhausted!"
	},
	{
		id: 55,
		type: "general",
		setup: "Why is peter pan always flying?",
		punchline: "Because he neverlands"
	},
	{
		id: 56,
		type: "programming",
		setup: "How do you check if a webpage is HTML5?",
		punchline: "Try it out on Internet Explorer"
	},
	{
		id: 57,
		type: "general",
		setup: "What do you call a cow with no legs?",
		punchline: "Ground beef!"
	},
	{
		id: 58,
		type: "general",
		setup: "I dropped a pear in my car this morning.",
		punchline: "You should drop another one, then you would have a pair."
	},
	{
		id: 59,
		type: "general",
		setup: "Lady: How do I spread love in this cruel world?",
		punchline: "Random Dude: [...💘]"
	},
	{
		id: 60,
		type: "programming",
		setup: "A user interface is like a joke.",
		punchline: "If you have to explain it then it is not that good."
	},
	{
		id: 61,
		type: "knock-knock",
		setup: "Knock knock. \n Who's there? \n Hatch. \n Hatch who?",
		punchline: "Bless you!"
	},
	{
		id: 62,
		type: "general",
		setup: "What do you call sad coffee?",
		punchline: "Despresso."
	},
	{
		id: 63,
		type: "general",
		setup: "Why did the butcher work extra hours at the shop?",
		punchline: "To make ends meat."
	},
	{
		id: 64,
		type: "general",
		setup: "Did you hear about the hungry clock?",
		punchline: "It went back four seconds."
	},
	{
		id: 65,
		type: "general",
		setup: "Well...",
		punchline: "That’s a deep subject."
	},
	{
		id: 66,
		type: "general",
		setup: "Did you hear the story about the cheese that saved the world?",
		punchline: "It was legend dairy."
	},
	{
		id: 67,
		type: "general",
		setup: "Did you watch the new comic book movie?",
		punchline: "It was very graphic!"
	},
	{
		id: 68,
		type: "general",
		setup: "I started a new business making yachts in my attic this year...",
		punchline: "The sails are going through the roof."
	},
	{
		id: 69,
		type: "general",
		setup: "I got hit in the head by a soda can, but it didn't hurt that much...",
		punchline: "It was a soft drink."
	},
	{
		id: 70,
		type: "general",
		setup: "I can't tell if i like this blender...",
		punchline: "It keeps giving me mixed results."
	},
	{
		id: 71,
		type: "general",
		setup: "I couldn't get a reservation at the library...",
		punchline: "They were fully booked."
	},
	{
		id: 72,
		type: "programming",
		setup: "I was gonna tell you a joke about UDP...",
		punchline: "...but you might not get it."
	},
	{
		id: 73,
		type: "programming",
		setup: "The punchline often arrives before the set-up.",
		punchline: "Do you know the problem with UDP jokes?"
	},
	{
		id: 74,
		type: "programming",
		setup: "Why do C# and Java developers keep breaking their keyboards?",
		punchline: "Because they use a strongly typed language."
	},
	{
		id: 75,
		type: "general",
		setup: "What do you give to a lemon in need?",
		punchline: "Lemonaid."
	},
	{
		id: 76,
		type: "general",
		setup: "Never take advice from electrons.",
		punchline: "They are always negative."
	},
	{
		id: 78,
		type: "general",
		setup: "Hey, dad, did you get a haircut?",
		punchline: "No, I got them all cut."
	},
	{
		id: 79,
		type: "general",
		setup: "What time is it?",
		punchline: "I don't know... it keeps changing."
	},
	{
		id: 80,
		type: "general",
		setup: 'A weasel walks into a bar. The bartender says, "Wow, I\'ve never served a weasel before. What can I get for you?"',
		punchline: "Pop,goes the weasel."
	},
	{
		id: 81,
		type: "general",
		setup: "Bad at golf?",
		punchline: "Join the club."
	},
	{
		id: 82,
		type: "general",
		setup: "Can a kangaroo jump higher than the Empire State Building?",
		punchline: "Of course. The Empire State Building can't jump."
	},
	{
		id: 83,
		type: "general",
		setup: "Can February march?",
		punchline: "No, but April may."
	},
	{
		id: 84,
		type: "general",
		setup: "Can I watch the TV?",
		punchline: "Yes, but don’t turn it on."
	},
	{
		id: 85,
		type: "general",
		setup: "Dad, can you put my shoes on?",
		punchline: "I don't think they'll fit me."
	},
	{
		id: 86,
		type: "general",
		setup: "Did you hear about the bread factory burning down?",
		punchline: "They say the business is toast."
	},
	{
		id: 87,
		type: "general",
		setup: "Did you hear about the chameleon who couldn't change color?",
		punchline: "They had a reptile dysfunction."
	},
	{
		id: 88,
		type: "general",
		setup: "Did you hear about the cheese factory that exploded in France?",
		punchline: "There was nothing left but de Brie."
	},
	{
		id: 89,
		type: "general",
		setup: "Did you hear about the cow who jumped over the barbed wire fence?",
		punchline: "It was udder destruction."
	},
	{
		id: 90,
		type: "general",
		setup: "Did you hear about the guy who invented Lifesavers?",
		punchline: "They say he made a mint."
	},
	{
		id: 91,
		type: "general",
		setup: "Did you hear about the guy whose whole left side was cut off?",
		punchline: "He's all right now."
	},
	{
		id: 92,
		type: "general",
		setup: "Did you hear about the kidnapping at school?",
		punchline: "It's ok, he woke up."
	},
	{
		id: 93,
		type: "general",
		setup: "Did you hear about the Mexican train killer?",
		punchline: "He had loco motives"
	},
	{
		id: 94,
		type: "general",
		setup: "Did you hear about the new restaurant on the moon?",
		punchline: "The food is great, but there’s just no atmosphere."
	},
	{
		id: 95,
		type: "general",
		setup: "Did you hear about the runner who was criticized?",
		punchline: "He just took it in stride"
	},
	{
		id: 96,
		type: "general",
		setup: "Did you hear about the scientist who was lab partners with a pot of boiling water?",
		punchline: "He had a very esteemed colleague."
	},
	{
		id: 97,
		type: "general",
		setup: "Did you hear about the submarine industry?",
		punchline: "It really took a dive..."
	},
	{
		id: 98,
		type: "general",
		setup: "Did you hear that David lost his ID in prague?",
		punchline: "Now we just have to call him Dav."
	},
	{
		id: 99,
		type: "general",
		setup: "Did you hear that the police have a warrant out on a midget psychic ripping people off?",
		punchline: 'It reads "Small medium at large."'
	},
	{
		id: 100,
		type: "general",
		setup: "Did you hear the joke about the wandering nun?",
		punchline: "She was a roman catholic."
	},
	{
		id: 101,
		type: "general",
		setup: "Did you hear the news?",
		punchline: "FedEx and UPS are merging. They’re going to go by the name Fed-Up from now on."
	},
	{
		id: 102,
		type: "general",
		setup: "Did you hear the one about the guy with the broken hearing aid?",
		punchline: "Neither did he."
	},
	{
		id: 103,
		type: "general",
		setup: "Did you know crocodiles could grow up to 15 feet?",
		punchline: "But most just have 4."
	},
	{
		id: 104,
		type: "general",
		setup: "What do ghosts call their true love?",
		punchline: "Their ghoul-friend"
	},
	{
		id: 105,
		type: "general",
		setup: "Did you know that protons have mass?",
		punchline: "I didn't even know they were catholic."
	},
	{
		id: 106,
		type: "general",
		setup: "Did you know you should always take an extra pair of pants golfing?",
		punchline: "Just in case you get a hole in one."
	},
	{
		id: 107,
		type: "general",
		setup: "Do I enjoy making courthouse puns?",
		punchline: "Guilty"
	},
	{
		id: 108,
		type: "general",
		setup: "Do you know where you can get chicken broth in bulk?",
		punchline: "The stock market."
	},
	{
		id: 109,
		type: "general",
		setup: "Do you want a brief explanation of what an acorn is?",
		punchline: "In a nutshell, it's an oak tree."
	},
	{
		id: 110,
		type: "general",
		setup: "Ever wondered why bees hum?",
		punchline: "It's because they don't know the words."
	},
	{
		id: 111,
		type: "general",
		setup: "Have you ever heard of a music group called Cellophane?",
		punchline: "They mostly wrap."
	},
	{
		id: 112,
		type: "general",
		setup: "Have you heard of the band 1023MB?",
		punchline: "They haven't got a gig yet."
	},
	{
		id: 113,
		type: "general",
		setup: "Have you heard the rumor going around about butter?",
		punchline: "Never mind, I shouldn't spread it."
	},
	{
		id: 114,
		type: "general",
		setup: "How are false teeth like stars?",
		punchline: "They come out at night!"
	},
	{
		id: 115,
		type: "general",
		setup: "How can you tell a vampire has a cold?",
		punchline: "They start coffin."
	},
	{
		id: 116,
		type: "general",
		setup: "How come a man driving a train got struck by lightning?",
		punchline: "He was a good conductor."
	},
	{
		id: 117,
		type: "general",
		setup: "How come the stadium got hot after the game?",
		punchline: "Because all of the fans left."
	},
	{
		id: 118,
		type: "general",
		setup: "How did Darth Vader know what Luke was getting for Christmas?",
		punchline: "He felt his presents."
	},
	{
		id: 119,
		type: "general",
		setup: "How did the hipster burn the roof of his mouth?",
		punchline: "He ate the pizza before it was cool."
	},
	{
		id: 120,
		type: "general",
		setup: "How do hens stay fit?",
		punchline: "They always egg-cercise!"
	},
	{
		id: 121,
		type: "general",
		setup: "How do locomotives know where they're going?",
		punchline: "Lots of training"
	},
	{
		id: 122,
		type: "general",
		setup: "How do the trees get on the internet?",
		punchline: "They log on."
	},
	{
		id: 123,
		type: "general",
		setup: "How do you find Will Smith in the snow?",
		punchline: " Look for fresh prints."
	},
	{
		id: 124,
		type: "general",
		setup: "How do you fix a broken pizza?",
		punchline: "With tomato paste."
	},
	{
		id: 125,
		type: "general",
		setup: "How do you fix a damaged jack-o-lantern?",
		punchline: "You use a pumpkin patch."
	},
	{
		id: 126,
		type: "general",
		setup: "How do you get a baby alien to sleep?",
		punchline: " You rocket."
	},
	{
		id: 127,
		type: "general",
		setup: "How do you get two whales in a car?",
		punchline: "Start in England and drive West."
	},
	{
		id: 128,
		type: "general",
		setup: "How do you know if there’s an elephant under your bed?",
		punchline: "Your head hits the ceiling!"
	},
	{
		id: 129,
		type: "general",
		setup: "How do you make a hankie dance?",
		punchline: "Put a little boogie in it."
	},
	{
		id: 130,
		type: "general",
		setup: "How do you make holy water?",
		punchline: "You boil the hell out of it."
	},
	{
		id: 131,
		type: "general",
		setup: "How do you organize a space party?",
		punchline: "You planet."
	},
	{
		id: 132,
		type: "general",
		setup: "How do you steal a coat?",
		punchline: "You jacket."
	},
	{
		id: 133,
		type: "general",
		setup: "How do you tell the difference between a crocodile and an alligator?",
		punchline: "You will see one later and one in a while."
	},
	{
		id: 134,
		type: "general",
		setup: "How does a dyslexic poet write?",
		punchline: "Inverse."
	},
	{
		id: 135,
		type: "general",
		setup: "How does a French skeleton say hello?",
		punchline: "Bone-jour."
	},
	{
		id: 136,
		type: "general",
		setup: "How does a penguin build it’s house?",
		punchline: "Igloos it together."
	},
	{
		id: 137,
		type: "general",
		setup: "How does a scientist freshen their breath?",
		punchline: "With experi-mints!"
	},
	{
		id: 138,
		type: "general",
		setup: "How does the moon cut his hair?",
		punchline: "Eclipse it."
	},
	{
		id: 139,
		type: "general",
		setup: "How many apples grow on a tree?",
		punchline: "All of them!"
	},
	{
		id: 140,
		type: "general",
		setup: "How many bones are in the human hand?",
		punchline: "A handful of them."
	},
	{
		id: 141,
		type: "general",
		setup: "How many hipsters does it take to change a lightbulb?",
		punchline: "Oh, it's a really obscure number. You've probably never heard of it."
	},
	{
		id: 142,
		type: "general",
		setup: "How many kids with ADD does it take to change a lightbulb?",
		punchline: "Let's go ride bikes!"
	},
	{
		id: 143,
		type: "general",
		setup: "How many optometrists does it take to change a light bulb?",
		punchline: "1 or 2? 1... or 2?"
	},
	{
		id: 144,
		type: "general",
		setup: "How many seconds are in a year?",
		punchline: "12. January 2nd, February 2nd, March 2nd, April 2nd.... etc"
	},
	{
		id: 145,
		type: "general",
		setup: "How many South Americans does it take to change a lightbulb?",
		punchline: "A Brazilian"
	},
	{
		id: 146,
		type: "general",
		setup: "How many tickles does it take to tickle an octopus?",
		punchline: "Ten-tickles!"
	},
	{
		id: 147,
		type: "general",
		setup: "How much does a hipster weigh?",
		punchline: "An instagram."
	},
	{
		id: 148,
		type: "general",
		setup: "How was the snow globe feeling after the storm?",
		punchline: "A little shaken."
	},
	{
		id: 149,
		type: "general",
		setup: "Is the pool safe for diving?",
		punchline: "It deep ends."
	},
	{
		id: 150,
		type: "general",
		setup: "Is there a hole in your shoe?",
		punchline: "No… Then how’d you get your foot in it?"
	},
	{
		id: 151,
		type: "general",
		setup: "What did the spaghetti say to the other spaghetti?",
		punchline: "Pasta la vista, baby!"
	},
	{
		id: 152,
		type: "general",
		setup: "What’s 50 Cent’s name in Zimbabwe?",
		punchline: "200 Dollars."
	},
	{
		id: 153,
		type: "general",
		setup: "Want to hear a chimney joke?",
		punchline: "Got stacks of em! First one's on the house"
	},
	{
		id: 154,
		type: "general",
		setup: "Want to hear a joke about construction?",
		punchline: "Nah, I'm still working on it."
	},
	{
		id: 155,
		type: "general",
		setup: "Want to hear my pizza joke?",
		punchline: "Never mind, it's too cheesy."
	},
	{
		id: 156,
		type: "general",
		setup: "What animal is always at a game of cricket?",
		punchline: "A bat."
	},
	{
		id: 157,
		type: "general",
		setup: "What are the strongest days of the week?",
		punchline: "Saturday and Sunday...the rest are weekdays."
	},
	{
		id: 158,
		type: "general",
		setup: "What biscuit does a short person like?",
		punchline: "Shortbread. "
	},
	{
		id: 159,
		type: "general",
		setup: "What cheese can never be yours?",
		punchline: "Nacho cheese."
	},
	{
		id: 160,
		type: "general",
		setup: "What creature is smarter than a talking parrot?",
		punchline: "A spelling bee."
	},
	{
		id: 161,
		type: "general",
		setup: "What did celery say when he broke up with his girlfriend?",
		punchline: "She wasn't right for me, so I really don't carrot all."
	},
	{
		id: 162,
		type: "general",
		setup: "What did Michael Jackson name his denim store?",
		punchline: "   Billy Jeans!"
	},
	{
		id: 163,
		type: "general",
		setup: "What did one nut say as he chased another nut?",
		punchline: " I'm a cashew!"
	},
	{
		id: 164,
		type: "general",
		setup: "What did one plate say to the other plate?",
		punchline: "Dinner is on me!"
	},
	{
		id: 165,
		type: "general",
		setup: "What did one snowman say to the other snow man?",
		punchline: "Do you smell carrot?"
	},
	{
		id: 166,
		type: "general",
		setup: "What did one wall say to the other wall?",
		punchline: "I'll meet you at the corner!"
	},
	{
		id: 167,
		type: "general",
		setup: "What did Romans use to cut pizza before the rolling cutter was invented?",
		punchline: "Lil Caesars"
	},
	{
		id: 168,
		type: "general",
		setup: "What did the 0 say to the 8?",
		punchline: "Nice belt."
	},
	{
		id: 169,
		type: "general",
		setup: "What did the beaver say to the tree?",
		punchline: "It's been nice gnawing you."
	},
	{
		id: 170,
		type: "general",
		setup: "What did the big flower say to the littler flower?",
		punchline: "Hi, bud!"
	},
	{
		id: 180,
		type: "general",
		setup: "What did the Buffalo say to his little boy when he dropped him off at school?",
		punchline: "Bison."
	},
	{
		id: 181,
		type: "general",
		setup: "What did the digital clock say to the grandfather clock?",
		punchline: "Look, no hands!"
	},
	{
		id: 182,
		type: "general",
		setup: "What did the dog say to the two trees?",
		punchline: "Bark bark."
	},
	{
		id: 183,
		type: "general",
		setup: "What did the Dorito farmer say to the other Dorito farmer?",
		punchline: "Cool Ranch!"
	},
	{
		id: 184,
		type: "general",
		setup: "What did the fish say when it swam into a wall?",
		punchline: "Damn!"
	},
	{
		id: 185,
		type: "general",
		setup: "What did the grape do when he got stepped on?",
		punchline: "He let out a little wine."
	},
	{
		id: 186,
		type: "general",
		setup: "What did the judge say to the dentist?",
		punchline: "Do you swear to pull the tooth, the whole tooth and nothing but the tooth?"
	},
	{
		id: 187,
		type: "general",
		setup: "What did the late tomato say to the early tomato?",
		punchline: "I’ll ketch up"
	},
	{
		id: 188,
		type: "general",
		setup: "What did the left eye say to the right eye?",
		punchline: "Between us, something smells!"
	},
	{
		id: 189,
		type: "general",
		setup: "What did the mountain climber name his son?",
		punchline: "Cliff."
	},
	{
		id: 189,
		type: "general",
		setup: "What did the ocean say to the beach?",
		punchline: "Thanks for all the sediment."
	},
	{
		id: 190,
		type: "general",
		setup: "What did the ocean say to the shore?",
		punchline: "Nothing, it just waved."
	},
	{
		id: 191,
		type: "general",
		setup: "Why don't you find hippopotamuses hiding in trees?",
		punchline: "They're really good at it."
	},
	{
		id: 192,
		type: "general",
		setup: "What did the pirate say on his 80th birthday?",
		punchline: "Aye Matey!"
	},
	{
		id: 193,
		type: "general",
		setup: "What did the Red light say to the Green light?",
		punchline: "Don't look at me I'm changing!"
	},
	{
		id: 194,
		type: "general",
		setup: "What did the scarf say to the hat?",
		punchline: "You go on ahead, I am going to hang around a bit longer."
	},
	{
		id: 195,
		type: "general",
		setup: "What did the shy pebble wish for?",
		punchline: "That she was a little boulder."
	},
	{
		id: 196,
		type: "general",
		setup: "What did the traffic light say to the car as it passed?",
		punchline: "Don't look I'm changing!"
	},
	{
		id: 197,
		type: "general",
		setup: "What did the Zen Buddist say to the hotdog vendor?",
		punchline: "Make me one with everything."
	},
	{
		id: 198,
		type: "general",
		setup: "What do birds give out on Halloween?",
		punchline: "Tweets."
	},
	{
		id: 199,
		type: "general",
		setup: "What do I look like?",
		punchline: "A JOKE MACHINE!?"
	},
	{
		id: 200,
		type: "general",
		setup: "What do prisoners use to call each other?",
		punchline: "Cell phones."
	},
	{
		id: 201,
		type: "general",
		setup: "What do vegetarian zombies eat?",
		punchline: "Grrrrrainnnnnssss."
	},
	{
		id: 202,
		type: "general",
		setup: "What do you call a bear with no teeth?",
		punchline: "A gummy bear!"
	},
	{
		id: 203,
		type: "general",
		setup: "What do you call a bee that lives in America?",
		punchline: "A USB."
	},
	{
		id: 204,
		type: "general",
		setup: "What do you call a boomerang that won't come back?",
		punchline: "A stick."
	},
	{
		id: 205,
		type: "general",
		setup: "What do you call a careful wolf?",
		punchline: "Aware wolf."
	},
	{
		id: 206,
		type: "general",
		setup: "What do you call a cow on a trampoline?",
		punchline: "A milk shake!"
	},
	{
		id: 207,
		type: "general",
		setup: "What do you call a cow with no legs?",
		punchline: "Ground beef."
	},
	{
		id: 208,
		type: "general",
		setup: "What do you call a cow with two legs?",
		punchline: "Lean beef."
	},
	{
		id: 209,
		type: "general",
		setup: "What do you call a crowd of chess players bragging about their wins in a hotel lobby?",
		punchline: "Chess nuts boasting in an open foyer."
	},
	{
		id: 210,
		type: "general",
		setup: "What do you call a dad that has fallen through the ice?",
		punchline: "A Popsicle."
	},
	{
		id: 211,
		type: "general",
		setup: "What do you call a dictionary on drugs?",
		punchline: "High definition."
	},
	{
		id: 212,
		type: "general",
		setup: "what do you call a dog that can do magic tricks?",
		punchline: "a labracadabrador"
	},
	{
		id: 213,
		type: "general",
		setup: "What do you call a droid that takes the long way around?",
		punchline: "R2 detour."
	},
	{
		id: 214,
		type: "general",
		setup: "What do you call a duck that gets all A's?",
		punchline: "A wise quacker."
	},
	{
		id: 215,
		type: "general",
		setup: "What do you call a fake noodle?",
		punchline: "An impasta."
	},
	{
		id: 216,
		type: "general",
		setup: "What do you call a fashionable lawn statue with an excellent sense of rhythmn?",
		punchline: "A metro-gnome"
	},
	{
		id: 217,
		type: "general",
		setup: "What do you call a fat psychic?",
		punchline: "A four-chin teller."
	},
	{
		id: 218,
		type: "general",
		setup: "What do you call a fly without wings?",
		punchline: "A walk."
	},
	{
		id: 219,
		type: "general",
		setup: "What do you call a girl between two posts?",
		punchline: "Annette."
	},
	{
		id: 220,
		type: "general",
		setup: "What do you call a group of disorganized cats?",
		punchline: "A cat-tastrophe."
	},
	{
		id: 221,
		type: "general",
		setup: "What do you call a group of killer whales playing instruments?",
		punchline: "An Orca-stra."
	},
	{
		id: 222,
		type: "general",
		setup: "What do you call a monkey in a mine field?",
		punchline: "A babooooom!"
	},
	{
		id: 223,
		type: "general",
		setup: "What do you call a nervous javelin thrower?",
		punchline: "Shakespeare."
	},
	{
		id: 224,
		type: "general",
		setup: "What do you call a pig that knows karate?",
		punchline: "A pork chop!"
	},
	{
		id: 225,
		type: "general",
		setup: "What do you call a pig with three eyes?",
		punchline: "Piiig"
	},
	{
		id: 226,
		type: "general",
		setup: "What do you call a pile of cats?",
		punchline: " A Meowtain."
	},
	{
		id: 227,
		type: "general",
		setup: "What do you call a sheep with no legs?",
		punchline: "A cloud."
	},
	{
		id: 228,
		type: "general",
		setup: "What do you call a troublesome Canadian high schooler?",
		punchline: "A poutine."
	},
	{
		id: 229,
		type: "general",
		setup: "What do you call an alligator in a vest?",
		punchline: "An in-vest-igator!"
	},
	{
		id: 230,
		type: "general",
		setup: "What do you call an Argentinian with a rubber toe?",
		punchline: "Roberto"
	},
	{
		id: 231,
		type: "general",
		setup: "What do you call an eagle who can play the piano?",
		punchline: "Talonted!"
	},
	{
		id: 232,
		type: "general",
		setup: "What do you call an elephant that doesn’t matter?",
		punchline: "An irrelephant."
	},
	{
		id: 233,
		type: "general",
		setup: "What do you call an old snowman?",
		punchline: "Water."
	},
	{
		id: 234,
		type: "general",
		setup: "What do you call cheese by itself?",
		punchline: "Provolone."
	},
	{
		id: 235,
		type: "general",
		setup: "What do you call corn that joins the army?",
		punchline: "Kernel."
	},
	{
		id: 236,
		type: "general",
		setup: "What do you call someone with no nose?",
		punchline: "Nobody knows."
	},
	{
		id: 237,
		type: "general",
		setup: "What do you call two barracuda fish?",
		punchline: " A Pairacuda!"
	},
	{
		id: 238,
		type: "general",
		setup: "What do you do on a remote island?",
		punchline: "Try and find the TV island it belongs to."
	},
	{
		id: 239,
		type: "general",
		setup: "What do you do when you see a space man?",
		punchline: "Park your car, man."
	},
	{
		id: 240,
		type: "general",
		setup: "What do you get hanging from Apple trees?",
		punchline: "Sore arms."
	},
	{
		id: 241,
		type: "general",
		setup: "What do you get when you cross a bee and a sheep?",
		punchline: "A bah-humbug."
	},
	{
		id: 242,
		type: "general",
		setup: "What do you get when you cross a chicken with a skunk?",
		punchline: "A fowl smell!"
	},
	{
		id: 243,
		type: "general",
		setup: "What do you get when you cross a rabbit with a water hose?",
		punchline: "Hare spray."
	},
	{
		id: 244,
		type: "general",
		setup: "What do you get when you cross a snowman with a vampire?",
		punchline: "Frostbite."
	},
	{
		id: 245,
		type: "general",
		setup: "What do you give a sick lemon?",
		punchline: "Lemonaid."
	},
	{
		id: 246,
		type: "general",
		setup: "What does a clock do when it's hungry?",
		punchline: "It goes back four seconds!"
	},
	{
		id: 247,
		type: "general",
		setup: "What does a female snake use for support?",
		punchline: "A co-Bra!"
	},
	{
		id: 248,
		type: "general",
		setup: "What does a pirate pay for his corn?",
		punchline: "A buccaneer!"
	},
	{
		id: 249,
		type: "general",
		setup: "What does an angry pepper do?",
		punchline: "It gets jalapeño face."
	},
	{
		id: 250,
		type: "general",
		setup: "What happens to a frog's car when it breaks down?",
		punchline: "It gets toad."
	},
	{
		id: 251,
		type: "general",
		setup: "What happens when you anger a brain surgeon?",
		punchline: "They will give you a piece of your mind."
	},
	{
		id: 252,
		type: "general",
		setup: "What has ears but cannot hear?",
		punchline: "A field of corn."
	},
	{
		id: 253,
		type: "general",
		setup: "What is a centipedes's favorite Beatle song?",
		punchline: " I want to hold your hand, hand, hand, hand..."
	},
	{
		id: 254,
		type: "general",
		setup: "What is a tornado's favorite game to play?",
		punchline: "Twister!"
	},
	{
		id: 255,
		type: "general",
		setup: "What is a vampire's favorite fruit?",
		punchline: "A blood orange."
	},
	{
		id: 256,
		type: "general",
		setup: "What is a witch's favorite subject in school?",
		punchline: "Spelling!"
	},
	{
		id: 257,
		type: "general",
		setup: "What is red and smells like blue paint?",
		punchline: "Red paint!"
	},
	{
		id: 258,
		type: "general",
		setup: "What is the difference between ignorance and apathy?",
		punchline: "I don't know and I don't care."
	},
	{
		id: 259,
		type: "general",
		setup: "What is the hardest part about sky diving?",
		punchline: "The ground."
	},
	{
		id: 260,
		type: "general",
		setup: "What is the leading cause of dry skin?",
		punchline: "Towels"
	},
	{
		id: 261,
		type: "general",
		setup: "What is the least spoken language in the world?",
		punchline: "Sign Language"
	},
	{
		id: 262,
		type: "general",
		setup: "What is the tallest building in the world?",
		punchline: "The library, it’s got the most stories!"
	},
	{
		id: 263,
		type: "general",
		setup: "What is this movie about?",
		punchline: "It is about 2 hours long."
	},
	{
		id: 264,
		type: "general",
		setup: "What kind of award did the dentist receive?",
		punchline: "A little plaque."
	},
	{
		id: 265,
		type: "general",
		setup: "What kind of bagel can fly?",
		punchline: "A plain bagel."
	},
	{
		id: 266,
		type: "general",
		setup: "What kind of dinosaur loves to sleep?",
		punchline: "A stega-snore-us."
	},
	{
		id: 267,
		type: "general",
		setup: "What kind of dog lives in a particle accelerator?",
		punchline: "A Fermilabrador Retriever."
	},
	{
		id: 268,
		type: "general",
		setup: "What kind of magic do cows believe in?",
		punchline: "MOODOO."
	},
	{
		id: 269,
		type: "general",
		setup: "What kind of music do planets listen to?",
		punchline: "Nep-tunes."
	},
	{
		id: 270,
		type: "general",
		setup: "What kind of pants do ghosts wear?",
		punchline: "Boo jeans."
	},
	{
		id: 271,
		type: "general",
		setup: "What kind of tree fits in your hand?",
		punchline: "A palm tree!"
	},
	{
		id: 272,
		type: "general",
		setup: "What lies at the bottom of the ocean and twitches?",
		punchline: "A nervous wreck."
	},
	{
		id: 273,
		type: "general",
		setup: "What musical instrument is found in the bathroom?",
		punchline: "A tuba toothpaste."
	},
	{
		id: 274,
		type: "general",
		setup: "What time did the man go to the dentist?",
		punchline: "Tooth hurt-y."
	},
	{
		id: 275,
		type: "general",
		setup: "What type of music do balloons hate?",
		punchline: "Pop music!"
	},
	{
		id: 276,
		type: "general",
		setup: "What was a more important invention than the first telephone?",
		punchline: "The second one."
	},
	{
		id: 277,
		type: "general",
		setup: "What was the pumpkin’s favorite sport?",
		punchline: "Squash."
	},
	{
		id: 278,
		type: "general",
		setup: "What's black and white and read all over?",
		punchline: "The newspaper."
	},
	{
		id: 279,
		type: "general",
		setup: "What's blue and not very heavy?",
		punchline: " Light blue."
	},
	{
		id: 280,
		type: "general",
		setup: "What's brown and sticky?",
		punchline: "A stick."
	},
	{
		id: 281,
		type: "general",
		setup: "What's orange and sounds like a parrot?",
		punchline: "A Carrot."
	},
	{
		id: 282,
		type: "general",
		setup: "What's red and bad for your teeth?",
		punchline: "A Brick."
	},
	{
		id: 283,
		type: "general",
		setup: "What's the best thing about elevator jokes?",
		punchline: "They work on so many levels."
	},
	{
		id: 284,
		type: "general",
		setup: "What's the difference between a guitar and a fish?",
		punchline: 'You can tune a guitar but you can\'t "tuna"fish!'
	},
	{
		id: 285,
		type: "general",
		setup: "What's the difference between a hippo and a zippo?",
		punchline: "One is really heavy, the other is a little lighter."
	},
	{
		id: 286,
		type: "general",
		setup: "What's the difference between a seal and a sea lion?",
		punchline: "An ion! "
	},
	{
		id: 287,
		type: "general",
		setup: "What's the worst part about being a cross-eyed teacher?",
		punchline: "They can't control their pupils."
	},
	{
		id: 288,
		type: "general",
		setup: "What's the worst thing about ancient history class?",
		punchline: "The teachers tend to Babylon."
	},
	{
		id: 289,
		type: "general",
		setup: "What’s brown and sounds like a bell?",
		punchline: "Dung!"
	},
	{
		id: 290,
		type: "general",
		setup: "What’s E.T. short for?",
		punchline: "He’s only got little legs."
	},
	{
		id: 291,
		type: "general",
		setup: "What’s Forest Gump’s Facebook password?",
		punchline: "1forest1"
	},
	{
		id: 292,
		type: "general",
		setup: "What’s the advantage of living in Switzerland?",
		punchline: "Well, the flag is a big plus."
	},
	{
		id: 293,
		type: "general",
		setup: "What’s the difference between an African elephant and an Indian elephant?",
		punchline: "About 5000 miles."
	},
	{
		id: 294,
		type: "general",
		setup: "When do doctors get angry?",
		punchline: "When they run out of patients."
	},
	{
		id: 295,
		type: "general",
		setup: "When does a joke become a dad joke?",
		punchline: "When it becomes apparent."
	},
	{
		id: 296,
		type: "general",
		setup: "When is a door not a door?",
		punchline: "When it's ajar."
	},
	{
		id: 297,
		type: "general",
		setup: "Where did you learn to make ice cream?",
		punchline: "Sunday school."
	},
	{
		id: 298,
		type: "general",
		setup: "Where do bees go to the bathroom?",
		punchline: " The BP station."
	},
	{
		id: 299,
		type: "general",
		setup: "Where do hamburgers go to dance?",
		punchline: "The meat-ball."
	},
	{
		id: 300,
		type: "general",
		setup: "Where do rabbits go after they get married?",
		punchline: "On a bunny-moon."
	},
	{
		id: 301,
		type: "general",
		setup: "Where do sheep go to get their hair cut?",
		punchline: "The baa-baa shop."
	},
	{
		id: 302,
		type: "general",
		setup: "Where do you learn to make banana splits?",
		punchline: "At sundae school."
	},
	{
		id: 303,
		type: "general",
		setup: "Where do young cows eat lunch?",
		punchline: "In the calf-ateria."
	},
	{
		id: 304,
		type: "general",
		setup: "Where does batman go to the bathroom?",
		punchline: "The batroom."
	},
	{
		id: 305,
		type: "general",
		setup: "Where does Fonzie like to go for lunch?",
		punchline: "Chick-Fil-Eyyyyyyyy."
	},
	{
		id: 306,
		type: "general",
		setup: "Where does Napoleon keep his armies?",
		punchline: "In his sleevies."
	},
	{
		id: 307,
		type: "general",
		setup: "Where was the Declaration of Independence signed?",
		punchline: "At the bottom! "
	},
	{
		id: 308,
		type: "general",
		setup: "Where’s the bin?",
		punchline: "I haven’t been anywhere!"
	},
	{
		id: 309,
		type: "general",
		setup: "Which side of the chicken has more feathers?",
		punchline: "The outside."
	},
	{
		id: 310,
		type: "general",
		setup: "Who did the wizard marry?",
		punchline: "His ghoul-friend"
	},
	{
		id: 311,
		type: "general",
		setup: "Who is the coolest Doctor in the hospital?",
		punchline: "The hip Doctor!"
	},
	{
		id: 312,
		type: "general",
		setup: "Why are fish easy to weigh?",
		punchline: "Because they have their own scales."
	},
	{
		id: 313,
		type: "general",
		setup: "Why are fish so smart?",
		punchline: "Because they live in schools!"
	},
	{
		id: 314,
		type: "general",
		setup: "Why are ghosts bad liars?",
		punchline: "Because you can see right through them!"
	},
	{
		id: 315,
		type: "general",
		setup: "Why are graveyards so noisy?",
		punchline: "Because of all the coffin."
	},
	{
		id: 316,
		type: "general",
		setup: "Why are mummys scared of vacation?",
		punchline: "They're afraid to unwind."
	},
	{
		id: 317,
		type: "general",
		setup: "Why are oranges the smartest fruit?",
		punchline: "Because they are made to concentrate. "
	},
	{
		id: 318,
		type: "general",
		setup: "Why are pirates called pirates?",
		punchline: "Because they arrr!"
	},
	{
		id: 319,
		type: "general",
		setup: "Why are skeletons so calm?",
		punchline: "Because nothing gets under their skin."
	},
	{
		id: 320,
		type: "general",
		setup: "Why can't a bicycle stand on its own?",
		punchline: "It's two-tired."
	},
	{
		id: 321,
		type: "general",
		setup: 'Why can\'t you use "Beef stew"as a password?',
		punchline: "Because it's not stroganoff."
	},
	{
		id: 322,
		type: "general",
		setup: "Why can't your nose be 12 inches long?",
		punchline: "Because then it'd be a foot!"
	},
	{
		id: 323,
		type: "general",
		setup: "Why can’t you hear a pterodactyl go to the bathroom?",
		punchline: "The p is silent."
	},
	{
		id: 324,
		type: "general",
		setup: "Why couldn't the kid see the pirate movie?",
		punchline: "Because it was rated arrr!"
	},
	{
		id: 325,
		type: "general",
		setup: "Why couldn't the lifeguard save the hippie?",
		punchline: "He was too far out, man."
	},
	{
		id: 326,
		type: "general",
		setup: "Why did Dracula lie in the wrong coffin?",
		punchline: "He made a grave mistake."
	},
	{
		id: 327,
		type: "general",
		setup: "Why did Sweden start painting barcodes on the sides of their battleships?",
		punchline: "So they could Scandinavian."
	},
	{
		id: 328,
		type: "general",
		setup: "Why did the A go to the bathroom and come out as an E?",
		punchline: "Because he had a vowel movement."
	},
	{
		id: 329,
		type: "general",
		setup: "Why did the barber win the race?",
		punchline: "He took a short cut."
	},
	{
		id: 330,
		type: "general",
		setup: "Why did the belt go to prison?",
		punchline: "He held up a pair of pants!"
	},
	{
		id: 331,
		type: "general",
		setup: "Why did the burglar hang his mugshot on the wall?",
		punchline: "To prove that he was framed!"
	},
	{
		id: 332,
		type: "general",
		setup: "Why did the chicken get a penalty?",
		punchline: "For fowl play."
	},
	{
		id: 333,
		type: "general",
		setup: "Why did the Clydesdale give the pony a glass of water?",
		punchline: "Because he was a little horse!"
	},
	{
		id: 334,
		type: "general",
		setup: "Why did the coffee file a police report?",
		punchline: "It got mugged."
	},
	{
		id: 335,
		type: "general",
		setup: "Why did the cookie cry?",
		punchline: "Because his mother was a wafer so long"
	},
	{
		id: 336,
		type: "general",
		setup: "Why did the cookie cry?",
		punchline: "It was feeling crumby."
	},
	{
		id: 337,
		type: "general",
		setup: "Why did the cowboy have a weiner dog?",
		punchline: "Somebody told him to get a long little doggy."
	},
	{
		id: 338,
		type: "general",
		setup: "Why did the fireman wear red, white, and blue suspenders?",
		punchline: "To hold his pants up."
	},
	{
		id: 339,
		type: "general",
		setup: "Why did the girl smear peanut butter on the road?",
		punchline: "To go with the traffic jam."
	},
	{
		id: 340,
		type: "general",
		setup: "Why did the half blind man fall in the well?",
		punchline: "Because he couldn't see that well!"
	},
	{
		id: 341,
		type: "general",
		setup: "Why did the house go to the doctor?",
		punchline: "It was having window panes."
	},
	{
		id: 342,
		type: "general",
		setup: "Why did the kid cross the playground?",
		punchline: "To get to the other slide."
	},
	{
		id: 343,
		type: "general",
		setup: "Why did the man put his money in the freezer?",
		punchline: "He wanted cold hard cash!"
	},
	{
		id: 344,
		type: "general",
		setup: "Why did the man run around his bed?",
		punchline: "Because he was trying to catch up on his sleep!"
	},
	{
		id: 345,
		type: "general",
		setup: "Why did the melons plan a big wedding?",
		punchline: "Because they cantaloupe!"
	},
	{
		id: 346,
		type: "general",
		setup: "Why did the octopus beat the shark in a fight?",
		punchline: "Because it was well armed."
	},
	{
		id: 347,
		type: "general",
		setup: "Why did the opera singer go sailing?",
		punchline: "They wanted to hit the high Cs."
	},
	{
		id: 348,
		type: "general",
		setup: "Why did the scarecrow win an award?",
		punchline: "Because he was outstanding in his field."
	},
	{
		id: 349,
		type: "general",
		setup: "Why did the tomato blush?",
		punchline: "Because it saw the salad dressing."
	},
	{
		id: 350,
		type: "general",
		setup: "Why did the tree go to the dentist?",
		punchline: "It needed a root canal."
	},
	{
		id: 351,
		type: "general",
		setup: "Why did the worker get fired from the orange juice factory?",
		punchline: "Lack of concentration."
	},
	{
		id: 352,
		type: "general",
		setup: "Why didn't the number 4 get into the nightclub?",
		punchline: "Because he is 2 square."
	},
	{
		id: 353,
		type: "general",
		setup: "Why didn’t the orange win the race?",
		punchline: "It ran out of juice."
	},
	{
		id: 354,
		type: "general",
		setup: "Why didn’t the skeleton cross the road?",
		punchline: "Because he had no guts."
	},
	{
		id: 355,
		type: "general",
		setup: "Why do bananas have to put on sunscreen before they go to the beach?",
		punchline: "Because they might peel!"
	},
	{
		id: 356,
		type: "general",
		setup: "Why do bears have hairy coats?",
		punchline: "Fur protection."
	},
	{
		id: 357,
		type: "general",
		setup: "Why do bees have sticky hair?",
		punchline: "Because they use honey combs!"
	},
	{
		id: 358,
		type: "general",
		setup: "Why do bees hum?",
		punchline: "Because they don't know the words."
	},
	{
		id: 359,
		type: "general",
		setup: "Why do birds fly south for the winter?",
		punchline: "Because it's too far to walk."
	},
	{
		id: 360,
		type: "general",
		setup: "Why do choirs keep buckets handy?",
		punchline: "So they can carry their tune"
	},
	{
		id: 361,
		type: "general",
		setup: "Why do crabs never give to charity?",
		punchline: "Because they’re shellfish."
	},
	{
		id: 362,
		type: "general",
		setup: "Why do ducks make great detectives?",
		punchline: "They always quack the case."
	},
	{
		id: 363,
		type: "general",
		setup: "Why do mathematicians hate the U.S.?",
		punchline: "Because it's indivisible."
	},
	{
		id: 364,
		type: "general",
		setup: "Why do pirates not know the alphabet?",
		punchline: 'They always get stuck at "C".'
	},
	{
		id: 365,
		type: "general",
		setup: "Why do pumpkins sit on people’s porches?",
		punchline: "They have no hands to knock on the door."
	},
	{
		id: 366,
		type: "general",
		setup: "Why do scuba divers fall backwards into the water?",
		punchline: "Because if they fell forwards they’d still be in the boat."
	},
	{
		id: 367,
		type: "general",
		setup: "Why do trees seem suspicious on sunny days?",
		punchline: "Dunno, they're just a bit shady."
	},
	{
		id: 368,
		type: "general",
		setup: "Why do valley girls hang out in odd numbered groups?",
		punchline: "Because they can't even."
	},
	{
		id: 369,
		type: "general",
		setup: "Why do wizards clean their teeth three times a day?",
		punchline: "To prevent bat breath!"
	},
	{
		id: 370,
		type: "general",
		setup: "Why do you never see elephants hiding in trees?",
		punchline: "Because they're so good at it."
	},
	{
		id: 371,
		type: "general",
		setup: "Why does a chicken coop only have two doors?",
		punchline: "Because if it had four doors it would be a chicken sedan."
	},
	{
		id: 372,
		type: "general",
		setup: "Why does a Moon-rock taste better than an Earth-rock?",
		punchline: "Because it's a little meteor."
	},
	{
		id: 373,
		type: "general",
		setup: "Why does it take longer to get from 1st to 2nd base, than it does to get from 2nd to 3rd base?",
		punchline: "Because there’s a Shortstop in between!"
	},
	{
		id: 374,
		type: "general",
		setup: "Why does Norway have barcodes on their battleships?",
		punchline: "So when they get back to port, they can Scandinavian."
	},
	{
		id: 375,
		type: "general",
		setup: "Why does Superman get invited to dinners?",
		punchline: "Because he is a Supperhero."
	},
	{
		id: 376,
		type: "general",
		setup: "Why does Waldo only wear stripes?",
		punchline: "Because he doesn't want to be spotted."
	},
	{
		id: 377,
		type: "programming",
		setup: "Knock-knock.",
		punchline: "A race condition. Who is there?"
	},
	{
		id: 378,
		type: "programming",
		setup: "What's the best part about TCP jokes?",
		punchline: "I get to keep telling them until you get them."
	},
	{
		id: 379,
		type: "programming",
		setup: "A programmer puts two glasses on his bedside table before going to sleep.",
		punchline: "A full one, in case he gets thirsty, and an empty one, in case he doesn’t."
	},
	{
		id: 380,
		type: "programming",
		setup: "There are 10 kinds of people in this world.",
		punchline: "Those who understand binary, those who don't, and those who weren't expecting a base 3 joke."
	},
	{
		id: 381,
		type: "general",
		setup: "Two guys walk into a bar . . .",
		punchline: 'The first guy says "Ouch!" and the second says "Yeah, I didn\'t see it either."'
	},
	{
		id: 382,
		type: "programming",
		setup: "What did the router say to the doctor?",
		punchline: "It hurts when IP."
	},
	{
		id: 383,
		type: "programming",
		setup: "An IPv6 packet is walking out of the house.",
		punchline: "He goes nowhere."
	},
	{
		id: 384,
		type: "programming",
		setup: "A DHCP packet walks into a bar and asks for a beer.",
		punchline: 'Bartender says, "here, but I’ll need that back in an hour!"'
	},
	{
		id: 385,
		type: "programming",
		setup: "3 SQL statements walk into a NoSQL bar. Soon, they walk out",
		punchline: "They couldn't find a table."
	},
	{
		id: 386,
		type: "general",
		setup: "I saw a nice stereo on Craigslist for $1. Seller says the volume is stuck on ‘high’",
		punchline: "I couldn’t turn it down."
	},
	{
		id: 387,
		type: "general",
		setup: "My older brother always tore the last pages of my comic books, and never told me why.",
		punchline: "I had to draw my own conclusions."
	}
];

let fileHandleTicker;
let fileContentTicker = "";
let fileSizeTicker = 0;
let monitorInterval = null;

 
async function selectTickerFile() {
	
	fileHandleTicker = await window.showOpenFilePicker({
		types: [{
			description: 'Text Files',
			accept: {'text/plain': ['.txt']},
		}],
	});
	
	if (!isSSAPP){
		fileHandleTicker = fileHandleTicker[0];
	}
	 
	try {
		await loadFileTicker();
	} catch(e){}
	
};

function processTicker(){ 
	if (fileContentTicker && settings.ticker){
		sendTickerP2P([fileContentTicker]);
	} else {
		sendTickerP2P([]);
	}
}

async function loadFileTicker(file=null) {
	if (!settings.ticker) {
		clearInterval(monitorInterval);
		if (fileContentTicker){
			fileContentTicker = "";
			sendTickerP2P([]);
		}
		return;
	}
	if (fileHandleTicker) {
		if (!isSSAPP){
			if (!file){
				file = await fileHandleTicker.getFile();
			}
			fileContentTicker = await file.text();
		} else {
			fileContentTicker = fileHandleTicker;
		}
		sendTickerP2P([fileContentTicker]);
		fileSizeTicker = file.size;
		if (!isSSAPP){
			monitorFileChanges();
		}
	} else {
		selectTickerFile();
	}
}

function monitorFileChanges() {
	clearInterval(monitorInterval);
	monitorInterval = setInterval(async () => {
		if (fileHandleTicker) {
			const newFile = await fileHandleTicker.getFile();
			if (newFile.size !== fileSizeTicker) {
				fileSizeTicker = newFile.size;
				try {
					await loadFileTicker(newFile);
				} catch(e){}
			}
		}
	}, 1000); // Check for changes every second
}

window.addEventListener('beforeunload', async function() {
  document.title = "Close me - Social Stream Ninja";
});

window.addEventListener('unload', async function() {
  document.title = "Close me - Social Stream Ninja";
});
