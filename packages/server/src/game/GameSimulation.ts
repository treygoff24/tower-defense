// packages/server/src/game/GameSimulation.ts
import type { GameState, ElementType, TowerConfig, WaveConfig, MapConfig, ReactionConfig, GamePhase, EnemyType } from '@td/shared';
import { PREP_PHASE_DURATION_SEC, TOWER_CONFIGS, WAVE_CONFIGS, MAP_CONFIGS, REACTION_CONFIGS } from '@td/shared';
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
  private _godMode = false;
  private _prepTimerPaused = false;

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
    if (this.room.state.phase === 'prep' || this.room.state.phase === 'combat') return;
    this.economy.grantStartingGold(this.room.playerCount);
    this.room.state.phase = 'prep';
    this.room.state.prepTimeRemaining = PREP_PHASE_DURATION_SEC;
    this.room.state.maxWaves = this.waveScheduler.totalWaves;
  }

  placeTower(playerId: string, configId: string, x: number, y: number): CommandResult {
    const config = TOWER_CONFIGS[configId];
    if (!config) return { ok: false, reason: 'Unknown tower' };
    if (!this.economy.canAfford(config.costGold)) return { ok: false, reason: 'Not enough gold' };
    const result = this.towerSystem.placeTower(configId, x, y, playerId);
    if (result.ok) this.economy.spendGold(config.costGold);
    return { ok: result.ok, reason: result.reason };
  }

  sellTower(_playerId: string, instanceId: string): CommandResult & { goldRefund?: number } {
    const result = this.towerSystem.sellTower(instanceId);
    if (result.ok && result.goldRefund !== undefined) {
      this.economy.addGold(result.goldRefund);
      return { ok: true, goldRefund: result.goldRefund };
    }
    return { ok: result.ok, reason: result.reason };
  }

  startWave(): void {
    if (!this.waveScheduler.hasMoreWaves()) return;
    this.waveScheduler.advance();
    this.room.state.wave = this.waveScheduler.currentWave;
    this.room.state.phase = 'combat';
    this.spawnQueue = this.waveScheduler.getSpawnEvents(this.room.playerCount);
    this.waveElapsedSec = 0;
    console.log(`[DEBUG] startWave: wave=${this.room.state.wave}, spawnQueue=${this.spawnQueue.length}, baseHp=${this.room.state.baseHp}, players=${this.room.playerCount}`);
  }

  tick(dt: number): void {
    const phase = this.room.state.phase;
    if (phase === 'prep') {
      if (!this._prepTimerPaused) {
        this.room.state.prepTimeRemaining -= dt;
      }
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
      this.enemySystem.spawnEnemy(spawn.enemyType, spawn.hp, spawn.speed, spawn.armor, spawn.tags);
    }

    // Move enemies
    this.enemySystem.update(dt);

    // Process tower attacks
    const aliveEnemies = this.enemySystem.getAliveEnemies();
    const towers = this.towerSystem.getAllTowers();

    for (const tower of towers) {
      const attack = this.combatSystem.processAttack(tower, aliveEnemies, this.room.state.tick);
      if (!attack) continue;

      // Apply primary damage
      this.enemySystem.damageEnemy(attack.targetId, attack.damage);

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
            this.reactionSystem.checkReaction(enemy, effect.element, attack.damage);
          }
        }
      }

      // Apply splash damage
      for (const splashId of attack.splashTargetIds) {
        this.enemySystem.damageEnemy(splashId, Math.floor(attack.damage * 0.5));
      }
    }

    // Handle leaked enemies — each leak deals 1 damage to base
    const leaked = this.enemySystem.getLeakedEnemies();
    if (leaked.length > 0) {
      console.log(`[DEBUG] ${leaked.length} enemies leaked! baseHp=${this.room.state.baseHp}, wave=${this.room.state.wave}, elapsed=${this.waveElapsedSec.toFixed(1)}s`);
    }
    for (const _enemy of leaked) {
      if (!this._godMode) {
        this.room.state.baseHp -= 1;
      }
    }

    // Check defeat
    if (this.room.state.baseHp <= 0) {
      this.room.state.baseHp = 0;
      this.room.state.phase = 'defeat';
      console.log(`[DEBUG] DEFEAT! wave=${this.room.state.wave}, tick=${this.room.state.tick}`);
      return;
    }

    // Check wave complete: no spawn queue + no alive enemies
    if (this.spawnQueue.length === 0 && this.enemySystem.aliveCount === 0) {
      const waveConfig = this.waveScheduler.getCurrentWaveConfig();
      if (waveConfig) {
        this.economy.addWaveBonus(this.waveScheduler.currentWave, this.room.playerCount);
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

  /** Dev: set gold to exact amount */
  devSetGold(amount: number): void {
    this.economy.setGold(amount);
  }

  /** Dev: skip prep timer — triggers startWave on next tick */
  devSkipPrep(): void {
    if (this.room.state.phase === 'prep') {
      this.room.state.prepTimeRemaining = 0;
    }
  }

  /** Dev: pause/unpause the prep timer */
  devPausePrepTimer(paused: boolean): void {
    this._prepTimerPaused = paused;
  }

  /** Dev: spawn N enemies immediately */
  devSpawnEnemies(enemyType: EnemyType, count: number, hp?: number, speed?: number): void {
    for (let i = 0; i < count; i++) {
      this.enemySystem.spawnEnemy(
        enemyType,
        hp ?? 100,
        speed ?? 60,
        0,
        [],
      );
    }
  }

  /** Dev: kill all alive enemies instantly */
  devKillAllEnemies(): void {
    const alive = this.enemySystem.getAliveEnemies();
    for (const enemy of alive) {
      this.enemySystem.damageEnemy(enemy.instanceId, enemy.hp);
    }
  }

  /** Dev: force phase transition */
  devSetPhase(phase: GamePhase): void {
    this.room.state.phase = phase;
    if (phase === 'prep') {
      this.room.state.prepTimeRemaining = PREP_PHASE_DURATION_SEC;
    }
  }

  /** Dev: set base HP */
  devSetBaseHp(hp: number): void {
    this.room.state.baseHp = hp;
  }

  /** Dev: set current wave number */
  devSetWave(wave: number): void {
    this.room.state.wave = wave;
    this.waveScheduler.setCurrentWave(wave);
  }

  /** Dev: god mode — base takes no damage */
  devGodMode(enabled: boolean): void {
    this._godMode = enabled;
  }

  private elementToStatusType(element: ElementType): string {
    switch (element) {
      case 'fire':   return 'burning';
      case 'water':  return 'soaked';
      case 'ice':    return 'cold';
      case 'poison': return 'toxin';
    }
  }
}
