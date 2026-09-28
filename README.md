# Stormbound

A browser battle royale: **you vs 99 AI heroes** on a bright, stylized island. Ride the flying Storm Bus, skydive, loot glowing chests, build walls and ramps, and be the last hero standing while the purple storm closes in.

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

Every key above can be changed in **Settings → Key bindings** (movement, jump, sprint, crouch, reload, interact, the build pieces, edit, quick 90s, map, emote, mute, weapon slots 1–6, inventory, drop, ping, shoulder swap, auto-run, Sprite power, change build material and reset edit).

**Touch devices** get a floating joystick on the left, drag-to-look on the right, and buttons for Fire (hold), Jump, Crouch, Reload, Use and quick-build (Wall, Floor, Ramp, Cone, MAT to switch material). Push the stick all the way to sprint. Tap the inventory slots to switch, and tap the minimap for the full map.

## Inventory & survival

- **Slot 1** is the harvesting axe: hit trees, crates and wooden houses for wood, rocks and walls for stone, cars, lamps and city props for metal. Trees and rocks show a glowing blue **weak point**; hit it for double materials. Trees and rocks have HP: chop a tree down and it **topples over**, and rocks **crumble**. Bullets and explosions wear them down too. Everything grows back next match.
- **Custom Skin (Locker → Hero → Load model…):** wear your own `.glb` / `.gltf` character. The file stays in your browser (IndexedDB), never in the game files or the repo, so use models you're allowed to use. Rigs with Unreal-mannequin bone names (pelvis, spine_01, thigh_l, hand_r… as used by Fortnite-style and Unreal characters) or Mixamo names are driven by all our animations; other models load but stand still. Weapons go in the right hand, and the model is scaled to 1.92 m. **Remove** goes back to a normal hero.
- **Fortnite numbers (researched):**
  - Scale matches Fortnite: players are 1.92 m tall, and every house storey is exactly one build wall (3.84 m) high, so walls you build line up with the floors. Doors are ~2.9 m and small houses about 10 × 7 m; furniture keeps its real size.
  - Sprint is 1.3× the run speed (Fortnite Chapter 5), with tactical sprint a bit faster on stamina.
  - Ammo caps: 500 light, 500 medium, 150 shells and 50 heavy. Shells come in stacks of 4. Over the cap, the rest stays on the ground.
  - Materials cap at 500 each; metal walls top out at 450.
  - The Assault Rifle is based on the Holo Twister: 27 damage, 5.1 shots/s, 25-round mag, 1.5× headshots.
  - The Pump is based on the Sentinel: 12 pellets, 92 common → 114 legendary, 4 shells, 1.75× headshots.
  - Rarity steps follow Fortnite, about +5.5% damage per rarity.
  - Fall damage follows Fortnite's heights: none below ~12.5 m (3⅓ walls), 49 at 5 walls, 100 at 6 walls. Rolling doesn't reduce it.
  - Storm damage climbs 1 → 1 → 2 → 5 → 8 → 12 → 15 → 20. The first circle waits 3 minutes (Fortnite: 3:20) and closes to 1.6 km across; a full match lasts about 22 minutes.
  - The island is Fortnite-sized, about 2.3 km of land across, and laid out like the Chapter 1 Season 3 map with its 17 named places. The Storm Bus flies at 320 m and 72 m/s, and you can skydive and glide roughly 400 m out from its path.
- **Fortnite-style look (Chapter 5+):**
  - Heavy condensed uppercase type (Anton, a free stand-in for Burbank; Barlow Condensed for numbers). Both are bundled, so nothing loads from Google Fonts.
  - Straight health and shield bars, square quick-bar slots with rarity glow, and a square minimap.
  - Under the minimap: storm timer (grey stopwatch while the circle waits, purple storm cloud while it closes), players left and eliminations.
  - The lobby shows one selected-mode card with **Change** above a big yellow **PLAY!** button.
  - The Item Shop uses wide tiles: art on a rarity gradient, a dark name band and the price.
  - A win reads **#1 VICTORY ROYALE**.
  - Rarity colours follow Fortnite: grey, green, blue, purple, orange legendary, gold mythic.
