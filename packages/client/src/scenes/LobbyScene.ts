import Phaser from 'phaser';
import { GameClient } from '../GameClient';

export class LobbyScene extends Phaser.Scene {
  private joinEventEmitter: Phaser.Events.EventEmitter | null = null;
  private playerName: string = 'Player';

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d0d1a');

    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // Title
    this.add.text(screenWidth / 2, screenHeight * 0.25, 'TOWER DEFENSE', {
      fontSize: '72px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#00ff88',
      stroke: '#004422',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(screenWidth / 2, screenHeight * 0.32, 'Elemental Warfare', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#88aaaa',
    }).setOrigin(0.5);

    // Name input label
    this.add.text(screenWidth / 2, screenHeight * 0.42, 'Enter Your Name', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Create name input text field (using Phaser text input simulation)
    const inputBg = this.add.rectangle(screenWidth / 2, screenHeight * 0.48, 220, 45, 0x222233);
    inputBg.setStrokeStyle(2, 0x00aa66);

    const nameText = this.add.text(screenWidth / 2, screenHeight * 0.48, 'Player', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Make it interactive for editing
    inputBg.setInteractive({ useHandCursor: true });

    let isEditing = false;

    inputBg.on('pointerdown', () => {
      isEditing = true;
      // Use browser prompt for name entry
      const entered = prompt('Enter your name:', this.playerName);
      if (entered && entered.trim()) {
        this.playerName = entered.trim();
        nameText.setText(this.playerName);
      }
      isEditing = false;
    });

    inputBg.on('pointerover', () => {
      if (!isEditing) {
        inputBg.setStrokeStyle(2, 0x00ff88);
      }
    });

    inputBg.on('pointerout', () => {
      if (!isEditing) {
        inputBg.setStrokeStyle(2, 0x00aa66);
      }
    });

    // Join button
    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonX = screenWidth / 2;
    const buttonY = screenHeight * 0.65;

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
      this.handleJoinRequest();
    });

    // Version text
    this.add.text(screenWidth / 2, screenHeight - 30, 'v0.1.0', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#666666',
    }).setOrigin(0.5);
  }

  private async handleJoinRequest(): Promise<void> {
    // Player name is already set (via prompt in create or default)
    const playerName = this.playerName;

    // Get GameClient from registry
    const gameClient = this.registry.get('gameClient') as GameClient;

    if (gameClient) {
      try {
        // Connect to server
        await gameClient.connect(playerName);
        console.log('Connected to server as:', playerName);

        // Transition to class selection
        this.scene.start('ClassSelectScene');
      } catch (err) {
        console.error('Failed to connect:', err);
        // For demo purposes, still allow progression if server not available
        this.scene.start('ClassSelectScene');
      }
    } else {
      // GameClient not found, still allow progression for demo
      console.warn('GameClient not found in registry');
      this.scene.start('ClassSelectScene');
    }
  }
}
