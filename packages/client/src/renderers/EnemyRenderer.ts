import Phaser from 'phaser';
import type { EnemyState } from '@td/shared';
import { TILE_SIZE } from '@td/shared';
import { ENEMY_ASSETS } from '../assets/manifest';
import type { AudioManager } from '../audio/AudioManager';
import { spawnExplosion, spawnFloatingText } from './VFXHelpers';

// ─── Per-enemy runtime state ─────────────────────────────────────────────────
export interface EnemyVisual {
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Ellipse;
  maxHp: number;
  lastHp: number;
  type: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ENEMY_BASE_SCALE = 3;
const SHADOW_DEPTH = 1;
const ENTITY_DEPTH = 10;

export class EnemyRenderer {
  private scene: Phaser.Scene;
  private audio: AudioManager;
  private enemies: Map<string, EnemyVisual> = new Map();

  constructor(scene: Phaser.Scene, audio: AudioManager) {
    this.scene = scene;
    this.audio = audio;
  }

  // ─────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────

  /** Sync enemy visuals to the given server state snapshot. */
  update(enemies: Record<string, EnemyState>): void {
    const current = new Set(Object.keys(enemies));

    for (const [id, ev] of this.enemies) {
      if (!current.has(id) || !enemies[id].alive) {
        this.killEnemy(id, ev);
      }
    }

    for (const [id, enemy] of Object.entries(enemies)) {
      if (!enemy.alive) continue;

      if (!this.enemies.has(id)) {
        const ev = this.createEnemyVisual(id, enemy);
        this.enemies.set(id, ev);
      } else {
        const ev = this.enemies.get(id)!;
        this.updateEnemyVisual(ev, enemy);
      }
    }
  }

  /** Handle an explicit enemy-killed event (e.g. from server). */
  handleEnemyKilled(data: { id: string; x: number; y: number }): void {
    const ev = this.enemies.get(data.id);
    if (ev) {
      this.killEnemy(data.id, ev);
    } else {
      spawnExplosion(this.scene, data.x, data.y, 'fx_small_explosion');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────

  private getEnemyInfo(
    type: string
  ): { key: string; scale: number; deathFxKey: string } {
    const info = ENEMY_ASSETS.find((a) => a.enemyType === type);
    return {
      key: info ? `enemy_${type}` : 'enemy_grunt',
      scale: info ? info.scale * (ENEMY_BASE_SCALE / 3) : ENEMY_BASE_SCALE,
      deathFxKey: info?.deathFxKey ?? 'fx_small_explosion',
    };
  }

  private createEnemyVisual(_id: string, enemy: EnemyState): EnemyVisual {
    const { key, scale } = this.getEnemyInfo(enemy.type);
    const walkAnim = `enemy_${enemy.type}_walk`;
    const idleAnim = `enemy_${enemy.type}_idle`;

    const px = enemy.x * TILE_SIZE + TILE_SIZE / 2;
    const py = enemy.y * TILE_SIZE + TILE_SIZE / 2;

    // Shadow
    const shadow = this.scene.add.ellipse(px, py + 6, 18, 6, 0x000000, 0.4);
    shadow.setDepth(SHADOW_DEPTH);

    // Sprite
    const sprite = this.scene.add.sprite(px, py, key);
    sprite.setScale(scale);
    sprite.setDepth(ENTITY_DEPTH + py * 0.001);

    if (this.scene.anims.exists(walkAnim)) {
      sprite.play(walkAnim);
    } else if (this.scene.anims.exists(idleAnim)) {
      sprite.play(idleAnim);
    }

    // Invisible enemies: shimmer effect
    if (enemy.type === 'invisible') {
      sprite.setAlpha(0.45);
      sprite.setTint(0x88ddff);
      this.scene.tweens.add({
        targets: sprite,
        alpha: { from: 0.15, to: 0.45 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    // HP bar
    const hpBar = this.scene.add.graphics();
    hpBar.setDepth(ENTITY_DEPTH + 1);

    // Entrance scale-pop
    sprite.setScale(scale * 1.5);
    this.scene.tweens.add({
      targets: sprite,
      scaleX: scale,
      scaleY: scale,
      duration: 150,
      ease: 'Back.Out',
    });

    return {
      sprite,
      hpBar,
      shadow,
      maxHp: enemy.hp,
      lastHp: enemy.hp,
      type: enemy.type,
    };
  }

  private updateEnemyVisual(ev: EnemyVisual, enemy: EnemyState): void {
    const { sprite, hpBar, shadow } = ev;
    const px = enemy.x * TILE_SIZE + TILE_SIZE / 2;
    const py = enemy.y * TILE_SIZE + TILE_SIZE / 2;

    // Flip to face direction of movement
    const oldX = sprite.x;
    sprite.setPosition(px, py);
    if (px !== oldX) {
      sprite.setFlipX(px < oldX);
    }

    shadow.setPosition(px, py + 6);

    // Depth sort (Y)
    sprite.setDepth(ENTITY_DEPTH + py * 0.001);

    // HP bar
    const hpRatio = enemy.hp / ev.maxHp;
    this.drawHpBar(hpBar, px, py - 14 * (sprite.scale / 2), hpRatio);

    // Hit flash on damage + floating combat text
    if (enemy.hp < ev.lastHp) {
      const damage = ev.lastHp - enemy.hp;
      sprite.setTint(0xffffff);
      this.scene.time.delayedCall(80, () => {
        if (sprite.active) {
          if (ev.type === 'invisible') {
            sprite.setTint(0x88ddff);
          } else {
            sprite.clearTint();
          }
        }
      });
      // Tiny knockback wiggle
      this.scene.tweens.add({
        targets: sprite,
        x: px + (Math.random() - 0.5) * 8,
        duration: 60,
        yoyo: true,
      });
      if (damage > 0) {
        spawnFloatingText(this.scene, px, py - 10, `-${damage}`, 0xff3333);
      }
      ev.lastHp = enemy.hp;
    }
  }

  private drawHpBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    ratio: number
  ): void {
    g.clear();
    if (ratio >= 1) return;

    const w = 26;
    const h = 4;
    g.fillStyle(0x000000, 0.6);
    g.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
    const color =
      ratio > 0.5 ? 0x44ee44 : ratio > 0.25 ? 0xeecc00 : 0xee2222;
    g.fillStyle(color, 1);
    g.fillRect(x - w / 2, y, w * ratio, h);
    g.fillStyle(0xffffff, 0.2);
    g.fillRect(x - w / 2, y, w * ratio, 1);
    g.setDepth(ENTITY_DEPTH + 1);
  }

  private killEnemy(id: string, ev: EnemyVisual): void {
    const { sprite, hpBar, shadow } = ev;
    const x = sprite.x;
    const y = sprite.y;

    if (ev.type === 'boss' || ev.type === 'tank') {
      this.audio.playBossEnemyDeath();
    } else {
      this.audio.playEnemyDeath();
    }

    spawnFloatingText(this.scene, x, y - 10, '💀', 0xffd700, 16);

    sprite.setTint(0xff4400);
    this.scene.tweens.add({
      targets: sprite,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      angle: Math.random() > 0.5 ? 180 : -180,
      duration: 300,
      ease: 'Power3.In',
      onComplete: () => { if (sprite.active) sprite.destroy(); },
    });

    hpBar.destroy();
    shadow.destroy();
    this.enemies.delete(id);

    const { deathFxKey } = this.getEnemyInfo(ev.type);
    spawnExplosion(this.scene, x, y, deathFxKey);

    if (ev.type === 'boss' || ev.type === 'tank') {
      this.scene.cameras.main.shake(200, 0.01);
    }
  }
}
