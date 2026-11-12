import test from 'node:test';
import assert from 'node:assert/strict';
import {replaySnapshot,TOUR_SECONDS} from '../replay.mjs';
import {classify,Session,STATIONS} from '../telemetry.mjs';

test('visible tour covers every station, finishes, and counts exactly two expected failures',()=>{
  const start=Date.now()-TOUR_SECONDS*1000;
  const {state,tour}=replaySnapshot(start,start+TOUR_SECONDS*1000);
  assert.equal(tour.complete,true);assert.equal(state.state,'idle');assert.equal(state.errors,2);
  for(const station of STATIONS)assert.ok(state.counts[station]>0,station);
  assert.equal(state.context.percent,20);
  assert.ok(state.events.some(e=>e.status==='error'));
  assert.equal(state.events.filter(e=>e.status==='batch-error').length,2);
  assert.ok(state.events.some(e=>e.status==='unknown'));
});
test('tour exercises parallel in-progress calls and both context warning thresholds',()=>{
  const start=Date.now();
  const at=seconds=>replaySnapshot(start,start+seconds*1000).state;
  assert.equal(at(78).events.filter(e=>e.status==='running').length,3);
  assert.equal(at(85).context.percent,75);assert.equal(at(93).context.percent,95);
  assert.equal(at(101).context.percent,20);assert.equal(at(115).state,'thinking');
});
test('tool classification covers station families and safe fallback',()=>{
  const inputs=[['collaboration.spawn_agent','','agents'],['hook.run','','hooks'],['memory.get','','memory'],['skills.read','','skills'],['cua_repl.js','','browser'],['apply_patch','','files'],['web__run','','network'],['exec_command','echo hello','shell'],['request_user_input','','you'],['exec_command','Get-Content SKILL.md','skills'],['exec_command','Get-Content C:/memories/note','memory'],['exec_command','curl https://example.com','network'],['exec_command','rg hello','files'],['unknown.new_tool','','shell']];
  for(const [name,input,expected]of inputs)assert.equal(classify(name,input),expected,name);
});
test('long-running calls become unconfirmed, then recover on a completion record',()=>{
  const session=new Session(null,'stale-test');const old=new Date(Date.now()-100000).toISOString();
  session.consume({timestamp:old,type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:'c',arguments:'{}'}});
  assert.equal(session.snapshot().state,'quiet');assert.equal(session.snapshot().events[0].status,'unconfirmed');
  session.consume({timestamp:new Date().toISOString(),type:'response_item',payload:{type:'function_call_output',call_id:'c',output:'{"exit_code":0}'}});
  assert.equal(session.snapshot().events[0].status,'done');assert.equal(session.snapshot().state,'thinking');
});
test('plain error prose does not produce a false tool failure',()=>{
  const session=new Session(null,'ordinary-output');
  session.consume({type:'response_item',payload:{type:'function_call',name:'read_file',call_id:'c',arguments:'{}'}});
  session.consume({type:'response_item',payload:{type:'function_call_output',call_id:'c',output:'A document describing error messages and failing commands.'}});
  assert.equal(session.errors,0);assert.equal(session.events[0].status,'done');
});
