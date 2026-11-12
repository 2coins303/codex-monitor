// Project a small, explicit set of names. Never evaluate logged JavaScript.
export function decodeLiteral(value) {
  if (!value || !['"', "'", '`'].includes(value[0])) return null;
  if (value[0] === '`' && value.includes('${')) return null;
  try { if (value[0] === '"') return JSON.parse(value); } catch { return null; }
  return value.slice(1,-1).replace(/\\(u[0-9a-f]{4}|x[0-9a-f]{2}|[\s\S])/gi, (_,v) => v[0] === 'u' || v[0] === 'x' ? String.fromCharCode(parseInt(v.slice(1),16)) : ({n:'\n',r:'\r',t:'\t'}[v] ?? v));
}
export function literalFields(source) {
  const fields = {};
  const tokens = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[A-Za-z_]\w*/g;
  for (const token of source.matchAll(tokens)) {
    const key = decodeLiteral(token[0]) ?? token[0];
    if (!['path','file_path','filename','uri','url','ref_id','name','skill','title','cmd'].includes(key)) continue;
    const after = source.slice(token.index + token[0].length);
    const value = after.match(/^\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/);
    if (value) fields[key] = decodeLiteral(value[1]);
  }
  return fields;
}
const clean = value => String(value || '').replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,110);
const fileName = value => clean(String(value || '').split(/[\\/]/).filter(Boolean).slice(-2).join('/'));
const hostname = value => { try { const url=new URL(value); return /^https?:$/.test(url.protocol) ? url.host : ''; } catch { return ''; } };
export function describeOperation(name, input) {
  const source = typeof input === 'string' ? input : JSON.stringify(input || {});
  const fields = literalFields(source), n=name.toLowerCase();
  const command=fields.cmd || '';
  let label=name.replace(/^mcp__codex_apps__|^mcp__|^functions\./,'').replace(/__/g,' · '), detail='';
  if (/apply_patch/.test(n)) {
    label='Edit files';
    const patch=decodeLiteral(source.trim()) || source;
    const paths=[...patch.matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm)].map(m=>fileName(m[1]));
    detail=paths.slice(0,2).join(', ')+(paths.length>2?` +${paths.length-2}`:'');
  } else if (/read_file|write_file|view_image/.test(n)) {
    label=/write/.test(n)?'Write file':/image/.test(n)?'View image':'Read file';
    detail=fileName(fields.path||fields.file_path||fields.filename);
  } else if (/exec_command|shell/.test(n)) {
    // Commands are summarized by a known executable/verb, never by arguments.
    const kind=command.match(/\b(Get-Content|Get-ChildItem|Test-Path|rg|cat|ls|node|npm|python|git|curl|wget|Invoke-WebRequest|Invoke-RestMethod|Copy-Item|New-Item|Move-Item|Start-Process|Stop-Process)\b/i)?.[1];
    label=kind||'Shell command';
    if (/SKILL\.md/i.test(command)) {
      label='Read skill';
      const p=command.match(/[\\/]([^\\/\s'"`]+)[\\/]SKILL\.md/i);detail=p?clean(p[1]):'SKILL.md';
    }
  } else if (/web.*run/.test(n)) {
    label=/search_query|image_query/.test(source)?'Web search':/screenshot/.test(source)?'Page screenshot':'Web request';
    detail=hostname(fields.ref_id||fields.url);
  } else if (/cua.*js|browser|screenshot/.test(n)) {
    label=/getScreenshot|screenshot/.test(source)?'Capture view':/getAXState|domSnapshot/.test(source)?'Inspect page':/\.click\(|\.fill\(|\.press\(/.test(source)?'Interact with page':'Browser activity';
    // Only an explicitly named URL is projected. Browser code and page text stay private.
    detail=hostname(fields.url);
  } else if (/skill/.test(n)) {
    label='Read skill';detail=clean(fields.skill || fields.name || fileName(fields.path));
  } else if (/memory/.test(n)) label=/read|get|search/.test(n)?'Read memory':'Memory update';
  else if (/spawn_agent/.test(n)) label='Start agent';
  else if (/wait_agent/.test(n)) label='Wait for agents';
  else if (/send_message|followup_task/.test(n)) label='Agent message';
  else if (/hook/.test(n)) label='Hook event';
  else if (/request_user_input/.test(n)) label='Ask for input';
  return {label:clean(label),detail:clean(detail)};
}
