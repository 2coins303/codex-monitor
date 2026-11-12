import {groupEvents,groupStatus,durationLabel} from './feed.js';
import {AUTO_SESSION_LABEL,initialSession,sessionUrl} from './session.js';
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const names = {you:'You',model:'Model',memory:'Memory',files:'Files',shell:'Shell',network:'Network',browser:'Browser',agents:'Agents',skills:'Skills',hooks:'Hooks'};
const colors = {you:'#99bfff',model:'#8ef0c5',memory:'#c3a2ff',files:'#f4d18e',shell:'#88d8ed',network:'#7fb5ff',browser:'#9cbbff',agents:'#c9a4ff',skills:'#f1b2d4',hooks:'#c4cbd8'};
const icons = {
  you:'M0-8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M-7 10V7a7 7 0 0 1 14 0v3',
  model:'M-8-7h16v14H-8zM-3-3h6v6h-6zM-12-4h4m-4 8h4m16-8h4m-4 8h4M-4-11v4m8-4v4M-4 7v4m8-4v4',
  memory:'M-8-7c0-4 16-4 16 0s-16 4-16 0v14c0 4 16 4 16 0V-7M-8 0c0 4 16 4 16 0',
  files:'M-8-10H3l5 5v15H-8zM3-10v5h5M-4 0h8m-8 4h6',
  shell:'M-10-8h20v16h-20zM-6-3l4 3-4 3M1 4h5',
  network:'M0-10a10 10 0 1 0 0 20 10 10 0 0 0 0-20M-10 0h20M0-10c-7 5-7 15 0 20 7-5 7-15 0-20',
  browser:'M-10-8h20v16h-20zM-10-3h20M-7-6h1m2 0h1',
  agents:'M-5-7a3 3 0 1 0 0 6 3 3 0 0 0 0-6M-11 8V5a6 6 0 0 1 12 0v3M5-6a3 3 0 0 1 0 6M5 2a6 6 0 0 1 6 6',
  skills:'M0-11l3 8 8 3-8 3-3 8-3-8-8-3 8-3z',
  hooks:'M-6-9v12a6 6 0 0 0 12 0V0M2 4l4-4 4 4M-9-9h6'
};
function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key,val] of Object.entries(attrs)) node.setAttribute(key,val);
  if (text !== undefined) node.textContent = text;
  return node;
}
const map = $('map'), positions = {}, elements = {}, cx=360, cy=320, radius=235;
const defs=svg('defs');
const coreGradient=svg('radialGradient',{id:'core-fill',cx:'38%',cy:'25%',r:'80%'});
coreGradient.append(svg('stop',{offset:'0%','stop-color':'#223e3d'}),svg('stop',{offset:'58%','stop-color':'#122528'}),svg('stop',{offset:'100%','stop-color':'#101a22'}));
const auraGradient=svg('radialGradient',{id:'core-aura'});
auraGradient.append(svg('stop',{offset:'0%','stop-color':'#7ae9c1','stop-opacity':'.15'}),svg('stop',{offset:'55%','stop-color':'#49bca6','stop-opacity':'.07'}),svg('stop',{offset:'100%','stop-color':'#49bca6','stop-opacity':'0'}));
defs.append(coreGradient,auraGradient);map.append(defs);
map.append(svg('circle',{cx,cy,r:190,fill:'url(#core-aura)',class:'core-aura'}),svg('circle',{cx,cy,r:radius,class:'map-orbit'}),svg('circle',{cx,cy,r:164,class:'map-orbit inner'}));
const field=svg('g',{class:'field-points','aria-hidden':'true'});
for(let i=0;i<46;i++){const a=i*2.39996,r=130+(i%7)*19;field.append(svg('circle',{cx:cx+Math.cos(a)*r,cy:cy+Math.sin(a)*r,r:i%4===0?1.3:.7}));}map.append(field);
const route=svg('g',{class:'recent-route','aria-hidden':'true'}),spokes=svg('g'), signals=svg('g'), stations=svg('g');map.append(route,spokes,signals,stations);
Object.keys(names).forEach((key,index)=>{
  const angle=(-90+index*36)*Math.PI/180, x=cx+Math.cos(angle)*radius, y=cy+Math.sin(angle)*radius;
  const qx=(cx+x)/2-Math.sin(angle)*20,qy=(cy+y)/2+Math.cos(angle)*20;
  positions[key]={x,y,qx,qy};
  const d=`M${cx} ${cy} Q${qx} ${qy} ${x} ${y}`;
  const line=svg('path',{d,class:'spoke',style:`--station:${colors[key]}`});
  const flow=svg('path',{d,class:'flow-path',style:`--station:${colors[key]}`});spokes.append(line,flow);
  const group=svg('g',{transform:`translate(${x},${y})`,class:'station',style:`--station:${colors[key]};--delay:${index*.16}s`,tabindex:0,role:'button','aria-label':`Filter ${names[key]} activity`});
  const count=svg('text',{y:66,class:'count'},'0 events');
  group.append(svg('circle',{r:40,class:'station-glow'}),svg('circle',{r:33,class:'station-aura'}),svg('circle',{r:33,class:'station-orbit'}),svg('circle',{r:28,class:'station-node'}),svg('path',{d:icons[key],class:'icon'}),svg('text',{y:49,class:'name'},names[key]),count);
  const clock=svg('g',{class:'station-clock',transform:'translate(24,-24)','aria-hidden':'true'});
  clock.append(svg('circle',{r:9}),svg('path',{d:'M0 0V-6',class:'clock-minute'}),svg('path',{d:'M0 0L4 0',class:'clock-hour'}));group.append(clock);
  const badge=svg('g',{class:'error-badge',transform:'translate(-24,-24)'}),errorCount=svg('text',{y:3},'');
  badge.append(svg('circle',{r:9}),errorCount);group.append(badge);
  if(key==='agents'){const orbit=svg('g',{class:'agent-orbiter','aria-hidden':'true'});orbit.append(svg('circle',{cx:0,cy:-37,r:3.5}));group.append(orbit);}
  group.addEventListener('click',()=>setFilter(filter===key?null:key));
  group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setFilter(filter===key?null:key);}});
  stations.append(group);elements[key]={line,flow,group,count,clock,badge,errorCount};
});
map.append(svg('circle',{cx,cy,r:113,class:'engine-orbit'}),svg('circle',{cx,cy,r:107,class:'engine-orbit reverse'}),svg('circle',{cx,cy,r:91,class:'center-shell'}),svg('circle',{cx,cy,r:99,class:'center-ring-bg'}));
const circumference=2*Math.PI*99;
const ring=svg('circle',{cx,cy,r:99,class:'center-ring','stroke-dasharray':circumference,'stroke-dashoffset':circumference,transform:`rotate(-90 ${cx} ${cy})`});
const modelText=svg('text',{x:cx,y:cy+10,class:'center-model'},'Waiting for session');
const stateText=svg('text',{x:cx,y:cy+41,class:'center-state'},'Connecting');
const contextText=svg('text',{x:cx,y:cy+135,class:'center-caption'},'CONTEXT —');
map.append(ring,svg('text',{x:cx,y:cy-43,class:'center-kicker'},'LOCAL SESSION'),svg('text',{x:cx,y:cy-13,class:'center-name'},'Codex'),modelText,svg('rect',{x:cx-54,y:cy+24,width:108,height:26,rx:13,class:'center-pill'}),stateText,contextText);
const wave=svg('g',{class:'core-wave','aria-hidden':'true'});
for(let i=0;i<5;i++)wave.append(svg('rect',{x:cx-13+i*6,y:cy+61,width:3,height:7,rx:1.5,style:`--delay:${i*.14}s`}));map.append(wave);
let current=null, seen=new Map(), selected=initialSession(location.search), filter=null, paused=false, connected=false;
localStorage.removeItem('codex-map-session');
history.replaceState(null,'',sessionUrl(selected));
let lastCatalog='', lastFeed='', busy=false;
let testStarted=null, requestGeneration=0;
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
let motionEnabled=localStorage.getItem('codex-map-motion')!=='off'&&!motionQuery.matches;
let runningStations=[], lastFlow=0;
const feedNodes=new Map();
let followFeed=true, displayedGroups=[];
$('feed').addEventListener('scroll',()=>{followFeed=$('feed').scrollTop<8;$('follow-feed').hidden=followFeed;$('feed-mode').textContent=followFeed?'Newest first · repeats folded':'Reading history';});
$('follow-feed').addEventListener('click',()=>{followFeed=true;$('feed').scrollTo({top:0,behavior:motionEnabled?'smooth':'instant'});$('follow-feed').hidden=true;});
function setMotion(enabled,persist=true){
  motionEnabled=enabled&&!motionQuery.matches;document.body.classList.toggle('motion-off',!motionEnabled);
  $('motion').textContent=motionEnabled?'Motion on':'Motion off';$('motion').setAttribute('aria-label',$('motion').textContent);$('motion').setAttribute('aria-pressed',String(motionEnabled));$('motion').disabled=motionQuery.matches;
  $('motion').title=motionQuery.matches?'Reduced motion is enabled in your system settings':'Toggle decorative motion and animated event trails';
  if(!motionEnabled){signals.replaceChildren();document.querySelectorAll('.arrive').forEach(row=>row.classList.remove('arrive'));document.getAnimations().forEach(animation=>animation.cancel());}
  if(persist)localStorage.setItem('codex-map-motion',motionEnabled?'on':'off');
}
setMotion(motionEnabled,false);$('motion').addEventListener('click',()=>setMotion(!motionEnabled));
motionQuery.addEventListener('change',()=>setMotion(localStorage.getItem('codex-map-motion')!=='off',false));
function setFilter(value){filter=value;lastFeed='';followFeed=true;$('feed').scrollTop=0;if(current)render(current);}
$('clear-filter').addEventListener('click',()=>setFilter(null));
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'Resume view':'Pause view';$('pause').setAttribute('aria-pressed',String(paused));connection(paused?'View paused':connected?'Local connection':'Reconnecting',paused||!connected);if(!paused)poll();});
$('about').addEventListener('click',()=>$('about-dialog').showModal());
function updateSessionMode(){
  const automatic=selected==='auto';
  $('auto-follow').hidden=automatic;
  $('auto-follow').disabled=testStarted!==null;
  $('session-status').textContent=testStarted!==null?'Simulation · live discovery continues':automatic?'Auto-follow on · checks every 500 ms':'Pinned to one chat · new chats still detected';
  $('session-status').classList.toggle('pinned',!automatic);
}
function selectSession(value){
  requestGeneration++;selected=value;$('session').value=selected;
  history.replaceState(null,'',sessionUrl(selected));
  current=null;seen.clear();lastFeed='';updateSessionMode();poll();
}
$('session').addEventListener('change',()=>selectSession($('session').value));
$('auto-follow').addEventListener('click',()=>selectSession('auto'));
updateSessionMode();
function changeTest(start){
  requestGeneration++;testStarted=start?Date.now():null;paused=false;current=null;seen.clear();lastFeed='';
  $('pause').textContent='Pause view';$('pause').setAttribute('aria-pressed','false');
  $('test-tour').textContent=start?'Exit test':'Test all events';$('test-banner').hidden=!start;$('session').disabled=start;
  $('test-again').hidden=true;document.body.classList.toggle('testing',start);updateSessionMode();poll();
}
$('test-tour').addEventListener('click',()=>changeTest(testStarted===null));
$('test-again').addEventListener('click',()=>changeTest(true));
function connection(text,off=false){$('connection').querySelector('span').textContent=text;$('connection').classList.toggle('off',off);document.body.classList.toggle('disconnected',off);if(off)signals.replaceChildren();}
function pulse(station,error=false,reverse=false){
  if(!motionEnabled||paused||!connected||document.hidden||signals.childElementCount>=30)return;
  const pos=positions[station];if(!pos)return;
  const packet=svg('g',{class:`signal${error?' error':''}`,style:`--station:${error?'#ff9799':colors[station]}`});
  const dots=[0,1,2,3].map(i=>svg('circle',{r:i===0?3.2:2-i*.35}));packet.append(...dots);signals.append(packet);
  const start=performance.now();
  function step(now){
    if(!packet.isConnected||paused||!motionEnabled||document.hidden){packet.remove();return;}
    const progress=Math.min(1,(now-start)/1250);
    dots.forEach((dot,i)=>{const p=Math.max(0,progress-i*.045),t=reverse?1-p:p,u=1-t;dot.setAttribute('cx',u*u*cx+2*u*t*pos.qx+t*t*pos.x);dot.setAttribute('cy',u*u*cy+2*u*t*pos.qy+t*t*pos.y);dot.setAttribute('opacity',Math.sin(p*Math.PI)*(1-i*.2));});
    if(progress<1)requestAnimationFrame(step);else packet.remove();
  }
  requestAnimationFrame(step);
}
setInterval(()=>{
  if(!motionEnabled||paused||!connected||document.hidden||Date.now()-lastFlow<1800)return;
  lastFlow=Date.now();for(const station of runningStations)pulse(station);
},300);
const stateLabels={idle:'Ready for the next turn',working:'Tools are at work',thinking:'Turn in progress',quiet:'Waiting for new log events',unavailable:'Session log unavailable'};
function render(state){
  const switched=current?.id!==state.id;
  if(switched){seen.clear();lastFeed='';signals.replaceChildren();runningStations=[];feedNodes.clear();followFeed=true;$('feed').scrollTop=0;}
  for(const e of state.events){
    const prior=seen.get(e.id);
    if(!switched&&Date.now()-Date.parse(e.completedAt||e.time)<15000){
      if(prior===undefined){pulse(e.station,false,false);if(e.status!=='running')setTimeout(()=>{if(current?.id===state.id)pulse(e.station,['error','batch-error'].includes(e.status),true);},650);}
      else if(prior!==e.status&&e.status!=='running')pulse(e.station,['error','batch-error'].includes(e.status),true);
    }
    seen.set(e.id,e.status);
  }
  if(seen.size>500){const ids=new Set(state.events.map(e=>e.id));for(const key of seen.keys())if(!ids.has(key))seen.delete(key);}
  current=state;
  document.body.classList.toggle('engine-live',['working','thinking'].includes(state.state));
  $('project').textContent=state.project;$('state-label').textContent=stateLabels[state.state]||'Waiting for events';
  modelText.textContent=state.model;stateText.textContent={idle:'Ready',working:'Working',thinking:'In progress',quiet:'No recent events',unavailable:'Unavailable'}[state.state]||'Waiting';
  const percent=state.context?.percent;
  ring.setAttribute('stroke-dashoffset',circumference*(1-(percent??0)/100));ring.style.stroke=percent>=90?'#f58c86':percent>=70?'#e8c187':'#9ce8c6';
  $('context-bar').style.transform=`scaleX(${(percent??0)/100})`;$('context-bar').style.background=ring.style.stroke;
  contextText.textContent=`CONTEXT ${percent===undefined?'—':Math.round(percent)+'%'}`;
  $('context-value').textContent=percent===undefined?'—':`${Math.round(percent)}%`;
  $('context-detail').textContent=state.context?`${formatNumber(state.context.used)} / ${formatNumber(state.context.limit)} tokens`:'Waiting for usage data';
  $('event-count').textContent=Object.values(state.counts).reduce((a,b)=>a+b,0).toLocaleString();
  $('event-detail').textContent=state.truncated?'Recent log segment':'Events in loaded log';
  $('error-count').textContent=state.errors;$('error-count').style.color=state.errors?'#f58c86':'';
  runningStations=[];
  for(const [key,el] of Object.entries(elements)){
    const count=state.counts[key]||0, active=state.events.some(e=>e.station===key&&e.status==='running')||(key==='model'&&state.state==='thinking');
    const failed=state.events.some(e=>e.station===key&&['error','batch-error'].includes(e.status)&&Date.now()-Date.parse(e.completedAt||e.time)<20000);
    if(active)runningStations.push(key);
    el.line.setAttribute('class',`spoke${count?' used':''}${active?' active':''}`);
    el.line.style.strokeWidth=String(Math.min(2.7,.8+Math.log2(count+1)*.23));
    el.flow.classList.toggle('active',active);
    el.group.setAttribute('class',`station${active?' active':''}${failed?' failed':''}${filter===key?' selected':''}`);
    el.group.setAttribute('aria-pressed',String(filter===key));
    el.count.textContent=`${count} ${count===1?'event':'events'}`;
    const open=state.events.filter(e=>e.station===key&&e.status==='running');
    const elapsed=open.length?Date.now()-Math.min(...open.map(e=>Date.parse(e.time))):0;
    el.group.classList.toggle('long-call',elapsed>=3000);
    const errors=state.events.filter(e=>e.station===key&&['error','batch-error'].includes(e.status)).length;
    el.badge.classList.toggle('visible',errors>0);el.errorCount.textContent=errors>9?'9+':errors;
    el.group.setAttribute('aria-label',`Filter ${names[key]} activity`);
  }
  $('active-stations').textContent=runningStations.length?`${runningStations.length} active`:'Standing by';
  $('active-stations').parentElement.classList.toggle('active',runningStations.length>0);
  $('feed-title').textContent=filter?names[filter]:'All stations';$('clear-filter').hidden=!filter;
  const visits=[];
  for(const e of state.events){if(!['model','you'].includes(e.station)&&visits.at(-1)!==e.station)visits.push(e.station);}
  const recent=visits.slice(-8);route.replaceChildren();
  recent.slice(1).forEach((key,i)=>{const a=positions[recent[i]],b=positions[key];route.append(svg('path',{d:`M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`,opacity:.1+(i+1)/recent.length*.4}));});
  const latest=state.events.filter(e=>e.status==='running').at(-1)||state.events.at(-1);
  $('now-station').textContent=state.state==='thinking'?'Model':latest?names[latest.station]:'Waiting';
  $('now-detail').textContent=state.state==='thinking'?`${state.model} · turn in progress`:latest?[latest.label||latest.name,latest.detail].filter(Boolean).join(' · '):'Waiting for local events';
  $('now-context').textContent=percent===undefined?'':`Context ${Math.round(percent)}%`;
  $('now-station').parentElement.style.setProperty('--station',colors[state.state==='thinking'?'model':latest?.station]||colors.model);
  renderFeed(state,switched);
  updateAge();
}
function span(className,text=''){const el=document.createElement('span');el.className=className;el.textContent=text;return el;}
function renderFeed(state,switched){
  const groups=groupEvents(state.events).reverse().filter(g=>!filter||g.station===filter).slice(0,60);
  displayedGroups=groups;
  const key=JSON.stringify(groups.map(g=>[g.id,g.count,g.status,g.events.map(e=>e.status)]));
  if(key===lastFeed){updateDurations();return;}lastFeed=key;
  const feed=$('feed'), previous=new Map([...feed.children].map(row=>[row,row.getBoundingClientRect().top]));
  const anchor=[...feed.children].find(row=>row.getBoundingClientRect().bottom>feed.getBoundingClientRect().top);
  const anchorTop=anchor?.getBoundingClientRect().top;
  const desired=[];
  for(const group of groups){
    const e=group.latest;let item=feedNodes.get(group.id);
    if(!item){
      const row=document.createElement('div');row.className='event';row.style.setProperty('--station',colors[e.station]);
      const dot=span('event-dot'),station=span('event-station',names[e.station]),title=span('event-name'),status=span('event-status'),time=span('event-time');
      const toggle=document.createElement('button');toggle.className='group-toggle';toggle.setAttribute('aria-expanded','false');
      const details=document.createElement('div');details.className='group-details';details.hidden=true;
      toggle.addEventListener('click',()=>{details.hidden=!details.hidden;toggle.setAttribute('aria-expanded',String(!details.hidden));});
      row.append(dot,station,title,toggle,status,time,details);item={row,title,status,time,toggle,details};feedNodes.set(group.id,item);
    }
    item.row.className=`event ${group.status}${group.active?' has-running':''}`;
    item.title.textContent=e.station==='model'?[e.label||e.name,e.detail].filter(Boolean).join(' · '):e.detail||e.label||e.name;
    item.title.title=[e.label||e.name,e.detail,e.name].filter(Boolean).join(' · ');
    item.time.textContent=new Date(e.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    item.toggle.hidden=group.count<2;item.toggle.textContent=`+${group.count-1}`;item.toggle.setAttribute('aria-label',`Show ${group.count} ${names[group.station]} calls`);
    item.status.textContent=groupStatus(group,Date.now());
    item.row.title=group.status==='batch-error'?'A call in this batch failed; the exact failing call is unknown.':'';
    item.details.replaceChildren(...[...group.events].reverse().map(event=>{const line=document.createElement('div');line.textContent=[event.label||event.name,event.detail,event.status,event.durationMs===undefined?'':durationLabel(event.durationMs)].filter(Boolean).join(' · ');return line;}));
    desired.push(item.row);
  }
  if(!groups.length){const empty=document.createElement('div');empty.className='empty';empty.textContent=filter?`No ${names[filter].toLowerCase()} activity in the loaded events.`:'Start a turn in Codex to see its activity.';desired.push(empty);}
  const keep=new Set(desired);for(const child of [...feed.childNodes])if(!keep.has(child))child.remove();
  desired.forEach((row,index)=>{if(feed.children[index]!==row)feed.insertBefore(row,feed.children[index]||null);});
  if(followFeed)feed.scrollTop=0;else if(anchor?.isConnected)feed.scrollTop+=anchor.getBoundingClientRect().top-anchorTop;
  if(motionEnabled&&!switched&&followFeed){
    for(const row of desired){const before=previous.get(row),delta=before===undefined?-25:before-row.getBoundingClientRect().top;
      if(delta&&row.offsetTop-feed.scrollTop<feed.clientHeight){row.getAnimations().forEach(a=>a.cancel());row.animate([{transform:`translateY(${delta}px)`,opacity:before===undefined?0:.7},{transform:'translateY(0)',opacity:1}],{duration:450,easing:'cubic-bezier(.2,.8,.2,1)'});}
    }
  }
  const ids=new Set(groups.map(g=>g.id));for(const id of feedNodes.keys())if(!ids.has(id))feedNodes.delete(id);
  $('follow-feed').hidden=followFeed;
}
function updateDurations(){if(paused)return;for(const group of displayedGroups){const item=feedNodes.get(group.id);if(item)item.status.textContent=groupStatus(group,Date.now());}}
function updateAge(){if(!current?.lastEventAt)return;const age=Math.max(0,Math.floor((Date.now()-Date.parse(current.lastEventAt))/1000));$('last-update').textContent=`Last event ${age<2?'just now':age<60?age+'s ago':Math.floor(age/60)+'m ago'}`;}
function formatNumber(n){return n>=1000?`${(n/1000).toFixed(1)}k`:String(n);}
async function poll(){
  if(busy)return;busy=true;
  const generation=requestGeneration;
  try{
    const endpoint=testStarted!==null?`/api/test-tour?started=${testStarted}`:`/api/state${selected==='auto'?'':`?session=${encodeURIComponent(selected)}`}`;
    const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(6000)});
    if(!response.ok)throw new Error('Connection failed');const data=await response.json();connected=true;
    if(generation!==requestGeneration)return;
    connection(paused?'View paused':testStarted!==null?'Simulated test':'Local connection',paused);
    if(data.tour){
      if(paused)return;
      const returnIn=Math.max(0,Math.ceil((testStarted+(data.tour.duration+5)*1000-Date.now())/1000));
      if(data.tour.complete&&!returnIn){changeTest(false);return;}
      $('test-stage').textContent=data.tour.stage+(data.tour.complete?` · Live monitoring resumes in ${returnIn}s`:'');$('test-time').textContent=`${data.tour.elapsed} / ${data.tour.duration}s`;
      $('test-progress').value=data.tour.elapsed;$('test-again').hidden=!data.tour.complete;
      render(data.state);return;
    }
    const catalogKey=JSON.stringify(data.sessions.map(s=>[s.id,s.project]));
    if(catalogKey!==lastCatalog){lastCatalog=catalogKey;const opt=document.createElement('option');opt.value='auto';opt.textContent=AUTO_SESSION_LABEL;const options=[opt];
      for(const s of data.sessions){const o=document.createElement('option');o.value=s.id;o.textContent=`${new Date(s.modified).toLocaleDateString([],{month:'short',day:'numeric'})} · ${s.project} · ${s.id.slice(-6)}`;options.push(o);}
      $('session').replaceChildren(...options);
      if(selected!=='auto'&&!data.sessions.some(s=>s.id===selected)){selectSession('auto');return;}
      $('session').value=selected;
    }
    if(paused)return;
    if(data.state)render(data.state);else{
      render({id:'no-session',project:'Waiting for a session',model:'Codex',state:'idle',lastEventAt:null,context:null,counts:{},errors:0,truncated:false,events:[]});
      $('state-label').textContent='No Codex sessions found';stateText.textContent='Waiting';modelText.textContent='No local session';
      $('last-update').textContent='Start a local Codex chat, or try the simulated tour.';
    }
  }catch{if(!paused&&generation===requestGeneration){connected=false;connection('Reconnecting…',true);$('state-label').textContent='Connection lost · retrying';}}
  finally{busy=false;}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
window.addEventListener('focus',()=>poll());
poll();setInterval(poll,500);setInterval(()=>{if(!paused){updateAge();updateDurations();}},500);
