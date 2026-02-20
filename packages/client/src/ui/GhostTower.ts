import Phaser from 'phaser';
import { TILE_SIZE } from '@td/shared';

export class GhostTower {
  private scene: Phaser.Scene;
  private rect!: Phaser.GameObjects.Rectangle;
  private rangeCircle!: Phaser.GameObjects.Shape;
  private rangeGraphics!: Phaser.GameObjects.Graphics;
  private isValidPlacement = false;
  private currentRange = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create range graphics (behind the circle for outline)
    this.rangeGraphics = scene.add.graphics();

    // Create range circle (semi-transparent)
    this.rangeCircle = scene.add.circle(0, 0, 0, 0x00ff88, 0.15) as Phaser.GameObjects.Shape;
    this.rangeCircle.setStrokeStyle(1, 0x00ff88, 0.5);
    this.rangeCircle.setVisible(false);

    // Create placement preview rectangle
    this.rect = scene.add.rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE - 4);
    this.rect.setStrokeStyle(2, 0x00ff00);
    this.rect.setFillStyle(0x00ff00, 0.3);
    this.rect.setVisible(false);
  }

  show(x: number, y: number, range: number, isValid: boolean): void {
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);

    const screenX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const screenY = tileY * TILE_SIZE + TILE_SIZE / 2;

    this.currentRange = range;
    this.isValidPlacement = isValid;

    // Update rectangle position
    this.rect.setPosition(screenX, screenY);
    this.rect.setVisible(true);

    // Update range circle - recreate to change radius since Shape doesn't have setRadius
    this.rangeCircle.destroy();
    this.rangeCircle = this.scene.add.circle(screenX, screenY, range, isValid ? 0x00ff88 : 0xff4444, 0.15) as Phaser.GameObjects.Shape;
    this.rangeCircle.setStrokeStyle(1, isValid ? 0x00ff88 : 0xff4444, 0.5);
    this.rangeCircle.setVisible(true);

    // Update colors based on validity
    const color = isValid ? 0x00ff00 : 0xff0000;
    const fillAlpha = isValid ? 0.3 : 0.3;
    const strokeAlpha = isValid ? 1 : 1;

    this.rect.setFillStyle(color, fillAlpha);
    this.rect.setStrokeStyle(2, color, strokeAlpha);

    this.rangeCircle.setFillStyle(isValid ? 0x00ff88 : 0xff4444, 0.15);
    this.rangeCircle.setStrokeStyle(1, isValid ? 0x00ff88 : 0xff4444, 0.5);

    // Redraw range graphics
    this.rangeGraphics.clear();
    if (isValid) {
      // Draw range rings
      this.rangeGraphics.lineStyle(1, 0x00ff88, 0.2);
      for (let r = 50; r < range; r += 50) {
        this.rangeGraphics.strokeCircle(screenX, screenY, r);
      }
    }
  }

  hide(): void {
    this.rect.setVisible(false);
    this.rangeCircle.setVisible(false);
    this.rangeGraphics.clear();
  }

  isVisible(): boolean {
    return this.rect.visible;
  }

  getRange(): number {
    return this.currentRange;
  }

  isValid(): boolean {
    return this.isValidPlacement;
  }

  destroy(): void {
    this.rect.destroy();
    this.rangeCircle.destroy();
    this.rangeGraphics.destroy();
  }
}
