import { strict as assert } from 'node:assert';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'https://www.vividbooks.com/distributor?k=256'});
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document,
  localStorage: dom.window.localStorage, location: dom.window.location,
});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
(globalThis as any).requestAnimationFrame=(fn: FrameRequestCallback)=>setTimeout(fn,0);
(globalThis as any).cancelAnimationFrame=(id:number)=>clearTimeout(id);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
async function main() {
const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router');
const { HelmetProvider } = await import('react-helmet-async');
const { ProductsProvider } = await import('../src/contexts/ProductsContext');
const { DistributorOrderPage } = await import('../src/components/distributor/DistributorOrderPage');
const root = createRoot(document.getElementById('root')!);
const reply = (status: number, json: unknown) => new Response(JSON.stringify(json), {status, headers:{'content-type':'application/json'}});
let productRequests = 0, orderPosts = 0, bundleRequests = 0;
let mode: 'failure'|'success'|'timeout' = 'failure';
(globalThis as any).fetch = async (input: RequestInfo, init?: RequestInit) => {
  const url = String(input);
  if (url.includes('/distributor/orders')) {orderPosts++; throw Error('Objednávkový POST není v testu povolen');}
  if (url.includes('/distributor/access')) return reply(200,{ok:true});
  if (url.includes('/products?')) {
    productRequests++;
    if (mode === 'timeout') return new Promise((_,reject) => {
      init?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
    });
    if (mode === 'failure') return reply(500,{error:'unavailable'});
    return reply(200,{products:[{id:'fixture',name:'Testovací sešit',type:'print',category:'Matematika'}]});
  }
  if (url.includes('/product-bundles?')) {bundleRequests++; return new Promise(()=>{});}
  return reply(200,{});
};
const originalTimer = window.setTimeout.bind(window);
(window as any).setTimeout = (fn: TimerHandler, ms?: number, ...args:any[]) => originalTimer(fn, ms === 12000 ? 10 : ms, ...args);
async function settle(predicate: () => boolean) {
  for(let i=0;i<100;i++) {
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,5))});
    if(predicate()) return;
  }
  throw Error('Timeout čekání na UI: '+document.body.textContent?.slice(0,300));
}
const text=()=>document.getElementById('root')!.textContent || '';
const tree=()=>React.createElement(HelmetProvider,null,
  React.createElement(MemoryRouter,{initialEntries:['/distributor?k=256']},
    React.createElement(ProductsProvider,null,React.createElement(DistributorOrderPage))));
await act(async()=>root.render(tree()));
await settle(()=>text().includes('Katalog se nepodařilo načíst'));
assert(!text().includes('Katalog je momentálně prázdný'));
const retry = [...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Zkusit znovu'))!;
assert(retry);
mode='success';
await act(async()=>retry.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
await settle(()=>text().includes('Objednávka pro distributory') && text().includes('Matematika'));
assert.equal(productRequests,2);
assert.equal(bundleRequests,1,'balíčky lze nechat viset, katalog se přesto zobrazí');
assert.equal(orderPosts,0);
console.log('500 → chyba → opakování → katalog přes visící balíčky; POST 0: OK');
await act(async()=>root.unmount());
// Samostatný test přerušeného katalogového API (hodiny zkráceny jen v testu).
mode='timeout';
const second = createRoot(document.getElementById('root')!);
await act(async()=>second.render(tree()));
await settle(()=>text().includes('Katalog se nepodařilo načíst'));
assert(!text().includes('Katalog je momentálně prázdný'));
assert.equal(orderPosts,0);
console.log('timeout → bezpečná chyba, POST 0: OK');
await act(async()=>second.unmount());
}
main().catch(e=>{console.error(e);process.exitCode=1});
