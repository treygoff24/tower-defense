# Tower Defense Game Design Spec

## Overview

A multiplayer web-based co-op PvE tower defense game inspired by Burbenog TD. Players choose elemental classes, build towers along fixed paths, trigger elemental reactions through tower synergies, and defend against waves of fantasy enemies together. Built for 1-6 players with persistent meta-progression across sessions.

**Team:** Trey, Matt, Milk

---

## Core Pillars

1. **Co-op First** — Shared economy, shared map, succeed or fail together
2. **Elemental Identity** — 4 distinct elemental classes with unique towers and passive modifiers
3. **Synergy Depth** — 3-layer tower interaction system (proximity, reactions, chain triggers)
4. **Progression Hook** — Persistent meta-progression that keeps players coming back
5. **Accessible Range** — Solo-viable through 6-player parties with dynamic difficulty scaling

---

## Game Flow

### Session Structure

1. **Lobby** — Host creates game, sets difficulty, invites players (1-6)
2. **Class Selection** — Each player picks an elemental class (Fire, Water, Ice, Poison)
3. **Wave Loop** — Repeating cycle:
   - **Prep Phase** (timed, ~30 seconds) — Place/upgrade towers, spend lumber, coordinate
   - **Combat Phase** — Wave spawns, enemies traverse fixed path, towers attack
   - **Post-Wave** — Gold from kills distributed, lumber granted every 5 waves
4. **Victory** — Survive all waves (30-50 per session)
5. **Defeat** — Shared base HP reaches 0
6. **Rewards** — XP, unlocks, cosmetics based on performance

### Map Design

- **Fixed paths** with waypoint-based enemy pathing
- Enemies traverse all player areas before converging to a central base
- Build zones alongside the path for tower placement
- Roughly symmetric exposure per player zone for fairness
- **Flexible zone system**: inner zones always active, outer zones unlock with more players to prevent sparse maps at low player counts

---

## Elemental Class System

### Design Philosophy

- Each class has a **primary identity** (damage type, CC type, role)
- Everyone can build **shared basic towers** (arrow, amplifier, etc.)
- Each class has **3-4 unique specialty towers** only they can build
- **Class passive modifier**: basic towers placed by a player inherit their elemental flavor
- No class is pure support — every class has at least 1-2 real damage towers

### The Four Classes

| Class | Primary Identity | CC Type | Role | Passive Modifier |
|---|---|---|---|---|
| **Fire** | AoE/burst damage | Burn DoT | Wave clearer, boss burster | Towers gain burn tick on hit |
| **Water** | Utility/enabler | Pushback/displacement | Reaction enabler, flow control | Towers apply "Soaked" on hit |
| **Ice** | Hard crowd control | Freeze (full stop) | Lockdown, shatter setup | Towers apply stacking "Cold" |
| **Poison** | Attrition/debuff | Stacking DoT + slow | Area denial, tank killer | Towers apply stacking "Toxin" |

### Class Differentiation: Water vs Ice

This is a critical design distinction:
- **Water** controls *where* enemies go — pushback towers shove enemies backward on the path, buying time and forcing re-traversal through kill zones
- **Ice** controls *whether* enemies move at all — freeze towers stop enemies completely, enabling shatter combos and holding enemies in AoE zones
- Water is the universal reaction partner (Soaked status enables reactions with all other elements)
- Ice is the hard-commit control class (Freeze is the strongest single CC but requires setup)

---

## Tower System

### Tower Categories

#### Shared Basic Towers (all classes)
Accessible to every player. Class passive modifiers make them feel different depending on who placed them.
- Arrow Tower — single-target ranged
- Amplifier Tower — no damage, buffs all towers in radius (+15% damage); useful on fixed paths where blocking makes no sense
- Ballista — slow, high single-target damage
- Scout Tower — reveals invisible enemies in radius

#### Class Specialty Towers (unique per class, 3-4 each)
Only buildable by players of that class. These define the class's mechanical identity.

**Fire Specialty Towers:**
- Flame Spire — AoE splash, ignite DoT
- Inferno Cannon — high single-target burst, overkill insurance (splash never wasted)
- Magma Pool — ground area denial, burning zone enemies walk through
- Pyroclast (advanced) — long-range artillery, massive AoE on impact

