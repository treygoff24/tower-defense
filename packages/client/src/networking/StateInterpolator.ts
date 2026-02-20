// packages/client/src/networking/StateInterpolator.ts
import type { GameState, Vec2 } from '@td/shared';

interface TimedSnapshot {
  state: GameState;
  timestamp: number;
}

export class StateInterpolator {
  private snapshots: TimedSnapshot[] = [];
  private maxSnapshots = 3;

  pushSnapshot(state: GameState, timestamp: number): void {
    this.snapshots.push({ state, timestamp });
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  getEnemyPosition(instanceId: string, currentTime: number): Vec2 | null {
    if (this.snapshots.length === 0) return null;

    if (this.snapshots.length === 1) {
      const enemy = this.snapshots[0].state.enemies[instanceId];
      return enemy ? { x: enemy.x, y: enemy.y } : null;
    }

    const prev = this.snapshots[this.snapshots.length - 2];
    const curr = this.snapshots[this.snapshots.length - 1];

    const prevEnemy = prev.state.enemies[instanceId];
    const currEnemy = curr.state.enemies[instanceId];

    if (!currEnemy) return null;
    if (!prevEnemy) return { x: currEnemy.x, y: currEnemy.y };

    const elapsed = currentTime - prev.timestamp;
    const interval = curr.timestamp - prev.timestamp;
    const t = interval > 0 ? Math.min(1, elapsed / interval) : 1;

    return {
      x: prevEnemy.x + (currEnemy.x - prevEnemy.x) * t,
      y: prevEnemy.y + (currEnemy.y - prevEnemy.y) * t,
    };
  }

  getLatestState(): GameState | null {
    if (this.snapshots.length === 0) return null;
    return this.snapshots[this.snapshots.length - 1].state;
  }
}