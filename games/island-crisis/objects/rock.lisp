; rock — a desert stone from one revolve: roughed lumpy, grained into
; facets (no splits: the facets carry the grain, and a split is 4× the
; faces). Object space: x forward, y up, z right; the origin on the ground,
; about 80 across at scale 1. After the showroom's boulder.
def r 40
def h 34

(rough 5 12
  (grain .3 9 0
    (ink 176 140 100)
    (revolve y  0 0  (* r .8) 2  r (* h .45)  (* r .7) (* h .85)  (* r .3) h  0 h)))
