// packages/server/src/game/GameSimulation.reactions.test.ts
//
// Integration and unit tests for:
//   BUG-00a: Elemental reaction results were previously discarded
//   BUG-00b: Enemy resistances were never stored or enforced

import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { ReactionSystem } from '../systems/ReactionSystem.js';
import type { TowerState, EnemyState } from '@td/shared';
import { TOWER_CONFIGS, REACTION_CONFIGS, MAP_CONFIGS } from '@td/shared';

// ─── BUG-00a: Elemental Reaction Bonus Damage ─────────────────────────────────

describe('GameSimulation — Elemental Reactions (BUG-00a)', () => {
  /**
   * Scenario:
   *   • tidal_tower (water, range 3, base 15, splash 1.5) fires FIRST
   *     → applies "soaked" status to primary target
   *   • flame_spire (fire, range 3.5, base 22) fires SECOND
   *     → triggers vaporize: reaction.damage = round(22 × 1.5) = 33
   *
   * Wave 1 grunt: hp=50, speed=1.0, armor=0.
   *
   * Without the fix (reaction result discarded):
   *   Damage per cycle: primary flame (22) only for elemental. Max HP lost = 37 (tidal 15 + flame 22).
   * With the fix (reaction damage applied):
   *   Damage per cycle: 15 + 22 + 33 = 70 → enemy dies (hp=0, 50 HP lost tracked mid-tick).
   *
   * Note: GameSimulation calls clearDead() each tick, purging killed enemies from the map
   * BEFORE the next tick's attacks run. So we must capture maxHpLost per-tick (right after
   * the tick that kills the enemy) rather than at the very end.
   */
  it('vaporize reaction applies bonus damage when water-soaked enemy is hit by fire', () => {
    const sim = GameSimulation.create('reaction-test');
    sim.addPlayer('p1', 'Trey');
    sim.selectClass('p1', 'fire');
    sim.readyUp('p1');

    // Grant extra gold: tidal_tower=100, flame_spire=120 (starting=200, need 20 more)
    sim.cheatAddGold(300);

    // Place water tower FIRST so it processes before the fire tower in the tick loop
    // Both towers in BZ3 (x:3-6, y:5-9), which covers the path at x=2 (WP1→WP2)
    const waterResult = sim.placeTower('p1', 'tidal_tower', 3, 6);
    expect(waterResult.ok).toBe(true);

    const fireResult = sim.placeTower('p1', 'flame_spire', 4, 6);
    expect(fireResult.ok).toBe(true);

    sim.startWave();

    // Track maxHpLost per-tick (before clearDead removes killed enemies next tick)
    // Wave 1 grunt: hp=50. With vaporize (33 bonus), total damage = 15+22+33=70 → dead (maxHp-hp=50).
    // Without reaction: 15+22=37 → alive (maxHpLost=37).
    let maxHpLostEver = 0;

    for (let i = 0; i < 60; i++) {
      sim.tick(0.05);
      // Check IMMEDIATELY after tick: killed enemies still in map (clearDead runs NEXT tick)
      const enemies = Object.values(sim.state.enemies);
      for (const e of enemies) {
        maxHpLostEver = Math.max(maxHpLostEver, e.maxHp - e.hp);
      }
    }

    // Reaction bonus pushes total damage to 70 (> hp=50), so maxHpLost = 50 (enemy died)
    // Without the fix it would be 37 (15+22 only, enemy still alive with hp=13)
    expect(maxHpLostEver).toBeGreaterThan(37);
  });
});

// ─── BUG-00a: Reaction result via ReactionSystem unit test ───────────────────

describe('ReactionSystem — checkReaction returns usable result', () => {
  it('vaporize: returns damage > 0 when soaked enemy is hit by fire', () => {
    const map = MAP_CONFIGS['map_01']!;
    const enemySystem = new EnemySystem(map.waypoints);
    const reactionSystem = new ReactionSystem(REACTION_CONFIGS);

    const enemy = enemySystem.spawnEnemy('grunt', 200, 2, 0, ['ground']);
    // Manually apply "soaked" status (normally applied by a water tower on-hit)
    enemy.statuses.push({ element: 'water', type: 'soaked', stacks: 1, remainingSec: 5 });

    const result = reactionSystem.checkReaction(enemy, 'fire', 22);

    expect(result).not.toBeNull();
    expect(result!.damage).toBeGreaterThan(0); // 33 for vaporize (22 × 1.5)
    expect(result!.damage).toBe(Math.round(22 * 1.5)); // 33
  });

  it('applying reaction result damages the enemy (simulating the fix)', () => {
    const map = MAP_CONFIGS['map_01']!;
    const enemySystem = new EnemySystem(map.waypoints);
    const reactionSystem = new ReactionSystem(REACTION_CONFIGS);

    const enemy = enemySystem.spawnEnemy('grunt', 200, 2, 0, ['ground']);
    enemy.statuses.push({ element: 'water', type: 'soaked', stacks: 1, remainingSec: 5 });

    const hpBefore = enemy.hp;
    const baseDamage = 22;

    // Simulate primary fire damage
    enemySystem.damageEnemy(enemy.instanceId, baseDamage);

    // Check and apply reaction (the fix)
    const reaction = reactionSystem.checkReaction(enemy, 'fire', baseDamage);
    if (reaction && reaction.damage > 0) {
      enemySystem.damageEnemy(enemy.instanceId, reaction.damage);
    }

    const totalDamage = hpBefore - enemy.hp;
    // Without the fix, totalDamage = 22; with fix, totalDamage = 22 + 33 = 55
    expect(totalDamage).toBeGreaterThan(baseDamage);
    expect(totalDamage).toBe(baseDamage + Math.round(baseDamage * 1.5)); // 22 + 33 = 55
  });
});

