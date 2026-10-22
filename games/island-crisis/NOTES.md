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
   then front and back together. The exit opens when the last wave is clear.
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
- `lib/input.mjs`: Q/E/M/Space/Enter/Shift and the pointer
- `lib/bigtext.mjs`: block font (api.write draws one fixed size)

## Next

- More island set pieces (a boss per biome).
- Teach dash with a scripted volley in the hallway.
