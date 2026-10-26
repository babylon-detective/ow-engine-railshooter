import { emptyPad, stickDirections } from './gamepad.mjs';
import { installControllerSetup, pollControllers, controllerSetupOpen, toggleControllerSetup } from './controller-setup.mjs';

// Keyboard: WASD / arrows move, Space boosts, C brakes, U jumps, Enter
// fires, Q / E or Left / Right Shift turn, IJKL aim, Esc or P pauses.
const keyboard = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight',
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
  Escape: 'Menu', Tab: 'View' };
const aimKeys = { KeyJ: [-1, 0], KeyL: [1, 0], KeyI: [0, 1], KeyK: [0, -1] };
const watched = new Set([...Object.keys(keyboard), ...Object.keys(aimKeys), 'KeyU', 'KeyC', 'KeyP', 'KeyQ', 'KeyE', 'KeyM',
  'KeyG', 'KeyF', 'Space', 'Enter', 'NumpadEnter', 'ShiftLeft', 'ShiftRight']);
const state = {
  held: new Set(), presses: [],
  mouse: { u: .5, v: .5, moved: false, down: false, clicks: [], boosts: 0, boostHeld: false },
};

export function installInput() {
  if (typeof addEventListener !== 'function' || globalThis.__islandCrisisInput) return;
  globalThis.__islandCrisisInput = true;
  installControllerSetup();
  addEventListener('keydown', e => {
    if (!watched.has(e.code)) return;
    if (e.code === 'KeyG' || e.code === 'Escape' && controllerSetupOpen()) {
      if (!e.repeat) toggleControllerSetup();
      return;
    }
    if (controllerSetupOpen() || globalThis.__oskiewarAccountOpen || globalThis.__oskiewarConsoleOpen) return;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) state.presses.push(e.code);
    state.held.add(e.code);
  });
  addEventListener('keyup', e => state.held.delete(e.code));
  addEventListener('blur', () => {
    state.held.clear(); state.presses.length = 0;
    state.mouse.down = false; state.mouse.clicks.length = 0;
    state.mouse.boosts = 0; state.mouse.boostHeld = false;
  });
  const at = e => {
    state.mouse.u = e.clientX / innerWidth;
    state.mouse.v = e.clientY / innerHeight;
  };
  addEventListener('pointermove', e => { at(e); state.mouse.moved = true; });
  addEventListener('contextmenu', e => {
    if (!e.target.closest?.('#ic-controllers, #ic-controller-button')) e.preventDefault();
  });
  addEventListener('pointerdown', e => {
    if (e.target.closest?.('#ic-controllers, #ic-controller-button')) return;
    if (e.button === 2) { state.mouse.boosts++; state.mouse.boostHeld = true; return; }
    if (e.button !== 0) return;
    at(e);
    state.mouse.moved = true;
    state.mouse.down = true;
    state.mouse.clicks.push({ u: state.mouse.u, v: state.mouse.v });
  });
  addEventListener('pointerup', e => {
    if (e.button === 0) state.mouse.down = false;
    if (e.button === 2) state.mouse.boostHeld = false;
  });
}

// One snapshot per sim tick: edges since the last tick, held keys, the pointer
// in stage units.
export function readInput(api) {
  const { width, height } = api.view();
  const m = state.mouse;
  let pad = pollControllers();
  const blocked = !document.hasFocus() || globalThis.__oskiewarAccountOpen || globalThis.__oskiewarConsoleOpen;
  if (blocked) {
    pad = { ...pad, ...emptyPad(), connected: pad.connected };
  } else if (!controllerSetupOpen()) {
    for (const [code, name] of Object.entries(keyboard)) if (state.held.has(code)) pad.down.add(name);
    let ax = 0, ay = 0;
    for (const [code, [x, y]] of Object.entries(aimKeys)) if (state.held.has(code)) { ax += x; ay += y; }
    if (ax || ay) {
      const l = Math.hypot(ax, ay);
      pad = { ...pad, rightX: ax / l, rightY: ay / l };
    }
  }
  const snap = {
    pad, directions: stickDirections(pad), setupOpen: controllerSetupOpen(),
    pressed: new Set(blocked ? [] : state.presses), held: new Set(blocked ? [] : state.held),
    mouse: { x: m.u * width, y: m.v * height, moved: !blocked && m.moved, down: !blocked && m.down,
      clicks: blocked ? [] : m.clicks.map(c => ({ x: c.u * width, y: c.v * height })),
      boost: !blocked && m.boosts > 0, boostHeld: !blocked && m.boostHeld },
  };
  state.presses.length = 0;
  m.clicks.length = 0;
  m.boosts = 0;
  m.moved = false;
  return snap;
}
