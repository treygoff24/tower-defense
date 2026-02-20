import type { ClassConfig, ElementType } from '../index.js';

export const CLASS_CONFIGS: Record<ElementType, ClassConfig> = {
  fire: {
    id: 'fire',
    identity: ['aoe', 'ignite'],
    passive: { type: 'burn_on_hit', dps: 2, durationSec: 3 },
    heroId: 'flame_warden',
  },
  water: {
    id: 'water',
    identity: ['utility', 'pushback'],
    passive: { type: 'soaked_on_hit', durationSec: 5 },
    heroId: 'tidecaller',
  },
  ice: {
    id: 'ice',
    identity: ['control', 'freeze'],
    passive: { type: 'cold_on_hit', durationSec: 4 }, // Stacks, no fixed duration
    heroId: 'frostguard',
  },
  poison: {
    id: 'poison',
    identity: ['attrition', 'debuff'],
    passive: { type: 'toxin_on_hit', dps: 1, durationSec: 5 },
    heroId: 'plague_doctor',
  },
};