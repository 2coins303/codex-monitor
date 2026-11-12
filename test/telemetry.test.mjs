import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Session, operations, discover } from '../telemetry.mjs';
const row=(type,payload)=>JSON.stringify({timestamp:new Date().toISOString(),type,payload})+'\n';
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-map-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'session.jsonl');fs.writeFileSync(file,row('session_meta',{cwd:'C:\\Work\\Example'}));return {file,session:new Session(file,'test-session')};}

test('reads real call lifecycle and last reported context without exposing contents', t=>{
  const {file,session}=fixture(t);
  fs.appendFileSync(file,[row('event_msg',{type:'task_started'}),row('turn_context',{model:'example-model'}),row('response_item',{type:'message',role:'user',content:'PRIVATE_PROMPT'}),row('response_item',{type:'reasoning',summary:'PRIVATE_REASONING'}),row('response_item',{type:'custom_tool_call',name:'exec',call_id:'c1',input:'await tools.exec_command({cmd:"echo PRIVATE_ARGUMENT"});'}),row('event_msg',{type:'token_count',info:{last_token_usage:{input_tokens:250},total_token_usage:{input_tokens:99999},model_context_window:1000}})].join(''));
  session.poll();let state=session.snapshot();assert.equal(state.state,'working');assert.equal(state.context.percent,25);assert.equal(state.counts.shell,1);assert.equal(state.project,'Example');
  fs.appendFileSync(file,row('response_item',{type:'custom_tool_call_output',call_id:'c1',output:[{type:'input_text',text:'{"exit_code":7,"output":"PRIVATE_OUTPUT"}'}]}));session.poll();state=session.snapshot();assert.equal(state.errors,1);assert.equal(state.events.find(e=>e.station==='shell').status,'error');assert.doesNotMatch(JSON.stringify(state),/PRIVATE_/);
  fs.appendFileSync(file,row('event_msg',{type:'task_complete'}));session.poll();assert.equal(session.snapshot().state,'idle');
});
test('does not replay bytes; incomplete UTF-8 lines are consumed exactly once',t=>{
  const {file,session}=fixture(t);session.poll();
  const bytes=Buffer.from(row('turn_context',{cwd:'C:\\Work\\Café'}));const split=bytes.indexOf(Buffer.from('é'))+1;
  fs.appendFileSync(file,bytes.subarray(0,split));session.poll();assert.equal(session.project,'Example');
  fs.appendFileSync(file,bytes.subarray(split));session.poll();assert.equal(session.project,'Café');const n=session.sequence;session.poll();assert.equal(session.sequence,n);
});
test('extracts nested operations but ignores code inside literals and comments',()=>{
  const result=operations('exec','// tools.web__run({})\nawait tools.apply_patch("source contains tools.exec_command({})"); await tools.web__run({search_query: []});');
  assert.deepEqual(result.map(x=>x.station),['files','network']);assert.equal(result.length,2);
});
test('a batch error does not pretend to identify the failing nested tool',t=>{
  const {file,session}=fixture(t);fs.appendFileSync(file,row('response_item',{type:'custom_tool_call',name:'exec',call_id:'batch',input:'await Promise.all([tools.apply_patch("a"), tools.exec_command({cmd:"echo x"})])'})+row('response_item',{type:'custom_tool_call_output',call_id:'batch',output:'{"exit_code":1}'}));session.poll();assert.equal(session.errors,1);assert.ok(session.events.every(e=>e.status==='batch-error'));
});
test('a stopped turn leaves unmatched calls unknown',t=>{
  const {file,session}=fixture(t);fs.appendFileSync(file,row('response_item',{type:'function_call',name:'web__run',call_id:'c',arguments:'{}'})+row('event_msg',{type:'task_complete'}));session.poll();assert.equal(session.events[0].status,'unknown');
});
test('large histories load a bounded recent segment',t=>{
  const {file,session}=fixture(t);fs.appendFileSync(file,row('response_item',{type:'reasoning',summary:'x'.repeat(7*1024*1024)})+row('event_msg',{type:'task_started'}));session.poll();assert.equal(session.truncated,true);assert.equal(session.counts.you,1);assert.equal(session.offset,fs.statSync(file).size);
});
test('a truncated log clears stale context, state, and error counts',t=>{
  const {file,session}=fixture(t);fs.appendFileSync(file,row('event_msg',{type:'task_started'})+row('event_msg',{type:'token_count',info:{last_token_usage:{input_tokens:500},model_context_window:1000}}));session.poll();assert.equal(session.context.percent,50);
  fs.writeFileSync(file,row('session_meta',{cwd:'C:\\Work\\Replacement'}));session.poll();const state=session.snapshot();assert.equal(state.context,null);assert.equal(state.state,'idle');assert.equal(state.events.length,0);assert.equal(state.project,'Replacement');
});

test('discovery finds resumed older chats beyond recent creation dates and skips invalid directories',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-monitor-discovery-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const recent=path.join(dir,'2026','12','01'),older=path.join(dir,'2025','01','01');
  fs.mkdirSync(recent,{recursive:true});fs.mkdirSync(older,{recursive:true});
  fs.writeFileSync(path.join(dir,'2027'),'not a directory');
  for(let i=1;i<=65;i++){
    const file=path.join(recent,`00000000-0000-0000-0000-${String(i).padStart(12,'0')}.jsonl`);
    fs.writeFileSync(file,'');fs.utimesSync(file,new Date('2026-01-01'),new Date('2026-01-01'));
  }
  const id='00000000-0000-0000-0000-000000000999';
  const file=path.join(older,id+'.jsonl');fs.writeFileSync(file,'');
  fs.utimesSync(file,new Date('2026-02-01'),new Date('2026-02-01'));
  const catalog=discover(dir);
  assert.equal(catalog[0].id,id);assert.equal(catalog.length,40);
});
