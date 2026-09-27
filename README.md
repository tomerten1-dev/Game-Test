# Stormbound

A browser battle royale: **you vs 19 AI bots** on a bright, stylized island. Ride the flying Battle Bus, skydive, loot glowing chests, build walls and ramps, and be the last robot standing while the purple storm closes in.

Built from scratch with **Vite + Three.js** (ES modules, plain JavaScript). No game engine.

## Run it

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173) and press **PLAY**.

To play on your phone on the same Wi‑Fi, use the "Network" URL that `npm run dev` prints.

Production build: `npm run build` (output in `dist/`), preview it with `npm run preview`.

## Controls

| Desktop | Action |
| --- | --- |
| WASD | Move / steer while skydiving |
| Mouse | Aim (click the game to capture the mouse) |
| Left click | Shoot |
| Right click | Zoom (over-the-shoulder aim) |
| Space | Jump · jump out of the bus · open glider early |
| R | Reload |
| E (or F) | Open chest / pick up |
| Q | Build wood wall (10 wood) |
| V | Build wood ramp (10 wood) |
| 1 · 2 · 3 / mouse wheel | Switch weapon |
| M | Mute |
| Esc | Pause |

**Touch devices** get a floating joystick on the left, drag-to-look on the right, and buttons for Fire (hold), Jump, Wall, Ramp, Reload and Use. Tap the weapon slots to switch.

## How a match works

1. The Battle Bus flies across the island at 110 m. Jump when you like (it drops you at the end otherwise).
2. Skydive and steer. The glider opens automatically about 35 m above the ground.
3. Loot gold chests (weapon + shield potion / medkit + wood) and floor loot. Rarity colors: grey, green, blue, purple, gold. Rarer = more damage.
4. The storm has 6 phases. Each waits, then shrinks toward a new circle (white ring on the minimap). Damage grows every phase.
5. Health 100 + shield 100 (shield absorbs damage first). Headshots do 1.5x.
6. Last one alive wins. **Play Again** starts a fresh match without reloading the page.

## Project layout

```
src/
  core/      Game loop + match flow, input, device/quality presets, noise, Web Audio synth
  world/     Terrain (fbm island + heightAt), sky & clouds, water, lighting, foliage,
             towns, colliders, storm, battle bus, loot, building
  player/    Robot character (clone/tint/animations/arm IK), shared Actor body, Player, camera rig, glider
  bots/      Bot AI + names
  weapons/   Weapon stats & rarities, weapon instances, procedural gun models, hitscan combat
  effects/   Pooled muzzle flashes, tracers, particles, damage numbers, elimination bursts
  ui/        HUD, minimap, menus, touch controls
public/models/RobotExpressive.glb   CC0 animated robot (three.js examples)
```

## Tech notes

- **Look:** ACES Filmic tone mapping, sRGB output, hemisphere light + warm sun with soft PCF shadows (shadow camera follows the player), gradient sky shader with sun disk, drifting puffy clouds, matching distance fog, and sky-based environment reflections.
  (three.js r186 folded `PCFSoftShadowMap` into `PCFShadowMap`. Soft edges come from `shadow.radius`.)
- **Terrain:** a 460 m height grid from fbm noise. `heightAt(x, z)` is bilinear, and everything (movement, grass, bullets, camera) uses it. Towns are flattened plateaus.
- **Foliage:** instanced trees (round, pine, some autumn), rocks and bushes. Grass is one instanced draw call with a wind-sway vertex shader that samples a height texture and wraps around the player.
- **Characters:** every player/bot is a `SkeletonUtils.clone` of the robot, scaled to 1.8 m with its "Main" material tinted (player = teal). Animations crossfade over 0.2 s, running speed follows movement speed, and a small arm IK makes robots hold their gun.
- **Performance:** instancing, object pools for effects, bot "think" every ~0.3 s, animation LOD for far robots, and lower pixel ratio / shadows / grass on mobile.
- **Assets:** trees, rocks, houses, weapons, the bus and loot are built procedurally from low-poly primitives, so no extra asset packs are needed. All sounds are synthesized with Web Audio.

Robot model: "RobotExpressive" by Tomás Laulhé (CC0), from the three.js examples.
