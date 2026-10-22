# showroom — the engine's world, in a hallway

An `own` game that draws in oskiewar's 3D instead of on the flat stage. It
is the worked example for the world calls (GAME-SPEC.md → The world,
Objects, Figures), and the smallest rail shooter in the shape @jeffrey
sketched (2026-10-21): one hallway at a time, gliding toward a closed door;
turn one direction, shoot the big switch on the right wall once, the door
opens and the next hall begins; reach the door closed and you die, and the
run restarts at once. Tap to shoot with a flash, one shot a switch, the
switch flashes red, the lens snaps back to the door.

## What it shows

- `api.camera` on a rail: the lens glides down the hall; E (or a trigger)
  turns it to the right wall and back, so the switch needs a turn to be
  seen and shot.
- `api.face` + `api.shade`: the floor, walls and ceiling, lit by the
  engine's own flat rule.
- `objects/crate.lisp`: a game's own object in the dialect, kept in the
  folder to copy from (`api.object("crate", null, { x, y, z })` draws it;
  the halls are kept clear of props — @jeffrey, 2026-10-22).
- `api.pointer()` aims, `api.cursor("none")` hides the system cursor, a
  press (mouse, finger, Space, J or X) is one shot: screen flash, a loud
  drum, the switch flashes red and the door lifts.

## Controls

- Mouse / finger / right stick: aim
- Click / tap / Space / J / X / A: shoot (tap, not hold)
- E or Q / a trigger or shoulder: turn to the right wall, and back
- Death restarts on its own
