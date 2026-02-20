// packages/server/src/systems/EnemySystem.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { EnemySystem } from './EnemySystem';
import type { Vec2 } from '@td/shared';

const waypoints: Vec2[] = [
  { x: 0, y: 5 },
  { x: 5, y: 5 },
  { x: 10, y: 5 },
  { x: 15, y: 5 },
];

describe('EnemySystem', () => {
  let system: EnemySystem;

  beforeEach(() => {
    system = new EnemySystem(waypoints);
  });

  it('spawns an enemy at the first waypoint', () => {
    const enemy = system.spawnEnemy('grunt', 100, 1.0, 0, ['ground']);
    expect(enemy.x).toBe(0);
    expect(enemy.y).toBe(5);
    expect(enemy.waypointIndex).toBe(0);
    expect(enemy.alive).toBe(true);
  });

  it('moves enemy toward next waypoint each tick', () => {
    const enemy = system.spawnEnemy('grunt', 100, 2.0, 0, ['ground']);
    system.update(1.0); // 1 second at speed 2 = 2 tiles
    expect(enemy.x).toBeGreaterThan(0);
    expect(enemy.waypointIndex).toBe(0); // still heading to wp 1
  });

  it('advances waypoint index when reaching a waypoint', () => {
    const enemy = system.spawnEnemy('grunt', 100, 10, 0, ['ground']);
    system.update(1.0); // speed 10, should reach multiple waypoints
    expect(enemy.waypointIndex).toBeGreaterThan(0);
  });

  it('marks enemy as reached-end when passing last waypoint', () => {
    const enemy = system.spawnEnemy('grunt', 100, 100, 0, ['ground']);
    system.update(1.0); // very fast, should reach end
    const leaked = system.getLeakedEnemies();
    expect(leaked.length).toBeGreaterThan(0);
  });

  it('damages an enemy', () => {
    const enemy = system.spawnEnemy('grunt', 100, 1, 0, ['ground']);
    system.damageEnemy(enemy.instanceId, 30);
    expect(enemy.hp).toBe(70);
  });

  it('kills an enemy when HP <= 0', () => {
    const enemy = system.spawnEnemy('grunt', 50, 1, 0, ['ground']);
    system.damageEnemy(enemy.instanceId, 60);
    expect(enemy.alive).toBe(false);
  });

  it('applies armor reduction to damage', () => {
    const enemy = system.spawnEnemy('grunt', 100, 1, 5, ['ground']);
    system.damageEnemy(enemy.instanceId, 20);
    // 20 - 5 armor = 15 damage, HP = 85
    expect(enemy.hp).toBe(85);
  });

  it('tracks alive enemy count', () => {
    system.spawnEnemy('grunt', 100, 1, 0, ['ground']);
    system.spawnEnemy('grunt', 100, 1, 0, ['ground']);
    expect(system.aliveCount).toBe(2);
    const enemies = system.getAliveEnemies();
    system.damageEnemy(enemies[0].instanceId, 200);
    expect(system.aliveCount).toBe(1);
  });

  it('applies status effects', () => {
    const enemy = system.spawnEnemy('grunt', 100, 1, 0, ['ground']);
    system.applyStatus(enemy.instanceId, {
      element: 'fire',
      type: 'burning',
      stacks: 1,
      remainingSec: 5,
    });
    expect(enemy.statuses.length).toBe(1);
    expect(enemy.statuses[0].type).toBe('burning');
  });

  it('updates status durations each tick', () => {
    const enemy = system.spawnEnemy('grunt', 100, 1, 0, ['ground']);
    system.applyStatus(enemy.instanceId, {
      element: 'fire',
      type: 'burning',
      stacks: 1,
      remainingSec: 2,
    });
    system.update(1.0);
    expect(enemy.statuses[0].remainingSec).toBeCloseTo(1.0, 1);
  });

  it('removes expired statuses', () => {
    const enemy = system.spawnEnemy('grunt', 100, 1, 0, ['ground']);
    system.applyStatus(enemy.instanceId, {
      element: 'fire',
      type: 'burning',
      stacks: 1,
      remainingSec: 0.5,
    });
    system.update(1.0);
    expect(enemy.statuses.length).toBe(0);
  });
});
