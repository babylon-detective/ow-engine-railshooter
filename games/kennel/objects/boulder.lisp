; boulder — a rock of the game's own, from one revolve: roughed by noise so
; it is lumpy, grained so the stone is faceted, with moss blended over it.
; Object space: x forward, y up, z to the right; the origin on the ground
; under it. `grain` reads `detail` through its splits, so it bakes three
; levels: cut finer up close, plain far away. Nothing moves per tick, so a
; tick is one MODEL op.
def r 34
def h 30

(rough 4 11
  (grain .35 9 (- 1 (min 1 detail))
    (ink 118 108 96)
    (mottle 74 122 52 .9 14
      (revolve y  0 0  (* r .8) 2  r (* h .45)  (* r .7) (* h .85)  (* r .3) h  0 h))))
