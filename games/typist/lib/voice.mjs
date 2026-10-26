// voice — each word, once typed, spoken back in @jeffrey's voice. Nothing is
// synthesized at play time: the clips are pre-rendered (ElevenLabs v4, the
// jeffrey-pvc voice; see NOTES.md → Voice), one per real word and one per
// consonant-vowel syllable spelt the way it sounds ("bah", "bee", "boo"), so
// a nonsense word like "boyu" is its syllables scheduled back to back on an
// AudioContext — any word the generator can make plays with no round trip.
// A missing clip means silence, never an error: the game plays without them.
const VOWEL = { a: "ah", e: "eh", i: "ee", o: "oh", u: "oo" };
export const clipName = (syl) => syl[0] + VOWEL[syl[1]];
export const partsOf = (word, real) => real ? [word] : (word.match(/[a-z][aeiou]/g) || []).map(clipName);

let ctx = null;
const buffers = new Map(), loading = new Map();
const context = () => (ctx ||= globalThis.AudioContext ? new AudioContext() : null);

function buffer(api, name) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name));
  if (!loading.has(name)) loading.set(name, (async () => {
    const url = api.asset(`voice/${name}.mp3`);
    if (!url || !context()) return null;
    const decoded = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
    buffers.set(name, decoded);
    return decoded;
  })().catch(() => null));
  return loading.get(name);
}

// Decode a hall's clips when the hall is laid, so they are ready when typed.
export function warm(api, names) { for (const name of names) buffer(api, name); }

const OVERLAP = .035;   // syllables run together a hair, like one word
// A whole word: its clips back to back.
export const speak = (api, word, real) => speakClips(api, partsOf(word, real));
// Any run of clips — one syllable as its vowel is typed, or a whole word.
export async function speakClips(api, names) {
  if (!context()) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const parts = await Promise.all(names.map((name) => buffer(api, name)));
  if (!parts.length || parts.some((b) => !b)) return;
  let at = ctx.currentTime + .09;
  for (const b of parts) {
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = b; gain.gain.value = .9;
    source.connect(gain).connect(ctx.destination);
    source.start(at);
    at += b.duration - OVERLAP;
  }
}
