; switch — a wall switch: a dark plate, a lamp-button and a yellow tag
; under it. `turbo` is 1 once it is hit (green); `hurt` is the off-beat of
; its blink while it waits (red, then pink). x out of the wall, y up,
; z across; the origin on the wall at the button's middle.
(ink 40 42 54)
(outline 2 20 20 28 (slab 0 -86 -86 16 86 86))
(glow
  (ink (mix (mix 255 255 hurt) 90 turbo) (mix (mix 60 150 hurt) 255 turbo) (mix (mix 60 130 hurt) 140 turbo))
  (slab 16 -54 -54 40 54 54))
(ink 236 190 40)
(slab 0 -126 -70 12 -98 70)