**Water Specialty Towers:**
- Tidal Tower — moderate damage, applies "Soaked" in AoE
- Geyser — pushes enemies back X tiles on the path (signature Water mechanic)
- Whirlpool — AoE slow + damage, pulls enemies toward center
- Monsoon Spire (advanced) — periodic AoE burst, drenches all enemies in radius

**Ice Specialty Towers:**
- Frost Turret — single-target, stacking Cold (enough stacks = Freeze)
- Blizzard Tower — AoE Cold application, slower attack speed
- Glacial Spike — on Freeze, deals shatter burst damage
- Permafrost Obelisk (advanced) — aura that continuously applies Cold to all enemies in radius

**Poison Specialty Towers:**
- Venom Spitter — single-target DoT, stacking Toxin
- Plague Spreader — on enemy death, spreads Toxin to nearby enemies
- Miasma Cloud — area denial zone, enemies take increasing DoT the longer they stay
- Blight Engine (advanced) — debuff tower, enemies take increased damage from all sources

#### Hybrid Towers (require 2 unlocked elements, 5-10 total)
Cross-class synergy towers. Require two specific elements to be present on the team (any player of either class can build them once unlocked). These are the primary incentive for diverse team composition.

Example hybrids:
- **Steamworks** (Fire + Water) — AoE steam cloud, burns and soaks simultaneously
- **Frostfire Beacon** (Fire + Ice) — alternates between fire and ice attacks, triggering Melt
- **Toxic Geyser** (Water + Poison) — pushback + poison puddle on landing
- **Cryovenom Trap** (Ice + Poison) — frozen poison crystals shatter into AoE toxin
- **Boiling Cauldron** (Water + Fire) — sustained AoE, Vaporize on every hit

#### Ultimate Towers (lumber-gated, 2-3 total)
Late-game capstones. Cost lumber, not just gold. One per class archetype.
- **Elemental Nexus** — amplifies all elemental reactions in radius
- **Arcane Conduit** — massively boosts all towers in radius
- **Cataclysm Engine** — highest raw damage in the game, single target

### Tower Upgrade System

- Each tower has 3 upgrade tiers (Tier 1 → 2 → 3)
- Upgrades are stat deltas: damage +X, rate * Y, range +Z, adds effect
- Advanced towers may have branching upgrade paths at Tier 3 (choose specialization)
- Data-driven: all upgrades defined in config, not code

### Tower Role Taxonomy

Target coverage minimums per team:
- At least 1 reliable slow/CC line
- At least 1 anti-air solution
- At least 1 AoE line
- At least 1 high single-target line
- At least 1 reveal for invisible enemies

**Damage towers (~20):** Single-target DPS, burst, AoE splash, chain/bounce, DoT, long-range artillery
**Support towers (~8):** Slow, armor reduction, damage amplification, tower buff, utility (reveal, ground air)
**Hybrid towers (~6):** Dual-element requirement, combined effects
**Ultimate towers (~3):** Lumber-gated capstones

### Tower Transfer Mechanic

- Players can gift/transfer tower ownership to teammates
- Ownership determines who can sell/upgrade/cast tower abilities
- Available anytime (small gold transaction cost to prevent abuse)
- Enables role specialization: "I'll build slows for your kill zone"
- UI should display each player's coverage role at a glance

---

## Elemental Reaction System

### 3-Layer Synergy Architecture

**Layer 1 — Proximity Bonuses (passive, always-on)**
Towers near complementary elements gain ambient bonuses:
- Fire + Ice adjacent: +10% attack speed for both
- Water + Poison adjacent: Poison towers gain +15% DoT duration
- Proximity radius: ~2 tile radius
- Visual indicator: subtle glow/particle effect connecting synergized towers

**Layer 2 — Elemental Reactions (status-triggered)**
Enemies accumulate elemental statuses from tower hits. When a second element hits a status-tagged enemy, a reaction triggers:

| Reaction | Trigger Condition | Effect |
|---|---|---|
| **Vaporize** | Fire hits Soaked enemy | 1.5x damage burst on that hit |
| **Melt** | Fire hits Frozen enemy | 2x damage burst, breaks Freeze |
| **Steam Burst** | Water hits Burning enemy | AoE steam cloud, damages + slows nearby |
| **Freeze** | Ice hits Soaked enemy | Full stop CC for 2-3 seconds |
| **Shatter** | Any damage hits Frozen enemy hard | Bonus AoE burst damage around target |
| **Blight** | Poison hits Soaked enemy | Amplified DoT, "Festering" stacks |
| **Frostburn** | Ice hits Poisoned enemy | Crystallized venom, creates slow zone on death |
| **Conflagration** | Fire hits Poisoned enemy | Massive AoE burst, clears Poison stacks |

