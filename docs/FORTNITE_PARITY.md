# Stormbound vs Fortnite: feature gap list and work plan

Legend: ✅ have · 🟡 partial · ❌ missing · Effort: S (≤½ day) · M (1–2 days) · L (3+ days)

> IP note: we copy *mechanics and feel*, never Fortnite's names, logos, characters, sounds or UI art.
> Terms to avoid shipping: "Victory Royale", "V-Bucks", "Battle Pass", "Chug Jug", "Slurp", "Battle Bus"
> (ours is now the **Storm Bus**; the end screen says "#1 VICTORY!").

---

## 1. In-match features

### 1.1 Drop / start of match
| Feature | Fortnite | Stormbound | Gap |
|---|---|---|---|
| Warm-up island before match (players fight, respawn) | ✅ | ❌ | Bots + player spawn on a small island for ~20 s, infinite respawn |
| Flying bus crossing the map, jump anytime | ✅ | ✅ | — |
| Bus route shown on map + "doors open" timer | ✅ | 🟡 route on minimap only | Full map + countdown banner |
| Skydive steering, dive faster | ✅ | ✅ | — |
| Glider auto-deploy + manual deploy | ✅ | ✅ | — |
| Glider redeploy (item / during storm phases) | ✅ | ❌ | Launch pads + redeploy item |
| Landing animation / camera | ✅ | ✅ | — |

### 1.2 Movement
| Feature | Fortnite | Stormbound | Gap |
|---|---|---|---|
| Walk / run / jump | ✅ | ✅ | — |
| Sprint (hold Shift) | ✅ | ❌ | S |
| Crouch (smaller hitbox, more accuracy) | ✅ | ❌ | S |
| Slide (sprint + crouch) | ✅ | ❌ | M |
| Mantle / ledge climb | ✅ | ❌ | M |
| Swimming (surface swim, fish) | ✅ | 🟡 slow wading | M |
| Fall damage | ✅ | ❌ | S |
| Launch pads / jump pads, ziplines, vehicles | ✅ | ❌ | M / L |

### 1.3 Weapons & combat
| Feature | Fortnite | Stormbound | Gap |
|---|---|---|---|
| Hitscan AR / SMG / pistol / shotgun | ✅ | ✅ | — |
| Sniper (projectile w/ drop, scope) | ✅ | ❌ | M |
| Rocket launcher / explosives | ✅ | ❌ | M |
| Grenades (throwable arc) | ✅ | ❌ | M |
| Rarity tiers grey→gold (+ mythic) | ✅ | ✅ 5 tiers | mythic optional |
| Aim-down-sights zoom | ✅ | ✅ right click | scope overlay for sniper |
| Bloom / first-shot accuracy / recoil | ✅ | ✅ | first-shot accuracy when still: S |
| Headshots, damage falloff | ✅ | ✅ | — |
| Ammo types + reserve ammo, ammo boxes | ✅ | ❌ infinite reserve | M |
| Pickaxe melee + harvesting | ✅ | ❌ | M |
| Weapon swap / drop / auto-pickup ammo & mats | ✅ | 🟡 swap on pickup only | S |
| Hit markers, damage numbers (white / blue shield / yellow head) | ✅ | ✅ | shield-blue numbers: S |
| Damage direction indicator | ✅ | ✅ | — |
| Elimination effect + sound | ✅ | ✅ | — |
| Downed/knocked (team modes) | ✅ | ❌ | only with teams |
| Spectate killer after death | ✅ | 🟡 camera stays on body | M |

### 1.4 Building
| Feature | Fortnite | Stormbound | Gap |
|---|---|---|---|
| Wall, ramp | ✅ | ✅ | — |
| Floor, cone (roof) | ✅ | ❌ | M |
| Build preview ghost + grid snapping | ✅ | ❌ instant place | M |
| 3 materials (wood / brick / metal) with build-up HP | ✅ | 🟡 wood only | M |
| Edit mode (windows/doors/half walls) | ✅ | ❌ | L |
| Structural support / collapse | ✅ | ❌ | M |
| Harvest trees/rocks/houses for mats | ✅ | ❌ | M (with pickaxe) |
| "Zero Build" mode | ✅ | ❌ | S once modes exist |

