import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../',import.meta.url);
const read = path => fs.readFileSync(new URL('../'+path, import.meta.url),'utf8');
test('home download links now lead to our games without breaking Dungeon GO downloads', () => {
  const home=read('index.html'), app=read('app.js'), downloads=read('downloads/index.html');
  assert.match(home,/href="\/games\/">Our Games<\/a>/);
  assert.match(app,/href="\/games\/">Explore Games/);
  assert.match(downloads,/href="\/downloads\/android"/);
  assert.match(downloads,/href="\/downloads\/windows"/);
  assert.match(downloads,/href="\/games\/">All Games/);
});
test('ABSZ Game Store displays seven real titles with official detail routes and 4 live releases',()=>{
 const html=read('games/index.html');
 for(const name of ['ABSZ Dungeon GO!','My Monsters and Dungeon','My Hero Clash With Monster','Please Defend Our King!','Community & Friendship','DungeonCraft Online','LAST HAVEN: Zombie Apocalypse'])assert.ok(html.includes(name.replace(/&/g,'&amp;')),name);
 assert.equal((html.match(/class="store-game-row"/g)||[]).length,14);
 assert.equal((html.match(/data-status="available"/g)||[]).length,12);
 for(const tab of ['games','apps','search','books','you'])assert.ok(html.includes('data-screen="'+tab+'"'));
 assert.match(html,/Featured games — swipe to browse/);
 assert.match(html,/data-category="soon"/);
});
test('seven app-style detail pages are routed without disturbing the original download pages',()=>{
 const cfg=JSON.parse(read('vercel.json'));
 for(const slug of ['my-hero-clash-with-monsters','absz-dungeon-go','my-monster-and-dungeon','last-haven','please-defend-our-king','community-and-friendship','dungeoncraft-online']){
 const url='/games/app/'+slug+'/';
 assert.ok(cfg.rewrites.some(x=>x.source===url && x.destination===url+'index.html'),slug);
 const page=read('games/app/'+slug+'/index.html');
 assert.match(page,/About this game/);assert.match(page,/Screenshots &amp; previews/);
 assert.match(page,/bottom-tabs/);
 assert.ok(page.includes('href="'+url.replace('/games/app/'+slug+'/','/games/')+'?tab=games"') || page.includes('href="/games/?tab=games"'));
 }
 for(const link of ['/games/my-hero-clash-with-monsters/','/games/my-monster-and-dungeon/','/games/last-haven/']) assert.ok(cfg.rewrites.some(r=>r.source===link));
 assert.ok(cfg.rewrites.some(r=>r.source==='/downloads/'));
});
test('Hero Clash has its Play-Store-style game page while the download page remains accessible',()=>{
 const routes=JSON.parse(read('vercel.json')).rewrites;
 const app=routes.find(r=>r.source==='/games/my-hero-clash-with-monsters/');
 const download=routes.find(r=>r.source==='/play/my-hero-clash-with-monsters/');
 assert.equal(app.destination,'/games/app/my-hero-clash-with-monsters/index.html');
 assert.equal(download.destination,'/hero-clash/index.html');
 const detail=read('games/app/my-hero-clash-with-monsters/index.html');
 assert.match(detail,/href="\/play\/my-hero-clash-with-monsters\/"/);
 const html=read('hero-clash/index.html');
 assert.ok(html.includes('/downloads/hero-clash/android'));
 assert.ok(html.includes('/hero-clash/privacy.html'));
 assert.ok(!html.includes('Physical two-phone testing'));
 assert.ok(html.includes('Play Protect review has not yet been completed'));
});
test('Hero Clash has no public technical metadata or checksums',()=>{
 const cfg=JSON.parse(read('vercel.json')),page=read('hero-clash/index.html');
 assert.ok(cfg.redirects.some(x=>x.source==='/downloads/hero-clash/android'&&x.destination.endsWith('.apk')));
 assert.ok(!page.includes('APK checksum'));
 assert.ok(!page.includes('/hero-clash/release.js'));
 assert.ok(!fs.existsSync(new URL('../hero-clash/release.json',import.meta.url)));
 for(const path of ['/games/my-hero-clash-with-monsters','/games/my-hero-clash-with-monsters/'])
  assert.ok(cfg.headers.some(h=>h.source===path&&h.headers.some(v=>v.key==='Content-Security-Policy')));
});

