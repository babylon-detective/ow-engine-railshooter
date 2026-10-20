// An "own" game: the engine draws nothing of oskiewar. This module is the
// whole game. See GAME-SPEC.md for every call on `api`.
// sim runs 60 times a second; paint runs once per displayed frame.

const state = { x: 0, y: 0, vx: 0, vy: 0, hits: 0 };

export function boot(api) {
  const { width, height } = api.view();
  state.x = width / 2;
  state.y = height / 2;
}

export function sim(api) {
  const pad = api.pad(0);
  const held = name => pad.down.includes(name);
  const ax = (held('ArrowRight') ? 1 : 0) - (held('ArrowLeft') ? 1 : 0) + pad.leftX;
  const ay = (held('ArrowDown') ? 1 : 0) - (held('ArrowUp') ? 1 : 0) - pad.leftY;
  state.vx = (state.vx + ax * 1.6) * 0.9;
  state.vy = (state.vy + ay * 1.6) * 0.9;
  state.x += state.vx;
  state.y += state.vy;
  const { width, height } = api.view();
  if (state.x < 40 || state.x > width - 40 || state.y < 40 || state.y > height - 40) {
    state.x = Math.min(width - 40, Math.max(40, state.x));
    state.y = Math.min(height - 40, Math.max(40, state.y));
    state.vx *= -0.6;
    state.vy *= -0.6;
    state.hits++;
    api.drum('block', 0.6, (state.x / width) * 2 - 1);
  }
}

export function paint(api) {
  const { width } = api.view();
  api.wipe(22, 26, 48);
  api.box(state.x - 40, state.y - 40, 80, 80, 255, 205, 74);
  const title = api.manifest.title;
  api.write(title, width / 2 - api.textWidth(title, 72) / 2, 48, 72, 255, 236, 120);
  api.write('WASD or stick to move · walls hit ' + state.hits, 48, 150, 28, 220, 230, 255);
}