Design rule: reactions trigger based on **enemy status**, not hit sequencing. If an enemy is Soaked and gets hit by Fire = Vaporize, regardless of which tower fired first. This is more readable and intentional for TD gameplay.

**Layer 3 — Chain Triggers (deliberate sequencing)**
Advanced mechanic for experienced players. Placing towers in deliberate order along the path creates multi-step combos:
- Water tower → soaks enemies → Ice tower → Freeze (Soaked + Cold = instant Freeze) → Fire tower → Melt (2x burst + breaks Freeze) → Poison tower → applies fresh DoT to weakened enemies
- Optimal chain sequencing along the path is the skill ceiling

### Reaction Scaling

- Base reaction damage scales with the triggering tower's stats
- Proximity to synergy partners amplifies reaction damage by 10-25%
- Meta-progression unlocks can further boost specific reaction types
- Some reactions have internal cooldowns per enemy to prevent infinite proc loops

---

## Enemy System

### Enemy Archetypes

| Type | Characteristics | Pressure Point |
|---|---|---|
| **Grunt** | Standard HP, standard speed | Baseline threat |
| **Runner** | Low HP, high speed | Stresses range and first-shot towers |
| **Tank/Siege** | Very high HP, slow, partial AoE resistance | Stresses single-target DPS and DoT |
| **Flyer (Air)** | Bypasses ground towers, follows air path | Requires anti-air or "grounding" debuff |
| **Invisible** | Hidden until revealed or within melee range | Requires reveal towers/hero/true-sight |
| **Caster** | Shields, heals, or buffs nearby allies | Priority targeting required |
| **Boss** | Massive HP, unique abilities, single unit | Full-team coordination check |

### Enemy Abilities (escalating threat)

- **Passive:** Buff nearby allies (speed aura, damage resistance)
- **Active:** Shield other enemies, heal the pack, disable towers temporarily
- **Dangerous:** Split into smaller units on death, burrow past path sections, destroy towers
- Introduced gradually: basic grunts early, first abilities around wave 8-10, dangerous abilities in late waves

### Elemental Resistances

- Some enemies resist specific elements (fire-resistant, poison-immune, etc.)
- Forces team composition diversity — no single class can handle everything
- Resistance reduces elemental damage by 50% but does not negate reactions
- Boss enemies may rotate resistances or be temporarily immune to one element

### Wave Design

- **30-50 waves** per session
- Every wave defined in data: count, HP, speed, armor, tags, bounty, special abilities
- Exponential-ish HP scaling with spike waves for tag-check encounters
- **Tag-check waves** (Air, Invisible, Siege, Caster) create coordination pressure — introduced every ~5 waves
- Wave composition telegraphed during prep phase so players can plan

**Pacing milestones:**
- Wave 3: each player has at least one meaningful DPS tower
- Wave 5: first lumber grant, first strategic branching point
- Wave 10: first hard tag-check wave (Air or Invisible)
- Wave 15: first boss wave
- Wave 25: hybrid/ultimate tower territory
- Wave 30-50: escalating difficulty, multi-tag waves, boss gauntlets

---

## Economy System

### Dual Resource Model

**Gold (continuous flow):**
- Earned from enemy kills (wave completion bonus + per-kill bounty)
- Shared pool — any player can spend
- Used for: building towers, upgrading towers, tower transfers
- Reward by wave completion (not last-hit) to avoid co-op friction

**Lumber (pacing currency):**
- Granted every 5 waves (fixed schedule)
- Shared pool with team vote or discussion on spend
- Used for: unlocking additional builder tiers, purchasing heroes, building ultimate towers, tech buildings
- Creates distinct "power spike" moments — the Burbenog feel

### Economy Scaling by Player Count

- Gold income scales with player count to maintain per-player purchasing power
- Lumber grants are fixed (not per-player) — forces team-level strategic decisions
- Solo players receive slightly boosted income to compensate for covering all roles alone

---

## Hero System

### Design Philosophy

