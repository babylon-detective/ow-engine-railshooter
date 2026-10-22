// Enemies, bullets and sparks. Everything that moves lives in the rail's local
// frame (f forward, s right, u up), so it keeps pace with the runner the way
// Panzer Dragoon's flyers do; turrets are fixed to the ground instead.
import { BIOMES, groundAt } from './world.mjs';
import * as Rail from './rail.mjs';
import * as M from './mesh.mjs';
import { project, rayDir } from './render.mjs';

// Per camera quadrant (0 ahead, 1 right, 2 behind, 3 left): the view direction
// and the screen-right direction, in (f, s).
export const QD = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const QR = [[0, 1], [-1, 0], [0, -1], [1, 0]];
const rnd = (a, b) => a + Math.random() * (b - a);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function quadrantOf(f, s) {
  return ((Math.round(Math.atan2(s, f) / (Math.PI / 2)) % 4) + 4) % 4;
}

const playerCore = S => [S.player.f, S.player.s, S.player.u + 80];

function pickQuadrant(S) {
  return Math.random() < .72 ? S.camDir : (S.camDir + 1 + Math.floor(Math.random() * 3)) % 4;
}

function hoverTarget(e, depth = rnd(850, 1450), lateral = rnd(-520, 520), up = rnd(90, 520)) {
  e.tf = QD[e.q][0] * depth + QR[e.q][0] * lateral;
  e.ts = QD[e.q][1] * depth + QR[e.q][1] * lateral;
  e.tu = up;
}

function spawnFlyer(S, type, q, lateral) {
  const depth = rnd(2100, 2700);
  const e = {
    type, q, hp: type === 'drone' ? 3 : 2, t: 0, flash: 0, phase: rnd(0, 6),
    f: QD[q][0] * depth + QR[q][0] * lateral, s: QD[q][1] * depth + QR[q][1] * lateral, u: rnd(200, 700),
    vf: 0, vs: 0, vu: 0, rad: type === 'drone' ? 75 : 65, score: type === 'drone' ? 100 : 150,
    fireT: rnd(70, 160), col: BIOMES[S.biome < 0 ? 0 : S.biome].enemy,
  };
  hoverTarget(e, undefined, lateral * .6);
  S.enemies.push(e);
}

function spawnWave(S, diff) {
  const q = pickQuadrant(S);
  const chargerBias = S.biome === 3 || S.biome === 2 ? .45 : .2;
  const n = 1 + Math.floor(Math.random() * (2 + diff * .6));
  const type = Math.random() < chargerBias ? 'charger' : 'drone';
  for (let i = 0; i < n && S.enemies.length < 16; i++) spawnFlyer(S, type, q, (i - (n - 1) / 2) * 260);
}

function spawnTurrets(S) {
  const len = Rail.edgeLen(S.edge);
  const ahead = S.s + rnd(1900, 2500);
  if (ahead > len - 50) return;
  const r = Rail.sample(S.edge, S.dir, ahead);
  const fr = Rail.frame(r.p, r.heading);
  const n = Math.random() < .4 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const side = (i === 0 ? 1 : -1) * (Math.random() < .5 ? 1 : -1);
    const w = Rail.toWorld(fr, rnd(-100, 100), side * rnd(240, 430), 0);
    w[1] = groundAt(w[0], w[2]);
    S.enemies.push({ type: 'turret', w, f: 0, s: 0, u: 0, hp: 4, t: 0, flash: 0, rad: 85, score: 120,
      fireT: rnd(40, 90), col: BIOMES[S.biome < 0 ? 0 : S.biome].enemy });
  }
}

function spawnGunship(S, api) {
  const e = { type: 'gunship', q: S.camDir, hp: 40, max: 40, t: 0, flash: 0, phase: 0,
    f: 0, s: 0, u: 900, rad: 190, score: 2000, fireT: 120, volley: 0, col: [220, 70, 160] };
  const p = [QD[e.q][0] * 3200, QD[e.q][1] * 3200];
  e.f = p[0]; e.s = p[1];
  hoverTarget(e, 1350, 0, 420);
  S.enemies.push(e);
  S.toast = 'warning: gunship'; S.toastT = 150;
  api.drum('gong', 1.2);
}

function fireAt(S, e, speed, spread = 0, lift = 0) {
  const P = playerCore(S);
  let df = P[0] - e.f, ds = P[1] - e.s, du = P[2] - e.u;
  const l = Math.hypot(df, ds, du) || 1;
  df /= l; ds /= l; du /= l;
  if (spread) {
    const c = Math.cos(spread), s = Math.sin(spread);
    [df, ds] = [df * c - ds * s, df * s + ds * c];
  }
  S.ebullets.push({ f: e.f, s: e.s, u: e.u, vf: df * speed, vs: ds * speed, vu: du * speed + lift, life: 420 });
}

