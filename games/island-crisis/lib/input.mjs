// Input the engine's api.pad doesn't carry: Q / E / M / Space / Enter /
// Shift and the mouse or trackpad. WASD, J, K and pads still come from api.pad.
const watched = new Set(['KeyQ', 'KeyE', 'KeyM', 'Space', 'Enter', 'NumpadEnter', 'ShiftLeft', 'ShiftRight']);
const state = {
  held: new Set(), presses: [],
  mouse: { u: .5, v: .5, moved: false, down: false, clicks: [] },
};

export function installInput() {
  if (typeof addEventListener !== 'function' || globalThis.__islandCrisisInput) return;
  globalThis.__islandCrisisInput = true;
  addEventListener('keydown', e => {
    if (!watched.has(e.code)) return;
    if (e.code === 'Space') e.preventDefault();
    if (!e.repeat) state.presses.push(e.code);
    state.held.add(e.code);
  });
  addEventListener('keyup', e => state.held.delete(e.code));
  addEventListener('blur', () => { state.held.clear(); state.mouse.down = false; });
  const at = e => {
    state.mouse.u = e.clientX / innerWidth;
    state.mouse.v = e.clientY / innerHeight;
  };
  addEventListener('pointermove', e => { at(e); state.mouse.moved = true; });
  addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    at(e);
    state.mouse.moved = true;
    state.mouse.down = true;
    state.mouse.clicks.push({ u: state.mouse.u, v: state.mouse.v });
  });
  addEventListener('pointerup', e => { if (e.button === 0) state.mouse.down = false; });
}

// One snapshot per sim tick: edges since the last tick, held keys, the pointer
// in stage units.
export function readInput(api) {
  const { width, height } = api.view();
  const m = state.mouse;
  const snap = {
    pressed: new Set(state.presses), held: new Set(state.held),
    mouse: { x: m.u * width, y: m.v * height, moved: m.moved, down: m.down,
      clicks: m.clicks.map(c => ({ x: c.u * width, y: c.v * height })) },
  };
  state.presses.length = 0;
  m.clicks.length = 0;
  m.moved = false;
  return snap;
}
