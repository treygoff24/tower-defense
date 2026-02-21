// packages/client/src/effects/ProjectileManager.test.ts
//
// Tests pool acquire/release semantics and basic fire() behaviour for
// ProjectileManager.  Phaser objects are fully mocked so no canvas/WebGL is
// required.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectileManager, type TowerFiredPayload } from './ProjectileManager';

// ── Phaser mock infrastructure ────────────────────────────────────────────────

/**
 * Collected 'onComplete' callbacks from scene.tweens.add() calls.
 * Tests can trigger the tween completion by calling these.
 */
let tweenCallbacks: Array<() => void> = [];

/** Create a fresh mock Graphics object (Phaser.GameObjects.Graphics). */
function makeGraphics() {
  return {
    setVisible: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    fillTriangle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    x: 0,
    y: 0,
  };
}

/** Create a mock Arc / Circle (Phaser.GameObjects.Arc). */
function makeCircle() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    scale: 1,
    alpha: 1,
  };
}

/**
 * Build a minimal Phaser.Scene mock that captures tween onComplete callbacks
 * and returns unique objects from add.graphics() / add.circle().
 */
function createMockScene() {
  return {
    add: {
      graphics: vi.fn(() => makeGraphics()),
      circle: vi.fn(() => makeCircle()),
    },
    tweens: {
      add: vi.fn((config: { onComplete?: () => void }) => {
        if (typeof config.onComplete === 'function') {
          tweenCallbacks.push(config.onComplete);
        }
      }),
    },
  };
}

// ── test fixtures ─────────────────────────────────────────────────────────────

type MockScene = ReturnType<typeof createMockScene>;

const FIRE_PAYLOAD: TowerFiredPayload = {
  towerId: 't1',
  targetId: 'e1',
  damage: 10,
  element: 'fire',
  towerX: 2,
  towerY: 5,
  targetX: 5,
  targetY: 7,
};

const DEFAULT_PAYLOAD: TowerFiredPayload = {
  towerId: 't2',
  targetId: 'e2',
  damage: 15,
  towerX: 1,
  towerY: 3,
  targetX: 4,
  targetY: 6,
};

// ── Pool acquire / release ────────────────────────────────────────────────────

describe('ProjectileManager – pool management', () => {
  let scene: MockScene;
  let manager: ProjectileManager;

  beforeEach(() => {
    tweenCallbacks = [];
    scene = createMockScene();
    manager = new ProjectileManager(scene as unknown as import('phaser').Scene, 5);
  });

  it('starts with 0 active projectiles', () => {
    expect(manager.activeCount).toBe(0);
  });

  it('pre-fills exactly poolSize Graphics objects during construction', () => {
    expect(scene.add.graphics).toHaveBeenCalledTimes(5);
  });

  it('acquire() activates a pool slot and returns it', () => {
    const entry = manager.acquire('e1');
    expect(entry).not.toBeNull();
    expect(manager.activeCount).toBe(1);
  });

  it('acquire() returns null when all slots are active (pool exhausted)', () => {
    for (let i = 0; i < 5; i++) manager.acquire(`e${i}`);
    expect(manager.acquire('overflow')).toBeNull();
  });

  it('release() decrements active count to 0', () => {
    const entry = manager.acquire('e1');
    expect(manager.activeCount).toBe(1);
    manager.release(entry!);
    expect(manager.activeCount).toBe(0);
  });

  it('release() makes the slot reusable for a subsequent acquire()', () => {
    const entry = manager.acquire('e1');
    manager.release(entry!);

    const entry2 = manager.acquire('e2');
    expect(entry2).not.toBeNull();
    expect(manager.activeCount).toBe(1);
  });

  it('multiple sequential acquires fill the pool correctly', () => {
    for (let i = 0; i < 5; i++) manager.acquire(`e${i}`);
    expect(manager.activeCount).toBe(5);
  });
});

// ── fire() behaviour ──────────────────────────────────────────────────────────

