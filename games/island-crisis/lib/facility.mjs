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
import * as M from './mesh.mjs';
import * as Combat from './combat.mjs';
import * as Overlay from './overlay.mjs';
import { rng } from './util.mjs';
import { project } from './render.mjs';

export const HALL = { W: 440, H: 640, Z0: -2400, END: 9200 };
export const HANGAR = { W: 2600, H: 1500, Z0: 9200, EXIT: 17000, END: 17800, DOOR: 1300 };
const HALL_BOX = [620, 950, 240, 120, 400];
const HANGAR_DRONES = [700, 1100, 650, 160, 620];
export const QNAME = ['front', 'right', 'behind', 'left'];

const GATES = [
  { door: 3000, sw: [HALL.W - 6, 290, 2800], face: [-1, 0, 0], need: 1,
    fin: [HALL.W - 210, HALL.W, 0, HALL.H, 2600, 2650], warnAt: 700, nudgeAt: 1700, where: 'on the right wall' },
  { door: 6400, sw: [-HALL.W + 6, 290, 6200], face: [1, 0, 0], need: 3,
    fin: [-HALL.W, -HALL.W + 210, 0, HALL.H, 6000, 6050], warnAt: 4500, nudgeAt: 5100, where: 'on the left wall' },
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
const chunks = [];
const CH = 400;
function chunkAt(z, tag) {
  const k = Math.floor(z / CH);
  let c = chunks.find(c => c.k === k && c.tag === tag);
  if (!c) chunks.push(c = { k, tag, z0: k * CH, z1: k * CH + CH, base: [], decal: [], solid: [] });
  return c;
}
// A one-sided quad facing along `n`, unlit (interior colours are set by hand).
function quad(out, a, b, c, d, col, n) {
  const m = [(a[0] + c[0]) / 2 - n[0] * 100, (a[1] + c[1]) / 2 - n[1] * 100, (a[2] + c[2]) / 2 - n[2] * 100];
  M.face(out, [a, b, c, d], col, m, false);
}
const UP = [0, 1, 0], DOWN = [0, -1, 0], PX = [1, 0, 0], NX = [-1, 0, 0], PZ = [0, 0, 1], NZ = [0, 0, -1];
const box = (out, x0, x1, y0, y1, z0, z1, col, top = null) =>
  M.box(out, M.yawBasis([0, 0, 0], 0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2, col, top);

function buildHall() {
  const { W, H } = HALL;
  for (let z = HALL.Z0; z < HALL.END; z += CH) {
    const c = chunkAt(z, 'hall'), z1 = z + CH, alt = (z / CH) & 1;
    quad(c.base, [-W, 0, z], [W, 0, z], [W, 0, z1], [-W, 0, z1], alt ? [58, 62, 76] : [66, 70, 86], UP);
    quad(c.base, [-W, H, z], [W, H, z], [W, H, z1], [-W, H, z1], [34, 36, 48], DOWN);
    quad(c.base, [W, 0, z], [W, H, z], [W, H, z1], [W, 0, z1], alt ? [104, 112, 136] : [92, 100, 124], NX);
    quad(c.base, [-W, 0, z], [-W, H, z], [-W, H, z1], [-W, 0, z1], alt ? [96, 104, 128] : [86, 94, 116], PX);
    quad(c.decal, [-16, 1, z], [16, 1, z], [16, 1, z1 - 60], [-16, 1, z1 - 60], [255, 210, 70], UP);
    for (const s of [-1, 1]) {
      const x = s * (W - 1), n = s > 0 ? NX : PX;
      quad(c.decal, [x, 40, z], [x, 64, z], [x, 64, z1], [x, 40, z1], [70, 230, 255], n);
      quad(c.decal, [x, H - 90, z + 30], [x, H - 70, z + 30], [x, H - 70, z1 - 30], [x, H - 90, z1 - 30], [60, 66, 84], n);
    }
    if (!alt) quad(c.decal, [-150, H - 1, z + 100], [150, H - 1, z + 100], [150, H - 1, z + 300], [-150, H - 1, z + 300], [236, 244, 255], DOWN);
  }
  for (const g of GATES) {
    const c = chunkAt(g.door, 'hall');
    box(c.solid, -W, -W + 60, 0, H, g.door - 40, g.door + 40, [60, 64, 80]);
    box(c.solid, W - 60, W, 0, H, g.door - 40, g.door + 40, [60, 64, 80]);
    box(c.solid, -W, W, H - 60, H, g.door - 40, g.door + 40, [52, 56, 70]);
    const [x0, x1, y0, y1, z0, z1] = g.fin;
    box(chunkAt(z0, 'hall').solid, x0, x1, y0, y1, z0, z1, [74, 80, 100], [60, 64, 80]);
  }
}

function buildHangar() {
  const { W, H, Z0, END, EXIT, DOOR } = HANGAR;
  const R = rng(99);
  for (let z = Z0; z < END; z += CH) {
    const c = chunkAt(z, 'hangar'), z1 = z + CH, alt = (z / CH) & 1;
    for (let x = -W, i = 0; x < W; x += 650, i++)
      quad(c.base, [x, 0, z], [x + 650, 0, z], [x + 650, 0, z1], [x, 0, z1], (i + alt) & 1 ? [72, 78, 92] : [80, 86, 102], UP);
    quad(c.base, [-W, H, z], [W, H, z], [W, H, z1], [-W, H, z1], [30, 32, 44], DOWN);
    quad(c.base, [W, 0, z], [W, H, z], [W, H, z1], [W, 0, z1], alt ? [88, 94, 116] : [80, 86, 108], NX);
    quad(c.base, [-W, 0, z], [-W, H, z], [-W, H, z1], [-W, 0, z1], alt ? [84, 90, 112] : [76, 82, 104], PX);
    quad(c.decal, [-16, 1, z], [16, 1, z], [16, 1, z1 - 60], [-16, 1, z1 - 60], [255, 210, 70], UP);
    for (const lx of [-700, 700]) quad(c.decal, [lx - 10, 1, z], [lx + 10, 1, z], [lx + 10, 1, z1 - 120], [lx - 10, 1, z1 - 120], [200, 206, 220], UP);
    if ((z / CH) % 3 === 0) {
      for (const s of [-1, 1]) {
        const x = s * (W - 1), n = s > 0 ? NX : PX;
        quad(c.decal, [x, 700, z + 40], [x, 1200, z + 40], [x, 1200, z1 + 300], [x, 700, z1 + 300], [150, 196, 236], n);
        box(c.solid, s > 0 ? W - 90 : -W, s > 0 ? W : -W + 90, 0, H, z - 50, z + 50, [60, 64, 82]);
      }
      box(c.solid, -W, W, H - 70, H, z - 40, z + 40, [46, 50, 64]);
      for (const lx of [-1500, 0, 1500]) quad(c.decal, [lx - 200, H - 71, z + 120], [lx + 200, H - 71, z + 120], [lx + 200, H - 71, z + 260], [lx - 200, H - 71, z + 260], [236, 244, 255], DOWN);
    }
    if (z > Z0 + 400 && z < EXIT - 400 && R() < .7) {
      const s = R() < .5 ? -1 : 1, x = s * (1500 + R() * 800), hw = 120 + R() * 120, h = 140 + R() * 260;
      box(c.solid, x - hw, x + hw, 0, h, z + 100, z + 100 + hw * 1.6, [130, 104, 72], [150, 122, 86]);
      if (R() < .5) box(c.solid, x - hw * .6, x + hw * .6, h, h + hw, z + 140, z + 120 + hw * 1.2, [118, 94, 66], [140, 112, 78]);
    }
  }
  const back = chunkAt(Z0, 'hangar-back');
  quad(back.base, [-W, 0, Z0], [-HALL.W, 0, Z0], [-HALL.W, H, Z0], [-W, H, Z0], [70, 76, 98], PZ);
  quad(back.base, [HALL.W, 0, Z0], [W, 0, Z0], [W, H, Z0], [HALL.W, H, Z0], [70, 76, 98], PZ);
  quad(back.base, [-HALL.W, HALL.H, Z0], [HALL.W, HALL.H, Z0], [HALL.W, H, Z0], [-HALL.W, H, Z0], [64, 70, 92], PZ);
  const ex = chunkAt(EXIT, 'hangar');
  quad(ex.base, [-W, 0, EXIT], [-DOOR, 0, EXIT], [-DOOR, H, EXIT], [-W, H, EXIT], [70, 76, 98], NZ);
  quad(ex.base, [DOOR, 0, EXIT], [W, 0, EXIT], [W, H, EXIT], [DOOR, H, EXIT], [70, 76, 98], NZ);
  box(ex.solid, -DOOR - 80, -DOOR, 0, H, EXIT - 60, EXIT, [60, 64, 80]);
  box(ex.solid, DOOR, DOOR + 80, 0, H, EXIT - 60, EXIT, [60, 64, 80]);
  const out = chunkAt(EXIT + 800, 'hangar');
  quad(out.base, [-DOOR, 0, EXIT + 800], [DOOR, 0, EXIT + 800], [DOOR, H, EXIT + 800], [-DOOR, H, EXIT + 800], [255, 252, 232], NZ);
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
  S.gates = GATES.map(g => ({ ...g, hit: stage !== 'hall', open: stage !== 'hall' ? 1 : 0 }));
  S.script = { drones: 0, wave: -1, waveT: 0, gap: 90, exit: 0, enteredT: 0 };
  S.speed = stage === 'hall' ? 3.4 : 3.4;
  S.level = { shot, aim };
}

const toLocalZ = (S, z) => z - S.z;
const flyer = (S, type, q, lat, box) => Combat.spawnFlyer(S, type, q, lat, { box, from: 1600, fireT: 160 + Math.random() * 80 });

// Which keys turn the camera from quadrant `from` to `to`, and which way.
export function turnTo(from, to) {
  const d = (to - from + 4) % 4;
  return d === 1 ? { keys: ['e'], dir: 'right' } : d === 3 ? { keys: ['q'], dir: 'left' } : d === 2 ? { keys: ['e', 'e'], dir: 'back' } : null;
}

function nextGate(S) { return S.gates.find(g => !g.hit) || null; }

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
    S.z += S.speed;
    for (const gt of S.gates) if (gt.hit && gt.open < 1) gt.open = Math.min(1, gt.open + 1 / 36);

    for (const gt of S.gates) {
      if (gt.open < .8 && S.z + Math.max(0, p.f) + 90 > gt.door) {
        Combat.die(S, api, 'the door was sealed');
        S.hint = 'the switch was ' + gt.where + '. turn the camera with ' + (gt.need === 1 ? 'e' : gt.need === 3 ? 'q' : 'e e');
        return null;
      }
    }

    if (S.gates[0].hit && sc.drones === 0 && S.z > 3300) {
      sc.drones = 1;
      for (const lat of [-220, 220]) flyer(S, 'drone', 0, lat, HALL_BOX);
    }
    if (S.gates[0].hit && sc.drones === 1 && S.z > 4200) {
      sc.drones = 2;
      for (const lat of [-240, 0, 240]) flyer(S, lat ? 'drone' : 'charger', 0, lat, HALL_BOX);
    }
    if (S.gates[1].hit && sc.drones === 2 && S.z > 6700) {
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
    if (S.z < 600) S.nudge = { text: 'wasd move. hold shift and tap a direction to dash', keys: [], dir: null };
    else if (g && S.z > g.nudgeAt) {
      const turn = turnTo(S.camDir, g.need);
      const sp = S.cam && project(S.cam, ...g.sw);
      const seen = Math.abs(S.camYaw - S.camYawTarget) < .08 && sp && sp.x > 60 && sp.x < S.cam.w - 60 && sp.y > 0 && sp.y < S.cam.h;
      S.nudge = turn
        ? { text: 'the switch is ' + g.where + '. turn', ...turn, urgent: true }
        : seen ? { text: 'shoot the switch!   click or j', keys: [], dir: null, urgent: true }
          : { text: 'keep watching. it comes into view', keys: [], dir: null };
    } else if (front.length && S.camDir !== 0) {
      S.nudge = { text: 'enemies ahead. face front', ...turnTo(S.camDir, 0) };
    } else if (front.length && sc.drones === 1) {
      S.nudge = { text: 'tap click or j to shoot. one shot, one kill', keys: [], dir: null };
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
    S.z = sc.exit < 1 ? Math.min(stopAt, S.z + S.speed) : S.z + S.speed;

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
    S.score += 500;
    S.toast = 'switch hit: door open'; S.toastT = 110;
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

function door(R, z, half, H, open, flip = false) {
  const faces = [], y0 = open * H, band = H / 8;
  for (let i = 0; i < 8; i++) {
    const a = Math.min(H, y0 + i * band), b = Math.min(H, y0 + (i + 1) * band);
    if (b - a < 1) continue;
    quad(faces, [-half, a, z], [half, a, z], [half, b, z], [-half, b, z], STRIPES[i & 1], flip ? PZ : NZ);
  }
  R.mesh(faces, 10);
}

function drawSwitch(R, S, g) {
  const B = M.lookBasis(g.sw, g.face), faces = [];
  const t = S.t, on = g.hit;
  const pulse = on ? [90, 255, 140] : (t >> 3) % 2 ? [255, 60, 60] : [255, 150, 130];
  M.box(faces, B, 0, 0, 8, 86, 86, 8, [40, 42, 54], null, false);
  M.box(faces, B, 0, 0, 24, 54, 54, 12, pulse, null, false);
  M.box(faces, B, 0, -112, 8, 70, 14, 6, [236, 190, 40], null, false);
  R.mesh(faces, -10);
  if (!on && S.camDir === g.need) {
    const r = 130 + 14 * Math.sin(t * .25);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + t * .03;
      const P = M.at(B, Math.cos(a) * r, Math.sin(a) * r, 30);
      R.spark(P[0], P[1], P[2], 16, 255, 255, 120, -40);
    }
  }
}

export function draw(R, S, cam) {
  const far = cam.far + CH, cz = cam.pos[2];
  for (const c of chunks) {
    if (c.z1 < cz - far || c.z0 > cz + far) continue;
    if (c.tag === 'hangar-back' && S.stage === 'hall') continue;
    if (c.tag === 'hall' && S.stage === 'hangar' && c.z1 < S.z - 6000) continue;
    R.mesh(c.base, 80);
    R.mesh(c.decal, 40);
    R.mesh(c.solid, 0);
  }
  for (const g of S.gates) {
    if (Math.abs(g.door - cz) > far) continue;
    if (g.open < 1) door(R, g.door, HALL.W - 60, HALL.H - 60, g.open);
    const lamp = M.yawBasis([0, HALL.H - 30, g.door - 44], 0), f = [];
    M.box(f, lamp, 0, 0, 0, 60, 14, 6, g.hit ? [90, 255, 140] : [255, 60, 60], null, false);
    R.mesh(f, -5);
    drawSwitch(R, S, g);
  }
  if (Math.abs(HANGAR.EXIT - cz) < far + 2000) door(R, HANGAR.EXIT, HANGAR.DOOR, HANGAR.H, S.stage === 'hangar' ? S.script.exit : 0);
}
