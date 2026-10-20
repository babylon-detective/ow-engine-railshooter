# CLAUDE.md — making a game on the oskiewar engine

You are helping someone make **their own game** on the oskiewar engine, the
engine behind oskiewar.com (a free browser fighting game by Aesthetic
Computer). This repo is the downstream kit: the engine as shipped, a local
server with live reload, and a folder per game.

Read `GAME-SPEC.md` before writing any game code. It is the whole contract:
the `game.json` fields, the `.oskie` file, the hooks, every `api` call.

## First session: find out what they want

Don't scaffold right away. Ask, briefly and in plain words, then build
toward the answer:

1. **What is the game?** One sentence, or a game it's like. Fighting, racing,
   dodging, rhythm, a toy?
2. **Own or overlay?** Is it a different game on the engine (`own`: you draw
   and simulate everything), or oskiewar with new rules on top (`overlay`:
   the fighters and dojo stay, the module adds rules and HUD)? If they aren't
   sure, explain the difference with one example of each.
3. **Players.** One player, two on one keyboard, or pads?
4. **The first playable thing.** What is the smallest version that would
   already be fun to press buttons in? Build that first.
5. **Name.** A title (≤ 24 characters) and a slug (`a-z 0-9 -`).

Write the answers down in `games/<slug>/NOTES.md` as you go. The game's
design lives there between sessions, so read it at the start of every later
session.

## Scaffold, run, iterate

```bash
npm run new <slug>              # an "own" game  → games/<slug>/
npm run new <slug> -- --overlay # an "overlay" game
npm start                       # http://localhost:7777  (PORT=… to change)
```

Open `http://localhost:7777/play/<slug>`. Every save under `games/<slug>/`
reloads that page on its own, so don't tell them to refresh. The index at `/`
lists every game, and `/oskiewar` is the plain game for reference.

Start the server in the background and leave it running, then iterate in
small steps:

- Change one thing, save, and say what they should see. If you can see the
  browser yourself, look before claiming it works.
- Keep `sim` for state and `paint` for drawing (see GAME-SPEC.md).
- Split a growing game into modules under `games/<slug>/lib/` and import them
  with relative paths.
- Put sounds and pictures in `games/<slug>/assets/` and reach them with
  `api.asset("assets/…")`.

When something breaks, the game shows a red bar with the error and the
browser console has the stack. `npm run check` validates every game folder.

## Exporting

```bash
npm run pack <slug>             # → dist/<slug>.oskie, one file, the whole game
npm run unpack path/to/x.oskie  # → games/<slug>/  (add -- --force to overwrite)
```

A `.oskie` file is the game, the way a `.c3p` is a Construct project. It can
be sent, archived, or opened by anyone with this repo.

## Rules

- **Never edit `engine/`.** It is the engine exactly as oskiewar.com serves
  it, and it is replaced wholesale when the engine updates (`git pull`). A
  game that needs the engine to do something new asks for it in `WANTS.md`.
- **Your work goes in `games/<slug>/`.** Change root files (`server.mjs`,
  `bin/`, `lib/`) only for a real bug in the kit, and say so in the commit.
- **No dependencies.** No `npm install`. Games are plain ES modules, and the
  kit runs on Node ≥ 20 alone.
- **Commit and push your own game.** Commit as you reach playable steps, with
  messages that say what changed in the game, and push to `main`. The repo is
  shared with the engine's author, so keep each game in its own folder.

## WANTS.md: growing the engine

When the game wants something the `api` can't do (changing the fight, sprites,
alpha, 3D, saving scores, netplay, a hook that doesn't exist), add an entry to
`WANTS.md`:

```md
## <short name of the ask>
- game: <slug>
- what the game would do with it: …
- smallest version that would unblock it: …
```

Then work around it in the meantime if you can, and say so. The engine's
author reads this file to decide what the engine grows next. It is the
channel back upstream.
