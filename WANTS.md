# WANTS — what downstream games need from the engine

Each entry is one ask. See CLAUDE.md for the format. The engine's author
reads this to decide what the engine grows next.

## Answered

- **3D shapes, the camera, objects and figures** (island-crisis drew its
  own software 3D over `api.triangle`) → engine 452: `api.camera`,
  `api.face`, `api.shade`, `api.light`, `api.project`, `api.object` with
  the engine's `revolver` and `monowheel` and a game's own `objects/*.lisp`,
  `api.defineObject`, `api.figure`. See GAME-SPEC.md → The world, and
  `games/showroom`.
- **Richer art: mesh models, textures** (island-crisis asked how to bring
  Blender meshes in) → engine 453, on purpose not as import: the object
  dialect grew curves and procedural surfaces instead — `tube` (a smooth,
  tapered, capped tube through points), `patch` (a bicubic Bézier surface),
  and the `grain`, `mottle` and `rough` scopes (noise-shaded, noise-blended
  and noise-displaced faces, no images). A form written as source can be
  read, re-cut per level, switched and bent per tick, where a mesh file can
  only be drawn. See OBJECT-DIALECT.md → Curves and surfaces, and
  `games/showroom/objects/boulder.lisp` and `sapling.lisp`.
- **Animation** (island-crisis asked how characters move) → engine 454: no
  keyframes, rigs in the dialect. `bend` (a two-piece limb solved toward a
  hint) and `orb` join `capsule`; joints are numbers an object computes
  from `distance`, `speed`, `time`, `turbo` and `(owner look x|y|z)`, so
  a walk is arithmetic. `games/kennel` is two four-legged hounds, trot,
  head, ears, tail and paws in `objects/hound.lisp`.
- **Mouse and keys the pad table doesn't carry** (island-crisis read the DOM
  itself in `lib/input.mjs`) → engine 452: `api.pointer()`, `api.keys()`,
  `api.cursor()`.

## Change the fight from an overlay
- game: (any overlay)
- what the game would do with it: new rules — knockback, health, power-ups, win conditions.
- smallest version that would unblock it: a deterministic `rules` hook the sim calls each tick, with a short list of writable fields.

## Sprites and alpha
- game: (any own)
- what the game would do with it: draw pictures from `assets/`, fade things in and out.
- smallest version that would unblock it: `api.image(path, x, y, w, h)` and an alpha argument on shapes.

## Netplay between two copies of a game
- game: (any)
- what the game would do with it: two players on two machines.
- smallest version that would unblock it: rooms namespaced by game slug on oskiewar's relay, with the same input-rollback the fight uses.

## AC sign-in, handles and high scores
- game: (any)
- what the game would do with it: players sign in with their aesthetic.computer handle; scores and saves are kept under it.
- smallest version that would unblock it: `api.player()` → `{ handle }` plus `api.score(name, value)` and `api.scores(name)`, backed by AC. Planned upstream.

## A cursor and alpha the engine draws
- game: island-crisis
- what the game would do with it: an aim reticle and menu cursor that follow the pointer at page resolution (like oskiewar's own SVG cursor), plus full-screen flashes for shots, hits and damage.
- smallest version that would unblock it: `api.cursor(svgOrName)` and an alpha on `api.box`. Meanwhile the game adds its own DOM layer (`lib/overlay.mjs`) over the canvases.
- Camera visibility: alpha on foreground scenery would let the game fade obstructing meshes; for now it clips decorative geometry just before the player in its software renderer, without hiding gameplay doors, targets or hazards.

## Big text
- game: island-crisis
- what the game would do with it: titles, banners and tutorial prompts at large sizes.
- smallest version that would unblock it: let `api.write` honour `size` in own mode (it's held to the one dojo size). Meanwhile a block font drawn with `api.box` (`lib/bigtext.mjs`).

## Paired Joy-Cons and unaliased controller input
- game: island-crisis
- what the game would do with it: combine upright left/right Joy-Cons into one player's move/aim controls, including nonstandard browser layouts, without ZL/ZR also generating fighting-game face-button actions.
- smallest version that would unblock it: raw controller IDs, mappings and axes/buttons, configurable pairing, and an option to disable trigger aliases in own mode. Meanwhile the game polls the Gamepad API itself and provides saved calibration for unknown layouts.
