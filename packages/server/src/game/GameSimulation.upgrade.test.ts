// packages/server/src/game/GameSimulation.upgrade.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation.js';

/**
 * Helper — sets up a simulation in prep phase with starting gold
 * and places one arrow_tower at (1, 5) owned by 'p1'.
 * Returns the simulation and the instanceId of the placed tower.
 */
function setupWithTower(): { sim: GameSimulation; instanceId: string } {
  const sim = GameSimulation.create('test-room');
  sim.addPlayer('p1', 'Trey');
  sim.selectClass('p1', 'fire');
  sim.readyUp('p1');
  sim.startGame(); // → prep phase, starting gold granted

  // arrow_tower costs 50g; starting gold is 200 (1 player) — plenty
  const placeResult = sim.placeTower('p1', 'arrow_tower', 1, 2);
  expect(placeResult.ok).toBe(true);

  const instanceId = Object.keys(sim.state.towers)[0]!;
  return { sim, instanceId };
}

describe('GameSimulation — Tower Upgrade', () => {
  describe('Success path', () => {
    it('tier 1→2 upgrade succeeds and returns newTier=2', () => {
      const { sim, instanceId } = setupWithTower();
      const result = sim.upgradeTower('p1', instanceId);
      expect(result.ok).toBe(true);
      expect(result.newTier).toBe(2);
    });

    it('tier 2→3 upgrade succeeds and returns newTier=3', () => {
      const { sim, instanceId } = setupWithTower();
      sim.cheatAddGold(10000); // ensure plenty of gold

      const r1 = sim.upgradeTower('p1', instanceId);
      expect(r1.ok).toBe(true);
      expect(r1.newTier).toBe(2);

      const r2 = sim.upgradeTower('p1', instanceId);
      expect(r2.ok).toBe(true);
      expect(r2.newTier).toBe(3);
    });

    it('deducts correct gold for tier 1→2 upgrade (arrow_tower tier2 costs 35g)', () => {
      const { sim, instanceId } = setupWithTower();
      const goldBefore = sim.state.economy.gold;
      const result = sim.upgradeTower('p1', instanceId);
      expect(result.ok).toBe(true);
      // arrow_tower tier 2 cost = 35
      expect(sim.state.economy.gold).toBe(goldBefore - 35);
    });

    it('deducts correct gold for tier 2→3 upgrade (arrow_tower tier3 costs 70g)', () => {
      const { sim, instanceId } = setupWithTower();
      sim.cheatAddGold(10000);
      sim.upgradeTower('p1', instanceId); // 1→2

      const goldBefore = sim.state.economy.gold;
      const result = sim.upgradeTower('p1', instanceId); // 2→3
      expect(result.ok).toBe(true);
      // arrow_tower tier 3 cost = 70
      expect(sim.state.economy.gold).toBe(goldBefore - 70);
    });

    it('tower tier is reflected in game state after upgrade', () => {
      const { sim, instanceId } = setupWithTower();
      sim.upgradeTower('p1', instanceId);
      expect(sim.state.towers[instanceId]?.tier).toBe(2);
    });
  });

  describe('Rejection cases', () => {
    it('rejects upgrade if player does not own the tower', () => {
      const { sim, instanceId } = setupWithTower();
      const result = sim.upgradeTower('p2', instanceId); // p2 doesn't own it
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/own/i);
    });

    it('rejects upgrade at max tier (3)', () => {
      const { sim, instanceId } = setupWithTower();
      sim.cheatAddGold(10000);
      sim.upgradeTower('p1', instanceId); // 1→2
      sim.upgradeTower('p1', instanceId); // 2→3

      const result = sim.upgradeTower('p1', instanceId); // should fail
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/max tier/i);
    });

    it('rejects upgrade with insufficient gold', () => {
      const { sim, instanceId } = setupWithTower();
      // Drain all gold
      (sim as any).economy.state.gold = 0;
      const result = sim.upgradeTower('p1', instanceId);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/gold/i);
    });

    it('does not deduct gold when upgrade is rejected (insufficient funds)', () => {
      const { sim, instanceId } = setupWithTower();
      (sim as any).economy.state.gold = 10; // not enough for tier2 (35g)
      const goldBefore = sim.state.economy.gold;
      const result = sim.upgradeTower('p1', instanceId);
      expect(result.ok).toBe(false);
      expect(sim.state.economy.gold).toBe(goldBefore); // unchanged
    });

    it('rejects upgrade of nonexistent tower', () => {
      const { sim } = setupWithTower();
      const result = sim.upgradeTower('p1', 'tower_nonexistent');
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/not found/i);
    });
  });
});
