import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const config=JSON.parse(read('vercel.json')),html=read('downloads/index.html'),script=read('downloads/downloads.js');
test('official Android and PC downloads remain available',()=>{
 for(const platform of ['android','windows']){
   assert.match(html,new RegExp('href="/downloads/'+platform+'"'));
   const route=config.redirects.find(r=>r.source==='/downloads/'+platform);
   assert.ok(route);assert.match(route.destination,/^https:\/\/cdn\.abszrpg\.shop\/downloads\//);
 }
});
test('technical release files and checksums are not part of public website',()=>{
 for(const base of ['downloads','hero-clash','monster-dungeon','last-haven']){
  for(const filename of ['release.json','SHA256SUMS.txt'])
    assert.equal(existsSync(new URL('../'+base+'/'+filename,import.meta.url)),false,base+'/'+filename);
 }
 assert.equal(existsSync(new URL('../hero-clash/release.js',import.meta.url)),false);
 assert.ok(!config.redirects.some(r=>r.source==='/downloads/checksums'));
 assert.ok(!config.rewrites.some(r=>r.source==='/downloads/aegis-status.json'));
 assert.doesNotMatch(html,/href="\/downloads\/checksums"|verify (its|the) (SHA-256 )?checksum/i);
 assert.doesNotMatch(script,/release\.json|aegis-status\.json|GAME_API|health/);
 assert.doesNotMatch(JSON.stringify(config.headers),/br-summer-cherry-a15duloj-game\.compute/);
});
test('download page preserves navigation, styling and JavaScript',()=>{
 assert.ok(config.rewrites.some(r=>r.source==='/downloads/'));
 assert.ok(config.headers.some(h=>h.source==='/downloads/:path*'&&h.headers.some(v=>v.key==='Content-Security-Policy'&&v.value.includes("object-src 'none'"))));
 assert.match(html,/id="android-download" class="download-action android-action" href="\/downloads\/android"/);
 assert.match(html,/id="windows-download" class="download-action windows-action" href="\/downloads\/windows"/);
 assert.match(read('downloads/downloads.css'),/\.download-action\.windows-action\{[\s\S]*?background:linear-gradient\(125deg,#fff2b7/);
 assert.match(script,/Opening official download/);
});
