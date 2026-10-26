// Everything flat: the sky and sea behind the scene, and the HUD and map in
// front of it.
import { project, rayDir, toCam } from './render.mjs';
import { world, BIOMES, SEA_COLOR } from './world.mjs';
import * as Rail from './rail.mjs';
import { LIGHT } from './mesh.mjs';
import { quadrantOf } from './combat.mjs';
import { clamp, mix3 } from './util.mjs';
import { bigWidth, bigWrite } from './bigtext.mjs';

const ink = (api, c) => [c[0] | 0, c[1] | 0, c[2] | 0];

export function background(api, cam, sky) {
  const { w, h, cx, cy, f } = cam;
  api.wipe(...ink(api, sky));
  const horizon = cy - f * Math.tan(Math.min(cam.pitch, 1.55));
  const top = mix3(sky, [sky[0] * .7, sky[1] * .75, sky[2] * .9], .8);
  const bands = 10;
  if (horizon > 0) {
    const hy = Math.min(h, horizon);
    for (let i = 0; i < bands; i++) {
      const y0 = hy * i / bands, y1 = hy * (i + 1) / bands;
      api.box(0, y0, w, y1 - y0 + 1, ...ink(api, mix3(top, cam.fog, Math.pow((i + 1) / bands, 2.2))));
    }
    const sun = project(cam, cam.pos[0] + LIGHT[0] * 1e5, cam.pos[1] + LIGHT[1] * 1e5, cam.pos[2] + LIGHT[2] * 1e5);
    if (sun && sky[0] + sky[1] + sky[2] > 200 && sun.y < horizon) {
      const s = 46;
      api.triangle(sun.x, sun.y - s, sun.x + s, sun.y, sun.x - s, sun.y, 255, 246, 210);
      api.triangle(sun.x, sun.y + s, sun.x + s, sun.y, sun.x - s, sun.y, 255, 246, 210);
    }
  }
  if (horizon < h) {
    const y0 = Math.max(0, horizon);
    for (let i = 0; i < bands; i++) {
      const a = y0 + (h - y0) * i / bands, b = y0 + (h - y0) * (i + 1) / bands;
      const d = rayDir(cam, cx, (a + b) / 2);
      const dist = d[1] < -1e-4 ? cam.pos[1] / -d[1] : 1e9;
      let t = cam.fogStart < cam.far ? clamp((dist - cam.fogStart) / (cam.far - cam.fogStart), 0, 1) : 0;
      api.box(0, a, w, b - a + 1, ...ink(api, mix3(SEA_COLOR, cam.fog, t)));
    }
  }
}

function edgeArrow(api, cam, x, y, behind, col) {
  const { w, h, cx, cy } = cam;
  let dx = x - cx, dy = y - cy;
  if (behind) { dx = -dx; dy = -dy; }
  const l = Math.hypot(dx, dy) || 1;
  dx /= l; dy /= l;
  const k = Math.min((w / 2 - 50) / Math.abs(dx || 1e-6), (h / 2 - 50) / Math.abs(dy || 1e-6));
  const px = cx + dx * k, py = cy + dy * k, nx = -dy, ny = dx;
  api.triangle(px + dx * 30, py + dy * 30, px + nx * 20, py + ny * 20, px - nx * 20, py - ny * 20, ...col);
}

// A keycap: the key's letter in big block type on a raised cap.
function keycap(api, label, x, y, s, lit) {
  const px = s / 11, w = Math.max(s, bigWidth(label, px) + px * 5);
  api.box(x + px, y + px * 1.4, w, s, 10, 12, 26);
  api.box(x, y, w, s, ...(lit ? [255, 236, 120] : [240, 244, 255]));
  api.box(x, y + s - px * 1.6, w, px * 1.6, ...(lit ? [200, 160, 50] : [160, 170, 196]));
  bigWrite(api, label, x + (w - bigWidth(label, px)) / 2, y + px * 1.6, px, [20, 22, 36]);
  return w;
}

