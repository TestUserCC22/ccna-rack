/* CCNA Rack service worker: the app shell is cached so everything works offline. */
const VERSION="ccna-rack-v1.0.0";
const SHELL=["./","index.html","app.js","bank.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION&&k!=="ccna-rack-fonts").map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("message",e=>{if(e.data==="skip")self.skipWaiting()});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.hostname==="fonts.googleapis.com"||url.hostname==="fonts.gstatic.com"){
    e.respondWith(caches.open("ccna-rack-fonts").then(c=>c.match(req).then(hit=>{const net=fetch(req).then(r=>{if(r.ok||r.type==="opaque")c.put(req,r.clone());return r}).catch(()=>hit);return hit||net})));
    return;
  }
  if(url.origin!==location.origin)return;
  if(req.mode==="navigate"){e.respondWith(caches.match("index.html").then(hit=>hit||fetch(req)));return}
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>hit||fetch(req)));
});
