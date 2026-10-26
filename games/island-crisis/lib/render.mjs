// The engine draws the 3D: every triangle goes to api.face and every prop to
// api.object (objects/*.lisp), seen through api.camera. This module keeps
// the camera's math on our side too, for culling, fog, aim rays and the HUD.
//
// Our world is y-up (the terrain, the rails and the fight were built that
// way); the engine's is y-down. Every point crosses as (x, -y, z): x stays
// screen-right, y up becomes the engine's -y up, z stays forward, so the
// picture and the objects' "z to the right" agree on both sides.
import { clamp } from './util.mjs';

// Where the engine puts the lens's centre on the stage, measured each frame
// with api.project (it sits a little above the stage's middle).
const centre = { dx: 0, dy: 0 };

// target: the point looked at; yaw 0 looks along +z; pitch > 0 looks down.
// fov is vertical, in radians; the engine wants it across the stage.
export function makeCamera(target, yaw, pitch, dist, view, opts) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const fw = [sy * cp, -sp, cy * cp], right = [cy, 0, -sy], up = [sy * sp, cp, cy * sp];
  const pos = [target[0] - fw[0] * dist, target[1] - fw[1] * dist, target[2] - fw[2] * dist];
  const f = view.height / 2 / Math.tan(opts.fov / 2);
  return {
    pos, fw, right, up, yaw, pitch, f, target,
    hfov: 2 * Math.atan(Math.tan(opts.fov / 2) * view.width / view.height),
    cx: view.width / 2 + centre.dx, cy: view.height / 2 + centre.dy, w: view.width, h: view.height,
    near: 10, far: opts.far, fogStart: opts.fogStart, fog: opts.fog,
  };
}

export function toCam(cam, x, y, z) {
  const dx = x - cam.pos[0], dy = y - cam.pos[1], dz = z - cam.pos[2];
  return [
    dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2],
    dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2],
    dx * cam.fw[0] + dy * cam.fw[1] + dz * cam.fw[2],
  ];
}

// Where a world point lands on screen; null when it is behind the camera.
// The same projection api.camera is told to use (tests hold the two together).
export function project(cam, x, y, z) {
  const [X, Y, Z] = toCam(cam, x, y, z);
  if (Z < cam.near) return null;
  return { x: cam.cx + cam.f * X / Z, y: cam.cy - cam.f * Y / Z, z: Z };
}

// The world-space direction through a screen point.
export function rayDir(cam, sx, sy) {
  const a = (sx - cam.cx) / cam.f, b = (cam.cy - sy) / cam.f;
  const d = [0, 1, 2].map(i => cam.fw[i] + cam.right[i] * a + cam.up[i] * b);
  const l = Math.hypot(...d);
  return d.map(v => v / l);
}

export function cameraSpec(cam) {
  const t = [0, 1, 2].map(i => cam.pos[i] + cam.fw[i] * 100);
  return { position: [cam.pos[0], -cam.pos[1], cam.pos[2]], target: [t[0], -t[1], t[2]],
    fov: cam.hfov * 180 / Math.PI, roll: 0, perspective: 1 };
}

// A forward vector from a heading: 0 runs along +z, as the rails do.
export const along = heading => [Math.sin(heading), 0, Math.cos(heading)];

export const SCENERY = 1;
// Past the far plane too (the open sea runs on to the horizon, in fog).
export const HORIZON = 2;

export class Scene {
  constructor() { this.frame = new Float64Array(12); this.stats = { faces: 0, objects: 0 }; }

  // `focus` (the runner, or null) sets the scenery cutaway: terrain, walls
  // and props nearer the lens than the runner that rise into the line of
  // sight from the camera to it, and lie close to that line, are left out,
  // so nothing covers the runner. Ground below the line stays. Combat, the
  // runner, doors and switches never take the cut.
  begin(api, cam, focus = null) {
    this.api = api; this.cam = cam; this.cut = 0;
    this.stats.faces = this.stats.objects = 0;
    if (focus) {
      const [x, , z] = toCam(cam, ...focus);
      if (z > 200) { this.cut = z - 120; this.focus = { x, y: focus[1], z }; }
    }
    const spec = api.camera(cameraSpec(cam));
    // Measure the engine's centre so our projection (aim, HUD, culling)
    // lands where its faces do; this frame's camera is fixed up too.
    const t = api.project(spec.target.x, spec.target.y, spec.target.z);
    if (!t.behind && Number.isFinite(t.x) && Number.isFinite(t.y)) {
      centre.dx = t.x - cam.w / 2; centre.dy = t.y - cam.h / 2;
      cam.cx = t.x; cam.cy = t.y;
    }
  }

