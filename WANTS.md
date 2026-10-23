# WANTS — what downstream games need from the engine

Each entry is one ask. See CLAUDE.md for the format. The engine's author
reads this to decide what the engine grows next.

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

## Big text
- game: island-crisis
- what the game would do with it: titles, banners and tutorial prompts at large sizes.
- smallest version that would unblock it: let `api.write` honour `size` in own mode (it's held to the one dojo size). Meanwhile a block font drawn with `api.box` (`lib/bigtext.mjs`).

## Paired Joy-Cons and unaliased controller input
- game: island-crisis
- what the game would do with it: combine upright left/right Joy-Cons into one player's move/aim controls, including nonstandard browser layouts, without ZL/ZR also generating fighting-game face-button actions.
- smallest version that would unblock it: raw controller IDs, mappings and axes/buttons, configurable pairing, and an option to disable trigger aliases in own mode. Meanwhile the game polls the Gamepad API itself and provides saved calibration for unknown layouts.
