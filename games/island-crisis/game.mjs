// island crisis — a 3D rail shooter in the spirit of Sin & Punishment and
// Panzer Dragoon Orta, drawn with flat triangles on the oskiewar engine.
// It opens indoors: a hallway that teaches the four-way camera (Q / E), then
// a hangar of screen-sized targets, then the five-biome island, where M lifts
// the camera into a map to choose the next pathway. See NOTES.md.
import { buildWorld, BIOMES, biomeWeights, biomeAt, groundAt, drawTerrain, drawScenery } from './lib/world.mjs';
import { Renderer, makeCamera, project } from './lib/render.mjs';
import { installInput, readInput } from './lib/input.mjs';
import * as Overlay from './lib/overlay.mjs';
import * as Rail from './lib/rail.mjs';
import * as Combat from './lib/combat.mjs';
import * as Facility from './lib/facility.mjs';
import * as Title from './lib/title.mjs';
import * as Hud from './lib/hud.mjs';
import * as M from './lib/mesh.mjs';
import { bigWidth, bigWrite } from './lib/bigtext.mjs';
import { clamp, lerp, angleLerp } from './lib/util.mjs';

// A long lens, close behind: enemies fill the frame instead of dotting it.
const FOV = .62, MAP_FOV = 1.08, MAP_DIST = 8800;
const PLAY_DIST = { hall: 1000, hangar: 1100, island: 1150 };
const BOUNDS = { hall: [300, 360], hangar: [420, 460], island: [400, 440] };
const STAGES = ['hall', 'hangar', 'island'];
const STAGE_NAME = { hall: 'the hallway', hangar: 'the hangar', island: 'the island' };
const INDOOR = { hall: { bg: [10, 12, 22], fog: [14, 16, 28], far: 6500, fogStart: 2600 },
  hangar: { bg: [16, 20, 32], fog: [22, 26, 40], far: 9000, fogStart: 3600 } };
const SAVE_KEY = 'island-crisis:save';

const R = new Renderer();
const S = { mode: 'title', t: 0, cam: null };
let prevDown = new Set();

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    return s && STAGES.includes(s.stage) ? s : null;
  } catch { return null; }
}
function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ stage: S.stage, score: S.score, kills: S.kills, visited: [...S.visited] }));
  } catch {}
}

function toTitle() {
  Object.assign(S, { mode: 'title', paused: false, fly: Title.startFlight(), save: loadSave(), sel: 0, enemies: [], shots: [], ebullets: [], parts: [] });
  S.sel = S.save ? 1 : 0;
}

function startIsland() {
  Object.assign(S, { stage: 'island', level: null, edge: 0, dir: 1, s: 0, speed: 6, route: [], stageT: 0, biome: -1,
    spawnT: 240, turretT: 360, bossT: 2700, offT: 0, nudge: null });
  const r = Rail.sample(0, 1, 0);
  S.O = r.p;
  S.heading = r.heading;
}

function begin(api, stage, carry = {}) {
  const { width, height } = api.view();
  Object.assign(S, {
    mode: 'play', overT: 0, stageT: 0, sel: 0,
    camDir: 0, camYaw: 0, camYawTarget: 0, camPitch: .15,
    map: { open: false, t: 0, routes: [], ahead: [], sel: 0, hover: false },
    route: [], routeLabel: '',
    player: { f: 0, s: 0, u: 140, va: 0, vu: 0, hp: 100, inv: 0, roll: 0, rollCd: 0, fireCd: 0, fireBuf: 0, dash: 0, dashCd: 0 },
    reticle: { x: width / 2, y: height * .4 }, lock: null, aimT: 3200, muzzle: 0,
    enemies: [], ebullets: [], shots: [], parts: [],
    score: carry.score || 0, kills: carry.kills || 0, spawnT: 240, turretT: 360, bossT: 2700,
    biome: -1, visited: new Set(carry.visited || []), toast: STAGE_NAME[stage], toastT: 130,
    shake: 0, hurtT: 0, nudge: null, hint: '', why: '', level: null, offT: 0, paused: false,
  });
  if (stage === 'island') startIsland(); else Facility.start(S, stage);
  writeSave();
  api.drum('gong', 1.4);
}

