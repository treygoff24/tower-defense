import { describe, it, expect, beforeEach } from 'vitest';
import { ReactionSystem } from './ReactionSystem';
import type { EnemyState, ReactionConfig } from '@td/shared';

const reactions: ReactionConfig[] = [
  {
    id: 'vaporize',
    triggerElement: 'fire',
    requiredStatus: 'soaked',
    effect: { type: 'damage_multiplier', value: 1.5 },
    consumesStatus: true,
    sound: 'sfx_vaporize',
    vfx: 'vfx_steam_burst',
  },
  {
    id: 'freeze',
    triggerElement: 'ice',
    requiredStatus: 'soaked',
    effect: { type: 'apply_status', value: 0, durationSec: 3 },
    consumesStatus: true,
    sound: 'sfx_freeze',
    vfx: 'vfx_freeze',
  },
  {
    id: 'melt',
    triggerElement: 'fire',
    requiredStatus: 'frozen',
    effect: { type: 'damage_multiplier', value: 2.0 },
    consumesStatus: true,
    sound: 'sfx_melt',
    vfx: 'vfx_melt',
  },
  {
    id: 'conflagration',
    triggerElement: 'fire',
    requiredStatus: 'toxin',
    effect: { type: 'aoe_burst', value: 50, aoeRadius: 2.0 },
    consumesStatus: true,
    sound: 'sfx_conflagration',
    vfx: 'vfx_conflagration',
  },
];

function makeEnemy(statuses: { type: string; element: string }[] = []): EnemyState {
  return {
    instanceId: 'e1', type: 'grunt', hp: 100, maxHp: 100, speed: 1, armor: 0,
    x: 5, y: 5, waypointIndex: 0, progress: 0, alive: true,
    statuses: statuses.map((s) => ({
      element: s.element as any,
      type: s.type,
      stacks: 1,
      remainingSec: 5,
    })),
  };
}

describe('ReactionSystem', () => {
  let system: ReactionSystem;

  beforeEach(() => {
    system = new ReactionSystem(reactions);
  });

  it('triggers Vaporize when fire hits soaked enemy', () => {
    const enemy = makeEnemy([{ type: 'soaked', element: 'water' }]);
    const result = system.checkReaction(enemy, 'fire', 20);
    expect(result).toBeDefined();
    expect(result!.reaction.id).toBe('vaporize');
    expect(result!.damage).toBe(30); // 20 * 1.5 = 30
  });

  it('does not trigger when enemy lacks required status', () => {
    const enemy = makeEnemy([]);
    const result = system.checkReaction(enemy, 'fire', 20);
    expect(result).toBeNull();
  });

  it('triggers Freeze when ice hits soaked enemy', () => {
    const enemy = makeEnemy([{ type: 'soaked', element: 'water' }]);
    const result = system.checkReaction(enemy, 'ice', 10);
    expect(result).toBeDefined();
    expect(result!.reaction.id).toBe('freeze');
  });

  it('triggers Melt when fire hits frozen enemy', () => {
    const enemy = makeEnemy([{ type: 'frozen', element: 'ice' }]);
    const result = system.checkReaction(enemy, 'fire', 20);
    expect(result).toBeDefined();
    expect(result!.reaction.id).toBe('melt');
    expect(result!.damage).toBe(40); // 20 * 2.0
  });

  it('triggers Conflagration when fire hits toxin enemy', () => {
    const enemy = makeEnemy([{ type: 'toxin', element: 'poison' }]);
    const result = system.checkReaction(enemy, 'fire', 20);
    expect(result).toBeDefined();
    expect(result!.reaction.id).toBe('conflagration');
  });

  it('consumes status when consumesStatus is true', () => {
    const enemy = makeEnemy([{ type: 'soaked', element: 'water' }]);
    system.checkReaction(enemy, 'fire', 20);
    expect(enemy.statuses.find((s) => s.type === 'soaked')).toBeUndefined();
  });

  it('prioritizes Melt over Vaporize (frozen check before soaked)', () => {
    const enemy = makeEnemy([
      { type: 'soaked', element: 'water' },
      { type: 'frozen', element: 'ice' },
    ]);
    const result = system.checkReaction(enemy, 'fire', 20);
    expect(result!.reaction.id).toBe('melt');
  });
});