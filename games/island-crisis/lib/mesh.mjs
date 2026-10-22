// Low-poly mesh builders. A mesh is a list of faces { p: [9 coords], n: [3], c: [r,g,b] }
// in world space, colour already lit. Every builder orients its faces outward
// from the primitive's centre so the renderer can cull back faces.
export const LIGHT = (() => {
  const v = [-0.45, 0.8, -0.38], l = Math.hypot(...v);
  return v.map(x => x / l);
})();

export function shade(col, nx, ny, nz, ambient = .45) {
  const d = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
  const k = ambient + (1 - ambient) * d;
  return [col[0] * k, col[1] * k, col[2] * k];
}

export function face(out, pts, col, center, lit = true) {
  const [a, b, c] = pts;
  let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  let vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  let flip = false;
  if (center) {
    let mx = 0, my = 0, mz = 0;
    for (const p of pts) { mx += p[0]; my += p[1]; mz += p[2]; }
    mx /= pts.length; my /= pts.length; mz /= pts.length;
    if ((mx - center[0]) * nx + (my - center[1]) * ny + (mz - center[2]) * nz < 0) flip = true;
  }
  if (flip) { nx = -nx; ny = -ny; nz = -nz; }
  const color = lit ? shade(col, nx, ny, nz) : col;
  for (let i = 1; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    out.push({
      p: flip ? [a[0], a[1], a[2], q[0], q[1], q[2], p[0], p[1], p[2]]
        : [a[0], a[1], a[2], p[0], p[1], p[2], q[0], q[1], q[2]],
      n: [nx, ny, nz], c: color,
    });
  }
}

// A basis is an origin and three axes: X right, Y up, Z forward.
export const yawBasis = (o, yaw) => ({
  o, X: [Math.cos(yaw), 0, -Math.sin(yaw)], Y: [0, 1, 0], Z: [Math.sin(yaw), 0, Math.cos(yaw)],
});
export const at = (B, x, y, z) => [
  B.o[0] + B.X[0] * x + B.Y[0] * y + B.Z[0] * z,
  B.o[1] + B.X[1] * x + B.Y[1] * y + B.Z[1] * z,
  B.o[2] + B.X[2] * x + B.Y[2] * y + B.Z[2] * z,
];
// A child basis whose origin is a local point, turned about the parent's X axis.
export function pitchAround(B, x, y, z, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    o: at(B, x, y, z), X: B.X,
    Y: [B.Y[0] * c + B.Z[0] * s, B.Y[1] * c + B.Z[1] * s, B.Y[2] * c + B.Z[2] * s],
    Z: [B.Z[0] * c - B.Y[0] * s, B.Z[1] * c - B.Y[1] * s, B.Z[2] * c - B.Y[2] * s],
  };
}
// A basis at `o` whose Z axis points along `dir`.
export function lookBasis(o, dir) {
  const l = Math.hypot(...dir) || 1;
  const Z = dir.map(v => v / l);
  let X = [Z[2], 0, -Z[0]];
  const xl = Math.hypot(...X) || 1;
  X = X.map(v => v / xl);
  const Y = [Z[1] * X[2] - Z[2] * X[1], Z[2] * X[0] - Z[0] * X[2], Z[0] * X[1] - Z[1] * X[0]];
  return { o, X, Y, Z };
}

export function box(out, B, cx, cy, cz, hx, hy, hz, col, topCol = null, lit = true) {
  const p = (sx, sy, sz) => at(B, cx + sx * hx, cy + sy * hy, cz + sz * hz);
  const c = p(0, 0, 0);
  const v = [p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1), p(-1, 1, -1),
    p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)];
  face(out, [v[0], v[1], v[2], v[3]], col, c, lit);
  face(out, [v[5], v[4], v[7], v[6]], col, c, lit);
  face(out, [v[4], v[0], v[3], v[7]], col, c, lit);
  face(out, [v[1], v[5], v[6], v[2]], col, c, lit);
  face(out, [v[3], v[2], v[6], v[7]], topCol || col, c, lit);
  face(out, [v[4], v[5], v[1], v[0]], col, c, lit);
}

// A cone of `sides` faces; a negative height hangs it downward.
export function pyramid(out, B, cx, cy, cz, rad, h, sides, col, rot = 0, lit = true) {
  const apex = at(B, cx, cy + h, cz), c = at(B, cx, cy + h / 3, cz);
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + i / sides * Math.PI * 2;
    ring.push(at(B, cx + Math.cos(a) * rad, cy, cz + Math.sin(a) * rad));
  }
  for (let i = 0; i < sides; i++) face(out, [ring[i], ring[(i + 1) % sides], apex], col, c, lit);
  face(out, ring.slice().reverse(), col, c, lit);
}

export function octa(out, B, cx, cy, cz, rx, ry, rz, col, lit = true) {
  const c = at(B, cx, cy, cz);
  const px = at(B, cx + rx, cy, cz), nx = at(B, cx - rx, cy, cz);
  const py = at(B, cx, cy + ry, cz), ny = at(B, cx, cy - ry, cz);
  const pz = at(B, cx, cy, cz + rz), nz = at(B, cx, cy, cz - rz);
  for (const [a, b] of [[px, pz], [pz, nx], [nx, nz], [nz, px]]) {
    face(out, [a, b, py], col, c, lit);
    face(out, [a, b, ny], col, c, lit);
  }
}
