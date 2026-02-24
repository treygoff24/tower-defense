import Phaser from 'phaser';
import type { GameState, GamePhase, ElementType, WaveConfig } from '@td/shared';
import { TOWER_CONFIGS, WAVE_CONFIGS } from '@td/shared';
import { GameClient } from '../GameClient';
import { TowerPanel } from '../ui/TowerPanel';
import { TowerInspector } from '../ui/TowerInspector';
import type { TargetingMode } from '../ui/TowerInspector';

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
  private sellPanel: Phaser.GameObjects.Container | null = null;
  private towerInspectorInst: TowerInspector | null = null;
  private inspectorBackdrop: Phaser.GameObjects.Rectangle | null = null;
  private shopOpen: boolean = false;
  private shopButton: Phaser.GameObjects.Text | null = null;
  private shopBackdrop: Phaser.GameObjects.Rectangle | null = null;
  private targetingModes: Map<string, TargetingMode> = new Map();
  private hudGold = 0;
  private wavePreviewContainer: Phaser.GameObjects.Container | null = null;
  private currentWaveNum: number = 0;
  private currentSpeed: number = 1;
  private speedLabel: Phaser.GameObjects.Text | null = null;

  /* Tracking for polish features */
  private lastWaveText = '';
  private hpLowPulseTween: Phaser.Tweens.Tween | null = null;
  private lastAnnouncedPhase: GamePhase | null = null;
  private combatVignetteGfx: Phaser.GameObjects.Graphics | null = null;
  private startWavePulseTween: Phaser.Tweens.Tween | null = null;
  private prepPhasePulseTween: Phaser.Tweens.Tween | null = null;
  private goldBonusText: Phaser.GameObjects.Text | null = null;
  private lastWaveGoldReward = 50;

  /* Wave banner */
  private lastBannerWave = 0;
  private waveBannerContainer: Phaser.GameObjects.Container | null = null;

  /* End-of-game statistics */
  private statsEnemiesKilled = 0;
  private statsGoldEarned    = 0;
  private statsTowersBuilt   = 0;
  private statsPrevAliveEnemies: Set<string> = new Set();
  private statsPrevGold = 0;
  private statsPrevTowers: Set<string> = new Set();
  private statsTowerShots: Map<string, { configId: string; shots: number }> = new Map();

  /* Latest game state (used for player lookups) */
  private lastKnownState: GameState | null = null;

  /* Chat system */
  private chatInputActive = false;
  private chatInputEl: HTMLInputElement | null = null;
  private chatMessages: Array<{ sender: string; text: string; time: number }> = [];
  private chatMsgObjects: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: 'HudScene' });
  }

  create(): void {
    this.createHudElements();
    this.setupChatSystem();
    this.setupGlobalEscHandler();
  }

  private createHudElements(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── Gold panel (top-left) ──────────────────────────────────────
    const goldPanel = this.createPanel(14, 14, 180, 38);

    // Subtle gold shimmer border
    const goldBorder = this.add.graphics();
    goldBorder.lineStyle(1, 0xffd700, 0.4);
    goldBorder.strokeRoundedRect(14, 14, 180, 38, 8);
    goldBorder.setScrollFactor(0).setDepth(100);

    this.add.text(22, 20, '💰', { fontSize: '20px' }).setScrollFactor(0).setDepth(101);
    this.goldText = this.add.text(50, 21, 'Gold: 0', {
      fontSize: '20px',
      fontFamily: '"Arial Black", Arial',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(101);

    // ── Wave panel (top-center) ───────────────────────────────────
    this.createPanel(W / 2 - 110, 14, 220, 38);
    this.waveText = this.add.text(W / 2, 22, 'Wave 0 / 20', {
      fontSize: '18px',
      fontFamily: '"Arial Black", Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);

    const waveBtn = this.add.text(W / 2 + 120, 26, '📋 Waves', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaccff',
      backgroundColor: '#111133',
      padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(101).setInteractive({ useHandCursor: true });
    waveBtn.on('pointerdown', () => this.toggleWavePreview());
    waveBtn.on('pointerover', () => waveBtn.setColor('#ffffff'));
    waveBtn.on('pointerout', () => waveBtn.setColor('#aaccff'));

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

    // HP bar background glow
    this.hpBarGlow = this.add.graphics().setScrollFactor(0).setDepth(100);

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

    // ── Speed toggle (below HP bar) ──────────────────────────────
    const speedPanelW = 60;
    const speedPanelH = 24;
    const speedContainer = this.add.container(W - hpPanelW - 15, 72).setScrollFactor(0).setDepth(101);
    const speedBg = this.add.graphics();
    speedBg.fillStyle(0x141833, 0.95);
    speedBg.fillRoundedRect(-speedPanelW / 2, -speedPanelH / 2, speedPanelW, speedPanelH, 6);
    speedBg.lineStyle(1, 0x66a6ff, 0.9);
    speedBg.strokeRoundedRect(-speedPanelW / 2, -speedPanelH / 2, speedPanelW, speedPanelH, 6);

    this.speedLabel = this.add.text(0, 0, `${this.currentSpeed}×`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#e6ecff',
    }).setOrigin(0.5);

    const speedHit = this.add.rectangle(0, 0, speedPanelW, speedPanelH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    speedHit.on('pointerdown', () => {
      this.cycleGameSpeed();
    });

    speedContainer.add([speedBg, this.speedLabel, speedHit]);

    // ── Version display (top-right corner) ────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-undef
    const versionText = 'v' + __VERSION__;
    this.add.text(W - 14, 74, versionText, {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#666688',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(101);

    // ── Class icon (bottom-left) ───────────────────────────────────
    this.classIcon = this.createClassIcon(70, H - 70);
    this.classIcon.setScrollFactor(0).setDepth(101);

    // ── Shop button (bottom-left area) ─────────────────────────
    this.shopButton = this.add.text(130, H - 72, '🛒 Shop', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#e6ecff',
      backgroundColor: '#0f1330',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(101).setInteractive({ useHandCursor: true });

    this.shopButton.on('pointerover', () => this.shopButton?.setColor('#ffffff'));
    this.shopButton.on('pointerout', () => this.shopButton?.setColor('#e6ecff'));
    this.shopButton.on('pointerdown', () => {
      if (this.shopOpen) {
        this.closeShop();
      } else {
        this.openShop();
      }
    });

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

    // ── Zoom controls (bottom-right) ────────────────────────────
    const emitZoomEvent = (eventName: string): void => {
      const gameScene = this.scene.get('GameScene');
      if (!gameScene) return;
      gameScene.events.emit(eventName);
    };

    const createZoomButton = (
      label: string,
      x: number,
      y: number,
      eventName: string,
    ): Phaser.GameObjects.Container => {
      const container = this.add.container(x, y);
      container.setScrollFactor(0).setDepth(101);

      const bg = this.add.graphics();
      bg.fillStyle(0x14152a, 0.95);
      bg.fillRoundedRect(-14, -14, 28, 28, 6);
      bg.lineStyle(1, 0x6f9eff, 0.9);
      bg.strokeRoundedRect(-14, -14, 28, 28, 6);

      const text = this.add.text(0, 0, label, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffffff',
      }).setOrigin(0.5, 0.45);

      const hit = this.add.rectangle(0, 0, 28, 28, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      hit.on('pointerdown', () => emitZoomEvent(eventName));

      container.add([bg, text, hit]);
      return container;
    };

    createZoomButton('−', W - 46, H - 56, 'zoom-out');
    createZoomButton('+', W - 14, H - 56, 'zoom-in');
  }

  // ─────────────────────────────────────────────────────────────────
  // Panel helper
  // ─────────────────────────────────────────────────────────────────

  private createPanel(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    // Try WoodTable texture first
    if (this.textures.exists('ui_wood_table')) {
      const img = this.add.image(x + w / 2, y + h / 2, 'ui_wood_table');
      img.setDisplaySize(w, h);
      img.setAlpha(0.85);
      img.setScrollFactor(0).setDepth(100);

      // Dark overlay for readability
      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.3);
      overlay.fillRoundedRect(x, y, w, h, 8);
      overlay.setScrollFactor(0).setDepth(100);
    }

    // Graphics fallback (also serves as border/frame even when texture exists)
    const g = this.add.graphics();
    if (!this.textures.exists('ui_wood_table')) {
      g.fillStyle(0x0a0a20, 0.82);
      g.fillRoundedRect(x, y, w, h, 8);
    }
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
    const btnW = 220;
    const btnH = 48;

    const gfx = this.add.graphics();
    const drawBtn = (state: 'normal' | 'hover' | 'pressed') => {
      gfx.clear();
      // Shadow
      gfx.fillStyle(0x000000, 0.35);
      gfx.fillRoundedRect(-btnW / 2 + 2, -btnH / 2 + 3, btnW, btnH, 10);
      // Body
      const fills = { normal: 0x0050aa, hover: 0x0066cc, pressed: 0x003d88 };
      gfx.fillStyle(fills[state], 1);
      gfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
      // Top highlight
      gfx.fillStyle(0xffffff, state === 'hover' ? 0.14 : 0.07);
      gfx.fillRoundedRect(-btnW / 2 + 2, -btnH / 2 + 1, btnW - 4, btnH / 2 - 2, { tl: 8, tr: 8, bl: 0, br: 0 });
      // Border
      const borders = { normal: [0x4488ff, 0.85] as const, hover: [0x66aaff, 1] as const, pressed: [0x3377ee, 1] as const };
      const [bc, ba] = borders[state];
      gfx.lineStyle(2, bc, ba);
      gfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    };
    drawBtn('normal');

    const hitArea = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => { drawBtn('hover'); });
    hitArea.on('pointerout', () => { drawBtn('normal'); });
    hitArea.on('pointerdown', () => { drawBtn('pressed'); });
    hitArea.on('pointerup', () => { drawBtn('normal'); this.handleStartWave(); });

    const label = this.add.text(0, 0, '⚔  START WAVE', {
      fontSize: '18px',
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#001133',
      strokeThickness: 3,
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

  private cycleGameSpeed(): void {
    const gameClient = this.registry.get('gameClient') as GameClient;
    if (!gameClient) return;

    const speedOptions = [1, 1.5, 2];
    const idx = speedOptions.indexOf(this.currentSpeed);
    const nextSpeed = speedOptions[(idx + 1) % speedOptions.length];

    gameClient.setGameSpeed(nextSpeed).catch((error: unknown) => {
      console.error('Failed to set game speed:', error);
    });
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
    this.lastKnownState = state;
    this.currentWaveNum = (state as { currentWave?: number }).currentWave ?? 0;

    // ── Stats tracking ────────────────────────────────────────────
    // Enemies killed: alive last tick but now gone/dead
    const aliveNow = new Set(
      Object.entries(state.enemies)
        .filter(([, e]) => e.alive)
        .map(([id]) => id)
    );
    for (const prevId of this.statsPrevAliveEnemies) {
      if (!aliveNow.has(prevId)) this.statsEnemiesKilled++;
    }
    this.statsPrevAliveEnemies = aliveNow;

    // Gold earned: track positive deltas
    if (state.economy.gold > this.statsPrevGold) {
      this.statsGoldEarned += state.economy.gold - this.statsPrevGold;
    }
    this.statsPrevGold = state.economy.gold;

    // Towers built: new tower IDs appearing in state
    const towerIds = new Set(Object.keys(state.towers));
    for (const id of towerIds) {
      if (!this.statsPrevTowers.has(id)) this.statsTowersBuilt++;
    }
    this.statsPrevTowers = towerIds;

    // ── Wave banner (show on combat phase with new wave) ──────────
    if (state.phase === 'combat' && state.wave > this.lastBannerWave) {
      this.showWaveBanner(state.wave);
    }

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
    const panelW = 210;
    this.hpBarGlow.clear();
    this.hpBarGlow.fillStyle(fillColor, 0.1);
    this.hpBarGlow.fillRoundedRect(W - panelW - 18, 48, panelW + 8, 14, 4);

    // HP bar
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

    if (this.currentSpeed !== state.gameSpeed) {
      this.currentSpeed = state.gameSpeed;
      this.speedLabel?.setText(`${this.currentSpeed}×`);
    }

    this.time.timeScale = this.currentSpeed;
    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      gameScene.time.timeScale = this.currentSpeed;
    }

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

    // Note: victory/defeat overlays are now handled by ResultScene (launched by GameClient)
  }

  private showDamageIndicator(currentHp: number, prevHp: number): void {
    const W = this.cameras.main.width;
    const dmg = prevHp - currentHp;
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

  private setupGlobalEscHandler(): void {
    if (!this.input.keyboard) return;
    const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.on('down', this.handleEsc);
  }

  private handleEsc = (): void => {
    if (this.wavePreviewContainer) {
      this.toggleWavePreview();
      return;
    }

    if (this.shopOpen) {
      this.closeShop();
      return;
    }

    const gameScene = this.scene.get('GameScene');
    gameScene?.events.emit('tower-deselected');
  };

  private openShop(): void {
    if (!this.towerPanel) return;
    if (this.shopOpen) return;

    this.shopOpen = true;
    this.towerPanel.getContainer().setVisible(true);

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    if (this.shopBackdrop) {
      this.shopBackdrop.setPosition(W / 2, H / 2);
      this.shopBackdrop.setDisplaySize(W, H);
      this.shopBackdrop.setVisible(true);
      this.shopBackdrop.setInteractive();
      return;
    }

    this.shopBackdrop = this.add
      .rectangle(W / 2, H / 2, W, H, 0x000000, 0.4)
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive({ useHandCursor: false })
      .setVisible(true);

    this.shopBackdrop.on('pointerdown', () => this.closeShop());
  }

  private closeShop(): void {
    this.shopOpen = false;
    this.towerPanel?.getContainer().setVisible(false);

    if (this.shopBackdrop) {
      this.shopBackdrop.destroy();
      this.shopBackdrop = null;
    }
  }

  private toggleWavePreview(): void {
    if (this.wavePreviewContainer) {
      this.wavePreviewContainer.destroy();
      this.wavePreviewContainer = null;
      return;
    }

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const previewContainer = this.add.container(W / 2, H / 2)
      .setScrollFactor(0)
      .setDepth(210);

    const backdrop = this.add.rectangle(0, 0, W, H, 0x000000, 0.45)
      .setScrollFactor(0)
      .setInteractive()
      .setDepth(1)
      .on('pointerdown', () => this.toggleWavePreview());
    previewContainer.add(backdrop);

    const panelW = Math.min(760, W - 64);
    const maxRows = 9;
    const rowH = 24;
    const startWave = Math.max(this.currentWaveNum, 1);
    const upcomingWaves = WAVE_CONFIGS
      .filter((waveCfg) => waveCfg.wave >= startWave)
      .slice(0, maxRows);
    const panelH = Math.max(140, 64 + upcomingWaves.length * rowH);
    const panelX = -panelW / 2;
    const panelY = -panelH / 2;

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x09102a, 0.95);
    panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
    panelBg.lineStyle(2, 0x88aaff, 0.95);
    panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
    previewContainer.add(panelBg);

    const panelHit = this.add
      .rectangle(0, 0, panelW, panelH, 0, 0)
      .setInteractive()
      .on('pointerdown', (_ptr: any, _lx: any, _ly: any, evt: Phaser.Types.Input.EventData) => {
        evt.stopPropagation();
      });
    previewContainer.add(panelHit);

    const title = this.add.text(0, panelY + 16, '📋 Wave Preview', {
      fontSize: '20px',
      fontFamily: '"Arial Black", Arial',
      color: '#88ccff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    previewContainer.add(title);

    const closeBtn = this.add.text(panelX + panelW - 12, panelY + 10, '✕', {
      fontSize: '22px',
      fontFamily: 'Arial',
      color: '#ff8f8f',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.setScrollFactor(0);
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff8f8f'));
    closeBtn.on('pointerdown', () => this.toggleWavePreview());
    previewContainer.add(closeBtn);

    const enemyIcons: Record<string, string> = {
      grunt: '👣',
      runner: '💨',
      tank: '🛡',
      flyer: '🦋',
      invisible: '👻',
      caster: '🧙',
      boss: '💀',
    };

    const baseY = panelY + 50;
    if (upcomingWaves.length === 0) {
      const emptyText = this.add.text(0, baseY, 'No upcoming waves configured', {
        fontSize: '14px',
        fontFamily: 'Arial',
        color: '#99aacc',
      }).setOrigin(0.5);
      previewContainer.add(emptyText);
    } else {
      upcomingWaves.forEach((waveCfg, i) => {
        const y = baseY + i * rowH;
        const isCurrent = waveCfg.wave === this.currentWaveNum;
        const isNext = waveCfg.wave === this.currentWaveNum + 1;
        const isPast = waveCfg.wave < this.currentWaveNum;

        const rowColor = isCurrent ? '#ffd95a' : isNext ? '#7fff88' : '#dde6ff';
        const rowAlpha = isPast ? 0.4 : 1;

        const rowBg = this.add.graphics();
        if (isCurrent) {
          rowBg.fillStyle(0x443300, 0.25);
          rowBg.fillRoundedRect(panelX + 8, y - 12, panelW - 16, 20, 6);
        }
        previewContainer.add(rowBg);

        const groupText = waveCfg.groups
          .map((g) => `${enemyIcons[g.enemyType] ?? '👾'} ${g.enemyType} ×${g.count}`)
          .join('  ');
        const waveText = this.add.text(panelX + 14, y, `Wave ${waveCfg.wave}`, {
          fontSize: '12px',
          fontFamily: 'Arial',
          color: rowColor,
        }).setOrigin(0, 0.5);

        const enemyText = this.add.text(panelX + 120, y, groupText, {
          fontSize: '12px',
          fontFamily: 'Arial',
          color: rowColor,
        }).setOrigin(0, 0.5);

        const rewardText = this.add.text(panelX + panelW - 14, y, `+${waveCfg.bountyGold}g`, {
          fontSize: '12px',
          fontFamily: 'Arial',
          color: '#ffd700',
          fontStyle: 'bold',
        }).setOrigin(1, 0.5);

        const rowContainer = this.add.container(0, 0, [waveText, enemyText, rewardText]);
        rowContainer.setAlpha(rowAlpha);
        previewContainer.add(rowContainer);
      });
    }

    this.wavePreviewContainer = previewContainer;
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
    this.closeShop();

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
    const panelX = W - 150;  // 280px wide panel, centered 150px from right
    const panelY = H / 2;
    this.towerPanel = new TowerPanel(this, panelX, panelY);
    this.towerPanel.getContainer().setScrollFactor(0).setDepth(101).setVisible(false);
    this.towerPanel.setGold(this.hudGold > 0 ? this.hudGold : 999);
    this.towerPanel.setTowerConfigs(classTowers);

    // Wire up selection → GameScene event
    this.towerPanel.setSelectionCallback((configId) => {
      this.closeShop();
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

  // ─────────────────────────────────────────────────────────────────
  // Wave Announcement Banner V2
  // ─────────────────────────────────────────────────────────────────

  private showWaveBanner(wave: number): void {
    if (this.lastBannerWave >= wave) return;
    this.lastBannerWave = wave;

    const W = this.cameras.main.width;

    // Destroy any existing banner
    if (this.waveBannerContainer) {
      this.waveBannerContainer.destroy();
      this.waveBannerContainer = null;
    }

    // Look up wave config
    const waveConfig: WaveConfig | undefined = WAVE_CONFIGS.find((wc) => wc.wave === wave);
    const playerCount = Object.keys(this.lastKnownState?.players ?? {}).length || 1;
    const goldBonus = (40 + 10 * wave) * playerCount;

    // Build enemy summary string with icons
    const ENEMY_ICONS: Record<string, string> = {
      grunt: '👣', runner: '💨', tank: '🛡', flyer: '🦋',
      invisible: '👻', caster: '🧙', boss: '💀',
    };
    const enemySummary = waveConfig?.groups
      .map((g) => `${ENEMY_ICONS[g.enemyType] ?? '👾'} ${g.enemyType} ×${g.count}`)
      .join('  ') ?? '';

    const telegraph = waveConfig?.telegraph ?? '';

    const bannerW = Math.min(W - 40, 700);
    const bannerH = telegraph ? 96 : 72;

    const container = this.add.container(W / 2, -bannerH - 10);
    container.setScrollFactor(0);
    container.setDepth(95); // below interactive UI (101+), does not block clicks

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x06061a, 0.88);
    bg.fillRoundedRect(-bannerW / 2, 0, bannerW, bannerH, 12);
    bg.lineStyle(2, 0xffcc00, 0.9);
    bg.strokeRoundedRect(-bannerW / 2, 0, bannerW, bannerH, 12);
    // Gold accent strip at top
    bg.fillStyle(0xffcc00, 0.7);
    bg.fillRoundedRect(-bannerW / 2, 0, bannerW, 4, { tl: 12, tr: 12, bl: 0, br: 0 });
    container.add(bg);

    // Wave title
    const titleText = this.add.text(0, 14, `⚔  WAVE ${wave}`, {
      fontSize: '26px',
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0);
    container.add(titleText);

    // Enemy summary row
    if (enemySummary) {
      const enemyText = this.add.text(0, 46, enemySummary, {
        fontSize: '14px',
        fontFamily: 'Arial',
        color: '#ffccaa',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5, 0);
      container.add(enemyText);
    }

    // Telegraph (left) + Gold bonus (right)
    if (telegraph) {
      const telegraphText = this.add.text(-bannerW / 2 + 14, bannerH - 22, `"${telegraph}"`, {
        fontSize: '11px',
        fontFamily: 'Arial',
        fontStyle: 'italic',
        color: '#aaccff',
      }).setOrigin(0, 0);
      container.add(telegraphText);
    }

    const goldBonusPreview = this.add.text(bannerW / 2 - 14, bannerH - 22, `+${goldBonus}g 💰 wave bonus`, {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#ffd700',
    }).setOrigin(1, 0);
    container.add(goldBonusPreview);

    this.waveBannerContainer = container;

    // Slide in from top
    this.tweens.add({
      targets: container,
      y: 58, // just below top HUD bar row
      duration: 400,
      ease: 'Back.Out',
      onComplete: () => {
        // Hold 3 seconds then slide out
        this.time.delayedCall(3000, () => {
          if (!container.active) return;
          this.tweens.add({
            targets: container,
            y: -bannerH - 20,
            duration: 350,
            ease: 'Back.In',
            onComplete: () => {
              container.destroy();
              if (this.waveBannerContainer === container) {
                this.waveBannerContainer = null;
              }
            },
          });
        });
      },
    });
  }

  /** Called by GameClient when a tower fires — used for MVP tracking. */
  recordTowerShot(towerId: string, configId: string): void {
    const entry = this.statsTowerShots.get(towerId);
    if (entry) {
      entry.shots++;
    } else {
      this.statsTowerShots.set(towerId, { configId, shots: 1 });
    }
  }

  /** Return current match stats for ResultScene. */
  getMatchStats(): {
    enemiesKilled: number;
    goldEarned: number;
    towersBuilt: number;
    mvpTowerName: string | null;
  } {
    let mvpTowerName: string | null = null;
    let maxShots = 0;
    for (const [, entry] of this.statsTowerShots) {
      if (entry.shots > maxShots) {
        maxShots = entry.shots;
        mvpTowerName = TOWER_CONFIGS[entry.configId]?.name ?? entry.configId;
      }
    }
    return {
      enemiesKilled: this.statsEnemiesKilled,
      goldEarned: this.statsGoldEarned,
      towersBuilt: this.statsTowersBuilt,
      mvpTowerName,
    };
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

    const edgeW = 80;
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
    const bonus = this.lastWaveGoldReward;
    this.goldBonusText = this.add.text(W / 2, 130, `+${bonus} gold 💰`, {
      fontSize: '22px',
      fontFamily: '"Arial Black", Arial',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setAlpha(0);

    this.tweens.add({
      targets: this.goldBonusText,
      alpha: 1,
      y: 125,
      duration: 400,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: this.goldBonusText,
          alpha: 0,
          y: 115,
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

  // ─────────────────────────────────────────────────────────────────
  // Chat System
  // ─────────────────────────────────────────────────────────────────

  private setupChatSystem(): void {
    if (!this.input.keyboard) return;

    // Enter key → open chat input (if not already open)
    const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    enterKey.on('down', () => {
      if (!this.chatInputActive) {
        this.openChatInput();
      }
    });
  }

  private openChatInput(): void {
    if (this.chatInputActive) return;
    this.chatInputActive = true;

    // Create a native DOM input for full keyboard capture
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 128;
    input.placeholder = 'Type a message… (Enter to send, Escape to cancel)';
    input.style.cssText = [
      'position: absolute',
      'bottom: 18px',
      'left: 50%',
      'transform: translateX(-50%)',
      'width: 55%',
      'padding: 7px 14px',
      'background: rgba(0,0,10,0.88)',
      'color: #ffffff',
      'border: 1.5px solid #4488aa',
      'border-radius: 6px',
      'font-size: 14px',
      'font-family: Arial',
      'outline: none',
      'z-index: 2000',
      'box-sizing: border-box',
    ].join(';');

    document.body.appendChild(input);
    input.focus();
    this.chatInputEl = input;

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const msg = input.value.trim();
        if (msg) {
          const gameClient = this.registry.get('gameClient') as GameClient;
          gameClient?.sendChat(msg).catch((err: unknown) => console.error('Chat error:', err));
        }
        this.closeChatInput();
      } else if (e.key === 'Escape') {
        this.closeChatInput();
      }
    });
  }

  private closeChatInput(): void {
    if (!this.chatInputActive) return;
    this.chatInputActive = false;
    if (this.chatInputEl) {
      this.chatInputEl.remove();
      this.chatInputEl = null;
    }
  }

  /** Called by GameClient when a wave_completed event is received. */
  receiveWaveCompleted(goldReward: number): void {
    this.lastWaveGoldReward = goldReward;
  }

  /** Called by GameClient when a chat_message event is received. */
  receiveChatMessage(sender: string, text: string): void {
    const now = Date.now();
    this.chatMessages.push({ sender, text, time: now });
    if (this.chatMessages.length > 5) this.chatMessages.shift();
    this.rebuildChatOverlay();
  }

  private rebuildChatOverlay(): void {
    // Destroy existing message objects
    for (const obj of this.chatMsgObjects) {
      if (obj.active) obj.destroy();
    }
    this.chatMsgObjects = [];

    if (this.chatMessages.length === 0) return;

    const H = this.cameras.main.height;
    const baseY = H - 80; // above the bottom UI

    this.chatMessages.forEach((msg, i) => {
      const rowY = baseY - (this.chatMessages.length - 1 - i) * 24;
      const fullText = `${msg.sender}: ${msg.text}`;

      const container = this.add.container(14, rowY);
      container.setScrollFactor(0);
      container.setDepth(150);

      // Background pill
      const textObj = this.add.text(8, 0, fullText, {
        fontSize: '13px',
        fontFamily: 'Arial',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 1,
      }).setOrigin(0, 0.5);

      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.65);
      bg.fillRoundedRect(-2, -11, textObj.width + 20, 22, 4);

      container.add([bg, textObj]);

      // Fade out after 10 s from when message was received
      const elapsed = Date.now() - msg.time;
      const remaining = Math.max(0, 10000 - elapsed);

      this.time.delayedCall(remaining, () => {
        if (!container.active) return;
        this.tweens.add({
          targets: container,
          alpha: 0,
          duration: 600,
          onComplete: () => {
            container.destroy();
            const idx = this.chatMessages.indexOf(msg);
            if (idx >= 0) {
              this.chatMessages.splice(idx, 1);
              this.rebuildChatOverlay();
            }
          },
        });
      });

      this.chatMsgObjects.push(container);
    });
  }

  showBaseDamage(damage: number): void {
    this.showDamageIndicator(0, damage);
  }

  // ─────────────────────────────────────────────────────────────────
  // Sell Panel
  // ─────────────────────────────────────────────────────────────────

  showSellPanel(
    instanceId: string,
    configId: string,
    refund: number,
    onSell: () => void
  ): void {
    this.hideSellPanel();

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const cfg = TOWER_CONFIGS[configId];
    const towerName = cfg?.name ?? configId;

    const panelW = 200;
    const panelH = 120;
    const px = W - panelW / 2 - 20;   // right side (above tower panel area)
    const py = H - panelH / 2 - 80;

    const container = this.add.container(px, py);
    container.setScrollFactor(0).setDepth(110);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a22, 0.93);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 10);
    bg.lineStyle(2, 0xffd700, 0.9);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 10);

    // Tower name
    const nameText = this.add.text(0, -panelH / 2 + 16, towerName, {
      fontSize: '13px',
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Refund amount
    const refundText = this.add.text(0, -panelH / 2 + 36, `Sell for 💰 ${refund}g`, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#ffd700',
    }).setOrigin(0.5);

    // Sell button
    const btnW = 80;
    const btnH = 30;
    const sellBtnGfx = this.add.graphics();
    const drawSellBtn = (hover: boolean) => {
      sellBtnGfx.clear();
      sellBtnGfx.fillStyle(hover ? 0xee4400 : 0xcc2200, 1);
      sellBtnGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
      sellBtnGfx.lineStyle(1, 0xff6644, 0.8);
      sellBtnGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
    };
    drawSellBtn(false);
    sellBtnGfx.setPosition(-44, panelH / 2 - 22);

    const sellBtnText = this.add.text(-44, panelH / 2 - 22, '💰 SELL', {
      fontSize: '12px',
      fontFamily: '"Arial Black", Arial',
      color: '#ffffff',
    }).setOrigin(0.5);

    const sellHit = this.add.rectangle(-44, panelH / 2 - 22, btnW, btnH, 0, 0)
      .setInteractive({ useHandCursor: true });
    sellHit.on('pointerover', () => drawSellBtn(true));
    sellHit.on('pointerout', () => drawSellBtn(false));
    sellHit.on('pointerdown', () => {
      onSell();
      this.hideSellPanel();
    });

    // Close button
    const closeBtnGfx = this.add.graphics();
    const drawCloseBtn = (hover: boolean) => {
      closeBtnGfx.clear();
      closeBtnGfx.fillStyle(hover ? 0x555577 : 0x333355, 1);
      closeBtnGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
      closeBtnGfx.lineStyle(1, 0x6666aa, 0.8);
      closeBtnGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
    };
    drawCloseBtn(false);
    closeBtnGfx.setPosition(44, panelH / 2 - 22);

    const closeBtnText = this.add.text(44, panelH / 2 - 22, '✕ Cancel', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    const closeHit = this.add.rectangle(44, panelH / 2 - 22, btnW, btnH, 0, 0)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerover', () => drawCloseBtn(true));
    closeHit.on('pointerout', () => drawCloseBtn(false));
    closeHit.on('pointerdown', () => this.hideSellPanel());

    container.add([
      bg,
      nameText,
      refundText,
      sellBtnGfx,
      sellBtnText,
      sellHit,
      closeBtnGfx,
      closeBtnText,
      closeHit,
    ]);

    // Pop-in animation
    container.setScale(0.8);
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 150,
      ease: 'Back.Out',
    });

    // Store instanceId for reference
    (container as unknown as { instanceId: string }).instanceId = instanceId;
    this.sellPanel = container;
  }

  hideSellPanel(): void {
    if (!this.sellPanel) return;
    const panel = this.sellPanel;
    this.sellPanel = null;
    this.tweens.add({
      targets: panel,
      alpha: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 120,
      ease: 'Power2.In',
      onComplete: () => panel.destroy(),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Tower Inspector (unified inspect/upgrade/sell panel)
  // ─────────────────────────────────────────────────────────────────

  showTowerInspector(
    instanceId: string,
    configId: string,
    tier: number,
    refund: number,
    ownerId?: string
  ): void {
    // Dismiss any existing inspector first
    this.hideTowerInspector();

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Full-screen backdrop that dismisses the inspector when clicked outside
    this.inspectorBackdrop = this.add
      .rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(200)
      .setInteractive();
    this.inspectorBackdrop.on('pointerdown', () => this.hideTowerInspector());

    // Position panel at right side of screen, centered vertically
    const panelX = W - 130;  // center of 240px panel, 10px from right edge
    const panelY = Math.max(60, H / 2 - 180); // top of panel

    const targetingMode = this.targetingModes.get(instanceId) ?? 'first';

    // Look up owner's name from latest game state
    let ownerName: string | undefined;
    if (ownerId && this.lastKnownState) {
      ownerName = this.lastKnownState.players[ownerId]?.name;
    }

    this.towerInspectorInst = new TowerInspector(this, panelX, panelY, {
      instanceId,
      configId,
      tier,
      refund,
      gold: this.hudGold,
      targetingMode,
      ownerName,

      onSell: () => {
        const gameClient = this.registry.get('gameClient') as GameClient;
        if (!gameClient) return;
        gameClient.sellTower(instanceId).then((result) => {
          if (result.ok) {
            this.hideTowerInspector();
            const gameScene = this.scene.get('GameScene');
            if (gameScene) {
              gameScene.events.emit('tower-sold-visual', {
                instanceId,
                goldRefund: result.goldRefund ?? refund,
              });
            }
          } else {
            console.warn('Sell rejected:', result.reason);
          }
        }).catch((err: unknown) => console.error('Sell error:', err));
      },

      onUpgrade: () => {
        const gameClient = this.registry.get('gameClient') as GameClient;
        if (!gameClient) return;
        gameClient.upgradeTower(instanceId).then((result) => {
          if (result.ok) {
            this.hideTowerInspector();
          } else {
            console.warn('Upgrade rejected:', result.reason);
          }
        }).catch((err: unknown) => console.error('Upgrade error:', err));
      },

      onTargetingChange: (mode: TargetingMode) => {
        this.targetingModes.set(instanceId, mode);
      },

      onDismiss: () => this.hideTowerInspector(),
    });
  }

  hideTowerInspector(): void {
    if (this.towerInspectorInst) {
      this.towerInspectorInst.destroy();
      this.towerInspectorInst = null;
    }
    if (this.inspectorBackdrop) {
      this.inspectorBackdrop.destroy();
      this.inspectorBackdrop = null;
    }
  }

}
