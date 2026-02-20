import Phaser from 'phaser';
import type { TowerConfig, ElementType } from '@td/shared';

interface TowerDisplayInfo {
  config: TowerConfig;
  canAfford: boolean;
}

export type TowerSelectionCallback = (configId: string) => void;

export class TowerPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private towerItems: TowerDisplayInfo[] = [];
  private selectedTower: string | null = null;
  private onSelection: TowerSelectionCallback | null = null;
  private currentGold = 0;

  private towerItemContainers: Phaser.GameObjects.Container[] = [];
  private panelWidth = 180;
  private itemHeight = 70;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.container = scene.add.container(x, y);

    this.createBackground();
    this.createTitle();
  }

  private createBackground(): void {
    // Panel background
    const bg = this.scene.add.rectangle(0, 0, this.panelWidth, 400, 0x1a1a2e, 0.9);
    bg.setStrokeStyle(2, 0x444466);
    this.container.add(bg);
  }

  private createTitle(): void {
    const title = this.scene.add.text(0, -180, 'TOWERS', {
      fontSize: '18px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.container.add(title);
  }

  setTowerConfigs(configs: TowerConfig[]): void {
    // Clear existing items
    this.towerItemContainers.forEach((item) => item.destroy());
    this.towerItemContainers = [];

    // Create new items
    let yOffset = -140;

    configs.forEach((config, index) => {
      const canAfford = config.costGold <= this.currentGold;
      const itemContainer = this.createTowerItem(config, canAfford, yOffset);
      this.towerItemContainers.push(itemContainer);
      this.container.add(itemContainer);

      this.towerItems.push({ config, canAfford });
      yOffset += this.itemHeight;
    });
  }

  private createTowerItem(
    config: TowerConfig,
    canAfford: boolean,
    y: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, y);
    const itemWidth = this.panelWidth - 20;

    // Item background
    const bg = this.scene.add.rectangle(0, 0, itemWidth, this.itemHeight - 5, 0x2a2a3e);
    bg.setStrokeStyle(1, canAfford ? 0x00aa66 : 0x664444);

    // Tower name
    const nameColor = canAfford ? '#ffffff' : '#666666';
    const name = this.scene.add.text(-itemWidth / 2 + 10, -20, config.name, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: nameColor,
    });

    // Cost
    const costColor = canAfford ? '#ffd700' : '#884444';
    const cost = this.scene.add.text(-itemWidth / 2 + 10, 5, `${config.costGold}g`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: costColor,
    });

    // Element indicator
    const elementColors: Record<ElementType | 'shared', number> = {
      fire: 0xff4400,
      water: 0x0088ff,
      ice: 0x88ccff,
      poison: 0x44cc44,
      shared: 0xaaaaaa,
    };
    const elementColor = elementColors[config.class] || 0xaaaaaa;
    const elementDot = this.scene.add.circle(itemWidth / 2 - 15, 0, 8, elementColor);

    container.add([bg, name, cost, elementDot]);

    // Make interactive if affordable
    if (canAfford) {
      bg.setInteractive({ useHandCursor: true });

      bg.on('pointerover', () => {
        bg.setFillStyle(0x3a3a4e);
      });

      bg.on('pointerout', () => {
        bg.setFillStyle(0x2a2a3e);
      });

      bg.on('pointerdown', () => {
        this.selectTower(config.id, container);
      });
    }

    (container as unknown as { bgRect: Phaser.GameObjects.Rectangle }).bgRect = bg;
    (container as unknown as { configId: string }).configId = config.id;

    return container;
  }

  private selectTower(configId: string, container: Phaser.GameObjects.Container): void {
    // Deselect previous
    this.towerItemContainers.forEach((item) => {
      const bg = (item as unknown as { bgRect: Phaser.GameObjects.Rectangle }).bgRect;
      bg.setStrokeStyle(1, 0x444466);
    });

    // Select new
    this.selectedTower = configId;
    const bg = (container as unknown as { bgRect: Phaser.GameObjects.Rectangle }).bgRect;
    bg.setStrokeStyle(2, 0x00ff88);

    // Emit callback
    if (this.onSelection) {
      this.onSelection(configId);
    }
  }

  setGold(gold: number): void {
    this.currentGold = gold;
    // Refresh display to update affordability
    // In a real implementation, you'd want to call a refresh method
  }

  setSelectionCallback(callback: TowerSelectionCallback): void {
    this.onSelection = callback;
  }

  getSelectedTower(): string | null {
    return this.selectedTower;
  }

  clearSelection(): void {
    this.selectedTower = null;
    this.towerItemContainers.forEach((item) => {
      const bg = (item as unknown as { bgRect: Phaser.GameObjects.Rectangle }).bgRect;
      bg.setStrokeStyle(1, 0x444466);
    });
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy();
  }
}
