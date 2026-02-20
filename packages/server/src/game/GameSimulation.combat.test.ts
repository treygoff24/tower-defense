// packages/server/src/game/GameSimulation.combat.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation.js';

describe('GameSimulation — Combat Tick Integration', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = GameSimulation.create('test-room');
    sim.addPlayer('p1', 'Trey');
    sim.selectClass('p1', 'fire');
    sim.readyUp('p1');
    sim.startGame();
  });

  it('enemies take damage from towers during combat', () => {
    // Zone A covers x:[1,2] y:[5,6,7]. Tower at (2,6) is in Zone A.
    // Enemies travel from (-1,7) → (2,7). Distance from (2,6) to (2,7) = 1 → in range 3.
    sim.placeTower('p1', 'arrow_tower', 2, 6);
    sim.startWave();
    // Tick 10 seconds — enough for enemies to enter range and take hits
    for (let i = 0; i < 200; i++) sim.tick(0.05);
    const enemies = Object.values(sim.state.enemies);
    const damagedOrDead = enemies.filter((e) => e.hp < e.maxHp || !e.alive);
    expect(damagedOrDead.length).toBeGreaterThan(0);
  });

  it('leaked enemies damage the base', () => {
    // No towers — wave 1 has 5 grunts that will walk the full path
    sim.startWave();
    const initialBaseHp = sim.state.maxBaseHp;
    // Tick long enough for enemies to traverse the map (~70 tiles of path at speed 1.0 = ~70s)
    for (let i = 0; i < 2000; i++) sim.tick(0.05);
    expect(sim.state.baseHp).toBeLessThan(initialBaseHp);
  });

  it('wave completion transitions phase to prep (or victory)', () => {
    // No towers — all enemies leak, wave ends, transitions out of combat
    sim.startWave();
    // Tick until combat phase ends (enemies leak or die)
    for (let i = 0; i < 5000; i++) {
      sim.tick(0.05);
      const phase = sim.state.phase;
      if (phase === 'prep' || phase === 'victory' || phase === 'defeat') break;
    }
    expect(['prep', 'victory', 'defeat']).toContain(sim.state.phase);
  });
});
