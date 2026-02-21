// packages/client/src/audio/SoundPool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SoundPool, type PooledInstance } from './SoundPool';

// ─── helpers ────────────────────────────────────────────────────────────────

let _tick = 0;
function makeInstance(stopFn?: () => void): PooledInstance {
  return {
    startTime: ++_tick,
    stop: stopFn ?? vi.fn(),
  };
}

// ─── core polyphony ─────────────────────────────────────────────────────────

describe('SoundPool – polyphony limits', () => {
  it('allows up to maxPerCategory simultaneous instances', () => {
    const pool = new SoundPool(4);
    for (let i = 0; i < 4; i++) pool.acquire('sfx', makeInstance());
    expect(pool.activeCount('sfx')).toBe(4);
  });

  it('5th request evicts the oldest instance', () => {
    const pool = new SoundPool(4);
    const stopped = vi.fn();
    const oldest = makeInstance(stopped);

    pool.acquire('sfx', oldest);
    for (let i = 0; i < 3; i++) pool.acquire('sfx', makeInstance());

    // oldest is still alive here
    expect(stopped).not.toHaveBeenCalled();
    expect(pool.activeCount('sfx')).toBe(4);

    // 5th request should evict the oldest
    pool.acquire('sfx', makeInstance());

    expect(stopped).toHaveBeenCalledTimes(1);
    expect(pool.activeCount('sfx')).toBe(4); // still capped at 4
  });

  it('evicts in FIFO order (oldest first)', () => {
    const pool = new SoundPool(3);
    const calls: string[] = [];

    const a = makeInstance(() => calls.push('a'));
    const b = makeInstance(() => calls.push('b'));
    const c = makeInstance(() => calls.push('c'));

    pool.acquire('sfx', a);
    pool.acquire('sfx', b);
    pool.acquire('sfx', c);

    pool.acquire('sfx', makeInstance()); // evicts a
    pool.acquire('sfx', makeInstance()); // evicts b

    expect(calls).toEqual(['a', 'b']);
  });
});

// ─── volume normalisation ────────────────────────────────────────────────────

describe('SoundPool – volume normalisation', () => {
  it('returns 1/sqrt(N) volume where N is the active count after insert', () => {
    const pool = new SoundPool(4);

    const v1 = pool.acquire('sfx', makeInstance()); // N=1 → 1/√1 = 1
    const v2 = pool.acquire('sfx', makeInstance()); // N=2 → 1/√2
    const v3 = pool.acquire('sfx', makeInstance()); // N=3 → 1/√3
    const v4 = pool.acquire('sfx', makeInstance()); // N=4 → 1/√4 = 0.5

    expect(v1).toBeCloseTo(1 / Math.sqrt(1));
    expect(v2).toBeCloseTo(1 / Math.sqrt(2));
    expect(v3).toBeCloseTo(1 / Math.sqrt(3));
    expect(v4).toBeCloseTo(1 / Math.sqrt(4));
  });

  it('volume after eviction reflects capped pool size (N=4)', () => {
    const pool = new SoundPool(4);
    for (let i = 0; i < 4; i++) pool.acquire('sfx', makeInstance());

    // 5th: oldest evicted, N stays at 4
    const v5 = pool.acquire('sfx', makeInstance());
    expect(v5).toBeCloseTo(1 / Math.sqrt(4));
  });

  it('first instance in an empty category has volume 1.0', () => {
    const pool = new SoundPool(4);
    const vol = pool.acquire('brand-new', makeInstance());
    expect(vol).toBeCloseTo(1.0);
  });
});

// ─── category independence ───────────────────────────────────────────────────

describe('SoundPool – category independence', () => {
  it('tracks categories independently', () => {
    const pool = new SoundPool(4);
    pool.acquire('a', makeInstance());
    pool.acquire('a', makeInstance());
    pool.acquire('b', makeInstance());

    expect(pool.activeCount('a')).toBe(2);
    expect(pool.activeCount('b')).toBe(1);
  });

  it('eviction in one category does not affect another', () => {
    const pool = new SoundPool(2);
    const stopped = vi.fn();

    pool.acquire('a', makeInstance(stopped));
    pool.acquire('a', makeInstance());
    // category b is independent
    pool.acquire('b', makeInstance(stopped)); // must NOT be evicted

    pool.acquire('a', makeInstance()); // triggers eviction in 'a' only

    // stopped called once (the oldest 'a' instance), not the 'b' instance
    expect(stopped).toHaveBeenCalledTimes(1);
    expect(pool.activeCount('b')).toBe(1);
  });

  it('volume for category starts at 1.0 regardless of other categories', () => {
    const pool = new SoundPool(4);
    pool.acquire('a', makeInstance());
    pool.acquire('a', makeInstance());

    // Fresh category 'b' should still get volume 1.0
    const vol = pool.acquire('b', makeInstance());
    expect(vol).toBeCloseTo(1.0);
  });
});

// ─── release ────────────────────────────────────────────────────────────────

describe('SoundPool – release', () => {
  it('release decrements the active count', () => {
    const pool = new SoundPool(4);
    const inst = makeInstance();
    pool.acquire('sfx', inst);
    expect(pool.activeCount('sfx')).toBe(1);

    pool.release('sfx', inst);
    expect(pool.activeCount('sfx')).toBe(0);
  });

  it('release is safe to call for an already-evicted instance', () => {
    const pool = new SoundPool(1);
    const inst = makeInstance();
    pool.acquire('sfx', inst);

    // Evict inst by adding another
    pool.acquire('sfx', makeInstance());
    expect(pool.activeCount('sfx')).toBe(1);

    // Should not throw
    expect(() => pool.release('sfx', inst)).not.toThrow();
    expect(pool.activeCount('sfx')).toBe(1); // the second instance is still there
  });
});

// ─── clearAll ────────────────────────────────────────────────────────────────

describe('SoundPool – clearAll', () => {
  it('clearAll() stops all instances across all categories', () => {
    const pool = new SoundPool(4);
    const stops: string[] = [];

    pool.acquire('a', makeInstance(() => stops.push('a')));
    pool.acquire('b', makeInstance(() => stops.push('b')));

    pool.clearAll();

    expect(stops).toContain('a');
    expect(stops).toContain('b');
    expect(pool.activeCount('a')).toBe(0);
    expect(pool.activeCount('b')).toBe(0);
  });

  it('clearAll(category) only clears that category', () => {
    const pool = new SoundPool(4);
    const stops: string[] = [];

    pool.acquire('a', makeInstance(() => stops.push('a')));
    pool.acquire('b', makeInstance(() => stops.push('b')));

    pool.clearAll('a');

    expect(stops).toEqual(['a']);
    expect(pool.activeCount('a')).toBe(0);
    expect(pool.activeCount('b')).toBe(1);
  });
});
