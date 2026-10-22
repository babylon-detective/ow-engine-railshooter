// island crisis — a 3D rail shooter in the spirit of Sin & Punishment and
// Panzer Dragoon Orta, drawn with flat triangles on the oskiewar engine.
// The runner follows a rail network across a five-biome island; M lifts the
// camera into a map where the next pathway is chosen. See NOTES.md.
import { buildWorld, BIOMES, biomeWeights, biomeAt, groundAt, drawTerrain, drawScenery } from './lib/world.mjs';
import { Renderer, makeCamera, project } from './lib/render.mjs';
import { installInput, readInput } from './lib/input.mjs';
import * as Rail from './lib/rail.mjs';
import * as Combat from './lib/combat.mjs';
import * as Hud from './lib/hud.mjs';
import * as M from './lib/mesh.mjs';
import { clamp, lerp, angleLerp } from './lib/util.mjs';

const FOV = 1.08, PLAY_DIST = 760, MAP_DIST = 8800;
const LATERAL = 400, CEILING = 460;
const R = new Renderer();
const S = { mode: 'title', t: 0, cam: null };
let prevDown = new Set();

function reset(api) {
  const { width, height } = api.view();
  Object.assign(S, {
    mode: 'play', t: 0, overT: 0,
    edge: 0, dir: 1, s: 0, speed: 7.2, heading: 0, O: [0, 0, 0],
    camDir: 0, camYaw: 0, camYawTarget: 0, camPitch: .17,
    map: { open: false, t: 0, routes: [], ahead: [], sel: 0 },
    route: [], routeLabel: '',
    player: { f: 0, s: 0, u: 140, va: 0, vu: 0, hp: 100, inv: 0, roll: 0, rollCd: 0, fireCd: 0 },
    reticle: { x: width / 2, y: height * .42 }, lock: null, aimT: 2800, muzzle: 0,
    enemies: [], ebullets: [], shots: [], parts: [],
    score: 0, kills: 0, spawnT: 140, turretT: 240, bossT: 2700,
    biome: -1, visited: new Set(), toast: '', toastT: 0, shake: 0, hurtT: 0,
  });
  const r = Rail.sample(S.edge, S.dir, S.s);
  S.O = r.p;
  S.heading = r.heading;
}

export function boot(api) {
  installInput();
  buildWorld();
  reset(api);
  S.mode = 'title';
}

const frameNow = () => Rail.frame(S.O, S.heading);

function openMap(api) {
  const { routes, ahead } = Rail.routesFrom(S.edge, S.dir, S.s);
  Object.assign(S.map, { open: true, routes, ahead });
  const current = S.route.length
    ? routes.findIndex(r => r.legs.length && r.legs.at(-1).edge === S.route.at(-1).edge && r.legs.at(-1).dir === S.route.at(-1).dir)
    : -1;
  S.map.sel = current >= 0 ? current : Math.max(0, routes.findIndex(r => r.best));
  api.drum('whoosh', 1);
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
  api.drum('ding', 1);
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
    if (h >= 0 && h !== map.sel) { map.sel = h; api.tone(660, .05); }
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
  api.drum('whoosh', .45, d * .6);
}

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
    S.biome = b;
    const first = !S.visited.has(b);
    S.visited.add(b);
    S.toast = BIOMES[b].name + (first && S.t > 10 ? '   +15 hp' : '');
    S.toastT = 120;
    if (first && S.t > 10) S.player.hp = Math.min(100, S.player.hp + 15);
    if (S.t > 10) api.drum('bell', .8);
  }
}

