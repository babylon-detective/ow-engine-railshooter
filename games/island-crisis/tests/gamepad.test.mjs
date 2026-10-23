import { automaticPad, captureBinding, deviceKey, readPads, stickDirections, validProfile } from '../lib/gamepad.mjs';

let count = 0;
const check = (condition, message) => { if (!condition) throw new Error(message); count++; };
const pad = (id, mapping = 'standard', index = 0) => ({
  id, mapping, index, connected: true, axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
const press = (p, ...indices) => indices.forEach(i => { p.buttons[i] = { pressed: true, value: 1 }; });

const standard = pad('Xbox', 'standard', 5);
press(standard, 6, 7);
let result = readPads([null, standard]);
check(result.down.has('LeftTrigger') && result.down.has('RightTrigger'), 'Triggers survive sparse controller indices');
check(!result.down.has('A') && !result.down.has('X'), 'Camera triggers do not also roll or shoot');
standard.axes = [.1, -.1, .1, -.1];
check(readPads([standard]).leftX === 0 && readPads([standard]).rightY === 0, 'Stick drift is filtered');
standard.axes = [.7, -1, 1, 1];
result = readPads([standard]);
check(result.leftX > 0 && result.leftY === 1 && result.rightX === 1 && result.rightY === -1, 'Standard axis signs');
check(stickDirections(result).has('ArrowUp'), 'Analog stick can navigate menus and trigger dash edges');

const left = pad('Joy-Con (L)', 'standard', 6), right = pad('Joy-Con (R)', 'standard', 2);
left.axes = [-1, -1, 0, 0];
right.axes = [1, 1, 0, 0];
press(left, 2, 6, 8, 9);
press(right, 7, 8, 9);
result = readPads([right, null, left]);
check(result.leftX === 1 && result.leftY === 1, 'Upright left Joy-Con axes undo sideways rotation');
check(result.rightX === 1 && result.rightY === 1, 'Upright right Joy-Con supplies aim, not movement');
for (const name of ['ArrowUp', 'LeftTrigger', 'RightTrigger', 'LeftShoulder', 'RightShoulder', 'View', 'Menu'])
  check(result.down.has(name), `Paired Joy-Con ${name}`);
check(!result.down.has('A') && !result.down.has('X'), 'Pair does not inherit engine shoulder aliases');
right.connected = false;
check(readPads([left, right]).rightX === 0, 'Disconnected right controller releases aim and buttons');
check(readPads([]).down.size === 0 && !readPads([]).connected, 'Unplugging clears controls');

const raw = pad('Nintendo raw left', '', 9);
check(automaticPad(raw) === null && readPads([raw]).unsupported.length === 1, 'Unknown raw layouts require calibration, not guesses');
const rest = [{ device: deviceKey(raw), axes: [...raw.axes], buttons: raw.buttons.map(b => b.pressed) }];
raw.axes[3] = -.9;
const move = captureBinding([raw], rest, 'leftX');
check(move.index === 3 && move.sign === -1 && move.center === 0, 'Calibration captures arbitrary inverted axis');
raw.axes[3] = 0;
press(raw, 11);
const fire = captureBinding([raw], rest, 'RightShoulder');
check(fire.index === 11 && fire.kind === 'button', 'Calibration captures arbitrary button');
check(validProfile([move, fire]) && !validProfile([{ action: 'invalid' }]), 'Saved profile validation');
raw.axes[3] = -1;
raw.index = 1;
result = readPads([raw], [move, fire]);
check(result.leftX === 1 && result.down.has('RightShoulder'), 'Custom bindings survive changed browser index');
check(result.unsupported.length === 0, 'Calibrated raw controller is recognized');
raw.buttons[11].pressed = false; raw.buttons[11].value = 0; raw.axes[3] = 0;
check(readPads([raw], [move, fire]).down.size === 0, 'Release propagates through custom mapping');
raw.axes[3] = -1;
const direction = captureBinding([raw], rest, 'ArrowRight');
check(readPads([raw], [direction]).down.has('ArrowRight'), 'Axis-based d-pad mapping');
console.log(`Gamepad tests: ${count} assertions passed`);
