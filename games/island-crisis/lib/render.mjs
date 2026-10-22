// A small software 3D pipeline on top of api.triangle: camera, near-plane
// clipping, distance fog and a painter's sort (far faces first).
import { clamp } from './util.mjs';

// target: the point looked at; yaw 0 looks along +z; pitch > 0 looks down.
export function makeCamera(target, yaw, pitch, dist, view, opts) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const fw = [sy * cp, -sp, cy * cp], right = [cy, 0, -sy], up = [sy * sp, cp, cy * sp];
  const pos = [target[0] - fw[0] * dist, target[1] - fw[1] * dist, target[2] - fw[2] * dist];
  const f = view.height / 2 / Math.tan(opts.fov / 2);
  return {
    pos, fw, right, up, yaw, pitch, f, target,
    cx: view.width / 2, cy: view.height / 2, w: view.width, h: view.height,
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

export class Renderer {
  constructor() {
    this.pool = [];
    this.n = 0;
    this.cam = null;
    this.px = new Float64Array(8); this.py = new Float64Array(8); this.pz = new Float64Array(8);
    this.qx = new Float64Array(8); this.qy = new Float64Array(8); this.qz = new Float64Array(8);
  }

  begin(cam) { this.cam = cam; this.n = 0; }

  push(d, x1, y1, x2, y2, x3, y3, r, g, b) {
    const c = this.cam;
    if ((x1 < 0 && x2 < 0 && x3 < 0) || (x1 > c.w && x2 > c.w && x3 > c.w) ||
        (y1 < 0 && y2 < 0 && y3 < 0) || (y1 > c.h && y2 > c.h && y3 > c.h)) return;
    if (Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) < 3) return;
    let o = this.pool[this.n];
    if (!o) o = this.pool[this.n] = {};
    o.d = d; o.x1 = x1; o.y1 = y1; o.x2 = x2; o.y2 = y2; o.x3 = x3; o.y3 = y3;
    o.r = r; o.g = g; o.b = b;
    this.n++;
  }

  fogged(d, r, g, b, out) {
    const c = this.cam;
    let t = c.fogStart < c.far ? clamp((d - c.fogStart) / (c.far - c.fogStart), 0, 1) : 0;
    t = t * t * (3 - 2 * t);
    out[0] = r + (c.fog[0] - r) * t; out[1] = g + (c.fog[1] - g) * t; out[2] = b + (c.fog[2] - b) * t;
    return out;
  }

  // A triangle already in camera space.
  triC(X1, Y1, Z1, X2, Y2, Z2, X3, Y3, Z3, r, g, b, bias = 0) {
    const c = this.cam, near = c.near;
    if (Z1 < near && Z2 < near && Z3 < near) return;
    if (Z1 > c.far && Z2 > c.far && Z3 > c.far) return;
    const d = (Z1 + Z2 + Z3) / 3 + bias;
    const col = this.fogged(Math.max(d, 0), r, g, b, this.col || (this.col = [0, 0, 0]));
    const f = c.f, cx = c.cx, cy = c.cy;
    if (Z1 >= near && Z2 >= near && Z3 >= near) {
      this.push(d, cx + f * X1 / Z1, cy - f * Y1 / Z1, cx + f * X2 / Z2, cy - f * Y2 / Z2,
        cx + f * X3 / Z3, cy - f * Y3 / Z3, col[0], col[1], col[2]);
      return;
    }
    // Sutherland–Hodgman against the near plane.
    const px = this.px, py = this.py, pz = this.pz, qx = this.qx, qy = this.qy, qz = this.qz;
    px[0] = X1; py[0] = Y1; pz[0] = Z1; px[1] = X2; py[1] = Y2; pz[1] = Z2; px[2] = X3; py[2] = Y3; pz[2] = Z3;
    let m = 0;
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      const ain = pz[i] >= near, bin = pz[j] >= near;
      if (ain) { qx[m] = px[i]; qy[m] = py[i]; qz[m] = pz[i]; m++; }
      if (ain !== bin) {
        const t = (near - pz[i]) / (pz[j] - pz[i]);
        qx[m] = px[i] + (px[j] - px[i]) * t; qy[m] = py[i] + (py[j] - py[i]) * t; qz[m] = near; m++;
      }
    }
    for (let i = 1; i + 1 < m; i++)
      this.push(d, cx + f * qx[0] / qz[0], cy - f * qy[0] / qz[0],
        cx + f * qx[i] / qz[i], cy - f * qy[i] / qz[i],
        cx + f * qx[i + 1] / qz[i + 1], cy - f * qy[i + 1] / qz[i + 1], col[0], col[1], col[2]);
  }

  triW(ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b, bias = 0) {
    const { pos, right: R, up: U, fw: F } = this.cam;
    ax -= pos[0]; ay -= pos[1]; az -= pos[2];
    bx -= pos[0]; by -= pos[1]; bz -= pos[2];
    cx -= pos[0]; cy -= pos[1]; cz -= pos[2];
    this.triC(
      ax * R[0] + ay * R[1] + az * R[2], ax * U[0] + ay * U[1] + az * U[2], ax * F[0] + ay * F[1] + az * F[2],
      bx * R[0] + by * R[1] + bz * R[2], bx * U[0] + by * U[1] + bz * U[2], bx * F[0] + by * F[1] + bz * F[2],
      cx * R[0] + cy * R[1] + cz * R[2], cx * U[0] + cy * U[1] + cz * U[2], cx * F[0] + cy * F[1] + cz * F[2],
      r, g, b, bias);
  }

  // Faces from mesh.mjs, with back faces culled.
  mesh(faces, bias = 0) {
    const pos = this.cam.pos;
    for (const fc of faces) {
      const p = fc.p, n = fc.n;
      if ((pos[0] - p[0]) * n[0] + (pos[1] - p[1]) * n[1] + (pos[2] - p[2]) * n[2] <= 0) continue;
      this.triW(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], fc.c[0], fc.c[1], fc.c[2], bias);
    }
  }

  // A camera-facing diamond: bullets, sparks, flames.
  spark(x, y, z, size, r, g, b, bias = 0) {
    const c = this.cam;
    const [X, Y, Z] = toCam(c, x, y, z);
    if (Z < c.near * 3 || Z > c.far) return;
    const s = Math.max(1.5, c.f * size / Z), sx = c.cx + c.f * X / Z, sy = c.cy - c.f * Y / Z;
    const col = this.fogged(Z * .6, r, g, b, [0, 0, 0]);
    this.push(Z + bias, sx, sy - s, sx + s, sy, sx, sy + s, col[0], col[1], col[2]);
    this.push(Z + bias, sx, sy - s, sx, sy + s, sx - s, sy, col[0], col[1], col[2]);
  }

  flush(api) {
    const list = this.pool.slice(0, this.n);
    list.sort((a, b) => b.d - a.d);
    for (const o of list) api.triangle(o.x1, o.y1, o.x2, o.y2, o.x3, o.y3, o.r | 0, o.g | 0, o.b | 0);
    return list.length;
  }
}
