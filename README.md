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
