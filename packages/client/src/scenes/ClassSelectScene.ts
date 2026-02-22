import Phaser from 'phaser';
import type { ElementType } from '@td/shared';
import { GameClient } from '../GameClient';
import { S } from '../dpr';

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
    soldierKey: 'ts_fire_idle',
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
    soldierKey: 'ts_water_idle',
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
    soldierKey: 'ts_ice_idle',
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
    soldierKey: 'ts_poison_idle',
    towers: ['Venom Spitter', 'Plague Spreader', 'Miasma Cloud'],
    passive: 'Toxin on hit',
  },
];

interface CardState {
  classData: ClassCardData;
  baseY: number;
  soldierSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc | null;
  selectedOverlay: Phaser.GameObjects.Graphics;
  glowBorder: Phaser.GameObjects.Graphics;
  cardBg: Phaser.GameObjects.Graphics;
  cardBorder: Phaser.GameObjects.Graphics;
  width: number;
  height: number;
}

export class ClassSelectScene extends Phaser.Scene {
  private selectedClass: ElementType | null = null;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private cardStates = new Map<Phaser.GameObjects.Container, CardState>();
  private readyButton!: Phaser.GameObjects.Container;
  private readyText!: Phaser.GameObjects.Text;
  private readyBg!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'ClassSelectScene' });
  }

  create(): void {
    this.cardContainers = [];
    this.cardStates.clear();
    this.selectedClass = null;

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── Background ────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor('#080818');
    this.createStarfield(W, H);

    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.6, 0.6, 0.0, 0.0);
    vignette.fillRect(0, 0, W, H / 2);
    vignette.setDepth(0);

    // ── Title section ─────────────────────────────────────────────
    if (this.textures.exists('ui_banner')) {
      const titleBanner = this.add.image(W / 2, 55 * S, 'ui_banner');
      titleBanner.setDisplaySize(420 * S, 88 * S);
      titleBanner.setAlpha(0.55).setDepth(1);
    } else {
      const titleBg = this.add.graphics();
      titleBg.fillStyle(0x0a0a20, 0.85);
      titleBg.fillRoundedRect(W / 2 - 300 * S, 16 * S, 600 * S, 80 * S, 12 * S);
      titleBg.lineStyle(S, 0x4444aa, 0.8);
      titleBg.strokeRoundedRect(W / 2 - 300 * S, 16 * S, 600 * S, 80 * S, 12 * S);
      titleBg.setDepth(1);
    }

    const titleGlow = this.add.text(W / 2, 42 * S, '\u2694  CHOOSE YOUR ELEMENT  \u2694', {
      fontSize: `${34 * S}px`,
      fontFamily: '"Arial Black", Arial',
      color: '#110800',
    }).setOrigin(0.5).setAlpha(0.45).setDepth(1);

    const title = this.add.text(W / 2, 40 * S, '\u2694  CHOOSE YOUR ELEMENT  \u2694', {
      fontSize: `${34 * S}px`,
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#441100',
      strokeThickness: 4 * S,
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

    this.add.text(W / 2, 76 * S, "Select a class \u2014 your towers share your element's passive", {
      fontSize: `${14 * S}px`,
      fontFamily: 'Arial',
      fontStyle: 'italic',
      color: '#6677aa',
    }).setOrigin(0.5).setDepth(2);

    if (this.textures.exists('ui_ribbon_small')) {
      const ribbon = this.add.image(W / 2, 100 * S, 'ui_ribbon_small');
      ribbon.setDisplaySize(300 * S, 16 * S);
      ribbon.setAlpha(0.35).setDepth(2);
    }

    // ── Particle texture ──────────────────────────────────────────
    if (!this.textures.exists('_particle_dot')) {
      const pg = this.make.graphics({ x: 0, y: 0 });
      pg.fillStyle(0xffffff, 1);
      pg.fillCircle(4, 4, 4);
      pg.generateTexture('_particle_dot', 8, 8);
      pg.destroy();
    }

    // ── Class cards ───────────────────────────────────────────────
    const cardWidth = 224 * S;
    const cardHeight = 350 * S;
    const spacing = 22 * S;
    const totalWidth = CLASS_CARDS.length * cardWidth + (CLASS_CARDS.length - 1) * spacing;
    const startX = (W - totalWidth) / 2 + cardWidth / 2;
    const cardY = H / 2 + 10 * S;

    CLASS_CARDS.forEach((classData, index) => {
      const cardX = startX + index * (cardWidth + spacing);
      const cardContainer = this.createClassCard(classData, cardX, cardY, cardWidth, cardHeight, index);
      this.cardContainers.push(cardContainer);
    });

    // ── Ready button ──────────────────────────────────────────────
    this.readyButton = this.createReadyButton(W / 2, H - 52 * S);

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
      const size = (Math.random() < 0.8 ? 1 : 2) * S;
      g.fillStyle(0xffffff, 0.2 + Math.random() * 0.4);
      g.fillRect(sx, sy, size, size);
    }
    for (let i = 0; i < 10; i++) {
      const star = this.add.circle(Math.random() * W, Math.random() * H, 1.5 * S, 0xffffff, 0.7).setDepth(0);
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
    index: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(5);
    const colorHex = '#' + classData.color.toString(16).padStart(6, '0');
    const headerH = height * 0.40;
    const cornerR = 12 * S;

    // ── Drop shadow ───────────────────────────────────────────────
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-width / 2 + 5 * S, -height / 2 + 6 * S, width, height, cornerR);

    // ── Card background (rounded rect) ────────────────────────────
    const cardBg = this.add.graphics();
    this.drawCardFill(cardBg, width, height, cornerR, 0x10102a, 0.95);

    // ── Gradient header wash ──────────────────────────────────────
    const headerGfx = this.add.graphics();
    const inset = 4 * S;
    headerGfx.fillGradientStyle(
      classData.color, classData.color,
      classData.color, classData.color,
      0.18, 0.18, 0.0, 0.0,
    );
    headerGfx.fillRect(-width / 2 + inset, -height / 2 + inset, width - inset * 2, headerH);

    // ── Card border ───────────────────────────────────────────────
    const cardBorder = this.add.graphics();
    cardBorder.lineStyle(1.5 * S, classData.color, 0.35);
    cardBorder.strokeRoundedRect(-width / 2, -height / 2, width, height, cornerR);

    // ── Soldier glow + sprite ─────────────────────────────────────
    const soldierY = -height / 2 + headerH / 2 + 5 * S;
    let soldierGlow: Phaser.GameObjects.Graphics | null = null;
    let soldierSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc | null = null;

    if (this.textures.exists(classData.soldierKey)) {
      soldierGlow = this.add.graphics();
      soldierGlow.fillStyle(classData.color, 0.06);
      soldierGlow.fillCircle(0, soldierY, 55 * S);
      soldierGlow.fillStyle(classData.color, 0.04);
      soldierGlow.fillCircle(0, soldierY, 38 * S);

      soldierSprite = this.add.sprite(0, soldierY, classData.soldierKey, 0);
      const isLancer = classData.soldierKey.includes('ice');
      soldierSprite.setScale((isLancer ? 0.55 : 0.85) * S);
      const idleAnim = `${classData.soldierKey}_idle`;
      if (this.anims.exists(idleAnim)) soldierSprite.play(idleAnim);
    } else {
      soldierSprite = this.add.circle(0, soldierY, 18 * S, classData.color);
    }

    // ── Element icon circle (at header/body boundary) ─────────────
    const iconY = -height / 2 + headerH;
    const iconGfx = this.add.graphics();
    // Soft outer glow
    iconGfx.fillStyle(classData.color, 0.1);
    iconGfx.fillCircle(0, iconY, 28 * S);
    // Dark disc
    iconGfx.fillStyle(0x0c0c22, 1);
    iconGfx.fillCircle(0, iconY, 20 * S);
    // Colored ring
    iconGfx.lineStyle(2 * S, classData.color, 0.85);
    iconGfx.strokeCircle(0, iconY, 20 * S);

    const iconText = this.add.text(0, iconY, classData.icon, {
      fontSize: `${16 * S}px`,
    }).setOrigin(0.5);

    // ── Class name ────────────────────────────────────────────────
    const nameY = iconY + 30 * S;
    const nameText = this.add.text(0, nameY, classData.name, {
      fontSize: `${21 * S}px`,
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3 * S,
    }).setOrigin(0.5);

    // ── Element type with decorative dashes ───────────────────────
    const elemY = nameY + 28 * S;
    const elemText = this.add.text(0, elemY, `\u2500\u2500 ${classData.element.toUpperCase()} \u2500\u2500`, {
      fontSize: `${9 * S}px`,
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: colorHex,
      letterSpacing: 3 * S,
    }).setOrigin(0.5);

    // ── Description ───────────────────────────────────────────────
    const descY = elemY + 20 * S;
    const descText = this.add.text(0, descY, classData.description, {
      fontSize: `${11 * S}px`,
      fontFamily: 'Arial',
      color: '#8899bb',
      wordWrap: { width: width - 30 * S },
      align: 'center',
      lineSpacing: 2 * S,
    }).setOrigin(0.5, 0);

    // ── Tower section ─────────────────────────────────────────────
    const towerY = height / 2 - 76 * S;
    const towerDivider = this.add.graphics();
    towerDivider.lineStyle(S * 0.5, classData.color, 0.2);
    towerDivider.lineBetween(-width / 2 + 18 * S, towerY - 8 * S, width / 2 - 18 * S, towerY - 8 * S);

    const towerTexts = classData.towers.map((tower, ti) =>
      this.add.text(0, towerY + ti * 15 * S, `\u25B8 ${tower}`, {
        fontSize: `${10 * S}px`,
        fontFamily: 'Arial',
        color: colorHex,
      }).setOrigin(0.5, 0).setAlpha(0.8),
    );

    // ── Passive at bottom ─────────────────────────────────────────
    const passiveY = height / 2 - 24 * S;
    const passiveBg = this.add.graphics();
    passiveBg.fillStyle(classData.color, 0.08);
    passiveBg.fillRoundedRect(-width / 2 + 10 * S, passiveY - 4 * S, width - 20 * S, 18 * S, 4 * S);

    const passiveText = this.add.text(0, passiveY, `${classData.icon} ${classData.passive}`, {
      fontSize: `${9 * S}px`,
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: colorHex,
    }).setOrigin(0.5, 0).setAlpha(0.7);

    // ── Ambient particles ─────────────────────────────────────────
    const particles = this.add.particles(0, 0, '_particle_dot', {
      x: { min: -width / 2 + 10 * S, max: width / 2 - 10 * S },
      y: { min: height / 2 - 20 * S, max: height / 2 },
      speed: { min: 4 * S, max: 12 * S },
      angle: { min: -100, max: -80 },
      lifespan: { min: 2500, max: 4500 },
      alpha: { start: 0.25, end: 0 },
      scale: { start: 0.4 * S, end: 0 },
      tint: classData.color,
      frequency: 800,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });

    // ── Selection overlay + glow border ───────────────────────────
    const selectedOverlay = this.add.graphics();
    selectedOverlay.setVisible(false);

    const glowBorder = this.add.graphics();
    glowBorder.setVisible(false);

    // ── Hit area (must be on top for pointer events) ──────────────
    const hitArea = this.add.rectangle(0, 0, width, height, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });

    // ── Assemble children ─────────────────────────────────────────
    const children: Phaser.GameObjects.GameObject[] = [
      shadow, cardBg, headerGfx,
    ];
    if (soldierGlow) children.push(soldierGlow);
    if (soldierSprite) children.push(soldierSprite);
    children.push(
      cardBorder,
      iconGfx, iconText,
      nameText, elemText,
      descText,
      towerDivider, ...towerTexts,
      passiveBg, passiveText,
      particles,
      selectedOverlay, glowBorder,
      hitArea,
    );
    container.add(children);

    // ── Interactivity ─────────────────────────────────────────────
    hitArea.on('pointerover', () => {
      if (this.selectedClass !== classData.element) {
        this.drawCardFill(cardBg, width, height, cornerR, 0x181838, 0.95);
        cardBorder.clear();
        cardBorder.lineStyle(1.5 * S, classData.color, 0.55);
        cardBorder.strokeRoundedRect(-width / 2, -height / 2, width, height, cornerR);
        this.tweens.add({ targets: container, y: y - 8, duration: 150, ease: 'Power2.Out' });
      }
    });

    hitArea.on('pointerout', () => {
      if (this.selectedClass !== classData.element) {
        this.drawCardFill(cardBg, width, height, cornerR, 0x10102a, 0.95);
        cardBorder.clear();
        cardBorder.lineStyle(1.5 * S, classData.color, 0.35);
        cardBorder.strokeRoundedRect(-width / 2, -height / 2, width, height, cornerR);
        this.tweens.add({ targets: container, y, duration: 150, ease: 'Power2.Out' });
      }
    });

    hitArea.on('pointerdown', () => {
      this.selectClass(classData.element, container);
    });

    // ── Store card state ──────────────────────────────────────────
    this.cardStates.set(container, {
      classData,
      baseY: y,
      soldierSprite,
      selectedOverlay,
      glowBorder,
      cardBg,
      cardBorder,
      width,
      height,
    });

    // ── Staggered entrance ────────────────────────────────────────
    container.setAlpha(0);
    container.setY(y + 40);
    this.tweens.add({
      targets: container,
      alpha: 1,
      y,
      delay: index * 120,
      duration: 500,
      ease: 'Back.Out',
    });

    return container;
  }

  private drawCardFill(
    gfx: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    r: number,
    color: number,
    alpha: number,
  ): void {
    gfx.clear();
    gfx.fillStyle(color, alpha);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  }

  // ─────────────────────────────────────────────────────────────────
  // Selection
  // ─────────────────────────────────────────────────────────────────

  private selectClass(element: ElementType, container: Phaser.GameObjects.Container): void {
    const cornerR = 12 * S;

    // Deselect all cards
    this.cardContainers.forEach((card) => {
      const st = this.cardStates.get(card);
      if (!st) return;
      st.selectedOverlay.clear();
      st.selectedOverlay.setVisible(false);
      this.tweens.killTweensOf(st.glowBorder);
      st.glowBorder.clear();
      st.glowBorder.setVisible(false);
      this.drawCardFill(st.cardBg, st.width, st.height, cornerR, 0x10102a, 0.95);
      st.cardBorder.clear();
      st.cardBorder.lineStyle(1.5 * S, st.classData.color, 0.35);
      st.cardBorder.strokeRoundedRect(-st.width / 2, -st.height / 2, st.width, st.height, cornerR);
      this.tweens.add({ targets: card, y: st.baseY, duration: 150, ease: 'Power2.Out' });
    });

    // Select this card
    this.selectedClass = element;
    const st = this.cardStates.get(container);
    if (!st) return;

    // Color wash overlay
    st.selectedOverlay.clear();
    st.selectedOverlay.fillStyle(st.classData.color, 0.07);
    st.selectedOverlay.fillRoundedRect(-st.width / 2, -st.height / 2, st.width, st.height, cornerR);
    st.selectedOverlay.setVisible(true);

    // Brighten card
    this.drawCardFill(st.cardBg, st.width, st.height, cornerR, 0x181838, 0.95);

    // Bright border
    st.cardBorder.clear();
    st.cardBorder.lineStyle(2 * S, st.classData.color, 0.9);
    st.cardBorder.strokeRoundedRect(-st.width / 2, -st.height / 2, st.width, st.height, cornerR);

    // Layered glow border
    st.glowBorder.clear();
    st.glowBorder.lineStyle(10 * S, st.classData.color, 0.08);
    st.glowBorder.strokeRoundedRect(-st.width / 2, -st.height / 2, st.width, st.height, cornerR);
    st.glowBorder.lineStyle(6 * S, st.classData.color, 0.18);
    st.glowBorder.strokeRoundedRect(-st.width / 2, -st.height / 2, st.width, st.height, cornerR);
    st.glowBorder.lineStyle(3 * S, st.classData.color, 0.4);
    st.glowBorder.strokeRoundedRect(-st.width / 2, -st.height / 2, st.width, st.height, cornerR);
    st.glowBorder.setBlendMode(Phaser.BlendModes.ADD);
    st.glowBorder.setVisible(true);

    // Breathing pulse
    this.tweens.killTweensOf(st.glowBorder);
    this.tweens.add({
      targets: st.glowBorder,
      alpha: { from: 0.7, to: 1.0 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    // Lift card
    this.tweens.add({
      targets: container,
      y: st.baseY - 12,
      duration: 200,
      ease: 'Back.Out',
    });

    // Pulse soldier
    if (st.soldierSprite && st.soldierSprite instanceof Phaser.GameObjects.Sprite) {
      this.tweens.add({
        targets: st.soldierSprite,
        scaleX: st.soldierSprite.scaleX * 1.15,
        scaleY: st.soldierSprite.scaleY * 1.15,
        duration: 120,
        yoyo: true,
        ease: 'Power2.Out',
      });
    }

    this.enableReadyButton();
  }

  // ─────────────────────────────────────────────────────────────────
  // Ready button
  // ─────────────────────────────────────────────────────────────────

  private createReadyButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(10);
    const btnW = 260 * S;
    const btnH = 54 * S;
    const r = 12 * S;

    const bg = this.add.graphics();
    const drawBtn = (state: 'disabled' | 'normal' | 'hover' | 'pressed') => {
      bg.clear();
      // Shadow
      bg.fillStyle(0x000000, 0.35);
      bg.fillRoundedRect(-btnW / 2 + 3 * S, -btnH / 2 + 4 * S, btnW, btnH, r);
      // Body
      const fills: Record<string, number> = {
        disabled: 0x1a2233,
        normal: 0x006633,
        hover: 0x008844,
        pressed: 0x005528,
      };
      bg.fillStyle(fills[state] ?? 0x1a2233, 1);
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, r);
      // Top highlight
      if (state !== 'disabled') {
        bg.fillStyle(0xffffff, state === 'hover' ? 0.15 : 0.08);
        bg.fillRoundedRect(
          -btnW / 2 + 2 * S, -btnH / 2 + S,
          btnW - 4 * S, btnH / 2 - 2 * S,
          { tl: 10 * S, tr: 10 * S, bl: 0, br: 0 },
        );
      }
      // Border
      const borders: Record<string, [number, number]> = {
        disabled: [0x334455, 0.4],
        normal: [0x00cc66, 0.85],
        hover: [0x00ff88, 1],
        pressed: [0x00aa55, 1],
      };
      const [bc, ba] = borders[state] ?? [0x334455, 0.4];
      bg.lineStyle(2 * S, bc, ba);
      bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, r);
    };
    drawBtn('disabled');
    this.readyBg = bg;

    this.readyText = this.add.text(0, 0, 'SELECT A CLASS', {
      fontSize: `${18 * S}px`,
      fontFamily: '"Arial Black", Arial',
      fontStyle: 'bold',
      color: '#445566',
      stroke: '#000000',
      strokeThickness: 2 * S,
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0)
      .setInteractive({ useHandCursor: false });

    hit.on('pointerover', () => { if (this.selectedClass) drawBtn('hover'); });
    hit.on('pointerout', () => { if (this.selectedClass) drawBtn('normal'); });
    hit.on('pointerdown', () => {
      if (!this.selectedClass) return;
      drawBtn('pressed');
      this.tweens.add({ targets: container, scaleX: 0.96, scaleY: 0.96, duration: 60, yoyo: true });
    });
    hit.on('pointerup', () => {
      if (this.selectedClass) {
        drawBtn('normal');
        this.emitReadyUp();
      }
    });

    (container as unknown as { drawBtn: typeof drawBtn }).drawBtn = drawBtn;
    (container as unknown as { hit: Phaser.GameObjects.Rectangle }).hit = hit;

    container.add([bg, this.readyText, hit]);
    return container;
  }

  private enableReadyButton(): void {
    const hit = (this.readyButton as unknown as { hit: Phaser.GameObjects.Rectangle }).hit;
    hit.setInteractive({ useHandCursor: true });

    this.readyText.setText('\u2694  READY  \u2694');
    this.readyText.setColor('#ffffff');

    const drawBtn = (this.readyButton as unknown as { drawBtn: (s: string) => void }).drawBtn;
    if (drawBtn) drawBtn('normal');

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

  // ─────────────────────────────────────────────────────────────────
  // Game flow
  // ─────────────────────────────────────────────────────────────────

  private async emitReadyUp(): Promise<void> {
    if (!this.selectedClass) return;

    const gameClient = this.registry.get('gameClient') as GameClient;
    if (gameClient) {
      await gameClient.selectClass(this.selectedClass);
      await gameClient.readyUp();
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
      this.scene.start('HudScene');
      return;
    }

    const checkInterval = this.time.addEvent({
      delay: 500,
      callback: () => {
        const state = gameClient.getLatestState();
        if (state && (state.phase === 'prep' || state.phase === 'combat')) {
          checkInterval.remove();
          this.scene.start('GameScene');
          this.scene.start('HudScene');
        }
      },
      loop: true,
    });
  }
}
