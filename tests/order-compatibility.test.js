import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeProductDetails } from '../api/_product-meta.js';

async function createOrder(platform, details) {
  const writes=[];
  const product={id:1,name:'Test Sword',slug:'test-sword',stock:null,price_cents:5000,sale_price_cents:2500,image_data:null,delivery_payload:{commands:['give {player} diamond {quantity}'],...(details?{product_details:details}:{})}};
  const sql=async(strings,...values)=>{
    const query=strings.join('?');
    if(query.includes('SELECT * FROM products'))return [product];
    if(query.includes('INSERT INTO orders')){writes.push({query,values});return [{id:42,order_code:'ABSZ-TEST123',public_token:'test',total_cents:5000}]}
    if(query.includes('INSERT INTO order_items')){writes.push({query,values});return []}
    throw new Error('Unexpected query: '+query);
  };
  let response;
  const context=vm.createContext({sql,normalizeProductDetails,send:(_res,status,data)=>{response={status,data}},fail:(_res,e)=>{throw e},readBody:async req=>req.body,qs:req=>new URL(req.url,'https://example.com').searchParams,randomToken:()=> 'TEST123',getSetting:async key=>key==='store'?{live:true}:{provider:'Touch n Go QR',qr_image:null},audit:async()=>{},discordConfig:async()=>({}),discordRequest:async()=>{},URL,BigInt,console});
  const source=fs.readFileSync(new URL('../api/order.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','async function handler');
  vm.runInContext(source,context);
  await context.handler({method:'POST',url:'/api/order',body:{op:'create',minecraft_name:'Test_Player',platform,product_slug:'test-sword',quantity:2}},{});
  return {response,writes,product};
}
test('unconfigured legacy products still accept either existing edition',async()=>{
  for(const edition of ['JAVA','BEDROCK']){const {response}=await createOrder(edition);assert.equal(response.status,201)}
});
test('unsupported configured editions are rejected before any order write',async()=>{
  const {response,writes}=await createOrder('BEDROCK',{server_id:'rpg',editions:['JAVA']});assert.equal(response.status,400);assert.match(response.data.error,/not configured for Bedrock/);assert.equal(writes.length,0);
});
test('allowed editions preserve sale-price calculation, quantity and fulfillment commands',async()=>{
  const {response,writes,product}=await createOrder('JAVA',{server_id:'rpg',editions:['JAVA']});assert.equal(response.status,201);
  assert.equal(writes[0].values.at(-1),5000);assert.equal(writes[1].values[4],2);assert.equal(writes[1].values[3],2500);assert.deepEqual(JSON.parse(writes[1].values.at(-1)),product.delivery_payload);
});
