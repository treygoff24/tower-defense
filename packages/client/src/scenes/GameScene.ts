import Phaser from 'phaser';
import type { GameState, GamePhase, Vec2, BuildZone } from '@td/shared';
import { TILE_SIZE, MAP_CONFIGS, TOWER_CONFIGS } from '@td/shared';
import { GameClient } from '../GameClient';
import { AudioManager } from '../audio/AudioManager';
import { TowerRenderer } from '../renderers/TowerRenderer';
import { EnemyRenderer } from '../renderers/EnemyRenderer';
import { MapRenderer } from '../renderers/MapRenderer';

// ─── Constants ────────────────────────────────────────────────────────────────
const HUD_DEPTH = 50;

export class GameScene extends Phaser.Scene {
  // ── Audio ──────────────────────────────────────────────────────────
  private audio = new AudioManager();

  // ── Renderers ─────────────────────────────────────────────────────
  private towerRenderer!: TowerRenderer;
  private enemyRenderer!: EnemyRenderer;
  private mapRenderer!: MapRenderer;

  // ── Ghost / range preview ─────────────────────────────────────────
  private ghostGraphics!: Phaser.GameObjects.Graphics;
  private rangePreview!: Phaser.GameObjects.Graphics;

  // ── Map data (held here for build-validity checks) ─────────────────
  private waypoints: Vec2[] = [];
  private buildZones: BuildZone[] = [];
  private mapWidth = 0;
  private mapHeight = 0;

  // ── Phase & selection state ────────────────────────────────────────
  private currentPhase: GamePhase = 'prep';
  private selectedTowerId: string | null = null;

  // ── Timing ────────────────────────────────────────────────────────
  private lastBaseHp = -1;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2d5a1b');

    // Audio
    this.audio.bind(this);

    // Renderers
    this.mapRenderer = new MapRenderer(this);
    this.towerRenderer = new TowerRenderer(this, this.audio);
    this.enemyRenderer = new EnemyRenderer(this, this.audio);

    // Ghost / range preview (HUD-layer overlay, owned by GameScene)
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
    this.events.on('tower-sold-visual', this.handleTowerSoldVisual, this);

    this.setupDemoMap();
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

    // Animate clouds
    this.mapRenderer.updateClouds(delta);
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

    this.mapRenderer.renderMap(
      this.waypoints,
      this.buildZones,
      this.mapWidth,
      this.mapHeight
    );
    this.mapRenderer.spawnFloatingClouds();

    // Fit camera
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;
    const zoomX = camW / (this.mapWidth * TILE_SIZE);
    const zoomY = camH / (this.mapHeight * TILE_SIZE);
    const zoom = Math.min(zoomX, zoomY) * 0.95;
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(
      (this.mapWidth * TILE_SIZE) / 2,
      (this.mapHeight * TILE_SIZE) / 2
    );
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
    const valid =
      this.isValidBuildTile(tileX, tileY) &&
      !this.towerRenderer.isTileOccupied(tileX, tileY);
    const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const cy = tileY * TILE_SIZE + TILE_SIZE / 2;

    this.ghostGraphics.clear();
    this.rangePreview.clear();

    const rangePixels = 3 * TILE_SIZE;
    this.rangePreview.fillStyle(valid ? 0x00aaff : 0xff3300, 0.08);
    this.rangePreview.fillCircle(cx, cy, rangePixels);
    this.rangePreview.lineStyle(1, valid ? 0x00aaff : 0xff3300, 0.4);
    this.rangePreview.strokeCircle(cx, cy, rangePixels);

    const color = valid ? 0x00ff88 : 0xff3300;
    this.ghostGraphics.lineStyle(3, color, 0.9);
    this.ghostGraphics.strokeRect(
      tileX * TILE_SIZE,
      tileY * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE
    );
    this.ghostGraphics.fillStyle(color, 0.25);
    this.ghostGraphics.fillRect(
      tileX * TILE_SIZE,
      tileY * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE
    );

    const cs = 8;
    const tx = tileX * TILE_SIZE;
    const ty = tileY * TILE_SIZE;
    this.ghostGraphics.lineStyle(3, color, 1);
    [
      [tx, ty],
      [tx + TILE_SIZE - cs, ty],
      [tx, ty + TILE_SIZE - cs],
      [tx + TILE_SIZE - cs, ty + TILE_SIZE - cs],
    ].forEach(([lx, ly]) => {
      this.ghostGraphics.strokeRect(lx, ly, cs, cs);
    });
  }

  private handleTileClick(pointer: Phaser.Input.Pointer): void {
    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);

    const canPlace = this.currentPhase === 'prep' || this.currentPhase === 'combat';
    if (canPlace && this.selectedTowerId) {
      const gameClient = this.registry.get('gameClient') as GameClient;
      if (
        gameClient &&
        this.isValidBuildTile(tileX, tileY) &&
        !this.towerRenderer.isTileOccupied(tileX, tileY)
      ) {
        this.events.emit('tile-clicked', {
          tileX,
          tileY,
          configId: this.selectedTowerId,
        });
      }
    } else if (this.currentPhase === 'prep') {
      const towerAtTile = this.towerRenderer.getTowerAtTile(tileX, tileY);
      if (towerAtTile) {
        const { instanceId, tv } = towerAtTile;
        const cfg = TOWER_CONFIGS[tv.configId];
        const refund = cfg ? Math.round(cfg.costGold * 0.5) : 0;
        const gameClient = this.registry.get('gameClient') as {
          getLatestState(): { towers: Record<string, { tier: number }> } | null;
        } | undefined;
        const state = gameClient?.getLatestState();
        const tier = state?.towers[instanceId]?.tier ?? 1;
        this.events.emit('placed-tower-clicked', {
          instanceId,
          configId: tv.configId,
          refund,
          tier,
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
    this.towerRenderer.playWaveFanfare();

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
  // State sync — delegate to renderers
  // ─────────────────────────────────────────────────────────────────

  syncState(state: GameState): void {
    this.towerRenderer.update(state.towers);
    this.enemyRenderer.update(state.enemies);
  }

  // ─────────────────────────────────────────────────────────────────
  // External event handlers — delegate to renderers
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
    this.towerRenderer.handleShotFired(data);
  }

  handleEnemyKilled(data: { id: string; x: number; y: number }): void {
    this.enemyRenderer.handleEnemyKilled(data);
  }

  handleBaseDamaged(_data: { damage: number }): void {
    // Camera shake and red flash are handled in update() via state diff
  }

  private handleTowerSoldVisual(data: {
    instanceId: string;
    goldRefund: number;
  }): void {
    this.towerRenderer.handleTowerSoldVisual(data);
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers (build-tile logic uses buildZones cached locally)
  // ─────────────────────────────────────────────────────────────────

  isValidBuildTile(tileX: number, tileY: number): boolean {
    return this.buildZones.some(
      (z) =>
        tileX >= z.x &&
        tileX < z.x + z.width &&
        tileY >= z.y &&
        tileY < z.y + z.height
    );
  }

  getBuildZones(): BuildZone[] {
    return this.buildZones;
  }

  getWaypoints(): Vec2[] {
    return this.waypoints;
  }
}