function burst(S, f, s, u, n, size, palette, speed = 9) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), b = rnd(-1, 1), v = rnd(.3, 1) * speed, c = Math.sqrt(1 - b * b);
    const life = rnd(18, 40) | 0;
    S.parts.push({ f, s, u, vf: Math.cos(a) * c * v, vs: Math.sin(a) * c * v, vu: b * v + 2, life, max: life,
      size: size * rnd(.6, 1.3), col: palette[i % palette.length] });
  }
}
const FIRE = [[255, 236, 150], [255, 160, 50], [236, 70, 40], [120, 110, 110]];

function kill(S, e, api, pan) {
  e.hp = 0;
  S.score += e.score;
  S.kills++;
  const big = e.type === 'gunship';
  burst(S, e.f, e.s, e.u + (e.type === 'turret' ? 70 : 0), big ? 60 : 16, big ? 34 : 18, FIRE, big ? 18 : 9);
  api.drum(big ? 'gong' : 'snare', big ? 1.4 : .7, pan);
  if (big) {
    api.drum('kick', 1.5, pan);
    S.player.hp = Math.min(100, S.player.hp + 25);
    S.toast = 'gunship down  +25 hp'; S.toastT = 150;
  }
}

function hurt(S, dmg, api) {
  const p = S.player;
  if (p.inv > 0 || p.roll > 0 || S.mode !== 'play') return false;
  p.hp = Math.max(0, p.hp - dmg);
  p.inv = 70;
  S.shake = 16;
  S.hurtT = 14;
  api.drum('body-impact', 1.1);
  if (p.hp <= 0) {
    S.mode = 'over'; S.overT = 0;
    burst(S, p.f, p.s, p.u + 80, 40, 26, FIRE, 14);
    api.drum('gong', 1.5);
  }
  return true;
}

// What sits under the reticle: the nearest enemy, and how deep to aim.
export function updateLock(S, fr) {
  const cam = S.cam;
  S.lock = null;
  S.aimT = 2800;
  if (!cam) return;
  for (const e of S.enemies) {
    const w = Rail.toWorld(fr, e.f, e.s, e.u + (e.type === 'turret' ? 70 : 0));
    const sp = project(cam, ...w);
    if (!sp) continue;
    const reach = Math.max(70, cam.f * e.rad / sp.z * 1.4);
    if (Math.hypot(sp.x - S.reticle.x, sp.y - S.reticle.y) < reach) {
      const d = dist3(cam.pos, w);
      if (d < S.aimT) { S.aimT = d; S.lock = e; }
    }
  }
}

// The player's gun: shots leave the gun and converge where the reticle points,
// at the depth of whatever enemy sits under it.
export function fire(S, api, fr) {
  const cam = S.cam, p = S.player;
  if (!cam) return;
  const dir = rayDir(cam, S.reticle.x, S.reticle.y), T = S.aimT;
  const aim = Rail.toLocal(fr, cam.pos[0] + dir[0] * T, cam.pos[1] + dir[1] * T, cam.pos[2] + dir[2] * T);
  const th = S.camYaw, right = [-Math.sin(th), Math.cos(th)];
  const o = [p.f + right[0] * 26, p.s + right[1] * 26, p.u + 118];
  let vf = aim[0] - o[0], vs = aim[1] - o[1], vu = aim[2] - o[2];
  const l = Math.hypot(vf, vs, vu) || 1;
  S.shots.push({ f: o[0], s: o[1], u: o[2], vf: vf / l * 90, vs: vs / l * 90, vu: vu / l * 90, life: 42 });
  S.muzzle = 3;
  api.drum('hat', .22);
}

