const buttons = ['A', 'B', 'X', 'Y', 'LeftShoulder', 'RightShoulder',
  'LeftTrigger', 'RightTrigger', 'View', 'Menu', 'LeftStick', 'RightStick',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
export const axes = ['leftX', 'leftY', 'rightX', 'rightY'];
export const actions = [...axes, ...buttons];
export const emptyPad = () => ({ down: new Set(), leftX: 0, leftY: 0, rightX: 0, rightY: 0, connected: false });
export const deviceKey = p => `${p.id}|${p.mapping}|${p.axes.length}|${p.buttons.length}`;
export const buttonDown = b => !!b && (b.pressed || b.value > .5);
const limit = n => Math.max(-1, Math.min(1, Number.isFinite(n) ? n : 0));
export const deadzone = n => Math.abs(n) <= .18 ? 0 : limit(Math.sign(n) * (Math.abs(limit(n)) - .18) / .82);

function sideOf(p) {
  if (/Joy-Con.*\(L\)/i.test(p.id)) return 'left';
  if (/Joy-Con.*\(R\)/i.test(p.id)) return 'right';
  return null;
}

export function automaticPad(p) {
  if (p.mapping !== 'standard') return null;
  const out = emptyPad(), side = sideOf(p);
  out.connected = true;
  if (!side) {
    buttons.forEach((name, i) => { if (buttonDown(p.buttons[i])) out.down.add(name); });
    [out.leftX, out.leftY, out.rightX, out.rightY] =
      [p.axes[0] || 0, -(p.axes[1] || 0), p.axes[2] || 0, -(p.axes[3] || 0)].map(deadzone);
    return out;
  }
  // Chromium presents individual Joy-Cons sideways. Undo that rotation for
  // an upright pair, including the SL/SR and Select shoulder remapping.
  const names = side === 'left'
    ? { 0: 'ArrowLeft', 1: 'ArrowDown', 2: 'ArrowUp', 3: 'ArrowRight',
      6: 'LeftTrigger', 8: 'LeftShoulder', 9: 'View', 10: 'LeftStick' }
    : { 0: 'B', 1: 'Y', 2: 'A', 3: 'X',
      7: 'RightTrigger', 8: 'RightShoulder', 9: 'Menu', 10: 'RightStick' };
  for (const [i, name] of Object.entries(names)) if (buttonDown(p.buttons[i])) out.down.add(name);
  if (side === 'left') {
    out.leftX = deadzone(-(p.axes[1] || 0));
    out.leftY = deadzone(-(p.axes[0] || 0));
  } else {
    out.rightX = deadzone(p.axes[1] || 0);
    out.rightY = deadzone(p.axes[0] || 0);
  }
  return out;
}

export function validProfile(profile) {
  return Array.isArray(profile) && profile.length > 0 && profile.every(b =>
    b && actions.includes(b.action) && typeof b.device === 'string' &&
    Number.isInteger(b.index) && b.index >= 0 &&
    (b.kind === 'button' && !axes.includes(b.action) ||
      b.kind === 'axis' && [-1, 1].includes(b.sign) && Number.isFinite(b.center)));
}

function merge(out, pad) {
  for (const name of pad.down) out.down.add(name);
  for (const name of axes) if (Math.abs(pad[name]) > Math.abs(out[name])) out[name] = pad[name];
  out.connected ||= pad.connected;
}

export function readPads(raw, profile = null) {
  const out = emptyPad(), live = raw.filter(p => p && p.connected !== false);
  out.unsupported = [];
  for (const p of live) {
    const bindings = profile?.filter(b => b.device === deviceKey(p));
    if (bindings?.length) {
      out.connected = true;
      for (const b of bindings) {
        if (b.kind === 'button') {
          if (buttonDown(p.buttons[b.index])) out.down.add(b.action);
        } else {
          const value = Number.isFinite(p.axes[b.index]) ? limit((p.axes[b.index] - b.center) * b.sign) : 0;
          if (axes.includes(b.action)) {
            if (Math.abs(deadzone(value)) > Math.abs(out[b.action])) out[b.action] = deadzone(value);
          } else if (value > .55) out.down.add(b.action);
        }
      }
    } else {
      const mapped = automaticPad(p);
      if (mapped) merge(out, mapped);
      else out.unsupported.push(p.id);
    }
  }
  return out;
}

export function stickDirections(pad) {
  const down = new Set();
  if (pad.leftX > .5) down.add('ArrowRight');
  if (pad.leftX < -.5) down.add('ArrowLeft');
  if (pad.leftY > .5) down.add('ArrowUp');
  if (pad.leftY < -.5) down.add('ArrowDown');
  return down;
}

export function captureBinding(raw, baseline, action) {
  for (const p of raw) {
    const rest = baseline.find(r => r.device === deviceKey(p));
    if (!rest) continue;
    if (!axes.includes(action)) {
      const index = p.buttons.findIndex((b, i) => buttonDown(b) && !rest.buttons[i]);
      if (index >= 0) return { action, device: rest.device, kind: 'button', index };
    }
    const index = p.axes.findIndex((v, i) => Number.isFinite(rest.axes[i]) && Math.abs(v - rest.axes[i]) > .65);
    if (index >= 0) return { action, device: rest.device, kind: 'axis', index,
      sign: Math.sign(p.axes[index] - rest.axes[index]), center: rest.axes[index] };
  }
  return null;
}
