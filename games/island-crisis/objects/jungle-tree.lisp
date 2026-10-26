; jungle-tree — a broadleaf: a short trunk under two lumpy, mossy canopy
; tiers. Object space: x forward, y up, z right; the origin at the roots,
; about 230 tall at scale 1. Static: it bakes and draws as one MODEL op.
def th 110

(grain .25 7 0
  (ink 104 70 44)
  (tube (- 7 (* 2 detail)) 20 12  0 0 0  2 (* th .45) 0  0 (* th .8) 0))
(mottle 120 190 70 .6 14 0
  (ink 40 128 54)
  (move 0 (* th .7) 0 (rough 6 14 (revolve y  0 0  80 6  62 50  30 92  0 104)))
  (ink 52 148 62)
  (move 0 (* th 1.3) 0 (rough 4 10 (revolve y  0 0  56 4  40 40  0 76))))
