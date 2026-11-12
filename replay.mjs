import { Session } from './telemetry.mjs';

// Explicitly simulated records go through the same classifier and lifecycle reducer
// as live logs. They are never written into Codex's sessions directory.
export const TOUR_SECONDS = 116;
export const stages = [
  [0, 'You: starting a test turn'], [5, 'Model: a response and 25% context'],
  [10, 'Memory: reading a test memory'], [18, 'Files: opening a test file'],
  [26, 'Shell: a successful command'], [34, 'Network: a simulated request'],
  [42, 'Browser: a simulated browser action'], [50, 'Agents: an agent tool call'],
  [58, 'Skills: reading a skill'], [66, 'Hooks: a hook event'],
  [74, 'Parallel work: three stations active together'],
  [84, 'Expected failure: Shell turns red; context turns amber at 75%'],
  [92, 'Batch failure: per-tool result uncertain; context turns red at 95%'],
  [100, 'Recovery: context compaction and a successful retry'],
  [108, 'Interrupted call: completion not recorded'],
  [116, 'Test complete: all 10 stations exercised; 2 expected errors']
];
function records() {
  const list=[];
  const add=(at,type,payload)=>list.push({at,type,payload});
  const event=(at,payload)=>add(at,'event_msg',payload);
  const usage=(at,percent)=>event(at,{type:'token_count',info:{last_token_usage:{input_tokens:percent*1000},model_context_window:100000}});
  const call=(at,end,name,id,output='{"exit_code":0}',input='{}')=>{
    add(at,'response_item',{type:'custom_tool_call',name,call_id:id,input});
    if(end!==null)add(end,'response_item',{type:'custom_tool_call_output',call_id:id,output});
  };
  add(0,'turn_context',{cwd:'SIMULATED EVENT TEST',model:'TEST - no model calls'});
  event(0,{type:'task_started'});usage(5,25);
  call(10,16,'memory.read_test','memory');
  call(18,24,'read_file','files','{}','{"path":"C:/demo/src/app.js"}');
  call(19,21,'read_file','files-2','{}','{"path":"C:/demo/public/style.css"}');
  call(21,23,'apply_patch','files-3','{}','*** Begin Patch\n*** Update File: C:/demo/public/index.html\n*** End Patch');
  call(26,32,'exec_command','shell','{"exit_code":0}','{"cmd":"node --test"}');
  call(34,40,'web__run','network','{}','{"open":[{"ref_id":"https://docs.example.com/guide?private=hidden"}]}');
  call(36,38,'web__run','network-2','{}','{"open":[{"ref_id":"https://developer.example.com/reference"}]}');
  call(42,48,'cua_repl.js','browser','{}','await tab.getScreenshot();');
  call(50,56,'collaboration.spawn_agent','agents');
  call(58,64,'skills.read','skills','{}','{"name":"design-review"}');
  call(66,72,'hook.test','hooks');
  call(74,82,'read_file','parallel-files','{}','{"path":"C:/demo/test/app.test.js"}');
  call(74,82,'web__run','parallel-network','{}','{"open":[{"ref_id":"https://docs.example.com"}]}');
  call(74,82,'exec_command','parallel-shell','{}','{"cmd":"npm test"}');
  usage(84,75);call(84,88,'exec_command','expected-error','{"exit_code":1}');
  add(90,'turn_context',{model:'TEST - alternate model'});
  usage(92,95);call(92,96,'exec','expected-batch','{"exit_code":2}', 'await Promise.all([tools.read_file({}), tools.exec_command({})]);');
  add(100,'compacted',{});usage(100,20);call(100,106,'exec_command','successful-retry');
  call(108,null,'web__run','unfinished');event(112,{type:'turn_aborted'});
  event(114,{type:'task_started'});event(116,{type:'task_complete'});
  return list.sort((a,b)=>a.at-b.at);
}
export const tourRecords=records();
export function replaySnapshot(started, now=Date.now()) {
  const elapsed=Math.max(0,(now-started)/1000);
  const session=new Session(null,`test-tour-${started}`);
  for(const row of tourRecords){
    if(row.at>elapsed)break;
    session.consume({type:row.type,payload:row.payload,timestamp:new Date(started+row.at*1000).toISOString()});
  }
  const state=session.snapshot();
  return {state,tour:{simulated:true,elapsed:Math.min(TOUR_SECONDS,Math.floor(elapsed)),duration:TOUR_SECONDS,complete:elapsed>=TOUR_SECONDS,stage:stages.filter(s=>s[0]<=elapsed).at(-1)[1]}};
}
