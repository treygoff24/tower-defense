import type { EnemyState, ReactionConfig, ElementType, ReactionType } from '@td/shared';

export interface ReactionResult {
  reaction: ReactionConfig;
  damage: number;
  aoeRadius?: number;
  applyStatus?: string;
  statusDuration?: number;
}

// Priority order: higher-value reactions first
const REACTION_PRIORITY: Record<string, number> = {
  melt: 10,
  conflagration: 9,
  vaporize: 8,
  freeze: 7,
  shatter: 6,
  blight: 5,
  frostburn: 4,
  steam_burst: 3,
};

export class ReactionSystem {
  private reactions: ReactionConfig[];

  constructor(reactions: ReactionConfig[]) {
    this.reactions = reactions.sort(
      (a, b) => (REACTION_PRIORITY[b.id] ?? 0) - (REACTION_PRIORITY[a.id] ?? 0),
    );
  }

  checkReaction(enemy: EnemyState, triggerElement: ElementType, baseDamage: number): ReactionResult | null {
    for (const reaction of this.reactions) {
      if (reaction.triggerElement !== triggerElement) continue;

      const statusIndex = enemy.statuses.findIndex((s) => s.type === reaction.requiredStatus);
      if (statusIndex === -1) continue;

      let damage = baseDamage;
      let applyStatus: string | undefined;
      let statusDuration: number | undefined;

      switch (reaction.effect.type) {
        case 'damage_multiplier':
          damage = Math.round(baseDamage * (reaction.effect.value ?? 1));
          break;
        case 'aoe_burst':
          damage = reaction.effect.value ?? 0;
          break;
        case 'apply_status':
          applyStatus = 'frozen';
          statusDuration = reaction.effect.durationSec;
          damage = 0;
          break;
      }

      if (reaction.consumesStatus) {
        enemy.statuses.splice(statusIndex, 1);
      }

      return {
        reaction,
        damage,
        aoeRadius: reaction.effect.aoeRadius,
        applyStatus,
        statusDuration,
      };
    }

    return null;
  }
}