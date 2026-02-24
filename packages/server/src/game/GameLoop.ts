// packages/server/src/game/GameLoop.ts
import { TICK_DURATION_MS } from '@td/shared';

export class GameLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTime: number = 0;
  private onTick: (dt: number) => void;
  private getSpeed?: () => number;

  isRunning = false;

  constructor(onTick: (dt: number) => void, getSpeed?: () => number) {
    this.onTick = onTick;
    this.getSpeed = getSpeed;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();

    this.intervalId = setInterval(() => {
      const now = performance.now();
      let dt = (now - this.lastTime) / 1000;
      dt = Math.min(dt, 0.1);
      this.lastTime = now;
      const scaledDt = dt * (this.getSpeed?.() ?? 1);
      this.onTick(scaledDt);
    }, TICK_DURATION_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }
}
