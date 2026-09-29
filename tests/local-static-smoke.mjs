import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const files = new Map([['/planner-casamento/','index.html'],['/planner-casamento/manifest.webmanifest','manifest.webmanifest'],['/planner-casamento/sw.js','sw.js'],['/planner-casamento/app-icon.svg','app-icon.svg']]);
const mime = {'index.html':'text/html','manifest.webmanifest':'application/manifest+json','sw.js':'text/javascript','app-icon.svg':'image/svg+xml'};
const server = createServer(async (req,res)=>{const f=files.get(new URL(req.url,'http://localhost').pathname);if(!f){res.writeHead(404).end();return;}try{res.writeHead(200,{'content-type':mime[f]});res.end(await readFile(f));}catch{res.writeHead(500).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
try{
 const manifest=await (await fetch(url+'/planner-casamento/manifest.webmanifest')).json();
 assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/planner-casamento/');
 const results=await Promise.all(Array.from({length:100},async()=>{const start=performance.now();const r=await fetch(url+'/planner-casamento/');const html=await r.text();return {ok:r.ok&&html.includes('id="app"'),ms:performance.now()-start};}));
 const failures=results.filter(r=>!r.ok).length;const durations=results.map(r=>r.ms).sort((a,b)=>a-b);const p95=durations[Math.ceil(.95*durations.length)-1];
 console.log(JSON.stringify({scope:'local static smoke test, NOT Supabase',requests:100,concurrent:100,failures,p95_ms:Math.round(p95)},null,2));
 assert.equal(failures,0);assert.ok(p95<2000,'local static p95 must be under 2s');
}finally{server.close();}
