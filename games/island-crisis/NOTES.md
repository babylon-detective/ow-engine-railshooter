# island crisis — a 3D rail shooter

**Mode:** own · **Players:** 1 (keyboard + mouse, or a pad)
**Like:** Sin & Punishment, Panzer Dragoon Orta

## The run

1. **The hallway** (tutorial, slow). Three sealed doors. Each opens from a
   switch you can only see, and only hit, after turning the camera:
   right wall (E), left wall (Q), the back of a pillar you already passed
   (E E). Each switch sits ~1100 before its door, and a shot switch holds
   the door open for only `GATE_HOLD` = 200 ticks (3.3 s, countdown in the
   nudge) before it shuts again. Cruising covers ~1000 in that time, so you
   must **BOOST** straight after the shot (three boosts ≈ 2000). If it shuts
   on you, **BRAKE** to buy time and shoot the switch again; reach a shut
   door and you die ("sealed in", with a hint to boost). The switch scores
   500 once. Nudges name the keys, the compass slot flashes, and chevrons
   point the way. Low 70-unit hurdles at z=1000 and z=3900 teach jumping;
   running into one costs 12 HP. A few drones teach tap fire.
2. **The hangar.** Wide room, five scripted waves of *slabs*, armoured
   plates the size of a screen panel, from the front, right, left, behind,
   then front and back together. The runner halts 1700 short of the exit so
   a front wave still hangs inside the room, and every enemy is kept between
   the back wall, the side walls and the shut door (enemies ride in
   runner-relative space, so without that they drifted past the door where
   they couldn't be seen or shot). The exit opens when the last wave is
   clear, the runner speeds through, and the island begins.
3. **The island.** The open rail network across five biomes (jungle,
   desert, urban, cave, mountain top). M lifts the camera into the map to
   choose the next pathway at junctions.

Each level start is a checkpoint, saved in localStorage
(`island-crisis:save`). The title's **continue** resumes there, and so
does **retry** after a death.

## Feel

- Long lens (FOV .62) close behind the runner, so enemies fill the frame.
- **Tap to fire**: one press, one round. Loud (kick + clap + hat), a white
  screen flash, reticle recoil.
- **One shot, one kill.** A hit enemy flashes red and white for a moment,
  then bursts (red hit-marker on the reticle, bigger flash). The gunship
  takes 6.
- **BOOST** (Space / right click / L2): 22 untouchable ticks, ready again
  after 36. With no direction held it drives forward in depth and surges the
  rail 16 extra units a tick (~350 per boost): doors, falling rocks. With a
  direction it bursts across the 2D plane (on the ground: steer plane; while
  hovering: the screen plane).
- **BRAKE** (hold C / PS X): rail speed × .35, the runner pulls back toward
  the camera, and any boost surge is cancelled. For dodging things ahead,
  buying time at a shutting door, or slowing down to pick another route.
- Esc / P / Start pause the whole loop (Enter fires during play).

## Ground, jump, hover

New runs and level transitions start with feet on the floor. Outside, contact
follows the actual terrain triangles rather than the rail's smoothed height.
Gravity advances only in `sim`; it freezes with pause and the route map.

- Grounded or jumping: WASD / left stick steer on the horizontal ground
  plane relative to the camera. Rail travel still happens automatically.
- First jump: a gravity-bound jump that can clear a low barrier.
- Second jump press before landing: engage hover. Left/right move across
  the view; up/down raise/lower altitude. Releasing the stick holds height.
  Boost and brake also work while hovering.
- Jump from hover: launch in the left-stick/WASD direction on the ground
  plane, with an upward impulse, then fall and land. With no direction held,
  leap forward relative to the camera. Hold BOOST to power up this leap.
  Further jump presses cannot restore hover until the player lands.

## Aim modes and camera visibility

Free aim is the default, with a cyan SVG crosshair. Click R3 or press F to
toggle auto aim: the crosshair turns red and snaps to the nearest living,
on-screen enemy **by distance from the player**. It tracks that enemy's
center. Flick the right stick towards another target to select it; center
the stick before another flick. Death or loss of visibility acquires the
nearest eligible target. With no targets the mode stays red but has no lock.
Toggle back to free aim for precise switch shots. Mouse motion does not
pull an auto-locked reticle away from its target.

The scenery cutaway keeps the runner in sight: terrain, walls and props
nearer the lens than the runner that rise into the line of sight from the
camera to it (and lie close to that line) are left out. Ground below the
line stays. It is visual only: enemies, the runner, hurdles, doors and
switches are never cut, and auto aim cannot acquire enemies through closed
doors. The title flyover and overhead map keep all the scenery.

## Drawing: the engine's 3D

Since engine 455 everything 3D goes through the engine: `api.camera`,
`api.face`, `api.object` and `api.figure` (GAME-SPEC.md → The world,
Objects, Figures; OBJECT-DIALECT.md). There is no mesh code in the game.

- **Coordinates.** The game's world is y-up (terrain, rails, the fight);
  the engine's is y-down. Every point crosses as (x, −y, z), which keeps
  screen-right right and makes an object's "z to the right" our right.
  A rail heading θ is forward (sin θ, 0, cos θ).
- **`lib/render.mjs`** keeps the camera's math on our side for culling,
  fog, aim rays and the HUD, and tells `api.camera` the same lens (fov
  across the stage). The engine draws its centre a little above the stage's
  middle, so each frame `Scene.begin` measures it with `api.project` and
  our projection follows; they agree to the pixel. `Scene` sends
  triangles (`tri`, `quad` — one-sided with a normal, fogged by depth),
  camera-facing `spark`s, and `object`s placed by a 12-number frame.
- **World faces:** terrain (two per cell, lit by the engine's sun from
  `api.light()`), the open sea around the grid out to the horizon, the
  rooms' floors, walls and ceilings, doors, shadows, sparks, bullets. A
  world face carries one depth, so nothing is laid on another: floors are
  cut around their stripes, walls into bands round their light strips.
- **Objects (`objects/*.lisp`):** island props `palm jungle-tree cactus rock
  mesa tower spire crystal pine snowrock arch`; set pieces `gate-frame fin
  hurdle crate rib beam switch`; enemies `drone charger turret shield
  gunship`; the runner's `blaster`. Organic things are lit forms (tube,
  revolve, orb, capsule under grain / mottle / rough, no face splits);
  built things are flat and inked (slab under outline), the engine's style.
