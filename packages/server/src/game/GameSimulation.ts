// packages/server/src/game/GameSimulation.ts
import type { GameState, ElementType, TowerConfig, WaveConfig, MapConfig, ReactionConfig, TargetingMode, ServerEvent } from '@td/shared';
import { PREP_PHASE_DURATION_SEC, TOWER_CONFIGS, WAVE_CONFIGS, MAP_CONFIGS, REACTION_CONFIGS, ENEMY_BASE_DAMAGE } from '@td/shared';
import { GameRoom } from '../rooms/GameRoom.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { WaveScheduler } from '../systems/WaveScheduler.js';
import { TowerSystem } from '../systems/TowerSystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { ReactionSystem } from '../systems/ReactionSystem.js';
import type { SpawnEvent } from '../systems/WaveScheduler.js';

export interface CommandResult {
  ok: boolean;
  reason?: string;
}

export class GameSimulation {
  private room: GameRoom;
  private economy: EconomySystem;
  private waveScheduler: WaveScheduler;
  private towerSystem: TowerSystem;
  private enemySystem: EnemySystem;
  private combatSystem: CombatSystem;
  private reactionSystem: ReactionSystem;
  private spawnQueue: SpawnEvent[] = [];
  private waveElapsedSec = 0;
  private pendingEvents: ServerEvent[] = [];

  private constructor(
    room: GameRoom,
    map: MapConfig,
    towerConfigs: Record<string, TowerConfig>,
    waveConfigs: WaveConfig[],
    reactionConfigs: ReactionConfig[],
  ) {
    this.room = room;
    this.economy = new EconomySystem();
    this.waveScheduler = new WaveScheduler(waveConfigs);
    this.towerSystem = new TowerSystem(towerConfigs, map);
    this.enemySystem = new EnemySystem(map.waypoints);
    this.combatSystem = new CombatSystem(towerConfigs);
    this.reactionSystem = new ReactionSystem(reactionConfigs);
  }

  static create(roomId: string): GameSimulation {
    const room = new GameRoom(roomId);
    const map = MAP_CONFIGS['map_01']!;
    return new GameSimulation(room, map, TOWER_CONFIGS, WAVE_CONFIGS, REACTION_CONFIGS);
  }

  get state(): GameState {
    const roomState = this.room.state;
    return {
      ...roomState,
      economy: this.economy.state,
      towers: this.towerSystem.getTowersAsRecord(),
      enemies: this.enemySystem.getEnemiesAsRecord(),
    };
  }

  /** Drain and return all pending server events accumulated since last call. */
  drainEvents(): ServerEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  addPlayer(id: string, name: string): CommandResult {
    return this.room.addPlayer(id, name);
  }

  removePlayer(id: string): void {
    this.room.removePlayer(id);
  }

  selectClass(id: string, cls: ElementType): CommandResult {
    return this.room.selectClass(id, cls);
  }

  readyUp(id: string): CommandResult {
    const result = this.room.readyUp(id);
    if (result.ok && this.allPlayersReady()) {
      this.startGame();
    }
    return result;
  }

  private allPlayersReady(): boolean {
    const players = Object.values(this.room.state.players);
    return players.length > 0 && players.every(p => p.ready && p.elementClass !== null);
  }

  startGame(): void {
    if (
      this.room.state.phase === 'prep' ||
      this.room.state.phase === 'combat' ||
      this.room.state.phase === 'victory' ||
      this.room.state.phase === 'defeat'
    ) return;
    this.economy.grantStartingGold(this.room.playerCount);
    this.room.state.phase = 'prep';
    this.room.state.prepTimeRemaining = PREP_PHASE_DURATION_SEC;
    this.room.state.maxWaves = this.waveScheduler.totalWaves;
  }

  placeTower(playerId: string, configId: string, x: number, y: number): CommandResult {
    const phase = this.room.state.phase;
    if (phase !== 'prep' && phase !== 'combat') {
      return { ok: false, reason: `Tower placement not allowed during ${phase} phase` };
    }
    const config = TOWER_CONFIGS[configId];
    if (!config) return { ok: false, reason: 'Unknown tower' };
    if (!this.economy.canAfford(config.costGold)) return { ok: false, reason: 'Not enough gold' };
    const result = this.towerSystem.placeTower(configId, x, y, playerId);
    if (result.ok) this.economy.spendGold(config.costGold);
    return { ok: result.ok, reason: result.reason };
  }

