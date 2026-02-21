import { describe, it, expect, beforeEach } from 'vitest';
import { CombatSystem, applyDelta } from './CombatSystem';
import type { TowerState, EnemyState, TowerConfig, TargetingMode } from '@td/shared';

const arrowConfig: TowerConfig = {
  id: 'arrow_tower',
  name: 'Arrow Tower',
  class: 'shared',
  category: 'basic',
  roles: ['damage'],
  costGold: 50,
  range: 3,
  attackPeriodSec: 1.0,
  baseDamage: 10,
  targets: 'ground',
  upgrades: [],
};

const flameConfig: TowerConfig = {
  id: 'flame_spire',
  name: 'Flame Spire',
  class: 'fire',
  category: 'specialty',
  roles: ['aoe', 'damage'],
  costGold: 120,
  range: 3.5,
  attackPeriodSec: 1.2,
  baseDamage: 22,
  splashRadius: 1.5,
  onHit: [{ type: 'dot', element: 'fire', dps: 3, durationSec: 4 }],
  targets: 'ground',
  upgrades: [],
};

function makeTower(config: TowerConfig, x: number, y: number): TowerState {
  return { instanceId: `t_${x}_${y}`, configId: config.id, ownerId: 'p1', tier: 1, x, y, lastAttackTick: 0 };
}

function makeEnemy(id: string, x: number, y: number, hp = 100, type: 'grunt' | 'flyer' = 'grunt'): EnemyState {
  return {
    instanceId: id, type, hp, maxHp: hp, speed: 1, armor: 0,
    x, y, waypointIndex: 0, progress: 0, statuses: [], alive: true,
  };
}

