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
    system = new TowerSystem({ arrow_tower: mockTowerConfig }, mockMap);
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

  it('returns total gold invested for refund calculation', () => {
    const place = system.placeTower('arrow_tower', 4, 5, 'p1');
    system.upgradeTower(place.tower!.instanceId);
    const result = system.sellTower(place.tower!.instanceId);
    // 50 (base) + 40 (tier 2) = 90 * 0.7 = 63
    expect(result.goldRefund).toBe(63);
  });
});
