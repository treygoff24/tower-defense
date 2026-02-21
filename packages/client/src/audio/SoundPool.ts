/**
 * SoundPool — enforces polyphony limits and volume normalisation per category.
 *
 * Pure TS: no Web Audio dependency so it can be unit-tested in Node / jsdom.
 *
 * Rules
 * ──────
 * • Max `maxPerCategory` (default 4) simultaneous instances per string key.
 * • A 5th request immediately stops the oldest instance and takes its slot.
 * • Every instance in a category plays at gain = 1 / √N where N is the
 *   current active count (evaluated *after* the new instance is added).
 */

export interface PooledInstance {
  /** Called by the pool when this instance must be forcibly stopped. */
  stop(): void;
  /** Monotonically increasing value used to determine "oldest" — use Date.now() or a counter. */
  readonly startTime: number;
}

export class SoundPool {
  private readonly maxPerCategory: number;
  private readonly pools = new Map<string, PooledInstance[]>();

  constructor(maxPerCategory = 4) {
    this.maxPerCategory = maxPerCategory;
  }

  /**
   * Acquire a slot for `category`.
   *
   * @param instance  The new instance to register (caller creates it).
   * @returns         The normalised volume factor [0, 1] to apply to this instance.
   *                  If the category was full the oldest instance is stopped first.
   */
  acquire(category: string, instance: PooledInstance): number {
    let pool = this.pools.get(category);
    if (!pool) {
      pool = [];
      this.pools.set(category, pool);
    }

    // Evict oldest if at capacity
    if (pool.length >= this.maxPerCategory) {
      const oldest = pool.shift()!;
      oldest.stop();
    }

    pool.push(instance);
    const N = pool.length;
    return 1 / Math.sqrt(N);
  }

  /**
   * Release a specific instance once it has naturally finished.
   * Safe to call even if the instance was already evicted.
   */
  release(category: string, instance: PooledInstance): void {
    const pool = this.pools.get(category);
    if (!pool) return;
    const idx = pool.indexOf(instance);
    if (idx !== -1) pool.splice(idx, 1);
    if (pool.length === 0) this.pools.delete(category);
  }

  /** Current number of active instances in a category. */
  activeCount(category: string): number {
    return this.pools.get(category)?.length ?? 0;
  }

  /** Stop and remove all instances (optionally scoped to one category). */
  clearAll(category?: string): void {
    if (category !== undefined) {
      const pool = this.pools.get(category);
      if (pool) {
        pool.forEach((i) => i.stop());
        this.pools.delete(category);
      }
    } else {
      this.pools.forEach((pool) => pool.forEach((i) => i.stop()));
      this.pools.clear();
    }
  }
}
