import Phaser from 'phaser';
import type { ElementType } from '@td/shared';
import { GameClient } from '../GameClient';

interface ClassCardData {
  element: ElementType;
  name: string;
  icon: string;
  description: string;
  color: number;
  buildingKey: string;
  soldierKey: string;
  towers: string[];
  passive: string;
}

const CLASS_CARDS: ClassCardData[] = [
  {
    element: 'fire',
    name: 'Pyromancer',
    icon: '🔥',
    description: 'Explosive grenades and fire DoT. Burns cut through enemy armor.',
    color: 0xff4400,
    buildingKey: 'building_yellow',
    soldierKey: 'tower_fire',
    towers: ['Flame Spire', 'Inferno Cannon', 'Magma Pool'],
    passive: 'Burn on hit',
  },
  {
    element: 'water',
    name: 'Hydromancer',
    icon: '💧',
    description: 'Splash damage + slow. Soaked enemies trigger powerful reactions.',
    color: 0x0088ff,
    buildingKey: 'building_blue',
    soldierKey: 'tower_water',
    towers: ['Tidal Tower', 'Geyser', 'Whirlpool'],
    passive: 'Soaked on hit',
  },
  {
    element: 'ice',
    name: 'Cryomancer',
    icon: '❄',
    description: 'Freeze and shatter. Stacking cold makes enemies brittle.',
    color: 0x88ccff,
    buildingKey: 'building_black',
    soldierKey: 'tower_ice',
    towers: ['Frost Turret', 'Blizzard Tower', 'Glacial Spike'],
    passive: 'Cold on hit',
  },
  {
    element: 'poison',
    name: 'Necromancer',
    icon: '☠',
    description: 'Venom spreads between enemies. Blight stacks deal massive damage over time.',
    color: 0x44cc44,
    buildingKey: 'building_purple',
    soldierKey: 'tower_poison',
    towers: ['Venom Spitter', 'Plague Spreader', 'Miasma Cloud'],
    passive: 'Toxin on hit',
  },
];

