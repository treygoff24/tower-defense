import Phaser from 'phaser';
import type { GameState, GamePhase, ElementType, DevCheatCommand } from '@td/shared';
import { TOWER_CONFIGS } from '@td/shared';
import { GameClient } from '../GameClient';
import { TowerPanel } from '../ui/TowerPanel';
import { S } from '../dpr';

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
  private hpBarGlow!: Phaser.GameObjects.Graphics;
  private phaseText!: Phaser.GameObjects.Text;
  private prepTimerText!: Phaser.GameObjects.Text;
  private startWaveButton!: Phaser.GameObjects.Container;
  private classIcon!: Phaser.GameObjects.Container;
  private playerElement: ElementType | null = null;
  private prevBaseHp = -1;
  private towerPanel: TowerPanel | null = null;
  private hudGold = 0;

  /* Tracking for polish features */
  private lastWaveText = '';
  private hpLowPulseTween: Phaser.Tweens.Tween | null = null;
  private lastAnnouncedPhase: GamePhase | null = null;
  private combatVignetteGfx: Phaser.GameObjects.Graphics | null = null;
  private startWavePulseTween: Phaser.Tweens.Tween | null = null;
  private prepPhasePulseTween: Phaser.Tweens.Tween | null = null;
  private goldBonusText: Phaser.GameObjects.Text | null = null;
  private devPanel: Phaser.GameObjects.Container | null = null;
  private devPanelVisible = false;
  private godModeEnabled = false;
  private prepTimerPaused = false;

  constructor() {
    super({ key: 'HudScene' });
  }

  create(): void {
    this.createHudElements();

    // Dev mode toggle: backtick key
    this.input.keyboard?.on('keydown-BACKTICK', () => {
      this.toggleDevPanel();
    });
  }

  private createHudElements(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── Gold panel (top-left) ──────────────────────────────────────
    const goldPanel = this.createPanel(14 * S, 14 * S, 180 * S, 38 * S);

    // Subtle gold shimmer border
    const goldBorder = this.add.graphics();
    goldBorder.lineStyle(S, 0xffd700, 0.4);
    goldBorder.strokeRoundedRect(14 * S, 14 * S, 180 * S, 38 * S, 8 * S);
    goldBorder.setScrollFactor(0).setDepth(100);

    this.add.text(22 * S, 20 * S, '💰', { fontSize: `${20 * S}px` }).setScrollFactor(0).setDepth(101);
    this.goldText = this.add.text(50 * S, 21 * S, 'Gold: 0', {
      fontSize: `${20 * S}px`,
      fontFamily: '"Arial Black", Arial',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2 * S,
    }).setScrollFactor(0).setDepth(101);

    // ── Wave panel (top-center) ───────────────────────────────────
    this.createPanel(W / 2 - 110 * S, 14 * S, 220 * S, 38 * S);
    this.waveText = this.add.text(W / 2, 22 * S, 'Wave 0 / 20', {
      fontSize: `${18 * S}px`,
      fontFamily: '"Arial Black", Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2 * S,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);

    // ── Base HP (top-right) ────────────────────────────────────────
    const hpPanelW = 210 * S;
    this.createPanel(W - hpPanelW - 14 * S, 14 * S, hpPanelW, 38 * S);
    this.add.text(W - hpPanelW - 4 * S, 20 * S, '🏰', { fontSize: `${20 * S}px` }).setScrollFactor(0).setDepth(101);
    this.hpText = this.add.text(W - hpPanelW + 22 * S, 21 * S, 'Base HP: 100', {
      fontSize: `${17 * S}px`,
      fontFamily: 'Arial',
      color: '#44ff44',
      stroke: '#000000',
      strokeThickness: 2 * S,
    }).setScrollFactor(0).setDepth(101);

    // HP bar background glow
    this.hpBarGlow = this.add.graphics().setScrollFactor(0).setDepth(100);

    // HP bar (just below top bar)
    this.hpBarFill = this.add.graphics().setScrollFactor(0).setDepth(101);

    // Tiny Swords bar sprites (if available) — override Graphics fallback
    if (this.textures.exists('ui_big_bar_base')) {
      this.hpBarFill.setVisible(false);
      const barLeft = W - hpPanelW - 14 * S;
      this.hpBarBase = this.add.image(barLeft, 54 * S, 'ui_big_bar_base')
        .setOrigin(0, 0.5).setDisplaySize(hpPanelW, 16 * S).setScrollFactor(0).setDepth(101);
      this.hpBarFillImg = this.add.image(barLeft, 54 * S, 'ui_big_bar_fill')
        .setOrigin(0, 0.5).setDisplaySize(hpPanelW, 16 * S).setScrollFactor(0).setDepth(101);
    }

    // ── Class icon (bottom-left) ───────────────────────────────────
    this.classIcon = this.createClassIcon(70 * S, H - 70 * S);
    this.classIcon.setScrollFactor(0).setDepth(101);

    // ── Start Wave button (center-bottom) ─────────────────────────
    this.startWaveButton = this.createStartWaveButton(W / 2, H - 60 * S);
    this.startWaveButton.setScrollFactor(0).setDepth(101);
    this.startWaveButton.setVisible(false);

    // ── Phase announcement (center) ───────────────────────────────
    this.phaseText = this.add.text(W / 2, 90 * S, '', {
      fontSize: `${38 * S}px`,
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#00ff88',
      stroke: '#000000',
      strokeThickness: 5 * S,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);

    // ── Prep timer ────────────────────────────────────────────────
    this.prepTimerText = this.add.text(W / 2, 56 * S, '', {
      fontSize: `${15 * S}px`,
      fontFamily: 'Arial',
      color: '#88ffff',
      stroke: '#000000',
      strokeThickness: 2 * S,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101).setVisible(false);
  }

  // ─────────────────────────────────────────────────────────────────
  // Panel helper
  // ─────────────────────────────────────────────────────────────────

  private createPanel(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    const r = 8 * S;
    // Try WoodTable texture first
    if (this.textures.exists('ui_wood_table')) {
      const img = this.add.image(x + w / 2, y + h / 2, 'ui_wood_table');
      img.setDisplaySize(w, h);
      img.setAlpha(0.85);
      img.setScrollFactor(0).setDepth(100);

      // Dark overlay for readability
      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.3);
      overlay.fillRoundedRect(x, y, w, h, r);
      overlay.setScrollFactor(0).setDepth(100);
    }

    // Graphics fallback (also serves as border/frame even when texture exists)
    const g = this.add.graphics();
    if (!this.textures.exists('ui_wood_table')) {
      g.fillStyle(0x0a0a20, 0.82);
      g.fillRoundedRect(x, y, w, h, r);
    }
    g.lineStyle(S, 0x6666aa, 0.9);
    g.strokeRoundedRect(x, y, w, h, r);
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
    bg.fillCircle(0, 0, 36 * S);
    bg.lineStyle(3 * S, 0x6666aa, 1);
    bg.strokeCircle(0, 0, 36 * S);

    const icon = this.add.text(0, -4 * S, '⚔', {
      fontSize: `${28 * S}px`,
    }).setOrigin(0.5);

    const nameText = this.add.text(0, 44 * S, 'Towers', {
      fontSize: `${11 * S}px`,
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
    const btnW = 220 * S;
    const btnH = 48 * S;
    const r = 10 * S;

    const gfx = this.add.graphics();
    const drawBtn = (state: 'normal' | 'hover' | 'pressed') => {
      gfx.clear();
      // Shadow
      gfx.fillStyle(0x000000, 0.35);
      gfx.fillRoundedRect(-btnW / 2 + 2 * S, -btnH / 2 + 3 * S, btnW, btnH, r);
      // Body
      const fills = { normal: 0x0050aa, hover: 0x0066cc, pressed: 0x003d88 };
      gfx.fillStyle(fills[state], 1);
      gfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, r);
      // Top highlight
      gfx.fillStyle(0xffffff, state === 'hover' ? 0.14 : 0.07);
      gfx.fillRoundedRect(-btnW / 2 + 2 * S, -btnH / 2 + S, btnW - 4 * S, btnH / 2 - 2 * S, { tl: 8 * S, tr: 8 * S, bl: 0, br: 0 });
      // Border
      const borders = { normal: [0x4488ff, 0.85] as const, hover: [0x66aaff, 1] as const, pressed: [0x3377ee, 1] as const };
      const [bc, ba] = borders[state];
      gfx.lineStyle(2 * S, bc, ba);
      gfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, r);
    };
    drawBtn('normal');

    const hitArea = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => { drawBtn('hover'); });
    hitArea.on('pointerout', () => { drawBtn('normal'); });
    hitArea.on('pointerdown', () => { drawBtn('pressed'); });
    hitArea.on('pointerup', () => { drawBtn('normal'); this.handleStartWave(); });

    const label = this.add.text(0, 0, '⚔  START WAVE', {
      fontSize: `${18 * S}px`,
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#001133',
      strokeThickness: 3 * S,
    }).setOrigin(0.5);

    container.add([gfx, label, hitArea]);
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
  // Start Wave button pulse (prep phase attention-draw)
  // ─────────────────────────────────────────────────────────────────

  private startButtonPulse(): void {
    if (this.startWavePulseTween) return;
    this.startWavePulseTween = this.tweens.add({
      targets: this.startWaveButton,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private stopButtonPulse(): void {
    if (this.startWavePulseTween) {
      this.startWavePulseTween.stop();
      this.startWavePulseTween = null;
      this.startWaveButton.setScale(1);
    }
  }

  /** Flash the start-wave button green briefly (e.g. when a tower is placed). */
  flashStartWaveButton(): void {
    if (!this.startWaveButton || !this.startWaveButton.visible) return;
    const children = this.startWaveButton.getAll() as Phaser.GameObjects.GameObject[];
    for (const child of children) {
      if (child instanceof Phaser.GameObjects.Image) {
        child.setTint(0x00ff88);
        this.time.delayedCall(200, () => { child.clearTint(); });
        return;
      }
    }
    // Fallback: tint the label text
    const label = (this.startWaveButton as unknown as { label: Phaser.GameObjects.Text }).label;
    if (label) {
      label.setTint(0x00ff88);
      this.time.delayedCall(200, () => { label.clearTint(); });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // State sync
  // ─────────────────────────────────────────────────────────────────

  syncState(state: GameState): void {
    if (!this.goldText) return;
    // Gold — pulse on change
    const newGold = state.economy.gold;
    this.hudGold = newGold;
    if (this.goldText.text !== `Gold: ${newGold}`) {
      this.goldText.setText(`Gold: ${newGold}`);
      this.tweens.add({ targets: this.goldText, scaleX: 1.2, scaleY: 1.2, yoyo: true, duration: 150 });
    }
    this.towerPanel?.setGold(newGold);

    // Wave — integrate enemy count when in combat
    const alive = Object.values(state.enemies).filter((e) => e.alive).length;
    let waveStr: string;
    if (state.wave === 0) {
      waveStr = 'Wave: Ready';
    } else if (alive > 0) {
      waveStr = `Wave ${state.wave} / ${state.maxWaves} · 👾 ${alive}`;
    } else {
      waveStr = `Wave ${state.wave} / ${state.maxWaves}`;
    }
    if (this.waveText.text !== waveStr) {
      this.waveText.setText(waveStr);
      // Pulse on new wave start (wave number changed)
      const waveKey = `w${state.wave}`;
      if (this.lastWaveText !== waveKey && state.wave > 0) {
        this.tweens.add({
          targets: this.waveText,
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 200,
          yoyo: true,
          ease: 'Sine.InOut',
        });
      }
      this.lastWaveText = waveKey;
    }

    // HP
    const hpRatio = state.baseHp / state.maxBaseHp;
    const hpColor = hpRatio > 0.6 ? '#44ff44' : hpRatio > 0.3 ? '#ffee22' : '#ff3333';
    const fillColor = hpRatio > 0.6 ? 0x44ff44 : hpRatio > 0.3 ? 0xffee22 : 0xff3333;
    this.hpText.setColor(hpColor);
    this.hpText.setText(`🏰 ${state.baseHp} / ${state.maxBaseHp}`);

    // HP bar background glow
    const W = this.cameras.main.width;
    const panelW = 210 * S;
    this.hpBarGlow.clear();
    this.hpBarGlow.fillStyle(fillColor, 0.1);
    this.hpBarGlow.fillRoundedRect(W - panelW - 18 * S, 48 * S, panelW + 8 * S, 14 * S, 4 * S);

    // HP bar
    if (this.hpBarFillImg) {
      // Tiny Swords sprite bar — scale fill width proportionally from left
      this.hpBarFillImg.setDisplaySize(Math.max(panelW * hpRatio, 2 * S), 16 * S);
      this.hpBarFillImg.setTint(fillColor);
    } else {
      this.hpBarFill.clear();
      this.hpBarFill.fillStyle(0x000000, 0.5);
      this.hpBarFill.fillRect(W - panelW - 14 * S, 52 * S, panelW, 6 * S);
      this.hpBarFill.fillStyle(fillColor, 1);
      this.hpBarFill.fillRect(W - panelW - 14 * S, 52 * S, panelW * hpRatio, 6 * S);
    }

    // Low-HP pulsing red tint on HP text
    if (hpRatio < 0.3 && hpRatio > 0) {
      if (!this.hpLowPulseTween || !this.hpLowPulseTween.isPlaying()) {
        this.hpLowPulseTween = this.tweens.add({
          targets: this.hpText,
          alpha: 0.5,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      }
    } else {
      if (this.hpLowPulseTween) {
        this.hpLowPulseTween.stop();
        this.hpLowPulseTween = null;
        this.hpText.setAlpha(1);
      }
    }

    // Base damage shake
    if (this.prevBaseHp !== -1 && state.baseHp < this.prevBaseHp) {
      this.showDamageIndicator(state.baseHp, this.prevBaseHp);
    }
    this.prevBaseHp = state.baseHp;

    this.updatePlayerClass(state);
    this.updatePhaseDisplay(state.phase);

    // Start wave button visibility + pulse
    if (state.phase === 'prep') {
      this.prepTimerText.setText(`⏱ Prep: ${Math.ceil(state.prepTimeRemaining)}s`);
      this.prepTimerText.setVisible(true);
      this.startWaveButton.setVisible(true);
      this.startButtonPulse();
    } else {
      this.prepTimerText.setVisible(false);
      this.startWaveButton.setVisible(false);
      this.stopButtonPulse();
    }

    if (state.phase === 'victory' || state.phase === 'defeat') {
      this.showGameOverOverlay(state.phase);
    }
  }

  private showDamageIndicator(currentHp: number, prevHp: number): void {
    const dmg = prevHp - currentHp;
    const W = this.cameras.main.width;
    const dmgText = this.add.text(W - 30 * S, 65 * S, `-${dmg}`, {
      fontSize: `${26 * S}px`,
      fontFamily: '"Arial Black", Arial',
      color: '#ff3333',
      stroke: '#000000',
      strokeThickness: 3 * S,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(103);

    this.tweens.add({
      targets: dmgText,
      y: 30 * S,
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
      bg.fillCircle(0, 0, 36 * S);
      bg.lineStyle(3 * S, color, 1);
      bg.strokeCircle(0, 0, 36 * S);

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
    const panelX = W - 110 * S;  // 210px wide panel, centered 110px from right
    const panelY = H / 2;
    this.towerPanel = new TowerPanel(this, panelX, panelY);
    this.towerPanel.getContainer().setScrollFactor(0).setDepth(101);
    this.towerPanel.setGold(this.hudGold > 0 ? this.hudGold : 999);
    this.towerPanel.setTowerConfigs(classTowers);

    // Wire up selection → GameScene event
    this.towerPanel.setSelectionCallback((configId) => {
      const gameScene = this.scene.get('GameScene');
      const gameClient = this.registry.get('gameClient') as GameClient;
      if (gameScene) {
        gameScene.events.emit('tower-selected', configId);
      }
      if (gameClient) {
        gameClient.selectTower(configId);
      }
      // Flash start-wave button green when a tower is placed
      this.flashStartWaveButton();
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
    const resultText = this.add.text(W / 2, H / 2 - 60 * S, isVictory ? '🏆 VICTORY!' : '💀 DEFEAT', {
      fontSize: `${72 * S}px`,
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: isVictory ? '#ffd700' : '#ff3333',
      stroke: '#000000',
      strokeThickness: 7 * S,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    resultText.setScale(0);
    this.tweens.add({
      targets: resultText,
      scale: 1,
      duration: 400,
      ease: 'Back.Out',
    });

    this.add.text(W / 2, H / 2 + 20 * S, isVictory ? 'All waves survived!' : 'The base has fallen...', {
      fontSize: `${24 * S}px`,
      fontFamily: 'Arial',
      color: '#cccccc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(W / 2, H / 2 + 70 * S, 'Refresh to play again', {
      fontSize: `${18 * S}px`,
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
        const circle = this.add.circle(x, H + 20 * S, (4 + Math.random() * 6) * S, colors[Math.floor(Math.random() * colors.length)])
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

  // ─────────────────────────────────────────────────────────────────
  // Phase display with polish effects
  // ─────────────────────────────────────────────────────────────────

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
    if (this.lastAnnouncedPhase === phase && this.phaseText.visible) return;
    this.lastAnnouncedPhase = phase;

    // Cleanup previous prep pulse tween
    if (this.prepPhasePulseTween) {
      this.prepPhasePulseTween.stop();
      this.prepPhasePulseTween = null;
    }

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

    // ── Phase-specific polish ──────────────────────────────────
    if (phase === 'combat') {
      this.showCombatVignette();
      // Fade out announcement after delay
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
    } else if (phase === 'post_wave') {
      // Show "+gold" bonus text briefly
      this.showPostWaveGoldBonus();
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
    } else if (phase === 'prep') {
      // Slow pulse for prep phase text (cyan)
      this.phaseText.setColor('#88ffff');
      this.prepPhasePulseTween = this.tweens.add({
        targets: this.phaseText,
        alpha: 0.5,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      // Don't auto-hide prep text — it stays visible during prep
    } else if (phase !== 'victory' && phase !== 'defeat') {
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

  // ─────────────────────────────────────────────────────────────────
  // Combat vignette (red screen-edge overlay that fades in then out)
  // ─────────────────────────────────────────────────────────────────

  private showCombatVignette(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    if (this.combatVignetteGfx) {
      this.combatVignetteGfx.destroy();
    }

    const gfx = this.add.graphics().setScrollFactor(0).setDepth(99);
    this.combatVignetteGfx = gfx;

    const edgeW = 80 * S;
    // Left edge
    gfx.fillStyle(0xff0000, 0.25);
    gfx.fillRect(0, 0, edgeW, H);
    // Right edge
    gfx.fillRect(W - edgeW, 0, edgeW, H);
    // Top edge
    gfx.fillRect(0, 0, W, edgeW * 0.6);
    // Bottom edge
    gfx.fillRect(0, H - edgeW * 0.6, W, edgeW * 0.6);

    // Inner, less opaque layer for gradient feel
    gfx.fillStyle(0xff0000, 0.1);
    gfx.fillRect(edgeW, 0, edgeW, H);
    gfx.fillRect(W - edgeW * 2, 0, edgeW, H);
    gfx.fillRect(0, edgeW * 0.6, W, edgeW * 0.4);
    gfx.fillRect(0, H - edgeW, W, edgeW * 0.4);

    gfx.setAlpha(0);

    // Fade in then fade out
    this.tweens.add({
      targets: gfx,
      alpha: 1,
      duration: 400,
      ease: 'Sine.In',
      onComplete: () => {
        this.tweens.add({
          targets: gfx,
          alpha: 0,
          duration: 1200,
          delay: 600,
          ease: 'Sine.Out',
          onComplete: () => {
            gfx.destroy();
            if (this.combatVignetteGfx === gfx) {
              this.combatVignetteGfx = null;
            }
          },
        });
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Post-wave gold bonus text
  // ─────────────────────────────────────────────────────────────────

  private showPostWaveGoldBonus(): void {
    const W = this.cameras.main.width;

    // Destroy previous bonus text if still around
    if (this.goldBonusText) {
      this.goldBonusText.destroy();
      this.goldBonusText = null;
    }

    // Show a "+bonus gold" text below phase text
    const bonus = 50; // standard wave-clear bonus
    this.goldBonusText = this.add.text(W / 2, 130 * S, `+${bonus} gold 💰`, {
      fontSize: `${22 * S}px`,
      fontFamily: '"Arial Black", Arial',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3 * S,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setAlpha(0);

    this.tweens.add({
      targets: this.goldBonusText,
      alpha: 1,
      y: 125 * S,
      duration: 400,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: this.goldBonusText,
          alpha: 0,
          y: 115 * S,
          duration: 800,
          delay: 1200,
          ease: 'Sine.In',
          onComplete: () => {
            if (this.goldBonusText) {
              this.goldBonusText.destroy();
              this.goldBonusText = null;
            }
          },
        });
      },
    });
  }

  showBaseDamage(damage: number): void {
    this.showDamageIndicator(0, damage);
  }

  // ─────────────────────────────────────────────────────────────────
  // Dev panel
  // ─────────────────────────────────────────────────────────────────

  private toggleDevPanel(): void {
    this.devPanelVisible = !this.devPanelVisible;
    if (this.devPanelVisible && !this.devPanel) {
      this.createDevPanel();
    }
    this.devPanel?.setVisible(this.devPanelVisible);
  }

  private createDevPanel(): void {
    const H = this.cameras.main.height;
    const panelX = 10 * S;
    const panelW = 200 * S;
    const btnH = 28 * S;
    const btnGap = 4 * S;
    const pad = 8 * S;

    const buttons: { label: string; action: () => void }[] = [
      { label: '💰 +1000 Gold', action: () => this.devCheat({ type: 'add_gold', amount: 1000 }) },
      { label: '💰 +10000 Gold', action: () => this.devCheat({ type: 'add_gold', amount: 10000 }) },
      { label: '⏭ Skip Prep', action: () => this.devCheat({ type: 'skip_prep' }) },
      { label: '⏸ Pause Timer', action: () => {
        this.prepTimerPaused = !this.prepTimerPaused;
        this.devCheat({ type: 'pause_prep_timer', paused: this.prepTimerPaused });
      }},
      { label: '👾 Spawn 10 Grunts', action: () => this.devCheat({ type: 'spawn_enemies', enemyType: 'grunt', count: 10 }) },
      { label: '👾 Spawn 5 Tanks', action: () => this.devCheat({ type: 'spawn_enemies', enemyType: 'tank', count: 5, hp: 500 }) },
      { label: '👾 Spawn Boss', action: () => this.devCheat({ type: 'spawn_enemies', enemyType: 'boss', count: 1, hp: 2000 }) },
      { label: '💀 Kill All Enemies', action: () => this.devCheat({ type: 'kill_all_enemies' }) },
      { label: '❤ Full HP', action: () => this.devCheat({ type: 'set_base_hp', hp: 100 }) },
      { label: '❤ Set HP = 1', action: () => this.devCheat({ type: 'set_base_hp', hp: 1 }) },
      { label: '🛡 God Mode', action: () => {
        this.godModeEnabled = !this.godModeEnabled;
        this.devCheat({ type: 'god_mode', enabled: this.godModeEnabled });
      }},
      { label: '⚔ Force Combat', action: () => this.devCheat({ type: 'set_phase', phase: 'combat' }) },
      { label: '🛡 Force Prep', action: () => this.devCheat({ type: 'set_phase', phase: 'prep' }) },
    ];

    const panelH = pad * 2 + 24 * S + buttons.length * (btnH + btnGap);
    const panelY = H - panelH - 10 * S;

    this.devPanel = this.add.container(panelX, panelY).setScrollFactor(0).setDepth(500);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRoundedRect(0, 0, panelW, panelH, 8 * S);
    bg.lineStyle(S, 0xff8800, 0.8);
    bg.strokeRoundedRect(0, 0, panelW, panelH, 8 * S);
    this.devPanel.add(bg);

    // Title
    const title = this.add.text(panelW / 2, pad, 'DEV MODE', {
      fontSize: `${14 * S}px`,
      fontFamily: '"Arial Black", Arial',
      color: '#ff8800',
      stroke: '#000000',
      strokeThickness: 2 * S,
    }).setOrigin(0.5, 0);
    this.devPanel.add(title);

    // Buttons
    let yOff = pad + 24 * S;
    for (const btn of buttons) {
      const btnContainer = this.createDevButton(pad, yOff, panelW - pad * 2, btnH, btn.label, btn.action);
      this.devPanel.add(btnContainer);
      yOff += btnH + btnGap;
    }
  }

  private createDevButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x333333, 0.9);
    bg.fillRoundedRect(0, 0, w, h, 4 * S);

    const text = this.add.text(w / 2, h / 2, label, {
      fontSize: `${11 * S}px`,
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5);

    const hitArea = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x555555, 0.9);
      bg.fillRoundedRect(0, 0, w, h, 4 * S);
    });

    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x333333, 0.9);
      bg.fillRoundedRect(0, 0, w, h, 4 * S);
    });

    hitArea.on('pointerdown', () => {
      bg.clear();
      bg.fillStyle(0x222222, 0.9);
      bg.fillRoundedRect(0, 0, w, h, 4 * S);
    });

    hitArea.on('pointerup', () => {
      bg.clear();
      bg.fillStyle(0x555555, 0.9);
      bg.fillRoundedRect(0, 0, w, h, 4 * S);
      onClick();
    });

    container.add([bg, text, hitArea]);
    return container;
  }

  private devCheat(cheat: DevCheatCommand): void {
    const gameClient = this.registry.get('gameClient') as GameClient;
    gameClient?.devCheat(cheat);
  }
}
