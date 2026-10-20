# Oskiewar game spec — `ac.oskiewar.game` v1

A game on the oskiewar engine is a folder while you work on it and a single
`.oskie` file when it travels, the way a Construct project is a folder or a
`.c3p`. The engine is the one oskiewar.com runs, unmodified; a game never
patches it, it plugs into it.

```
games/<slug>/            →  npm run pack <slug>  →  dist/<slug>.oskie
  game.json                  (one JSON file: manifest + every file)
  game.mjs
  lib/*.mjs, assets/*    ←  npm run unpack dist/<slug>.oskie
```

## Two modes

| mode | the engine runs | your module |
|---|---|---|
| `own` | the platform only: pads and keyboard, the frame, the comic typeface, drums and tones | is the whole game — it simulates and paints everything |
| `overlay` | oskiewar itself: title, dojo, fighters, dummy, physics | watches the fight through `signal` and `players()`, and draws on top |

Pick `own` to make a different game. Pick `overlay` to make oskiewar with
different rules on top. An overlay can read the fight but not change it in v1:
that is the first thing on the list of asks (see "Asking the engine for more").

## `game.json`

```json
{
  "slug": "dreamdeal",
  "title": "dream deal",
  "author": "@dreamdealer",
  "description": "One line about the game.",
  "mode": "own",
  "entry": "game.mjs",
  "engine": 449
}
```

| field | rule |
|---|---|
| `slug` | 2–32 characters of `a-z 0-9 -`, starting with a letter; the folder name and the URL `/play/<slug>` |
| `title` | 1–24 characters; the tab title, and in `overlay` mode the wordmark on the title screen |
| `mode` | `"own"` or `"overlay"` |
| `entry` | the module the engine imports; default `game.mjs` |
| `engine` | the engine build the game was made against (`engine/ENGINE.json` → `build`); `npm run check` warns when it differs |
| `author`, `description` | optional, ≤ 60 and ≤ 280 characters |

## The `.oskie` file

UTF-8 JSON:

```json
{
  "format": "ac.oskiewar.game",
  "version": 1,
  "manifest": { "...": "game.json, as above" },
  "files": {
    "game.mjs":        { "type": "text/javascript", "text": "export function paint(api) { … }" },
    "lib/board.mjs":   { "type": "text/javascript", "text": "…" },
    "assets/hit.wav":  { "type": "audio/wav", "base64": "UklGR…" }
  }
}
```

- Every path is relative to the game folder: letters, digits, `_ . -`, and `/`
  between parts, with no `..`.
- Each file carries exactly one of `text` or `base64`.
- 32 MB in all.
- Text types are `.mjs .js .json .txt .md .svg .lisp .csv`. Binary types are
  `.png .jpg .jpeg .gif .webp .wav .mp3 .ogg .glb .woff2 .ttf`. Any other
  extension is refused at pack time.
- Modules can import each other with relative specifiers
  (`import { x } from "./lib/board.mjs"`). Import cycles are refused. Bare
  imports (`"three"`) and URLs don't resolve. A game carries its own code.

`engine/oskiewar-game.mjs` is the validator. The CLI and the browser both use
it, so a file `npm run check` accepts is a file the engine runs.

## The module

Export any of these. Every hook is optional.

```js
export function boot(api) {}          // once, after the engine is up
export function sim(api) {}           // 60 times a second, fixed step
export function paint(api) {}         // once per displayed frame, after the engine draws
export function signal(api, event) {} // overlay: every engine event, as it happens
```

- `sim` is the only place game state should advance. `paint` can run more or
  fewer times than `sim` and should only draw.
- When a hook throws, the game stops. The engine keeps running and puts the
  error in a red bar at the top of the screen, and the browser console has the
  stack. Save the file and the page reloads.

### `api`

**Identity and time**

| call | returns |
|---|---|
| `api.manifest` | the validated `game.json` |
| `api.engine` | the engine build number |
| `api.now()` | seconds on the engine's clock |
| `api.view()` | `{ width, height }` of the stage, in the units every draw call uses (height is 1080; width follows the window) |
| `api.screen()` | `own`: always `"game"`. `overlay`: oskiewar's screen — `"title"`, `"game"`, … |
| `api.asset(path)` | a URL for a file in the game (`api.asset("assets/hit.wav")`), for `new Image()`, `new Audio()` or `fetch` |

