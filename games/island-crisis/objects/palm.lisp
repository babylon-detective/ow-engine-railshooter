; palm — a jungle palm: a leaning, curved trunk and a crown of drooping
; fronds. Object space: x forward, y up, z to the right; the origin at the
; roots, about 120 tall. The game scales it per tree. Static, so it bakes
; three levels and costs one MODEL op a tick.
def h 110

(grain .25 6 0
  (ink 104 70 44)
  (tube (- 7 (* 2 detail)) 16 10  0 0 0  6 40 0  14 80 2  12 h 0))
(mottle 140 200 70 .5 12 0
  (ink 58 146 58)
  (move 12 h 0
    (radial y 5
      (tube 4 14 3  0 0 0  30 10 0  58 4 0  78 -22 0))))
(ink 120 84 40)
(move 12 (- h 4) 0 (orb 0 0 0 10 6))
