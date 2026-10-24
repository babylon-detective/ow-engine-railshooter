// typist — a typing rail shooter, like typing of the dead on the showroom's
// hall (@jeffrey + Artur, 2026-10-23). The hero glides toward a door with one
// switch per word. You type the word; every letter is a sub-action — the
// hero turns a little further toward the switch with each correct one, and
// on the last letter the arm comes up, the shot lands, the switch drops, and
// the hero turns back. A wrong letter costs one letter of progress: you only
// partially get there. Reach the door with a word unfinished and the hero
// smashes into it and breaks apart — limbs and chips bounce off the door and
// skid along the floor (@jeffrey, 2026-10-24: no standing at the door
// waiting). With a heart left the pieces pull back together a way down the
// hall and the glide resumes; the word keeps what you typed — a smash costs
// a heart, never your letters (@jeffrey, 2026-10-23). The third smash leaves
// the pieces where they fell. Each word, once typed, is spoken back in
// @jeffrey's voice (lib/voice.mjs). One word at a time, nothing to aim.
// World units are the engine's: y grows DOWN, the floor is at 1800. Halls
// run along +z. See NOTES.md.

import { drawGlyph, glyphWidth } from "./lib/bigtext.mjs";
import { speak, speakClips, warm, partsOf, clipName } from "./lib/voice.mjs";

// Every letter is a note on notepat's keyboard (disks/notepat.mjs): the
// white keys c d e f g a b are themselves, v s w r q the sharps between
// them, h i j k l m n the octave above with t y u o p its sharps, z and x
// the a# and b below. Semitones from middle C; a correct letter sounds its
// note, quietly, under the speech.
const NOTE = { c: 0, v: 1, d: 2, s: 3, e: 4, f: 5, w: 6, g: 7, r: 8, a: 9, q: 10, b: 11,
  h: 12, t: 13, i: 14, y: 15, j: 16, k: 17, u: 18, l: 19, o: 20, m: 21, p: 22, n: 23, z: -2, x: -1 };
const hz = (letter) => 261.63 * 2 ** ((NOTE[letter] ?? 0) / 12);

// Screen flashes, with no alpha to fade: a whole-screen wash for the first
// two ticks, then bands along the edges that thin out. Yellow for a letter,
// light green for a word, red for a wrong letter or a bump.
const YELLOW = [255, 236, 120], GREEN = [150, 255, 170], RED = [220, 30, 40];
function flash(col, life) { S.fx.push({ col, life, max: life }); }

const FLOOR = 1800, HALF = 300, HEIGHT = 500, HALL = 1500;
const EYE = FLOOR - 230, AHEAD = 230;
// The pace climbs with every door and with a clean run: doors cleared add
// to it (less past the eighth, where the all-three-syllable combos begin),
// accuracy over 90% adds more, under 75% eases off. A hall with a single
// long word glides faster — one word is less to type — and every hall
// starts gently, ramping to full pace over its first third, so a new kind of
// door is not also a wall of speed. The hero sprints once a door's words
// are done.
function pace(h = current()) {
  const acc = S.typed + S.wrong ? S.typed / (S.typed + S.wrong) : 1;
  const skill = acc > .9 ? (acc - .9) * 8 : acc < .75 ? -(.75 - acc) * 4 : 0;
  const doors = Math.min(S.run, 7) * .28 + Math.max(0, S.run - 7) * .12;
  const solo = h && h.targets.length === 1 && h.targets[0].word.length >= 6 ? 1.35 : 1;
  const ease = h ? .6 + .4 * Math.min(1, Math.max(0, S.s - h.z0) / (HALL / 3)) : 1;
  return Math.max(1.4, Math.min(6, 1.9 + doors + skill)) * solo * ease;
}
const SPRINT = 4.2;
const S = { t: 0, s: 0, halls: [], run: 0, best: 0, hearts: 3, miss: 0, prev: new Set(),
  shot: null, bump: 0, dead: 0, typed: 0, wrong: 0, over: false, beat: 0, api: null, fx: [], cues: [], smash: null, shards: [] };

