// Enemies, bullets and sparks. Everything that moves lives in the rail's local
// frame (f forward, s right, u up), so it keeps pace with the runner the way
// Panzer Dragoon's flyers do; turrets are fixed to the ground instead.
// One tap, one shot, one kill: a hit enemy flashes red, then bursts.
import { BIOMES, groundAt } from './world.mjs';
import * as Rail from './rail.mjs';
import * as M from './mesh.mjs';
import * as Overlay from './overlay.mjs';
import { project, rayDir } from './render.mjs';
import { targetPoint } from './targeting.mjs';

// Per camera quadrant (0 ahead, 1 right, 2 behind, 3 left): the view direction
// and the screen-right direction, in (f, s).
export const QD = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const QR = [[0, 1], [-1, 0], [0, -1], [1, 0]];
const rnd = (a, b) => a + Math.random() * (b - a);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const DYING = 14;

export function quadrantOf(f, s) {
  return ((Math.round(Math.atan2(s, f) / (Math.PI / 2)) % 4) + 4) % 4;
}

const playerCore = S => [S.player.f, S.player.s, S.player.u + 80];
const enemyColor = S => S.stage === 'island' ? BIOMES[S.biome < 0 ? 0 : S.biome].enemy : [235, 96, 52];
const centerU = e => e.u + (e.type === 'turret' ? 100 : 0);

// Where a flyer hovers: `box` is [near, far, lateral, low, high] around the
// runner, in its quadrant.
const ISLAND_BOX = [520, 950, 460, 120, 480];
function hoverTarget(e, lateral = rnd(-e.box[2], e.box[2])) {
  const depth = rnd(e.box[0], e.box[1]);
  e.tf = QD[e.q][0] * depth + QR[e.q][0] * lateral;
  e.ts = QD[e.q][1] * depth + QR[e.q][1] * lateral;
  e.tu = rnd(e.box[3], e.box[4]);
}

export function spawnFlyer(S, type, q, lateral, opts = {}) {
  const box = opts.box || ISLAND_BOX;
  const depth = opts.from ?? rnd(1700, 2100);
  const e = {
    type, q, hp: 1, t: 0, flash: 0, dying: 0, phase: rnd(0, 6), box, wave: opts.wave ?? -1,
    f: QD[q][0] * depth + QR[q][0] * lateral, s: QD[q][1] * depth + QR[q][1] * lateral, u: rnd(box[3], box[4]) + 200,
    vf: 0, vs: 0, vu: 0, rad: type === 'drone' ? 120 : 100, score: type === 'drone' ? 100 : 150,
    fireT: opts.fireT ?? rnd(90, 170), dmg: 10, col: enemyColor(S),
  };
  hoverTarget(e, Math.max(-box[2], Math.min(box[2], lateral * .6)));
  S.enemies.push(e);
  return e;
}

// A slab is a target the size of a screen panel: an armoured plate with a
// glowing core that lobs slow, heavy orbs.
export function spawnSlab(S, q, lateral, up, opts = {}) {
  const depth = opts.depth ?? rnd(1150, 1400);
  const from = depth + 1600;
  const e = {
    type: 'slab', q, hp: 1, t: 0, flash: 0, dying: 0, phase: rnd(0, 6), wave: opts.wave ?? -1,
    f: QD[q][0] * from + QR[q][0] * lateral, s: QD[q][1] * from + QR[q][1] * lateral, u: up + 300,
    tf: QD[q][0] * depth + QR[q][0] * lateral, ts: QD[q][1] * depth + QR[q][1] * lateral, tu: up,
    rad: 330, score: 300, fireT: rnd(140, 220), dmg: 12, col: opts.col || [236, 96, 52],
  };
  S.enemies.push(e);
  return e;
}

function spawnWave(S, diff) {
  const q = Math.random() < .7 ? S.camDir : (S.camDir + 1 + Math.floor(Math.random() * 3)) % 4;
  const chargerBias = S.biome === 3 || S.biome === 2 ? .45 : .2;
  const n = 1 + Math.floor(Math.random() * (2 + diff * .5));
  const type = Math.random() < chargerBias ? 'charger' : 'drone';
  for (let i = 0; i < n && S.enemies.length < 12; i++) spawnFlyer(S, type, q, (i - (n - 1) / 2) * 340);
  if (diff > 1 && Math.random() < .3) spawnSlab(S, q, (Math.random() - .5) * 600, rnd(260, 520), { col: enemyColor(S) });
}

