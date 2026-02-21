// packages/server/src/systems/EnemySystem.ts
import type { Vec2, EnemyState, EnemyType, EnemyStatus } from '@td/shared';

// NOTE: nextEnemyId is intentionally an instance-level counter (not module-level)
// to prevent state leaking between test runs in Vitest.

export class EnemySystem {
  private waypoints: Vec2[];
  private enemies: Map<string, EnemyState> = new Map();
  private leakedEnemies: EnemyState[] = [];
  private nextEnemyId = 1; // instance-level to avoid cross-test contamination

  constructor(waypoints: Vec2[]) {
    this.waypoints = waypoints;
  }

  spawnEnemy(
    type: EnemyType,
    hp: number,
    speed: number,
    armor: number,
    tags: string[],
    resistances?: string[],
  ): EnemyState {
    const spawn = this.waypoints[0];
    const instanceId = `enemy_${this.nextEnemyId++}`;
    const enemy: EnemyState = {
      instanceId,
      type,
      hp,
      maxHp: hp,
      speed,
      armor,
      x: spawn.x,
      y: spawn.y,
      waypointIndex: 0,
      progress: 0,
      statuses: [],
      alive: true,
      resistances,
    };
    this.enemies.set(instanceId, enemy);
    return enemy;
  }

  update(dt: number): void {
    this.leakedEnemies = [];

    for (const enemy of this.enemies.values()) {
      if (!enemy.alive) continue;
      this.moveEnemy(enemy, dt);
      this.updateStatuses(enemy, dt);
    }
  }

  private moveEnemy(enemy: EnemyState, dt: number): void {
    let remainingDistance = enemy.speed * dt;

    while (remainingDistance > 0) {
      const nextWpIndex = enemy.waypointIndex + 1;
      if (nextWpIndex >= this.waypoints.length) {
        this.leakedEnemies.push(enemy);
        enemy.alive = false;
        return;
      }

      const target = this.waypoints[nextWpIndex];
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= remainingDistance) {
        enemy.x = target.x;
        enemy.y = target.y;
        enemy.waypointIndex = nextWpIndex;
        enemy.progress = 0;
        remainingDistance -= dist;
      } else {
        const ratio = remainingDistance / dist;
        enemy.x += dx * ratio;
        enemy.y += dy * ratio;
        const totalSegDist = Math.sqrt(
          (target.x - this.waypoints[enemy.waypointIndex].x) ** 2 +
            (target.y - this.waypoints[enemy.waypointIndex].y) ** 2,
        );
        enemy.progress =
          totalSegDist > 0 ? 1 - (dist - remainingDistance) / totalSegDist : 0;
        remainingDistance = 0;
      }
    }
  }

  private updateStatuses(enemy: EnemyState, dt: number): void {
    for (let i = enemy.statuses.length - 1; i >= 0; i--) {
      enemy.statuses[i].remainingSec -= dt;
      if (enemy.statuses[i].remainingSec <= 0) {
        enemy.statuses.splice(i, 1);
      }
    }
  }

  damageEnemy(instanceId: string, rawDamage: number): number {
    const enemy = this.enemies.get(instanceId);
    if (!enemy || !enemy.alive) return 0;

    const effectiveDamage = Math.max(1, rawDamage - enemy.armor);
    enemy.hp -= effectiveDamage;

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
    }

    return effectiveDamage;
  }

  applyStatus(instanceId: string, status: EnemyStatus): void {
    const enemy = this.enemies.get(instanceId);
    if (!enemy || !enemy.alive) return;

    const existing = enemy.statuses.find((s) => s.type === status.type);
    if (existing) {
      existing.stacks = Math.min(existing.stacks + status.stacks, 10);
      existing.remainingSec = Math.max(existing.remainingSec, status.remainingSec);
    } else {
      enemy.statuses.push({ ...status });
    }
  }

  getEnemy(instanceId: string): EnemyState | undefined {
    return this.enemies.get(instanceId);
  }

  getAliveEnemies(): EnemyState[] {
    return Array.from(this.enemies.values()).filter((e) => e.alive);
  }

  getLeakedEnemies(): EnemyState[] {
    return this.leakedEnemies;
  }

  get aliveCount(): number {
    return this.getAliveEnemies().length;
  }

  getEnemiesAsRecord(): Record<string, EnemyState> {
    const record: Record<string, EnemyState> = {};
    for (const [id, enemy] of this.enemies) {
      record[id] = enemy;
    }
    return record;
  }

  clearDead(): void {
    for (const [id, enemy] of this.enemies) {
      if (!enemy.alive) this.enemies.delete(id);
    }
  }

  hasEnemyStatus(instanceId: string, statusType: string): boolean {
    const enemy = this.enemies.get(instanceId);
    if (!enemy) return false;
    return enemy.statuses.some((s) => s.type === statusType);
  }

  removeStatus(instanceId: string, statusType: string): void {
    const enemy = this.enemies.get(instanceId);
    if (!enemy) return;
    enemy.statuses = enemy.statuses.filter((s) => s.type !== statusType);
  }
}
