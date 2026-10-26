; snowrock — a mountain boulder, grey stone with snow lying on it.
; Object space: x forward, y up, z right; origin on the ground, ~80 across.
def r 40
def h 30

(rough 5 12
  (grain .25 9 0
    (ink 120 120 132)
    (mottle 244 248 255 .85 16 0
      (revolve y  0 0  (* r .8) 2  r (* h .45)  (* r .7) (* h .85)  (* r .3) h  0 h))))
