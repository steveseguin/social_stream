// Scales a game card to the browser source so it reads at stream size: the card is laid out once at a fixed width,
// then sized by the window. &scale=0.2..1 shrinks it; &align=left|right|top|bottom (combinable, e.g. topright) moves it.
window.SSNFitCard = function (card, params) {
	'use strict';
	var scale = parseFloat(params.get('scale')), align = (params.get('align') || '').toLowerCase(), tallest = 0, wasPortrait = null;
	scale = isFinite(scale) ? Math.max(0.2, Math.min(1, scale)) : 1;
	function fit() {
		var vw = window.innerWidth, vh = window.innerHeight, portrait = vh > vw * 1.1;
		if (portrait !== wasPortrait) {
			wasPortrait = portrait; tallest = 0;
			document.body.classList.toggle('portrait', portrait);
			document.body.classList.toggle('landscape', !portrait);
		}
		var w = card.offsetWidth, h = card.offsetHeight;
		if (!w || !h) return;
		// Scale to the tallest state seen so far, so the card does not resize every time a row appears.
		tallest = Math.max(tallest, h);
		var m = Math.min(vw, vh) * 0.03, s = Math.min((vw - m * 2) / w, (vh - m * 2) / tallest) * scale;
		var x = align.indexOf('left') >= 0 ? m : align.indexOf('right') >= 0 ? vw - w * s - m : (vw - w * s) / 2;
		var y = align.indexOf('top') >= 0 ? m : align.indexOf('bottom') >= 0 ? vh - tallest * s - m : (vh - tallest * s) / 2;
		card.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) scale(' + s.toFixed(4) + ')';
	}
	window.addEventListener('resize', fit);
	if (window.ResizeObserver) new ResizeObserver(fit).observe(card);
	fit();
	return fit;
};
