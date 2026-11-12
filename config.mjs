import os from 'node:os';
import path from 'node:path';

export function readConfig(env=process.env) {
  const port=Number(env.CODEX_MAP_PORT || 43187);
  if(!Number.isInteger(port)||port<1024||port>65535) throw new Error('CODEX_MAP_PORT must be an integer between 1024 and 65535.');
  const home=env.CODEX_HOME || path.join(os.homedir(),'.codex');
  return {port,baseUrl:`http://127.0.0.1:${port}`,sessionsRoot:env.CODEX_MAP_SESSIONS || path.join(home,'sessions')};
}
