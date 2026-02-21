import Phaser from 'phaser';
import type { TowerState } from '@td/shared';
import { TILE_SIZE, TOWER_CONFIGS } from '@td/shared';
import { TOWER_ASSETS } from '../assets/manifest';
import type { TowerAssetInfo } from '../assets/manifest';
import type { AudioManager } from '../audio/AudioManager';
import { spawnDustPuff, spawnFloatingText } from './VFXHelpers';
import { spawnMuzzleFlash, spawnImpact } from './VFXHelpers';

// ─── Per-tower runtime state ─────────────────────────────────────────────────
export interface TowerVisual {
  base: Phaser.GameObjects.Image;
  soldier: Phaser.GameObjects.Sprite;
  rangeCircle: Phaser.GameObjects.Graphics;
  aura: Phaser.GameObjects.Ellipse;
  selected: boolean;
  configId: string;
}

// ─── Projectile pool entry ───────────────────────────────────────────────────
interface LiveProjectile {
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Shape;
  active: boolean;
  targetId: string | null;
  tween: Phaser.Tweens.Tween | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BUILDING_SCALE = 0.35;
const MAX_PROJECTILES = 120;
const SHADOW_DEPTH = 1;
const ENTITY_DEPTH = 10;
const PROJECTILE_DEPTH = 20;
const FX_DEPTH = 30;

export class TowerRenderer {
  private scene: Phaser.Scene;
  private audio: AudioManager;
  private towers: Map<string, TowerVisual> = new Map();
  private projectiles: LiveProjectile[] = [];

  constructor(scene: Phaser.Scene, audio: AudioManager) {
    this.scene = scene;
    this.audio = audio;
    this.initProjectilePool();
  }

  // ─────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────

  /** Sync tower visuals to the given server state snapshot. */
  update(towers: Record<string, TowerState>): void {
    const current = new Set(Object.keys(towers));

    for (const [id, tv] of this.towers) {
      if (!current.has(id)) {
        this.destroyTowerVisual(tv);
        this.towers.delete(id);
      }
    }

    for (const [id, tower] of Object.entries(towers)) {
      const px = tower.x * TILE_SIZE + TILE_SIZE / 2;
      const py = tower.y * TILE_SIZE + TILE_SIZE / 2;

      if (!this.towers.has(id)) {
        const tv = this.createTowerVisual(id, tower, px, py);
        this.towers.set(id, tv);
        this.playTowerPlaceAnimation(tv, px, py);
      } else {
        const tv = this.towers.get(id)!;
        tv.base.setPosition(px, py);
        tv.soldier.setPosition(px, py - 8);
        tv.aura.setPosition(px, py + 4);
      }
    }
  }

  /** Returns true if a tower occupies the given tile coordinates. */
  isTileOccupied(tileX: number, tileY: number): boolean {
    for (const [, tv] of this.towers) {
      const ttx = Math.floor(tv.base.x / TILE_SIZE);
      const tty = Math.floor(tv.base.y / TILE_SIZE);
      if (ttx === tileX && tty === tileY) return true;
    }
    return false;
  }

  /** Returns the tower instance at the given tile, or null. */
  getTowerAtTile(
    tileX: number,
    tileY: number
  ): { instanceId: string; tv: TowerVisual } | null {
    for (const [id, tv] of this.towers) {
      const ttx = Math.floor(tv.base.x / TILE_SIZE);
      const tty = Math.floor(tv.base.y / TILE_SIZE);
      if (ttx === tileX && tty === tileY) {
        return { instanceId: id, tv };
      }
    }
    return null;
  }

  /** Pulse all tower soldiers — called on wave start. */
  playWaveFanfare(): void {
    for (const [, tv] of this.towers) {
      this.scene.tweens.add({
        targets: tv.soldier,
        scaleX: tv.soldier.scaleX * 1.3,
        scaleY: tv.soldier.scaleY * 1.3,
        yoyo: true,
        duration: 200,
        ease: 'Back.Out',
      });
    }
  }