function enterStage(api, stage) {
  if (stage === 'island') startIsland();
  S.enemies = []; S.ebullets = []; S.shots = [];
  S.camDir = 0; S.camYawTarget = Math.round(S.camYaw / (Math.PI * 2)) * Math.PI * 2;
  S.toast = STAGE_NAME[stage]; S.toastT = 150;
  S.player.hp = Math.min(100, S.player.hp + 30);
  writeSave();
  api.drum('gong', 1.6);
  api.drum('bell', 1.4);
  Overlay.flash([255, 255, 240], stage === 'island' ? .95 : .5, stage === 'island' ? 900 : 400);
}

export function boot(api) {
  installInput();
  installOverlay();
  buildWorld();
  Facility.buildFacility();
  toTitle();
  // A handle for poking at the game from the console while developing.
  if (globalThis.location?.hostname === 'localhost') globalThis.__islandCrisis = S;
}
const installOverlay = () => Overlay.installOverlay();

const frameNow = () => Rail.frame(S.O, S.heading);

// ── The map (outdoors only) ──────────────────────────────────────────────
function openMap(api) {
  const { routes, ahead } = Rail.routesFrom(S.edge, S.dir, S.s);
  Object.assign(S.map, { open: true, routes, ahead });
  const current = S.route.length
    ? routes.findIndex(r => r.legs.length && r.legs.at(-1).edge === S.route.at(-1).edge && r.legs.at(-1).dir === S.route.at(-1).dir)
    : -1;
  S.map.sel = current >= 0 ? current : Math.max(0, routes.findIndex(r => r.best));
  api.drum('whoosh', 1.4);
}

function closeMap(api, go) {
  const map = S.map;
  map.open = false;
  if (!go) return;
  const r = map.routes[map.sel];
  if (r.back) {
    S.dir = -S.dir;
    S.s = Rail.edgeLen(S.edge) - S.s;
    S.route = [];
    S.toast = 'turning back'; S.toastT = 90;
  } else {
    S.route = r.legs.slice();
    S.routeLabel = r.label;
    S.toast = 'heading for ' + r.label; S.toastT = 90;
  }
  api.drum('ding', 1.6);
}

function mapSim(api, inp, press) {
  const map = S.map, n = map.routes.length;
  if (press('ArrowLeft') || press('ArrowUp')) map.sel = (map.sel + n - 1) % n;
  if (press('ArrowRight') || press('ArrowDown')) map.sel = (map.sel + 1) % n;
  const pick = (x, y) => {
    let best = -1, bestD = 70;
    map.routes.forEach((r, i) => {
      for (let k = 0; k < r.pts.length; k += 2) {
        const sp = project(S.cam, r.pts[k][0], r.pts[k][1] + 10, r.pts[k][2]);
        if (!sp) continue;
        const d = Math.hypot(sp.x - x, sp.y - y);
        if (d < bestD) { bestD = d; best = i; }
      }
    });
    return best;
  };
  if (inp.mouse.moved && S.cam) {
    const h = pick(inp.mouse.x, inp.mouse.y);
    map.hover = h >= 0;
    if (h >= 0 && h !== map.sel) { map.sel = h; api.drum('hat', .6); }
  }
  for (const c of inp.mouse.clicks) {
    const h = pick(c.x, c.y);
    if (h >= 0) { map.sel = h; closeMap(api, true); return; }
  }
  if (press('X') || press('A') || press('RightShoulder')) { closeMap(api, true); return; }
  if (inp.pressed.has('KeyM') || press('Y') || press('View') || press('B') || press('Menu')) closeMap(api, false);
}

function cycleCamera(api, d) {
  S.camDir = (S.camDir + d + 4) % 4;
  S.camYawTarget += d * Math.PI / 2;
  api.drum('whoosh', 1, d * .6);
}

// ── Outdoors ─────────────────────────────────────────────────────────────
function advanceRail(api) {
  S.s += S.speed;
  while (S.s >= Rail.edgeLen(S.edge)) {
    S.s -= Rail.edgeLen(S.edge);
    const node = Rail.endNode(S.edge, S.dir);
    let leg = null;
    if (S.route.length && Rail.startNode(S.route[0].edge, S.route[0].dir) === node) leg = S.route.shift();
    else S.route = [];
    if (!leg) leg = Rail.straightest(node, S.edge, S.heading);
    S.edge = leg.edge;
    S.dir = leg.dir;
    api.tone(880, .06);
  }
  const r = Rail.sample(S.edge, S.dir, S.s);
  S.O = r.p;
  S.heading = angleLerp(S.heading, r.heading, .08);
  const b = biomeAt(S.O[0], S.O[2]);
  if (b !== S.biome) {
    const first = !S.visited.has(b) && S.biome >= 0;
    S.biome = b;
    S.visited.add(b);
    if (S.stageT > 10) {
      S.toast = BIOMES[b].name + (first ? '  +15 hp' : '');
      S.toastT = 120;
      if (first) S.player.hp = Math.min(100, S.player.hp + 15);
      api.drum('bell', 1.2);
    }
  }
}

