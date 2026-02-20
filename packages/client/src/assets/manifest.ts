import type { ElementType } from '@td/shared';

export type AssetEntry =
  | { kind: 'image'; key: string; path: string }
  | { kind: 'spritesheet'; key: string; path: string; frameWidth: number; frameHeight: number }
  | { kind: 'placeholder'; key: string; color: number; width?: number; height?: number };

// ── Enemy Robot Spritesheets ─────────────────────────────────────────
// Each sheet: frameWidth=16, frameHeight=16
// Rows (top→bottom): idle, walk, firing, melee, destroyed
// Hornet: frameWidth=48, frameHeight=24 — neutral hover / firing hover

// ── Tower Defenders — Tiny Swords Units ──────────────────────────────
// Fire (Yellow): Warrior — 192×192 frames. Idle=8f, Attack1=4f, Run=6f
// Water (Blue): Archer — 192×192 frames. Idle=6f, Shoot=8f, Run=4f
// Ice (Black): Lancer — 320×320 frames. Idle=12f, Right_Attack=3f, Run=6f (use 192 width → 20f idle)
// Poison (Purple): Monk — 192×192 frames. Idle=6f, Heal=11f, Run=4f
// Shared (Blue): Warrior — 192×192 frames. Same as fire but blue faction

// ── Effect Spritesheets ──────────────────────────────────────────────
// big-explosion:   352×32  → frameWidth=32, frameHeight=32, 11 frames
// small-explosion: 216×24  → frameWidth=24, frameHeight=24,  9 frames
// muzzle-flashes:   32×8   → frameWidth= 8, frameHeight= 8,  4 frames
// bullet-impacts:   80×8   → frameWidth= 8, frameHeight= 8, 10 frames
// smoke:            64×8   → frameWidth= 8, frameHeight= 8,  8 frames
// Explosion_01:  1536×192  → frameWidth=192, frameHeight=192, 8 frames (Tiny Swords)
// Fire_01:        512×64   → frameWidth=64, frameHeight=64,  8 frames (Tiny Swords)