function playerSim(api, inp, down, press) {
  const p = S.player;
  const held = b => down.has(b);
  let ix = (held('ArrowRight') ? 1 : 0) - (held('ArrowLeft') ? 1 : 0);
  let iy = (held('ArrowUp') ? 1 : 0) - (held('ArrowDown') ? 1 : 0);
  const pad = api.pad(0);
  if (Math.abs(pad.leftX) > .15) ix += pad.leftX;
  if (Math.abs(pad.leftY) > .15) iy += pad.leftY;
  const il = Math.hypot(ix, iy);
  if (il > 1) { ix /= il; iy /= il; }

  if ((press('A') || press('B') || inp.pressed.has('Space')) && p.rollCd <= 0) {
    p.roll = 24; p.rollCd = 50;
    const dx = il > .2 ? ix : 0, dy = il > .2 ? iy : 1;
    p.va += dx * 16; p.vu += dy * 13;
    api.drum('whoosh', .6);
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
    S.reticle.x += pad.rightX * 26;
    S.reticle.y -= pad.rightY * 26;
  }
  S.reticle.x = clamp(S.reticle.x, 0, width);
  S.reticle.y = clamp(S.reticle.y, 0, height);

  const fr = frameNow();
  Combat.updateLock(S, fr);
  if (p.fireCd > 0) p.fireCd--;
  const firing = held('X') || held('RightShoulder') || inp.mouse.down;
  if (firing && p.fireCd <= 0) { p.fireCd = 5; Combat.fire(S, api, fr); }
  if (S.muzzle > 0) S.muzzle--;
}

function updateCamera(api) {
  const view = api.view();
  const w = biomeWeights(S.O[0], S.O[2]);
  const blend = key => [0, 1, 2].map(k => w.reduce((sum, wi, i) => sum + wi * BIOMES[i][key][k], 0));
  S.sky = blend('sky');
  S.fogCol = blend('fog');
  if (S.mode === 'title') {
    S.cam = makeCamera([0, 500, 0], S.t * .0016, .52, 6200, view,
      { fov: FOV, far: 16000, fogStart: 8000, fog: [190, 214, 236] });
    S.sky = [140, 190, 240];
    S.mapE = 0;
    return;
  }
  const yaw = S.heading + S.camYaw;
  const D = [Math.sin(yaw), 0, Math.cos(yaw)];
  const target = [S.O[0] + D[0] * 150, S.O[1] + 190, S.O[2] + D[2] * 150];
  let pitch = .17;
  const back = PLAY_DIST * Math.cos(pitch);
  const ground = Math.max(groundAt(target[0] - D[0] * back, target[2] - D[2] * back),
    groundAt(target[0] - D[0] * back * .5, target[2] - D[2] * back * .5)) + 130;
  const need = (ground - target[1]) / PLAY_DIST;
  if (need > Math.sin(pitch)) pitch = Math.asin(Math.min(.85, need));
  S.camPitch = lerp(S.camPitch, pitch, pitch > S.camPitch ? .25 : .06);

  const m = S.map.t, e = m * m * (3 - 2 * m);
  S.mapE = e;
  const mapTarget = [lerp(S.O[0], 0, .5), 0, lerp(S.O[2], 0, .5)];
  const tgt = [0, 1, 2].map(k => lerp(target[k], mapTarget[k], e));
  if (S.shake > 0) {
    tgt[0] += (Math.random() - .5) * S.shake * 2;
    tgt[1] += (Math.random() - .5) * S.shake * 2;
  }
  S.cam = makeCamera(tgt, yaw, lerp(S.camPitch, 1.52, e), lerp(PLAY_DIST, MAP_DIST, e * e), view, {
    fov: FOV, far: lerp(4300, 30000, e), fogStart: lerp(1500, 30000, e), fog: S.fogCol,
  });
}

export function sim(api) {
  const inp = readInput(api);
  const down = new Set(api.pad(0).down);
  const press = b => down.has(b) && !prevDown.has(b);
  S.t++;
  const start = press('X') || press('A') || press('RightShoulder') || inp.mouse.clicks.length > 0 || inp.pressed.has('Space');

  if (S.mode === 'title') {
    if (start) { reset(api); api.drum('gong', 1); }
  } else if (S.mode === 'over') {
    S.overT++;
    Combat.stepParticlesOnly(S);
    if (S.overT > 70 && start) { reset(api); api.drum('gong', 1); }
  } else {
    const map = S.map;
    if (!map.open && (inp.pressed.has('KeyM') || press('Y') || press('View'))) openMap(api);
    else if (map.open) mapSim(api, inp, press);
    map.t = clamp(map.t + (map.open ? 1 : -1) / 36, 0, 1);
    if (!map.open && map.t < .2) {
      if (inp.pressed.has('KeyQ') || press('LeftTrigger')) cycleCamera(api, -1);
      if (inp.pressed.has('KeyE') || press('RightTrigger')) cycleCamera(api, 1);
      S.camYaw = lerp(S.camYaw, S.camYawTarget, .14);
      advanceRail(api);
      playerSim(api, inp, down, press);
      Combat.step(S, api, frameNow());
      if (S.toastT > 0) S.toastT--;
      if (S.hurtT > 0) S.hurtT--;
      if (S.shake > 0) S.shake *= .85;
      if (S.shake < .5) S.shake = 0;
    }
  }
  prevDown = down;
  updateCamera(api);
}