function chevrons(api, w, h, dir, t) {
  const n = 3, s = 46, gap = 52, phase = (t >> 3) % n;
  for (let i = 0; i < n; i++) {
    const col = i === phase ? [255, 236, 120] : [255, 255, 255];
    if (dir === 'right' || dir === 'back') {
      const x = w - 70 - (n - 1 - i) * gap;
      api.triangle(x - s * .5 + 5, h / 2 - s + 6, x + s * .6 + 5, h / 2 + 6, x - s * .5 + 5, h / 2 + s + 6, 10, 12, 26);
      api.triangle(x - s * .5, h / 2 - s, x + s * .6, h / 2, x - s * .5, h / 2 + s, ...col);
    }
    if (dir === 'left' || dir === 'back') {
      const x = 70 + (n - 1 - i) * gap;
      api.triangle(x + s * .5 + 5, h / 2 - s + 6, x - s * .6 + 5, h / 2 + 6, x + s * .5 + 5, h / 2 + s + 6, 10, 12, 26);
      api.triangle(x + s * .5, h / 2 - s, x - s * .6, h / 2, x + s * .5, h / 2 + s, ...col);
    }
  }
}

// The tutorial's voice: a line of block type, the keys to press as caps,
// and chevrons on the side of the screen to turn toward.
export function drawNudge(api, S) {
  const n = S.nudge;
  if (!n) return;
  const { w, h } = S.cam, t = S.t;
  const pad = S.padConnected;
  const keys = (n.keys || []).map(k => pad ? ({ e: 'r1', q: 'l1', m: 'view', u: 'o', space: 'l2', c: 'x' }[k] || k) : k);
  const px = Math.max(3, Math.min(4.5, w / 420)), cap = px * 15;
  const tw = bigWidth(n.text, px);
  const kw = keys.reduce((sum, k) => sum + Math.max(cap, bigWidth(k, cap / 11) + cap / 11 * 5) + 16, 0);
  const total = tw + (keys.length ? kw + 24 : 0);
  const x0 = w / 2 - total / 2, y0 = 150;
  api.box(x0 - 28, y0 - 22, total + 56, cap + 44, 12, 14, 28);
  const ink = n.urgent && (t >> 4) % 2 ? [255, 236, 120] : [240, 246, 255];
  bigWrite(api, n.text, x0, y0 + (cap - px * 7) / 2, px, ink);
  let x = x0 + tw + 24;
  keys.forEach((k, i) => { x += keycap(api, k, x, y0, cap, (t >> 4) % keys.length === i) + 16; });
  if (n.dir) chevrons(api, w, h, n.dir, t);
}

