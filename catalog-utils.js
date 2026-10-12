// Shared catalogue behavior; keeps prices and original product types untouched.
(function(root){
  const categories={
    'bedrock-realms':'Bedrock Realms',
    'java-1-21-1':'Java 1.21.1',
    economy:'Economy',
    merch:'Merch',
    'physical-product':'Physical Product'
  };
  const sorts={'featured':'Featured','price-asc':'Price: Low to High','price-desc':'Price: High to Low','name-asc':'Name: A–Z','name-desc':'Name: Z–A','newest':'Newest'};
  const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en').trim();
  function details(p){return p.details||p.delivery_payload?.product_details||{}}
  function productCategories(p){
    const d=details(p),selected=new Set(Array.isArray(d.store_categories)?d.store_categories.filter(x=>Object.hasOwn(categories,x)):[]);
    // Confirmed server metadata is enough to place a product in its matching world category.
    if(d.server_id==='bedrock-smp')selected.add('bedrock-realms');
    if(d.server_id==='rpg')selected.add('java-1-21-1');
    if(d.server_id==='economy-s6')selected.add('economy');
    return [...selected];
  }
  function filterProducts(products,{category='all',query='',sort='featured'}={}){
    const terms=normalize(query).split(/\s+/).filter(Boolean);
    const shown=products.filter(p=>{
      if(category!=='all'&&p.category!==category&&!productCategories(p).includes(category))return false;
      const haystack=normalize([p.name,p.slug,p.description,p.category,...productCategories(p).map(x=>categories[x])].join(' '));
      return terms.every(term=>haystack.includes(term));
    });
    const name=(a,b)=>String(a.name||'').localeCompare(String(b.name||''),'en',{numeric:true,sensitivity:'base'});
    const price=p=>Number.isFinite(Number(p.price_cents))?Number(p.price_cents):0;
    const comparisons={
      'featured':(a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)),
      'price-asc':(a,b)=>price(a)-price(b)||name(a,b),
      'price-desc':(a,b)=>price(b)-price(a)||name(a,b),
      'name-asc':name,
      'name-desc':(a,b)=>name(b,a),
      'newest':(a,b)=>Number(b.id||0)-Number(a.id||0)
    };
    return shown.sort(comparisons[sort]||comparisons.featured);
  }
  root.AbszCatalog={categories,sorts,productCategories,filterProducts};
})(globalThis);