test('store layout is responsive with bottom navigation, swipeable art and explicit no-fake-rating policy',()=>{
 const html=read('games/index.html'),css=read('games/store.css'),script=read('games/store.js');
 assert.match(html,/data-tab-link="games"/);assert.match(html,/data-tab-link="apps"/);assert.match(html,/data-tab-link="search"/);assert.match(html,/data-tab-link="books"/);assert.match(html,/data-tab-link="you"/);
 assert.match(css,/position:fixed;bottom:0/);assert.match(css,/scroll-snap-type:x mandatory/);
 assert.match(script,/popstate/);assert.match(script,/data-category/);assert.match(script,/search-results/);
 assert.doesNotMatch(html,/55M reviews|500M|Top grossing|4\.5 stars/);
});
test('real screenshots form a swipable and keyboard-accessible gallery without changing the Android installer',async()=>{
 const page=read('hero-clash/index.html'), script=read('hero-clash/gallery.js'), css=read('hero-clash/style.css'), v=JSON.parse(read('vercel.json'));
 assert.match(page,/id="gameplay"/);
 assert.match(page,/id="hc-gallery-rail"/);
 assert.match(page,/id="hc-gallery-dialog"/);
 assert.match(page,/View real gameplay/);
 assert.equal((page.match(/class="hc-gallery-slide"/g)||[]).length,19);
 assert.equal((page.match(/class="hc-gallery-thumb"/g)||[]).length,19);
 assert.ok(page.includes('/downloads/hero-clash/android'));
 assert.match(v.redirects.find(x=>x.source==='/downloads/hero-clash/android').destination,/^https:\/\/hero-cdn\.abszsmp\.my\.id\/releases\/android\/.*\.apk$/);
 assert.match(css,/scroll-snap-type:x mandatory/);
 assert.match(script,/touchstart/);
 assert.match(script,/ArrowLeft/);
 new (await import('node:vm')).Script(script);
 for(const x of page.matchAll(/src="(\/assets\/hero-clash\/gameplay\/[^"]+\.webp)"/g)) {
   assert.ok((await import('node:fs')).existsSync(new URL('..'+x[1],import.meta.url)),x[1]);
 }
});

test('new players see the 19-shot interactive real gameplay carousel first, before promo and download',()=>{
 const page=read('hero-clash/index.html'), style=read('hero-clash/style.css');
 const navbar=page.indexOf('</header>');
 const gallery=page.indexOf('id="gameplay"');
 const hero=page.indexOf('class="hc-hero shell"');
 const download=page.indexOf('id="apk-download"');
 const tips=page.indexOf('class="hc-first-launch"');
 assert.ok(navbar>=0&&navbar<gallery&&gallery<hero&&hero<download&&download<tips);
 assert.equal((page.match(/id="gameplay"/g)||[]).length,1);
 assert.equal((page.match(/class="hc-gallery-slide"/g)||[]).length,19);
 assert.equal((page.match(/class="hc-gallery-thumb"/g)||[]).length,19);
 assert.match(page,/class="hc-gallery-download" href="#download"/);
 assert.match(style,/\.hc-page main > \.hc-gameplay/);
 assert.match(style,/grid-template-areas:"download" "aside"/);
 assert.ok(page.includes('href="/downloads/hero-clash/android"'));
});

