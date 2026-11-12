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
  const waitForSession=async id=>{
    const deadline=Date.now()+1800;
    do {const data=await json('/api/state');if(data.state?.id===id)return data;await delay(50);} while(Date.now()<deadline);
    assert.fail('Newly active chat was not discovered within the polling window');
  };
  assert.equal((await json('/api/state')).state,null);
  const day=path.join(temp,'2026','01','01');fs.mkdirSync(day,{recursive:true});
  const id='00000000-0000-0000-0000-000000000001';
  const line=(type,payload)=>JSON.stringify({type,payload,timestamp:new Date().toISOString()})+'\n';
  const session=path.join(day,id+'.jsonl');
  fs.writeFileSync(session,line('session_meta',{cwd:'/example/project'})+line('event_msg',{type:'task_started'})+line('response_item',{type:'message',role:'user',content:'SECRET_FIXTURE_MESSAGE'})+line('response_item',{type:'function_call',name:'read_file',call_id:'demo',arguments:JSON.stringify({path:'/example/src/demo.js'})}));
  const live=await waitForSession(id);
  assert.equal(live.state.id,id);assert.equal(live.state.project,'project');
  assert.equal(live.state.events.at(-1).detail,'src/demo.js');
  assert.doesNotMatch(JSON.stringify(live),/SECRET_FIXTURE_MESSAGE/);
  // A new chat can appear in a new day/month/year after the monitor is already open.
  const nextDay=path.join(temp,'2027','02','02');fs.mkdirSync(nextDay,{recursive:true});
  const nextId='00000000-0000-0000-0000-000000000002';
  const nextFile=path.join(nextDay,nextId+'.jsonl');
  fs.writeFileSync(nextFile,line('session_meta',{cwd:'/example/new-chat'})+line('event_msg',{type:'task_started'}));
  const switched=await waitForSession(nextId);
  assert.equal(switched.state.project,'new-chat');assert.equal(switched.sessions.length,2);
  assert.equal((await json('/api/state?session='+id)).state.id,id,'explicit pin remains on its chat');
  // Resuming an older chat must update recency, not just discover newly created files.
  fs.appendFileSync(session,line('event_msg',{type:'task_started'}));
  await waitForSession(id);
  // Discovery also runs between requests, and a removed pin can recover automatically.
  fs.unlinkSync(session);await delay(650);
  const removed=await json('/api/state?session='+id);
  assert.equal(removed.state.id,nextId);assert.equal(removed.sessions.length,1);
  for(const asset of ['/','/app.js','/feed.js','/session.js','/style.css','/icon.svg'])assert.equal((await fetch(base+asset)).status,200);
  assert.equal((await fetch(base+'/server.mjs')).status,404);
  assert.equal((await fetch(base+'/api/state',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/api/state',{headers:{Origin:'https://example.org'}})).status,403);
  const wrongHost=await new Promise((resolve,reject)=>{http.get(base+'/api/health',{headers:{Host:'example.org'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});
  assert.equal(wrongHost,403);
  assert.equal((await fetch(base+'/api/test-tour?started=invalid')).status,400);
  const demo=await json('/api/test-tour?started='+(Date.now()-117000));
  assert.equal(demo.tour.complete,true);assert.equal(demo.state.errors,2);
  assert.ok(Object.values(demo.state.counts).every(count=>count>0));
  const before=fs.readFileSync(nextFile,'utf8');await ensureServer(base);
  assert.equal(fs.readFileSync(nextFile,'utf8'),before,'launcher and demo leave logs unchanged');
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
