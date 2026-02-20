import Phaser from 'phaser';
import type { GameState, GamePhase, Vec2, TowerState, EnemyState, BuildZone } from '@td/shared';
import { TILE_SIZE } from '@td/shared';
import { GameClient } from '../GameClient';
import { ENEMY_ASSETS, TOWER_ASSETS } from '../assets/manifest';
import { AudioManager } from '../audio/AudioManager';

// ─── Per-tower runtime state ─────────────────────────────────────────────────
interface TowerVisual {
  base: Phaser.GameObjects.Image;
  soldier: Phaser.GameObjects.Sprite;
  rangeCircle: Phaser.GameObjects.Graphics;
  selected: boolean;
}

// ─── Per-enemy runtime state ─────────────────────────────────────────────────
interface EnemyVisual {
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Ellipse;
  maxHp: number;
  lastHp: number;
  type: string;
}

// ─── Projectile pool entry ───────────────────────────────────────────────────
interface LiveProjectile {
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Shape;
  active: boolean;
  targetId: string | null;
  tween: Phaser.Tweens.Tween | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SOLDIER_SCALE = 3;
const ENEMY_BASE_SCALE = 3;
const BUILDING_SCALE = 0.28;
const MAX_PROJECTILES = 120;
const CLOUD_DEPTH = -10;
const SHADOW_DEPTH = 1;
const TERRAIN_DEPTH = 0;
const DECO_DEPTH = 5;
const ENTITY_DEPTH = 10;
const PROJECTILE_DEPTH = 20;
const FX_DEPTH = 30;
const HUD_DEPTH = 50;

export class GameScene extends Phaser.Scene {
  // ── Audio ──────────────────────────────────────────────────────────
  private audio = new AudioManager();

  // ── Visuals ────────────────────────────────────────────────────────
  private towers: Map<string, TowerVisual> = new Map();
  private enemies: Map<string, EnemyVisual> = new Map();
  private projectiles: LiveProjectile[] = [];

  // ── Map graphics ──────────────────────────────────────────────────
  private tileLayer!: Phaser.GameObjects.Group;        // tileset ground sprites
  private terrainLayer!: Phaser.GameObjects.Graphics;
  private decorationLayer!: Phaser.GameObjects.Group;
  private cloudLayer!: Phaser.GameObjects.Group;
  private ghostGraphics!: Phaser.GameObjects.Graphics;
  private rangePreview!: Phaser.GameObjects.Graphics;

  // ── Map data ──────────────────────────────────────────────────────
  private waypoints: Vec2[] = [];
  private buildZones: BuildZone[] = [];
  private mapWidth = 0;
  private mapHeight = 0;
  private currentPhase: GamePhase = 'prep';
  private selectedTowerId: string | null = null;

  // ── Timing ────────────────────────────────────────────────────────
  private cloudTimer = 0;
  private lastBaseHp = -1;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2d5a1b'); // Lush grass green

    // Audio
    this.audio.bind(this);

    // Layering objects
    this.tileLayer = this.add.group();
    this.decorationLayer = this.add.group();
    this.cloudLayer = this.add.group();
    this.terrainLayer = this.add.graphics().setDepth(TERRAIN_DEPTH);
    this.ghostGraphics = this.add.graphics().setDepth(HUD_DEPTH);
    this.rangePreview = this.add.graphics().setDepth(HUD_DEPTH - 1);

    // Input
    this.input.on('pointermove', this.handleMouseMove, this);
    this.input.on('pointerdown', this.handleTileClick, this);

    // Events from HUD / network
    this.events.on('sync-state', this.syncState, this);
    this.events.on('tower-selected', this.handleTowerSelected, this);
    this.events.on('tower-deselected', this.handleTowerDeselected, this);
    this.events.on('shot-fired', this.handleShotFired, this);
    this.events.on('enemy-killed', this.handleEnemyKilled, this);
    this.events.on('base-damaged', this.handleBaseDamaged, this);

    this.setupDemoMap();
    this.spawnFloatingClouds();
    this.initProjectilePool();
  }

