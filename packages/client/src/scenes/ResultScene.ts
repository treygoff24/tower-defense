// packages/client/src/scenes/ResultScene.ts
import Phaser from 'phaser';

export interface ResultSceneData {
  phase: 'victory' | 'defeat';
  wave: number;
  maxWaves: number;
  enemiesKilled: number;
  goldEarned: number;
  towersBuilt: number;
  mvpTowerName: string | null;
}

export class ResultScene extends Phaser.Scene {
  private data_!: ResultSceneData;

  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data: ResultSceneData): void {
    this.data_ = data;
  }

  create(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const d = this.data_;
    const isVictory = d.phase === 'victory';

    // ── Full-screen dim overlay ──────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82)
      .setScrollFactor(0)
      .setDepth(0);

    const accentColor = isVictory ? 0xffd700 : 0xff3333;
    const accentHex = isVictory ? '#ffd700' : '#ff3333';

    // ── Decorative horizontal bars ──────────────────────────────
    const topBar = this.add.graphics().setDepth(1);
    topBar.fillStyle(accentColor, 0.6);
    topBar.fillRect(0, H / 2 - 220, W, 3);
    topBar.fillRect(0, H / 2 + 210, W, 3);

    // ── Main title ───────────────────────────────────────────────
    const titleStr = isVictory
      ? '🏆 VICTORY!'
      : `💀 DEFEAT`;
    const title = this.add.text(W / 2, H / 2 - 190, titleStr, {
      fontSize: '72px',
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: accentHex,
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5, 0).setDepth(2).setScale(0);

    this.tweens.add({
      targets: title,
      scale: 1,
      duration: 500,
      ease: 'Back.Out',
    });

    // ── Sub-title ────────────────────────────────────────────────
    const subStr = isVictory
      ? `You survived all ${d.maxWaves} waves!`
      : `Wave ${d.wave} was your doom`;
    this.add.text(W / 2, H / 2 - 110, subStr, {
      fontSize: '22px',
      fontFamily: 'Arial',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(2).setAlpha(0);

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      delay: 300,
      duration: 400,
    });

    // ── Stats panel ──────────────────────────────────────────────
    const panelW = 480;
    const panelH = 180;
    const panelX = W / 2 - panelW / 2;
    const panelY = H / 2 - 70;

    const panelBg = this.add.graphics().setDepth(2);
    panelBg.fillStyle(0x0a0a22, 0.9);
    panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    panelBg.lineStyle(2, accentColor, 0.7);
    panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
    panelBg.setAlpha(0);
    this.tweens.add({ targets: panelBg, alpha: 1, delay: 400, duration: 400 });

    const statRows: Array<{ label: string; value: string }> = [
      { label: '🌊 Waves Survived', value: isVictory ? `${d.maxWaves} / ${d.maxWaves}` : `${d.wave - 1} / ${d.maxWaves}` },
      { label: '💀 Enemies Killed', value: d.enemiesKilled.toString() },
      { label: '💰 Gold Earned', value: `${d.goldEarned}g` },
      { label: '🏗 Towers Built', value: d.towersBuilt.toString() },
    ];

    const rowH = 36;
    const startY = panelY + 16;
    const col1X = panelX + 24;
    const col2X = panelX + panelW - 24;

    statRows.forEach((row, i) => {
      const rowY = startY + i * rowH;
      const delay = 500 + i * 80;

      const lbl = this.add.text(col1X, rowY + rowH / 2, row.label, {
        fontSize: '15px',
        fontFamily: 'Arial',
        color: '#aabbcc',
      }).setOrigin(0, 0.5).setDepth(3).setAlpha(0);
      this.tweens.add({ targets: lbl, alpha: 1, delay, duration: 300 });

      const val = this.add.text(col2X, rowY + rowH / 2, row.value, {
        fontSize: '16px',
        fontFamily: '"Arial Black", Arial',
        color: '#ffffff',
      }).setOrigin(1, 0.5).setDepth(3).setAlpha(0);
      this.tweens.add({ targets: val, alpha: 1, delay, duration: 300 });

      // Subtle separator line
      if (i < statRows.length - 1) {
        const sep = this.add.graphics().setDepth(3).setAlpha(0);
        sep.lineStyle(1, 0x444466, 0.6);
        sep.lineBetween(col1X, rowY + rowH, col2X, rowY + rowH);
        this.tweens.add({ targets: sep, alpha: 1, delay: delay + 100, duration: 200 });
      }
    });

    // ── MVP Tower row ────────────────────────────────────────────
    if (d.mvpTowerName) {
      const mvpY = panelY + panelH + 12;
      const mvpText = this.add.text(W / 2, mvpY, `⭐ Most Active Tower: ${d.mvpTowerName}`, {
        fontSize: '14px',
        fontFamily: 'Arial',
        fontStyle: 'italic',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5, 0).setDepth(2).setAlpha(0);
      this.tweens.add({ targets: mvpText, alpha: 1, delay: 900, duration: 400 });
    }

    // ── Play Again button ────────────────────────────────────────
    const btnY = H / 2 + 148;
    this.createPlayAgainButton(W / 2, btnY);

    // ── Victory particles ────────────────────────────────────────
    if (isVictory) {
      this.spawnVictoryParticles(W, H);
    }
  }

  private createPlayAgainButton(cx: number, cy: number): void {
    const btnW = 240;
    const btnH = 52;

    const gfx = this.add.graphics().setDepth(3);
    const draw = (state: 'normal' | 'hover' | 'pressed') => {
      gfx.clear();
      // Shadow
      gfx.fillStyle(0x000000, 0.4);
      gfx.fillRoundedRect(cx - btnW / 2 + 2, cy - btnH / 2 + 3, btnW, btnH, 10);
      // Body
      const fills = { normal: 0x0050aa, hover: 0x0066cc, pressed: 0x003d88 };
      gfx.fillStyle(fills[state], 1);
      gfx.fillRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 10);
      // Top highlight
      gfx.fillStyle(0xffffff, state === 'hover' ? 0.15 : 0.08);
      gfx.fillRoundedRect(cx - btnW / 2 + 2, cy - btnH / 2 + 1, btnW - 4, btnH / 2 - 2, {
        tl: 8, tr: 8, bl: 0, br: 0,
      });
      // Border
      gfx.lineStyle(2, state === 'hover' ? 0x66aaff : 0x4488ff, 0.9);
      gfx.strokeRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 10);
    };
    draw('normal');

    const label = this.add.text(cx, cy, '🔄  Play Again', {
      fontSize: '20px',
      fontFamily: '"Arial Black", Arial',
      color: '#ffffff',
      stroke: '#001133',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(4);

    const hit = this.add.rectangle(cx, cy, btnW, btnH, 0, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(5);

    hit.on('pointerover', () => draw('hover'));
    hit.on('pointerout', () => draw('normal'));
    hit.on('pointerdown', () => draw('pressed'));
    hit.on('pointerup', () => {
      draw('normal');
      this.events.emit('play_again');
      // Stop all scenes and return to lobby
      this.scene.stop('ResultScene');
      this.scene.stop('GameScene');
      this.scene.stop('HudScene');
      this.scene.start('LobbyScene');
    });

    // Pulse animation on button
    this.tweens.add({
      targets: [gfx, label],
      scaleX: 1.03,
      scaleY: 1.03,
      delay: 1200,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    gfx.setAlpha(0);
    label.setAlpha(0);
    this.tweens.add({ targets: [gfx, label], alpha: 1, delay: 1000, duration: 400 });
  }

  private spawnVictoryParticles(W: number, H: number): void {
    const colors = [0xffd700, 0xff8800, 0xffff00, 0x00ff88, 0xff44ff, 0x44ffff];
    for (let i = 0; i < 80; i++) {
      this.time.delayedCall(i * 40, () => {
        const x = Math.random() * W;
        const circle = this.add.circle(x, H + 20, 4 + Math.random() * 6, colors[Math.floor(Math.random() * colors.length)])
          .setDepth(1);
        this.tweens.add({
          targets: circle,
          y: -20,
          x: x + (Math.random() - 0.5) * 120,
          alpha: 0,
          duration: 1800 + Math.random() * 1800,
          ease: 'Linear',
          onComplete: () => { circle.destroy(); },
        });
      });
    }
  }
}
