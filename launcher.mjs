import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {readConfig} from './config.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
export async function health(baseUrl) {
  try {
    const response=await fetch(`${baseUrl}/api/health`,{signal:AbortSignal.timeout(700),redirect:'error'});
    if(!response.ok)return 'occupied';
    return (await response.json()).app==='codex-activity-map'?'ready':'occupied';
  } catch(error) { return error.cause?.code==='ECONNREFUSED'?'absent':'unreachable'; }
}
export async function ensureServer(baseUrl) {
  const existing=await health(baseUrl);
  if(existing==='ready')return;
  if(existing!=='absent')throw new Error('The chosen port is occupied or not responding. Choose a different CODEX_MAP_PORT.');
  const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,env:process.env,detached:true,stdio:'ignore',windowsHide:true});
  let launchError=null;
  child.on('error',error=>{launchError=error;});
  child.unref();
  for(let i=0;i<32;i++){
    if(launchError)throw launchError;
    await delay(250);
    if(await health(baseUrl)==='ready')return;
  }
  throw new Error('Could not start Codex Monitor. Run npm start in this folder to see the error.');
}
function openBrowser(url) {
  const command=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';
  const child=spawn(command,[url],{stdio:'ignore',detached:true,windowsHide:true});
  child.on('error',()=>console.log(`Open ${url} in your browser.`));child.unref();
}
async function main(){
  const {baseUrl}=readConfig();await ensureServer(baseUrl);
  console.log(`Codex Monitor: ${baseUrl}`);
  if(!process.argv.includes('--server-only'))openBrowser(baseUrl);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
