#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// Run against the actual sibling SSApp checkout, with a fresh isolated profile.
const repoRoot = process.env.SSAPP_REPO || path.resolve(__dirname, '..', '..', 'ssapp');
const electronPath = require(path.join(repoRoot, 'node_modules', 'electron'));
const socialStreamRoot = path.resolve(__dirname, '..');
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssapp-popup-search-filter-'));
const token = `popup-search-filter-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function getFreePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const port = server.address().port;
			server.close(() => resolve(port));
		});
	});
}

function requestJson(port, pathname, body) {
	return new Promise((resolve, reject) => {
		const payload = body === undefined ? null : JSON.stringify(body);
		const request = http.request({
			host: '127.0.0.1',
			port,
			path: `${pathname}${pathname.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`,
			method: payload === null ? 'GET' : 'POST',
			headers: payload === null ? {} : {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(payload),
			},
		}, response => {
			let text = '';
			response.setEncoding('utf8');
			response.on('data', chunk => { text += chunk; });
			response.on('end', () => {
				try {
					const parsed = text ? JSON.parse(text) : {};
					if (response.statusCode >= 200 && response.statusCode < 300) resolve(parsed);
					else reject(new Error(`HTTP ${response.statusCode}: ${text}`));
				} catch (error) { reject(error); }
			});
		});
		request.on('error', reject);
		if (payload !== null) request.write(payload);
		request.end();
	});
}

async function waitForControl(port, child, timeoutMs = 60000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (child.exitCode !== null) throw new Error(`SSApp exited early with code ${child.exitCode}.`);
		try {
			const ping = await requestJson(port, '/ping');
			if (ping && ping.ok) return;
		} catch (_) { }
		await new Promise(resolve => setTimeout(resolve, 250));
	}
	throw new Error('Timed out waiting for SSApp remote control.');
}

async function stopApp(child) {
	if (!child || child.exitCode !== null) return;
	child.kill();
	await Promise.race([
		new Promise(resolve => child.once('exit', resolve)),
		new Promise(resolve => setTimeout(resolve, 5000)),
	]);
}


async function run() {
 const port=await getFreePort();
 const child=spawn(electronPath,['.','--multiinstance','--preferlocalassets',`--filesource=${socialStreamRoot}`,'--remote-control'],{cwd:repoRoot,env:{...process.env,SSAPP_USER_DATA_DIR:profileDir,SSAPP_REMOTE_CONTROL:'1',SSAPP_REMOTE_CONTROL_PORT:String(port),SSAPP_REMOTE_CONTROL_TOKEN:token,SSAPP_DIAGNOSTICS_SAFE_GPU:'1',SSAPP_DEBUG_LOGS:'0'},stdio:['ignore','ignore','ignore'],windowsHide:true});
 try {
 await waitForControl(port,child);
 let mainWindow;
 for(let i=0;i<100;i++){mainWindow=((await requestJson(port,'/windows')).windows||[]).find(w=>String(w.url).includes('index.html'));if(mainWindow)break;await new Promise(r=>setTimeout(r,200));}
 const result=await requestJson(port,'/exec',{windowId:mainWindow.id,code:`(async()=>{
 await ensurePopupPanelLoaded(true);
 const frame=document.getElementById('frame1');
 for(let i=0;i<100;i++){if(frame.contentDocument?.getElementById('searchInput') && frame.contentDocument?.getElementById('docklink')?.href)break;await new Promise(r=>setTimeout(r,200));}
 await new Promise(r=>setTimeout(r,1200));
 const d=frame.contentDocument,w=frame.contentWindow;
 const input=d.getElementById('searchInput'),toolbar=d.getElementById('popupSearchToolbar');
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};

 const checks=[];
 function check(value,message){if(!value)throw new Error(message);checks.push(message);}
 const bttv=d.querySelector('[data-setting="bttv"]'),row=bttv.closest('.options_group > div');
 const wrappers=[...d.querySelectorAll('input.collapsible-input')];
 const controls=[...d.querySelectorAll('input:not(.collapsible-input):not([type="search"]),select,textarea')];
 const values=()=>JSON.stringify(controls.map(e=>[e.value,e.checked]));
 const originalValues=values();
 const inlineDisplays=[...d.querySelectorAll('button,.wrapper,.options_group > div')].map(e=>[e,e.style.display]);
 const visible=e=>!!e.getBoundingClientRect().height && w.getComputedStyle(e).display!=='none';
 const filter=()=>d.getElementById('activeIcon').click();
 const escape=()=>input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 async function search(q){input.value=q;input.dispatchEvent(new w.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,350));return [...d.querySelectorAll('.popup-search-result')];}
 check(!bttv.checked,'Fresh profile starts with BTTV disabled');
 check(visible(input),'Search visible initially');
 for(let cycle=0;cycle<3;cycle++){
  const state=wrappers.map(e=>e.checked);
  let results=await search('Better Twitch TV');
  check(results.length===1 && visible(results[0]),'Emote alias finds BTTV');
  filter();
  check(results.every(visible),'Filter does not hide existing results');
  filter();
  check(wrappers.every((e,i)=>e.checked===state[i]),'Filter restores open sections');
  check(results.every(visible),'Results survive filter off');
  escape();
  check(!input.value && !d.body.classList.contains('popup-searching') && visible(input),'Escape clears search and keeps input visible');
  filter();
  check(!visible(row),'Enabled filter hides disabled setting');
  results=await search('Better Twitch TV');
  check(results.length===1 && visible(results[0]),'Search works after enabling filter');
  results[0].click();
  check(visible(row) && !bttv.checked,'Result reveals disabled setting without enabling it');
  check(!input.value && visible(input),'Result clears query and keeps search visible');
  filter();
  check(!visible(row),'Filter can be enabled again after selecting result');
  filter();
  check(visible(row),'Filter off restores selected setting');
 }
 const state=wrappers.map(e=>e.checked);
 filter();await search('read aloud');escape();
 check(!visible(row),'Escape preserves enabled filter');filter();
 check(wrappers.every((e,i)=>e.checked===state[i]),'Escape plus filter off restores sections');
 let results=await search('this-query-has-no-results-9398');
 check(results.length===0 && d.getElementById('popupSearchResults').textContent.includes('No matching'),'No-results message works');
 await search('');
 check(!d.body.classList.contains('popup-searching'),'Clearing query closes results');
 for(const q of ['Seven TV','Franker Face Z','read aloud','bigger text']){
  results=await search(q);check(results.length>0 && results.every(visible),'Alias works: '+q);
 }
 escape();input.blur();
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'f',ctrlKey:true,bubbles:true,cancelable:true}));
 check(d.activeElement===input,'Ctrl+F focuses search');
 escape();
 await new Promise(r=>setTimeout(r,3000));
 check(values()===originalValues,'Settings unchanged after repeated search and filter interactions');
 check(inlineDisplays.every(([e,display])=>e.style.display===display),'Original inline visibility survives filter cycles');
 check(!d.querySelector('.popup-enabled-filter-hidden'),'No filter hiding remains after disabling filter');
 const output={passed:checks.length,checks};

 return output;
 })()`});
 assert.ok(result.ok && result.result && result.result.passed >= 47, 'Electron menu checks did not complete');
 console.log(JSON.stringify(result.result,null,2));
 }finally{await stopApp(child);}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
