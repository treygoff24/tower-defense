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
  private targetingModes: Map<string, TargetingMode> = new Map();
  private hudGold = 0;

  /* Tracking for polish features */
  private lastWaveText = '';
  private hpLowPulseTween: Phaser.Tweens.Tween | null = null;
  private lastAnnouncedPhase: GamePhase | null = null;
  private combatVignetteGfx: Phaser.GameObjects.Graphics | null = null;
  private startWavePulseTween: Phaser.Tweens.Tween | null = null;
  private prepPhasePulseTween: Phaser.Tweens.Tween | null = null;
  private goldBonusText: Phaser.GameObjects.Text | null = null;

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
    const panelX = W - 110;  // 210px wide panel, centered 110px from right
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
    const goldBonus = wave * 10 + 20;

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
    const bonus = 50; // standard wave-clear bonus
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
    refund: number
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

    this.towerInspectorInst = new TowerInspector(this, panelX, panelY, {
      instanceId,
      configId,
      tier,
      refund,
      gold: this.hudGold,
      targetingMode,

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