// Words: real short ones on even halls, syllable nonsense ("boyu popo rebo")
// on odd ones — three action events, in letters.
const REAL = ["sun", "dog", "run", "key", "map", "cat", "ink", "fox", "box", "jam", "wave", "door", "lamp", "frog", "moon",
  "sand", "ring", "wind", "milk", "star", "path", "leaf", "rock", "bird", "fish", "road", "gate", "drum", "kite", "nest"];
const C = "bdfgjklmnprstvz", V = "aeiou";
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (list) => list[(rnd() * list.length) | 0];
const syllables = (n) => { let w = ""; for (let i = 0; i < n; i++) w += pick(C) + pick(V); return w; };
// A word by syllable count: one syllable is a real short word, two and
// three are nonsense. The doors, in order (@jeffrey, 2026-10-23: "move
// faster on single 3 syllable words, then mixed 1 and 2 and 3 syllable,
// before combos of all three syllables"):
//   1-2  one word, one then two syllables — learn the keys
//   3-4  a single three-syllable word, at the faster solo glide
//   5-6  two words of mixed length;  7-8  three words of mixed length
//   9+   three words of three syllables each
const word = (syl) => syl === 1 ? pick(REAL) : syllables(syl);
function phraseFor(index) {
  if (index < 2) return [word(index + 1)];
  if (index < 4) return [word(3)];
  if (index < 8) return Array.from({ length: index < 6 ? 2 : 3 }, () => word(1 + ((rnd() * 3) | 0)));
  return [word(3), word(3), word(3)];
}

// A hall: from z0 to z0 + HALL, its door at the far end, a switch per word.
function hall(index, z0) {
  const words = phraseFor(index);
  const n = words.length, size = 110;
  const targets = words.map((word, i) => ({ word, real: REAL.includes(word), typed: 0, done: false, hit: 0,
    x: (i - (n - 1) / 2) * 190, y: FLOOR - HEIGHT * .55, z: z0 + HALL, w: size, h: size }));
  if (S.api) warm(S.api, targets.flatMap((t) => partsOf(t.word, t.real)));
  return { index, z0, z1: z0 + HALL, open: 0, targets, at: 0, jolt: 0 };
}

function restart() {
  S.halls = [hall(0, 0), hall(1, HALL)];
  Object.assign(S, { s: 0, run: 0, hearts: 3, dead: 0, typed: 0, wrong: 0, over: false, bump: 0, shot: null, beat: 0, fx: [], cues: [], smash: null, shards: [] });
}
export function boot(api) { S.api = api; api.cursor("none"); restart(); }

const current = () => S.halls[0];
const active = (h) => h.targets[h.at] || null;

