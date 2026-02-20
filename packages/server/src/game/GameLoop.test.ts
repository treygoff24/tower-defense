// packages/server/src/game/GameLoop.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameLoop } from './GameLoop';

describe('GameLoop', () => {
  let loop: GameLoop;
  let tickCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tickCallback = vi.fn();
    loop = new GameLoop(tickCallback);
  });

  afterEach(() => {
    loop.stop();
  });

  it('is not running initially', () => {
    expect(loop.isRunning).toBe(false);
  });

  it('calls tick callback at 20Hz', async () => {
    loop.start();
    expect(loop.isRunning).toBe(true);
    // Wait ~110ms for at least 2 ticks (50ms each)
    await new Promise((r) => setTimeout(r, 110));
    loop.stop();
    expect(tickCallback.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('passes delta time to tick callback', async () => {
    loop.start();
    await new Promise((r) => setTimeout(r, 60));
    loop.stop();
    if (tickCallback.mock.calls.length > 0) {
      const dt = tickCallback.mock.calls[0][0];
      expect(dt).toBeGreaterThan(0);
      expect(dt).toBeLessThan(0.1);
    }
  });

  it('stops cleanly', async () => {
    loop.start();
    await new Promise((r) => setTimeout(r, 60));
    loop.stop();
    const callCount = tickCallback.mock.calls.length;
    await new Promise((r) => setTimeout(r, 100));
    expect(tickCallback.mock.calls.length).toBe(callCount);
  });
});
