# Feature audit: Stormbound vs Fortnite Battle Royale Chapter 1 Season 3

**Target:** Fortnite BR, Chapter 1 Season 3 (22 Feb to 30 Apr 2018, patches v3.0 to v3.6). Where a mechanic changed during the season, this audit uses the **end-of-season (v3.6)** value unless noted.

**How this was researched**
- Main source: Epic's patch notes for every Chapter 1 update (v1.6 to v10.x), as transcribed on the Fortnite wiki. They were read through the wiki's MediaWiki API, including page revisions from April 2018.
- Also used:
  - 2018 articles (GamesRadar, GameRevolution, arenafps, Gadget Hacks, Shacknews, GameRant).
  - A pre-June-2018 HUD screenshot.
  - Search snippets from Forbes, GameSpot, Dexerto and others.
- Confidence labels:
  - **✔✔** = two or more independent sources agree.
  - **✔** = one source (usually Epic's own patch-note text).
  - **?** = sources conflict, or no Season 3 value was found.
- Raw notes and fetched pages are in the session scratchpad (`research/`). A short source list is at the end.

**Status column:** `todo` = differs and needs fixing · `ok` = already matches · `decide` = needs your call (see **Decisions** below) · `done` = fixed and committed.

---

## Decisions I need from you first

Each point below is either a place where Season 3 conflicts with something you asked me for earlier, or a place where the sources disagree. I won't guess on any of these.

| # | Topic | Season 3 | What you asked for / what we have | Options |
|---|---|---|---|---|
| D1 | Small Shield stack | **10 per slot** in S3 (cut to 6 in v7.20) ✔ | You asked for max 6 | keep 6 / use 10 |
| D2 | Gold bars | Not in Chapter 1 (added Ch2 S5) ✔ | You asked to bring gold back | keep gold / remove |
| D3 | Vending machines | In S3 from v3.40. They cost **materials**: 100/200/300/400/500 by rarity. One machine = one rarity, 3 offers (one per material). Hitting it cycles the offer ✔✔ | Ours cost gold | S3 materials version / keep gold version |
| D4 | Upgrade benches | Not in Chapter 1 (added Ch2 S1) ✔ | You asked for them | keep / remove |
| D5 | Hiding spots | S3 had only the **Bush** item (Legendary, a wearable disguise that breaks on any damage). Enterable haystacks, dumpsters and bushes came in Ch2 ✔✔ | You asked for bushes to hide in | keep ours / replace with the Bush item / both |
| D6 | Sliding | Not in Chapter 1 (added Ch3) ✔ | You asked for Fortnite-style sliding | keep / remove |
| D7 | Ammo counter | S3 HUD showed **magazine \| reserve** ✔✔ (screenshot) | You asked for magazine / **total** (e.g. 30/252) | keep total / S3 reserve |
| D8 | Pickaxe damage to players | **10** in S3 (raised to 20 in v6.30) ✔ (patch history). One agent read the current wiki value, 20 | We use 20 | 10 / 20 |
| D9 | Storm table | Reconstructed table below. Zone 3/4 timings and the damage steps conflict between 2018 wiki revisions ? | — | use the reconstructed table / keep ours |
| D10 | Bandage use time | 3.5 s (wiki stat tables) vs 4 s (2018 guide) ? | We use 4 s | 3.5 / 4 |
| D11 | Damage-trap reset | 5 s or 6 s ? | We use 3 s | 5 / 6 |
| D12 | Swimming | None in Chapter 1: lakes and rivers were thigh-deep and slowed you; the ocean killed you instantly ✔✔ | We have swimming in lakes and the sea | remove swimming (make lakes shallow, ocean lethal) / keep |
| D13 | Lobby meta (Battle Pass, quests, shop, sprays, lobby music) | S3: 100-tier pass with Battle Stars, weekly/daily challenges, V-Bucks shop. Sprays came in S4 and lobby music in S6 | Ours: coin-based, 26-item pass, sprays, lobby music | include in the audit fixes, or leave the meta alone? |
| D14 | Missing S3 weapons and items | Revolver, Hunting Rifle, Heavy Shotgun, Semi-Auto Sniper, Scoped AR, Suppressed Pistol, Tactical SMG + Suppressed SMG (split), Crossbow, LMG, Remote Explosives, Clinger, Boogie Bomb, Bush, Cozy Campfire | Not in our game | add all (reusing existing gun models) / add some / skip |
| D15 | Quick 90s key (H) and Simple Build | Not in Fortnite (macros) | We have both | remove / keep |

---

## 1. Match flow

| # | Feature | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 1.1 | Pre-game | No warm-up; PLAY goes straight to the bus | **Spawn Island warm-up**: roam, pick up weapons, shoot and build; no health loss (shield can drop); then a 10 s countdown and onto the bus | Warm-up island missing | ✔✔ | todo |
| 1.2 | Bus route | Random straight line; route shown on minimap only while aboard | Random straight line; **route shown on the big map before launch** (v3.0) | Show the route before launch | ✔ | todo |
| 1.3 | Bus altitude / speed | 320 m, 72 m/s, about 45 s flight | About 830 m (2 weak sources). Speed unknown: sources say 60–100 m/s | Altitude probably much higher | ? | decide |
| 1.4 | Thank the bus driver | Yes (E) | **Not in S3** (added v5.30/5.40) | Remove | ✔✔ | todo |
| 1.5 | Skydive | 21–44 m/s fall; steer 24 m/s | Diving is faster; about 45° body angle is fastest overall. Exact speeds unknown | Roughly fine | ? | ok |
| 1.6 | Glider deploy | Auto-opens at 60 m; jump opens early; once opened it stays open | Auto-opens about **100 m** above whatever is below you. **You can switch between skydive and glider any number of times while high enough** (it slows you) | Raise the auto height; allow closing and reopening the glider during the drop | ✔✔ (toggle) / ? (100 m) | todo |
| 1.7 | Redeploy after landing | None | None (launch pads only) | — | ✔✔ | ok |
| 1.8 | Victory | Slow-motion orbit camera, confetti, results after 5.2 s | "#1 Victory Royale" banner, then **you keep control of your character for 10 s**; slow-mo and fanfare came in v5.x | Replace the cinematic with 10 s of control | ✔ | todo |
| 1.9 | Spectate on death | Killer; next/previous; counter | Killer (teammates first); full map, kills, players left and storm timer shown; "You placed X" for 10 s; spectator count | Minor UI check | ✔✔ | todo (small) |
| 1.10 | Victory umbrella | None | First S3 win unlocks the Paper Parasol glider | Add as a reward | ✔ | todo (meta, see D13) |
| 1.11 | Modes | Solo (99 bots), Quick (29 bots, storm ×1.6) | Solo / Duos / Squads plus LTMs | Solo only is fine vs bots; Quick is ours | — | ok |

## 2. Movement

| # | Feature | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 2.1 | Run / sprint / crouch speeds | 6.4 / 8.32 / 3.4 m/s | **No S3 numbers found.** Run speed was "365" units (from v5.00 "365 → 410", which may be Save the World only). Modern values: 5.48 run / 7.39 sprint / 4.18 crouch | Can't match exactly | ? | decide |
| 2.2 | Sprint | Hold key, no stamina | Sprint key with no stamina ✔✔. "Sprint by Default" was **not in S3** (v5.10) | Remove the Sprint-by-default setting (optional) | ✔✔ | todo (small) |
| 2.3 | Pickaxe swing slow | None | **−20% movement while swinging** the pickaxe | Add | ✔ | todo |
| 2.4 | Weapon speed penalty | Minigun ×0.88 | None for any weapon (GamesRadar timed runs); ADS slow exists but value unknown | Remove the Minigun penalty | ✔✔ | todo |
| 2.5 | Jump | 8.2 m/s, about 1.4 m | Value not found. **Jump fatigue**: repeated jumps lose height after 3–4 | Add jump fatigue (exact numbers unknown) | ✔✔ (exists) | todo |
| 2.6 | Fall damage | None below 12.5 m, lethal at about 23 m, health only | Starts just above 3 floors (~11.5–12.8 m) at about 10 damage; lethal at 6 floors (~23 m); ignores shield; none when landing on tires (v3.6) | Matches | ✔✔ | ok |
| 2.7 | Slide / slide kick | Yes | Not in Ch1 | See D6 | ✔ | decide |
| 2.8 | Hurdle / vault | Sprinting into low obstacles vaults them | Not in Ch1 (hurdling came in Ch4) | Remove | ✔ | todo |
| 2.9 | Swimming | Deep water swim 4.4/5.8 m/s | None in Ch1 | See D12 | ✔✔ | decide |
| 2.10 | Ladders | Lookout towers with ladders | **No evidence of ladders in Ch1 BR** | Remove the towers or make them plain | ? | decide |
| 2.11 | Doors | E to open; bots auto-open; 120 HP | Interact to open; can be opened in build mode; an auto-open doors option existed | Fine | ✔ | ok |
| 2.12 | Healing while moving | Capped at 3.2 m/s | Must stand still (e.g. "Small Shield cannot be consumed while moving") | Stop movement while healing | ✔✔ | todo |

## 3. Weapons (end of S3 values)

**Rarities in S3:** Common, Uncommon, Rare, Epic, Legendary.

**Hitscan guns: damage, headshot and fall-off** (fall-off added in the v3.40 content update)

| # | Weapon | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 3.1 | Assault Rifle (M16 / SCAR) | C–L 30/31/33/35/36, 5.5/s, 30 rounds, reload 2.3 s ×rarity, 2× head, fall-off 60 → 230 m to 60% | Same damage, rate and magazine ✔✔. Reload 2.28/2.23/2.18/2.12/2.07 s. **2× head** ✔. **Fall-off: 100% to 50 m, 80% at 75 m, 65% at 100 m** ✔✔. Structure damage 33 | Fix reloads and fall-off | ✔✔ | todo |
| 3.2 | Burst AR | C–L 27–33 | **C–R only: 27/29/30**; 4.06 bursts/s; reload 2.86/2.73/2.6 s; 2× head; fall-off as AR | Remove Epic/Legendary; rate | ✔ | todo |
| 3.3 | SMG | One "SMG": C–R 17/18/19, 12/s, 30 rounds | Two guns: **Tactical SMG** U–E 16/17/18, 13/s, 35 rounds, reload 2.4/2.3/2.2 s; **Suppressed SMG** C–R 17/18/19, 9/s, 30 rounds, reload 2.2/2.1/2.0 s. Fall-off 24 m → 80% at 35 m → 65% at 50 m | Split into two | ✔✔ | todo (D14) |
| 3.4 | Pistol | C–U 23/24, 6.75/s, 16 rounds | **C–R 23/24/25**; reload 1.54/1.47/1.4 s; fall-off 28 m → 85% at 47.5 m → 75% at 70 m | Add Rare; reload; fall-off | ✔ | todo |
| 3.5 | Hand Cannon | E–L 75/78, 0.8/s, 7 rounds, 2.5× head | Same; 2× head after v3.40; reload 2.09/1.98 s; fall-off 35 m → 70% at 60 m → 40% at 85 m | Head 2×; fall-off | ✔✔ | todo |
| 3.6 | Minigun | E–L 18/19, medium ammo, 100 magazine + reload, 2.5× head | 18/19 (v3.6) ✔✔; **light ammo**; no magazine (overheats instead of reloading); 2.5× head; spin-up and overheat times not found | Ammo type; overheat instead of reload | ✔ / ? | todo |
| 3.7 | Pump Shotgun | U–R **80/85**, 2× head, 0.7/s, 5 shells | **U–R 90/95**, **2.5× head** ✔✔; 0.7/s; 5 shells; reload 4.84/4.62 s (shell by shell); fall-off 100% to 7.68 m, 70% at 18 m, 20% at 30 m, 0 at 41 m; structure 100; pellet count not found | Damage, head multiplier and fall-off wrong | ✔✔ | todo |
| 3.8 | Tactical Shotgun | C–R 67/70/74, 2× head, 1.5/s, 8 shells | Same damage ✔✔; **2.5× head**; reload 6.27/5.99/5.7 s; structure 70 | Head multiplier | ✔✔ | todo |
| 3.9 | Heavy Shotgun | Missing | E–L 74/77, 2.5× head, 1.0/s, 7 shells, reload 5.94/5.63 s, 5 pellets | Add | ✔✔ | todo (D14) |
| 3.10 | Bolt-Action Sniper | R–L 105/110/116, 2.5×, reload 3.33 ×rarity | Same damage ✔✔; reload 3.0/2.85/2.7 s ✔; projectile (S3 speed and drop not found) | Matches | ✔✔ | ok |
| 3.11 | Semi-Auto Sniper / Hunting Rifle / Crossbow / Scoped AR / Revolver / Suppressed Pistol / LMG | Missing | Semi-Auto E–L 63/66; Hunting U–R 86/90 (no scope); Crossbow R–E 75/79; Scoped AR R–E 23/24; Revolver C–R 54/57/60; Suppressed Pistol E–L 26/28; LMG R–E 25/26 (from 19 Apr) | Add | ✔/✔✔ | todo (D14) |
| 3.12 | Rocket Launcher | R–L 110/116/121, reload 3.1 s ×rarity, 375 to builds, 55 m/s | Same damage and 375 ✔✔; **reload 2.3/2.185/2.07 s**. Rocket speed: the Guided Missile (1300 units/s = 13 m/s) was "slightly slower than a regular rocket", so rockets were roughly 15 m/s. Our 55 m/s is far too fast (single inference) | Reload; rocket speed | ✔✔ / ? | todo |
| 3.13 | Grenade Launcher | R–L 100/105/110, 220 to builds, reload 3.6 s | Same damage ✔✔; **375 to builds**; reload 3.0/2.85/2.7 s | Build damage; reload | ✔✔ | todo |
| 3.14 | Loot pool | Our 11 guns | End-of-season pool (see 3.1–3.13) | Depends on D14 | ✔ | decide |

## 4. Combat mechanics

| # | Feature | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 4.1 | First-shot accuracy | Pistol, AR, Burst, Hand Cannon; still for 0.5 s | From v3.40: Suppressed and Tactical SMG, pistols, Revolver, Hand Cannon, AR, Burst. Needs **aiming (ADS)**, standing still, not having fired recently; the reticle closes fully. Resets on crouch/uncrouch/weapon switch (v3.6). Reset time not found | Add SMGs; require ADS; reset rules | ✔✔ | todo |
| 4.2 | Bloom / crouch / sprint spread | Crouch ×0.7, moving ×2.2 | Crouch spread benefit 25%; sprint spread penalty 50% (both until v5.40); no fixed recoil pattern | Crouch 0.75; sprint penalty | ✔ | todo |
| 4.3 | Damage fall-off | Linear to 60% at max range | Per-weapon steps (table in 3.x); before v3.40 there was none. Fall-off also applied to structure damage | Use the S3 tables | ✔✔ | todo |
| 4.4 | Headshots | 2× (2.5× sniper, Minigun, Hand Cannon) | 2× for AR, SMGs, pistols, Revolver, Hand Cannon, Burst (from v3.40); **2.5× for shotguns, snipers, Crossbow, Minigun**; explosives and grenades can't crit | Shotguns 2.5×, Hand Cannon 2× | ✔✔ | todo |
| 4.5 | Damage number colours | White body, blue shield, yellow head | White health, blue shield, **crits against shields are also blue** (v1.7.1); yellow only for crits on health | Headshot on shield → blue | ✔ | todo |
| 4.6 | Hit markers | White/yellow/blue/red | Hit markers present; red on eliminations | Fine | ✔ | ok |
| 4.7 | Reticles | Per weapon | Four-arm bloom cross (closes on first-shot accuracy); shotguns centre point; scopes | Fine | ✔ | ok |
| 4.8 | Equip / swap | Draw times; +0.6 s shotgun→shotgun | v3.5: equip time on shotguns, Revolver, Hand Cannon and rocket (snipers reverted in v3.6); no pump-after-swap. Absolute times not found | Keep; review | ? | ok |
| 4.9 | Explosions vs builds | Radius falloff | Only damaged structures **visible from the blast centre** (until v4.50) | Add line-of-sight check | ✔ | todo |
| 4.10 | Structure damage by guns | 90% of damage | Per-weapon structure values (e.g. AR 33, Pump 100, Tactical 70, Sniper 105) | Use per-weapon values | ✔ | todo |

## 5. Consumables, throwables, traps

| # | Item | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 5.1 | Bandages | +15 up to 75, 4 s, 5 per pickup / 15 per slot | +15 up to 75, **3.5 s or 4 s**, 15 per slot | D10 | ? | decide |
| 5.2 | Med Kit | +100, 10 s, max 3 | Same | — | ✔✔ | ok |
| 5.3 | Small Shield | +25 up to 50, 2 s, 3 per pickup / max 6 | Same, but **max 10** | D1 | ✔ | decide |
| 5.4 | Shield Potion | +50, 5 s, max 2 | Same | — | ✔✔ | ok |
| 5.5 | Slurp Juice | +1 HP & +1 shield per 0.5 s up to 75 each | **+1 HP & +1 shield per second for 25 s (25 + 25)**; 2 s drink; max 2 (75 came in v5.10) | Amount and rate wrong | ✔ | todo |
| 5.6 | Chug Jug | Full HP+shield, 15 s, max 1 | Same | — | ✔✔ | ok |
| 5.7 | Cozy Campfire | Not dropping | Rare trap: floor only, 2 HP/s for 25 s to everyone nearby, stacks | Add to loot | ✔✔ | todo (D14) |
| 5.8 | Bush item | Missing | Legendary disguise, 3 s, breaks on any damage | Add | ✔ | todo (D5) |
| 5.9 | Grenade | 100 dmg, **180 to builds**, 2.2 s fuse, max 10 | 100 / **375 to builds**, **3 s fuse**, max 10, 3 per pickup, can't crit | Build damage; fuse | ✔ | todo |
| 5.10 | Impulse Grenade | Max 9, 3 per pickup | **Max 8** in S3 (9 from v5.30); knockback only; fall-damage kills credit the thrower | Stack | ✔ | todo |
| 5.11 | Remote Explosives / Clinger / Boogie Bomb | Missing | Remote: 70 / 800, 4 per pickup, max 10. Clinger (v3.6): 100 / 200, sticks, 2.5 s. Boogie: forced 5 s dance | Add | ✔✔ | todo (D14) |
| 5.12 | Damage Trap | 150 dmg, full tile on own floor/wall/ceiling, 3 s re-arm, uses an inventory slot | **125 dmg** ✔✔; floor/wall/ceiling of **player-built or world structures**; re-arm 5–6 s; lives in the **build menu trap slot, not the inventory** | Damage; world surfaces; trap slot; re-arm | ✔✔ / ? | todo |
| 5.13 | Launch Pad | Placed 2.4 m ahead on ground; inventory slot | Epic trap, **floor only** (placed on a build floor or flat ground), unlimited uses, destructible, lives in the trap slot | Trap slot; placement | ✔ | todo |
| 5.14 | Port-a-Fort | 4-storey metal tower; tire gives no fall damage; max 2 | **3-storey** metal tower with a door, tires inside; **tires don't give fall immunity after v3.6** (landing on tires takes no damage); max 5 | Height; stack; tire rule | ✔✔ | todo |

## 6. Inventory and pickup

| # | Feature | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 6.1 | Slots | Pickaxe + 5 | Pickaxe + 5; ammo, materials **and traps** take no slot | Traps should go to the build menu | ✔✔ | todo |
| 6.2 | Auto-pickup | Ammo, materials, gold always; guns and consumables when they fit (default on) | Auto for **ammo, materials, traps** only. Weapons and consumables need Interact (their auto-pickup option came in v4.20) | Turn off auto-pickup of guns and consumables | ✔✔ | todo |
| 6.3 | Auto-sort consumables | Setting, on | Came in v5.30 | Remove / turn off | ✔ | todo |
| 6.4 | Full inventory | Swap with the held item | Swap with the held item; "Backpack full" if holding the pickaxe | Fine | ✔ | ok |
| 6.5 | Ammo per pickup | Light 18, medium 20, shells 5, heavy 6, rockets 3 | **Light 12, medium 10 (solo), shells 5, heavy 6, rockets 2** | Light, medium, rockets | ✔ | todo |
| 6.6 | Caps | 999 ammo, 999 materials | 999 / 999 | — | ✔✔ | ok |
| 6.7 | Drop on death | Everything; bots drop at least 50 materials | Everything | Fine | ✔ | ok |

## 7. Loot sources

| # | Feature | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 7.1 | Chest spawn chance | 70% | **50–70%** per spot (60–80% was an LTM) | Lower slightly | ✔ | todo |
| 7.2 | Chest contents | Gun + ammo + consumable + extra ammo + 30 of one material + gold | **Gun (Uncommon+) + its ammo + 30 of one material + a consumable/trap/utility** | Remove the extra ammo box (and gold per D2) | ✔✔ | todo |
| 7.3 | Chest HP / breakable | Not breakable | 500 HP (v3.30), can be broken with the pickaxe | Add | ✔ | todo |
| 7.4 | Ammo box spawn / HP | 82% / not breakable | **65–80%**; 250 HP | Lower chance; breakable | ✔ | todo |
| 7.5 | Supply drops | Fixed at 180/390/600/810 s; 110 m up; falls 5.5 m/s | **Every 180 s ± 30 s**; 60 s descent; balloon HP 500 (Solo, v3.6); epic/legendary gun + ammo + consumables + materials (+ traps) | Timing randomness; descent; balloon HP | ✔ | todo |
| 7.6 | Supply Llama | 3 per match; 500 of each material; ammo; 2 shields, 10 bandages, 2 traps, 1 launch pad + 1 heal; gold | 3 per match; **500 of each material, 10 stacks of each ammo, 3 traps and consumables**; opened by search **or by destroying it** (1500 HP, v3.5) | Traps 3; destructible | ✔✔ | todo |
| 7.7 | Floor loot | Weapon / consumable / ammo spots | Fixed spawn points; exact rates not found | Fine | ? | ok |

## 8. Harvesting

| # | Feature | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 8.1 | Pickaxe vs objects | 50 (100 weak point) | 50 (100 weak point); weak point appears after the first hit and moves each hit | Matches | ✔✔ | ok |
| 8.2 | Pickaxe vs builds | 50 own / 75 enemy | **50 enemy, 25 friendly** (75 came in v5.10) | Fix | ✔ | todo |
| 8.3 | Materials per swing | 7–10 per swing, double on weak point, +12 on destroy | Each object has a total resource value (±15% after v3.40), handed out in proportion to damage (a tree gives about 50 wood in total). Exact per-object numbers not found | Switch to a per-object total paid out by damage | ✔ / ? | todo |
| 8.4 | Trees fall over | Yes | No (physics trees came in Ch3); trees just break | Remove toppling | ✔ | todo |

## 9. Building and editing

| # | Feature | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 9.1 | Wall HP (start → max) / build time | Wood 90→150 / 4 s; stone 99→300 / 11.5 s; metal 110→450 / 25 s | **Wood 100→200 / 5 s; stone 90→300 / 12 s; metal 80→400 / 20 s** (the 150/500 values came in v5.10) | All values | ✔✔ (wood, metal) / ✔ (stone) | todo |
| 9.2 | Other pieces' HP | Same as walls | Not found for S3 | — | ? | ok |
| 9.3 | Cost | 10 | 10; edits free | — | ✔ | ok |
| 9.4 | Turbo build | 0.09 s between pieces | **0.15 s** (0.05 s came in v4.30) | Slower | ✔✔ | todo |
| 9.5 | Auto material change | Uses the material you have most of | Switches to the **next** material that has stock (v3.0, toggle) | Order | ✔✔ | todo |
| 9.6 | Build through objects | Needs checking | You can place through trees, rocks and cars (v3.0); only terrain or builds give support | Verify | ✔✔ | todo (verify) |
| 9.7 | Structural collapse | Flood fill from ground, staggered break | Same idea | Fine | ✔✔ | ok |
| 9.8 | Edit grids | Wall 3×3; floor, ramp and cone 2×2 | Wall 3×3 ✔✔; floor 2×2 ✔✔ (the wiki says 3×3, guides say 2×2); cone 2×2 ✔✔; **stairs: drag path, 4 corners + 4 edges** ? | Stairs layout uncertain | ✔✔ / ? | decide |
| 9.9 | Edit confirm | G again, or "confirm on release" setting | Press edit again; **confirm-on-release came in Ch2** | Remove the setting | ✔✔ | todo |
| 9.10 | Edited tiles | Removed | Removed tiles show **see-through** until v4.5 | Fine | ✔ | ok |
| 9.11 | Whose builds | Own only | Own and teammates' only | Fine | ✔✔ | ok |
| 9.12 | Pre-edits | Yes | Yes | — | ✔ | ok |
| 9.13 | Keys | Q/Z/V/X pieces, B build mode, G edit | PC S3 defaults: Q build mode, F1–F5 wall/floor/stairs/roof/trap, G edit | Defaults differ (rebindable anyway) | ✔✔ | decide |
| 9.14 | Quick 90s, Simple Build | Yes | Not Fortnite | See D15 | — | decide |

## 10. Storm

| # | Feature | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 10.1 | Phase timings | Waits/shrinks 200/180, 120/120, 90/90, 80/70, 50/40, 30/40, 30/40, 20/45, 15/60 | Reconstructed: **3:20/3:00, 2:30/1:30, 2:00/1:00–1:30, 2:00/1:00, 1:30/0:40, 1:30/0:30, 1:00/0:25, 1:00/0:25, 0:45/0:25** (about 25 min in total) | Several phases | ✔ / ? | todo (D9) |
| 10.2 | Damage per second | 1, 1, 2, 5, 5, 8, 10, 10, 10 | **1, 1, 2, 5, 10, 10, 10, 10, 10** (the 8 in zone 5 came in v6.20) | Zones 5–6 | ? | todo (D9) |
| 10.3 | Circle sizes | 800/500/300/175/95/50/25/10/0 m | Not found; the pattern roughly halves each circle (zone 7 = 12.5 m, zone 8 = 6.25 m radius before v6.00) | Smaller late circles | ? | todo |
| 10.4 | Circle position | **Bug: every centre stays within 325 m of the map centre** | Each eye randomly inside the previous one; no moving zones | Fix the bug | ✔✔ | todo |
| 10.5 | First circle | Shown immediately with a 200 s wait | About 1 min after the drop phase, then shown | Add the grace period | ✔ | todo |
| 10.6 | Damage vs shield | Health only | Health only | — | ✔✔ | ok |
| 10.7 | Visuals / sound | Purple wall, tint, thunder, "RUN!" text | Blue/purple wall; ticking clock before shrink; timer icons (stopwatch while waiting, storm cloud while shrinking) | Add the ticking clock; icons | ✔ | todo |

## 11. HUD

| # | Feature | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 11.1 | Layout | Minimap top right; health and shield bottom left; quick bar bottom right | Minimap top right; storm timer, players-alive and **skull kill icon** under it; **health/shield bars bottom centre**; quick bar bottom right; build bar and materials above it | Move health/shield to centre; skull icon | ✔✔ | todo |
| 11.2 | Ammo readout | Magazine / total | Magazine \| reserve | D7 | ✔✔ | decide |
| 11.3 | Pings | World pings, danger pings, map marker | **Map markers only** (big map; shown on minimap and compass); **Squad Comms wheel** v3.50; world pings came in v8 | Remove world pings | ✔✔ | todo |
| 11.4 | Big map zoom | 1–8× | Zoom added in v3.40 | Fine | ✔ | ok |
| 11.5 | Kill feed | Top left, distance shown | Bottom left; distance for kills over 50 m (v3.40) | Position; distance rule | ✔ | todo |
| 11.6 | Sound visualisation, HUD layout editor | Yes | Sound visualisation was mobile only (v3.50); no HUD layout editor (HUD scale only) | Remove or hide | ✔ | todo |
| 11.7 | Structure HP bar | Yes | Yes | — | ✔ | ok |
| 11.8 | Pickup notes, damage direction | Yes | Yes | — | ✔ | ok |

## 12. Map and world

| # | Feature | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 12.1 | Named places | 17 towns; Loot Lake is a village; Moisty Mire and Wailing Woods unbuilt | **19**: Pleasant Park, **Loot Lake (a lake with a house on an island)**, **Moisty Mire (swamp)**, Retail Row, Fatal Fields, Anarchy Acres, **Wailing Woods**, Lonely Lodge, Greasy Grove, Flush Factory, Salty Springs, Dusty Depot, Tomato Town, Tilted Towers, Shifty Shafts, Snobby Shores, Haunted Hills, Junk Junction, Lucky Landing (v3.1) | Fix Loot Lake; add Moisty Mire and Wailing Woods | ✔✔ | todo |
| 12.2 | Ocean | Swimmable | **Touching the ocean kills you instantly**; island edges are cliffs | D12 | ✔✔ | decide |
| 12.3 | Lakes / rivers | Deep water swims; shallow water ×0.65 | Thigh-deep, slower wading (amount not found); water doesn't block bullets | D12 | ✔✔ | decide |
| 12.4 | Day / night | Day, then golden hour at 4 min | Day/night cycle existed (length not found) | Keep | ✔ | ok |
| 12.5 | Weather | Clear | None | — | ✔ | ok |
| 12.6 | Meteor | None | Meteor in the sky from 20 Mar, getting closer; meteorites falling from 26 Apr | Add a sky meteor (visual) | ✔ | todo |
| 12.7 | Vehicles, foraged food | None | None | — | ✔✔ | ok |
| 12.8 | Fuel barrels, fire | Explode and spread fire | Not an S3 mechanic (fire came in Ch2) | Remove | ? | decide |

## 13. Audio

| # | Feature | Ours now | Fortnite S3 | Difference | Conf. | Status |
|---|---|---|---|---|---|---|
| 13.1 | Chest hum | Within 18 m | Ambient hum and glow | Fine | ✔✔ | ok |
| 13.2 | Footsteps / building | Per surface; hearing range 40 m | Per surface; enemy steps louder | Fine | ✔ | ok |
| 13.3 | Storm ticking clock | None | Ticking before shrinking | Add | ✔ | todo |
| 13.4 | Low-health heartbeat | Removed | None in Ch1 | — | ✔ | ok |

## 14. Lobby and meta (see D13)

| # | Feature | Ours now | Fortnite S3 | Status |
|---|---|---|---|---|
| 14.1 | Battle Pass | 26 items, 4 pages, coins | 100 tiers, Battle Stars (10 = 1 tier), 950 V-Bucks, free and premium tracks | decide |
| 14.2 | Challenges | 3 dailies, 7 weeklies | 10 weeks of 7 challenges (normal 5 stars, HARD 10 stars); up to 3 dailies | decide |
| 14.3 | Item Shop | 2 featured + 6 daily, coins | 2 featured + 6 daily, V-Bucks | ok |
| 14.4 | Cosmetic types | Hero, back bling, tool, glider, contrail, emote, spray, loading screen, lobby music | Outfit, back bling, pickaxe, glider, skydiving trail, emotes, loading screen, banner. **No sprays (S4) or lobby music (S6)** | decide |

## 15. Bugs found during the audit (not Fortnite differences)

| # | Bug | Status |
|---|---|---|
| B1 | Storm centres always stay within 325 m of the map centre (`Storm._pickCenter`) | todo |
| B2 | The weekly quest "Destroy 50 trees" can never progress (`Meta.track` returns early for `tree`) | todo |
| B3 | In Quick Match, supply-drop times aren't scaled with the faster storm | todo |
| B4 | Shooting a fuel barrel never damages the shooter (only its fire can) | todo |

## 16. Already changed this session to match S3

These were fixed before this audit was started.
- Season 3 weapon damage and loot pool.
- 999 ammo and material caps.
- 9-phase storm with no surge and no moving zones.
- Removed bosses, rifts, overrides, weather, crown, tactical sprint, mantling, wall jumps, roll landing, door bash, redeploy, ziplines, ascenders, balloons and forecast consoles.
- Traps cover a full tile.
- Rockets are now visible.
- Stairs now have steps.
- No damage numbers on builds.

---

## Main sources
- Epic patch notes via the Fortnite wiki: `fortnite.fandom.com/wiki/Update_v3.00` … `Update_v3.60`, `Content_Update_v3.40`, `Content_Update_v3.50`, plus v1.6–v10.x for "changed later" history.
- Fortnite wiki pages (current text and April-2018 revisions): weapon pages with version tables, The Storm, Building, Battle Bus, Glider, Damage Trap, Supply Drop, Supply Llama, Vending Machine, Ammunition, Pickaxe, Season 3, Season 3 Battle Pass, Weekly Challenges.
- 2018 articles:
  - GameRevolution (Hand Cannon, Heavy Shotgun, Crossbow, LMG).
  - arenafps (double pump, bloom, first-shot accuracy).
  - GamesRadar (fall faster, run speed, myths; July 2018).
  - Gadget Hacks (editing, March 2018).
  - Shacknews / GameRant (v3.5 equip times).
  - technik-consulting (bus and glider).
  - Dexerto / DotEsports (fall damage).
  - gaming-tools HUD screenshot (pre-v4.3).