  update(_time: number, delta: number): void {
    const gameClient = this.registry.get('gameClient') as GameClient;

    if (gameClient) {
      const state = gameClient.getLatestState();
      if (state) {
        if (state.phase !== this.currentPhase) {
          this.handlePhaseTransition(state.phase);
          this.currentPhase = state.phase;
        }
        this.syncState(state);

        // Screenshake when base HP drops
        if (this.lastBaseHp !== -1 && state.baseHp < this.lastBaseHp) {
          const dmg = this.lastBaseHp - state.baseHp;
          this.cameras.main.shake(300, Math.min(0.02, dmg * 0.002));
          this.flashRed();
          this.audio.playBaseDamage();
        }
        this.lastBaseHp = state.baseHp;
      }
    }

    // Animate clouds gently
    this.cloudTimer += delta;
    for (const obj of this.cloudLayer.getChildren()) {
      const cloud = obj as Phaser.GameObjects.Image;
      cloud.x += (cloud as unknown as { speed: number }).speed * (delta / 1000);
      if (cloud.x > this.mapWidth * TILE_SIZE + 200) {
        cloud.x = -200;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Map Setup
  // ─────────────────────────────────────────────────────────────────

  private setupDemoMap(): void {
    this.waypoints = [
      { x: 0, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 5 },
      { x: 7, y: 5 },
      { x: 7, y: 3 },
      { x: 10, y: 3 },
    ];

    this.buildZones = [
      { x: 1, y: 1, width: 2, height: 1 },
      { x: 4, y: 4, width: 2, height: 2 },
      { x: 6, y: 4, width: 1, height: 2 },
      { x: 8, y: 2, width: 1, height: 1 },
      { x: 2, y: 3, width: 1, height: 1 },
    ];

    this.mapWidth = 12;
    this.mapHeight = 8;

    this.renderMap(this.waypoints, this.buildZones);
    this.spawnDecorations();
  }

  renderMap(waypoints: Vec2[], buildZones: BuildZone[]): void {
    this.waypoints = waypoints;
    this.buildZones = buildZones;
    this.terrainLayer.clear();

    // ── Tile layer (tileset sprites beneath graphics) ─────────────
    this.tileLayer.clear(true, true);
    const hasTileset = this.textures.exists('tileset_color1_ss');
    if (hasTileset) {
      // Tiny Swords Tilemap_color1: 576×384 → 9 cols × 6 rows at 64px each
      // Frame layout: row 0 = base grass (solid green center ≈ frame 4)
      //               row 2 = dirt/earth variants
      // We scatter a few grass frame variants for a textured look.
      const grassFrames = [4, 4, 4, 4, 3, 5]; // weight toward center tile
      for (let ty = 0; ty < this.mapHeight; ty++) {
        for (let tx = 0; tx < this.mapWidth; tx++) {
          const frame = grassFrames[(tx * 3 + ty * 7) % grassFrames.length];
          const tile = this.add.image(
            tx * TILE_SIZE + TILE_SIZE / 2,
            ty * TILE_SIZE + TILE_SIZE / 2,
            'tileset_color1_ss',
            frame
          );
          tile.setDepth(TERRAIN_DEPTH - 1);
          this.tileLayer.add(tile);
        }
      }
    }

    const g = this.terrainLayer;

    // Draw dirt path
    // Path glow/shadow
    g.lineStyle(TILE_SIZE + 12, 0x3d2b1f, 0.5);
    this.drawPath(g, waypoints);

    // Main path
    g.lineStyle(TILE_SIZE, 0x8b6914, 1);
    this.drawPath(g, waypoints);

    // Path edge highlight
    g.lineStyle(TILE_SIZE - 8, 0xa07820, 0.6);
    this.drawPath(g, waypoints);

    // Path center track
    g.lineStyle(4, 0xc4a240, 0.4);
    this.drawPath(g, waypoints);

    // Build zone foundations (stone-ish)
    for (const zone of buildZones) {
      // Stone base
      g.fillStyle(0x5a5a6a, 0.85);
      g.fillRect(zone.x * TILE_SIZE, zone.y * TILE_SIZE, zone.width * TILE_SIZE, zone.height * TILE_SIZE);
      // Stone border
      g.lineStyle(3, 0x8888aa, 0.9);
      g.strokeRect(zone.x * TILE_SIZE, zone.y * TILE_SIZE, zone.width * TILE_SIZE, zone.height * TILE_SIZE);
      // Inner pattern
      g.lineStyle(1, 0x6a6a7a, 0.4);
      for (let tx = zone.x; tx < zone.x + zone.width; tx++) {
        for (let ty = zone.y; ty < zone.y + zone.height; ty++) {
          g.strokeRect(tx * TILE_SIZE + 4, ty * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        }
      }
    }

    // ── Start marker ──────────────────────────────────────────────
    if (waypoints.length > 0) {
      const sp = waypoints[0];
      const sx = sp.x * TILE_SIZE + TILE_SIZE / 2;
      const sy = sp.y * TILE_SIZE + TILE_SIZE / 2;
      g.fillStyle(0xff4444, 0.8);
      g.fillCircle(sx, sy, 10);
      g.lineStyle(3, 0xff0000, 1);
      g.strokeCircle(sx, sy, 14);
    }

    // ── End marker ────────────────────────────────────────────────
    if (waypoints.length > 1) {
      const ep = waypoints[waypoints.length - 1];
      const ex = ep.x * TILE_SIZE + TILE_SIZE / 2;
      const ey = ep.y * TILE_SIZE + TILE_SIZE / 2;
      g.fillStyle(0x4444ff, 0.8);
      g.fillCircle(ex, ey, 10);
      g.lineStyle(3, 0x2222ff, 1);
      g.strokeCircle(ex, ey, 14);
    }
  }

  private drawPath(g: Phaser.GameObjects.Graphics, waypoints: Vec2[]): void {
    g.beginPath();
    if (waypoints.length === 0) return;
    g.moveTo(waypoints[0].x * TILE_SIZE + TILE_SIZE / 2, waypoints[0].y * TILE_SIZE + TILE_SIZE / 2);
    for (let i = 1; i < waypoints.length; i++) {
      g.lineTo(waypoints[i].x * TILE_SIZE + TILE_SIZE / 2, waypoints[i].y * TILE_SIZE + TILE_SIZE / 2);
    }
    g.strokePath();
  }

  private spawnDecorations(): void {
    this.decorationLayer.clear(true, true);

    const totalW = this.mapWidth * TILE_SIZE;
    const totalH = this.mapHeight * TILE_SIZE;

    const decoAssets = ['deco_tree1', 'deco_tree2', 'deco_rock1', 'deco_rock2', 'deco_bush1'];

    // Scatter 25 decorations on non-path, non-buildzone tiles
    const placed: Array<{ x: number; y: number }> = [];
    let attempts = 0;
    while (placed.length < 25 && attempts < 500) {
      attempts++;
      const tx = Math.floor(Math.random() * this.mapWidth);
      const ty = Math.floor(Math.random() * this.mapHeight);
      if (this.isOnPath(tx, ty) || this.isInBuildZone(tx, ty)) continue;
      if (placed.some((p) => p.x === tx && p.y === ty)) continue;

      placed.push({ x: tx, y: ty });
      const key = decoAssets[Math.floor(Math.random() * decoAssets.length)];
      const deco = this.add.image(
        tx * TILE_SIZE + TILE_SIZE / 2,
        ty * TILE_SIZE + TILE_SIZE / 2,
        key
      );
      deco.setScale(0.18 + Math.random() * 0.1);
      deco.setDepth(DECO_DEPTH + ty * 0.01); // Y-sort
      deco.setAlpha(0.9);
      this.decorationLayer.add(deco);
    }
  }

  private isOnPath(tx: number, ty: number): boolean {
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[i + 1];
      if (a.x === b.x) {
        if (tx === a.x && ty >= Math.min(a.y, b.y) && ty <= Math.max(a.y, b.y)) return true;
      } else {
        if (ty === a.y && tx >= Math.min(a.x, b.x) && tx <= Math.max(a.x, b.x)) return true;
      }
    }
    return false;
  }

  private isInBuildZone(tx: number, ty: number): boolean {
    return this.buildZones.some(
      (z) => tx >= z.x && tx < z.x + z.width && ty >= z.y && ty < z.y + z.height
    );
  }

  private spawnFloatingClouds(): void {
    const cloudKeys = ['deco_cloud1', 'deco_cloud2'];
    for (let i = 0; i < 6; i++) {
      const key = cloudKeys[i % cloudKeys.length];
      if (!this.textures.exists(key)) continue;
      const cloud = this.add.image(
        Math.random() * this.mapWidth * TILE_SIZE,
        Math.random() * this.mapHeight * TILE_SIZE,
        key
      );
      cloud.setDepth(CLOUD_DEPTH);
      cloud.setAlpha(0.3 + Math.random() * 0.2);
      cloud.setScale(0.4 + Math.random() * 0.3);
      (cloud as unknown as { speed: number }).speed = 8 + Math.random() * 12;
      this.cloudLayer.add(cloud);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Input
  // ─────────────────────────────────────────────────────────────────

  private handleMouseMove(pointer: Phaser.Input.Pointer): void {
    if (this.currentPhase !== 'prep' || !this.selectedTowerId) {
      this.ghostGraphics.clear();
      this.rangePreview.clear();
      return;
    }

    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);
    const valid = this.isValidBuildTile(tileX, tileY) && !this.isTileOccupied(tileX, tileY);
    const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const cy = tileY * TILE_SIZE + TILE_SIZE / 2;

    this.ghostGraphics.clear();
    this.rangePreview.clear();

    // Range preview (soft blue circle)
    const rangePixels = 3 * TILE_SIZE; // default range estimate
    this.rangePreview.fillStyle(valid ? 0x00aaff : 0xff3300, 0.08);
    this.rangePreview.fillCircle(cx, cy, rangePixels);
    this.rangePreview.lineStyle(1, valid ? 0x00aaff : 0xff3300, 0.4);
    this.rangePreview.strokeCircle(cx, cy, rangePixels);

    // Ghost tile
    const color = valid ? 0x00ff88 : 0xff3300;
    this.ghostGraphics.lineStyle(3, color, 0.9);
    this.ghostGraphics.strokeRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    this.ghostGraphics.fillStyle(color, 0.25);
    this.ghostGraphics.fillRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);

    // Corner accents
    const cs = 8;
    const tx = tileX * TILE_SIZE;
    const ty = tileY * TILE_SIZE;
    this.ghostGraphics.lineStyle(3, color, 1);
    [[tx, ty], [tx + TILE_SIZE - cs, ty], [tx, ty + TILE_SIZE - cs], [tx + TILE_SIZE - cs, ty + TILE_SIZE - cs]].forEach(
      ([lx, ly]) => {
        this.ghostGraphics.strokeRect(lx, ly, cs, cs);
      }
    );
  }

  private handleTileClick(pointer: Phaser.Input.Pointer): void {
    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);

    if (this.currentPhase === 'prep' && this.selectedTowerId) {
      const gameClient = this.registry.get('gameClient') as GameClient;
      if (gameClient && this.isValidBuildTile(tileX, tileY) && !this.isTileOccupied(tileX, tileY)) {
        this.events.emit('tile-clicked', { tileX, tileY, configId: this.selectedTowerId });
      }
    } else {
      this.events.emit('tile-clicked', { tileX, tileY });
    }
  }

  private handleTowerSelected(configId: string): void {
    this.selectedTowerId = configId;
  }

  private handleTowerDeselected(): void {
    this.selectedTowerId = null;
    this.ghostGraphics.clear();
    this.rangePreview.clear();
  }

  // ─────────────────────────────────────────────────────────────────
  // Phase transitions
  // ─────────────────────────────────────────────────────────────────

  private handlePhaseTransition(newPhase: GamePhase): void {
    if (newPhase === 'combat') {
      this.ghostGraphics.clear();
      this.rangePreview.clear();
      this.playWaveFanfare();
    }
    if (newPhase === 'post_wave') {
      this.playWaveClearEffect();
    }
    this.currentPhase = newPhase;
  }

  private playWaveFanfare(): void {
    this.audio.playWaveStart();

    // Quick pulse of all tower soldiers
    for (const [, tv] of this.towers) {
      this.tweens.add({
        targets: tv.soldier,
        scaleX: SOLDIER_SCALE * 1.3,
        scaleY: SOLDIER_SCALE * 1.3,
        yoyo: true,
        duration: 200,
        ease: 'Back.Out',
      });
    }
    // Flash the screen red briefly
    const flash = this.add.rectangle(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0xff0000,
      0.2
    ).setDepth(200);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 600,
      onComplete: () => flash.destroy(),
    });
  }

