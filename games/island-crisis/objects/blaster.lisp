; blaster — the runner's gun, flat and inked: a grip in the fist, a body,
; a long barrel and a cyan sight; `turbo` lights the muzzle for the frames
; after a shot. x along the barrel, y up, z right; the origin in the fist.
(ink 34 36 48)
(outline 1.2 10 10 14
  (rotate z -.3 (slab -4 -18 -3.5 5 0 3.5))
  (slab -10 0 -5 26 12 5))
(ink 70 76 92)
(outline 1.2 10 10 14 (move 41 6 0 (drum x 4 30)))
(ink 90 240 255)
(slab 4 12 -1.5 14 15 1.5)
(if turbo
  (glow
    (ink 255 255 220)
    (ball 62 6 0 9)))
