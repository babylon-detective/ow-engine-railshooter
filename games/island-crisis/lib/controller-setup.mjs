import { buttonDown, captureBinding, deviceKey, readPads, validProfile } from './gamepad.mjs';

const storageKey = 'island-crisis:controllers:v1';
const steps = [
  ['leftX', 'Move LEFT stick RIGHT'], ['leftY', 'Move LEFT stick UP'],
  ['rightX', 'Move RIGHT stick RIGHT'], ['rightY', 'Move RIGHT stick UP'],
  ['ArrowUp', 'Press d-pad UP'], ['ArrowDown', 'Press d-pad DOWN'],
  ['ArrowLeft', 'Press d-pad LEFT'], ['ArrowRight', 'Press d-pad RIGHT'],
  ['RightShoulder', 'Press R / fire'], ['A', 'Press B / dodge and confirm'],
  ['LeftTrigger', 'Press ZL / camera left'], ['RightTrigger', 'Press ZR / camera right'],
  ['LeftShoulder', 'Press L / dash'], ['View', 'Press Minus / map'],
  ['Menu', 'Press Plus / pause'],
];
let profile = null, panel, status, prompt, next, skip, calibrate;
let raw = [], baseline = [], pending = [], step = -1, armed = false, release = null, error = '';
let accessError = '';

function report(message, cause) {
  error = message;
  console.error(`[Island Crisis controllers] ${message}`, cause);
}

export function installControllerSetup() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      const value = JSON.parse(saved);
      if (!validProfile(value)) throw new Error('Invalid controller bindings');
      profile = value;
    }
  } catch (e) { report('Could not load controller calibration. Calibrate again.', e); }
  const style = document.createElement('style');
  style.textContent = `
    #ic-controller-button { position:fixed; left:12px; bottom:12px; z-index:60; }
    #ic-controllers { position:fixed; inset:8% 5%; margin:auto; max-width:620px;
      max-height:80vh; overflow:auto; z-index:100; padding:24px; color:#fff;
      background:#111827; border:2px solid #ffe478; font:16px/1.5 monospace; cursor:auto; }
    #ic-controllers button, #ic-controller-button { font:14px monospace; padding:8px;
      margin:4px; color:#111827; background:#ffe478; border:0; cursor:pointer; }
    #ic-controllers pre { white-space:pre-wrap; overflow-wrap:anywhere; }
    #ic-controllers button:disabled { opacity:.5; }
  `;
  document.head.append(style);
  const opener = document.createElement('button');
  opener.id = 'ic-controller-button';
  opener.textContent = 'Controllers (G)';
  panel = document.createElement('section');
  panel.id = 'ic-controllers';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Controller setup');
  panel.innerHTML = `<h2>Controllers</h2>
    <p>Focus the game, then press a button on each Joy-Con. Hold both upright.
    If the browser exposes no controllers, calibration cannot access them.
    In Brave, check that fingerprinting protection is not blocking the Gamepad API for localhost.</p>
    <pre data-status aria-live="polite"></pre><p data-prompt aria-live="polite"></p>
    <button data-calibrate>Calibrate / remap</button>
    <button data-next hidden>Ready: sticks centered, buttons released</button>
    <button data-skip hidden>Skip this control</button>
    <button data-reset>Use automatic mapping</button>
    <button data-close>Close</button>`;
  document.body.append(opener, panel);
  status = panel.querySelector('[data-status]');
  prompt = panel.querySelector('[data-prompt]');
  next = panel.querySelector('[data-next]');
  skip = panel.querySelector('[data-skip]');
  calibrate = panel.querySelector('[data-calibrate]');
  opener.onclick = toggleControllerSetup;
  panel.querySelector('[data-close]').onclick = toggleControllerSetup;
  calibrate.onclick = () => { pending = []; step = 0; armed = false; release = null; };
  next.onclick = () => {
    baseline = raw.map(p => ({ device: deviceKey(p), axes: [...p.axes], buttons: p.buttons.map(buttonDown) }));
    armed = true;
  };
  skip.onclick = () => { armed = false; release = null; advance(); };
  panel.querySelector('[data-reset]').onclick = () => {
    profile = null; step = -1; armed = false; release = null;
    try { localStorage.removeItem(storageKey); error = ''; }
    catch (e) { report('Automatic mapping is active, but saved calibration could not be removed.', e); }
  };
}

export const controllerSetupOpen = () => !!panel && !panel.hidden;
export function toggleControllerSetup() {
  panel.hidden = !panel.hidden;
  if (panel.hidden) { step = -1; armed = false; release = null; }
}

function advance() {
  step++;
  if (step < steps.length) return;
  step = -1;
  if (!pending.length) { error = 'Nothing was mapped. Previous controls are unchanged.'; return; }
  profile = pending;
  try { localStorage.setItem(storageKey, JSON.stringify(profile)); error = ''; }
  catch (e) { report('Calibration works for this session but could not be saved.', e); }
}

export function pollControllers() {
  try {
    raw = [...(navigator.getGamepads?.() || [])].filter(p => p && p.connected !== false);
    accessError = navigator.getGamepads ? '' : 'This browser does not provide the Gamepad API.';
  } catch (e) {
    raw = [];
    if (!accessError) console.error('[Island Crisis controllers] Gamepad access blocked by the browser.', e);
    accessError = 'Gamepad access blocked by the browser. Check site permissions.';
  }
  const pad = readPads(raw, profile);
  if (controllerSetupOpen()) {
    if (release) {
      const p = raw.find(p => deviceKey(p) === release.device);
      const neutral = !p || (release.kind === 'button' ? !buttonDown(p.buttons[release.index])
        : Math.abs(p.axes[release.index] - release.center) < .2);
      if (neutral) { release = null; advance(); }
    } else if (armed && step >= 0 && document.hasFocus()) {
      const binding = captureBinding(raw, baseline, steps[step][0]);
      if (binding) { pending.push(binding); release = binding; armed = false; }
    }
    const lines = raw.length ? raw.map(p => `${p.id}\n${p.mapping || 'raw layout'} | axes: ${
      p.axes.map(v => v.toFixed(2)).join(', ')} | buttons: ${
      p.buttons.flatMap((b, i) => buttonDown(b) ? [i] : []).join(', ') || 'none'}`).join('\n\n')
      : 'No controllers exposed. Click the game, then press a button on BOTH Joy-Cons.';
    status.textContent = [accessError, error, lines, pad.unsupported.length ? 'Unmapped controller detected: use Calibrate / remap.' : '',
      profile ? 'Saved custom mapping active.' : 'Automatic mapping: standard pads and upright Chromium Joy-Con pairs.'].filter(Boolean).join('\n\n');
    prompt.textContent = step < 0 ? 'Changes are saved in this browser. Closing cancels unfinished calibration.'
      : release ? 'Release that control to continue.'
        : `${step + 1}/${steps.length}: ${steps[step][1]}. ${armed ? 'Listening...' : 'Center all sticks and release buttons, then click Ready.'}`;
    next.hidden = skip.hidden = step < 0;
    next.disabled = armed || !!release || !raw.length;
    calibrate.disabled = !raw.length;
  }
  pad.status = accessError || error || (pad.unsupported.length ? 'Unmapped controller: open Controllers (G) to calibrate.'
    : pad.connected ? '' : 'No controller detected. Press a button on both Joy-Cons. Controllers: G');
  return pad;
}
