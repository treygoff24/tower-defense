import Phaser from 'phaser';
import type { GameState, GamePhase, Vec2, TowerState, EnemyState, BuildZone } from '@td/shared';
import { TILE_SIZE, MAP_CONFIGS, TOWER_CONFIGS, isOnPath as isPathTile } from '@td/shared';
import { GameClient } from '../GameClient';
import { ENEMY_ASSETS, TOWER_ASSETS, GRUNT_VARIANT_KEYS, GRUNT_VARIANT_TINTS } from '../assets/manifest';
import type { TowerAssetInfo } from '../assets/manifest';
import { AudioManager } from '../audio/AudioManager';
import { DeathAnimator } from '../effects/DeathAnimator';
import { ProjectileManager } from '../effects/ProjectileManager';
import { TowerAnimator } from '../effects/TowerAnimator';
import { EnemyInspector } from '../ui/EnemyInspector';

// ─── Per-tower runtime state ─────────────────────────────────────────────────
interface TowerVisual {
  base: Phaser.GameObjects.Image;
  soldier: Phaser.GameObjects.Sprite;
  rangeCircle: Phaser.GameObjects.Graphics;
  aura: Phaser.GameObjects.Ellipse;
  ownerRing?: Phaser.GameObjects.Arc;
  selected: boolean;
  configId: string;
  tierIndicator?: Phaser.GameObjects.Graphics;
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
const ENEMY_BASE_SCALE = 3;
const BUILDING_SCALE = 0.35;
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

  // ── Effects ────────────────────────────────────────────────────────
  private deathAnimator!: DeathAnimator;
  private projectileManager!: ProjectileManager;
  private towerAnimator!: TowerAnimator;

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
  private blockedDecoTiles: Set<string> = new Set();
  private currentPhase: GamePhase = 'prep';
  private selectedTowerId: string | null = null;
  private defaultZoom: number = 1;

  // ── Timing ────────────────────────────────────────────────────────
  private cloudTimer = 0;
  private lastBaseHp = -1;
  private lastState: GameState | null = null;

  // ── Enemy Inspector (3D) ───────────────────────────────────────────
  private enemyInspector: EnemyInspector | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2d5a1b'); // Lush grass green

    // Audio
    this.audio.bind(this);

    // Effects
    this.deathAnimator = new DeathAnimator(this);

    // Projectile manager (object-pooled, handles tower_fired server events)
    this.projectileManager = new ProjectileManager(this);
    this.projectileManager.bindEvents(this.events);
    this.towerAnimator = new TowerAnimator(this);

    // Layering objects
    this.tileLayer = this.add.group();
    this.decorationLayer = this.add.group();
    this.cloudLayer = this.add.group();
    this.terrainLayer = this.add.graphics().setDepth(TERRAIN_DEPTH);
    this.ghostGraphics = this.add.graphics().setDepth(HUD_DEPTH);
    this.rangePreview = this.add.graphics().setDepth(HUD_DEPTH - 1);

    // Input
    this.input.mouse?.disableContextMenu(); // Allow right-click for ping
    this.input.on('pointermove', this.handleMouseMove, this);
    this.input.on(
      'pointermove',
      (ptr: Phaser.Input.Pointer) => {
        if (ptr.isDown && ptr.button === 0 && this.cameras.main.zoom > 1.1 && !this.selectedTowerId) {
          this.cameras.main.scrollX -= (ptr.x - ptr.prevPosition.x) / this.cameras.main.zoom;
          this.cameras.main.scrollY -= (ptr.y - ptr.prevPosition.y) / this.cameras.main.zoom;
        }
      }
    );
    this.input.on('pointerup', this.handleTileClick, this);
    this.input.on('wheel', (_ptr: Phaser.Input.Pointer, _objs: unknown[], _dx: number, dy: number) => {
      this.adjustZoom(dy > 0 ? -0.1 : 0.1);
    });
    this.input.keyboard?.on('keydown-EQUAL', () => this.adjustZoom(0.15));
    this.input.keyboard?.on('keydown-MINUS', () => this.adjustZoom(-0.15));
    this.input.keyboard?.on('keydown-NUMPAD_ADD', () => this.adjustZoom(0.15));
    this.input.keyboard?.on('keydown-NUMPAD_SUBTRACT', () => this.adjustZoom(-0.15));
    this.input.setDefaultCursor('auto');

    // Events from HUD / network
    this.events.on('sync-state', this.syncState, this);
    this.events.on('tower-selected', this.handleTowerSelected, this);
    this.events.on('tower-deselected', this.handleTowerDeselected, this);
    this.events.on('shot-fired', this.handleShotFired, this);
    this.events.on('enemy-killed', this.handleEnemyKilled, this);
    this.events.on('base-damaged', this.handleBaseDamaged, this);
    this.events.on('tower-sold-visual', this.handleTowerSoldVisual, this);
    this.events.on('zoom-in', () => this.adjustZoom(0.2));
    this.events.on('zoom-out', () => this.adjustZoom(-0.2));
    this.events.on('zoom-reset', () => this.cameras.main.setZoom(this.defaultZoom));
    this.events.on('ping_marker', (data: { x: number; y: number }) => {
      this.showPingMarker(data.x, data.y);
    });

