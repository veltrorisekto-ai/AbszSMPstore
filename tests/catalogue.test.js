import test from 'node:test';import assert from 'node:assert/strict';
import '../catalog-utils.js';
const {filterProducts,productCategories,categories}=globalThis.AbszCatalog;
const products=[
  {id:1,name:'Azure Sword',description:'A crystalline weapon',slug:'azure-sword',category:'weapons',price_cents:2500,featured:true,details:{server_id:'rpg'}},
  {id:2,name:'Economy Coins',description:'Currency bundle',category:'coins',price_cents:1000,details:{server_id:'economy-s6'}},
  {id:3,name:'Bedrock Rank',description:'Build in the realms',category:'ranks',price_cents:5000,details:{server_id:'bedrock-smp'}},
  {id:4,name:'Café Shirt',description:'Cotton merchandise',category:'limited',price_cents:3000,details:{store_categories:['merch','physical-product']}},
  {id:5,name:'Legacy Bundle',description:'Older content',category:'bundles',price_cents:2000}
];
test('all requested categories are available and existing unassigned products remain visible',()=>{
  assert.deepEqual(Object.values(categories),['Bedrock Realms','Java 1.21.1','Economy','Merch','Physical Product']);assert.equal(filterProducts(products).length,5);assert.deepEqual(productCategories(products[4]),[]);
});
test('search is case-insensitive, handles accents and combines name/description keywords',()=>{
  assert.equal(filterProducts(products,{query:'AZURE crystalline'})[0].id,1);assert.equal(filterProducts(products,{query:'cafe'})[0].id,4);assert.equal(filterProducts(products,{query:'economy'}).length,1);assert.equal(filterProducts(products,{query:'missing item'}).length,0);
});
test('world collections use confirmed server metadata and manual collection assignments',()=>{
  for(const [category,id] of [['java-1-21-1',1],['economy',2],['bedrock-realms',3],['merch',4],['physical-product',4]])assert.deepEqual(filterProducts(products,{category}).map(p=>p.id),[id]);
  assert.equal(filterProducts(products,{category:'weapons'}).length,1);assert.equal(filterProducts(products,{category:'merch',query:'azure'}).length,0);
});
test('price, name and newest sorts use effective prices without mutating source data',()=>{
  const before=products.map(p=>p.id);assert.deepEqual(filterProducts(products,{sort:'price-asc'}).map(p=>p.id),[2,5,1,4,3]);assert.deepEqual(filterProducts(products,{sort:'price-desc'}).map(p=>p.id),[3,4,1,5,2]);assert.equal(filterProducts(products,{sort:'newest'})[0].id,5);assert.equal(filterProducts(products,{sort:'name-asc'})[0].id,1);assert.equal(filterProducts(products,{sort:'name-desc'})[0].id,5);assert.deepEqual(products.map(p=>p.id),before);
});
