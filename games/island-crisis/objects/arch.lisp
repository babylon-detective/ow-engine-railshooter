; arch — a rock arch over a cave rail: two bowed columns and a lintel, all
; tubes, roughed and grained; stalactites hang from it and two crystals
; glow at its feet. Object space: x along the rail, y up, z to the rail's
; right; the origin on the rail.
(rough 12 50
  (grain .25 26 0
    (ink 78 62 82)
    (tube 6 120 100  0 0 -600  0 400 -620  0 780 -560)
    (tube 6 120 100  0 0 600  0 400 620  0 780 560)
    (tube 6 110 110  0 760 -620  0 810 0  0 760 620)))
(ink 96 78 104)
(repeat 4 k
  (move 0 720 (+ -420 (* k 260)) (revolve y  0 0  30 0  0 -100)))
(glow
  (ink 100 245 230)
  (move 0 90 -520 (revolve y  0 -60  22 0  0 60))
  (ink 180 120 255)
  (move 0 90 520 (revolve y  0 -60  22 0  0 60)))