// Keys: letters only, one press each; space between words is free.
const LETTER = /^Key([A-Z])$/;
export function sim(api) {
  if (S.freeze) return;   // a test harness can hold a frame still
  S.t++;
  const keys = new Set(api.keys());
  const h = current(), tg = active(h);
  for (const k of keys) {
    if (S.prev.has(k)) continue;
    // the run is over: space or enter go again at once, any letter after a
    // moment (so the word you were mid-way through does not restart it)
    if (S.over) { if (k === "Enter" || k === "Space" || (S.dead > 45 && LETTER.test(k))) restart(); continue; }
    const m = LETTER.exec(k);
    if (!m || !tg || tg.done || S.smash) continue;
    const letter = m[1].toLowerCase();
    if (letter === tg.word[tg.typed]) {
      tg.typed++; S.typed++;
      api.tone(hz(letter), .09);
      flash(YELLOW, 5);
      // the speech arrives as you type: a nonsense word's syllable is heard
      // the moment its vowel lands; a real word is spoken whole at the shot
      if (!tg.real && tg.typed % 2 === 0) speakClips(api, [clipName(tg.word.slice(tg.typed - 2, tg.typed))]);
      if (tg.typed === tg.word.length) shoot(api, h, tg);
    } else {
      // a wrong letter: only partly there — one letter of progress lost,
      // a red flash and a two-note fall
      tg.typed = Math.max(0, tg.typed - 1); S.wrong++; S.miss = 8;
      flash(RED, 8);
      api.drum("block", .7, 0); api.tone(hz("x") / 2, .1);
      S.cues.push({ at: S.t + 4, tone: hz("z") / 4, seconds: .16 });
    }
  }
  S.prev = keys;
  S.cues = S.cues.filter((c) => { if (c.at > S.t) return true; api.tone(c.tone, c.seconds); return false; });
  for (const f of S.fx) f.life--;
  S.fx = S.fx.filter((f) => f.life > 0);
  if (S.shot) { S.shot.life--; if (S.shot.life <= 0) S.shot = null; }
  if (S.miss > 0) S.miss--;
  if (S.bump > 0) S.bump--;
  for (const t of h.targets) if (t.hit > 0) t.hit--;
  for (const hh of S.halls) if (hh.jolt > 0) hh.jolt *= .82;
  if (S.over) { S.dead++; stepShards(); }
  else if (S.smash) stepSmash(api, h);
  else {
    beat(api, h);
    if (h.open) h.open = Math.min(1, h.open + .035);
    // words done: sprint through the door; otherwise glide at the run's pace,
    // straight into the door if it is still shut
    S.s += h.open ? pace(h) * SPRINT : pace(h);
    if (!h.open && S.s >= h.z1 - 70) smashInto(api, h);
    // Through an open door: the hall behind is done, a new one is laid ahead.
    if (S.s > h.z1 + 60 && h.open) {
      S.halls.shift(); const last = S.halls[S.halls.length - 1];
      S.halls.push(hall(last.index + 1, last.z1)); S.run++; S.best = Math.max(S.best, S.run);
      api.drum("bell", .7, 0);
    }
  }
  // the camera rides 420 behind the hero; on a smash it cuts back so the
  // burst plays out in front of the door, and comes forward again as the
  // hero re-forms (over, it stays back on the pieces)
  let pull = 0;
  if (S.over) pull = 380 * Math.min(1, S.dead / 6);
  else if (S.smash) { const m = S.smash; pull = m.t <= BURST ? 380 * Math.min(1, m.t / 6) : 380 * (1 - Math.min(1, (m.t - BURST) / GATHER)); }
  api.camera({ position: [90, EYE - 40 - pull * .1, S.s - 420 - pull], target: [-10, EYE + 70, S.s + 600], fov: 74 });
}

// ——— the beat: a kit under the hall, keeping time with the glide ———
// Kick on one and three, snare on two and four, hats on the eighths; the
// tempo follows the pace, so a hall that eases in also counts in, and the
// sprint through a cleared door rides double-time hats. Quiet enough that
// the letter tones sit on top. S.beat counts sixteenths; a step plays when
// the count crosses a whole number.
const EIGHTHS = [["kick", .75, 0], ["hat", .22, -.3], ["snare", .45, 0], ["hat", .22, .3], ["kick", .75, 0], ["hat", .22, -.3], ["snare", .45, 0], ["hat", .3, .3]];
function beat(api, h) {
  const bpm = 96 + pace(h) * 12, sprinting = h.open > 0 && h.open < 1;
  const was = Math.floor(S.beat);
  S.beat += bpm / 900;   // sixteenths per tick, at sixty ticks a second
  const now = Math.floor(S.beat);
  if (now === was) return;
  const step = now % 16;
  if (step % 2 === 0) { const [name, amount, pan] = EIGHTHS[step / 2]; api.drum(name, amount, pan); }
  else if (sprinting) api.drum("hat", .16, step % 4 === 1 ? .5 : -.5);
}

