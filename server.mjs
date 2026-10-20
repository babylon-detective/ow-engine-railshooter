#!/usr/bin/env node
// The local oskiewar engine: serves engine/ the way oskiewar.com does, one
// game per /play/<slug>, and reloads the page whenever a file under games/
// changes. No dependencies; `npm start`.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { root, listGames, packGame, engineInfo } from './lib/oskie.mjs';

const port = Number(process.env.PORT) || 7777;
const host = process.env.HOST || '127.0.0.1';
const engineDir = join(root, 'engine');
const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.json', 'application/json'],
  ['.svg', 'image/svg+xml'], ['.ttf', 'font/ttf'], ['.woff2', 'font/woff2'],
  ['.wav', 'audio/wav'], ['.png', 'image/png'],
]);

// Live reload: one event stream per open page. A save under games/<slug>/
// reloads the pages playing that game; a change to engine/ reloads them all.
const listeners = new Set();
const scopes = new Set();
let pending = null;
function changed(scope) {
  scopes.add(scope);
  clearTimeout(pending);
  pending = setTimeout(() => {
    for (const client of listeners)
      if (scopes.has('*') || client.slug === '*' || scopes.has(client.slug)) client.response.write('data: reload\n\n');
    console.log(`↻ ${[...scopes].map(s => s === '*' ? 'engine' : s).join(' ')}`);
    scopes.clear();
  }, 60);
}
watch(join(root, 'games'), { recursive: true }, (_, file) => file && changed(String(file).split(/[\\/]/)[0]));
watch(engineDir, { recursive: true }, () => changed('*'));

const reloadClient = slug => `<script>globalThis.__oskiewarGameUrl=${JSON.stringify('/oskie/' + slug)};
(()=>{const s=new EventSource(${JSON.stringify('/live?game=' + slug)});s.onmessage=()=>location.reload();})();</script>`;

function indexPage() {
  const engine = engineInfo();
  const rows = listGames().map(slug => {
    try {
      const { manifest } = packGame(slug);
      return `<li><a href="/play/${slug}">${manifest.title}</a> <small>${manifest.mode} · ${manifest.author || ''}</small><br>${manifest.description || ''}</li>`;
    } catch (error) {
      return `<li><b>${slug}</b> <span style="color:#c33">${error.message}</span></li>`;
    }
  }).join('');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>oskiewar engine</title><style>body{font:18px/1.5 system-ui;max-width:640px;margin:40px auto;padding:0 16px;background:#ebf1f8;color:#171b28}
a{color:#2b3fd6}li{margin:0 0 14px}small{color:#6e768d}</style>
<h1>oskiewar engine <small>build ${engine.build}</small></h1>
<ul>${rows || '<li>No games yet. <code>npm run new my-game</code></li>'}</ul>
<p><a href="/oskiewar">oskiewar itself</a>, for reference.</p>
<script>new EventSource('/live?game=*').onmessage=()=>location.reload()</script>`;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  const send = (status, body, type = 'text/plain; charset=utf-8') => {
    response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    response.end(body);
  };
  try {
    if (path === '/') return send(200, indexPage(), types.get('.html'));
    if (path === '/live') {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      response.write(': hi\n\n');
      const client = { slug: url.searchParams.get('game') || '*', response };
      listeners.add(client);
      request.on('close', () => listeners.delete(client));
      return;
    }
    const oskie = path.match(/^\/oskie\/([a-z][a-z0-9-]*)$/);
    if (oskie) return send(200, JSON.stringify(packGame(oskie[1])), 'application/json');
    const play = path.match(/^\/play\/([a-z][a-z0-9-]*)\/?$/);
    if (play || path === '/oskiewar') {
      let shell = await readFile(join(engineDir, 'mac-test.html'), 'utf8');
      if (play) {
        if (!existsSync(join(root, 'games', play[1], 'game.json'))) return send(404, 'no game ' + play[1]);
        shell = shell.replace('<head>', '<head>' + reloadClient(play[1]));
      }
      return send(200, shell, types.get('.html'));
    }
    // The engine asks a few oskiewar.com services on the way up. Offline,
    // each answers empty, and the engine treats that as "nothing to show".
    if (path.startsWith('/api/') || path.startsWith('/.netlify/') || path.startsWith('/oskiewar-'))
      if (!existsSync(join(engineDir, path))) return send(200, '{}', 'application/json');
    const file = normalize(join(engineDir, path));
    if (!file.startsWith(engineDir)) return send(403, 'no');
    const body = await readFile(file).catch(() => null);
    if (!body) return send(404, 'not found');
    send(200, body, types.get(extname(file)) || 'application/octet-stream');
  } catch (error) {
    console.error(error);
    send(500, String(error?.message || error));
  }
});
server.listen(port, host, () => {
  console.log(`oskiewar engine ${engineInfo().build} → http://localhost:${port}`);
  for (const slug of listGames()) console.log(`  http://localhost:${port}/play/${slug}`);
});