// Outdoors the camera lesson keeps going: when everything left alive is off
// to one side, say which way to turn.
function islandNudge() {
  S.nudge = null;
  const live = S.enemies.filter(e => !e.dying && e.hp > 0);
  const counts = [0, 0, 0, 0];
  for (const e of live) counts[Combat.quadrantOf(e.f, e.s)]++;
  S.offT = live.length && !counts[S.camDir] ? S.offT + 1 : 0;
  if (S.offT > 90) {
    let q = -1, best = 9;
    for (let k = 0; k < 4; k++) {
      const cost = [0, 1, 2, 1][(k - S.camDir + 4) % 4];
      if (counts[k] && cost < best) { best = cost; q = k; }
    }
    S.nudge = { text: 'enemies ' + (q === 2 ? 'behind you' : 'on the ' + Facility.QNAME[q]), ...Facility.turnTo(S.camDir, q), urgent: true };
  } else if (Rail.edgeLen(S.edge) - S.s < 1300 && !S.route.length) {
    S.nudge = { text: 'junction ahead. choose a path', keys: ['m'], dir: null, urgent: true };
  } else if (S.stageT < 420) {
    S.nudge = { text: 'outdoors now. the map shows every path', keys: ['m'], dir: null };
  }
}

// ── The runner ───────────────────────────────────────────────────────────
function playerSim(api, inp, down, press) {
  const p = S.player, [LATERAL, CEILING] = BOUNDS[S.stage];
  const held = b => inp.pad.down.has(b);
  let ix = (held('ArrowRight') ? 1 : 0) - (held('ArrowLeft') ? 1 : 0);
  let iy = (held('ArrowUp') ? 1 : 0) - (held('ArrowDown') ? 1 : 0);
  const pad = inp.pad;
  ix ||= pad.leftX;
  iy ||= pad.leftY;
  const il = Math.hypot(ix, iy);
  if (il > 1) { ix /= il; iy /= il; }

  // Dash: hold Shift (or LB) and tap a direction, or hold a direction and
  // tap the modifier. A short, untouchable burst that way.
  const mod = inp.held.has('ShiftLeft') || inp.held.has('ShiftRight') || held('LeftShoulder');
  const modTap = inp.pressed.has('ShiftLeft') || inp.pressed.has('ShiftRight') || press('LeftShoulder');
  const dirTap = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].some(press);
  if (p.dash > 0) p.dash--;
  if (p.dashCd > 0) p.dashCd--;
  if (mod && (dirTap || (modTap && il > .2)) && il > .2 && p.dashCd <= 0) {
    p.dash = 12; p.dashCd = 22;
    p.va += ix / il * 32; p.vu += iy / il * 26;
    S.dashDir = [ix / il, iy / il];
    api.drum('whoosh', 1.7, ix * .7);
    api.drum('hat', 1);
  }
  if ((press('A') || press('B') || inp.pressed.has('Space')) && p.rollCd <= 0) {
    p.roll = 24; p.rollCd = 50;
    const dx = il > .2 ? ix : 0, dy = il > .2 ? iy : 1;
    p.va += dx * 16; p.vu += dy * 13;
    api.drum('whoosh', 1.1);
  }
  p.va = (p.va + ix * 1.5) * .86;
  p.vu = (p.vu + iy * 1.5) * .86;

  const th = S.camYaw, right = [-Math.sin(th), Math.cos(th)], look = [Math.cos(th), Math.sin(th)];
  let a = p.f * right[0] + p.s * right[1], d = p.f * look[0] + p.s * look[1];
  a = clamp(a + p.va, -LATERAL, LATERAL);
  d *= .9;
  p.u = clamp(p.u + p.vu, 0, CEILING);
  if (p.u === 0 || p.u === CEILING) p.vu = 0;
  if (Math.abs(a) === LATERAL) p.va = 0;
  p.f = right[0] * a + look[0] * d;
  p.s = right[1] * a + look[1] * d;
  if (p.roll > 0) p.roll--;
  if (p.rollCd > 0) p.rollCd--;
  if (p.inv > 0) p.inv--;

  const { width, height } = api.view();
  if (inp.mouse.moved) { S.reticle.x = inp.mouse.x; S.reticle.y = inp.mouse.y; }
  if (Math.hypot(pad.rightX, pad.rightY) > .15) {
    S.reticle.x = clamp(S.reticle.x + pad.rightX * 26, 0, width);
    S.reticle.y = clamp(S.reticle.y - pad.rightY * 26, 0, height);
    Overlay.padAim(api, S.reticle.x, S.reticle.y);
  }
  S.reticle.x = clamp(S.reticle.x, 0, width);
  S.reticle.y = clamp(S.reticle.y, 0, height);

  // Tap to fire: one press, one round. A tap during the short recovery is
  // held for a few frames rather than dropped.
  const fr = frameNow();
  Combat.updateLock(S, fr);
  if (p.fireCd > 0) p.fireCd--;
  if (press('X') || press('RightShoulder') || inp.mouse.clicks.length) p.fireBuf = 8;
  if (p.fireBuf > 0) {
    p.fireBuf--;
    if (p.fireCd <= 0) { p.fireCd = 7; p.fireBuf = 0; Combat.fire(S, api, fr); }
  }
  if (S.muzzle > 0) S.muzzle--;
}

