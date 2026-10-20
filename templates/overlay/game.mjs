// An "overlay" game: oskiewar runs underneath (fighters, dojo, title) and
// this module watches it and draws over it. It can read the fight but not
// change it; see GAME-SPEC.md, and WANTS.md for asking the engine for more.

const tally = new Map();

export function signal(api, event) {
  // Every engine event comes through here: punch, kick, jump, pickup, ...
  // `event.player` is the seat (0 or 1), or -1 for the room.
  if (event.player < 0) return;
  const key = event.player + ':' + event.name;
  tally.set(key, (tally.get(key) || 0) + 1);
}

export function paint(api) {
  if (api.screen() !== 'game') return;
  for (const player of api.players()) {
    // y grows downward; a fighter stands about 220 units tall.
    const spot = api.project(player.x, player.y - 280, player.z);
    if (!spot || spot.behind) continue;
    const jumps = tally.get(player.index + ':jump') || 0;
    const label = 'jumps ' + jumps;
    api.write(label, spot.x - api.textWidth(label, 30) / 2, spot.y, 30, 255, 236, 120);
  }
}