Heroes are **purchased safety nets with active abilities**, not required to win. They catch leaks, provide clutch plays, and create cross-class co-op moments.

### Hero Mechanics

- Each player can purchase one Hero aligned to their elemental class (costs lumber)
- Heroes auto-attack enemies on the path; during prep phase, the hero can be repositioned to any valid path position — they lock in place once combat begins
  - *Strategic note: repositioning each prep phase is intended and encouraged — moving your hero to the toughest upcoming choke point is a core decision*
- 2-3 active abilities per hero on cooldowns (player-activated, not auto-cast)
- Heroes level 1-5 during the session (gains HP, damage, ability potency)
- Hero levels reset between sessions (no persistent hero progression)
- At least one ability per hero benefits teammates' towers (co-op hook)

### Hero Concepts

**Flame Warden (Fire):**
- "Inferno Strike" — targeted fireball, high single-target damage (15s CD)
- "Backdraft" — AoE knockback + burn around hero (30s CD)
- "Ignite Weapons" — all towers in radius gain burn effect for 10s (45s CD) *(team benefit)*

**Tidecaller (Water):**
- "Tidal Wave" — pushes all enemies in range back 3 tiles (45s CD)
- "Mending Rain" — repairs a damaged tower to full HP (60s CD) *(team benefit)*
- "Drench" — applies Soaked to all enemies in large radius (30s CD)

**Frostguard (Ice):**
- "Glacial Prison" — freezes all enemies in range for 3s (40s CD)
- "Shatter Pulse" — bonus damage to all Frozen enemies on map (25s CD)
- "Permafrost Aura" — all towers in radius gain Cold application for 15s (50s CD) *(team benefit)*

**Plague Doctor (Poison):**
- "Plague Cloud" — lingering poison zone on path for 10s (35s CD)
- "Weaken" — target enemy takes +30% damage from all sources for 10s (20s CD) *(team benefit)*
- "Epidemic" — spreads all Toxin stacks from one enemy to all nearby enemies (45s CD)

### Hero Balance Constraints

- Heroes are optional — winnable without them, but they provide meaningful advantage
- Team-wide shared cooldown on similar ability types (prevents CC-stacking from 4 heroes simultaneously)
- Hero abilities should enable reactions (Tidecaller's Drench + Frostguard's Glacial Prison = mass Freeze)

---

## Player Scaling (1-6 Players)

### Difficulty Scaling Formula

```
enemy_HP = base_HP * (1 + 0.3 * (player_count - 1))
enemy_count = base_count * (1 + 0.25 * (player_count - 1))
gold_per_wave = base_gold * player_count
boss_HP = base_boss_HP * (1 + 0.5 * (player_count - 1))
```

### Scaling Philosophy

