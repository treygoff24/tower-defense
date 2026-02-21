// packages/client/src/GameClient.ts
import { NetworkManager } from './networking/NetworkManager';
import { StateInterpolator } from './networking/StateInterpolator';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import type { ResultSceneData } from './scenes/ResultScene';
import type { GameState, ElementType } from '@td/shared';

export class GameClient {
  private network: NetworkManager;
  private interpolator: StateInterpolator;
  private gameScene: GameScene | null = null;
  private hudScene: HudScene | null = null;
  private selectedTowerId: string | null = null;
  private resultShown = false;

  constructor(serverUrl?: string) {
    this.network = new NetworkManager(serverUrl);
    this.interpolator = new StateInterpolator();
  }

  async connect(playerName: string): Promise<void> {
    await this.network.connect();
    await this.network.joinGame(playerName);

    this.network.onGameSnapshot((state: GameState) => {
      this.interpolator.pushSnapshot(state, performance.now());
      this.hudScene?.syncState(state);
      this.gameScene?.syncState(state);

      // Launch result screen on game over
      if ((state.phase === 'victory' || state.phase === 'defeat') && !this.resultShown) {
        this.resultShown = true;
        this.launchResultScene(state);
      }
    });

    // Relay tower_fired events from the server to the GameScene event bus
    // Also track shots for MVP tower stat
    this.network.onTowerFired((event) => {
      this.gameScene?.events.emit('tower_fired', event);
      // Look up configId from current state for MVP tracking
      const curState = this.interpolator.getLatestState();
      const configId = curState?.towers[event.towerId]?.configId ?? event.towerId;
      this.hudScene?.recordTowerShot(event.towerId, configId);
    });
  }

  private launchResultScene(state: GameState): void {
    const stats = this.hudScene?.getMatchStats() ?? {
      enemiesKilled: 0,
      goldEarned: 0,
      towersBuilt: 0,
      mvpTowerName: null,
    };

    const data: ResultSceneData = {
      phase: state.phase as 'victory' | 'defeat',
      wave: state.wave,
      maxWaves: state.maxWaves,
      ...stats,
    };

    // Launch ResultScene alongside the existing scenes
    this.gameScene?.scene.launch('ResultScene', data);
  }

  bindScenes(gameScene: GameScene, hudScene: HudScene): void {
    this.gameScene = gameScene;
    this.hudScene = hudScene;

    gameScene.events.on('tile-clicked', async (data: { tileX: number; tileY: number; configId?: string }) => {
      const configId = data.configId ?? this.selectedTowerId;
      if (configId) {
        const result = await this.network.placeTower(configId, data.tileX, data.tileY);
        if (!result.ok) {
          console.warn('Placement rejected:', result.reason);
        }
      }
    });

    // Tower clicked → show TowerInspector with sell/upgrade/targeting
    gameScene.events.on(
      'placed-tower-clicked',
      (data: { instanceId: string; configId: string; refund: number; tier: number; ownerId: string }) => {
        hudScene.showTowerInspector(data.instanceId, data.configId, data.tier, data.refund, data.ownerId);
      }
    );

    // Close sell panel when clicking elsewhere (also closes inspector)
    gameScene.events.on('sell-panel-close', () => {
      hudScene.hideSellPanel();
      hudScene.hideTowerInspector();
    });
  }

  async selectClass(elementClass: ElementType): Promise<void> {
    await this.network.selectClass(elementClass);
  }

  async readyUp(): Promise<void> {
    await this.network.readyUp();
  }

  async startWave(): Promise<void> {
    await this.network.startWave();
  }

  selectTower(configId: string): void {
    this.selectedTowerId = configId;
  }

  clearTowerSelection(): void {
    this.selectedTowerId = null;
  }

  async sellTower(instanceId: string): Promise<{ ok: boolean; reason?: string; goldRefund?: number }> {
    return this.network.sellTower(instanceId);
  }

  async upgradeTower(instanceId: string): Promise<{ ok: boolean; reason?: string }> {
    return this.network.upgradeTower(instanceId);
  }

  async sendCommand(command: import('@td/shared').ClientCommand): Promise<{ ok: boolean; reason?: string }> {
    return this.network.sendCommand(command);
  }

  getLatestState(): GameState | null {
    return this.interpolator.getLatestState();
  }

  disconnect(): void {
    this.network.disconnect();
  }
}