// ── Camera ───────────────────────────────────────────────────────────────
function updateCamera(api) {
  const view = api.view();
  if (S.mode === 'title') {
    const w = biomeWeights(S.fly.p[0], S.fly.p[2]);
    const blend = key => [0, 1, 2].map(k => w.reduce((sum, wi, i) => sum + wi * BIOMES[i][key][k], 0));
    S.sky = blend('sky');
    S.fogCol = blend('fog');
    S.cam = Title.flightCamera(S.fly, view, S.fogCol);
    S.mapE = 0;
    return;
  }
  const indoor = S.stage !== 'island';
  if (!indoor) {
    const w = biomeWeights(S.O[0], S.O[2]);
    const blend = key => [0, 1, 2].map(k => w.reduce((sum, wi, i) => sum + wi * BIOMES[i][key][k], 0));
    S.sky = blend('sky');
    S.fogCol = blend('fog');
  }
  const yaw = S.heading + S.camYaw;
  const D = [Math.sin(yaw), 0, Math.cos(yaw)];
  const p = S.player, T = Rail.toWorld(frameNow(), p.f * .45, p.s * .45, 0);
  const target = [T[0] + D[0] * 120, S.O[1] + 230 + p.u * .5, T[2] + D[2] * 120];
  const dist = PLAY_DIST[S.stage];
  let pitch = indoor ? .12 : .17;
  if (!indoor) {
    const back = dist * Math.cos(pitch);
    const ground = Math.max(groundAt(target[0] - D[0] * back, target[2] - D[2] * back),
      groundAt(target[0] - D[0] * back * .5, target[2] - D[2] * back * .5)) + 130;
    const need = (ground - target[1]) / dist;
    if (need > Math.sin(pitch)) pitch = Math.asin(Math.min(.85, need));
  }
  S.camPitch = lerp(S.camPitch, pitch, pitch > S.camPitch ? .25 : .06);

  const m = S.map.t, e = m * m * (3 - 2 * m);
  S.mapE = e;
  const mapTarget = [lerp(S.O[0], 0, .5), 0, lerp(S.O[2], 0, .5)];
  const tgt = [0, 1, 2].map(k => lerp(target[k], mapTarget[k], e));
  if (S.shake > 0) {
    tgt[0] += (Math.random() - .5) * S.shake * 2;
    tgt[1] += (Math.random() - .5) * S.shake * 2;
  }
  const room = INDOOR[S.stage];
  S.cam = makeCamera(tgt, yaw, lerp(S.camPitch, 1.52, e), lerp(dist, MAP_DIST, e * e), view, room
    ? { fov: FOV, far: room.far, fogStart: room.fogStart, fog: room.fog }
    : { fov: lerp(FOV, MAP_FOV, e), far: lerp(4600, 30000, e), fogStart: lerp(1800, 30000, e), fog: S.fogCol });
}

