import Phaser from 'phaser';
import { ASSET_MANIFEST } from '../assets/manifest';

export class BootScene extends Phaser.Scene {
  private loadingBar!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createLoadingScreen();
    this.loadAllAssets();
  }

  create(): void {
    this.createAnimations();
    this.time.delayedCall(200, () => {
      this.scene.start('LobbyScene');
    });
  }

  private createLoadingScreen(): void {
    const { width, height } = this.cameras.main;
    const cx = width / 2;
    const cy = height / 2;

    this.cameras.main.setBackgroundColor('#0d0d1a');

    // Title
    this.add.text(cx, cy - 80, '⚔ ELEMENT DEFENSE ⚔', {
      fontSize: '36px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 40, 'LOADING...', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Bar background
    this.add.rectangle(cx, cy, 400, 28, 0x222244).setOrigin(0.5);
    this.add.rectangle(cx, cy, 402, 30, 0x4444aa, 0).setStrokeStyle(2, 0x6666ff);

    this.loadingBar = this.add.graphics();

    this.load.on('progress', (v: number) => {
      const barW = 400;
      const barH = 28;
      this.loadingBar.clear();
      this.loadingBar.fillStyle(0x00ff88, 1);
      this.loadingBar.fillRect(cx - barW / 2, cy - barH / 2, barW * v, barH);
    });

    this.load.on('fileprogress', (_file: { key: string }) => {
      // Could show file name if desired
    });
  }

  private loadAllAssets(): void {
    for (const entry of ASSET_MANIFEST) {
      switch (entry.kind) {
        case 'image':
          this.load.image(entry.key, entry.path);
          break;
        case 'spritesheet':
          this.load.spritesheet(entry.key, entry.path, {
            frameWidth: entry.frameWidth,
            frameHeight: entry.frameHeight,
          });
          break;
        case 'placeholder':
          this.generatePlaceholderTexture(
            entry.key,
            entry.color,
            entry.width ?? 64,
            entry.height ?? 64
          );
          break;
      }
    }
  }

  private generatePlaceholderTexture(key: string, color: number, width: number, height: number): void {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, width, height);
    g.lineStyle(2, 0xffffff, 0.3);
    g.strokeRect(0, 0, width, height);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  private createAnimations(): void {
    const anims = this.anims;

    // ── Enemy Robots ─────────────────────────────────────────────────
    // Scarab / Spider / Centipede: 80×80 or 128×288, frameWidth=16, frameHeight=16
    // Rows: 0=idle(5f), 1=walk(5f), 2=firing(5f), 3=melee(5f), 4=destroyed(5f)
    // Centipede same row layout but many more rows (use row 0 = idle, row 1 = walk)

    const robotKeys = ['enemy_grunt', 'enemy_tank', 'enemy_invisible'];
    for (const key of robotKeys) {
      this.safeCreateAnim(anims, `${key}_idle`, {
        key, frames: anims.generateFrameNumbers(key, { start: 0, end: 4 }),
        frameRate: 6, repeat: -1,
      });
      this.safeCreateAnim(anims, `${key}_walk`, {
        key, frames: anims.generateFrameNumbers(key, { start: 5, end: 9 }),
        frameRate: 8, repeat: -1,
      });
      this.safeCreateAnim(anims, `${key}_fire`, {
        key, frames: anims.generateFrameNumbers(key, { start: 10, end: 14 }),
        frameRate: 10, repeat: 0,
      });
      this.safeCreateAnim(anims, `${key}_death`, {
        key, frames: anims.generateFrameNumbers(key, { start: 20, end: 24 }),
        frameRate: 10, repeat: 0,
      });
    }

    // Boss (Centipede — same row layout, larger sprite)
    this.safeCreateAnim(anims, 'enemy_boss_idle', {
      key: 'enemy_boss', frames: anims.generateFrameNumbers('enemy_boss', { start: 0, end: 4 }),
      frameRate: 6, repeat: -1,
    });
    this.safeCreateAnim(anims, 'enemy_boss_walk', {
      key: 'enemy_boss', frames: anims.generateFrameNumbers('enemy_boss', { start: 5, end: 9 }),
      frameRate: 8, repeat: -1,
    });
    this.safeCreateAnim(anims, 'enemy_boss_death', {
      key: 'enemy_boss', frames: anims.generateFrameNumbers('enemy_boss', { start: 20, end: 24 }),
      frameRate: 8, repeat: 0,
    });

    // Runner (Wasp): single row of 8 frames, all walk
    this.safeCreateAnim(anims, 'enemy_runner_walk', {
      key: 'enemy_runner', frames: anims.generateFrameNumbers('enemy_runner', { start: 0, end: 7 }),
      frameRate: 12, repeat: -1,
    });
    this.safeCreateAnim(anims, 'enemy_runner_idle', {
      key: 'enemy_runner', frames: anims.generateFrameNumbers('enemy_runner', { start: 0, end: 7 }),
      frameRate: 8, repeat: -1,
    });

    // Flyer (Hornet): frameWidth=48, frameHeight=24 → row 0 = hover (4 frames), row 1 = firing (4 frames)
    this.safeCreateAnim(anims, 'enemy_flyer_idle', {
      key: 'enemy_flyer', frames: anims.generateFrameNumbers('enemy_flyer', { start: 0, end: 3 }),
      frameRate: 8, repeat: -1,
    });
    this.safeCreateAnim(anims, 'enemy_flyer_fire', {
      key: 'enemy_flyer', frames: anims.generateFrameNumbers('enemy_flyer', { start: 4, end: 7 }),
      frameRate: 10, repeat: 0,
    });

    // ── Soldiers (Towers): 80×112, frameWidth=16, frameHeight=16 ─────
    // Rows: 0=idle(5f), 1=walk(5f), 2=crawl(5f), 3=fire(5f), 4=hit(5f), 5=death(5f), 6=throw(5f)
    const soldierKeys = ['tower_fire', 'tower_water', 'tower_ice', 'tower_poison', 'tower_shared'];
    for (const key of soldierKeys) {
      this.safeCreateAnim(anims, `${key}_idle`, {
        key, frames: anims.generateFrameNumbers(key, { start: 0, end: 4 }),
        frameRate: 6, repeat: -1,
      });
      this.safeCreateAnim(anims, `${key}_fire`, {
        key, frames: anims.generateFrameNumbers(key, { start: 15, end: 19 }),
        frameRate: 12, repeat: 0,
      });
      this.safeCreateAnim(anims, `${key}_throw`, {
        key, frames: anims.generateFrameNumbers(key, { start: 30, end: 34 }),
        frameRate: 12, repeat: 0,
      });
    }

    // ── Effects ───────────────────────────────────────────────────────
    // big-explosion: 352×32, frameWidth=32, frameHeight=32 → 11 frames
    this.safeCreateAnim(anims, 'fx_big_explosion', {
      key: 'fx_big_explosion',
      frames: anims.generateFrameNumbers('fx_big_explosion', { start: 0, end: 10 }),
      frameRate: 20, repeat: 0,
    });

    // small-explosion: 216×24, frameWidth=24, frameHeight=24 → 9 frames
    this.safeCreateAnim(anims, 'fx_small_explosion', {
      key: 'fx_small_explosion',
      frames: anims.generateFrameNumbers('fx_small_explosion', { start: 0, end: 8 }),
      frameRate: 18, repeat: 0,
    });

    // muzzle flash: 32×8, frameWidth=8, frameHeight=8 → 4 frames
    this.safeCreateAnim(anims, 'fx_muzzle', {
      key: 'fx_muzzle',
      frames: anims.generateFrameNumbers('fx_muzzle', { start: 0, end: 3 }),
      frameRate: 24, repeat: 0,
    });

    // bullet impacts: 80×8, frameWidth=8, frameHeight=8 → 10 frames
    this.safeCreateAnim(anims, 'fx_impact', {
      key: 'fx_impact',
      frames: anims.generateFrameNumbers('fx_impact', { start: 0, end: 9 }),
      frameRate: 20, repeat: 0,
    });

    // smoke: 64×8, frameWidth=8, frameHeight=8 → 8 frames
    this.safeCreateAnim(anims, 'fx_smoke', {
      key: 'fx_smoke',
      frames: anims.generateFrameNumbers('fx_smoke', { start: 0, end: 7 }),
      frameRate: 12, repeat: 0,
    });

    // Tiny Swords explosion: 1536×192, frameWidth=192, frameHeight=192 → 8 frames
    this.safeCreateAnim(anims, 'fx_ts_explosion', {
      key: 'fx_ts_explosion',
      frames: anims.generateFrameNumbers('fx_ts_explosion', { start: 0, end: 7 }),
      frameRate: 16, repeat: 0,
    });

    // Tiny Swords fire: 512×64, frameWidth=64, frameHeight=64 → 8 frames
    this.safeCreateAnim(anims, 'fx_ts_fire', {
      key: 'fx_ts_fire',
      frames: anims.generateFrameNumbers('fx_ts_fire', { start: 0, end: 7 }),
      frameRate: 12, repeat: -1,
    });

    // Hit sparks: frameWidth=8, frameHeight=8 → check actual frame count
    this.safeCreateAnim(anims, 'fx_hit_sparks', {
      key: 'fx_hit_sparks',
      frames: anims.generateFrameNumbers('fx_hit_sparks', { start: 0, end: 5 }),
      frameRate: 20, repeat: 0,
    });

    // Tiny Swords fire 2
    this.safeCreateAnim(anims, 'fx_ts_fire2', {
      key: 'fx_ts_fire2',
      frames: anims.generateFrameNumbers('fx_ts_fire2', { start: 0, end: 7 }),
      frameRate: 12, repeat: -1,
    });

    // Projectile spin (grenade)
    this.safeCreateAnim(anims, 'proj_grenade_spin', {
      key: 'proj_grenade',
      frames: anims.generateFrameNumbers('proj_grenade', { start: 0, end: 7 }),
      frameRate: 20, repeat: -1,
    });
  }

  private safeCreateAnim(
    anims: Phaser.Animations.AnimationManager,
    key: string,
    config: Phaser.Types.Animations.Animation
  ): void {
    if (!anims.exists(key)) {
      anims.create({ ...config, key });
    }
  }
}
