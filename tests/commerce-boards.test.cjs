const {test} = require('node:test');
const assert = require('node:assert/strict');
const B = require('../shared/monetization/boards.js');
const router = require('../js/streamdeck-remote-control.js');
test('120 spots support claims, reveals and corrections without recording sales', () => {
 const initial = B.apply({}, 'boardSave', {count:120,columns:20});
 const claimed = B.apply(initial, 'boardSpot', {id:'120',status:'claimed',result:'hidden item'});
 assert.equal(claimed.board.spots[119].status,'claimed'); assert.equal(initial.board.spots[119].status,'available');
 assert.equal(claimed.board.spots[119].result,'');
 const reveal = B.apply(claimed,'boardSpot',{id:'120',status:'revealed',result:'Card #25'});
 assert.equal(reveal.board.spots[119].result,'Card #25'); assert.equal(reveal.sales.length,0);
 assert.equal(B.apply(reveal,'boardSpot',{id:'120',status:'available'}).board.spots[119].result,'');
 assert.throws(()=>B.apply(initial,'boardSpot',{id:'121',status:'claimed'}));
 assert.throws(()=>B.apply(initial,'boardSave',{count:121,columns:20}));
 assert.throws(()=>B.apply(initial,'boardSave',{labels:Array(121).fill('Team').join('\n'),columns:6}));
 assert.equal(B.apply({},'boardSave',{labels:'Boston\nToronto',columns:2,style:'teams'}).board.spots.length,2);
});
test('sales require opt-in purchases; bids, gifts, tests and unrelated platforms never count', () => {
 const on = B.apply({},'salesSettings',{automatic:true,visible:true});
 const event = {type:'shopify',event:'purchase',id:'order1',subtitle:'Signed card',chatname:'private buyer',hasDonation:'$900',meta:{commerce:{quantity:2}}};
 assert.equal(B.purchase({},event),null);
 for (const eventKind of ['auction_update','auction_won','donation','gift','new_subscriber']) assert.equal(B.purchase(on,{...event,event:eventKind}),null);
 for (const flags of [{private:true},{isTest:true},{testMode:true},{type:'whatnot'},{type:'ebay',chatname:'eBay Sandbox buyer'},{id:null}]) assert.equal(B.purchase(on,{...event,...flags}),null);
 const recorded = B.purchase(on,event,1000); assert.equal(recorded.sales[0].amount,null); assert.equal(recorded.sales[0].quantity,2);
 assert(!JSON.stringify(B.publicState(recorded)).includes('private buyer')); assert(!('seen' in B.publicState(recorded)));
 assert.equal(B.purchase(recorded,event),null);
 assert.equal(B.purchase(B.apply(recorded,'salesClear',{}),event),null);
 assert.equal(B.purchase(B.normalize(JSON.parse(JSON.stringify(recorded))),event),null);
});
test('manual sales validate prices, retain currency, and support removal', () => {
 let s = B.apply({},'saleAdd',{title:'Jersey',amount:30,currency:'CAD'},1);
 assert.equal(s.sales[0].amount,30); assert.equal(s.sales[0].source,'Host confirmed');
 assert.throws(()=>B.apply(s,'saleAdd',{title:'Jersey',amount:-1,currency:'USD'}));
 assert.throws(()=>B.apply(s,'saleAdd',{title:'Jersey',amount:30,currency:'$'}));
 assert.equal(B.apply(s,'saleAdd',{title:'No price',amount:''},2).sales[0].amount,null);
 assert.equal(B.apply(s,'saleRemove',{id:s.sales[0].id}).sales.length,0);
 for(let i=0;i<120;i++) s=B.apply(s,'saleAdd',{title:'Item '+i},i+10);
 assert.equal(s.sales.length,100);
});
test('remote board commands use the same commerce API without altering product controls', () => {
const result=router.commerceRequest({action:'commerceControl',value:{command:'boardSpot',data:{id:'2',status:'claimed'}}});
 assert.equal(result.ok,true); assert.equal(result.data.id,'2');
 assert.equal(router.commerceRequest({action:'commerceControl',value:{command:'boardSpot',data:[]}}).ok,false);
 assert.equal(router.commerceRequest({action:'commerceControl',value:{command:'saleAdd',data:{title:'x'.repeat(17000)}}}).ok,false);
 assert.equal(router.commerceRequest({action:'commerceNext'}).command,'next');
});
test('linked sale claims once, preserves reveals, and refund reopens only its original board', () => {
 let s=B.apply({},'boardSave',{count:3,columns:3},1), boardId=s.board.id;
 const data={title:'Spot 2',boardId,spotId:'2',amount:35,currency:'CAD'};
 s=B.apply(s,'saleAdd',data,2);assert.equal(s.board.spots[1].status,'claimed');
 assert.throws(()=>B.apply(s,'saleAdd',data,3),/already/);
 const publicSale=B.publicState(s).sales[0];assert(!('spotId' in publicSale));assert(!('boardId' in publicSale));
 s=B.apply(s,'boardSpot',{id:'2',status:'revealed',result:'Card'},4);
 const oldSale=s.sales[0].id;
 const refund=B.apply(s,'saleRemove',{id:oldSale,reopenSpot:true},5);
 assert.equal(refund.sales.length,0);assert.equal(refund.board.spots[1].status,'available');assert.equal(refund.board.spots[1].result,'');
 s=B.apply(s,'boardSave',{count:3,columns:3},6);s=B.apply(s,'boardSpot',{id:'2',status:'claimed'},7);
 s=B.apply(s,'saleRemove',{id:oldSale,reopenSpot:true},8);assert.equal(s.board.spots[1].status,'claimed');
 assert.throws(()=>B.apply(s,'saleAdd',data,9),/board changed/);
});
test('source auction snapshots stay drafts, omit bidder identity, and retain eBay purchase quantity', () => {
 for(const type of ['whatnot','ebay']) {
  const event={type,event:'auction_update',meta:{title:'Fixture card',status:'sold',price:42,priceText:'$42',bidder:'Private buyer',winnerName:'Private buyer'}};
  const draft=B.auction(event,100);assert.equal(draft.title,'Fixture card');assert(!JSON.stringify(draft).includes('Private buyer'));assert.equal(draft.amount,undefined);
  assert.equal(B.purchase({automatic:true},event),null);
  for(const flag of ['private','isTest','testMode','history','replay'])assert.equal(B.auction({...event,[flag]:true}),null);
 }
 assert.equal(B.auction({type:'twitch',event:'auction_update',meta:{title:'Other'}}),null);
 const s=B.purchase({automatic:true},{type:'ebay',event:'purchase',id:'order-quantity',meta:{ebayPurchase:{itemName:'Packs',quantity:3}}});
 assert.equal(s.sales[0].quantity,3);assert.equal(s.sales[0].amount,null);
});
