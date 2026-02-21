// packages/client/src/effects/TowerAnimator.ts
import Phaser from 'phaser';

/** Maps element name → tint color for the attack flash. */
const ELEMENT_TINTS: Record<string, number> = {
  fire: 0xff6600,
  ice: 0x00ccff,
  water: 0x0066ff,
  poison: 0x00cc00,
};

const DEFAULT_TINT = 0xffffff;

/** Duration (ms) for each half of the yoyo tween (total = TWEEN_HALF_MS * 2). */
const TWEEN_HALF_MS = 100;

/** Peak scale multiplier during the pulse (relative to the sprite's current scale). */
const SCALE_PULSE = 1.15;

type TweenTarget = Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
type Tintable = TweenTarget & { setTint(c: number): void; clearTint(): void };

/**
 * TowerAnimator manages per-frame attack animations for tower sprites.
 *
 * Usage:
 *   const animator = new TowerAnimator(scene);
 *   animator.playAttack(soldierSprite, 'fire');
 */
export class TowerAnimator {
  private scene: Phaser.Scene;

  /**
   * Active tween registry so we can cancel previous tweens on the same
   * sprite before starting a new one (prevents stacking).
   */
  private activeTweens = new Map<Phaser.GameObjects.GameObject, Phaser.Tweens.Tween>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Play a quick attack animation on `towerSprite`:
   *  1. Scale pulse: currentScale → currentScale×1.15 → currentScale over 200 ms
   *  2. Element-coloured tint flash that clears at the midpoint
   *
   * If a tween is already running on this sprite it is cancelled first so
   * animations never stack.
   */
  playAttack(towerSprite: TweenTarget & { setTint?(c: number): void; clearTint?(): void }, element?: string): void {
    // ── Cancel existing tween to prevent stacking ──────────────────
    const existing = this.activeTweens.get(towerSprite);
    if (existing) {
      existing.stop();
      this.activeTweens.delete(towerSprite);
    }

    // ── Tint flash ────────────────────────────────────────────────
    const tint =
      element !== undefined ? (ELEMENT_TINTS[element] ?? DEFAULT_TINT) : DEFAULT_TINT;

    towerSprite.setTint?.(tint);

    // Clear tint at the midpoint of the animation (100 ms in)
    this.scene.time.delayedCall(TWEEN_HALF_MS, () => {
      if (towerSprite.active) {
        towerSprite.clearTint?.();
      }
    });

    // ── Scale pulse tween ─────────────────────────────────────────
    // Capture the current (base) scale BEFORE the tween alters anything.
    const baseScaleX = towerSprite.scaleX;
    const baseScaleY = towerSprite.scaleY;

    const tween = this.scene.tweens.add({
      targets: towerSprite,
      scaleX: baseScaleX * SCALE_PULSE,
      scaleY: baseScaleY * SCALE_PULSE,
      duration: TWEEN_HALF_MS,
      yoyo: true,            // auto-reverses → total 200 ms
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.activeTweens.delete(towerSprite);
        // Guarantee the sprite's scale is exactly restored
        if (towerSprite.active) {
          towerSprite.setScale(baseScaleX, baseScaleY);
        }
      },
    });

    this.activeTweens.set(towerSprite, tween);
  }
}
