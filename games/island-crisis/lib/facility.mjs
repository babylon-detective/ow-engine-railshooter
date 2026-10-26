// The opening levels, indoors, before the island: a hallway that teaches the
// camera and a hangar full of targets the size of the screen.
//
// Both run along a straight rail down +z (heading 0), so the runner's local
// frame is the world shifted by z: f = z - S.z, s = x, u = y. Walls, floor and
// ceiling are one-sided and face inward, so when the camera swings outside
// the hallway to look sideways, the near wall vanishes and the room reads
// like a cutaway.
//
// The hallway: three sealed doors, each opened by a switch you can only see
// (and only hit) after turning the camera: one on the right wall (E), one on
// the left (Q), one on the back of a pillar you've already passed (E E).
// Reach a door still shut and you die.
import * as Combat from './combat.mjs';
import * as Overlay from './overlay.mjs';
import { rng } from './util.mjs';
import { project, along, SCENERY } from './render.mjs';
import { railAdvance } from './motion.mjs';

export const HALL = { W: 440, H: 640, Z0: -2400, END: 9200 };
export const HANGAR = { W: 2600, H: 1500, Z0: 9200, EXIT: 17000, END: 17800, DOOR: 1300 };
const HALL_BOX = [620, 950, 240, 120, 400];
const HANGAR_DRONES = [700, 1100, 650, 160, 620];
export const QNAME = ['front', 'right', 'behind', 'left'];
export const HURDLES = [{ z: 1000, height: 70 }, { z: 3900, height: 70 }];

// Each switch sits ~1100 before its door (and comes into view ~570 before
// that). A shot switch holds the door open for GATE_HOLD ticks, then it
// shuts again: cruising covers ~1000 in that time, three boosts ~2000, so
// the lesson is BOOST straight after the shot.
export const GATE_HOLD = 200;
const GATES = [
  { door: 3000, sw: [HALL.W - 6, 290, 1900], face: [-1, 0, 0], need: 1,
    fin: [HALL.W - 210, HALL.W, 0, HALL.H, 1700, 1750], warnAt: 1100, nudgeAt: 1300, where: 'on the right wall' },
  { door: 6400, sw: [-HALL.W + 6, 290, 5300], face: [1, 0, 0], need: 3,
    fin: [-HALL.W, -HALL.W + 210, 0, HALL.H, 5100, 5150], warnAt: 4400, nudgeAt: 4700, where: 'on the left wall' },
  { door: 9000, sw: [HALL.W - 110, 270, 7856], face: [0, 0, 1], need: 2,
    fin: [HALL.W - 220, HALL.W, 0, HALL.H, 7800, 7850], warnAt: 7200, nudgeAt: 7950, where: 'behind you' },
];

const WAVES = [
  { msg: 'the hangar: big targets, one tap each', slabs: [[0, -900, 360], [0, 0, 640], [0, 900, 360]] },
  { msg: 'incoming from the right', slabs: [[1, -650, 420], [1, 650, 420]], drones: [1, 1] },
  { msg: 'incoming from the left', slabs: [[3, -650, 420], [3, 650, 420]], drones: [3, 3] },
  { msg: 'behind you', slabs: [[2, -900, 360], [2, 0, 640], [2, 900, 360]] },
  { msg: 'front and back: keep turning', slabs: [[0, -650, 420], [0, 650, 420], [2, -650, 420], [2, 650, 420]], drones: [1, 3] },
];

// ── Geometry ─────────────────────────────────────────────────────────────
// Rooms are world faces, laid out once in chunks along z; set pieces are
// objects from objects/*.lisp. A world face carries one depth, so nothing
// is laid on top of anything: the floor is cut around its stripe, a wall
// into bands around its light strip.
const chunks = [];
const CH = 400;
function chunkAt(z, tag) {
  const k = Math.floor(z / CH);
  let c = chunks.find(c => c.k === k && c.tag === tag);
  if (!c) chunks.push(c = { k, tag, z0: k * CH, z1: k * CH + CH, quads: [], props: [] });
  return c;
}
// A one-sided quad facing along `n`: seen only from that side.
function quad(out, a, b, c, d, col, n) { out.push({ a, b, c, d, col, n }); }
const prop = (c, name, x, y, z, scale = 1, rad = 400, heading = 0) => c.props.push({ name, x, y, z, scale, rad, heading });
const UP = [0, 1, 0], DOWN = [0, -1, 0], PX = [1, 0, 0], NX = [-1, 0, 0], PZ = [0, 0, 1], NZ = [0, 0, -1];
// A floor strip from x0 to x1, z0 to z1.
const floorQuad = (out, x0, x1, z0, z1, col, y = 0) => quad(out, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], col, UP);
// A side wall at x (facing `n`), from y0 to y1 and z0 to z1.
const wallQuad = (out, x, y0, y1, z0, z1, col, n) => quad(out, [x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1], col, n);