// ── Menus (title and game over share one) ────────────────────────────────
function menuItems() {
  if (S.paused) return { items: ['resume', 'title'], enabled: [true, true] };
  return S.mode === 'title'
    ? { items: ['start', 'continue'], enabled: [true, !!S.save] }
    : { items: ['retry', 'title'], enabled: [true, true] };
}
function menuLayout(api) {
  const { items } = menuItems(), view = api.view();
  return Title.layout(view, items, S.mode === 'title' && !S.paused ? null : view.height * (S.paused ? .5 : .62));
}

function menuSim(api, inp, press) {
  const { items, enabled } = menuItems(), L = menuLayout(api);
  let hover = null;
  const m = inp.mouse;
  if (m.moved) {
    hover = Title.rowAt(L, m.x, m.y);
    if (hover && hover.i !== S.sel) { S.sel = hover.i; api.drum('hat', .8); }
  }
  S.menuHover = Title.rowAt(L, m.x, m.y) ? true : m.moved ? false : S.menuHover;
  const n = items.length;
  if (press('ArrowUp')) { S.sel = (S.sel + n - 1) % n; api.drum('hat', .8); }
  if (press('ArrowDown')) { S.sel = (S.sel + 1) % n; api.drum('hat', .8); }
  let pick = -1;
  for (const c of m.clicks) { const r = Title.rowAt(L, c.x, c.y); if (r) pick = r.i; }
  if (press('X') || press('A') || press('B') || press('Menu') || press('RightShoulder') || inp.pressed.has('Space') || inp.pressed.has('Enter') || inp.pressed.has('NumpadEnter')) pick = S.sel;
  if (pick < 0) return;
  if (!enabled[pick]) { api.drum('block', 1); return; }
  const what = items[pick];
  if (what === 'start') begin(api, 'hall');
  else if (what === 'continue') begin(api, S.save.stage, S.save);
  else if (what === 'retry') { const save = loadSave(); begin(api, save?.stage || 'hall', save || {}); }
  else if (what === 'resume') { S.paused = false; api.drum('ding', 1.2); }
  else if (what === 'title') { toTitle(); api.drum('whoosh', 1); }
}

// ── The tick ─────────────────────────────────────────────────────────────
export function sim(api) {
  const inp = readInput(api);
  S.padConnected = inp.pad.connected;
  S.controllerStatus = inp.pad.status;
  const down = new Set([...inp.pad.down, ...inp.directions]);
  if (inp.setupOpen) {
    if (S.mode === 'play') S.paused = true;
    prevDown = down;
    return;
  }
  const press = b => down.has(b) && !prevDown.has(b);
  const pauseKey = inp.pressed.has('Enter') || inp.pressed.has('NumpadEnter') || press('Menu');

  // Pause stops the whole loop: nothing advances, not even the clock, until
  // Enter / Start again or "resume".
  if (S.mode === 'play' && (S.paused || pauseKey)) {
    if (pauseKey) {
      S.paused = !S.paused;
      S.sel = 0;
      api.drum(S.paused ? 'block' : 'ding', 1.2);
    } else menuSim(api, inp, press);
    prevDown = down;
    Overlay.setMode(cursorMode());
    return;
  }
  S.t++;

  if (S.mode === 'title') {
    Title.stepFlight(S.fly);
    menuSim(api, inp, press);
  } else if (S.mode === 'over') {
    S.overT++;
    Combat.stepParticlesOnly(S);
    if (S.overT > 50) menuSim(api, inp, press);
  } else {
    S.stageT++;
    const map = S.map, outdoors = S.stage === 'island';
    const mapKey = inp.pressed.has('KeyM') || press('Y') || press('View');
    if (!map.open && mapKey) {
      if (outdoors) openMap(api);
      else { S.toast = 'no map indoors'; S.toastT = 70; api.drum('block', .8); }
    } else if (map.open) mapSim(api, inp, press);
    map.t = clamp(map.t + (map.open ? 1 : -1) / 36, 0, 1);
    if (!map.open && map.t < .2) {
      if (inp.pressed.has('KeyQ') || press('LeftTrigger')) cycleCamera(api, -1);
      if (inp.pressed.has('KeyE') || press('RightTrigger')) cycleCamera(api, 1);
      S.camYaw = lerp(S.camYaw, S.camYawTarget, .16);
      if (outdoors) advanceRail(api);
      else {
        const next = Facility.step(S, api);
        if (next) enterStage(api, next);
      }
      if (S.mode === 'play') {
        playerSim(api, inp, down, press);
        Combat.step(S, api, frameNow());
        if (S.stage === 'island') islandNudge();
      }
      if (S.toastT > 0) S.toastT--;
      if (S.hurtT > 0) S.hurtT--;
      if (S.shake > 0) S.shake *= .85;
      if (S.shake < .5) S.shake = 0;
    }
  }
  prevDown = down;
  updateCamera(api);
  Overlay.setMode(cursorMode());
}

