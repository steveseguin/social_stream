const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.join(__dirname,'..');
test('Updated header is limited to inspiration and its local links resolve',()=>{
    const pages=['index.html',...fs.readdirSync(path.join(root,'docs')).filter(f=>f.endsWith('.html')).map(f=>'docs/'+f)];
    let count=0;
    for(const file of pages){
        const source=fs.readFileSync(path.join(root,file),'utf8');if(!source.includes('<!-- SSN shared header -->'))continue;count++;
        assert.equal((source.match(/id="ssn-site-nav"/g)||[]).length,1,file);
        const shell=source.match(/<!-- SSN shared header -->[\s\S]*?<!-- \/SSN shared header -->/)[0];
        for(const match of shell.matchAll(/(?:href|src)="([^"]+)"/g))assert.ok(fs.existsSync(path.resolve(path.dirname(path.join(root,file)),match[1])),file+': '+match[1]);
    }
    assert.equal(count,1);
    assert.ok(!fs.existsSync(path.join(root,'scripts/build-site-shell.cjs')));
    require('acorn').parse(fs.readFileSync(path.join(root,'docs/js/site-shell.js'),'utf8'),{ecmaVersion:2020});
});
test('Shared menus, persistent themes, gallery previews and documentation controls work together',async()=>{
    const server=http.createServer((req,res)=>{
        let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://fixture').pathname));
        if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
        if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
        if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
    const {chromium}=require('playwright'),browser=await chromium.launch({headless:true});
    try{
        const page=await browser.newPage({colorScheme:'dark'}),errors=[];
        page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>r.abort());
        for(const file of ['docs/inspiration.html']){
            await page.setViewportSize({width:1440,height:900});await page.goto(origin+'/'+file);
            assert.equal(await page.locator('.site-header').evaluate(e=>e.getBoundingClientRect().height),76);
            await page.locator('.site-theme').click();
            const dark=await page.evaluate(()=>document.documentElement.classList.contains('dark-mode'));
            await page.reload();assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark-mode')),dark);
            for(const width of [320,390,768,1280]){
                await page.setViewportSize({width,height:900});
                assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,file+' '+width);
                assert.equal(await page.locator('#ssn-site-nav').isVisible(),false);
                await page.locator('.site-menu').click();assert.equal(await page.locator('#ssn-site-nav').isVisible(),true);
                await page.keyboard.press('Escape');assert.equal(await page.locator('.site-menu').getAttribute('aria-expanded'),'false');
            }
        }
        await page.setViewportSize({width:1440,height:900});await page.goto(origin+'/docs/sticker-gallery.html');
        await page.locator('[data-preview]').first().click();assert.equal(await page.locator('#sticker-preview').isVisible(),true);await page.keyboard.press('Escape');
        await page.goto(origin+'/docs/overlay-gallery.html');await page.locator('#gallery-search').fill('cozy');assert.ok(await page.locator('.gallery-card:visible').count()>0);
        await page.locator('[data-screenshot]').filter({visible:true}).first().click();assert.equal(await page.locator('#gallery-lightbox').isVisible(),true);await page.keyboard.press('Escape');
        for(const file of ['index.html','docs/features.html']) {
            await page.goto(origin+'/'+file);assert.equal(await page.locator('.site-header').count(),0);
            assert.equal(await page.locator('#theme-toggle svg').count(),2);
            const before=await page.evaluate(()=>document.documentElement.classList.contains('dark-mode'));
            await page.locator('#theme-toggle').click();
            assert.notEqual(await page.evaluate(()=>document.documentElement.classList.contains('dark-mode')),before);
            assert.equal(await page.locator('.product-scene,.site-product-shot,.site-download').count(),0);
            for(const width of [1440,390]) {
                await page.setViewportSize({width,height:900});
                await page.screenshot({path:path.join(require('os').tmpdir(),'ssn-design-correction-'+file.replace(/[/.]/g,'-')+'-'+width+'.png'),fullPage:false});
            }
        }
        await page.goto(origin+'/docs/inspiration.html');
        for(const width of [1440,390]) {
            await page.setViewportSize({width,height:900});
            await page.screenshot({path:path.join(require('os').tmpdir(),'ssn-design-correction-inspiration-'+width+'.png'),fullPage:false});
        }
        assert.equal(await page.locator('.site-download').count(),0);
        assert.equal(await page.locator('.site-theme svg').count(),1);
        assert.deepEqual(errors,[]);
    }finally{await browser.close();await new Promise(r=>server.close(r));}
});
