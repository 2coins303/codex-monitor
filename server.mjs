import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Session, discover } from './telemetry.mjs';
import { replaySnapshot } from './replay.mjs';
import { readConfig } from './config.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const {sessionsRoot,port}=readConfig();
const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const cache = new Map();
let catalog = [], lastScan = 0;
function scan() {
  if (Date.now() - lastScan > 3000) {
    catalog = discover(sessionsRoot); lastScan = Date.now();
    for (const [id] of cache) if (!catalog.some(s => s.id === id)) cache.delete(id);
  }
}
function getSession(id) {
  scan();
  const entry = catalog.find(s => s.id === id) || catalog[0];
  if (!entry) return null;
  if (!cache.has(entry.id)) {
    if (cache.size >= 8) cache.delete(cache.keys().next().value);
    cache.set(entry.id, new Session(entry.file, entry.id));
  }
  const session = cache.get(entry.id);
  session.poll();
  return session.snapshot();
}
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/feed.js', ['feed.js', 'text/javascript; charset=utf-8']],
  ['/open-local.js', ['open-local.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/icon.svg', ['icon.svg', 'image/svg+xml']]
]);
const server = http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  if (!allowedHosts.has(req.headers.host) || (req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin))) {
    res.writeHead(403); res.end('Local access only'); return;
  }
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  let url;
  try { url = new URL(req.url, `http://127.0.0.1:${port}`); }
  catch { res.writeHead(400);res.end('Invalid URL');return; }
  if (url.pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ app: 'codex-activity-map', version: '1.0.0' })); return;
  }
  if (url.pathname === '/api/state') {
    const state = getSession(url.searchParams.get('session'));
    const sessions = catalog.map(s => ({ id: s.id, modified: s.modified, project: cache.get(s.id)?.project || 'Codex session' }));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ now: new Date().toISOString(), state, sessions })); return;
  }
  if (url.pathname === '/api/test-tour') {
    const started = Number(url.searchParams.get('started'));
    if (!Number.isSafeInteger(started) || started < 1 || started > Date.now() + 5000) {
      res.writeHead(400); res.end('Invalid test start time'); return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ...replaySnapshot(started), sessions: [] })); return;
  }
  const asset = staticFiles.get(url.pathname);
  if (!asset) { res.writeHead(404); res.end('Not found'); return; }
  res.setHeader('Content-Type', asset[1]);
  const stream=fs.createReadStream(path.join(root,'public',asset[0]));
  stream.on('error',()=>{if(!res.headersSent)res.writeHead(500);res.end('Asset unavailable');});
  stream.pipe(res);
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use.` : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Codex Monitor: http://127.0.0.1:${port}`));
