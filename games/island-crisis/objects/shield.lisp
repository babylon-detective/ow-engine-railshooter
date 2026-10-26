; shield — the hangar's big target: an armoured plate the size of a screen
; panel framed by two posts and a lintel, a dark face panel, and a glowing
; core that pulses with `time` and flares when it is about to fire
; (`turbo`). `hurt` flashes it all red. Plate colour in the `def`s. Every
; layer stands clear of the one behind it (a world face carries one
; depth). x toward the runner, y up, z across; the origin at its middle.
def cr 236
def cg 96
def cb 52

(ink (mix cr 255 hurt) (mix cg 40 hurt) (mix cb 40 hurt))
(outline 3 40 20 16 (slab -34 -250 -380 34 250 380))
(ink (mix 83 170 hurt) (mix 34 24 hurt) (mix 18 24 hurt))
(outline 3 20 12 10
  (slab -60 -280 -440 40 280 -360)
  (slab -60 -280 360 40 280 440)
  (slab -56 280 -440 36 306 440))
(nudge -2 (slab 36 -200 -330 44 200 330))
(let pulse (+ 150 (* 100 (abs (sin (* time 4.8))))))
(let hot (max turbo hurt))
(glow
  (ink 255 (mix pulse 255 hot) (mix 90 (mix 200 255 hurt) hot))
  (move 76 0 0 (revolve x  0 -40  90 0  0 40)))
