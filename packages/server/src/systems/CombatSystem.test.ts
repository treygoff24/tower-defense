import { describe, it, expect, beforeEach } from 'vitest';
import { CombatSystem } from './CombatSystem';
import type { TowerState, EnemyState, TowerConfig } from '@td/shared';

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
});