export function step(S, api, fr) {
  const diff = Math.min(5, S.t / 3000);
  const P = playerCore(S);
  const panOf = e => Math.max(-1, Math.min(1, (e.s * Math.cos(S.camYaw) - e.f * Math.sin(S.camYaw)) / 1200));

  if (--S.spawnT <= 0) {
    spawnWave(S, diff);
    S.spawnT = Math.max(70, 175 - diff * 20) + rnd(0, 80);
  }
  if (--S.turretT <= 0) {
    spawnTurrets(S);
    S.turretT = rnd(190, 340);
  }
  if (--S.bossT <= 0) {
    if (!S.enemies.some(e => e.type === 'gunship')) spawnGunship(S, api);
    S.bossT = 2700;
  }

  for (const e of S.enemies) {
    e.t++;
    if (e.flash > 0) e.flash--;
    if (e.type === 'turret') {
      [e.f, e.s, e.u] = Rail.toLocal(fr, ...e.w);
    } else if (e.type === 'charger' && e.t > 90) {
      if (e.t === 91) {
        const l = Math.hypot(P[0] - e.f, P[1] - e.s, P[2] - e.u) || 1, v = 21 + diff;
        e.vf = (P[0] - e.f) / l * v; e.vs = (P[1] - e.s) / l * v; e.vu = (P[2] - e.u) / l * v;
        api.drum('whoosh', .5, panOf(e));
      }
      e.f += e.vf; e.s += e.vs; e.u += e.vu;
    } else {
      if (e.type === 'drone' && e.t % 220 === 0) hoverTarget(e);
      const k = e.type === 'gunship' ? .012 : .03;
      e.f += (e.tf - e.f) * k; e.s += (e.ts - e.s) * k; e.u += (e.tu - e.u) * k;
      const w = Math.sin(e.t * (e.type === 'gunship' ? .02 : .05) + e.phase) * (e.type === 'gunship' ? 7 : 4);
      e.f += QR[e.q][0] * w; e.s += QR[e.q][1] * w;
    }

    const d = Math.hypot(P[0] - e.f, P[1] - e.s, P[2] - e.u);
    if (e.type === 'charger') {
      if (d < 95 && hurt(S, 16, api)) { e.hp = 0; burst(S, e.f, e.s, e.u, 14, 18, FIRE); }
    } else if (--e.fireT <= 0) {
      if (e.type === 'drone' && e.t > 60 && d < 3200) {
        fireAt(S, e, 10 + diff * 1.2);
        e.fireT = 150 - diff * 12 + rnd(0, 80);
      } else if (e.type === 'turret' && d > 250 && d < 2500) {
        const muzzle = { f: e.f, s: e.s, u: e.u + 80 };
        fireAt(S, muzzle, 11 + diff, 0, 1.2);
        e.fireT = 100 + rnd(0, 50);
      } else if (e.type === 'gunship' && e.t > 120) {
        e.volley++;
        const n = e.volley % 3 === 0 ? 9 : 5;
        for (let i = 0; i < n; i++) fireAt(S, e, 9 + diff, (i - (n - 1) / 2) * .11);
        api.drum('clap', .6, panOf(e));
        e.fireT = 95;
      } else e.fireT = 20;
    }
    const far = Math.hypot(e.f, e.s);
    if ((e.type === 'turret' && e.f < -600 && far > 2200) || far > 5200) e.hp = 0;
  }

  for (const b of S.shots) {
    const pf = b.f, ps = b.s, pu = b.u;
    b.f += b.vf; b.s += b.vs; b.u += b.vu;
    if (--b.life <= 0) continue;
    const hit = (cf, cs, cu, r) => {
      const sf = b.f - pf, ss = b.s - ps, su = b.u - pu;
      const t = Math.max(0, Math.min(1, ((cf - pf) * sf + (cs - ps) * ss + (cu - pu) * su) / (sf * sf + ss * ss + su * su || 1)));
      return Math.hypot(pf + sf * t - cf, ps + ss * t - cs, pu + su * t - cu) < r;
    };
    for (const e of S.enemies) {
      if (e.hp <= 0) continue;
      const cu = e.u + (e.type === 'turret' ? 70 : 0);
      if (!hit(e.f, e.s, cu, e.rad)) continue;
      b.life = 0;
      e.hp--;
      e.flash = 4;
      burst(S, b.f, b.s, b.u, 3, 10, [[255, 255, 220], [140, 230, 255]], 6);
      if (e.hp <= 0) kill(S, e, api, panOf(e)); else api.drum('block', .3, panOf(e));
      break;
    }
    if (b.life <= 0) continue;
    for (const eb of S.ebullets) {
      if (eb.life > 0 && hit(eb.f, eb.s, eb.u, 48)) {
        eb.life = 0; b.life = 0;
        S.score += 10;
        burst(S, eb.f, eb.s, eb.u, 5, 10, [[255, 200, 120], [255, 255, 255]], 5);
        api.drum('glass-shard', .25);
        break;
      }
    }
  }

  for (const b of S.ebullets) {
    b.f += b.vf; b.s += b.vs; b.u += b.vu;
    if (--b.life <= 0) continue;
    if (Math.hypot(P[0] - b.f, P[1] - b.s, P[2] - b.u) < 56 && hurt(S, 10, api)) b.life = 0;
  }

  for (const q of S.parts) {
    q.f += q.vf; q.s += q.vs; q.u += q.vu;
    q.vf *= .94; q.vs *= .94; q.vu = q.vu * .94 - .15;
    q.life--;
  }

  S.enemies = S.enemies.filter(e => e.hp > 0);
  S.shots = S.shots.filter(b => b.life > 0);
  S.ebullets = S.ebullets.filter(b => b.life > 0 && Math.hypot(b.f, b.s) < 6000);
  S.parts = S.parts.filter(q => q.life > 0);
}

