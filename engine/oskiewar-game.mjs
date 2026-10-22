// Downstream games: one .oskie file is one game on the oskiewar engine.
// The format and the hook API are written down in GAME-SPEC.md. This module
// is shared: the web shell loads a game with it, and the oskiewar-engine
// CLI (pack, unpack, check) validates with the same function, so a file the
// CLI accepts is a file the browser runs.
export const GAME_FORMAT = 'ac.oskiewar.game';
export const GAME_VERSION = 1;
export const GAME_MODES = ['own', 'overlay'];
export const GAME_MAX_BYTES = 32 * 1024 * 1024;
const SLUG = /^[a-z][a-z0-9-]{1,31}$/;
const PATH = /^[a-z0-9_][a-z0-9_.-]*(\/[a-z0-9_][a-z0-9_.-]*)*$/i;

export function validateGame(value) {
  const fail = message => { throw new Error('.oskie: ' + message); };
  if (!value || value.format !== GAME_FORMAT || value.version !== GAME_VERSION)
    fail(`expected ${GAME_FORMAT} version ${GAME_VERSION}`);
  const m = value.manifest;
  if (!m || typeof m !== 'object') fail('missing manifest');
  if (!SLUG.test(m.slug || '')) fail('slug must be 2–32 of a-z, 0-9 and -, starting with a letter');
  if (typeof m.title !== 'string' || !m.title.trim() || m.title.length > 24)
    fail('title must be 1–24 characters');
  if (!GAME_MODES.includes(m.mode)) fail('mode must be "own" or "overlay"');
  const entry = m.entry ?? 'game.mjs';
  if (!value.files || typeof value.files !== 'object') fail('missing files');
  let bytes = 0;
  const files = {};
  for (const [path, file] of Object.entries(value.files)) {
    if (!PATH.test(path) || path.split('/').includes('..')) fail('bad file path ' + path);
    if (!file || typeof file.type !== 'string') fail('file ' + path + ' needs a type');
    const text = typeof file.text === 'string', base64 = typeof file.base64 === 'string';
    if (text === base64) fail('file ' + path + ' needs exactly one of text or base64');
    bytes += text ? file.text.length : Math.floor(file.base64.length * 3 / 4);
    files[path] = text ? { type: file.type, text: file.text } : { type: file.type, base64: file.base64 };
  }
  if (bytes > GAME_MAX_BYTES) fail('game is over 32 MB');
  if (typeof files[entry]?.text !== 'string') fail('entry ' + entry + ' is not a text file in files');
  const manifest = {
    slug: m.slug, title: m.title.trim(),
    author: typeof m.author === 'string' ? m.author.slice(0, 60) : '',
    description: typeof m.description === 'string' ? m.description.slice(0, 280) : '',
    mode: m.mode, entry, engine: Number.isInteger(m.engine) ? m.engine : 0,
    ...(m.map ? { map: m.map } : {}),
  };
  return { format: GAME_FORMAT, version: GAME_VERSION, manifest, files };
}

// Browser only. Every file becomes a blob URL; JavaScript modules have their
// relative imports ("./x.mjs") rewritten to their siblings' blob URLs first,
// so a game can be several modules without a server behind it.
export async function loadGame(source) {
  const raw = typeof source === 'string'
    ? await (await fetch(source, { cache: 'no-store' })).json() : source;
  const game = validateGame(raw);
  const urls = {}, pending = new Set();
  const isModule = path => /\.m?js$/.test(path);
  const toBlob = (body, type) => URL.createObjectURL(new Blob([body], { type }));
  const bytesOf = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  for (const [path, file] of Object.entries(game.files))
    if (!isModule(path)) urls[path] = toBlob(file.text ?? bytesOf(file.base64), file.type);
  const moduleUrl = path => {
    if (urls[path]) return urls[path];
    if (pending.has(path)) throw new Error('.oskie: import cycle through ' + path);
    const file = game.files[path];
    if (typeof file?.text !== 'string') throw new Error('.oskie: no module ' + path);
    pending.add(path);
    const base = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    const text = file.text.replace(/(\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.\.?\/[^"']+)\2/g,
      (match, lead, quote, specifier) => {
        const target = new URL(specifier, 'game:/' + base).pathname.slice(1);
        return lead + quote + moduleUrl(target) + quote;
      });
    pending.delete(path);
    return (urls[path] = toBlob(text, 'text/javascript'));
  };
  const mod = await import(moduleUrl(game.manifest.entry));
  // `files` rides along for the engine: a game's objects/*.lisp are defined
  // from it at boot (GAME-SPEC.md → Objects).
  return { manifest: game.manifest, mod, asset: path => urls[path] || null, files: game.files };
}
