const http = require('http');
function getJson(url){ return new Promise((ok,no)=>http.get(url,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>ok(JSON.parse(d)));r.on('error',no)}).on('error',no)); }
(async()=>{
 const pages=await getJson('http://127.0.0.1:9300/json');
 const page=pages.find(p=>p.title==='Miss Chulerías - POS');
 if(!page) throw new Error('No se encontró la PWA');
 const ws=new WebSocket(page.webSocketDebuggerUrl);
 let seq=0; const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}};
 await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no});
 const call=(method,params={})=>new Promise(ok=>{const id=++seq;pending.set(id,ok);ws.send(JSON.stringify({id,method,params}))});
 await call('Runtime.enable');
 const expression=`(async()=>{const out={url:location.href,online:navigator.onLine,ua:navigator.userAgent,localStorage:{...localStorage},dbs:{}};const dbs=await indexedDB.databases();for(const d of dbs){const db=await new Promise((ok,no)=>{const r=indexedDB.open(d.name);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});out.dbs[d.name]={stores:[...db.objectStoreNames]};for(const s of db.objectStoreNames){out.dbs[d.name][s]=await new Promise((ok,no)=>{const tx=db.transaction(s,'readonly');const r=tx.objectStore(s).getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}}return out})()`;
 const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 console.log(JSON.stringify(r.result.result.value,null,2));
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