function buildHall() {
  const { W, H } = HALL;
  for (let z = HALL.Z0; z < HALL.END; z += CH) {
    const c = chunkAt(z, 'hall'), q = c.quads, z1 = z + CH, alt = (z / CH) & 1;
    const floor = alt ? [58, 62, 76] : [66, 70, 86];
    floorQuad(q, -W, -16, z, z1, floor);
    floorQuad(q, 16, W, z, z1, floor);
    floorQuad(q, -16, 16, z, z1 - 60, [255, 210, 70]);
    floorQuad(q, -16, 16, z1 - 60, z1, floor);
    const ceil = [34, 36, 48];
    const top = (x0, x1, z0, z1, col) => quad(q, [x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1], col, DOWN);
    top(-W, -150, z, z1, ceil); top(150, W, z, z1, ceil);
    if (!alt) { top(-150, 150, z, z + 100, ceil); top(-150, 150, z + 100, z + 300, [236, 244, 255]); top(-150, 150, z + 300, z1, ceil); }
    else top(-150, 150, z, z1, ceil);
    for (const s of [-1, 1]) {
      const x = s * W, n = s > 0 ? NX : PX, wall = (s > 0) === !!alt ? [104, 112, 136] : [92, 100, 124];
      wallQuad(q, x, 0, 40, z, z1, wall, n);
      wallQuad(q, x, 40, 64, z, z1, [70, 230, 255], n);
      wallQuad(q, x, 64, H - 90, z, z1, wall, n);
      wallQuad(q, x, H - 90, H - 70, z, z1, [60, 66, 84], n);
      wallQuad(q, x, H - 70, H, z, z1, wall, n);
    }
  }
  for (const g of GATES) {
    const [x0, x1, , , z0, z1] = g.fin;
    prop(chunkAt(z0, 'hall'), 'fin', (x0 + x1) / 2, 0, (z0 + z1) / 2, 1, 700);
  }
}

