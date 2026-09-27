# Stormbound

A browser battle royale: **you vs 19 AI heroes** on a bright, stylized island. Ride the flying Storm Bus, skydive, loot glowing chests, build walls and ramps, and be the last hero standing while the purple storm closes in.

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
| Left click | Shoot · swing the axe · use a heal/shield item |
| Right click | Zoom (over-the-shoulder aim) |
| Space | Jump · jump out of the bus · open glider early |
| Shift | Sprint |
| C (or Ctrl) | Crouch · press while sprinting to slide |
| R | Reload (uses reserve ammo of the matching type) |
| E (or F) | Open chest / ammo box · pick up |
| Q · Z · V · X | Build mode: wall · floor · ramp · cone (ghost preview) |
| Left click (build mode) | Place the piece (hold to keep placing) |
| Right click (build mode) | Switch material: wood → stone → metal |
| Mouse wheel (build mode) | Cycle pieces |
| B | Toggle build mode |
| G | Edit the wall you look at: door → window → plain |
| 1 – 6 / mouse wheel | Switch slot (1 = harvesting axe) · leaves build mode |
| M | Full-screen map (click: marker, right-click: clear, wheel: zoom, drag: pan) |
| Middle click | Ping what you're looking at |
| N | Mute |
| Esc | Pause |

**Touch devices** get a floating joystick on the left, drag-to-look on the right, and buttons for Fire (hold), Jump, Crouch, Reload, Use and quick-build (Wall, Floor, Ramp, Cone, MAT to switch material). Push the stick all the way to sprint. Tap the inventory slots to switch, and tap the minimap for the full map.

## Inventory & survival

- **Slot 1** is the harvesting axe: hit trees, crates and wooden houses for wood, rocks and walls for stone, cars, lamps and city props for metal.
- **Slots 2–6** hold guns or stacks of heals: Bandages (+15 up to 75), Medkit (full health), Small Shield (+25 up to 50), Shield Potion (+50). Hold still-ish while the ring fills.
- Guns use **light / medium / shells** ammo; reserve shows after the slash. Green **ammo boxes** near houses and anything dropped on the ground are picked up by walking over it.
- Sprinting is fast but inaccurate; standing still gives a perfectly accurate first shot. Falls from high up hurt.

## Loot & world events

- **Weapons:** assault rifle, shotgun, SMG and pistol (hitscan), plus a **sniper rifle** (heavy ammo, bullets travel and drop, right-click for a scope, 2.5× headshots) and a **rocket launcher** (splash damage that wrecks builds). Sniper and rockets are rare on the floor and common in rare chests and supply drops.
- **Grenades** (click to throw, they bounce and go off after ~2 s) and **launch pads** (click to place, step on it to fly up and glide).
- **Rare chests** (purple, ~1 in 8) drop two weapons and grenades.
- **Supply drops** float down under a blue balloon three times a match inside the next safe zone. They leave blue smoke and hold an epic or legendary weapon, heals, grenades or a launch pad, and 60 metal.
- **Jump pads** (cyan discs around the island) bounce you high with no fall damage.
- **Vending machines** in four towns rotate rare / epic / legendary weapons for 100 wood / 200 stone / 300 metal.
- Each match rolls a lighting mood: **Sunny Day**, **Golden Hour** or **Dusk**.
- Bots switch to the sniper at long range and the rocket launcher against builds, lob grenades at enemies hiding in boxes, and race for supply drops.

## Map, storm & spectating

- The compass at the top shows your heading plus your marker, pings and (when you're outside) the direction of the safe zone.
- The last two storm circles move instead of just shrinking. Inside the storm the world goes purple, foggy and rainy.
- When you're eliminated you spectate whoever got you (then whoever gets them). Press Space or click **See results** to continue.
- **Visualize sound** (menu/pause) shows icons around the crosshair for gunshots, footsteps, building and nearby chests. It also works with sound muted.

## Building

Every piece costs 10 of the selected material and snaps to a 4 m grid, lining up with nearby builds so you can stack walls, floors and ramps. Look up to build a level higher, or look down to put a floor under you.

| Material | Max HP | Time to reach full HP |
| --- | --- | --- |
| Wood | 150 | 2.5 s |
| Stone | 300 | 5 s |
| Metal | 450 | 8 s |

Pieces start weaker (and see-through) and harden while they build. Anything that loses its connection to the ground collapses. Bots box up (four walls + roof) when hurt, heal inside, open windows to shoot back, shoot through your walls and ramp up to high ground.

## Graphics settings

The start menu and pause screen have a **Graphics** selector:

| Setting | What you get |
| --- | --- |
| **Auto** (default) | High on desktop, Low on phones. Drops a level automatically if the frame rate stays under ~42 fps. |
| **High** | Ambient occlusion (N8AO), bloom, color grading, SMAA, 2048 shadow map, full grass, detailed trees out to 95 m |
| **Medium** | Bloom + color grading + SMAA, no ambient occlusion, less grass, detailed trees to 70 m |
| **Low** | No post-processing, 1024 shadows, sparse grass, pixel ratio 1, detailed trees to 45 m |

## How a match works

1. The Storm Bus flies across the island at 110 m. Jump when you like (it drops you at the end otherwise).
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
  - **KayKit** by Kay Lousberg: characters and animations, medieval buildings (homes, tavern, blacksmith, market, church, towers, windmills, castle), the modern downtown of Pebble City (City Builder Bits: buildings, roads, parked cars, street lights), café and porch furniture (Furniture Bits), pine trees, rocks, clouds, crates, barrels, sacks, tents, flags, lumber and the treasure chest. See `public/models/kk/CREDITS.md`.
  - **Kenney:** palms, rock spires and the pistol/SMG/AR blasters. See `public/models/env/CREDITS.md`.
  - **Quaternius Stylized Nature:** painted leafy trees (shown near the camera; cheaper trees stand in far away), flowering bushes and clover. See `public/models/nature/CREDITS.md`.
  - **Procedural:** round/autumn trees, bushes, grass, the shotgun, the bus, fences, fountains and lamps are built from low-poly shapes.
  - **Audio:** all sounds are synthesized with Web Audio.

