// packages/client/src/effects/ProjectileManager.ts
import Phaser from 'phaser';

// ── Constants ─────────────────────────────────────────────────────────────────
const POOL_MAX = 64;
const TRAVEL_MS = 250;
const FLASH_DURATION_MS = 120;
const PROJECTILE_RADIUS = 5;
const PROJECTILE_DEPTH = 25;

/** Element → fill colour */
const ELEMENT_COLORS: Record<string, number> = {
  fire: 0xff6600,
  water: 0x0066ff,
  ice: 0x00ccff,
  poison: 0x00cc00,
};

const DEFAULT_COLOR = 0xcccccc;

// ── Internal pool entry ───────────────────────────────────────────────────────
interface PoolEntry {
  sprite: Phaser.GameObjects.Arc;
  active: boolean;
  tween: Phaser.Tweens.Tween | null;
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * ProjectileManager
 *
 * Object pool (max 64) of circular projectile sprites.
 * Each projectile travels from origin to target over 250 ms, then
 * produces a brief flash before recycling back to the pool.
 *
 * Usage:
 *   const pm = new ProjectileManager(scene);
 *   pm.fire(towerPx, towerPy, enemyPx, enemyPy, 'fire', () => { ... });
 */
export class ProjectileManager {
  private scene: Phaser.Scene;
  private pool: PoolEntry[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initPool();
  }

  // ── Initialise pool ─────────────────────────────────────────────────────────
  private initPool(): void {
    for (let i = 0; i < POOL_MAX; i++) {
      const sprite = this.scene.add.circle(0, 0, PROJECTILE_RADIUS, DEFAULT_COLOR);
      sprite.setVisible(false);
      sprite.setDepth(PROJECTILE_DEPTH);
      sprite.setActive(false);
      this.pool.push({ sprite, active: false, tween: null });
    }
  }

  // ── Acquire from pool ───────────────────────────────────────────────────────
  private acquire(): PoolEntry | null {
    return this.pool.find((e) => !e.active) ?? null;
  }

  // ── Recycle back to pool ────────────────────────────────────────────────────
  private recycle(entry: PoolEntry): void {
    if (entry.tween) {
      entry.tween.stop();
      entry.tween = null;
    }
    entry.active = false;
    entry.sprite.setVisible(false);
    entry.sprite.setAlpha(1);
    entry.sprite.setScale(1);
    entry.sprite.setActive(false);
  }

  // ── Public fire API ─────────────────────────────────────────────────────────
  /**
   * Fire a projectile from (fromX, fromY) to (toX, toY).
   * @param element Optional element name for tinting ('fire', 'water', 'ice', 'poison')
   * @param onArrive Optional callback invoked when the projectile reaches its target
   */
  fire(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    element?: string,
    onArrive?: () => void,
  ): void {
    const entry = this.acquire();
    if (!entry) return; // pool exhausted

    const color = element ? (ELEMENT_COLORS[element] ?? DEFAULT_COLOR) : DEFAULT_COLOR;

    // Reset sprite
    entry.active = true;
    entry.sprite.setActive(true);
    entry.sprite.setPosition(fromX, fromY);
    entry.sprite.setFillStyle(color);
    entry.sprite.setAlpha(1);
    entry.sprite.setScale(1);
    entry.sprite.setVisible(true);

    // Travel tween
    entry.tween = this.scene.tweens.add({
      targets: entry.sprite,
      x: toX,
      y: toY,
      duration: TRAVEL_MS,
      ease: 'Linear',
      onComplete: () => {
        entry.tween = null;
        onArrive?.();
        this.playArrivalFlash(entry, color);
      },
    });
  }

  // ── Arrival flash, then recycle ─────────────────────────────────────────────
  private playArrivalFlash(entry: PoolEntry, color: number): void {
    // Briefly expand + fade
    entry.sprite.setFillStyle(color);
    entry.sprite.setAlpha(0.9);

    this.scene.tweens.add({
      targets: entry.sprite,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: FLASH_DURATION_MS,
      ease: 'Quad.Out',
      onComplete: () => {
        this.recycle(entry);
      },
    });
  }

  // ── Utility ─────────────────────────────────────────────────────────────────
  /** Number of currently active (in-flight) projectiles. */
  getActiveCount(): number {
    return this.pool.filter((e) => e.active).length;
  }

  /** Total capacity of the pool. */
  getPoolSize(): number {
    return this.pool.length;
  }

  /** Cancel and recycle all active projectiles. */
  clear(): void {
    for (const entry of this.pool) {
      if (entry.active) {
        this.recycle(entry);
      }
    }
  }

  /** Destroy all pool sprites — call when the scene shuts down. */
  destroy(): void {
    for (const entry of this.pool) {
      if (entry.tween) entry.tween.stop();
      entry.sprite.destroy();
    }
    this.pool = [];
  }
}