- **Solo (1 player):** tight but winnable through efficient builds. Access to all basic towers compensates for no class synergies. Reduced wave counts optional.
- **Duo (2 players):** strong synergy potential with 2 elements. Core co-op experience.
- **Trio (3 players):** designed sweet spot. 3 of 4 elements covered, one gap creates strategic tension.
- **Full squad (4 players):** all elements covered. Maximum synergy, maximum enemy threat.
- **5-6 players:** duplicate classes allowed. Additional enemy types and mechanics introduced (not just HP bloat). Split-on-death enemies, multi-path spawns, tower-disabling enemies.

  **Duplicate class rules (when two players share the same class):**
  - Passive modifiers do NOT stack — a basic tower can only have one elemental passive applied regardless of which player placed it (first-placer's passive applies)
  - Both players can independently build that class's specialty towers
  - If two burn DoTs from two Fire players hit the same enemy simultaneously, only the stronger one applies (no double-dipping on the same status type)
  - Both players share the same specialty tower build pool — having two Fire players doesn't make Fire specialty towers twice as available, it just means two people can build them

### Late-Join Support

- Players joining mid-game receive catch-up gold: `wave_number * base_income_per_wave * 0.7`
- Late joiners select their class from remaining available (or duplicate if all taken)
- Difficulty scales up to new player count starting next wave

---

## Meta-Progression System

### Tier 1: In-Run Progression (session-scoped, resets each game)

- Gold + Lumber economy
- Tower upgrades (Tier 1 → 2 → 3)
- Builder unlocks via lumber every 5 waves
- Hero purchase and leveling (1-5)

### Tier 2: Permanent Account Progression

**XP System:**
- Earn XP per wave survived, per boss killed, per elemental reaction triggered, per session completed
- Account level increases with XP

**Class Skill Trees (per class, ~60-80 nodes each):**
- Passive bonuses: "Fire splash radius +10%", "Cold stacks apply 5% faster"
- New tower unlocks: additional specialty towers beyond the starting 3-4
- Tower upgrade variants: alternate Tier 3 branches
- Hero ability enhancements

**Unlockable Content:**
- Additional classes (start with 2 unlocked, earn the other 2)
- New maps with different path layouts and environments
- Difficulty modifiers (Blitz mode, Endless mode, Expert wave shuffling)
- New hybrid tower recipes

### Tier 3: Cosmetics and Prestige

- Tower skins (visual variants per upgrade tier)
- Projectile effects (fire changes color, ice gets crystal particles)
- Player icons and borders
- Map visual themes
- **Prestige challenges:** "Beat wave 50 with only Ice and Poison towers" → unique tower skin
- Earnable through play only. No pay-to-win. No gacha.

### Progression Rules

- Never gate co-op content behind individual progression — sync unlock states within a session (use host's unlocks, or union of all players' unlocks)
- Early nodes are minor or aesthetic — new players can participate meaningfully in veteran sessions
- Total unlock time target: ~30-50 hours per class to complete skill tree

---

## Sound Design

### Philosophy

Sound is a critical feedback channel. Every action, reaction, and threat should have distinct audio. Players will supply all audio files — the system must support easy swapping and layering.

### Sound Categories

**Tower Sounds:**
- Placement sound (per element: fire crackle, water splash, ice crystallize, poison bubble)
- Attack sound (unique per tower type — arrow thwip, flame whoosh, ice shard, poison spit)
- Upgrade sound (ascending tone + elemental flourish)
- Sell/transfer sound

**Elemental Reaction Sounds (high priority — these are the game's signature moments):**
- Vaporize: sharp steam hiss + burst
- Melt: crackling sizzle + glass-break
- Steam Burst: pressurized release + wet explosion
- Freeze: crystallization crack + deep bass thud
- Shatter: satisfying glass/ice shatter (most important sound in the game)
- Blight: wet organic bubbling + acid sizzle
- Frostburn: cracking ice + venomous hiss
- Conflagration: massive fire roar + chemical pop

**Enemy Sounds:**
- Footsteps/movement (varies by type: marching, skittering, flying whoosh, burrowing rumble)
- Damage taken (generic hit, elemental-specific reactions)
- Death sound (per enemy type, with elemental death variant if killed by reaction)
- Ability activation (caster shield-up, healer pulse, boss roar)
- Wave spawn horn/alert

**Hero Sounds:**
- Ability activation (unique per hero per ability)
- Ability impact
- Hero level-up fanfare
- Hero purchase confirmation

**UI/Game State Sounds:**
- Wave start horn
- Wave cleared fanfare
- Prep phase ambient (calm, strategic — lute/ambient fantasy)
- Combat phase ambient (intensifying percussion/tension)
- Lumber granted (satisfying resource "cha-ching" with weight)
- Gold earned (lighter coin sound, not overwhelming since it's frequent)
- Tower placement denied (error buzz)
- Player joined/left lobby
- Base taking damage (alarm, escalating urgency)
- Base destroyed (defeat stinger)
- Victory fanfare
- Elemental class selection (unique sting per element)

**Proximity/Spatial Audio:**
- Tower sounds attenuated by distance from camera
- Reaction sounds louder/more prominent (they're the payoff moment)
- Boss sounds are globally audible regardless of position
- Directional audio hints for incoming special waves

### Audio System Requirements

- Support layered/concurrent sounds (multiple towers firing + reactions + enemy movement)
- Priority system: reactions > boss abilities > tower attacks > ambient
- Volume ducking: when a reaction triggers, briefly duck tower attack sounds to let the reaction shine
- Per-category volume sliders in settings (Master, Music, SFX, UI, Reactions)
- Audio files loaded as sprite sheets for performance (Web Audio API)

---

## Visual Style

### Art Direction

- **2D top-down angled view (3/4 isometric)**
- Classic fantasy aesthetic: stone towers, magical effects, medieval-fantasy enemies
- Each element has a distinct color palette:
  - Fire: warm oranges, reds, ember particles
  - Water: blues, teals, flowing/ripple effects
  - Ice: cold blues, whites, crystal/frost particles
  - Poison: greens, purples, bubbling/dripping effects
- Elemental reactions have dramatic visual effects (screen-shake on Shatter, flash on Conflagration)

### Sprite Art Pipeline

- AI-generated sprites via Gemini Nano Banana Pro
- Reference image system for cross-asset style consistency per element
- Transparent backgrounds (PNG with alpha)
- Per-frame editing for animations (more reliable than single-sheet generation)
- Prompt template: "top-down angled (3/4 iso), orthographic, no perspective distortion, crisp pixels, transparent background"
- Flash model for iteration/drafts, Pro model for production assets

---

## Technical Architecture

### Client

- **Phaser 3 + TypeScript** — 2D game framework, sprite-based rendering
- Handles: rendering, input, animation, tweens, local audio
- Optimistic UI: ghost tower on placement attempt, server confirms/rejects

### Server

- **Node.js + TypeScript** — authoritative game simulation at 20Hz fixed tick
- **Socket.IO** for WebSocket communication (rooms, reconnection, fallback)
- Server owns: economy validation, tower placement legality, wave scheduling, damage calculation, reaction resolution
- Evaluate **Colyseus** as multiplayer framework (rooms, reconnection, state sync out of the box)

### Networking Model

1. **Command stream (reliable, ordered):** client sends PlaceTower, UpgradeTower, StartWave, UseAbility → server validates → broadcasts accepted commands
2. **Periodic snapshots (250-1000ms):** enemy positions + HP, tower states, economy, wave timer → supports late join and reconnection
3. **Client-side interpolation** for smooth visuals between snapshots

### Pathfinding

- **Waypoint lists** for fixed paths — lowest CPU cost
- Each enemy stores progress index along waypoint list
- No flow fields needed for fixed-path design

### Performance

- Spatial hashing for tower target selection
- Projectile pooling with max cap
- Stagger tower retargeting across ticks
- JSON commands for friend-group scale; compact array snapshots for bandwidth

### Hosting

- Static client: Vercel / Cloudflare Pages / Netlify
- Realtime server: Fly.io / Railway
- Database (meta-progression): TBD (Supabase, PlanetScale, or similar)

---

## Data-Driven Design

All game content is defined in configuration, not hardcoded:

**Governor/Class config:**
```json
{
  "id": "fire",
  "identity": ["aoe", "ignite"],
  "primaryBuilder": "fire",
  "passive": {"type": "burn_on_hit", "dps": 2, "durationSec": 3},
  "heroId": "flame_warden"
}
```

**Tower config:**
```json
{
  "id": "flame_spire_1",
  "class": "fire",
  "role": ["aoe", "damage"],
  "costGold": 120,
  "range": 3.5,
  "attackPeriodSec": 1.2,
  "baseDamage": 22,
  "splashRadius": 1.5,
  "onHit": [{"type": "dot", "element": "fire", "dps": 3, "durationSec": 4}],
  "tags": ["ground"],
  "upgrades": [
    {"tier": 2, "costGold": 80, "deltas": {"baseDamage": "+10", "splashRadius": "+0.3"}},
    {"tier": 3, "costGold": 150, "deltas": {"baseDamage": "+15", "onHit.0.dps": "+5"}}
  ]
}
```

**Wave config:**
```json
{
  "wave": 12,
  "count": 24,
  "creep": {"hp": 420, "speed": 1.05, "armor": 2, "tags": ["air"]},
  "bountyGold": 7,
  "spawnIntervalSec": 0.25,
  "telegraph": "Flying wave incoming — anti-air required!"
}
```

**Reaction config:**
```json
{
  "id": "vaporize",
  "triggerElement": "fire",
  "requiredStatus": "soaked",
  "effect": {"type": "damage_multiplier", "value": 1.5},
  "consumesStatus": true,
  "sound": "sfx_vaporize",
  "vfx": "vfx_steam_burst"
}
```

---

## MVP Scope (v0.1)

Minimum viable version to validate the core loop:

- 1 map, fixed path with waypoints
- 4 elemental classes with 2-3 specialty towers each
- 6-8 shared basic towers
- 15-20 waves
- 4-6 enemy types (Grunt, Runner, Tank, Flyer, Invisible, Boss)
- Gold economy (lumber deferred to v0.2)
- Elemental status system + 4 core reactions (Vaporize, Freeze, Melt, Conflagration)
- Authoritative server with command + snapshot sync
- 1-4 player co-op
- Lobby with invite link
- Sound effects for all tower attacks and reactions
- No meta-progression (deferred to v0.3)

### v0.2 Additions
- Lumber economy + builder unlock pacing
- Heroes (4 heroes, 2 abilities each)
- Hybrid towers (3-5)
- Full 30-wave campaign
- 5-6 player support
- Proximity bonuses + chain triggers
- Tower transfer mechanic
- Telemetry & analytics instrumentation (see Telemetry section below)

### v0.3 Additions
- Meta-progression (account XP, class skill trees)
- Additional maps
- Ultimate towers
- Cosmetics system
- Endless mode
- Prestige challenges
- Full 50-wave campaign option

---

## Balance Targets & Success Metrics

### Wave Pacing Goals

These targets define what "well-balanced" looks like. Used during playtesting to validate tuning.

**Completion rate targets (Normal difficulty):**

| Segment | Target Clear Rate | Notes |
|---|---|---|
| Waves 1-10 | 95%+ of teams | Early game should feel learnable, not punishing |
| Waves 11-20 | 80-85% of teams | Mid-game pressure ramps; first team wipes expected here |
| Waves 21-30 | 60-70% of teams | Late-game is earned, not given |
| Waves 31-40 | 40-50% of teams | Extended waves for skilled/progressed teams |
| Waves 41-50 | 20-30% of teams | Endgame gauntlet, bragging rights territory |

**Damage threshold targets:**
- Average team should take first base damage between waves 8-12 (not before, not much after)
- By wave 20, teams should have taken 20-40% of max base HP in cumulative damage
- A "clean run" (zero damage) through wave 30 should be achievable but rare (~5% of runs)

**Pacing feel targets:**
- Prep phase should feel "just barely enough time" — 30 seconds baseline, consider 20s for Blitz mode
- No wave should feel like a guaranteed wipe without counterplay
- Every 5-wave lumber grant should feel like a meaningful power spike
- Tag-check waves (Air, Invisible) should cause at least 1 leak on first encounter for unprepared teams

**Solo vs co-op balance:**
- Solo clear rate should be within 10% of duo clear rate at each segment
- 4-player clear rate should be within 5% of 3-player clear rate (the designed sweet spot)
- 6-player should feel harder than 4-player due to coordination overhead, not just stat scaling

---

## Telemetry & Analytics

> **Deferred to v0.2** — Telemetry & analytics deferred to v0.2 — build a fun game loop first, then instrument it.

---

*(Full telemetry spec below — implement during v0.2 after the core loop is validated and playable.)*

### What to Track

Instrument the game to collect data that directly informs balance tuning and design iteration.

**Wave-level metrics:**
- Wave survival rate (per wave number, per difficulty, per player count)
- Average base damage taken per wave
- Wave completion time (how long combat phase lasts)
- Number of leaks per wave

**Reaction metrics:**
- Reaction trigger frequency (which reactions fire most/least)
- Reaction damage as % of total damage dealt
- Most common reaction chains (e.g., Soak → Freeze → Shatter)
- Reactions per minute by team composition

**Class & tower metrics:**
- Class pick rates across sessions
- Tower build frequency (which towers are popular, which are ignored)
- Tower gold efficiency (damage dealt per gold spent, per tower type)
- Hybrid tower adoption rate (are players discovering cross-class towers?)

**Hero metrics:**
- Hero purchase timing (which wave do players buy heroes?)
- Ability usage frequency and timing
- Leaks caught by heroes vs leaks that hit base
- Hero ability uptime per session

**Economy metrics:**
- Average gold at each wave milestone (are players gold-starved or hoarding?)
- Lumber spend patterns (what do players unlock first?)
- Tower transfer frequency and timing

**Session-level metrics:**
- Session completion rate and average wave reached
- Session duration
- Player count distribution
- Disconnect/rejoin frequency

### How to Use

- Review telemetry weekly during active development/playtesting
- Flag any tower with <5% pick rate as candidates for buff/redesign
- Flag any reaction with <2% trigger rate as potentially unclear or hard to set up
- Use wave survival curves to identify difficulty spikes that need smoothing
- Compare solo vs co-op metrics to validate scaling formula
