; charger — a spike that hangs, then rams: a long double cone along its
; flight with a dark fin across it. Body colour in the `def`s for per-biome
; copies; `hurt` red, `turbo` white (it flickers white before it charges).
; x along its flight, y up, z right; the origin at its middle.
def cr 235
def cg 96
def cb 52

(ink (mix (mix cr 255 turbo) 255 hurt) (mix (mix cg 240 turbo) 40 hurt) (mix (mix cb 200 turbo) 40 hurt))
(revolve x  0 -130  45 0  0 130)
(ink (mix 82 170 hurt) (mix 34 24 hurt) (mix 18 24 hurt))
(capsule -56 0 -100  -56 0 100  14 4)