function shoot(api, h, tg) {
  tg.done = true; tg.hit = 16; flash(GREEN, 10);
  S.shot = { life: 10, from: hand(h, tg), to: [tg.x, tg.y, tg.z - 2] };
  api.drum("kick", 1.4, 0); api.drum("clap", 1, 0); api.drum("glass-shard", 1.2, .3);
  if (tg.real) speak(api, tg.word, true);
  h.at++;
  if (h.targets.every((t) => t.done)) { h.open = .01; api.drum("gong", .5, 0); }
}

// ——— the smash: the hero hits a shut door and breaks apart ———
// Every limb becomes a shard — a lit quad the size of the segment, in its
// colour — plus a handful of chips. They bounce off the door (back down the
// hall), up, and out, under gravity, and skid along the floor. With a heart
// left, after the burst the shards are drawn back to where the limbs belong
// on a hero re-forming a way back down the hall, and the glide goes on
// (@jeffrey, 2026-10-24: the failure should have the character smash into
// the door and break apart, not wait there).
const SKIN = [226, 188, 150], HAIR = [96, 66, 48], ARM_R = [168, 130, 214], LEG_L = [26, 26, 40];
const PIECES = [
  { a: "head", b: "head", w: 42, l: 42, col: SKIN }, { a: "head", b: "head", w: 40, l: 18, col: HAIR, up: 16 },
  { a: "neck", b: "pelvis", w: 34, col: SKIN },
  { a: "shoulder-l", b: "elbow-l", w: 11, col: SKIN }, { a: "elbow-l", b: "hand-l", w: 10, col: SKIN },
  { a: "shoulder-r", b: "elbow-r", w: 11, col: ARM_R }, { a: "elbow-r", b: "hand-r", w: 10, col: ARM_R },
  { a: "hip-l", b: "knee-l", w: 13, col: LEG_L }, { a: "knee-l", b: "foot-l", w: 12, col: LEG_L },
  { a: "hip-r", b: "knee-r", w: 13, col: SKIN }, { a: "knee-r", b: "foot-r", w: 12, col: SKIN },
];
const BURST = 42, GATHER = 30;
const mid = (J, pc) => { const a = J[pc.a], b = J[pc.b]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - (pc.up || 0), (a[2] + b[2]) / 2]; };
function shard(pc, J) {
  const a = J[pc.a], b = J[pc.b], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d);
  // the quad's own axes: along the limb, and across it; spin about a random axis
  const u1 = L > 1 ? d.map((v) => v / L) : [0, 1, 0];
  let u2 = Math.abs(u1[1]) < .9 ? [-u1[2], 0, u1[0]] : [1, 0, 0];   // u1 × up, or x when the limb is upright
  const m = Math.hypot(...u2) || 1; u2 = u2.map((v) => v / m);
  const ax = [rnd() - .5, rnd() - .5, rnd() - .5], am = Math.hypot(...ax) || 1;
  return { pc, p: mid(J, pc), v: [(rnd() - .5) * 9, -(3 + rnd() * 8), -(3 + rnd() * 6)], u1, u2, axis: ax.map((v) => v / am),
    spin: (rnd() - .5) * .5, hl: (pc.l || L) / 2, hw: pc.w / 2, col: pc.col, rest: 0 };
}
function smashInto(api, h) {
  S.hearts--; flash(RED, 18); h.jolt = 16;
  api.drum("body-impact", 1.8, 0); api.drum("glass-shard", 1.5, -.2); api.drum("whoosh", .9, .2);
  const J = pose(h);
  S.shards = PIECES.map((pc) => shard(pc, J));
  for (let i = 0; i < 10; i++) {
    const c = shard({ a: "pelvis", b: "neck", w: 6 + rnd() * 9, l: 6 + rnd() * 9, col: [SKIN, HAIR, ARM_R, LEG_L][(rnd() * 4) | 0] }, J);
    c.v = [(rnd() - .5) * 16, -(4 + rnd() * 12), -(4 + rnd() * 9)]; c.spin *= 2; S.shards.push(c);
  }
  S.smash = { t: 0, from: S.s, to: Math.max(h.z0 + 120, S.s - 720) };
  if (S.hearts <= 0) { S.over = true; S.dead = 0; S.smash = null; api.drum("gong", 1, 0); }
}
// an axis-angle turn of a vector (Rodrigues)
function turn(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const cr = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [0, 1, 2].map((i) => v[i] * c + cr[i] * s + k[i] * dot * (1 - c));
}
function stepShards() {
  const h = current();
  for (const d of S.shards) {
    d.v[1] += .55; for (let i = 0; i < 3; i++) d.p[i] += d.v[i];
    const floor = FLOOR - Math.min(d.hw, 6);
    if (d.p[1] > floor) { d.p[1] = floor; d.v[1] *= -.42; d.v[0] *= .72; d.v[2] *= .72; d.spin *= .55; if (Math.abs(d.v[1]) < .6) { d.v[1] = 0; d.rest++; } }
    if (Math.abs(d.p[0]) > HALF - 8) { d.p[0] = Math.sign(d.p[0]) * (HALF - 8); d.v[0] *= -.5; }
    if (d.p[2] > h.z1 - 10) { d.p[2] = h.z1 - 10; d.v[2] *= -.5; }
    if (d.spin) { d.u1 = turn(d.u1, d.axis, d.spin); d.u2 = turn(d.u2, d.axis, d.spin); }
  }
}
function stepSmash(api, h) {
  const m = S.smash; m.t++;
  if (m.t <= BURST) { stepShards(); return; }
  // gathering: the camera eases back down the hall and every shard is drawn
  // to its limb's place on the hero standing there
  const k = Math.min(1, (m.t - BURST) / GATHER), e = k * k * (3 - 2 * k);
  S.s = m.from + (m.to - m.from) * e;
  const J = pose(h);
  for (const d of S.shards) {
    const to = mid(J, d.pc), w = .12 + .5 * k;
    for (let i = 0; i < 3; i++) d.p[i] += (to[i] - d.p[i]) * w;
    d.spin *= .8; if (d.spin) { d.u1 = turn(d.u1, d.axis, d.spin); d.u2 = turn(d.u2, d.axis, d.spin); }
  }
  if (m.t === BURST + 1) api.drum("whoosh", .6, -.3);
  if (k >= 1) { S.smash = null; S.shards = []; S.bump = 45; api.drum("block", .9, 0); api.tone(hz("c"), .12); }
}
function drawShards(api) {
  for (const d of S.shards) {
    const e1 = d.u1.map((v) => v * d.hl), e2 = d.u2.map((v) => v * d.hw), c = d.p;
    const a = [c[0] + e1[0] + e2[0], c[1] + e1[1] + e2[1], c[2] + e1[2] + e2[2]], b = [c[0] + e1[0] - e2[0], c[1] + e1[1] - e2[1], c[2] + e1[2] - e2[2]];
    const cc = [c[0] - e1[0] - e2[0], c[1] - e1[1] - e2[1], c[2] - e1[2] - e2[2]], dd = [c[0] - e1[0] + e2[0], c[1] - e1[1] + e2[1], c[2] - e1[2] + e2[2]];
    quad(api, a, b, cc, dd, d.col); quad(api, dd, cc, b, a, d.col);
  }
}