- **Switches as state.** `hurt` flashes an enemy red, `turbo` white (hit and
  dying frames, a charger's wind-up, a shield's charge, a lit door lamp, a
  hit switch); both bake, so a flash costs nothing. A turret's barrel reads
  `pitch`; a shield's and gunship's cores pulse with `time`.
- **Biome colours.** Drone, charger, turret and shield keep their body
  colour in three `def`s; boot fetches each source and `defineObject`s a
  copy per biome (`drone-1` … `shield-4`) with them swapped, as the kennel's
  grey hound is made.
- **The runner** is the engine's fighter (`api.figure`), posed in
  `lib/runner.mjs` from the run cycle, jump tuck, hover and the gun arm's
  aim, with `blaster` in the right fist.
- **Budget.** Props are the costly part of a frame: the nearest 140 are
  drawn (100 on the title flyover), none past most of the fog. Headless
  (software GL) the island runs at 60 fps, the flyover 43–47.

## Controls

PlayStation names; Nintendo / Xbox in brackets.

| keyboard | pad | does |
|---|---|---|
| WASD / arrows | d-pad / left stick | steer; while hovering, up/down controls altitude |
| Space / right click | L2 (ZL / LT) | **BOOST** (forward, or across the plane with a direction) |
| C (hold) | Cross (Nintendo B / Xbox A) | **BRAKE** |
| U | Circle (Nintendo A / Xbox B) | jump / hover / exit leap |
| Enter / click | R2 (ZR / RT), also Square | fire (tap) |
| Q / Left Shift | L1 (L / LB) | turn the camera 90° left |
| E / Right Shift | R1 (R / RB) | turn the camera 90° right |
| IJKL / mouse | right stick | aim the reticle |
| F | R3 | toggle free aim / auto lock |
| — | right-stick flick in auto mode | snap to another enemy center |
| M | Select / Minus / View | map (outdoors) |
| Esc / P | Start / Plus / Menu | pause |