export function stepParticlesOnly(S) {
  for (const q of S.parts) {
    q.f += q.vf; q.s += q.vs; q.u += q.vu;
    q.vf *= .94; q.vs *= .94; q.vu = q.vu * .94 - .15;
    q.life--;
  }
  S.parts = S.parts.filter(q => q.life > 0);
}

export function draw(R, S, fr) {
  const pw = Rail.toWorld(fr, S.player.f, S.player.s, S.player.u + 80);
  for (const e of S.enemies) {
    const P = Rail.toWorld(fr, e.f, e.s, e.u);
    if (e.type === 'turret') P[1] = e.w[1];
    const col = e.flash ? [255, 255, 255] : e.col;
    const dark = [col[0] * .35, col[1] * .35, col[2] * .35];
    const toP = [pw[0] - P[0], pw[1] - P[1], pw[2] - P[2]];
    const faces = [];
    if (e.type === 'drone') {
      const B = M.yawBasis(P, e.t * .08);
      M.octa(faces, B, 0, 0, 0, 64, 26, 64, col);
      M.pyramid(faces, B, 0, 16, 0, 26, 34, 4, dark);
      M.box(faces, B, 0, -6, 0, 92, 4, 10, dark);
      R.mesh(faces);
      R.spark(P[0], P[1] - 28, P[2], 13, 255, 255, 190, -30);
    } else if (e.type === 'charger') {
      const B = M.lookBasis(P, e.t > 90 ? [e.vf * fr.F[0] + e.vs * fr.S[0], e.vu, e.vf * fr.F[2] + e.vs * fr.S[2]] : toP);
      const hot = e.t > 70 && (e.t >> 2) % 2 ? [255, 240, 200] : col;
      M.octa(faces, B, 0, 0, 0, 30, 30, 92, hot);
      M.box(faces, B, 0, 0, -40, 70, 4, 22, dark);
      R.mesh(faces);
      if (e.t > 90) R.spark(...M.at(B, 0, 0, -110), 24, 255, 160, 60, 10);
    } else if (e.type === 'turret') {
      const B = M.yawBasis(P, 0);
      M.box(faces, B, 0, 30, 0, 52, 30, 52, [70, 70, 80], dark);
      M.box(faces, B, 0, 84, 0, 34, 24, 34, col);
      const head = M.at(B, 0, 84, 0);
      M.box(faces, M.lookBasis(head, [pw[0] - head[0], pw[1] - head[1], pw[2] - head[2]]), 0, 0, 56, 9, 9, 50, dark);
      R.mesh(faces);
    } else if (e.type === 'gunship') {
      const B = M.yawBasis(P, Math.atan2(toP[0], toP[2]));
      M.box(faces, B, 0, 0, 0, 120, 55, 230, col, dark);
      M.box(faces, B, 0, -10, -30, 360, 10, 90, dark);
      M.box(faces, B, 330, -40, -30, 30, 50, 70, [80, 80, 96]);
      M.box(faces, B, -330, -40, -30, 30, 50, 70, [80, 80, 96]);
      M.pyramid(faces, B, 0, 55, 40, 70, 60, 4, dark);
      const pulse = 150 + 100 * Math.abs(Math.sin(e.t * .1));
      M.octa(faces, B, 0, -60, 150, 50, 40, 50, [255, pulse, 120], false);
      R.mesh(faces);
      R.spark(...M.at(B, 330, -90, -30), 30, 255, 170, 80, 10);
      R.spark(...M.at(B, -330, -90, -30), 30, 255, 170, 80, 10);
    }
  }
  for (const b of S.ebullets) {
    const P = Rail.toWorld(fr, b.f, b.s, b.u);
    R.spark(P[0], P[1], P[2], 30, 255, 70, 90);
    R.spark(P[0], P[1], P[2], 15, 255, 236, 220, -2);
  }
  for (const b of S.shots) {
    const P = Rail.toWorld(fr, b.f, b.s, b.u);
    const Q = Rail.toWorld(fr, b.f - b.vf * .5, b.s - b.vs * .5, b.u - b.vu * .5);
    R.spark(P[0], P[1], P[2], 13, 160, 250, 255);
    R.spark(Q[0], Q[1], Q[2], 8, 90, 180, 255);
  }
  for (const q of S.parts) {
    const P = Rail.toWorld(fr, q.f, q.s, q.u);
    const k = q.life / q.max;
    R.spark(P[0], P[1], P[2], q.size * (.4 + k), q.col[0], q.col[1], q.col[2]);
  }
}