// ─── BUG-00b: Enemy Resistances ───────────────────────────────────────────────

describe('EnemySystem — spawnEnemy stores resistances (BUG-00b)', () => {
  it('resistances field is stored on spawned enemy', () => {
    const map = MAP_CONFIGS['map_01']!;
    const enemySystem = new EnemySystem(map.waypoints);

    const enemy = enemySystem.spawnEnemy('grunt', 100, 2, 0, ['ground'], ['fire']);
    expect(enemy.resistances).toEqual(['fire']);
  });

  it('resistances field is undefined when not provided', () => {
    const map = MAP_CONFIGS['map_01']!;
    const enemySystem = new EnemySystem(map.waypoints);

    const enemy = enemySystem.spawnEnemy('grunt', 100, 2, 0, ['ground']);
    expect(enemy.resistances).toBeUndefined();
  });
});

describe('CombatSystem — Enemy Resistances block elemental on-hit effects (BUG-00b)', () => {
  let combatSystem: CombatSystem;

  // Helper: create a fresh flame_spire tower at (0,0) ready to fire at tick 100
  // Note: processAttack mutates tower.lastAttackTick, so each test gets its own instance.
  function makeFlameSpirerTower(): TowerState {
    return {
      instanceId: 'tower_test',
      configId: 'flame_spire',
      ownerId: 'p1',
      tier: 1,
      x: 0,
      y: 0,
      lastAttackTick: 0,
    };
  }

  // Helper: create an enemy at (1, 0) — within flame_spire range 3.5
  function makeEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
    return {
      instanceId: 'enemy_test',
      type: 'grunt',
      hp: 200,
      maxHp: 200,
      speed: 0,
      armor: 0,
      x: 1,
      y: 0,
      waypointIndex: 0,
      progress: 0,
      statuses: [],
      alive: true,
      ...overrides,
    };
  }

  beforeEach(() => {
    combatSystem = new CombatSystem(TOWER_CONFIGS);
  });

  it('non-resistant enemy receives fire on-hit effects', () => {
    const tower = makeFlameSpirerTower();
    const enemy = makeEnemy(); // no resistances
    const attack = combatSystem.processAttack(tower, [enemy], 100);

    expect(attack).not.toBeNull();
    const fireEffects = attack!.onHitEffects.filter((e) => e.element === 'fire');
    expect(fireEffects.length).toBeGreaterThan(0);
  });

  it('fire-resistant enemy receives NO fire on-hit effects', () => {
    const tower = makeFlameSpirerTower(); // fresh instance per test
    const enemy = makeEnemy({ resistances: ['fire'] });
    const attack = combatSystem.processAttack(tower, [enemy], 100);

    expect(attack).not.toBeNull();
    // All fire elemental on-hit effects should be filtered out
    const fireEffects = attack!.onHitEffects.filter((e) => e.element === 'fire');
    expect(fireEffects).toHaveLength(0);
  });

  it('fire-resistant enemy with soaked status does NOT trigger vaporize reaction', () => {
    // Enemy is soaked (water status) but resists fire
    const tower = makeFlameSpirerTower(); // fresh instance per test
    const enemy = makeEnemy({
      resistances: ['fire'],
      statuses: [{ element: 'water', type: 'soaked', stacks: 1, remainingSec: 5 }],
    });

    const attack = combatSystem.processAttack(tower, [enemy], 100);
    expect(attack).not.toBeNull();

    // No fire on-hit effects → no fire element applied → no reaction check for fire
    const fireEffects = attack!.onHitEffects.filter((e) => e.element === 'fire');
    expect(fireEffects).toHaveLength(0);

    // Verify: if we tried to trigger vaporize manually with fire on a soaked enemy,
    // it would succeed — confirming it is the RESISTANCE that blocks it, not the reaction config.
    const reactionSystem = new ReactionSystem(REACTION_CONFIGS);
    const reaction = reactionSystem.checkReaction(enemy, 'fire', 22);
    // Reaction system itself can still find the reaction (it doesn't know about resistance)
    // — the blocking happens in CombatSystem before the on-hit effect is ever applied.
    expect(reaction).not.toBeNull();
  });

  it('resistance only blocks matching element (water tower still works on fire-resistant enemy)', () => {
    // tidal_tower is water class — should NOT be blocked by fire resistance
    const tidalTower: TowerState = {
      instanceId: 'tower_tidal',
      configId: 'tidal_tower',
      ownerId: 'p1',
      tier: 1,
      x: 0,
      y: 0,
      lastAttackTick: 0,
    };

    const enemy = makeEnemy({ resistances: ['fire'] }); // only fire resistance
    const attack = combatSystem.processAttack(tidalTower, [enemy], 100);

    expect(attack).not.toBeNull();
    // Water on-hit effects should pass through (only fire is resisted)
    const waterEffects = attack!.onHitEffects.filter((e) => e.element === 'water');
    expect(waterEffects.length).toBeGreaterThan(0);
  });
});
