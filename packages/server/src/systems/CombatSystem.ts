import type { TowerState, EnemyState, TowerConfig, OnHitEffect, TargetingMode } from '@td/shared';
import { TICK_RATE } from '@td/shared';

export interface AttackResult {
  towerId: string;
  targetId: string;
  damage: number;
  splashTargetIds: string[];
  onHitEffects: OnHitEffect[];
}

/**
 * Apply a delta to a base value.
 *
 * Supported delta formats:
 *   '+5'    → add 5 (currentValue + 5)
 *   '*-0.15' → multiply by (1 + (-0.15)) = 0.85 (currentValue * 0.85)
 *   5       → add 5 (numeric shorthand)
 */
export function applyDelta(currentValue: number, delta: string | number): number {
  if (typeof delta === 'number') {
    return currentValue + delta;
  }
  if (delta.startsWith('+')) {
    return currentValue + parseFloat(delta.slice(1));
  }
  if (delta.startsWith('*')) {
    // '*-0.15' means factor = -0.15, result = currentValue * (1 + (-0.15)) = currentValue * 0.85
    const factor = parseFloat(delta.slice(1));
    return currentValue * (1 + factor);
  }
  return currentValue;
}

export class CombatSystem {
  private configs: Record<string, TowerConfig>;

  constructor(configs: Record<string, TowerConfig>) {
    this.configs = configs;
  }

  private distance(ax: number, ay: number, bx: number, by: number): number {
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  }

  /**
   * Get the effective value of a simple numeric stat after applying all
   * applicable upgrade deltas.
   */
  private getEffectiveStat(tower: TowerState, key: 'baseDamage' | 'range' | 'attackPeriodSec' | 'splashRadius'): number {
    const config = this.configs[tower.configId];
    if (!config) return 0;

    let value: number;
    switch (key) {
      case 'baseDamage':     value = config.baseDamage; break;
      case 'range':          value = config.range; break;
      case 'attackPeriodSec': value = config.attackPeriodSec; break;
      case 'splashRadius':   value = config.splashRadius ?? 0; break;
    }

    // Apply deltas for every upgrade tier the tower has reached (tier > 1)
    for (const upgrade of config.upgrades) {
      if (upgrade.tier <= tower.tier && upgrade.tier > 1) {
        const delta = upgrade.deltas[key];
        if (delta !== undefined) {
          value = applyDelta(value, delta);
        }
      }
    }

    return value;
  }

  findTarget(tower: TowerState, enemies: EnemyState[], targetingMode?: TargetingMode): EnemyState | null {
    const config = this.configs[tower.configId];
    if (!config) return null;

    const range = this.getEffectiveStat(tower, 'range');
    const mode = targetingMode ?? tower.targetingMode ?? 'first';

    // Filter candidates: alive, correct target type, within range
    const candidates = enemies.filter((enemy) => {
      if (!enemy.alive) return false;
      if (config.targets === 'ground' && this.isAirEnemy(enemy)) return false;
      if (config.targets === 'air' && !this.isAirEnemy(enemy)) return false;
      return this.distance(tower.x, tower.y, enemy.x, enemy.y) <= range;
    });

    if (candidates.length === 0) return null;

    switch (mode) {
      case 'first': {
        // Enemy furthest along path (highest waypointIndex + progress)
        // Tiebreaker: closest to tower (preserves backward-compatible behavior)
        return candidates.reduce((best, e) => {
          const eScore = e.waypointIndex + e.progress;
          const bScore = best.waypointIndex + best.progress;
          if (eScore !== bScore) return eScore > bScore ? e : best;
          // Tiebreaker: closer enemy wins
          return this.distance(tower.x, tower.y, e.x, e.y) <
            this.distance(tower.x, tower.y, best.x, best.y)
            ? e
            : best;
        });
      }

      case 'last': {
        // Enemy earliest on path (lowest waypointIndex + progress)
        // Tiebreaker: closest to tower
        return candidates.reduce((best, e) => {
          const eScore = e.waypointIndex + e.progress;
          const bScore = best.waypointIndex + best.progress;
          if (eScore !== bScore) return eScore < bScore ? e : best;
          // Tiebreaker: closer enemy wins
          return this.distance(tower.x, tower.y, e.x, e.y) <
            this.distance(tower.x, tower.y, best.x, best.y)
            ? e
            : best;
        });
      }

      case 'strongest':
        // Highest HP
        return candidates.reduce((best, e) => (e.hp > best.hp ? e : best));

      case 'weakest':
        // Lowest HP
        return candidates.reduce((best, e) => (e.hp < best.hp ? e : best));

      case 'closest':
        // Nearest euclidean distance to tower
        return candidates.reduce((best, e) =>
          this.distance(tower.x, tower.y, e.x, e.y) < this.distance(tower.x, tower.y, best.x, best.y)
            ? e
            : best
        );

      default:
        return candidates[0] ?? null;
    }
  }

  private isAirEnemy(enemy: EnemyState): boolean {
    return enemy.type === 'flyer';
  }

  canFire(tower: TowerState, currentTick: number): boolean {
    const config = this.configs[tower.configId];
    if (!config) return false;
    const attackPeriod = this.getEffectiveStat(tower, 'attackPeriodSec');
    if (attackPeriod <= 0) return false; // support towers never fire
    const ticksBetweenAttacks = Math.floor(attackPeriod * TICK_RATE);
    return currentTick - tower.lastAttackTick >= ticksBetweenAttacks;
  }

  getDamage(tower: TowerState): number {
    return this.getEffectiveStat(tower, 'baseDamage');
  }

  getSplashTargets(tower: TowerState, primary: EnemyState, allEnemies: EnemyState[]): EnemyState[] {
    const config = this.configs[tower.configId];
    if (!config?.splashRadius) return [];

    const splashRadius = this.getEffectiveStat(tower, 'splashRadius');

    return allEnemies.filter((e) => {
      if (!e.alive || e.instanceId === primary.instanceId) return false;
      return this.distance(primary.x, primary.y, e.x, e.y) <= splashRadius;
    });
  }

  /**
   * Returns the effective onHit effects for the tower at its current tier,
   * applying any upgrade deltas that modify nested onHit properties
   * (e.g. 'onHit.0.dps': '+2').
   */
  getOnHitEffects(tower: TowerState): OnHitEffect[] {
    const config = this.configs[tower.configId];
    if (!config?.onHit || config.onHit.length === 0) return [];

    // Deep-clone the base onHit array so we don't mutate config
    const effects: OnHitEffect[] = config.onHit.map((e) => ({ ...e }));

    // Apply upgrade deltas that target onHit properties
    for (const upgrade of config.upgrades) {
      if (upgrade.tier <= tower.tier && upgrade.tier > 1) {
        for (const [key, delta] of Object.entries(upgrade.deltas)) {
          // Parse dot-paths like 'onHit.0.dps'
          const parts = key.split('.');
          if (parts[0] === 'onHit' && parts.length === 3) {
            const index = parseInt(parts[1], 10);
            const prop = parts[2] as keyof OnHitEffect;
            if (effects[index] !== undefined) {
              const current = (effects[index] as unknown as Record<string, unknown>)[prop as string];
              if (typeof current === 'number') {
                (effects[index] as unknown as Record<string, unknown>)[prop as string] = applyDelta(current, delta);
              }
            }
          }
        }
      }
    }

    return effects;
  }

  processAttack(tower: TowerState, enemies: EnemyState[], currentTick: number): AttackResult | null {
    if (!this.canFire(tower, currentTick)) return null;

    const target = this.findTarget(tower, enemies, tower.targetingMode);
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
