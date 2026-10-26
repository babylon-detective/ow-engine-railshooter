// The runner: the engine's own fighter (api.figure), posed here on sixteen
// joints from the run, jump, hover and aim, with objects/blaster.lisp in the
// right fist pointing where the reticle does. Joints are built in our y-up
// space and cross to the engine's as (x, -y, z), like everything else.
import * as Rail from './rail.mjs';
import { groundAt } from './world.mjs';
import { rayDir } from './render.mjs';
import { clamp } from './util.mjs';

// skin, hair, shirt, pants, skirt, shoe, accent, iris, lip, blush
const PALETTE = [[240, 198, 160], [40, 30, 30], [214, 52, 64], [40, 46, 76], [40, 46, 76],
  [34, 36, 48], [90, 240, 255], [60, 120, 200], [200, 90, 100], [240, 150, 150]];
const UP = [0, 1, 0];
const engine = p => [p[0], -p[1], p[2]];

export function drawRunner(api, scene, S, fr) {
  const p = S.player, cam = S.cam;
  const P = Rail.toWorld(fr, p.f, p.s, p.u);
  const ground = S.stage === 'island' ? groundAt(P[0], P[2]) : 0;

  // A shadow on the ground under the runner, smaller the higher it flies.
  if (ground < P[1] + 40) {
    const r = 46 * clamp(1 - (P[1] - ground) / 900, .35, 1), y = ground + 3;
    scene.tri(P[0] - r, y, P[2], P[0], y, P[2] + r, P[0] + r, y, P[2], 20, 24, 28);
    scene.tri(P[0] - r, y, P[2], P[0] + r, y, P[2], P[0], y, P[2] - r, 20, 24, 28);
  }
  if (p.inv > 0 && (S.t >> 2) % 2) return;

  // The body's frame: facing down the rail.
  const F = [Math.sin(S.heading), 0, Math.cos(S.heading)], Rt = [F[2], 0, -F[0]];
  const at = (x, y, z) => [P[0] + Rt[0] * x + F[0] * z, P[1] + y, P[2] + Rt[2] * x + F[2] * z];

  const air = clamp((p.y - p.groundY) / 60, 0, 1), hover = p.motion === 'hover';
  const run = S.t * .32, sw = Math.sin(run) * .75 * (1 - air);
  const lean = hover ? 0 : 10 * (1 - air);
  const bob = air ? 0 : Math.abs(Math.cos(run)) * 5;
  const j = {};
  j.pelvis = at(0, 100 + bob, 0);
  j.neck = at(0, 170 + bob, lean);
  j.head = at(0, 196 + bob, lean + 2);
  j.look = at(0, 196 + bob, lean + 24);
  for (const [side, x, swing] of [['l', -11, sw], ['r', 11, -sw]]) {
    // Legs: the thigh swings with the stride; the shin trails behind it.
    // Tucked in a jump, hanging loose in a hover.
    const thigh = hover ? -.15 : air ? .7 : swing;
    const shin = thigh - (hover ? .35 : air ? 1.5 : .45 + .55 * Math.max(0, -swing));
    j['hip-' + side] = at(x, 95 + bob, 0);
    const knee = [x, 95 + bob - 47 * Math.cos(thigh), 47 * Math.sin(thigh)];
    j['knee-' + side] = at(...knee);
    j['foot-' + side] = at(x, knee[1] - 48 * Math.cos(shin), knee[2] + 48 * Math.sin(shin));
  }
  j['shoulder-l'] = at(-20, 168 + bob, lean);
  j['shoulder-r'] = at(20, 168 + bob, lean);
  // The left arm swings against the right leg.
  const arm = hover ? .5 : -sw * .9;
  const elbowL = [-24, 168 + bob - 28 * Math.cos(arm), lean + 28 * Math.sin(arm)];
  j['elbow-l'] = at(...elbowL);
  j['hand-l'] = at(-24, elbowL[1] - 26 * Math.cos(arm + .7), elbowL[2] + 26 * Math.sin(arm + .7));

  // The gun arm reaches to where the reticle points, at the depth of what
  // it is over, the same point the shots fly to.
  const shoulder = j['shoulder-r'];
  const d = rayDir(cam, S.reticle.x, S.reticle.y), T = S.aimT;
  let aim = [0, 1, 2].map(k => cam.pos[k] + d[k] * T - shoulder[k]);
  const al = Math.hypot(...aim) || 1;
  aim = aim.map(v => v / al);
  j['hand-r'] = [0, 1, 2].map(k => shoulder[k] + aim[k] * 46);
  j['elbow-r'] = [0, 1, 2].map(k => shoulder[k] + aim[k] * 24 - UP[k] * 8);

  const joints = {};
  for (const k in j) joints[k] = engine(j[k]);
  api.figure(joints, { palette: PALETTE, hurt: p.inv > 0, blink: (S.t % 200) < 6 });
  scene.object('blaster', { turbo: S.muzzle > 0 ? 1 : 0 }, j['hand-r'], aim, UP, 1, 80);

  // Boost trail, hover jet and muzzle flash: sparks.
  if (p.dash > 0 && S.dashDir) {
    for (let i = 1; i <= 4; i++) {
      const k = i * 26 * p.dash / 12;
      const Q = Rail.toWorld(fr, p.f - S.dashDir[0] * k, p.s - S.dashDir[1] * k, p.u + 100 - S.dashDir[2] * k);
      scene.spark(Q[0], Q[1], Q[2], 34 - i * 6, 120, 230, 255);
    }
  }
  if (hover) {
    const jet = at(0, 78, -28);
    scene.spark(jet[0], jet[1], jet[2], 18 + Math.sin(S.t * .7) * 5, 90, 220, 255);
  }
  if (S.muzzle > 0) {
    const mz = [0, 1, 2].map(k => j['hand-r'][k] + aim[k] * 66);
    scene.spark(mz[0], mz[1], mz[2], 30 + S.muzzle * 12, 255, 255, 220);
  }
}
