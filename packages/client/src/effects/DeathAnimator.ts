import Phaser from 'phaser';

// ─── Element colour map ──────────────────────────────────────────────────────
const ELEMENT_COLORS: Record<string, number> = {
  fire:   0xff8800,
  ice:    0x00ffff,
  water:  0x0088ff,
  poison: 0x44cc44,
};

/**
 * DeathAnimator
 *
 * Purely-cosmetic death FX that runs client-side only.
 * The enemy is already removed from server state before this plays.
 *
 * Usage:
 *   const deathAnimator = new DeathAnimator(scene);
 *   deathAnimator.playDeath(enemy.x, enemy.y, 'fire');
 */
export class DeathAnimator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  playDeath(x: number, y: number, element?: string): void {
    const particleColor = element
      ? (ELEMENT_COLORS[element] ?? 0xffffff)
      : 0xffffff;

    // ── White flash circle (simulates "white tint" for 100 ms) ──────────────
    const flash = this.scene.add.circle(x, y, 14, 0xffffff, 0.9);
    flash.setDepth(102);

    this.scene.time.delayedCall(100, () => {
      if (flash.active) flash.destroy();
    });

    // ── Coloured core: fade out + scale down over 300 ms ────────────────────
    const core = this.scene.add.circle(x, y, 10, particleColor, 0.75);
    core.setDepth(101);

    this.scene.tweens.add({
      targets: core,
      alpha:  { from: 0.75, to: 0 },
      scaleX: { from: 1,    to: 0.3 },
      scaleY: { from: 1,    to: 0.3 },
      duration: 300,
      ease: 'Power2.In',
      onComplete: () => {
        if (core.active) core.destroy();
      },
    });

    // ── 2–3 small particles in element colour ────────────────────────────────
    const count = 2 + Math.floor(Math.random() * 2); // 2 or 3
    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2 + Math.random() * 0.8;
      const radius = 25 + Math.random() * 25;
      const size   = 2 + Math.random() * 3;

      const p = this.scene.add.circle(x, y, size, particleColor, 1);
      p.setDepth(100);

      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        alpha:  0,
        scaleX: 0,
        scaleY: 0,
        duration: 280 + Math.random() * 120,
        ease: 'Power2.Out',
        onComplete: () => {
          if (p.active) p.destroy();
        },
      });
    }
  }
}
