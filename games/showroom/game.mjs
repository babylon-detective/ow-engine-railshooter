// showroom — one hallway at a time, drawn in the engine's own 3D. See
// NOTES.md and GAME-SPEC.md ("The world", "Objects", "Figures"). The
// game's own object, objects/crate.lisp, stays in the folder as the copyable
// example; the halls themselves are kept clear.
//
// The loop: you glide toward a closed door. A big switch panel sits on the
// right wall. Turn (one direction), shoot it once, the door opens and the
// next hall begins. Reach the door closed and you die; the run restarts
// at once. World units are the engine's: y grows DOWN, the floor is at
// 1800 and up is -y. Halls run along +z.

const FLOOR = 1800, HALF = 300, HEIGHT = 500, HALL = 2200;
const EYE = FLOOR - 170, PACE = 2.2, TURN = .96;   // the turn: a look down the right wall, not a full quarter
const S = { t: 0, s: 0, turned: false, yaw: 0, flash: 0, red: 0, cool: 0, halls: [], run: 0, best: 0, dead: 0,
  prev: new Set(), pointerWas: false, keyWas: false, reticle: { x: 0, y: 0 }, shots: 0 };

// A hall: from z0 to z0 + HALL, its door at the far end, one switch panel
// on the right wall partway along. The first switch sits early, so the
// first hall teaches the turn before the door arrives.
function hall(index, z0) {
  const z = z0 + HALL * (index === 0 ? .42 : .55 + ((index * 7) % 3) * .08);
  return { index, z0, z1: z0 + HALL, open: 0, sw: { z, y: FLOOR - 250, w: 340, h: 340, hit: 0, down: false } };
}

function restart(api) {
  S.halls = [hall(0, 0), hall(1, HALL)];
  Object.assign(S, { s: 0, turned: false, yaw: 0, run: 0, dead: 0, shots: 0 });
  S.reticle = { x: api.view().width / 2, y: api.view().height / 2 };
}

export function boot(api) { api.cursor("none"); restart(api); }

const pressNow = (down, name) => down.has(name) && !S.prev.has(name);

export function sim(api) {
  S.t++;
  const pad = api.pad(0), down = new Set(pad.down), keys = new Set(api.keys());
  const pointer = api.pointer(), view = api.view();
  if (pointer.active) { S.reticle.x = pointer.x; S.reticle.y = pointer.y; }
  if (Math.hypot(pad.rightX, pad.rightY) > .15) {
    S.reticle.x = Math.max(0, Math.min(view.width, S.reticle.x + pad.rightX * 22));
    S.reticle.y = Math.max(0, Math.min(view.height, S.reticle.y - pad.rightY * 22));
  }
  // One direction: a press turns to look down the right wall, where the
  // switch is; the next turns back. From the front the switch is a sliver.
  const turnKey = keys.has("KeyE") || keys.has("KeyQ");
  if ((turnKey && !S.keyWas) || pressNow(down, "RightTrigger") || pressNow(down, "LeftTrigger") ||
      pressNow(down, "RightShoulder") || pressNow(down, "LeftShoulder")) { S.turned = !S.turned; api.drum("whoosh", .5, .5); }
  S.keyWas = turnKey;
  S.yaw += ((S.turned ? TURN : 0) - S.yaw) * .18;
  // One shot a press, with a short cool-down so one tap is one shot.
  if (S.cool > 0) S.cool--;
  const shootKey = keys.has("Space") || keys.has("KeyJ") || keys.has("KeyK");
  const shot = (pointer.down && !S.pointerWas) || pressNow(down, "X") || pressNow(down, "A") || (shootKey && !S.shootWas);
  S.pointerWas = pointer.down; S.shootWas = shootKey;
  if (S.dead) {
    if (S.t - S.dead > 50) restart(api);
  } else {
    if (shot && S.cool <= 0) { S.cool = 10; fire(api); }
    S.s += PACE;
    const h = current();
    if (h.open) h.open = Math.min(1, h.open + .04);
    // Through an open door: the hall behind is done, a new one is laid ahead.
    if (S.s > h.z1 + 60 && h.open) { S.halls.shift(); const last = S.halls[S.halls.length - 1]; S.halls.push(hall(last.index + 1, last.z1)); S.run++; S.best = Math.max(S.best, S.run); api.drum("bell", .8, 0); }
    else if (S.s >= h.z1 - 40 && !h.open) { S.dead = S.t; S.red = 30; api.drum("body-impact", 1.8, 0); api.drum("gong", 1, 0); }
  }
  if (S.flash > 0) S.flash--;
  if (S.red > 0) S.red--;
  for (const h of S.halls) if (h.sw.hit > 0) h.sw.hit--;
  S.prev = down;
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
  api.camera({ position: [0, EYE, S.s], target: [fx * 100, EYE, S.s + fz * 100], fov: 96 });   // fov is across the stage
}