  /** Handle a shot-fired event: fire a projectile and play attack animation. */
  handleShotFired(data: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    targetId: string;
    configId: string;
    elementColor: number;
  }): void {
    const assetInfo =
      TOWER_ASSETS.find((a) => data.configId.startsWith(a.element)) ??
      TOWER_ASSETS[TOWER_ASSETS.length - 1];
    const projKey = assetInfo.projKey;

    if (projKey === 'proj_grenade') {
      this.audio.playGrenadeShoot();
    } else {
      this.audio.playTowerShoot();
    }

    this.fireProjectile(
      data.fromX,
      data.fromY,
      data.toX,
      data.toY,
      data.targetId,
      projKey,
      data.elementColor
    );

    // Play tower attack animation for the matching tower
    for (const [, tv] of this.towers) {
      const dist = Phaser.Math.Distance.Between(
        tv.base.x,
        tv.base.y,
        data.fromX,
        data.fromY
      );
      if (dist < 8) {
        const currentTextureKey = tv.soldier.texture.key;
        const attackAnimKey = `${currentTextureKey.replace('_idle', '_attack')}_attack`;
        const idleAnimKey = `${currentTextureKey}_idle`;
        if (this.scene.anims.exists(attackAnimKey)) {
          tv.soldier.play(attackAnimKey);
          tv.soldier.once('animationcomplete', () => {
            if (tv.soldier.active) tv.soldier.play(idleAnimKey);
          });
        }
        break;
      }
    }
  }

  /** Handle the tower-sold-visual event. */
  handleTowerSoldVisual(data: { instanceId: string; goldRefund: number }): void {
    const tv = this.towers.get(data.instanceId);
    if (!tv) return;

    // Remove from tracking BEFORE the tween so update() can't double-destroy
    // during the 300ms dissolve window (server snapshots arrive every 250ms).
    this.towers.delete(data.instanceId);

    spawnFloatingText(
      this.scene,
      tv.base.x,
      tv.base.y - 20,
      `+${data.goldRefund}g 💰`,
      0xffd700,
      16
    );

    this.scene.tweens.add({
      targets: [tv.base, tv.soldier, tv.aura],
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 300,
      ease: 'Power2.In',
      onComplete: () => {
        this.destroyTowerVisual(tv);
      },
    });

    this.audio.playSellTower();
  }

  // ─────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────

  private getElementColor(configId: string): number {
    const element = configId.split('_')[0];
    switch (element) {
      case 'fire':   return 0xff4400;
      case 'water':  return 0x0088ff;
      case 'ice':    return 0x88ccff;
      case 'poison': return 0x44cc44;
      default:       return 0xaaaaaa;
    }
  }

  private getTowerAssetInfo(configId: string): TowerAssetInfo {
    const element = configId.split('_')[0] as string;
    return (
      TOWER_ASSETS.find((a) => a.element === element) ??
      TOWER_ASSETS[TOWER_ASSETS.length - 1]
    );
  }

