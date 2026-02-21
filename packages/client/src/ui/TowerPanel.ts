import Phaser from 'phaser';
import type { TowerConfig, ElementType } from '@td/shared';
import { TOWER_CONFIGS } from '@td/shared';
import { S } from '../dpr';

interface TowerDisplayInfo {
  config: TowerConfig;
  canAfford: boolean;
}

export type TowerSelectionCallback = (configId: string) => void;

const ELEMENT_ICONS: Record<ElementType | 'shared', string> = {
  fire: '🔥',
  water: '💧',
  ice: '❄',
  poison: '☠',
  shared: '⚔',
};

const ELEMENT_COLORS: Record<ElementType | 'shared', number> = {
  fire: 0xff4400,
  water: 0x0088ff,
  ice: 0x88ccff,
  poison: 0x44cc44,
  shared: 0xaaaaaa,
};

const ELEMENT_HEX: Record<ElementType | 'shared', string> = {
  fire: '#ff4400',
  water: '#0088ff',
  ice: '#88ccff',
  poison: '#44cc44',
  shared: '#aaaaaa',
};

export class TowerPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private towerItems: TowerDisplayInfo[] = [];
  private selectedTower: string | null = null;
  private onSelection: TowerSelectionCallback | null = null;
  private currentGold = 0;
  private elementClass: ElementType | 'shared' = 'shared';
  private titleText: Phaser.GameObjects.Text | null = null;

  private towerItemContainers: Phaser.GameObjects.Container[] = [];
  private panelWidth = 220 * S;
  private itemHeight = 70 * S;

  /** Track the breathing-glow tween on the selected item */
  private selectionTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.container = scene.add.container(x, y);

    this.createBackground();
    this.createTitle();
  }

  // ────────────────────────────────────────────────────────────────
  // Background
  // ────────────────────────────────────────────────────────────────
  private createBackground(): void {
    const bgH = 400 * S;
    if (this.scene.textures.exists('ui_wood_table')) {
      const woodBg = this.scene.add.image(0, 0, 'ui_wood_table');
      woodBg.setDisplaySize(this.panelWidth, bgH);
      woodBg.setAlpha(0.9);
      this.container.add(woodBg);

      // Dark overlay for contrast
      const overlay = this.scene.add.graphics();
      overlay.fillStyle(0x000000, 0.25);
      overlay.fillRect(-this.panelWidth / 2, -bgH / 2, this.panelWidth, bgH);
      this.container.add(overlay);
    } else {
      // Fallback: plain rectangle
      const bg = this.scene.add.rectangle(0, 0, this.panelWidth, bgH, 0x1a1a2e, 0.9);
      bg.setStrokeStyle(2 * S, 0x444466);
      this.container.add(bg);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Title
  // ────────────────────────────────────────────────────────────────
  private createTitle(): void {
    const icon = ELEMENT_ICONS[this.elementClass] ?? '⚔';
    const color = ELEMENT_HEX[this.elementClass] ?? '#ffffff';

    this.titleText = this.scene.add
      .text(0, -180 * S, `${icon} TOWERS`, {
        fontSize: `${18 * S}px`,
        fontFamily: 'Arial',
        fontStyle: 'bold',
        color,
      })
      .setOrigin(0.5);
    this.container.add(this.titleText);
  }

  /** Update the title to reflect the current element class */
  private refreshTitle(): void {
    if (!this.titleText) return;
    const icon = ELEMENT_ICONS[this.elementClass] ?? '⚔';
    const color = ELEMENT_HEX[this.elementClass] ?? '#ffffff';
    this.titleText.setText(`${icon} TOWERS`);
    this.titleText.setColor(color);
  }

  // ────────────────────────────────────────────────────────────────
  // Public API — element class
  // ────────────────────────────────────────────────────────────────
  setElementClass(element: ElementType): void {
    this.elementClass = element;
    this.refreshTitle();
  }

  // ────────────────────────────────────────────────────────────────
  // Tower configs
  // ────────────────────────────────────────────────────────────────
  setTowerConfigs(configs: TowerConfig[]): void {
    // Clear existing items
    this.towerItemContainers.forEach((item) => item.destroy());
    this.towerItemContainers = [];
    this.towerItems = [];

    // Stop any active selection tween
    this.stopSelectionTween();

    // Create new items
    let yOffset = -140 * S;

    configs.forEach((config) => {
      const canAfford = config.costGold <= this.currentGold;
      const itemContainer = this.createTowerItem(config, canAfford, yOffset);
      this.towerItemContainers.push(itemContainer);
      this.container.add(itemContainer);

      this.towerItems.push({ config, canAfford });
      yOffset += this.itemHeight;
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Tower item creation
  // ────────────────────────────────────────────────────────────────
  private createTowerItem(
    config: TowerConfig,
    canAfford: boolean,
    y: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, y);
    const itemWidth = this.panelWidth - 20 * S;
    const iH = this.itemHeight - 5 * S;

    const elementBuildingKeys: Record<ElementType | 'shared', string> = {
      fire: 'building_yellow',
      water: 'building_blue',
      ice: 'building_black',
      poison: 'building_purple',
      shared: 'building_blue',
    };
    const elementSoldierKeys: Record<ElementType | 'shared', string> = {
      fire: 'ts_fire_idle',
      water: 'ts_water_idle',
      ice: 'ts_ice_idle',
      poison: 'ts_poison_idle',
      shared: 'ts_shared_idle',
    };

    const elementColor = ELEMENT_COLORS[config.class] ?? 0xaaaaaa;
    const alpha = canAfford ? 1 : 0.45;

    // ── Item background ───────────────────────────────────────────
    const bg = this.scene.add.graphics();
    const drawBg = (hover: boolean, selected: boolean, afford: boolean) => {
      bg.clear();
      const fill = selected ? 0x1e2a3a : hover ? 0x222238 : 0x181828;
      bg.fillStyle(fill, 1);
      bg.fillRoundedRect(-itemWidth / 2, -iH / 2, itemWidth, iH, 6 * S);

      let borderColor: number;
      let borderAlpha: number;
      if (!afford) {
        borderColor = 0x442222;
        borderAlpha = 0.3;
      } else if (selected) {
        borderColor = elementColor;
        borderAlpha = 1;
      } else if (hover) {
        borderColor = elementColor;
        borderAlpha = 0.9;
      } else {
        borderColor = 0x333355;
        borderAlpha = 0.5;
      }
      bg.lineStyle((selected ? 2 : 1) * S, borderColor, borderAlpha);
      bg.strokeRoundedRect(-itemWidth / 2, -iH / 2, itemWidth, iH, 6 * S);
    };
    drawBg(false, false, canAfford);

    // ── Green left-border accent (when affordable) ────────────────
    const leftAccent = this.scene.add.graphics();
    if (canAfford) {
      leftAccent.fillStyle(elementColor, 0.7);
      leftAccent.fillRoundedRect(-itemWidth / 2, -iH / 2 + 4 * S, 2 * S, iH - 8 * S, S);
    }

    // ── Building thumbnail ────────────────────────────────────────
    const buildingKey = elementBuildingKeys[config.class] ?? 'building_blue';
    const thumbSize = 36 * S;
    const thumbX = -itemWidth / 2 + thumbSize / 2 + 4 * S;
    let thumb: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    if (this.scene.textures.exists(buildingKey)) {
      thumb = this.scene.add.image(thumbX, 0, buildingKey);
      (thumb as Phaser.GameObjects.Image).setScale(0.12 * S);
      (thumb as Phaser.GameObjects.Image).setAlpha(alpha);
    } else {
      thumb = this.scene.add.rectangle(
        thumbX,
        0,
        thumbSize,
        thumbSize - 10 * S,
        elementColor,
        alpha * 0.5
      );
    }

    // Soldier sprite (frame 0)
    const soldierKey = elementSoldierKeys[config.class] ?? 'ts_shared_idle';
    let soldierThumb: Phaser.GameObjects.Sprite | null = null;
    if (this.scene.textures.exists(soldierKey)) {
      soldierThumb = this.scene.add.sprite(thumbX - 2 * S, -4 * S, soldierKey, 0);
      // Tiny Swords units are 192px (or 320px for Lancer) — scale to fit thumbnail
      const isLancer = soldierKey.includes('ice');
      soldierThumb.setScale((isLancer ? 0.09 : 0.15) * S);
      soldierThumb.setAlpha(alpha);
    }

    // ── Tower name ────────────────────────────────────────────────
    const textX = thumbX + thumbSize / 2 + 6 * S;
    const dotReserve = 18 * S;
    const textMaxWidth = itemWidth / 2 - textX - dotReserve;

    const nameColor = canAfford ? '#ffffff' : '#554444';
    const displayName = this.truncateName(config.name, textMaxWidth, 12 * S);
    const name = this.scene.add
      .text(textX, -16 * S, displayName, {
        fontSize: `${12 * S}px`,
        fontFamily: '"Arial Black", Arial',
        fontStyle: 'bold',
        color: nameColor,
      })
      .setOrigin(0, 0.5);

    // ── Cost ──────────────────────────────────────────────────────
    let costStr: string;
    let costColor: string;
    if (canAfford) {
      costStr = `💰 ${config.costGold}g`;
      costColor = '#ffd700';
    } else {
      const deficit = config.costGold - this.currentGold;
      costStr = `💰 ${config.costGold}g (-${deficit})`;
      costColor = '#cc4444';
    }
    const cost = this.scene.add
      .text(textX, 2 * S, costStr, {
        fontSize: `${11 * S}px`,
        fontFamily: 'Arial',
        color: costColor,
      })
      .setOrigin(0, 0.5);

    // ── Range indicator ───────────────────────────────────────────
    const towerCfg = TOWER_CONFIGS[config.id];
    const rangeVal = towerCfg ? towerCfg.range : config.range;
    const rangeText = this.scene.add
      .text(textX, 16 * S, `📏 ${rangeVal} tiles`, {
        fontSize: `${10 * S}px`,
        fontFamily: 'Arial',
        color: '#888888',
      })
      .setOrigin(0, 0.5);

    // ── Element dot (right edge) ──────────────────────────────────
    const dot = this.scene.add.circle(itemWidth / 2 - 10 * S, 0, 5 * S, elementColor, alpha);

    const children: Phaser.GameObjects.GameObject[] = [
      bg,
      leftAccent,
      thumb,
      name,
      cost,
      rangeText,
      dot,
    ];
    if (soldierThumb) children.splice(3, 0, soldierThumb);
    container.add(children);

    // ── Interactivity ─────────────────────────────────────────────
    const hitArea = this.scene.add
      .rectangle(0, 0, itemWidth, iH, 0, 0)
      .setInteractive({ useHandCursor: canAfford });
    container.add(hitArea);

    if (canAfford) {
      hitArea.on('pointerover', () => {
        drawBg(true, this.selectedTower === config.id, true);
      });
      hitArea.on('pointerout', () => {
        drawBg(false, this.selectedTower === config.id, true);
      });
      hitArea.on('pointerdown', () => {
        this.selectTower(config.id, container);
        drawBg(true, true, true);
      });
    }

    // Store references for later updates
    (container as unknown as { bgGfx: Phaser.GameObjects.Graphics }).bgGfx = bg;
    (container as unknown as { drawBg: (h: boolean, s: boolean, a: boolean) => void }).drawBg =
      drawBg;
    (container as unknown as { leftAccent: Phaser.GameObjects.Graphics }).leftAccent = leftAccent;
    (container as unknown as { nameText: Phaser.GameObjects.Text }).nameText = name;
    (container as unknown as { costText: Phaser.GameObjects.Text }).costText = cost;
    (container as unknown as { rangeText: Phaser.GameObjects.Text }).rangeText = rangeText;
    (container as unknown as { dotCircle: Phaser.GameObjects.Arc }).dotCircle = dot;
    (container as unknown as { hitArea: Phaser.GameObjects.Rectangle }).hitArea = hitArea;
    (container as unknown as { bgRect: Phaser.GameObjects.Rectangle }).bgRect =
      this.scene.add.rectangle(0, 0, 0, 0); // legacy compat shim
    (container as unknown as { configId: string }).configId = config.id;

    return container;
  }

  /**
   * Truncate a tower name to fit within maxWidth pixels at the given font size.
   */
  private truncateName(name: string, maxWidth: number, fontSize: number): string {
    const charWidth = fontSize * 0.68;
    const ellipsis = '…';
    const ellipsisWidth = charWidth;
    if (name.length * charWidth <= maxWidth) return name;

    const maxChars = Math.floor((maxWidth - ellipsisWidth) / charWidth);
    return name.slice(0, Math.max(maxChars, 1)) + ellipsis;
  }

  // ────────────────────────────────────────────────────────────────
  // Selection
  // ────────────────────────────────────────────────────────────────
  private stopSelectionTween(): void {
    if (this.selectionTween) {
      this.selectionTween.stop();
      this.selectionTween.destroy();
      this.selectionTween = null;
    }
  }

  private selectTower(configId: string, _container: Phaser.GameObjects.Container): void {
    // Stop previous breathing glow
    this.stopSelectionTween();

    // Deselect all — reset border alpha on old selection
    this.towerItemContainers.forEach((item) => {
      const draw = (item as unknown as { drawBg: (h: boolean, s: boolean, a: boolean) => void })
        .drawBg;
      const cid = (item as unknown as { configId: string }).configId;
      const ti = this.towerItems.find((t) => t.config.id === cid);
      const afford = ti ? ti.canAfford : true;
      if (draw) draw(false, false, afford);

      const gfx = (item as unknown as { bgGfx: Phaser.GameObjects.Graphics }).bgGfx;
      if (gfx) gfx.setAlpha(1);
    });

    // Select new
    this.selectedTower = configId;
    const found = this.towerItemContainers.find(
      (item) => (item as unknown as { configId: string }).configId === configId
    );
    if (found) {
      const draw = (found as unknown as { drawBg: (h: boolean, s: boolean, a: boolean) => void })
        .drawBg;
      if (draw) draw(false, true, true);

      // Breathing glow: pulse the border graphics alpha
      const bgGfx = (found as unknown as { bgGfx: Phaser.GameObjects.Graphics }).bgGfx;
      if (bgGfx) {
        bgGfx.setAlpha(1);
        this.selectionTween = this.scene.tweens.add({
          targets: bgGfx,
          alpha: { from: 1.0, to: 0.7 },
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    if (this.onSelection) {
      this.onSelection(configId);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Gold & affordability refresh
  // ────────────────────────────────────────────────────────────────
  setGold(gold: number): void {
    const oldGold = this.currentGold;
    this.currentGold = gold;
    if (oldGold !== gold) {
      this.refreshAffordability();
    }
  }

  private refreshAffordability(): void {
    const itemWidth = this.panelWidth - 20 * S;
    const iH = this.itemHeight - 5 * S;

    this.towerItems.forEach((info, idx) => {
      const container = this.towerItemContainers[idx];
      if (!container) return;

      const config = info.config;
      const wasAffordable = info.canAfford;
      const canAffordNow = config.costGold <= this.currentGold;

      // Skip if nothing changed
      if (wasAffordable === canAffordNow) {
        // Still update deficit text if can't afford
        if (!canAffordNow) {
          const costText = (container as unknown as { costText: Phaser.GameObjects.Text })
            .costText;
          if (costText) {
            const deficit = config.costGold - this.currentGold;
            costText.setText(`💰 ${config.costGold}g (-${deficit})`);
          }
        }
        return;
      }

      info.canAfford = canAffordNow;
      const elementColor = ELEMENT_COLORS[config.class] ?? 0xaaaaaa;
      const alpha = canAffordNow ? 1 : 0.45;

      // Update name text color
      const nameText = (container as unknown as { nameText: Phaser.GameObjects.Text }).nameText;
      if (nameText) {
        nameText.setColor(canAffordNow ? '#ffffff' : '#554444');
      }

      // Update cost text
      const costText = (container as unknown as { costText: Phaser.GameObjects.Text }).costText;
      if (costText) {
        if (canAffordNow) {
          costText.setText(`💰 ${config.costGold}g`);
          costText.setColor('#ffd700');
        } else {
          const deficit = config.costGold - this.currentGold;
          costText.setText(`💰 ${config.costGold}g (-${deficit})`);
          costText.setColor('#cc4444');
        }
      }

      // Update dot alpha
      const dotCircle = (container as unknown as { dotCircle: Phaser.GameObjects.Arc })
        .dotCircle;
      if (dotCircle) {
        dotCircle.setAlpha(alpha);
      }

      // Update left accent
      const leftAccent = (container as unknown as { leftAccent: Phaser.GameObjects.Graphics })
        .leftAccent;
      if (leftAccent) {
        leftAccent.clear();
        if (canAffordNow) {
          leftAccent.fillStyle(elementColor, 0.7);
          leftAccent.fillRoundedRect(-itemWidth / 2, -iH / 2 + 4 * S, 2 * S, iH - 8 * S, S);
        }
      }

      // Redraw background with correct affordability
      const isSelected = this.selectedTower === config.id;
      const drawBg = (
        container as unknown as { drawBg: (h: boolean, s: boolean, a: boolean) => void }
      ).drawBg;
      if (drawBg) {
        drawBg(false, isSelected, canAffordNow);
      }

      // Update hitArea interactivity
      const hitArea = (container as unknown as { hitArea: Phaser.GameObjects.Rectangle }).hitArea;
      if (hitArea) {
        hitArea.removeAllListeners();
        if (canAffordNow) {
          hitArea.setInteractive({ useHandCursor: true });
          hitArea.on('pointerover', () => {
            drawBg(true, this.selectedTower === config.id, true);
          });
          hitArea.on('pointerout', () => {
            drawBg(false, this.selectedTower === config.id, true);
          });
          hitArea.on('pointerdown', () => {
            this.selectTower(config.id, container);
            drawBg(true, true, true);
          });
        } else {
          hitArea.disableInteractive();
        }
      }
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────
  setSelectionCallback(callback: TowerSelectionCallback): void {
    this.onSelection = callback;
  }

  getSelectedTower(): string | null {
    return this.selectedTower;
  }

  clearSelection(): void {
    this.stopSelectionTween();
    this.selectedTower = null;
    this.towerItemContainers.forEach((item) => {
      const cid = (item as unknown as { configId: string }).configId;
      const ti = this.towerItems.find((t) => t.config.id === cid);
      const afford = ti ? ti.canAfford : true;

      // Reset graphics alpha
      const gfx = (item as unknown as { bgGfx: Phaser.GameObjects.Graphics }).bgGfx;
      if (gfx) gfx.setAlpha(1);

      // Redraw without selection
      const draw = (item as unknown as { drawBg: (h: boolean, s: boolean, a: boolean) => void })
        .drawBg;
      if (draw) draw(false, false, afford);

      // Legacy compat
      const bg = (item as unknown as { bgRect: Phaser.GameObjects.Rectangle }).bgRect;
      if (bg && bg.setStrokeStyle) bg.setStrokeStyle(S, 0x444466);
    });
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.stopSelectionTween();
    this.container.destroy();
  }
}
