// typist — a typing rail shooter, like typing of the dead on the showroom's
// hall (@jeffrey + Artur, 2026-10-23). The hero glides toward a door with one
// switch per word. You type the word; every letter is a sub-action — the
// hero turns a little further toward the switch with each correct one, and
// on the last letter the arm comes up, the shot lands, the switch drops, and
// the hero turns back. A wrong letter costs one letter of progress: you only
// partially get there. Reach the door with a word unfinished and the hero
// bumps it; three bumps end the run. One word at a time, nothing to aim.
// World units are the engine's: y grows DOWN, the floor is at 1800. Halls
// run along +z. See NOTES.md.

import { drawGlyph, glyphWidth } from "./lib/bigtext.mjs";

const FLOOR = 1800, HALF = 300, HEIGHT = 500, HALL = 1500;
const EYE = FLOOR - 230, PACE = 1.9, AHEAD = 230;
const S = { t: 0, s: 0, halls: [], run: 0, best: 0, hearts: 3, flash: 0, red: 0, miss: 0, prev: new Set(),
  shot: null, bump: 0, dead: 0, typed: 0, wrong: 0, over: false };

// Words: real short ones on even halls, syllable nonsense ("boyu popo rebo")
// on odd ones — three action events, in letters.
const REAL = ["sun", "dog", "run", "key", "map", "cat", "ink", "fox", "box", "jam", "wave", "door", "lamp", "frog", "moon",
  "sand", "ring", "wind", "milk", "star", "path", "leaf", "rock", "bird", "fish", "road", "gate", "drum", "kite", "nest"];
const C = "bdfgjklmnprstvz", V = "aeiou";
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (list) => list[(rnd() * list.length) | 0];
const syllables = (n) => { let w = ""; for (let i = 0; i < n; i++) w += pick(C) + pick(V); return w; };
function phraseFor(index) {
  const words = index === 0 ? 1 : Math.min(3, 1 + ((index + 1) >> 1));
  const out = [];
  for (let i = 0; i < words; i++) out.push(index % 2 ? syllables(2) : pick(REAL));
  return out;
}

// A hall: from z0 to z0 + HALL, its door at the far end, a switch per word.
function hall(index, z0) {
  const words = phraseFor(index);
  const n = words.length, size = 110;
  const targets = words.map((word, i) => ({ word, typed: 0, done: false, hit: 0,
    x: (i - (n - 1) / 2) * 190, y: FLOOR - HEIGHT * .55, z: z0 + HALL, w: size, h: size }));
  return { index, z0, z1: z0 + HALL, open: 0, targets, at: 0 };
}

function restart() {
  S.halls = [hall(0, 0), hall(1, HALL)];
  Object.assign(S, { s: 0, run: 0, hearts: 3, dead: 0, typed: 0, wrong: 0, over: false, bump: 0, shot: null });
}
export function boot(api) { api.cursor("none"); restart(); }

const current = () => S.halls[0];
const active = (h) => h.targets[h.at] || null;

// Keys: letters only, one press each; space between words is free.
const LETTER = /^Key([A-Z])$/;
export function sim(api) {
  S.t++;
  const keys = new Set(api.keys());
  const h = current(), tg = active(h);
  for (const k of keys) {
    if (S.prev.has(k)) continue;
    if (S.over) { if (k === "Enter" || k === "Space") restart(); continue; }
    const m = LETTER.exec(k);
    if (!m || !tg || tg.done) continue;
    const letter = m[1].toLowerCase();
    if (letter === tg.word[tg.typed]) {
      tg.typed++; S.typed++;
      api.tone(440 + tg.typed * 60, .05);
      if (tg.typed === tg.word.length) shoot(api, h, tg);
    } else {
      // a wrong letter: only partly there — one letter of progress lost
      tg.typed = Math.max(0, tg.typed - 1); S.wrong++; S.miss = 8;
      api.drum("block", .9, 0);
    }
  }
  S.prev = keys;
  if (S.shot) { S.shot.life--; if (S.shot.life <= 0) S.shot = null; }
  if (S.flash > 0) S.flash--;
  if (S.red > 0) S.red--;
  if (S.miss > 0) S.miss--;
  if (S.bump > 0) S.bump--;
  for (const t of h.targets) if (t.hit > 0) t.hit--;
  if (S.over) return;
  if (h.open) h.open = Math.min(1, h.open + .035);
  const stopAt = h.z1 - 150;
  if (h.open || S.s < stopAt) S.s = Math.min(h.open ? S.s + PACE : stopAt, S.s + PACE);
  else if (!S.bump) {
    // At a shut door with words left: the hero bumps it. Three bumps end the run.
    S.bump = 70; S.hearts--; S.red = 18; api.drum("body-impact", 1.6, 0);
    if (S.hearts <= 0) { S.over = true; api.drum("gong", 1, 0); }
    else { tg && (tg.typed = 0); }
  }
  // Through an open door: the hall behind is done, a new one is laid ahead.
  if (S.s > h.z1 + 60 && h.open) {
    S.halls.shift(); const last = S.halls[S.halls.length - 1];
    S.halls.push(hall(last.index + 1, last.z1)); S.run++; S.best = Math.max(S.best, S.run);
    api.drum("bell", .7, 0);
  }
  api.camera({ position: [90, EYE - 40, S.s - 420], target: [-10, EYE + 70, S.s + 600], fov: 74 });
}