// ——— the hero: sixteen joints, posed by the word's progress ———
// Standing at z = S.s facing +z. Progress turns the body toward the active
// switch and raises the right arm along the line to it; the head leads.
const HERO_X = -110;
const angleTo = (tg) => Math.atan2(tg.x - HERO_X, tg.z - S.s);
function progressOf(h) {
  const tg = active(h);
  if (!tg) return { k: 0, tg: null };
  return { k: tg.done ? 0 : tg.typed / tg.word.length, tg };
}
function pose(h) {
  const { k, tg } = progressOf(h);
  const turn = tg ? angleTo(tg) * Math.min(1, k * 1.15) : 0;
  const sprinting = h.open > 0 && h.open < 1;
  const stride = Math.sin(S.s / (sprinting ? 16 : 26)) * (S.smash || S.over ? 0 : 1) * (sprinting ? 1.4 : 1);
  const bob = Math.abs(Math.cos(S.s / (sprinting ? 16 : 26))) * (sprinting ? 7 : 4);
  const z0 = S.s, y = (up) => FLOOR - up + bob;
  // local: x right, up, z forward; turned about the pelvis, then placed
  const c = Math.cos(turn), s = Math.sin(turn);
  const P = (x, up, dz) => [HERO_X + x * c + dz * s, y(up), z0 - x * s + dz * c];
  const J = {
    head: P(0, 196, 0), neck: P(0, 170, 0), pelvis: P(0, 100, 0),
    "shoulder-l": P(-20, 168, 0), "shoulder-r": P(20, 168, 0),
    "elbow-l": P(-25, 132, 4), "hand-l": P(-26, 96, 10),
    "hip-l": P(-11, 95, 0), "hip-r": P(11, 95, 0),
    "knee-l": P(-12, 50, stride * 10), "knee-r": P(12, 50, -stride * 10),
    "foot-l": P(-13, 0, stride * 22), "foot-r": P(13, 0, -stride * 22),
  };
  // the right arm: down at rest, out along the line to the switch as the word completes
  const rest = { e: P(25, 132, 4), h: P(26, 96, 10) };
  if (tg && k > 0) {
    const sh = J["shoulder-r"], d = [tg.x - sh[0], tg.y - sh[1], tg.z - sh[2]], L = Math.hypot(...d) || 1;
    const u = d.map((v) => v / L), raise = Math.min(1, k * 1.25);
    const e = [sh[0] + u[0] * 26, sh[1] + u[1] * 26 + 6, sh[2] + u[2] * 26], hd = [sh[0] + u[0] * 56, sh[1] + u[1] * 56, sh[2] + u[2] * 56];
    J["elbow-r"] = rest.e.map((v, i) => v + (e[i] - v) * raise);
    J["hand-r"] = rest.h.map((v, i) => v + (hd[i] - v) * raise);
  } else { J["elbow-r"] = rest.e; J["hand-r"] = rest.h; }
  // the head looks at the switch from the first letter on
  const hd = J.head;
  if (tg) {
    const d = [tg.x - hd[0], tg.y - hd[1], tg.z - hd[2]], L = Math.hypot(...d) || 1;
    const f = [s, 0, c], w = Math.min(1, k * 2 + .15);
    const look = [0, 1, 2].map((i) => f[i] + (d[i] / L - f[i]) * w), m = Math.hypot(...look) || 1;
    J.look = look.map((v, i) => hd[i] + v / m * 22);
  } else J.look = [hd[0] + s * 22, hd[1], hd[2] + c * 22];
  return J;
}
const hand = (h, tg) => pose(h)["hand-r"];

