import Phaser from 'phaser';
import type { EnemyStatus, ElementType } from '@td/shared';

const STATUS_COLORS: Record<string, number> = {
  burning: 0xff4400,
  soaked: 0x0088ff,
  frozen: 0x88ccff,
  cold: 0x88ccff,
  toxin: 0x44cc44,
};

const STATUS_DISPLAY_ORDER = ['burning', 'soaked', 'frozen', 'cold', 'toxin'];

export class StatusIndicator {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private dots: Phaser.GameObjects.Shape[] = [];
  private currentEnemyId: string | null = null;

  private dotSize = 5;
  private dotSpacing = 3;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(51); // Above health bars

    this.container.setVisible(false);
  }

  showForEnemy(enemyId: string, x: number, y: number, statuses: EnemyStatus[]): void {
    this.currentEnemyId = enemyId;

    // Clear existing dots
    this.clearDots();

    if (statuses.length === 0) {
      this.container.setVisible(false);
      return;
    }

    // Position above enemy
    this.container.setPosition(x, y - 25);
    this.container.setVisible(true);

    // Sort statuses for consistent display
    const sortedStatuses = [...statuses].sort((a, b) => {
      const aIndex = STATUS_DISPLAY_ORDER.indexOf(a.type);
      const bIndex = STATUS_DISPLAY_ORDER.indexOf(b.type);
      return aIndex - bIndex;
    });

    // Create dots for each status
    let xOffset = -(sortedStatuses.length - 1) * (this.dotSize + this.dotSpacing) / 2;

    for (const status of sortedStatuses) {
      const color = STATUS_COLORS[status.type] || 0xffffff;

      const dot = this.scene.add.circle(xOffset, 0, this.dotSize, color) as Phaser.GameObjects.Shape;
      dot.setStrokeStyle(1, 0x000000, 0.5);

      // Add glow effect for higher stacks
      if (status.stacks > 1) {
        dot.setAlpha(0.7 + Math.min(status.stacks * 0.1, 0.3));
      }

      this.dots.push(dot);
      this.container.add(dot);

      xOffset += this.dotSize + this.dotSpacing;
    }
  }

  updatePosition(x: number, y: number): void {
    this.container.setPosition(x, y - 25);
  }

  private clearDots(): void {
    for (const dot of this.dots) {
      dot.destroy();
    }
    this.dots = [];
  }

  hide(): void {
    this.clearDots();
    this.container.setVisible(false);
    this.currentEnemyId = null;
  }

  getCurrentEnemyId(): string | null {
    return this.currentEnemyId;
  }

  destroy(): void {
    this.clearDots();
    this.container.destroy();
  }
}