function spawnTurrets(S) {
  const len = Rail.edgeLen(S.edge);
  const ahead = S.s + rnd(1500, 2000);
  if (ahead > len - 50) return;
  const r = Rail.sample(S.edge, S.dir, ahead);
  const fr = Rail.frame(r.p, r.heading);
  const n = Math.random() < .4 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const side = (i === 0 ? 1 : -1) * (Math.random() < .5 ? 1 : -1);
    const w = Rail.toWorld(fr, rnd(-100, 100), side * rnd(260, 430), 0);
    w[1] = groundAt(w[0], w[2]);
    S.enemies.push({ type: 'turret', w, f: 0, s: 0, u: 0, hp: 1, t: 0, flash: 0, dying: 0, rad: 120, score: 120,
      fireT: rnd(50, 100), dmg: 10, col: enemyColor(S) });
  }
}

function spawnGunship(S, api) {
  const e = { type: 'gunship', q: S.camDir, hp: 6, max: 6, t: 0, flash: 0, dying: 0, phase: 0,
    f: 0, s: 0, u: 900, rad: 260, score: 2000, fireT: 120, volley: 0, dmg: 10, col: [220, 70, 160],
    box: [1000, 1200, 200, 380, 460] };
  e.f = QD[e.q][0] * 3000; e.s = QD[e.q][1] * 3000;
  hoverTarget(e, 0);
  S.enemies.push(e);
  S.toast = 'warning: gunship'; S.toastT = 150;
  api.drum('gong', 1.6);
}

function fireAt(S, e, speed, spread = 0, lift = 0, big = false) {
  const P = playerCore(S);
  let df = P[0] - e.f, ds = P[1] - e.s, du = P[2] - e.u;
  const l = Math.hypot(df, ds, du) || 1;
  df /= l; ds /= l; du /= l;
  if (spread) {
    const c = Math.cos(spread), s = Math.sin(spread);
    [df, ds] = [df * c - ds * s, df * s + ds * c];
  }
  S.ebullets.push({ f: e.f, s: e.s, u: e.u, vf: df * speed, vs: ds * speed, vu: du * speed + lift, life: 480,
    dmg: e.dmg || 10, big });
}

function burst(S, f, s, u, n, size, palette, speed = 9) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), b = rnd(-1, 1), v = rnd(.3, 1) * speed, c = Math.sqrt(1 - b * b);
    const life = rnd(20, 46) | 0;
    S.parts.push({ f, s, u, vf: Math.cos(a) * c * v, vs: Math.sin(a) * c * v, vu: b * v + 2, life, max: life,
      size: size * rnd(.6, 1.3), col: palette[i % palette.length] });
  }
}
const FIRE = [[255, 250, 210], [255, 236, 150], [255, 160, 50], [236, 70, 40], [120, 110, 110]];
const RED = [[255, 60, 60], [255, 200, 200], [255, 255, 255]];

export const panOf = (S, e) => Math.max(-1, Math.min(1, (e.s * Math.cos(S.camYaw) - e.f * Math.sin(S.camYaw)) / 1200));

// The tap that lands: the enemy is out of the fight at once (score counts
// now), flashes red for a few frames, then bursts in explode().
function hitEnemy(S, e, api) {
  e.hp--;
  e.flash = 8;
  const pan = panOf(S, e);
  Overlay.hitMarker();
  if (e.hp > 0) {
    api.drum('block', 1.6, pan);
    api.drum('body-impact', 1, pan);
    return;
  }
  e.dying = DYING;
  S.score += e.score;
  S.kills++;
  api.drum('body-impact', 1.8, pan);
  api.drum('block', 1.4, pan);
}

