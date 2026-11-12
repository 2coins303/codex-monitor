// Consecutive station visits fold before filtering, preserving the real route.
export function groupEvents(events) {
  const groups=[];
  for(const event of events){
    let group=groups.at(-1);
    const boundary=event.station==='you'||event.name==='Model changed'||/Turn complete|Turn interrupted/.test(event.name);
    if(!group||group.station!==event.station||boundary||group.boundary){
      group={id:event.id,station:event.station,events:[],boundary};groups.push(group);
    }
    group.events.push(event);
  }
  return groups.map(group=>{
    const events=group.events, latest=events.at(-1);
    const active=events.filter(e=>e.status==='running');
    const status=events.some(e=>e.status==='error')?'error':events.some(e=>e.status==='batch-error')?'batch-error':active.length?'running':events.some(e=>e.status==='unconfirmed')?'unconfirmed':events.some(e=>e.status==='unknown')?'unknown':'done';
    const durations=events.filter(e=>Number.isFinite(e.durationMs));
    // Wall-clock span avoids adding parallel calls' shared batch duration twice.
    const start=Math.min(...events.map(e=>Date.parse(e.time)));
    const end=Math.max(...durations.map(e=>Date.parse(e.completedAt)||Date.parse(e.time)+e.durationMs));
    return {...group,latest,count:events.length,active:active.length,status,start,durationMs:durations.length?Math.max(0,end-start):null};
  });
}
export function durationLabel(ms) {
  if(ms<1000)return `${Math.round(ms)} ms`;
  if(ms<60000)return `${(ms/1000).toFixed(1)} s`;
  return `${Math.floor(ms/60000)}m ${Math.floor(ms/1000)%60}s`;
}
export function groupStatus(group,now) {
  const duration=group.active?durationLabel(Math.max(0,now-group.start)):group.durationMs===null?'':durationLabel(group.durationMs);
  const status={'error':'Error','batch-error':'Batch error',running:'Running',unconfirmed:'Unconfirmed',unknown:'No finish recorded',done:''}[group.status];
  return [status,duration].filter(Boolean).join(' · ');
}
