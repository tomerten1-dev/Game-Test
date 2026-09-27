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
| Space | Jump · jump out of the bus · open glider early · redeploy the glider when falling from high up |
| Shift | Sprint |
| C (or Ctrl) | Crouch · press while sprinting to slide |
| R | Reload (uses reserve ammo of the matching type) |
| E (or F) | Open chest / ammo box · pick up |
| Q · Z · V · X | Build mode: wall · floor · ramp · cone (ghost preview) |
| Left click (build mode) | Place the piece (hold to keep placing) |
| Right click (build mode) | Switch material: wood → stone → metal |
| Mouse wheel (build mode) | Cycle pieces |
| B | Toggle build mode |
| G | Edit your wall/floor: click or drag tiles on the 3×3 grid, G again to confirm, right-click to reset (ramps flip) |
| 1 – 6 / mouse wheel | Switch slot (1 = harvesting axe) · leaves build mode |
| M | Full-screen map (click: marker, right-click: clear, wheel: zoom, drag: pan) |
| Middle click (or P) | Ping what you're looking at |
| Tab | Inventory screen: drag slots to swap or drag one out of the row to drop it; drop / drop one / split stacks; drop materials and ammo |
| J | Drop the held item |
| Y | Swap camera shoulder |
| T | Emote — tap for your equipped emote, hold for the emote wheel |
| N | Mute |
| Esc | Pause |

Every key above can be changed in **Settings → Key bindings** (movement, jump, sprint, crouch, reload, interact, the build pieces, edit, quick 90s, map, emote, mute, weapon slots 1–6, inventory, drop, ping and shoulder swap).

**Touch devices** get a floating joystick on the left, drag-to-look on the right, and buttons for Fire (hold), Jump, Crouch, Reload, Use and quick-build (Wall, Floor, Ramp, Cone, MAT to switch material). Push the stick all the way to sprint. Tap the inventory slots to switch, and tap the minimap for the full map.

## Inventory & survival

