import Phaser from 'phaser';
import { GameClient } from '../GameClient';

export class LobbyScene extends Phaser.Scene {
  private playerName: string = 'Player';

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── Background ────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor('#0a0f1a');

    // Subtle starfield
    this.createStarfield(W, H);

    // Floating clouds (if loaded)
    this.addFloatingClouds(W, H);

    // ── Title card ────────────────────────────────────────────────
    // Use Tiny Swords banner image if loaded, otherwise fallback graphics
    // Banner.png is 704×512 — use as a small decorative accent behind the title
    if (this.textures.exists('ui_banner')) {
      const banner = this.add.image(W / 2, H * 0.19, 'ui_banner');
      banner.setDisplaySize(320, 90); // small accent — does not dominate
      banner.setAlpha(0.55);
    } else {
      const panelG = this.add.graphics();
      panelG.fillStyle(0x0d1a30, 0.9);
      panelG.fillRoundedRect(W / 2 - 280, H * 0.14, 560, 100, 16);
      panelG.lineStyle(2, 0x4466aa, 0.8);
      panelG.strokeRoundedRect(W / 2 - 280, H * 0.14, 560, 100, 16);
    }

    // Title glow layer
    const titleGlow = this.add.text(W / 2, H * 0.19 + 2, '⚔  ELEMENT DEFENSE  ⚔', {
      fontSize: '44px',
      fontFamily: '"Arial Black", Arial',
      color: '#001122',
    }).setOrigin(0.5).setAlpha(0.5);

    const title = this.add.text(W / 2, H * 0.19, '⚔  ELEMENT DEFENSE  ⚔', {
      fontSize: '44px',
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#442200',
      strokeThickness: 5,
    }).setOrigin(0.5);