test('desktop real gameplay gallery fills the page instead of starting with a huge empty left gutter',()=>{
 const css=read('hero-clash/style.css'),html=read('hero-clash/index.html');
 assert.match(css,/@media \(min-width:761px\)/);
 assert.match(css,/\.hc-gameplay \.hc-gallery-rail\{[\s\S]*?padding:14px 0 20px;[\s\S]*?scroll-padding-inline:0/);
 assert.match(css,/\.hc-gameplay \.hc-gallery-slide\{[\s\S]*?flex:0 0 calc\(\(100% - 32px\)\/3\)/);
 assert.match(css,/@media \(min-width:1200px\)\{[\s\S]*?flex-basis:calc\(\(100% - 48px\)\/4\)/);
 assert.match(css,/@media\(max-width:760px\)[\s\S]*?\.hc-gallery-rail\{gap:11px;padding:10px 11vw 14px/);
 assert.equal((html.match(/class="hc-gallery-slide"/g)||[]).length,19);
 assert.match(html,/href="\/downloads\/hero-clash\/android"/);
});

test('Festival Time and Your Hero Skills exchange positions, images, categories and thumbnails',()=>{
 const html=read('hero-clash/index.html');
 const slides=[...html.matchAll(/<article class="hc-gallery-slide"[^>]*>[\s\S]*?<\/article>/g)].map(m=>m[0]);
 const thumbs=[...html.matchAll(/<button type="button" class="hc-gallery-thumb" data-thumb="\d+"[^>]*>[\s\S]*?<\/button>/g)].map(m=>m[0]);
 assert.equal(slides.length,19);
 assert.equal(thumbs.length,19);
 for(const [index,name,file,category] of [
   [2,'Your Hero Skills','forest-skills.webp','Combat'],
   [5,'Festival Time','town-festival.webp','Town']
 ]){
  assert.ok(slides[index].includes('<h3>'+name+'</h3>'));
  assert.ok(slides[index].includes(file));
  assert.ok(slides[index].includes('data-category="'+category+'"'));
  assert.ok(slides[index].includes('data-index="'+index+'"'));
  assert.ok(slides[index].includes('data-open="'+index+'"'));
  assert.ok(thumbs[index].includes(name));
  assert.ok(thumbs[index].includes(file));
  assert.ok(thumbs[index].includes('data-thumb="'+index+'"'));
 }
});

test('Hero Clash Android APK button is green and Windows PC button is gold with unchanged official URLs',()=>{
 const page=read('hero-clash/index.html'),css=read('hero-clash/style.css');
 assert.match(page,/class="hc-button hc-download-button hc-platform-download hc-apk-download" id="apk-download" href="\/downloads\/hero-clash\/android"/);
 assert.match(page,/class="hc-button hc-download-button hc-platform-download hc-pc-download" id="pc-download" href="https:\/\/hero-cdn\.abszsmp\.my\.id\/releases\/windows\/\d+\.\d+\.\d+\/My-Hero-Clash-With-Monster-Windows\.zip"/);
 assert.equal((page.match(/id="apk-size"/g)||[]).length,1);
 assert.match(css,/\.hc-page #apk-download,\s*\.hc-page #pc-download/);
 assert.match(css,/#pc-download \{[\s\S]*?background:linear-gradient\(125deg,#fff3b7/);
 assert.match(css,/#apk-download,\s*\.hc-page #pc-download \{[\s\S]*?background:linear-gradient\(125deg,#a2ffd0/);
});

test('LAST HAVEN public page has basic player guidance without revealing implementation details',()=>{
 const page=read('last-haven/index.html');
 for(const route of ['/downloads/last-haven/android','/downloads/last-haven/windows'])assert.ok(page.includes('href="'+route+'"'));
 for(const wording of ['What kind of game is LAST HAVEN?','Can I play with friends?','Which devices are supported?','Where can I find updates or get help?'])assert.ok(page.includes(wording));
 for(const privateDetail of [/device identity/i,/signed update information/i,/server and linked/i,/public matchmaking creates/i,/full matches use separate maps/i,/LAST-HAVEN\.exe/i,/Update &amp; Play/i,/physical Android and Windows gameplay testing/i])assert.doesNotMatch(page,privateDetail);
 assert.equal((page.match(/class="lh-platform /g)||[]).length,2);
});

test('My Monsters and Dungeon public page hides technical release links while preserving both downloads',()=>{
 const page=read('monster-dungeon/index.html');
 assert.doesNotMatch(page,/Download checksums|Release details/);
 assert.doesNotMatch(page,/href="\/monster-dungeon\/(?:SHA256SUMS\.txt|release\.json)"/);
 assert.doesNotMatch(page,/System WebView|WebGL-capable|dedicated Edge app window|Game assets load online/);
 assert.match(page,/href="\/downloads\/monster-dungeon\/android"/);
 assert.match(page,/href="\/downloads\/monster-dungeon\/windows"/);
 assert.doesNotMatch(page,/READ-ME-FIRST|mmd-api\.abszsmp\.online/);
});

test('app-style game pages only use actual available assets and keep install buttons truthful',()=>{
 const entries=[
 ['my-hero-clash-with-monsters','/play/my-hero-clash-with-monsters/',true],
 ['absz-dungeon-go','/downloads/',true],
 ['my-monster-and-dungeon','/play/my-monster-and-dungeon/',true],
 ['last-haven','/play/last-haven/',true],
 ['please-defend-our-king','/games/please-defend-our-king/',false],
 ['community-and-friendship','/games/community-and-friendship/',false],
 ['dungeoncraft-online','/games/dungeoncraft-online/',false]
 ];
 for(const [slug,url,live] of entries){
 const page=read('games/app/'+slug+'/index.html');
 assert.match(page,/ABSZ Projects &amp; Studios/);
 assert.ok(page.includes('href="'+url+'"'),slug);
 assert.equal(page.includes('class="install-button disabled"'),!live);
 for(const m of page.matchAll(/(?:src)="(\/(?:assets|last-haven)\/[^"]+)"/g))assert.ok(fs.existsSync(new URL('..'+m[1],import.meta.url)),m[1]);
 }
 const js=read('games/detail-ui.js');assert.match(js,/ArrowRight/);assert.match(js,/touchstart/);
});

test('Top Charts, original game routes, review moderation and database safety are wired',async()=>{
 const home=read('games/index.html'),script=read('games/store.js'),api=read('api/game-reviews.js');
 const routes=JSON.parse(read('vercel.json')).rewrites;
 assert.match(home,/Top charts/);
 assert.match(home,/ABSZ Picks/);
 assert.match(home,/Most reviewed/);
 assert.match(script,/chartScores/);
 for(const slug of ['my-hero-clash-with-monsters','my-monster-and-dungeon','last-haven','please-defend-our-king','community-and-friendship','dungeoncraft-online','absz-dungeon-go']){
  const url='/games/'+slug+'/';
  assert.equal(routes.find(r=>r.source===url)?.destination,'/games/app/'+slug+'/index.html');
  const page=read('games/app/'+slug+'/index.html');
  assert.match(page,/Ratings &amp; reviews/);
  assert.match(page,/data-reviews-game=/);
  assert.match(page,/script src="\/games\/reviews-ui\.js"/);
 }
 for(const slug of ['my-hero-clash-with-monsters','my-monster-and-dungeon','last-haven'])
  assert.ok(routes.find(r=>r.source==='/play/'+slug+'/'));
 assert.match(api,/status='approved'/);
 assert.match(api,/await requireAdmin\(req\)/);
 assert.match(api,/status:'pending'/);
 assert.match(api,/fingerprint/);
 assert.doesNotMatch(home,/55M reviews|500M downloads/);
 assert.ok(fs.existsSync(new URL('../games/review-moderation/index.html',import.meta.url)));
 for(const p of ['games/store.js','games/detail-ui.js','games/reviews-ui.js','games/review-moderation/moderate.js']){
  new (await import('node:vm')).Script(read(p),{filename:p});
 }
});
