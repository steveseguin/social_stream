const colorCache = new Map();
const MAX_CACHE_SIZE = 1000;
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

function getColorFromName(str, settings) {
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
