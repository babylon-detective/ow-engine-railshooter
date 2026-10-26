// The island: a heightfield with five biomes around a central peak, a network
// of rails (the pathways the map lets you choose between) carved into it, and
// low-poly scenery for each biome.
import { clamp, lerp, smoothstep, mix3, fbm, rng, wrapAngle } from './util.mjs';
import { SCENERY } from './render.mjs';

// The sun, in our y-up space (towards it). boot() sets it from the engine's
// api.light() so the terrain is lit from where the engine lights objects.
export let LIGHT = (() => { const v = [-0.45, 0.8, -0.38], l = Math.hypot(...v); return v.map(x => x / l); })();
export function setLight(engineLight) {
  const v = [-engineLight.x, engineLight.y, -engineLight.z], l = Math.hypot(...v) || 1;
  if (v[1] > 0) LIGHT = v.map(x => x / l);
}
const shade = (col, nx, ny, nz, ambient) => {
  const k = ambient + (1 - ambient) * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
  return [col[0] * k, col[1] * k, col[2] * k];
};

export const SEA = 0, CELL = 160, N = 56, V = N + 1, HALF = N * CELL / 2;

export const BIOMES = [
  { name: 'jungle', ground: [58, 138, 60], ground2: [36, 104, 52], rock: [96, 110, 80], path: [150, 112, 70],
    sky: [120, 196, 210], fog: [150, 205, 190], enemy: [235, 96, 52] },
  { name: 'desert', ground: [230, 196, 122], ground2: [206, 160, 96], rock: [190, 118, 78], path: [246, 222, 170],
    sky: [120, 170, 235], fog: [246, 214, 168], enemy: [96, 80, 220] },
  { name: 'urban', ground: [116, 118, 128], ground2: [92, 96, 106], rock: [120, 120, 126], path: [52, 54, 62],
    sky: [214, 150, 140], fog: [196, 160, 168], enemy: [250, 204, 40] },
  { name: 'cave', ground: [74, 60, 70], ground2: [56, 44, 56], rock: [66, 54, 66], path: [110, 70, 120],
    sky: [20, 14, 28], fog: [26, 18, 34], enemy: [80, 236, 220] },
  { name: 'mountain top', ground: [238, 242, 250], ground2: [170, 176, 190], rock: [128, 128, 138], path: [200, 210, 232],
    sky: [130, 176, 248], fog: [196, 214, 244], enemy: [236, 60, 150] },
];
export const SEA_COLOR = [34, 104, 168];
const SECTOR = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export function biomeWeights(x, z) {
  const r = Math.hypot(x, z), th = Math.atan2(z, x);
  const m = 1 - smoothstep(850, 1350, r);
  const w = [0, 0, 0, 0, m];
  let sum = 0;
  for (let i = 0; i < 4; i++) { w[i] = Math.max(0, Math.cos(th - SECTOR[i])) ** 6; sum += w[i]; }
  for (let i = 0; i < 4; i++) w[i] = w[i] / sum * (1 - m);
  return w;
}

export function biomeAt(x, z) {
  const w = biomeWeights(x, z);
  let best = 0;
  for (let i = 1; i < 5; i++) if (w[i] > w[best]) best = i;
  return best;
}

// `rail` asks for the height a rail would ride at: the cave's rock walls left
// out, so the carving later cuts canyons through them.
export function baseHeight(x, z, rail = false) {
  const r = Math.hypot(x, z), w = biomeWeights(x, z);
  const n = fbm(x / 650, z / 650);
  const coast = 1 - smoothstep(2450, 3350, r + n * 260);
  const hJ = 150 + 210 * Math.abs(fbm(x / 420 + 3, z / 420 - 2));
  const hD = 110 + 70 * Math.sin(x * .0042 + z * .0013) * Math.cos(z * .0031 - x * .0008) + 30 * n;
  const hU = 120;
  const hC = rail ? 170 : 420 + 720 * Math.abs(fbm(x / 300 - 7, z / 300 + 4));
  const biomeH = w[0] * hJ + w[1] * hD + w[2] * hU + w[3] * hC + w[4] * 200;
  const mountain = 1850 * Math.exp(-((r / 1050) ** 2)) * (1 + .15 * n);
  return coast * (biomeH + mountain) + (1 - coast) * -280;
}

