import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductDetails, productPayload } from '../api/_product-meta.js';

test('legacy products have no invented compatibility', () => {
  assert.deepEqual(normalizeProductDetails(undefined), {server_id:null,editions:[],duration:'',benefits:[],restrictions:'',screenshots:[],store_categories:[]});
});
test('metadata is bounded, validates editions and accepts only HTTPS screenshots', () => {
  const result=normalizeProductDetails({server_id:'unknown',editions:['JAVA','JAVA','BEDROCK','ADMIN'],duration:' x ',benefits:[' first ',null,...Array(20).fill('x'.repeat(300))],restrictions:'r'.repeat(3000),screenshots:['javascript:alert(1)','http://example.com/a.png','https://user:pass@example.com/a.png','https://example.com/a.png']});
  assert.equal(result.server_id,null);assert.deepEqual(result.editions,['JAVA','BEDROCK']);assert.equal(result.duration,'x');assert.equal(result.benefits.length,12);assert.equal(result.benefits[1].length,200);assert.equal(result.restrictions.length,2000);assert.deepEqual(result.screenshots,['https://example.com/a.png']);
});
test('saving metadata keeps trusted commands and other existing payload fields', () => {
  const previous={commands:['old {player}'],existing_field:{enabled:true},product_details:{server_id:'rpg',editions:['JAVA']}};
  const next=productPayload(previous,['new {player}'],{server_id:'economy-s6',editions:['BEDROCK']});
  assert.deepEqual(next.commands,['new {player}']);assert.deepEqual(next.existing_field,{enabled:true});assert.equal(next.product_details.server_id,'economy-s6');assert.deepEqual(previous.commands,['old {player}']);
});
test('older clients retain metadata when saving without the new fields', () => {
  const details={server_id:'rpg',editions:['JAVA']};assert.deepEqual(productPayload({product_details:details},['give {player}'],undefined).product_details,details);
});
test('store categories validate, deduplicate and survive older metadata editors',()=>{
  assert.deepEqual(normalizeProductDetails({store_categories:['merch','physical-product','merch','invalid']}).store_categories,['merch','physical-product']);
  assert.deepEqual(productPayload({product_details:{store_categories:['economy']}},[],{server_id:'economy-s6'}).product_details.store_categories,['economy']);
  assert.deepEqual(productPayload({product_details:{store_categories:['economy']}},[],{store_categories:[]}).product_details.store_categories,[]);
});