  upgradeTower(playerId: string, instanceId: string): CommandResult & { newTier?: number } {
    const tower = this.towerSystem.getTower(instanceId);
    if (!tower) return { ok: false, reason: 'Tower not found' };
    if (tower.ownerId !== playerId) return { ok: false, reason: 'You do not own this tower' };
    if (tower.tier >= 3) return { ok: false, reason: 'Tower is already at max tier' };

    const upgradeCost = this.towerSystem.getUpgradeCost(instanceId);
    if (upgradeCost === null) return { ok: false, reason: 'Already at max tier' };
    if (!this.economy.canAfford(upgradeCost)) return { ok: false, reason: 'Not enough gold' };

    this.economy.spendGold(upgradeCost);
    const result = this.towerSystem.upgradeTower(instanceId);

    if (!result.ok) {
      // Rollback gold deduction on unexpected failure
      this.economy.addGold(upgradeCost);
      return { ok: false, reason: result.reason };
    }

    // tower_upgraded event data is returned in the result; callers (e.g. index.ts)
    // are responsible for emitting the ServerEvent to connected clients.
    return { ok: true, newTier: result.newTier };
  }

  sellTower(playerId: string, instanceId: string): CommandResult & { goldRefund?: number } {
    const phase = this.room.state.phase;
    if (phase !== 'prep' && phase !== 'combat') {
      return { ok: false, reason: `Tower selling not allowed during ${phase} phase` };
    }
    const tower = this.towerSystem.getTower(instanceId);
    if (tower && tower.ownerId !== playerId) {
      return { ok: false, reason: 'You do not own this tower' };
    }
    const result = this.towerSystem.sellTower(instanceId);
    if (result.ok && result.goldRefund !== undefined) {
      this.economy.addGold(result.goldRefund);
      return { ok: true, goldRefund: result.goldRefund };
    }
    return { ok: result.ok, reason: result.reason };
  }

  setTargeting(playerId: string, instanceId: string, mode: TargetingMode): CommandResult {
    const tower = this.towerSystem.getTower(instanceId);
    if (!tower) return { ok: false, reason: 'Tower not found' };
    if (tower.ownerId !== playerId) return { ok: false, reason: 'You do not own this tower' };
    tower.targetingMode = mode;
    return { ok: true };
  }

  startWave(): void {
    if (this.state.phase !== 'prep') return;
    if (!this.waveScheduler.hasMoreWaves()) return;
    this.waveScheduler.advance();
    this.room.state.wave = this.waveScheduler.currentWave;
    this.room.state.phase = 'combat';
    this.spawnQueue = this.waveScheduler.getSpawnEvents(this.room.playerCount);
    this.waveElapsedSec = 0;
  }

  tick(dt: number): void {
    const phase = this.room.state.phase;
    if (phase === 'prep') {
      this.room.state.prepTimeRemaining -= dt;
      if (this.room.state.prepTimeRemaining <= 0) {
        this.startWave();
      }
    } else if (phase === 'combat') {
      this.tickCombat(dt);
    }
    this.room.state.tick++;
  }

