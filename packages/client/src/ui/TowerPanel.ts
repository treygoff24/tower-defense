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
  private panelWidth = 220;
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

    configs.forEach((config, _index) => {
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
    const iH = this.itemHeight - 5;

    const elementColors: Record<ElementType | 'shared', number> = {
      fire:   0xff4400,
      water:  0x0088ff,
      ice:    0x88ccff,
      poison: 0x44cc44,
      shared: 0xaaaaaa,
    };
    const elementBuildingKeys: Record<ElementType | 'shared', string> = {
      fire:   'building_yellow',
      water:  'building_blue',
      ice:    'building_black',
      poison: 'building_purple',
      shared: 'building_blue',
    };
    const elementSoldierKeys: Record<ElementType | 'shared', string> = {
      fire:   'tower_fire',
      water:  'tower_water',
      ice:    'tower_ice',
      poison: 'tower_poison',
      shared: 'tower_shared',
    };

    const elementColor = elementColors[config.class] ?? 0xaaaaaa;
    const alpha = canAfford ? 1 : 0.45;

    // ── Item background ───────────────────────────────────────────
    const bg = this.scene.add.graphics();
    const drawBg = (hover: boolean, selected: boolean) => {
      bg.clear();
      const fill = selected ? 0x1e2a3a : hover ? 0x222238 : 0x181828;
      bg.fillStyle(fill, 1);
      bg.fillRoundedRect(-itemWidth / 2, -iH / 2, itemWidth, iH, 6);
      const borderColor = selected ? elementColor : canAfford ? (hover ? elementColor : 0x333355) : 0x332222;
      const borderAlpha = selected ? 1 : canAfford ? (hover ? 0.9 : 0.5) : 0.3;
      bg.lineStyle(selected ? 2 : 1, borderColor, borderAlpha);
      bg.strokeRoundedRect(-itemWidth / 2, -iH / 2, itemWidth, iH, 6);
    };
    drawBg(false, false);

    // ── Building thumbnail ────────────────────────────────────────
    const buildingKey = elementBuildingKeys[config.class] ?? 'building_blue';
    const thumbSize = 36;
    const thumbX = -itemWidth / 2 + thumbSize / 2 + 4;
    let thumb: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    if (this.scene.textures.exists(buildingKey)) {
      thumb = this.scene.add.image(thumbX, 0, buildingKey);
      (thumb as Phaser.GameObjects.Image).setScale(0.12);
      (thumb as Phaser.GameObjects.Image).setAlpha(alpha);
    } else {
      thumb = this.scene.add.rectangle(thumbX, 0, thumbSize, thumbSize - 10, elementColor, alpha * 0.5);
    }

    // Soldier sprite (frame 0)
    const soldierKey = elementSoldierKeys[config.class] ?? 'tower_shared';
    let soldierThumb: Phaser.GameObjects.Sprite | null = null;
    if (this.scene.textures.exists(soldierKey)) {
      soldierThumb = this.scene.add.sprite(thumbX - 2, -4, soldierKey, 0);
      soldierThumb.setScale(2.4);
      soldierThumb.setAlpha(alpha);
    }

    // ── Tower name ────────────────────────────────────────────────
    // Text starts just after the thumbnail area; fixed width to prevent overflow
    const textX = thumbX + thumbSize / 2 + 6;                // left-anchored after thumb
    const dotReserve = 18;                                    // space for element dot + gap
    const textMaxWidth = itemWidth / 2 - textX - dotReserve; // px available before dot

    const nameColor = canAfford ? '#ffffff' : '#555566';
    const displayName = this.truncateName(config.name, textMaxWidth, 12);
    const name = this.scene.add.text(textX, -14, displayName, {
      fontSize: '12px',
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: nameColor,
    }).setOrigin(0, 0.5);

    // ── Cost ──────────────────────────────────────────────────────
    const costColor = canAfford ? '#ffd700' : '#664444';
    const cost = this.scene.add.text(textX, 6, `💰 ${config.costGold}g`, {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: costColor,
    }).setOrigin(0, 0.5);

    // ── Element dot (right edge) ──────────────────────────────────
    const dot = this.scene.add.circle(itemWidth / 2 - 10, 0, 5, elementColor, alpha);

    const children: Phaser.GameObjects.GameObject[] = [bg, thumb, name, cost, dot];
    if (soldierThumb) children.splice(2, 0, soldierThumb);
    container.add(children);

    // ── Interactivity ─────────────────────────────────────────────
    const hitArea = this.scene.add.rectangle(0, 0, itemWidth, iH, 0, 0)
      .setInteractive({ useHandCursor: canAfford });
    container.add(hitArea);

    if (canAfford) {
      hitArea.on('pointerover', () => { drawBg(true, this.selectedTower === config.id); });
      hitArea.on('pointerout',  () => { drawBg(false, this.selectedTower === config.id); });
      hitArea.on('pointerdown', () => {
        this.selectTower(config.id, container);
        drawBg(true, true);
      });
    }

    (container as unknown as { bgGfx: Phaser.GameObjects.Graphics }).bgGfx = bg;
    (container as unknown as { drawBg: (hover: boolean, sel: boolean) => void }).drawBg = drawBg;
    (container as unknown as { bgRect: Phaser.GameObjects.Rectangle }).bgRect =
      this.scene.add.rectangle(0, 0, 0, 0); // legacy compat shim
    (container as unknown as { configId: string }).configId = config.id;

    return container;
  }

  /**
   * Truncate a tower name to fit within maxWidth pixels at the given font size.
   * Uses a rough char-width estimate; Phaser measures text on canvas but we avoid
   * the overhead of creating a temp Text just for measurement.
   */
  private truncateName(name: string, maxWidth: number, fontSize: number): string {
    // Bold Arial Black averages ~0.68× font size per char
    const charWidth = fontSize * 0.68;
    const ellipsis = '…';
    const ellipsisWidth = charWidth;
    if (name.length * charWidth <= maxWidth) return name;

    const maxChars = Math.floor((maxWidth - ellipsisWidth) / charWidth);
    return name.slice(0, Math.max(maxChars, 1)) + ellipsis;
  }

  private selectTower(configId: string, _container: Phaser.GameObjects.Container): void {
    // Deselect all
    this.towerItemContainers.forEach((item) => {
      const draw = (item as unknown as { drawBg: (hover: boolean, sel: boolean) => void }).drawBg;
      if (draw) draw(false, false);
    });

    // Select new
    this.selectedTower = configId;
    const found = this.towerItemContainers.find(
      (item) => (item as unknown as { configId: string }).configId === configId
    );
    if (found) {
      const draw = (found as unknown as { drawBg: (hover: boolean, sel: boolean) => void }).drawBg;
      if (draw) draw(false, true);
    }

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