function shoot(api, h, tg) {
  tg.done = true; tg.hit = 16; S.flash = 4;
  S.shot = { life: 10, from: hand(h, tg), to: [tg.x, tg.y, tg.z - 2] };
  api.drum("kick", 1.4, 0); api.drum("clap", 1, 0); api.drum("glass-shard", 1.2, .3);
  h.at++;
  if (h.targets.every((t) => t.done)) { h.open = .01; api.drum("gong", .5, 0); }
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
  const stride = Math.sin(S.s / 26) * (S.bump || S.over ? 0 : 1);
  const bob = Math.abs(Math.cos(S.s / 26)) * 4;
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
  // The door lifts once every switch is down; it is cut around the switches.
  const lift = h.open * HEIGHT, z = z1, top = FLOOR - HEIGHT, bottom = FLOOR - lift;
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

export function paint(api) {
  const { width, height } = api.view();
  api.wipe(22, 20, 30);
  for (const h of S.halls) drawHall(api, h);
  const h = current();
  api.figure(pose(h), { eyes: "dots", mouth: S.miss ? "frown" : "smile", hurt: S.bump > 0 });
  // the shot: a line from the hand to the switch, in front
  if (S.shot) {
    const a = api.project(...S.shot.from), b = api.project(...S.shot.to);
    if (!a.behind && !b.behind) api.line(a.x, a.y, b.x, b.y, 6, 255, 240, 160);
  }
  if (S.flash > 0) api.box(0, 0, width, height, 255, 250, 230);
  if (S.red > 0) api.box(0, 0, width, height, 200, 24, 30);
  // the phrase in block letters across the top: typed letters lit, the next
  // one underlined, the rest waiting; the active word brightest
  const cell = 11, gap = cell * 4, y = 150;
  const wordW = (w) => w.length * glyphWidth(cell) - cell;
  const total = h.targets.reduce((acc, t, i) => acc + wordW(t.word) + (i ? gap : 0), 0);
  let x = (width - total) / 2;
  h.targets.forEach((t, i) => {
    if (i) x += gap;
    const isActive = active(h) === t;
    for (let c = 0; c < t.word.length; c++) {
      const done = t.done || c < t.typed, next = isActive && c === t.typed;
      const col = done ? [120, 255, 150] : next ? (S.miss ? [255, 70, 70] : [255, 236, 120]) : isActive ? [235, 235, 245] : [110, 108, 120];
      drawGlyph(api, t.word[c], x, y, cell, ...col);
      if (next) api.box(x, y + cell * 8, cell * 5, cell * .8, ...col);
      x += glyphWidth(cell);
    }
  });
  // hud: doors, hearts, accuracy
  const acc = S.typed + S.wrong ? Math.round(100 * S.typed / (S.typed + S.wrong)) : 100;
  api.write("door " + (S.run + 1) + (S.best > S.run ? "   best " + S.best : ""), 40, 36, 34, 255, 236, 120);
  api.write("♥".repeat(Math.max(0, S.hearts)), 40, 80, 34, 255, 90, 110);
  api.write(acc + "% letters", width - 40 - api.textWidth(acc + "% letters", 30), 40, 30, 180, 180, 200);
  if (S.over) {
    api.box(0, height / 2 - 120, width, 240, 20, 16, 28);
    const msg = "the door wins. " + S.run + " doors. space to go again";
    api.write(msg, (width - api.textWidth(msg, 54)) / 2, height / 2 - 30, 54, 255, 236, 120);
  }
}
globalThis.__typist = S;
