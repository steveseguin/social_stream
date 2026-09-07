#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { _electron } = require("playwright");

// Run against the actual sibling SSApp checkout, with a fresh isolated profile.
const repoRoot = process.env.SSAPP_REPO || path.resolve(__dirname, "..", "..", "ssapp");
const electronPath = require(path.join(repoRoot, "node_modules", "electron"));
const socialStreamRoot = path.resolve(__dirname, "..");
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "ssapp-popup-search-filter-"));
const token = `popup-search-filter-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function getFreePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const port = server.address().port;
			server.close(() => resolve(port));
		});
	});
}

function requestJson(port, pathname, body) {
	return new Promise((resolve, reject) => {
		const payload = body === undefined ? null : JSON.stringify(body);
		const request = http.request(
			{
				host: "127.0.0.1",
				port,
				path: `${pathname}${pathname.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`,
				method: payload === null ? "GET" : "POST",
				headers:
					payload === null
						? {}
						: {
								"Content-Type": "application/json",
								"Content-Length": Buffer.byteLength(payload)
							}
			},
			response => {
				let text = "";
				response.setEncoding("utf8");
				response.on("data", chunk => {
					text += chunk;
				});
				response.on("end", () => {
					try {
						const parsed = text ? JSON.parse(text) : {};
						if (response.statusCode >= 200 && response.statusCode < 300) resolve(parsed);
						else reject(new Error(`HTTP ${response.statusCode}: ${text}`));
					} catch (error) {
						reject(error);
					}
				});
			}
		);
		request.on("error", reject);
		request.setTimeout(90000, () => request.destroy(new Error("SSApp control request timed out")));
		if (payload !== null) request.write(payload);
		request.end();
	});
}

async function waitForControl(port, child, timeoutMs = 60000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (child.exitCode !== null) throw new Error(`SSApp exited early with code ${child.exitCode}.`);
		try {
			const ping = await requestJson(port, "/ping");
			if (ping && ping.ok) return;
		} catch (_) {}
		await new Promise(resolve => setTimeout(resolve, 250));
	}
	throw new Error("Timed out waiting for SSApp remote control.");
}

async function stopApp(child) {
	if (!child || child.exitCode !== null) return;
	child.kill();
	await Promise.race([new Promise(resolve => child.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 5000))]);
}

async function run() {
	const port = await getFreePort();
	let electronApp;
	const pageErrors = [];
	const localPort = await getFreePort();
	const launch = async () => {
		electronApp = await _electron.launch({ executablePath: electronPath, args: [".", "--multiinstance", "--preferlocalassets", `--filesource=${socialStreamRoot}`, "--remote-control", `--ssapp-local-server-port=${localPort}`], cwd: repoRoot, env: { ...process.env, SSAPP_USER_DATA_DIR: profileDir, SSAPP_REMOTE_CONTROL: "1", SSAPP_REMOTE_CONTROL_PORT: String(port), SSAPP_REMOTE_CONTROL_TOKEN: token, SSAPP_DIAGNOSTICS_SAFE_GPU: "1", SSAPP_DEBUG_LOGS: "0" }, timeout: 60000 });
		for (const page of electronApp.windows()) {
			page.on("pageerror", error => pageErrors.push(error.message));
		}
		return electronApp.process();
	};
	let child = await launch();
	try {
		await waitForControl(port, child);
		let mainWindow;
		for (let i = 0; i < 100; i++) {
			mainWindow = ((await requestJson(port, "/windows")).windows || []).find(w => String(w.url).includes("index.html"));
			if (mainWindow) break;
			await new Promise(r => setTimeout(r, 200));
		}
await requestJson(port,'/exec',{windowId:mainWindow.id,code:`(async()=>{await ensurePopupPanelLoaded();await new Promise(r=>setTimeout(r,2500));return true;})()`});const win=electronApp.windows().find(p=>p.url().includes('index.html'));for(const theme of ['light','dark']){await win.emulateMedia({colorScheme:theme});await new Promise(r=>setTimeout(r,600));const r=await requestJson(port,'/exec',{windowId:mainWindow.id,code:'('+function(){const d=document.getElementById('frame1').contentDocument,w=d.defaultView,issues=[];function rgb(v){const a=v.match(/[\d.]+/g);return a?a.map(Number):[0,0,0,0];}function bg(el){for(let e=el;e;e=e.parentElement){let c=rgb(w.getComputedStyle(e).backgroundColor);if(c.length===3||c[3]===1)return c;}return [255,255,255];}function lum(c){return c.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}function contrast(a,b){let x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}let count=0;d.querySelectorAll('.popup-settings-panel input:not([type="checkbox"]),.popup-settings-panel select,.popup-settings-panel button,.popup-reviewed-control').forEach(e=>{if(e.hidden||e.disabled||e.type==='hidden')return;const c=w.getComputedStyle(e),name=e.id||e.name||e.textContent.trim();if(c.display==='none')return;const ratio=contrast(rgb(c.color),bg(e));if(ratio<4.5)issues.push(name+' text contrast '+ratio.toFixed(2));if(e.tagName!=='BUTTON'){const labelled=e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||Array.from(e.labels||[]).some(l=>l.textContent.trim());if(!labelled)issues.push(name+' missing name');const br=contrast(rgb(c.borderTopColor),bg(e));if(c.borderTopStyle!=='none'&&br<3)issues.push(name+' boundary contrast '+br.toFixed(2));if(e.placeholder){const pc=rgb(w.getComputedStyle(e,'::placeholder').color);const pr=contrast(pc,bg(e));if(pr<4.5)issues.push(name+' placeholder contrast '+pr.toFixed(2));}}count++;});d.querySelectorAll('.popup-settings-panel input[type="checkbox"]').forEach(e=>{if(!e.closest('.switch'))issues.push((e.id||e.name)+' not a switch');if(!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!Array.from(e.labels||[]).some(l=>l.textContent.trim()))issues.push((e.id||e.name)+' missing toggle name');});if(d.querySelectorAll('#monetization-settings > .money-platform').length!==4)issues.push('Platform grouping damaged');return {count,issues};}.toString()+')()'});console.log(theme,JSON.stringify(r.result));if(r.result.issues.length)throw Error('Accessibility audit failed');} }finally{await electronApp.close();}}run().catch(e=>{console.error(e);process.exitCode=1;});