function cursorMode() {
  if (S.paused) return S.menuHover ? 'active' : 'menu';
  if (S.mode === 'play') {
    if (S.map.open || S.mapE > .3) return S.map.hover ? 'active' : 'menu';
    return S.lock || S.aimSwitch ? 'lock' : 'aim';
  }
  if (S.mode === 'over' && S.overT <= 50) return 'menu';
  return S.menuHover ? 'active' : 'menu';
}

// ── Drawing ──────────────────────────────────────────────────────────────
function drawPlayer(fr) {
  const p = S.player;
  if (S.mode === 'over') return;
  const P = Rail.toWorld(fr, p.f, p.s, p.u);
  const g = S.stage === 'island' ? groundAt(P[0], P[2]) : 0;
  if (g < P[1] + 40) {
    const r = 46 * clamp(1 - (P[1] - g) / 900, .35, 1);
    R.triW(P[0] - r, g + 4, P[2], P[0], g + 4, P[2] + r, P[0] + r, g + 4, P[2], 20, 24, 28, 8);
    R.triW(P[0] - r, g + 4, P[2], P[0] + r, g + 4, P[2], P[0], g + 4, P[2] - r, 20, 24, 28, 8);
  }
  if (p.inv > 0 && (S.t >> 2) % 2) return;
  const run = S.t * .32, air = clamp(p.u / 60, 0, 1);
  const sw = Math.sin(run) * .75 * (1 - air * .75);
  let B = M.yawBasis(P, S.heading);
  if (p.roll > 0) B = M.pitchAround(B, 0, 90, 0, (1 - p.roll / 24) * Math.PI * 2);
  const base = p.roll > 0 ? -90 : 0;
  const faces = [];
  const jacket = [214, 52, 64], pants = [40, 46, 76], skin = [240, 198, 160], dark = [34, 36, 48];
  for (const side of [-1, 1]) {
    const L = M.pitchAround(B, side * 14, base + 70, 0, side * sw - air * .45);
    M.box(faces, L, 0, -33, 0, 9, 33, 10, pants);
    M.box(faces, L, 0, -66, 5, 10, 6, 14, dark);
  }
  M.box(faces, B, 0, base + 104, 0, 25, 34, 15, jacket, [240, 90, 90]);
  M.box(faces, B, 0, base + 104, -24, 18, 22, 9, dark);
  M.box(faces, B, 0, base + 153, 2, 15, 15, 15, skin);
  M.box(faces, B, 0, base + 166, -2, 17, 5, 17, [40, 30, 30]);
  M.box(faces, B, 0, base + 154, 16, 12, 5, 2, [90, 240, 255], null, false);
  const arm = M.pitchAround(B, -30, base + 126, 0, -sw * .8);
  M.box(faces, arm, 0, -30, 0, 7, 30, 7, jacket);
  const shoulder = M.at(B, 30, base + 124, 0);
  const cam = S.cam, dirAim = [0, 0, 0];
  const a = (S.reticle.x - cam.cx) / cam.f, b = (cam.cy - S.reticle.y) / cam.f;
  for (let k = 0; k < 3; k++) dirAim[k] = cam.pos[k] + (cam.fw[k] + cam.right[k] * a + cam.up[k] * b) * S.aimT - shoulder[k];
  const G = M.lookBasis(shoulder, dirAim);
  M.box(faces, G, 0, 0, 38, 8, 8, 40, [70, 76, 92]);
  M.box(faces, G, 0, -12, 14, 6, 10, 7, dark);
  R.mesh(faces);
  if (p.dash > 0 && S.dashDir) {
    const th = S.camYaw, rx = -Math.sin(th), rs = Math.cos(th);
    for (let i = 1; i <= 4; i++) {
      const k = i * 26 * p.dash / 12;
      const Q = Rail.toWorld(fr, p.f - rx * S.dashDir[0] * k, p.s - rs * S.dashDir[0] * k, p.u + 100 - S.dashDir[1] * k);
      R.spark(Q[0], Q[1], Q[2], 34 - i * 6, 120, 230, 255, 4);
    }
  }
  const jet = M.at(B, 0, base + 78, -28);
  if (p.u > 4) R.spark(jet[0], jet[1], jet[2], 14 + Math.random() * 10, 255, 170, 70, 6);
  if (S.muzzle > 0) {
    const mz = M.at(G, 0, 0, 84);
    R.spark(mz[0], mz[1], mz[2], 30 + S.muzzle * 12, 255, 255, 220, -10);
    R.spark(mz[0], mz[1], mz[2], 14 + S.muzzle * 5, 255, 255, 255, -12);
  }
}