**Input**

`api.pad(seat)`, where `seat` is `0` or `1`, returns
`{ connected, down, leftX, leftY, rightX, rightY }`.

- `down` lists the buttons held right now: `ArrowUp ArrowDown ArrowLeft
  ArrowRight A B X Y LeftShoulder RightShoulder LeftTrigger RightTrigger View
  Menu LeftStick RightStick`.
- The sticks run from −1 to 1, and up is positive.
- The keyboard plays seat 0:

| key | button |
|---|---|
| W A S D | the arrows |
| J | X |
| K | A |
| J + K | X + Y |
| L | A + X |
| I | Y |
| Enter | A (outside a fight) |
| Space | B (outside a fight) |
| Esc | Menu |
| Tab | View |

- A plugged-in pad (standard layout) takes its own seat.
- In overlay mode oskiewar is reading the same pads to move the fighters.

**Drawing** (stage units; colors are 0–255)

| call | does |
|---|---|
| `api.wipe(r, g, b)` | fills the backdrop, behind everything |
| `api.box(x, y, w, h, r, g, b)` | a filled rectangle, in front of the scene |
| `api.line(x1, y1, x2, y2, width, r, g, b)` | a line, in front of the scene |
| `api.triangle(x1, y1, x2, y2, x3, y3, r, g, b)` | a filled triangle, in front of the scene |
| `api.write(text, x, y, size, r, g, b)` | text in oskiewar's comic face, always lower case; `y` is the top of the line |
| `api.textWidth(text, size)` | how wide `write` will make it |

Shapes have no alpha in v1. Draw order is call order.

**Sound**

| call | does |
|---|---|
| `api.drum(name, amount = 1, pan = 0)` | plays an engine drum. Names: `kick snare clap hat bell gong ding block whoosh glass glass-shard body-impact`. `amount` runs 0–2; `pan` runs −1 (left) to 1 (right) |
| `api.tone(frequency, seconds = .12)` | a short synth note |

Browsers start audio only after the first key or click.

**The fight** (overlay only; in `own` mode these return `[]` and `null`)

| call | returns |
|---|---|
| `api.players()` | copies of the fighters on stage: `{ index, name, x, y, z, vx, vy, facing, grounded, alive, score, roundWins }`. These are world units: `y` grows downward, the floor is at 1800, a fighter is about 220 tall. Changing a copy changes nothing |
| `api.project(x, y, z)` | where a world point lands on screen: `{ x, y, behind }`, in stage units |

`signal(api, event)` receives `{ name, player, value, value2 }`. `player` is
the seat (0 or 1), or −1 for the room. The engine emits many names. A few
common ones are `jump punch kick block grab throw dash pickup powerup
countdown round-win match-win tie shield ballserve`. Log them to find the rest:

```js
export function signal(api, e) { console.log(e.name, e.player, e.value); }
```

## Where a game runs

- **Locally (v1).** `npm start` serves the engine at `http://localhost:7777`
  and each game at `/play/<slug>`. Saving any file in the game reloads its page.
- **A `.oskie` anywhere.** On a localhost page, the engine shell also takes
  `?game=<url of a .oskie>`.
- **Your own site.** `npm run build <slug>` writes `dist/<slug>/`: the engine,
  the game as `game.oskie`, and an `index.html` that loads it. It's static
  files and nothing else, so any host works. For Vercel it's
  `vercel deploy dist/<slug> --prod`.
- **Not on oskiewar.com yet.** A game is code, and code on oskiewar.com could
  act as the signed-in player. Hosting `.oskie` games there needs a sandboxed
  origin first.
- **Offline from oskiewar's rooms.** A downstream game never joins oskiewar's
  public rooms and never asks for an AC sign-in. Netplay between two copies
  of the same game is planned; it is not in v1.

## Asking the engine for more

v1 is deliberately small. When a game needs something the API above can't do
(changing the fight, sprites, alpha, 3D shapes, AC sign-in and handles for
high scores, netplay), write
it in `WANTS.md` with what the game would do with it. That file is how the
engine learns what to grow next.
