import { clamp } from './util.mjs';

export const GRAVITY = .65;
export const motionState = () => ({
  f: 0, s: 0, u: 0, y: 0, groundY: 0, motion: 'ground',
  va: 0, vd: 0, vu: 0, roll: 0, rollCd: 0, dash: 0, dashCd: 0,
});

// y is absolute world height; u is derived afterwards for rail-local combat.
// Moving the rail up a slope must not add height to an airborne jump.
export function stepMotion(p, input, space) {
  const { yaw, lateral, ceiling, originY, floorAt } = space;
  let { x, y } = input;
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  const moving = length > .2;
  const dx = moving ? x / Math.hypot(x, y) : 0;
  const dy = moving ? y / Math.hypot(x, y) : 1;
  const event = {};
  for (const key of ['dash', 'dashCd', 'roll', 'rollCd']) if (p[key] > 0) p[key]--;
  if (input.jump) {
    if (p.motion === 'ground') {
      p.motion = 'jump'; p.vu = 15; event.jump = 'jump';
    } else if (p.motion === 'jump') {
      p.motion = 'hover'; p.vu = 7; event.jump = 'hover';
    } else if (p.motion === 'hover') {
      p.motion = 'fall'; p.vu = input.boost ? 19 : 13;
      p.va += dx * (input.boost ? 34 : 18);
      p.vd += dy * (input.boost ? 34 : 18);
      event.jump = 'leap';
      if (input.boost) { p.dash = 12; p.dashCd = 22; event.dash = true; }
    }
  }
  if (input.dash && moving && p.dashCd === 0 && event.jump !== 'leap') {
    p.dash = 12; p.dashCd = 22;
    p.va += dx * 32;
    if (p.motion === 'hover') p.vu += dy * 26;
    else p.vd += dy * 32;
    event.dash = true;
  }
  if (input.roll && p.rollCd === 0) {
    p.roll = 24; p.rollCd = 50;
    p.va += (moving ? dx : 1) * 16;
    if (p.motion === 'hover') p.vu += (moving ? dy : 0) * 13;
    else p.vd += (moving ? dy : 0) * 16;
    event.roll = true;
  }
  p.va = (p.va + x * 1.5) * .86;
  p.vd = (p.vd + (p.motion === 'hover' ? 0 : y * 1.5)) * .86;
  const right = [-Math.sin(yaw), Math.cos(yaw)], look = [Math.cos(yaw), Math.sin(yaw)];
  const a = clamp(p.f * right[0] + p.s * right[1] + p.va, -lateral, lateral);
  const d = clamp(p.f * look[0] + p.s * look[1] + p.vd, -240, 240);
  if (Math.abs(a) === lateral) p.va = 0;
  if (Math.abs(d) === 240) p.vd = 0;
  p.f = right[0] * a + look[0] * d;
  p.s = right[1] * a + look[1] * d;
  p.groundY = floorAt(p.f, p.s);
  if (p.motion === 'ground') {
    p.y = p.groundY; p.vu = 0;
  } else {
    p.vu = p.motion === 'hover' ? (p.vu + y * 1.5) * .86 : p.vu - GRAVITY;
    p.y += p.vu;
    if (p.y > p.groundY + ceiling) {
      p.y = p.groundY + ceiling; p.vu = Math.min(0, p.vu);
    }
    if (p.y <= p.groundY) {
      p.y = p.groundY; p.vu = 0; p.motion = 'ground'; event.landed = true;
    }
  }
  p.u = p.y - originY;
  return event;
}
