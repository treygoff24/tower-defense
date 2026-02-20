import Phaser from 'phaser';
import { ASSET_MANIFEST } from '../assets/manifest';

export class BootScene extends Phaser.Scene {
  private loadingBar!: Phaser.GameObjects.Graphics;
  private loadingProgress = 0;

  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // Create loading bar background
    const screenCenterX = this.cameras.main.width / 2;
    const screenCenterY = this.cameras.main.height / 2;
    
    // Dark background
    this.cameras.main.setBackgroundColor('#0d0d1a');
    
    // Loading text
    this.add.text(screenCenterX, screenCenterY - 50, 'LOADING...', {
      fontSize: '32px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Loading bar container
    const barWidth = 400;
    const barHeight = 30;
    const barX = screenCenterX - barWidth / 2;
    const barY = screenCenterY;

    // Background bar
    this.add.rectangle(screenCenterX, screenCenterY, barWidth, barHeight, 0x333333).setOrigin(0.5);
    
    // Progress bar (will be updated)
    this.loadingBar = this.add.graphics();
    
    this.loadAssets();
  }

  private loadAssets(): void {
    // Load manifest entries
    for (const entry of ASSET_MANIFEST) {
      if (entry.kind === 'image') {
        this.load.image(entry.key, entry.path);
      } else if (entry.kind === 'placeholder') {
        // Generate placeholder texture
        const width = entry.width ?? 64;
        const height = entry.height ?? 64;
        this.generatePlaceholderTexture(entry.key, entry.color, width, height);
      }
    }

    // When all assets are loaded, start LobbyScene
    this.load.on('complete', () => {
      this.time.delayedCall(300, () => {
        this.scene.start('LobbyScene');
      });
    });

    // Update loading bar during load
    this.load.on('progress', (progress: number) => {
      this.updateLoadingBar(progress);
    });

    this.load.start();
  }

  private generatePlaceholderTexture(key: string, color: number, width: number, height: number): void {
    const graphics = this.make.graphics();
    
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, width, height);
    
    // Add border
    graphics.lineStyle(2, 0xffffff, 0.3);
    graphics.strokeRect(0, 0, width, height);
    
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  private updateLoadingBar(progress: number): void {
    const screenCenterX = this.cameras.main.width / 2;
    const screenCenterY = this.cameras.main.height / 2;
    const barWidth = 400;
    const barHeight = 30;

    this.loadingBar.clear();
    this.loadingBar.fillStyle(0x00ff88, 1);
    this.loadingBar.fillRect(
      screenCenterX - barWidth / 2,
      screenCenterY - barHeight / 2,
      barWidth * progress,
      barHeight
    );
  }
}
