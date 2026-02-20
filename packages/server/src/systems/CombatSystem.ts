import type { TowerState, EnemyState, TowerConfig, OnHitEffect } from '@td/shared';
import { TICK_RATE } from '@td/shared';

export interface AttackResult {
  towerId: string;
  targetId: string;
  damage: number;
  splashTargetIds: string[];
  onHitEffects: OnHitEffect[];
}

export class CombatSystem {
  private configs: Record<string, TowerConfig>;

  constructor(configs: Record<string, TowerConfig>) {
    this.configs = configs;
  }

  private distance(ax: number, ay: number, bx: number, by: number): number {
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  }

  findTarget(tower: TowerState, enemies: EnemyState[]): EnemyState | null {
    const config = this.configs[tower.configId];
    if (!config) return null;

    let closest: EnemyState | null = null;
    let closestDist = Infinity;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      // Check target type compatibility
      if (config.targets === 'ground' && this.isAirEnemy(enemy)) continue;
      if (config.targets === 'air' && !this.isAirEnemy(enemy)) continue;

      const dist = this.distance(tower.x, tower.y, enemy.x, enemy.y);
      if (dist <= config.range && dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }

    return closest;
  }

  private isAirEnemy(enemy: EnemyState): boolean {
    return enemy.type === 'flyer';
  }

  canFire(tower: TowerState, currentTick: number): boolean {
    const config = this.configs[tower.configId];
    if (!config) return false;
    const ticksBetweenAttacks = Math.floor(config.attackPeriodSec * TICK_RATE);
    return currentTick - tower.lastAttackTick >= ticksBetweenAttacks;
  }

  getDamage(tower: TowerState): number {
    const config = this.configs[tower.configId];
    if (!config) return 0;

    let damage = config.baseDamage;

    // Apply upgrade deltas
    for (const upgrade of config.upgrades) {
      if (upgrade.tier <= tower.tier && upgrade.tier > 1) {
        const dmgDelta = upgrade.deltas['baseDamage'];
        if (typeof dmgDelta === 'string' && dmgDelta.startsWith('+')) {
          damage += parseFloat(dmgDelta.slice(1));
        } else if (typeof dmgDelta === 'number') {
          damage += dmgDelta;
        }
      }
    }

    return damage;
  }

  getSplashTargets(tower: TowerState, primary: EnemyState, allEnemies: EnemyState[]): EnemyState[] {
    const config = this.configs[tower.configId];
    if (!config?.splashRadius) return [];

    return allEnemies.filter((e) => {
      if (!e.alive || e.instanceId === primary.instanceId) return false;
      return this.distance(primary.x, primary.y, e.x, e.y) <= config.splashRadius!;
    });
  }

  getOnHitEffects(tower: TowerState): OnHitEffect[] {
    const config = this.configs[tower.configId];
    return config?.onHit ?? [];
  }

  processAttack(tower: TowerState, enemies: EnemyState[], currentTick: number): AttackResult | null {
    if (!this.canFire(tower, currentTick)) return null;

    const target = this.findTarget(tower, enemies);
    if (!target) return null;

    tower.lastAttackTick = currentTick;
    tower.currentTarget = target.instanceId;
    const damage = this.getDamage(tower);
    const splashTargets = this.getSplashTargets(tower, target, enemies);

    return {
      towerId: tower.instanceId,
      targetId: target.instanceId,
      damage,
      splashTargetIds: splashTargets.map((e) => e.instanceId),
      onHitEffects: this.getOnHitEffects(tower),
    };
  }
}