export const world = { nodes: [], edges: [], H: null, P: null, TC: null, objects: [], ready: false };

// ── Rails ────────────────────────────────────────────────────────────────
function makeEdge(id, ia, ib, wob) {
  const A = world.nodes[ia], B = world.nodes[ib];
  const STEPS = 320, xs = [], zs = [], raw = [];
  const da = wrapAngle(B.a - A.a);
  for (let s = 0; s <= STEPS; s++) {
    const t = s / STEPS;
    let r, a;
    if (B.kind === 'summit') { r = A.r * (1 - t); a = A.a + 1.2 * t; }
    else {
      a = A.a + da * t;
      r = lerp(A.r, B.r, t) + Math.sin(t * Math.PI) * wob;
      if (Math.abs(da) < 1e-6) a += Math.sin(t * Math.PI * 2) * .08;
    }
    xs.push(r * Math.cos(a)); zs.push(r * Math.sin(a));
    raw.push(Math.max(baseHeight(xs[s], zs[s], true), 34));
  }
  let ys = raw.slice();
  for (let pass = 0; pass < 5; pass++) {
    const next = ys.slice();
    for (let s = 0; s <= STEPS; s++) {
      let sum = 0, k = 0;
      for (let o = -12; o <= 12; o++) {
        const i = s + o;
        if (i >= 0 && i <= STEPS) { sum += ys[i]; k++; }
      }
      next[s] = sum / k;
    }
    ys = next;
  }
  const errA = A.y - ys[0], errB = B.y - ys[STEPS];
  for (let s = 0; s <= STEPS; s++) ys[s] = Math.max(34, ys[s] + lerp(errA, errB, s / STEPS));
  const ds = [0];
  for (let s = 1; s <= STEPS; s++) ds.push(ds[s - 1] + Math.hypot(xs[s] - xs[s - 1], ys[s] - ys[s - 1], zs[s] - zs[s - 1]));
  const mid = STEPS >> 1;
  return { id, a: ia, b: ib, xs, ys, zs, ds, len: ds[STEPS], biome: biomeAt(xs[mid], zs[mid]) };
}

function buildRails() {
  const nodes = world.nodes;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, r = k % 2 ? 2150 : 1700;
    nodes.push({ x: r * Math.cos(a), z: r * Math.sin(a), r, a, kind: k % 2 ? 'pass' : 'hub' });
  }
  nodes.push({ x: 0, z: 0, r: 0, a: 0, kind: 'summit' });
  for (const k of [0, 2, 4, 6]) {
    const a = k * Math.PI / 4, r = 2850;
    nodes.push({ x: r * Math.cos(a), z: r * Math.sin(a), r, a, kind: 'coast' });
  }
  for (const n of nodes) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      const a = i / 8 * Math.PI * 2, d = i ? 140 : 0;
      sum += baseHeight(n.x + Math.cos(a) * d, n.z + Math.sin(a) * d, true);
    }
    n.y = Math.max(34, sum / 9);
    n.biome = biomeAt(n.x, n.z);
  }
  const pairs = [];
  for (let k = 0; k < 8; k++) pairs.push([k, (k + 1) % 8]);
  pairs.push([0, 8], [2, 8], [4, 8], [6, 8]);
  pairs.push([0, 9], [2, 10], [4, 11], [6, 12]);
  pairs.push([9, 10], [10, 11], [11, 12], [12, 9]);
  const R = rng(7);
  world.edges = pairs.map(([a, b], id) => makeEdge(id, a, b, (R() - .5) * 520));
}

// A point on an edge, `d` units from its `a` end.
export function edgePoint(e, d) {
  d = clamp(d, 0, e.len);
  let lo = 0, hi = e.ds.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (e.ds[m] <= d) lo = m; else hi = m;
  }
  const t = (d - e.ds[lo]) / ((e.ds[hi] - e.ds[lo]) || 1);
  return [lerp(e.xs[lo], e.xs[hi], t), lerp(e.ys[lo], e.ys[hi], t), lerp(e.zs[lo], e.zs[hi], t)];
}