describe('CombatSystem', () => {
  let system: CombatSystem;
  const configs = { arrow_tower: arrowConfig, flame_spire: flameConfig };

  beforeEach(() => {
    system = new CombatSystem(configs);
  });

  it('finds closest enemy in range', () => {
    const tower = makeTower(arrowConfig, 5, 5);
    const near = makeEnemy('e1', 6, 5); // dist 1
    const far = makeEnemy('e2', 9, 5); // dist 4, out of range (3)
    const target = system.findTarget(tower, [near, far]);
    expect(target?.instanceId).toBe('e1');
  });

  it('returns null if no enemy in range', () => {
    const tower = makeTower(arrowConfig, 5, 5);
    const far = makeEnemy('e1', 20, 20);
    const target = system.findTarget(tower, [far]);
    expect(target).toBeNull();
  });

  it('skips dead enemies', () => {
    const tower = makeTower(arrowConfig, 5, 5);
    const dead = makeEnemy('e1', 6, 5);
    dead.alive = false;
    const target = system.findTarget(tower, [dead]);
    expect(target).toBeNull();
  });

  it('respects target type — ground tower does not target air', () => {
    const tower = makeTower(arrowConfig, 5, 5); // targets: ground
    const flyer = makeEnemy('e1', 6, 5, 100, 'flyer');
    const target = system.findTarget(tower, [flyer]);
    expect(target).toBeNull();
  });

  it('determines if tower can fire based on attack period', () => {
    const tower = makeTower(arrowConfig, 5, 5);
    tower.lastAttackTick = 0;
    // attackPeriodSec = 1.0 at 20 ticks/sec = 20 ticks
    expect(system.canFire(tower, 20)).toBe(true);
    expect(system.canFire(tower, 10)).toBe(false);
  });

  it('calculates splash targets', () => {
    const tower = makeTower(flameConfig, 5, 5);
    const target = makeEnemy('e1', 6, 5);
    const nearby = makeEnemy('e2', 6.5, 5); // within splash radius 1.5
    const farAway = makeEnemy('e3', 20, 20);
    const splashed = system.getSplashTargets(tower, target, [target, nearby, farAway]);
    expect(splashed).toContainEqual(expect.objectContaining({ instanceId: 'e2' }));
    expect(splashed).not.toContainEqual(expect.objectContaining({ instanceId: 'e3' }));
  });

  describe('targeting modes', () => {
    const bigRangeConfig: TowerConfig = {
      ...arrowConfig,
      id: 'big_range',
      range: 10,
    };

    function makeTowerWithMode(mode: TargetingMode) {
      const t = makeTower(bigRangeConfig, 0, 0);
      t.targetingMode = mode;
      return t;
    }

    function makeEnemyPath(id: string, x: number, y: number, hp: number, waypointIndex: number, progress: number): EnemyState {
      return { ...makeEnemy(id, x, y, hp), waypointIndex, progress };
    }

    it('first mode: selects enemy furthest along path (highest waypointIndex + progress)', () => {
      const sys2 = new CombatSystem({ big_range: bigRangeConfig });
      const tower = makeTowerWithMode('first');

      const e1 = makeEnemyPath('e1', 1, 0, 100, 2, 0.1);  // score 2.1
      const e2 = makeEnemyPath('e2', 2, 0, 100, 1, 0.9);  // score 1.9
      const e3 = makeEnemyPath('e3', 3, 0, 100, 0, 0.5);  // score 0.5

      const target = sys2.findTarget(tower, [e1, e2, e3]);
      expect(target?.instanceId).toBe('e1');
    });

    it('last mode: selects enemy earliest on path (lowest waypointIndex + progress)', () => {
      const sys2 = new CombatSystem({ big_range: bigRangeConfig });
      const tower = makeTowerWithMode('last');

      const e1 = makeEnemyPath('e1', 1, 0, 100, 2, 0.1);  // score 2.1
      const e2 = makeEnemyPath('e2', 2, 0, 100, 1, 0.9);  // score 1.9
      const e3 = makeEnemyPath('e3', 3, 0, 100, 0, 0.5);  // score 0.5

      const target = sys2.findTarget(tower, [e1, e2, e3]);
      expect(target?.instanceId).toBe('e3');
    });

    it('strongest mode: selects enemy with highest HP in range', () => {
      const sys2 = new CombatSystem({ big_range: bigRangeConfig });
      const tower = makeTowerWithMode('strongest');

      const e1 = makeEnemyPath('e1', 1, 0, 80, 0, 0);
      const e2 = makeEnemyPath('e2', 2, 0, 200, 0, 0);
      const e3 = makeEnemyPath('e3', 3, 0, 50, 0, 0);

      const target = sys2.findTarget(tower, [e1, e2, e3]);
      expect(target?.instanceId).toBe('e2');
    });

    it('weakest mode: selects enemy with lowest HP in range', () => {
      const sys2 = new CombatSystem({ big_range: bigRangeConfig });
      const tower = makeTowerWithMode('weakest');

      const e1 = makeEnemyPath('e1', 1, 0, 80, 0, 0);
      const e2 = makeEnemyPath('e2', 2, 0, 200, 0, 0);
      const e3 = makeEnemyPath('e3', 3, 0, 50, 0, 0);

      const target = sys2.findTarget(tower, [e1, e2, e3]);
      expect(target?.instanceId).toBe('e3');
    });

    it('closest mode: selects enemy nearest to tower position', () => {
      const sys2 = new CombatSystem({ big_range: bigRangeConfig });
      const tower = makeTowerWithMode('closest');

      const e1 = makeEnemyPath('e1', 5, 0, 100, 0, 0);   // dist 5
      const e2 = makeEnemyPath('e2', 1, 0, 100, 0, 0);   // dist 1 — closest
      const e3 = makeEnemyPath('e3', 3, 3, 100, 0, 0);   // dist ~4.24

      const target = sys2.findTarget(tower, [e1, e2, e3]);
      expect(target?.instanceId).toBe('e2');
    });

    it('default (no targetingMode) behaves like first mode', () => {
      const sys2 = new CombatSystem({ big_range: bigRangeConfig });
      const tower = makeTower(bigRangeConfig, 0, 0);
      // No targetingMode set

      const e1 = makeEnemyPath('e1', 1, 0, 100, 3, 0.0);  // score 3.0
      const e2 = makeEnemyPath('e2', 2, 0, 100, 1, 0.5);  // score 1.5

      const target = sys2.findTarget(tower, [e1, e2]);
      expect(target?.instanceId).toBe('e1');
    });
  });
});

