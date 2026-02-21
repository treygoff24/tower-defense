import Phaser from 'phaser';
import type { Vec2, BuildZone } from '@td/shared';
import { TILE_SIZE } from '@td/shared';

// ─── Constants ────────────────────────────────────────────────────────────────
const CLOUD_DEPTH = -10;
const TERRAIN_DEPTH = 0;
const DECO_DEPTH = 5;

export class MapRenderer {
  private scene: Phaser.Scene;

  private tileLayer!: Phaser.GameObjects.Group;
  private terrainLayer!: Phaser.GameObjects.Graphics;
  private decorationLayer!: Phaser.GameObjects.Group;
  private cloudLayer!: Phaser.GameObjects.Group;

  private waypoints: Vec2[] = [];
  private buildZones: BuildZone[] = [];
  private mapWidth = 0;
  private mapHeight = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.tileLayer = scene.add.group();
    this.decorationLayer = scene.add.group();
    this.cloudLayer = scene.add.group();
    this.terrainLayer = scene.add.graphics().setDepth(TERRAIN_DEPTH);
  }

  // ─────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────

  /** Render the full map (tiles, path, build zones, markers, decorations). */
  renderMap(
    waypoints: Vec2[],
    buildZones: BuildZone[],
    mapWidth: number,
    mapHeight: number
  ): void {
    this.waypoints = waypoints;
    this.buildZones = buildZones;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    this.renderTiles();
    this.renderTerrain();
    this.spawnDecorations();
  }

  /** Spawn floating clouds (call once after renderMap). */
  spawnFloatingClouds(): void {
    const cloudKeys = ['deco_cloud1', 'deco_cloud2', 'deco_cloud3', 'deco_cloud4'];
    for (let i = 0; i < 6; i++) {
      const key = cloudKeys[i % cloudKeys.length];
      if (!this.scene.textures.exists(key)) continue;
      const cloud = this.scene.add.image(
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

  /** Animate clouds — call every frame from GameScene.update(). */
  updateClouds(delta: number): void {
    for (const obj of this.cloudLayer.getChildren()) {
      const cloud = obj as Phaser.GameObjects.Image;
      cloud.x += (cloud as unknown as { speed: number }).speed * (delta / 1000);
      if (cloud.x > this.mapWidth * TILE_SIZE + 200) {
        cloud.x = -200;
      }
    }
  }

  isOnPath(tx: number, ty: number): boolean {
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[i + 1];
      if (a.x === b.x) {
        if (tx === a.x && ty >= Math.min(a.y, b.y) && ty <= Math.max(a.y, b.y))
          return true;
      } else {
        if (ty === a.y && tx >= Math.min(a.x, b.x) && tx <= Math.max(a.x, b.x))
          return true;
      }
    }
    return false;
  }

  isInBuildZone(tx: number, ty: number): boolean {
    return this.buildZones.some(
      (z) =>
        tx >= z.x &&
        tx < z.x + z.width &&
        ty >= z.y &&
        ty < z.y + z.height
    );
  }

  getBuildZones(): BuildZone[] {
    return this.buildZones;
  }

  getWaypoints(): Vec2[] {
    return this.waypoints;
  }

  // ─────────────────────────────────────────────────────────────────
  // Tile rendering
  // ─────────────────────────────────────────────────────────────────

  private renderTiles(): void {
    this.tileLayer.clear(true, true);
    const hasTileset = this.scene.textures.exists('tileset_color1_ss');
    const hasDirtTileset = this.scene.textures.exists('tileset_color2_ss');
    const hash = (a: number, b: number): number =>
      ((a * 2654435761) ^ (b * 2246822519)) >>> 0;

    if (hasTileset) {
      for (let ty = 0; ty < this.mapHeight; ty++) {
        for (let tx = 0; tx < this.mapWidth; tx++) {
          if (this.isOnPath(tx, ty)) continue;
          const frame = this.getGrassTileFrame(tx, ty);
          const tile = this.scene.add.image(
            tx * TILE_SIZE + TILE_SIZE / 2,
            ty * TILE_SIZE + TILE_SIZE / 2,
            'tileset_color1_ss',
            frame
          );
          tile.setDepth(TERRAIN_DEPTH - 1);
          if (frame === 10) {
            const h = hash(tx, ty);
            if ((h % 100) < 30) tile.setRotation(Math.PI);
            tile.setAlpha(0.9 + (h % 11) / 100);
          }
          this.tileLayer.add(tile);
        }
      }
    }

    if (hasDirtTileset) {
      for (let ty = 0; ty < this.mapHeight; ty++) {
        for (let tx = 0; tx < this.mapWidth; tx++) {
          if (!this.isOnPath(tx, ty)) continue;
          const frame = this.getPathTileFrame(tx, ty);
          const dirtTile = this.scene.add.image(
            tx * TILE_SIZE + TILE_SIZE / 2,
            ty * TILE_SIZE + TILE_SIZE / 2,
            'tileset_color2_ss',
            frame
          );
          dirtTile.setDepth(TERRAIN_DEPTH + 0.5);
          dirtTile.setTint(0xddccaa);
          this.tileLayer.add(dirtTile);
        }
      }
    }
  }

  private renderTerrain(): void {
    const g = this.terrainLayer;
    g.clear();

    // Dark edge outline around path
    g.lineStyle(2, 0x3a2a10, 0.55);
    for (let ty = 0; ty < this.mapHeight; ty++) {
      for (let tx = 0; tx < this.mapWidth; tx++) {
        if (!this.isOnPath(tx, ty)) continue;
        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;
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

    // Worn trail center line
    g.lineStyle(2, 0x6b4c1e, 0.25);
    this.drawPath(g, this.waypoints);

    // Build zone styling
    for (const zone of this.buildZones) {
      const zx = zone.x * TILE_SIZE;
      const zy = zone.y * TILE_SIZE;
      const zw = zone.width * TILE_SIZE;
      const zh = zone.height * TILE_SIZE;

      g.fillStyle(0x8b7d6b, 0.45);
      g.fillRoundedRect(zx + 2, zy + 2, zw - 4, zh - 4, 6);
      g.lineStyle(2, 0xccbb99, 0.65);
      g.strokeRoundedRect(zx + 2, zy + 2, zw - 4, zh - 4, 6);
      g.lineStyle(1, 0xaabb88, 0.3);
      for (let tx = zone.x; tx < zone.x + zone.width; tx++) {
        for (let ty = zone.y; ty < zone.y + zone.height; ty++) {
          g.strokeRect(tx * TILE_SIZE + 4, ty * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        }
      }
    }

    // Start marker — enemy spawn (Castle Red)
    if (this.waypoints.length > 0) {
      const sp = this.waypoints[0];
      const sx = sp.x * TILE_SIZE + TILE_SIZE / 2;
      const sy = sp.y * TILE_SIZE + TILE_SIZE / 2;

      const redGlow = this.scene.add.circle(sx, sy, TILE_SIZE * 1.3, 0xff0000, 0.15);
      redGlow.setDepth(TERRAIN_DEPTH + 1);
      this.scene.tweens.add({
        targets: redGlow,
        alpha: { from: 0.08, to: 0.22 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });

      if (this.scene.textures.exists('castle_red')) {
        const castleRed = this.scene.add.image(sx, sy - 16, 'castle_red');
        castleRed.setScale(0.5);
        castleRed.setDepth(TERRAIN_DEPTH + 2);
        castleRed.setOrigin(0.5, 0.65);
      } else {
        g.fillStyle(0xdd2222, 0.9);
        g.fillTriangle(sx - 14, sy - 13, sx - 14, sy + 13, sx + 16, sy);
      }

      this.scene.add
        .text(sx, sy + TILE_SIZE * 0.6, 'SPAWN', {
          fontSize: '10px',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          color: '#ff6666',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(TERRAIN_DEPTH + 3)
        .setAlpha(0.8);
    }

    // End marker — player castle (Castle Blue)
    if (this.waypoints.length > 1) {
      const ep = this.waypoints[this.waypoints.length - 1];
      const ex = ep.x * TILE_SIZE + TILE_SIZE / 2;
      const ey = ep.y * TILE_SIZE + TILE_SIZE / 2;

      const blueGlow = this.scene.add.circle(ex, ey, TILE_SIZE * 1.3, 0x2244ff, 0.15);
      blueGlow.setDepth(TERRAIN_DEPTH + 1);
      this.scene.tweens.add({
        targets: blueGlow,
        alpha: { from: 0.08, to: 0.22 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });

      if (this.scene.textures.exists('castle_blue')) {
        const castleBlue = this.scene.add.image(ex, ey - 16, 'castle_blue');
        castleBlue.setScale(0.5);
        castleBlue.setDepth(TERRAIN_DEPTH + 2);
        castleBlue.setOrigin(0.5, 0.65);
      } else {
        g.fillStyle(0x4466ff, 0.85);
        g.fillRect(ex - 11, ey - 10, 22, 20);
      }

      this.scene.add
        .text(ex, ey + TILE_SIZE * 0.6, 'BASE', {
          fontSize: '10px',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          color: '#6688ff',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(TERRAIN_DEPTH + 3)
        .setAlpha(0.8);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Decoration spawning
  // ─────────────────────────────────────────────────────────────────

  private spawnDecorations(): void {
    this.decorationLayer.clear(true, true);

    const decoAssets: Array<{
      key: string;
      frames: number;
      scale: number;
      isSprite: boolean;
    }> = [
      { key: 'deco_tree1', frames: 6, scale: 0.28, isSprite: true },
      { key: 'deco_tree2', frames: 6, scale: 0.28, isSprite: true },
      { key: 'deco_bush1', frames: 8, scale: 0.35, isSprite: true },
      { key: 'deco_bush2', frames: 8, scale: 0.35, isSprite: true },
      { key: 'deco_bush3', frames: 8, scale: 0.35, isSprite: true },
      { key: 'deco_rock1', frames: 1, scale: 0.7, isSprite: false },
      { key: 'deco_rock2', frames: 1, scale: 0.7, isSprite: false },
      { key: 'deco_rock3', frames: 1, scale: 0.7, isSprite: false },
      { key: 'deco_rock4', frames: 1, scale: 0.7, isSprite: false },
    ];

    const availableAssets = decoAssets.filter((a) =>
      this.scene.textures.exists(a.key)
    );

    const weightedAssets: typeof availableAssets = [];
    for (const asset of availableAssets) {
      const count = asset.key.startsWith('deco_tree')
        ? 4
        : asset.key.startsWith('deco_bush')
        ? 3
        : 2;
      for (let i = 0; i < count; i++) weightedAssets.push(asset);
    }

    if (weightedAssets.length === 0) return;

    const placed: Array<{ x: number; y: number }> = [];
    let attempts = 0;
    while (placed.length < 24 && attempts < 500) {
      attempts++;
      const tx = Math.floor(Math.random() * this.mapWidth);
      const ty = Math.floor(Math.random() * this.mapHeight);
      if (this.isOnPath(tx, ty) || this.isInBuildZone(tx, ty)) continue;
      if (placed.some((p) => p.x === tx && p.y === ty)) continue;

      placed.push({ x: tx, y: ty });
      const asset =
        weightedAssets[Math.floor(Math.random() * weightedAssets.length)];
      const frame = asset.frames > 1 ? Math.floor(Math.random() * asset.frames) : 0;
      const scaleJitter = asset.scale * (0.85 + Math.random() * 0.3);

      let deco: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
      if (asset.isSprite) {
        deco = this.scene.add.sprite(
          tx * TILE_SIZE + TILE_SIZE / 2,
          ty * TILE_SIZE + TILE_SIZE / 2,
          asset.key,
          frame
        );
      } else {
        deco = this.scene.add.image(
          tx * TILE_SIZE + TILE_SIZE / 2,
          ty * TILE_SIZE + TILE_SIZE / 2,
          asset.key
        );
      }
      deco.setScale(scaleJitter);
      deco.setDepth(DECO_DEPTH + ty * 0.01);
      deco.setAlpha(0.92);
      this.decorationLayer.add(deco);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Autotile helpers
  // ─────────────────────────────────────────────────────────────────

  private getGrassTileFrame(tx: number, ty: number): number {
    const maxX = this.mapWidth - 1;
    const maxY = this.mapHeight - 1;
    const isLeft   = tx === 0;
    const isRight  = tx === maxX;
    const isTop    = ty === 0;
    const isBottom = ty === maxY;
    if (isTop && isLeft)     return 0;
    if (isTop && isRight)    return 2;
    if (isBottom && isLeft)  return 18;
    if (isBottom && isRight) return 20;
    if (isTop)    return 1;
    if (isBottom) return 19;
    if (isLeft)   return 9;
    if (isRight)  return 11;
    return 10;
  }

  private getPathTileFrame(tx: number, ty: number): number {
    const up    = this.isOnPath(tx, ty - 1);
    const down  = this.isOnPath(tx, ty + 1);
    const left  = this.isOnPath(tx - 1, ty);
    const right = this.isOnPath(tx + 1, ty);

    if (up && down && left && right) return 10;
    if (up && down && left)    return 11;
    if (up && down && right)   return 9;
    if (left && right && up)   return 19;
    if (left && right && down) return 1;
    if (up && down)    return 10;
    if (left && right) return 10;
    if (down && right) return 0;
    if (down && left)  return 2;
    if (up && right)   return 18;
    if (up && left)    return 20;
    if (up)    return 19;
    if (down)  return 1;
    if (left)  return 11;
    if (right) return 9;
    return 10;
  }

  // ─────────────────────────────────────────────────────────────────
  // Drawing utilities
  // ─────────────────────────────────────────────────────────────────

  private drawPath(g: Phaser.GameObjects.Graphics, waypoints: Vec2[]): void {
    g.beginPath();
    if (waypoints.length === 0) return;
    g.moveTo(
      waypoints[0].x * TILE_SIZE + TILE_SIZE / 2,
      waypoints[0].y * TILE_SIZE + TILE_SIZE / 2
    );
    for (let i = 1; i < waypoints.length; i++) {
      g.lineTo(
        waypoints[i].x * TILE_SIZE + TILE_SIZE / 2,
        waypoints[i].y * TILE_SIZE + TILE_SIZE / 2
      );
    }
    g.strokePath();
  }

  /** Draw a dashed rectangle on the given Graphics object. */
  drawDashedRect(
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
    this.drawDashedLine(g, x, y, x + w, y, dashLen, gapLen);
    this.drawDashedLine(g, x + w, y, x + w, y + h, dashLen, gapLen);
    this.drawDashedLine(g, x + w, y + h, x, y + h, dashLen, gapLen);
    this.drawDashedLine(g, x, y + h, x, y, dashLen, gapLen);
  }

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
}