    // tower_fired: animate the attacking tower sprite (projectile handled by projectileManager)
    this.events.on('tower_fired', (event: { towerId: string; element?: string }) => {
      const tv = this.towers.get(event.towerId);
      if (!tv) return; // race condition – tower not yet rendered, skip silently
      this.towerAnimator.playAttack(tv.soldier, event.element);
    });

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

        // Enemy inspector: update position and auto-dismiss on death
        if (this.enemyInspector) {
          this.enemyInspector.update(state.enemies);
        }

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
    const map = MAP_CONFIGS['map_01'];
    if (!map) throw new Error('Map map_01 not found in MAP_CONFIGS');
    
    this.waypoints = map.waypoints;
    this.buildZones = map.buildZones;
    this.mapWidth = map.width;
    this.mapHeight = map.height;

    this.renderMap(this.waypoints, this.buildZones);
    this.spawnDecorations();

    // Zoom camera to fill the viewport and center on the map
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;
    const zoomX = camW / (this.mapWidth * TILE_SIZE);
    const zoomY = camH / (this.mapHeight * TILE_SIZE);
    const zoom = Math.min(zoomX, zoomY) * 0.95;
    this.cameras.main.setZoom(zoom);
    this.defaultZoom = this.cameras.main.zoom;
    this.cameras.main.centerOn(
      (this.mapWidth * TILE_SIZE) / 2,
      (this.mapHeight * TILE_SIZE) / 2
    );
  }

  private adjustZoom(delta: number): void {
    const cam = this.cameras.main;
    const MIN_ZOOM = 0.4;
    const MAX_ZOOM = 2.0;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom + delta, MIN_ZOOM, MAX_ZOOM));
  }

  // ─── Autotile helpers ───────────────────────────────────────────

  /**
   * Returns the tileset frame index for a grass (color1) tile based on its
   * position relative to the map edges.  Uses the standard 3×3 autotile
   * layout:
   *   0  1  2      (top row: corners & top edge)
   *   9 10 11      (mid row: left edge, center, right edge)
   *  18 19 20      (bot row: corners & bottom edge)
   */
  private getGrassTileFrame(tx: number, ty: number): number {
    const maxX = this.mapWidth - 1;
    const maxY = this.mapHeight - 1;

    const isLeft   = tx === 0;
    const isRight  = tx === maxX;
    const isTop    = ty === 0;
    const isBottom = ty === maxY;

    // Corners
    if (isTop && isLeft)     return 0;
    if (isTop && isRight)    return 2;
    if (isBottom && isLeft)  return 18;
    if (isBottom && isRight) return 20;

    // Edges
    if (isTop)    return 1;
    if (isBottom) return 19;
    if (isLeft)   return 9;
    if (isRight)  return 11;

    // Center fill
    return 10;
  }

  /**
   * Returns the tileset frame index for a path (color2) tile.
   * Checks which of the 4 cardinal neighbours are also path tiles and picks
   * the matching frame from the standard 3-row autotile layout.
   *
   * Frame map (same 9-col × 6-row sheet, we use the first 3 rows):
   *   0  1  2
   *   9 10 11
   *  18 19 20
   *
   * Convention: frame 10 = all neighbours are path (center fill).
   */
  private getPathTileFrame(tx: number, ty: number): number {
    const up    = this.isOnPath(tx, ty - 1);
    const down  = this.isOnPath(tx, ty + 1);
    const left  = this.isOnPath(tx - 1, ty);
    const right = this.isOnPath(tx + 1, ty);

    // All four neighbours
    if (up && down && left && right) return 10;

    // Three neighbours (T-junctions) → use center, looks best
    if (up && down && left)  return 11;  // open on right → right edge
    if (up && down && right) return 9;   // open on left → left edge
    if (left && right && up) return 19;  // open on bottom → bottom edge
    if (left && right && down) return 1; // open on top → top edge

    // Two neighbours — straights
    if (up && down)    return 10; // vertical corridor
    if (left && right) return 10; // horizontal corridor

    // Two neighbours — corners
    if (down && right) return 0;  // top-left corner (path continues down & right)
    if (down && left)  return 2;  // top-right corner
    if (up && right)   return 18; // bottom-left corner
    if (up && left)    return 20; // bottom-right corner

    // One neighbour — dead ends → use edge tile facing the open side
    if (up)    return 19;
    if (down)  return 1;
    if (left)  return 11;
    if (right) return 9;

    // Island (no neighbours) — use center
    return 10;
  }

  renderMap(waypoints: Vec2[], buildZones: BuildZone[]): void {
    this.waypoints = waypoints;
    this.buildZones = buildZones;
    this.terrainLayer.clear();

    // ── Tile layer (tileset sprites beneath graphics) ─────────────
    this.tileLayer.clear(true, true);
    const hasTileset = this.textures.exists('tileset_color1_ss');
    const hasDirtTileset = this.textures.exists('tileset_color2_ss');

    // Deterministic seed helper for per-tile variation
    const hash = (a: number, b: number): number => ((a * 2654435761) ^ (b * 2246822519)) >>> 0;

    if (hasTileset) {
      for (let ty = 0; ty < this.mapHeight; ty++) {
        for (let tx = 0; tx < this.mapWidth; tx++) {
          // Skip grass tile if this cell is on the path — dirt will be laid instead
          if (this.isOnPath(tx, ty)) continue;

          const frame = this.getGrassTileFrame(tx, ty);

          const tile = this.add.image(
            tx * TILE_SIZE + TILE_SIZE / 2,
            ty * TILE_SIZE + TILE_SIZE / 2,
            'tileset_color1_ss',
            frame
          );
          tile.setDepth(TERRAIN_DEPTH - 1);

          // Subtle per-tile variation for interior tiles
          if (frame === 10) {
            const h = hash(tx, ty);
            // Slight random rotation (0 or PI) on ~30 % of center tiles
            if ((h % 100) < 30) {
              tile.setRotation(Math.PI);
            }
            // Subtle alpha variation
            tile.setAlpha(0.9 + (h % 11) / 100); // 0.90 – 1.00
          }

          this.tileLayer.add(tile);
        }
      }
    }

    // ── Dirt / path tiles (tileset_color2_ss) with autotile edges ──
    if (hasDirtTileset) {
      for (let ty = 0; ty < this.mapHeight; ty++) {
        for (let tx = 0; tx < this.mapWidth; tx++) {
          if (!this.isOnPath(tx, ty)) continue;

          const frame = this.getPathTileFrame(tx, ty);

          const dirtTile = this.add.image(
            tx * TILE_SIZE + TILE_SIZE / 2,
            ty * TILE_SIZE + TILE_SIZE / 2,
            'tileset_color2_ss',
            frame
          );
          dirtTile.setDepth(TERRAIN_DEPTH + 0.5);
          dirtTile.setTint(0xddccaa); // Warm tint to deepen contrast vs bright grass
          this.tileLayer.add(dirtTile);
        }
      }
    }

    const g = this.terrainLayer;

    // ── Dark edge outline around path for contrast ─────────────
    g.lineStyle(2, 0x3a2a10, 0.55);
    for (let ty = 0; ty < this.mapHeight; ty++) {
      for (let tx = 0; tx < this.mapWidth; tx++) {
        if (!this.isOnPath(tx, ty)) continue;
        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;
        // Draw edge segment on each side that borders grass
        if (!this.isOnPath(tx, ty - 1)) {
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + TILE_SIZE, py); g.strokePath();
        }
        if (!this.isOnPath(tx, ty + 1)) {
          g.beginPath(); g.moveTo(px, py + TILE_SIZE); g.lineTo(px + TILE_SIZE, py + TILE_SIZE); g.strokePath();
        }
        if (!this.isOnPath(tx - 1, ty)) {
          g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + TILE_SIZE); g.strokePath();
        }
        if (!this.isOnPath(tx + 1, ty)) {
          g.beginPath(); g.moveTo(px + TILE_SIZE, py); g.lineTo(px + TILE_SIZE, py + TILE_SIZE); g.strokePath();
        }
      }
    }

    // ── Worn trail center line ───────────────────────────────────
    g.lineStyle(2, 0x6b4c1e, 0.25);
    this.drawPath(g, waypoints);

    // ── Build zone styling ───────────────────────────────────────
    for (const zone of buildZones) {
      const zx = zone.x * TILE_SIZE;
      const zy = zone.y * TILE_SIZE;
      const zw = zone.width * TILE_SIZE;
      const zh = zone.height * TILE_SIZE;

      // Stone platform
      g.fillStyle(0x8b7d6b, 0.45);
      g.fillRoundedRect(zx + 2, zy + 2, zw - 4, zh - 4, 6);
      // Outer border — warm stone
      g.lineStyle(2, 0xccbb99, 0.65);
      g.strokeRoundedRect(zx + 2, zy + 2, zw - 4, zh - 4, 6);
      // Inner grid lines for individual tiles
      g.lineStyle(1, 0xaabb88, 0.3);
      for (let tx = zone.x; tx < zone.x + zone.width; tx++) {
        for (let ty = zone.y; ty < zone.y + zone.height; ty++) {
          g.strokeRect(tx * TILE_SIZE + 4, ty * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        }
      }
    }

    // ── Start marker — enemy spawn (Castle Red) ──────────────────
    if (waypoints.length > 0) {
      const sp = waypoints[0];
      const sx = sp.x * TILE_SIZE + TILE_SIZE / 2;
      const sy = sp.y * TILE_SIZE + TILE_SIZE / 2;

      // Pulsing red glow circle behind castle
      const redGlow = this.add.circle(sx, sy, TILE_SIZE * 1.3, 0xff0000, 0.15);
      redGlow.setDepth(TERRAIN_DEPTH + 1);
      this.tweens.add({
        targets: redGlow,
        alpha: { from: 0.08, to: 0.22 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });

      if (this.textures.exists('castle_red')) {
        // Castle is 320×256 — scale to span ~2 tiles wide
        const castleRed = this.add.image(sx, sy - 16, 'castle_red');
        castleRed.setScale(0.5);
        castleRed.setDepth(TERRAIN_DEPTH + 2);
        castleRed.setOrigin(0.5, 0.65);
      } else {
        g.fillStyle(0xdd2222, 0.9);
        g.fillTriangle(sx - 14, sy - 13, sx - 14, sy + 13, sx + 16, sy);
      }

      // Label
      const spawnLabel = this.add.text(sx, sy + TILE_SIZE * 0.6, 'SPAWN', {
        fontSize: '10px', fontFamily: 'Arial', fontStyle: 'bold',
        color: '#ff6666', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(TERRAIN_DEPTH + 3).setAlpha(0.8);
    }

    // ── End marker — player castle (Castle Blue) ─────────────────
    if (waypoints.length > 1) {
      const ep = waypoints[waypoints.length - 1];
      const ex = ep.x * TILE_SIZE + TILE_SIZE / 2;
      const ey = ep.y * TILE_SIZE + TILE_SIZE / 2;

      // Pulsing blue glow circle behind castle
      const blueGlow = this.add.circle(ex, ey, TILE_SIZE * 1.3, 0x2244ff, 0.15);
      blueGlow.setDepth(TERRAIN_DEPTH + 1);
      this.tweens.add({
        targets: blueGlow,
        alpha: { from: 0.08, to: 0.22 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });

      if (this.textures.exists('castle_blue')) {
        // Castle is 320×256 — scale to span ~2 tiles wide
        const castleBlue = this.add.image(ex, ey - 16, 'castle_blue');
        castleBlue.setScale(0.5);
        castleBlue.setDepth(TERRAIN_DEPTH + 2);
        castleBlue.setOrigin(0.5, 0.65);
      } else {
        g.fillStyle(0x4466ff, 0.85);
        g.fillRect(ex - 11, ey - 10, 22, 20);
      }

      // Label
      const baseLabel = this.add.text(ex, ey + TILE_SIZE * 0.6, 'BASE', {
        fontSize: '10px', fontFamily: 'Arial', fontStyle: 'bold',
        color: '#6688ff', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(TERRAIN_DEPTH + 3).setAlpha(0.8);
    }
  }

  /** Draw a dashed rectangle on the given Graphics object. */
  private drawDashedRect(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    dashLen: number,
    gapLen: number,
    lineWidth: number,
    color: number,
    alpha: number
  ): void {
    g.lineStyle(lineWidth, color, alpha);
    // Top edge
    this.drawDashedLine(g, x, y, x + w, y, dashLen, gapLen);
    // Right edge
    this.drawDashedLine(g, x + w, y, x + w, y + h, dashLen, gapLen);
    // Bottom edge
    this.drawDashedLine(g, x + w, y + h, x, y + h, dashLen, gapLen);
    // Left edge
    this.drawDashedLine(g, x, y + h, x, y, dashLen, gapLen);
  }

  /** Draw a single dashed line segment. */
  private drawDashedLine(
    g: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLen: number,
    gapLen: number
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / len;
    const ny = dy / len;
    let drawn = 0;
    let drawing = true;
    while (drawn < len) {
      const segLen = drawing ? dashLen : gapLen;
      const end = Math.min(drawn + segLen, len);
      if (drawing) {
        g.beginPath();
        g.moveTo(x1 + nx * drawn, y1 + ny * drawn);
        g.lineTo(x1 + nx * end, y1 + ny * end);
        g.strokePath();
      }
      drawn = end;
      drawing = !drawing;
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
    this.blockedDecoTiles.clear();

    // Spritesheet-based assets with frame counts (pick random frame to vary appearance)
    // Tree frames: 256×256px → scale 0.17 ≈ 43px (~0.67 tiles). Rocks are single images.
    const decoAssets: Array<{ key: string; frames: number; scale: number; isSprite: boolean }> = [
      { key: 'deco_tree1',  frames: 6, scale: 0.28, isSprite: true  }, // 256×256 frames — scaled up
      { key: 'deco_tree2',  frames: 6, scale: 0.28, isSprite: true  },
      { key: 'deco_bush1',  frames: 8, scale: 0.35, isSprite: true  }, // 128×128 frames — scaled up
      { key: 'deco_bush2',  frames: 8, scale: 0.35, isSprite: true  },
      { key: 'deco_bush3',  frames: 8, scale: 0.35, isSprite: true  },
      { key: 'deco_rock1',  frames: 1, scale: 0.7, isSprite: false },
      { key: 'deco_rock2',  frames: 1, scale: 0.7, isSprite: false },
      { key: 'deco_rock3',  frames: 1, scale: 0.7, isSprite: false },
      { key: 'deco_rock4',  frames: 1, scale: 0.7, isSprite: false },
    ];

    // Filter to only assets whose textures exist
    const availableAssets = decoAssets.filter((a) => this.textures.exists(a.key));

    // Weighted selection: more rocks/bushes at edges, more trees inland
    const weightedAssets: Array<{ key: string; frames: number; scale: number; isSprite: boolean }> = [];
    for (const asset of availableAssets) {
      if (asset.key.startsWith('deco_tree')) {
        for (let i = 0; i < 4; i++) weightedAssets.push(asset);
      } else if (asset.key.startsWith('deco_bush')) {
        for (let i = 0; i < 3; i++) weightedAssets.push(asset);
      } else if (asset.key.startsWith('deco_rock')) {
        for (let i = 0; i < 2; i++) weightedAssets.push(asset);
      }
    }

    if (weightedAssets.length === 0) return;

    // Scatter decorations on non-path, non-buildzone tiles
    const placed: Array<{ x: number; y: number }> = [];
    let attempts = 0;
    while (placed.length < 24 && attempts < 500) {
      attempts++;
      const tx = Math.floor(Math.random() * this.mapWidth);
      const ty = Math.floor(Math.random() * this.mapHeight);
      if (this.isOnPath(tx, ty) || this.isInBuildZone(tx, ty)) continue;
      if (placed.some((p) => p.x === tx && p.y === ty)) continue;

      placed.push({ x: tx, y: ty });
      const asset = weightedAssets[Math.floor(Math.random() * weightedAssets.length)];
      const frame = asset.frames > 1 ? Math.floor(Math.random() * asset.frames) : 0;
      const scaleJitter = asset.scale * (0.85 + Math.random() * 0.3);

      let deco: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
      if (asset.isSprite) {
        deco = this.add.sprite(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2, asset.key, frame);
      } else {
        deco = this.add.image(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2, asset.key);
      }
      deco.setScale(scaleJitter);
      deco.setDepth(DECO_DEPTH + ty * 0.01); // Y-sort
      deco.setAlpha(0.92);
      this.decorationLayer.add(deco);

      if (asset.key.startsWith('deco_tree') || asset.key.startsWith('deco_rock')) {
        this.blockedDecoTiles.add(`${tx},${ty}`);
      }
    }
  }

  private isOnPath(tx: number, ty: number): boolean {
    return isPathTile(tx, ty, this.waypoints);
  }

  private isInBuildZone(tx: number, ty: number): boolean {
    return this.buildZones.some(
      (z) => tx >= z.x && tx < z.x + z.width && ty >= z.y && ty < z.y + z.height
    );
  }

  private spawnFloatingClouds(): void {
    const cloudKeys = ['deco_cloud1', 'deco_cloud2', 'deco_cloud3', 'deco_cloud4'];
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
    const canPlace = this.currentPhase === 'prep' || this.currentPhase === 'combat';
    if (!canPlace || !this.selectedTowerId) {
      this.ghostGraphics.clear();
      this.rangePreview.clear();
      return;
    }

    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);
    const valid = this.isValidBuildTile(tileX, tileY);
    const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const cy = tileY * TILE_SIZE + TILE_SIZE / 2;

    this.ghostGraphics.clear();
    this.rangePreview.clear();

    // Range preview (soft blue circle) — use actual tower config range
    const configRange = TOWER_CONFIGS[this.selectedTowerId]?.range ?? 3;
    const rangePixels = configRange * TILE_SIZE;
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
    if (pointer.getDistance() > 5) return;

    // Right-click → send ping at tile coords
    if (pointer.rightButtonDown()) {
      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);
      const gameClient = this.registry.get('gameClient') as GameClient;
      gameClient?.sendPing(tileX, tileY).catch((err: unknown) => console.error('Ping error:', err));
      return;
    }

    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);

    const canPlace = this.currentPhase === 'prep' || this.currentPhase === 'combat';
    if (canPlace && this.selectedTowerId) {
      const gameClient = this.registry.get('gameClient') as GameClient;
      if (gameClient && this.isValidBuildTile(tileX, tileY)) {
        this.events.emit('tile-clicked', { tileX, tileY, configId: this.selectedTowerId });
      }
    } else if (this.currentPhase === 'prep' || this.currentPhase === 'combat') {
      // Check if clicking on a placed tower → show TowerInspector
      const towerAtTile = this.getTowerAtTile(tileX, tileY);
      if (towerAtTile) {
        const { instanceId, tv } = towerAtTile;
        const cfg = TOWER_CONFIGS[tv.configId];
        const refund = cfg ? Math.round(cfg.costGold * 0.5) : 0;
        // Look up tier from latest game state
        const gameClient = this.registry.get('gameClient') as { getLatestState(): { towers: Record<string, { tier: number; ownerId?: string }> } | null } | undefined;
        const state = gameClient?.getLatestState();
        const tier = state?.towers[instanceId]?.tier ?? 1;
        const ownerId = state?.towers[instanceId]?.ownerId ?? '';
        this.events.emit('placed-tower-clicked', {
          instanceId,
          configId: tv.configId,
          refund,
          tier,
          ownerId,
        });
      } else {
        this.events.emit('sell-panel-close');
        this.events.emit('tile-clicked', { tileX, tileY });
      }
    } else {
      this.events.emit('sell-panel-close');
      this.events.emit('tile-clicked', { tileX, tileY });
    }
  }

  private getTowerAtTile(
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

  private handleTowerSelected(configId: string): void {
    this.selectedTowerId = configId;
    this.input.setDefaultCursor('crosshair');
  }

  private handleTowerDeselected(): void {
    this.selectedTowerId = null;
    this.input.setDefaultCursor('auto');
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

    // Quick pulse of all tower soldiers — use each tower's own scale
    for (const [, tv] of this.towers) {
      this.tweens.add({
        targets: tv.soldier,
        scaleX: tv.soldier.scaleX * 1.3,
        scaleY: tv.soldier.scaleY * 1.3,
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
        tv.aura.setPosition(px, py + 4);
        tv.ownerRing?.setPosition(px, py + 6);
        // Update tier indicator if tower was upgraded
        const currentTier = tower.tier ?? 1;
        const hasTierIndicator = !!tv.tierIndicator;
        if (currentTier >= 2 && !hasTierIndicator) {
          tv.tierIndicator = this.createTierIndicator(px, py, currentTier);
        } else if (currentTier >= 2 && hasTierIndicator) {
          // Refresh in case tier changed
          tv.tierIndicator!.destroy();
          tv.tierIndicator = this.createTierIndicator(px, py, currentTier);
        }
      }
    }
  }

  /** Get the element color for a tower configId. */
  private getElementColor(configId: string): number {
    const element = TOWER_ASSETS[configId]?.element ?? configId.split('_')[0];
    switch (element) {
      case 'fire':   return 0xff4400;
      case 'water':  return 0x0088ff;
      case 'ice':    return 0x88ccff;
      case 'poison': return 0x44cc44;
      default:       return 0xaaaaaa;
    }
  }

  /** Resolve the TowerAssetInfo for a given tower configId (Record lookup). */
  private getTowerAssetInfo(configId: string): TowerAssetInfo {
    return TOWER_ASSETS[configId] ?? TOWER_ASSETS['arrow_tower'];
  }

  private createTowerVisual(
    _id: string,
    tower: TowerState,
    px: number,
    py: number
  ): TowerVisual {
    const assetInfo = this.getTowerAssetInfo(tower.configId);
    const soldierKey = assetInfo.idleKey;

    // Building base (static image, sits behind the soldier)
    const base = this.add.image(px, py, assetInfo.buildingKey);
    base.setScale(BUILDING_SCALE);
    base.setDepth(ENTITY_DEPTH + py * 0.001);
    base.setOrigin(0.5, 0.7);
    base.setInteractive({ useHandCursor: true });

    // Soldier sprite (animated, sits on top of building)
    const soldier = this.add.sprite(px, py - 8, soldierKey);
    soldier.setScale(assetInfo.unitScale);
    soldier.setDepth(ENTITY_DEPTH + py * 0.001 + 0.5);
    soldier.play(`${assetInfo.idleKey}_idle`);

    // Shadow
    const shadowEllipse = this.add.ellipse(px, py + 8, 24, 8, 0x000000, 0.3);
    shadowEllipse.setDepth(SHADOW_DEPTH);

    // Element aura (pulsing colored glow)
    const elementColor = this.getElementColor(tower.configId);
    const aura = this.add.ellipse(px, py + 4, 30, 10, elementColor, 0.15);
    aura.setDepth(SHADOW_DEPTH + 0.5);
    this.tweens.add({
      targets: aura,
      alpha: { from: 0.08, to: 0.2 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    // Range circle (hidden by default, shown on select)
    const rangeCircle = this.add.graphics();
    rangeCircle.setDepth(ENTITY_DEPTH - 1);
    rangeCircle.setVisible(false);

    // Tier indicator (gold dots for tier 2+)
    let tierIndicator: Phaser.GameObjects.Graphics | undefined;
    if (tower.tier >= 2) {
      tierIndicator = this.createTierIndicator(px, py, tower.tier);
    }

    // Owner ring — colored circle at tower base to indicate player ownership
    const PLAYER_COLORS = [0x4488ff, 0xff4444, 0x44cc44, 0xffcc00];
    const playerIds = Object.keys(this.lastState?.players ?? {});
    const ownerIdx = playerIds.indexOf(tower.ownerId);
    const ringColor = PLAYER_COLORS[ownerIdx >= 0 ? ownerIdx : 0];
    const ownerRing = this.add.circle(px, py + 6, 16, ringColor, 0.35);
    ownerRing.setStrokeStyle(2, ringColor, 0.6);
    ownerRing.setDepth(SHADOW_DEPTH + 0.3);

    return { base, soldier, rangeCircle, aura, ownerRing, selected: false, configId: tower.configId, tierIndicator };
  }

  private createTierIndicator(px: number, py: number, tier: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.setDepth(ENTITY_DEPTH + 100);
    g.fillStyle(0xffd700, 1); // Gold
    if (tier === 2) {
      g.fillCircle(px + 12, py - 20, 4);
    } else if (tier >= 3) {
      // Two gold dots for tier 3
      g.fillCircle(px + 10, py - 20, 4);
      g.fillCircle(px + 18, py - 20, 4);
    }
    return g;
  }

  private destroyTowerVisual(tv: TowerVisual): void {
    tv.base.destroy();
    tv.soldier.destroy();
    tv.rangeCircle.destroy();
    tv.aura.destroy();
    tv.ownerRing?.destroy();
    tv.tierIndicator?.destroy();
  }

  private playTowerPlaceAnimation(tv: TowerVisual, px: number, py: number): void {
    this.audio.playTowerPlace();

    // Use the soldier's current scale as the target (set by createTowerVisual)
    const soldierTargetScale = tv.soldier.scaleX;

    // Pop in from above
    tv.soldier.setPosition(px, py - 40);
    tv.soldier.setAlpha(0);
    tv.soldier.setScale(soldierTargetScale * 0.5);
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
        return go === tv.soldier ? soldierTargetScale : BUILDING_SCALE;
      },
      scaleY: (target: Phaser.GameObjects.GameObject) => {
        const go = target as Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
        return go === tv.soldier ? soldierTargetScale : BUILDING_SCALE;
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

  /**
   * Grunt has 3 color variants — deterministic rotation based on enemy ID.
   * Returns 0/1/2 consistently for the same enemy across frames.
   */
  private getGruntVariantIdx(enemyId: string): number {
    let hash = 0;
    for (let i = 0; i < enemyId.length; i++) {
      hash = (hash * 31 + enemyId.charCodeAt(i)) >>> 0;
    }
    return hash % GRUNT_VARIANT_KEYS.length;
  }

  private createEnemyVisual(_id: string, enemy: EnemyState): EnemyVisual {
    const { scale } = this.getEnemyInfo(enemy.type);

    // Grunt: rotate through 3 color variant keys (same Scarab sprite, different tint)
    const spriteKey =
      enemy.type === 'grunt'
        ? GRUNT_VARIANT_KEYS[this.getGruntVariantIdx(_id)]
        : `enemy_${enemy.type}`;

    const walkAnim = `${spriteKey}_walk`;
    const idleAnim = `${spriteKey}_idle`;

    // Convert tile coords to pixel coords
    const px = enemy.x * TILE_SIZE + TILE_SIZE / 2;
    const py = enemy.y * TILE_SIZE + TILE_SIZE / 2;

    // Shadow
    const shadow = this.add.ellipse(px, py + 6, 18, 6, 0x000000, 0.4);
    shadow.setDepth(SHADOW_DEPTH);

    // Sprite — use per-type variant key
    const sprite = this.add.sprite(px, py, spriteKey);
    sprite.setScale(scale);
    sprite.setDepth(ENTITY_DEPTH + py * 0.001);

    // Pick walk or idle animation
    if (this.anims.exists(walkAnim)) {
      sprite.play(walkAnim);
    } else if (this.anims.exists(idleAnim)) {
      sprite.play(idleAnim);
    }

    // Grunt: apply variant tint for visual differentiation
    if (enemy.type === 'grunt') {
      const tint = GRUNT_VARIANT_TINTS[this.getGruntVariantIdx(_id)];
      sprite.setTint(tint);
    }

    // Tank: scale up for larger visual (1.3×)
    if (enemy.type === 'tank') {
      sprite.setScale(scale * 1.3);
    }

    // Runner: slightly smaller/lighter
    if (enemy.type === 'runner') {
      sprite.setScale(scale * 0.85);
    }

    // Flyer: floating bobbing animation (sine wave Y)
    if (enemy.type === 'flyer') {
      this.tweens.add({
        targets: sprite,
        y: py - 4,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    // Boss: glowing ring underneath + extra scale
    if (enemy.type === 'boss') {
      sprite.setScale(scale * 1.5);
      const glowRing = this.add.circle(px, py + 4, 20, 0xff4400, 0.4);
      glowRing.setDepth(SHADOW_DEPTH + 0.1);
      this.tweens.add({
        targets: glowRing,
        alpha: { from: 0.3, to: 0.8 },
        scaleX: { from: 1, to: 1.2 },
        scaleY: { from: 1, to: 1.2 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      // Store on sprite for cleanup
      (sprite as unknown as Record<string, unknown>)['__bossGlow'] = glowRing;
    }

    // Invisible: alpha oscillates 0.3–0.7 with cyan tint
    if (enemy.type === 'invisible') {
      sprite.setAlpha(0.5);
      sprite.setTint(0x88ddff);
      this.tweens.add({
        targets: sprite,
        alpha: { from: 0.3, to: 0.7 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
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

    // Make sprite interactive so players can click to inspect
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => {
      this.showEnemyInspector(enemy.instanceId);
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

  /** Open the enemy stat inspector for the given enemy ID. Closes any existing one. */
  private showEnemyInspector(enemyId: string): void {
    // Dismiss existing inspector (same enemy or different)
    if (this.enemyInspector) {
      this.enemyInspector.dismiss();
      this.enemyInspector = null;
      // If clicking the same enemy again, treat as toggle-off
    }

    // Get latest state for this enemy
    const gameClient = this.registry.get('gameClient') as GameClient;
    const state = gameClient?.getLatestState();
    const enemy = state?.enemies[enemyId];
    if (!enemy || !enemy.alive) return;

    this.enemyInspector = new EnemyInspector(this, enemy, () => {
      this.enemyInspector = null;
    });
  }

  private updateEnemyVisual(ev: EnemyVisual, enemy: EnemyState): void {
    const { sprite, hpBar, shadow } = ev;
    const px = enemy.x * TILE_SIZE + TILE_SIZE / 2;
    const py = enemy.y * TILE_SIZE + TILE_SIZE / 2;

    // Flip to face direction of movement (compare old pixel pos before updating)
    const oldX = sprite.x;
    sprite.setPosition(px, py);
    if (px !== oldX) {
      sprite.setFlipX(px < oldX);
    }

    // Move shadow
    shadow.setPosition(px, py + 6);

    // Depth sort (Y)
    const depth = ENTITY_DEPTH + py * 0.001;
    sprite.setDepth(depth);

    // HP bar
    const hpRatio = enemy.hp / ev.maxHp;
    this.drawHpBar(hpBar, px, py - 14 * (sprite.scale / 2), hpRatio);

    // Hit flash on damage + floating combat text
    if (enemy.hp < ev.lastHp) {
      const damage = ev.lastHp - enemy.hp;
      sprite.setTint(0xffffff);
      this.time.delayedCall(80, () => {
        if (sprite.active) {
          // Restore cyan tint for invisible enemies, otherwise clear
          if (ev.type === 'invisible') {
            sprite.setTint(0x88ddff);
          } else {
            sprite.clearTint();
          }
        }
      });
      // Tiny knockback wiggle
      this.tweens.add({
        targets: sprite,
        x: px + (Math.random() - 0.5) * 8,
        duration: 60,
        yoyo: true,
      });
      // Floating damage text
      if (damage > 0) {
        this.spawnFloatingText(px, py - 10, `-${damage}`, 0xff3333);
      }
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

    // Floating skull text at death position
    this.spawnFloatingText(x, y - 10, '💀', 0xffd700, 16);

    // Death animation (cosmetic — purely client-side)
    this.deathAnimator.playDeath(x, y);

    // Original death animation before destroy
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

    const fx = this.add.sprite(x, y, fxKey);
    fx.setDepth(FX_DEPTH);

    // Scale bigger for big explosions
    const scale = fxKey === 'fx_big_explosion' ? 2 : 1.5;
    fx.setScale(scale);

    // Animation keys are registered with the full 'fx_' prefix
    fx.play(fxKey);
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

  /** Spawn floating combat / reward text that drifts up and fades out. */
  private spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: number,
    fontSize: number = 14
  ): void {
    const colorStr = '#' + color.toString(16).padStart(6, '0');
    const txt = this.add.text(x, y, text, {
      fontFamily: '"Arial Black", Arial, sans-serif',
      fontSize: `${fontSize}px`,
      color: colorStr,
      stroke: '#000000',
      strokeThickness: 2,
    });
    txt.setOrigin(0.5, 0.5);
    txt.setDepth(FX_DEPTH + 1);
    txt.setAlpha(0);

    this.tweens.add({
      targets: txt,
      y: y - 30,
      alpha: { from: 0, to: 1 },
      duration: 200,
      ease: 'Quad.Out',
      onComplete: () => {
        this.tweens.add({
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
    // Pick projectile key based on tower type (configId-keyed Record)
    const assetInfo = TOWER_ASSETS[data.configId] ?? TOWER_ASSETS['arrow_tower'];
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

    // Play tower attack animation
    for (const [, tv] of this.towers) {
      const towerWorldX = tv.base.x;
      const towerWorldY = tv.base.y;
      const dist = Phaser.Math.Distance.Between(towerWorldX, towerWorldY, data.fromX, data.fromY);
      if (dist < 8) {
        // Derive the attack anim key from the idle texture key
        const currentTextureKey = tv.soldier.texture.key;
        const attackAnimKey = `${currentTextureKey.replace('_idle', '_attack')}_attack`;
        const idleAnimKey = `${currentTextureKey}_idle`;
        if (this.anims.exists(attackAnimKey)) {
          tv.soldier.play(attackAnimKey);
          tv.soldier.once('animationcomplete', () => {
            if (tv.soldier.active) tv.soldier.play(idleAnimKey);
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

  private handleTowerSoldVisual(data: { instanceId: string; goldRefund: number }): void {
    const tv = this.towers.get(data.instanceId);
    if (!tv) return;

    // Remove from tracking BEFORE the tween so syncTowers can't double-destroy
    // during the 300ms dissolve window (server snapshots arrive every 250ms).
    this.towers.delete(data.instanceId);

    // Floating gold refund text at tower position
    this.spawnFloatingText(tv.base.x, tv.base.y - 20, `+${data.goldRefund}g 💰`, 0xffd700, 16);

    // Dissolve animation — onComplete only destroys Phaser objects (map removal done above)
    this.tweens.add({
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

    // Play sell sound
    this.audio.playSellTower();
  }

  // ─────────────────────────────────────────────────────────────────
  // Full state sync entry point
  // ─────────────────────────────────────────────────────────────────

  /** Show a pulsing ping ring at tile coords */
  private showPingMarker(tileX: number, tileY: number): void {
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(px, py, 8, 0xffffff, 0).setStrokeStyle(2, 0xffcc00, 1);
      ring.setDepth(9000);
      this.tweens.add({
        targets: ring,
        scaleX: 2.5,
        scaleY: 2.5,
        alpha: 0,
        delay: i * 400,
        duration: 1200,
        ease: 'Sine.Out',
        onComplete: () => ring.destroy(),
      });
    }
  }

  syncState(state: GameState): void {
    this.lastState = state;
    this.syncTowers(state.towers);
    this.syncEnemies(state.enemies);
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  isValidBuildTile(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= this.mapWidth || tileY >= this.mapHeight) return false;
    if (this.isOnPath(tileX, tileY)) return false;
    if (this.blockedDecoTiles.has(`${tileX},${tileY}`)) return false;
    if (this.isTileOccupied(tileX, tileY)) return false;
    return true;
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
