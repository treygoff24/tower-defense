import Phaser from 'phaser';
import type { ElementType, GameState } from '@td/shared';
import { GameClient } from '../GameClient';

interface ClassCardData {
  element: ElementType;
  name: string;
  description: string;
  color: number;
}

const CLASS_CARDS: ClassCardData[] = [
  {
    element: 'fire',
    name: 'Pyromancer',
    description: 'Deal massive fire damage. Hosts burning enemies take bonus damage from water.',
    color: 0xff4400,
  },
  {
    element: 'water',
    name: 'Hydromancer',
    description: 'Apply soaked status. Soaked enemies take extra damage and enable steam reactions.',
    color: 0x0088ff,
  },
  {
    element: 'ice',
    name: 'Cryomancer',
    description: 'Freeze and slow enemies. Frozen enemies are vulnerable to fire damage.',
    color: 0x88ccff,
  },
  {
    element: 'poison',
    name: 'Necromancer',
    description: 'Apply toxin damage over time. Blight spreads between nearby enemies.',
    color: 0x44cc44,
  },
];

export class ClassSelectScene extends Phaser.Scene {
  private selectedClass: ElementType | null = null;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private readyButton!: Phaser.GameObjects.Container;
  private readyText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'ClassSelectScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d0d1a');

    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // Title
    this.add.text(screenWidth / 2, 50, 'CHOOSE YOUR ELEMENT', {
      fontSize: '36px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(screenWidth / 2, 90, 'Select a class to enhance your towers', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#888888',
    }).setOrigin(0.5);

    // Create class cards
    const cardWidth = 220;
    const cardHeight = 320;
    const spacing = 40;
    const totalWidth = CLASS_CARDS.length * cardWidth + (CLASS_CARDS.length - 1) * spacing;
    const startX = (screenWidth - totalWidth) / 2 + cardWidth / 2;
    const cardY = screenHeight / 2;

    CLASS_CARDS.forEach((classData, index) => {
      const cardX = startX + index * (cardWidth + spacing);
      const cardContainer = this.createClassCard(classData, cardX, cardY, cardWidth, cardHeight);
      this.cardContainers.push(cardContainer);
    });

    // Ready button (initially disabled)
    this.readyButton = this.createReadyButton(screenWidth / 2, screenHeight - 80);
  }

  private createClassCard(
    classData: ClassCardData,
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Card background
    const bg = this.add.rectangle(0, 0, width, height, 0x222233);
    bg.setStrokeStyle(3, classData.color);
    bg.setInteractive({ useHandCursor: true });

    // Element icon (circle with color)
    const iconRadius = 50;
    const icon = this.add.circle(0, -height / 2 + 70, iconRadius, classData.color);

    // Class name
    const name = this.add.text(0, -height / 2 + 140, classData.name, {
      fontSize: '24px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Element name
    const elementName = this.add.text(0, -height / 2 + 170, classData.element.toUpperCase(), {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#888888',
    }).setOrigin(0.5);

    // Description (word wrap)
    const description = this.add.text(0, 20, classData.description, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaaaaa',
      wordWrap: { width: width - 30 },
    }).setOrigin(0.5, 0);

    container.add([bg, icon, name, elementName, description]);

    // Selection state visuals
    const selectedOverlay = this.add.rectangle(0, 0, width, height, classData.color, 0.2) as Phaser.GameObjects.Rectangle;
    selectedOverlay.setVisible(false);
    container.add(selectedOverlay);

    // Interactivity
    bg.on('pointerover', () => {
      if (this.selectedClass !== classData.element) {
        bg.setFillStyle(0x333344);
      }
    });

    bg.on('pointerout', () => {
      if (this.selectedClass !== classData.element) {
        bg.setFillStyle(0x222233);
      }
    });

    bg.on('pointerdown', () => {
      this.selectClass(classData.element, container, selectedOverlay, bg);
    });

    // Store reference for updating
    (container as unknown as { backgroundRect: Phaser.GameObjects.Rectangle }).backgroundRect = bg;
    (container as unknown as { selectedOverlay: Phaser.GameObjects.Rectangle }).selectedOverlay = selectedOverlay;
    (container as unknown as { classData: ClassCardData }).classData = classData;

    return container;
  }

  private selectClass(
    element: ElementType,
    container: Phaser.GameObjects.Container,
    selectedOverlay: Phaser.GameObjects.Rectangle,
    bg: Phaser.GameObjects.Rectangle
  ): void {
    // Deselect all cards
    this.cardContainers.forEach((card) => {
      const overlay = (card as unknown as { selectedOverlay: Phaser.GameObjects.Rectangle }).selectedOverlay;
      const background = (card as unknown as { backgroundRect: Phaser.GameObjects.Rectangle }).backgroundRect;
      overlay.setVisible(false);
      background.setFillStyle(0x222233);
    });

    // Select this card
    this.selectedClass = element;
    selectedOverlay.setVisible(true);
    bg.setFillStyle(0x333355);

    // Enable ready button
    this.readyText.setText('READY');
    (this.readyButton as unknown as { background: Phaser.GameObjects.Rectangle }).background.setAlpha(1);
    (this.readyButton as unknown as { background: Phaser.GameObjects.Rectangle }).background.setInteractive({ useHandCursor: true });
  }

  private createReadyButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const buttonWidth = 160;
    const buttonHeight = 50;

    // Button background (initially disabled)
    const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x444444);
    (container as unknown as { background: Phaser.GameObjects.Rectangle }).background = bg;

    // Button text
    this.readyText = this.add.text(0, 0, 'SELECT CLASS', {
      fontSize: '20px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#888888',
    }).setOrigin(0.5);

    container.add([bg, this.readyText]);

    // Make not interactive initially
    bg.setInteractive({ useHandCursor: false });

    bg.on('pointerover', () => {
      if (this.selectedClass) {
        bg.setFillStyle(0x00aa77);
      }
    });

    bg.on('pointerout', () => {
      if (this.selectedClass) {
        bg.setFillStyle(0x008855);
      }
    });

    bg.on('pointerup', () => {
      if (this.selectedClass) {
        this.emitReadyUp();
      }
    });

    return container;
  }

  private emitReadyUp(): void {
    if (!this.selectedClass) return;

    // Get GameClient from registry
    const gameClient = this.registry.get('gameClient') as GameClient;

    if (gameClient) {
      // Select class and ready up
      gameClient.selectClass(this.selectedClass);
      gameClient.readyUp();
    }

    // Listen for game state changes to transition to GameScene
    this.checkGameStart();
  }

  private checkGameStart(): void {
    const gameClient = this.registry.get('gameClient') as GameClient;
    if (!gameClient) {
      // For demo, transition after a delay if no client
      this.time.delayedCall(1000, () => {
        this.scene.start('GameScene');
      });
      return;
    }

    // Poll for game state changes
    const checkInterval = this.time.addEvent({
      delay: 500,
      callback: () => {
        const state = gameClient.getLatestState();
        if (state && (state.phase === 'prep' || state.phase === 'combat')) {
          checkInterval.remove();
          this.scene.start('GameScene');
        }
      },
      loop: true,
    });
  }
}
