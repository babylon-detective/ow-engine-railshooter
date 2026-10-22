// The title: the camera flies along the island's tracks on its own, taking a
// random branch at every junction, with the name in letters as tall as the
// screen allows and a two-item menu under it.
import { world, groundAt, exitsOf } from './world.mjs';
import * as Rail from './rail.mjs';
import { makeCamera } from './render.mjs';
import { bigWidth, bigWrite } from './bigtext.mjs';
import { angleLerp, clamp, lerp } from './util.mjs';

export function startFlight(seed = Math.random()) {
  const edge = Math.floor(seed * world.edges.length) % world.edges.length;
  const r = Rail.sample(edge, 1, 0);
  return { edge, dir: 1, s: 0, heading: r.heading, look: r.heading, t: 0, p: r.p };
}

export function stepFlight(F) {
  F.t++;
  F.s += 17;
  while (F.s >= Rail.edgeLen(F.edge)) {
    F.s -= Rail.edgeLen(F.edge);
    const node = Rail.endNode(F.edge, F.dir);
    const exits = exitsOf(node).filter(x => x.edge !== F.edge);
    const next = exits.length ? exits[Math.floor(Math.random() * exits.length)] : { edge: F.edge, dir: -F.dir };
    F.edge = next.edge;
    F.dir = next.dir;
  }
  const r = Rail.sample(F.edge, F.dir, F.s);
  F.p = r.p;
  F.heading = angleLerp(F.heading, r.heading, .05);
  F.look = angleLerp(F.look, F.heading + Math.sin(F.t * .0045) * .55, .03);
}

export function flightCamera(F, view, fog) {
  const ahead = Rail.sample(F.edge, F.dir, Math.min(Rail.edgeLen(F.edge), F.s + 500)).p;
  const lift = 330 + 170 * Math.sin(F.t * .0031);
  const target = [lerp(F.p[0], ahead[0], .6), lerp(F.p[1], ahead[1], .6) + lift * .45, lerp(F.p[2], ahead[2], .6)];
  let pitch = .2 + .06 * Math.sin(F.t * .0023);
  const dist = 1500;
  const D = [Math.sin(F.look), Math.cos(F.look)];
  const back = dist * Math.cos(pitch);
  const ground = Math.max(groundAt(target[0] - D[0] * back, target[2] - D[1] * back),
    groundAt(target[0] - D[0] * back * .5, target[2] - D[1] * back * .5)) + 220;
  const need = (ground - target[1]) / dist;
  if (need > Math.sin(pitch)) pitch = Math.asin(Math.min(.8, need));
  F.pitch = F.pitch == null ? pitch : lerp(F.pitch, pitch, pitch > F.pitch ? .2 : .04);
  return makeCamera(target, F.look, F.pitch, dist, view,
    { fov: .9, far: 7200, fogStart: 3400, fog });
}

// The wordmark and the menu share one layout, so the pointer hit-tests what
// is drawn.
export function layout(view, items, topAt = null) {
  const { width: w, height: h } = view;
  const px = Math.max(8, Math.min(w * .84 / 35, h * .245 / 7));
  const y1 = h * .07, y2 = y1 + px * 7 + px * 1.6;
  const mpx = Math.max(5, Math.min(px * .3, 12));
  const top = topAt ?? y2 + px * 7 + Math.max(36, px * 1.6);
  const rows = items.map((label, i) => {
    const tw = bigWidth(label, mpx);
    const bw = Math.max(tw, bigWidth('continue', mpx)) + mpx * 8, bh = mpx * 7 + mpx * 4;
    return { label, i, x: w / 2 - bw / 2, y: top + i * (bh + mpx * 2.4), w: bw, h: bh, tw, px: mpx };
  });
  return { px, y1, y2, rows };
}

export const rowAt = (L, x, y) => L.rows.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;

// Letters with a stepped, extruded shadow so they read as solid blocks.
function wordmark(api, text, cx, y, px, face, side) {
  const x = cx - bigWidth(text, px) / 2, depth = Math.max(2, Math.round(px / 7));
  for (let k = depth; k >= 1; k--) bigWrite(api, text, x + k * px * .18, y + k * px * .18, px, k === depth ? [10, 12, 26] : side);
  bigWrite(api, text, x, y, px, face);
}

export function drawMenu(api, L, sel, enabled, t, title = true) {
  const { width: w } = api.view();
  if (title) {
    wordmark(api, 'island', w / 2, L.y1, L.px, [255, 222, 70], [196, 84, 30]);
    wordmark(api, 'crisis', w / 2, L.y2, L.px, [255, 92, 64], [120, 20, 40]);
  }
  for (const r of L.rows) {
    const on = r.i === sel, ok = enabled[r.i];
    const bob = on ? Math.sin(t * .15) * r.px * .25 : 0;
    if (on) {
      api.box(r.x - r.px * .6, r.y - r.px * .6 + bob, r.w + r.px * 1.2, r.h + r.px * 1.2, 10, 12, 26);
      api.box(r.x, r.y + bob, r.w, r.h, ...(ok ? [255, 236, 120] : [120, 120, 130]));
    } else api.box(r.x + r.px * .5, r.y + r.px * .5, r.w, r.h, 10, 12, 26);
    if (!on) api.box(r.x, r.y, r.w, r.h, 24, 30, 52);
    const ink = on ? [20, 22, 36] : ok ? [240, 246, 255] : [96, 100, 120];
    bigWrite(api, r.label, r.x + (r.w - r.tw) / 2, r.y + r.px * 2 + bob, r.px, ink);
    if (on) {
      const ax = r.x - r.px * 4 - Math.abs(Math.sin(t * .15)) * r.px, ay = r.y + r.h / 2;
      api.triangle(ax, ay - r.px * 2, ax + r.px * 2.4, ay, ax, ay + r.px * 2, 255, 236, 120);
      const bx = r.x + r.w + r.px * 4 + Math.abs(Math.sin(t * .15)) * r.px;
      api.triangle(bx, ay - r.px * 2, bx - r.px * 2.4, ay, bx, ay + r.px * 2, 255, 236, 120);
    }
  }
}

export const clampSel = (sel, n) => clamp(sel, 0, n - 1);
