import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'scripts/release-files.json'),'utf8'));
const allowed=new Set(manifest);
let files;
try { files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean); }
catch { files=[...manifest]; }
if(!files.length)files=[...manifest];
const failures=[];
for(const name of files){
  if(!allowed.has(name)){failures.push(`Unexpected release file: ${name}`);continue;}
  if(!fs.existsSync(path.join(root,name))){failures.push(`Missing release file: ${name}`);continue;}
  if(/\.(png|jpg|ico|gif|mp4)$/.test(name))continue;
  const text=fs.readFileSync(path.join(root,name),'utf8');
  const rules=[
    ['personal home directory',/(?:[A-Z]:[\\/]+Users[\\/]+(?!Public[\\/]|Default[\\/])|\/Users\/|\/home\/[a-z][a-z0-9_-]*\/)/i],
    ['credential',/\b(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_]{15,}/],
    ['private key',/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/],
    ['live rollout filename',/rollout-\d{4}-\d{2}-\d{2}T/]
  ];
  for(const [label,pattern] of rules)if(pattern.test(text))failures.push(`${label}: ${name}`);
}
for(const name of manifest)if(!fs.existsSync(path.join(root,name)))failures.push(`Missing release file: ${name}`);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log(`Release checks passed: ${files.length} allowlisted files; no private paths, tokens, keys, or live rollouts detected.`);
