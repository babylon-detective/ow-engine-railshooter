import { clamp } from './util.mjs';

export const GRAVITY = .65;
// BOOST: `time` ticks of untouchable burst, ready again after `cooldown`.
// Without a direction it surges the runner `surge` extra units a tick along
// the rail (time × surge ≈ 350 units per boost), which is what gets you
// through a door before it shuts.
export const BOOST = { time: 22, cooldown: 36, surge: 16 };
export const BRAKE_SCALE = .35;

export const motionState = () => ({
  f: 0, s: 0, u: 0, y: 0, groundY: 0, motion: 'ground',
  va: 0, vd: 0, vu: 0, dash: 0, dashCd: 0, surge: 0, braking: false,
});

// How far the rail carries the runner this tick.
export const railAdvance = (p, speed) =>
  speed * (p.braking ? BRAKE_SCALE : 1) + (p.surge > 0 ? BOOST.surge : 0);

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
  for (const key of ['dash', 'dashCd', 'surge']) if (p[key] > 0) p[key]--;
  if (input.jump) {
    if (p.motion === 'ground') {
      p.motion = 'jump'; p.vu = 15; event.jump = 'jump';
    } else if (p.motion === 'jump') {
      p.motion = 'hover'; p.vu = 7; event.jump = 'hover';
    } else if (p.motion === 'hover') {
      const big = input.boostHeld;
      p.motion = 'fall'; p.vu = big ? 19 : 13;
      p.va += dx * (big ? 34 : 18);
      p.vd += dy * (big ? 34 : 18);
      event.jump = 'leap';
      if (big) { p.dash = BOOST.time; p.dashCd = BOOST.cooldown; event.boost = 'plane'; }
    }
  }
  if (input.boost && p.dashCd === 0 && event.jump !== 'leap') {
    p.dash = BOOST.time; p.dashCd = BOOST.cooldown;
    if (moving) {
      // With a direction: a burst across the 2D plane.
      p.va += dx * 32;
      if (p.motion === 'hover') p.vu += dy * 26;
      else p.vd += dy * 32;
      event.boost = 'plane';
    } else {
      // Without one: forward in depth, and the rail surges ahead.
      p.surge = BOOST.time;
      p.vd += 26;
      event.boost = 'forward';
    }
  }
  // BRAKE: slow the rail and pull back towards the camera.
  if (input.brake && !p.braking) event.brake = true;
  p.braking = !!input.brake;
  if (p.braking) { p.vd -= 1.8; p.surge = 0; }
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
