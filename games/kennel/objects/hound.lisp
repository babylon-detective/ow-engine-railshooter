; hound — a four-legged walker, gait and all, in the dialect. No keyframes.
;
; The game moves the dog's place and tells it `distance` (units walked),
; `speed`, `turbo` (excited: tail going, ears up) and where to look, as
; `(owner look x|y|z)` in the dog's own space. Everything else is arithmetic.
; Object space: x forward, y up, z to the right; the origin on the ground
; under the chest. A dog is about 100 long and 60 at the shoulder.
;
; The trot: each foot's phase runs with distance. For the first `duty` of
; it the foot is planted and slides back under the body; for the rest it
; lifts and swings forward. Diagonal legs share a phase. At a standstill
; nothing moves, and the lift fades out as the dog slows.
;
; the numbers: how far a step carries, the share of it a foot stays
; planted, how high a swinging foot lifts
def stride 36
def duty .6
def lift 12
(let go (min 1 (/ speed 60)))
(let bob (* go 1.5 (sin (* (/ distance stride) tau))))

; where the head looks: the game's point, or straight ahead when none
(let lx (owner look x))
(let ly (owner look y))
(let lz (owner look z))
(let none (and (= lx 0) (= lz 0)))
(let tx (- (mix lx 140 none) 46))
(let ty (- (mix ly 64 none) 66))
(let tz (mix lz 0 none))
(let yaw (clamp (atan tz tx) -1.1 1.1))
(let pit (clamp (atan ty (sqrt (+ (* tx tx) (* tz tz)))) -.5 .6))
(let hx (+ 46 (* 15 (cos pit) (cos yaw))))
(let hy (+ 66 bob (* 15 (sin pit))))
(let hz (* 15 (cos pit) (sin yaw)))
(let nx (+ hx (* 19 (cos pit) (cos yaw))))
(let ny (+ hy (* 19 (sin pit))))
(let nz (+ hz (* 19 (cos pit) (sin yaw))))

; one grain scope round the whole body puts fur noise on every face.
; body: chest to pelvis, and the neck up to the head
(grain .12 6 0
  (ink 196 150 96)
  (capsule 30 (+ 52 bob) 0  -30 (+ 50 bob) 0  30 8)
  (capsule 34 (+ 58 bob) 0  hx hy hz  16 6)
  (orb hx hy hz 12 8)
  ; muzzle and nose, eyes
  (ink 120 86 56)
  (capsule hx hy hz  nx ny nz  11 6)
  (ink 20 16 18)
  (orb nx ny nz 4 6)
  (orb (+ hx 7) (+ hy 4) (+ hz 6) 2.5 5)
  (orb (+ hx 7) (+ hy 4) (- hz 6) 2.5 5)
  ; ears, up when excited, flopped when not
  (ink 120 86 56)
  (capsule (- hx 3) (+ hy 8) (+ hz 7)  (- hx 9) (+ hy (mix 11 21 turbo)) (+ hz (mix 13 10 turbo))  5 5)
  (capsule (- hx 3) (+ hy 8) (- hz 7)  (- hx 9) (+ hy (mix 11 21 turbo)) (- hz (mix 13 10 turbo))  5 5)
  ; tail: wagging, faster and higher when excited
  (let wag (sin (* time (mix 5 22 turbo))))
  (ink 196 150 96)
  (capsule -32 (+ 54 bob) 0  -48 (+ (mix 56 64 turbo) bob) (* wag 7)  7 5)
  (capsule -48 (+ (mix 56 64 turbo) bob) (* wag 7)  -60 (+ (mix 54 72 turbo) bob) (* wag 14)  5 5)
  ; four legs: k 0 front-left, 1 front-right, 2 rear-left, 3 rear-right.
  ; Front and rear legs trot in diagonal pairs.
  (repeat 4 k
    (let front (< k 2))
    (let off (mix 0 .5 (% (+ k (floor (/ k 2))) 2)))
    (let ph (% (+ (* distance (/ duty stride)) off) 1))
    (let st (< ph duty))
    (let back (mix (* stride .5) (* stride -.5) (/ ph duty)))
    (let swing (/ (- ph duty) (- 1 duty)))
    (let fx (mix (mix (* stride -.5) (* stride .5) swing) back st))
    (let fy (* lift go (- 1 st) (sin (* pi (max 0 swing)))))
    (move (mix -28 26 front) (+ (mix 46 48 front) bob) (mix -12 12 (% k 2))
      (ink 196 150 96)
      (bend 0 0 0  fx (- fy (+ (mix 46 48 front) bob)) 0  26 25  -30 -24 0  9 6)
      (ink 120 86 56)
      (orb fx (- (+ fy 4) (+ (mix 46 48 front) bob)) 0 5 6))))
