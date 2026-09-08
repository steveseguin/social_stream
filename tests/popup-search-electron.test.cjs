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
		const result = await requestJson(port, "/exec", {
			windowId: mainWindow.id,
			code: `(async()=>{
 await ensurePopupPanelLoaded();
 const frame=document.getElementById('frame1');
 for(let i=0;i<100;i++){if(frame.contentDocument?.getElementById('searchInput') && frame.contentDocument?.getElementById('docklink')?.href)break;await new Promise(r=>setTimeout(r,200));}
 await new Promise(r=>setTimeout(r,1200));
 const d=frame.contentDocument,w=frame.contentWindow;
 const input=d.getElementById('searchInput');

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
 check(sourcemode.startsWith('file://'),'Local source path normalized to a file URL');
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

 function change(selector,value) {
  const e=d.querySelector(selector);check(!!e,'Control exists: '+selector);
  if(e.type==='checkbox'){if(e.checked!==value)e.click();}
  else {e.value=value;e.dispatchEvent(new w.Event('change',{bubbles:true}));}
 }
 change('[data-setting="excludeAlertsDock"]',true);
 change('[data-param1="transparent"]',true);
 change('[data-textparam1="viewerbarbg"]','#123456');
 await new Promise(r=>setTimeout(r,2500));
 const dock=new URL(d.getElementById('docklink').href),featured=new URL(d.getElementById('overlaylink').href);
 check(dock.pathname.endsWith('/dock.html') && featured.pathname.endsWith('/featured.html'),'Generated links target correct overlay pages');
 check(dock.searchParams.get('session') && dock.searchParams.get('session')===featured.searchParams.get('session'),'Generated links share a nonempty session');
 check(dock.searchParams.has('transparent'),'Checkbox updates generated dock URL');
 check(dock.searchParams.get('viewerbarbg')==='#123456','Text option is encoded correctly in dock URL');
 check(!featured.searchParams.has('viewerbarbg') && !featured.searchParams.has('transparent'),'Dock options do not leak into featured URL');
 const audience=d.getElementById('nc-audience-room');
 check(!!audience,'Audience section is registered in the menu');
 const audienceToggle=d.getElementById('wrapper-audience-room-options');
 check(!!audienceToggle && !!audience.closest('.wrapper.beginner-basic'),'Audience uses the standard beginner accordion');
 for(const query of ['Audience Room','Ninja Chatter','Allow Cheer overlay effect','Ingress API Key']) {
  const results=await search(query);
  const match=results.find(e=>e.textContent.includes('Audience Room'));
  check(!!match,'Audience search finds '+query);
  match.click();
  check(audienceToggle.checked && visible(audience),'Audience result opens its accordion');
  if(query==='Allow Cheer overlay effect') check(audience.querySelector('[data-nc-cheer]').closest('details').open,'Cheer search opens optional controls');
  if(query==='Ingress API Key') check(audience.querySelector('#sscapikey').closest('details').open,'Relay search opens optional controls');
 }
 audienceToggle.checked=false;

 check(audience.querySelector('[data-nc-status]').textContent.includes('Chrome extension'),'Electron explains the audience pilot limitation');
 check([...audience.querySelectorAll('[data-nc-op]')].every(button=>button.disabled),'Unqualified pairing controls stay disabled');
 check(!!audience.querySelector('[data-setting="ssc"]'),'Existing desktop relay remains available');
 const output={passed:checks.length,checks,links:{dock:dock.href,featured:featured.href}};


 return output;
 })()`
		});
		assert.ok(result.ok && result.result && result.result.passed >= 47, "Electron menu checks did not complete");

		console.log("Initial menu checks passed: " + result.result.passed);
		await requestJson(port, '/exec', { windowId: mainWindow.id, code: `(() => {
 const d=document.getElementById('frame1').contentDocument;
 const get=key=>d.getElementById('multi-alert-effect3-'+key);
 get('preset').click();
 if(!get('summary').textContent.includes('exactly $100 USD') || !get('summary').textContent.includes('Thank you!')) throw Error('Alert summary missing preset details');
 get('clear-sound').click();
 if(get('sound').value || get('min').value!=='100') throw Error('Clear sound changed other settings');
 get('reset').click();
 if(get('summary').textContent!=='Not configured' || get('min').value) throw Error('Reset left stale alert settings');
 return true;
})()` });
		console.log('Electron alert summaries, clear sound, and reset passed');
		const soundIntegration = await requestJson(port, '/exec', {windowId: mainWindow.id, code: `(async()=>{
            for(let attempt=0;attempt<100;attempt++){
                const frame=document.getElementById('frame2'), background=frame && frame.contentWindow;
                if(background && background.SSNSoundLibrary && background.flowEditor) return {sounds:background.SSNSoundLibrary.sounds.length,styles:!!frame.contentDocument.querySelector('link[href="./shared/alerts/sound-library.css"]')};
                await new Promise(resolve=>setTimeout(resolve,200));
            }
            throw new Error('Integrated background Event Flow sound picker did not load');
        })()`});
		assert.strictEqual(soundIntegration.result.sounds, 17);
		assert.ok(soundIntegration.result.styles);
		console.log('Integrated Electron Event Flow sound library passed');

		await electronApp.close();
		child = await launch();
		await waitForControl(port, child);
		mainWindow = null;
		for (let i = 0; i < 100; i++) {
			mainWindow = ((await requestJson(port, "/windows")).windows || []).find(w => String(w.url).includes("index.html"));
			if (mainWindow) break;
			await new Promise(r => setTimeout(r, 200));
		}
		const restarted = await requestJson(port, "/exec", {
			windowId: mainWindow.id,
			code: `(async()=>{
 await ensurePopupPanelLoaded();
 const frame=document.getElementById('frame1');
 for(let i=0;i<100;i++){if(frame.contentDocument?.getElementById('docklink')?.href)break;await new Promise(r=>setTimeout(r,200));}
 await new Promise(r=>setTimeout(r,2000));
 const d=frame.contentDocument;
 return {global:d.querySelector('[data-setting="excludeAlertsDock"]').checked,transparent:d.querySelector('[data-param1="transparent"]').checked,text:d.querySelector('[data-textparam1="viewerbarbg"]').value,dock:d.getElementById('docklink').href,featured:d.getElementById('overlaylink').href};
 })()`
		});
		assert.strictEqual(restarted.result.global, true, "Global setting survives restart");
		assert.strictEqual(restarted.result.transparent, true, "Overlay checkbox survives restart");
		assert.strictEqual(restarted.result.text, "#123456", "Text option survives restart");
		assert.strictEqual(restarted.result.dock, result.result.links.dock, "Dock session and parameters survive restart");
		assert.strictEqual(restarted.result.featured, result.result.links.featured, "Featured session and parameters survive restart");
		console.log("Restart persistence checks passed: 5");

		const execMenu = async code => {
			const response = await requestJson(port, "/exec", { windowId: mainWindow.id, code });
			assert.ok(response.ok);
			return response.result;
		};
		for (const theme of ["light", "dark"]) {
			await electronApp
				.windows()
				.find(page => page.url().includes("index.html"))
				.emulateMedia({ colorScheme: theme });
			for (const width of [520, 1280]) {
				await electronApp.evaluate(({ BrowserWindow }, width) => {
					const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes("index.html"));
					win.setSize(width, 850);
				}, width);
				const layout = await execMenu(`(async()=>{
    await new Promise(r=>setTimeout(r,350));
    const f=document.getElementById('frame1'),d=f.contentDocument,w=f.contentWindow;
    const input=d.getElementById('searchInput');input.scrollIntoView();
    const scroll=d.scrollingElement;scroll.scrollTop=scroll.scrollHeight;
    await new Promise(r=>setTimeout(r,350));
    const panel=d.getElementById('nc-audience-room');
    d.getElementById('wrapper-audience-room-options').checked=true;
    const field=panel.querySelector('[data-nc-sources]'),label=panel.querySelector('label[for="nc-publish-sources"]');
    const fr=field.getBoundingClientRect(),lr=label.getBoundingClientRect();
    if(lr.bottom>fr.top || fr.width<100 || fr.right>w.innerWidth) throw Error('Audience field layout failed');
    const style=w.getComputedStyle(field);
    function luminance(color) {
     const channels=color.match(/[0-9.]+/g).slice(0,3).map(v=>{v=Number(v)/255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);});
     return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
    }
    const fg=luminance(style.color),bg=luminance(style.backgroundColor);
    if((Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05)<4.5) throw Error('Audience input contrast failed');
    const header=d.querySelector('label[for="wrapper-audience-room-options"]'),peer=d.querySelector('label[for="wrapper-additional-chat-services-options"]');
    if(w.getComputedStyle(header).backgroundColor!==w.getComputedStyle(peer).backgroundColor) throw Error('Audience header theme differs');
    d.getElementById('wrapper-audience-room-options').checked=false;
    const r=input.getBoundingClientRect();
    return {visible:r.width>100 && r.top>=0 && r.bottom<=w.innerHeight && r.right<=w.innerWidth,dark:w.matchMedia('(prefers-color-scheme: dark)').matches};
   })()`);
				assert.ok(layout.visible, "Search stays on screen after scrolling at " + width + "px in " + theme);
				assert.strictEqual(layout.dark, theme === "dark", "Electron theme reaches menu");
			}
		}
		console.log("Theme/size/scroll checks passed: 8");
		const modes = await execMenu(`(async()=>{
  const f=document.getElementById('frame1'),d=f.contentDocument,w=f.contentWindow,input=d.getElementById('searchInput');
  const escape=()=>input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  async function search(){input.value='Better Twitch TV';input.dispatchEvent(new w.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,350));return [...d.querySelectorAll('.popup-search-result')];}
  for(const beginner of [true,false,true,false]){
   escape();
   // Persist the mode through the real settings path. Changing only the body
   // class is undone by the settings refresh caused by the filter controls.
   await new Promise(resolve=>w.chrome.runtime.sendMessage({cmd:'saveSetting',type:'setting',setting:'beginnerMode',value:beginner},resolve));
   const saved=await new Promise(resolve=>w.chrome.runtime.sendMessage({cmd:'getSettings'},resolve));
   if(saved.beginnerMode!==beginner)throw new Error('Beginner mode was not saved');
   w.update(saved,false);
   d.getElementById('activeIcon').click();
   const rows=await search();
   if(rows.length!==1)throw new Error('Common emote setting missing in mode '+beginner);
   rows[0].click();
   const row=d.querySelector('[data-setting="bttv"]').closest('.options_group > div');
   if(!row.getBoundingClientRect().height)throw new Error('Mode/filter result stays hidden');
   if(d.body.classList.contains('beginner-mode')!==beginner)throw new Error('Mode changed during search');
  }
  return true;
 })()`);
		assert.strictEqual(modes, true);
		console.log("Beginner/full rendering with search/filter checks passed: 4 cycles");
		// Start transport testing without the preceding CDP media emulation.
		await electronApp.close();
		child = await launch();
		await waitForControl(port, child);
		mainWindow = null;
		for (let i = 0; i < 100; i++) {
			mainWindow = ((await requestJson(port, "/windows")).windows || []).find(w => String(w.url).includes("index.html"));
			if (mainWindow) break;
			await new Promise(r => setTimeout(r, 200));
		}

		await electronApp.evaluate(async ({ Menu }) => {
			function find(menu) {
				for (const item of menu.items) {
					if (item.label.startsWith("Enable Local Server")) return item;
					if (item.submenu) {
						const found = find(item.submenu);
						if (found) return found;
					}
				}
			}
			const item = find(Menu.getApplicationMenu());
			if (!item) throw new Error("Local server menu item missing");
			await item.click();
		});
		const delivery = await execMenu(`(async()=>{
  await new Promise(r=>setTimeout(r,2000));
  await ensurePopupPanelLoaded();
  const menu=document.getElementById('frame1');
  for(let i=0;i<100;i++){if(menu.contentDocument?.getElementById('docklink')?.href)break;await new Promise(r=>setTimeout(r,200));}
  const d=menu.contentDocument,w=menu.contentWindow;
  if(!d?.getElementById('docklink')){
   const reply=await new Promise(resolve=>{w.chrome?.runtime?.sendMessage({cmd:'getSettings'},r=>resolve(r));setTimeout(()=>resolve(null),4000);});
   throw new Error('Reloaded menu not ready: '+JSON.stringify({ready:d?.readyState,hydrated:w.popupStartupSettingsHydrated,hasSession:!!w.lastResponse?.streamID,replySession:!!reply?.streamID,replySettings:!!reply?.settings,updateType:typeof w.update,body:!!d?.body}));
  }
  for(let i=0;i<100;i++){if(typeof d.getElementById('server2')?.onchange==='function' && !d.getElementById('disableButtonText').textContent.includes('Loading'))break;await new Promise(r=>setTimeout(r,200));}
  if(typeof d.getElementById('server2')?.onchange!=='function' || d.getElementById('disableButtonText').textContent.includes('Loading'))throw new Error('Menu settings handlers did not finish loading');
  const state=d.getElementById('extensionState');if(state && !state.checked)state.click();
  await new Promise(r=>setTimeout(r,1500));
  const server=d.getElementById('server2');if(!server)throw new Error('Server fallback control missing');if(!server.checked)server.click();
  await new Promise(r=>setTimeout(r,1000));
  if(!server.checked)throw new Error('Server fallback did not remain enabled; detached='+!server.isConnected+' handler='+typeof server.onchange+' status='+d.getElementById('disableButtonText').textContent);
  const dock=new URL(d.getElementById('docklink').href);
  dock.searchParams.set('server2','');dock.searchParams.set('localserver','');dock.searchParams.set('localserverport',${localPort});
  const local=new URL('dock.html',menu.src);local.search=dock.search;
  const frame=document.createElement('iframe');frame.id='regressionDock';frame.style.cssText='position:fixed;left:0;top:0;width:400px;height:500px;z-index:9999';frame.src=local.href;document.body.appendChild(frame);
  await new Promise((resolve,reject)=>{frame.onload=resolve;setTimeout(()=>reject(new Error('Dock load timed out')),15000);});
  for(let i=0;i<3;i++){d.querySelector('[data-action="fakemsg"]').click();await new Promise(r=>setTimeout(r,700));}
  for(let i=0;i<50;i++){if(frame.contentDocument.querySelector('[data-mid]'))break;await new Promise(r=>setTimeout(r,200));}
  const count=frame.contentDocument.querySelectorAll('[data-mid]').length;
  if(!count)throw new Error('Fake test messages did not render in local dock');
  await new Promise(r=>setTimeout(r,2500));
  if(menu.contentDocument!==d || !d.getElementById('docklink'))throw new Error('Menu reloaded unexpectedly during message delivery');
  frame.remove();return {count};
 })()`);
		assert.ok(delivery.count > 0);
		console.log("Real test-message button -> local relay -> dock rendering passed");
		assert.deepStrictEqual(pageErrors, [], "No uncaught JavaScript errors across the app workflows");
	} finally {
		await electronApp.close().catch(() => stopApp(child));
	}
}
run().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
