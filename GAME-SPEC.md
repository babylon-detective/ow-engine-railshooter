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
| `own` | the platform only: pads, keyboard and pointer, the frame, the comic typeface, drums and tones, and the world — one camera, world faces, the engine's objects and figures (engine 452 and later) | is the whole game — it simulates and paints everything |
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
- `objects/<name>.lisp` is an object (see **Objects** below), defined under
  `<name>` before `boot`.

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

`api.pointer()` is the mouse or finger on the stage: `{ x, y, active, down }`
in stage units, `down` while a button or finger is pressed. `api.keys()` lists
every key held right now by its code (`KeyQ`, `Space`, `KeyM`, …), so a game
can use keys the pad table doesn't name. `api.cursor(name)` picks the mouse
cursor over the stage: `"none"` (for a game that draws its own reticle),
`"crosshair"`, `"pointer"` or `"default"`. (Engine 452 and later.)

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

**The world** (engine 452 and later)

The engine is a 3D game, and an `own` game may draw in its world instead
of, or as well as, on the flat stage. World units are the engine's: **`y`
grows downward**, the fighters' floor is at `y = 1800`, a fighter is about
220 tall, and `-y` is up. Everything below is seen through one camera, and
world faces take their depth from it, so they sort against each other (and,
in an overlay, against the fighters) without the game sorting anything.

| call | does |
|---|---|
| `api.camera(spec?)` | `own` mode: moves the camera to `spec` and returns it. `spec` is `{ position, target, fov, roll, perspective }`; `position` and `target` are `{ x, y, z }` or `[x, y, z]`, `fov` is the horizontal field of view in degrees, across the stage (55 by default, the fight's lens; 90–100 for a first-person hall, lower for a closer, more cinematic frame), `perspective` runs 1 (perspective) to 0 (orthographic, `width` world units across the stage). What `spec` leaves out keeps its value. With no `spec`, or in an overlay, it returns the camera as it stands |
| `api.face(ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b)` | one world triangle in a flat colour. Wind it counter-clockwise as seen from the side you want to show; both sides draw |
| `api.shade(ax, ay, az, bx, by, bz, cx, cy, cz)` | the engine's flat lighting for that face, .72 (turned away from the sun) to 1 (facing it). Multiply your colour by it to light faces the way the engine lights its own |
| `api.light()` | the sun's direction, a unit `{ x, y, z }` |
| `api.project(x, y, z)` | where a world point lands on the stage: `{ x, y, behind }` |

Faces drawn with `api.triangle` sit in front of the world, so a HUD or a
reticle drawn with the flat calls covers it.

A world face carries **one depth**, its middle, not a depth per pixel. Two
faces that cross in space, or lie on the same plane and overlap (a panel on
a wall, a disc on the panel), fight: whichever middle is nearer wins the
whole overlap. Build so nothing overlaps — cut the wall around the panel,
make the panel a ring around the disc — or lift the nearer thing clearly
off the surface. `games/showroom` does both.

**Objects** (engine 452 and later)

Oskiewar's props are small KidLisp programs in the object dialect
(`OBJECT-DIALECT.md` in the engine's repo: `slab`, `ball`, `limb`, `ring`,
`drum`, `plate`, `stroke`, `ink`, `outline`, `move`, `rotate`, `radial`,
`mirror`, inputs like `time` and `distance`). They compile once and draw
flat, inked, in the engine's style. A game draws the engine's and brings
its own.

| call | does |
|---|---|
| `api.object(name, inputs, place)` | draws object `name` once, this frame. `inputs` is an object of the dialect's input names the object reads (`time`, `distance`, `speed`, `lean`, `heading`, `pitch`, `turbo`, `hit`, `land`, `cylinder`, `spent`, `cock`, …); a missing one reads its default, and `time` reads the engine clock. `place` is where it stands: `{ x, y, z, heading, scale }` (`heading` in radians about the world's up, 0 facing +x) or `{ x, y, z, forward, up, scale }`, or the twelve numbers of a frame (origin, then where object x, y, z point) |
| `api.objects()` | the names that can be drawn right now |
| `api.defineObject(name, source)` | defines (or replaces) an object from dialect source at run time; it compiles at once, so a mistake throws here |

- The engine's objects: `monowheel` (the freeskate wheel; reads `distance`,
  `speed`, `turbo`, `land`, `hit`), `revolver` (the gun fights' six-shooter,
  its origin in the fist; reads `cylinder`, `spent`, `cock`).
- **Your objects:** every `objects/<name>.lisp` in the game is defined as
  `<name>` before `boot`. One that fails to compile stops the game with the
  file named in the red bar. A name the engine has (`monowheel`, `revolver`,
  `figure`, `character`) replaces the engine's — that is how a game restyles
  the figure every `api.figure` call draws.
- Object space: x forward, y up, z to the owner's right, the game's units.

**Figures** (engine 452 and later)

`api.figure(joints, options?)` draws an oskiewar fighter — the flat figure
every player is drawn as — on sixteen joints the game poses. It returns
`false` when no joint was given.

- `joints` is `{ head, look, neck, pelvis, "shoulder-l", "shoulder-r",
  "elbow-l", "elbow-r", "hand-l", "hand-r", "hip-l", "hip-r", "knee-l",
  "knee-r", "foot-l", "foot-r" }`, each `[x, y, z]` or `{ x, y, z }`, or a
  flat array of 48 numbers in that order. `look` is a point one head radius
  (about 22) out from `head` in the direction the face points. A joint left
  out (or `NaN`) draws nothing hung on it. A standing fighter: head 196 above
  the floor, neck 170, shoulders ±20 across at 168, pelvis 100, hips ±11 at
  95, knees 48, feet on the floor.
- `options.palette` is ten colours, the LOOK slots: skin, hair, shirt,
  pants, skirt, shoe, accent, iris, lip, blush (ten `[r, g, b]`, or thirty
  numbers). Left out, the default fighter's.
- `options.eyes` (`dots wide sleepy none`) and `options.mouth` (`smile
  neutral frown none`) draw the made character's face instead; its palette
  slots then read skin=head, shirt=torso, pants=left arm, skirt=right arm,
  shoe=left leg, accent=right leg, iris=face, lip=shoes, hair=hair.
- `options.blink`, `hurt` (X eyes), `glasses`, `headless`, `crowd` (fewer
  marks, for many small figures) are switches.

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
(changing the fight, sprites, alpha, AC sign-in and handles for high scores,
netplay), write
it in `WANTS.md` with what the game would do with it. That file is how the
engine learns what to grow next.
