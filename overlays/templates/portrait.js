/* Vertical pack: overlays for 9:16 streams (TikTok LIVE, Shorts, live selling) and panels that fill the empty bars
   when a vertical video sits in a 16:9 canvas (or a wide video sits in a 9:16 canvas).
   Static like the rest of the studio: every value is typed into the link, nothing talks to chat. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.register) { return; }
	var esc = SSO.esc, uid = 0;

	// ---------------------------------------------------------------- small helpers
	function mk(tag, cls, parent, html) {
		var e = document.createElement(tag);
		if (cls) { e.className = cls; }
		if (html != null) { e.innerHTML = html; }
		if (parent) { parent.appendChild(e); }
		return e;
	}
	function rgbOf(v) {
		var m = /^#([0-9a-f]{3,8})$/i.exec(SSO.color(v, ""));
		if (!m) { return null; }
		var h = m[1];
		if (h.length === 3 || h.length === 4) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
		if (h.length < 6) { return null; }
		return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
	}
	function alpha(v, a) { var c = rgbOf(v); return c ? "rgba(" + c.join(",") + "," + a + ")" : SSO.color(v); }
	// Readable text colour for sitting on top of a fill.
	function isDark(v) { var c = rgbOf(v); return !c || (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) <= 150; }
	function onColor(v) { var c = rgbOf(v); return c && (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) > 150 ? "#14161c" : "#ffffff"; }
	function pick(v, fallback) { return SSO.color(v || fallback, SSO.color(fallback)); }
	function r2(n) { return Math.round(n * 100) / 100; }
	function watch(root, fn) {
		function run() { fn(root.clientWidth || window.innerWidth, root.clientHeight || window.innerHeight); }
		run();
		window.addEventListener("resize", run);
		SSO.onCleanup(root, function () { window.removeEventListener("resize", run); });
		return run;
	}
	// Cross-fades through the children of box, one at a time.
	function rotate(box, seconds) {
		var kids = box.children, i = 0;
		if (!kids.length) { return; }
		kids[0].className += " on";
		if (kids.length < 2) { return; }
		setInterval(function () {
			kids[i].className = kids[i].className.replace(/\s*\bon\b/, "");
			i = (i + 1) % kids.length;
			kids[i].className += " on";
		}, Math.max(2, seconds || 6) * 1000);
	}
	function qrInto(box, link) {
		if (!box || !window.QRCode || !link) { return; }
		try { new window.QRCode(box, { text: link, width: 420, height: 420, colorDark: "#000000", colorLight: "#ffffff" }); } catch (e) {}
	}
	// Sets el to the largest size (in em, at most base) where the longest word of text still fits across it.
	// Measured with a canvas, because text effects add shadows and offset copies that confuse scrollWidth.
	var measurer = null;
	function fitWords(el, text, base, upper, fx) {
		el.style.fontSize = base + "em";
		var cs = window.getComputedStyle(el), px = parseFloat(cs.fontSize) || 16, room = el.clientWidth;
		if (!room) { return; }
		measurer = measurer || document.createElement("canvas").getContext("2d");
		measurer.font = (fx === "chrome" || fx === "vapor" ? "italic" : "normal") + " " + (cs.fontWeight || "700") + " " + px + "px " + cs.fontFamily;
		var spacing = parseFloat(cs.letterSpacing) || 0, widest = 0;
		String(upper ? String(text).toUpperCase() : text).split(/\s+/).forEach(function (word) {
			widest = Math.max(widest, measurer.measureText(word).width + spacing * word.length);
		});
		widest *= fx === "ransom" ? 1.45 : fx ? 1.12 : 1.04;
		if (widest > room) { el.style.fontSize = r2(base * room / widest) + "em"; }
	}
	function field(base, extra) { Object.keys(extra).forEach(function (k) { base[k] = extra[k]; }); return base; }
	var SVG = {
		truck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M1.5 5.5h12v10h-12zM14.5 8.5h4.2l3.8 3.9v3.1h-8zM6 19.6a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6zM17.6 19.6a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z"/></svg>',
		box: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 2.5l8.5 4.6v9.8L12 21.5l-8.5-4.6V7.1zM3.5 7.1L12 11.8l8.5-4.7M12 11.8v9.7"/></svg>',
		clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5.4l3.4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
	};

	// ---------------------------------------------------------------- shared styles
	var CSS = [
		".pp{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;line-height:1.2;}",
		".pp-bg,.pp-look,.pp-lay{position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;}",
		".pp-fx{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;}",
		".pp-blob{position:absolute;border-radius:50%;animation:pp-drift 24s ease-in-out infinite alternate;}",
		"@keyframes pp-drift{from{transform:translate(0,0) scale(1)}to{transform:translate(5%,8%) scale(1.2)}}",
		"@keyframes pp-pan{from{background-position:0 0}to{background-position:var(--pp-s) var(--pp-s)}}",
		"@keyframes pp-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}",
		".pp-win{position:absolute;box-sizing:border-box;pointer-events:none;}",
		".pp-win i{position:absolute;display:block;box-sizing:border-box;}",
		".pp-col{position:absolute;box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;padding:4.2em 3.8em;overflow:hidden;}",
		".pp-col.row{flex-direction:row;align-items:center;padding:3em 2.2em;}",
		".pp-mod{flex:0 0 auto;min-width:0;margin:1.3em 0;animation:pp-in .9s ease both;}",
		".pp-mod:nth-child(2){animation-delay:.15s;} .pp-mod:nth-child(3){animation-delay:.3s;}",
		// Opacity only: a moving entrance would count as overflow while the columns are being measured.
		"@keyframes pp-in{from{opacity:0}to{opacity:1}}",
		".pp-col.row .pp-mod{flex:1 1 0;margin:0 1.6em;}",
		".pp-mod.grow{flex:1 1 0;min-height:0;display:flex;flex-direction:column;}",
		".pp-col.row .pp-mod.grow{align-self:stretch;}",
		".pp-card{background:var(--pp-card);border:1px solid var(--pp-line);border-radius:2em;padding:2.2em 2.6em;box-shadow:0 1.4em 3.4em rgba(0,0,0,.22);box-sizing:border-box;}",
		".pp-mod.grow > .pp-card{flex:1 1 0;min-height:0;display:flex;flex-direction:column;}",
		".pp.c-outline .pp-card{background:none;box-shadow:none;border:.22em solid var(--pp-line2);}",
		".pp.c-none .pp-card{background:none;border:0;box-shadow:none;padding:0;}",
		".pp.c-none .pp-col{text-shadow:0 .1em .5em rgba(0,0,0,.45);}",
		".pp-h{display:flex;align-items:center;font-size:1.7em;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.82;margin-bottom:.85em;}",
		".pp-h:before{content:'';flex:0 0 auto;width:.5em;height:.5em;border-radius:50%;background:var(--pp-acc);margin-right:.6em;}",
		// title block
		".pp-title{text-align:center;}",
		".pp-title,.pp-clock,.pp-cap,.pp-vt{text-shadow:0 .06em .45em var(--pp-ts);}",
		".pp.l-engine .pp-title,.pp.l-engine .pp-clock{background:radial-gradient(closest-side,var(--pp-scrim),transparent);padding:3em 1em;margin:-3em -1em;}",
		".pp-kick{display:inline-flex;align-items:center;font-size:1.7em;font-weight:800;letter-spacing:.18em;text-transform:uppercase;padding:.4em 1em;border-radius:99em;background:var(--pp-acc);color:var(--pp-on);text-shadow:none;}",
		".pp-kick i{width:.55em;height:.55em;border-radius:50%;background:currentColor;margin-right:.55em;animation:pp-pulse 1.4s ease-in-out infinite;}",
		".pp-t1{font-size:6.6em;font-weight:800;line-height:1;margin-top:.28em;}",
		".pp-t1 > span{display:inline-block;max-width:100%;}",
		".pp-t2{font-size:2.3em;opacity:.86;margin-top:.55em;line-height:1.28;font-weight:500;}",
		// sideways title
		".pp-vt{flex:1 1 0;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;}",
		".pp-vt span{-webkit-writing-mode:vertical-rl;writing-mode:vertical-rl;font-weight:800;line-height:1;white-space:nowrap;font-size:13em;letter-spacing:.03em;}",
		".pp-vt.up span{transform:rotate(180deg);}",
		// lists
		".pp-soc-r{display:flex;align-items:center;font-size:2.5em;font-weight:600;padding:.44em 0;min-width:0;}",
		".pp-soc-r + .pp-soc-r{border-top:1px solid var(--pp-line);}",
		".pp-soc-r .sso-icon{width:1.35em;height:1.35em;margin-right:.6em;flex:0 0 auto;}",
		".pp-soc-r span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}",
		// The waiting messages sit a little lower and slide up. Clipping them here keeps that offset (and its transition while
		// sizes are still settling) from being counted as overflow when the layout is measured.
		".pp-msgs{display:grid;overflow:hidden;padding:1em 0;margin:-1em 0;}",
		".pp-msgs > div{grid-area:1/1;font-size:2.9em;font-weight:600;line-height:1.26;opacity:0;transform:translateY(.4em);transition:opacity .7s,transform .7s;}",
		".pp-msgs > div.on{opacity:1;transform:none;}",
		".pp-dots{display:flex;align-items:center;margin-top:1.3em;}",
		".pp-dots i{width:.8em;height:.8em;border-radius:99em;background:var(--pp-line2);margin-right:.6em;transition:width .5s,background .5s;}",
		".pp-dots i.on{width:2.6em;background:var(--pp-acc);}",
		".pp-clock{text-align:center;}",
		".pp-time{font-size:7.6em;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;}",
		".pp-time small{font-size:.3em;margin-left:.25em;opacity:.8;font-weight:700;}",
		".pp-date{font-size:2.2em;opacity:.86;margin-top:.55em;}",
		".pp-img{text-align:center;}",
		".pp-img img{display:block;max-width:100%;max-height:26em;margin:0 auto;border-radius:1.6em;}",
		".pp-img.circle img{width:24em;height:24em;object-fit:cover;border-radius:50%;box-shadow:0 0 0 .5em var(--pp-line),0 1.4em 3.4em rgba(0,0,0,.3);}",
		".pp-img.plain img{border-radius:0;}",
		".pp-cap{font-size:2.2em;font-weight:700;margin-top:.7em;text-align:center;}",
		".pp-qr{display:flex;flex-direction:column;align-items:center;}",
		".pp-qr-box{background:#fff;padding:1.4em;border-radius:1.8em;line-height:0;width:24em;box-sizing:border-box;box-shadow:0 1.4em 3.4em rgba(0,0,0,.3);}",
		".pp-qr-box img,.pp-qr-box canvas{width:100% !important;height:auto !important;}",
		".pp-sch-r{display:flex;align-items:baseline;font-size:2.3em;padding:.42em .55em;border-radius:.55em;}",
		".pp-sch-r b{flex:0 0 3em;color:var(--pp-acc);text-transform:uppercase;letter-spacing:.06em;font-size:.86em;}",
		".pp-sch-r i{font-style:normal;flex:0 0 4.2em;opacity:.8;font-variant-numeric:tabular-nums;}",
		".pp-sch-r span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;}",
		".pp-sch-r.today{background:var(--pp-acc);color:var(--pp-on);text-shadow:none;} .pp-sch-r.today b{color:inherit;} .pp-sch-r.today i{opacity:1;}",
		".pp-step{display:flex;align-items:center;font-size:2.5em;font-weight:600;line-height:1.22;padding:.42em 0;}",
		".pp-step b{flex:0 0 auto;width:1.75em;height:1.75em;border-radius:50%;background:var(--pp-acc);color:var(--pp-on);display:flex;align-items:center;justify-content:center;margin-right:.7em;font-size:.9em;text-shadow:none;}",
		".pp-price{display:flex;align-items:baseline;font-size:2.5em;padding:.36em 0;}",
		".pp-price span{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
		".pp-price i{flex:1;border-bottom:.12em dotted var(--pp-line2);margin:0 .5em;min-width:.8em;transform:translateY(-.22em);}",
		".pp-price b{color:var(--pp-acc);font-variant-numeric:tabular-nums;white-space:nowrap;}",
		".pp-tick{position:relative;overflow:hidden;flex:1 1 0;min-height:14em;-webkit-mask-image:linear-gradient(180deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(180deg,transparent,#000 12%,#000 88%,transparent);}",
		".pp-tick-in{position:absolute;left:0;right:0;top:0;animation:pp-tick linear infinite;}",
		".pp-tick-in div{font-size:2.6em;font-weight:600;padding:.55em 0;line-height:1.25;border-bottom:1px solid var(--pp-line);}",
		"@keyframes pp-tick{from{transform:translateY(0)}to{transform:translateY(-50%)}}",
		".pp-pet{position:relative;width:22em;margin:0 auto;}",
		".pp-say{position:relative;font-size:2.3em;font-weight:700;text-align:center;background:#fff;color:#22252e;border-radius:1em;padding:.5em .8em;margin:0 auto .9em;max-width:11em;box-shadow:0 .4em 1.2em rgba(0,0,0,.25);text-shadow:none;}",
		".pp-say:after{content:'';position:absolute;left:50%;bottom:-.5em;margin-left:-.5em;border:.5em solid transparent;border-top-color:#fff;border-bottom:0;}",
		".pp-eq{display:flex;align-items:flex-end;justify-content:center;height:16em;}",
		".pp-eq i{flex:1;max-width:2.4em;margin:0 .35em;height:100%;border-radius:.7em .7em 0 0;background:linear-gradient(180deg,var(--pp-acc),var(--pp-acc2));transform-origin:50% 100%;animation:pp-eq ease-in-out infinite alternate;}",
		"@keyframes pp-eq{from{transform:scaleY(.12)}to{transform:scaleY(1)}}"
	].join("\n");
	function common() { SSO.addStyle(CSS, "sso-portrait-css"); }

	// ---------------------------------------------------------------- panel backgrounds
	var LOOKS = [["glow", "Soft colour glow"], ["gradient", "Gradient"], ["solid", "Solid colour"], ["dots", "Dots"], ["stripes", "Diagonal stripes"], ["grid", "Grid"], ["halftone", "Halftone fade"], ["engine", "Animated background"]];
	// Paints a look into host. Pattern sizes follow --pp-u (one layout unit in px) so they scale with the source.
	function paintLook(host, c, glowSpots) {
		var c1 = pick(c.c1, "10132b"), c2 = pick(c.c2, "5b21b6"), c3 = pick(c.c3, "22d3ee"), look = c.look;
		if (look === "engine" && SSO.ENGINES && SSO.ENGINES[c.engine]) {
			SSO.startEngine(c.engine, host, { c1: c.c1, c2: c.c2, c3: c.c3, speed: c.speed, count: 8, minutes: 3 });
			if (c.dim > 0) { mk("div", "pp-lay", host.parentNode).style.background = "rgba(0,0,0," + c.dim + ")"; }
			return;
		}
		var pan = c.motion ? "animation:pp-pan 14s linear infinite;" : "";
		if (look === "solid") { host.style.background = c1; return; }
		if (look === "gradient" || look === "engine") { host.style.background = "linear-gradient(160deg," + c2 + "," + c1 + " 62%)"; mk("div", "pp-lay", host).style.background = "radial-gradient(120% 60% at 50% 100%," + alpha(c3, 0.28) + ",transparent 70%)"; return; }
		if (look === "dots") {
			host.style.cssText += "background-color:" + c1 + ";--pp-s:calc(var(--pp-u) * 3.6);background-image:radial-gradient(" + alpha(c2, 0.7) + " 20%,transparent 22%);background-size:var(--pp-s) var(--pp-s);" + pan;
			mk("div", "pp-lay", host).style.background = "linear-gradient(180deg,transparent 30%," + alpha(c3, 0.3) + ")";
			return;
		}
		if (look === "stripes") {
			host.style.cssText += "--pp-s:calc(var(--pp-u) * 7);background-image:linear-gradient(135deg," + c1 + " 25%," + c2 + " 25%," + c2 + " 50%," + c1 + " 50%," + c1 + " 75%," + c2 + " 75%);background-size:var(--pp-s) var(--pp-s);" + pan;
			mk("div", "pp-lay", host).style.background = "linear-gradient(180deg," + alpha(c3, 0.22) + ",transparent 45%,rgba(0,0,0,.28))";
			return;
		}
		if (look === "grid") {
			var line = alpha(c2, 0.55);
			host.style.cssText += "background-color:" + c1 + ";--pp-s:calc(var(--pp-u) * 6);background-image:linear-gradient(" + line + " 1.5px,transparent 1.5px),linear-gradient(90deg," + line + " 1.5px,transparent 1.5px);background-size:var(--pp-s) var(--pp-s);" + pan;
			mk("div", "pp-lay", host).style.background = "radial-gradient(120% 55% at 50% 100%," + alpha(c3, 0.4) + ",transparent 70%)";
			return;
		}
		if (look === "halftone") {
			host.style.background = "linear-gradient(180deg," + c1 + "," + c2 + ")";
			var dots = mk("div", "pp-lay", host);
			dots.style.cssText += "--pp-s:calc(var(--pp-u) * 3);background-image:radial-gradient(" + c3 + " 34%,transparent 36%);background-size:var(--pp-s) var(--pp-s);-webkit-mask-image:linear-gradient(0deg,#000,transparent 72%);mask-image:linear-gradient(0deg,#000,transparent 72%);opacity:.75;" + pan;
			return;
		}
		// glow: soft blobs of the second and third colours, parked where the panels are
		host.style.background = c1;
		(glowSpots || [["-14%", "-22%", "62%", "92%", c2, 0.9, 0], ["52%", "34%", "62%", "92%", c3, 0.6, -9], ["-18%", "46%", "48%", "70%", c3, 0.35, -15], ["66%", "-28%", "46%", "70%", c2, 0.55, -5]]).forEach(function (s) {
			var b = mk("div", "pp-blob", host);
			b.style.cssText += "left:" + s[0] + ";top:" + s[1] + ";width:" + s[2] + ";height:" + s[3] + ";background:radial-gradient(closest-side," + alpha(s[4], s[5]) + ",transparent);animation-delay:" + s[6] + "s;" + (c.motion ? "" : "animation:none;");
		});
	}

	// ---------------------------------------------------------------- drifting extras over the panels
	var FX = [["", "None"], ["eq", "Equalizer bars"], ["shapes", "Drifting shapes"], ["hearts", "Floating hearts"], ["pixels", "Pixel rain"], ["bubbles", "Bubbles"], ["stars", "Twinkling stars"], ["snow", "Snow"]];
	function startFx(host, c, regions) {
		if (!c.deco) { return; }
		var kind = c.deco;
		var cv = mk("canvas", "pp-fx", host), g = cv.getContext("2d"), alive = true, frameId = 0, last = 0, t = 0, W = 0, H = 0, d = 1, parts = [];
		var acc = pick(c.accent, "ff4fd8"), acc2 = pick(c.c3, "22d3ee"), amount = c.decoamount || 1;
		var base = { shapes: 26, hearts: 22, pixels: 60, bubbles: 28, stars: 60, snow: 90, eq: 0 }[kind] || 0;
		function seed() {
			parts = [];
			var n = Math.round(base * amount * Math.max(0.35, W * H / (1920 * 1080)));
			for (var i = 0; i < n; i++) {
				parts.push({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random(), p: Math.random() * 6.283, v: 0.5 + Math.random(), k: i % 4, r: Math.random() * 6.283, vr: (Math.random() - 0.5) * 0.8 });
			}
		}
		function fit() {
			var w = host.clientWidth, h = host.clientHeight;
			if (w === W && h === H) { return; }
			W = w; H = h; d = Math.min(window.devicePixelRatio || 1, 1.5);
			cv.width = Math.max(2, Math.round(W * d)); cv.height = Math.max(2, Math.round(H * d));
			seed();
		}
		function heart(x, y, s) { g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.45, y - s, x, y - s * 0.45); g.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.3, x, y + s * 0.35); g.closePath(); }
		function star(x, y, s) { g.beginPath(); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rr = i % 2 ? s * 0.28 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }
		function draw(dt) {
			var u = H / 108, i, p;
			g.setTransform(d, 0, 0, d, 0, 0);
			g.clearRect(0, 0, W, H);
			if (kind === "eq") {
				regions().forEach(function (R, ri) {
					var n = Math.max(6, Math.round(R[2] / (u * 5))), bw = R[2] / n, top = R[3] * 0.24;
					var gr = g.createLinearGradient(0, R[1] + R[3] - top, 0, R[1] + R[3]);
					gr.addColorStop(0, alpha(acc, 0.85)); gr.addColorStop(1, alpha(acc2, 0.25));
					g.fillStyle = gr;
					for (i = 0; i < n; i++) {
						var k = i + ri * 31, lv = 0.5 + 0.5 * Math.sin(t * (1.6 + (k % 7) * 0.33) + k * 1.7) * Math.sin(t * 0.8 + k * 0.6);
						lv = 0.12 + 0.88 * lv * lv;
						var bh = top * lv, bx = R[0] + i * bw + bw * 0.16, bwid = bw * 0.68, by = R[1] + R[3] - bh, rad = Math.min(bwid / 2, u * 0.9);
						g.beginPath(); g.moveTo(bx, by + bh); g.lineTo(bx, by + rad); g.quadraticCurveTo(bx, by, bx + rad, by); g.lineTo(bx + bwid - rad, by); g.quadraticCurveTo(bx + bwid, by, bx + bwid, by + rad); g.lineTo(bx + bwid, by + bh); g.closePath(); g.fill();
					}
				});
				return;
			}
			for (i = 0; i < parts.length; i++) {
				p = parts[i];
				if (kind === "shapes") {
					p.y -= p.v * u * 0.9 * dt; p.x += Math.sin(t * 0.3 + p.p) * u * 0.5 * dt; p.r += p.vr * dt;
					if (p.y < -u * 8) { p.y = H + u * 8; p.x = Math.random() * W; }
					var s = u * (1.6 + p.s * 2.6);
					g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.lineWidth = Math.max(1.5, u * 0.42); g.strokeStyle = alpha(p.k % 2 ? acc : acc2, 0.42);
					g.beginPath();
					if (p.k === 0) { g.arc(0, 0, s, 0, 6.283); }
					else if (p.k === 1) { g.rect(-s, -s, s * 2, s * 2); }
					else if (p.k === 2) { g.moveTo(0, -s * 1.15); g.lineTo(s, s * 0.8); g.lineTo(-s, s * 0.8); g.closePath(); }
					else { g.moveTo(-s, 0); g.lineTo(s, 0); g.moveTo(0, -s); g.lineTo(0, s); }
					g.stroke(); g.restore();
				} else if (kind === "hearts") {
					p.y -= p.v * u * 4.2 * dt; p.x += Math.sin(t * 0.9 + p.p) * u * 1.4 * dt;
					if (p.y < -u * 6) { p.y = H + u * 6; p.x = Math.random() * W; }
					g.fillStyle = alpha(p.k % 2 ? acc : acc2, Math.min(0.75, 0.15 + (p.y / H) * 0.7));
					heart(p.x, p.y, u * (1.2 + p.s * 1.8)); g.fill();
				} else if (kind === "pixels") {
					var cell = u * 2.2;
					p.y += p.v * u * 16 * dt;
					if (p.y > H + cell * 6) { p.y = -cell * 6; p.x = Math.random() * W; }
					var px = Math.floor(p.x / cell) * cell, py = Math.floor(p.y / cell) * cell;
					for (var q = 0; q < 5; q++) { g.fillStyle = alpha(p.k % 2 ? acc : acc2, 0.6 - q * 0.12); g.fillRect(px, py - q * cell, cell * 0.86, cell * 0.86); }
				} else if (kind === "bubbles") {
					p.y -= p.v * u * 3.4 * dt; p.x += Math.sin(t * 0.7 + p.p) * u * 1.1 * dt;
					if (p.y < -u * 6) { p.y = H + u * 6; p.x = Math.random() * W; }
					var br = u * (0.8 + p.s * 2.2);
					g.lineWidth = Math.max(1, u * 0.22); g.strokeStyle = alpha(p.k % 2 ? acc : acc2, 0.5); g.beginPath(); g.arc(p.x, p.y, br, 0, 6.283); g.stroke();
					g.strokeStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(p.x, p.y, br * 0.62, 3.6, 4.6); g.stroke();
				} else if (kind === "stars") {
					g.fillStyle = alpha(p.k % 3 ? "#ffffff" : acc, 0.12 + 0.75 * Math.abs(Math.sin(t * p.v * 1.3 + p.p)));
					star(p.x, p.y, u * (0.5 + p.s * 0.9)); g.fill();
				} else {
					p.y += p.v * u * 5.5 * dt; p.x += Math.sin(t * 0.8 + p.p) * u * 1.6 * dt;
					if (p.y > H + u * 3) { p.y = -u * 3; p.x = Math.random() * W; }
					g.fillStyle = "rgba(255,255,255," + (0.35 + p.s * 0.3).toFixed(2) + ")"; g.beginPath(); g.arc(p.x, p.y, u * (0.25 + p.s * 0.5), 0, 6.283); g.fill();
				}
			}
		}
		SSO.onCleanup(host, function () { alive = false; cancelAnimationFrame(frameId); });
		(function frame(now) {
			if (!alive) { return; }
			frameId = requestAnimationFrame(frame);
			// About 30 frames a second is plenty for slow drifting things and halves the cost.
			if (now - last < 30) { return; }
			var dt = Math.min(0.08, (now - last) / 1000 || 0.03); last = now; t += dt;
			fit();
			draw(dt);
		})(performance.now());
	}

	// ---------------------------------------------------------------- panel content blocks
	var MODULES = [["", "Nothing"], ["title", "Title block"], ["vtitle", "Big sideways title"], ["socials", "Social accounts"], ["messages", "Rotating messages"], ["clock", "Clock & date"],
		["image", "Logo or image"], ["qr", "QR code"], ["schedule", "Schedule"], ["support", "Tip & support links"], ["steps", "How-to steps"], ["prices", "Price list"],
		["ticker", "Scrolling list"], ["pet", "Cat"], ["eq", "Equalizer bars"]];
	var DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
	function heading(text) { return text ? '<div class="pp-h">' + esc(text) + "</div>" : ""; }
	function socialRows(value, icons) {
		return SSO.parseSocials(value).map(function (s) { return '<div class="pp-soc-r">' + SSO.iconHTML(s.net, icons) + "<span>" + esc(s.handle) + "</span></div>"; }).join("");
	}
	// Each builder fills box and may return a fit() that runs whenever the column is resized.
	var BUILD = {
		title: function (box, c) {
			box.innerHTML = '<div class="pp-title">' + (c.kicker ? '<div class="pp-kick"><i></i>' + esc(c.kicker) + "</div>" : "") +
				(c.title ? '<div class="pp-t1"><span>' + SSO.fxHTML(c.title, c.fx) + "</span></div>" : "") + (c.subtitle ? '<div class="pp-t2">' + esc(c.subtitle) + "</div>" : "") + "</div>";
			var t1 = box.querySelector(".pp-t1"), span = t1 && t1.firstChild;
			if (!t1) { return null; }
			if (c.fx && c.fx !== "ransom") { SSO.applyFX(span, c.fx, c.fx1, c.fx2, c.fx3); }
			// One long word would poke out of a narrow panel; shrink the title until its widest word fits.
			return function () { fitWords(t1, c.title, 6.6, false, c.fx); };
		},
		vtitle: function (box, c, env) {
			box.className += " grow";
			box.innerHTML = '<div class="pp-vt' + (env.second ? "" : " up") + '"><span>' + SSO.fxHTML(c.title || "Your Name", c.fx === "ransom" ? "" : c.fx) + "</span></div>";
			var holder = box.firstChild, span = holder.firstChild;
			if (c.fx && c.fx !== "ransom") { SSO.applyFX(span, c.fx, c.fx1, c.fx2, c.fx3); }
			return function () {
				var size = 13;
				span.style.fontSize = size + "em";
				for (var n = 0; n < 24 && size > 1.5 && (span.offsetHeight > holder.clientHeight || span.offsetWidth > holder.clientWidth); n++) { size *= 0.93; span.style.fontSize = size + "em"; }
			};
		},
		socials: function (box, c) { box.innerHTML = '<div class="pp-card">' + heading(c.sochead) + socialRows(c.socials, c.icons) + "</div>"; },
		support: function (box, c) { box.innerHTML = '<div class="pp-card">' + heading(c.suphead) + socialRows(c.support, c.icons) + "</div>"; },
		messages: function (box, c) {
			var lines = SSO.lines(c.messages);
			if (!lines.length) { return null; }
			box.innerHTML = '<div class="pp-card">' + heading(c.msghead) + '<div class="pp-msgs">' + lines.map(function (m) { return "<div>" + esc(m) + "</div>"; }).join("") + "</div>" +
				(lines.length > 1 ? '<div class="pp-dots">' + lines.map(function () { return "<i></i>"; }).join("") + "</div>" : "") + "</div>";
			rotate(box.querySelector(".pp-msgs"), c.msgtime);
			// The dots step in time with the messages so viewers can see there is more coming.
			if (lines.length > 1) { rotate(box.querySelector(".pp-dots"), c.msgtime); }
		},
		clock: function (box, c) {
			box.innerHTML = '<div class="pp-clock"><div class="pp-time"></div><div class="pp-date"></div></div>';
			var time = box.querySelector(".pp-time"), date = box.querySelector(".pp-date"), last = "";
			function tick() {
				var now = new Date(), text = SSO.formatTime(SSO.zonedParts(now, c.tz), c.h12, false);
				if (text === last) { return; }
				last = text;
				var m = / (AM|PM)$/.exec(text);
				time.innerHTML = esc(m ? text.slice(0, -3) : text) + (m ? "<small>" + m[1] + "</small>" : "");
				date.textContent = SSO.formatDate(now, c.tz, "long");
			}
			tick();
			setInterval(tick, 1000);
			// A wide display font can make the time wider than a narrow panel; shrink just the time, not the whole column.
			return function () {
				time.style.fontSize = "7.6em";
				if (time.scrollWidth > time.clientWidth + 1) { time.style.fontSize = r2(7.6 * time.clientWidth / time.scrollWidth * 0.97) + "em"; }
			};
		},
		image: function (box, c, env) {
			if (!c.image) { return null; }
			box.innerHTML = '<div class="pp-img ' + esc(c.imgshape) + '"><img alt=""></div>' + (c.imgcap ? '<div class="pp-cap">' + esc(c.imgcap) + "</div>" : "");
			var img = box.querySelector("img");
			img.onerror = function () { img.style.display = "none"; };
			img.onload = env.refit;
			img.src = c.image;
		},
		qr: function (box, c) {
			if (!c.qr) { return null; }
			box.innerHTML = '<div class="pp-qr"><div class="pp-qr-box"></div>' + (c.qrcap ? '<div class="pp-cap">' + esc(c.qrcap) + "</div>" : "") + "</div>";
			qrInto(box.querySelector(".pp-qr-box"), c.qr);
		},
		schedule: function (box, c) {
			var today = DAYS[SSO.zonedParts(new Date(), c.tz).wd];
			box.innerHTML = '<div class="pp-card">' + heading(c.schhead) + SSO.lines(c.schedule).map(function (line) {
				var p = line.split("|").map(function (s) { return s.trim(); });
				return '<div class="pp-sch-r' + (p[0].toLowerCase().slice(0, 3) === today ? " today" : "") + '"><b>' + esc(p[0]) + "</b>" + (p.length > 2 ? "<i>" + esc(p[1]) + "</i>" : "") + "<span>" + esc(p.slice(p.length > 2 ? 2 : 1).join(" | ")) + "</span></div>";
			}).join("") + "</div>";
		},
		steps: function (box, c) {
			box.innerHTML = '<div class="pp-card">' + heading(c.stepshead) + SSO.lines(c.steps).map(function (line, i) { return '<div class="pp-step"><b>' + (i + 1) + "</b><span>" + esc(line) + "</span></div>"; }).join("") + "</div>";
		},
		prices: function (box, c) {
			box.innerHTML = '<div class="pp-card">' + heading(c.priceshead) + SSO.lines(c.prices).map(function (line) {
				var p = line.split("|").map(function (s) { return s.trim(); });
				return '<div class="pp-price"><span>' + esc(p[0]) + "</span>" + (p[1] ? "<i></i><b>" + esc(p[1]) + "</b>" : "") + "</div>";
			}).join("") + "</div>";
		},
		ticker: function (box, c) {
			var lines = SSO.lines(c.ticker);
			if (!lines.length) { return null; }
			box.className += " grow";
			var rows = lines.map(function (m) { return "<div>" + esc(m) + "</div>"; }).join("");
			box.innerHTML = '<div class="pp-card">' + heading(c.tickhead) + '<div class="pp-tick"><div class="pp-tick-in">' + rows + rows + "</div></div></div>";
			var inner = box.querySelector(".pp-tick-in"), holder = inner.parentNode, half = 1;
			function pace() {
				// Same reading pace however long the list is: about one line every couple of seconds.
				inner.style.animationDuration = Math.max(6, half * lines.length * 2.6 / (c.tickspeed || 1)) + "s";
			}
			pace();
			return function () {
				// The loop jumps back by half the strip, so each half has to be at least as tall as the window it scrolls
				// through. A short list in a tall panel is repeated until it is.
				var one = inner.offsetHeight / (half * 2), need = one > 0 ? Math.max(1, Math.min(12, Math.ceil(holder.clientHeight / one))) : 1;
				if (need === half) { return; }
				half = need;
				var html = "";
				for (var i = 0; i < half * 2; i++) { html += rows; }
				inner.innerHTML = html;
				pace();
			};
		},
		pet: function (box, c) {
			if (!SSO.catSVG) { return null; }
			box.innerHTML = (c.petsay ? '<div class="pp-say">' + esc(c.petsay) + "</div>" : "") + '<div class="pp-pet">' + SSO.catSVG("sit", c.coat) + "</div>";
		},
		eq: function (box) {
			var rnd = SSO.seeded("pp-eq"), html = "";
			for (var i = 0; i < 12; i++) { html += '<i style="animation-duration:' + (0.45 + rnd() * 0.7).toFixed(2) + "s;animation-delay:-" + (rnd() * 1.2).toFixed(2) + 's"></i>'; }
			box.innerHTML = '<div class="pp-eq">' + html + "</div>";
		}
	};
	// Fills one panel column with its chosen blocks; returns the list of fit functions.
	function fillColumn(colEl, ids, c, env) {
		var fits = [];
		ids.forEach(function (id) {
			if (!id || !BUILD[id]) { return; }
			var box = mk("div", "pp-mod");
			var fit = BUILD[id](box, c, env);
			if (!box.firstChild) { return; }
			colEl.appendChild(box);
			if (typeof fit === "function") { fits.push(fit); }
		});
		return fits;
	}
	// Sets the column's unit, then steps it down until nothing spills out of the panel.
	function fitColumn(colEl, base, fits) {
		var size = base;
		for (var n = 0; n < 22; n++) {
			colEl.style.fontSize = r2(size) + "px";
			fits.forEach(function (f) { f(); });
			if (size <= 3 || (colEl.scrollHeight <= colEl.clientHeight + 1 && colEl.scrollWidth <= colEl.clientWidth + 1)) { break; }
			size *= 0.94;
		}
	}

	// ---------------------------------------------------------------- window frame
	var FRAMES = [["", "None"], ["line", "Thin line"], ["double", "Double line"], ["glow", "Neon glow"], ["shadow", "Soft shadow"], ["gradient", "Gradient border"], ["brackets", "Corner brackets"], ["phone", "Phone bezel"]];
	// Draws the frame just outside the hole so it never covers the video. rect = [x, y, w, h], r = hole radius, k = px per design px.
	function drawFrame(win, c, rect, r, k) {
		var col = pick(c.framecolor, "ffffff"), w = Math.max(1, c.framew * k), style = c.frame;
		win.innerHTML = "";
		win.style.cssText = "";
		if (!style) { win.style.display = "none"; return; }
		function box(grow, radius) {
			win.style.left = r2(rect[0] - grow) + "px"; win.style.top = r2(rect[1] - grow) + "px";
			win.style.width = r2(rect[2] + grow * 2) + "px"; win.style.height = r2(rect[3] + grow * 2) + "px";
			win.style.borderRadius = r2(radius) + "px";
		}
		if (style === "line") { box(w, r + w); win.style.border = r2(w) + "px solid " + col; win.style.boxShadow = "0 " + r2(6 * k) + "px " + r2(26 * k) + "px rgba(0,0,0,.35)"; }
		else if (style === "double") {
			box(w * 3, r + w * 3); win.style.border = r2(w) + "px solid " + col;
			var inner = mk("i", "", win); inner.style.cssText = "left:" + r2(w) + "px;top:" + r2(w) + "px;right:" + r2(w) + "px;bottom:" + r2(w) + "px;border:" + r2(w) + "px solid " + col + ";border-radius:" + r2(r + w) + "px;";
		} else if (style === "glow") {
			box(w, r + w); win.style.border = r2(w) + "px solid #fff";
			win.style.boxShadow = "0 0 " + r2(w * 2.5) + "px " + col + ",0 0 " + r2(w * 7) + "px " + col + ",0 0 " + r2(w * 16) + "px " + alpha(col, 0.6) + ",inset 0 0 " + r2(w * 2.5) + "px " + col;
		} else if (style === "shadow") {
			box(0, r); win.style.boxShadow = "0 0 0 1px rgba(255,255,255,.14),0 " + r2(14 * k) + "px " + r2(70 * k) + "px rgba(0,0,0,.65),0 0 " + r2(18 * k) + "px rgba(0,0,0,.4)";
		} else if (style === "gradient") {
			box(w, r + w); win.style.padding = r2(w) + "px";
			win.style.background = "linear-gradient(160deg," + col + "," + pick(c.c3, "22d3ee") + "," + pick(c.c2, "5b21b6") + ")";
			win.style.webkitMask = "linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)"; win.style.webkitMaskComposite = "xor"; win.style.maskComposite = "exclude";
		} else if (style === "brackets") {
			var gap = w * 2.5, len = Math.min(rect[2], rect[3]) * 0.12;
			box(gap, 0);
			[["left", "top"], ["right", "top"], ["left", "bottom"], ["right", "bottom"]].forEach(function (p) {
				var b = mk("i", "", win);
				b.style.cssText = p[0] + ":0;" + p[1] + ":0;width:" + r2(len) + "px;height:" + r2(len) + "px;border-" + p[0] + ":" + r2(w) + "px solid " + col + ";border-" + p[1] + ":" + r2(w) + "px solid " + col + ";border-" + p[1] + "-" + p[0] + "-radius:" + r2(r + gap) + "px;";
			});
		} else if (style === "phone") {
			var bz = Math.max(w * 2.5, 12 * k);
			box(bz, r + bz); win.style.border = r2(bz) + "px solid #0c0d12";
			win.style.boxShadow = "0 0 0 " + r2(Math.max(1, 2 * k)) + "px " + alpha(col, 0.55) + ",0 " + r2(18 * k) + "px " + r2(60 * k) + "px rgba(0,0,0,.55),inset 0 0 0 " + r2(Math.max(1, 1.5 * k)) + "px rgba(255,255,255,.12)";
			var notch = mk("i", "", win); notch.style.cssText = "left:50%;top:" + r2(10 * k) + "px;width:" + r2(rect[2] * 0.2) + "px;height:" + r2(Math.max(8, 22 * k)) + "px;margin-left:" + r2(-rect[2] * 0.1) + "px;border-radius:99px;background:#0c0d12;";
			[[0.2, 0.07], [0.3, 0.1]].forEach(function (b) { var btn = mk("i", "", win); btn.style.cssText = "right:" + r2(-bz - 4 * k) + "px;top:" + (b[0] * 100) + "%;width:" + r2(Math.max(2, 5 * k)) + "px;height:" + (b[1] * 100) + "%;border-radius:" + r2(3 * k) + "px;background:#22242c;"; });
		}
	}
	function rrPath(x, y, w, h, r) {
		r = Math.max(0, Math.min(r, w / 2, h / 2));
		var a = function (dx, dy) { return r ? "a" + r2(r) + " " + r2(r) + " 0 0 1 " + r2(dx) + " " + r2(dy) : ""; };
		return "M" + r2(x + r) + " " + r2(y) + "h" + r2(w - 2 * r) + a(r, r) + "v" + r2(h - 2 * r) + a(-r, r) + "h" + r2(-(w - 2 * r)) + a(-r, -r) + "v" + r2(-(h - 2 * r)) + a(r, -r) + "z";
	}

	// ---------------------------------------------------------------- fields shared by both panel overlays
	function lookFields() {
		return [
			{ key: "look", label: "Panel background", type: "select", group: "Panels", default: "glow", options: LOOKS },
			{ key: "engine", label: "Animated background", type: "select", group: "Panels", default: "aurora", options: SSO.ENGINE_LIST || [], show: { look: "engine" } },
			{ key: "c1", label: "Colour 1", type: "color", group: "Panels", default: "" },
			{ key: "c2", label: "Colour 2", type: "color", group: "Panels", default: "" },
			{ key: "c3", label: "Colour 3", type: "color", group: "Panels", default: "" },
			{ key: "speed", label: "Background speed", type: "range", group: "Panels", default: 1, min: 0.1, max: 4, step: 0.1, show: { look: "engine" } },
			{ key: "dim", label: "Darken the background for readability", type: "range", group: "Panels", default: 0.25, min: 0, max: 0.9, step: 0.05, show: { look: "engine" } },
			{ key: "motion", label: "Slowly move the pattern", type: "bool", group: "Panels", default: true, show: { look: ["glow", "dots", "stripes", "grid", "halftone"] } },
			{ key: "opacity", label: "Panel opacity", type: "range", group: "Panels", default: 1, min: 0.1, max: 1, step: 0.05, help: "Lower it to let something behind the overlay in OBS (a blurred copy of your video, for example) show through." },
			{ key: "deco", label: "Drifting extras", type: "select", group: "Panels", default: "", options: FX },
			{ key: "decoamount", label: "How many", type: "range", group: "Panels", default: 1, min: 0.3, max: 3, step: 0.1, show: { deco: ["shapes", "hearts", "pixels", "bubbles", "stars", "snow"] } },
			{ key: "cards", label: "Content cards", type: "select", group: "Panels", default: "card", options: [["card", "Filled cards"], ["outline", "Outlined"], ["none", "No cards, just the content"]] },
			{ key: "cardbg", label: "Card colour", type: "color", group: "Panels", default: "0a0c18", show: { cards: "card" } },
			{ key: "cardop", label: "Card opacity", type: "range", group: "Panels", default: 0.5, min: 0, max: 1, step: 0.05, show: { cards: "card" } }
		];
	}
	function contentFields() {
		return [
			{ key: "kicker", label: "Small label above the title (blank = none)", type: "text", group: "Title block", default: "Live now" },
			{ key: "title", label: "Title", type: "text", group: "Title block", default: "Your Name" },
			{ key: "subtitle", label: "Line under the title", type: "text", group: "Title block", default: "Variety streamer" }
		].concat(SSO.fxFields("Title block")).concat([
			{ key: "sochead", label: "Heading", type: "text", group: "Social accounts", default: "Follow along" },
			field(SSO.f.socials("tiktok:@yourname,youtube:@yourname,instagram:@yourname,discord:discord.gg/yourname"), { group: "Social accounts" }),
			field(SSO.f.iconStyle("brand"), { group: "Social accounts" }),
			{ key: "msghead", label: "Heading", type: "text", group: "Rotating messages", default: "" },
			{ key: "messages", label: "Messages (one per line)", type: "textarea", group: "Rotating messages", default: "Say hi in chat!\nFollow so you catch the next one\nBe kind to each other" },
			{ key: "msgtime", label: "Seconds per message", type: "number", group: "Rotating messages", default: 6, min: 2, max: 120, step: 1 },
			field(SSO.f.tz("tz", "Time zone"), { group: "Clock & schedule" }),
			{ key: "h12", label: "12-hour clock", type: "bool", group: "Clock & schedule", default: true },
			{ key: "schhead", label: "Schedule heading", type: "text", group: "Clock & schedule", default: "Schedule" },
			{ key: "schedule", label: "Schedule (Day | time | what, one per line)", type: "textarea", group: "Clock & schedule", default: "Mon | 7 PM | Minecraft\nWed | 7 PM | Chill & chat\nFri | 8 PM | Horror night\nSat | 2 PM | Community games", help: "Today's row is highlighted when a line starts with the day." },
			{ key: "image", label: "Logo or image link", type: "text", image: true, group: "Image & QR", default: "" },
			{ key: "imgshape", label: "Image shape", type: "select", group: "Image & QR", default: "round", options: [["round", "Rounded corners"], ["circle", "Circle"], ["plain", "As it is"]] },
			{ key: "imgcap", label: "Caption under the image", type: "text", group: "Image & QR", default: "" },
			{ key: "qr", label: "QR code link", type: "text", group: "Image & QR", default: "https://socialstream.ninja" },
			{ key: "qrcap", label: "Caption under the QR code", type: "text", group: "Image & QR", default: "Scan to follow" },
			{ key: "suphead", label: "Support heading", type: "text", group: "Support & shopping", default: "Support the stream" },
			{ key: "support", label: "Tip & support links", type: "socials", group: "Support & shopping", default: "kofi:ko-fi.com/yourname,paypal:paypal.me/yourname" },
			{ key: "stepshead", label: "Steps heading", type: "text", group: "Support & shopping", default: "How to buy" },
			{ key: "steps", label: "Steps (one per line)", type: "textarea", group: "Support & shopping", default: "Comment the item number\nPay the invoice we send\nWe ship the next day" },
			{ key: "priceshead", label: "Price list heading", type: "text", group: "Support & shopping", default: "Tonight's deals" },
			{ key: "prices", label: "Price list (Item | price, one per line)", type: "textarea", group: "Support & shopping", default: "Mystery box | $15\nSticker pack | $6\nSigned print | $25" },
			{ key: "tickhead", label: "Scrolling list heading", type: "text", group: "Scrolling list & cat", default: "Thank you" },
			{ key: "ticker", label: "Scrolling list (one per line)", type: "textarea", group: "Scrolling list & cat", default: "NightOwl\nPixelPanda\nCoffeeBean\nSleepyFox\nMoonRider\nTinyDragon\nLuckyClover\nStarGazer\nBluebird\nRedPanda" },
			{ key: "tickspeed", label: "Scroll speed", type: "range", group: "Scrolling list & cat", default: 1, min: 0.3, max: 3, step: 0.1 },
			{ key: "coat", label: "Cat colours", type: "select", group: "Scrolling list & cat", default: "orange", options: [["orange", "Orange tabby"], ["black", "Black"], ["grey", "Grey tabby"], ["white", "White"], ["calico", "Calico"]] },
			{ key: "petsay", label: "Cat's speech bubble (blank = none)", type: "text", group: "Scrolling list & cat", default: "hi chat!" },
			{ key: "fg", label: "Text colour", type: "color", group: "Text", default: "ffffff" },
			{ key: "accent", label: "Accent colour", type: "color", group: "Text", default: "ff4fd8" },
			field(SSO.f.font("Poppins"), { group: "Text" }),
			{ key: "zoom", label: "Content size", type: "range", group: "Text", default: 1, min: 0.5, max: 1.6, step: 0.05, help: "Content also shrinks by itself when a panel gets too full." }
		]);
	}
	function slot(key, label, group, def) { return { key: key, label: label, type: "select", group: group, default: def, options: MODULES }; }

	// mode "side": bars left and right of a tall window. mode "stack": bars above and below a wide window.
	function renderPanels(root, c, ctx, mode) {
		common();
		SSO.loadFont(c.font);
		var id = "pp-clip-" + (++uid), side = mode === "side";
		var accent = pick(c.accent, "ff4fd8"), fg = pick(c.fg, "ffffff");
		var wrap = mk("div", "pp c-" + c.cards + " l-" + (c.look === "engine" && SSO.ENGINES && SSO.ENGINES[c.engine] ? "engine" : "flat"), root), lightText = onColor(fg) !== "#ffffff";
		wrap.style.cssText = "color:" + fg + ";font-family:" + SSO.fontStack(c.font) + ";--pp-acc:" + accent + ";--pp-acc2:" + pick(c.c3, "22d3ee") + ";--pp-on:" + onColor(accent) +
			";--pp-card:" + alpha(c.cardbg || "0a0c18", c.cardop) + ";--pp-line:" + alpha(fg, 0.16) + ";--pp-line2:" + alpha(fg, 0.45) + ";--pp-ts:" + (lightText ? "rgba(0,0,0,.5)" : "rgba(255,255,255,.6)") + ";--pp-scrim:" + (lightText ? "rgba(0,0,0,.4)" : "rgba(255,255,255,.55)") + ";";
		mk("div", "", wrap, '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><clipPath id="' + id + '" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" d=""/></clipPath></defs></svg>');
		var hole = wrap.querySelector("path");
		var bg = mk("div", "pp-bg", wrap);
		bg.style.webkitClipPath = bg.style.clipPath = "url(#" + id + ")";
		bg.style.opacity = c.opacity;
		var regions = [[0, 0, 0, 0], [0, 0, 0, 0]];
		paintLook(mk("div", "pp-look", bg), c, side ? null : [["-22%", "-14%", "92%", "52%", pick(c.c2, "5b21b6"), 0.9, 0], ["30%", "60%", "92%", "52%", pick(c.c3, "22d3ee"), 0.6, -9], ["46%", "-16%", "70%", "44%", pick(c.c3, "22d3ee"), 0.35, -15], ["-20%", "68%", "70%", "40%", pick(c.c2, "5b21b6"), 0.55, -5]]);
		startFx(bg, c, function () { return regions; });
		var win = mk("div", "pp-win", wrap);
		var slots = side ? [[c.l1, c.l2, c.l3], c.mirror ? [c.l1, c.l2, c.l3] : [c.r1, c.r2, c.r3]] : [[c.t1, c.t2], c.mirror ? [c.t1, c.t2] : [c.b1, c.b2]];
		if (c.swap) { slots.reverse(); }
		var run = null, cols = slots.map(function (ids, i) {
			var colEl = mk("div", "pp-col" + (side ? "" : " row"), wrap);
			colEl.style.justifyContent = side ? c.valign : "space-evenly";
			var fits = fillColumn(colEl, ids, c, { second: i === 1, refit: function () { if (run) { run(); } } });
			return { el: colEl, fits: fits, count: Math.max(1, colEl.children.length) };
		});
		run = watch(root, function (W, H) {
			var k = (side ? H / 1080 : W / 1080), pad = c.pad * k, r = c.radius * k, rect;
			var ratio = { "9:16": 9 / 16, "3:4": 3 / 4, "4:5": 4 / 5, "1:1": 1, "16:9": 16 / 9, "4:3": 4 / 3, "3:2": 3 / 2 }[c.aspect];
			if (side) {
				var wh = H - pad * 2, ww = Math.min(W * 0.92, ratio ? wh * ratio : W * c.winw / 100);
				var x = c.pos === "left" ? pad : c.pos === "right" ? W - ww - pad : (W - ww) / 2;
				rect = [x, pad, ww, wh];
				var gapL = x, gapR = W - x - ww;
				if (c.pos === "left") { regions = [[x + ww, 0, gapR / 2, H], [x + ww + gapR / 2, 0, gapR / 2, H]]; }
				else if (c.pos === "right") { regions = [[0, 0, gapL / 2, H], [gapL / 2, 0, gapL / 2, H]]; }
				else { regions = [[0, 0, gapL, H], [x + ww, 0, gapR, H]]; }
			} else {
				var w2 = W - pad * 2, h2 = Math.min(H * 0.92, ratio ? w2 / ratio : H * c.winw / 100);
				var y = (H - h2) * c.vpos / 100;
				rect = [pad, y, w2, h2];
				regions = [[0, 0, W, y], [0, y + h2, W, H - y - h2]];
			}
			hole.setAttribute("d", "M0 0H" + r2(W) + "V" + r2(H) + "H0z" + rrPath(rect[0], rect[1], rect[2], rect[3], r));
			wrap.style.setProperty("--pp-u", r2(10 * k) + "px");
			drawFrame(win, c, rect, r, k);
			cols.forEach(function (col, i) {
				var R = regions[i];
				col.el.style.left = r2(R[0]) + "px"; col.el.style.top = r2(R[1]) + "px"; col.el.style.width = r2(R[2]) + "px"; col.el.style.height = r2(R[3]) + "px";
				col.el.style.display = R[2] < 40 || R[3] < 40 ? "none" : "";
				// A design unit is a 656px-wide column split into 65.6 parts, so 1em is 10px on a 1080p canvas.
				// Above and below a wide video the blocks sit side by side, unless that bar is tall enough to stack them.
				var rowFlow = !side && R[3] < R[2] * 0.8;
				col.el.className = "pp-col" + (rowFlow ? " row" : "");
				var base = side ? R[2] / 65.6 : rowFlow ? Math.min(R[2] / col.count / 52, R[3] / 44) : Math.min(R[2] / 65.6, R[3] / 70);
				fitColumn(col.el, base * c.zoom, col.fits);
			});
		});
		SSO.fontsReady(run);
	}

	SSO.register({
		id: "sidepanels",
		name: "Side panels for vertical video",
		category: "vertical",
		description: "Streaming a vertical 9:16 video in a normal 16:9 scene? This fills the empty bars on both sides with your socials, a title, rotating messages, a schedule, a QR code, a clock or a how-to-buy list, over a colour look or an animated background. The middle stays clear for the video.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		libs: ["thirdparty/qrcode.min.js"],
		fields: [
			{ key: "aspect", label: "Video shape", type: "select", group: "Video window", default: "9:16", options: [["9:16", "9:16 (TikTok, Shorts, Reels)"], ["3:4", "3:4"], ["4:5", "4:5"], ["1:1", "Square"], ["custom", "Custom width"]], help: "Add this as a full-screen browser source above your video. The window in the middle is see-through." },
			{ key: "winw", label: "Window width (% of the screen)", type: "range", group: "Video window", default: 31.6, min: 15, max: 90, step: 0.1, show: { aspect: "custom" } },
			{ key: "pos", label: "Where the video sits", type: "select", group: "Video window", default: "center", options: [["center", "In the middle (a panel each side)"], ["left", "On the left (one wide panel)"], ["right", "On the right (one wide panel)"]] },
			{ key: "pad", label: "Space around the video", type: "range", group: "Video window", default: 0, min: 0, max: 140, step: 2 },
			{ key: "radius", label: "Rounded corners", type: "range", group: "Video window", default: 0, min: 0, max: 160, step: 2 },
			{ key: "frame", label: "Frame around the video", type: "select", group: "Video window", default: "shadow", options: FRAMES },
			{ key: "framecolor", label: "Frame colour", type: "color", group: "Video window", default: "ffffff", show: { frame: ["line", "double", "glow", "gradient", "brackets", "phone"] } },
			{ key: "framew", label: "Frame thickness", type: "range", group: "Video window", default: 4, min: 1, max: 30, step: 1, show: { frame: ["line", "double", "glow", "gradient", "brackets", "phone"] } }
		].concat(lookFields()).concat([
			slot("l1", "Top", "Left panel", "title"), slot("l2", "Middle", "Left panel", "socials"), slot("l3", "Bottom", "Left panel", ""),
			slot("r1", "Top", "Right panel", "messages"), slot("r2", "Middle", "Right panel", "qr"), slot("r3", "Bottom", "Right panel", ""),
			{ key: "mirror", label: "Same content on both sides", type: "bool", group: "Right panel", default: false },
			{ key: "swap", label: "Swap left and right", type: "bool", group: "Right panel", default: false },
			{ key: "valign", label: "Arrange the content", type: "select", group: "Right panel", default: "space-evenly", options: [["space-evenly", "Spread out"], ["center", "Together in the middle"], ["flex-start", "At the top"], ["flex-end", "At the bottom"]] }
		]).concat(contentFields()),
		presets: [
			{ name: "Neon gamer panels", tags: ["vertical", "gaming", "cyber"], values: { look: "glow", c1: "0a0620", c2: "7c1fff", c3: "00e5ff", accent: "ff3ec8", frame: "glow", framecolor: "00e5ff", framew: 3, radius: 28, pad: 26, deco: "eq", font: "Rajdhani", cardbg: "0b0a1e", cardop: 0.55 } },
			{ name: "Clean pro panels", tags: ["vertical", "pro", "simple"], values: { look: "gradient", c1: "0b1220", c2: "1e2b45", c3: "38bdf8", accent: "38bdf8", frame: "line", framecolor: "ffffff", framew: 2, radius: 18, pad: 22, font: "Inter", kicker: "On air", subtitle: "Mon / Wed / Fri at 7 PM", l2: "schedule", r1: "clock", r2: "socials", cardbg: "0a1020", cardop: 0.6 } },
			{ name: "Cozy corner panels", tags: ["vertical", "cozy", "cute"], values: { look: "dots", c1: "3b2a20", c2: "6b4a33", c3: "f59e0b", accent: "f59e0b", fg: "fff3dc", font: "Kalam", frame: "double", framecolor: "f5deb3", framew: 3, radius: 22, pad: 34, kicker: "", title: "cozy stream", subtitle: "pull up a chair", l2: "pet", r2: "support", cardbg: "2a1c14", cardop: 0.6, petsay: "welcome in!" } },
			{ name: "Cute pastel panels", tags: ["vertical", "cute"], values: { look: "gradient", c1: "ffd6e8", c2: "d9e4ff", c3: "ffffff", fg: "6b3a5b", accent: "ff7eb6", font: "Fredoka", deco: "hearts", frame: "line", framecolor: "ffffff", framew: 6, radius: 44, pad: 30, kicker: "hiii", title: "your name", subtitle: "comfy streams and good vibes", fx: "bubble", fx1: "ff7eb6", fx3: "c2185b", r1: "pet", r2: "messages", cardbg: "ffffff", cardop: 0.72, coat: "white", petsay: "be nice!" } },
			{ name: "Live shopping panels", tags: ["vertical", "pro", "simple"], values: { look: "gradient", c1: "eef4ff", c2: "ffffff", c3: "2563eb", fg: "0f172a", accent: "2563eb", font: "Poppins", frame: "shadow", radius: 16, pad: 22, l1: "steps", l2: "support", r1: "prices", r2: "qr", qrcap: "Scan to shop", suphead: "Ways to pay", support: "paypal:paypal.me/yourname,venmo:@yourname,cashapp:$yourname", cardbg: "ffffff", cardop: 0.92 } },
			{ name: "Cherry blossom panels", tags: ["vertical", "spring", "cute"], values: { look: "engine", engine: "springpark", dim: 0.1, accent: "ff8fb8", font: "Fredoka", frame: "line", framecolor: "ffffff", framew: 5, radius: 30, pad: 26, kicker: "hello spring", r1: "clock", r2: "messages", cardbg: "3a1432", cardop: 0.6 } },
			{ name: "Beach day panels", tags: ["vertical", "summer", "cute"], values: { look: "engine", engine: "beachday", dim: 0.1, accent: "ffd166", font: "Baloo 2", frame: "line", framecolor: "ffffff", framew: 6, radius: 34, pad: 26, kicker: "summer stream", r1: "clock", r2: "messages", cardbg: "06304a", cardop: 0.62 } },
			{ name: "Harvest panels", tags: ["vertical", "autumn", "cozy"], values: { look: "engine", engine: "harvest", dim: 0.15, accent: "ffb347", fg: "fff1d6", font: "Amatic SC", zoom: 1.2, frame: "double", framecolor: "ffd9a0", framew: 3, radius: 20, pad: 32, kicker: "cozy season", r1: "messages", r2: "support", cardbg: "2a1206", cardop: 0.62 } },
			{ name: "Snowy night panels", tags: ["vertical", "winter", "cozy"], values: { look: "engine", engine: "snownight", dim: 0.1, accent: "ffc46b", font: "Fredoka", frame: "line", framecolor: "eaf2ff", framew: 4, radius: 26, pad: 26, kicker: "warm inside", r1: "clock", r2: "messages", cardbg: "0b1a33", cardop: 0.62 } },
			{ name: "Aurora glass panels", tags: ["vertical", "elegant"], values: { look: "engine", engine: "aurora", c1: "020a14", c2: "1dffb0", c3: "7b2ff7", dim: 0.05, accent: "7dffd0", font: "Montserrat", frame: "gradient", framecolor: "1dffb0", framew: 4, radius: 26, pad: 26, kicker: "", r1: "clock", r2: "qr", cardbg: "06101c", cardop: 0.5 } },
			{ name: "Big sideways name", tags: ["vertical", "simple", "punk"], values: { look: "solid", c1: "0b0b0f", c3: "f2e600", accent: "f2e600", cards: "none", l1: "vtitle", l2: "", mirror: true, title: "YOUR NAME", fx: "outline", fx1: "f2e600", font: "Anton", frame: "line", framecolor: "f2e600", framew: 4, deco: "shapes", decoamount: 0.6 } },
			{ name: "One wide panel", tags: ["vertical", "gaming", "pro"], values: { pos: "left", look: "grid", c1: "0b1020", c2: "3b82f6", c3: "22d3ee", accent: "22d3ee", font: "Rajdhani", frame: "phone", framecolor: "22d3ee", radius: 44, pad: 36, l2: "socials", r1: "schedule", r2: "qr", cardbg: "0a1226", cardop: 0.7 } },
			{ name: "Square video panels", tags: ["vertical", "retro"], values: { aspect: "1:1", look: "halftone", c1: "1a1033", c2: "7a1f6b", c3: "ffd166", accent: "ffd166", font: "Bungee", frame: "line", framecolor: "ffd166", framew: 5, pad: 40, radius: 12, kicker: "", subtitle: "", l2: "clock", r1: "socials", r2: "", cardbg: "140a26", cardop: 0.7 } },
			{ name: "Thank-you roll", tags: ["vertical", "cozy", "celebrate"], values: { look: "stripes", c1: "1d2440", c2: "232c4f", c3: "8fb4ff", accent: "ffd166", font: "Poppins", frame: "shadow", radius: 20, pad: 24, kicker: "thank you", title: "Top supporters", subtitle: "you keep the lights on", l2: "support", r1: "ticker", r2: "", tickhead: "Hall of fame", cardbg: "0c1124", cardop: 0.65 } },
			{ name: "Pixel rain panels", tags: ["vertical", "retro", "gaming"], values: { look: "solid", c1: "05060f", c3: "33ff77", accent: "33ff77", deco: "pixels", font: "Silkscreen", zoom: 0.85, title: "PLAYER ONE", kicker: "Press start", subtitle: "", fx: "pixel", fx2: "ffffff", fx3: "0b5d2a", frame: "brackets", framecolor: "33ff77", framew: 6, pad: 30, r2: "socials", r1: "messages", cardbg: "06140a", cardop: 0.8 } },
			{ name: "Halloween panels", tags: ["vertical", "halloween", "spooky"], values: { look: "engine", engine: "halloween", dim: 0.15, accent: "ff7a00", fg: "ffe9c7", font: "Creepster", zoom: 1.05, frame: "glow", framecolor: "ff7a00", framew: 3, radius: 18, pad: 28, kicker: "spooky season", title: "Your Name", subtitle: "enter if you dare", r1: "messages", r2: "qr", cardbg: "140a1f", cardop: 0.7 } },
			{ name: "Christmas panels", tags: ["vertical", "christmas", "winter"], values: { look: "engine", engine: "christmas", dim: 0.1, accent: "ffd166", font: "Mountains of Christmas", zoom: 1.1, frame: "double", framecolor: "ffd166", framew: 3, radius: 24, pad: 32, kicker: "happy holidays", r1: "clock", r2: "messages", cardbg: "0b1a3a", cardop: 0.62 } }
		],
		render: function (root, c, ctx) { renderPanels(root, c, ctx, "side"); }
	});

	SSO.register({
		id: "topbottom",
		name: "Top & bottom panels for wide video",
		category: "vertical",
		description: "The other way round: a wide 16:9 video (gameplay, a second camera) inside a tall 9:16 stream. This fills the space above and below it with a title, socials, messages, a schedule or a QR code. The window in the middle stays clear.",
		size: [1080, 1920],
		sizeFor: function (c, thumb) { return thumb ? [405, 720] : [1080, 1920]; },
		libs: ["thirdparty/qrcode.min.js"],
		fields: [
			{ key: "aspect", label: "Video shape", type: "select", group: "Video window", default: "16:9", options: [["16:9", "16:9 (wide)"], ["4:3", "4:3"], ["3:2", "3:2"], ["1:1", "Square"], ["custom", "Custom height"]], help: "Add this as a full-screen browser source above your video in a 1080x1920 scene. The window is see-through." },
			{ key: "winw", label: "Window height (% of the screen)", type: "range", group: "Video window", default: 31.6, min: 15, max: 80, step: 0.1, show: { aspect: "custom" } },
			{ key: "vpos", label: "Window position (0 = top, 100 = bottom)", type: "range", group: "Video window", default: 50, min: 0, max: 100, step: 1 },
			{ key: "pad", label: "Space at the sides of the video", type: "range", group: "Video window", default: 0, min: 0, max: 140, step: 2 },
			{ key: "radius", label: "Rounded corners", type: "range", group: "Video window", default: 0, min: 0, max: 160, step: 2 },
			{ key: "frame", label: "Frame around the video", type: "select", group: "Video window", default: "shadow", options: FRAMES.filter(function (f) { return f[0] !== "phone"; }) },
			{ key: "framecolor", label: "Frame colour", type: "color", group: "Video window", default: "ffffff", show: { frame: ["line", "double", "glow", "gradient", "brackets"] } },
			{ key: "framew", label: "Frame thickness", type: "range", group: "Video window", default: 4, min: 1, max: 30, step: 1, show: { frame: ["line", "double", "glow", "gradient", "brackets"] } }
		].concat(lookFields()).concat([
			slot("t1", "Left", "Top panel", "title"), slot("t2", "Right", "Top panel", ""),
			slot("b1", "Left", "Bottom panel", "socials"), slot("b2", "Right", "Bottom panel", "qr"),
			{ key: "mirror", label: "Same content top and bottom", type: "bool", group: "Bottom panel", default: false },
			{ key: "swap", label: "Swap top and bottom", type: "bool", group: "Bottom panel", default: false }
		]).concat(contentFields()),
		presets: [
			{ name: "Gameplay in the middle", tags: ["vertical", "gaming", "cyber"], values: { look: "glow", c1: "0a0620", c2: "7c1fff", c3: "00e5ff", accent: "ff3ec8", frame: "glow", framecolor: "00e5ff", framew: 3, radius: 22, pad: 20, font: "Rajdhani", cardbg: "0b0a1e", cardop: 0.55 } },
			{ name: "Clean stack", tags: ["vertical", "pro", "simple"], values: { look: "gradient", c1: "0b1220", c2: "1e2b45", c3: "38bdf8", accent: "38bdf8", frame: "line", framecolor: "ffffff", framew: 2, radius: 14, pad: 18, font: "Inter", kicker: "On air", b1: "schedule", b2: "socials", cardbg: "0a1020", cardop: 0.6 } },
			{ name: "Video up top", tags: ["vertical", "cozy"], values: { vpos: 10, look: "dots", c1: "3b2a20", c2: "6b4a33", c3: "f59e0b", accent: "f59e0b", fg: "fff3dc", font: "Kalam", frame: "double", framecolor: "f5deb3", framew: 3, radius: 18, pad: 24, t1: "", b1: "title", b2: "socials", kicker: "", title: "cozy stream", subtitle: "pull up a chair", cardbg: "2a1c14", cardop: 0.6 } },
			{ name: "Cute pastel stack", tags: ["vertical", "cute"], values: { look: "gradient", c1: "ffd6e8", c2: "d9e4ff", c3: "ffffff", fg: "6b3a5b", accent: "ff7eb6", font: "Fredoka", deco: "hearts", frame: "line", framecolor: "ffffff", framew: 6, radius: 36, pad: 26, kicker: "hiii", title: "your name", subtitle: "comfy streams", fx: "bubble", fx1: "ff7eb6", fx3: "c2185b", b1: "pet", b2: "messages", cardbg: "ffffff", cardop: 0.72, coat: "white" } },
			{ name: "Beach day stack", tags: ["vertical", "summer"], values: { look: "engine", engine: "beachday", dim: 0.1, accent: "ffd166", font: "Baloo 2", frame: "line", framecolor: "ffffff", framew: 6, radius: 28, pad: 24, kicker: "summer stream", cardbg: "06304a", cardop: 0.62 } },
			{ name: "Live shopping stack", tags: ["vertical", "pro", "simple"], values: { look: "gradient", c1: "eef4ff", c2: "ffffff", c3: "2563eb", fg: "0f172a", accent: "2563eb", font: "Poppins", frame: "shadow", radius: 14, pad: 18, t1: "title", kicker: "Live sale", title: "Your Shop", subtitle: "new drops every Friday", b1: "steps", b2: "prices", cardbg: "ffffff", cardop: 0.92 } }
		],
		render: function (root, c, ctx) { renderPanels(root, c, ctx, "stack"); }
	});

	// ================================================================ portrait-first overlays (made for 1080x1920)
	var VCSS = [
		".vz-guides{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:50;}",
		".vz-guides i{position:absolute;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(135deg,rgba(255,70,70,.24) 0 12px,rgba(255,70,70,.09) 12px 24px);outline:2px dashed rgba(255,110,110,.95);outline-offset:-2px;}",
		".vz-guides b{font:700 2.2em/1.2 system-ui,sans-serif;color:#fff;background:rgba(150,20,20,.8);padding:.25em .7em;border-radius:.4em;text-align:center;}",
		// ---- vertical screen
		".vs{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;line-height:1.2;}",
		".vs-body{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;}",
		".vs.l-top .vs-body{justify-content:flex-start;} .vs.l-bottom .vs-body{justify-content:flex-end;} .vs.l-spread .vs-body{justify-content:space-between;}",
		".vs-main,.vs-foot{display:flex;flex-direction:column;align-items:center;width:100%;box-sizing:border-box;}",
		".vs-foot{margin-top:4em;} .vs.l-spread .vs-foot{margin-top:0;}",
		".vs-panel{background:var(--vs-chip);border:1px solid var(--vs-line);border-radius:4em;padding:5em 4em;box-shadow:0 3em 8em rgba(0,0,0,.35);}",
		".vs-kick{display:inline-flex;align-items:center;font-size:2.6em;font-weight:800;letter-spacing:.2em;text-transform:uppercase;padding:.42em 1.1em;border-radius:99em;margin-bottom:1.1em;}",
		".vs-kick i{width:.55em;height:.55em;border-radius:50%;background:currentColor;margin-right:.6em;animation:pp-pulse 1.4s ease-in-out infinite;}",
		".vs-title{font-weight:800;line-height:1;margin:0;max-width:100%;text-shadow:0 .03em .1em var(--vs-ts),0 .06em .45em var(--vs-ts);}",
		".vs-title > span{display:inline-block;max-width:100%;}",
		".vs-sub{font-size:3.5em;opacity:.92;margin-top:.8em;font-weight:500;line-height:1.28;text-shadow:0 .04em .12em var(--vs-ts),0 .06em .5em var(--vs-ts);}",
		".vs-countbox{margin-top:4.4em;display:flex;flex-direction:column;align-items:center;}",
		".vs-cl{font-size:2.2em;letter-spacing:.34em;text-transform:uppercase;opacity:.85;margin-bottom:.7em;font-weight:700;}",
		".vs-count{font-size:10em;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:.03em;text-shadow:0 0 .4em currentColor;}",
		".vs-count.done{font-size:5.4em;letter-spacing:0;}",
		".vs-boxes{display:flex;justify-content:center;}",
		".vs-boxes span{display:flex;flex-direction:column;align-items:center;width:15em;margin:0 1em;padding:1.8em 0 1.5em;border-radius:2.4em;background:var(--vs-chip);border:1px solid var(--vs-line);box-shadow:0 1.6em 4em rgba(0,0,0,.3);}",
		".vs-boxes b{font-size:8.6em;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;}",
		".vs-boxes i{font-style:normal;font-size:1.9em;letter-spacing:.24em;text-transform:uppercase;opacity:.8;margin-top:.6em;}",
		".vs-ring{position:relative;width:38em;height:38em;}",
		".vs-ring svg{position:absolute;left:0;top:0;width:100%;height:100%;transform:rotate(-90deg);}",
		".vs-ring .vs-count{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);font-size:8.4em;}",
		".vs-ring .vs-count.done{font-size:4em;padding:0 1.2em;}",
		".vs-msgs{display:grid;overflow:hidden;padding:1.4em 0;margin-top:2em;width:100%;}",
		".vs-msgs > div{grid-area:1/1;font-size:3.3em;font-weight:600;line-height:1.3;opacity:0;transform:translateY(.4em);transition:opacity .7s,transform .7s;text-shadow:0 .05em .35em var(--vs-ts);}",
		".vs-msgs > div.on{opacity:.95;transform:none;}",
		".vs-socials{display:flex;flex-direction:column;align-items:center;width:100%;}",
		".vs-socials.grid{flex-direction:row;flex-wrap:wrap;justify-content:center;}",
		".vs-soc{display:flex;align-items:center;font-size:3.3em;font-weight:700;padding:.46em 1.1em .46em .7em;margin:.2em;border-radius:99em;background:var(--vs-chip);border:1px solid var(--vs-line);max-width:100%;box-sizing:border-box;}",
		".vs-soc .sso-icon{width:1.4em;height:1.4em;margin-right:.5em;flex:0 0 auto;}",
		".vs-soc span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}",
		".vs-qr{display:flex;flex-direction:column;align-items:center;margin-top:3em;}",
		".vs-qr-box{background:#fff;padding:1.6em;border-radius:2.2em;line-height:0;width:30em;box-sizing:border-box;box-shadow:0 2em 5em rgba(0,0,0,.4);}",
		".vs-qr-box img,.vs-qr-box canvas{width:100% !important;height:auto !important;}",
		".vs-qr-cap{margin-top:.7em;font-size:2.8em;font-weight:700;text-shadow:0 .05em .35em var(--vs-ts);}",
		// ---- vertical kit
		".vk{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;line-height:1.2;}",
		".vk-safe{position:absolute;left:4%;display:flex;flex-direction:column;justify-content:space-between;}",
		".vk-row{display:flex;justify-content:space-between;align-items:flex-start;}",
		".vk-bot .vk-row{align-items:flex-end;}",
		".vk-colm{display:flex;flex-direction:column;max-width:66%;min-width:0;}",
		".vk-colm.l{align-items:flex-start;} .vk-colm.r{align-items:flex-end;margin-left:auto;}",
		".vk-c{display:flex;flex-direction:column;align-items:center;}",
		".vk-mid{flex:1 1 0;min-height:0;display:flex;justify-content:space-between;align-items:center;}",
		".vk-p{margin:.8em 0;max-width:100%;box-sizing:border-box;animation:pp-in .8s ease both;}",
		".vk-mid .vk-p{animation-delay:.15s;} .vk-bot .vk-p{animation-delay:.3s;}",
		".vk-card{background:var(--k-bg);color:var(--k-fg);border:1px solid var(--k-line);border-radius:2.6em;box-shadow:0 1em 3em rgba(0,0,0,.3);}",
		".vk-head{display:flex;align-items:center;padding:1em 2.4em 1em 1em;border-radius:99em;}",
		".vk-ava{flex:0 0 auto;width:7.4em;height:7.4em;border-radius:50%;background:var(--k-acc);color:var(--k-on);display:flex;align-items:center;justify-content:center;overflow:hidden;margin-right:1.5em;}",
		".vk-ava b{font-size:3.8em;font-weight:800;line-height:1;text-transform:uppercase;}",
		".vk-ava img{width:100%;height:100%;object-fit:cover;display:block;}",
		".vk-id{min-width:0;}",
		".vk-name{font-size:3.4em;font-weight:800;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
		".vk-handle{font-size:2.3em;opacity:.8;margin-top:.12em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
		".vk-live{flex:0 0 auto;display:flex;align-items:center;font-size:1.9em;font-weight:800;letter-spacing:.12em;background:#e11d48;color:#fff;border-radius:99em;padding:.34em .8em;margin-left:1.1em;text-shadow:none;}",
		".vk-live i,.vk-badge.pill i{width:.55em;height:.55em;border-radius:50%;background:currentColor;margin-right:.5em;animation:pp-pulse 1.4s ease-in-out infinite;}",
		".vk-soc{display:flex;align-items:center;font-size:2.6em;font-weight:700;padding:.42em 1em .42em .55em;border-radius:99em;margin:.24em 0;max-width:100%;box-sizing:border-box;}",
		".vk-soc .sso-icon{width:1.5em;height:1.5em;margin-right:.5em;flex:0 0 auto;}",
		".vk-soc span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}",
		".vk-note{padding:1.9em 2.4em 2.1em;max-width:54em;}",
		".vk-note-h{font-size:1.8em;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--k-acc);margin-bottom:.45em;}",
		".vk-note-t{font-size:2.9em;font-weight:600;line-height:1.26;white-space:pre-line;}",
		".vk-goal{padding:1.7em 2.3em 2em;width:58em;}",
		".vk-goal-top{display:flex;justify-content:space-between;align-items:baseline;font-size:2.4em;font-weight:700;margin-bottom:.55em;}",
		".vk-goal-top b{font-variant-numeric:tabular-nums;white-space:nowrap;margin-left:1em;}",
		".vk-goal-top span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
		".vk-bar{height:2.3em;border-radius:99em;background:var(--k-line);overflow:hidden;}",
		".vk-bar div{position:relative;height:100%;border-radius:99em;background:linear-gradient(90deg,var(--k-acc),var(--k-acc2));overflow:hidden;min-width:2.3em;}",
		".vk-bar div:after{content:'';position:absolute;top:0;bottom:0;left:-40%;width:30%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);animation:vk-shine 3.6s ease-in-out infinite;}",
		"@keyframes vk-shine{0%,35%{left:-40%}80%,100%{left:120%}}",
		".vk-msg{padding:1.2em 2.4em;border-radius:99em;text-align:center;}",
		".vk-msgs{display:grid;overflow:hidden;padding:1em 2.2em;margin:-1em -2.2em;}",
		".vk-msgs > div{grid-area:1/1;font-size:2.7em;font-weight:700;line-height:1.25;opacity:0;transform:translateY(.4em);transition:opacity .6s,transform .6s;}",
		".vk-msgs > div.on{opacity:1;transform:none;}",
		".vk-badge{font-weight:800;text-transform:uppercase;text-shadow:none;}",
		".vk-badge.pill{display:flex;align-items:center;font-size:2.7em;letter-spacing:.14em;padding:.36em 1em;border-radius:99em;background:var(--k-acc);color:var(--k-on);box-shadow:0 .4em 1.2em rgba(0,0,0,.3);}",
		".vk-badge.burst{position:relative;width:17em;height:17em;overflow:hidden;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--k-on);filter:drop-shadow(0 .6em 1.2em rgba(0,0,0,.35));}",
		".vk-badge.burst svg{position:absolute;left:0;top:0;width:100%;height:100%;animation:vk-spin 26s linear infinite;}",
		".vk-badge.burst span{position:relative;font-size:3.5em;line-height:1;transform:rotate(-10deg);max-width:4.2em;text-align:center;}",
		"@keyframes vk-spin{to{transform:rotate(360deg)}}",
		".vk-badge.stamp{font-size:3.4em;letter-spacing:.12em;padding:.2em .7em;color:var(--k-acc);border:.14em solid var(--k-acc);border-radius:.3em;box-shadow:inset 0 0 0 .08em transparent,inset 0 0 0 .18em var(--k-acc);transform:rotate(-8deg);background:rgba(0,0,0,.2);margin:.6em .3em;}",
		".vk-badge.ribbon{position:relative;font-size:2.8em;letter-spacing:.12em;padding:.36em 1.3em;background:var(--k-acc);color:var(--k-on);margin:0 .7em;box-shadow:0 .4em 1em rgba(0,0,0,.3);}",
		".vk-badge.ribbon:before,.vk-badge.ribbon:after{content:'';position:absolute;top:.28em;width:1.2em;height:100%;background:var(--k-acc);filter:brightness(.7);z-index:-1;}",
		".vk-badge.ribbon:before{left:-.7em;clip-path:polygon(0 0,100% 0,100% 100%,0 100%,45% 50%);} .vk-badge.ribbon:after{right:-.7em;clip-path:polygon(0 0,100% 0,55% 50%,100% 100%,0 100%);}",
		".vk.t-neon .vk-card{border:.2em solid var(--k-acc);box-shadow:0 0 1.6em var(--k-acc),inset 0 0 1.6em rgba(255,255,255,.05);}",
		".vk.t-neon .vk-name,.vk.t-neon .vk-note-t,.vk.t-neon .vk-msgs{text-shadow:0 0 .5em var(--k-acc);}",
		".vk.t-bold .vk-card{border:.4em solid #111;border-radius:1em;box-shadow:.7em .7em 0 #111;}",
		".vk.t-bold .vk-head{border-radius:1em;} .vk.t-bold .vk-ava{border-radius:.6em;} .vk.t-bold .vk-soc,.vk.t-bold .vk-msg{border-radius:.5em;}",
		".vk.t-bold .vk-bar,.vk.t-bold .vk-bar div{border-radius:.3em;} .vk.t-bold .vk-bar{box-shadow:inset 0 0 0 .2em #111;}",
		".vk.t-soft .vk-card{border:.45em solid #fff;border-radius:3.4em;box-shadow:0 1em 2.6em rgba(120,60,100,.22);}",
		".vk.t-soft .vk-head,.vk.t-soft .vk-soc,.vk.t-soft .vk-msg{border-radius:99em;}",
		".vk.t-minimal .vk-card{background:none;border:0;box-shadow:none;text-shadow:0 .08em .4em rgba(0,0,0,.75),0 0 .1em rgba(0,0,0,.6);}",
		".vk.t-minimal .vk-head{padding-left:0;} .vk.t-minimal .vk-note,.vk.t-minimal .vk-goal,.vk.t-minimal .vk-msg{padding-left:0;padding-right:0;}",
		".vk.t-minimal .vk-soc{padding-left:0;} .vk.t-minimal .vk-bar{background:rgba(0,0,0,.45);box-shadow:0 0 0 1px rgba(255,255,255,.3);}",
		// ---- vertical shop card
		".vh-wrap{position:absolute;left:4%;display:flex;flex-direction:column;justify-content:flex-end;line-height:1.2;}",
		".vh-wrap.top{justify-content:flex-start;}",
		".vh{position:relative;background:var(--h-bg);color:var(--h-fg);border-radius:3.2em;padding:2.6em 2.8em 2.8em;border:1px solid var(--h-line);box-shadow:0 1.8em 4.4em rgba(0,0,0,.38);box-sizing:border-box;}",
		".vh-top{display:flex;align-items:center;margin-bottom:1.4em;}",
		".vh-lot{font-size:2em;font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:.34em .85em;border-radius:.5em;background:var(--h-fg);color:var(--h-inv);white-space:nowrap;}",
		".vh-badge{font-size:2em;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:.34em .9em;border-radius:99em;background:var(--h-acc);color:var(--h-on);margin-left:.6em;white-space:nowrap;animation:vh-pop 2.8s ease-in-out infinite;}",
		"@keyframes vh-pop{0%,70%,100%{transform:scale(1)}80%{transform:scale(1.12)}90%{transform:scale(.97)}}",
		".vh-lot + .vh-badge{margin-left:.6em;} .vh-top > .vh-badge:first-child{margin-left:0;}",
		".vh-timer{margin-left:auto;display:flex;align-items:center;font-size:2.3em;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;}",
		".vh-timer svg{width:1.1em;height:1.1em;margin-right:.4em;}",
		".vh-main{display:flex;align-items:center;}",
		".vh-pic{flex:0 0 auto;width:18em;height:18em;border-radius:2.2em;overflow:hidden;margin-right:2.2em;background:var(--h-line);}",
		".vh-pic img{width:100%;height:100%;object-fit:cover;display:block;}",
		".vh-info{flex:1;min-width:0;}",
		".vh-title{font-size:3.7em;font-weight:800;line-height:1.12;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}",
		".vh-prices{display:flex;align-items:baseline;flex-wrap:wrap;margin-top:.9em;}",
		".vh-now{font-size:6.6em;font-weight:800;line-height:1;color:var(--h-acc);font-variant-numeric:tabular-nums;}",
		".vh-was{font-size:3em;opacity:.6;margin-left:.55em;text-decoration:line-through;}",
		".vh-meta{display:flex;flex-wrap:wrap;margin-top:1.1em;font-size:2.3em;font-weight:600;}",
		".vh-meta span{display:flex;align-items:center;margin:0 1.3em .2em 0;opacity:.92;}",
		".vh-meta svg{width:1.25em;height:1.25em;margin-right:.42em;flex:0 0 auto;}",
		".vh-steps{display:flex;margin-top:1.8em;padding-top:1.6em;border-top:1px solid var(--h-line);}",
		".vh-steps span{flex:1 1 0;display:flex;align-items:center;font-size:2.1em;font-weight:600;line-height:1.2;min-width:0;margin-right:.9em;}",
		".vh-steps span:last-child{margin-right:0;}",
		".vh-steps b{flex:0 0 auto;width:1.75em;height:1.75em;border-radius:50%;background:var(--h-acc);color:var(--h-on);display:flex;align-items:center;justify-content:center;margin-right:.5em;font-size:.95em;}",
		".vh-pay{display:flex;flex-wrap:wrap;align-items:center;margin-top:1.4em;font-size:2.1em;font-weight:600;}",
		".vh-pay span{display:flex;align-items:center;margin:0 1.3em .2em 0;opacity:.94;min-width:0;}",
		".vh-pay .sso-icon{width:1.35em;height:1.35em;margin-right:.42em;flex:0 0 auto;}",
		".vh.s-bold{border:.45em solid #111;border-radius:1.2em;box-shadow:.9em .9em 0 #111;}",
		".vh.s-bold .vh-now{color:inherit;} .vh.s-bold .vh-pic{border-radius:.6em;border:.3em solid #111;}",
		".vh.s-bold .vh-badge{border-radius:.4em;}",
		".vh.s-neon{border:.22em solid var(--h-acc);box-shadow:0 0 2em var(--h-acc),inset 0 0 2em rgba(255,255,255,.05);}",
		".vh.s-neon .vh-now{text-shadow:0 0 .35em var(--h-acc);}",
		".vh-tagwrap{filter:drop-shadow(0 1.4em 2.4em rgba(0,0,0,.4));}",
		".vh.s-tag{border:0;box-shadow:none;border-radius:1.4em;padding-left:9em;clip-path:polygon(7em 0,100% 0,100% 100%,7em 100%,0 50%);}",
		".vh.s-tag:before{content:'';position:absolute;left:3.4em;top:50%;width:2.6em;height:2.6em;margin-top:-1.3em;border-radius:50%;background:rgba(0,0,0,.55);box-shadow:inset 0 .3em .5em rgba(0,0,0,.6),0 0 0 .5em rgba(0,0,0,.12);}",
		".vh.s-tag:after{content:'';position:absolute;left:8em;top:1em;right:1em;bottom:1em;border:.22em dashed var(--h-line2);border-radius:1em;pointer-events:none;}",
		".vh.s-bar{padding:1.5em 2.2em;border-radius:99em;display:flex;align-items:center;}",
		".vh.s-bar .vh-top{margin:0;} .vh.s-bar .vh-title{font-size:2.8em;-webkit-line-clamp:1;margin:0 .7em;flex:1;min-width:0;}",
		".vh.s-bar .vh-now{font-size:4.2em;} .vh.s-bar .vh-was{font-size:2.3em;margin:0 .5em 0 .4em;}",
		".vh.s-bar .vh-timer{margin-left:.6em;}"
	].join("\n");
	function vcommon() { common(); SSO.addStyle(VCSS, "sso-portrait-v-css"); }
	function safeFields(top, bottom, right) {
		return [
			{ key: "safetop", label: "Keep clear at the top (%)", type: "range", group: "Safe zones", default: top, min: 0, max: 30, step: 1, help: "Leaves room for the app's own buttons: your profile and the viewer count at the top, chat and gifts at the bottom, and the icons down the right side." },
			{ key: "safebottom", label: "Keep clear at the bottom (%)", type: "range", group: "Safe zones", default: bottom, min: 0, max: 45, step: 1 },
			{ key: "saferight", label: "Keep clear on the right (%)", type: "range", group: "Safe zones", default: right, min: 0, max: 30, step: 1 },
			{ key: "guides", label: "Show the safe zones here in the editor (never shown in OBS)", type: "bool", group: "Safe zones", default: false }
		];
	}
	function drawGuides(root, c, ctx, unit) {
		if (!ctx || !ctx.preview || !c.guides) { return; }
		var g = mk("div", "vz-guides", root);
		g.style.fontSize = unit + "px";
		g.innerHTML = (c.safetop > 0 ? '<i style="left:0;top:0;right:0;height:' + c.safetop + '%"><b>app header</b></i>' : "") +
			(c.safebottom > 0 ? '<i style="left:0;bottom:0;right:0;height:' + c.safebottom + '%"><b>chat and gifts</b></i>' : "") +
			(c.saferight > 0 ? '<i style="right:0;top:' + c.safetop + "%;bottom:" + c.safebottom + "%;width:" + c.saferight + '%"><b style="transform:rotate(90deg);white-space:nowrap">app buttons</b></i>' : "");
		return g;
	}
	// One design unit is a tenth of a pixel-wide slice of a 1080x1920 canvas, so sizes read as "px at 1080 wide".
	function vunit(W, H) { return Math.max(1.5, Math.min(W / 108, H / 192)); }
	var VGLOW = [["-30%", "-12%", "110%", "50%", null, 0.9, 0], ["20%", "62%", "110%", "50%", null, 0.6, -9], ["30%", "-10%", "90%", "40%", null, 0.3, -15], ["-40%", "40%", "90%", "40%", null, 0.4, -5]];
	function vglow(c) { return VGLOW.map(function (s, i) { var copy = s.slice(); copy[4] = i % 2 ? pick(c.c3, "22d3ee") : pick(c.c2, "5b21b6"); return copy; }); }
	function bgFields(look, engine) {
		return lookFields().filter(function (f) { return ["look", "engine", "c1", "c2", "c3", "speed", "dim", "motion"].indexOf(f.key) !== -1; }).map(function (f) {
			var copy = field({}, f);
			copy.group = "Background";
			if (f.key === "look") { copy.default = look; copy.label = "Background"; }
			if (f.key === "engine") { copy.default = engine; }
			return copy;
		});
	}

	// ---------------------------------------------------------------- vertical starting soon / BRB / ending
	SSO.register({
		id: "vscreen",
		name: "Vertical screen (starting soon / BRB)",
		category: "vertical",
		description: "A starting soon, be right back or ending screen laid out for a 9:16 stream: a stacked title, a countdown, your socials as big tappable-looking pills and a QR code, over any animated background. Keeps clear of the app's own buttons at the top, bottom and right.",
		size: [1080, 1920],
		sizeFor: function (c, thumb) { return thumb ? [405, 720] : [1080, 1920]; },
		libs: ["thirdparty/qrcode.min.js"],
		fields: [
			{ key: "kicker", label: "Small label above the title (blank = none)", type: "text", group: "Content", default: "Live soon" },
			{ key: "title", label: "Title", type: "text", group: "Content", default: "Starting soon" },
			{ key: "subtitle", label: "Subtitle", type: "text", group: "Content", default: "Grab a drink, we go live in a moment" },
			{ key: "minutes", label: "Countdown minutes (0 = none)", type: "number", group: "Content", default: 5, min: 0, max: 600, step: 0.5 },
			{ key: "target", label: "...or count down to (HH:MM, 12-31T23:59 every year, or 2026-12-31T23:59)", type: "text", group: "Content", default: "" },
			{ key: "cstyle", label: "Countdown style", type: "select", group: "Content", default: "boxes", options: [["boxes", "Boxes"], ["plain", "Big numbers"], ["ring", "Progress ring"]] },
			{ key: "countlabel", label: "Countdown label", type: "text", group: "Content", default: "" },
			{ key: "endtext", label: "Text when the countdown ends", type: "text", group: "Content", default: "Any second now..." },
			{ key: "messages", label: "Rotating messages (one per line)", type: "textarea", group: "Content", default: "" },
			field(SSO.f.socials("tiktok:@yourname,youtube:@yourname,instagram:@yourname"), { group: "Socials" }),
			field(SSO.f.iconStyle("brand"), { group: "Socials" }),
			{ key: "soclayout", label: "Socials layout", type: "select", group: "Socials", default: "stack", options: [["stack", "Stacked"], ["grid", "Side by side"]] },
			{ key: "qr", label: "QR code link (blank = none)", type: "text", group: "Socials", default: "" },
			{ key: "qrcaption", label: "QR caption", type: "text", group: "Socials", default: "Scan to follow" }
		].concat(bgFields("engine", "nebula")).concat([
			{ key: "layout", label: "Layout", type: "select", group: "Layout", default: "center", options: [["center", "Everything in the middle"], ["spread", "Title at the top, socials at the bottom"], ["top", "Everything at the top"], ["bottom", "Everything at the bottom"]] },
			{ key: "panel", label: "Dark glass panel behind the text", type: "bool", group: "Layout", default: false },
			{ key: "fg", label: "Text colour", type: "color", group: "Text", default: "ffffff" },
			{ key: "accent", label: "Accent colour", type: "color", group: "Text", default: "67e8f9" },
			field(SSO.f.font("Montserrat"), { group: "Text" }),
			{ key: "fontsize", label: "Title size", type: "range", group: "Text", default: 150, min: 40, max: 280, step: 2 },
			{ key: "upper", label: "UPPERCASE title", type: "bool", group: "Text", default: false }
		]).concat(SSO.fxFields("Text")).concat(safeFields(12, 22, 15)),
		presets: [
			{ name: "Starting soon (vertical)", tags: ["vertical", "elegant", "cyber"], values: {} },
			{ name: "Neon tunnel countdown", tags: ["vertical", "cyber", "gaming"], values: { engine: "tunnel", c1: "04000c", c2: "ff00e6", c3: "00fff0", accent: "00fff0", font: "Orbitron", upper: true, fontsize: 120, fx: "glitch", fx1: "ff00e6", fx2: "00fff0", cstyle: "ring", kicker: "Going live", subtitle: "", dim: 0.1 } },
			{ name: "Be right back (lava lamp)", tags: ["vertical", "cozy", "retro"], values: { engine: "lava", c1: "1a0630", c2: "ff4d6d", c3: "ffb703", accent: "ffb703", title: "be right back", subtitle: "stretching, snacking, back in a sec", kicker: "", minutes: 0, font: "Kalam", fontsize: 170, panel: true, messages: "Chat is still open, say hi!\nFollow so you catch the next one", dim: 0.15 } },
			{ name: "Thanks for watching + QR", tags: ["vertical", "pro", "elegant"], values: { engine: "aurora", c1: "020a14", c2: "1dffb0", c3: "7b2ff7", accent: "7dffd0", title: "Thanks for watching", subtitle: "follow for the next one", kicker: "That's a wrap", minutes: 0, layout: "spread", qr: "https://socialstream.ninja", font: "Poppins", fontsize: 130, dim: 0.1 } },
			{ name: "Live sale opens soon", tags: ["vertical", "pro", "simple"], values: { look: "gradient", c1: "eef4ff", c2: "ffffff", c3: "2563eb", fg: "0f172a", accent: "2563eb", kicker: "Live sale", title: "Doors open soon", subtitle: "new drops, auctions and giveaways", countlabel: "We start in", font: "Poppins", fontsize: 140, layout: "spread", messages: "Free shipping over $50\nComment SOLD and the lot number to buy" } },
			{ name: "Cherry blossom BRB", tags: ["vertical", "spring", "cute"], values: { engine: "springpark", accent: "ff8fb8", title: "be right back", subtitle: "smelling the flowers", kicker: "", minutes: 0, font: "Fredoka", fontsize: 160, panel: true, dim: 0.1 } },
			{ name: "Beach day starting soon", tags: ["vertical", "summer", "cute"], values: { engine: "beachday", accent: "ffd166", kicker: "Summer stream", subtitle: "grab something cold", font: "Baloo 2", fontsize: 160, panel: true, dim: 0.05 } },
			{ name: "Harvest evening", tags: ["vertical", "autumn", "cozy"], values: { engine: "harvest", accent: "ffb347", fg: "fff1d6", kicker: "Cozy season", title: "Starting soon", subtitle: "grab a warm drink", font: "Amatic SC", fontsize: 230, layout: "top", panel: true, dim: 0.1 } },
			{ name: "Snowy night starting", tags: ["vertical", "winter", "cozy"], values: { engine: "snownight", accent: "ffc46b", kicker: "Warm inside", subtitle: "it's cold out, come on in", font: "Fredoka", fontsize: 150, layout: "top", dim: 0.05 } },
			{ name: "Halloween countdown", tags: ["vertical", "halloween", "spooky"], values: { engine: "halloween", accent: "ff7a00", fg: "ffe9c7", kicker: "Spooky season", title: "starting soon...", subtitle: "if you dare", font: "Creepster", fontsize: 170, cstyle: "plain", panel: true, dim: 0.15 } },
			{ name: "Christmas countdown", tags: ["vertical", "christmas", "winter"], values: { engine: "christmas", accent: "ffd166", kicker: "Happy holidays", title: "Merry Christmas", subtitle: "", target: "12-25T00:00", minutes: 0, countlabel: "Christmas in", endtext: "Merry Christmas!", font: "Mountains of Christmas", fontsize: 170, layout: "top", panel: true, dim: 0.05 } },
			{ name: "Synth grid", tags: ["vertical", "retro", "cyber"], values: { look: "grid", c1: "120024", c2: "ff3ec8", c3: "00e5ff", accent: "ff3ec8", font: "Orbitron", upper: true, fontsize: 120, fx: "chrome", fx1: "ff3ec8", fx3: "3b0764", kicker: "", subtitle: "", cstyle: "plain" } },
			{ name: "Cute pastel", tags: ["vertical", "cute"], values: { look: "glow", c1: "ffd6e8", c2: "d9e4ff", c3: "ffffff", fg: "6b3a5b", accent: "ff7eb6", kicker: "hiii", title: "starting soon", subtitle: "grab a snack!", font: "Fredoka", fontsize: 160, fx: "bubble", fx1: "ff7eb6", fx3: "c2185b" } },
			{ name: "Big and minimal", tags: ["vertical", "simple", "pro"], values: { look: "solid", c1: "0b0b0f", accent: "f2e600", kicker: "", subtitle: "", socials: "", font: "Bebas Neue", upper: true, fontsize: 260, cstyle: "plain" } }
		],
		render: function (root, c, ctx) {
			vcommon();
			SSO.loadFont(c.font);
			var accent = pick(c.accent, "67e8f9"), dark = isDark(pick(c.fg, "ffffff"));
			var el = mk("div", "vs l-" + c.layout, root);
			// Dark text gets light chips and a light halo; light text gets dark ones.
			el.style.cssText = "color:" + pick(c.fg, "ffffff") + ";font-family:" + SSO.fontStack(c.font) + ";--pp-acc:" + accent + ";--pp-on:" + onColor(accent) +
				";--vs-chip:" + (dark ? "rgba(255,255,255,.74)" : "rgba(8,10,20,.46)") + ";--vs-line:" + (dark ? "rgba(0,0,0,.1)" : "rgba(255,255,255,.18)") + ";--vs-ts:" + (dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)") + ";";
			var bg = mk("div", "pp-bg", el);
			paintLook(mk("div", "pp-look", bg), c, vglow(c));
			var side = Math.max(6, c.saferight);
			var body = mk("div", "vs-body", el);
			body.style.cssText = "top:" + (c.safetop + 1.5) + "%;bottom:" + (c.safebottom + 1.5) + "%;left:" + side + "%;right:" + side + "%;";
			var socials = SSO.parseSocials(c.socials), msgs = SSO.lines(c.messages), counting = c.minutes > 0 || !!c.target;
			var count = "";
			if (counting) {
				count = '<div class="vs-countbox">' + (c.countlabel ? '<div class="vs-cl">' + esc(c.countlabel) + "</div>" : "") +
					(c.cstyle === "boxes" ? '<div class="vs-boxes"></div>' :
						c.cstyle === "ring" ? '<div class="vs-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="53" fill="' + (dark ? "rgba(255,255,255,.6)" : "rgba(6,8,16,.42)") + '" stroke="' + (dark ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.16)") + '" stroke-width="7"/><circle class="vs-arc" cx="60" cy="60" r="53" fill="none" stroke="' + accent + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="333" stroke-dashoffset="0"/></svg><div class="vs-count"></div></div>' :
							'<div class="vs-count" style="color:' + accent + '"></div>') + "</div>";
			}
			var main = '<div class="vs-main' + (c.panel ? " vs-panel" : "") + '">' +
				(c.kicker ? '<div class="vs-kick" style="background:' + accent + ";color:" + onColor(accent) + '"><i></i>' + esc(c.kicker) + "</div>" : "") +
				'<h1 class="vs-title" style="font-size:' + (c.fontsize / 10) + "em;" + (c.upper ? "text-transform:uppercase;letter-spacing:.03em;" : "") + '"><span>' + SSO.fxHTML(c.title, c.fx) + "</span></h1>" +
				(c.subtitle ? '<div class="vs-sub">' + esc(c.subtitle) + "</div>" : "") + count +
				(msgs.length ? '<div class="vs-msgs">' + msgs.map(function (m) { return "<div>" + esc(m) + "</div>"; }).join("") + "</div>" : "") + "</div>";
			var foot = socials.length || c.qr ? '<div class="vs-foot">' +
				(socials.length ? '<div class="vs-socials ' + c.soclayout + '">' + socials.map(function (s) { return '<div class="vs-soc">' + SSO.iconHTML(s.net, c.icons) + "<span>" + esc(s.handle) + "</span></div>"; }).join("") + "</div>" : "") +
				(c.qr ? '<div class="vs-qr"><div class="vs-qr-box"></div>' + (c.qrcaption ? '<div class="vs-qr-cap">' + esc(c.qrcaption) + "</div>" : "") + "</div>" : "") + "</div>" : "";
			body.innerHTML = main + foot;
			var title = body.querySelector(".vs-title"), tspan = title.firstChild;
			if (c.fx && c.fx !== "ransom") { SSO.applyFX(tspan, c.fx, c.fx1, c.fx2, c.fx3); }
			qrInto(body.querySelector(".vs-qr-box"), c.qr);
			var msgBox = body.querySelector(".vs-msgs");
			if (msgBox) { rotate(msgBox, 6); }
			var guides = null;
			var run = watch(root, function (W, H) {
				var u = vunit(W, H), size = u;
				el.style.setProperty("--pp-u", r2(u) + "px");
				if (!guides) { guides = drawGuides(el, c, ctx, u) || true; } else if (guides.style) { guides.style.fontSize = u + "px"; }
				// Shrink the title until its longest word fits the width, then the whole block until it fits the height.
				for (var n = 0; n < 24; n++) {
					el.style.fontSize = r2(size) + "px";
					fitWords(title, c.title, c.fontsize / 10, c.upper, c.fx);
					if (size <= 2 || body.scrollHeight <= body.clientHeight + 1) { break; }
					size *= 0.95;
				}
			});
			SSO.fontsReady(run);
			var boxes = body.querySelector(".vs-boxes"), countEl = body.querySelector(".vs-count"), arc = body.querySelector(".vs-arc");
			if (counting) {
				var tgt = SSO.parseTarget(c.target), start = Date.now(), end = tgt ? tgt.getTime() : start + c.minutes * 60000, total = Math.max(1000, end - start), lastKey = "", done = false;
				var tick = function () {
					var left = end - Date.now();
					if (left <= 0) {
						if (done) { return; }
						done = true;
						if (boxes) { boxes.outerHTML = '<div class="vs-count done" style="color:' + accent + '">' + esc(c.endtext) + "</div>"; }
						else { countEl.className += " done"; countEl.textContent = c.endtext; }
						if (arc) { arc.setAttribute("stroke-dashoffset", "333"); }
						run();
						return;
					}
					if (boxes) {
						var p = SSO.splitDuration(left), units = p.d > 0 ? [[p.d, "days"], [p.h, "hours"], [p.m, "min"]] : p.h > 0 ? [[p.h, "hours"], [p.m, "min"], [p.s, "sec"]] : [[p.m, "min"], [p.s, "sec"]];
						var key = units.map(function (x) { return x[0]; }).join(":");
						if (key !== lastKey) { lastKey = key; boxes.innerHTML = units.map(function (x) { return "<span><b>" + SSO.pad(x[0]) + "</b><i>" + x[1] + "</i></span>"; }).join(""); }
					} else {
						countEl.textContent = SSO.formatDuration(left, { ceil: true });
						if (arc) { arc.setAttribute("stroke-dashoffset", r2(333 * (1 - left / total))); }
					}
				};
				tick();
				setInterval(tick, 250);
			}
		}
	});

	// ---------------------------------------------------------------- vertical stream kit
	var SPOTS = [["", "Hidden"], ["tl", "Top left"], ["tc", "Top centre"], ["tr", "Top right"], ["ml", "Middle left"], ["mr", "Middle right"], ["bl", "Bottom left"], ["bc", "Bottom centre"], ["br", "Bottom right"]];
	function spot(key, group, def) { return { key: key, label: "Where it sits", type: "select", group: group, default: def, options: SPOTS }; }
	function burstPath() {
		var d = "", n = 16;
		for (var i = 0; i < n * 2; i++) { var a = i * Math.PI / n, r = i % 2 ? 41 : 50; d += (i ? "L" : "M") + r2(50 + Math.cos(a) * r) + " " + r2(50 + Math.sin(a) * r); }
		return d + "z";
	}
	var KIT_THEMES = [["glass", "Dark glass"], ["solid", "Solid cards"], ["neon", "Neon"], ["bold", "Bold blocks"], ["soft", "Soft & round"], ["minimal", "Text only"]];
	SSO.register({
		id: "vkit",
		name: "Vertical stream kit",
		category: "vertical",
		description: "Everything a 9:16 stream usually needs, as one overlay: a name pill, your socials, a pinned note for today's topic, a goal bar you type in, a LIVE / NEW / SALE badge and a rotating reminder. Each piece can be moved or hidden, and they all stay out of the way of the app's own buttons.",
		size: [1080, 1920],
		sizeFor: function (c, thumb) { return thumb ? [405, 720] : [1080, 1920]; },
		fields: [
			spot("headpos", "Name pill", "tl"),
			{ key: "name", label: "Name", type: "text", group: "Name pill", default: "Your Name" },
			{ key: "handle", label: "Handle or tagline", type: "text", group: "Name pill", default: "@yourname" },
			{ key: "avatar", label: "Picture link (blank = first letter)", type: "text", image: true, group: "Name pill", default: "" },
			{ key: "livedot", label: "Show a LIVE tag in the pill", type: "bool", group: "Name pill", default: false },
			spot("badgepos", "Badge", "tr"),
			{ key: "badge", label: "Badge text", type: "text", group: "Badge", default: "LIVE" },
			{ key: "badgestyle", label: "Badge style", type: "select", group: "Badge", default: "pill", options: [["pill", "Pill with a pulsing dot"], ["burst", "Starburst"], ["stamp", "Stamp"], ["ribbon", "Ribbon"]] },
			spot("socpos", "Socials", "ml"),
			field(SSO.f.socials("tiktok:@yourname,instagram:@yourname,youtube:@yourname"), { group: "Socials" }),
			field(SSO.f.iconStyle("brand"), { group: "Socials" }),
			spot("notepos", "Pinned note", "bl"),
			{ key: "notehead", label: "Note heading", type: "text", group: "Pinned note", default: "Today" },
			{ key: "note", label: "Note text", type: "textarea", group: "Pinned note", default: "Q&A, then we open the mystery box" },
			spot("goalpos", "Goal bar", "tc"),
			{ key: "goallabel", label: "Goal label", type: "text", group: "Goal bar", default: "Follower goal" },
			{ key: "goalnow", label: "Where you are now", type: "number", group: "Goal bar", default: 370, min: 0, max: 100000000, step: 1, help: "Typed in by you; it does not update by itself. For a goal that fills from real events, use the Social Stream Ninja goal overlays." },
			{ key: "goalmax", label: "The goal", type: "number", group: "Goal bar", default: 500, min: 1, max: 100000000, step: 1 },
			spot("msgpos", "Rotating reminder", ""),
			{ key: "messages", label: "Reminders (one per line)", type: "textarea", group: "Rotating reminder", default: "Tap follow so you catch the next one\nSay hi in chat!\nShare the stream with a friend" },
			{ key: "msgtime", label: "Seconds per reminder", type: "number", group: "Rotating reminder", default: 6, min: 2, max: 120, step: 1 },
			{ key: "theme", label: "Look", type: "select", group: "Look", default: "glass", options: KIT_THEMES },
			{ key: "bg", label: "Card colour", type: "color", group: "Look", default: "0b0e1a" },
			{ key: "fg", label: "Text colour", type: "color", group: "Look", default: "ffffff" },
			{ key: "accent", label: "Accent colour", type: "color", group: "Look", default: "ff3d71" },
			{ key: "accent2", label: "Second accent (goal bar)", type: "color", group: "Look", default: "ffb347" },
			field(SSO.f.font("Poppins"), { group: "Look" }),
			{ key: "zoom", label: "Size", type: "range", group: "Look", default: 1.2, min: 0.6, max: 1.8, step: 0.05 }
		].concat(safeFields(12, 22, 15)),
		presets: [
			{ name: "Glass kit", tags: ["vertical", "pro", "simple"], values: {} },
			{ name: "Neon kit", tags: ["vertical", "cyber", "gaming"], values: { theme: "neon", bg: "0a0014", accent: "00fff0", accent2: "ff3ec8", font: "Rajdhani", msgpos: "bc", notepos: "", zoom: 1.3 } },
			{ name: "Bold blocks kit", tags: ["vertical", "punk", "spicy"], values: { theme: "bold", bg: "f2e600", fg: "111111", accent: "ff3d00", accent2: "111111", font: "Anton", badgestyle: "stamp", notehead: "Tonight", zoom: 1.25 } },
			{ name: "Soft and cute kit", tags: ["vertical", "cute"], values: { theme: "soft", bg: "fff0f6", fg: "6b3a5b", accent: "ff7eb6", accent2: "b388ff", font: "Fredoka", badge: "NEW", badgestyle: "burst", goallabel: "Heart goal" } },
			{ name: "Clean white kit", tags: ["vertical", "simple", "pro"], values: { theme: "solid", bg: "ffffff", fg: "14161c", accent: "2563eb", accent2: "38bdf8", font: "Inter", livedot: true, badgepos: "" } },
			{ name: "Text only kit", tags: ["vertical", "simple"], values: { theme: "minimal", font: "Montserrat", goalpos: "", accent: "ffd166" } },
			{ name: "Live seller kit", tags: ["vertical", "pro"], values: { theme: "solid", bg: "ffffff", fg: "14161c", accent: "e11d48", accent2: "fb923c", badge: "SALE", badgestyle: "ribbon", name: "Your Shop", handle: "new drops every Friday", notehead: "How to buy", note: "Comment SOLD and the lot number", goallabel: "Sold tonight", goalnow: 18, goalmax: 40, msgpos: "bc", messages: "Free shipping over $50\nWe ship the next day\nAsk anything in chat", socpos: "" } },
			{ name: "Just a name tag", tags: ["vertical", "simple"], values: { headpos: "bl", badgepos: "tl", socpos: "", notepos: "", goalpos: "", livedot: false, zoom: 1.45 } },
			{ name: "Cozy autumn kit", tags: ["vertical", "autumn", "cozy"], values: { theme: "soft", bg: "3b2a20", fg: "fff3dc", accent: "f59e0b", accent2: "ef4444", font: "Kalam", badge: "cozy", badgestyle: "stamp", notehead: "Tonight", note: "tea, chat and a slow game", goallabel: "Cozy goal" } }
		],
		render: function (root, c, ctx) {
			vcommon();
			SSO.loadFont(c.font);
			var accent = pick(c.accent, "ff3d71"), bg = pick(c.bg, "0b0e1a"), fg = pick(c.fg, "ffffff"), theme = c.theme;
			var el = mk("div", "vk t-" + theme, root);
			el.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";color:" + fg + ";--k-bg:" + (theme === "glass" ? alpha(bg, 0.62) : theme === "neon" ? alpha(bg, 0.72) : bg) + ";--k-fg:" + fg + ";--k-acc:" + accent +
				";--k-acc2:" + pick(c.accent2, "ffb347") + ";--k-on:" + onColor(accent) + ";--k-line:" + alpha(fg, theme === "solid" || theme === "soft" ? 0.14 : 0.2) + ";";
			var safe = mk("div", "vk-safe", el);
			safe.style.cssText = "top:" + (c.safetop + 1) + "%;bottom:" + (c.safebottom + 1) + "%;right:" + Math.max(4, c.saferight) + "%;";
			safe.innerHTML = '<div class="vk-top"><div class="vk-row"><div class="vk-colm l" data-s="tl"></div><div class="vk-colm r" data-s="tr"></div></div><div class="vk-c" data-s="tc"></div></div>' +
				'<div class="vk-mid"><div class="vk-colm l" data-s="ml"></div><div class="vk-colm r" data-s="mr"></div></div>' +
				'<div class="vk-bot"><div class="vk-c" data-s="bc"></div><div class="vk-row"><div class="vk-colm l" data-s="bl"></div><div class="vk-colm r" data-s="br"></div></div></div>';
			function put(pos, cls, html) {
				var host = pos && safe.querySelector('[data-s="' + pos + '"]');
				return host ? mk("div", "vk-p " + cls, host, html) : null;
			}
			var initial = Array.from(String(c.name || "?").trim())[0] || "?";
			var head = put(c.headpos, "vk-card vk-head", '<div class="vk-ava">' + (c.avatar ? '<img alt="">' : "<b>" + esc(initial) + "</b>") + '</div><div class="vk-id"><div class="vk-name">' + esc(c.name) + "</div>" +
				(c.handle ? '<div class="vk-handle">' + esc(c.handle) + "</div>" : "") + "</div>" + (c.livedot ? '<div class="vk-live"><i></i>LIVE</div>' : ""));
			if (head && c.avatar) {
				var img = head.querySelector("img");
				img.onerror = function () { img.parentNode.innerHTML = "<b>" + esc(initial) + "</b>"; };
				img.src = c.avatar;
			}
			if (c.badge) {
				put(c.badgepos, "vk-badge " + c.badgestyle, c.badgestyle === "burst" ? '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + burstPath() + '" fill="' + accent + '"/><circle cx="50" cy="50" r="35" fill="none" stroke="' + alpha(onColor(accent), 0.45) + '" stroke-width="1.2" stroke-dasharray="2 2.4"/></svg><span>' + esc(c.badge) + "</span>" :
					(c.badgestyle === "pill" ? "<i></i>" : "") + esc(c.badge));
			}
			var total = Math.max(1, c.goalmax), frac = SSO.clamp(c.goalnow / total, 0, 1);
			put(c.goalpos, "vk-card vk-goal", '<div class="vk-goal-top"><span>' + esc(c.goallabel) + "</span><b>" + esc(Number(c.goalnow).toLocaleString()) + " / " + esc(Number(c.goalmax).toLocaleString()) + '</b></div><div class="vk-bar"><div style="width:' + r2(frac * 100) + '%"></div></div>');
			var socials = SSO.parseSocials(c.socials);
			if (socials.length) { put(c.socpos, "vk-socs", socials.map(function (s) { return '<div class="vk-card vk-soc">' + SSO.iconHTML(s.net, c.icons) + "<span>" + esc(s.handle) + "</span></div>"; }).join("")); }
			if (c.note) { put(c.notepos, "vk-card vk-note", (c.notehead ? '<div class="vk-note-h">' + esc(c.notehead) + "</div>" : "") + '<div class="vk-note-t">' + esc(c.note) + "</div>"); }
			var msgs = SSO.lines(c.messages);
			if (msgs.length) {
				var msg = put(c.msgpos, "vk-card vk-msg", '<div class="vk-msgs">' + msgs.map(function (m) { return "<div>" + esc(m) + "</div>"; }).join("") + "</div>");
				if (msg) { rotate(msg.firstChild, c.msgtime); }
			}
			var guides = null;
			var run = watch(root, function (W, H) {
				var u = vunit(W, H);
				if (!guides) { guides = drawGuides(el, c, ctx, u) || true; } else if (guides.style) { guides.style.fontSize = u + "px"; }
				var size = u * c.zoom;
				for (var n = 0; n < 20; n++) {
					el.style.fontSize = r2(size) + "px";
					if (size <= 2 || (safe.scrollHeight <= safe.clientHeight + 1 && safe.scrollWidth <= safe.clientWidth + 1)) { break; }
					size *= 0.95;
				}
			});
			SSO.fontsReady(run);
		}
	});

	// ---------------------------------------------------------------- vertical live-selling card
	function numberIn(text) { var m = /(\d[\d,]*\.?\d*)/.exec(String(text || "")); return m ? parseFloat(m[1].replace(/,/g, "")) : NaN; }
	SSO.register({
		id: "vshop",
		name: "Live selling card (vertical)",
		category: "vertical",
		description: "A product card for selling live on a 9:16 stream: lot number, item name, price with the old price struck through, how many are left, shipping, how to buy in three steps, payment options and an optional deal timer. Everything is typed in by you, so change the link (or keep a few OBS sources ready) as you move to the next item.",
		size: [1080, 1920],
		sizeFor: function (c, thumb) { return thumb ? [405, 720] : [1080, 1920]; },
		fields: [
			{ key: "lot", label: "Lot or item number (blank = none)", type: "text", group: "Item", default: "Lot 12" },
			{ key: "title", label: "Item name", type: "text", group: "Item", default: "Mystery box - series 3" },
			{ key: "now", label: "Price", type: "text", group: "Item", default: "$24" },
			{ key: "was", label: "Old price (blank = none)", type: "text", group: "Item", default: "$35" },
			{ key: "badge", label: "Badge (blank = work out the discount, - = none)", type: "text", group: "Item", default: "" },
			{ key: "stock", label: "Stock line (blank = none)", type: "text", group: "Item", default: "3 left" },
			{ key: "ship", label: "Shipping line (blank = none)", type: "text", group: "Item", default: "Free US shipping" },
			{ key: "image", label: "Picture link (blank = none)", type: "text", image: true, group: "Item", default: "" },
			{ key: "steps", label: "How to buy (one short step per line, blank = none)", type: "textarea", group: "How to buy", default: "Comment SOLD 12\nPay the invoice\nShips tomorrow" },
			{ key: "pay", label: "Ways to pay", type: "socials", group: "How to buy", default: "paypal:PayPal,venmo:Venmo,cashapp:Cash App" },
			{ key: "minutes", label: "Deal timer in minutes (0 = none)", type: "number", group: "Timer", default: 0, min: 0, max: 600, step: 0.5 },
			{ key: "timerlabel", label: "Timer label", type: "text", group: "Timer", default: "Ends in" },
			{ key: "endtext", label: "Text when the timer ends", type: "text", group: "Timer", default: "Closed" },
			{ key: "style", label: "Style", type: "select", group: "Look", default: "card", options: [["card", "Clean card"], ["dark", "Dark glass"], ["bold", "Bold sale"], ["tag", "Price tag"], ["neon", "Neon"], ["bar", "Slim bar"]] },
			{ key: "pos", label: "Where it sits", type: "select", group: "Look", default: "bottom", options: [["bottom", "Above the chat area"], ["top", "Under the app header"]] },
			{ key: "bg", label: "Card colour", type: "color", group: "Look", default: "ffffff" },
			{ key: "fg", label: "Text colour", type: "color", group: "Look", default: "14161c" },
			{ key: "accent", label: "Accent colour", type: "color", group: "Look", default: "e11d48" },
			field(SSO.f.font("Poppins"), { group: "Look" }),
			{ key: "zoom", label: "Size", type: "range", group: "Look", default: 1, min: 0.6, max: 1.4, step: 0.05 }
		].concat(safeFields(12, 22, 15)),
		presets: [
			{ name: "Clean product card", tags: ["vertical", "pro", "simple"], values: {} },
			{ name: "Dark glass card", tags: ["vertical", "pro", "elegant"], values: { style: "dark", bg: "0b0e1a", fg: "ffffff", accent: "22d3ee" } },
			{ name: "Bold sale card", tags: ["vertical", "spicy", "punk"], values: { style: "bold", bg: "f2e600", fg: "111111", accent: "e11d48", badge: "SALE", font: "Bungee", zoom: 0.92 } },
			{ name: "Price tag", tags: ["vertical", "cozy", "retro"], values: { style: "tag", bg: "e7c99b", fg: "3a2613", accent: "b4321a", font: "Special Elite", lot: "No. 12", pay: "" } },
			{ name: "Neon deal with timer", tags: ["vertical", "cyber", "gaming"], values: { style: "neon", bg: "0a0014", fg: "ffffff", accent: "ff3ec8", font: "Rajdhani", minutes: 3, zoom: 1.05 } },
			{ name: "Auction lot", tags: ["vertical", "pro"], values: { style: "dark", bg: "101426", fg: "ffffff", accent: "facc15", lot: "Lot 7", title: "Signed first-edition print", now: "$40", was: "", badge: "Auction", stock: "Current bid", ship: "Ships worldwide", steps: "Type your bid in chat\nHighest bid at zero wins\nWe message the winner", minutes: 2, timerlabel: "Closes in", endtext: "Sold!", pay: "" } },
			{ name: "Slim price bar", tags: ["vertical", "simple"], values: { style: "bar", bg: "111827", fg: "ffffff", accent: "facc15", badge: "-" } },
			{ name: "New drop (top of screen)", tags: ["vertical", "simple", "cute"], values: { pos: "top", accent: "16a34a", badge: "New", lot: "", was: "", stock: "Just landed", steps: "" } }
		],
		render: function (root, c, ctx) {
			vcommon();
			SSO.loadFont(c.font);
			var accent = pick(c.accent, "e11d48"), bg = pick(c.bg, "ffffff"), fg = pick(c.fg, "14161c"), style = c.style;
			var wrap = mk("div", "vh-wrap" + (c.pos === "top" ? " top" : ""), root);
			wrap.style.cssText = "top:" + (c.safetop + 1) + "%;bottom:" + (c.safebottom + 1) + "%;right:" + Math.max(4, c.saferight) + "%;font-family:" + SSO.fontStack(c.font) + ";";
			var holder = mk("div", style === "tag" ? "vh-tagwrap" : "", wrap);
			var card = mk("div", "vh s-" + style, holder);
			card.style.cssText = "--h-bg:" + (style === "dark" ? alpha(bg, 0.7) : style === "neon" ? alpha(bg, 0.78) : bg) + ";--h-fg:" + fg + ";--h-inv:" + bg + ";--h-acc:" + accent + ";--h-on:" + onColor(accent) + ";--h-line:" + alpha(fg, 0.14) + ";--h-line2:" + alpha(fg, 0.35) + ";";
			var now = numberIn(c.now), was = numberIn(c.was), badge = c.badge === "-" ? "" : c.badge || (isFinite(now) && isFinite(was) && was > now ? "-" + Math.round((1 - now / was) * 100) + "%" : "");
			var timer = c.minutes > 0 ? '<span class="vh-timer">' + SVG.clock + '<span class="vh-time"></span></span>' : "";
			var lot = c.lot ? '<span class="vh-lot">' + esc(c.lot) + "</span>" : "", badgeHTML = badge ? '<span class="vh-badge">' + esc(badge) + "</span>" : "";
			var prices = '<b class="vh-now">' + esc(c.now) + "</b>" + (c.was ? '<s class="vh-was">' + esc(c.was) + "</s>" : "");
			if (style === "bar") {
				card.innerHTML = '<div class="vh-top">' + lot + '</div><div class="vh-title">' + esc(c.title) + "</div>" + prices + badgeHTML + timer;
			} else {
				var steps = SSO.lines(c.steps).slice(0, 4), pays = SSO.parseSocials(c.pay);
				card.innerHTML = (lot || badgeHTML || timer ? '<div class="vh-top">' + lot + badgeHTML + timer + "</div>" : "") +
					'<div class="vh-main">' + (c.image ? '<div class="vh-pic"><img alt=""></div>' : "") + '<div class="vh-info"><div class="vh-title">' + esc(c.title) + '</div><div class="vh-prices">' + prices + "</div>" +
					(c.stock || c.ship ? '<div class="vh-meta">' + (c.stock ? "<span>" + SVG.box + esc(c.stock) + "</span>" : "") + (c.ship ? "<span>" + SVG.truck + esc(c.ship) + "</span>" : "") + "</div>" : "") + "</div></div>" +
					(steps.length ? '<div class="vh-steps">' + steps.map(function (s, i) { return "<span><b>" + (i + 1) + "</b>" + esc(s) + "</span>"; }).join("") + "</div>" : "") +
					(pays.length ? '<div class="vh-pay">' + pays.map(function (p) { return "<span>" + SSO.iconHTML(p.net, "brand") + esc(p.handle) + "</span>"; }).join("") + "</div>" : "");
				var pic = card.querySelector(".vh-pic img");
				if (pic) { pic.onerror = function () { pic.parentNode.style.display = "none"; }; pic.src = c.image; }
			}
			var guides = null;
			watch(root, function (W, H) {
				var u = vunit(W, H);
				if (!guides) { guides = drawGuides(root, c, ctx, u) || true; } else if (guides.style) { guides.style.fontSize = u + "px"; }
				wrap.style.fontSize = r2(u * c.zoom) + "px";
			});
			var time = card.querySelector(".vh-time");
			if (time) {
				var end = Date.now() + c.minutes * 60000, label = c.timerlabel ? c.timerlabel + " " : "";
				var tick = function () {
					var left = end - Date.now();
					time.textContent = left <= 0 ? c.endtext : label + SSO.formatDuration(left, { ceil: true });
				};
				tick();
				setInterval(tick, 250);
			}
		}
	});
})();
