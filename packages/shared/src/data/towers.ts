import type { TowerConfig } from '../index.js';

export const TOWER_CONFIGS: Record<string, TowerConfig> = {
  // ═══════════════════════════════════════════════════════════
  // SHARED BASIC TOWERS (available to all classes)
  // ═══════════════════════════════════════════════════════════

  arrow_tower: {
    id: 'arrow_tower',
    name: 'Arrow Tower',
    description: 'Reliable single-target tower. Fast attack speed with moderate damage.',
    class: 'shared',
    category: 'basic',
    roles: ['damage'],
    costGold: 50,
    range: 3,
    attackPeriodSec: 1.0,
    baseDamage: 10,
    targets: 'ground',
    upgrades: [
      { tier: 2, costGold: 35, deltas: { baseDamage: '+5', range: '+0.3' } },
      { tier: 3, costGold: 70, deltas: { baseDamage: '+8', attackPeriodSec: '*-0.15' } },
    ],
  },

  amplifier_tower: {
    id: 'amplifier_tower',
    name: 'Amplifier Tower',
    description:
      'SUPPORT — Does not attack. Boosts damage of all towers within range by 15% (20% at tier 2, 25% at tier 3). Stack near tower clusters for maximum effect.',
    class: 'shared',
    category: 'basic',
    roles: ['support'],
    costGold: 80,
    range: 2,
    attackPeriodSec: 0, // No attack, support only
    baseDamage: 0,
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 60, deltas: { range: '+0.5' } }, // Buffs +20% instead of 15%
      { tier: 3, costGold: 100, deltas: { range: '+0.5' } }, // Buffs +25% at max
    ],
  },

  ballista: {
    id: 'ballista',
    name: 'Ballista',
    description: 'High single-shot damage with long range. Slow reload. Best against tanks and bosses.',
    class: 'shared',
    category: 'basic',
    roles: ['damage'],
    costGold: 100,
    range: 4,
    attackPeriodSec: 2.0,
    baseDamage: 40,
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 75, deltas: { baseDamage: '+15', range: '+0.5' } },
      { tier: 3, costGold: 130, deltas: { baseDamage: '+20', attackPeriodSec: '*-0.1' } },
    ],
  },

  scout_tower: {
    id: 'scout_tower',
    name: 'Scout Tower',
    description: 'UTILITY — Reveals invisible enemies within range. Does not deal damage.',
    class: 'shared',
    category: 'basic',
    roles: ['utility'],
    costGold: 60,
    range: 5,
    attackPeriodSec: 0, // No direct attack, reveals invisible
    baseDamage: 0,
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 45, deltas: { range: '+1' } },
      { tier: 3, costGold: 80, deltas: { range: '+1' } }, // Now also reveals in larger radius
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // FIRE SPECIALTY TOWERS (Fire class only)
  // ═══════════════════════════════════════════════════════════

  flame_spire: {
    id: 'flame_spire',
    name: 'Flame Spire',
    description: 'Area-of-effect fire tower. Damages all enemies in radius and applies burn over time.',
    class: 'fire',
    category: 'specialty',
    roles: ['damage', 'aoe'],
    costGold: 120,
    range: 3.5,
    attackPeriodSec: 1.2,
    baseDamage: 22,
    splashRadius: 1.5,
    onHit: [{ type: 'dot', element: 'fire', dps: 3, durationSec: 4 }],
    targets: 'ground',
    upgrades: [
      { tier: 2, costGold: 80, deltas: { baseDamage: '+10', splashRadius: '+0.3', 'onHit.0.dps': '+2' } },
      { tier: 3, costGold: 150, deltas: { baseDamage: '+15', splashRadius: '+0.3', 'onHit.0.durationSec': '+2' } },
    ],
  },

  inferno_cannon: {
    id: 'inferno_cannon',
    name: 'Inferno Cannon',
    description: 'Single-target heavy cannon with very high damage and lingering fire DoT.',
    class: 'fire',
    category: 'specialty',
    roles: ['damage'],
    costGold: 150,
    range: 4,
    attackPeriodSec: 1.8,
    baseDamage: 55,
    onHit: [{ type: 'dot', element: 'fire', dps: 4, durationSec: 3 }],
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 100, deltas: { baseDamage: '+20', range: '+0.5' } },
      { tier: 3, costGold: 180, deltas: { baseDamage: '+25', 'onHit.0.dps': '+3' } },
    ],
  },

  magma_pool: {
    id: 'magma_pool',
    name: 'Magma Pool',
    description: 'Fire hazard zone that burns grouped ground enemies over time for sustained crowd pressure.',
    class: 'fire',
    category: 'specialty',
    roles: ['aoe', 'damage'],
    costGold: 100,
    range: 2,
    attackPeriodSec: 0.8,
    baseDamage: 12,
    splashRadius: 2,
    onHit: [{ type: 'dot', element: 'fire', dps: 5, durationSec: 3 }],
    targets: 'ground',
    upgrades: [
      { tier: 2, costGold: 70, deltas: { baseDamage: '+8', splashRadius: '+0.5' } },
      { tier: 3, costGold: 120, deltas: { baseDamage: '+10', 'onHit.0.dps': '+3' } },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // WATER SPECIALTY TOWERS (Water class only)
  // ═══════════════════════════════════════════════════════════

  tidal_tower: {
    id: 'tidal_tower',
    name: 'Tidal Tower',
    description: 'Water assault tower with AoE splash and slowing impact on both air and ground enemies.',
    class: 'water',
    category: 'specialty',
    roles: ['damage', 'cc'],
    costGold: 100,
    range: 3,
    attackPeriodSec: 1.0,
    baseDamage: 15,
    splashRadius: 1.5,
    onHit: [{ type: 'status', element: 'water', slowPercent: 20, durationSec: 2 }],
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 70, deltas: { baseDamage: '+8', splashRadius: '+0.3' } },
      { tier: 3, costGold: 120, deltas: { baseDamage: '+10', range: '+0.5' } },
    ],
  },

  geyser: {
    id: 'geyser',
    name: 'Geyser',
    description:
      'Knockback specialist. Low damage but pushes enemies backward along the path.',
    class: 'water',
    category: 'specialty',
    roles: ['cc'],
    costGold: 130,
    range: 3,
    attackPeriodSec: 2.5,
    baseDamage: 8,
    onHit: [{ type: 'pushback', element: 'water', value: 3 }], // Pushes back 3 tiles
    targets: 'ground',
    upgrades: [
      { tier: 2, costGold: 90, deltas: { baseDamage: '+5', attackPeriodSec: '*-0.2' } },
      { tier: 3, costGold: 150, deltas: { baseDamage: '+8', range: '+0.5' } },
    ],
  },

  whirlpool: {
    id: 'whirlpool',
    name: 'Whirlpool',
    description:
      'Area control tower that adds splash water damage and long slowing effects for enemy crowd management.',
    class: 'water',
    category: 'specialty',
    roles: ['aoe', 'cc'],
    costGold: 120,
    range: 2.5,
    attackPeriodSec: 1.5,
    baseDamage: 10,
    splashRadius: 2,
    onHit: [{ type: 'status', element: 'water', slowPercent: 35, durationSec: 3 }],
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 85, deltas: { baseDamage: '+6', splashRadius: '+0.3' } },
      { tier: 3, costGold: 140, deltas: { baseDamage: '+8', 'onHit.0.slowPercent': '+10' } },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ICE SPECIALTY TOWERS (Ice class only)
  // ═══════════════════════════════════════════════════════════

  frost_turret: {
    id: 'frost_turret',
    name: 'Frost Turret',
    description: 'Balanced ice tower with reliable single-target damage plus a meaningful slow effect.',
    class: 'ice',
    category: 'specialty',
    roles: ['damage', 'cc'],
    costGold: 110,
    range: 3,
    attackPeriodSec: 1.0,
    baseDamage: 12,
    onHit: [{ type: 'status', element: 'ice', slowPercent: 15, durationSec: 4 }], // Stacks Cold
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 75, deltas: { baseDamage: '+6', 'onHit.0.slowPercent': '+5' } },
      { tier: 3, costGold: 130, deltas: { baseDamage: '+8', range: '+0.3' } },
    ],
  },

  blizzard_tower: {
    id: 'blizzard_tower',
    name: 'Blizzard Tower',
    description: 'Area freeze-like blast that deals multiple-target damage and heavy short-term crowd control.',
    class: 'ice',
    category: 'specialty',
    roles: ['aoe', 'cc'],
    costGold: 140,
    range: 3,
    attackPeriodSec: 1.5,
    baseDamage: 8,
    splashRadius: 2,
    onHit: [{ type: 'status', element: 'ice', slowPercent: 20, durationSec: 3 }],
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 95, deltas: { baseDamage: '+4', splashRadius: '+0.5' } },
      { tier: 3, costGold: 160, deltas: { baseDamage: '+5', 'onHit.0.slowPercent': '+10' } },
    ],
  },

  glacial_spike: {
    id: 'glacial_spike',
    name: 'Glacial Spike',
    description: 'Fast single-target ice damage with bonus range growth at higher tiers.',
    class: 'ice',
    category: 'specialty',
    roles: ['damage'],
    costGold: 130,
    range: 3,
    attackPeriodSec: 1.2,
    baseDamage: 25,
    onHit: [{ type: 'status', element: 'ice', slowPercent: 10, durationSec: 2 }],
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 90, deltas: { baseDamage: '+12' } },
      { tier: 3, costGold: 160, deltas: { baseDamage: '+15', range: '+0.5' } },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // POISON SPECIALTY TOWERS (Poison class only)
  // ═══════════════════════════════════════════════════════════

  venom_spitter: {
    id: 'venom_spitter',
    name: 'Venom Spitter',
    description: 'Rapid poison damage tower with continuous toxic burn over several seconds.',
    class: 'poison',
    category: 'specialty',
    roles: ['damage'],
    costGold: 90,
    range: 3,
    attackPeriodSec: 0.8,
    baseDamage: 8,
    onHit: [{ type: 'dot', element: 'poison', dps: 2, durationSec: 5 }],
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 65, deltas: { baseDamage: '+4', 'onHit.0.dps': '+1' } },
      { tier: 3, costGold: 110, deltas: { baseDamage: '+6', attackPeriodSec: '*-0.1' } },
    ],
  },

  plague_spreader: {
    id: 'plague_spreader',
    name: 'Plague Spreader',
    description: 'Steady poison fire support for single targets with persistent stacking damage.',
    class: 'poison',
    category: 'specialty',
    roles: ['damage'],
    costGold: 120,
    range: 3,
    attackPeriodSec: 1.0,
    baseDamage: 10,
    onHit: [{ type: 'dot', element: 'poison', dps: 2, durationSec: 4 }],
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 80, deltas: { baseDamage: '+6', range: '+0.3' } },
      { tier: 3, costGold: 140, deltas: { baseDamage: '+8', range: '+0.3' } },
    ],
  },

  miasma_cloud: {
    id: 'miasma_cloud',
    name: 'Miasma Cloud',
    description: 'Area-of-effect poison cloud that damages all enemies inside its radius and keeps pressure on groups.',
    class: 'poison',
    category: 'specialty',
    roles: ['aoe', 'damage'],
    costGold: 110,
    range: 2,
    attackPeriodSec: 1.2,
    baseDamage: 6,
    splashRadius: 2.5,
    onHit: [{ type: 'dot', element: 'poison', dps: 3, durationSec: 4 }],
    targets: 'both',
    upgrades: [
      { tier: 2, costGold: 75, deltas: { baseDamage: '+4', splashRadius: '+0.3' } },
      { tier: 3, costGold: 130, deltas: { baseDamage: '+5', 'onHit.0.dps': '+2' } },
    ],
  },
};