function explode(S, e, api) {
  const big = e.type === 'gunship' || e.type === 'slab', pan = panOf(S, e);
  const cu = centerU(e);
  burst(S, e.f, e.s, cu, big ? 70 : 26, big ? 46 : 24, FIRE, big ? 20 : 12);
  burst(S, e.f, e.s, cu, big ? 18 : 8, big ? 30 : 16, RED, big ? 26 : 16);
  api.drum('snare', 2, pan);
  api.drum('kick', 2, pan);
  api.drum('glass-shard', big ? 1.6 : 1.1, pan);
  Overlay.flash([255, 246, 220], big ? .42 : .26, big ? 260 : 150);
  S.shake = Math.max(S.shake, big ? 22 : 10);
  if (e.type === 'gunship') {
    api.drum('gong', 1.6, pan);
    S.player.hp = Math.min(100, S.player.hp + 25);
    S.toast = 'gunship down  +25 hp'; S.toastT = 150;
  }
}

export function hurt(S, dmg, api) {
  const p = S.player;
  if (p.inv > 0 || p.dash > 0 || S.mode !== 'play') return false;
  p.hp = Math.max(0, p.hp - dmg);
  p.inv = 70;
  S.shake = 18;
  S.hurtT = 16;
  api.drum('body-impact', 2);
  Overlay.flash([255, 30, 50], .45, 320);
  if (p.hp <= 0) die(S, api, 'shot down');
  return true;
}

export function die(S, api, why) {
  const p = S.player;
  p.hp = 0;
  S.mode = 'over'; S.overT = 0; S.why = why;
  burst(S, p.f, p.s, p.u + 80, 50, 30, FIRE, 15);
  api.drum('gong', 2);
  api.drum('kick', 2);
  Overlay.flash([255, 255, 255], .9, 700);
}

// What sits under the reticle: the nearest enemy, and how deep to aim.
export function updateLock(S, fr) {
  const cam = S.cam;
  S.lock = null;
  S.aimT = 3200;
  S.aimSwitch = false;
  if (!cam) return;
  if (S.autoAim && S.autoTarget) {
    S.lock = S.autoTarget;
    S.aimT = dist3(cam.pos, targetPoint(fr, S.autoTarget));
    return;
  }
  for (const e of S.autoAim ? [] : S.enemies) {
    if (e.dying || e.hp <= 0) continue;
    const w = targetPoint(fr, e);
    const sp = project(cam, ...w);
    if (!sp) continue;
    const reach = Math.max(60, cam.f * e.rad / sp.z * 1.15);
    if (Math.hypot(sp.x - S.reticle.x, sp.y - S.reticle.y) < reach) {
      const d = dist3(cam.pos, w);
      if (d < S.aimT) { S.aimT = d; S.lock = e; }
    }
  }
  // Indoors the reticle ray stops at the room (or a switch), so shots from
  // the gun converge on what the reticle is actually over.
  if (S.level?.aim) {
    const hit = S.level.aim(S, cam, rayDir(cam, S.reticle.x, S.reticle.y));
    if (hit && hit.t < S.aimT) { S.aimT = hit.t; S.lock = null; S.aimSwitch = !!hit.switch; }
  }
}

// One tap: a fast round from the gun to wherever the reticle points, at the
// depth of whatever sits under it. Loud, bright, and it kicks.
export function fire(S, api, fr) {
  const cam = S.cam, p = S.player;
  if (!cam) return;
  const dir = rayDir(cam, S.reticle.x, S.reticle.y), T = S.aimT;
  const aim = Rail.toLocal(fr, cam.pos[0] + dir[0] * T, cam.pos[1] + dir[1] * T, cam.pos[2] + dir[2] * T);
  const th = S.camYaw, right = [-Math.sin(th), Math.cos(th)];
  const o = [p.f + right[0] * 26, p.s + right[1] * 26, p.u + 118];
  let vf = aim[0] - o[0], vs = aim[1] - o[1], vu = aim[2] - o[2];
  const l = Math.hypot(vf, vs, vu) || 1;
  S.shots.push({ f: o[0], s: o[1], u: o[2], vf: vf / l * 150, vs: vs / l * 150, vu: vu / l * 150, life: 30 });
  S.muzzle = 5;
  S.shake = Math.max(S.shake, 5);
  api.drum('kick', 1.7);
  api.drum('clap', 2);
  api.drum('hat', 1.4);
  Overlay.flash([255, 252, 236], .22, 90);
  Overlay.recoil();
}

