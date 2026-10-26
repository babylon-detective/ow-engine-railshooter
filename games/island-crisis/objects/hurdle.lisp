; hurdle — a low barrier across the hallway, 70 high, in yellow and black
; caution stripes: jump it. x along the hall, y up, z across; the origin on
; the floor at its middle.
(outline 1.5 30 24 10
  (repeat 11 k
    (let z0 (+ -440 (* k 80)))
    (let dark (% k 2))
    (ink (mix 236 40 dark) (mix 170 42 dark) (mix 40 54 dark))
    (slab -25 0 z0 25 70 (+ z0 80))))
