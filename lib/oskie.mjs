// Pack, unpack and check .oskie files. The validator is the engine's own
// (engine/oskiewar-game.mjs), so a file this accepts is a file the browser runs.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, extname, sep } from 'node:path';
import { validateGame, GAME_FORMAT, GAME_VERSION } from '../engine/oskiewar-game.mjs';

export const root = new URL('..', import.meta.url).pathname;
export const gamesDir = join(root, 'games');

const TEXT = new Map([
  ['.mjs', 'text/javascript'], ['.js', 'text/javascript'], ['.json', 'application/json'],
  ['.txt', 'text/plain'], ['.md', 'text/markdown'], ['.svg', 'image/svg+xml'],
  ['.lisp', 'text/plain'], ['.csv', 'text/csv'],
]);
const BINARY = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.gif', 'image/gif'],
  ['.webp', 'image/webp'], ['.wav', 'audio/wav'], ['.mp3', 'audio/mpeg'], ['.ogg', 'audio/ogg'],
  ['.glb', 'model/gltf-binary'], ['.woff2', 'font/woff2'], ['.ttf', 'font/ttf'],
]);

export function listGames() {
  if (!existsSync(gamesDir)) return [];
  return readdirSync(gamesDir).filter(name => existsSync(join(gamesDir, name, 'game.json'))).sort();
}

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    if (name.startsWith('.')) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// A game folder becomes one .oskie object: game.json is the manifest, every
// other file goes in `files` under its path inside the folder.
export function packGame(slug) {
  const dir = join(gamesDir, slug);
  const manifest = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8'));
  const files = {};
  for (const path of walk(dir)) {
    const name = relative(dir, path).split(sep).join('/');
    if (name === 'game.json') continue;
    const ext = extname(path).toLowerCase();
    if (TEXT.has(ext)) files[name] = { type: TEXT.get(ext), text: readFileSync(path, 'utf8') };
    else if (BINARY.has(ext)) files[name] = { type: BINARY.get(ext), base64: readFileSync(path).toString('base64') };
    else throw new Error(`${slug}: ${name} has a file type the format does not carry (${ext || 'none'})`);
  }
  return validateGame({ format: GAME_FORMAT, version: GAME_VERSION, manifest, files });
}

export function unpackGame(game, dir) {
  const checked = validateGame(game);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'game.json'), JSON.stringify(checked.manifest, null, 2) + '\n');
  for (const [name, file] of Object.entries(checked.files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.text ?? Buffer.from(file.base64, 'base64'));
  }
  return checked;
}

export const engineInfo = () => JSON.parse(readFileSync(join(root, 'engine/ENGINE.json'), 'utf8'));
