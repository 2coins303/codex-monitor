import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {readConfig} from '../config.mjs';

test('defaults resolve against the current user, with portable overrides',()=>{
  const config=readConfig({});
  assert.equal(config.sessionsRoot,path.join(os.homedir(),'.codex','sessions'));
  assert.equal(config.baseUrl,'http://127.0.0.1:43187');
  assert.equal(readConfig({CODEX_HOME:'/example/codex'}).sessionsRoot,path.join('/example/codex','sessions'));
  assert.equal(readConfig({CODEX_MAP_SESSIONS:'/example/logs',CODEX_MAP_PORT:'43188'}).sessionsRoot,'/example/logs');
  assert.equal(readConfig({CODEX_MAP_PORT:'43188'}).baseUrl,'http://127.0.0.1:43188');
});
test('invalid or privileged ports fail before starting a server',()=>{
  for(const port of ['0','80','1023','65536','-1','abc','43187.5'])assert.throws(()=>readConfig({CODEX_MAP_PORT:port}),/1024.*65535/);
});
