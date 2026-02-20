import Phaser from 'phaser';
import type { GameState, GamePhase, ElementType } from '@td/shared';
import { TOWER_CONFIGS } from '@td/shared';
import { GameClient } from '../GameClient';
import { TowerPanel } from '../ui/TowerPanel';

const ELEMENT_COLORS: Record<ElementType, number> = {
  fire:   0xff4400,
  water:  0x0088ff,
  ice:    0x88ccff,
  poison: 0x44cc44,
};

const ELEMENT_NAMES: Record<ElementType, string> = {
  fire:   'Pyromancer 🔥',
  water:  'Hydromancer 💧',
  ice:    'Cryomancer ❄',
  poison: 'Necromancer ☠',
};

const ELEMENT_ICONS: Record<ElementType, string> = {
  fire:   '🔥',
  water:  '💧',
  ice:    '❄',
  poison: '☠',
};

export class HudScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private hpBarBase!: Phaser.GameObjects.Image | null;
  private hpBarFillImg?: Phaser.GameObjects.Image;
  private phaseText!: Phaser.GameObjects.Text;
  private prepTimerText!: Phaser.GameObjects.Text;
  private startWaveButton!: Phaser.GameObjects.Container;
  private classIcon!: Phaser.GameObjects.Container;
  private playerElement: ElementType | null = null;
  private prevBaseHp = -1;
  private enemyCountText!: Phaser.GameObjects.Text;
  private towerPanel: TowerPanel | null = null;
  private hudGold = 0;

  constructor() {
    super({ key: 'HudScene' });
  }

  create(): void {
    this.createHudElements();
  }

  private createHudElements(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── Gold panel (top-left) ──────────────────────────────────────
    this.createPanel(14, 14, 160, 38);
    this.add.text(22, 20, '💰', { fontSize: '20px' }).setScrollFactor(0).setDepth(101);
    this.goldText = this.add.text(50, 21, 'Gold: 0', {
      fontSize: '20px',
      fontFamily: '"Arial Black", Arial',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(101);

    // ── Wave + enemy count (top-center) ───────────────────────────
    this.createPanel(W / 2 - 110, 14, 220, 38);
    this.waveText = this.add.text(W / 2, 22, 'Wave 0 / 20', {
      fontSize: '18px',
      fontFamily: '"Arial Black", Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);

    // ── Base HP (top-right) ────────────────────────────────────────
    const hpPanelW = 210;
    this.createPanel(W - hpPanelW - 14, 14, hpPanelW, 38);
    this.add.text(W - hpPanelW - 4, 20, '🏰', { fontSize: '20px' }).setScrollFactor(0).setDepth(101);
    this.hpText = this.add.text(W - hpPanelW + 22, 21, 'Base HP: 100', {
      fontSize: '17px',
      fontFamily: 'Arial',
      color: '#44ff44',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(101);

    // HP bar (just below top bar)
    this.hpBarFill = this.add.graphics().setScrollFactor(0).setDepth(101);

    // Tiny Swords bar sprites (if available) — override Graphics fallback
    if (this.textures.exists('ui_big_bar_base')) {
      this.hpBarFill.setVisible(false);
      const barLeft = W - hpPanelW - 14;
      this.hpBarBase = this.add.image(barLeft, 54, 'ui_big_bar_base')
        .setOrigin(0, 0.5).setDisplaySize(hpPanelW, 16).setScrollFactor(0).setDepth(101);
      this.hpBarFillImg = this.add.image(barLeft, 54, 'ui_big_bar_fill')
        .setOrigin(0, 0.5).setDisplaySize(hpPanelW, 16).setScrollFactor(0).setDepth(101);
    }

    // ── Enemy count (below wave text) ─────────────────────────────
    this.enemyCountText = this.add.text(W / 2, 52, '', {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: '#ff9966',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);

    // ── Class icon (bottom-left) ───────────────────────────────────
    this.classIcon = this.createClassIcon(70, H - 70);
    this.classIcon.setScrollFactor(0).setDepth(101);

    // ── Start Wave button (center-bottom) ─────────────────────────
    this.startWaveButton = this.createStartWaveButton(W / 2, H - 60);
    this.startWaveButton.setScrollFactor(0).setDepth(101);
    this.startWaveButton.setVisible(false);

    // ── Phase announcement (center) ───────────────────────────────
    this.phaseText = this.add.text(W / 2, 90, '', {
      fontSize: '38px',
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#00ff88',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);

    // ── Prep timer ────────────────────────────────────────────────
    this.prepTimerText = this.add.text(W / 2, 56, '', {
      fontSize: '15px',
      fontFamily: 'Arial',
      color: '#88ffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101).setVisible(false);
  }

  // ─────────────────────────────────────────────────────────────────
  // Panel helper
  // ─────────────────────────────────────────────────────────────────

  private createPanel(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(0x0a0a20, 0.82);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1, 0x6666aa, 0.9);
    g.strokeRoundedRect(x, y, w, h, 8);
    g.setScrollFactor(0).setDepth(100);
    return g;
  }

  // ─────────────────────────────────────────────────────────────────
  // Class icon
  // ─────────────────────────────────────────────────────────────────

  private createClassIcon(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a20, 0.85);
    bg.fillCircle(0, 0, 36);
    bg.lineStyle(3, 0x6666aa, 1);
    bg.strokeCircle(0, 0, 36);

    const icon = this.add.text(0, -4, '⚔', {
      fontSize: '28px',
    }).setOrigin(0.5);

    const nameText = this.add.text(0, 44, 'Towers', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    container.add([bg, icon, nameText]);
    (container as unknown as { bgGfx: Phaser.GameObjects.Graphics }).bgGfx = bg;
    (container as unknown as { iconText: Phaser.GameObjects.Text }).iconText = icon;
    (container as unknown as { nameTextObj: Phaser.GameObjects.Text }).nameTextObj = nameText;

    return container;
  }

  // ─────────────────────────────────────────────────────────────────
  // Start Wave button
  // ─────────────────────────────────────────────────────────────────

  private createStartWaveButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Try to use Tiny Swords button if available, else draw our own
    const hasTsBtn = this.textures.exists('ui_btn_blue_regular');

    let bg: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
    if (hasTsBtn) {
      const img = this.add.image(0, 0, 'ui_btn_blue_regular');
      img.setScale(0.65);
      bg = img;
      bg.setInteractive({ useHandCursor: true });

      bg.on('pointerover', () => { (bg as Phaser.GameObjects.Image).setTexture('ui_btn_blue_pressed'); });
      bg.on('pointerout',  () => { (bg as Phaser.GameObjects.Image).setTexture('ui_btn_blue_regular'); });
      bg.on('pointerdown', () => { (bg as Phaser.GameObjects.Image).setTexture('ui_btn_blue_pressed'); });
      bg.on('pointerup',   () => {
        (bg as Phaser.GameObjects.Image).setTexture('ui_btn_blue_regular');
        this.handleStartWave();
      });
    } else {
      const gfx = this.add.graphics();
      gfx.fillStyle(0x0055cc, 1);
      gfx.fillRoundedRect(-90, -24, 180, 48, 10);
      gfx.lineStyle(2, 0x4488ff, 1);
      gfx.strokeRoundedRect(-90, -24, 180, 48, 10);
      bg = gfx;
      const hitArea = this.add.rectangle(0, 0, 180, 48, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on('pointerover', () => { gfx.clear(); gfx.fillStyle(0x0077ee, 1); gfx.fillRoundedRect(-90, -24, 180, 48, 10); });
      hitArea.on('pointerout', () => { gfx.clear(); gfx.fillStyle(0x0055cc, 1); gfx.fillRoundedRect(-90, -24, 180, 48, 10); gfx.lineStyle(2, 0x4488ff, 1); gfx.strokeRoundedRect(-90, -24, 180, 48, 10); });
      hitArea.on('pointerup', () => { this.handleStartWave(); });
      container.add(hitArea);
    }

    const label = this.add.text(0, 0, '⚔  START WAVE', {
      fontSize: '20px',
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#002244',
      strokeThickness: 3,
    }).setOrigin(0.5);

    container.add([bg, label]);
    (container as unknown as { label: Phaser.GameObjects.Text }).label = label;

    return container;
  }

  private handleStartWave(): void {
    const gameClient = this.registry.get('gameClient') as GameClient;
    if (gameClient) {
      gameClient.startWave();
      // Pulse animation
      this.tweens.add({
        targets: this.startWaveButton,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 100,
        yoyo: true,
        ease: 'Power2',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // State sync
  // ─────────────────────────────────────────────────────────────────

  syncState(state: GameState): void {
    // Gold — pulse on change
    const newGold = state.economy.gold;
    this.hudGold = newGold;
    if (this.goldText.text !== `Gold: ${newGold}`) {
      this.goldText.setText(`Gold: ${newGold}`);
      this.tweens.add({ targets: this.goldText, scaleX: 1.2, scaleY: 1.2, yoyo: true, duration: 150 });
    }
    this.towerPanel?.setGold(newGold);

    // Wave
    this.waveText.setText(state.wave === 0 ? 'Wave: Ready' : `Wave ${state.wave} / ${state.maxWaves}`);

    // Enemy count
    const alive = Object.values(state.enemies).filter((e) => e.alive).length;
    this.enemyCountText.setText(alive > 0 ? `👾 ${alive} enemies` : '');

    // HP
    const hpRatio = state.baseHp / state.maxBaseHp;
    const hpColor = hpRatio > 0.6 ? '#44ff44' : hpRatio > 0.3 ? '#ffee22' : '#ff3333';
    this.hpText.setColor(hpColor);
    this.hpText.setText(`🏰 ${state.baseHp} / ${state.maxBaseHp}`);

    // HP bar
    const W = this.cameras.main.width;
    const panelW = 210;
    const fillColor = hpRatio > 0.6 ? 0x44ff44 : hpRatio > 0.3 ? 0xffee22 : 0xff3333;
    if (this.hpBarFillImg) {
      // Tiny Swords sprite bar — scale fill width proportionally from left
      this.hpBarFillImg.setDisplaySize(Math.max(panelW * hpRatio, 2), 16);
      this.hpBarFillImg.setTint(fillColor);
    } else {
      this.hpBarFill.clear();
      this.hpBarFill.fillStyle(0x000000, 0.5);
      this.hpBarFill.fillRect(W - panelW - 14, 52, panelW, 6);
      this.hpBarFill.fillStyle(fillColor, 1);
      this.hpBarFill.fillRect(W - panelW - 14, 52, panelW * hpRatio, 6);
    }

    // Base damage shake
    if (this.prevBaseHp !== -1 && state.baseHp < this.prevBaseHp) {
      this.showDamageIndicator(state.baseHp, this.prevBaseHp);
    }
    this.prevBaseHp = state.baseHp;

    this.updatePlayerClass(state);
    this.updatePhaseDisplay(state.phase);

    // Start wave button visibility
    if (state.phase === 'prep') {
      this.prepTimerText.setText(`⏱ Prep: ${Math.ceil(state.prepTimeRemaining)}s`);
      this.prepTimerText.setVisible(true);
      this.startWaveButton.setVisible(true);
    } else {
      this.prepTimerText.setVisible(false);
      this.startWaveButton.setVisible(false);
    }

    if (state.phase === 'victory' || state.phase === 'defeat') {
      this.showGameOverOverlay(state.phase);
    }
  }

  private showDamageIndicator(currentHp: number, prevHp: number): void {
    const dmg = prevHp - currentHp;
    const W = this.cameras.main.width;
    const dmgText = this.add.text(W - 30, 65, `-${dmg}`, {
      fontSize: '26px',
      fontFamily: '"Arial Black", Arial',
      color: '#ff3333',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(103);

    this.tweens.add({
      targets: dmgText,
      y: 30,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => { dmgText.destroy(); },
    });
  }

  private updatePlayerClass(state: GameState): void {
    const players = Object.values(state.players);
    const localPlayer = players.find((p) => p.connected);

    if (localPlayer?.elementClass && localPlayer.elementClass !== this.playerElement) {
      this.playerElement = localPlayer.elementClass;
      const color = ELEMENT_COLORS[this.playerElement];
      const name = ELEMENT_NAMES[this.playerElement];
      const icon = ELEMENT_ICONS[this.playerElement];

      const bg = (this.classIcon as unknown as { bgGfx: Phaser.GameObjects.Graphics }).bgGfx;
      const iconText = (this.classIcon as unknown as { iconText: Phaser.GameObjects.Text }).iconText;
      const nameText = (this.classIcon as unknown as { nameTextObj: Phaser.GameObjects.Text }).nameTextObj;

      bg.clear();
      bg.fillStyle(0x0a0a20, 0.85);
      bg.fillCircle(0, 0, 36);
      bg.lineStyle(3, color, 1);
      bg.strokeCircle(0, 0, 36);

      iconText.setText(icon);
      nameText.setText(name);
      nameText.setColor('#' + color.toString(16).padStart(6, '0'));

      // Spin animation on class select
      this.tweens.add({
        targets: this.classIcon,
        angle: 360,
        duration: 500,
        ease: 'Power2.Out',
      });

      // ── Show tower panel for this class ──────────────────────
      this.showTowerPanelForClass(this.playerElement);
    }
  }

  private showTowerPanelForClass(elementClass: ElementType): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Destroy existing panel before creating new one
    this.towerPanel?.destroy();
    this.towerPanel = null;

    // Filter towers to player's element + shared towers
    const allTowers = Object.values(TOWER_CONFIGS);
    const classTowers = allTowers.filter(
      (t) => t.class === elementClass || t.class === 'shared'
    );

    if (classTowers.length === 0) return;

    // Position: right sidebar, vertically centered
    const panelX = W - 95;  // 180px wide panel, centered 95px from right
    const panelY = H / 2;
    this.towerPanel = new TowerPanel(this, panelX, panelY);
    this.towerPanel.getContainer().setScrollFactor(0).setDepth(101);
    this.towerPanel.setTowerConfigs(classTowers);
    this.towerPanel.setGold(this.hudGold > 0 ? this.hudGold : 999);

    // Wire up selection → GameScene event
    this.towerPanel.setSelectionCallback((configId) => {
      const gameScene = this.scene.get('GameScene');
      if (gameScene) {
        gameScene.events.emit('tower-selected', configId);
      }
    });
  }

  private showGameOverOverlay(phase: 'victory' | 'defeat'): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const isVictory = phase === 'victory';

    // Prevent duplicate overlays
    if (this.data.get('gameOverShown')) return;
    this.data.set('gameOverShown', true);

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(200);

    // Animated text
    const resultText = this.add.text(W / 2, H / 2 - 60, isVictory ? '🏆 VICTORY!' : '💀 DEFEAT', {
      fontSize: '72px',
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: isVictory ? '#ffd700' : '#ff3333',
      stroke: '#000000',
      strokeThickness: 7,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    resultText.setScale(0);
    this.tweens.add({
      targets: resultText,
      scale: 1,
      duration: 400,
      ease: 'Back.Out',
    });

    this.add.text(W / 2, H / 2 + 20, isVictory ? 'All waves survived!' : 'The base has fallen...', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#cccccc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(W / 2, H / 2 + 70, 'Refresh to play again', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#888888',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Particles
    if (isVictory) {
      this.spawnVictoryParticles(W, H);
    }
  }

  private spawnVictoryParticles(W: number, H: number): void {
    const colors = [0xffd700, 0xff8800, 0xffff00, 0x00ff88, 0xff44ff];
    for (let i = 0; i < 60; i++) {
      this.time.delayedCall(i * 50, () => {
        const x = Math.random() * W;
        const circle = this.add.circle(x, H + 20, 4 + Math.random() * 6, colors[Math.floor(Math.random() * colors.length)])
          .setScrollFactor(0).setDepth(202);
        this.tweens.add({
          targets: circle,
          y: -20,
          x: x + (Math.random() - 0.5) * 100,
          alpha: 0,
          duration: 1500 + Math.random() * 1500,
          ease: 'Linear',
          onComplete: () => { circle.destroy(); },
        });
      });
    }
  }

  private updatePhaseDisplay(phase: GamePhase): void {
    const phaseMessages: Partial<Record<GamePhase, { text: string; color: string }>> = {
      prep:       { text: '🛡 PREP PHASE',    color: '#88ffff' },
      combat:     { text: '⚔ WAVE START!',   color: '#ff6644' },
      post_wave:  { text: '✅ WAVE CLEARED!', color: '#88ff88' },
      victory:    { text: '🏆 VICTORY!',      color: '#ffd700' },
      defeat:     { text: '💀 DEFEAT',        color: '#ff3333' },
    };

    const msg = phaseMessages[phase];
    if (!msg) return;

    // Don't re-announce same phase
    if (this.phaseText.text === msg.text && this.phaseText.visible) return;

    this.phaseText.setText(msg.text);
    this.phaseText.setColor(msg.color);
    this.phaseText.setScale(0);
    this.phaseText.setAlpha(1);
    this.phaseText.setVisible(true);

    this.tweens.add({
      targets: this.phaseText,
      scale: 1,
      duration: 300,
      ease: 'Back.Out',
    });

    if (phase !== 'combat' && phase !== 'prep') {
      this.tweens.add({
        targets: this.phaseText,
        alpha: 0,
        duration: 1500,
        delay: 2000,
        onComplete: () => {
          this.phaseText.setVisible(false);
          this.phaseText.setAlpha(1);
        },
      });
    }
  }

  showBaseDamage(damage: number): void {
    this.showDamageIndicator(0, damage);
  }
}
