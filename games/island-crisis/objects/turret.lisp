; turret — a ground gun, flat and inked: a grey base, a coloured head and a
; barrel. The game turns it to face the runner and hands it `pitch`, the
; barrel's climb in radians. Head colour in the `def`s for per-biome copies;
; `hurt` red, `turbo` white. x toward the runner, y up, z right; the origin
; on the ground under it.
def cr 235
def cg 96
def cb 52

(ink (mix (mix 70 255 turbo) 255 hurt) (mix (mix 70 255 turbo) 40 hurt) (mix (mix 80 255 turbo) 40 hurt))
(outline 2 30 30 36 (slab -74 0 -74 74 84 74))
(ink (mix (mix cr 255 turbo) 255 hurt) (mix (mix cg 255 turbo) 40 hurt) (mix (mix cb 255 turbo) 40 hurt))
(outline 2 30 30 36 (slab -48 84 -48 48 152 48))
(move 0 118 0
  (rotate z pitch
    (ink 40 40 48)
    (outline 1.5 16 16 20 (slab 40 -13 -13 150 13 13))))
