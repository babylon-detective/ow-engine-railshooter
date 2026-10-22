# island-crisis — a 3D rail shooter

**Game type:** Own mode (all custom)  
**Players:** 1 (keyboard + mouse or gamepad)  
**Setting:** Five-biome island (jungle, desert, urban, cave, mountain top) connected by rail network

## Gameplay

A high-speed rail-shooter in the style of Sin & Punishment and Panzer Dragoon Orta:

- **Rail running:** Follow a carved rail network across a procedural island with five distinct biomes
- **Full-screen aiming:** Cross-reticle tracks enemies and locks onto the nearest threat
- **Camera cycling:** Four viewpoints (front/right/back/left) rotated with Q/E or shoulder triggers
- **Map mode (M):** Zoom out to a top-down view of rail branches and choose your next path
- **Combat:** Enemies spawn in waves; dodge with Space or dpad; fire with J or right shoulder
- **Aerial movement:** Jump/dodge sideways and up to avoid incoming fire
- **Scoring:** Kill count, health pickups from biome transitions, boss encounters

## Controls

- **WASD / DPad:** Move player left/right/up/down
- **Mouse / Right Stick:** Aim the reticle
- **J / Right Shoulder:** Fire
- **Q / Left Trigger:** Turn camera left
- **E / Right Trigger:** Turn camera right
- **Space:** Dodge (jump sideways or up)
- **M / View Button:** Open/close map

## Design

- Soft-colored low-poly 3D world, drawn with triangles only
- Procedurally generated terrain with noise-based biome distribution
- Rail network carves canyons and paths through the landscape
- Decorative scenery: trees, buildings, rock formations, stalactites
- Enemies: drones (projectile), chargers (melee), turrets (fixed), gunships (boss)
- Particles and sparks for combat feedback
- Smooth camera control with pitch adjustment to avoid collision
- Fog and sky gradient blend by biome

## Files

- `game.mjs` — Main loop, state, rail traversal, camera, input
- `lib/util.mjs` — Math utilities, noise, RNG
- `lib/mesh.mjs` — Low-poly mesh builders, lighting
- `lib/render.mjs` — Software 3D: camera, near-plane clipping, painter's sort
- `lib/world.mjs` — Island generation, rail network, terrain, scenery
- `lib/rail.mjs` — Rail sampling, local frames, route selection
- `lib/input.mjs` — Keyboard/mouse input (Q/E/M/Space) the engine's api.pad doesn't carry
- `lib/combat.mjs` — Enemies, bullets, particles, hit detection
- `lib/hud.mjs` — Full-screen HUD, map overlay, threat arrows
- `lib/bigtext.mjs` — Blocky bitmap font for titles

## Performance

- Boot: ~225ms
- Play mode: 2.6ms paint, ~3.5k triangles per frame at 60 FPS
- Title/map: 7–9ms paint (coarser terrain LOD)
- No dependencies; runs on Node ≥ 20 and modern browsers

## Deployment

Built with `npm run build island-crisis` → static site in `dist/island-crisis/`.

Deployed to Vercel: `vercel deploy dist/island-crisis --prod`

## Next Steps

- Add more enemy variety and behaviors
- Turret placement improvements (less overlap)
- Boss phases and projectile patterns
- Score multipliers and combo systems
- Audio cues for actions and threats (HUD update via `api.drum`)