// Ways out of a node: { edge, dir } where dir 1 runs a→b and -1 runs b→a.
export function exitsOf(node) {
  const out = [];
  for (const e of world.edges) {
    if (e.a === node) out.push({ edge: e.id, dir: 1 });
    if (e.b === node) out.push({ edge: e.id, dir: -1 });
  }
  return out;
}

export function nodeLabel(i) {
  const n = world.nodes[i];
  if (n.kind === 'summit') return 'mountain top';
  const name = BIOMES[n.biome].name;
  return n.kind === 'coast' ? name + ' coast' : n.kind === 'pass' ? name + ' pass' : name;
}

// ── Terrain ──────────────────────────────────────────────────────────────
// Rail samples bucketed on a coarse grid, so "how far to the nearest rail"
// looks at a few buckets instead of every sample.
const BUCKET = 400, BN = Math.ceil(2 * HALF / BUCKET);
let buckets = null;
function nearestRail(x, z) {
  let best = 1e12, y = 0;
  const bi = Math.floor((x + HALF) / BUCKET), bj = Math.floor((z + HALF) / BUCKET);
  for (let j = bj - 2; j <= bj + 2; j++) for (let i = bi - 2; i <= bi + 2; i++) {
    if (i < 0 || j < 0 || i >= BN || j >= BN) continue;
    for (const [rx, ry, rz] of buckets[j * BN + i]) {
      const d = (rx - x) ** 2 + (rz - z) ** 2;
      if (d < best) { best = d; y = ry; }
    }
  }
  return [Math.min(Math.sqrt(best), 800), y];
}

export function groundAt(x, z) {
  const H = world.H;
  const gx = clamp((x + HALF) / CELL, 0, N - .001), gz = clamp((z + HALF) / CELL, 0, N - .001);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const h00 = Math.max(SEA, H[j * V + i]), h10 = Math.max(SEA, H[j * V + i + 1]);
  const h01 = Math.max(SEA, H[(j + 1) * V + i]), h11 = Math.max(SEA, H[(j + 1) * V + i + 1]);
  // Match the two rendered triangles, not a bilinear surface between them.
  return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz
    : h00 + (h11 - h01) * fx + (h01 - h00) * fz;
}

function terrainColor(x, z, h, ny, path, i, j) {
  if (h < SEA - 1) return mix3([70, 196, 204], [24, 78, 150], smoothstep(0, 220, -h));
  const w = biomeWeights(x, z);
  const v = fbm(x / 260, z / 260) * .5 + .5;
  let col = [0, 0, 0], rock = [0, 0, 0], pathCol = [0, 0, 0];
  for (let b = 0; b < 5; b++) {
    const g = mix3(BIOMES[b].ground, BIOMES[b].ground2, v);
    for (let k = 0; k < 3; k++) {
      col[k] += g[k] * w[b]; rock[k] += BIOMES[b].rock[k] * w[b]; pathCol[k] += BIOMES[b].path[k] * w[b];
    }
  }
  if (w[2] > .5 && (i + j) % 2) col = mix3(col, [104, 106, 118], .6);
  col = mix3(col, rock, smoothstep(.86, .6, ny));
  col = mix3(col, [240, 244, 252], smoothstep(1150, 1450, h) * smoothstep(.5, .7, ny));
  col = mix3(col, [232, 214, 156], (1 - smoothstep(24, 52, h)) * (1 - w[2]) * (1 - w[3]));
  return mix3(col, pathCol, path * .55);
}