export class ClassSelectScene extends Phaser.Scene {
  private selectedClass: ElementType | null = null;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private readyButton!: Phaser.GameObjects.Container;
  private readyText!: Phaser.GameObjects.Text;
  private readyBg!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'ClassSelectScene' });
  }

  create(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── Background ────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor('#080818');
    this.createStarfield(W, H);

    // Subtle vignette overlay
    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.6, 0.6, 0.0, 0.0);
    vignette.fillRect(0, 0, W, H / 2);
    vignette.setDepth(0);

    // ── Title section ─────────────────────────────────────────────
    if (this.textures.exists('ui_banner')) {
      const titleBanner = this.add.image(W / 2, 58, 'ui_banner');
      titleBanner.setDisplaySize(660, 110);
      titleBanner.setAlpha(0.88).setDepth(1);
    } else {
      const titleBg = this.add.graphics();
      titleBg.fillStyle(0x0a0a20, 0.85);
      titleBg.fillRoundedRect(W / 2 - 300, 16, 600, 80, 12);
      titleBg.lineStyle(1, 0x4444aa, 0.8);
      titleBg.strokeRoundedRect(W / 2 - 300, 16, 600, 80, 12);
      titleBg.setDepth(1);
    }

    const titleGlow = this.add.text(W / 2, 42, '⚔  CHOOSE YOUR ELEMENT  ⚔', {
      fontSize: '34px',
      fontFamily: '"Arial Black", Arial',
      color: '#110800',
    }).setOrigin(0.5).setAlpha(0.45).setDepth(1);

    const title = this.add.text(W / 2, 40, '⚔  CHOOSE YOUR ELEMENT  ⚔', {
      fontSize: '34px',
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#441100',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2);

    this.tweens.add({
      targets: [title, titleGlow],
      scaleX: 1.012,
      scaleY: 1.012,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.add.text(W / 2, 76, "Select a class \u2014 your towers share your element's passive", {
      fontSize: '14px',
      fontFamily: 'Arial',
      fontStyle: 'italic',
      color: '#6677aa',
    }).setOrigin(0.5).setDepth(2);

    // Ribbon decoration below title
    if (this.textures.exists('ui_ribbon_small')) {
      const ribbon = this.add.image(W / 2, 105, 'ui_ribbon_small');
      ribbon.setDisplaySize(500, 28);
      ribbon.setAlpha(0.7).setDepth(2);
    }

    // ── Class cards ───────────────────────────────────────────────
    const cardWidth = 210;
    const cardHeight = 360;
    const spacing = 30;
    const totalWidth = CLASS_CARDS.length * cardWidth + (CLASS_CARDS.length - 1) * spacing;
    const startX = (W - totalWidth) / 2 + cardWidth / 2;
    const cardY = H / 2 + 10;

    CLASS_CARDS.forEach((classData, index) => {
      const cardX = startX + index * (cardWidth + spacing);
      const cardContainer = this.createClassCard(classData, cardX, cardY, cardWidth, cardHeight, index);
      this.cardContainers.push(cardContainer);
    });

    // ── Ready button ──────────────────────────────────────────────
    this.readyButton = this.createReadyButton(W / 2, H - 52);

    // Fade in
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  // ─────────────────────────────────────────────────────────────────
  // Background
  // ─────────────────────────────────────────────────────────────────

  private createStarfield(W: number, H: number): void {
    const g = this.add.graphics().setDepth(0);
    for (let i = 0; i < 100; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * H;
      const size = Math.random() < 0.8 ? 1 : 2;
      g.fillStyle(0xffffff, 0.2 + Math.random() * 0.4);
      g.fillRect(sx, sy, size, size);
    }
    for (let i = 0; i < 10; i++) {
      const star = this.add.circle(Math.random() * W, Math.random() * H, 1.5, 0xffffff, 0.7).setDepth(0);
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: 600 + Math.random() * 1400,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 2000,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Class card
  // ─────────────────────────────────────────────────────────────────

  private createClassCard(
    classData: ClassCardData,
    x: number,
    y: number,
    width: number,
    height: number,
    index: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(5);

    // ── Card background ───────────────────────────────────────────
    const bg = this.add.rectangle(0, 0, width, height, 0x14142a);
    bg.setStrokeStyle(2, classData.color, 0.85);
    bg.setInteractive({ useHandCursor: true });

    // ── Image viewport (upper portion of card) ────────────────────
    const viewH = 150;
    const viewBg = this.add.rectangle(0, -height / 2 + viewH / 2, width, viewH, 0x0a0a1a);

    // ── Building image ────────────────────────────────────────────
    const buildingY = -height / 2 + viewH - 20;
    let buildingObj: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    if (this.textures.exists(classData.buildingKey)) {
      buildingObj = this.add.image(0, buildingY, classData.buildingKey);
      (buildingObj as Phaser.GameObjects.Image).setScale(0.26);
      (buildingObj as Phaser.GameObjects.Image).setOrigin(0.5, 0.85);
      // Subtle tint from element color
      (buildingObj as Phaser.GameObjects.Image).setTint(
        Phaser.Display.Color.IntegerToColor(classData.color)
          .lighten(80).color
      );
    } else {
      buildingObj = this.add.rectangle(0, buildingY - 30, 60, 80, classData.color, 0.4);
    }

    // ── Soldier sprite (on top of building, frame 0 = idle row) ──
    const soldierY = -height / 2 + viewH - 60;
    let soldierSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc | null = null;
    if (this.textures.exists(classData.soldierKey)) {
      soldierSprite = this.add.sprite(-4, soldierY, classData.soldierKey, 0);
      soldierSprite.setScale(4);
      // Play idle animation if registered
      const idleAnim = `${classData.soldierKey}_idle`;
      if (this.anims.exists(idleAnim)) {
        soldierSprite.play(idleAnim);
      }
    } else {
      soldierSprite = this.add.circle(-4, soldierY, 14, classData.color);
    }

    // ── Element badge (corner pill) ───────────────────────────────
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(classData.color, 0.9);
    badgeBg.fillRoundedRect(width / 2 - 46, -height / 2 + 6, 40, 22, 6);
    const badgeText = this.add.text(width / 2 - 26, -height / 2 + 10, classData.icon, {
      fontSize: '14px',
    }).setOrigin(0.5, 0);

    // ── Divider ───────────────────────────────────────────────────
    const dividerY = -height / 2 + viewH + 1;
    const divider = this.add.graphics();
    divider.lineStyle(1, classData.color, 0.5);
    divider.lineBetween(-width / 2 + 10, dividerY, width / 2 - 10, dividerY);

    // ── Class name ────────────────────────────────────────────────
    const nameY = -height / 2 + viewH + 22;
    const name = this.add.text(0, nameY, classData.name, {
      fontSize: '20px',
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0);

    // ── Element type pill ─────────────────────────────────────────
    const elementPillY = nameY + 28;
    const pillBg = this.add.graphics();
    pillBg.fillStyle(classData.color, 0.18);
    pillBg.lineStyle(1, classData.color, 0.6);
    pillBg.fillRoundedRect(-38, elementPillY - 1, 76, 18, 9);
    pillBg.strokeRoundedRect(-38, elementPillY - 1, 76, 18, 9);
    const elementLabel = this.add.text(0, elementPillY + 1, classData.element.toUpperCase(), {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#' + classData.color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // ── Description ───────────────────────────────────────────────
    const descY = elementPillY + 26;
    const description = this.add.text(0, descY, classData.description, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#9999bb',
      wordWrap: { width: width - 28 },
      align: 'center',
    }).setOrigin(0.5, 0);

    // ── Passive label ─────────────────────────────────────────────
    const passiveY = descY + description.height + 8;
    const passivePillBg = this.add.graphics();
    passivePillBg.fillStyle(0x222244, 1);
    passivePillBg.lineStyle(1, classData.color, 0.4);
    passivePillBg.fillRoundedRect(-width / 2 + 12, passiveY - 2, width - 24, 20, 5);
    passivePillBg.strokeRoundedRect(-width / 2 + 12, passiveY - 2, width - 24, 20, 5);
    const passiveText = this.add.text(-width / 2 + 20, passiveY + 1, `PASSIVE: ${classData.passive}`, {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#' + classData.color.toString(16).padStart(6, '0'),
    }).setOrigin(0, 0);

    // ── Tower list ────────────────────────────────────────────────
    const towerSectionY = height / 2 - 70;
    const towerDivider = this.add.graphics();
    towerDivider.lineStyle(1, 0x333355, 1);
    towerDivider.lineBetween(-width / 2 + 10, towerSectionY - 4, width / 2 - 10, towerSectionY - 4);

    const towersLabel = this.add.text(0, towerSectionY, 'TOWERS', {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#555577',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    const towerTexts = classData.towers.map((tower, ti) =>
      this.add.text(0, towerSectionY + 14 + ti * 16, `\u2022 ${tower}`, {
        fontSize: '11px',
        fontFamily: 'Arial',
        color: '#' + classData.color.toString(16).padStart(6, '0'),
      }).setOrigin(0.5, 0).setAlpha(0.9)
    );

    // ── Selection overlay ─────────────────────────────────────────
    const selectedOverlay = this.add.rectangle(0, 0, width, height, classData.color, 0.15);
    selectedOverlay.setVisible(false);

    // Glow border when selected
    const glowBorder = this.add.graphics();
    glowBorder.setVisible(false);

    // ── Add all children to container ─────────────────────────────
    const children: Phaser.GameObjects.GameObject[] = [
      bg, viewBg,
      buildingObj,
      badgeBg, badgeText,
      divider,
      name,
      pillBg, elementLabel,
      description,
      passivePillBg, passiveText,
      towerDivider, towersLabel,
      ...towerTexts,
      selectedOverlay, glowBorder,
    ];
    if (soldierSprite) children.splice(3, 0, soldierSprite);
    container.add(children);

    // ── Interactivity ─────────────────────────────────────────────
    bg.on('pointerover', () => {
      if (this.selectedClass !== classData.element) {
        bg.setFillStyle(0x1e1e38);
        this.tweens.add({
          targets: container,
          y: y - 8,
          duration: 150,
          ease: 'Power2.Out',
        });
      }
    });

    bg.on('pointerout', () => {
      if (this.selectedClass !== classData.element) {
        bg.setFillStyle(0x14142a);
        this.tweens.add({
          targets: container,
          y,
          duration: 150,
          ease: 'Power2.Out',
        });
      }
    });

    bg.on('pointerdown', () => {
      this.selectClass(classData.element, container, selectedOverlay, bg, glowBorder, y);
    });

    // ── Store refs ────────────────────────────────────────────────
    (container as unknown as { backgroundRect: Phaser.GameObjects.Rectangle }).backgroundRect = bg;
    (container as unknown as { selectedOverlay: Phaser.GameObjects.Rectangle }).selectedOverlay = selectedOverlay;
    (container as unknown as { glowBorder: Phaser.GameObjects.Graphics }).glowBorder = glowBorder;
    (container as unknown as { classData: ClassCardData }).classData = classData;
    (container as unknown as { baseY: number }).baseY = y;
    (container as unknown as { soldierSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc | null }).soldierSprite = soldierSprite;

    // ── Staggered entrance ────────────────────────────────────────
    container.setAlpha(0);
    container.setY(y + 40);
    this.tweens.add({
      targets: container,
      alpha: 1,
      y,
      delay: index * 100,
      duration: 450,
      ease: 'Back.Out',
    });

    return container;
  }

  // ─────────────────────────────────────────────────────────────────
  // Selection
  // ─────────────────────────────────────────────────────────────────

  private selectClass(
    element: ElementType,
    container: Phaser.GameObjects.Container,
    selectedOverlay: Phaser.GameObjects.Rectangle,
    bg: Phaser.GameObjects.Rectangle,
    glowBorder: Phaser.GameObjects.Graphics,
    baseY: number
  ): void {
    // Deselect all
    this.cardContainers.forEach((card) => {
      const overlay = (card as unknown as { selectedOverlay: Phaser.GameObjects.Rectangle }).selectedOverlay;
      const background = (card as unknown as { backgroundRect: Phaser.GameObjects.Rectangle }).backgroundRect;
      const glow = (card as unknown as { glowBorder: Phaser.GameObjects.Graphics }).glowBorder;
      const cy = (card as unknown as { baseY: number }).baseY;
      overlay.setVisible(false);
      glow.setVisible(false);
      background.setFillStyle(0x14142a);
      background.setStrokeStyle(2, (card as unknown as { classData: ClassCardData }).classData.color, 0.85);
      this.tweens.add({ targets: card, y: cy, duration: 150, ease: 'Power2.Out' });
    });

    // Select this card
    this.selectedClass = element;
    selectedOverlay.setVisible(true);
    bg.setFillStyle(0x1c1c38);
    bg.setStrokeStyle(3, (container as unknown as { classData: ClassCardData }).classData.color, 1);

    // Glow border
    const cd = (container as unknown as { classData: ClassCardData }).classData;
    glowBorder.clear();
    glowBorder.lineStyle(6, cd.color, 0.3);
    glowBorder.strokeRect(-cd.color, -baseY, 100, 100); // placeholder — we draw it properly below
    glowBorder.clear();
    const w = 210; const h = 360;
    glowBorder.lineStyle(5, cd.color, 0.25);
    glowBorder.strokeRect(-w / 2, -h / 2, w, h);
    glowBorder.setVisible(true);

    // Lift selected card
    this.tweens.add({
      targets: container,
      y: baseY - 12,
      duration: 200,
      ease: 'Back.Out',
    });

    // Pulse selected soldier
    const soldier = (container as unknown as { soldierSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc | null }).soldierSprite;
    if (soldier) {
      this.tweens.add({
        targets: soldier,
        scaleX: 4.8,
        scaleY: 4.8,
        duration: 120,
        yoyo: true,
        ease: 'Power2.Out',
      });
    }

    // Unlock ready button
    this.enableReadyButton();
  }

  // ─────────────────────────────────────────────────────────────────
  // Ready button
  // ─────────────────────────────────────────────────────────────────

  private createReadyButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(10);
    const btnW = 220;
    const btnH = 56;

    const useSprite = this.textures.exists('ui_btn_blue_regular') && this.textures.exists('ui_btn_blue_pressed');

    if (useSprite) {
      // Tiny Swords sprite button — disabled/greyed out until class is selected
      const btnImg = this.add.image(0, 0, 'ui_btn_blue_regular');
      btnImg.setDisplaySize(btnW, btnH);
      btnImg.setAlpha(0.45);
      btnImg.setTint(0x556677);
      (container as unknown as { btnImg: Phaser.GameObjects.Image }).btnImg = btnImg;

      this.readyText = this.add.text(0, -2, 'SELECT A CLASS', {
        fontSize: '17px',
        fontFamily: '"Arial Black", Arial',
        fontStyle: 'bold',
        color: '#8899aa',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);

      const hit = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0)
        .setInteractive({ useHandCursor: false });
      (container as unknown as { hit: Phaser.GameObjects.Rectangle }).hit = hit;

      hit.on('pointerover', () => {
        if (!this.selectedClass) return;
        btnImg.setTexture('ui_btn_blue_pressed');
      });
      hit.on('pointerout', () => {
        if (!this.selectedClass) return;
        btnImg.setTexture('ui_btn_blue_regular');
      });
      hit.on('pointerdown', () => {
        if (!this.selectedClass) return;
        btnImg.setTexture('ui_btn_blue_pressed');
        this.tweens.add({ targets: container, scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
      });
      hit.on('pointerup', () => {
        if (this.selectedClass) {
          btnImg.setTexture('ui_btn_blue_regular');
          this.emitReadyUp();
        }
      });

      container.add([btnImg, this.readyText, hit]);
    } else {
      // Fallback: drawn graphics button
      const bg = this.add.graphics();
      bg.fillStyle(0x223344, 1);
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
      bg.lineStyle(2, 0x334455, 1);
      bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
      this.readyBg = bg;

      this.readyText = this.add.text(0, 0, 'SELECT A CLASS', {
        fontSize: '19px',
        fontFamily: '"Arial Black", Arial',
        fontStyle: 'bold',
        color: '#445566',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);

      const hit = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0)
        .setInteractive({ useHandCursor: false });
      (container as unknown as { hit: Phaser.GameObjects.Rectangle }).hit = hit;
      (container as unknown as { background: Phaser.GameObjects.Graphics }).background = bg;

      hit.on('pointerover', () => {
        if (!this.selectedClass) return;
        bg.clear();
        bg.fillStyle(0x00aa66, 1);
        bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
        bg.lineStyle(2, 0x00ff88, 1);
        bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
      });
      hit.on('pointerout', () => {
        if (!this.selectedClass) return;
        bg.clear();
        bg.fillStyle(0x008855, 1);
        bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
        bg.lineStyle(2, 0x00cc77, 1);
        bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
      });
      hit.on('pointerdown', () => {
        if (!this.selectedClass) return;
        bg.clear();
        bg.fillStyle(0x006644, 1);
        bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
      });
      hit.on('pointerup', () => {
        if (this.selectedClass) {
          this.tweens.add({ targets: container, scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
          this.emitReadyUp();
        }
      });

      container.add([bg, this.readyText, hit]);
    }

    return container;
  }

  private enableReadyButton(): void {
    const hit = (this.readyButton as unknown as { hit: Phaser.GameObjects.Rectangle }).hit;
    hit.setInteractive({ useHandCursor: true });

    this.readyText.setText('⚔  READY  ⚔');
    this.readyText.setColor('#ffffff');

    const btnImg = (this.readyButton as unknown as { btnImg?: Phaser.GameObjects.Image }).btnImg;
    if (btnImg) {
      // Sprite mode — remove grey tint, full alpha
      btnImg.clearTint();
      btnImg.setAlpha(1);
    } else {
      // Graphics mode
      const btnW = 220; const btnH = 56;
      this.readyBg.clear();
      this.readyBg.fillStyle(0x008855, 1);
      this.readyBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
      this.readyBg.lineStyle(2, 0x00cc77, 1);
      this.readyBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    }

    // Pulse to draw attention
    this.tweens.add({
      targets: this.readyButton,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 500,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut',
    });
  }

  private emitReadyUp(): void {
    if (!this.selectedClass) return;

    const gameClient = this.registry.get('gameClient') as GameClient;
    if (gameClient) {
      gameClient.selectClass(this.selectedClass);
      gameClient.readyUp();
    }

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.checkGameStart();
    });
  }

  private checkGameStart(): void {
    const gameClient = this.registry.get('gameClient') as GameClient;
    if (!gameClient) {
      this.scene.start('GameScene');
      return;
    }

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
