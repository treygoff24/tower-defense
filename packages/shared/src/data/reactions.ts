import type { ReactionConfig } from '../index.js';

export const REACTION_CONFIGS: ReactionConfig[] = [
  {
    id: 'vaporize',
    triggerElement: 'fire',
    requiredStatus: 'soaked',
    effect: { type: 'damage_multiplier', value: 1.5 },
    consumesStatus: true,
    sound: 'sfx_vaporize',
    vfx: 'vfx_steam_burst',
  },
  {
    id: 'freeze',
    triggerElement: 'ice',
    requiredStatus: 'soaked',
    effect: { type: 'apply_status', status: 'frozen', durationSec: 3 },
    consumesStatus: true,
    sound: 'sfx_freeze',
    vfx: 'vfx_ice_freeze',
  },
  {
    id: 'melt',
    triggerElement: 'fire',
    requiredStatus: 'frozen',
    effect: { type: 'damage_multiplier', value: 2.0 },
    consumesStatus: true,
    sound: 'sfx_melt',
    vfx: 'vfx_melt_break',
  },
  {
    id: 'conflagration',
    triggerElement: 'fire',
    requiredStatus: 'toxin',
    effect: { type: 'aoe_burst', value: 50, aoeRadius: 2.0 },
    consumesStatus: true,
    sound: 'sfx_conflagration',
    vfx: 'vfx_fire_explosion',
  },
];