function stepParts(S) {
  for (const q of S.parts) {
    q.f += q.vf; q.s += q.vs; q.u += q.vu;
    q.vf *= .94; q.vs *= .94; q.vu = q.vu * .94 - .15;
    q.life--;
  }
  S.parts = S.parts.filter(q => q.life > 0);
}

export function step(S, api, fr) {
  const island = S.stage === 'island';
  const diff = Math.min(5, S.stageT / 3000);
  const P = playerCore(S);

  if (island) {
    if (--S.spawnT <= 0) {
      spawnWave(S, diff);
      S.spawnT = Math.max(90, 200 - diff * 20) + rnd(0, 90);
    }
    if (--S.turretT <= 0) {
      spawnTurrets(S);
      S.turretT = rnd(220, 360);
    }
    if (--S.bossT <= 0) {
      if (!S.enemies.some(e => e.type === 'gunship')) spawnGunship(S, api);
      S.bossT = 2700;
    }
  }

  for (const e of S.enemies) {
    e.t++;
    if (e.flash > 0) e.flash--;
    if (e.type === 'turret') [e.f, e.s, e.u] = Rail.toLocal(fr, ...e.w);
    if (e.dying) {
      if (e.type !== 'turret') { e.u += 1.5; e.f += (e.vf || 0) * .2; e.s += (e.vs || 0) * .2; }
      if (--e.dying <= 0) { e.hp = -1; explode(S, e, api); }
      continue;
    }
    if (e.type === 'charger' && e.t > 100) {
      if (e.t === 101) {
        const l = Math.hypot(P[0] - e.f, P[1] - e.s, P[2] - e.u) || 1, v = 18 + diff;
        e.vf = (P[0] - e.f) / l * v; e.vs = (P[1] - e.s) / l * v; e.vu = (P[2] - e.u) / l * v;
        api.drum('whoosh', 1, panOf(S, e));
      }
      e.f += e.vf; e.s += e.vs; e.u += e.vu;
    } else if (e.type !== 'turret') {
      if (e.type === 'drone' && e.t % 220 === 0) hoverTarget(e);
      const k = e.type === 'gunship' ? .012 : e.type === 'slab' ? .022 : .03;
      e.f += (e.tf - e.f) * k; e.s += (e.ts - e.s) * k; e.u += (e.tu - e.u) * k;
      const w = Math.sin(e.t * (e.type === 'drone' ? .05 : .02) + e.phase) * (e.type === 'drone' ? 4 : 5);
      e.f += QR[e.q][0] * w; e.s += QR[e.q][1] * w;
    }

    const d = Math.hypot(P[0] - e.f, P[1] - e.s, P[2] - e.u);
    if (e.type === 'charger') {
      if (d < 120 && hurt(S, 16, api)) { e.hp = -1; burst(S, e.f, e.s, e.u, 14, 18, FIRE); }
    } else if (--e.fireT <= 0) {
      if (e.type === 'drone' && e.t > 70 && d < 3200) {
        fireAt(S, e, 9 + diff);
        e.fireT = 170 - diff * 12 + rnd(0, 90);
      } else if (e.type === 'slab' && e.t > 100) {
        fireAt(S, { f: e.f, s: e.s, u: e.u, dmg: e.dmg }, 7.5, 0, 0, true);
        api.drum('clap', 1, panOf(S, e));
        e.fireT = 190 + rnd(0, 90);
      } else if (e.type === 'turret' && d > 250 && d < 2400) {
        fireAt(S, { f: e.f, s: e.s, u: e.u + 100, dmg: 10 }, 10 + diff, 0, 1.2);
        e.fireT = 120 + rnd(0, 60);
      } else if (e.type === 'gunship' && e.t > 120) {
        e.volley++;
        const n = e.volley % 3 === 0 ? 7 : 5;
        for (let i = 0; i < n; i++) fireAt(S, e, 8 + diff, (i - (n - 1) / 2) * .11);
        api.drum('clap', 1.2, panOf(S, e));
        e.fireT = 110;
      } else e.fireT = 20;
    }
    const far = Math.hypot(e.f, e.s);
    if ((e.type === 'turret' && e.f < -700 && far > 2200) || far > 5600) e.hp = -1;
  }

  for (const b of S.shots) {
    const pf = b.f, ps = b.s, pu = b.u;
    b.f += b.vf; b.s += b.vs; b.u += b.vu;
    if (--b.life <= 0) continue;
    const sf = b.f - pf, ss = b.s - ps, su = b.u - pu, sl = sf * sf + ss * ss + su * su || 1;
    const hit = (cf, cs, cu, r) => {
      const t = Math.max(0, Math.min(1, ((cf - pf) * sf + (cs - ps) * ss + (cu - pu) * su) / sl));
      return Math.hypot(pf + sf * t - cf, ps + ss * t - cs, pu + su * t - cu) < r;
    };
    let best = null, bestT = 2;
    for (const e of S.enemies) {
      if (e.hp <= 0 || e.dying) continue;
      const cu = centerU(e);
      if (!hit(e.f, e.s, cu, e.rad)) continue;
      const t = ((e.f - pf) * sf + (e.s - ps) * ss + (cu - pu) * su) / sl;
      if (t < bestT) { bestT = t; best = e; }
    }
    if (best) {
      b.life = 0;
      hitEnemy(S, best, api);
      burst(S, b.f, b.s, b.u, 6, 14, [[255, 255, 220], [255, 80, 80]], 7);
      continue;
    }
    if (S.level?.shot?.(S, api, b, pf, ps, pu, hit)) { b.life = 0; continue; }
    for (const eb of S.ebullets) {
      if (eb.life > 0 && hit(eb.f, eb.s, eb.u, eb.big ? 90 : 56)) {
        eb.life = 0; b.life = 0;
        S.score += 10;
        burst(S, eb.f, eb.s, eb.u, 8, 14, [[255, 200, 120], [255, 255, 255]], 6);
        api.drum('glass-shard', 1);
        break;
      }
    }
  }

  for (const b of S.ebullets) {
    b.f += b.vf; b.s += b.vs; b.u += b.vu;
    if (--b.life <= 0) continue;
    if (Math.hypot(P[0] - b.f, P[1] - b.s, P[2] - b.u) < (b.big ? 80 : 56) && hurt(S, b.dmg, api)) b.life = 0;
  }

  stepParts(S);
  S.enemies = S.enemies.filter(e => e.hp > 0 || e.dying > 0);
  S.shots = S.shots.filter(b => b.life > 0);
  S.ebullets = S.ebullets.filter(b => b.life > 0 && Math.hypot(b.f, b.s) < 6000);
}

