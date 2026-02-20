import type { WaveConfig } from '../index.js';

export const WAVE_CONFIGS: WaveConfig[] = [
  // ═══════════════════════════════════════════════════════════
  // WAVES 1-3: Grunts only — tutorial waves
  // ═══════════════════════════════════════════════════════════

  {
    wave: 1,
    groups: [
      { enemyType: 'grunt', count: 5, hp: 50, speed: 1.0, armor: 0, tags: ['ground'], spawnIntervalSec: 0.8 },
    ],
    bountyGold: 5,
    telegraph: 'Grunts approaching!',
  },
  {
    wave: 2,
    groups: [
      { enemyType: 'grunt', count: 8, hp: 60, speed: 1.0, armor: 0, tags: ['ground'], spawnIntervalSec: 0.7 },
    ],
    bountyGold: 6,
    telegraph: 'More grunts incoming!',
  },
  {
    wave: 3,
    groups: [
      { enemyType: 'grunt', count: 10, hp: 80, speed: 1.0, armor: 0, tags: ['ground'], spawnIntervalSec: 0.6 },
    ],
    bountyGold: 8,
    telegraph: 'A larger group approaches!',
  },

  // ═══════════════════════════════════════════════════════════
  // WAVES 4-5: Introduce Runners (fast, low HP)
  // ═══════════════════════════════════════════════════════════

  {
    wave: 4,
    groups: [
      { enemyType: 'grunt', count: 6, hp: 80, speed: 1.0, armor: 0, tags: ['ground'], spawnIntervalSec: 0.8 },
      { enemyType: 'runner', count: 5, hp: 30, speed: 1.8, armor: 0, tags: ['ground'], spawnIntervalSec: 0.4 },
    ],
    bountyGold: 8,
    telegraph: 'Fast runners spotted! Watch your first-shot timing!',
  },
  {
    wave: 5,
    groups: [
      { enemyType: 'grunt', count: 8, hp: 90, speed: 1.0, armor: 0, tags: ['ground'], spawnIntervalSec: 0.7 },
      { enemyType: 'runner', count: 8, hp: 35, speed: 1.9, armor: 0, tags: ['ground'], spawnIntervalSec: 0.35 },
    ],
    bountyGold: 10,
    telegraph: 'Speed up! The runners are getting faster!',
  },

  // ═══════════════════════════════════════════════════════════
  // WAVES 6-9: Mixed grunts + runners, escalating difficulty
  // ═══════════════════════════════════════════════════════════

  {
    wave: 6,
    groups: [
      { enemyType: 'grunt', count: 10, hp: 100, speed: 1.0, armor: 0, tags: ['ground'], spawnIntervalSec: 0.6 },
      { enemyType: 'runner', count: 10, hp: 40, speed: 2.0, armor: 0, tags: ['ground'], spawnIntervalSec: 0.3 },
    ],
    bountyGold: 12,
    telegraph: 'Combined assault!',
  },
  {
    wave: 7,
    groups: [
      { enemyType: 'grunt', count: 12, hp: 110, speed: 1.05, armor: 0, tags: ['ground'], spawnIntervalSec: 0.55 },
      { enemyType: 'runner', count: 12, hp: 45, speed: 2.0, armor: 0, tags: ['ground'], spawnIntervalSec: 0.3 },
    ],
    bountyGold: 14,
    telegraph: 'The horde grows!',
  },
  {
    wave: 8,
    groups: [
      { enemyType: 'grunt', count: 14, hp: 120, speed: 1.05, armor: 1, tags: ['ground'], spawnIntervalSec: 0.5 },
      { enemyType: 'runner', count: 14, hp: 50, speed: 2.1, armor: 0, tags: ['ground'], spawnIntervalSec: 0.28 },
    ],
    bountyGold: 16,
    telegraph: 'Armored grunts incoming!',
  },
  {
    wave: 9,
    groups: [
      { enemyType: 'grunt', count: 16, hp: 130, speed: 1.1, armor: 1, tags: ['ground'], spawnIntervalSec: 0.45 },
      { enemyType: 'runner', count: 16, hp: 55, speed: 2.2, armor: 0, tags: ['ground'], spawnIntervalSec: 0.25 },
    ],
    bountyGold: 18,
    telegraph: 'Preparing for a tough wave!',
  },

  // ═══════════════════════════════════════════════════════════
  // WAVE 10: First Flyers — anti-air required!
  // ═══════════════════════════════════════════════════════════

  {
    wave: 10,
    groups: [
      { enemyType: 'grunt', count: 10, hp: 140, speed: 1.1, armor: 1, tags: ['ground'], spawnIntervalSec: 0.5 },
      { enemyType: 'flyer', count: 8, hp: 60, speed: 1.5, armor: 0, tags: ['air'], spawnIntervalSec: 0.4 },
    ],
    bountyGold: 20,
    telegraph: 'Flying enemies! Anti-air required!',
  },

  // ═══════════════════════════════════════════════════════════
  // WAVES 11-14: Tanks introduced (high HP, slow)
  // ═══════════════════════════════════════════════════════════

  {
    wave: 11,
    groups: [
      { enemyType: 'grunt', count: 12, hp: 150, speed: 1.1, armor: 2, tags: ['ground'], spawnIntervalSec: 0.5 },
      { enemyType: 'tank', count: 3, hp: 350, speed: 0.6, armor: 3, tags: ['ground'], spawnIntervalSec: 1.5 },
    ],
    bountyGold: 22,
    telegraph: 'Heavy tanks spotted! Single-target DPS needed!',
  },
  {
    wave: 12,
    groups: [
      { enemyType: 'grunt', count: 14, hp: 160, speed: 1.1, armor: 2, tags: ['ground'], spawnIntervalSec: 0.45 },
      { enemyType: 'tank', count: 4, hp: 400, speed: 0.6, armor: 3, tags: ['ground'], spawnIntervalSec: 1.4 },
      { enemyType: 'runner', count: 10, hp: 60, speed: 2.2, armor: 0, tags: ['ground'], spawnIntervalSec: 0.3 },
    ],
    bountyGold: 25,
    telegraph: 'Tanks and runners combo!',
  },
  {
    wave: 13,
    groups: [
      { enemyType: 'grunt', count: 16, hp: 170, speed: 1.15, armor: 2, tags: ['ground'], spawnIntervalSec: 0.4 },
      { enemyType: 'tank', count: 5, hp: 450, speed: 0.6, armor: 4, tags: ['ground'], spawnIntervalSec: 1.3 },
    ],
    bountyGold: 28,
    telegraph: 'More heavy armor!',
  },
  {
    wave: 14,
    groups: [
      { enemyType: 'grunt', count: 18, hp: 180, speed: 1.15, armor: 3, tags: ['ground'], spawnIntervalSec: 0.4 },
      { enemyType: 'tank', count: 6, hp: 500, speed: 0.65, armor: 4, tags: ['ground'], spawnIntervalSec: 1.2 },
      { enemyType: 'flyer', count: 6, hp: 80, speed: 1.6, armor: 0, tags: ['air'], spawnIntervalSec: 0.5 },
    ],
    bountyGold: 32,
    telegraph: 'Combined ground and air assault!',
  },

  // ═══════════════════════════════════════════════════════════
  // WAVE 15: First BOSS wave
  // ═══════════════════════════════════════════════════════════

  {
    wave: 15,
    groups: [
      { enemyType: 'grunt', count: 10, hp: 200, speed: 1.15, armor: 3, tags: ['ground'], spawnIntervalSec: 0.5 },
      { enemyType: 'boss', count: 1, hp: 1200, speed: 0.7, armor: 5, tags: ['ground', 'boss'], spawnIntervalSec: 0, resistances: ['fire'] },
    ],
    bountyGold: 50,
    telegraph: 'BOSS BATTLE! Fire-resistant boss incoming!',
  },

  // ═══════════════════════════════════════════════════════════
  // WAVES 16-17: Invisible enemies
  // ═══════════════════════════════════════════════════════════

  {
    wave: 16,
    groups: [
      { enemyType: 'grunt', count: 12, hp: 200, speed: 1.15, armor: 3, tags: ['ground'], spawnIntervalSec: 0.45 },
      { enemyType: 'invisible', count: 6, hp: 100, speed: 1.4, armor: 1, tags: ['ground', 'invisible'], spawnIntervalSec: 0.6 },
    ],
    bountyGold: 28,
    telegraph: 'Invisible enemies! Build scout towers!',
  },
  {
    wave: 17,
    groups: [
      { enemyType: 'grunt', count: 14, hp: 220, speed: 1.2, armor: 3, tags: ['ground'], spawnIntervalSec: 0.4 },
      { enemyType: 'invisible', count: 10, hp: 120, speed: 1.5, armor: 2, tags: ['ground', 'invisible'], spawnIntervalSec: 0.5 },
      { enemyType: 'flyer', count: 8, hp: 100, speed: 1.7, armor: 1, tags: ['air'], spawnIntervalSec: 0.4 },
    ],
    bountyGold: 35,
    telegraph: 'Invisible and flying combo!',
  },

  // ═══════════════════════════════════════════════════════════
  // WAVES 18-19: Multi-type waves
  // ═══════════════════════════════════════════════════════════

  {
    wave: 18,
    groups: [
      { enemyType: 'grunt', count: 16, hp: 240, speed: 1.2, armor: 4, tags: ['ground'], spawnIntervalSec: 0.35 },
      { enemyType: 'runner', count: 15, hp: 80, speed: 2.3, armor: 1, tags: ['ground'], spawnIntervalSec: 0.25 },
      { enemyType: 'tank', count: 4, hp: 550, speed: 0.65, armor: 5, tags: ['ground'], spawnIntervalSec: 1.2 },
      { enemyType: 'flyer', count: 8, hp: 110, speed: 1.8, armor: 1, tags: ['air'], spawnIntervalSec: 0.4 },
    ],
    bountyGold: 42,
    telegraph: 'Full assault! All enemy types!',
  },
  {
    wave: 19,
    groups: [
      { enemyType: 'grunt', count: 20, hp: 260, speed: 1.25, armor: 4, tags: ['ground'], spawnIntervalSec: 0.3 },
      { enemyType: 'runner', count: 20, hp: 90, speed: 2.4, armor: 1, tags: ['ground'], spawnIntervalSec: 0.22 },
      { enemyType: 'tank', count: 5, hp: 600, speed: 0.65, armor: 5, tags: ['ground'], spawnIntervalSec: 1.1 },
      { enemyType: 'invisible', count: 8, hp: 150, speed: 1.6, armor: 2, tags: ['ground', 'invisible'], spawnIntervalSec: 0.5 },
    ],
    bountyGold: 50,
    telegraph: 'Penultimate wave! Everything at once!',
  },

  // ═══════════════════════════════════════════════════════════
  // WAVE 20: Final boss
  // ═══════════════════════════════════════════════════════════

  {
    wave: 20,
    groups: [
      { enemyType: 'grunt', count: 15, hp: 280, speed: 1.25, armor: 5, tags: ['ground'], spawnIntervalSec: 0.35 },
      { enemyType: 'tank', count: 6, hp: 700, speed: 0.7, armor: 6, tags: ['ground'], spawnIntervalSec: 1.0 },
      { enemyType: 'flyer', count: 10, hp: 130, speed: 1.9, armor: 2, tags: ['air'], spawnIntervalSec: 0.35 },
      { enemyType: 'boss', count: 1, hp: 2500, speed: 0.6, armor: 8, tags: ['ground', 'boss'], spawnIntervalSec: 0, resistances: ['poison'] },
    ],
    bountyGold: 100,
    telegraph: 'FINAL BOSS! Poison-resistant mega boss!',
  },
];