function drawPlayer(fr) {
  const p = S.player;
  if (S.mode === 'over') return;
  const P = Rail.toWorld(fr, p.f, p.s, p.u);
  const g = groundAt(P[0], P[2]);
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
  const cam = S.cam, dirAim = [0, 1, 2].map(k => cam.pos[k] - shoulder[k]);
  const ray = (() => {
    const a = (S.reticle.x - cam.cx) / cam.f, b = (cam.cy - S.reticle.y) / cam.f;
    return [0, 1, 2].map(k => cam.pos[k] + (cam.fw[k] + cam.right[k] * a + cam.up[k] * b) * S.aimT);
  })();
  for (let k = 0; k < 3; k++) dirAim[k] = ray[k] - shoulder[k];
  const G = M.lookBasis(shoulder, dirAim);
  M.box(faces, G, 0, 0, 38, 8, 8, 40, [70, 76, 92]);
  M.box(faces, G, 0, -12, 14, 6, 10, 7, dark);
  R.mesh(faces);
  const jet = M.at(B, 0, base + 78, -28);
  if (p.u > 4) R.spark(jet[0], jet[1], jet[2], 14 + Math.random() * 10, 255, 170, 70, 6);
  if (S.muzzle > 0) {
    const mz = M.at(G, 0, 0, 84);
    R.spark(mz[0], mz[1], mz[2], 26, 255, 255, 200, -10);
  }
}

export function paint(api) {
  if (!S.cam) return;
  const cam = S.cam;
  Hud.background(api, cam, S.sky);
  R.begin(cam);
  drawTerrain(R, cam, S.mode === 'title' || S.mapE > .35 ? 2 : 1);
  drawScenery(R, cam);
  const { width, height } = api.view();
  if (S.mode !== 'title') {
    const fr = frameNow();
    drawPlayer(fr);
    Combat.draw(R, S, fr);
    R.flush(api);
    if (S.mapE > .02) Hud.drawMap(api, S, fr, S.mapE);
    else Hud.drawHud(api, S, fr);
  } else R.flush(api);

  if (S.mode === 'title') {
    const title = 'island crisis', s = 150;
    api.write(title, width / 2 - api.textWidth(title, s) / 2 + 6, height * .22 + 6, s, 20, 30, 50);
    api.write(title, width / 2 - api.textWidth(title, s) / 2, height * .22, s, 255, 230, 120);
    const sub = 'a rail shooter across five biomes';
    api.write(sub, width / 2 - api.textWidth(sub, 40) / 2, height * .22 + 170, 40, 240, 250, 255);
    if ((S.t >> 5) % 2) {
      const go = 'press j  or rb  or click to start';
      api.write(go, width / 2 - api.textWidth(go, 46) / 2, height * .72, 46, 255, 255, 255);
    }
  } else if (S.mode === 'over') {
    api.box(0, height * .3, width, height * .34, 16, 12, 24);
    const a = 'crisis unresolved', b = 'score ' + S.score + '   ' + S.kills + ' down   ' + S.visited.size + '/5 biomes';
    api.write(a, width / 2 - api.textWidth(a, 110) / 2, height * .34, 110, 255, 90, 80);
    api.write(b, width / 2 - api.textWidth(b, 40) / 2, height * .34 + 140, 40, 240, 240, 250);
    if (S.overT > 70) {
      const c = 'j or rb to run again';
      api.write(c, width / 2 - api.textWidth(c, 36) / 2, height * .34 + 200, 36, 255, 236, 140);
    }
  }
}