function buildTerrain() {
  buckets = Array.from({ length: BN * BN }, () => []);
  for (const e of world.edges)
    for (let s = 0; s < e.xs.length; s += 3) {
      const i = clamp(Math.floor((e.xs[s] + HALF) / BUCKET), 0, BN - 1), j = clamp(Math.floor((e.zs[s] + HALF) / BUCKET), 0, BN - 1);
      buckets[j * BN + i].push([e.xs[s], e.ys[s], e.zs[s]]);
    }
  const H = world.H = new Float32Array(V * V), P = world.P = new Float32Array(V * V);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL;
    const b = baseHeight(x, z);
    const [d, ry] = nearestRail(x, z);
    H[j * V + i] = lerp(b, ry - 8, 1 - smoothstep(330, 760, d));
    P[j * V + i] = 1 - smoothstep(70, 170, d);
  }
  // Two lit colours per cell: (v00, v10, v11) and (v00, v11, v01).
  const TC = world.TC = new Float32Array(N * N * 6);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x0 = -HALF + i * CELL, z0 = -HALF + j * CELL;
    const h = (a, b) => H[(j + b) * V + i + a], r = (a, b) => Math.max(SEA, h(a, b));
    const tris = [[[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 1], [0, 1]]];
    tris.forEach((t, k) => {
      const p = t.map(([a, b]) => [x0 + a * CELL, r(a, b), z0 + b * CELL]);
      const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2];
      const vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const hTrue = Math.max(...t.map(([a, b]) => h(a, b)));
      const pathM = Math.max(...t.map(([a, b]) => P[(j + b) * V + i + a]));
      const cx = x0 + CELL * (t[0][0] + t[1][0] + t[2][0]) / 3, cz = z0 + CELL * (t[0][1] + t[1][1] + t[2][1]) / 3;
      const base = terrainColor(cx, cz, hTrue, ny, pathM, i, j);
      const lit = hTrue < SEA - 1 ? base : shade(base, nx, ny, nz, .5);
      TC.set(lit, (j * N + i) * 6 + k * 3);
    });
  }
}

// ── Scenery ──────────────────────────────────────────────────────────────
// Every prop is an object from objects/*.lisp, placed: { name, x, y, z,
// heading, scale, rad }. `rad` is how far it reaches, for culling.
function railDist(x, z) { return nearestRail(x, z)[0]; }

function place(name, x, y, z, heading, scale, rad, extra = {}) {
  world.objects.push({ name, x, y, z, heading, scale, rad, ...extra });
}

function buildScenery() {
  const R = rng(1234), rnd = (a, b) => a + R() * (b - a);
  const quota = [150, 110, 120, 80, 60];
  for (let tries = 0; tries < 9000 && quota.some(q => q > 0); tries++) {
    const x = rnd(-3300, 3300), z = rnd(-3300, 3300);
    const y = groundAt(x, z);
    if (y < 34) continue;
    const b = biomeAt(x, z);
    if (quota[b] <= 0) continue;
    const d = railDist(x, z), turn = rnd(0, Math.PI * 2);
    if (b === 0) {
      if (d < 300) continue;
      const k = rnd(.7, 1.35);
      if (R() < .35) place('palm', x, y - 4, z, turn, k, 200 * k);
      else place('jungle-tree', x, y - 4, z, turn, k, 260 * k);
    } else if (b === 1) {
      if (d < 300) continue;
      if (R() < .3) {
        const k = rnd(.6, 1.4);
        if (d < 300 + 160 * k) continue;
        place('mesa', x, y - 8, z, turn, k, 260 * k);
      } else if (R() < .6) {
        const k = rnd(.7, 1.3);
        place('cactus', x, y - 4, z, turn, k, 160 * k);
      } else {
        const k = rnd(.8, 2);
        place('rock', x, y - 6, z, turn, k, 50 * k);
      }
    } else if (b === 2) {
      const k = rnd(.45, 1.5) * (R() < .2 ? 1.4 : 1);
      if (d < 330 + 150 * k) continue;
      place('tower', x, y - 6, z, Math.round(rnd(0, 4)) * Math.PI / 2 + Math.atan2(z, x), k, 420 * k);
    } else if (b === 3) {
      if (d < 260) continue;
      const k = rnd(.45, 1.3);
      place('spire', x, y - 6, z, turn, k, 330 * k);
      if (R() < .4) place('crystal', x + 50 * k, y - 4, z, turn, rnd(.6, 1.2), 80);
    } else {
      if (d < 280) continue;
      if (y > 1200 || R() < .4) {
        const k = rnd(1, 2.6);
        place('snowrock', x, y - 6, z, turn, k, 50 * k);
      } else {
        const k = rnd(.6, 1.1);
        place('pine', x, y - 4, z, turn, k, 210 * k);
      }
    }
    quota[b]--;
  }
  // Rock arches over the cave canyons, hung with stalactites and crystals.
  for (const e of world.edges) {
    for (let d = 200; d < e.len - 200; d += 380) {
      const p = edgePoint(e, d), q = edgePoint(e, d + 20);
      if (biomeWeights(p[0], p[2])[3] < .55) continue;
      place('arch', p[0], p[1] - 10, p[2], Math.atan2(q[0] - p[0], q[2] - p[2]), 1, 900);
    }
  }
}

