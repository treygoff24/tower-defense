// packages/client/src/effects/ProjectileManager.ts
import Phaser from 'phaser';

const ELEMENT_COLORS: Record<string, number> = {
  fire: 0xff6600,
  water: 0x0066ff,
  ice: 0x00ccff,
  poison: 0x00cc00,
};
const DEFAULT_COLOR = 0xcccccc;
const PROJECTILE_RADIUS = 4;
const TWEEN_DURATION_MS = 250;
const TILE_SIZE = 64;

export interface TowerFiredPayload {
  towerId: string;
  targetId: string;
  damage: number;
  element?: string;
  towerX: number;
  towerY: number;
  targetX: number;
  targetY: number;
}

interface PoolEntry {
  graphics: Phaser.GameObjects.Graphics;
  active: boolean;
}

/**
 * Object-pooled projectile manager using Graphics objects.
 * Pre-allocates a fixed pool; silently drops fire() when exhausted.
 */
export class ProjectileManager {
  private scene: Phaser.Scene;
  private pool: PoolEntry[];
  private _activeCount = 0;

  constructor(scene: Phaser.Scene, poolSize = 64) {
    this.scene = scene;
    this.pool = [];
    for (let i = 0; i < poolSize; i++) {
      const g = this.scene.add.graphics();
      g.setVisible(false);
      g.setDepth(100);
      this.pool.push({ graphics: g, active: false });
    }
  }

  get activeCount(): number {
    return this._activeCount;
  }

  /** Acquire a pool slot, returning the entry or null if exhausted. */
  acquire(targetId: string): PoolEntry | null {
    const slot = this.pool.find((e) => !e.active);
    if (!slot) return null;
    slot.active = true;
    this._activeCount++;
    return slot;
  }

  /** Release a pool slot back. */
  release(entry: PoolEntry): void {
    if (!entry.active) return;
    entry.active = false;
    entry.graphics.setVisible(false);
    entry.graphics.clear();
    this._activeCount--;
  }

  /** Bind to a Phaser EventEmitter so tower_fired events auto-fire projectiles. */
  bindEvents(emitter: Phaser.Events.EventEmitter): void {
    emitter.on('tower_fired', (data: TowerFiredPayload) => {
      this.fire(data);
    });
  }

  /** Fire a projectile from tower to target. */
  fire(payload: TowerFiredPayload): void {
    const entry = this.acquire(payload.targetId);
    if (!entry) return; // pool exhausted — silently drop

    const g = entry.graphics;
    const color = payload.element
      ? (ELEMENT_COLORS[payload.element] ?? DEFAULT_COLOR)
      : DEFAULT_COLOR;

    const fromX = payload.towerX * TILE_SIZE + TILE_SIZE / 2;
    const fromY = payload.towerY * TILE_SIZE + TILE_SIZE / 2;
    const toX = payload.targetX * TILE_SIZE + TILE_SIZE / 2;
    const toY = payload.targetY * TILE_SIZE + TILE_SIZE / 2;

    g.clear();
    g.fillStyle(color, 1);
    if (payload.element === 'ice') {
      // Diamond shape for ice
      g.fillTriangle(0, -PROJECTILE_RADIUS, PROJECTILE_RADIUS, 0, 0, PROJECTILE_RADIUS);
    } else {
      g.fillCircle(0, 0, PROJECTILE_RADIUS);
    }
    g.setPosition(fromX, fromY);
    g.setVisible(true);

    this.scene.tweens.add({
      targets: g,
      x: toX,
      y: toY,
      duration: TWEEN_DURATION_MS,
      ease: 'Linear',
      onComplete: () => {
        this.release(entry);
      },
    });
  }
}