// ─── applyDelta unit tests ────────────────────────────────────────────────────

describe('applyDelta', () => {
  it('adds a positive value with the "+" prefix', () => {
    expect(applyDelta(10, '+5')).toBe(15);
  });

  it('adds a fractional value with the "+" prefix', () => {
    expect(applyDelta(3, '+0.3')).toBeCloseTo(3.3, 5);
  });

  it('multiplies by (1 + factor) for "*" prefix — attack speed increase', () => {
    // '*-0.15' → factor = -0.15 → multiply by 0.85
    expect(applyDelta(2.0, '*-0.15')).toBeCloseTo(2.0 * 0.85, 10);
  });

  it('multiplies by 0.85 for "*-0.15" (attack period reduction)', () => {
    const result = applyDelta(1.0, '*-0.15');
    expect(result).toBeCloseTo(0.85, 10);
  });

  it('handles numeric delta (treated as addition)', () => {
    expect(applyDelta(10, 8)).toBe(18);
  });

  it('handles "+0" without changing value', () => {
    expect(applyDelta(42, '+0')).toBe(42);
  });

  it('handles negative addition via "+(-n)" — note: "+5" is strictly positive prefix', () => {
    // applyDelta is defined for '+' prefix as positive floats per spec;
    // this checks that parseFloat handles strings like '+5' correctly
    expect(applyDelta(0, '+5')).toBe(5);
    expect(applyDelta(100, '+0')).toBe(100);
  });
});

// ─── Upgrade-aware CombatSystem tests ────────────────────────────────────────

