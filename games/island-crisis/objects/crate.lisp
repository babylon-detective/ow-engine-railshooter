; crate — a hangar crate, flat and inked, with two straps. After the
; showroom's crate. x forward, y up, z right; the origin on the floor under
; it, 120 across at scale 1.
def half 60
def edge 2

(ink 150 118 80)
(outline edge 70 42 22 (slab (- half) 0 (- half) half (* half 2) half))
(ink 96 64 40)
(nudge -.6
  (slab (- half) 30 (- half) half 42 half)
  (slab (- half) 78 (- half) half 90 half))