describe('ProjectileManager – fire()', () => {
  let scene: MockScene;
  let manager: ProjectileManager;

  beforeEach(() => {
    tweenCallbacks = [];
    scene = createMockScene();
    manager = new ProjectileManager(scene as unknown as import('phaser').Scene, 5);
  });

  it('fire() increases active count by 1', () => {
    manager.fire(FIRE_PAYLOAD);
    expect(manager.activeCount).toBe(1);
  });

  it('fire() starts a tween (scene.tweens.add called)', () => {
    manager.fire(FIRE_PAYLOAD);
    expect(scene.tweens.add).toHaveBeenCalledTimes(1);
  });

  it('pool slot is released when the movement tween completes', () => {
    manager.fire(FIRE_PAYLOAD);
    expect(manager.activeCount).toBe(1);

    // Simulate the movement tween completing (first callback registered)
    tweenCallbacks[0]?.();

    // ProjectileManager.release() is called inside _onArrived immediately
    expect(manager.activeCount).toBe(0);
  });

  it('fire() with ice element draws a diamond (fillTriangle, not fillCircle)', () => {
    const iceMockScene = createMockScene();
    const iceManager = new ProjectileManager(
      iceMockScene as unknown as import('phaser').Scene,
      1
    );

    // Capture the graphics object created for the pool entry
    const g = iceMockScene.add.graphics.mock.results[0]!.value as ReturnType<typeof makeGraphics>;

    iceManager.fire({ ...DEFAULT_PAYLOAD, element: 'ice', targetId: 'e_ice' });

    expect(g.fillTriangle).toHaveBeenCalled();
    expect(g.fillCircle).not.toHaveBeenCalled();
  });

  it('fire() with non-ice element draws a circle (fillCircle, not fillTriangle)', () => {
    const mockScene2 = createMockScene();
    const manager2 = new ProjectileManager(
      mockScene2 as unknown as import('phaser').Scene,
      1
    );
    const g = mockScene2.add.graphics.mock.results[0]!.value as ReturnType<typeof makeGraphics>;

    manager2.fire({ ...DEFAULT_PAYLOAD, element: 'fire', targetId: 'e_fire' });

    expect(g.fillCircle).toHaveBeenCalled();
    expect(g.fillTriangle).not.toHaveBeenCalled();
  });

  it('fire() drops silently when pool is exhausted (no throw, active stays at cap)', () => {
    // Fill all 5 slots
    for (let i = 0; i < 5; i++) {
      manager.fire({ ...DEFAULT_PAYLOAD, targetId: `e${i}` });
    }
    expect(manager.activeCount).toBe(5);

    // This fire should be silently dropped
    expect(() => manager.fire({ ...DEFAULT_PAYLOAD, targetId: 'overflow' })).not.toThrow();
    expect(manager.activeCount).toBe(5);
  });

  it('handles 20+ fire() calls within pool capacity gracefully', () => {
    // Pool is size 5; fire 20 — only 5 fit, rest are no-ops
    for (let i = 0; i < 20; i++) {
      manager.fire({ ...DEFAULT_PAYLOAD, targetId: `e${i}` });
    }
    expect(manager.activeCount).toBeLessThanOrEqual(5);
  });
});

// ── Recycling after impact ────────────────────────────────────────────────────

describe('ProjectileManager – recycle & reuse', () => {
  let scene: MockScene;
  let manager: ProjectileManager;

  beforeEach(() => {
    tweenCallbacks = [];
    scene = createMockScene();
    manager = new ProjectileManager(scene as unknown as import('phaser').Scene, 2);
  });

  it('a released slot can be reused for a new projectile', () => {
    manager.fire(FIRE_PAYLOAD);
    expect(manager.activeCount).toBe(1);

    // Simulate movement tween complete → _onArrived → release
    tweenCallbacks[0]?.();
    expect(manager.activeCount).toBe(0);

    // Now fire again — should succeed (slot recycled)
    manager.fire({ ...FIRE_PAYLOAD, targetId: 'e_new' });
    expect(manager.activeCount).toBe(1);
  });

  it('pool correctly tracks 2 simultaneous in-flight projectiles', () => {
    manager.fire({ ...FIRE_PAYLOAD, targetId: 'a' });
    manager.fire({ ...FIRE_PAYLOAD, targetId: 'b' });
    expect(manager.activeCount).toBe(2);
  });

  it('completing one of two in-flight projectiles leaves the other active', () => {
    manager.fire({ ...FIRE_PAYLOAD, targetId: 'a' });
    manager.fire({ ...FIRE_PAYLOAD, targetId: 'b' });

    // Complete first tween only
    tweenCallbacks[0]?.();

    expect(manager.activeCount).toBe(1);
  });
});

// ── bindEvents() ─────────────────────────────────────────────────────────────

describe('ProjectileManager – bindEvents()', () => {
  it('responds to tower_fired events via bindEvents()', () => {
    tweenCallbacks = [];
    const mockScene = createMockScene();
    const manager = new ProjectileManager(
      mockScene as unknown as import('phaser').Scene,
      5
    );

    // Minimal EventEmitter stub
    const listeners: Record<string, Array<(data: unknown) => void>> = {};
    const emitter = {
      on: (event: string, fn: (data: unknown) => void) => {
        listeners[event] = listeners[event] ?? [];
        listeners[event].push(fn);
      },
      emit: (event: string, data: unknown) => {
        listeners[event]?.forEach((fn) => fn(data));
      },
    } as unknown as import('phaser').Events.EventEmitter;

    manager.bindEvents(emitter);

    // Emit a tower_fired event through the emitter
    emitter.emit('tower_fired', FIRE_PAYLOAD);

    expect(manager.activeCount).toBe(1);
  });
});
