import Phaser from 'phaser';
import type { GameState, GamePhase, Vec2, TowerState, EnemyState, BuildZone } from '@td/shared';
import { TILE_SIZE } from '@td/shared';
import { GameClient } from '../GameClient';

type Sprite = Phaser.GameObjects.Sprite;
type Graphics = Phaser.GameObjects.Graphics;

export class GameScene extends Phaser.Scene {
  private towerSprites: Map<string, Sprite> = new Map();
  private enemySprites: Map<string, Sprite> = new Map();
  private pathGraphics!: Graphics;
  private buildZoneGraphics!: Graphics;
  private ghostGraphics!: Graphics;
  private waypoints: Vec2[] = [];
  private buildZones: BuildZone[] = [];
  private mapWidth = 0;
  private mapHeight = 0;
  private currentPhase: GamePhase = 'prep';
  private selectedTowerId: string | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Dark background
    this.cameras.main.setBackgroundColor('#0a0a15');

    // Set up camera
    this.cameras.main.setScroll(0, 0);

    // Create graphics objects
    this.buildZoneGraphics = this.add.graphics();
    this.pathGraphics = this.add.graphics();
    this.ghostGraphics = this.add.graphics();

    // Set up mouse move for tower placement ghost
    this.input.on('pointermove', this.handleMouseMove, this);

    // Set up click handler for tower placement
    this.input.on('pointerdown', this.handleTileClick, this);

    // Listen for state sync events
    this.events.on('sync-state', this.syncState, this);

    // Listen for tower selection from UI
    this.events.on('tower-selected', this.handleTowerSelected, this);
    this.events.on('tower-deselected', this.handleTowerDeselected, this);

