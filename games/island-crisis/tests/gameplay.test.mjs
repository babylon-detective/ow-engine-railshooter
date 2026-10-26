import { motionState, stepMotion, railAdvance, BOOST, BRAKE_SCALE } from '../lib/motion.mjs';
import { candidates, chooseTarget, updateAutoAim } from '../lib/targeting.mjs';
import { makeCamera, Renderer } from '../lib/render.mjs';
import { canTarget, hitsHurdle, HURDLES } from '../lib/facility.mjs';
import { buildWorld, groundAt, world, HALF, CELL, V } from '../lib/world.mjs';
import { frame } from '../lib/rail.mjs';

let count = 0;
const check = (condition, message) => { if (!condition) throw new Error(message); count++; };
const close = (a, b) => Math.abs(a - b) < 1e-6;
const space = { yaw: 0, lateral: 400, ceiling: 440, originY: 0, floorAt: () => 0 };
const tick = (p, input = {}, room = space) => stepMotion(p, { x: 0, y: 0, ...input }, room);
let p = motionState();
for (let i = 0; i < 60; i++) tick(p, { x: 1, y: 1 });
check(p.y === 0 && p.motion === 'ground', 'Default movement stays grounded');
check(p.s > 0 && p.f > 0, 'Ground movement uses the horizontal plane');
p = motionState();
tick(p, { jump: true });
check(p.motion === 'jump' && p.y > 0, 'First jump leaves ground');
let peak = p.y;
for (let i = 0; i < 80; i++) { tick(p); peak = Math.max(peak, p.y); }
check(peak > 140 && peak < 200, 'Jump clears a 70-unit hurdle without flying indefinitely');
check(p.motion === 'ground' && p.y === 0 && p.vu === 0, 'Gravity lands first jump');
tick(p, { jump: true });
tick(p, { jump: true });
check(p.motion === 'hover', 'Second press enters hover');
for (let i = 0; i < 120; i++) tick(p);
const hoverY = p.y;
for (let i = 0; i < 120; i++) tick(p);
check(close(hoverY, p.y), 'Released controls maintain hover altitude');
tick(p, { y: 1 });
check(p.y > hoverY, 'Hover directional movement changes altitude');
const ordinary = { ...p }, boosted = { ...p };
tick(ordinary, { jump: true, x: -1 });
tick(boosted, { jump: true, x: -1, boostHeld: true });
check(ordinary.motion === 'fall' && ordinary.va < 0 && ordinary.vu > 0, 'Third press makes directional leap');
check(boosted.va < ordinary.va && boosted.vu > ordinary.vu && boosted.dash > 0, 'Held boost powers up the exit leap');
tick(boosted, { jump: true });
check(boosted.motion === 'fall', 'Cannot re-enter hover before landing after an exit leap');
for (let i = 0; i < 150; i++) tick(boosted);
check(boosted.motion === 'ground' && boosted.y === 0, 'Boosted exit eventually lands');
tick(boosted, { jump: true });
check(boosted.motion === 'jump', 'Landing resets the jump cycle');

// BOOST and BRAKE
p = motionState();
tick(p, { boost: true });
check(p.surge === BOOST.time && p.dash > 0 && p.vd > 0, 'Boost without direction surges forward in depth');
let travel = 0;
for (let i = 0; i < BOOST.time; i++) { travel += railAdvance(p, 3.4); tick(p); }
check(travel > 3.4 * BOOST.time + 300, 'Forward boost carries the runner ~350 extra rail units');
tick(p, { boost: true });
check(p.surge === 0, 'Boost respects its cooldown');
p = motionState();
tick(p, { boost: true, x: 1 });
check(p.surge === 0 && p.s > 20 && p.dash > 0, 'Boost with a direction bursts across the 2D plane');
p = { ...motionState(), motion: 'hover', y: 200 };
tick(p, { boost: true, y: 1 });
check(p.surge === 0 && p.vu > 20, 'Directional boost while hovering moves on the screen plane');
p = motionState();
const evt = tick(p, { brake: true });
check(evt.brake && p.braking && close(railAdvance(p, 3.4), 3.4 * BRAKE_SCALE), 'Brake slows the rail');
for (let i = 0; i < 40; i++) tick(p, { brake: true });
check(p.f === -240, 'Brake pulls the runner back toward the camera');
p.surge = 10; tick(p, { brake: true });
check(p.surge === 0, 'Brake cancels a boost surge');
tick(p);
check(!p.braking && railAdvance(p, 3.4) === 3.4, 'Releasing brake restores speed');
p = { ...motionState(), motion: 'hover', y: 435 };
for (let i = 0; i < 60; i++) tick(p, { y: 1 });
check(p.y === 440 && p.vu === 0, 'Hover respects ceiling');
p = motionState();
tick(p, {}, { ...space, originY: 250, floorAt: () => 300 });
check(p.y === 300 && p.u === 50, 'Ground contact follows actual world terrain, not rail origin');
tick(p, { jump: true }, { ...space, originY: 250, floorAt: () => 300 });
const worldHeight = p.y;
tick(p, {}, { ...space, originY: 270, floorAt: () => 300 });
check(close(p.y, worldHeight + 13.7) && close(p.u + 270, p.y), 'Rail rise does not lift airborne player');
check(hitsHurdle({ f: 0, s: 0, u: 69 }, HURDLES[0].z, HURDLES[0]), 'Grounded runner hits low hurdle');
check(!hitsHurdle({ f: 0, s: 0, u: 70 }, HURDLES[0].z, HURDLES[0]), 'Feet above hurdle clear it');

