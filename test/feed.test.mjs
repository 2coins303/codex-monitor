import test from 'node:test';
import assert from 'node:assert/strict';
import {operations,Session} from '../telemetry.mjs';
import {describeOperation} from '../details.mjs';
import {groupEvents,groupStatus} from '../public/feed.js';

test('projects names without command arguments, URL paths, prompts or file contents',()=>{
  const file=describeOperation('read_file',JSON.stringify({path:'C:\\private-work\\project\\src\\app.js',prompt:'PRIVATE_PROMPT'}));
  assert.equal(file.detail,'src/app.js');
  const web=describeOperation('web__run',JSON.stringify({open:[{ref_id:'https://login:PRIVATE_PASSWORD@example.com/private/path?key=PRIVATE_QUERY'}]}));
  assert.equal(web.detail,'example.com');
  const shell=describeOperation('exec_command',JSON.stringify({cmd:'node run.js --key PRIVATE_SECRET'}));
  assert.equal(shell.label,'node');assert.equal(shell.detail,'');
  const patch=describeOperation('apply_patch','*** Begin Patch\n*** Update File: C:/project/src/app.js\n+PRIVATE_CONTENT\n*** End Patch');
  assert.equal(patch.detail,'src/app.js');
  assert.doesNotMatch(JSON.stringify([file,web,shell,patch]),/PRIVATE_|private-work|private\/path/);
});
test('nested static arguments stay in their own call and dynamic paths stay undisclosed',()=>{
  const result=operations('exec',`await tools.read_file({path:'C:/work/src/a.js'}); await tools.web__run({open:[{ref_id:'https://example.org/secret'}]}); await tools.exec_command({cmd:'npm test'});`);
  assert.deepEqual(result.map(x=>x.detail),['src/a.js','example.org','']);
  assert.equal(result[2].label,'npm');
  assert.equal(describeOperation('read_file','{path:variablePath,prompt:"path: hidden"}').detail,'');
  assert.equal(describeOperation('read_file','{path:`/folder/${secret}`}').detail,'');
});
test('folds only consecutive stations and preserves failure and concurrent running state',()=>{
  const e=(id,station,status,time=0)=>({id,station,status,name:'tool',time:new Date(time).toISOString(),durationMs:1000,completedAt:new Date(time+1000).toISOString()});
  const groups=groupEvents([e('a','files','done'),e('b','files','error'),e('c','files','running'),e('d','model','done'),e('e','files','done')]);
  assert.equal(groups.length,3);assert.equal(groups[0].id,'a');assert.equal(groups[0].count,3);assert.equal(groups[0].status,'error');assert.equal(groups[0].active,1);
  assert.equal(groups[0].durationMs,1000);assert.match(groupStatus(groups[0],5000),/Error.*5.0 s/);
});
test('does not fold model changes or turn boundaries into ordinary usage rows',()=>{
  const events=['Model usage reported','Model changed','Model usage reported','Turn complete'].map((name,i)=>({id:String(i),station:'model',name,status:'done',time:new Date(0).toISOString()}));
  assert.equal(groupEvents(events).length,4);
});
test('deduplicates identical usage reports and records model changes',()=>{
  const session=new Session(null,'test');
  session.consume({type:'turn_context',payload:{model:'model-one'}});
  const usage={type:'event_msg',payload:{type:'token_count',info:{last_token_usage:{input_tokens:500},total_token_usage:{input_tokens:1000},model_context_window:2000}}};
  session.consume(usage);session.consume(usage);assert.equal(session.modelSteps,1);
  session.consume({type:'turn_context',payload:{model:'model-two'}});
  assert.equal(session.events.at(-1).detail,'model-one → model-two');
});
