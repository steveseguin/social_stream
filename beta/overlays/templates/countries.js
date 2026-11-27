/* Country list, flag images and a waving-flag renderer shared by banners, screens, cards and the flag overlay.
   Flags come from flagcdn.com (SVG, CORS-enabled); if it can't be reached the flag falls back to the theme colours. */
(function () {
	"use strict";

	SSO.COUNTRIES = [["af","Afghanistan"],["al","Albania"],["dz","Algeria"],["as","American Samoa"],["ad","Andorra"],["ao","Angola"],["ai","Anguilla"],["aq","Antarctica"],["ag","Antigua and Barbuda"],["ar","Argentina"],["am","Armenia"],["aw","Aruba"],["au","Australia"],["at","Austria"],["az","Azerbaijan"],["bs","Bahamas"],["bh","Bahrain"],["bd","Bangladesh"],["bb","Barbados"],["by","Belarus"],["be","Belgium"],["bz","Belize"],["bj","Benin"],["bm","Bermuda"],["bt","Bhutan"],["bo","Bolivia, Plurinational State of"],["ba","Bosnia and Herzegovina"],["bw","Botswana"],["bv","Bouvet Island"],["br","Brazil"],["io","British Indian Ocean Territory"],["bn","Brunei"],["bg","Bulgaria"],["bf","Burkina Faso"],["bi","Burundi"],["cv","Cabo Verde"],["kh","Cambodia"],["cm","Cameroon"],["ca","Canada"],["bq","Caribbean Netherlands"],["ky","Cayman Islands"],["cf","Central African Republic"],["td","Chad"],["cl","Chile"],["cn","China"],["cx","Christmas Island"],["cc","Cocos (Keeling) Islands"],["co","Colombia"],["km","Comoros"],["cg","Congo"],["ck","Cook Islands"],["cr","Costa Rica"],["hr","Croatia"],["cu","Cuba"],["cw","Curaçao"],["cy","Cyprus"],["cz","Czechia"],["ci","Côte d'Ivoire"],["cd","DR Congo"],["dk","Denmark"],["dj","Djibouti"],["dm","Dominica"],["do","Dominican Republic"],["ec","Ecuador"],["eg","Egypt"],["sv","El Salvador"],["gq","Equatorial Guinea"],["er","Eritrea"],["ee","Estonia"],["sz","Eswatini"],["et","Ethiopia"],["fk","Falkland Islands (Malvinas)"],["fo","Faroe Islands"],["fj","Fiji"],["fi","Finland"],["fr","France"],["gf","French Guiana"],["pf","French Polynesia"],["tf","French Southern Territories"],["ga","Gabon"],["gm","Gambia"],["ge","Georgia"],["de","Germany"],["gh","Ghana"],["gi","Gibraltar"],["gr","Greece"],["gl","Greenland"],["gd","Grenada"],["gp","Guadeloupe"],["gu","Guam"],["gt","Guatemala"],["gg","Guernsey"],["gn","Guinea"],["gw","Guinea-Bissau"],["gy","Guyana"],["ht","Haiti"],["hm","Heard Island and McDonald Islands"],["va","Holy See"],["hn","Honduras"],["hk","Hong Kong"],["hu","Hungary"],["is","Iceland"],["in","India"],["id","Indonesia"],["ir","Iran, Islamic Republic of"],["iq","Iraq"],["ie","Ireland"],["im","Isle of Man"],["il","Israel"],["it","Italy"],["jm","Jamaica"],["jp","Japan"],["je","Jersey"],["jo","Jordan"],["kz","Kazakhstan"],["ke","Kenya"],["ki","Kiribati"],["kp","Korea, Democratic People's Republic of"],["kw","Kuwait"],["kg","Kyrgyzstan"],["la","Laos"],["lv","Latvia"],["lb","Lebanon"],["ls","Lesotho"],["lr","Liberia"],["ly","Libya"],["li","Liechtenstein"],["lt","Lithuania"],["lu","Luxembourg"],["mo","Macao"],["mg","Madagascar"],["mw","Malawi"],["my","Malaysia"],["mv","Maldives"],["ml","Mali"],["mt","Malta"],["mh","Marshall Islands"],["mq","Martinique"],["mr","Mauritania"],["mu","Mauritius"],["yt","Mayotte"],["mx","Mexico"],["fm","Micronesia, Federated States of"],["md","Moldova"],["mc","Monaco"],["mn","Mongolia"],["me","Montenegro"],["ms","Montserrat"],["ma","Morocco"],["mz","Mozambique"],["mm","Myanmar"],["na","Namibia"],["nr","Nauru"],["np","Nepal"],["nl","Netherlands"],["nc","New Caledonia"],["nz","New Zealand"],["ni","Nicaragua"],["ne","Niger"],["ng","Nigeria"],["nu","Niue"],["nf","Norfolk Island"],["mk","North Macedonia"],["mp","Northern Mariana Islands"],["no","Norway"],["om","Oman"],["pk","Pakistan"],["pw","Palau"],["ps","Palestine"],["pa","Panama"],["pg","Papua New Guinea"],["py","Paraguay"],["pe","Peru"],["ph","Philippines"],["pn","Pitcairn"],["pl","Poland"],["pt","Portugal"],["pr","Puerto Rico"],["qa","Qatar"],["ro","Romania"],["ru","Russia"],["rw","Rwanda"],["re","Réunion"],["bl","Saint Barthélemy"],["sh","Saint Helena, Ascension and Tristan da Cunha"],["kn","Saint Kitts and Nevis"],["lc","Saint Lucia"],["mf","Saint Martin (French part)"],["pm","Saint Pierre and Miquelon"],["vc","Saint Vincent and the Grenadines"],["ws","Samoa"],["sm","San Marino"],["st","Sao Tome and Principe"],["sa","Saudi Arabia"],["sn","Senegal"],["rs","Serbia"],["sc","Seychelles"],["sl","Sierra Leone"],["sg","Singapore"],["sx","Sint Maarten (Dutch part)"],["sk","Slovakia"],["si","Slovenia"],["sb","Solomon Islands"],["so","Somalia"],["za","South Africa"],["gs","South Georgia and the South Sandwich Islands"],["kr","South Korea"],["ss","South Sudan"],["es","Spain"],["lk","Sri Lanka"],["sd","Sudan"],["sr","Suriname"],["sj","Svalbard and Jan Mayen"],["se","Sweden"],["ch","Switzerland"],["sy","Syria"],["tw","Taiwan"],["tj","Tajikistan"],["tz","Tanzania"],["th","Thailand"],["tl","Timor-Leste"],["tg","Togo"],["tk","Tokelau"],["to","Tonga"],["tt","Trinidad and Tobago"],["tn","Tunisia"],["tr","Turkey"],["tm","Turkmenistan"],["tc","Turks and Caicos Islands"],["tv","Tuvalu"],["ug","Uganda"],["ua","Ukraine"],["ae","United Arab Emirates"],["gb","United Kingdom"],["us","United States"],["um","United States Minor Outlying Islands"],["uy","Uruguay"],["uz","Uzbekistan"],["vu","Vanuatu"],["ve","Venezuela, Bolivarian Republic of"],["vn","Vietnam"],["vg","Virgin Islands (British)"],["vi","Virgin Islands (U.S.)"],["wf","Wallis and Futuna"],["eh","Western Sahara"],["ye","Yemen"],["zm","Zambia"],["zw","Zimbabwe"],["ax","Åland Islands"]];

	// Palettes for popular countries: [main, second, third] roughly matching the flag.
	SSO.COUNTRY_THEMES = {
		us: ["#b22234", "#ffffff", "#3c3b6e"], ca: ["#d52b1e", "#ffffff", "#d52b1e"], mx: ["#006847", "#ffffff", "#ce1126"],
		br: ["#009c3b", "#ffdf00", "#002776"], ar: ["#74acdf", "#ffffff", "#f6b40e"], co: ["#fcd116", "#003893", "#ce1126"],
		cl: ["#d52b1e", "#ffffff", "#0039a6"], pe: ["#d91023", "#ffffff", "#d91023"], gb: ["#012169", "#ffffff", "#c8102e"],
		ie: ["#169b62", "#ffffff", "#ff883e"], fr: ["#0055a4", "#ffffff", "#ef4135"], de: ["#000000", "#dd0000", "#ffce00"],
		it: ["#009246", "#ffffff", "#ce2b37"], es: ["#aa151b", "#f1bf00", "#aa151b"], pt: ["#006600", "#ff0000", "#ffcc00"],
		nl: ["#ae1c28", "#ffffff", "#21468b"], be: ["#000000", "#fdda24", "#ef3340"], ch: ["#da291c", "#ffffff", "#da291c"],
		at: ["#ed2939", "#ffffff", "#ed2939"], se: ["#006aa7", "#fecc00", "#006aa7"], no: ["#ba0c2f", "#ffffff", "#00205b"],
		dk: ["#c8102e", "#ffffff", "#c8102e"], fi: ["#ffffff", "#002f6c", "#ffffff"], pl: ["#ffffff", "#dc143c", "#ffffff"],
		ua: ["#0057b7", "#ffd700", "#0057b7"], gr: ["#0d5eaf", "#ffffff", "#0d5eaf"], tr: ["#e30a17", "#ffffff", "#e30a17"],
		in: ["#ff9933", "#ffffff", "#138808"], pk: ["#01411c", "#ffffff", "#01411c"], ph: ["#0038a8", "#ce1126", "#fcd116"],
		id: ["#ff0000", "#ffffff", "#ff0000"], my: ["#010066", "#cc0001", "#ffcc00"], th: ["#a51931", "#f4f5f8", "#2d2a4a"],
		vn: ["#da251d", "#ffff00", "#da251d"], jp: ["#ffffff", "#bc002d", "#ffffff"], kr: ["#ffffff", "#cd2e3a", "#0047a0"],
		au: ["#012169", "#ffffff", "#e4002b"], nz: ["#012169", "#ffffff", "#c8102e"], za: ["#007749", "#ffb81c", "#de3831"],
		ng: ["#008751", "#ffffff", "#008751"], ke: ["#000000", "#bb0000", "#006600"], eg: ["#ce1126", "#ffffff", "#000000"],
		ma: ["#c1272d", "#006233", "#c1272d"], sa: ["#006c35", "#ffffff", "#006c35"], ae: ["#00732f", "#ffffff", "#ff0000"],
		jm: ["#009b3a", "#fed100", "#000000"], tt: ["#da1a35", "#000000", "#ffffff"], ru: ["#ffffff", "#0039a6", "#d52b1e"],
		cn: ["#de2910", "#ffde00", "#de2910"], ro: ["#002b7f", "#fcd116", "#ce1126"], hu: ["#ce2939", "#ffffff", "#477050"],
		cz: ["#11457e", "#ffffff", "#d7141a"], hr: ["#ff0000", "#ffffff", "#171796"], rs: ["#c6363c", "#0c4076", "#ffffff"],
		ve: ["#ffcc00", "#00247d", "#cf142b"], cu: ["#002a8f", "#ffffff", "#cf142b"], pr: ["#ed0000", "#ffffff", "#0050f0"],
		do: ["#002d62", "#ffffff", "#ce1126"], gh: ["#ce1126", "#fcd116", "#006b3f"], et: ["#078930", "#fcdd09", "#da121a"]
	};
	SSO.countryName = function (code) {
		for (var i = 0; i < SSO.COUNTRIES.length; i++) { if (SSO.COUNTRIES[i][0] === code) { return SSO.COUNTRIES[i][1]; } }
		return String(code || "").toUpperCase();
	};
	SSO.countryTheme = function (code) { return SSO.COUNTRY_THEMES[code] || ["#333333", "#ffffff", "#777777"]; };
	// SVG keeps the real aspect (good for <img>); PNG stretches to fill (needed for the sliced waving strips).
	SSO.flagURL = function (code, width) {
		var c = String(code || "us").toLowerCase().replace(/[^a-z-]/g, "");
		return width ? "https://flagcdn.com/w" + width + "/" + c + ".png" : "https://flagcdn.com/" + c + ".svg";
	};

	SSO.f.country = function (key, def, label, group, show) {
		return { key: key || "country", label: label || "Country", type: "select", group: group || "Flag", default: def || "us", show: show, options: SSO.COUNTRIES.map(function (c) { return [c[0], c[1]]; }) };
	};

	SSO.addStyle([
		".wf{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;overflow:hidden;}",
		".wf{align-items:center;}",
		".wf i{flex:1;height:108%;margin-right:-1px;background-repeat:no-repeat;animation:wf-wave var(--wfs,3s) ease-in-out infinite;will-change:transform;}",
		"@keyframes wf-wave{0%,100%{transform:translateY(calc(var(--wfa,2%) * -1));filter:brightness(.82)}50%{transform:translateY(var(--wfa,2%));filter:brightness(1.12)}}",
		".wf.mono i{animation-name:wf-wave-mono;}",
		"@keyframes wf-wave-mono{0%,100%{transform:translateY(calc(var(--wfa,2%) * -1));filter:grayscale(1) contrast(1.1) brightness(.7)}50%{transform:translateY(var(--wfa,2%));filter:grayscale(1) contrast(1.1) brightness(1.05)}}",
		".wf.still i{animation:none;}",
		".wf.still.mono i{filter:grayscale(1) contrast(1.1) brightness(.85);}",
		".wf-shade{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;}",
		".wf-grain{position:absolute;left:-10%;top:-10%;width:120%;height:120%;pointer-events:none;opacity:.22;mix-blend-mode:overlay;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E\");}",
		".wf-scratch{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;opacity:.35;background-image:repeating-linear-gradient(100deg,transparent 0 46px,rgba(255,255,255,.05) 47px,transparent 49px),repeating-linear-gradient(80deg,transparent 0 83px,rgba(0,0,0,.25) 84px,transparent 86px);}"
	].join("\n"), "sso-flag-css");

	// Draws a (waving) flag filling host. opts: { mono, still, strips, amp (%), speed (s), darken (0-1), grain, vignette, fallback colours }
	SSO.wavingFlag = function (host, code, opts) {
		opts = opts || {};
		var wrap = document.createElement("div");
		wrap.className = "wf" + (opts.mono ? " mono" : "") + (opts.still ? " still" : "");
		wrap.style.setProperty("--wfa", (opts.amp == null ? 2.5 : opts.amp) + "%");
		wrap.style.setProperty("--wfs", (opts.speed || 3.2) + "s");
		var theme = SSO.countryTheme(code);
		wrap.style.background = "linear-gradient(90deg," + theme[0] + "," + theme[1] + "," + theme[2] + ")";
		var n = opts.still ? 1 : (opts.strips || 48);
		var url = SSO.flagURL(code, opts.res || (opts.still ? 1280 : 2560));
		var html = "";
		for (var i = 0; i < n; i++) {
			html += '<i style="background-image:url(' + url + ");background-size:" + (n * 100) + "% 100%;background-position:" + (n > 1 ? (i / (n - 1) * 100) : 0) + "% 0;animation-delay:-" + (i * (opts.speed || 3.2) / n * 1.6).toFixed(3) + 's"></i>';
		}
		wrap.innerHTML = html;
		host.appendChild(wrap);
		var shade = document.createElement("div");
		shade.className = "wf-shade";
		var dark = opts.darken || 0;
		shade.style.background = (opts.vignette ? "radial-gradient(ellipse at 50% 50%,rgba(0,0,0," + dark * 0.6 + ") 30%,rgba(0,0,0," + Math.min(1, dark + 0.35) + ") 100%)" : "rgba(0,0,0," + dark + ")");
		host.appendChild(shade);
		if (opts.grain) {
			var grain = document.createElement("div");
			grain.className = "wf-grain";
			host.appendChild(grain);
			var scratch = document.createElement("div");
			scratch.className = "wf-scratch";
			host.appendChild(scratch);
		}
		return wrap;
	};
})();
