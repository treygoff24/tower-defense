import Phaser from 'phaser';
import { GameClient } from '../GameClient';
import { S } from '../dpr';

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
      banner.setDisplaySize(320 * S, 90 * S);
      banner.setAlpha(0.55);
    } else {
      const panelG = this.add.graphics();
      panelG.fillStyle(0x0d1a30, 0.9);
      panelG.fillRoundedRect(W / 2 - 280 * S, H * 0.14, 560 * S, 100 * S, 16 * S);
      panelG.lineStyle(2 * S, 0x4466aa, 0.8);
      panelG.strokeRoundedRect(W / 2 - 280 * S, H * 0.14, 560 * S, 100 * S, 16 * S);
    }

    // Title glow layer
    const titleGlow = this.add.text(W / 2, H * 0.19 + 2 * S, '⚔  ELEMENT DEFENSE  ⚔', {
      fontSize: `${44 * S}px`,
      fontFamily: '"Arial Black", Arial',
      color: '#001122',
    }).setOrigin(0.5).setAlpha(0.5);

    const title = this.add.text(W / 2, H * 0.19, '⚔  ELEMENT DEFENSE  ⚔', {
      fontSize: `${44 * S}px`,
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#442200',
      strokeThickness: 5 * S,
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
      fontSize: `${18 * S}px`,
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
    const spacing = 130 * S;
    const startX = W / 2 - (elements.length - 1) * spacing / 2;
    elements.forEach((el, i) => {
      const bx = startX + i * spacing;

      // Wrap badge in a Container so tween moves everything together
      const badgeContainer = this.add.container(bx, badgeY);

      const bg = this.add.graphics();
      bg.fillStyle(0x0d1a30, 0.8);
      bg.fillCircle(0, 0, 32 * S);
      bg.lineStyle(2 * S, Phaser.Display.Color.HexStringToColor(el.color).color, 0.9);
      bg.strokeCircle(0, 0, 32 * S);

      const iconText = this.add.text(0, -6 * S, el.icon, { fontSize: `${26 * S}px` }).setOrigin(0.5);
      const nameText = this.add.text(0, 22 * S, el.name, { fontSize: `${11 * S}px`, fontFamily: 'Arial', color: el.color }).setOrigin(0.5);

      badgeContainer.add([bg, iconText, nameText]);

      // Float animation: bobs 5 px upward then back
      this.tweens.add({
        targets: badgeContainer,
        y: badgeY - 5 * S,
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
      table.setDisplaySize(340 * S, 120 * S);
      table.setAlpha(0.75);
    }

    this.add.text(W / 2, H * 0.49, 'PLAYER NAME', {
      fontSize: `${13 * S}px`,
      fontFamily: '"Arial Black", Arial',
      color: '#7788aa',
      letterSpacing: 4 * S,
    }).setOrigin(0.5);

    const inputBg = this.add.graphics();
    const inputW = 240 * S;
    const inputH = 44 * S;
    const inputR = 10 * S;
    const inputX = W / 2 - inputW / 2;
    const inputY = H * 0.52;
    inputBg.fillStyle(0x0d1a30, 0.9);
    inputBg.fillRoundedRect(inputX, inputY, inputW, inputH, inputR);
    inputBg.lineStyle(2 * S, 0x224466, 1);
    inputBg.strokeRoundedRect(inputX, inputY, inputW, inputH, inputR);

    const nameText = this.add.text(W / 2, inputY + inputH / 2, this.playerName, {
      fontSize: `${22 * S}px`,
      fontFamily: '"Arial Black", Arial',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Cursor blink
    const cursor = this.add.text(W / 2 + nameText.width / 2 + 2 * S, inputY + inputH / 2, '|', {
      fontSize: `${22 * S}px`, fontFamily: 'Arial', color: '#00ff88',
    }).setOrigin(0, 0.5);
    this.tweens.add({
      targets: cursor,
      alpha: 0,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    const inputHit = this.add.rectangle(W / 2, inputY + inputH / 2, inputW, inputH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    inputHit.on('pointerover', () => {
      inputBg.clear();
      inputBg.fillStyle(0x0d2244, 0.95);
      inputBg.fillRoundedRect(inputX, inputY, inputW, inputH, inputR);
      inputBg.lineStyle(2 * S, 0x00ff88, 1);
      inputBg.strokeRoundedRect(inputX, inputY, inputW, inputH, inputR);
    });
    inputHit.on('pointerout', () => {
      inputBg.clear();
      inputBg.fillStyle(0x0d1a30, 0.9);
      inputBg.fillRoundedRect(inputX, inputY, inputW, inputH, inputR);
      inputBg.lineStyle(2 * S, 0x224466, 1);
      inputBg.strokeRoundedRect(inputX, inputY, inputW, inputH, inputR);
    });
    inputHit.on('pointerdown', () => {
      this.openNameInput(inputX, inputY, inputW, inputH, nameText, cursor, W);
    });

    // ── Join button ───────────────────────────────────────────────
    const btnY = H * 0.65;
    const joinBtn = this.createButton(W / 2, btnY, '⚔  JOIN GAME  ⚔', () => {
      this.handleJoinRequest();
    });
    joinBtn; // reference kept

    // ── How to play hint ──────────────────────────────────────────
    this.add.text(W / 2, H * 0.77, '🎮  Place towers during PREP phase  •  Work together  •  Survive all waves  🎮', {
      fontSize: `${13 * S}px`,
      fontFamily: 'Arial',
      color: '#556677',
      align: 'center',
    }).setOrigin(0.5);

    // ── Version ───────────────────────────────────────────────────
    this.add.text(W - 16 * S, H - 16 * S, 'v0.1.0  ·  Element Defense', {
      fontSize: `${12 * S}px`, fontFamily: 'Arial', color: '#334455',
    }).setOrigin(1, 1);

    // ── Fade in ───────────────────────────────────────────────────
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  /**
   * Positions a native HTML <input> over the Phaser name field so the player
   * can edit their name with full browser text-editing support (cursor, selection,
   * backspace, mobile keyboard, etc.) — no modal prompt.
   *
   * Coordinate mapping:
   *   canvas-space px / canvasW * 100  → % of viewport width  (left, width)
   *   canvas-space px / canvasH * 100  → % of viewport height (top, height)
   * The #game-container canvas is CSS-stretched to fill 100vw × 100vh.
   */
  private openNameInput(
    inputX: number,
    inputY: number,
    inputW: number,
    inputH: number,
    nameText: Phaser.GameObjects.Text,
    cursor: Phaser.GameObjects.Text,
    W: number,
  ): void {
    const H = this.cameras.main.height;

    // Create the element once; replace it each open to wipe stale listeners.
    const old = document.getElementById('player-name-input');
    const input = document.createElement('input');
    input.id = 'player-name-input';
    input.type = 'text';
    input.maxLength = 16;

    if (old) {
      old.parentNode?.replaceChild(input, old);
    } else {
      document.body.appendChild(input);
    }

    // Map canvas-space coordinates → CSS viewport percentages.
    input.style.left   = `${(inputX / W) * 100}vw`;
    input.style.top    = `${(inputY / H) * 100}vh`;
    input.style.width  = `${(inputW / W) * 100}vw`;
    input.style.height = `${(inputH / H) * 100}vh`;
    // Font size scales with viewport width, matching the canvas horizontal scale.
    input.style.fontSize = `${((22 * S) / W) * 100}vw`;

    input.value = this.playerName;
    input.style.display = 'block';

    // Hide the Phaser text objects while the HTML input is active to avoid ghost/double text.
    nameText.setVisible(false);
    cursor.setVisible(false);

    // Focus after a microtask so Phaser's pointerdown doesn't immediately blur it.
    setTimeout(() => { input.focus(); input.select(); }, 0);

    const commit = () => {
      const val = input.value.trim();
      if (val) {
        this.playerName = val.slice(0, 16);
        nameText.setText(this.playerName);
        cursor.setX(W / 2 + nameText.width / 2 + 2 * S);
      }
      input.style.display = 'none';
      nameText.setVisible(true);
      cursor.setVisible(true);
    };

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        commit();
      }
    });
    input.addEventListener('blur', commit);
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const btnW = 260 * S;
    const btnH = 54 * S;
    const r = 10 * S;

    const gfx = this.add.graphics();
    const drawBtn = (hover: boolean, pressed: boolean) => {
      gfx.clear();
      // Shadow
      gfx.fillStyle(0x000000, 0.35);
      gfx.fillRoundedRect(-btnW / 2 + 2 * S, -btnH / 2 + 3 * S, btnW, btnH, r);
      // Body
      const bodyColor = pressed ? 0x003d1a : hover ? 0x006633 : 0x004d28;
      gfx.fillStyle(bodyColor, 1);
      gfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, r);
      // Top highlight
      gfx.fillStyle(0xffffff, hover ? 0.12 : 0.06);
      gfx.fillRoundedRect(-btnW / 2 + 2 * S, -btnH / 2 + S, btnW - 4 * S, btnH / 2 - 2 * S, { tl: 8 * S, tr: 8 * S, bl: 0, br: 0 });
      // Border
      const borderColor = hover ? 0x00ff88 : 0x00cc66;
      gfx.lineStyle(2 * S, borderColor, hover ? 1 : 0.8);
      gfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, r);
    };
    drawBtn(false, false);

    const txt = this.add.text(0, 0, label, {
      fontSize: `${20 * S}px`,
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#002211',
      strokeThickness: 3 * S,
    }).setOrigin(0.5);

    const hitArea = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => { drawBtn(true, false); });
    hitArea.on('pointerout', () => { drawBtn(false, false); });
    hitArea.on('pointerdown', () => {
      drawBtn(true, true);
      this.tweens.add({ targets: container, scaleX: 0.96, scaleY: 0.96, duration: 60, yoyo: true });
    });
    hitArea.on('pointerup', () => {
      drawBtn(false, false);
      onClick();
    });

    container.add([gfx, txt, hitArea]);
    return container;
  }

  private createStarfield(W: number, H: number): void {
    const g = this.add.graphics();
    for (let i = 0; i < 120; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * H;
      const size = (Math.random() < 0.8 ? 1 : 2) * S;
      const alpha = 0.3 + Math.random() * 0.5;
      g.fillStyle(0xffffff, alpha);
      g.fillRect(sx, sy, size, size);
    }
    // Twinkle a few
    for (let i = 0; i < 15; i++) {
      const star = this.add.circle(
        Math.random() * W,
        Math.random() * H,
        1.5 * S,
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
        80 * S + Math.random() * (H * 0.6),
        key
      );
      cloud.setAlpha(0.08 + Math.random() * 0.07);
      cloud.setScale((0.25 + Math.random() * 0.2) * S);
      cloud.setDepth(1);
      const speed = 12 + Math.random() * 18;
      this.tweens.add({
        targets: cloud,
        x: W + 200 * S,
        duration: ((W + 400 * S) / speed) * 1000,
        repeat: -1,
        onRepeat: () => { cloud.x = -200 * S; cloud.y = 80 * S + Math.random() * (H * 0.6); },
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
