import Phaser from 'phaser';

interface Projectile {
  sprite: Phaser.GameObjects.Shape;
  active: boolean;
  targetId: string | null;
  speed: number;
  damage: number;
  element: number;
}

export class ProjectilePool {
  private scene: Phaser.Scene;
  private pool: Projectile[] = [];
  private maxSize: number;

  constructor(scene: Phaser.Scene, maxSize = 100) {
    this.scene = scene;
    this.maxSize = maxSize;

    // Pre-populate the pool
    this.initializePool();
  }

  private initializePool(): void {
    for (let i = 0; i < this.maxSize; i++) {
      const sprite = this.scene.add.circle(0, 0, 6, 0xffff00);
      sprite.setVisible(false);
      sprite.setDepth(30);

      this.pool.push({
        sprite,
        active: false,
        targetId: null,
        speed: 200,
        damage: 0,
        element: 0xffff00,
      });
    }
  }

  fire(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    targetId: string,
    speed: number,
    damage: number,
    elementColor: number
  ): void {
    // Find inactive projectile
    let projectile = this.pool.find((p) => !p.active);

    if (!projectile) {
      // Pool exhausted, create new (up to max)
      if (this.pool.length < this.maxSize) {
        const sprite = this.scene.add.circle(startX, startY, 6, elementColor) as Phaser.GameObjects.Shape;
        sprite.setVisible(true);
        sprite.setDepth(30);

        projectile = {
          sprite,
          active: true,
          targetId,
          speed,
          damage,
          element: elementColor,
        };
        this.pool.push(projectile);
      } else {
        // Pool fully exhausted, just return
        return;
      }
    }

    // Reset and activate projectile
    projectile.active = true;
    projectile.targetId = targetId;
    projectile.speed = speed;
    projectile.damage = damage;
    projectile.element = elementColor;

    projectile.sprite.setPosition(startX, startY);
    projectile.sprite.setFillStyle(elementColor);
    projectile.sprite.setVisible(true);

    // Animate to target
    const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
    const duration = (distance / speed) * 1000;

    // Create tween for movement
    this.scene.tweens.add({
      targets: projectile.sprite,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        this.handleProjectileHit(projectile);
      },
    });

    // Store tween reference for cancellation
    (projectile.sprite as unknown as { movementTween: Phaser.Tweens.Tween }).movementTween = 
      this.scene.tweens.getTweensOf(projectile.sprite)[0];
  }

  private handleProjectileHit(projectile: Projectile): void {
    if (!projectile.active) return;

    // Create small impact effect
    this.createImpactEffect(
      projectile.sprite.x,
      projectile.sprite.y,
      projectile.element
    );

    // Deactivate projectile
    projectile.active = false;
    projectile.targetId = null;
    projectile.sprite.setVisible(false);
  }

  private createImpactEffect(x: number, y: number, color: number): void {
    // Small flash
    const flash = this.scene.add.circle(x, y, 10, color, 0.8) as Phaser.GameObjects.Shape;
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(31);

    this.scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        flash.destroy();
      },
    });
  }

  // Update projectile positions to follow moving targets
  update(delta: number): void {
    for (const projectile of this.pool) {
      if (!projectile.active || !projectile.targetId) continue;

      // Check if we need to update target position
      // This would require access to enemy positions - handled externally
    }
  }

  // Cancel projectiles targeting a specific enemy (when enemy dies)
  cancelForTarget(targetId: string): void {
    for (const projectile of this.pool) {
      if (projectile.active && projectile.targetId === targetId) {
        // Stop the tween
        const tween = (projectile.sprite as unknown as { movementTween: Phaser.Tweens.Tween }).movementTween;
        if (tween) {
          tween.stop();
        }

        // Deactivate
        projectile.active = false;
        projectile.targetId = null;
        projectile.sprite.setVisible(false);
      }
    }
  }

  clear(): void {
    for (const projectile of this.pool) {
      if (projectile.active) {
        const tween = (projectile.sprite as unknown as { movementTween: Phaser.Tweens.Tween }).movementTween;
        if (tween) {
          tween.stop();
        }

        projectile.active = false;
        projectile.targetId = null;
        projectile.sprite.setVisible(false);
      }
    }
  }

  getActiveCount(): number {
    return this.pool.filter((p) => p.active).length;
  }

  destroy(): void {
    for (const projectile of this.pool) {
      const tween = (projectile.sprite as unknown as { movementTween: Phaser.Tweens.Tween }).movementTween;
      if (tween) {
        tween.stop();
      }
      projectile.sprite.destroy();
    }
    this.pool = [];
  }
}
