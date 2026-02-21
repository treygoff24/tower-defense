/**
 * Tooltip.ts — Reusable Phaser tooltip container.
 *
 * Features:
 * - Rounded rectangle dark semi-transparent background
 * - Multi-line text content
 * - Positions above target, flips below if near top edge
 * - Shifts left if near right screen edge
 * - Short fade-in / fade-out animation
 */
import Phaser from 'phaser';

export interface TooltipStyle {
  fontSize?: string;
  fontFamily?: string;
  lineSpacing?: number;
  padding?: number;
  bgColor?: number;
  bgAlpha?: number;
  cornerRadius?: number;
  textColor?: string;
  fadeDurationMs?: number;
}

const DEFAULTS: Required<TooltipStyle> = {
  fontSize: '11px',
  fontFamily: 'Arial',
  lineSpacing: 4,
  padding: 10,
  bgColor: 0x0a0a14,
  bgAlpha: 0.92,
  cornerRadius: 6,
  textColor: '#e0e0e0',
  fadeDurationMs: 120,
};

export class Tooltip extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private style: Required<TooltipStyle>;
  private fadeTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, style: TooltipStyle = {}) {
    super(scene, 0, 0);
    this.style = { ...DEFAULTS, ...style };

    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, '', {
        fontSize: this.style.fontSize,
        fontFamily: this.style.fontFamily,
        color: this.style.textColor,
        lineSpacing: this.style.lineSpacing,
      })
      .setOrigin(0, 0);

    this.add([this.bg, this.label]);
    this.setAlpha(0);
    this.setVisible(false);
    this.setDepth(9999);

    scene.add.existing(this);
  }

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────

  /**
   * Set the tooltip text content (multi-line string).
   */
  setContent(text: string): this {
    this.label.setText(text);
    this.redrawBackground();
    return this;
  }

  /**
   * Show the tooltip anchored to (anchorX, anchorY) in world space.
   * The tooltip is placed above the anchor by default; flipped below if near
   * the top edge, and shifted left if near the right edge.
   */
  showAt(anchorX: number, anchorY: number): void {
    this.redrawBackground();
    this.repositionNear(anchorX, anchorY);
    this.setVisible(true);

    this.stopFade();
    this.fadeTween = this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: this.style.fadeDurationMs,
      ease: 'Sine.easeOut',
    });
  }

  /**
   * Hide the tooltip with a short fade-out.
   */
  hide(): void {
    this.stopFade();
    if (this.alpha === 0) {
      this.setVisible(false);
      return;
    }
    this.fadeTween = this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: this.style.fadeDurationMs,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.setVisible(false);
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Internals
  // ─────────────────────────────────────────────────────────────

  private get textWidth(): number {
    return this.label.width;
  }

  private get textHeight(): number {
    return this.label.height;
  }

  private redrawBackground(): void {
    const pad = this.style.padding;
    const w = this.textWidth + pad * 2;
    const h = this.textHeight + pad * 2;

    this.bg.clear();
    // Subtle shadow offset
    this.bg.fillStyle(0x000000, 0.4);
    this.bg.fillRoundedRect(2, 2, w, h, this.style.cornerRadius);
    // Main background
    this.bg.fillStyle(this.style.bgColor, this.style.bgAlpha);
    this.bg.fillRoundedRect(0, 0, w, h, this.style.cornerRadius);
    // Thin border
    this.bg.lineStyle(1, 0x4455aa, 0.6);
    this.bg.strokeRoundedRect(0, 0, w, h, this.style.cornerRadius);

    // Position the label inside with padding
    this.label.setPosition(pad, pad);
  }

  private repositionNear(anchorX: number, anchorY: number): void {
    const pad = this.style.padding;
    const w = this.textWidth + pad * 2;
    const h = this.textHeight + pad * 2;
    const margin = 8; // gap between tooltip and target

    const cam = this.scene.cameras.main;
    const screenW = cam.width;
    const screenH = cam.height;

    // Default: place above the anchor
    let tx = anchorX - w / 2;
    let ty = anchorY - h - margin;

    // Flip below if too close to top
    if (ty < cam.scrollY + 4) {
      ty = anchorY + margin;
    }

    // Shift left if overflowing right edge
    if (tx + w > cam.scrollX + screenW - 4) {
      tx = cam.scrollX + screenW - w - 4;
    }
    // Shift right if overflowing left edge
    if (tx < cam.scrollX + 4) {
      tx = cam.scrollX + 4;
    }

    // Clamp bottom
    if (ty + h > cam.scrollY + screenH - 4) {
      ty = cam.scrollY + screenH - h - 4;
    }

    this.setPosition(tx, ty);
  }

  private stopFade(): void {
    if (this.fadeTween) {
      this.fadeTween.stop();
      this.fadeTween.destroy();
      this.fadeTween = null;
    }
  }
}
