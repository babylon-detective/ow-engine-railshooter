; crate — a drawn box of the game's own, in the engine's flat style:
; fills with ink edges, no lighting. Object space: x forward, y up, z to
; the right; the origin on the floor under the crate. `time` makes the
; lid breathe, so a per-tick input is shown beside the baked box.
def half 26
def edge 1.4

(ink 184 132 72)
(outline edge 70 42 22
  (slab (- half) 0 (- half) half (* half 2) half))
; two straps round it
(ink 96 64 40)
(nudge -.4
  (slab (- half) 14 (- half) half 20 half)
  (slab (- half) 34 (- half) half 40 half))
; the lid, lifted a touch and settling
(let lift (* 3 (+ 1 (sin (* time 2.4)))))
(move 0 (+ (* half 2) lift) 0
  (ink 204 152 90)
  (outline edge 70 42 22 (slab (- half) 0 (- half) half 5 half)))
