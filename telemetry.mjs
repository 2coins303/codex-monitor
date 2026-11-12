import fs from 'node:fs';
import path from 'node:path';
import { describeOperation } from './details.mjs';

export const STATIONS = ['you', 'model', 'memory', 'files', 'shell', 'network', 'browser', 'agents', 'skills', 'hooks'];
const MAX_READ = 6 * 1024 * 1024;
const safeName = value => String(value || '').replace(/[^a-zA-Z0-9_.:/ -]/g, '').slice(0, 90);
const shortPath = value => String(value || '').split(/[\\/]/).filter(Boolean).pop() || 'Workspace';

export function classify(name, input = '') {
  const n = name.toLowerCase();
  if (/spawn_agent|send_message|followup_task|interrupt_agent|wait_agent|list_agents|collaboration/.test(n)) return 'agents';
  if (/hook/.test(n)) return 'hooks';
  if (/memory|memories/.test(n)) return 'memory';
  if (/skill/.test(n)) return 'skills';
  if (/cua|computer|browser|sky[_.]|screenshot/.test(n)) return 'browser';
  if (/apply_patch|view_image|read_file|write_file|list_files/.test(n)) return 'files';
  if (/web|search|fetch|imagegen|mcp__codex_apps|mcp__.*drive/.test(n)) return 'network';
  if (/exec_command|shell/.test(n)) {
    // Only classify arguments; never send command text to the browser.
    if (/SKILL\.md|[\\/]skills[\\/]/i.test(input)) return 'skills';
    if (/[\\/]memories[\\/]|MEMORY\.md/i.test(input)) return 'memory';
    if (/\b(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod|git (?:fetch|pull|clone))\b/i.test(input)) return 'network';
    if (/\b(?:Get-Content|Get-ChildItem|Test-Path|rg|cat|ls)\b/.test(input)) return 'files';
    return 'shell';
  }
  if (/request_user_input/.test(n)) return 'you';
  return 'shell';
}

export function operations(name, input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input || {});
  if (name === 'exec' || name === 'functions.exec') {
    // Mask literals/comments so source code passed to apply_patch is not counted as work.
    const code = text.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, value => ' '.repeat(value.length));
    const matches = [...code.matchAll(/\btools\.([A-Za-z0-9_]+)\s*\(/g)];
    if (matches.length) return matches.slice(0, 40).map(m => {
      const start=m.index+m[0].length;let end=start,depth=1;
      for(;end<code.length;end++){if(code[end]==='(')depth++;if(code[end]===')'&&!--depth)break;}
      const args=text.slice(start,end);
      return {name:safeName(m[1]),station:classify(m[1],args),...describeOperation(m[1],args)};
    });
  }
  return [{ name: safeName(name || 'Tool'), station: classify(name || '', text), ...describeOperation(name || 'Tool',input) }];
}

function failure(output) {
  // Restrict error detection to machine status fields, never ordinary prose.
  let text = typeof output === 'string' ? output : Array.isArray(output) ? output.map(b => b.text || '').join('\n') : JSON.stringify(output || {});
  text = text.slice(0, 120000);
  return /"isError"\s*:\s*true|"exit_code"\s*:\s*(?:-[1-9]\d*|[1-9]\d*)|Process exited with code [1-9]|^Error:|"status"\s*:\s*"rejected"/m.test(text);
}

