import { describe, it, expect } from 'vitest';
import { TOWER_CONFIGS } from './towers.js';
import { WAVE_CONFIGS } from './waves.js';
import { MAP_CONFIGS } from './maps.js';
import { REACTION_CONFIGS } from './reactions.js';
import { CLASS_CONFIGS } from './classes.js';

describe('Data Configuration Tests', () => {
  // ═══════════════════════════════════════════════════════════
  // Tower Configuration Tests
  // ═══════════════════════════════════════════════════════════

  describe('Tower Configurations', () => {
    it('should have all required tower IDs', () => {
      const expectedTowers = [
        // Shared basic (4)
        'arrow_tower',
        'amplifier_tower',
        'ballista',
        'scout_tower',
        // Fire specialty (3)
        'flame_spire',
        'inferno_cannon',
        'magma_pool',
        // Water specialty (3)
        'tidal_tower',
        'geyser',
        'whirlpool',
        // Ice specialty (3)
        'frost_turret',
        'blizzard_tower',
        'glacial_spike',
        // Poison specialty (3)
        'venom_spitter',
        'plague_spreader',
        'miasma_cloud',
      ];

      for (const towerId of expectedTowers) {
        expect(TOWER_CONFIGS[towerId], `Tower ${towerId} should exist`).toBeDefined();
      }
    });

    it('should have 16 total towers', () => {
      expect(Object.keys(TOWER_CONFIGS).length).toBe(16);
    });

    it('each tower should have valid fields', () => {
      for (const [id, config] of Object.entries(TOWER_CONFIGS)) {
        expect(config.id).toBe(id);
        expect(config.name).toBeDefined();
        expect(config.class).toBeDefined();
        expect(config.category).toBeDefined();
        expect(config.roles).toBeDefined();
        expect(config.roles.length).toBeGreaterThan(0);
        expect(config.costGold).toBeGreaterThan(0);
        expect(config.range).toBeGreaterThan(0);
        expect(config.attackPeriodSec).toBeGreaterThanOrEqual(0);
        expect(config.baseDamage).toBeGreaterThanOrEqual(0);
        expect(config.targets).toMatch(/^(ground|air|both)$/);
        expect(config.upgrades).toBeDefined();
        expect(config.upgrades.length).toBe(2); // Each tower has 2 upgrades (tier 2 and 3)
      }
    });

    it('each tower should have valid upgrade tiers', () => {
      for (const config of Object.values(TOWER_CONFIGS)) {
        for (const upgrade of config.upgrades) {
          expect(upgrade.tier).toBeGreaterThanOrEqual(2);
          expect(upgrade.tier).toBeLessThanOrEqual(3);
          expect(upgrade.costGold).toBeGreaterThan(0);
          expect(upgrade.deltas).toBeDefined();
          expect(Object.keys(upgrade.deltas).length).toBeGreaterThan(0);
        }
      }
    });

    it('should have correct tower classes', () => {
      // Shared basic towers
      expect(TOWER_CONFIGS.arrow_tower.class).toBe('shared');
      expect(TOWER_CONFIGS.amplifier_tower.class).toBe('shared');
      expect(TOWER_CONFIGS.ballista.class).toBe('shared');
      expect(TOWER_CONFIGS.scout_tower.class).toBe('shared');

      // Fire specialty
      expect(TOWER_CONFIGS.flame_spire.class).toBe('fire');
      expect(TOWER_CONFIGS.inferno_cannon.class).toBe('fire');
      expect(TOWER_CONFIGS.magma_pool.class).toBe('fire');

      // Water specialty
      expect(TOWER_CONFIGS.tidal_tower.class).toBe('water');
      expect(TOWER_CONFIGS.geyser.class).toBe('water');
      expect(TOWER_CONFIGS.whirlpool.class).toBe('water');

      // Ice specialty
      expect(TOWER_CONFIGS.frost_turret.class).toBe('ice');
      expect(TOWER_CONFIGS.blizzard_tower.class).toBe('ice');
      expect(TOWER_CONFIGS.glacial_spike.class).toBe('ice');

      // Poison specialty
      expect(TOWER_CONFIGS.venom_spitter.class).toBe('poison');
      expect(TOWER_CONFIGS.plague_spreader.class).toBe('poison');
      expect(TOWER_CONFIGS.miasma_cloud.class).toBe('poison');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Wave Configuration Tests
  // ═══════════════════════════════════════════════════════════

  describe('Wave Configurations', () => {
    it('should have exactly 20 waves', () => {
      expect(WAVE_CONFIGS.length).toBe(20);
    });

    it('each wave should have valid fields', () => {
      for (const wave of WAVE_CONFIGS) {
        expect(wave.wave).toBeGreaterThan(0);
        expect(wave.groups).toBeDefined();
        expect(wave.groups.length).toBeGreaterThan(0);
        expect(wave.bountyGold).toBeGreaterThanOrEqual(0);
        expect(wave.telegraph).toBeDefined();
        expect(wave.telegraph.length).toBeGreaterThan(0);
      }
    });

    it('each wave group should have valid fields', () => {
      for (const wave of WAVE_CONFIGS) {
        for (const group of wave.groups) {
          expect(group.enemyType).toBeDefined();
          expect(group.count).toBeGreaterThan(0);
          expect(group.hp).toBeGreaterThan(0);
          expect(group.speed).toBeGreaterThan(0);
          expect(group.armor).toBeGreaterThanOrEqual(0);
          expect(group.tags).toBeDefined();
          expect(group.tags.length).toBeGreaterThan(0);
          expect(group.spawnIntervalSec).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('wave numbers should be sequential from 1 to 20', () => {
      for (let i = 0; i < 20; i++) {
        expect(WAVE_CONFIGS[i].wave).toBe(i + 1);
      }
    });

    it('wave 10 should have flyers', () => {
      const wave10 = WAVE_CONFIGS[9]; // wave 10 is at index 9
      const hasFlyer = wave10.groups.some((g) => g.tags.includes('air'));
      expect(hasFlyer).toBe(true);
    });

    it('wave 15 should be a boss wave', () => {
      const wave15 = WAVE_CONFIGS[14]; // wave 15 is at index 14
      const hasBoss = wave15.groups.some((g) => g.tags.includes('boss'));
      expect(hasBoss).toBe(true);
      expect(wave15.bountyGold).toBeGreaterThan(WAVE_CONFIGS[13].bountyGold);
    });

    it('wave 20 should be the final boss', () => {
      const wave20 = WAVE_CONFIGS[19]; // wave 20 is at index 19
      const hasBoss = wave20.groups.some((g) => g.tags.includes('boss'));
      expect(hasBoss).toBe(true);
      expect(wave20.bountyGold).toBe(100); // Final boss has highest bounty
    });

    it('waves 16-17 should have invisible enemies', () => {
      const wave16 = WAVE_CONFIGS[15];
      const wave17 = WAVE_CONFIGS[16];
      const hasInvisible16 = wave16.groups.some((g) => g.tags.includes('invisible'));
      const hasInvisible17 = wave17.groups.some((g) => g.tags.includes('invisible'));
      expect(hasInvisible16).toBe(true);
      expect(hasInvisible17).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Map Configuration Tests
  // ═══════════════════════════════════════════════════════════

  describe('Map Configurations', () => {
    it('should have map_01 defined', () => {
      expect(MAP_CONFIGS.map_01).toBeDefined();
    });

    it('map should have valid dimensions', () => {
      const map = MAP_CONFIGS.map_01;
      expect(map.width).toBe(20);
      expect(map.height).toBe(15);
      expect(map.tileSize).toBe(64);
    });

    it('map should have valid waypoints', () => {
      const map = MAP_CONFIGS.map_01;
      expect(map.waypoints.length).toBeGreaterThanOrEqual(8);
      expect(map.waypoints.length).toBeLessThanOrEqual(12);

      for (const wp of map.waypoints) {
        expect(typeof wp.x).toBe('number');
        expect(typeof wp.y).toBe('number');
      }
    });

    it('map should have valid build zones', () => {
      const map = MAP_CONFIGS.map_01;
      expect(map.buildZones.length).toBe(6);

      for (const zone of map.buildZones) {
        expect(zone.x).toBeGreaterThanOrEqual(0);
        expect(zone.y).toBeGreaterThanOrEqual(0);
        expect(zone.width).toBeGreaterThan(0);
        expect(zone.height).toBeGreaterThan(0);
      }
    });

    it('map should have valid player zones', () => {
      const map = MAP_CONFIGS.map_01;
      expect(map.playerZones.length).toBe(3);

      // Zone 0 at 1+ players
      expect(map.playerZones[0].minPlayers).toBe(1);
      // Zone 1 at 2+ players
      expect(map.playerZones[1].minPlayers).toBe(2);
      // Zone 2 at 3+ players
      expect(map.playerZones[2].minPlayers).toBe(3);
    });

    it('path should wind through the map (have direction changes)', () => {
      const map = MAP_CONFIGS.map_01;
      let directionChanges = 0;
      let prevWasHorizontal: boolean | null = null;

      for (let i = 1; i < map.waypoints.length; i++) {
        const dx = map.waypoints[i].x - map.waypoints[i - 1].x;
        const dy = map.waypoints[i].y - map.waypoints[i - 1].y;

        // Skip zero movement (consecutive waypoints at same position)
        if (dx === 0 && dy === 0) continue;

        // Check if this segment is primarily horizontal or vertical
        const isHorizontal = Math.abs(dx) > Math.abs(dy);

        if (prevWasHorizontal !== null && prevWasHorizontal !== isHorizontal) {
          directionChanges++;
        }
        prevWasHorizontal = isHorizontal;
      }
      // Should have at least some direction changes for interesting path
      expect(directionChanges).toBeGreaterThanOrEqual(2);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Reaction Configuration Tests
  // ═══════════════════════════════════════════════════════════

  describe('Reaction Configurations', () => {
    it('should have exactly 4 reactions', () => {
      expect(REACTION_CONFIGS.length).toBe(4);
    });

    it('each reaction should have required fields', () => {
      for (const reaction of REACTION_CONFIGS) {
        expect(reaction.id).toBeDefined();
        expect(reaction.triggerElement).toBeDefined();
        expect(reaction.requiredStatus).toBeDefined();
        expect(reaction.effect).toBeDefined();
        expect(typeof reaction.consumesStatus).toBe('boolean');
        expect(reaction.sound).toBeDefined();
        expect(reaction.vfx).toBeDefined();
      }
    });

    it('should have all 4 MVP reactions', () => {
      const reactionIds = REACTION_CONFIGS.map((r) => r.id);
      expect(reactionIds).toContain('vaporize');
      expect(reactionIds).toContain('freeze');
      expect(reactionIds).toContain('melt');
      expect(reactionIds).toContain('conflagration');
    });

    it('vaporize should have correct effect', () => {
      const vaporize = REACTION_CONFIGS.find((r) => r.id === 'vaporize');
      expect(vaporize?.triggerElement).toBe('fire');
      expect(vaporize?.requiredStatus).toBe('soaked');
      expect(vaporize?.effect.value).toBe(1.5);
      expect(vaporize?.consumesStatus).toBe(true);
    });

    it('freeze should have correct effect', () => {
      const freeze = REACTION_CONFIGS.find((r) => r.id === 'freeze');
      expect(freeze?.triggerElement).toBe('ice');
      expect(freeze?.requiredStatus).toBe('soaked');
      expect(freeze?.effect.durationSec).toBe(3);
      expect(freeze?.consumesStatus).toBe(true);
    });

    it('melt should have correct effect', () => {
      const melt = REACTION_CONFIGS.find((r) => r.id === 'melt');
      expect(melt?.triggerElement).toBe('fire');
      expect(melt?.requiredStatus).toBe('frozen');
      expect(melt?.effect.value).toBe(2.0);
      expect(melt?.consumesStatus).toBe(true);
    });

    it('conflagration should have correct effect', () => {
      const conflagration = REACTION_CONFIGS.find((r) => r.id === 'conflagration');
      expect(conflagration?.triggerElement).toBe('fire');
      expect(conflagration?.requiredStatus).toBe('toxin');
      expect(conflagration?.effect.value).toBe(50);
      expect(conflagration?.effect.aoeRadius).toBe(2.0);
      expect(conflagration?.consumesStatus).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Class Configuration Tests
  // ═══════════════════════════════════════════════════════════

  describe('Class Configurations', () => {
    it('should have all 4 element classes', () => {
      expect(CLASS_CONFIGS.fire).toBeDefined();
      expect(CLASS_CONFIGS.water).toBeDefined();
      expect(CLASS_CONFIGS.ice).toBeDefined();
      expect(CLASS_CONFIGS.poison).toBeDefined();
    });

    it('each class should have required fields', () => {
      for (const cls of Object.values(CLASS_CONFIGS)) {
        expect(cls.id).toBeDefined();
        expect(cls.identity).toBeDefined();
        expect(cls.identity.length).toBeGreaterThan(0);
        expect(cls.passive).toBeDefined();
        expect(cls.passive.type).toBeDefined();
        expect(cls.heroId).toBeDefined();
      }
    });

    it('fire class should have burn_on_hit passive', () => {
      const fire = CLASS_CONFIGS.fire;
      expect(fire.passive.type).toBe('burn_on_hit');
      expect(fire.passive.dps).toBe(2);
      expect(fire.passive.durationSec).toBe(3);
    });

    it('water class should have soaked_on_hit passive', () => {
      const water = CLASS_CONFIGS.water;
      expect(water.passive.type).toBe('soaked_on_hit');
      expect(water.passive.durationSec).toBe(5);
    });

    it('ice class should have cold_on_hit passive', () => {
      const ice = CLASS_CONFIGS.ice;
      expect(ice.passive.type).toBe('cold_on_hit');
      // Cold is stacking, so duration indicates the time stacks persist
      expect(ice.passive.durationSec).toBe(4);
    });

    it('poison class should have toxin_on_hit passive', () => {
      const poison = CLASS_CONFIGS.poison;
      expect(poison.passive.type).toBe('toxin_on_hit');
      expect(poison.passive.dps).toBe(1);
      expect(poison.passive.durationSec).toBe(5);
    });

    it('all classes should have unique hero IDs', () => {
      const heroIds = Object.values(CLASS_CONFIGS).map((c) => c.heroId);
      const uniqueHeroIds = new Set(heroIds);
      expect(uniqueHeroIds.size).toBe(heroIds.length);
    });
  });
});