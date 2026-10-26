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
- `OBJECT-DIALECT.md` — the KidLisp dialect a game's own `objects/*.lisp` props, vehicles and rigs are written in (`orb`, `tube`, `patch`, `bend`, `grain`, `mottle`, …).
- `CLAUDE.md` — how a coding agent should work here (start here with Claude Code).
- `WANTS.md` — what games need from the engine next.
- `games/hello` (own), `games/showroom` (own, in the engine's 3D: camera, world faces, oskiewar's props and figures, `.lisp` objects of its own), `games/kennel` (own: two hounds as dialect rigs, joints solved from `distance`/`speed`/`time`), `games/typist` (own: a typing rail shooter) and `games/jump-count` (overlay) are working examples.

Needs Node 20 or newer.
