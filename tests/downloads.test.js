import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const release=JSON.parse(read('downloads/release.json')),config=JSON.parse(read('vercel.json')),html=read('downloads/index.html');
test('platform buttons resolve to immutable official releases without displaying SHA-256 in cards',()=>{
 for(const [platform,id]of[['android','android'],['windows','windows']]){
  const file=release[platform];assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.ok(file.size>1000000);
  assert.equal(new URL(file.url).protocol,'https:');assert.ok(file.url.includes('/game-content/downloads/'+release.version+'/'));
  assert.equal(config.redirects.find(r=>r.source==='/downloads/'+platform).destination,file.url);
  assert.ok(html.includes('href="/downloads/'+platform+'"'));
  assert.ok(!html.includes('id="'+id+'-hash"'));
  assert.ok(!html.includes(file.sha256));
 }
 assert.equal((html.match(/class="hash-row"/g)||[]).length,0);
 assert.equal((html.match(/data-copy=/g)||[]).length,0);
});
test('download page keeps existing routes, scopes security headers and bundles every static asset',()=>{
 for(const route of ['/hosting','/join','/store','/admin'])assert.ok(config.rewrites.some(r=>r.source===route));
 assert.ok(config.rewrites.some(r=>r.source==='/downloads/'));
 assert.ok(config.headers.some(h=>h.source==='/downloads/:path*'&&h.headers.some(v=>v.key==='Content-Security-Policy'&&v.value.includes("object-src 'none'"))));
 for(const match of html.matchAll(/(?:src|href)="(\/assets\/dungeon\/[^"#]+|\/downloads\/downloads\.(?:css|js))"/g))assert.ok(existsSync(new URL('..'+match[1],import.meta.url)),match[1]);
 assert.ok(!JSON.stringify(release).includes('Source.zip'));assert.ok(!html.includes('release-signing-key'));
});

test('downloads page uses English for visible labels, instructions, metadata and status feedback',()=>{
 const script=read('downloads/downloads.js');
 assert.match(html,/<html lang="en">/);
 for(const phrase of ['Download APK','Download ZIP','Installation Guide','Frequently Asked Questions','Need help?','Found a Bug?','CONCEPT ART · NOT GAMEPLAY']){
  assert.ok(html.includes(phrase),phrase);
 }
 for(const phrase of ['Unverified','Checking API…'])assert.ok(html.includes(phrase),phrase);
 for(const phrase of ['Game API reachable','Game API unreachable','Opening official download…','Close navigation']){
  assert.ok(script.includes(phrase),phrase);
 }
 const malay=/\b(?:Muat Turun|Panduan Pemasangan|Soalan Lazim|Belum disahkan|Menyemak API|Sertai Discord kami|Kandungan Sentiasa Baharu|Tutup navigasi|Buka navigasi)\b/i;
 assert.ok(!malay.test(html));
 assert.ok(!malay.test(script));
});
