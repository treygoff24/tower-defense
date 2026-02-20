import Phaser from 'phaser';
import type { GameState, GamePhase, ElementType } from '@td/shared';
import { GameClient } from '../GameClient';

const ELEMENT_COLORS: Record<ElementType, number> = {
  fire: 0xff4400,
  water: 0x0088ff,
  ice: 0x88ccff,
  poison: 0x44cc44,
};

const ELEMENT_NAMES: Record<ElementType, string> = {
  fire: 'Pyromancer',
  water: 'Hydromancer',
  ice: 'Cryomancer',
  poison: 'Necromancer',
};

export class HudScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private prepTimerText!: Phaser.GameObjects.Text;
  private startWaveButton!: Phaser.GameObjects.Container;
  private classIcon!: Phaser.GameObjects.Container;
  private playerElement: ElementType | null = null;

  constructor() {
    super({ key: 'HudScene' });
  }

  create(): void {
    // Transparent background for overlay

    // Create HUD elements
    this.createHudElements();
  }

  private createHudElements(): void {
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // Top left - Gold
    this.goldText = this.add.text(20, 20, 'Gold: 0', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.goldText.setScrollFactor(0);
    this.goldText.setDepth(100);

    // Top center - Wave progress
    this.waveText = this.add.text(screenWidth / 2, 20, 'Wave: 0 / 20', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.waveText.setOrigin(0.5, 0);
    this.waveText.setScrollFactor(0);
    this.waveText.setDepth(100);

    // Top right - HP
    this.hpText = this.add.text(screenWidth - 20, 20, 'Base HP: 100', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.hpText.setOrigin(1, 0);
    this.hpText.setScrollFactor(0);
    this.hpText.setDepth(100);

    // Player class icon (bottom left)
    this.classIcon = this.createClassIcon(60, screenHeight - 60);
    this.classIcon.setScrollFactor(0);
    this.classIcon.setDepth(100);
    this.classIcon.setVisible(true); // Visible by default, will update when we get player class

    // Start Wave button (center bottom) - only visible during prep
    this.startWaveButton = this.createStartWaveButton(screenWidth / 2, screenHeight - 80);
    this.startWaveButton.setScrollFactor(0);
    this.startWaveButton.setDepth(100);
    this.startWaveButton.setVisible(false);

    // Center - Phase name (for transitions)
    this.phaseText = this.add.text(screenWidth / 2, 80, '', {
      fontSize: '32px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#00ff88',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.phaseText.setOrigin(0.5, 0);
    this.phaseText.setScrollFactor(0);
    this.phaseText.setDepth(100);
    this.phaseText.setVisible(false);

    // Prep timer
    this.prepTimerText = this.add.text(screenWidth / 2, 50, '', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#88ffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.prepTimerText.setOrigin(0.5, 0);
    this.prepTimerText.setScrollFactor(0);
    this.prepTimerText.setDepth(100);
    this.prepTimerText.setVisible(false);
  }

  private createClassIcon(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Background circle
    const bg = this.add.circle(0, 0, 30, 0x333333);
    bg.setStrokeStyle(3, 0xffffff);

    // Element icon (inner circle)
    const icon = this.add.circle(0, 0, 20, 0xffffff);

    // Class name text below
    const nameText = this.add.text(0, 40, '', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, icon, nameText]);

    // Store references for updating (using any to avoid Phaser type issues)
    (container as unknown as { bgCircle: unknown }).bgCircle = bg;
    (container as unknown as { iconCircle: unknown }).iconCircle = icon;
    (container as unknown as { nameTextObj: unknown }).nameTextObj = nameText;

    return container;
  }

  private createStartWaveButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const buttonWidth = 180;
    const buttonHeight = 50;

    // Button background
    const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x00aa66);
    bg.setStrokeStyle(2, 0x00ff88);

    // Button text
    const text = this.add.text(0, 0, 'START WAVE', {
      fontSize: '22px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, text]);

    // Button interactivity
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      bg.setFillStyle(0x00cc77);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x00aa66);
    });

    bg.on('pointerup', () => {
      bg.setFillStyle(0x00aa66);
      this.handleStartWave();
    });

    (container as unknown as { background: Phaser.GameObjects.Rectangle }).background = bg;

    return container;
  }

  private handleStartWave(): void {
    const gameClient = this.registry.get('gameClient') as GameClient;
    if (gameClient) {
      gameClient.startWave();
    }
  }

  syncState(state: GameState): void {
    // Update gold
    this.goldText.setText(`Gold: ${state.economy.gold}`);

    // Update wave progress indicator
    const waveDisplay = state.wave === 0 ? 'Wave: Start' : `Wave: ${state.wave} / ${state.maxWaves}`;
    this.waveText.setText(waveDisplay);

    // Update HP
    const hpPercent = state.baseHp / state.maxBaseHp;
    if (hpPercent > 0.6) {
      this.hpText.setColor('#44ff44');
    } else if (hpPercent > 0.3) {
      this.hpText.setColor('#ffff44');
    } else {
      this.hpText.setColor('#ff4444');
    }
    this.hpText.setText(`Base HP: ${state.baseHp} / ${state.maxBaseHp}`);

    // Update player class icon from game state
    this.updatePlayerClass(state);

    // Update phase
    this.updatePhaseDisplay(state.phase);

    // Show/hide Start Wave button during prep phase
    if (state.phase === 'prep') {
      this.prepTimerText.setText(`Prep Time: ${Math.ceil(state.prepTimeRemaining)}s`);
      this.prepTimerText.setVisible(true);
      this.startWaveButton.setVisible(true);
    } else {
      this.prepTimerText.setVisible(false);
      this.startWaveButton.setVisible(false);
    }

    // Handle victory/defeat overlay
    if (state.phase === 'victory' || state.phase === 'defeat') {
      this.showGameOverOverlay(state.phase);
    }
  }

  private updatePlayerClass(state: GameState): void {
    // Find the local player's element class from game state
    // For now, get first connected player
    const players = Object.values(state.players);
    const localPlayer = players.find((p) => p.connected);

    if (localPlayer?.elementClass && localPlayer.elementClass !== this.playerElement) {
      this.playerElement = localPlayer.elementClass;
      const color = ELEMENT_COLORS[this.playerElement];
      const name = ELEMENT_NAMES[this.playerElement];

      // Update class icon
      const icon = (this.classIcon as unknown as { iconCircle: unknown }).iconCircle as unknown as { setFillStyle(color: number): void };
      const nameTextObj = (this.classIcon as unknown as { nameTextObj: unknown }).nameTextObj as unknown as { setText(text: string): void };
      const bgCircle = (this.classIcon as unknown as { bgCircle: unknown }).bgCircle as unknown as { setStrokeStyle(width: number, color: number): void };

      icon.setFillStyle(color);
      bgCircle.setStrokeStyle(3, color);
      nameTextObj.setText(name);
      this.classIcon.setVisible(true);
    }
  }

  private showGameOverOverlay(phase: 'victory' | 'defeat'): void {
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // Semi-transparent overlay
    const overlay = this.add.rectangle(
      screenWidth / 2,
      screenHeight / 2,
      screenWidth,
      screenHeight,
      0x000000,
      0.7
    );
    overlay.setScrollFactor(0);
    overlay.setDepth(200);

    // Game over text
    const isVictory = phase === 'victory';
    const resultText = this.add.text(
      screenWidth / 2,
      screenHeight / 2 - 50,
      isVictory ? 'VICTORY!' : 'DEFEAT',
      {
        fontSize: '64px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        color: isVictory ? '#ffd700' : '#ff0000',
        stroke: '#000000',
        strokeThickness: 6,
      }
    );
    resultText.setOrigin(0.5);
    resultText.setScrollFactor(0);
    resultText.setDepth(201);

    // Restart hint
    this.add.text(
      screenWidth / 2,
      screenHeight / 2 + 30,
      'Refresh to play again',
      {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#aaaaaa',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(201);
  }

  private updatePhaseDisplay(phase: GamePhase): void {
    let displayText = '';
    let color = '#ffffff';

    switch (phase) {
      case 'lobby':
        displayText = 'LOBBY';
        color = '#888888';
        break;
      case 'class_select':
        displayText = 'CLASS SELECT';
        color = '#8888ff';
        break;
      case 'prep':
        displayText = 'PREP PHASE';
        color = '#88ffff';
        break;
      case 'combat':
        displayText = 'COMBAT';
        color = '#ff4444';
        break;
      case 'post_wave':
        displayText = 'WAVE COMPLETE';
        color = '#88ff88';
        break;
      case 'victory':
        displayText = 'VICTORY!';
        color = '#ffd700';
        break;
      case 'defeat':
        displayText = 'DEFEAT';
        color = '#ff0000';
        break;
    }

    if (displayText) {
      this.phaseText.setText(displayText);
      this.phaseText.setColor(color);
      this.phaseText.setVisible(true);

      // Fade out after a few seconds (unless combat)
      if (phase !== 'combat' && phase !== 'prep') {
        this.tweens.add({
          targets: this.phaseText,
          alpha: 0,
          duration: 2000,
          delay: 2000,
          onComplete: () => {
            this.phaseText.setVisible(false);
            this.phaseText.setAlpha(1);
          },
        });
      }
    }
  }

  // Show damage indicator on base
  showBaseDamage(damage: number): void {
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    const damageText = this.add.text(
      screenWidth - 20,
      60,
      `-${damage}`,
      {
        fontSize: '28px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        color: '#ff0000',
        stroke: '#000000',
        strokeThickness: 3,
      }
    );
    damageText.setOrigin(1, 0);
    damageText.setScrollFactor(0);
    damageText.setDepth(100);

    this.tweens.add({
      targets: damageText,
      y: 20,
      alpha: 0,
      duration: 1000,
      onComplete: () => {
        damageText.destroy();
      },
    });
  }
}
