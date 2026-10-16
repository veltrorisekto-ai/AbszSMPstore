import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const release=JSON.parse(read('downloads/release.json')),config=JSON.parse(read('vercel.json')),html=read('downloads/index.html');
test('platform buttons resolve to immutable official releases without displaying SHA-256 in cards',()=>{
 for(const [platform,id]of[['android','android'],['windows','windows']]){
  const file=release[platform];assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.ok(file.size>1000000);
  assert.equal(new URL(file.url).protocol,'https:');assert.equal(new URL(file.url).hostname,'cdn.abszrpg.shop');assert.ok(new URL(file.url).pathname.startsWith('/downloads/'+(file.release_path??file.release_version??release.version)+'/'));
  assert.equal(config.redirects.find(r=>r.source==='/downloads/'+platform).destination,file.url);
  assert.ok(html.includes('href="/downloads/'+platform+'"'));
  assert.ok(!html.includes('id="'+id+'-hash"'));
  assert.ok(!html.includes(file.sha256));
 }
 assert.equal((html.match(/class="hash-row"/g)||[]).length,0);
 assert.equal((html.match(/data-copy=/g)||[]).length,0);
});

test('Android-only releases accept unchanged versioned Windows downloads and reject unsafe paths',()=>{
 const context=vm.createContext({document:{getElementById:()=>({})},URL});
 vm.runInContext(read('downloads/downloads.js').split('async function populateRelease()')[0],context);
 const file={size:35522022,sha256:'e'.repeat(64),release_version:'0.9.1',url:'https://cdn.abszrpg.shop/downloads/0.9.1/Absz-Dungeon-GO-v0.9.1-Windows-PC.zip'};
 context.file=file;
 assert.equal(vm.runInContext('isValidFile(file,"0.9.2")',context),true);
 file.release_version='0.9.2';
 assert.equal(vm.runInContext('isValidFile(file,"0.9.2")',context),false);
 file.release_version='../0.9.1';
 assert.equal(vm.runInContext('isValidFile(file,"0.9.2")',context),false);
 file.release_version='0.9.1';file.url='https://example.com/downloads/0.9.1/a.zip';
 assert.equal(vm.runInContext('isValidFile(file,"0.9.2")',context),false);
 file.url='https://cdn.abszrpg.shop/downloads/0.9.2-r4/a.apk';file.release_version='0.9.2';file.release_path='0.9.2-r4';
 assert.equal(vm.runInContext('isValidFile(file,"0.9.2")',context),true);
 for(const invalid of ['0.9.1-r4','0.9.2-r0','../0.9.2-r4']){file.release_path=invalid;assert.equal(vm.runInContext('isValidFile(file,"0.9.2")',context),false);}
 for(const platform of ['android','windows'])assert.ok(html.includes('data-platform-version="'+platform+'"'));
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