// ——— drawing ———
function lit(api, a, b, c, col) { const k = api.shade(...a, ...b, ...c); api.face(...a, ...b, ...c, col[0] * k, col[1] * k, col[2] * k); }
function quad(api, a, b, c, d, col) { lit(api, a, b, c, col); lit(api, a, c, d, col); }

function drawHall(api, h) {
  const tint = h.index % 2 ? 1 : .9;
  const floor = [150, 140, 150].map((v) => v * tint), wall = [184, 170, 176].map((v) => v * tint), ceiling = [110, 100, 112];
  const z0 = Math.max(h.z0, S.s - 500), z1 = h.z1;
  for (let z = z0; z < z1; z += 340) {
    const za = z, zb = Math.min(z1, z + 340), stripe = (((z - h.z0) / 340) | 0) % 2 ? 1 : .93;
    quad(api, [-HALF, FLOOR, za], [HALF, FLOOR, za], [HALF, FLOOR, zb], [-HALF, FLOOR, zb], floor.map((v) => v * stripe));
    quad(api, [-HALF, FLOOR - HEIGHT, zb], [HALF, FLOOR - HEIGHT, zb], [HALF, FLOOR - HEIGHT, za], [-HALF, FLOOR - HEIGHT, za], ceiling);
    quad(api, [-HALF, FLOOR, zb], [-HALF, FLOOR - HEIGHT, zb], [-HALF, FLOOR - HEIGHT, za], [-HALF, FLOOR, za], wall);
    quad(api, [HALF, FLOOR, za], [HALF, FLOOR - HEIGHT, za], [HALF, FLOOR - HEIGHT, zb], [HALF, FLOOR, zb], wall);
  }
  // the door lifts once every switch is down (cut around the switches) and
  // jolts when the hero hits it
  const lift = h.open * HEIGHT + Math.sin(S.t * 1.9) * h.jolt, z = z1, top = FLOOR - HEIGHT, bottom = FLOOR - lift;
  const door = h.open ? [70, 120, 80] : [58, 50, 60];
  const slab = (xa, xb, ya, yb) => { if (xb > xa && yb > ya) quad(api, [xa, yb, z], [xb, yb, z], [xb, ya, z], [xa, ya, z], door); };
  if (lift >= HEIGHT) return;
  const ts = h.targets.slice().sort((a, b) => a.x - b.x);
  let x = -HALF;
  for (const t of ts) {
    const hw = t.w / 2, hh = t.h / 2, sy0 = t.y - hh - lift, sy1 = t.y + hh - lift;
    slab(x, t.x - hw, top, bottom);
    slab(t.x - hw, t.x + hw, top, Math.min(bottom, sy0));
    slab(t.x - hw, t.x + hw, Math.max(top, sy1), bottom);
    x = t.x + hw;
    const isActive = active(h) === t;
    const col = t.hit > 0 ? [255, 40, 40] : t.done ? [90, 110, 90] : isActive ? [250, 240, 160] : [230, 232, 240];
    const disc = t.hit > 0 ? [255, 40, 40] : t.done ? [70, 80, 70] : isActive ? [240, 90, 60] : [120, 90, 120];
    const cx = t.x, cy = t.y - lift, zf = z - 1, r = t.w * .28, n = 16, rim = [], edge = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      rim.push([cx + ca * r, cy + sa * r, zf]);
      const reach = hh / Math.max(Math.abs(ca), Math.abs(sa));
      edge.push([cx + ca * reach, cy + sa * reach, zf]);
    }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; api.face(cx, cy, zf, ...rim[i], ...rim[j], ...disc); quad(api, rim[j], rim[i], edge[i], edge[j], col); }
  }
  slab(x, HALF, top, bottom);
}

