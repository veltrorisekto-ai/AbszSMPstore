import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('admin-only endpoint does not expose storage settings to anonymous requests',()=>{
 const src=read('api/hero-video.js');
 assert.match(src,/if \(req\.method === 'GET'\) \{\s*await requireAdmin\(req\)/);
});
test('owner mutations have an origin boundary, and recovery links use the official domain',()=>{
 const src=read('api/admin.js');
 assert.match(src,/req\.headers\['sec-fetch-site'\] === 'cross-site'/);
 assert.match(src,/origin !== 'https:\/\/' \+ req\.headers\.host/);
 assert.match(src,/const base = 'https:\/\/abszrpg\.shop'/);
});
test('public store metadata excludes internal video storage attributes',()=>{
 const src=read('api/store.js');
 const start=src.indexOf('return {',src.indexOf('async function playableHeroVideo'));
 const end=src.indexOf('\n}',start);
 const block=src.slice(start,end);
 assert.doesNotMatch(block,/file_name|source|pathname|upload_mode/);
});
test('Discord interactions require a fresh signed timestamp',()=>{
 assert.match(read('api/discord.js'),/Math\.abs\(Date\.now\(\) \/ 1000 - timestamp\) > 300/);
});
test('CI does not upload source artifacts',()=>{
 assert.doesNotMatch(read('.github/workflows/ci.yml'),/upload-artifact|AbszSMP-online-source/);
 assert.match(read('.github/workflows/ci.yml'),/security-audit\.mjs/);
});