  private playWaveClearEffect(): void {
    this.audio.playWaveClear();
    const flash = this.add.rectangle(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0x00ff88,
      0.15
    ).setDepth(200);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 1000,
      onComplete: () => flash.destroy(),
    });
  }

  private flashRed(): void {
    const flash = this.add.rectangle(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0xff0000,
      0.3
    ).setDepth(200);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // State sync — Towers
  // ─────────────────────────────────────────────────────────────────

  private syncTowers(towers: Record<string, TowerState>): void {
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
      }
    }
  }

  private createTowerVisual(
    _id: string,
    tower: TowerState,
    px: number,
    py: number
  ): TowerVisual {
    const element = tower.configId.split('_')[0] as string;
    const assetInfo = TOWER_ASSETS.find((a) => a.element === element) ?? TOWER_ASSETS[TOWER_ASSETS.length - 1];
    const soldierKey = assetInfo.key;

    // Building base (static image, sits behind the soldier)
    const base = this.add.image(px, py, assetInfo.buildingKey);
    base.setScale(BUILDING_SCALE);
    base.setDepth(ENTITY_DEPTH + py * 0.001);
    base.setOrigin(0.5, 0.85);

    // Soldier sprite (animated, sits on top of building)
    const soldier = this.add.sprite(px, py - 8, soldierKey);
    soldier.setScale(SOLDIER_SCALE);
    soldier.setDepth(ENTITY_DEPTH + py * 0.001 + 0.5);
    soldier.play(`${soldierKey}_idle`);

    // Shadow
    const shadowEllipse = this.add.ellipse(px, py + 8, 24, 8, 0x000000, 0.3);
    shadowEllipse.setDepth(SHADOW_DEPTH);

    // Range circle (hidden by default, shown on select)
    const rangeCircle = this.add.graphics();
    rangeCircle.setDepth(ENTITY_DEPTH - 1);
    rangeCircle.setVisible(false);

    return { base, soldier, rangeCircle, selected: false };
  }

  private destroyTowerVisual(tv: TowerVisual): void {
    tv.base.destroy();
    tv.soldier.destroy();
    tv.rangeCircle.destroy();
  }

  private playTowerPlaceAnimation(tv: TowerVisual, px: number, py: number): void {
    this.audio.playTowerPlace();

    // Pop in from above
    tv.soldier.setPosition(px, py - 40);
    tv.soldier.setAlpha(0);
    tv.soldier.setScale(SOLDIER_SCALE * 0.5);
    tv.base.setAlpha(0);

    this.tweens.add({
      targets: [tv.soldier, tv.base],
      y: (target: Phaser.GameObjects.GameObject) => {
        const go = target as Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
        return go === tv.soldier ? py - 8 : py;
      },
      alpha: 1,
      scaleX: (target: Phaser.GameObjects.GameObject) => {
        const go = target as Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
        return go === tv.soldier ? SOLDIER_SCALE : BUILDING_SCALE;
      },
      scaleY: (target: Phaser.GameObjects.GameObject) => {
        const go = target as Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
        return go === tv.soldier ? SOLDIER_SCALE : BUILDING_SCALE;
      },
      duration: 250,
      ease: 'Back.Out',
    });

    // Dust puff
    this.spawnDustPuff(px, py + 8);

    // Camera nudge
    this.cameras.main.shake(80, 0.003);
  }

  // ─────────────────────────────────────────────────────────────────
  // State sync — Enemies
  // ─────────────────────────────────────────────────────────────────

  private syncEnemies(enemies: Record<string, EnemyState>): void {
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

  private getEnemyInfo(type: string): { key: string; scale: number; deathFxKey: string } {
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

    // Shadow
    const shadow = this.add.ellipse(enemy.x, enemy.y + 6, 18, 6, 0x000000, 0.4);
    shadow.setDepth(SHADOW_DEPTH);

    // Sprite
    const sprite = this.add.sprite(enemy.x, enemy.y, key);
    sprite.setScale(scale);
    sprite.setDepth(ENTITY_DEPTH + enemy.y * 0.001);

    // Pick walk or idle animation
    if (this.anims.exists(walkAnim)) {
      sprite.play(walkAnim);
    } else if (this.anims.exists(idleAnim)) {
      sprite.play(idleAnim);
    }

    // Invisible enemies get low alpha
    if (enemy.type === 'invisible') {
      sprite.setAlpha(0.45);
    }

    // HP bar (above enemy)
    const hpBar = this.add.graphics();
    hpBar.setDepth(ENTITY_DEPTH + 1);

    // Entrance scale-pop
    sprite.setScale(scale * 1.5);
    this.tweens.add({
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

    // Move
    sprite.setPosition(enemy.x, enemy.y);
    shadow.setPosition(enemy.x, enemy.y + 6);

    // Depth sort (Y)
    const depth = ENTITY_DEPTH + enemy.y * 0.001;
    sprite.setDepth(depth);

    // Flip to face direction of movement
    if (sprite.x !== enemy.x) {
      sprite.setFlipX(enemy.x < sprite.x);
    }

    // HP bar
    const hpRatio = enemy.hp / ev.maxHp;
    this.drawHpBar(hpBar, enemy.x, enemy.y - 14 * (sprite.scale / 2), hpRatio);

    // Hit flash on damage
    if (enemy.hp < ev.lastHp) {
      sprite.setTint(0xffffff);
      this.time.delayedCall(80, () => { if (sprite.active) sprite.clearTint(); });
      // Tiny knockback wiggle
      this.tweens.add({
        targets: sprite,
        x: enemy.x + (Math.random() - 0.5) * 8,
        duration: 60,
        yoyo: true,
      });
      ev.lastHp = enemy.hp;
    }
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, ratio: number): void {
    g.clear();
    if (ratio >= 1) return;

    const w = 26;
    const h = 4;
    g.fillStyle(0x000000, 0.6);
    g.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
    const color = ratio > 0.5 ? 0x44ee44 : ratio > 0.25 ? 0xeecc00 : 0xee2222;
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

    // Audio
    if (ev.type === 'boss' || ev.type === 'tank') {
      this.audio.playBossEnemyDeath();
    } else {
      this.audio.playEnemyDeath();
    }

    // Death animation before destroy
    sprite.setTint(0xff4400);
    this.tweens.add({
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

    // Explosion FX
    const { deathFxKey } = this.getEnemyInfo(ev.type);
    this.spawnExplosion(x, y, deathFxKey);

    // Screen micro-shake for bosses/tanks
    if (ev.type === 'boss' || ev.type === 'tank') {
      this.cameras.main.shake(200, 0.01);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Projectiles
  // ─────────────────────────────────────────────────────────────────

  private initProjectilePool(): void {
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const sprite = this.add.sprite(0, 0, 'proj_bullet');
      sprite.setVisible(false);
      sprite.setDepth(PROJECTILE_DEPTH);
      sprite.setScale(2.5);
      this.projectiles.push({ sprite, active: false, targetId: null, tween: null });
    }
  }

  private getProjectile(): LiveProjectile | null {
    return this.projectiles.find((p) => !p.active) ?? null;
  }

  fireProjectile(
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

    // Rotate toward target
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    sprite.setRotation(angle);

    // Animate spin for grenade
    if (projKey === 'proj_grenade') {
      sprite.play('proj_grenade_spin');
    }

    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const speed = 400;
    const dur = (dist / speed) * 1000;

    p.active = true;
    p.targetId = targetId;

    p.tween = this.tweens.add({
      targets: sprite,
      x: toX,
      y: toY,
      duration: dur,
      ease: 'Linear',
      onComplete: () => {
        // Muzzle flash at impact
        this.spawnImpact(sprite.x, sprite.y, elementColor, projKey === 'proj_grenade');
        sprite.stop();
        sprite.setVisible(false);
        p.active = false;
        p.targetId = null;
        p.tween = null;
      },
    });

    // Muzzle flash at origin
    this.spawnMuzzleFlash(fromX, fromY, elementColor);
  }

  // ─────────────────────────────────────────────────────────────────
  // VFX helpers
  // ─────────────────────────────────────────────────────────────────

  private spawnExplosion(x: number, y: number, fxKey: string): void {
    if (!this.textures.exists(fxKey)) return;

    const animKey = fxKey.replace('fx_', '');
    const fx = this.add.sprite(x, y, fxKey);
    fx.setDepth(FX_DEPTH);

    // Scale bigger for big explosions
    const scale = fxKey === 'fx_big_explosion' ? 2 : 1.5;
    fx.setScale(scale);

    fx.play(animKey);
    fx.once('animationcomplete', () => { fx.destroy(); });

    // Also spawn Tiny Swords explosion for extra flair on boss/tank
    if (fxKey === 'fx_big_explosion' && this.textures.exists('fx_ts_explosion')) {
      const ts = this.add.sprite(x, y, 'fx_ts_explosion');
      ts.setDepth(FX_DEPTH - 1);
      ts.setScale(0.35);
      ts.setAlpha(0.85);
      ts.play('fx_ts_explosion');
      ts.once('animationcomplete', () => { ts.destroy(); });
    }
  }

  private spawnMuzzleFlash(x: number, y: number, tint: number): void {
    if (!this.textures.exists('fx_muzzle')) return;
    const fx = this.add.sprite(x, y, 'fx_muzzle');
    fx.setScale(2);
    fx.setDepth(FX_DEPTH);
    fx.setTint(tint);
    fx.play('fx_muzzle');
    fx.once('animationcomplete', () => { fx.destroy(); });
  }

  private spawnImpact(x: number, y: number, tint: number, isSplash: boolean): void {
    if (!this.textures.exists('fx_impact')) return;
    const fx = this.add.sprite(x, y, 'fx_impact');
    fx.setScale(isSplash ? 3 : 2);
    fx.setDepth(FX_DEPTH);
    fx.setTint(tint);
    fx.play('fx_impact');
    fx.once('animationcomplete', () => { fx.destroy(); });

    if (isSplash) {
      this.spawnExplosion(x, y, 'fx_small_explosion');
    }
  }

  private spawnDustPuff(x: number, y: number): void {
    if (!this.textures.exists('fx_smoke')) return;
    const fx = this.add.sprite(x, y, 'fx_smoke');
    fx.setScale(2);
    fx.setDepth(FX_DEPTH - 1);
    fx.setTint(0xbbbbbb);
    fx.setAlpha(0.7);
    fx.play('fx_smoke');
    fx.once('animationcomplete', () => { fx.destroy(); });
  }

  // ─────────────────────────────────────────────────────────────────
  // External event handlers
  // ─────────────────────────────────────────────────────────────────

  handleShotFired(data: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    targetId: string;
    configId: string;
    elementColor: number;
  }): void {
    // Pick projectile key based on tower type
    const assetInfo = TOWER_ASSETS.find((a) =>
      data.configId.startsWith(a.element)
    ) ?? TOWER_ASSETS[TOWER_ASSETS.length - 1];
    const projKey = assetInfo.projKey;

    // Audio
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

    // Play tower fire animation
    for (const [, tv] of this.towers) {
      const towerWorldX = tv.base.x;
      const towerWorldY = tv.base.y;
      const dist = Phaser.Math.Distance.Between(towerWorldX, towerWorldY, data.fromX, data.fromY);
      if (dist < 8) {
        const soldierKey = tv.soldier.texture.key;
        const fireAnim = `${soldierKey}_fire`;
        if (this.anims.exists(fireAnim)) {
          tv.soldier.play(fireAnim);
          tv.soldier.once('animationcomplete', () => {
            if (tv.soldier.active) tv.soldier.play(`${soldierKey}_idle`);
          });
        }
        break;
      }
    }
  }

  handleEnemyKilled(data: { id: string; x: number; y: number }): void {
    const ev = this.enemies.get(data.id);
    if (ev) {
      this.killEnemy(data.id, ev);
    } else {
      // Spawn explosion at location anyway
      this.spawnExplosion(data.x, data.y, 'fx_small_explosion');
    }
  }

  handleBaseDamaged(_data: { damage: number }): void {
    // Camera shake and red flash are already handled in update() via state diff
  }

  // ─────────────────────────────────────────────────────────────────
  // Full state sync entry point
  // ─────────────────────────────────────────────────────────────────

  syncState(state: GameState): void {
    this.syncTowers(state.towers);
    this.syncEnemies(state.enemies);
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  isValidBuildTile(tileX: number, tileY: number): boolean {
    return this.buildZones.some(
      (z) =>
        tileX >= z.x && tileX < z.x + z.width && tileY >= z.y && tileY < z.y + z.height
    );
  }

  private isTileOccupied(tileX: number, tileY: number): boolean {
    for (const [, tv] of this.towers) {
      const ttx = Math.floor(tv.base.x / TILE_SIZE);
      const tty = Math.floor(tv.base.y / TILE_SIZE);
      if (ttx === tileX && tty === tileY) return true;
    }
    return false;
  }

  getBuildZones(): BuildZone[] {
    return this.buildZones;
  }

  getWaypoints(): Vec2[] {
    return this.waypoints;
  }
}
