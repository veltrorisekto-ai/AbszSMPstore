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
test('the catalogue includes seven games, with LAST HAVEN and three other games available',()=>{
  const html=read('games/index.html');
  for(const name of ['ABSZ Dungeon GO!','My Monsters and Dungeon','My Hero Clash With Monster','Please Defend Our King!','Community & Friendship','DungeonCraft Online','LAST HAVEN: Zombie Apocalypse']) assert.ok(html.includes(name),name);
  assert.equal((html.match(/class="game-card /g)||[]).length,7);
  assert.equal((html.match(/status-live/g)||[]).length,4);
  assert.match(html,/href="\/downloads\/"/);
});
test('unreleased games have routed detail pages rather than broken download URLs',()=>{
  const html=read('games/index.html'), js=read('games/detail.js'), routes=JSON.parse(read('vercel.json')).rewrites;
  for(const slug of ['my-monster-and-dungeon','please-defend-our-king','community-and-friendship','dungeoncraft-online']){
    assert.ok(html.includes('/games/'+slug+'/'),slug);
    assert.ok(js.includes("'"+slug+"'"),slug);
  }
  assert.ok(routes.some(r=>r.source==='/games/'&&r.destination==='/games/index.html'));
  assert.ok(routes.some(r=>r.source==='/games/:slug/'&&r.destination==='/games/detail.html'));
});
test('Hero Clash has a dedicated download route before the generic coming-soon route',()=>{const routes=JSON.parse(read('vercel.json')).rewrites;const hero=routes.findIndex(r=>r.source==='/games/my-hero-clash-with-monsters/');const generic=routes.findIndex(r=>r.source==='/games/:slug/');assert.ok(hero>=0&&hero<generic);assert.equal(routes[hero].destination,'/hero-clash/index.html');const html=read('hero-clash/index.html');assert.ok(html.includes('/downloads/hero-clash/android'));assert.ok(html.includes('/hero-clash/privacy.html'));assert.ok(html.includes('Physical two-phone testing'));assert.ok(html.includes('Play Protect review has not yet been completed'));});
test('Hero Clash release metadata describes the verified public APK and resource sizes',()=>{
 const r=JSON.parse(read('hero-clash/release.json')), cfg=JSON.parse(read('vercel.json'));
 assert.equal(r.applicationId,'shop.absz.heroclash.mobile');assert.match(r.version,/^[0-9]+[.][0-9]+[.][0-9]+$/);assert.ok(Number.isSafeInteger(r.versionCode)&&r.versionCode>0);assert.equal(r.channel,'public_beta');
 const redirect=cfg.redirects.find(x=>x.source==='/downloads/hero-clash/android');assert.equal(redirect.destination,r.apk.url);assert.match(r.apk.sha256,/^[a-f0-9]{64}$/);assert.ok(r.apk.bytes>1000000);assert.equal(read('hero-clash/SHA256SUMS.txt').trim(),r.apk.sha256+'  '+r.apk.filename);
 assert.equal(r.verification.signatureVerified,true);assert.equal(r.verification.debuggable,false);assert.equal(r.verification.playProtectCleared,false);assert.equal(r.verification.physicalDeviceTested,false);assert.deepEqual(r.android.permissions,['android.permission.INTERNET']);assert.ok(Number.isSafeInteger(r.resources.downloadBytes)&&r.resources.downloadBytes>10000000);for(const path of ['/games/my-hero-clash-with-monsters','/games/my-hero-clash-with-monsters/'])assert.ok(cfg.headers.some(h=>h.source===path&&h.headers.some(v=>v.key==='Content-Security-Policy')));
});

test('mobile game catalogue keeps seven game links but prevents Hero Clash hero-layout collision',()=>{
 const html=read('games/index.html'), css=read('games/games.css'), heroCss=read('hero-clash/style.css');
 assert.match(html,/class="game-card hero-game featured"/);
 assert.doesNotMatch(html,/class="game-card hero featured"/);
 assert.match(css,/\.game-card\.hero-game \.hero-live-art/);
 assert.match(css,/\.hero-game \.card-art/);
 assert.match(css,/\.site-nav\{display:flex;align-self:auto;flex-wrap:nowrap/);
 assert.match(css,/\.site-nav a\.active\{order:-1/);
 assert.match(css,/\.games-grid\{grid-template-columns:1fr/);
 assert.match(css,/\.game-card\{display:block;min-height:0/);
 assert.match(heroCss,/\.hc-page \.nav-cta\{display:none\}/);
 assert.match(heroCss,/\.hc-art\{order:1;flex:0 0 auto;height:clamp\(175px,53vw,255px\)/);
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
 assert.equal(v.redirects.find(x=>x.source==='/downloads/hero-clash/android').destination,JSON.parse(read('hero-clash/release.json')).apk.url);
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
