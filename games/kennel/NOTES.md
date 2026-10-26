# kennel — two hounds, one dialect object

An `own` game that shows a rig written in the object dialect (engine 454):
`objects/hound.lisp` is a four-legged walker — trot, head, ears, tail, paws —
in one file with no keyframes. The game only moves each dog's place and
hands the object `distance`, `speed`, `turbo` (excited) and a point to look
at, `(owner look x|y|z)`, in the dog's own space.

## What happens

One dog roams a loop of waypoints, the other chases it. Inside 118 units
they stop, turn nose to nose, tails going, ears up, for about three
seconds, then swap roles and the new roamer heads for the farthest
waypoint. The camera orbits the pair.

## What it shows

- `bend`: a leg is one `bend` from hip to foot (26 and 25 long, the joint
  hinted backward), and a foot is where the gait's arithmetic puts it.
- The trot: each foot's phase `(% (+ (* distance (/ duty stride)) off) 1)`,
  planted and sliding back for `duty` of it, swung forward with a lift
  after. Diagonal legs share a phase. The lift fades with speed, so a
  standing dog stands.
- `orb` for the head, eyes, nose and paws; `capsule` for the body, neck,
  muzzle, ears and tail; `grain` over the coat.
- `api.defineObject`: the grey dog is the same source with its inks
  swapped, defined at boot.
- The props are `boulder.lisp` and `sapling.lisp` from the showroom.

## Controls

None. It is a diorama.
