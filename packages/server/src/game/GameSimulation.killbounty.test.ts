// packages/server/src/game/GameSimulation.killbounty.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation.js';

/**
 * Tests for kill bounty gold:
 * - Killing an enemy awards bountyGold from the current wave config
 * - Multiple kills award bountyGold each time
 * - Splash kills also award bountyGold
 *
 * Design notes:
 * - Enemies are spawned with speed=0 so they don't move out of tower range.
 * - A "blocker" enemy with very high HP is injected far from the tower to
 *   prevent wave completion from firing the wave bonus gold, keeping the
 *   kill bounty assertion clean.
 */

function setupSim(): GameSimulation {
  const sim = GameSimulation.create('bounty-test');
  sim.addPlayer('p1', 'Trey');
  sim.selectClass('p1', 'fire');
  sim.readyUp('p1');
  sim.startGame();
  return sim;
}

/** Spawn a stationary enemy (speed=0) at the given position. */
function spawnStationary(sim: GameSimulation, hp: number, x: number, y: number) {
  const enemySys = (sim as any).enemySystem;
  const e = enemySys.spawnEnemy('grunt', hp, 0, 0, ['ground']); // speed=0 → stays in place
  e.x = x;
  e.y = y;
  return e;
}

/**
 * Set up a combat scenario:
 * - Place a tower, start wave, clear spawnQueue.
 * - Inject a "blocker" enemy far from the tower with huge HP so the wave
 *   won't end while we're testing kill bounty (prevents wave bonus contamination).
 */
function startCombat(sim: GameSimulation, towerId: string) {
  sim.placeTower('p1', towerId, 2, 6);
  sim.startWave();
  (sim as any).spawnQueue = [];
  // Blocker at (2, 0) — outside tower range (distance 6 > range 3) and near
  // the path start so it won't leak; keeps aliveCount > 0 to prevent the
  // wave-complete bonus from contaminating gold assertions.
  spawnStationary(sim, 999999, 2, 0);
}

describe('GameSimulation — Kill Bounty Gold', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = setupSim();
  });

  it('awards bountyGold when a primary-hit kill occurs', () => {
    // arrow_tower at (2,6), range=3; stationary enemy at (2,7) is distance 1
    startCombat(sim, 'arrow_tower');

    const target = spawnStationary(sim, 1, 2, 7);
    const goldBefore = sim.state.economy.gold;

    // Tick until the enemy is killed (tower fires every 20 ticks at dt=0.1)
    for (let i = 0; i < 50; i++) {
      sim.tick(0.1);
      if (!target.alive) break;
    }

    expect(target.alive).toBe(false);
    // Wave 1 bountyGold = 5
    expect(sim.state.economy.gold).toBe(goldBefore + 5);
  });

  it('awards bountyGold per kill when multiple enemies are killed', () => {
    startCombat(sim, 'arrow_tower');

    // Three 1-HP stationary enemies within tower range at (2,7)
    const e1 = spawnStationary(sim, 1, 2, 7);
    const e2 = spawnStationary(sim, 1, 2, 7);
    const e3 = spawnStationary(sim, 1, 2, 7);

    const goldBefore = sim.state.economy.gold;

    // Tower fires every 20 ticks. 3 kills need 3 fire events = 60 ticks
    // Use 200 ticks to be safe
    for (let i = 0; i < 200; i++) {
      sim.tick(0.1);
      if (!e1.alive && !e2.alive && !e3.alive) break;
    }

    expect(e1.alive).toBe(false);
    expect(e2.alive).toBe(false);
    expect(e3.alive).toBe(false);
    // 3 kills × 5 bountyGold = 15
    expect(sim.state.economy.gold).toBe(goldBefore + 15);
  });

  it('awards bountyGold for splash damage kills', () => {
    // flame_spire: splashRadius=1.5, baseDamage=22, available to fire class
    startCombat(sim, 'flame_spire');

    // Primary target at (2,7) — within tower range (tower at (2,6), range=3.5)
    const primary = spawnStationary(sim, 1, 2, 7);
    // Splash target at (2.5,7) — 0.5 tiles from primary, within splashRadius=1.5
    const splashVictim = spawnStationary(sim, 1, 2.5, 7);

    const goldBefore = sim.state.economy.gold;

    for (let i = 0; i < 100; i++) {
      sim.tick(0.1);
      if (!primary.alive && !splashVictim.alive) break;
    }

    expect(primary.alive).toBe(false);
    expect(splashVictim.alive).toBe(false);
    // Both kills should award bountyGold: 2 × 5 = 10
    expect(sim.state.economy.gold).toBe(goldBefore + 10);
  });

  it('does NOT award bountyGold when enemy takes damage but survives', () => {
    startCombat(sim, 'arrow_tower');

    // Tanky enemy with 1000 HP — will take damage but survive several ticks
    const tanky = spawnStationary(sim, 1000, 2, 7);
    const goldBefore = sim.state.economy.gold;

    // Tick a handful of times — tower fires once (10 dmg), enemy survives
    for (let i = 0; i < 25; i++) sim.tick(0.1);

    expect(tanky.alive).toBe(true);
    // No kill bounty should be awarded
    expect(sim.state.economy.gold).toBe(goldBefore);
  });

  it('awards correct bountyGold for wave 2 (6 gold/kill)', () => {
    // Advance the scheduler so getCurrentWaveConfig returns wave 2 (bountyGold=6)
    startCombat(sim, 'arrow_tower');
    const waveScheduler = (sim as any).waveScheduler;
    waveScheduler.advance(); // currentWave = 2 → getCurrentWaveConfig returns waves[1]
    (sim as any).room.state.wave = 2;

    const target = spawnStationary(sim, 1, 2, 7);
    const goldBefore = sim.state.economy.gold;

    for (let i = 0; i < 50; i++) {
      sim.tick(0.1);
      if (!target.alive) break;
    }

    expect(target.alive).toBe(false);
    // Wave 2 bountyGold = 6
    expect(sim.state.economy.gold).toBe(goldBefore + 6);
  });
});
