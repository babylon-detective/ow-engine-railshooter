; sapling — a young tree: a tapered trunk that leans, two branches, and a
; canopy of three lumpy, mottled blobs. The trunk and branches are tubes:
; each is a few points, smoothed into a curve, ringed and capped for you.
; Object space: x forward, y up, z to the right; the origin at the roots.
; The tubes take their sides from `detail`, so the tree bakes three levels
; (the noise scopes are told 0 splits: the facets already carry the grain).
; Static, so the whole tree bakes and a tick is one MODEL op; a `let` of
; `time` in the trunk's points would make it sway, at the cost of its faces
; every tick.
def trunk 90

(grain .3 7 0
  (ink 96 66 40)
  (tube (- 8 (* 2 detail)) 11 4  0 0 0  2 30 1  6 60 -1  9 trunk 0)
  (ink 88 60 36)
  (tube (- 5 detail) 4 2  4 44 0  22 62 10  34 76 14)
  (tube (- 5 detail) 4 2  5 52 -1  -14 68 -9  -22 84 -6))
(mottle 150 190 60 .8 10 0
  (ink 58 112 48)
  (move 9 trunk 0 (rough 3 8 (revolve y  0 -8  22 -4  30 8  26 20  12 28  0 30)))
  (move 30 78 14 (rough 2 6 (revolve y  0 -5  14 -2  16 6  10 12  0 14)))
  (move -20 86 -6 (rough 2 6 (revolve y  0 -5  12 -2  14 6  9 11  0 13))))