    // Subtle title breathing tween
    this.tweens.add({
      targets: [title, titleGlow],
      scaleX: 1.015,
      scaleY: 1.015,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.add.text(W / 2, H * 0.26, 'Cooperative Multiplayer Tower Defense', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#8899bb',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // ── Element badges ────────────────────────────────────────────
    const elements = [
      { icon: '🔥', name: 'Fire',   color: '#ff6644' },
      { icon: '💧', name: 'Water',  color: '#44aaff' },
      { icon: '❄',  name: 'Ice',    color: '#aaddff' },
      { icon: '☠',  name: 'Poison', color: '#66ff44' },
    ];
    const badgeY = H * 0.36;
    const spacing = 130;
    const startX = W / 2 - (elements.length - 1) * spacing / 2;
    elements.forEach((el, i) => {
      const bx = startX + i * spacing;

      // Wrap badge in a Container so tween moves everything together
      const badgeContainer = this.add.container(bx, badgeY);

      const bg = this.add.graphics();
      bg.fillStyle(0x0d1a30, 0.8);
      bg.fillCircle(0, 0, 32);           // local origin (0,0)
      bg.lineStyle(2, Phaser.Display.Color.HexStringToColor(el.color).color, 0.9);
      bg.strokeCircle(0, 0, 32);

      const iconText = this.add.text(0, -6, el.icon, { fontSize: '26px' }).setOrigin(0.5);
      const nameText = this.add.text(0, 22, el.name, { fontSize: '11px', fontFamily: 'Arial', color: el.color }).setOrigin(0.5);

      badgeContainer.add([bg, iconText, nameText]);

      // Float animation: bobs 5 px upward then back — correct because we tween container.y
      this.tweens.add({
        targets: badgeContainer,
        y: badgeY - 5,
        duration: 1500 + i * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    });

    // ── Name input ────────────────────────────────────────────────
    // WoodTable backdrop behind the input section
    if (this.textures.exists('ui_wood_table')) {
      const table = this.add.image(W / 2, H * 0.545, 'ui_wood_table');
      table.setDisplaySize(340, 120);
      table.setAlpha(0.75);
    }

    this.add.text(W / 2, H * 0.49, 'PLAYER NAME', {
      fontSize: '13px',
      fontFamily: '"Arial Black", Arial',
      color: '#7788aa',
      letterSpacing: 4,
    }).setOrigin(0.5);

    const inputBg = this.add.graphics();
    const inputX = W / 2 - 120;
    const inputY = H * 0.52;
    inputBg.fillStyle(0x0d1a30, 0.9);
    inputBg.fillRoundedRect(inputX, inputY, 240, 44, 10);
    inputBg.lineStyle(2, 0x224466, 1);
    inputBg.strokeRoundedRect(inputX, inputY, 240, 44, 10);

    const nameText = this.add.text(W / 2, inputY + 22, this.playerName, {
      fontSize: '22px',
      fontFamily: '"Arial Black", Arial',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Cursor blink
    const cursor = this.add.text(W / 2 + nameText.width / 2 + 2, inputY + 22, '|', {
      fontSize: '22px', fontFamily: 'Arial', color: '#00ff88',
    }).setOrigin(0, 0.5);
    this.tweens.add({
      targets: cursor,
      alpha: 0,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    const inputHit = this.add.rectangle(W / 2, inputY + 22, 240, 44, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    inputHit.on('pointerover', () => {
      inputBg.clear();
      inputBg.fillStyle(0x0d2244, 0.95);
      inputBg.fillRoundedRect(inputX, inputY, 240, 44, 10);
      inputBg.lineStyle(2, 0x00ff88, 1);
      inputBg.strokeRoundedRect(inputX, inputY, 240, 44, 10);
    });
    inputHit.on('pointerout', () => {
      inputBg.clear();
      inputBg.fillStyle(0x0d1a30, 0.9);
      inputBg.fillRoundedRect(inputX, inputY, 240, 44, 10);
      inputBg.lineStyle(2, 0x224466, 1);
      inputBg.strokeRoundedRect(inputX, inputY, 240, 44, 10);
    });
    inputHit.on('pointerdown', () => {
      const entered = prompt('Enter your name:', this.playerName);
      if (entered && entered.trim()) {
        this.playerName = entered.trim().slice(0, 16);
        nameText.setText(this.playerName);
        cursor.setX(W / 2 + nameText.width / 2 + 2);
      }
    });

    // ── Join button ───────────────────────────────────────────────
    const btnY = H * 0.65;
    const joinBtn = this.createButton(W / 2, btnY, '⚔  JOIN GAME  ⚔', () => {
      this.handleJoinRequest();
    });
    joinBtn; // reference kept

    // ── How to play hint ──────────────────────────────────────────
    this.add.text(W / 2, H * 0.77, '🎮  Place towers during PREP phase  •  Work together  •  Survive all waves  🎮', {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: '#556677',
      align: 'center',
    }).setOrigin(0.5);

    // ── Version ───────────────────────────────────────────────────
    this.add.text(W - 16, H - 16, 'v0.1.0  ·  Element Defense', {
      fontSize: '12px', fontFamily: 'Arial', color: '#334455',
    }).setOrigin(1, 1);

    // ── Fade in ───────────────────────────────────────────────────
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const useSprite = this.textures.exists('ui_btn_blue_regular') && this.textures.exists('ui_btn_blue_pressed');

    if (useSprite) {
      // Tiny Swords sprite button (320×320 source, displayed at 240×60)
      const btnImg = this.add.image(0, 0, 'ui_btn_blue_regular');
      btnImg.setDisplaySize(240, 60);

      const txt = this.add.text(0, -3, label, {
        fontSize: '20px',
        fontFamily: '"Arial Black", Arial',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#001133',
        strokeThickness: 3,
      }).setOrigin(0.5);

      const hitArea = this.add.rectangle(0, 0, 240, 60, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      hitArea.on('pointerover', () => { btnImg.setTexture('ui_btn_blue_pressed'); });
      hitArea.on('pointerout',  () => { btnImg.setTexture('ui_btn_blue_regular'); });
      hitArea.on('pointerdown', () => {
        btnImg.setTexture('ui_btn_blue_pressed');
        this.tweens.add({ targets: container, scaleX: 0.95, scaleY: 0.95, duration: 80, yoyo: true });
      });
      hitArea.on('pointerup', () => {
        btnImg.setTexture('ui_btn_blue_regular');
        onClick();
      });

      container.add([btnImg, txt, hitArea]);
    } else {
      // Fallback: drawn graphics button
      const gfx = this.add.graphics();
      const drawBtn = (hover: boolean) => {
        gfx.clear();
        gfx.fillStyle(hover ? 0x006633 : 0x004422, 1);
        gfx.fillRoundedRect(-110, -28, 220, 56, 12);
        gfx.lineStyle(2, hover ? 0x00ff88 : 0x008844, 1);
        gfx.strokeRoundedRect(-110, -28, 220, 56, 12);
      };
      drawBtn(false);

      const txt = this.add.text(0, 0, label, {
        fontSize: '22px',
        fontFamily: '"Arial Black", Arial',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#002211',
        strokeThickness: 3,
      }).setOrigin(0.5);

      const hitArea = this.add.rectangle(0, 0, 220, 56, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      hitArea.on('pointerover', () => { drawBtn(true); });
      hitArea.on('pointerout', () => { drawBtn(false); });
      hitArea.on('pointerdown', () => {
        this.tweens.add({ targets: container, scaleX: 0.95, scaleY: 0.95, duration: 80, yoyo: true });
      });
      hitArea.on('pointerup', () => { onClick(); });

      container.add([gfx, txt, hitArea]);
    }

    return container;
  }

  private createStarfield(W: number, H: number): void {
    const g = this.add.graphics();
    for (let i = 0; i < 120; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * H;
      const size = Math.random() < 0.8 ? 1 : 2;
      const alpha = 0.3 + Math.random() * 0.5;
      g.fillStyle(0xffffff, alpha);
      g.fillRect(sx, sy, size, size);
    }
    // Twinkle a few
    for (let i = 0; i < 15; i++) {
      const star = this.add.circle(
        Math.random() * W,
        Math.random() * H,
        1.5,
        0xffffff,
        0.8
      );
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: 800 + Math.random() * 1200,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 2000,
      });
    }
  }

  private addFloatingClouds(W: number, H: number): void {
    const cloudKeys = ['deco_cloud1', 'deco_cloud2'];
    for (let i = 0; i < 4; i++) {
      const key = cloudKeys[i % cloudKeys.length];
      if (!this.textures.exists(key)) continue;
      const cloud = this.add.image(
        Math.random() * W,
        80 + Math.random() * (H * 0.6),
        key
      );
      cloud.setAlpha(0.08 + Math.random() * 0.07);
      cloud.setScale(0.5 + Math.random() * 0.4);
      cloud.setDepth(-1);
      const speed = 12 + Math.random() * 18;
      this.tweens.add({
        targets: cloud,
        x: W + 200,
        duration: ((W + 400) / speed) * 1000,
        repeat: -1,
        onRepeat: () => { cloud.x = -200; cloud.y = 80 + Math.random() * (H * 0.6); },
      });
    }
  }

  private async handleJoinRequest(): Promise<void> {
    const gameClient = this.registry.get('gameClient') as GameClient;

    // Fade out
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', async () => {
      if (gameClient) {
        try {
          await gameClient.connect(this.playerName);
        } catch (err) {
          console.error('Failed to connect:', err);
        }
      }
      this.scene.start('ClassSelectScene');
    });
  }
}
