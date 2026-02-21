// packages/client/src/GameClient.ts
import { NetworkManager } from './networking/NetworkManager';
import { StateInterpolator } from './networking/StateInterpolator';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import type { GameState, ElementType } from '@td/shared';

export class GameClient {
  private network: NetworkManager;
  private interpolator: StateInterpolator;
  private gameScene: GameScene | null = null;
  private hudScene: HudScene | null = null;
  private selectedTowerId: string | null = null;

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
    });
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

    // Sell flow: placed tower clicked → show sell panel
    gameScene.events.on(
      'placed-tower-clicked',
      (data: { instanceId: string; configId: string; refund: number }) => {
        hudScene.showSellPanel(data.instanceId, data.configId, data.refund, async () => {
          const result = await this.network.sellTower(data.instanceId);
          if (result.ok) {
            hudScene.hideSellPanel();
            gameScene.events.emit('tower-sold-visual', {
              instanceId: data.instanceId,
              goldRefund: result.goldRefund ?? data.refund,
            });
          } else {
            console.warn('Sell rejected:', result.reason);
          }
        });
      }
    );

    // Close sell panel when clicking elsewhere
    gameScene.events.on('sell-panel-close', () => {
      hudScene.hideSellPanel();
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

  getLatestState(): GameState | null {
    return this.interpolator.getLatestState();
  }

  disconnect(): void {
    this.network.disconnect();
  }
}