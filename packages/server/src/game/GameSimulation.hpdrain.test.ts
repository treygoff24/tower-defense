// packages/server/src/game/GameSimulation.hpdrain.test.ts
// Task 1D: Variable HP drain by enemy type
import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation.js';
import type { EnemyType } from '@td/shared';
import { ENEMY_BASE_DAMAGE } from '@td/shared';

/**
 * Helper: create a simulation in combat phase with empty spawn queue.
 * We bypass startWave() to get full control over which enemies are present.
 */
function makeSimInCombat(): GameSimulation {
  const sim = GameSimulation.create('drain-test-room');
  sim.addPlayer('p1', 'Trey');
  sim.selectClass('p1', 'fire');
  sim.readyUp('p1');
  sim.startGame(); // → 'prep' phase
  // Manually set phase to 'combat' without starting the wave scheduler
  // so that spawnQueue stays empty and no wave enemies interfere.
  (sim as any).room.state.phase = 'combat';
  return sim;
}

/**
 * Spawn a single enemy that will immediately leak (speed = 9999 units/sec).
 * The enemy traverses the entire waypoint path in the first tick.
 */
function spawnLeaker(sim: GameSimulation, type: EnemyType): void {
  const enemySystem = (sim as any).enemySystem;
  enemySystem.spawnEnemy(type, 1000, 9999, 0, []);
}

/**
 * Run a single combat tick with enough dt to traverse the full map path (~42 units).
 * Speed 9999 × dt 0.1 = ~1000 units — far exceeds path length.
 */
function runOneTick(sim: GameSimulation): number {
  sim.tick(0.1);
  return sim.state.baseHp;
}

describe('ENEMY_BASE_DAMAGE constant', () => {
  it('grunt deals 1 damage', () => {
    expect(ENEMY_BASE_DAMAGE.grunt).toBe(1);
  });

  it('runner deals 1 damage', () => {
    expect(ENEMY_BASE_DAMAGE.runner).toBe(1);
  });

  it('tank deals 3 damage', () => {
    expect(ENEMY_BASE_DAMAGE.tank).toBe(3);
  });

  it('flyer deals 2 damage', () => {
    expect(ENEMY_BASE_DAMAGE.flyer).toBe(2);
  });

  it('invisible deals 2 damage', () => {
    expect(ENEMY_BASE_DAMAGE.invisible).toBe(2);
  });

  it('caster deals 2 damage', () => {
    expect(ENEMY_BASE_DAMAGE.caster).toBe(2);
  });

  it('boss deals 10 damage', () => {
    expect(ENEMY_BASE_DAMAGE.boss).toBe(10);
  });
});

describe('GameSimulation — HP drain by enemy type (integration)', () => {
  let sim: GameSimulation;
  let initialHp: number;

  beforeEach(() => {
    sim = makeSimInCombat();
    initialHp = sim.state.baseHp;
  });

  it('grunt leaking drains 1 HP from base', () => {
    spawnLeaker(sim, 'grunt');
    runOneTick(sim);
    expect(sim.state.baseHp).toBe(initialHp - 1);
  });

  it('runner leaking drains 1 HP from base', () => {
    spawnLeaker(sim, 'runner');
    runOneTick(sim);
    expect(sim.state.baseHp).toBe(initialHp - 1);
  });

  it('tank leaking drains 3 HP from base', () => {
    spawnLeaker(sim, 'tank');
    runOneTick(sim);
    expect(sim.state.baseHp).toBe(initialHp - 3);
  });

  it('flyer leaking drains 2 HP from base', () => {
    spawnLeaker(sim, 'flyer');
    runOneTick(sim);
    expect(sim.state.baseHp).toBe(initialHp - 2);
  });

  it('invisible leaking drains 2 HP from base', () => {
    spawnLeaker(sim, 'invisible');
    runOneTick(sim);
    expect(sim.state.baseHp).toBe(initialHp - 2);
  });

  it('caster leaking drains 2 HP from base', () => {
    spawnLeaker(sim, 'caster');
    runOneTick(sim);
    expect(sim.state.baseHp).toBe(initialHp - 2);
  });

  it('boss leaking drains 10 HP from base', () => {
    spawnLeaker(sim, 'boss');
    runOneTick(sim);
    expect(sim.state.baseHp).toBe(initialHp - 10);
  });

  it('multiple enemies of different types accumulate damage correctly', () => {
    // grunt(1) + tank(3) + boss(10) = 14
    spawnLeaker(sim, 'grunt');
    spawnLeaker(sim, 'tank');
    spawnLeaker(sim, 'boss');
    runOneTick(sim);
    expect(sim.state.baseHp).toBe(initialHp - 14);
  });

  it('two tanks leaking drain 6 HP total', () => {
    spawnLeaker(sim, 'tank');
    spawnLeaker(sim, 'tank');
    runOneTick(sim);
    expect(sim.state.baseHp).toBe(initialHp - 6);
  });
});
