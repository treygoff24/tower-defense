// packages/server/src/systems/TowerSystem.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerSystem } from './TowerSystem';
import type { TowerConfig, MapConfig } from '@td/shared';

const mockTowerConfig: TowerConfig = {
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
  upgrades: [
    { tier: 2, costGold: 40, deltas: { baseDamage: '+5' } },
    { tier: 3, costGold: 80, deltas: { baseDamage: '+10', range: '+0.5' } },
  ],
};

const mockTower100Config: TowerConfig = {
  id: 'heavy_tower',
  name: 'Heavy Tower',
  class: 'shared',
  category: 'basic',
  roles: ['damage'],
  costGold: 100,
  range: 2,
  attackPeriodSec: 2.0,
  baseDamage: 20,
  targets: 'ground',
  upgrades: [
    { tier: 2, costGold: 60, deltas: { baseDamage: '+10' } },
  ],
};

const mockMap: MapConfig = {
  id: 'test-map',
  name: 'Test Map',
  width: 20,
  height: 15,
  tileSize: 64,
  waypoints: [
    { x: 0, y: 7 },
    { x: 5, y: 7 },
    { x: 10, y: 7 },
    { x: 15, y: 7 },
    { x: 19, y: 7 },
  ],
  buildZones: [
    { x: 3, y: 4, width: 5, height: 2 },
    { x: 3, y: 9, width: 5, height: 2 },
  ],
  playerZones: [{ id: 0, minPlayers: 1, buildZones: [0, 1] }],
};

describe('TowerSystem', () => {
  let system: TowerSystem;

  beforeEach(() => {
    system = new TowerSystem({ arrow_tower: mockTowerConfig, heavy_tower: mockTower100Config }, mockMap);
  });

  it('places tower in valid build zone', () => {
    const result = system.placeTower('arrow_tower', 4, 5, 'p1');
    expect(result.ok).toBe(true);
    expect(result.tower).toBeDefined();
    expect(result.tower!.configId).toBe('arrow_tower');
  });

  it('rejects placement outside build zone', () => {
    const result = system.placeTower('arrow_tower', 0, 0, 'p1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('build zone');
  });

  it('rejects placement on occupied tile', () => {
    system.placeTower('arrow_tower', 4, 5, 'p1');
    const result = system.placeTower('arrow_tower', 4, 5, 'p2');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('occupied');
  });

  it('rejects unknown tower config', () => {
    const result = system.placeTower('fake_tower', 4, 5, 'p1');
    expect(result.ok).toBe(false);
  });

  it('upgrades tower to next tier', () => {
    const place = system.placeTower('arrow_tower', 4, 5, 'p1');
    const result = system.upgradeTower(place.tower!.instanceId);
    expect(result.ok).toBe(true);
    expect(result.newTier).toBe(2);
  });

  it('rejects upgrade beyond max tier', () => {
    const place = system.placeTower('arrow_tower', 4, 5, 'p1');
    system.upgradeTower(place.tower!.instanceId);
    system.upgradeTower(place.tower!.instanceId);
    const result = system.upgradeTower(place.tower!.instanceId);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('max tier');
  });

  it('sells tower and removes it', () => {
    const place = system.placeTower('arrow_tower', 4, 5, 'p1');
    const result = system.sellTower(place.tower!.instanceId);
    expect(result.ok).toBe(true);
    expect(result.goldRefund).toBeGreaterThan(0);
    expect(system.getTower(place.tower!.instanceId)).toBeUndefined();
  });

  it('sell refund uses base cost only, not total investment', () => {
    const place = system.placeTower('arrow_tower', 4, 5, 'p1');
    system.upgradeTower(place.tower!.instanceId);
    const result = system.sellTower(place.tower!.instanceId);
    // base cost = 50, refund = round(50 * 0.5) = 25 (NOT (50+40)*0.7=63)
    expect(result.goldRefund).toBe(25);
  });

  // ── New tests for 1A: 50% base-cost sell refund ──────────

  it('sells a 100g base-cost tower for exactly 50g', () => {
    const place = system.placeTower('heavy_tower', 4, 5, 'p1');
    const result = system.sellTower(place.tower!.instanceId);
    expect(result.ok).toBe(true);
    expect(result.goldRefund).toBe(50);
  });

  it('sell refund is based on base cost regardless of upgrade cost', () => {
    // heavy_tower base=100, upgrade=60; total investment=160
    // refund should be round(100 * 0.5) = 50, NOT round(160 * 0.5) = 80
    const place = system.placeTower('heavy_tower', 4, 5, 'p1');
    system.upgradeTower(place.tower!.instanceId);
    const result = system.sellTower(place.tower!.instanceId);
    expect(result.ok).toBe(true);
    expect(result.goldRefund).toBe(50);
  });

  it('selling a nonexistent tower returns ok: false', () => {
    const result = system.sellTower('tower_nonexistent');
    expect(result.ok).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('sold tower tile is freed for future placements', () => {
    const place = system.placeTower('arrow_tower', 4, 5, 'p1');
    const id = place.tower!.instanceId;
    system.sellTower(id);
    // tile should be free again
    const place2 = system.placeTower('arrow_tower', 4, 5, 'p2');
    expect(place2.ok).toBe(true);
    expect(system.getTower(id)).toBeUndefined();
  });
});