function drawOver(api) {
  const { width: w, height: h } = api.view();
  api.box(0, h * .2, w, h * .36, 16, 12, 24);
  const px = Math.max(6, Math.min(16, w / 120));
  const head = S.why === 'the door was sealed' ? 'sealed in' : 'shot down';
  bigWrite(api, head, w / 2 - bigWidth(head, px) / 2, h * .24, px, [255, 90, 80], [6, 4, 12]);
  const sub = 'score ' + S.score + '   ' + S.kills + ' down   ' + STAGE_NAME[S.stage];
  bigWrite(api, sub, w / 2 - bigWidth(sub, 4) / 2, h * .24 + px * 7 + 30, 4, [240, 240, 250]);
  if (S.hint) bigWrite(api, S.hint, w / 2 - bigWidth(S.hint, 4) / 2, h * .24 + px * 7 + 80, 4, [255, 236, 140]);
  if (S.overT > 50) {
    const { items, enabled } = menuItems();
    Title.drawMenu(api, menuLayout(api), S.sel, enabled, S.t, false);
  }
}

export function paint(api) {
  if (!S.cam) return;
  const cam = S.cam, room = S.mode !== 'title' && INDOOR[S.stage];
  if (room) {
    api.wipe(...room.bg);
    R.begin(cam);
    Facility.draw(R, S, cam);
  } else {
    Hud.background(api, cam, S.sky);
    R.begin(cam);
    drawTerrain(R, cam, S.mapE > .35 ? 2 : 1);
    drawScenery(R, cam);
  }
  if (S.mode !== 'title') {
    const fr = frameNow();
    drawPlayer(fr);
    Combat.draw(R, S, fr);
    R.flush(api);
    if (S.mode === 'play') {
      if (S.mapE > .02) Hud.drawMap(api, S, fr, S.mapE);
      else Hud.drawHud(api, S, fr);
    }
  } else R.flush(api);

  if (S.mode === 'title') {
    const { items, enabled } = menuItems();
    Title.drawMenu(api, menuLayout(api), S.sel, enabled, S.t, true);
    const { width: w, height: h } = api.view();
    const foot = 'wasd move   shift + direction dash   mouse aim   tap click or j shoot   q e turn camera   enter pause';
    api.write(foot, w / 2 - api.textWidth(foot, 24) / 2, h - 46, 24, 240, 246, 255);
    if (S.controllerStatus) api.write(S.controllerStatus, 30, h - 82, 24, 255, 236, 120);
  } else if (S.mode === 'over') drawOver(api);
  if (S.paused) drawPause(api);
}

function drawPause(api) {
  const { width: w, height: h } = api.view();
  api.box(0, h * .2, w, h * .66, 12, 14, 28);
  const px = Math.max(6, Math.min(18, w / 100));
  bigWrite(api, 'paused', w / 2 - bigWidth('paused', px) / 2, h * .27, px, [255, 236, 120], [6, 4, 12]);
  const { enabled } = menuItems();
  Title.drawMenu(api, menuLayout(api), S.sel, enabled, S.t, false);
  const foot = 'enter or start to resume';
  api.write(foot, w / 2 - api.textWidth(foot, 24) / 2, h * .8, 24, 220, 230, 245);
}
