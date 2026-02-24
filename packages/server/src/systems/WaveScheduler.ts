// packages/server/src/systems/WaveScheduler.ts
import type { WaveConfig, EnemyType } from '@td/shared';

export interface SpawnEvent {
  enemyType: EnemyType;
  hp: number;
  speed: number;
  armor: number;
  tags: string[];
  spawnAtSec: number;
  resistances?: string[];
}

export class WaveScheduler {
  private waves: WaveConfig[];
  currentWave: number = 0;

  constructor(waves: WaveConfig[]) {
    this.waves = waves;
  }

  getNextWave(): WaveConfig | undefined {
    return this.waves[this.currentWave];
  }

  getCurrentWaveConfig(): WaveConfig | undefined {
    return this.waves[this.currentWave - 1];
  }

  advance(): void {
    this.currentWave++;
  }

  hasMoreWaves(): boolean {
    return this.currentWave < this.waves.length;
  }

  getSpawnEvents(playerCount: number): SpawnEvent[] {
    const config = this.getCurrentWaveConfig();
    if (!config) return [];

    const hpScale = 1 + 0.3 * (playerCount - 1);
    const events: SpawnEvent[] = [];

    for (const group of config.groups) {
      for (let i = 0; i < group.count; i++) {
        events.push({
          enemyType: group.enemyType,
          hp: Math.round(group.hp * hpScale),
          speed: group.speed,
          armor: group.armor,
          tags: group.tags,
          spawnAtSec: i * group.spawnIntervalSec,
          resistances: group.resistances,
        });
      }
    }

    return events;
  }

  setCurrentWave(wave: number): void {
    this.currentWave = Math.max(0, Math.min(wave, this.waves.length));
  }

  get totalWaves(): number {
    return this.waves.length;
  }
}
