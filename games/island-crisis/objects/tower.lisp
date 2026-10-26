; tower — an urban block in the engine's flat style: storeys of wall and
; lit window bands stacked (cut, not overlaid, because a world face carries
; one depth), a plant room on the roof and a red mast light. Object space:
; x forward, y up, z right; the origin at the foot, 200 wide and 600 tall
; at scale 1.
def w 100
def storey 60

(repeat 10 k
  (let y0 (* k storey))
  (ink 150 152 168)
  (outline 1.5 70 72 86 (slab (- w) y0 (- w) w (+ y0 40) w))
  (ink 236 222 150)
  (outline 1.5 70 72 86 (slab (- w) (+ y0 40) (- w) w (+ y0 storey) w)))
(ink 70 74 86)
(outline 2 30 32 40 (slab -45 600 -45 45 660 45))
(ink 230 60 60)
(slab -3 660 -3 3 760 3)