  private createTowerVisual(
    _id: string,
    tower: TowerState,
    px: number,
    py: number
  ): TowerVisual {
    const assetInfo = this.getTowerAssetInfo(tower.configId);
    const soldierKey = assetInfo.idleKey;

    // Building base
    const base = this.scene.add.image(px, py, assetInfo.buildingKey);
    base.setScale(BUILDING_SCALE);
    base.setDepth(ENTITY_DEPTH + py * 0.001);
    base.setOrigin(0.5, 0.7);

    // Soldier sprite
    const soldier = this.scene.add.sprite(px, py - 8, soldierKey);
    soldier.setScale(assetInfo.unitScale);
    soldier.setDepth(ENTITY_DEPTH + py * 0.001 + 0.5);
    soldier.play(`${assetInfo.idleKey}_idle`);

    // Shadow
    const shadowEllipse = this.scene.add.ellipse(px, py + 8, 24, 8, 0x000000, 0.3);
    shadowEllipse.setDepth(SHADOW_DEPTH);

    // Element aura
    const elementColor = this.getElementColor(tower.configId);
    const aura = this.scene.add.ellipse(px, py + 4, 30, 10, elementColor, 0.15);
    aura.setDepth(SHADOW_DEPTH + 0.5);
    this.scene.tweens.add({
      targets: aura,
      alpha: { from: 0.08, to: 0.2 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    // Range circle (hidden by default, shown on select)
    const rangeCircle = this.scene.add.graphics();
    rangeCircle.setDepth(ENTITY_DEPTH - 1);
    rangeCircle.setVisible(false);

    return {
      base,
      soldier,
      rangeCircle,
      aura,
      selected: false,
      configId: tower.configId,
    };
  }

  private destroyTowerVisual(tv: TowerVisual): void {
    tv.base.destroy();
    tv.soldier.destroy();
    tv.rangeCircle.destroy();
    tv.aura.destroy();
  }

  private playTowerPlaceAnimation(tv: TowerVisual, px: number, py: number): void {
    this.audio.playTowerPlace();

    const soldierTargetScale = tv.soldier.scaleX;

    tv.soldier.setPosition(px, py - 40);
    tv.soldier.setAlpha(0);
    tv.soldier.setScale(soldierTargetScale * 0.5);
    tv.base.setAlpha(0);

    this.scene.tweens.add({
      targets: [tv.soldier, tv.base],
      y: (target: Phaser.GameObjects.GameObject) => {
        const go = target as Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
        return go === tv.soldier ? py - 8 : py;
      },
      alpha: 1,
      scaleX: (target: Phaser.GameObjects.GameObject) => {
        const go = target as Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
        return go === tv.soldier ? soldierTargetScale : BUILDING_SCALE;
      },
      scaleY: (target: Phaser.GameObjects.GameObject) => {
        const go = target as Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
        return go === tv.soldier ? soldierTargetScale : BUILDING_SCALE;
      },
      duration: 250,
      ease: 'Back.Out',
    });

    spawnDustPuff(this.scene, px, py + 8);
    this.scene.cameras.main.shake(80, 0.003);
  }

  // ─────────────────────────────────────────────────────────────────
  // Projectile pool
  // ─────────────────────────────────────────────────────────────────

  private initProjectilePool(): void {
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const sprite = this.scene.add.sprite(0, 0, 'proj_bullet');
      sprite.setVisible(false);
      sprite.setDepth(PROJECTILE_DEPTH);
      sprite.setScale(2.5);
      this.projectiles.push({ sprite, active: false, targetId: null, tween: null });
    }
  }

  private getProjectile(): LiveProjectile | null {
    return this.projectiles.find((p) => !p.active) ?? null;
  }

  private fireProjectile(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    targetId: string,
    projKey: string,
    elementColor: number
  ): void {
    const p = this.getProjectile();
    if (!p) return;

    const sprite = p.sprite as Phaser.GameObjects.Sprite;
    sprite.setTexture(projKey);
    sprite.setPosition(fromX, fromY);
    sprite.setVisible(true);
    sprite.setAlpha(1);
    sprite.setScale(2.5);
    sprite.setTint(elementColor);
    sprite.setFrame(0);

    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    sprite.setRotation(angle);

    if (projKey === 'proj_grenade') {
      sprite.play('proj_grenade_spin');
    }

    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const speed = 400;
    const dur = (dist / speed) * 1000;

    p.active = true;
    p.targetId = targetId;

    p.tween = this.scene.tweens.add({
      targets: sprite,
      x: toX,
      y: toY,
      duration: dur,
      ease: 'Linear',
      onComplete: () => {
        spawnImpact(this.scene, sprite.x, sprite.y, elementColor, projKey === 'proj_grenade');
        sprite.stop();
        sprite.setVisible(false);
        p.active = false;
        p.targetId = null;
        p.tween = null;
      },
    });

    spawnMuzzleFlash(this.scene, fromX, fromY, elementColor);
  }
}
