/**
 * VFXHelpers.ts — Shared visual-effect helpers.
 *
 * All functions accept a `Phaser.Scene` so they can be called from any
 * renderer without coupling to GameScene.
 */

const FX_DEPTH = 30;

export function spawnExplosion(
  scene: Phaser.Scene,
  x: number,
  y: number,
  fxKey: string
): void {
  if (!scene.textures.exists(fxKey)) return;

  const fx = scene.add.sprite(x, y, fxKey);
  fx.setDepth(FX_DEPTH);

  const scale = fxKey === 'fx_big_explosion' ? 2 : 1.5;
  fx.setScale(scale);

  fx.play(fxKey);
  fx.once('animationcomplete', () => { fx.destroy(); });

  // Extra Tiny Swords explosion flair for boss/tank
  if (fxKey === 'fx_big_explosion' && scene.textures.exists('fx_ts_explosion')) {
    const ts = scene.add.sprite(x, y, 'fx_ts_explosion');
    ts.setDepth(FX_DEPTH - 1);
    ts.setScale(0.35);
    ts.setAlpha(0.85);
    ts.play('fx_ts_explosion');
    ts.once('animationcomplete', () => { ts.destroy(); });
  }
}

export function spawnMuzzleFlash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tint: number
): void {
  if (!scene.textures.exists('fx_muzzle')) return;
  const fx = scene.add.sprite(x, y, 'fx_muzzle');
  fx.setScale(2);
  fx.setDepth(FX_DEPTH);
  fx.setTint(tint);
  fx.play('fx_muzzle');
  fx.once('animationcomplete', () => { fx.destroy(); });
}

export function spawnImpact(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tint: number,
  isSplash: boolean
): void {
  if (!scene.textures.exists('fx_impact')) return;
  const fx = scene.add.sprite(x, y, 'fx_impact');
  fx.setScale(isSplash ? 3 : 2);
  fx.setDepth(FX_DEPTH);
  fx.setTint(tint);
  fx.play('fx_impact');
  fx.once('animationcomplete', () => { fx.destroy(); });

  if (isSplash) {
    spawnExplosion(scene, x, y, 'fx_small_explosion');
  }
}

export function spawnDustPuff(scene: Phaser.Scene, x: number, y: number): void {
  if (!scene.textures.exists('fx_smoke')) return;
  const fx = scene.add.sprite(x, y, 'fx_smoke');
  fx.setScale(2);
  fx.setDepth(FX_DEPTH - 1);
  fx.setTint(0xbbbbbb);
  fx.setAlpha(0.7);
  fx.play('fx_smoke');
  fx.once('animationcomplete', () => { fx.destroy(); });
}

/** Spawn floating combat / reward text that drifts up and fades out. */
export function spawnFloatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number,
  fontSize: number = 14
): void {
  const colorStr = '#' + color.toString(16).padStart(6, '0');
  const txt = scene.add.text(x, y, text, {
    fontFamily: '"Arial Black", Arial, sans-serif',
    fontSize: `${fontSize}px`,
    color: colorStr,
    stroke: '#000000',
    strokeThickness: 2,
  });
  txt.setOrigin(0.5, 0.5);
  txt.setDepth(FX_DEPTH + 1);
  txt.setAlpha(0);

  scene.tweens.add({
    targets: txt,
    y: y - 30,
    alpha: { from: 0, to: 1 },
    duration: 200,
    ease: 'Quad.Out',
    onComplete: () => {
      scene.tweens.add({
        targets: txt,
        y: txt.y - 10,
        alpha: 0,
        duration: 600,
        ease: 'Quad.In',
        onComplete: () => {
          txt.destroy();
        },
      });
    },
  });
}
