// packages/server/src/game/GameSimulation.killbounty.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation.js';

/**
 * Tests for kill bounty gold:
 * - Killing an enemy awards bountyGold from the current wave config
 * - Multiple kills award bountyGold each time
 * - Splash kills also award bountyGold
 *
 * Strategy: inject a "blocker" enemy with very high HP (won't die in a few ticks,
 * won't reach end of path) to prevent wave completion from firing the wave bonus,
 * allowing us to isolate kill bounty gold cleanly.
 */

function setupSim(): GameSimulation {
  const sim = GameSimulation.create('bounty-test');
  sim.addPlayer('p1', 'Trey');
  sim.selectClass('p1', 'fire');
  sim.readyUp('p1');
  sim.startGame();
  return sim;
}

/** Spawn an enemy at the given position with specified HP. */
function spawnAt(sim: GameSimulation, hp: number, x: number, y: number) {
  const enemySys = (sim as any).enemySystem;
  const e = enemySys.spawnEnemy('grunt', hp, 1.0, 0, ['ground']);
  e.x = x;
  e.y = y;
  return e;
}

/**
 * Set up a combat scenario:
 * - place a tower, start wave, clear spawnQueue
 * - inject a "blocker" enemy far from the tower (won't die fast)
 *   so the wave won't complete while we run a few ticks
 */
function startCombat(sim: GameSimulation, towerId: string) {
  sim.placeTower('p1', towerId, 2, 6);
  sim.startWave();
  // Clear auto-spawn queue
  (sim as any).spawnQueue = [];
  // Blocker: very high HP, far away — prevents wave completion
  spawnAt(sim, 999999, 20, 3);
}

describe('GameSimulation — Kill Bounty Gold', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = setupSim();
  });

  it('awards bountyGold when a primary-hit kill occurs', () => {
    // arrow_tower at (2,6), range=3; path runs through (2,7) which is distance 1
    startCombat(sim, 'arrow_tower');

    // Inject a single 1-HP enemy within tower range
    const target = spawnAt(sim, 1, 2, 7);

    const goldBefore = sim.state.economy.gold;

    // Tick until the enemy is killed (tower fires after attackPeriodSec = 1s)
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

    // Three 1-HP enemies at the same spot — all within tower range
    const e1 = spawnAt(sim, 1, 2, 7);
    const e2 = spawnAt(sim, 1, 2, 7);
    const e3 = spawnAt(sim, 1, 2, 7);

    const goldBefore = sim.state.economy.gold;

    // Tick long enough for all 3 to be killed (tower fires every 1s, 3 seconds needed)
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
    // flame_spire: splashRadius=1.5, baseDamage=22, fire class tower
    startCombat(sim, 'flame_spire');

    // Primary target: 1 HP, within tower range at (2,7)
    const primary = spawnAt(sim, 1, 2, 7);
    // Splash target: 1 HP, within splash radius (1.5) of primary
    const splash = spawnAt(sim, 1, 2.5, 7);

    const goldBefore = sim.state.economy.gold;

    for (let i = 0; i < 100; i++) {
      sim.tick(0.1);
      if (!primary.alive && !splash.alive) break;
    }

    expect(primary.alive).toBe(false);
    expect(splash.alive).toBe(false);
    // Both kills should award bountyGold: 2 × 5 = 10
    expect(sim.state.economy.gold).toBe(goldBefore + 10);
  });

  it('does NOT award bountyGold when enemy takes damage but survives', () => {
    startCombat(sim, 'arrow_tower');

    // Tanky enemy with 1000 HP — won't die in a few ticks
    const enemy = spawnAt(sim, 1000, 2, 7);
    const goldBefore = sim.state.economy.gold;

    // Only tick a few times so tower fires but enemy survives
    for (let i = 0; i < 15; i++) sim.tick(0.1);

    expect(enemy.alive).toBe(true);
    // No kill bounty should be awarded
    expect(sim.state.economy.gold).toBe(goldBefore);
  });

  it('awards correct bountyGold for wave 2 (6 gold/kill)', () => {
    // Advance to wave 2 directly by manipulating the scheduler
    startCombat(sim, 'arrow_tower');
    // Advance scheduler to wave 2 (currentWave goes from 1 to 2)
    const waveScheduler = (sim as any).waveScheduler;
    waveScheduler.advance(); // currentWave = 2 → getCurrentWaveConfig returns waves[1] (bountyGold=6)
    (sim as any).room.state.wave = 2;

    const target = spawnAt(sim, 1, 2, 7);
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
