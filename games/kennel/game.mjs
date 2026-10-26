// kennel — two hounds on a lawn. One roams a loop of waypoints, the other
// chases it; when they meet they stop nose to nose, tails going, then trade
// places. The dog is objects/hound.lisp, gait and all: the game only moves
// each dog's place and hands it distance, speed, whether it's excited, and
// where to look. See NOTES.md. World units are the engine's: y grows DOWN,
// the floor is at 1800.

const FLOOR = 1800, DT = 1 / 60;
const S = { t: 0, dogs: [], phase: "roam", timer: 0, roamer: 0, waypoint: 0, armed: true };
const WAYPOINTS = [[-420, -300], [380, -340], [460, 260], [-60, 420], [-480, 120]];
const PROPS = [["sapling", -620, -520, .3], ["sapling", 640, -600, 2.1], ["sapling", 700, 560, 1.2],
  ["sapling", -700, 520, 4], ["boulder", 540, -120, .7], ["boulder", -560, -80, 2.4], ["boulder", 120, 660, 1.5]];

const dog = (x, z, heading, name) => ({ x, z, heading, speed: 0, dist: 0, name, excited: 0, look: [0, 0, 0] });

export function boot(api) {
  S.dogs = [dog(-260, -120, .3, "hound"), dog(300, 220, Math.PI, "hound")];
  // The second dog in a grey coat: the same source with its inks swapped.
  fetch(api.asset("objects/hound.lisp")).then((r) => r.text()).then((source) => {
    api.defineObject("hound-grey", source.replace(/\(ink 196 150 96\)/g, "(ink 122 122 130)").replace(/\(ink 120 86 56\)/g, "(ink 64 62 70)"));
    S.dogs[1].name = "hound-grey";
  }).catch(() => {});
}

const wrap = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
function steer(d, tx, tz, cruise) {
  const want = Math.atan2(tz - d.z, tx - d.x);
  d.heading += Math.max(-2.6 * DT, Math.min(2.6 * DT, wrap(want - d.heading)));
  d.speed += (cruise - d.speed) * Math.min(1, 3 * DT);
}
function advance(d) {
  d.x += Math.cos(d.heading) * d.speed * DT;
  d.z += Math.sin(d.heading) * d.speed * DT;
  d.dist += d.speed * DT;
}
// A world point in a dog's own space: x forward, y up, z right.
function inDog(d, x, y, z) {
  const dx = x - d.x, dz = z - d.z, c = Math.cos(d.heading), s = Math.sin(d.heading);
  return [dx * c + dz * s, FLOOR - y, dx * s - dz * c];
}
const nose = (d) => [d.x + Math.cos(d.heading) * 64, FLOOR - 64, d.z + Math.sin(d.heading) * 64];

export function sim() {
  S.t++;
  const [a, b] = S.dogs, roamer = S.dogs[S.roamer], chaser = S.dogs[1 - S.roamer];
  const gap = Math.hypot(a.x - b.x, a.z - b.z);
  if (S.phase === "roam") {
    const [wx, wz] = WAYPOINTS[S.waypoint];
    if (Math.hypot(wx - roamer.x, wz - roamer.z) < 70) S.waypoint = (S.waypoint + 1) % WAYPOINTS.length;
    steer(roamer, wx, wz, 150);
    steer(chaser, roamer.x, roamer.z, 196);
    // A greeting is armed again only once they have run apart a way.
    if (gap > 280) S.armed = true;
    if (gap < 118 && S.armed) { S.phase = "greet"; S.timer = 150; S.armed = false; a.excited = b.excited = 1; }
  } else {
    // Nose to nose: slow to a stop and turn to face each other.
    for (const d of S.dogs) {
      const o = d === a ? b : a;
      d.heading += Math.max(-2 * DT, Math.min(2 * DT, wrap(Math.atan2(o.z - d.z, o.x - d.x) - d.heading)));
      d.speed *= .86;
    }
    if (--S.timer <= 0) {
      S.phase = "roam"; a.excited = b.excited = 0; S.roamer = 1 - S.roamer;
      // The new roamer heads for the waypoint farthest from here.
      let far = 0, best = -1;
      WAYPOINTS.forEach(([wx, wz], i) => { const dd = Math.hypot(wx - a.x, wz - a.z); if (dd > best) { best = dd; far = i; } });
      S.waypoint = far;
    }
  }
  for (const d of S.dogs) advance(d);
  // Each dog looks at the other's nose.
  a.look = inDog(a, ...nose(b)); b.look = inDog(b, ...nose(a));
}

export function paint(api) {
  api.wipe(214, 226, 236);
  const [a, b] = S.dogs, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
  const ang = S.t * .0045, dist = 640 + Math.hypot(a.x - b.x, a.z - b.z) * .35;
  api.camera({ position: [mx + Math.cos(ang) * dist, FLOOR - 230, mz + Math.sin(ang) * dist],
    target: [mx, FLOOR - 50, mz], fov: 58 });
  // The lawn: a checker of flat quads, lit by the engine's rule.
  const tile = 140, n = 7;
  for (let i = -n; i < n; i++) for (let j = -n; j < n; j++) {
    const x0 = i * tile, z0 = j * tile, x1 = x0 + tile, z1 = z0 + tile;
    const col = (i + j) & 1 ? [112, 160, 84] : [122, 170, 92];
    const k = api.shade(x0, FLOOR, z0, x1, FLOOR, z0, x1, FLOOR, z1);
    api.face(x0, FLOOR, z0, x1, FLOOR, z0, x1, FLOOR, z1, col[0] * k, col[1] * k, col[2] * k);
    api.face(x0, FLOOR, z0, x1, FLOOR, z1, x0, FLOOR, z1, col[0] * k, col[1] * k, col[2] * k);
  }
  for (const [name, x, z, heading] of PROPS) api.object(name, null, { x, y: FLOOR, z, heading });
  for (const d of S.dogs)
    api.object(d.name, { distance: d.dist, speed: d.speed, turbo: d.excited, owner: { look: d.look } },
      { x: d.x, y: FLOOR, z: d.z, heading: d.heading });
  api.write(S.phase === "greet" ? "hello" : S.roamer ? "grey roams, tan chases" : "tan roams, grey chases", 40, 36, 26, 40, 40, 48);
}