describe('CombatSystem — upgrade deltas', () => {
  // Tower with tier-2 and tier-3 upgrades including all delta types
  const arrowWithUpgrades: TowerConfig = {
    id: 'arrow_upgraded',
    name: 'Arrow Tower (with upgrades)',
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
  };

  // Flame spire with onHit upgrade deltas
  const flameWithUpgrades: TowerConfig = {
    id: 'flame_upgraded',
    name: 'Flame Spire (with upgrades)',
    class: 'fire',
    category: 'specialty',
    roles: ['aoe', 'damage'],
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
  };

  let system: CombatSystem;

  beforeEach(() => {
    system = new CombatSystem({
      arrow_upgraded: arrowWithUpgrades,
      flame_upgraded: flameWithUpgrades,
    });
  });

  function makeTowerAt(config: TowerConfig, tier: number): TowerState {
    return { instanceId: 'tw1', configId: config.id, ownerId: 'p1', tier, x: 5, y: 5, lastAttackTick: 0 };
  }

  // getDamage

  it('getDamage returns base damage at tier 1', () => {
    const tower = makeTowerAt(arrowWithUpgrades, 1);
    expect(system.getDamage(tower)).toBe(10);
  });

  it('getDamage adds "+5" delta at tier 2 (baseDamage: 10 + 5 = 15)', () => {
    const tower = makeTowerAt(arrowWithUpgrades, 2);
    expect(system.getDamage(tower)).toBe(15);
  });

  it('getDamage adds "+8" delta cumulatively at tier 3 (10 + 5 + 8 = 23)', () => {
    const tower = makeTowerAt(arrowWithUpgrades, 3);
    expect(system.getDamage(tower)).toBe(23);
  });

  // attackPeriodSec via canFire

  it('canFire uses base attackPeriodSec at tier 1 (1.0s = 20 ticks)', () => {
    const tower = makeTowerAt(arrowWithUpgrades, 1);
    tower.lastAttackTick = 0;
    // 1.0s × 20 ticks/s = 20 ticks
    expect(system.canFire(tower, 20)).toBe(true);
    expect(system.canFire(tower, 19)).toBe(false);
  });

  it('canFire reflects "*-0.15" attackPeriod delta at tier 3 (0.85s = 17 ticks)', () => {
    const tower = makeTowerAt(arrowWithUpgrades, 3);
    tower.lastAttackTick = 0;
    // tier2 has no attackPeriodSec delta; tier3 applies *-0.15: 1.0 * 0.85 = 0.85s = 17 ticks
    expect(system.canFire(tower, 17)).toBe(true);
    expect(system.canFire(tower, 16)).toBe(false);
  });

  // range via findTarget

  it('findTarget uses base range at tier 1 (range=3)', () => {
    const tower = makeTowerAt(arrowWithUpgrades, 1);
    const inRange = makeEnemy('e1', 8, 5);    // dist=3, exactly at boundary
    const outOfRange = makeEnemy('e2', 8.01, 5); // dist>3
    expect(system.findTarget(tower, [inRange])?.instanceId).toBe('e1');
    expect(system.findTarget(tower, [outOfRange])).toBeNull();
  });

  it('findTarget uses upgraded range at tier 2 (range=3+0.3=3.3)', () => {
    const tower = makeTowerAt(arrowWithUpgrades, 2);
    // dist=3.2 < 3.3, should be in range
    const enemy = makeEnemy('e1', 8.2, 5); // dist=3.2
    expect(system.findTarget(tower, [enemy])?.instanceId).toBe('e1');
  });

  // onHit deltas

  it('getOnHitEffects returns base dps at tier 1', () => {
    const tower = makeTowerAt(flameWithUpgrades, 1);
    const effects = system.getOnHitEffects(tower);
    expect(effects[0]?.dps).toBe(3);
  });

  it('getOnHitEffects applies "+2" dps delta at tier 2 (dps: 3+2=5)', () => {
    const tower = makeTowerAt(flameWithUpgrades, 2);
    const effects = system.getOnHitEffects(tower);
    expect(effects[0]?.dps).toBe(5);
  });

  it('getOnHitEffects applies durationSec delta at tier 3 (durationSec: 4+2=6)', () => {
    const tower = makeTowerAt(flameWithUpgrades, 3);
    const effects = system.getOnHitEffects(tower);
    // tier2 adds dps+2 (dps=5), tier3 adds durationSec+2 (durationSec=6)
    expect(effects[0]?.dps).toBe(5);
    expect(effects[0]?.durationSec).toBe(6);
  });

  it('getOnHitEffects does not mutate the original config onHit array', () => {
    const tower = makeTowerAt(flameWithUpgrades, 3);
    system.getOnHitEffects(tower);
    // Original config should remain unchanged
    expect(flameWithUpgrades.onHit![0]?.dps).toBe(3);
    expect(flameWithUpgrades.onHit![0]?.durationSec).toBe(4);
  });

  // splashRadius

  it('getSplashTargets uses base splashRadius at tier 1 (1.5)', () => {
    const tower = makeTowerAt(flameWithUpgrades, 1);
    const primary = makeEnemy('e1', 6, 5);
    // dist from primary: 1.4 (in), 1.6 (out)
    const inSplash = makeEnemy('e2', 7.4, 5); // dist from e1 = 1.4
    const outSplash = makeEnemy('e3', 7.6, 5); // dist from e1 = 1.6
    const splashed = system.getSplashTargets(tower, primary, [primary, inSplash, outSplash]);
    expect(splashed.map(e => e.instanceId)).toContain('e2');
    expect(splashed.map(e => e.instanceId)).not.toContain('e3');
  });

  it('getSplashTargets uses upgraded splashRadius at tier 2 (1.5+0.3=1.8)', () => {
    const tower = makeTowerAt(flameWithUpgrades, 2);
    const primary = makeEnemy('e1', 6, 5);
    // dist from e1 = 1.7, in range at tier2 (1.8) but not tier1 (1.5)
    const enemy = makeEnemy('e2', 7.7, 5);
    const splashed = system.getSplashTargets(tower, primary, [primary, enemy]);
    expect(splashed.map(e => e.instanceId)).toContain('e2');
  });
});