### 1.5 Loot & items
| Feature | Fortnite | Stormbound | Gap |
|---|---|---|---|
| Glowing chests w/ hum + open animation | ✅ | ✅ (no hum) | hum sound: S |
| Floor loot | ✅ | ✅ | — |
| Ammo boxes | ✅ | ❌ | with ammo system |
| Supply drops (airdrop w/ balloon) | ✅ | ❌ | M |
| Loot llama / rare chests | ✅ | ❌ | S |
| Vending machines / NPC shops | ✅ | ❌ | M |
| 5-slot inventory + separate consumables | ✅ | 🟡 3 slots, consumables instant | M |
| Heals with use time (bandage, medkit, small/big shield, splash) | ✅ | 🟡 instant on pickup | M |
| Drop inventory on death as loot pile | ✅ | ✅ | — |

### 1.6 Storm & map
| Feature | Fortnite | Stormbound | Gap |
|---|---|---|---|
| Shrinking storm, phases, damage scaling | ✅ | ✅ 6 phases | — |
| Moving zones in endgame | ✅ | ❌ | S |
| Storm visuals (inside tint, wall) | ✅ | ✅ | inside-storm rain/fog: S |
| Full-screen map (M) w/ POI names, zoom | ✅ | ❌ | M |
| Map markers / pings | ✅ | ❌ | M |
| Compass bar at top | ✅ | ❌ | S |
| Named POIs, "entering X" banner | ✅ | ✅ | — |
| Day/night cycle, weather | ✅ | ❌ | M |

### 1.7 HUD & feedback
| Feature | Fortnite | Stormbound | Gap |
|---|---|---|---|
| Minimap, players left, kills, storm timer | ✅ | ✅ | — |
| Health/shield bars | ✅ | ✅ | — |
| Quick bar with ammo / mats | ✅ | 🟡 | 5 slots + mat types |
| Kill feed | ✅ | ✅ | — |
| XP pop-ups (+50 XP chest opened, elims) | ✅ | ❌ | with progression |
| Visualized sound effects (footsteps/chests/gunfire icons) | ✅ | ❌ | M |
| Emotes in match | ✅ | ❌ | M (KayKit Cheer + a few) |

### 1.8 Audio
| Feature | Fortnite | Stormbound | Gap |
|---|---|---|---|
| Positional 3D audio (panning) | ✅ | 🟡 volume by distance only | S (PannerNode) |
| Footsteps (direction matters!) | ✅ | ❌ | S |
| Music (lobby, bus, end) | ✅ | ❌ | M (procedural or CC0 tracks) |
| Chest hum, storm ambience, glider wind | ✅ | 🟡 | S |

### 1.9 Opponents & modes
| Feature | Fortnite | Stormbound | Gap |
|---|---|---|---|
| 100 players | ✅ | 20 (you + 19 bots) | 40–60 bots possible with LOD: M |
| Bots that loot, rotate, fight, build | ✅ | ✅ | smarter building fights: M |
| Duos/Squads with AI teammates, revive | ✅ | ❌ | L |
| Bosses / NPCs with keycards | ✅ | ❌ | M |
| Real multiplayer | ✅ | ❌ | XL (server needed, out of scope for now) |

---

## 2. Out of match (lobby / meta)