- **HUD details:**
  - Each gun slot shows its ammo (red when low), and ammo by type sits beside your materials.
  - The Vault Keycard has its own slot beside the quick bar.
  - Storm text reads "Storm eye forming / shrinks in / shrinking", with a chime per phase, a purple flash on every storm tick and a "You are in the storm · RUN!" warning.
  - Eliminations show a centred "ELIMINATED name" callout, and accolade toasts ("+150 XP Elimination", "+40 XP Chest Opened") appear under the compass.
  - Your open quests are tracked under the minimap.
  - Chests, ammo boxes, supply drops, llamas and the vault are searched by holding interact (a fill bar shows progress), and swapping into a full inventory is a short hold. Both can be turned off.
  - Settings add preferred slots per gun type, toggles for the minimap, compass, kill feed, quest tracker and an FPS counter, and a HUD layout editor (pause menu → Edit layout: drag the HUD blocks).
  - Visualize sound draws coloured arcs on a ring around the crosshair: white steps, gold chests, red gunfire.
- **Pings and map:** a single ping names what's under your crosshair (floor loot in its rarity colour, chests, ammo boxes, enemies) and lasts 10 s. Ping twice quickly for a red danger ping with an alert sound. On the big map, hover and press the ping key to ping a spot. The map legend explains every icon (supply drops, vending, benches, jump pads, bosses, medallion carriers, the vault), and a yellow arrow shows where a moving storm eye is heading.
- **Movement (Chapter 6–7 style):**
  - **Wall Scramble** (jump into a wall in front of you) and Wall Kick (a wall beside you).
  - **Ledge Jump** (sprint off an edge for extra distance) and **Roll Landing** (hold or tap Jump as you land: keep your speed, +16 stamina, less fall damage).
  - A big enough fall eliminates you, like in Fortnite.
  - **Shoulder-bash** doors by sprinting, sliding or rolling into them.
  - **Auto-run** (=), sprint-by-default and toggle-sprint settings.
  - Slides keep going downhill.
  - Dolphin-dive by jumping while swimming; swimming refills stamina.
  - Look down to skydive faster. In Zero Build, jump to cut your glider and redeploy from lower.
- **Getting around:**
  - **Lookout towers** on hills with ladders (walk into them) and **ziplines** from the top (interact to ride, forward/back to steer, jump to let go, no fall damage until you land).
  - An **ascender** up the factory smokestacks, and **hot air balloons** you can ride up and down.
  - New items: **Bouncer** (placed), **Crash Pad** (thrown), **Wingsuit** (10 launches; dive to build speed, pull up to climb) and **Seven Sliders** boots (jet-slide while sprinting, even on water; overheat after ~5 s).
- **Match starts:** sometimes you **drive the Battle Bus** (steer through 5 rings: +50 XP each and a supply drop under every ring). About 1 match in 5 is **Storm Surfing**: everyone rides a wave in from the sea, moves along it and gets launched onto the island (jump as it launches for a boost).
- **Floor loot tag:** when you're next to something on the ground, a tag beside the item shows the key and 'Pick up' (or 'Swap' when your slots are full), the name, a rarity chip and the ammo in the gun or the stack count.
- **Using items:** a countdown dial beside the crosshair shows the seconds left for heals, shields and reloads. The outfit characters drink shield potions and slurps (blue sparkles) and kneel to use bandages and medkits (green sparkles).
- **Heals (Fortnite timings):** bandages 4 s, medkit 10 s, shield potion 5 s; Slurp Juice gives 1 health and 1 shield every half second (up to 75 each).
- **More items:**
  - **Chug Splash** (thrown: +20 health or shield to everyone splashed), **Med-Mist** (thrown healing mist, +10 health a second), **Flowberry Fizz** (shake it: +5 shield every half second around you and 10 s of low gravity) and the **Spicy Taco** (+20 health and a speed boost).
  - **Shield Bubble** (a dome that stops every bullet and grenade in and out for 30 s), **Port-a-Fort** (an instant three-storey metal tower with a bounce tire inside; a bubble in Zero Build), **Storm Flip** (a safe bubble in the storm, or a small storm outside it), **SOS Flare** (a supply drop comes down on you), **Storm Scanner** (shows the circle after next for this phase), **Gas Can** and the **1-Up Token** (carry it: when eliminated you redeploy from the sky with all your gear, once).
  - **Foraged food:** apples and bananas (+5 health), mushrooms (+5 shield), peppers (+10 health and a stacking speed boost) and Slap Berries (endless tactical sprint for 12 s).
  - **Spike traps** go on floors only and break after one hit.
  - **Zero Build start kit:** everyone starts with a pistol, two small shields and one extra item.