function buildHangar() {
  const { W, H, Z0, END, EXIT, DOOR } = HANGAR;
  const R = rng(99);
  // Floor strips: tile edges every 650, the centre stripe and two lane lines
  // cut out as strips of their own.
  const xs = [-W, -1950, -1300, -710, -690, -650, -16, 16, 650, 690, 710, 1300, 1950, W];
  for (let z = Z0; z < END; z += CH) {
    const c = chunkAt(z, 'hangar'), q = c.quads, z1 = z + CH, alt = (z / CH) & 1;
    for (let i = 0; i + 1 < xs.length; i++) {
      const x0 = xs[i], x1 = xs[i + 1], mid = (x0 + x1) / 2;
      const tile = (Math.floor((mid + W) / 650) + alt) & 1 ? [72, 78, 92] : [80, 86, 102];
      const stripe = Math.abs(mid) < 20, lane = Math.abs(Math.abs(mid) - 700) < 12;
      if (stripe || lane) {
        const end = z1 - (stripe ? 60 : 120);
        floorQuad(q, x0, x1, z, end, stripe ? [255, 210, 70] : [200, 206, 220]);
        floorQuad(q, x0, x1, end, z1, tile);
      } else floorQuad(q, x0, x1, z, z1, tile);
    }
    quad(q, [-W, H, z], [W, H, z], [W, H, z1], [-W, H, z1], [30, 32, 44], DOWN);
    const windows = (z / CH) % 3 === 0;
    for (const s of [-1, 1]) {
      const x = s * W, n = s > 0 ? NX : PX, wall = alt ? (s > 0 ? [88, 94, 116] : [84, 90, 112]) : (s > 0 ? [80, 86, 108] : [76, 82, 104]);
      wallQuad(q, x, 0, 700, z, z1, wall, n);
      if (windows) {
        wallQuad(q, x, 700, 1200, z, z + 40, wall, n);
        wallQuad(q, x, 700, 1200, z + 40, z1 - 40, [150, 196, 236], n);
        wallQuad(q, x, 700, 1200, z1 - 40, z1, wall, n);
      } else wallQuad(q, x, 700, 1200, z, z1, wall, n);
      wallQuad(q, x, 1200, H, z, z1, wall, n);
    }
    if (windows) {
      for (const s of [-1, 1]) prop(c, 'rib', s * (W - 45), 0, z, 1, 1600);
      prop(c, 'beam', 0, 0, z, 1, 2700);
    }
    if (z > Z0 + 400 && z < EXIT - 400 && R() < .7) {
      const s = R() < .5 ? -1 : 1, x = s * (1500 + R() * 800), hw = 120 + R() * 120, h = 140 + R() * 260;
      const zc = z + 100 + hw * .8;
      c.props.push({ name: 'crate', x, y: 0, z: zc, heading: 0, rad: Math.max(h, hw * 2),
        scale: [hw * 1.6 / 120, h / 120, hw * 2 / 120] });
      if (R() < .5) c.props.push({ name: 'crate', x, y: h, z: zc, heading: Math.PI / 2, rad: hw * 2,
        scale: [hw * 1.2 / 120, hw / 120, hw * 1.2 / 120] });
    }
  }
  const back = chunkAt(Z0, 'hangar-back').quads;
  quad(back, [-W, 0, Z0], [-HALL.W, 0, Z0], [-HALL.W, H, Z0], [-W, H, Z0], [70, 76, 98], PZ);
  quad(back, [HALL.W, 0, Z0], [W, 0, Z0], [W, H, Z0], [HALL.W, H, Z0], [70, 76, 98], PZ);
  quad(back, [-HALL.W, HALL.H, Z0], [HALL.W, HALL.H, Z0], [HALL.W, H, Z0], [-HALL.W, H, Z0], [64, 70, 92], PZ);
  const ex = chunkAt(EXIT, 'hangar');
  quad(ex.quads, [-W, 0, EXIT], [-DOOR - 80, 0, EXIT], [-DOOR - 80, H, EXIT], [-W, H, EXIT], [70, 76, 98], NZ);
  quad(ex.quads, [DOOR + 80, 0, EXIT], [W, 0, EXIT], [W, H, EXIT], [DOOR + 80, H, EXIT], [70, 76, 98], NZ);
  for (const s of [-1, 1]) prop(ex, 'rib', s * (DOOR + 45), 0, EXIT - 50, 1, 1600);
  const out = chunkAt(EXIT + 800, 'hangar');
  quad(out.quads, [-DOOR, 0, EXIT + 800], [DOOR, 0, EXIT + 800], [DOOR, H, EXIT + 800], [-DOOR, H, EXIT + 800], [255, 252, 232], NZ);
}

export function buildFacility() {
  if (chunks.length) return;
  buildHall();
  buildHangar();
}

// ── Running it ───────────────────────────────────────────────────────────
export function start(S, stage) {
  S.stage = stage;
  S.z = stage === 'hall' ? 0 : HANGAR.Z0 + 100;
  S.O = [0, 0, S.z];
  S.heading = 0;
  const done = stage !== 'hall';
  S.gates = GATES.map(g => ({ ...g, hit: done, open: done ? 1 : 0, timer: 0, passed: done, scored: done }));
  S.script = { drones: 0, wave: -1, waveT: 0, gap: 90, exit: 0, enteredT: 0, obstacles: new Set() };
  S.speed = stage === 'hall' ? 3.4 : 3.4;
  S.level = { shot, aim, canTarget };
}

export function canTarget(S, e) {
  const z = S.z + e.f, from = S.z + S.player.f;
  const width = z < HANGAR.Z0 ? HALL.W : HANGAR.W;
  const height = z < HANGAR.Z0 ? HALL.H : HANGAR.H;
  if (Math.abs(e.s) > width || e.u < 0 || e.u > height) return false;
  const crosses = plane => (from - plane) * (z - plane) <= 0;
  if (S.gates.some(g => g.open < .9 && crosses(g.door))) return false;
  return !(S.stage === 'hangar' && S.script.exit < .9 && crosses(HANGAR.EXIT));
}