export function drawHud(api, S, fr) {
  const cam = S.cam, { w, h } = cam, p = S.player;
  const t = S.t;

  // Threats off screen, and bullets about to arrive from there.
  for (const e of S.enemies) {
    if (e.dying) continue;
    const P = Rail.toWorld(fr, e.f, e.s, e.u);
    const [X, Y, Z] = toCam(cam, ...P);
    const behind = Z < 10;
    const sx = cam.cx + cam.f * X / Math.max(Math.abs(Z), 1), sy = cam.cy - cam.f * Y / Math.max(Math.abs(Z), 1);
    if (!behind && sx > 0 && sx < w && sy > 0 && sy < h) continue;
    edgeArrow(api, cam, sx, sy, behind, e.type === 'gunship' ? [255, 80, 200] : [255, 70, 60]);
  }
  for (const b of S.ebullets) {
    const d = Math.hypot(b.f - p.f, b.s - p.s, b.u - p.u);
    if (d > 700) continue;
    const P = Rail.toWorld(fr, b.f, b.s, b.u), sp = project(cam, ...P);
    if (sp && sp.x > 0 && sp.x < w && sp.y > 0 && sp.y < h) continue;
    if ((t >> 2) % 2) edgeArrow(api, cam, sp ? sp.x : cam.cx, sp ? sp.y : cam.h, !sp, [255, 230, 60]);
  }

  // Health, score, where you are. (The reticle is the SVG cursor, overlay.mjs.)
  api.box(30, 28, 424, 34, 20, 22, 30);
  const hpc = p.hp > 50 ? [90, 230, 120] : p.hp > 25 ? [250, 200, 60] : [250, 70, 60];
  api.box(34, 32, 416 * p.hp / 100, 26, ...hpc);
  api.write('hp', 466, 28, 30, 240, 245, 255);
  bigWrite(api, String(S.score), 30, 76, 5, [255, 236, 140], [16, 18, 30]);
  const where = S.stage === 'island'
    ? (S.biome >= 0 ? BIOMES[S.biome].name + '   ' + S.visited.size + '/5 biomes' : '')
    : S.stage === 'hall' ? 'the hallway' : 'the hangar';
  api.write(where, 30, 122, 26, 220, 230, 245);

  // Compass: which way the camera faces, where the enemies are, and which
  // way a nudge wants you to turn.
  const ccx = w - 130, ccy = 120, counts = [0, 0, 0, 0];
  for (const e of S.enemies) if (!e.dying) counts[quadrantOf(e.f, e.s)]++;
  const spots = [[0, -1], [1, 0], [0, 1], [-1, 0]], names = ['front', 'right', 'back', 'left'];
  const want = S.nudge && S.nudge.dir ? (S.camDir + { right: 1, back: 2, left: 3 }[S.nudge.dir]) % 4 : -1;
  api.box(ccx - 20, ccy - 20, 40, 40, 30, 34, 46);
  for (let q = 0; q < 4; q++) {
    const x = ccx + spots[q][0] * 58, y = ccy + spots[q][1] * 58, on = q === S.camDir;
    const lit = q === want && (t >> 3) % 2;
    api.box(x - 27, y - 27, 54, 54, ...(on ? [255, 230, 120] : lit ? [140, 255, 170] : [44, 50, 66]));
    if (counts[q]) {
      const c = (t >> 3) % 2 || on ? [255, 70, 60] : [160, 40, 40];
      api.box(x - 13, y - 13, 26, 26, ...c);
    }
  }
  api.write(names[S.camDir], ccx - api.textWidth(names[S.camDir], 22) / 2, ccy + 94, 22, 255, 236, 160);
  api.write('q', ccx - 122, ccy - 14, 26, 200, 210, 230);
  api.write('e', ccx + 104, ccy - 14, 26, 200, 210, 230);

  const boss = S.enemies.find(e => e.type === 'gunship');
  if (boss) {
    api.box(w / 2 - 300, h - 70, 600, 22, 30, 20, 34);
    api.box(w / 2 - 296, h - 66, 592 * Math.max(0, boss.hp) / boss.max, 14, 236, 80, 170);
    api.write('gunship', w / 2 - api.textWidth('gunship', 24) / 2, h - 104, 24, 255, 160, 220);
  }

  if (S.toastT > 0) {
    const px = Math.max(3, Math.min(8, (w - 520) / (S.toast.length * 6)));
    bigWrite(api, S.toast, w / 2 - bigWidth(S.toast, px) / 2, S.nudge ? 300 : 190, px, [255, 250, 230], [16, 18, 30]);
  }
  if (S.stage === 'island' && S.route.length) {
    const msg = 'route: ' + S.routeLabel;
    api.write(msg, w / 2 - api.textWidth(msg, 26) / 2, h - 150, 26, 180, 255, 200);
  }
  drawNudge(api, S);
  const aim = S.autoAim ? (S.autoTarget ? 'auto lock' : 'auto: no target') : 'free aim';
  const movement = { ground: 'running', jump: 'jumping', hover: 'hovering', fall: 'landing' }[p.motion];
  const status = aim + ' / ' + movement;
  api.write(status, w - api.textWidth(status, 24) - 30, h - 34, 24, ...(S.autoAim ? [255, 80, 100] : [120, 240, 255]));
  if (S.stageT < 900 && S.stage === 'hall') {
    const lines = ['space / l2 / right click: boost   c / x: brake   u / circle: jump, hover, leap',
      'q e / shifts / l1 r1: turn   enter / click / r2: fire   ijkl: aim   f / r3: auto lock   esc: pause'];
    lines.forEach((l, i) => api.write(l, 30, h - 84 + i * 34, 26, 230, 236, 250));
  }

  if (S.hurtT > 0) {
    const c = [220, 30, 40], b = 22;
    api.box(0, 0, w, b, ...c); api.box(0, h - b, w, b, ...c);
    api.box(0, 0, b, h, ...c); api.box(w - b, 0, b, h, ...c);
  }
}

