import * as Rail from './rail.mjs';
import { project } from './render.mjs';

export const targetPoint = (fr, e) => e.type === 'turret'
  ? [e.w[0], e.w[1] + 100, e.w[2]] : Rail.toWorld(fr, e.f, e.s, e.u);

export function candidates(S, fr) {
  if (!S.cam) return [];
  const P = Rail.toWorld(fr, S.player.f, S.player.s, S.player.u + 80);
  const found = [];
  for (const enemy of S.enemies) {
    if (enemy.hp <= 0 || enemy.dying || S.level?.canTarget && !S.level.canTarget(S, enemy)) continue;
    const point = targetPoint(fr, enemy), screen = project(S.cam, ...point);
    if (!screen || screen.z > S.cam.far || screen.x < 0 || screen.x > S.cam.w || screen.y < 0 || screen.y > S.cam.h) continue;
    const distance = Math.hypot(...point.map((v, i) => v - P[i]));
    if (distance < 3500) found.push({ enemy, point, screen, distance });
  }
  return found;
}

export function chooseTarget(list, current, direction = null) {
  const from = list.find(c => c.enemy === current);
  if (!from) return list.reduce((best, c) => !best || c.distance < best.distance ? c : best, null);
  if (!direction) return from;
  const length = Math.hypot(...direction);
  let best = null, score = Infinity;
  for (const c of list) {
    if (c === from) continue;
    const x = c.screen.x - from.screen.x, y = from.screen.y - c.screen.y;
    const distance = Math.hypot(x, y);
    if (distance < 1 || !length) continue;
    const alignment = (x * direction[0] + y * direction[1]) / (distance * length);
    if (alignment < .35) continue;
    const cost = distance / (alignment * alignment);
    if (cost < score) { score = cost; best = c; }
  }
  return best || from;
}

export function updateAutoAim(S, fr, x, y, toggled = false) {
  const magnitude = Math.hypot(x, y);
  if (toggled) S.aimFlick = magnitude > .55;
  if (magnitude < .25) S.aimFlick = false;
  const flick = magnitude > .55 && !S.aimFlick;
  if (flick) S.aimFlick = true;
  const target = chooseTarget(candidates(S, fr), S.autoTarget, flick ? [x, y] : null);
  S.autoTarget = target?.enemy || null;
  if (target) { S.reticle.x = target.screen.x; S.reticle.y = target.screen.y; }
}
