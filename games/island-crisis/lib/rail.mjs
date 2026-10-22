// Running along the rail network: where the runner is, which way the rail
// faces, the local frame everything in a fight lives in, and the routes the
// map offers at the next junction.
import { world, edgePoint, exitsOf, nodeLabel } from './world.mjs';
import { wrapAngle } from './util.mjs';

export const endNode = (edge, dir) => dir > 0 ? world.edges[edge].b : world.edges[edge].a;
export const startNode = (edge, dir) => dir > 0 ? world.edges[edge].a : world.edges[edge].b;
export const edgeLen = edge => world.edges[edge].len;

// s runs from 0 at the leg's start to len at its end, whichever way it's run.
export function sample(edge, dir, s) {
  const e = world.edges[edge];
  const d = dir > 0 ? s : e.len - s;
  const p = edgePoint(e, d), a = edgePoint(e, d - 50), b = edgePoint(e, d + 50);
  return { p, heading: Math.atan2((b[0] - a[0]) * dir, (b[2] - a[2]) * dir) };
}

// The local frame: f forward along the rail, s to its right, u up.
export const frame = (O, heading) => ({
  O, F: [Math.sin(heading), 0, Math.cos(heading)], S: [Math.cos(heading), 0, -Math.sin(heading)],
});
export const toWorld = (fr, f, s, u) => [
  fr.O[0] + fr.F[0] * f + fr.S[0] * s, fr.O[1] + u, fr.O[2] + fr.F[2] * f + fr.S[2] * s,
];
export function toLocal(fr, x, y, z) {
  const dx = x - fr.O[0], dz = z - fr.O[2];
  return [dx * fr.F[0] + dz * fr.F[2], dx * fr.S[0] + dz * fr.S[2], y - fr.O[1]];
}

// The exit from `node` that turns least from `heading`.
export function straightest(node, fromEdge, heading) {
  const exits = exitsOf(node).filter(x => x.edge !== fromEdge);
  if (!exits.length) return { edge: fromEdge, dir: world.edges[fromEdge].a === node ? 1 : -1 };
  let best = exits[0], turn = Infinity;
  for (const x of exits) {
    const t = Math.abs(wrapAngle(sample(x.edge, x.dir, 60).heading - heading));
    if (t < turn) { turn = t; best = x; }
  }
  return best;
}

export function legPoints(leg, from = 0, to = edgeLen(leg.edge), step = 70) {
  const pts = [];
  for (let s = from; s < to; s += step) pts.push(sample(leg.edge, leg.dir, s).p);
  pts.push(sample(leg.edge, leg.dir, to).p);
  return pts;
}

// What the map offers: every way out of the next junction (two legs deep
// when the junction is only a bend), and turning back.
export function routesFrom(edge, dir, s) {
  const node = endNode(edge, dir);
  const exits = exitsOf(node).filter(x => x.edge !== edge);
  let routes, via = null;
  if (exits.length === 1) {
    via = exits[0];
    const next = endNode(via.edge, via.dir);
    const endHeading = sample(via.edge, via.dir, edgeLen(via.edge)).heading;
    const pick = straightest(next, via.edge, endHeading);
    routes = exitsOf(next).filter(x => x.edge !== via.edge)
      .map(x => ({ legs: [via, x], best: x.edge === pick.edge && x.dir === pick.dir }));
  } else {
    const pick = straightest(node, edge, sample(edge, dir, edgeLen(edge)).heading);
    routes = exits.map(x => ({ legs: [x], best: x.edge === pick.edge && x.dir === pick.dir }));
  }
  for (const r of routes) {
    const last = r.legs[r.legs.length - 1];
    r.end = endNode(last.edge, last.dir);
    r.label = nodeLabel(r.end);
    r.pts = legPoints(last);
  }
  const back = { edge, dir: -dir };
  routes.push({
    back: true, legs: [], end: startNode(edge, dir), label: 'back to ' + nodeLabel(startNode(edge, dir)),
    pts: legPoints(back, edgeLen(edge) - s, edgeLen(edge)),
  });
  return {
    routes,
    ahead: legPoints({ edge, dir }, s, edgeLen(edge)).concat(via ? legPoints(via) : []),
  };
}
