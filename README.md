# Stormbound

A browser battle royale: **you vs 19 AI heroes** on a bright, stylized island. Ride the flying Battle Bus, skydive, loot glowing chests, build walls and ramps, and be the last hero standing while the purple storm closes in.

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

## Graphics settings

The start menu and pause screen have a **Graphics** selector:

| Setting | What you get |
| --- | --- |
| **Auto** (default) | High on desktop, Low on phones. Drops a level automatically if the frame rate stays under ~42 fps. |
| **High** | Ambient occlusion (N8AO), bloom, color grading, SMAA, 2048 shadow map, full grass |
| **Medium** | Bloom + color grading + SMAA, no ambient occlusion, less grass |
| **Low** | No post-processing, 1024 shadows, sparse grass, pixel ratio 1 |

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
  player/    Hero character (clone/tint/layered animations), shared Actor body, Player, camera rig, glider
  bots/      Bot AI + names
  weapons/   Weapon stats & rarities, weapon instances, procedural gun models, hitscan combat
  effects/   Pooled muzzle flashes, tracers, particles, damage numbers, elimination bursts
  ui/        HUD, minimap, menus, touch controls
public/models/        CC0 models: chars/ (KayKit heroes), kk/ (KayKit world), env/ (Kenney)
```

## Tech notes

- **Look:** ACES Filmic tone mapping, sRGB output, hemisphere light + warm sun with soft PCF shadows (shadow camera follows the player), gradient sky shader with sun disk, drifting puffy clouds, matching distance fog, and sky-based environment reflections.
  (three.js r186 folded `PCFSoftShadowMap` into `PCFShadowMap`. Soft edges come from `shadow.radius`.)
- **Terrain:** a 460 m height grid from fbm noise. `heightAt(x, z)` is bilinear, and everything (movement, grass, bullets, camera) uses it. Towns are flattened plateaus.
- **Foliage:** instanced trees (round, pine, some autumn), rocks and bushes. Grass is one instanced draw call with a wind-sway vertex shader that samples a height texture and wraps around the player.
- **Characters:** KayKit Adventurers (Knight, Barbarian, Mage, Rogue, Hooded Rogue). Each player/bot is a `SkeletonUtils.clone` with a subtle color tint; you are the teal hooded rogue with a glowing backpack antenna. Animation runs on two layers: the legs play run / strafe / backpedal / jump while the upper body plays aim / shoot / reload. Crossfades take 0.2 s and running speed follows movement speed.
- **Performance:** instancing, object pools for effects, bot "think" every ~0.3 s, animation LOD for far characters, and lower pixel ratio / shadows / grass on mobile.
- **Post-processing:** [`postprocessing`](https://github.com/pmndrs/postprocessing) + [`n8ao`](https://github.com/N8python/n8ao): ambient occlusion, bloom on glowing things (loot beams, chests, muzzle flashes, sun), a warm/cool color grade and SMAA.
- **Baked lighting:** at load the game traces sun rays from every terrain point against houses, tree canopies, rocks and the mountain. That gives soft shadows and ambient occlusion across the whole island. Near the player they fade into the real shadow map.
- **Water:** depth-tinted from the terrain height (turquoise shallows, deep blue sea), animated shore foam, small waves.
- **Life:** wind-swaying trees and palms, falling leaves, birds, fountain spray, chest sparkles, dust puffs, skydive speed lines, victory confetti.
- **Assets (all CC0):**
  - **KayKit** by Kay Lousberg: characters and animations, medieval buildings (homes, tavern, blacksmith, market, church, towers, windmills, castle), pine trees, rocks, clouds, crates, barrels, sacks, tents, flags, lumber and the treasure chest. See `public/models/kk/CREDITS.md`.
  - **Kenney:** palms, rock spires and the pistol/SMG/AR blasters. See `public/models/env/CREDITS.md`.
  - **Procedural:** round/autumn trees, bushes, grass, the shotgun, the bus, fences, fountains and lamps are built from low-poly shapes.
  - **Audio:** all sounds are synthesized with Web Audio.

