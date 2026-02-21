import { describe, it, expect } from 'vitest';
import {
  TICK_RATE,
  TICK_DURATION_MS,
  SNAPSHOT_INTERVAL_MS,
  PREP_PHASE_DURATION_SEC,
  BASE_MAX_HP,
  TOWER_SELL_REFUND_PERCENT,
  MAX_PLAYERS,
  TILE_SIZE,
} from './index.js';
import type {
  ElementType,
  TowerConfig,
  EnemyState,
  GameState,
  ClientCommand,
  ServerEvent,
  GamePhase,
} from './index.js';

describe('Constants', () => {
  it('TICK_RATE is 20', () => {
    expect(TICK_RATE).toBe(20);
  });

  it('TICK_DURATION_MS is 1000 / TICK_RATE', () => {
    expect(TICK_DURATION_MS).toBe(1000 / 20);
  });

  it('SNAPSHOT_INTERVAL_MS is 250', () => {
    expect(SNAPSHOT_INTERVAL_MS).toBe(250);
  });

  it('PREP_PHASE_DURATION_SEC is 30', () => {
    expect(PREP_PHASE_DURATION_SEC).toBe(30);
  });

  it('BASE_MAX_HP is 100', () => {
    expect(BASE_MAX_HP).toBe(100);
  });

  it('TOWER_SELL_REFUND_PERCENT is 0.5', () => {
    expect(TOWER_SELL_REFUND_PERCENT).toBe(0.5);
  });

  it('MAX_PLAYERS is 4', () => {
    expect(MAX_PLAYERS).toBe(4);
  });

  it('TILE_SIZE is 64', () => {
    expect(TILE_SIZE).toBe(64);
  });
});

describe('Type correctness (compile-time checks via assignments)', () => {
  it('ElementType accepts valid values', () => {
    const elements: ElementType[] = ['fire', 'water', 'ice', 'poison'];
    expect(elements).toHaveLength(4);
  });

  it('GamePhase accepts all valid phases', () => {
    const phases: GamePhase[] = [
      'lobby',
      'class_select',
      'prep',
      'combat',
      'post_wave',
      'victory',
      'defeat',
    ];
    expect(phases).toHaveLength(7);
  });

  it('TowerConfig shape is valid', () => {
    const tower: TowerConfig = {
      id: 'fire_basic',
      name: 'Ember Tower',
      class: 'fire',
      category: 'basic',
      roles: ['damage'],
      costGold: 100,
      range: 3,
      attackPeriodSec: 1,
      baseDamage: 20,
      targets: 'both',
      upgrades: [],
    };
    expect(tower.id).toBe('fire_basic');
  });

  it('EnemyState shape is valid', () => {
    const enemy: EnemyState = {
      instanceId: 'e1',
      type: 'grunt',
      hp: 100,
      maxHp: 100,
      speed: 1,
      armor: 0,
      x: 0,
      y: 0,
      waypointIndex: 0,
      progress: 0,
      statuses: [],
      alive: true,
    };
    expect(enemy.instanceId).toBe('e1');
  });

  it('ClientCommand discriminated union works', () => {
    const cmd: ClientCommand = { type: 'place_tower', configId: 'fire_basic', x: 5, y: 3 };
    expect(cmd.type).toBe('place_tower');
  });

  it('ServerEvent discriminated union works', () => {
    const event: ServerEvent = {
      type: 'phase_changed',
      phase: 'combat',
    };
    expect(event.type).toBe('phase_changed');
  });

  it('GameState shape is valid', () => {
    const state: GameState = {
      phase: 'lobby',
      wave: 0,
      maxWaves: 20,
      baseHp: 100,
      maxBaseHp: 100,
      economy: { gold: 200, lumber: 0 },
      players: {},
      towers: {},
      enemies: {},
      prepTimeRemaining: 30,
      tick: 0,
    };
    expect(state.phase).toBe('lobby');
  });
});
