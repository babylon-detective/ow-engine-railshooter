#!/usr/bin/env node
// oskie new <slug> [--overlay]   scaffold games/<slug>
// oskie pack <slug>              games/<slug> → dist/<slug>.oskie
// oskie build <slug>             games/<slug> → dist/<slug>/, a static site (Vercel etc.)
// oskie unpack <file.oskie>      → games/<slug>
// oskie check [slug]             validate one game, or all of them
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { root, gamesDir, listGames, packGame, unpackGame, engineInfo } from '../lib/oskie.mjs';

const [command, target, ...flags] = process.argv.slice(2);
const die = message => { console.error(message); process.exit(1); };

if (command === 'new') {
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(target || '')) die('usage: npm run new <slug>   (a-z, 0-9, -; 2–32 long)');
  const dir = join(gamesDir, target);
  if (existsSync(dir)) die(`games/${target} already exists`);
  const template = flags.includes('--overlay') ? 'overlay' : 'own';
  cpSync(join(root, 'templates', template), dir, { recursive: true });
  const manifestPath = join(dir, 'game.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  Object.assign(manifest, { slug: target, title: target, engine: engineInfo().build });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`games/${target} (${template}) → npm start, then http://localhost:7777/play/${target}`);
} else if (command === 'pack') {
  if (!target) die('usage: npm run pack <slug>');
  const game = packGame(target);
  mkdirSync(join(root, 'dist'), { recursive: true });
  const out = join(root, 'dist', target + '.oskie');
  writeFileSync(out, JSON.stringify(game));
  console.log(`dist/${target}.oskie · ${Object.keys(game.files).length} files · ${(readFileSync(out).length / 1024).toFixed(1)} KB`);
} else if (command === 'build') {
  // A static site: the engine, the game as /game.oskie, and an index.html
  // that loads it. Deploy the folder anywhere that serves files (Vercel:
  // `vercel deploy dist/<slug>`).
  if (!target) die('usage: npm run build <slug>');
  const game = packGame(target);
  const out = join(root, 'dist', target);
  rmSync(out, { recursive: true, force: true });
  cpSync(join(root, 'engine'), out, { recursive: true, filter: source => !source.endsWith('README.md') });
  writeFileSync(join(out, 'game.oskie'), JSON.stringify(game));
  const shell = readFileSync(join(root, 'engine/mac-test.html'), 'utf8');
  writeFileSync(join(out, 'index.html'), shell.replace('<head>',
    '<head><script>globalThis.__oskiewarGameUrl="/game.oskie";</script>'));
  writeFileSync(join(out, 'vercel.json'), JSON.stringify({
    framework: null,
    installCommand: '',
    buildCommand: '',
    outputDirectory: '.',
    headers: [{ source: '/(.*)', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }],
  }, null, 2) + '\n');
  console.log(`dist/${target}/ → a static site; deploy it with: vercel deploy dist/${target} --prod`);
} else if (command === 'unpack') {
  if (!target) die('usage: npm run unpack <file.oskie>');
  const game = JSON.parse(readFileSync(target, 'utf8'));
  const slug = game?.manifest?.slug;
  const dir = join(gamesDir, String(slug));
  if (existsSync(dir) && !flags.includes('--force')) die(`games/${slug} exists; add --force to overwrite`);
  unpackGame(game, dir);
  console.log(`games/${slug}`);
} else if (command === 'check') {
  let failed = false;
  for (const slug of target ? [target] : listGames()) {
    try {
      const { manifest } = packGame(slug);
      const behind = manifest.engine && manifest.engine !== engineInfo().build
        ? ` (made on engine ${manifest.engine}, running ${engineInfo().build})` : '';
      console.log(`ok   ${slug}${behind}`);
    } catch (error) { failed = true; console.log(`FAIL ${slug}: ${error.message}`); }
  }
  if (failed) process.exit(1);
} else {
  die('oskie new <slug> [--overlay] | pack <slug> | build <slug> | unpack <file.oskie> | check [slug]');
}
