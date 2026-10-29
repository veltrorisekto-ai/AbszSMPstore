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

test('seven app store pages display real assets, appropriate status and secure download paths',()=>{
 const entries=[
 ['my-hero-clash-with-monsters',true],
 ['absz-dungeon-go',true],
 ['my-monster-and-dungeon',true],
 ['last-haven',true],
 ['please-defend-our-king',false],
 ['community-and-friendship',false],
 ['dungeoncraft-online',false]
 ];
 for(const [slug,live] of entries){
  const page=read('games/app/'+slug+'/index.html');
  assert.match(page,/ABSZ Projects &amp; Studios/);
  assert.equal(page.includes('class="install-button disabled"'),!live);
  if(live){assert.match(page,/Download Android APK/);assert.match(page,/Download Windows PC/)}
  else {assert.match(page,/Browse our other games/);assert.doesNotMatch(page,/Download Android APK/)}
  for(const m of page.matchAll(/(?:src)="(\/(?:assets|last-haven)\/[^"]+)"/g))assert.ok(fs.existsSync(new URL('..'+m[1],import.meta.url)),m[1]);
 }
 const js=read('games/detail-ui.js');assert.match(js,/ArrowRight/);assert.match(js,/touchstart/);
});
test('top charts, original routes and moderated user reviews are wired without fake user scores',async()=>{
 const home=read('games/index.html'),routes=JSON.parse(read('vercel.json')).rewrites;
 assert.match(home,/Top charts/);
 assert.match(home,/ABSZ Picks|Studio picks/);
 const charts=read('games/charts/index.html');
 assert.match(charts,/Community favourites/);
 assert.match(charts,/not a claim of most downloads/);
 for(const slug of ['my-hero-clash-with-monsters','my-monster-and-dungeon','last-haven','please-defend-our-king','community-and-friendship','dungeoncraft-online','absz-dungeon-go']){
  const url='/games/'+slug+'/';
  assert.equal(routes.find(r=>r.source===url)?.destination,'/games/app/'+slug+'/index.html');
  const page=read('games/app/'+slug+'/index.html');
  assert.match(page,/Ratings and reviews/);
  assert.match(page,/data-review-game=/);
  assert.match(page,/script src="\/games\/reviews\.js"/);
 }
 const api=read('api/game-reviews.js');
 assert.match(api,/status='approved'/);
 assert.match(api,/await requireAdmin\(req\)/);
 assert.match(api,/DEFAULT 'pending'/);
 assert.match(api,/websiteSession\(req,false\)/);
 assert.doesNotMatch(home,/55M reviews|500M downloads/);
 assert.ok(fs.existsSync(new URL('../games/moderation/index.html',import.meta.url)));
 for(const p of ['games/store.js','games/detail-ui.js','games/reviews.js','games/charts.js','games/moderate.js']){
  new (await import('node:vm')).Script(read(p),{filename:p});
 }
});
test('every public game URL resolves to ABSZ app-store detail layout rather than old landing page',()=>{
 const cfg=JSON.parse(read('vercel.json'));
 for(const slug of ['my-hero-clash-with-monsters','absz-dungeon-go','my-monster-and-dungeon','last-haven','please-defend-our-king','community-and-friendship','dungeoncraft-online']){
  for(const suffix of ['','/']){
   const route=cfg.rewrites.find(x=>x.source==='/games/'+slug+suffix);
   assert.ok(route,'missing app route: '+slug+suffix);
   assert.equal(route.destination,'/games/app/'+slug+'/index.html');
  }
  const html=read('games/app/'+slug+'/index.html');
  assert.match(html,/Ratings and reviews/);
  assert.match(html,/data-rating-chip/);
  assert.match(html,/data-review-game=/);
  assert.match(html,/\/games\/reviews\.js/);
 }
});
test('download buttons preserve Android and Windows destinations while coming-soon games do not claim installs',()=>{
 const cfg=JSON.parse(read('vercel.json'));
 for(const slug of ['my-hero-clash-with-monsters','absz-dungeon-go','my-monster-and-dungeon','last-haven']){
  const html=read('games/app/'+slug+'/index.html');
  assert.match(html,/Download Android APK/);assert.match(html,/Download Windows PC/);
  assert.match(html,/class="install-row platform-installs"/);
 }
 for(const slug of ['please-defend-our-king','community-and-friendship','dungeoncraft-online']){
  const html=read('games/app/'+slug+'/index.html');
  assert.match(html,/Coming Soon/);assert.doesNotMatch(html,/class="install-button android-install"/);
 }
 for(const source of ['/downloads/android','/downloads/windows','/downloads/monster-dungeon/android','/downloads/monster-dungeon/windows','/downloads/hero-clash/android','/downloads/hero-clash/windows','/downloads/last-haven/android','/downloads/last-haven/windows']){
  assert.ok(cfg.redirects.some(r=>r.source===source),source);
 }
});
test('top charts are curated honestly until real community ratings accumulate',()=>{
 const html=read('games/charts/index.html'),js=read('games/charts.js'),index=read('games/index.html');
 assert.match(index,/Top charts/);assert.match(index,/\/games\/charts\//);
 assert.match(html,/Studio picks/);assert.match(html,/Community favourites/);
 assert.match(html,/not a claim of most downloads/);assert.match(html,/at least 3 approved community reviews/);
 assert.match(js,/Number\(x\.count\)>=3/);
});
test('reviews are submitted by users, moderated by real site admins and not fabricated in markup',async()=>{
 const utils=await import('../api/_game-review-utils.js');
 const valid={game:'my-hero-clash-with-monsters',name:'Player123',rating:5,comment:'I enjoy the friendly adventures.',confirmPlayed:true};
 assert.equal(typeof utils.validateReview(valid),'object');
 assert.equal(typeof utils.validateReview({...valid,game:'community-and-friendship'}),'string');
 assert.equal(typeof utils.validateReview({...valid,rating:7}),'string');
 assert.equal(typeof utils.validateReview({...valid,confirmPlayed:false}),'string');
 const api=read('api/game-reviews.js'),ui=read('games/reviews.js'),admin=read('games/moderate.js');
 assert.match(api,/requireAdmin\(req\)/);assert.match(api,/status='approved'/);
 assert.match(api,/ON CONFLICT\(game_slug,account_key\)/);
 assert.match(api,/CREATE TABLE IF NOT EXISTS absz_game_reviews/);
 assert.match(ui,/fetch\('\/api\/game-reviews/);
 assert.match(admin,/moderate=1/);
 assert.doesNotMatch(read('games/index.html'),/55M reviews|500M downloads/);
});

test('Review API supports both Top Charts endpoints and schema matches initial live table',()=>{
 const api=read('api/game-reviews.js'),utils=read('api/_game-review-utils.js');
 for(const field of ['display_name','body','fingerprint','day_utc'])assert.ok(api.includes(field),field);
 for(const wrong of ['reviewer_name','review_text','ip_hash','submit_day'])assert.ok(!api.includes(wrong),wrong);
 assert.ok(api.includes("params.get('stats')==='1'"));
 assert.ok(api.includes("params.get('summary')==='1'"));
 assert.ok(utils.includes('confirmPlayed'));
});

test('all seven redesigned detail pages follow app-store layout with one real review section',async()=>{
 for(const slug of ['my-hero-clash-with-monsters','absz-dungeon-go','my-monster-and-dungeon','last-haven','please-defend-our-king','community-and-friendship','dungeoncraft-online']){
  const html=read('games/app/'+slug+'/index.html');
  assert.match(html,/ps-detail-header/);assert.match(html,/ps-app-hero/);assert.match(html,/ps-metrics/);
  assert.match(html,/install-row/);
  assert.match(html,/About this game/);assert.match(html,/Similar games/);
  assert.equal((html.match(/id="reviews-title"/g)||[]).length,1,'duplicate review heading '+slug);
  assert.doesNotMatch(html,/data-reviews-game/);
  assert.match(html,/games\/playstore\.css/);
 }
 const home=read('games/index.html');
 assert.match(home,/ps-home-header/);assert.match(home,/ps-feature-app-row/);
 assert.match(home,/Windows PC/);
 const css=read('games/playstore.css');assert.match(css,/background:#fff/);
 const js=read('games/playstore.js');new (await import('node:vm')).Script(js);
});

test('game reviews require signed-in ABSZ account and preserve moderation without anonymous publication',()=>{
const api=read('api/game-reviews.js'),auth=read('api/_website-auth.js'),frontend=read('games/reviews.js');
assert.match(api,/websiteSession\(req,false\)/);assert.match(api,/account_key IS NOT NULL/);assert.match(api,/ON CONFLICT\(game_slug,account_key\)/);
assert.match(auth,/absz_website/);assert.match(auth,/absz_market/);assert.match(auth,/timingSafeEqual/);
assert.match(frontend,/Pending admin approval/);assert.match(frontend,/games\/account\//);
for(const slug of ['my-hero-clash-with-monsters','absz-dungeon-go','my-monster-and-dungeon','last-haven']){const page=read('games/app/'+slug+'/index.html');assert.match(page,/data-review-auth/);assert.match(page,/data-review-form hidden/);assert.doesNotMatch(page,/name="name" autocomplete="nickname"/)}
const cfg=JSON.parse(read('vercel.json'));assert.ok(cfg.rewrites.some(r=>r.source==='/games/account/'&&r.destination==='/games/account/index.html'));
});
test('website account endpoints use HttpOnly cookies and origin-checked forms without disclosing passwords',async()=>{
const api=read('api/web-auth.js'),auth=read('api/_website-auth.js');
assert.match(api,/bcrypt.hash/);assert.match(api,/bcrypt.compare/);assert.match(api,/authRateLimit/);assert.match(api,/requireSameOrigin/);
assert.match(auth,/HttpOnly; Secure; SameSite=Lax/);
for(const js of ['games/account.js','games/reviews.js','games/moderate.js'])new (await import('node:vm')).Script(read(js));
});
