// packages/server/src/systems/EconomySystem.ts
import { EconomyState, TOWER_SELL_REFUND_PERCENT } from '@td/shared';

const BASE_STARTING_GOLD = 100;
const BASE_WAVE_BONUS = 20;
const WAVE_BONUS_SCALING = 5;

export class EconomySystem {
  state: EconomyState;

  constructor() {
    this.state = { gold: 0, lumber: 0 };
  }

  grantStartingGold(playerCount: number): void {
    this.state.gold = BASE_STARTING_GOLD * playerCount;
  }

  addGold(amount: number): void {
    this.state.gold += amount;
  }

  addWaveBonus(waveNumber: number, playerCount: number): void {
    const bonus = (BASE_WAVE_BONUS + WAVE_BONUS_SCALING * waveNumber) * playerCount;
    this.state.gold += bonus;
  }

  spendGold(amount: number): boolean {
    if (this.state.gold < amount) return false;
    this.state.gold -= amount;
    return true;
  }

  refundTower(originalCost: number): void {
    this.state.gold += Math.floor(originalCost * TOWER_SELL_REFUND_PERCENT);
  }

  canAfford(amount: number): boolean {
    return this.state.gold >= amount;
  }
}
