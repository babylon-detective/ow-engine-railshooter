; gunship — the island's boss: a hull, a wing across it, two engine pods
; with flames under them, a cockpit cone and a pulsing gun orb under the
; nose. `hurt` red, `turbo` white. x forward, y up, z right; the origin at
; its middle.
(ink (mix (mix 220 255 turbo) 255 hurt) (mix (mix 70 255 turbo) 40 hurt) (mix (mix 160 255 turbo) 40 hurt))
(outline 3 60 20 50 (slab -320 -78 -170 320 78 170))
(ink 80 26 60)
(outline 2 40 14 30 (slab -168 -28 -500 84 0 -170) (slab -168 -28 170 84 0 500))
(ink 80 80 96)
(outline 2 30 30 36
  (slab -140 -126 418 56 14 502)
  (slab -140 -126 -502 56 14 -418))
(ink 80 26 60)
(move 56 78 0 (revolve y  0 0  98 0  0 84))
(let pulse (+ 150 (* 100 (abs (sin (* time 6))))))
(glow
  (ink 255 (mix pulse 255 (max turbo hurt)) 120)
  (move 210 -84 0 (orb 0 0 0 64 8))
  (ink 255 170 80)
  (orb -42 -150 460 30 6)
  (orb -42 -150 -460 30 6))