- **Slot 1** is the harvesting axe: hit trees, crates and wooden houses for wood, rocks and walls for stone, cars, lamps and city props for metal. Trees and rocks show a glowing blue **weak point**; hit it for double materials. Trees and rocks have HP: chop a tree down and it **topples over**, and rocks **crumble**. Bullets and explosions wear them down too. Everything grows back next match.
- **HP bars:** hitting a build, a house wall or door, a tree, a rock or furniture shows a Fortnite-style health bar with its HP (e.g. `150 / 300`).
- **Picking up:** walking over a gun or heal that fits (a free slot, or room in a stack) picks it up; weapons fill slots from the left and consumables from the right. With full slots, picking something up swaps it with what you're holding. Looking at a gun on the floor shows a **stat card** compared with your gun. Each of these can be turned off in Settings.
- **Foraging:** red apples under trees (+5 health) and blue mushrooms in the woods (+5 shield).
- **Slots 2–6** hold guns or stacks of heals: Bandages (+15 up to 75), Medkit (full health), Small Shield (+25 up to 50), Shield Potion (+50), **Med-Mist** (+30, use it on the move), **Slurp Juice** (+75 over time: health, then shield), **Chug Jug** (full health and shield, 15 s). **Spike Traps** (place on a floor, wall or ceiling you aim at; spikes hit anyone else who walks in for 75, re-arming after 3 s, and go away with the surface they're on). Placeables: **Shield Keg** (shields everyone nearby up to 100) and **Campfire** (heals everyone nearby over time). Hold still-ish while the ring fills.
- **Mobility:** **Shockwave Grenade** (goes off on impact and launches everyone nearby, you too, ~40 m with no fall damage), **Grappler** (10 charges: pulls you to where you aim, up to 60 m), **Rift-to-Go** (warps you into the sky to glide).
- **Upgrade benches** in six towns (orange on the map): hold a gun and interact to raise its rarity for gold.
- **Village market and dressing:** village plazas have a market with stalls and a produce cart (apples, carrots, pots on the counters) and a parked wagon. Homes have firewood and lumber piles, and some have banners. Rusty Works has fuel barrels, pallets and scrap piles, Windy Farms has produce crates and wagons, and Salty Pier has cloth bales and cargo. Most of it breaks and can drop loot, and the axe gets stone from brick piles and metal from fuel and scrap.
- **Houses you can go into:** the village homes are medieval plaster-and-brick houses with tiled roofs, one or two stories, with furnished rooms: a dining room and a bedroom or workshop downstairs, and stairs up to a bedroom floor in the two-story ones. Chests and floor loot are inside. Doors open and close with interact (bots open them as they walk up) and break if you shoot or hit them. Windows shatter. Walls are panels that break under bullets, the axe and explosions and give wood when harvested. Everything is repaired at the start of the next match. You can also land and walk on the roofs.
- **Hiding spots:** jump into haystacks and dumpsters (interact); bots can't see you inside. Jump or interact to pop out.
- Crates, barrels, furniture and street clutter **break** from the axe, bullets and explosions and sometimes drop loot.
- **Swimming:** deep water is swimmable (slower, and no shooting or building while swimming).
- **Movement:** sprint into a low fence or crate to **hurdle** it; land from a big drop while running to **roll**; crouch-walking is almost silent.
- **Slide kick:** slide into someone to kick them off their feet (knockback + 15 damage).
- **Wall jump:** press Jump in the air next to a wall to kick off it (twice before you land).
- **Ledge hang:** reach for a ledge above your head mid-air to grab it, hang for a moment and pull yourself up.
- Guns use **light / medium / shells** ammo; reserve shows after the slash. Green **ammo boxes** near houses and anything dropped on the ground are picked up by walking over it.
- Sprinting is fast but inaccurate; standing still gives a perfectly accurate first shot. Falls from high up hurt.
- Guns take a moment to **draw** before they fire, and swapping straight from one shotgun to another right after a shot adds a delay. Pump and tactical shotguns **reload one shell at a time** and can fire mid-reload. Headshot multipliers differ per gun.

## Lobby & progression

- **Lobby:** your hero stands on a floating stage off the island's coast next to three party pads, with a nameplate showing your level and wins; leave it alone for a bit and your hero dances your equipped emote. Tabs: **Play**, **Locker**, **Item Shop**, **Quests**, **Career**, **Settings**. Drag to spin your hero; the Emote button (or **T** in a match) plays your equipped emote.
- **Modes:** *Solo* (you vs 99 bots), *Quick Match* (you vs 29 bots, faster storm), **Arena** (ranked: tougher bots, +50 siphon on eliminations, Hype points for placement and eliminations, a bus fare in the higher divisions, ten divisions from Open I to Champion III) or *Zero Build* (you vs 99 bots, no building, and everyone has a 50-point overshield that regenerates after 6 s without taking damage). It's you against bots, so there's no matchmaking or warm-up: Play drops you straight onto the Storm Bus.
- **XP & levels:** earned for time survived, eliminations, chests, supply drops, damage, placement and quests; the results screen itemises it. Every level gives Storm Coins, and the **Season 1 reward track** (levels 2–30) unlocks outfits colours, gliders, contrails, emotes, weapon wraps and heroes.
- **Daily quests:** three per day (e.g. "Open 3 chests", "Land at Candy Corners"), +500 XP and 100 Storm Coins each.
- **Weekly quests:** seven bigger goals each week (e.g. 25 eliminations, defeat the Foreman, open the vault, win a match), +2000 XP and 250 Storm Coins each.
- **Milestones:** four-star career goals (eliminations, wins, matches, damage, chests, builds, harvesting, top 10s); every star pays XP and coins on the results screen.
- **Item Shop — no real money:** Storm Coins are only earned by playing (matches, quests, level-ups). The shop has two featured items (plus a 20% bundle) and six daily items that rotate at midnight; click to preview on your hero, then buy with coins. There is no payment code anywhere in the game.
- **Locker:** 5 heroes plus 8 skins with their own headgear (Frostbite, Jack O'Knight, Star Voyager…), outfit colours, **back blings** (antenna pack, cape, wings, jetpack, guitar, lil llama…), **harvesting tools** (frying pan, candy cane, neon edge, golden axe…), gliders, contrails, 17 emotes (some with confetti or sparkles) and weapon wraps — all visible in matches. Bots wear random gear too. The reward track runs to level 50.
- **Victory Crown:** win a match and you start the next one wearing the crown (one bot starts crowned too). It drops when its wearer is eliminated; eliminations while crowned give bonus XP, and a crowned win is a *Crowned Victory Royale*.
- **Results screen:** medals (First Blood, Sharpshooter, Headhunter, Marksman, Rampage, Demolition, Lumberjack, Boss Slayer…, each worth XP) and match stats (accuracy, headshots, damage to players and builds, longest elimination).
- **Career:** matches, wins, top 5/10, eliminations, K/D, damage, chests, builds, harvest, time alive, best placement.
- **Settings:** mouse sensitivity, field of view, master/music volume, HUD scale, graphics, sound visualizer and full **key rebinding**. Everything (progress, locker, settings) is saved in your browser.
- **Music:** a rotating lobby playlist, a guitar battle theme on the Battle Bus, a boss theme for the final circles and victory / defeat jingles.

## Loot & world events

- **Weapons:** assault rifle, shotgun, SMG and pistol (hitscan), plus a **sniper rifle** (heavy ammo, bullets travel and drop, right-click for a scope, 2.5× headshots) and a **rocket launcher** (splash damage that wrecks builds). Sniper and rockets are rare on the floor and common in rare chests and supply drops.
- **Throwables** (click to throw, they bounce and go off after a short fuse): **grenades** explode; **smoke grenades** leave a cloud for ~12 s that bots can't see through; **impulse grenades** fling everyone nearby (no damage); **fire flasks** leave a patch of fire for ~6 s that burns players and wooden builds. **Launch pads** (click to place, step on it to fly up and glide).
- **Rare chests** (purple, ~1 in 8) drop two weapons and grenades.
- **Supply drops** float down under a blue balloon three times a match inside the next safe zone. They leave blue smoke and hold an epic or legendary weapon, heals, grenades or a launch pad, and 60 metal.
- **Jump pads** (cyan discs around the island) bounce you high with no fall damage.
- **Loot llamas:** three hide away from the towns each match; open one for 200 of each material, ammo and heals.
- **Gold bars** come from chests, ammo boxes, broken props, supply drops, llamas and bosses, and drop when someone is eliminated. **Vending machines** in four towns sell rare / epic / legendary weapons for 150 / 300 / 500 gold; **upgrade benches** raise a gun's rarity for 100–400 gold.
- **Bosses:** *The Foreman* (Rusty Works), *Captain Tide* (Salty Pier), *The Warden* (Pebble City) and *Lady Bloom* (Maple Hollow) guard their towns with guards. Each carries a named mythic weapon and a **medallion**: shield regen, endless tactical sprint, 60% faster reloads or health regen. Medallion carriers show up on everyone's map and bots hunt them.
- Each match rolls a lighting mood: **Sunny Day**, **Golden Hour** or **Dusk**.
- **Weather:** each match rolls its weather: clear, **rain** (streaks, rain sound, grey sky, closer fog) or a **thunderstorm**. In a thunderstorm, lightning strikes around the island with a flash and thunder that arrives late depending on distance. A strike close by hurts, knocks you up, fells trees and starts a small fire. Winter islands keep their snow instead.
- **Night:** the match turns to night after about 6½ minutes, and about 1 match in 5 is a **night match** from the start. At night everyone carries a **flashlight**: yours lights the way, bots' beams give them away, house windows glow, and bots notice people from less far away (rain cuts their sight a little too).
- Bots switch to the sniper at long range and the rocket launcher against builds, lob grenades at enemies hiding in boxes, and race for supply drops.
- **Bot brain:** every bot has a play style (rusher, looter, camper or builder), claims the chest or gun it's heading for so others go elsewhere, and at most three bots pile onto the same fight. Bots pick targets by threat (whoever is shooting them, weak, reloading or healing enemies first), turn toward gunfire they hear and toward whoever hit them, and pre-aim where you were last seen. They push weak enemies and back off from fights they're losing (box up, or retreat behind smoke). Their aim settles the longer they track you (moving, jumping, getting hit or a fast target throws it off), leads by bullet travel time and holds over for sniper drop; rockets go at your feet and snipers stand still and go for the head. With an empty mag they swap guns, or wall off and reload. They step out of fire, box up before long heals when enemies are near, and build loadouts with one gun per role (close, rifle, long range, explosive).
- **Bot build fights:** under fire, skilled bots throw up a wall and fight from behind it, edit-peeking through it: a window for normal shots, a half wall to shoot up at a higher enemy, a wide arch for close shotgun shots, closed again after each peek. Boxed bots rebuild walls that get shot out, peek the same way, and take height with quick 90s; in the open they 90 up when you have height on them, ramp-rush (ramp + cover wall) toward a higher enemy, and box up next to an enemy who is boxed. They harvest more materials as the match goes on.

## Seasons

**Settings → Island season** picks the island: *Summer*, *Winter* (snow, frosted trees, falling snow, pale sky) or *Desert* (sand, dry scrub, saguaro cacti, warm sky). *Auto* uses Winter from December to February and Summer otherwise. The island is generated on load, so the change applies after the reload button.

## Map, storm & spectating

- The compass at the top shows your heading plus your marker, pings and (when you're outside) the direction of the safe zone. Outside the next circle, the minimap draws a dashed line to it and the storm label shows the distance.
- The kill feed shows the weapon and the distance of each elimination. Damage numbers on the same target stack into one number (Settings to turn off).
- Sounds use 3D (HRTF) positioning, so you can hear whether shots come from in front, behind, above or below.
- The last two storm circles move instead of just shrinking. Inside the storm the world goes purple, foggy and rainy.
- **Storm surge:** from the third circle, while more players are alive than the circle allows, the ones who dealt the least damage take 20 damage every 10 s. The storm line shows your damage against the safe threshold.
- When you're eliminated you spectate whoever got you (then whoever gets them). Click / right-click to switch to the next / previous player; press Space or click **See results** to continue.
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
             towns, enterable houses (Houses.js), colliders, storm, battle bus, loot, building
  player/    Hero character (clone/tint/layered animations), shared Actor body, Player, camera rig, glider
  bots/      Bot AI + names
  weapons/   Weapon stats & rarities, weapon instances, procedural gun models, hitscan combat
  effects/   Pooled muzzle flashes, tracers, particles, damage numbers, elimination bursts
  ui/        HUD, minimap, menus, touch controls
public/models/        models: chars/ (KayKit heroes), kk/ (KayKit world), env/ (Kenney), nature/ village/ props/ outfits/ anims/ (Quaternius), guns/ (Styloo), trees/ (Elijah Cobden)
```

## Tech notes

- **Look:** ACES Filmic tone mapping, sRGB output, hemisphere light + warm sun with soft PCF shadows (shadow camera follows the player), gradient sky shader with sun disk, drifting puffy clouds, matching distance fog, and sky-based environment reflections.
  (three.js r186 folded `PCFSoftShadowMap` into `PCFShadowMap`. Soft edges come from `shadow.radius`.)
- **Terrain:** a 460 m height grid from fbm noise. `heightAt(x, z)` is bilinear, and everything (movement, grass, bullets, camera) uses it. Towns are flattened plateaus.
- **Foliage:** instanced trees (round, pine, some autumn), rocks and bushes. Grass is one instanced draw call with a wind-sway vertex shader that samples a height texture and wraps around the player.
- **Characters:** KayKit Adventurers (Knight, Barbarian, Mage, Rogue, Hooded Rogue). Each player/bot is a `SkeletonUtils.clone` with a subtle color tint; you are the teal hooded rogue with a glowing backpack antenna. Animation runs on two layers: the legs play run / strafe / backpedal / jump while the upper body plays aim / shoot / reload. Crossfades take 0.2 s and running speed follows movement speed.
- **Houses:** built from Medieval Village MegaKit pieces on the kit's 2 m grid (all houses share one instanced mesh per piece; a broken wall panel just hides its instances) in local space, then placed with a 90° rotation so every collider stays an axis-aligned box. Stairs and roofs use ramp colliders. Bots route through the house with a small portal graph (outside ↔ front door ↔ room A ↔ interior door ↔ room B, and room A ↔ stairs ↔ upstairs), walk around corners when the door is on the far side, and walk off roofs they land on.
- **Performance:** instancing, object pools for effects, bot "think" every ~0.3 s, animation LOD for far characters, and lower pixel ratio / shadows / grass on mobile.
- **Post-processing:** [`postprocessing`](https://github.com/pmndrs/postprocessing) + [`n8ao`](https://github.com/N8python/n8ao): ambient occlusion, bloom on glowing things (loot beams, chests, muzzle flashes, sun), a warm/cool color grade and SMAA.
- **Baked lighting:** at load the game traces sun rays from every terrain point against houses, tree canopies, rocks and the mountain. That gives soft shadows and ambient occlusion across the whole island. Near the player they fade into the real shadow map.
- **Water:** depth-tinted from the terrain height (turquoise shallows, deep blue sea), animated shore foam, small waves.
- **Life:** wind-swaying trees and palms, falling leaves, birds, fountain spray, chest sparkles, dust puffs, skydive speed lines, victory confetti.
- **Assets (CC0 unless noted):**
  - **KayKit** by Kay Lousberg: characters and animations, medieval buildings (homes, tavern, blacksmith, market, church, towers, windmills, castle), the modern downtown of Pebble City (City Builder Bits: buildings, roads, parked cars, street lights), café and porch furniture (Furniture Bits), pine trees, rocks, clouds, crates, barrels, sacks, tents, flags, lumber and the treasure chest. See `public/models/kk/CREDITS.md`.
  - **Kenney:** palms and rock spires. See `public/models/env/CREDITS.md`.
  - **Styloo Guns Asset Pack** (provided by the project owner; see its itch.io page for the license): every gun, the grenades, ammo boxes and rounds, and the vault's weapon board. See `public/models/guns/CREDITS.md`.
  - **Elijah Cobden Stylized Trees Pack** (provided by the project owner; see its itch.io page for the license): detailed oaks, columnar trees and pines near the camera, willows, swiggly trees and dead trees. See `public/models/trees/CREDITS.md`.
  - **Quaternius Stylized Nature:** painted leafy trees (shown near the camera; cheaper trees stand in far away), flowering bushes and clover. See `public/models/nature/CREDITS.md`.
  - **Quaternius Medieval Village MegaKit and Fantasy Props MegaKit** (CC0): the village houses (walls, doors, windows, stairs, roofs) and their furniture. See `public/models/village/CREDITS.md` and `public/models/props/CREDITS.md`. The **Universal Animation Library** (CC0) is in `public/models/anims/`, for the upcoming characters.
  - **Procedural:** far-away round/autumn trees, bushes, grass, the bus, fences, fountains and lamps are built from low-poly shapes.
  - **Audio:** CC0 Kenney sound samples plus synthesized effects (see `public/audio/CREDITS.md`), music from the Sitting on Clouds OST by Rom Di Prisco for the lobby and the Battle Bus (provided by the project owner, not CC0), and CC0 music for the final circles and the victory / defeat jingles (see `public/audio/music/CREDITS.md`).