export function hitsHurdle(p, z, hurdle) {
  return Math.abs(z + p.f - hurdle.z) < 45 && Math.abs(p.s) < HALL.W && p.u < hurdle.height;
}

export function playerObstacles(S, api) {
  if (S.stage !== 'hall') return;
  for (const hurdle of HURDLES) {
    if (S.script.obstacles.has(hurdle.z) || !hitsHurdle(S.player, S.z, hurdle)) continue;
    S.script.obstacles.add(hurdle.z);
    Combat.hurt(S, 12, api);
    S.toast = 'jump over low barriers: u or circle'; S.toastT = 110;
  }
}

const toLocalZ = (S, z) => z - S.z;
const flyer = (S, type, q, lat, box) => Combat.spawnFlyer(S, type, q, lat, { box, from: 1600, fireT: 160 + Math.random() * 80 });

// Which keys turn the camera from quadrant `from` to `to`, and which way.
export function turnTo(from, to) {
  const d = (to - from + 4) % 4;
  return d === 1 ? { keys: ['e'], dir: 'right' } : d === 3 ? { keys: ['q'], dir: 'left' } : d === 2 ? { keys: ['e', 'e'], dir: 'back' } : null;
}

function nextGate(S) { return S.gates.find(g => !g.hit && !g.passed) || null; }