const current = () => S.halls[0];

// The switch's four corners on the right wall.
function corners(sw) {
  const hw = sw.w / 2, hh = sw.h / 2, x = HALF - 2;
  return [[x, sw.y - hh, sw.z - hw], [x, sw.y - hh, sw.z + hw], [x, sw.y + hh, sw.z + hw], [x, sw.y + hh, sw.z - hw]];
}

// Aim by the picture: the reticle inside the switch's projected quad is a
// hit. The engine projects; the game tests 2D.
function fire(api) {
  S.shots++; S.flash = 5;
  api.drum("kick", 1.6, 0); api.drum("clap", 1.2, 0);
  const { x, y } = S.reticle, h = current(), sw = h.sw;
  if (sw.down || h.open) { api.tone(220, .08); return; }
  const pts = corners(sw).map(([px, py, pz]) => api.project(px, py, pz));
  if (pts.some((q) => q.behind)) { api.tone(220, .08); return; }
  let inside = true, sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4];
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (!sign) sign = Math.sign(cross); else if (Math.sign(cross) && Math.sign(cross) !== sign) { inside = false; break; }
  }
  if (!inside) { api.tone(220, .08); return; }
  sw.down = true; sw.hit = 14; h.open = .01;
  S.turned = false;   // BAM — and the lens snaps back to the door
  api.drum("glass-shard", 1.4, .4); api.drum("gong", .6, 0);
}

// One lit face: the engine's own flat rule applied to a colour.
function lit(api, a, b, c, col) {
  const k = api.shade(...a, ...b, ...c);
  api.face(...a, ...b, ...c, col[0] * k, col[1] * k, col[2] * k);
}
function quad(api, a, b, c, d, col) { lit(api, a, b, c, col); lit(api, a, c, d, col); }

