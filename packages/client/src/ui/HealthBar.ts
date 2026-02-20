import Phaser from 'phaser';

export class HealthBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private backgroundBar!: Phaser.GameObjects.Rectangle;
  private healthBar!: Phaser.GameObjects.Rectangle;
  private currentEnemyId: string | null = null;

  private barWidth = 40;
  private barHeight = 6;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(50); // Above enemies

    this.createBar();
  }

  private createBar(): void {
    // Background (dark)
    this.backgroundBar = this.scene.add.rectangle(
      0,
      -20,
      this.barWidth,
      this.barHeight,
      0x000000
    );
    this.container.add(this.backgroundBar);

    // Health bar (will be colored based on HP%)
    this.healthBar = this.scene.add.rectangle(
      -this.barWidth / 2,
      -20,
      this.barWidth,
      this.barHeight,
      0x00ff00
    );
    this.healthBar.setOrigin(0, 0.5);
    this.container.add(this.healthBar);

    this.container.setVisible(false);
  }

  showForEnemy(enemyId: string, x: number, y: number, hp: number, maxHp: number): void {
    this.currentEnemyId = enemyId;

    // Update position (slightly above enemy)
    this.container.setPosition(x, y - 15);
    this.container.setVisible(true);

    // Calculate HP percentage
    const hpPercent = hp / maxHp;

    // Update health bar width and color
    this.healthBar.width = this.barWidth * hpPercent;

    // Update color based on HP%
    if (hpPercent > 0.6) {
      this.healthBar.setFillStyle(0x00ff00); // Green
    } else if (hpPercent > 0.3) {
      this.healthBar.setFillStyle(0xffff00); // Yellow
    } else {
      this.healthBar.setFillStyle(0xff0000); // Red
    }
  }

  updatePosition(x: number, y: number): void {
    this.container.setPosition(x, y - 15);
  }

  hide(): void {
    this.container.setVisible(false);
    this.currentEnemyId = null;
  }

  getCurrentEnemyId(): string | null {
    return this.currentEnemyId;
  }

  destroy(): void {
    this.container.destroy();
  }
}
