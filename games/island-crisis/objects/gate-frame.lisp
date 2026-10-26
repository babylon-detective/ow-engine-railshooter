; gate-frame — a hallway door's frame, flat and inked: two posts against
; the walls and a lintel, with the lamp over the door, red while the door
; is shut and green once its switch is hit (`turbo`). x along the hall,
; y up, z across it; the origin on the floor in the doorway's middle.
(ink 60 64 80)
(outline 2 30 32 42
  (slab -40 0 -440 40 640 -380)
  (slab -40 0 380 40 640 440)
  (slab -40 580 -380 40 640 380))
(glow
  (ink (mix 255 90 turbo) (mix 60 255 turbo) (mix 60 140 turbo))
  (slab -50 594 -60 -44 626 60))
