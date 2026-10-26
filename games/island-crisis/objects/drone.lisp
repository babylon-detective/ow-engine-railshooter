; drone — the hallway and island flyer: a spinning top with a dark cap, a
; wing bar, and a lamp under it. Its body colour is the three `def`s, so the
; game defines a recoloured copy per biome. `hurt` flashes it red, `turbo`
; white (a hit, and the frames before it bursts). x toward the runner, y up,
; z right; the origin at its middle.
def cr 235
def cg 96
def cb 52

(rotate y (* time 4.8)
  (ink (mix (mix cr 255 turbo) 255 hurt) (mix (mix cg 255 turbo) 40 hurt) (mix (mix cb 255 turbo) 40 hurt))
  (revolve y  0 -40  96 0  0 40)
  (ink (mix 82 170 hurt) (mix 34 24 hurt) (mix 18 24 hurt))
  (move 0 24 0 (revolve y  0 0  38 0  0 50))
  (capsule 0 -9 -140  0 -9 140  14 4))
(glow
  (ink 255 255 190)
  (orb 0 -46 0 14 6))