// One tick of the indoor levels. Returns 'hangar' or 'island' when the
// runner crosses into the next level.
export function step(S, api) {
  const p = S.player, sc = S.script;
  S.nudge = null;
  if (S.stage === 'hall') {
    const g = nextGate(S);
    let speed = 3.4;
    if (g && S.z > g.nudgeAt) speed = 2.3;
    S.speed += (speed - S.speed) * .05;
    S.z += railAdvance(p, S.speed);
    for (const gt of S.gates) {
      if (!gt.passed && S.z + Math.min(0, p.f) - 90 > gt.door) gt.passed = true;
      if (gt.passed) { gt.open = Math.min(1, gt.open + 1 / 24); continue; }
      if (gt.hit && --gt.timer <= 0) {
        gt.hit = false;
        S.toast = 'the door is shutting'; S.toastT = 90;
        api.drum('gong', 1.2);
      }
      gt.open = gt.hit ? Math.min(1, gt.open + 1 / 24) : Math.max(0, gt.open - 1 / 24);
    }

    for (const gt of S.gates) {
      if (!gt.passed && gt.open < .8 && S.z + Math.max(0, p.f) + 90 > gt.door) {
        Combat.die(S, api, 'the door was sealed');
        S.hint = gt.scored
          ? 'it only stays open a moment. boost right after the shot: space, right click or l2'
          : 'the switch was ' + gt.where + '. turn the camera with ' + (gt.need === 1 ? 'e' : gt.need === 3 ? 'q' : 'e e');
        return null;
      }
    }

    if (S.gates[0].scored && sc.drones === 0 && S.z > 3300) {
      sc.drones = 1;
      for (const lat of [-220, 220]) flyer(S, 'drone', 0, lat, HALL_BOX);
    }
    if (S.gates[0].scored && sc.drones === 1 && S.z > 4200) {
      sc.drones = 2;
      for (const lat of [-240, 0, 240]) flyer(S, lat ? 'drone' : 'charger', 0, lat, HALL_BOX);
    }
    if (S.gates[1].scored && sc.drones === 2 && S.z > 6700) {
      sc.drones = 3;
      for (const lat of [-200, 200]) flyer(S, 'drone', 0, lat, HALL_BOX);
    }

    // Nothing hovers on the far side of a shut door, where shots can't reach.
    const shut = S.gates.find(gt => gt.open < .9 && gt.door > S.z);
    if (shut) {
      const lim = shut.door - 200 - S.z;
      for (const e of S.enemies) {
        if (e.dying || e.type === 'charger') continue;
        if (e.tf > lim) e.tf = lim;
        if (e.f > lim) e.f = lim;
      }
    }

    const front = S.enemies.filter(e => !e.dying && e.hp > 0);
    const held = S.gates.find(gt => gt.hit && !gt.passed);
    const shutting = S.gates.find(gt => !gt.hit && gt.scored && !gt.passed);
    if (held) {
      const secs = (held.timer / 60).toFixed(1);
      S.nudge = { text: 'door open ' + secs + 's. boost through!', keys: ['space'], dir: null, urgent: true };
    } else if (shutting && S.z > shutting.door - 700) {
      S.nudge = { text: 'door shut. brake and shoot the switch again', keys: ['c'], dir: null, urgent: true };
    } else if (HURDLES.some(h => S.z > h.z - 550 && S.z < h.z)) S.nudge = { text: 'low barrier ahead. jump over it', keys: ['u'], dir: null };
    else if (S.z < 450) S.nudge = { text: 'space boosts ahead. c brakes. u jumps, twice to hover', keys: [], dir: null };
    else if (g && S.z > g.nudgeAt) {
      const turn = turnTo(S.camDir, g.need);
      const sp = S.cam && project(S.cam, ...g.sw);
      const seen = Math.abs(S.camYaw - S.camYawTarget) < .08 && sp && sp.x > 60 && sp.x < S.cam.w - 60 && sp.y > 0 && sp.y < S.cam.h;
      S.nudge = turn
        ? { text: 'the switch is ' + g.where + '. turn', ...turn, urgent: true }
        : seen ? { text: 'shoot the switch!   click or enter', keys: [], dir: null, urgent: true }
          : { text: 'keep watching. it comes into view', keys: [], dir: null };
    } else if (front.length && S.camDir !== 0) {
      S.nudge = { text: 'enemies ahead. face front', ...turnTo(S.camDir, 0) };
    } else if (front.length && sc.drones === 1) {
      S.nudge = { text: 'tap click or enter to shoot. one shot, one kill', keys: [], dir: null };
    } else if (g && S.z > g.warnAt) {
      S.nudge = { text: g.need === 2 ? 'switches hide everywhere. watch the walls' : 'a sealed door ahead. find its switch', keys: [], dir: null };
    } else if (S.camDir !== 0 && !front.length) {
      S.nudge = { text: 'face front again', ...turnTo(S.camDir, 0) };
    }

    if (S.z > HALL.END + 100) { start(S, 'hangar'); return 'hangar'; }
  } else if (S.stage === 'hangar') {
    sc.enteredT++;
    // Stop far enough back that a front wave (slabs sit 1150–1400 ahead)
    // still hangs inside the room, not past the shut door.
    const stopAt = HANGAR.EXIT - 1700;
    const target = sc.exit < 1 ? (S.z > stopAt - 400 ? 0 : 3.4) : 6;
    S.speed += (target - S.speed) * .04;
    const step = S.z > stopAt - 400 && sc.exit < 1 ? S.speed : railAdvance(p, S.speed);
    S.z = sc.exit < 1 ? Math.min(stopAt, S.z + step) : S.z + step;

    const alive = S.enemies.filter(e => e.wave === sc.wave && e.hp > 0 && !e.dying);
    if (sc.wave < WAVES.length && alive.length === 0 && !S.enemies.some(e => e.wave === sc.wave && e.dying)) {
      if (--sc.gap <= 0) {
        sc.wave++;
        sc.waveT = 0;
        sc.gap = 80;
        const w = WAVES[sc.wave];
        if (w) {
          for (const [q, lat, up] of w.slabs) Combat.spawnSlab(S, q, lat, up, { wave: sc.wave });
          for (const q of w.drones || []) Combat.spawnFlyer(S, 'drone', q, (Math.random() - .5) * 800, { box: HANGAR_DRONES, wave: sc.wave });
          S.toast = w.msg; S.toastT = 150;
          api.drum('gong', 1.2);
        } else {
          S.toast = 'hangar clear. doors opening'; S.toastT = 160;
          api.drum('bell', 2);
        }
      }
    }
    sc.waveT++;
    if (sc.wave >= WAVES.length) sc.exit = Math.min(1, sc.exit + 1 / 120);
    containHangar(S);

    const live = S.enemies.filter(e => e.hp > 0 && !e.dying);
    if (live.length && !live.some(e => Combat.quadrantOf(e.f, e.s) === S.camDir) && sc.waveT > 40) {
      const counts = [0, 0, 0, 0];
      for (const e of live) counts[Combat.quadrantOf(e.f, e.s)]++;
      let q = -1, best = 9;
      for (let k = 0; k < 4; k++) {
        if (!counts[k]) continue;
        const cost = [0, 1, 2, 1][(k - S.camDir + 4) % 4];
        if (cost < best) { best = cost; q = k; }
      }
      S.nudge = { text: 'targets ' + (q === 2 ? 'behind you' : 'on the ' + QNAME[q]), ...turnTo(S.camDir, q), urgent: true };
    } else if (sc.wave >= WAVES.length && S.camDir !== 0) {
      S.nudge = { text: 'the way out is ahead', ...turnTo(S.camDir, 0) };
    } else if (sc.wave >= WAVES.length) {
      S.nudge = { text: 'doors open. out to the island', keys: [], dir: null };
    }

    if (S.z > HANGAR.EXIT + 260) return 'island';
  }
  S.O = [0, 0, S.z];
  return null;
}

