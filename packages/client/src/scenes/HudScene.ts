import Phaser from 'phaser';
import type { GameState, GamePhase } from '@td/shared';

export class HudScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private prepTimerText!: Phaser.GameObjects.Text;

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

    // Top center - Wave
    this.waveText = this.add.text(screenWidth / 2, 20, 'Wave: 1 / 10', {
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

  syncState(state: GameState): void {
    // Update gold
    this.goldText.setText(`Gold: ${state.economy.gold}`);

    // Update wave
    this.waveText.setText(`Wave: ${state.wave} / ${state.maxWaves}`);

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

    // Update phase
    this.updatePhaseDisplay(state.phase);

    // Update prep timer
    if (state.phase === 'prep') {
      this.prepTimerText.setText(`Prep Time: ${Math.ceil(state.prepTimeRemaining)}s`);
      this.prepTimerText.setVisible(true);
    } else {
      this.prepTimerText.setVisible(false);
    }
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
