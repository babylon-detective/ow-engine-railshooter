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
