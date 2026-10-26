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
test('the catalogue includes six games, with Dungeon GO and Hero Clash marked available',()=>{
  const html=read('games/index.html');
  for(const name of ['ABSZ Dungeon GO!','My Monster and Dungeon','My Hero Clash With Monster','Please Defend Our King!','Community & Friendship','DungeonCraft Online']) assert.ok(html.includes(name),name);
  assert.equal((html.match(/class="game-card /g)||[]).length,6);
  assert.equal((html.match(/status-live/g)||[]).length,2);
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
 assert.equal(r.applicationId,'shop.absz.heroclash.mobile');assert.equal(r.version,'0.4.1');assert.equal(r.versionCode,7);assert.equal(r.channel,'public_beta');
 const redirect=cfg.redirects.find(x=>x.source==='/downloads/hero-clash/android');assert.equal(redirect.destination,r.apk.url);assert.match(r.apk.sha256,/^[a-f0-9]{64}$/);assert.ok(r.apk.bytes>1000000);assert.equal(read('hero-clash/SHA256SUMS.txt').trim(),r.apk.sha256+'  '+r.apk.filename);
 assert.equal(r.verification.signatureVerified,true);assert.equal(r.verification.debuggable,false);assert.equal(r.verification.playProtectCleared,false);assert.equal(r.verification.physicalDeviceTested,false);assert.deepEqual(r.android.permissions,['android.permission.INTERNET']);assert.equal(r.resources.downloadBytes,74179017);for(const path of ['/games/my-hero-clash-with-monsters','/games/my-hero-clash-with-monsters/'])assert.ok(cfg.headers.some(h=>h.source===path&&h.headers.some(v=>v.key==='Content-Security-Policy')));
});

test('mobile game catalogue keeps six playable links but prevents Hero Clash hero-layout collision',()=>{
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