export class Session {
  constructor(file, id) {
    this.file = file;
    this.id = id;
    this.offset = 0;
    this.partial = Buffer.alloc(0);
    this.events = [];
    this.pending = new Map();
    this.counts = Object.fromEntries(STATIONS.map(s => [s, 0]));
    this.errors = 0;
    this.model = 'Codex';
    this.project = 'Workspace';
    this.turnActive = false;
    this.lastEventAt = null;
    this.context = null;
    this.usageKey = '';
    this.modelSteps = 0;
    this.sequence = 0;
    this.truncated = false;
    this.readable = true;
    this.readMetadata();
  }
  readMetadata() {
    let fd;
    try {
      fd = fs.openSync(this.file, 'r');
      const data = Buffer.alloc(Math.min(fs.fstatSync(fd).size, 2 * 1024 * 1024));
      fs.readSync(fd, data, 0, data.length, 0);
      const end = data.indexOf(10);
      if (end >= 0) {
        const row = JSON.parse(data.subarray(0, end).toString('utf8'));
        this.project = shortPath(row.payload?.cwd);
      }
    } catch {} finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  add(station, name, time, status = 'done', callId = null) {
    const event = { id: `${this.id}:${++this.sequence}`, station, name: safeName(name), time, status, callId };
    this.events.push(event);
    this.counts[station]++;
    this.events = this.events.slice(-160);
    return event;
  }
  consume(row) {
    const p = row.payload || {};
    const time = row.timestamp || new Date().toISOString();
    this.lastEventAt = time;
    if (row.type === 'turn_context') {
      if (p.model && this.model !== 'Codex' && this.model !== safeName(p.model)) {
        const change=this.add('model','Model changed',time);
        change.label='Model changed';change.detail=`${this.model} → ${safeName(p.model)}`;
      }
      this.model = safeName(p.model || this.model);
      if (p.cwd) this.project = shortPath(p.cwd);
      return;
    }
    if (row.type === 'event_msg') {
      if (p.type === 'task_started') {
        this.turnActive = true;
        this.add('you', 'Turn started', time);
      }
      if (['task_complete', 'turn_aborted'].includes(p.type)) {
        this.turnActive = false;
        // A missing end event is unknown, never silently successful.
        for (const group of this.pending.values()) for (const e of group) if (e.status === 'running') e.status = 'unknown';
        this.pending.clear();
        this.add('model', p.type === 'task_complete' ? 'Turn complete' : 'Turn interrupted', time);
      }
      if (p.type === 'token_count' && p.info) {
        const used = p.info.last_token_usage?.input_tokens;
        const limit = p.info.model_context_window;
        if (Number.isFinite(used) && Number.isFinite(limit) && limit > 0) this.context = { used, limit, percent: Math.min(100, used / limit * 100), time };
        const usageKey=JSON.stringify([p.info.total_token_usage,p.info.last_token_usage,p.info.model_context_window]);
        if(usageKey!==this.usageKey){
          this.usageKey=usageKey;this.modelSteps++;
          const event=this.add('model','Model usage reported',time);
          event.label=this.model;event.detail=`usage ${this.modelSteps}`;
        }
      }
      return;
    }
    if (row.type === 'compacted') { this.add('memory', 'Context compacted', time); return; }
    if (row.type !== 'response_item') return;
    // Message contents, reasoning, credentials and tool result contents are never projected.
    if (['function_call', 'custom_tool_call'].includes(p.type)) {
      this.turnActive = true;
      const name = p.namespace ? `${p.namespace}.${p.name}` : p.name;
      const group = operations(name, p.arguments ?? p.input).map(op => Object.assign(this.add(op.station, op.name, time, 'running', p.call_id), {label:op.label,detail:op.detail}));
      this.pending.set(p.call_id, group);
      // Bound unmatched calls when logs are incomplete.
      if (this.pending.size > 200) this.pending.delete(this.pending.keys().next().value);
    }
    if (['function_call_output', 'custom_tool_call_output'].includes(p.type)) {
      const group = this.pending.get(p.call_id);
      if (group) {
        const failed = failure(p.output);
        for (const e of group) {
          e.status = failed ? (group.length > 1 ? 'batch-error' : 'error') : 'done';
          e.durationMs = Math.max(0, Date.parse(time) - Date.parse(e.time));
          e.completedAt = time;
        }
        if (failed) this.errors++;
        this.pending.delete(p.call_id);
      }
    }
  }
  poll() {
    let fd;
    try {
      const size = fs.statSync(this.file).size;
      this.readable = true;
      if (size < this.offset) {
        this.offset = 0; this.partial = Buffer.alloc(0); this.pending.clear();
        this.events = []; this.counts = Object.fromEntries(STATIONS.map(s => [s, 0])); this.errors = 0;
        this.context = null; this.turnActive = false; this.lastEventAt = null;
        this.usageKey = ''; this.modelSteps = 0;
        this.model = 'Codex'; this.truncated = false; this.readMetadata();
      }
      if (size === this.offset) return;
      let skipFirst = false;
      if (size - this.offset > MAX_READ) {
        this.offset = size - MAX_READ;
        this.partial = Buffer.alloc(0);
        this.truncated = true;
        skipFirst = true;
      }
      fd = fs.openSync(this.file, 'r');
      const buffer = Buffer.alloc(size - this.offset);
      const read = fs.readSync(fd, buffer, 0, buffer.length, this.offset);
      this.offset += read;
      const data = Buffer.concat([this.partial, buffer.subarray(0, read)]);
      let start = skipFirst ? data.indexOf(10) + 1 : 0;
      if (skipFirst && start === 0) { this.partial = Buffer.alloc(0); return; }
      let end;
      while ((end = data.indexOf(10, start)) >= 0) {
        try { this.consume(JSON.parse(data.subarray(start, end).toString('utf8'))); } catch {}
        start = end + 1;
      }
      this.partial = data.subarray(start);
      if (this.partial.length > MAX_READ) this.partial = Buffer.alloc(0);
    } catch { this.readable = false; } finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  snapshot() {
    const age = this.lastEventAt ? Date.now() - Date.parse(this.lastEventAt) : Infinity;
    const state = !this.readable ? 'unavailable' : !this.turnActive ? 'idle' : age > 90000 ? 'quiet' : this.pending.size ? 'working' : 'thinking';
    return {
      id: this.id, project: this.project, model: this.model, state,
      lastEventAt: this.lastEventAt, context: this.context, counts: this.counts,
      errors: this.errors, truncated: this.truncated, modelSteps: this.modelSteps,
      events: this.events.map(({ callId, ...e }) => ({ ...e, status: e.status === 'running' && Date.now() - Date.parse(e.time) > 90000 ? 'unconfirmed' : e.status }))
    };
  }
}

export function discover(root) {
  const files = [];
  const entries = dir => { try { return fs.readdirSync(dir, {withFileTypes:true}); } catch { return []; } };
  const directories = (dir, pattern) => entries(dir).filter(e=>e.isDirectory()&&pattern.test(e.name)).map(e=>e.name);
  for (const year of directories(root, /^\d{4}$/)) {
    const yearDir = path.join(root, year);
    for (const month of directories(yearDir, /^\d{2}$/)) {
      const monthDir = path.join(yearDir, month);
      for (const day of directories(monthDir, /^\d{2}$/)) {
        const dir = path.join(monthDir, day);
        for (const entry of entries(dir)) {
          if (!entry.isFile()) continue;
          const name = entry.name;
          const match = name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
          if (!match) continue;
          try { const file = path.join(dir, name); files.push({ id: match[1], file, modified: fs.statSync(file).mtimeMs }); } catch {}
        }
      }
    }
  }
  return files.sort((a, b) => b.modified - a.modified || a.id.localeCompare(b.id)).slice(0, 40);
}