function drawHall(api, h) {
  const tint = h.index % 2 ? 1 : .9;
  const floor = [168, 150, 136].map((v) => v * tint), wall = [196, 176, 160].map((v) => v * tint), ceiling = [120, 110, 104];
  const z0 = Math.max(h.z0, S.s - 400), z1 = h.z1;
  for (let z = z0; z < z1; z += 340) {
    const za = z, zb = Math.min(z1, z + 340), stripe = (((z - h.z0) / 340) | 0) % 2 ? 1 : .93;
    quad(api, [-HALF, FLOOR, za], [HALF, FLOOR, za], [HALF, FLOOR, zb], [-HALF, FLOOR, zb], floor.map((v) => v * stripe));
    quad(api, [-HALF, FLOOR - HEIGHT, zb], [HALF, FLOOR - HEIGHT, zb], [HALF, FLOOR - HEIGHT, za], [-HALF, FLOOR - HEIGHT, za], ceiling);
    quad(api, [-HALF, FLOOR, zb], [-HALF, FLOOR - HEIGHT, zb], [-HALF, FLOOR - HEIGHT, za], [-HALF, FLOOR, za], wall);
  }
  // The right wall is cut around the switch: a world face carries one
  // depth, so a panel laid over a wall would fight it. Nothing overlaps.
  const sw = h.sw, hw = sw.w / 2, hh = sw.h / 2;
  const rightWall = (za, zb, ya, yb) => { if (zb > za && yb > ya) quad(api, [HALF, yb, za], [HALF, ya, za], [HALF, ya, zb], [HALF, yb, zb], wall); };
  for (let z = z0; z < z1; z += 340) {
    const za = z, zb = Math.min(z1, z + 340);
    rightWall(za, Math.min(zb, sw.z - hw), FLOOR - HEIGHT, FLOOR);
    rightWall(Math.max(za, sw.z + hw), zb, FLOOR - HEIGHT, FLOOR);
    const ma = Math.max(za, sw.z - hw), mb = Math.min(zb, sw.z + hw);
    rightWall(ma, mb, FLOOR - HEIGHT, sw.y - hh);
    rightWall(ma, mb, sw.y + hh, FLOOR);
  }
  // The door: a dark slab that lifts into the ceiling once the switch is hit.
  const lift = h.open * HEIGHT, door = h.open ? [70, 120, 80] : [60, 52, 48];
  if (lift < HEIGHT) quad(api, [-HALF, FLOOR - lift, z1], [HALF, FLOOR - lift, z1], [HALF, FLOOR - HEIGHT, z1], [-HALF, FLOOR - HEIGHT, z1], door);
  // The switch: a big bright panel with a red disc, red all over the moment
  // it is hit, dull once down. The panel is a ring of pieces around the
  // disc, so the disc never sits on top of a face (one depth a face).
  const col = sw.hit > 0 ? [255, 40, 40] : sw.down ? [90, 110, 90] : [236, 240, 250];
  const disc = sw.hit > 0 ? [255, 40, 40] : sw.down ? [70, 80, 70] : [220, 60, 80];
  const x = HALF, cz = sw.z, cy = sw.y, r = sw.w * .28, n = 16, rim = [], edge = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    rim.push([x, cy + sa * r, cz + ca * r]);
    const reach = hh / Math.max(Math.abs(ca), Math.abs(sa));
    edge.push([x, cy + sa * reach, cz + ca * reach]);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    api.face(x, cy, cz, ...rim[j], ...rim[i], ...disc);
    quad(api, rim[i], rim[j], edge[j], edge[i], col);
  }
}

export function paint(api) {
  const { width, height } = api.view();
  api.wipe(26, 22, 34);
  for (const h of S.halls) drawHall(api, h);
  // Flat, in front: the flash, the reticle, the words.
  if (S.flash > 0) api.box(0, 0, width, height, 255, 250, 230);
  if (S.red > 0) api.box(0, 0, width, height, 200, 24, 30);
  const r = S.reticle, k = S.flash > 0 ? 34 : 26;
  api.line(r.x - k, r.y, r.x - 8, r.y, 4, 255, 255, 255); api.line(r.x + 8, r.y, r.x + k, r.y, 4, 255, 255, 255);
  api.line(r.x, r.y - k, r.x, r.y - 8, 4, 255, 255, 255); api.line(r.x, r.y + 8, r.x, r.y + k, 4, 255, 255, 255);
  api.write("hall " + (S.run + 1) + (S.best > S.run ? "   best " + (S.best + 1) : ""), 40, 36, 34, 255, 236, 120);
  const hint = current().index === 0 && !current().sw.down ? (S.turned ? "shoot the switch" : "e or trigger: turn to the right wall") : "";
  if (hint) api.write(hint, width / 2 - api.textWidth(hint, 40) / 2, height - 110, 40, 255, 255, 255);
  if (S.dead) {
    const line = "the door was closed";
    api.write(line, width / 2 - api.textWidth(line, 90) / 2, height * .38, 90, 255, 236, 120);
  }
}