  // Does something at (x, top, z), `d` deep and `reach` wide, stand in the
  // line of sight to the runner? Only asked of things nearer than it.
  blocks(x, top, z, d, reach) {
    const f = this.focus, c = this.cam, k = Math.max(0, d) / f.z;
    const line = c.pos[1] + (f.y - c.pos[1]) * k;
    if (top + 30 < line) return false;
    const across = (x - c.pos[0]) * c.right[0] + (z - c.pos[2]) * c.right[2];
    return Math.abs(across - f.x * k) < 420 + reach;
  }

  depth(x, y, z) {
    const c = this.cam, p = c.pos, F = c.fw;
    return (x - p[0]) * F[0] + (y - p[1]) * F[1] + (z - p[2]) * F[2];
  }

  fog(d) {
    const c = this.cam;
    const t = c.fogStart < c.far ? clamp((d - c.fogStart) / (c.far - c.fogStart), 0, 1) : 0;
    return t * t * (3 - 2 * t);
  }

  // One world triangle, our coordinates, fogged by its middle's depth.
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b, flags = 0) {
    const c = this.cam;
    const za = this.depth(ax, ay, az), zb = this.depth(bx, by, bz), zc = this.depth(cx, cy, cz);
    if (za < c.near && zb < c.near && zc < c.near) return;
    if (!(flags & HORIZON) && za > c.far && zb > c.far && zc > c.far) return;
    const d = (za + zb + zc) / 3;
    if (flags & SCENERY && this.cut && d < this.cut && this.blocks((ax + bx + cx) / 3, Math.max(ay, by, cy), (az + bz + cz) / 3, d, 0)) return;
    this.stats.faces++;
    const t = this.fog(Math.max(d, 0)), fog = c.fog;
    this.api.face(ax, -ay, az, bx, -by, bz, cx, -cy, cz,
      r + (fog[0] - r) * t, g + (fog[1] - g) * t, b + (fog[2] - b) * t);
  }

  // A quad (a b c d in order). With a normal `n` it is one-sided: drawn only
  // from the side n points to, which is how a room's walls drop away when
  // the camera swings outside them.
  quad(a, b, c, d, col, n = null, flags = 0) {
    if (n) {
      const p = this.cam.pos;
      if ((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1] + (p[2] - a[2]) * n[2] <= 0) return;
    }
    this.tri(...a, ...b, ...c, col[0], col[1], col[2], flags);
    this.tri(...a, ...c, ...d, col[0], col[1], col[2], flags);
  }

  // A camera-facing diamond: bullets, sparks, flames.
  spark(x, y, z, size, r, g, b) {
    const c = this.cam, R = c.right, U = c.up;
    const d = this.depth(x, y, z);
    if (d < c.near * 3 || d > c.far) return;
    const t = [x + U[0] * size, y + U[1] * size, z + U[2] * size];
    const o = [x - U[0] * size, y - U[1] * size, z - U[2] * size];
    const rr = [x + R[0] * size, y + R[1] * size, z + R[2] * size];
    const l = [x - R[0] * size, y - R[1] * size, z - R[2] * size];
    this.tri(...t, ...rr, ...o, r, g, b);
    this.tri(...t, ...o, ...l, r, g, b);
  }

  // An object from objects/*.lisp at `at`, its x along `fwd` and y along
  // `up` (our coordinates), scaled by a number or [x, y, z]. `rad` is how
  // far it reaches, for culling; scenery takes the cutaway.
  object(name, inputs, at, fwd = [0, 0, 1], up = [0, 1, 0], scale = 1, rad = 200, flags = 0) {
    const c = this.cam, d = this.depth(...at);
    if (d < -rad || d - rad > c.far) return false;
    if (flags & SCENERY && this.cut && d < this.cut && this.blocks(at[0], at[1] + rad, at[2], d, rad * .5)) return false;
    this.stats.objects++;
    // Orthonormal: up made square to forward, right from the two.
    let fl = Math.hypot(...fwd) || 1;
    const F = [fwd[0] / fl, fwd[1] / fl, fwd[2] / fl];
    const k = up[0] * F[0] + up[1] * F[1] + up[2] * F[2];
    let U = [up[0] - F[0] * k, up[1] - F[1] * k, up[2] - F[2] * k];
    fl = Math.hypot(...U) || 1;
    U = [U[0] / fl, U[1] / fl, U[2] / fl];
    const [sx, sy, sz] = typeof scale === 'number' ? [scale, scale, scale] : scale;
    // Into the engine's space: y flips; object z is forward × up there.
    const fe = [F[0], -F[1], F[2]], ue = [U[0], -U[1], U[2]];
    const ze = [fe[1] * ue[2] - fe[2] * ue[1], fe[2] * ue[0] - fe[0] * ue[2], fe[0] * ue[1] - fe[1] * ue[0]];
    const m = this.frame;
    m[0] = at[0]; m[1] = -at[1]; m[2] = at[2];
    for (let i = 0; i < 3; i++) { m[3 + i] = fe[i] * sx; m[6 + i] = ue[i] * sy; m[9 + i] = ze[i] * sz; }
    this.api.object(name, inputs, m);
    return true;
  }
}
