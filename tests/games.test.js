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
test('the catalogue includes six games, with only Dungeon GO marked available',()=>{
  const html=read('games/index.html');
  for(const name of ['ABSZ Dungeon GO!','My Monster and Dungeon','My Hero Clash With Monsters','Please Defend Our King!','Community & Friendship','DungeonCraft Online']) assert.ok(html.includes(name),name);
  assert.equal((html.match(/class="game-card /g)||[]).length,6);
  assert.equal((html.match(/status-live/g)||[]).length,1);
  assert.match(html,/href="\/downloads\/"/);
});
test('unreleased games have routed detail pages rather than broken download URLs',()=>{
  const html=read('games/index.html'), js=read('games/detail.js'), routes=JSON.parse(read('vercel.json')).rewrites;
  for(const slug of ['my-monster-and-dungeon','my-hero-clash-with-monsters','please-defend-our-king','community-and-friendship','dungeoncraft-online']){
    assert.ok(html.includes('/games/'+slug+'/'),slug);
    assert.ok(js.includes("'"+slug+"'"),slug);
  }
  assert.ok(routes.some(r=>r.source==='/games/'&&r.destination==='/games/index.html'));
  assert.ok(routes.some(r=>r.source==='/games/:slug/'&&r.destination==='/games/detail.html'));
});