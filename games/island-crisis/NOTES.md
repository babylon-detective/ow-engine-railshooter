# island crisis — a 3D rail shooter

**Mode:** own · **Players:** 1 (keyboard + mouse, or a pad)
**Like:** Sin & Punishment, Panzer Dragoon Orta

## The run

1. **The hallway** (tutorial, slow). Three sealed doors. Each opens from a
   switch you can only see, and only hit, after turning the camera:
   right wall (E), left wall (Q), the back of a pillar you already passed
   (E E). Reach a door still shut and you die ("sealed in"). Nudges at the
   top of the screen name the keys, the compass slot flashes, and chevrons
   point the way. A few drones teach tap fire.
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
- Dash: hold Shift (LB) and tap a direction for a short untouchable burst.
- Enter (Start) pauses the whole loop.

## Controls

| keyboard | pad | does |
|---|---|---|
| WASD | d-pad / left stick | move on the screen plane |
| Shift + direction | LB + direction | dash |
| mouse / trackpad | right stick | aim the reticle |
| click / J | RB / X | fire (tap) |
| Space / K | A / B | dodge roll |
| Q / E | LT / RT | turn the camera 90° |
| M | View / Y | map (outdoors) |
| Enter | Start | pause |

### Joy-Cons on macOS / Brave

Use `http://localhost:7777/play/island-crisis`, click the page and press a
button on **each** Joy-Con. Bluetooth pairing alone does not guarantee that
the browser exposes a controller. Hold the two halves upright.

The game polls the browser directly, combines both halves into one player,
and does not use the engine's fighting-game trigger aliases. Standard-layout
controllers work automatically; individual Chromium Joy-Cons are rotated
back from their sideways browser layout. The left stick moves, the right
stick aims, L + direction dashes, R fires, ZL/ZR rotate the camera,
Minus opens the map, and Plus starts/confirms menus or pauses gameplay.
Face-button positions follow the standard layout (Nintendo B = bottom,
A = right, Y = left, X = top); R is the unambiguous fire button.

Open **Controllers (G)** to see controller IDs, axes, and pressed button
indices. If the browser reports an unknown/raw layout, use **Calibrate /
remap** with both halves connected. Center all sticks before each Ready
step, perform the requested action, then release it. Bindings are saved
locally per device ID/layout, not by connection order. Skip controls you
don't have; the left stick also navigates menus and initiates dash.
Closing cancels unfinished calibration; Use automatic mapping clears it.
Opening setup pauses gameplay; resume afterwards with Plus or Enter.

If the panel reports no devices, focus the game and press buttons again.
Check Brave's site-specific fingerprinting protection for localhost; if it
blocks Gamepad API access, allow it for this site or try Chrome to compare.
Calibration cannot read hardware that the browser does not expose.
No WebHID permission, driver, dependency, or engine modification is needed.

Validation: `node games/island-crisis/tests/gamepad.test.mjs`.

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
- `lib/facility.mjs`: hallway and hangar geometry, gates and switches, waves, nudges
- `lib/title.mjs`: track flyover camera, wordmark, menu layout
- `lib/overlay.mjs`: SVG cursor and flash layer
- `lib/combat.mjs`: enemies (drone, charger, turret, slab, gunship), tap fire, hits
- `lib/hud.mjs`: HUD, nudges and keycaps, compass, map overlay
- `lib/world.mjs`, `lib/rail.mjs`: island, biomes, rail network, routes
- `lib/render.mjs`, `lib/mesh.mjs`: software 3D (clip, painter's sort, fog)
- `lib/input.mjs`: keyboard, pointer, and unified per-tick controller snapshot
- `lib/gamepad.mjs`: standard/Joy-Con mapping, dead zones, saved raw bindings
- `lib/controller-setup.mjs`: controller diagnostics and calibration panel
- `lib/bigtext.mjs`: block font (api.write draws one fixed size)

## Next

- More island set pieces (a boss per biome).
- Teach dash with a scripted volley in the hallway.