- **Fishing:** grab a **Fishing Rod** (lying on the shore near most fishing spots, or from loot), aim at water and fire to cast, and fire again when the bobber dips. Calm water gives Small Fry and Floppers; the 16 **bubbling fishing spots** (3 catches each) give better fish, weapons and sometimes the **Mythic Goldfish** (throw it for 250 damage on a direct hit, then pick it back up). Fish: Small Fry (+25 health up to 75), Flopper (+40 health), Shield Fish (+50 shield), Slurpfish (+40 health, the rest to shield), Spicy Fish (+15 health and speed).
- **Sprites:** pick a **Water**, **Earth** or **Fire Sprite** in the Locker (it floats by your shoulder in place of the back bling). Water: press **K** to heal health and shield (cooldown). Earth: chests sometimes give an extra rare weapon. Fire: every ~150 damage you deal sets your target on fire. Chests (+5 XP) and eliminations (+20 XP) level your sprite to 2 and 3, making its power stronger; levels are saved between matches. Some bots carry sprites too.
- **HP bars:** hitting a build, a house wall or door, a tree, a rock or furniture shows a Fortnite-style health bar with its HP (e.g. `150 / 300`).
- **Picking up:** walking over a gun or heal that fits (a free slot, or room in a stack) picks it up; weapons fill slots from the left and consumables from the right. With full slots, picking something up swaps it with what you're holding. Looking at a gun on the floor shows a **stat card** compared with your gun. Each of these can be turned off in Settings.
- **Foraging:** red apples under trees (+5 health) and blue mushrooms in the woods (+5 shield).
- **Slots 2–6** hold guns or stacks of heals: Bandages (+15 up to 75), Medkit (1 s to start, then up to 100 health over 9 s while you move), Small Shield (+25 up to 50, 2 s), Shield Potion (1 s, then +50 over 4 s), **Med-Mist** (+30, use it on the move), **Slurp Juice** (+75 over time: health, then shield), **Chug Jug** (full health and shield, 15 s). **Spike Traps** (place on a floor, wall or ceiling you aim at; spikes hit anyone else who walks in for 75, re-arming after 3 s, and go away with the surface they're on). Placeables: **Shield Keg** (shields everyone nearby up to 100) and **Campfire** (heals everyone nearby over time). Hold still-ish while the ring fills.
- **Mobility:** **Shockwave Grenade** (goes off on impact and launches everyone nearby, you too, ~40 m with no fall damage), **Grappler** (10 charges: pulls you to where you aim, up to 60 m), **Rift-to-Go** (warps you into the sky to glide).
- **Upgrade benches** in six towns (orange on the map): hold a gun and interact to raise its rarity for gold.
- **Village market and dressing:** village plazas have a market with stalls and a produce cart (apples, carrots, pots on the counters) and a parked wagon. Homes have firewood and lumber piles, and some have banners. The factories (Junk Junction, Dusty Depot, Flush Factory) have fuel barrels, pallets and scrap piles, and the farms (Anarchy Acres, Fatal Fields) have produce crates and wagons. Most of it breaks and can drop loot, and the axe gets stone from brick piles and metal from fuel and scrap.
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

- **Battle Pass pages:** every level you gain gives one claim; spend it on any reward of an unlocked page (Quests tab). Claiming 4 rewards on a page unlocks the next. Coin rewards on the level track still pay out automatically. (Fortnite dropped Battle Stars in Chapter 6 for this system.)
- **New cosmetic types:** **Kicks** (sneakers over your outfit's boots), **Sidekicks** (a pup, kitty or penguin that follows you and hops when you emote, jump or open chests), **Sprays** (second page of the emote wheel, painted where you aim), **Loading Screens** (shown as a match starts, with a tip), **Lobby Music** (pick a track instead of the shuffle) and **outfit Styles** (alternate looks for each outfit, picked in the Locker).
- **Emote wheel pages:** scroll the mouse wheel (or tap the arrows) to flip between emote pages and sprays.
- **Victory Crown counter:** the crown shows how many crowned wins you've stacked (×N over the crown); bots wearing crowns show theirs, and it carries over when a crown is picked up.
- **Lobby:** your hero stands on a floating stage off the island's coast next to three party pads, with a nameplate showing your level and wins; leave it alone for a bit and your hero dances your equipped emote. Tabs: **Play**, **Locker**, **Item Shop**, **Quests**, **Career**, **Settings**. Drag to spin your hero; the Emote button (or **T** in a match) plays your equipped emote.
- **Modes:** *Solo* (you vs 99 bots), *Quick Match* (you vs 29 bots, faster storm), *Zero Build*, **Reload** (40 players on a smaller map starting at the second circle; everyone gets 2 reboots and drops back in from the sky with a pistol 10 s after being eliminated, until circle 7) and **Blitz Royale** (32 players, Zero Build, starts at the third circle, everyone gets the same kit and the same medallion, better loot, about 4–5 minutes), plus **Ranked** (tougher bots as you climb, siphon on eliminations). Ranked uses Fortnite's 18 ranks: Bronze I–III, Silver, Gold, Platinum and Diamond I–III, then Elite, Champion and Unreal; placement and eliminations add rank points, and from Platinum up each match costs a few.
- **XP & levels:** earned for time survived, eliminations, chests, supply drops, damage, placement and quests; the results screen itemises it. Every level gives Storm Coins, and the **Season 1 reward track** (levels 2–30) unlocks outfits colours, gliders, contrails, emotes, weapon wraps and heroes.
- **Daily quests:** three per day (e.g. "Open 3 chests", "Land at Candy Corners"), +500 XP and 100 Storm Coins each.
- **Weekly quests:** seven bigger goals each week (e.g. 25 eliminations, defeat the Foreman, open the vault, win a match), +2000 XP and 250 Storm Coins each.
- **Milestones:** four-star career goals (eliminations, wins, matches, damage, chests, builds, harvesting, top 10s); every star pays XP and coins on the results screen.
- **Item Shop — no real money:** Storm Coins are only earned by playing (matches, quests, level-ups). The shop has two featured items (plus a 20% bundle) and six daily items that rotate at midnight; click to preview on your hero, then buy with coins. There is no payment code anywhere in the game.
- **Characters:** you and the bots are Quaternius outfit characters (Trail Ranger, Forest Ranger, Village Hand, Harvest Keeper) animated with the Universal Animation Library: jog, sprint, jump, roll, aim and shoot, reload, consume, throw and more. The outfit packs have no heads, so a skin-toned mannequin head from the animation library is used (drop in Quaternius' Universal Base Characters later for real faces). The older KayKit heroes are still in the locker.
- **Locker:** 4 outfit characters and 5 KayKit heroes, plus 8 skins with their own headgear (Frostbite, Jack O'Knight, Star Voyager…), outfit colours, **back blings** (antenna pack, cape, wings, jetpack, guitar, lil llama…), **harvesting tools** (frying pan, candy cane, neon edge, golden axe…), gliders, contrails, 17 emotes (some with confetti or sparkles) and weapon wraps — all visible in matches. Bots wear random gear too. The reward track runs to level 50.
- **Victory Crown:** win a match and you start the next one wearing the crown (one bot starts crowned too). It drops when its wearer is eliminated; eliminations while crowned give bonus XP, and a crowned win is a *Crowned Victory Royale*.
- **Results screen:** medals (First Blood, Sharpshooter, Headhunter, Marksman, Rampage, Demolition, Lumberjack, Boss Slayer…, each worth XP) and match stats (accuracy, headshots, damage to players and builds, longest elimination).
- **Career:** matches, wins, top 5/10, eliminations, K/D, damage, chests, builds, harvest, time alive, best placement.
- **Settings:** mouse sensitivity, field of view, master/music volume, HUD scale, graphics, sound visualizer and full **key rebinding**. Everything (progress, locker, settings) is saved in your browser.
- **Music:** a rotating lobby playlist, a guitar battle theme on the Battle Bus and victory / defeat jingles (no music during the match itself). Sounds are only heard close by (about 40 m at most).

## Loot & world events

- **Weapons:** assault rifle, shotgun, SMG and pistol (hitscan), plus a **sniper rifle** (heavy ammo, bullets travel and drop, right-click for a scope, 2.5× headshots) and a **rocket launcher** (splash damage that wrecks builds). Sniper and rockets are rare on the floor and common in rare chests and supply drops.
- **More weapon types:** Drum Gun, Minigun (spins up before it fires), DMR (built-in 1.6× optic), Hand Cannon, Dual Pistols, Flare Gun (sets the spot on fire), Grenade Launcher (bouncing grenades that burst on contact), **Charge Bow** (hold fire to draw, release to loose; never runs out of arrows) and the **Kinetic Blade** (3-hit slash combo, right-click to dash, 6 s cooldown).
- **Gun handling (Fortnite rules):** aiming down sights tightens every gun's spread and slows you down; assault rifles, burst rifles, DMRs and pistols have a perfect first shot when you stand still; AR headshots do 2×; higher rarities reload faster. Shotguns use Fortnite's pump falloff (full damage to 7 m, 78% at 10 m, 49% at 15 m, nothing past 31 m), have a per-rarity damage cap and need 3 pellets on the head to count as a headshot.
- **Mod benches** stand beside each upgrade bench: four slots per gun — optic (red dot 1.15×, holo 1.3×, 2× and 4× scopes), magazine (drum +50% / speed mag), underbarrel (angled grip, vertical grip, laser) and barrel (muzzle brake, **suppressor**). Adding or swapping a mod costs 75 gold, removing one is free, and the parts show on the gun. Floor and chest guns often come with a few mods already on. Suppressed guns are quiet and only show on sound markers up close.
- **Exotic weapons** (cyan) are sold by four dealer characters around the island: the **Shadow Tracker** (hits reveal the target on your map for 8 s, 400 gold), **Marksman Six Shooter** (fast hip fire, slow perfect aimed shots at 1.5× damage, 400), **The Dub** (each blast launches you backwards, 600) and the **Storm Scout Sniper** (while held, the map shows the circle after next, 500).
- **Fire spreads:** flare guns, fire flasks and explosions set wooden builds, grass and trees alight; flames creep across grass and jump between touching wooden pieces. **Fuel barrels** in the industrial town and thrown **gas cans** explode when shot, burned or blown up (chains go off one after another).
- **Eliminations:** like Fortnite, siphon is Ranked-only: there the eliminator gets 75 health, then shield, over 5 s (the Health Siphon override turns it on everywhere). Eliminated players always drop at least 50 of each material. The pickaxe does 75 to enemy builds. A **RELOAD** hint appears under the crosshair when your magazine is at a quarter or less.
- **Throwables** (click to throw, they bounce and go off after a short fuse): **grenades** explode; **smoke grenades** leave a cloud for ~12 s that bots can't see through; **impulse grenades** fling everyone nearby (no damage); **fire flasks** leave a patch of fire for ~6 s that burns players and wooden builds. **Launch pads** (click to place, step on it to fly up and glide).
- **Rare chests** (shinier gold with a bigger glow, ~1 in 8) hold the usual number of items but at a better rarity.
- **Supply drops** float down under a blue balloon three times a match inside the next safe zone. Shoot the balloon to pop it and bring the crate down fast. They leave blue smoke and hold an epic or legendary weapon, heals, grenades or a launch pad, and 60 metal.
- **Jump pads** (cyan discs around the island) bounce you high with no fall damage.
- **Loot llamas:** three hide away from the towns each match; open one for 200 of each material, ammo and heals. They're skittish: walk or run at one and it runs off, get right up to it and it teleports away — sneak up crouched.
- **Gold bars** come from chests, ammo boxes, broken props, supply drops, llamas and bosses, and drop when someone is eliminated. **Vending machines** in four towns sell rare / epic / legendary weapons for 150 / 300 / 500 gold; **upgrade benches** raise a gun's rarity for 100–400 gold.
- **Bosses:** *The Foreman* guards the vault at Dusty Depot; *Captain Tide*, *The Warden* and *Lady Bloom* turn up at a different town each match (check the map), with guards. Each carries a named mythic weapon and a **medallion**: shield regen, endless tactical sprint, 60% faster reloads or health regen. Medallion carriers show up on everyone's map and bots hunt them.
- Each match rolls a lighting mood: **Sunny Day**, **Golden Hour** or **Dusk**.
- **Weather:** matches are clear (rain and thunderstorms are switched off). Winter islands keep their snow.
- **Night:** the match turns to night after about 6½ minutes, and about 1 match in 5 is a **night match** from the start. At night everyone carries a **flashlight**: yours lights the way, bots' beams give them away, house windows glow, and bots notice people from less far away.
- Bots switch to the sniper at long range and the rocket launcher against builds, lob grenades at enemies hiding in boxes, and race for supply drops.
- **Bot brain:** every bot has a play style (rusher, looter, camper or builder), claims the chest or gun it's heading for so others go elsewhere, and at most three bots pile onto the same fight. Bots pick targets by threat (whoever is shooting them, weak, reloading or healing enemies first), turn toward gunfire they hear and toward whoever hit them, and pre-aim where you were last seen. They push weak enemies and back off from fights they're losing (box up, or retreat behind smoke). Their aim settles the longer they track you (moving, jumping, getting hit or a fast target throws it off), leads by bullet travel time and holds over for sniper drop; rockets go at your feet and snipers stand still and go for the head. With an empty mag they swap guns, or wall off and reload. They step out of fire, box up before long heals when enemies are near, and build loadouts with one gun per role (close, rifle, long range, explosive).
- **Bot build fights:** under fire, skilled bots throw up a wall and fight from behind it, edit-peeking through it: a window for normal shots, a half wall to shoot up at a higher enemy, a wide arch for close shotgun shots, closed again after each peek. Boxed bots rebuild walls that get shot out, peek the same way, and take height with quick 90s; in the open they 90 up when you have height on them, ramp-rush (ramp + cover wall) toward a higher enemy, and box up next to an enemy who is boxed. They harvest more materials as the match goes on.

## Seasons

**The island** follows the Fortnite Chapter 1 Season 3 map (February 2018): the same coastline, a lake with an island in the middle-north, a river running from it north to the coast and another winding south to the sea, dense woods in the north-east, yellow fields in the north and a swamp in the south-east. It's about 2.3 km of land across. The layout comes from a data map (`public/maps/island.png`, made from the user-provided map image by `tools/build-island-map.py`): coastline, lake and rivers, forest density, fields, swamp and dirt. Hills, trees and towns are generated on top. On the full map, the A–J / 1–10 grid lines up with Fortnite's.

The named places are the Season 3 ones, with their names and grid squares: Junk Junction (B2), Haunted Hills (C2), Pleasant Park (C3), Anarchy Acres (F3), Loot Lake (D4), Tomato Town (G3), Wailing Woods (I3), Lonely Lodge (I5), Dusty Depot (F5, with the vault), Tilted Towers (D5), Snobby Shores (A5), Retail Row (H6), Salty Springs (F7), Greasy Grove (C7), Shifty Shafts (D7), Fatal Fields (F8), Moisty Mire (H8), Flush Factory (D9) and Lucky Landing (F10). Smaller spots include a roadside motel, a dirt track, the prison and the movie set in the swamp, the Loot Lake island, the hedge maze in Wailing Woods and a river bridge, each with a chest. A lantern-lit **Hill Tunnel** runs through the big round hill in the west. Map names use Fortnite-style lettering: heavy white capitals with a dark outline.

**Settings → Island season** picks the island: *Summer*, *Winter* (snow, frosted trees, falling snow, pale sky) or *Desert* (sand, dry scrub, saguaro cacti, warm sky). *Auto* uses Winter from December to February and Summer otherwise. The island is generated on load, so the change applies after the reload button.

## Map, storm & spectating

- The compass at the top shows your heading plus your marker, pings and (when you're outside) the direction of the safe zone. Outside the next circle, the minimap draws a dashed line to it and the storm label shows the distance.
- **Spectating** shows the watched player's full HUD: their weapon, ammo, inventory slots, materials and bars. While alive you see how many eliminated players are watching you (everyone you eliminated, and whoever they eliminated).
- **Audio:** other players' heals (a gulp for drinks, a rip for bandages and medkits) and reloads are audible nearby. Footsteps change with the surface: wood, metal, stone, water, snow, sand or grass. Settings have separate **Effects**, **Music** and **Interface & voice** volume sliders.
- The kill feed shows the weapon and the distance of each elimination. Damage numbers on the same target stack into one number (Settings to turn off).
- Sounds use 3D (HRTF) positioning, so you can hear whether shots come from in front, behind, above or below.
- **12 storm circles** like Fortnite: 1 damage a second for the first four, 5 at circle 5, 12 at circle 6, 15 at circle 7 and 20 from circle 8. The last four circles move instead of just shrinking. Inside the storm the world goes purple and foggy, lightning flashes, thunder rolls and the screen shakes more the deeper you are.
- **Storm forecast consoles** on top of the four lookout towers show the circle after next (hold interact).
- **Match Overrides:** three times a match an **Override Console** switches on in a town (pink beam, map icon). The first player there picks one of three rules for the whole lobby: Sonic Speed, Constant Heal, Infinite Stamina, Headshot, Overshield, Speed Shooter, Health Siphon, Big Fish, Extra Life or More XP. If nobody reaches it in 45 s, another player picks.
- **Rift Zones:** two towns each match get a rule of their own (low gravity, no building, speed boost or endless ammo), shown by a shimmering dome and a dashed ring on the map.
- **Friendly NPCs** (Scout Rika, Chef Bo, Warden Tomas) stand in three towns: buy an item, take a **bounty** (eliminate a marked player within 2:30 for 300 gold) or **hire** them for 200 gold to follow you and fight.
- **Houses can be flattened:** knock out most of a house's outer walls and the rest of it (upper floor, stairs, roof, chimney) comes down.
- **Storm surge:** from the third circle, while more players are alive than the circle allows, the ones who dealt the least damage take 25 damage every 5 s. The storm line shows your damage against the safe threshold.
- When you're eliminated you spectate whoever got you (then whoever gets them). Click / right-click to switch to the next / previous player; press Space or click **See results** to continue.
- **Visualize sound** (menu/pause) shows icons around the crosshair for gunshots, footsteps, building and nearby chests. It also works with sound muted.

## Building

Every piece costs 10 of the selected material and snaps to Fortnite's 5.12 m × 3.84 m grid, lining up with nearby builds so you can stack walls, floors and ramps. Look up to build a level higher, or look down to put a floor under you.

| Material | Starting → max HP | Time to reach full HP |
| --- | --- | --- |
| Wood | 90 → 150 | 4 s |
| Stone | 99 → 300 | 11.5 s |
| Metal | 110 → 500 | 25 s |

Pieces start weaker (and see-through) and harden while they build. Anything that loses its connection to the ground collapses. Bots box up (four walls + roof) when hurt, heal inside, open windows to shoot back, shoot through your walls and ramp up to high ground.

- **Edits:** walls and floors use the 3×3 tile grid. Editing a **ramp** cycles full → left half → right half → turned around; editing a **cone** turns it into a **half cone** rising the way you look.
- **Pre-edits:** in build mode with a wall or floor, press edit while not looking at a build of yours to shape the blueprint; every piece you place comes out edited until you clear it with the **reset-edit** key (U).
- **Rotate ramps** before placing with the reload key (R) in build mode. **Change material** with right-click or L.
- Settings: **Simple Build** (fire places walls, aim places a floor, ramp or cone depending on where you look), **Pre-edits** on/off and **Confirm edit on release**.
- Chests give 30 of each material, and material piles lie around the towns.
- **Loot placement like Fortnite:** most chests are in the named places. Enterable homes have indoor chest spots (downstairs and upstairs), other buildings one by the wall, and each spot spawns 60% of the time (Fortnite: 50–70%), so a village has ~25–30 chests. Only a few chests sit out in the wild (some crate piles, landmarks, islands). About 7% are rare chests. Floor loot fills most rooms, porches and plazas (~800 items a match), plus ~300 ammo boxes. Plain villages are Fortnite-POI sized: two rings of ~16 buildings round the plaza.

## Graphics settings

The start menu and pause screen have a **Graphics** selector:

| Setting | What you get |
| --- | --- |
| **Auto** (default) | High on desktop, Low on phones. Drops a level automatically if the frame rate stays under ~42 fps. |
| **High** | Ambient occlusion (N8AO), bloom, color grading, SMAA, 2048 shadow map, full grass, detailed trees out to 95 m |
| **Medium** | Bloom + color grading + SMAA, no ambient occlusion, less grass, detailed trees to 70 m |
| **Low** | No post-processing, 1024 shadows, sparse grass, pixel ratio 1, detailed trees to 45 m |

## How a match works

1. The Storm Bus flies across the island at 320 m (you can see the whole island below). Jump when you like (it drops you at the end otherwise).
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
- **Terrain:** a 3.1 km height grid (4 m cells) from fbm noise, drawn as chunks so only nearby ground is rendered. Trees, bushes, rocks and town props use streamed instancing (only instances near the camera are uploaded), and small props beyond the fog are hidden. `heightAt(x, z)` is bilinear, and everything (movement, grass, bullets, camera) uses it. Towns are flattened plateaus.
- **Foliage:** instanced trees (round, pine, some autumn), rocks and bushes. Grass is one instanced draw call with a wind-sway vertex shader that samples a height texture and wraps around the player.
- **Characters:** Quaternius outfit characters (Ranger and Peasant, male and female). Everyone, bosses included, uses these same rigs so no one looks out of place; the older KayKit hero skins map onto them with their own colour tint and hats sit on the head bone. Each player/bot is a `SkeletonUtils.clone` with a subtle color tint; the default outfit is the Trail Ranger. Animation runs on two layers: the legs play run / strafe / backpedal / jump while the upper body plays aim / shoot / reload. Crossfades take 0.2 s and running speed follows movement speed.
- **Houses:** built from Medieval Village MegaKit pieces on the kit's 2 m grid (all houses share one instanced mesh per piece; a broken wall panel just hides its instances) in local space, then placed with a 90° rotation so every collider stays an axis-aligned box. Stairs and roofs use ramp colliders. Bots route through the house with a small portal graph (outside ↔ front door ↔ room A ↔ interior door ↔ room B, and room A ↔ stairs ↔ upstairs), walk around corners when the door is on the far side, and walk off roofs they land on.
- **Performance:** instancing, object pools for effects, bot "think" every ~0.3 s, animation LOD for far characters, and lower pixel ratio / shadows / grass on mobile.
- **Post-processing:** [`postprocessing`](https://github.com/pmndrs/postprocessing) + [`n8ao`](https://github.com/N8python/n8ao): ambient occlusion, bloom on glowing things (loot beams, chests, muzzle flashes, sun), a warm/cool color grade and SMAA.
- **Baked lighting:** at load the game traces sun rays from every terrain point against houses, tree canopies, rocks and the mountain. That gives soft shadows and ambient occlusion across the whole island. Near the player they fade into the real shadow map.
- **Water:** depth-tinted from the terrain height (turquoise shallows, deep blue sea), animated shore foam, small waves.
- **Life:** wind-swaying trees and palms, falling leaves, birds, fountain spray, chest sparkles, dust puffs, skydive speed lines, victory confetti.
- **Assets (CC0 unless noted):**
  - **KayKit** by Kay Lousberg: characters and animations, medieval buildings (homes, tavern, blacksmith, market, church, towers, windmills, castle), the modern downtowns of Retail Row and Tilted Towers (City Builder Bits: buildings, roads, parked cars, street lights), café and porch furniture (Furniture Bits), pine trees, rocks, clouds, crates, barrels, sacks, tents, flags, lumber and the treasure chest. See `public/models/kk/CREDITS.md`.
  - **Kenney:** palms and rock spires. See `public/models/env/CREDITS.md`.
  - **Styloo Guns Asset Pack** (provided by the project owner; see its itch.io page for the license): every gun, the grenades, ammo boxes and rounds, and the vault's weapon board. See `public/models/guns/CREDITS.md`.
  - **Elijah Cobden Stylized Trees Pack** (provided by the project owner; see its itch.io page for the license): detailed oaks, columnar trees and pines near the camera, willows, swiggly trees and dead trees. See `public/models/trees/CREDITS.md`.
  - **Quaternius Stylized Nature:** painted leafy trees (shown near the camera; cheaper trees stand in far away), flowering bushes and clover. See `public/models/nature/CREDITS.md`.
  - **Quaternius Medieval Village MegaKit and Fantasy Props MegaKit** (CC0): the village houses (walls, doors, windows, stairs, roofs) and their furniture. See `public/models/village/CREDITS.md` and `public/models/props/CREDITS.md`.
  - **Quaternius Modular Character Outfits (Fantasy)** and **Universal Animation Library 1 & 2** (CC0): the player and bot characters, their animations and the mannequin heads. See `public/models/outfits/CREDITS.md` and `public/models/anims/CREDITS.md`.
  - **KayKit Resource Bits** (CC0): lumber, stone, fuel and scrap piles. See `public/models/res/CREDITS.md`.
  - **Procedural:** far-away round/autumn trees, bushes, grass, the bus, fences, fountains and lamps are built from low-poly shapes.
  - **Audio:** CC0 Kenney sound samples plus synthesized effects (see `public/audio/CREDITS.md`), the chest hum and chest-opening sounds (clips of Fortnite's, provided by the project owner, not CC0), music from the Sitting on Clouds OST by Rom Di Prisco for the lobby and the Battle Bus (provided by the project owner, not CC0), and CC0 victory / defeat jingles (see `public/audio/music/CREDITS.md`).

