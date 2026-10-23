# showroom — the engine's world, in a hallway

An `own` game that draws in oskiewar's 3D instead of on the flat stage. It
is the worked example for the world calls (GAME-SPEC.md → The world,
Objects, Figures), and the smallest rail shooter in the shape @jeffrey
sketched (2026-10-21/22): one hallway at a time, gliding toward a closed
door with a switch set into it; one tap at the switch and the door lifts
and the next hall begins; reach the door closed and you die, and the run
restarts at once. One button. The switch is a small region of the door,
somewhere else each time and shrinking, so from the far end it is a few
pixels and the shot only becomes makeable as you close in; the halls are
short, so the doors come one after another — an aim-practice map. Tap to
shoot with a flash; the switch flashes red.

## What it shows

- `api.camera` on a rail: the lens glides down the hall toward the door.
- `api.face` + `api.shade`: the floor, walls and ceiling, lit by the
  engine's own flat rule.
- `objects/crate.lisp`: a game's own object in the dialect, kept in the
  folder to copy from (`api.object("crate", null, { x, y, z })` draws it;
  the halls are kept clear of props — @jeffrey, 2026-10-22).
- `objects/boulder.lisp` and `objects/sapling.lisp` (engine 453): the
  curves and procedural surfaces — a roughed, grained, mossy rock from one
  `revolve`, and a tree of tapered `tube`s with a mottled canopy. Copy from
  these for set pieces; they bake three levels and cost one MODEL op a tick.
- `api.pointer()` aims, `api.cursor("none")` hides the system cursor, a
  press (mouse, finger, Space, J or X) is one shot: screen flash, a loud
  drum, the switch flashes red and the door lifts with the switch in it.
- The door is cut around the switch and the switch is a ring around its
  disc, because a world face carries one depth (see the spec).

## Controls

- Mouse / finger / right stick: aim
- Click / tap / Space / J / X / A: shoot (tap, not hold)
- Death restarts on its own