// Enemies ride along in runner-relative space, so as the runner nears the
// exit anything hovering ahead would drift through the shut door, where it
// can't be seen or shot but can still shoot back. Keep them all in the room.
function containHangar(S) {
  if (S.script.exit >= 1) return;
  const ahead = HANGAR.EXIT - 320 - S.z, back = HANGAR.Z0 + 320 - S.z, side = HANGAR.W - 360;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  for (const e of S.enemies) {
    if (e.type === 'turret') continue;
    e.f = clamp(e.f, back, ahead);
    e.s = clamp(e.s, -side, side);
    if (e.tf !== undefined) e.tf = clamp(e.tf, back, ahead);
    if (e.ts !== undefined) e.ts = clamp(e.ts, -side, side);
  }
  for (const b of S.ebullets) if (b.f > ahead + 200) b.life = 0;
}

// Player shots against the room: switches first, then shut doors, walls,
// floor and ceiling. `hit` is the segment test from combat.
function shot(S, api, b, pf, ps, pu, hit) {
  for (const g of S.gates) {
    if (g.hit || S.camDir !== g.need) continue;
    if (!hit(toLocalZ(S, g.sw[2]), g.sw[0], g.sw[1], 120)) continue;
    g.hit = true;
    g.timer = GATE_HOLD;
    if (!g.scored) S.score += 500;
    g.scored = true;
    S.toast = 'switch hit: boost through!'; S.toastT = 110;
    api.drum('ding', 2);
    api.drum('bell', 1.6);
    api.drum('kick', 1.6);
    Overlay.flash([140, 255, 170], .35, 260);
    Overlay.hitMarker();
    spark(S, b, [[140, 255, 170], [255, 255, 255]]);
    return true;
  }
  const z = S.z + b.f, z0 = S.z + pf;
  const block = () => { spark(S, b, [[255, 236, 160], [200, 210, 230]]); api.drum('block', .9); return true; };
  // Fins only hide switches from the front view; facing the switch is the
  // rule, so they never stop a shot that's already aimed at one.
  for (const g of S.gates) {
    if (g.open < .9 && (z0 - g.door) * (z - g.door) <= 0 && Math.abs(b.s) < HALL.W && b.u < HALL.H) return block();
  }
  if (S.stage === 'hangar' && S.script.exit < .9 && (z0 - HANGAR.EXIT) * (z - HANGAR.EXIT) <= 0) return block();
  const inHall = z < HANGAR.Z0;
  const W = inHall ? HALL.W : HANGAR.W, H = inHall ? HALL.H : HANGAR.H;
  if (Math.abs(b.s) > W || b.u > H || b.u < 0) return block();
  return false;
}

