import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {health,ensureServer} from '../launcher.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function freePort(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}

test('portable server discovers only configured synthetic data and enforces local access',async t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'codex-monitor-fixture-'));
  const port=await freePort(),base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,CODEX_MAP_PORT:String(port),CODEX_MAP_SESSIONS:temp},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let output='';child.stderr.on('data',data=>{output+=data;});
  t.after(async()=>{if(child.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}assert.equal(path.dirname(temp),os.tmpdir());fs.rmSync(temp,{recursive:true,force:true});});
  let ready=false;
  for(let i=0;i<40;i++){if(await health(base)==='ready'){ready=true;break;}await delay(50);}
  assert.ok(ready,output||'server readiness');
  const json=async endpoint=>{const response=await fetch(base+endpoint);assert.equal(response.status,200);return response.json();};
  assert.equal((await json('/api/state')).state,null);
  const day=path.join(temp,'2026','01','01');fs.mkdirSync(day,{recursive:true});
  const id='00000000-0000-0000-0000-000000000001';
  const line=(type,payload)=>JSON.stringify({type,payload,timestamp:new Date().toISOString()})+'\n';
  const session=path.join(day,id+'.jsonl');
  fs.writeFileSync(session,line('session_meta',{cwd:'/example/project'})+line('event_msg',{type:'task_started'})+line('response_item',{type:'message',role:'user',content:'SECRET_FIXTURE_MESSAGE'})+line('response_item',{type:'function_call',name:'read_file',call_id:'demo',arguments:JSON.stringify({path:'/example/src/demo.js'})}));
  await delay(3100);
  const live=await json('/api/state');
  assert.equal(live.state.id,id);assert.equal(live.state.project,'project');
  assert.equal(live.state.events.at(-1).detail,'src/demo.js');
  assert.doesNotMatch(JSON.stringify(live),/SECRET_FIXTURE_MESSAGE/);
  for(const asset of ['/','/app.js','/feed.js','/style.css','/icon.svg'])assert.equal((await fetch(base+asset)).status,200);
  assert.equal((await fetch(base+'/server.mjs')).status,404);
  assert.equal((await fetch(base+'/api/state',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/api/state',{headers:{Origin:'https://example.org'}})).status,403);
  const wrongHost=await new Promise((resolve,reject)=>{http.get(base+'/api/health',{headers:{Host:'example.org'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});
  assert.equal(wrongHost,403);
  assert.equal((await fetch(base+'/api/test-tour?started=invalid')).status,400);
  const demo=await json('/api/test-tour?started='+(Date.now()-117000));
  assert.equal(demo.tour.complete,true);assert.equal(demo.state.errors,2);
  assert.ok(Object.values(demo.state.counts).every(count=>count>0));
  const before=fs.readFileSync(session,'utf8');await ensureServer(base);
  assert.equal(fs.readFileSync(session,'utf8'),before,'launcher and demo leave logs unchanged');
  assert.match((await fetch(base+'/')).headers.get('content-security-policy'),/frame-ancestors 'none'/);
});

test('launcher refuses another application on the chosen port',async t=>{
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end('{"app":"different-application"}');});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal(await health(base),'occupied');
  await assert.rejects(ensureServer(base),/occupied/);
});