const cam = makeCamera([0, 180, 1000], 0, 0, 1000, { width: 1600, height: 900 },
  { fov: .62, far: 4500, fogStart: 3500, fog: [0, 0, 0] });
const enemy = (f, s, hp = 1) => ({ f, s, u: 180, hp, dying: 0, type: 'drone' });
const near = enemy(700, 0), left = enemy(1100, -240), right = enemy(950, 220), dead = enemy(300, 0, 0);
const S = { cam, player: { f: 0, s: 0, u: 0 }, enemies: [left, right, near, dead, enemy(-400, 0)],
  reticle: { x: 50, y: 50 }, autoTarget: null, aimFlick: false };
const fr = frame([0, 0, 0], 0);
let list = candidates(S, fr);
check(list.length === 3, 'Only living, on-screen enemies are lock candidates');
check(chooseTarget(list, null).enemy === near, 'Initial auto lock selects nearest enemy to player');
updateAutoAim(S, fr, 0, 0, true);
check(S.autoTarget === near && close(S.reticle.x, 800) && close(S.reticle.y, 450), 'Reticle snaps to exact enemy center');
updateAutoAim(S, fr, 1, 0);
check(S.autoTarget === right, 'Right stick flick selects enemy to the right');
for (let i = 0; i < 20; i++) updateAutoAim(S, fr, -1, 0);
check(S.autoTarget === right, 'Held stick does not repeatedly cycle');
updateAutoAim(S, fr, 0, 0);
updateAutoAim(S, fr, -1, 0);
check(S.autoTarget === near, 'Neutral rearms the next directional flick');
near.dying = 10;
updateAutoAim(S, fr, 0, 0);
check(S.autoTarget === right, 'Dead target is immediately replaced with nearest survivor');
S.enemies = [];
updateAutoAim(S, fr, 0, 0);
check(S.autoTarget === null, 'No enemies clears target safely');
const room = { stage: 'hall', z: 0, player: { f: 0 }, gates: [{ door: 500, open: 0 }] };
check(!canTarget(room, enemy(800, 0)), 'Cannot lock through a closed tutorial door');
room.gates[0].open = 1;
check(canTarget(room, enemy(800, 0)), 'Open door allows target');
S.enemies = [right]; S.level = { canTarget: () => false };
check(candidates(S, fr).length === 0, 'Gameplay occlusion is respected despite scenic cutaway');

const renderer = new Renderer();
const triangle = (z, scenery) => renderer.triC(-20, -20, z, 20, -20, z, 0, 20, z, 255, 0, 0, 0, scenery);
renderer.begin(cam, 200);
triangle(100, true);
check(renderer.n === 0, 'Foreground scenery is cut away');
triangle(100, false);
check(renderer.n === 1, 'Combat geometry is not cut away');
renderer.begin(cam, 200);
renderer.triC(-30, -30, 100, 30, -30, 300, 0, 30, 300, 255, 0, 0, 0, true);
check(renderer.n === 2, 'Scenery crossing cut plane is clipped, not discarded entirely');
check(renderer.pool.slice(0, renderer.n).every(t => [t.x1, t.y1, t.x2, t.y2, t.x3, t.y3].every(Number.isFinite)), 'Clipping produces finite coordinates');
renderer.begin(cam);
triangle(100, true);
check(renderer.n === 1, 'Map/title rendering preserves scenery');

buildWorld();
const i = 30, j = 27;
for (const [fx, fz] of [[.8, .2], [.2, .8], [.5, .5]]) {
  const h = (x, z) => Math.max(0, world.H[(j + z) * V + i + x]);
  const expected = fx >= fz ? h(0, 0) * (1 - fx) + h(1, 0) * (fx - fz) + h(1, 1) * fz
    : h(0, 0) * (1 - fz) + h(1, 1) * fx + h(0, 1) * (fz - fx);
  check(close(groundAt(-HALF + (i + fx) * CELL, -HALF + (j + fz) * CELL), expected), 'Terrain collision follows rendered triangle');
}
console.log(`Gameplay tests: ${count} assertions passed`);