// Where the reticle's ray meets the room, from the camera: a switch you're
// facing, a shut door, or the far wall, floor or ceiling.
function aim(S, cam, d) {
  const o = cam.pos;
  let best = { t: 1e9, switch: false };
  for (const g of S.gates) {
    if (g.hit || S.camDir !== g.need) continue;
    const c = [g.sw[0] - o[0], g.sw[1] - o[1], g.sw[2] - o[2]];
    const tc = c[0] * d[0] + c[1] * d[1] + c[2] * d[2];
    const miss = c[0] * c[0] + c[1] * c[1] + c[2] * c[2] - tc * tc;
    if (tc > 0 && miss < 110 * 110 && tc < best.t) best = { t: tc, switch: true };
  }
  const inHall = o[2] + d[2] * 1500 < HANGAR.Z0;
  const W = inHall ? HALL.W : HANGAR.W, H = inHall ? HALL.H : HANGAR.H;
  const planes = [];
  if (d[0] > 1e-4) planes.push((W - o[0]) / d[0]);
  if (d[0] < -1e-4) planes.push((-W - o[0]) / d[0]);
  if (d[1] > 1e-4) planes.push((H - o[1]) / d[1]);
  if (d[1] < -1e-4) planes.push(-o[1] / d[1]);
  for (const g of S.gates) if (g.open < .9 && d[2] > 1e-4 && o[2] < g.door) planes.push((g.door - o[2]) / d[2]);
  if (S.stage === 'hangar' && S.script.exit < .9 && Math.abs(d[2]) > 1e-4) planes.push((HANGAR.EXIT - o[2]) / d[2]);
  for (const t of planes) if (t > 0 && t < best.t) best = { t, switch: false };
  return best.t < 1e9 ? best : null;
}

function spark(S, b, palette) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 6;
    S.parts.push({ f: b.f, s: b.s, u: b.u, vf: Math.cos(a) * v, vs: Math.sin(a) * v, vu: Math.random() * 6, life: 22, max: 22,
      size: 12 + Math.random() * 8, col: palette[i % palette.length] });
  }
}

// ── Drawing ──────────────────────────────────────────────────────────────
const STRIPES = [[236, 190, 40], [40, 42, 54]];

// A door: eight stripes that lift into the ceiling as it opens. Both sides
// draw, so it reads shut from behind as well.
function door(scene, z, half, H, open) {
  const y0 = open * H, band = H / 8;
  for (let i = 0; i < 8; i++) {
    const a = Math.min(H, y0 + i * band), b = Math.min(H, y0 + (i + 1) * band);
    if (b - a < 1) continue;
    scene.quad([-half, a, z], [half, a, z], [half, b, z], [-half, b, z], STRIPES[i & 1]);
  }
}

function drawSwitch(scene, S, g) {
  const t = S.t, on = g.hit;
  const at = [g.sw[0] + g.face[0] * 4, g.sw[1], g.sw[2] + g.face[2] * 4];
  scene.object('switch', { turbo: on ? 1 : 0, hurt: !on && (t >> 3) % 2 ? 0 : 1 }, at, g.face, UP, 1, 200);
  if (!on && S.camDir === g.need) {
    // A ring of sparks round a switch you're facing.
    const r = 130 + 14 * Math.sin(t * .25), side = [g.face[2], 0, -g.face[0]];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + t * .03, c = Math.cos(a) * r, s = Math.sin(a) * r;
      scene.spark(at[0] + side[0] * c + g.face[0] * 40, at[1] + s, at[2] + side[2] * c + g.face[2] * 40, 16, 255, 255, 120);
    }
  }
}

export function draw(scene, S, cam) {
  const far = cam.far + CH, cz = cam.pos[2];
  for (const c of chunks) {
    if (c.z1 < cz - far || c.z0 > cz + far) continue;
    if (c.tag === 'hangar-back' && S.stage === 'hall') continue;
    if (c.tag === 'hall' && S.stage === 'hangar' && c.z1 < S.z - 6000) continue;
    for (const q of c.quads) scene.quad(q.a, q.b, q.c, q.d, q.col, q.n, SCENERY);
    for (const o of c.props) scene.object(o.name, null, [o.x, o.y, o.z], along(o.heading), UP, o.scale, o.rad, SCENERY);
  }
  if (S.stage === 'hall') for (const h of HURDLES) {
    if (Math.abs(h.z - cz) > far) continue;
    scene.object('hurdle', null, [0, 0, h.z], PZ, UP, 1, 900);
  }
  for (const g of S.gates) {
    if (Math.abs(g.door - cz) > far) continue;
    if (g.open < 1) door(scene, g.door, HALL.W - 60, HALL.H - 60, g.open);
    scene.object('gate-frame', { turbo: g.hit ? 1 : 0 }, [0, 0, g.door], PZ, UP, 1, 900);
    drawSwitch(scene, S, g);
  }
  if (Math.abs(HANGAR.EXIT - cz) < far + 2000) door(scene, HANGAR.EXIT, HANGAR.DOOR, HANGAR.H, S.stage === 'hangar' ? S.script.exit : 0);
}