| Feature | Fortnite | Stormbound | Gap |
|---|---|---|---|
| 3D lobby with your character posing, rotating | ✅ | ❌ (orbit over island + title) | M |
| Mode select (Solo / Duo / Squad / Zero Build) | ✅ | ❌ | S–M |
| Matchmaking screen ("Finding match… 17/20") | ✅ | ❌ | S |
| Locker: outfit, back bling, pickaxe, glider, contrail, emote, weapon wrap | ✅ | ❌ | M (outfit = 5 heroes + tints, glider colors, trails) |
| Account level + XP from matches | ✅ | ❌ | S (localStorage) |
| Season "pass" with tiers unlocking cosmetics | ✅ | ❌ | M |
| Daily / weekly quests ("Open 5 chests") | ✅ | ❌ | M |
| Item shop / currency | ✅ | ❌ | M — **earnable coins only, no real money** (see Phase E) |
| Career stats (wins, top 10, K/D, matches) | ✅ | ❌ | S |
| Settings: sensitivity, key rebinding, audio volumes, FOV, HUD scale | ✅ | 🟡 graphics only | M |
| News / patch-notes panel | ✅ | ❌ | S |
| Loading screen with tips / art | ✅ | 🟡 plain loading bar | S |
| Friends / party | ✅ | ❌ | needs backend — skip |
| Replays | ✅ | ❌ | skip |

---

## 3. Work plan (ordered by "feels like Fortnite" per effort)

Each phase ends with a playable build, a screenshot check and a git commit (same flow as before).

### Phase A — Core feel (combat & movement) · ✅ done
1. Sprint (Shift), crouch (C/Ctrl), slide, fall damage, first-shot accuracy when still.
2. Pickaxe (slot 0) with melee swing; harvesting trees/rocks/buildings → wood / stone / metal.
3. Ammo types (light / medium / heavy / shells) with reserve, ammo boxes, auto-pickup of ammo & mats.
4. 5-slot inventory (+ axe slot); consumables with use time (bandage 15 hp, medkit 100 hp, small shield 25, big shield 50).
5. 3D positional audio + footsteps + chest hum.

### Phase B — Building like Fortnite · ✅ done
1. Build mode with ghost preview (Q wall, Z floor, V ramp, X cone — C stays crouch), place with fire button.
2. Three materials (wood/stone/metal): build-up animation, HP grows while building.
3. Structural support (pieces fall when unsupported).
4. Simple edit mode (door/window cut-outs on walls).
5. Bots: box-fight behaviour (build walls/ramps when shot at, high ground).

### Phase C — Map & information · ~2 days
1. Full-screen map (M): POIs, storm circles, bus route, zoom/pan, markers.
2. Pings (middle mouse) + compass bar.
3. Moving storm zones for last 2 phases, rain/fog inside storm.
4. Spectate your killer after elimination.
5. Visualized sound effects (accessibility option).

### Phase D — Loot & world events · ~2 days
1. Supply drops with balloon + smoke, rare chests.
2. Sniper rifle (projectile + drop + scope overlay), rocket launcher, grenades.
3. Launch pads (redeploy glider), jump pads, a couple of vending machines.
4. Day/evening lighting variation per match.

### Phase E — Lobby & progression · ~3 days
1. 3D lobby scene: your hero on a platform, idle/emote animation, "PLAY" + mode select.
2. Matchmaking screen + warm-up island (20 s respawn deathmatch before the bus).
3. Locker: hero (5 KayKit heroes), color tint, glider color, contrail, emote picks — saved in localStorage.
4. XP & levels, end-of-match XP breakdown, career stats page.
5. Daily quests (3 per day), seasonal reward track unlocking locker items.
6. **Item Shop (no real money):** players earn **Storm Coins** from matches (placement, eliminations, quests, level-ups) and spend them on locker cosmetics (hero tints, glider colors, trails, emotes, weapon wraps). Daily rotating offers + featured bundle, preview on your hero, "owned" badges. Everything saved in localStorage; no purchases, no payment code.
7. Settings: sensitivity, FOV, key rebinding, volume sliders, HUD scale.
8. Music: lobby theme, bus/drop sting, victory/defeat jingles.

### Phase F — Scale & modes · ~3+ days
1. 40–60 bots with stronger LOD (animation + logic tiers).
2. Duo/Squad modes with AI teammates, knock & revive.
3. Zero Build mode toggle.
4. NPC boss with keycard vault.

### Not planned (needs servers / licensing)
Real online multiplayer, friends/party, real-money purchases of any kind, replays.