// Text: one size for every reading, as oskiewar's hud, each with a drop
// shadow two over and three down so it reads over the hall.
const TYPE = 28, INK = [12, 10, 20];
function write(api, text, x, y, col) { api.write(text, x + 2, y + 3, TYPE, ...INK); api.write(text, x, y, TYPE, ...col); }
const centre = (api, text, width) => (width - api.textWidth(text, TYPE)) / 2;
// Block letters with a shadow: a dark copy a third of a cell over and down.
function glyph(api, ch, x, y, cell, col) { drawGlyph(api, ch, x + cell * .3, y + cell * .35, cell, ...INK); drawGlyph(api, ch, x, y, cell, ...col); }
// The phrase: typed letters lit green; the one to type now a ghost that
// always blinks, with a cursor under it; the letters after it fainter
// still, so where to type is never in doubt (@jeffrey, 2026-10-24).
const LIT = [120, 255, 150], GHOST = [150, 148, 168], FAINT = [66, 62, 82], BRIGHT = [245, 243, 255], CURSOR = [255, 236, 120], WRONG = [255, 70, 70];
function drawPhrase(api, h, width) {
  // block letters at cell 11, smaller when the stage is too narrow for the
  // phrase (a portrait window), so the whole word always fits
  const letters = h.targets.reduce((n, t) => n + t.word.length, 0), gaps = h.targets.length - 1;
  const cell = Math.min(11, (width - 80) / (letters * 6 - 1 + gaps * 4)), gap = cell * 4, y = 150, blink = S.t % 36 < 22;
  const wordW = (w) => w.length * glyphWidth(cell) - cell;
  const total = h.targets.reduce((acc, t, i) => acc + wordW(t.word) + (i ? gap : 0), 0);
  let x = (width - total) / 2;
  api.box(x - 24, y - 16, total + 48, cell * 9 + 28, 24, 20, 34);
  h.targets.forEach((t, i) => {
    if (i) x += gap;
    const isActive = active(h) === t;
    for (let c = 0; c < t.word.length; c++) {
      const done = t.done || c < t.typed, next = isActive && c === t.typed;
      const col = done ? LIT : next ? (S.miss ? WRONG : blink ? BRIGHT : GHOST) : FAINT;
      glyph(api, t.word[c], x, y, cell, col);
      if (next) { api.box(x + cell * .3, y + cell * 8 + cell * .35, cell * 5, cell * .9, ...INK); api.box(x, y + cell * 8, cell * 5, cell * .9, ...(S.miss ? WRONG : CURSOR)); }
      x += glyphWidth(cell);
    }
  });
}
export function paint(api) {
  const { width, height } = api.view();
  S.view = { width, height };
  api.wipe(22, 20, 30);
  for (const h of S.halls) drawHall(api, h);
  const h = current();
  if (S.smash || S.over) drawShards(api);
  else api.figure(pose(h), { eyes: "dots", mouth: S.miss || S.bump ? "frown" : "smile", hurt: S.bump > 0 });
  // the shot: a line from the hand to the switch, in front
  if (S.shot) {
    const a = api.project(...S.shot.from), b = api.project(...S.shot.to);
    if (!a.behind && !b.behind) api.line(a.x, a.y, b.x, b.y, 6, 255, 240, 160);
  }
  for (const f of S.fx) {
    if (f.life > f.max - 2) { api.box(0, 0, width, height, ...f.col); continue; }
    const t = 28 * f.life / f.max;
    api.box(0, 0, width, t, ...f.col); api.box(0, height - t, width, t, ...f.col);
    api.box(0, 0, t, height, ...f.col); api.box(width - t, 0, t, height, ...f.col);
  }
  if (!S.over) drawPhrase(api, h, width);
  // hud: doors, hearts, accuracy
  const acc = S.typed + S.wrong ? Math.round(100 * S.typed / (S.typed + S.wrong)) : 100;
  write(api, "door " + (S.run + 1) + (S.best > S.run ? " · best " + S.best : "") + " · pace " + pace(h).toFixed(1), 40, 34, [255, 236, 120]);
  write(api, "♥".repeat(Math.max(0, S.hearts)) + "♡".repeat(Math.max(0, 3 - S.hearts)), 40, 72, [255, 90, 110]);
  write(api, acc + "% letters", width - 40 - api.textWidth(acc + "% letters", TYPE), 34, [180, 180, 200]);
  // the run is over: the pieces lie where they fell and the reading comes
  // in over them, at once — headline in block letters, the score under it,
  // and a blinking line that says how to go again
  if (S.over && S.dead >= 8) {
    const top = height * .18, cell = 9, line = "smashed", lw = line.length * glyphWidth(cell) - cell;
    api.box(0, top, width, 250, 20, 16, 28);
    let x = (width - lw) / 2;
    for (const ch of line) { if (ch !== " ") glyph(api, ch, x, top + 34, cell, [255, 236, 120]); x += glyphWidth(cell); }
    const score = S.run + (S.run === 1 ? " door" : " doors") + " · best " + S.best + " · " + acc + "% letters";
    write(api, score, centre(api, score, width), top + 130, [235, 235, 245]);
    if (S.t % 40 < 26) { const again = "space to go again"; write(api, again, centre(api, again, width), top + 182, [150, 255, 170]); }
  }
}
globalThis.__typist = S;
