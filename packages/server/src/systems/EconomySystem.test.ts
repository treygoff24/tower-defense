// packages/server/src/systems/EconomySystem.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { EconomySystem } from './EconomySystem';

describe('EconomySystem', () => {
  let economy: EconomySystem;

  beforeEach(() => {
    economy = new EconomySystem();
  });

  it('starts with zero gold', () => {
    expect(economy.state.gold).toBe(0);
  });

  it('adds starting gold scaled by player count', () => {
    economy.grantStartingGold(2);
    // Base 200 gold * 2 players
    expect(economy.state.gold).toBe(400);
  });

  it('adds kill bounty', () => {
    economy.addGold(10);
    expect(economy.state.gold).toBe(10);
  });

  it('adds wave completion bonus', () => {
    economy.addWaveBonus(5, 3); // wave 5, 3 players
    expect(economy.state.gold).toBeGreaterThan(0);
  });

  it('spends gold if sufficient', () => {
    economy.addGold(200);
    const result = economy.spendGold(120);
    expect(result).toBe(true);
    expect(economy.state.gold).toBe(80);
  });

  it('refuses to spend gold if insufficient', () => {
    economy.addGold(50);
    const result = economy.spendGold(120);
    expect(result).toBe(false);
    expect(economy.state.gold).toBe(50);
  });

});