// ── The map ──────────────────────────────────────────────────────────────
export const ROUTE_COLORS = [[255, 214, 60], [80, 230, 255], [140, 255, 120], [255, 120, 220], [255, 150, 70]];

function polyline(api, cam, pts, width, col) {
  let prev = null;
  for (const q of pts) {
    const sp = project(cam, q[0], q[1] + 10, q[2]);
    if (prev && sp) api.line(prev.x, prev.y, sp.x, sp.y, width, ...col);
    prev = sp;
  }
}

export function drawMap(api, S, fr, e) {
  const cam = S.cam, map = S.map, t = S.t;
  if (e < .5) return;
  for (const edge of world.edges) {
    const pts = [];
    for (let i = 0; i < edge.xs.length; i += 10) pts.push([edge.xs[i], edge.ys[i], edge.zs[i]]);
    pts.push([edge.xs.at(-1), edge.ys.at(-1), edge.zs.at(-1)]);
    polyline(api, cam, pts, 5, [40, 40, 52]);
  }
  polyline(api, cam, map.ahead, 9, [255, 255, 255]);
  map.routes.forEach((r, i) => {
    const sel = i === map.sel, col = ROUTE_COLORS[i % ROUTE_COLORS.length];
    const pulse = sel ? 14 + 5 * Math.sin(t * .25) : 8;
    if (sel) polyline(api, cam, r.pts, pulse + 8, [255, 255, 255]);
    polyline(api, cam, r.pts, pulse, col);
    const end = r.pts.at(-1), sp = project(cam, end[0], end[1] + 10, end[2]);
    if (sp) {
      const label = (i + 1) + '  ' + r.label, s = sel ? 34 : 26;
      api.box(sp.x - 9, sp.y - 9, 18, 18, ...col);
      const tw = api.textWidth(label, s);
      api.box(sp.x + 14, sp.y - s / 2 - 6, tw + 16, s + 12, ...(sel ? [255, 255, 255] : [20, 22, 30]));
      api.write(label, sp.x + 22, sp.y - s / 2, s, ...(sel ? [20, 20, 30] : col));
    }
  });
  for (const n of world.nodes) {
    const sp = project(cam, n.x, n.y + 10, n.z);
    if (sp) api.box(sp.x - 6, sp.y - 6, 12, 12, 240, 240, 250);
  }
  for (const [name, x, z] of [['jungle', 2500, 0], ['desert', 0, 2500], ['urban', -2500, 0], ['cave', 0, -2500], ['mountain top', 0, 0]]) {
    const sp = project(cam, x, 300, z);
    if (sp) api.write(name, sp.x - api.textWidth(name, 30) / 2, sp.y - 64, 30, 255, 255, 255);
  }
  for (const en of S.enemies) {
    const sp = project(cam, ...Rail.toWorld(fr, en.f, en.s, en.u));
    if (sp) api.box(sp.x - 5, sp.y - 5, 10, 10, 255, 60, 60);
  }
  const me = project(cam, ...Rail.toWorld(fr, S.player.f, S.player.s, S.player.u));
  if (me) {
    const hd = project(cam, ...Rail.toWorld(fr, S.player.f + 260, S.player.s, S.player.u));
    const s = 16 + 4 * Math.sin(t * .3);
    if (hd) api.line(me.x, me.y, hd.x, hd.y, 6, 255, 80, 80);
    api.box(me.x - s, me.y - s, s * 2, s * 2, 255, 80, 80);
    api.box(me.x - s / 2, me.y - s / 2, s, s, 255, 255, 255);
  }
  const { w, h } = cam;
  api.box(0, 0, w, 96, 16, 18, 28);
  bigWrite(api, 'map: choose a path', 30, 26, 6, [255, 236, 140]);
  const hint = 'a d or click to pick   enter or click to go   m to close';
  api.write(hint, w - api.textWidth(hint, 26) - 30, 34, 26, 220, 230, 245);
}
