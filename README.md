# oskiewar engine

Make your own game on the engine behind [oskiewar.com](https://oskiewar.com).
Web output, no dependencies, live reload.

```bash
git clone <this repo> && cd oskiewar-engine
npm start                     # → http://localhost:7777
npm run new my-game           # games/my-game/ → http://localhost:7777/play/my-game
npm run pack my-game          # → dist/my-game.oskie (the whole game, one file)
npm run build my-game         # → dist/my-game/ (static site: vercel deploy dist/my-game --prod)
```

- `GAME-SPEC.md` — the game format and the engine API.
- `CLAUDE.md` — how a coding agent should work here (start here with Claude Code).
- `WANTS.md` — what games need from the engine next.
- `games/hello` (own) and `games/jump-count` (overlay) are working examples.

Needs Node 20 or newer.

## Deploy Island Crisis

Run commands from this repository's root. No Vite, Vue, dependency installation,
or separate frontend project is needed. `pack` produces a portable `.oskie`
game file; `build` produces the complete static website.

```bash
npm run build island-crisis
vercel deploy dist/island-crisis --prod --project island-crisis --scope babylon-detectives-projects
```

The generated `vercel.json` disables framework detection, installation, and
remote building: the uploaded folder is already built. Rebuild before each
deploy. Building replaces the output folder, including its local Vercel link;
the explicit project and scope above keep deployments pointed at the same
project rather than creating another one.

For Git-based deployment of this repository instead, leave Vercel's Root
Directory empty. The root `vercel.json` disables framework detection and
installation, builds with `npm run build island-crisis`, and serves
`dist/island-crisis`. Do not set the Root Directory to `vite` or use `vite build`.