export function buildWorld() {
  if (world.ready) return world;
  buildRails();
  buildTerrain();
  buildScenery();
  world.ready = true;
  return world;
}

// ── Drawing ──────────────────────────────────────────────────────────────
// The terrain is world faces, two per cell, culled by the camera here and
// fogged by depth; the engine projects and sorts them.
export function drawTerrain(scene, cam, step = 1) {
  const H = world.H, TC = world.TC, far = cam.far;
  const [px, , pz] = cam.pos;
  const reach = far + CELL * 2;
  const i0 = Math.max(0, Math.floor((px - reach + HALF) / CELL / step) * step);
  const i1 = Math.min(N - 1, Math.ceil((px + reach + HALF) / CELL));
  const j0 = Math.max(0, Math.floor((pz - reach + HALF) / CELL / step) * step);
  const j1 = Math.min(N - 1, Math.ceil((pz + reach + HALF) / CELL));
  const kx = cam.cx / cam.f, span = CELL * step, R = cam.right, P = cam.pos;
  const h = k => Math.max(SEA, H[k]);
  for (let j = j0; j <= j1; j += step) for (let i = i0; i <= i1; i += step) {
    const i2 = Math.min(i + step, N), j2 = Math.min(j + step, N);
    const mx = -HALF + (i + i2) / 2 * CELL, mz = -HALF + (j + j2) / 2 * CELL, my = h(j * V + i);
    const z = scene.depth(mx, my, mz);
    if (z < -span * 2 || z > far + span) continue;
    const x = (mx - P[0]) * R[0] + (my - P[1]) * R[1] + (mz - P[2]) * R[2];
    if (Math.abs(x) > Math.max(0, z) * kx + span * 2 + 900) continue;
    const x0 = -HALF + i * CELL, x1 = -HALF + i2 * CELL, z0 = -HALF + j * CELL, z1 = -HALF + j2 * CELL;
    const a = h(j * V + i), b = h(j * V + i2), d = h(j2 * V + i2), e = h(j2 * V + i);
    const t = (j * N + i) * 6;
    scene.tri(x0, a, z0, x1, b, z0, x1, d, z1, TC[t], TC[t + 1], TC[t + 2], SCENERY);
    scene.tri(x0, a, z0, x1, d, z1, x0, e, z1, TC[t + 3], TC[t + 4], TC[t + 5], SCENERY);
  }
}

// Props are the costly part of a frame (each is a few dozen lit faces), so a
// frame draws at most `budget` of them, the nearest; and none past most
// of the fog, since an object can't fade.
export const PROP_BUDGET = 140;
const near = [];
export function drawScenery(scene, cam, budget = PROP_BUDGET) {
  const kx = cam.cx / cam.f, reach = cam.fogStart + (cam.far - cam.fogStart) * .6;
  const R = cam.right, P = cam.pos;
  near.length = 0;
  for (const o of world.objects) {
    const z = scene.depth(o.x, o.y, o.z);
    if (z < -o.rad || z - o.rad > reach) continue;
    const x = (o.x - P[0]) * R[0] + (o.y - P[1]) * R[1] + (o.z - P[2]) * R[2];
    if (Math.abs(x) > Math.max(0, z) * kx + o.rad * 1.5) continue;
    o.depth = z;
    near.push(o);
  }
  if (near.length > budget) near.sort((a, b) => a.depth - b.depth).length = budget;
  for (const o of near) {
    const fwd = [Math.sin(o.heading), 0, Math.cos(o.heading)];
    scene.object(o.name, null, [o.x, o.y, o.z], fwd, [0, 1, 0], o.scale, o.rad, SCENERY);
  }
}