    // Demo map (will be replaced with server data)
    this.setupDemoMap();
  }

  update(_time: number, _delta: number): void {
    // Get GameClient from registry
    const gameClient = this.registry.get('gameClient') as GameClient;

    if (gameClient) {
      // Get latest state from interpolator
      const state = gameClient.getLatestState();

      if (state) {
        // Check for phase transition
        if (state.phase !== this.currentPhase) {
          this.handlePhaseTransition(state.phase);
          this.currentPhase = state.phase;
        }

        // Sync game objects with interpolated state
        this.syncState(state);
      }

      // Show tower placement ghost during prep phase
      if (this.currentPhase === 'prep' && this.selectedTowerId) {
        // Ghost is drawn in handleMouseMove
      }
    }
  }

  private handlePhaseTransition(newPhase: GamePhase): void {
    console.log('Phase transition:', this.currentPhase, '->', newPhase);

    // Could add phase transition effects here
    if (newPhase === 'combat') {
      // Clear ghost when combat starts
      this.ghostGraphics.clear();
    }
  }

  private handleMouseMove(pointer: Phaser.Input.Pointer): void {
    if (this.currentPhase !== 'prep' || !this.selectedTowerId) {
      this.ghostGraphics.clear();
      return;
    }

    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);

    // Redraw ghost
    this.ghostGraphics.clear();

    const isValid = this.isValidBuildTile(tileX, tileY) && !this.isTileOccupied(tileX, tileY);

    // Draw ghost outline
    this.ghostGraphics.lineStyle(2, isValid ? 0x00ff00 : 0xff0000, 0.8);
    this.ghostGraphics.strokeRect(
      tileX * TILE_SIZE,
      tileY * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE
    );

    // Semi-transparent fill
    this.ghostGraphics.fillStyle(isValid ? 0x00ff00 : 0xff0000, 0.3);
    this.ghostGraphics.fillRect(
      tileX * TILE_SIZE,
      tileY * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE
    );
  }

  private handleTowerSelected(configId: string): void {
    this.selectedTowerId = configId;
  }

  private handleTowerDeselected(): void {
    this.selectedTowerId = null;
    this.ghostGraphics.clear();
  }

  private isTileOccupied(tileX: number, tileY: number): boolean {
    for (const sprite of this.towerSprites.values()) {
      const towerTileX = Math.floor(sprite.x / TILE_SIZE);
      const towerTileY = Math.floor(sprite.y / TILE_SIZE);
      if (towerTileX === tileX && towerTileY === tileY) {
        return true;
      }
    }
    return false;
  }

  private setupDemoMap(): void {
    // Demo waypoints for testing
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
  }

  renderMap(waypoints: Vec2[], buildZones: BuildZone[]): void {
    this.waypoints = waypoints;
    this.buildZones = buildZones;

    // Clear previous graphics
    this.buildZoneGraphics.clear();
    this.pathGraphics.clear();

    // Draw build zones
    this.buildZoneGraphics.fillStyle(0x336633, 0.5);
    for (const zone of buildZones) {
      this.buildZoneGraphics.fillRect(
        zone.x * TILE_SIZE,
        zone.y * TILE_SIZE,
        zone.width * TILE_SIZE,
        zone.height * TILE_SIZE
      );
      // Draw grid outline
      this.buildZoneGraphics.lineStyle(1, 0x44aa44, 0.8);
      this.buildZoneGraphics.strokeRect(
        zone.x * TILE_SIZE,
        zone.y * TILE_SIZE,
        zone.width * TILE_SIZE,
        zone.height * TILE_SIZE
      );
    }

    // Draw path
    this.pathGraphics.lineStyle(40, 0x665533, 1);
    this.pathGraphics.beginPath();
    
    if (waypoints.length > 0) {
      const firstPoint = waypoints[0];
      this.pathGraphics.moveTo(
        firstPoint.x * TILE_SIZE + TILE_SIZE / 2,
        firstPoint.y * TILE_SIZE + TILE_SIZE / 2
      );

      for (let i = 1; i < waypoints.length; i++) {
        const point = waypoints[i];
        this.pathGraphics.lineTo(
          point.x * TILE_SIZE + TILE_SIZE / 2,
          point.y * TILE_SIZE + TILE_SIZE / 2
        );
      }
    }
    this.pathGraphics.strokePath();

    // Draw center line on path
    this.pathGraphics.lineStyle(2, 0x887744, 0.5);
    this.pathGraphics.beginPath();
    
    if (waypoints.length > 0) {
      const firstPoint = waypoints[0];
      this.pathGraphics.moveTo(
        firstPoint.x * TILE_SIZE + TILE_SIZE / 2,
        firstPoint.y * TILE_SIZE + TILE_SIZE / 2
      );

      for (let i = 1; i < waypoints.length; i++) {
        const point = waypoints[i];
        this.pathGraphics.lineTo(
          point.x * TILE_SIZE + TILE_SIZE / 2,
          point.y * TILE_SIZE + TILE_SIZE / 2
        );
      }
    }
    this.pathGraphics.strokePath();
  }

  private handleTileClick(pointer: Phaser.Input.Pointer): void {
    // Convert screen coordinates to tile coordinates
    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);

    // Only handle tower placement during prep phase
    if (this.currentPhase === 'prep' && this.selectedTowerId) {
      const gameClient = this.registry.get('gameClient') as GameClient;
      if (gameClient) {
        // Check if tile is valid
        if (this.isValidBuildTile(tileX, tileY) && !this.isTileOccupied(tileX, tileY)) {
          // Emit tile-clicked event for tower placement UI
          this.events.emit('tile-clicked', { tileX, tileY, configId: this.selectedTowerId });

          // The actual network call is handled by the UI that selected the tower
          // For now, we'll just emit the event and let the UI handle the network call
          console.log(`Attempting to place tower ${this.selectedTowerId} at (${tileX}, ${tileY})`);
        }
      }
    } else {
      // Emit tile-clicked event for tower placement UI (legacy behavior)
      this.events.emit('tile-clicked', { tileX, tileY });
    }
  }

  syncState(state: GameState): void {
    this.syncTowers(state.towers);
    this.syncEnemies(state.enemies);
  }

  private syncTowers(towers: Record<string, TowerState>): void {
    const currentTowerIds = new Set(Object.keys(towers));

    // Remove sprites for towers that no longer exist
    for (const [instanceId, sprite] of this.towerSprites) {
      if (!currentTowerIds.has(instanceId)) {
        sprite.destroy();
        this.towerSprites.delete(instanceId);
      }
    }

    // Update or create tower sprites
    for (const [instanceId, tower] of Object.entries(towers)) {
      let sprite = this.towerSprites.get(instanceId);

      if (!sprite) {
        // Create new tower sprite
        const textureKey = `tower_${tower.configId.split('_')[0]}` || 'tower_shared';
        sprite = this.add.sprite(
          tower.x * TILE_SIZE + TILE_SIZE / 2,
          tower.y * TILE_SIZE + TILE_SIZE / 2,
          textureKey
        );
        this.towerSprites.set(instanceId, sprite);
      } else {
        // Update position (for smoothly moving if needed)
        sprite.x = tower.x * TILE_SIZE + TILE_SIZE / 2;
        sprite.y = tower.y * TILE_SIZE + TILE_SIZE / 2;
      }

      // Could add upgrade visual indicators here
    }
  }

  private syncEnemies(enemies: Record<string, EnemyState>): void {
    const currentEnemyIds = new Set(Object.keys(enemies));

    // Remove sprites for enemies that no longer exist
    for (const [instanceId, sprite] of this.enemySprites) {
      if (!currentEnemyIds.has(instanceId)) {
        sprite.destroy();
        this.enemySprites.delete(instanceId);
      }
    }

    // Update or create enemy sprites
    for (const [instanceId, enemy] of Object.entries(enemies)) {
      if (!enemy.alive) continue;

      let sprite = this.enemySprites.get(instanceId);

      if (!sprite) {
        // Create new enemy sprite
        const textureKey = `enemy_${enemy.type}`;
        sprite = this.add.sprite(enemy.x, enemy.y, textureKey);
        this.enemySprites.set(instanceId, sprite);
      } else {
        // Update position based on waypoint progress
        sprite.x = enemy.x;
        sprite.y = enemy.y;
      }

      // Could add direction/flipping here based on movement
    }
  }

  // Get build zones for tower placement validation
  getBuildZones(): BuildZone[] {
    return this.buildZones;
  }

  // Check if a tile is a valid build location
  isValidBuildTile(tileX: number, tileY: number): boolean {
    for (const zone of this.buildZones) {
      if (
        tileX >= zone.x &&
        tileX < zone.x + zone.width &&
        tileY >= zone.y &&
        tileY < zone.y + zone.height
      ) {
        return true;
      }
    }
    return false;
  }

  // Get waypoints for enemy path rendering
  getWaypoints(): Vec2[] {
    return this.waypoints;
  }
}