There is no dodge roll any more: BOOST is the untouchable move. K aims
down (IJKL), so BRAKE lives on C.

### Joy-Cons on macOS / Brave

Use `http://localhost:7777/play/island-crisis`, click the page and press a
button on **each** Joy-Con. Bluetooth pairing alone does not guarantee that
the browser exposes a controller. Hold the two halves upright.

The game polls the browser directly, combines both halves into one player,
and does not use the engine's fighting-game trigger aliases. Standard-layout
controllers work automatically; individual Chromium Joy-Cons are rotated
back from their sideways browser layout (macOS may also expose the pair as
one "Joy-Con (L/R)" standard pad, which maps directly). The left stick
moves, the right stick aims, L / R turn, ZL boosts, ZR fires, B brakes,
A jumps, Minus opens the map, Plus pauses, right-stick click toggles auto
aim. Face-button positions follow the standard layout (Nintendo B = bottom,
A = right, Y = left, X = top).

Open **Controllers (G)** to see controller IDs, axes, and pressed button
indices. If the browser reports an unknown/raw layout, use **Calibrate /
remap** with both halves connected. Center all sticks before each Ready
step, perform the requested action, then release it. Bindings are saved
locally per device ID/layout, not by connection order. Skip controls you
don't have; the left stick also navigates menus.
Closing cancels unfinished calibration; Use automatic mapping clears it.
Opening setup pauses gameplay; resume afterwards with Plus or Enter.
Saved custom calibrations keep their physical buttons, but the actions
moved (L2 boost, R2 fire, L1/R1 turn, X brake, O jump): recalibrate when
the panel asks. Standard-layout pads and paired Joy-Cons need nothing.

If the panel reports no devices, focus the game and press buttons again.
Check Brave's site-specific fingerprinting protection for localhost; if it
blocks Gamepad API access, allow it for this site or try Chrome to compare.
Calibration cannot read hardware that the browser does not expose.
No WebHID permission, driver, dependency, or engine modification is needed.

Validation:
`node games/island-crisis/tests/gamepad.test.mjs` and
`node games/island-crisis/tests/gameplay.test.mjs`.

## Title

Massive ISLAND / CRISIS block letters over a camera that flies the tracks on
its own (random branch at every junction, no enemies, no runner), with
**start** and **continue**.

## Cursor

The reticle is an SVG in a DOM layer over the engine's canvases, like
oskiewar's own `precise.svg` cursor. The browser draws it at page pixels and
pointer events move it directly, so it never stretches with the stage. Its
modes: menu crosshair, "active" (opens over a button), aim, and lock
(red, closes in over an enemy or a switch you're facing). The same layer
does the screen flashes with CSS opacity (see WANTS.md).

## Files

- `game.mjs`: modes (title / play / over / paused), camera, runner, menus, save
- `lib/motion.mjs`: grounded movement, gravity, hover, directional leaps, BOOST / BRAKE, rail surge
- `lib/targeting.mjs`: nearest visible targets, directional flick selection, center tracking
- `lib/facility.mjs`: hallway and hangar geometry, gates and switches, waves, nudges
- `lib/title.mjs`: track flyover camera, wordmark, menu layout
- `lib/overlay.mjs`: SVG cursor and flash layer
- `lib/combat.mjs`: enemies (drone, charger, turret, slab, gunship), tap fire, hits
- `lib/hud.mjs`: HUD, nudges and keycaps, compass, map overlay
- `lib/world.mjs`, `lib/rail.mjs`: island, biomes, rail network, routes; terrain faces, prop placements
- `lib/render.mjs`: the scene: camera math, `api.camera`, faces, sparks, objects, the cutaway
- `lib/runner.mjs`: the runner as `api.figure`, posed, with the blaster
- `objects/*.lisp`: every prop, set piece and enemy, in the object dialect
- `lib/input.mjs`: keyboard, pointer, and unified per-tick controller snapshot
- `lib/gamepad.mjs`: standard/Joy-Con mapping, dead zones, saved raw bindings
- `lib/controller-setup.mjs`: controller diagnostics and calibration panel
- `lib/bigtext.mjs`: block font (api.write draws one fixed size)

## Next

- More island set pieces (a boss per biome).
- Collapsing rocks on the island that only BOOST outruns.
