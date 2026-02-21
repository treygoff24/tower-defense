// packages/server/src/systems/TowerSystem.ts
import type { TowerConfig, TowerState, MapConfig } from '@td/shared';
import { TOWER_SELL_REFUND_PERCENT } from '@td/shared';

// NOTE: nextTowerId is intentionally an instance-level counter (not module-level)
// to prevent state leaking between test runs in Vitest.

interface PlaceResult {
  ok: boolean;
  tower?: TowerState;
  reason?: string;
}

interface UpgradeResult {
  ok: boolean;
  newTier?: number;
  cost?: number;
  reason?: string;
}

interface SellResult {
  ok: boolean;
  goldRefund?: number;
  reason?: string;
}

export class TowerSystem {
  private configs: Record<string, TowerConfig>;
  private map: MapConfig;
  private towers: Map<string, TowerState> = new Map();
  private occupiedTiles: Set<string> = new Set();
  private towerInvestment: Map<string, number> = new Map();
  private nextTowerId = 1; // instance-level to avoid cross-test contamination

  constructor(configs: Record<string, TowerConfig>, map: MapConfig) {
    this.configs = configs;
    this.map = map;
  }

  private tileKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  private isInBuildZone(x: number, y: number): boolean {
    return this.map.buildZones.some(
      (zone) => x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.height,
    );
  }

  placeTower(configId: string, x: number, y: number, ownerId: string): PlaceResult {
    const config = this.configs[configId];
    if (!config) return { ok: false, reason: 'Unknown tower config' };

    if (!this.isInBuildZone(x, y)) {
      return { ok: false, reason: 'Not in a build zone' };
    }

    if (this.occupiedTiles.has(this.tileKey(x, y))) {
      return { ok: false, reason: 'Tile is occupied' };
    }

    const instanceId = `tower_${this.nextTowerId++}`;
    const tower: TowerState = {
      instanceId,
      configId,
      ownerId,
      tier: 1,
      x,
      y,
      lastAttackTick: 0,
    };

    this.towers.set(instanceId, tower);
    this.occupiedTiles.add(this.tileKey(x, y));
    this.towerInvestment.set(instanceId, config.costGold);

    return { ok: true, tower };
  }

  upgradeTower(instanceId: string): UpgradeResult {
    const tower = this.towers.get(instanceId);
    if (!tower) return { ok: false, reason: 'Tower not found' };

    const config = this.configs[tower.configId];
    const upgrade = config.upgrades.find((u) => u.tier === tower.tier + 1);
    if (!upgrade) return { ok: false, reason: 'Already at max tier' };

    tower.tier = upgrade.tier;
    const current = this.towerInvestment.get(instanceId) ?? 0;
    this.towerInvestment.set(instanceId, current + upgrade.costGold);

    return { ok: true, newTier: tower.tier, cost: upgrade.costGold };
  }

  sellTower(instanceId: string): SellResult {
    const tower = this.towers.get(instanceId);
    if (!tower) return { ok: false, reason: 'Tower not found' };

    const baseCost = this.configs[tower.configId].costGold;
    const refund = Math.round(baseCost * TOWER_SELL_REFUND_PERCENT);

    this.towers.delete(instanceId);
    this.occupiedTiles.delete(this.tileKey(tower.x, tower.y));
    this.towerInvestment.delete(instanceId);

    return { ok: true, goldRefund: refund };
  }

  getTower(instanceId: string): TowerState | undefined {
    return this.towers.get(instanceId);
  }

  getAllTowers(): TowerState[] {
    return Array.from(this.towers.values());
  }

  getTowersAsRecord(): Record<string, TowerState> {
    const record: Record<string, TowerState> = {};
    for (const [id, tower] of this.towers) {
      record[id] = tower;
    }
    return record;
  }

  getUpgradeCost(instanceId: string): number | null {
    const tower = this.towers.get(instanceId);
    if (!tower) return null;
    const config = this.configs[tower.configId];
    const upgrade = config.upgrades.find((u) => u.tier === tower.tier + 1);
    return upgrade?.costGold ?? null;
  }

  getConfig(configId: string): TowerConfig | undefined {
    return this.configs[configId];
  }
}