export const ASSET_MANIFEST: AssetEntry[] = [
  // ── Enemy Robots ────────────────────────────────────────────────────
  { kind: 'spritesheet', key: 'enemy_grunt',     path: 'assets/Robots/Scarab.png',     frameWidth: 16, frameHeight: 16 },
  { kind: 'spritesheet', key: 'enemy_tank',      path: 'assets/Robots/Spider.png',     frameWidth: 16, frameHeight: 16 },
  { kind: 'spritesheet', key: 'enemy_flyer',     path: 'assets/Robots/Hornet.png',     frameWidth: 48, frameHeight: 24 },
  { kind: 'spritesheet', key: 'enemy_boss',      path: 'assets/Robots/Centipede.png',  frameWidth: 16, frameHeight: 16 },
  { kind: 'spritesheet', key: 'enemy_runner',    path: 'assets/Robots/Wasp.png',       frameWidth: 16, frameHeight: 16 },
  { kind: 'spritesheet', key: 'enemy_invisible', path: 'assets/Robots/Scarab.png',     frameWidth: 16, frameHeight: 16 },

  // ── Tower Defenders — Tiny Swords Units ─────────────────────────────
  // Fire element = Yellow faction
  { kind: 'spritesheet', key: 'ts_fire_idle',   path: 'assets/Tiny Swords (Free Pack)/Units/Yellow Units/Warrior/Warrior_Idle.png',    frameWidth: 192, frameHeight: 192 },
  { kind: 'spritesheet', key: 'ts_fire_attack', path: 'assets/Tiny Swords (Free Pack)/Units/Yellow Units/Warrior/Warrior_Attack1.png', frameWidth: 192, frameHeight: 192 },
  // Water element = Blue faction (Archer)
  { kind: 'spritesheet', key: 'ts_water_idle',   path: 'assets/Tiny Swords (Free Pack)/Units/Blue Units/Archer/Archer_Idle.png',  frameWidth: 192, frameHeight: 192 },
  { kind: 'spritesheet', key: 'ts_water_attack', path: 'assets/Tiny Swords (Free Pack)/Units/Blue Units/Archer/Archer_Shoot.png', frameWidth: 192, frameHeight: 192 },
  // Ice element = Black faction (Lancer) — NOTE: 320×320 frame size
  { kind: 'spritesheet', key: 'ts_ice_idle',   path: 'assets/Tiny Swords (Free Pack)/Units/Black Units/Lancer/Lancer_Idle.png',         frameWidth: 320, frameHeight: 320 },
  { kind: 'spritesheet', key: 'ts_ice_attack', path: 'assets/Tiny Swords (Free Pack)/Units/Black Units/Lancer/Lancer_Right_Attack.png', frameWidth: 320, frameHeight: 320 },
  // Poison element = Purple faction (Monk)
  { kind: 'spritesheet', key: 'ts_poison_idle',   path: 'assets/Tiny Swords (Free Pack)/Units/Purple Units/Monk/Idle.png', frameWidth: 192, frameHeight: 192 },
  { kind: 'spritesheet', key: 'ts_poison_attack', path: 'assets/Tiny Swords (Free Pack)/Units/Purple Units/Monk/Heal.png', frameWidth: 192, frameHeight: 192 },
  // Shared = Blue faction (Warrior)
  { kind: 'spritesheet', key: 'ts_shared_idle',   path: 'assets/Tiny Swords (Free Pack)/Units/Blue Units/Warrior/Warrior_Idle.png',    frameWidth: 192, frameHeight: 192 },
  { kind: 'spritesheet', key: 'ts_shared_attack', path: 'assets/Tiny Swords (Free Pack)/Units/Blue Units/Warrior/Warrior_Attack1.png', frameWidth: 192, frameHeight: 192 },

  // ── Buildings (static backgrounds for towers) ──────────────────────
  { kind: 'image', key: 'building_blue',   path: 'assets/Tiny Swords (Free Pack)/Buildings/Blue Buildings/Tower.png' },
  { kind: 'image', key: 'building_yellow', path: 'assets/Tiny Swords (Free Pack)/Buildings/Yellow Buildings/Tower.png' },
  { kind: 'image', key: 'building_red',      path: 'assets/Tiny Swords (Free Pack)/Buildings/Red Buildings/Tower.png' },
  { kind: 'image', key: 'building_barracks', path: 'assets/Tiny Swords (Free Pack)/Buildings/Red Buildings/Barracks.png' },
  { kind: 'image', key: 'building_black',  path: 'assets/Tiny Swords (Free Pack)/Buildings/Black Buildings/Tower.png' },
  { kind: 'image', key: 'building_purple', path: 'assets/Tiny Swords (Free Pack)/Buildings/Purple Buildings/Tower.png' },

  // ── Castles (landmark buildings for start/end markers) ─────────────
  { kind: 'image', key: 'castle_blue',   path: 'assets/Tiny Swords (Free Pack)/Buildings/Blue Buildings/Castle.png' },
  { kind: 'image', key: 'castle_red',    path: 'assets/Tiny Swords (Free Pack)/Buildings/Red Buildings/Castle.png' },

  // ── Archery buildings (for arrow-type towers) ──────────────────────
  { kind: 'image', key: 'archery_yellow', path: 'assets/Tiny Swords (Free Pack)/Buildings/Yellow Buildings/Archery.png' },
  { kind: 'image', key: 'archery_blue',   path: 'assets/Tiny Swords (Free Pack)/Buildings/Blue Buildings/Archery.png' },
  { kind: 'image', key: 'archery_black',  path: 'assets/Tiny Swords (Free Pack)/Buildings/Black Buildings/Archery.png' },
  { kind: 'image', key: 'archery_purple', path: 'assets/Tiny Swords (Free Pack)/Buildings/Purple Buildings/Archery.png' },

  // ── Effect Spritesheets ────────────────────────────────────────────
  { kind: 'spritesheet', key: 'fx_big_explosion',   path: 'assets/Effects/big-explosion.png',   frameWidth: 32, frameHeight: 32 },
  { kind: 'spritesheet', key: 'fx_small_explosion', path: 'assets/Effects/small-explosion.png', frameWidth: 24, frameHeight: 24 },
  { kind: 'spritesheet', key: 'fx_muzzle',          path: 'assets/Effects/muzzle-flashes.png',  frameWidth: 8,  frameHeight: 8 },
  { kind: 'spritesheet', key: 'fx_impact',          path: 'assets/Effects/bullet-impacts.png',  frameWidth: 8,  frameHeight: 8 },
  { kind: 'spritesheet', key: 'fx_smoke',           path: 'assets/Effects/smoke.png',            frameWidth: 8,  frameHeight: 8 },
  { kind: 'spritesheet', key: 'fx_hit_sparks',      path: 'assets/Effects/hit-sparks.png',       frameWidth: 8,  frameHeight: 8 },
  { kind: 'spritesheet', key: 'fx_ts_explosion',    path: 'assets/Tiny Swords (Free Pack)/Particle FX/Explosion_01.png', frameWidth: 192, frameHeight: 192 },
  { kind: 'spritesheet', key: 'fx_ts_fire',         path: 'assets/Tiny Swords (Free Pack)/Particle FX/Fire_01.png',      frameWidth: 64,  frameHeight: 64 },
  { kind: 'spritesheet', key: 'fx_ts_fire2',        path: 'assets/Tiny Swords (Free Pack)/Particle FX/Fire_02.png',      frameWidth: 64,  frameHeight: 64 },

  // ── Projectiles ─────────────────────────────────────────────────────
  { kind: 'spritesheet', key: 'proj_bullet',  path: 'assets/Projectiles/bullets+plasma.png', frameWidth: 8, frameHeight: 8 },
  { kind: 'spritesheet', key: 'proj_grenade', path: 'assets/Projectiles/Grenade.png',         frameWidth: 8, frameHeight: 8 },
  { kind: 'spritesheet', key: 'proj_rpg',     path: 'assets/Projectiles/RPG-round.png',       frameWidth: 16, frameHeight: 16 },

  // ── Terrain tiles ───────────────────────────────────────────────────
  { kind: 'spritesheet', key: 'tileset_color1_ss', path: 'assets/Tiny Swords (Free Pack)/Terrain/Tileset/Tilemap_color1.png', frameWidth: 64, frameHeight: 64 },
  { kind: 'spritesheet', key: 'tileset_color2_ss', path: 'assets/Tiny Swords (Free Pack)/Terrain/Tileset/Tilemap_color2.png', frameWidth: 64, frameHeight: 64 },

  // ── UI Elements ─────────────────────────────────────────────────────
  { kind: 'image', key: 'ui_bar_base', path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Bars/SmallBar_Base.png' },
  { kind: 'image', key: 'ui_bar_fill', path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Bars/SmallBar_Fill.png' },
  { kind: 'image', key: 'ui_big_bar_base', path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Bars/BigBar_Base.png' },
  { kind: 'image', key: 'ui_big_bar_fill', path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Bars/BigBar_Fill.png' },
  { kind: 'image', key: 'ui_banner',   path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Banners from the store page/Banner/Banner.png' },
  { kind: 'image', key: 'ui_wood_table', path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Wood Table/WoodTable.png' },
  { kind: 'image', key: 'ui_ribbon_small', path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Ribbons/SmallRibbons.png' },
  { kind: 'image', key: 'ui_btn_blue_regular',  path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Buttons/BigBlueButton_Regular.png' },
  { kind: 'image', key: 'ui_btn_blue_pressed',  path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Buttons/BigBlueButton_Pressed.png' },
  { kind: 'image', key: 'ui_btn_red_regular',   path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Buttons/BigRedButton_Regular.png' },
  { kind: 'image', key: 'ui_btn_red_pressed',   path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Buttons/BigRedButton_Pressed.png' },
  { kind: 'image', key: 'ui_cursor',    path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Cursors/Cursor_01.png' },
  { kind: 'image', key: 'ui_swords',    path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Swords/Swords.png' },
  { kind: 'image', key: 'ui_wood_table_slots', path: 'assets/Tiny Swords (Free Pack)/UI Elements/UI Elements/Wood Table/WoodTable_Slots.png' },

  // ── Decorations ─────────────────────────────────────────────────────
  // Tree1/Tree2: 1536×256, 6 trees per sheet, each frame 256×256
  { kind: 'spritesheet', key: 'deco_tree1', path: 'assets/Tiny Swords (Free Pack)/Terrain/Resources/Wood/Trees/Tree1.png', frameWidth: 256, frameHeight: 256 },
  { kind: 'spritesheet', key: 'deco_tree2', path: 'assets/Tiny Swords (Free Pack)/Terrain/Resources/Wood/Trees/Tree2.png', frameWidth: 256, frameHeight: 256 },
  // Bushe1: 1024×128, 8 bushes per sheet, each frame 128×128
  { kind: 'spritesheet', key: 'deco_bush1', path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Bushes/Bushe1.png', frameWidth: 128, frameHeight: 128 },
  { kind: 'spritesheet', key: 'deco_bush2', path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Bushes/Bushe2.png', frameWidth: 128, frameHeight: 128 },
  { kind: 'spritesheet', key: 'deco_bush3', path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Bushes/Bushe3.png', frameWidth: 128, frameHeight: 128 },
  { kind: 'image', key: 'deco_rock1',  path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Rocks/Rock1.png' },
  { kind: 'image', key: 'deco_rock2',  path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Rocks/Rock2.png' },
  { kind: 'image', key: 'deco_rock3',  path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Rocks/Rock3.png' },
  { kind: 'image', key: 'deco_rock4',  path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Rocks/Rock4.png' },
  { kind: 'image', key: 'deco_cloud1', path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Clouds/Clouds_01.png' },
  { kind: 'image', key: 'deco_cloud2', path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Clouds/Clouds_02.png' },
  { kind: 'image', key: 'deco_cloud3', path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Clouds/Clouds_03.png' },
  { kind: 'image', key: 'deco_cloud4', path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Clouds/Clouds_04.png' },
  { kind: 'image', key: 'deco_gold_stone1', path: 'assets/Tiny Swords (Free Pack)/Terrain/Resources/Gold/Gold Stones/Gold Stone 1.png' },
  { kind: 'image', key: 'deco_gold_stone2', path: 'assets/Tiny Swords (Free Pack)/Terrain/Resources/Gold/Gold Stones/Gold Stone 2.png' },
];

// ── Typed helpers ────────────────────────────────────────────────────────────

export interface TowerAssetInfo {
  /** Spritesheet key for idle animation */
  idleKey: string;
  /** Spritesheet key for attack animation */
  attackKey: string;
  element: ElementType;
  buildingKey: string;
  /** Frame size (192 for most, 320 for Lancer) */
  frameSize: number;
  /** Number of idle frames */
  idleFrames: number;
  /** Number of attack frames */
  attackFrames: number;
  projKey: string;
  /** Scale to fit on tile (64 / frameSize) */
  unitScale: number;
}

export const TOWER_ASSETS: TowerAssetInfo[] = [
  { idleKey: 'ts_fire_idle',   attackKey: 'ts_fire_attack',   element: 'fire',   buildingKey: 'building_yellow', frameSize: 192, idleFrames: 8,  attackFrames: 4,  projKey: 'proj_grenade', unitScale: 0.28 },
  { idleKey: 'ts_water_idle',  attackKey: 'ts_water_attack',  element: 'water',  buildingKey: 'building_blue',   frameSize: 192, idleFrames: 6,  attackFrames: 8,  projKey: 'proj_bullet',  unitScale: 0.28 },
  { idleKey: 'ts_ice_idle',    attackKey: 'ts_ice_attack',    element: 'ice',    buildingKey: 'building_black',  frameSize: 320, idleFrames: 12, attackFrames: 3,  projKey: 'proj_bullet',  unitScale: 0.17 },
  { idleKey: 'ts_poison_idle', attackKey: 'ts_poison_attack', element: 'poison', buildingKey: 'building_purple', frameSize: 192, idleFrames: 6,  attackFrames: 11, projKey: 'proj_bullet',  unitScale: 0.28 },
  { idleKey: 'ts_shared_idle', attackKey: 'ts_shared_attack', element: 'fire' as ElementType, buildingKey: 'building_blue', frameSize: 192, idleFrames: 8, attackFrames: 4, projKey: 'proj_bullet', unitScale: 0.28 },
];

export interface EnemyAssetInfo {
  key: string;
  enemyType: string;
  walkFrameStart: number;
  walkFrameEnd: number;
  frameRate: number;
  scale: number;
  deathFxKey: string;
}

export const ENEMY_ASSETS: EnemyAssetInfo[] = [
  { key: 'enemy_grunt',     enemyType: 'grunt',     walkFrameStart: 5,  walkFrameEnd: 9,  frameRate: 8,  scale: 3,   deathFxKey: 'fx_small_explosion' },
  { key: 'enemy_runner',    enemyType: 'runner',    walkFrameStart: 0,  walkFrameEnd: 7,  frameRate: 12, scale: 2.5, deathFxKey: 'fx_small_explosion' },
  { key: 'enemy_tank',      enemyType: 'tank',      walkFrameStart: 5,  walkFrameEnd: 9,  frameRate: 6,  scale: 4,   deathFxKey: 'fx_big_explosion'   },
  { key: 'enemy_flyer',     enemyType: 'flyer',     walkFrameStart: 0,  walkFrameEnd: 3,  frameRate: 8,  scale: 3,   deathFxKey: 'fx_small_explosion' },
  { key: 'enemy_invisible', enemyType: 'invisible', walkFrameStart: 5,  walkFrameEnd: 9,  frameRate: 8,  scale: 3,   deathFxKey: 'fx_small_explosion' },
  { key: 'enemy_boss',      enemyType: 'boss',      walkFrameStart: 5,  walkFrameEnd: 9,  frameRate: 6,  scale: 5,   deathFxKey: 'fx_big_explosion'   },
];
