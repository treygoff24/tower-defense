// packages/server/src/systems/WaveScheduler.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { WaveScheduler } from './WaveScheduler';
import type { WaveConfig } from '@td/shared';

const mockWaves: WaveConfig[] = [
  {
    wave: 1,
    groups: [{ enemyType: 'grunt', count: 5, hp: 50, speed: 1, armor: 0, tags: ['ground'], spawnIntervalSec: 0.5 }],
    bountyGold: 5,
    telegraph: 'Grunts incoming!',
  },
  {
    wave: 2,
    groups: [{ enemyType: 'runner', count: 8, hp: 30, speed: 1.5, armor: 0, tags: ['ground'], spawnIntervalSec: 0.3 }],
    bountyGold: 4,
    telegraph: 'Fast runners approaching!',
  },
];

describe('WaveScheduler', () => {
  let scheduler: WaveScheduler;

  beforeEach(() => {
    scheduler = new WaveScheduler(mockWaves);
  });

  it('starts at wave 0 (no wave active)', () => {
    expect(scheduler.currentWave).toBe(0);
  });

  it('returns next wave config', () => {
    const next = scheduler.getNextWave();
    expect(next).toBeDefined();
    expect(next!.wave).toBe(1);
  });

  it('advances to next wave', () => {
    scheduler.advance();
    expect(scheduler.currentWave).toBe(1);
  });

  it('reports if more waves remain', () => {
    expect(scheduler.hasMoreWaves()).toBe(true);
    scheduler.advance();
    scheduler.advance();
    expect(scheduler.hasMoreWaves()).toBe(false);
  });

  it('produces spawn events for a wave', () => {
    scheduler.advance();
    const spawns = scheduler.getSpawnEvents(1);
    expect(spawns).toHaveLength(5);
    expect(spawns[0].enemyType).toBe('grunt');
    expect(spawns[1].spawnAtSec).toBeGreaterThan(spawns[0].spawnAtSec);
  });

  it('scales enemy HP by player count', () => {
    scheduler.advance();
    const spawns = scheduler.getSpawnEvents(3); // 3 players
    // HP = 50 * (1 + 0.3 * (3-1)) = 50 * 1.6 = 80
    expect(spawns[0].hp).toBe(80);
  });
});
