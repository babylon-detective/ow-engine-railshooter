import { emptyPad, stickDirections } from './gamepad.mjs';
import { installControllerSetup, pollControllers, controllerSetupOpen, toggleControllerSetup } from './controller-setup.mjs';

const keyboard = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight',
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
  KeyI: 'Y', Escape: 'Menu', Tab: 'View' };
const watched = new Set([...Object.keys(keyboard), 'KeyJ', 'KeyK', 'KeyL', 'KeyQ', 'KeyE', 'KeyM',
  'KeyG', 'KeyF', 'Space', 'Enter', 'NumpadEnter', 'ShiftLeft', 'ShiftRight']);
const state = {
  held: new Set(), presses: [],
  mouse: { u: .5, v: .5, moved: false, down: false, clicks: [] },
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
  });
  const at = e => {
    state.mouse.u = e.clientX / innerWidth;
    state.mouse.v = e.clientY / innerHeight;
  };
  addEventListener('pointermove', e => { at(e); state.mouse.moved = true; });
  addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (e.target.closest?.('#ic-controllers, #ic-controller-button')) return;
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
  let pad = pollControllers();
  const blocked = !document.hasFocus() || globalThis.__oskiewarAccountOpen || globalThis.__oskiewarConsoleOpen;
  if (blocked) {
    pad = { ...pad, ...emptyPad(), connected: pad.connected };
  } else if (!controllerSetupOpen()) {
    for (const [code, name] of Object.entries(keyboard)) if (state.held.has(code)) pad.down.add(name);
    const punch = state.held.has('KeyJ'), kick = state.held.has('KeyK');
    if (punch) pad.down.add('X');
    if (kick) pad.down.add('A');
    if (state.held.has('KeyL')) { pad.down.add('A'); pad.down.add('X'); }
  }
  const snap = {
    pad, directions: stickDirections(pad), setupOpen: controllerSetupOpen(),
    pressed: new Set(blocked ? [] : state.presses), held: new Set(blocked ? [] : state.held),
    mouse: { x: m.u * width, y: m.v * height, moved: !blocked && m.moved, down: !blocked && m.down,
      clicks: blocked ? [] : m.clicks.map(c => ({ x: c.u * width, y: c.v * height })) },
  };
  state.presses.length = 0;
  m.clicks.length = 0;
  m.moved = false;
  return snap;
}
