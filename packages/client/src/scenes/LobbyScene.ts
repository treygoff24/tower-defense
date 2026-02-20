import Phaser from 'phaser';

export class LobbyScene extends Phaser.Scene {
  private joinEventEmitter: Phaser.Events.EventEmitter | null = null;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d0d1a');
    
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // Title
    this.add.text(screenWidth / 2, screenHeight * 0.3, 'TOWER DEFENSE', {
      fontSize: '72px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#00ff88',
      stroke: '#004422',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(screenWidth / 2, screenHeight * 0.4, 'Elemental Warfare', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#88aaaa',
    }).setOrigin(0.5);

    // Join button
    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonX = screenWidth / 2;
    const buttonY = screenHeight * 0.6;

    const button = this.add.container(buttonX, buttonY);

    // Button background
    const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x00aa66);
    bg.setStrokeStyle(2, 0x00ff88);

    // Button text
    const text = this.add.text(0, 0, 'JOIN GAME', {
      fontSize: '28px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    button.add([bg, text]);

    // Button interactivity
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      bg.setFillStyle(0x00cc77);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x00aa66);
    });

    bg.on('pointerdown', () => {
      bg.setFillStyle(0x008855);
    });

    bg.on('pointerup', () => {
      bg.setFillStyle(0x00aa66);
      this.emitJoinRequest();
    });

    // Version text
    this.add.text(screenWidth / 2, screenHeight - 30, 'v0.1.0', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#666666',
    }).setOrigin(0.5);
  }

  private emitJoinRequest(): void {
    this.events.emit('join-requested');
    this.scene.start('ClassSelectScene');
  }
}