  private tickCombat(dt: number): void {
    this.waveElapsedSec += dt;

    // Spawn enemies from queue based on elapsed time
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].spawnAtSec <= this.waveElapsedSec) {
      const spawn = this.spawnQueue.shift()!;
      this.enemySystem.spawnEnemy(spawn.enemyType, spawn.hp, spawn.speed, spawn.armor, spawn.tags, spawn.resistances);
    }

    // Move enemies
    this.enemySystem.update(dt);

    // Purge dead enemies from map
    this.enemySystem.clearDead();

    // Process tower attacks
    const aliveEnemies = this.enemySystem.getAliveEnemies();
    const towers = this.towerSystem.getAllTowers();

    for (const tower of towers) {
      const attack = this.combatSystem.processAttack(tower, aliveEnemies, this.room.state.tick);
      if (!attack) continue;

      // Emit tower_fired event for clients (visual projectile)
      const targetEnemy = this.enemySystem.getEnemy(attack.targetId);
      if (targetEnemy) {
        const towerConfig = TOWER_CONFIGS[tower.configId];
        const element = towerConfig?.class !== 'shared' ? towerConfig?.class : undefined;
        this.pendingEvents.push({
          type: 'tower_fired',
          towerId: attack.towerId,
          targetId: attack.targetId,
          damage: attack.damage,
          element,
          towerX: tower.x,
          towerY: tower.y,
          targetX: targetEnemy.x,
          targetY: targetEnemy.y,
        });
      }

      // Apply primary damage
      this.enemySystem.damageEnemy(attack.targetId, attack.damage);

      // Award kill bounty if enemy died
      const primaryEnemy = this.enemySystem.getEnemy(attack.targetId);
      if (primaryEnemy && !primaryEnemy.alive) {
        const waveConfig = this.waveScheduler.getCurrentWaveConfig();
        if (waveConfig) {
          this.economy.addGold(waveConfig.bountyGold);
        }
      }

      // Apply on-hit elemental statuses and check reactions
      for (const effect of attack.onHitEffects) {
        if (effect.element) {
          this.enemySystem.applyStatus(attack.targetId, {
            element: effect.element,
            type: this.elementToStatusType(effect.element),
            stacks: 1,
            remainingSec: effect.durationSec ?? 5,
          });

          // Check elemental reactions
          const enemy = this.enemySystem.getEnemy(attack.targetId);
          if (enemy?.alive) {
            const reaction = this.reactionSystem.checkReaction(enemy, effect.element, attack.damage);
            if (reaction) {
              if (reaction.damage > 0) {
                this.enemySystem.damageEnemy(enemy.instanceId, reaction.damage);
              }
              if (reaction.applyStatus) {
                enemy.statuses.push({
                  type: reaction.applyStatus,
                  element: reaction.reaction.triggerElement,
                  stacks: 1,
                  remainingSec: reaction.statusDuration ?? 3,
                });
              }
            }
          }
        }
      }

      // Apply splash damage
      for (const splashId of attack.splashTargetIds) {
        this.enemySystem.damageEnemy(splashId, Math.floor(attack.damage * 0.5));

        // Award kill bounty if splash killed this enemy
        const splashEnemy = this.enemySystem.getEnemy(splashId);
        if (splashEnemy && !splashEnemy.alive) {
          const waveConfig = this.waveScheduler.getCurrentWaveConfig();
          if (waveConfig) {
            this.economy.addGold(waveConfig.bountyGold);
          }
        }
      }
    }

    // Handle leaked enemies — each leak deals 1 damage to base
    const leaked = this.enemySystem.getLeakedEnemies();
    for (const enemy of leaked) {
      const damage = ENEMY_BASE_DAMAGE[enemy.type] ?? 1;
      this.room.state.baseHp -= damage;
    }

    // Check defeat
    if (this.room.state.baseHp <= 0) {
      this.room.state.baseHp = 0;
      this.room.state.phase = 'defeat';
      return;
    }

    // Check wave complete: no spawn queue + no alive enemies
    if (this.spawnQueue.length === 0 && this.enemySystem.aliveCount === 0) {
      const waveConfig = this.waveScheduler.getCurrentWaveConfig();
      if (waveConfig) {
        this.economy.addWaveBonus(this.waveScheduler.currentWave, this.room.playerCount);
        const waveNum = this.waveScheduler.currentWave;
        const goldReward = (40 + 10 * waveNum) * this.room.playerCount;
        this.pendingEvents.push({ type: 'wave_completed', wave: waveNum, goldReward });
      }

      if (!this.waveScheduler.hasMoreWaves()) {
        this.room.state.phase = 'victory';
      } else {
        this.room.state.phase = 'prep';
        this.room.state.prepTimeRemaining = PREP_PHASE_DURATION_SEC;
      }
    }
  }

  /** Dev/test only — grant gold directly */
  cheatAddGold(amount: number): void {
    this.economy.addGold(amount);
  }

  private elementToStatusType(element: ElementType): 'soaked' | 'burning' | 'cold' | 'frozen' | 'toxin' {
    switch (element) {
      case 'fire':   return 'burning';
      case 'water':  return 'soaked';
      case 'ice':    return 'cold';
      case 'poison': return 'toxin';
    }
  }
}
