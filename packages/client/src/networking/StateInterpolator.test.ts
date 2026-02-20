// packages/client/src/networking/StateInterpolator.test.ts
import { describe, it, expect } from 'vitest';
import { StateInterpolator } from './StateInterpolator';
import type { EnemyState } from '@td/shared';

function makeEnemy(x: number, y: number): EnemyState {
  return {
    instanceId: 'e1',
    type: 'grunt',
    hp: 100,
    maxHp: 100,
    speed: 1,
    armor: 0,
    x,
    y,
    waypointIndex: 0,
    progress: 0,
    statuses: [],
    alive: true,
  };
}

describe('StateInterpolator', () => {
  it('returns current position if no previous state', () => {
    const interp = new StateInterpolator();
    interp.pushSnapshot({ enemies: { e1: makeEnemy(5, 5) } } as unknown as import('@td/shared').GameState, 0);
    const pos = interp.getEnemyPosition('e1', 0);
    expect(pos).toEqual({ x: 5, y: 5 });
  });

  it('interpolates between two snapshots', () => {
    const interp = new StateInterpolator();
    interp.pushSnapshot({ enemies: { e1: makeEnemy(0, 5) } } as unknown as import('@td/shared').GameState, 0);
    interp.pushSnapshot({ enemies: { e1: makeEnemy(10, 5) } } as unknown as import('@td/shared').GameState, 250);
    // At time 125ms (halfway between snapshots)
    const pos = interp.getEnemyPosition('e1', 125);
    expect(pos!.x).toBeCloseTo(5, 0);
    expect(pos!.y).toBeCloseTo(5, 0);
  });
});