export const stepParticlesOnly = stepParts;

// Hit enemies flash red and white, swelling a little, before they burst.
function inkOf(S, e) {
  if (e.dying) return (S.t >> 1) % 2 ? [255, 36, 36] : [255, 236, 236];
  if (e.flash) return (e.flash >> 1) % 2 ? [255, 40, 40] : [255, 255, 255];
  return e.col;
}

export function draw(R, S, fr) {
  const pw = Rail.toWorld(fr, S.player.f, S.player.s, S.player.u + 80);
  for (const e of S.enemies) {
    const P = Rail.toWorld(fr, e.f, e.s, e.u);
    if (e.type === 'turret') P[1] = e.w[1];
    const col = inkOf(S, e), hot = e.dying || e.flash;
    const dark = hot ? [col[0] * .6, col[1] * .3, col[2] * .3] : [col[0] * .35, col[1] * .35, col[2] * .35];
    const k = e.dying ? 1 + (DYING - e.dying) * .02 : 1;
    const toP = [pw[0] - P[0], pw[1] - P[1], pw[2] - P[2]];
    const faces = [];
    if (e.type === 'drone') {
      const B = M.yawBasis(P, e.t * .08);
      M.octa(faces, B, 0, 0, 0, 96 * k, 40 * k, 96 * k, col, !hot);
      M.pyramid(faces, B, 0, 24, 0, 38 * k, 50 * k, 4, dark);
      M.box(faces, B, 0, -9, 0, 140 * k, 6, 14, dark);
      R.mesh(faces);
      if (!hot) R.spark(P[0], P[1] - 42, P[2], 19, 255, 255, 190, -30);
    } else if (e.type === 'charger') {
      const B = M.lookBasis(P, e.t > 100 ? [e.vf * fr.F[0] + e.vs * fr.S[0], e.vu, e.vf * fr.F[2] + e.vs * fr.S[2]] : toP);
      const c = !hot && e.t > 80 && (e.t >> 2) % 2 ? [255, 240, 200] : col;
      M.octa(faces, B, 0, 0, 0, 45 * k, 45 * k, 130 * k, c, !hot);
      M.box(faces, B, 0, 0, -56, 100 * k, 6, 30, dark);
      R.mesh(faces);
      if (e.t > 100 && !hot) R.spark(...M.at(B, 0, 0, -150), 34, 255, 160, 60, 10);
    } else if (e.type === 'turret') {
      const B = M.yawBasis(P, 0);
      M.box(faces, B, 0, 42, 0, 74, 42, 74, hot ? col : [70, 70, 80], dark);
      M.box(faces, B, 0, 118 * k, 0, 48 * k, 34 * k, 48 * k, col, null, !hot);
      const head = M.at(B, 0, 118, 0);
      M.box(faces, M.lookBasis(head, [pw[0] - head[0], pw[1] - head[1], pw[2] - head[2]]), 0, 0, 78, 13, 13, 70, dark);
      R.mesh(faces);
    } else if (e.type === 'slab') {
      const B = M.lookBasis(P, toP);
      const glow = 150 + 100 * Math.abs(Math.sin(e.t * .08));
      const charge = e.fireT < 40 && !hot;
      M.box(faces, B, 0, 0, 0, 380 * k, 250 * k, 34, col, null, !hot);
      for (const sx of [-1, 1]) M.box(faces, B, sx * 400 * k, 0, -10, 40, 280 * k, 50, dark, null, !hot);
      M.box(faces, B, 0, 270 * k, -10, 420 * k, 26, 46, dark, null, !hot);
      R.mesh(faces, 0);
      // The face panel and core sit on the plate, so they sort in front of it.
      const front = [];
      M.box(front, B, 0, 0, 40, 330 * k, 200 * k, 4, dark, null, false);
      R.mesh(front, -60);
      const core = [];
      M.octa(core, B, 0, 0, 70, 90 * k, 90 * k, 40, hot ? [255, 255, 255] : charge ? [255, 255, 200] : [255, glow, 90], false);
      R.mesh(core, -120);
      if (charge) R.spark(...M.at(B, 0, 0, 110), 60 + (40 - e.fireT) * 2, 255, 230, 140, -60);
    } else if (e.type === 'gunship') {
      const B = M.yawBasis(P, Math.atan2(toP[0], toP[2]));
      M.box(faces, B, 0, 0, 0, 170, 78, 320, col, dark, !hot);
      M.box(faces, B, 0, -14, -42, 500, 14, 126, dark);
      M.box(faces, B, 460, -56, -42, 42, 70, 98, [80, 80, 96]);
      M.box(faces, B, -460, -56, -42, 42, 70, 98, [80, 80, 96]);
      M.pyramid(faces, B, 0, 78, 56, 98, 84, 4, dark);
      const pulse = 150 + 100 * Math.abs(Math.sin(e.t * .1));
      M.octa(faces, B, 0, -84, 210, 70, 56, 70, hot ? [255, 255, 255] : [255, pulse, 120], false);
      R.mesh(faces);
      R.spark(...M.at(B, 460, -126, -42), 42, 255, 170, 80, 10);
      R.spark(...M.at(B, -460, -126, -42), 42, 255, 170, 80, 10);
    }
  }
  for (const b of S.ebullets) {
    const P = Rail.toWorld(fr, b.f, b.s, b.u), s = b.big ? 2.2 : 1;
    R.spark(P[0], P[1], P[2], 30 * s, 255, 70, 90);
    R.spark(P[0], P[1], P[2], 15 * s, 255, 236, 220, -2);
  }
  for (const b of S.shots) {
    for (let i = 0; i < 4; i++) {
      const k = i * .22;
      const P = Rail.toWorld(fr, b.f - b.vf * k, b.s - b.vs * k, b.u - b.vu * k);
      R.spark(P[0], P[1], P[2], 20 - i * 4, i ? 120 : 230, i ? 220 : 255, 255);
    }
  }
  for (const q of S.parts) {
    const P = Rail.toWorld(fr, q.f, q.s, q.u);
    const k = q.life / q.max;
    R.spark(P[0], P[1], P[2], q.size * (.4 + k), q.col[0], q.col[1], q.col[2]);
  }
}
