import type { ElementType } from '@td/shared';

export type AssetEntry =
  | { kind: 'image'; key: string; path: string }
  | { kind: 'spritesheet'; key: string; path: string; frameWidth: number; frameHeight: number }
  | { kind: 'placeholder'; key: string; color: number; width?: number; height?: number };

// ── Enemy Robot Spritesheets ─────────────────────────────────────────
// Each sheet: frameWidth=16, frameHeight=16
// Rows (top→bottom): idle, walk, firing, melee, destroyed
// Hornet: frameWidth=48, frameHeight=24 — neutral hover / firing hover

// ── Tower Soldier Spritesheets ───────────────────────────────────────
// Each sheet: 80×112, frameWidth=16, frameHeight=16
// Rows (top→bottom): idle, walk, crawl, fire, hit, death, throw (7 rows × 5 frames)

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

  // ── Tower Soldiers ─────────────────────────────────────────────────
  { kind: 'spritesheet', key: 'tower_fire',   path: 'assets/Soldiers/Grenadier-Class.png',    frameWidth: 16, frameHeight: 16 },
  { kind: 'spritesheet', key: 'tower_water',  path: 'assets/Soldiers/RadioOperator-Class.png', frameWidth: 16, frameHeight: 16 },
  { kind: 'spritesheet', key: 'tower_ice',    path: 'assets/Soldiers/Sniper-Class.png',        frameWidth: 16, frameHeight: 16 },
  { kind: 'spritesheet', key: 'tower_poison', path: 'assets/Soldiers/Assault-Class.png',       frameWidth: 16, frameHeight: 16 },
  { kind: 'spritesheet', key: 'tower_shared', path: 'assets/Soldiers/MachineGunner-Class.png', frameWidth: 16, frameHeight: 16 },

  // ── Buildings (static backgrounds for towers) ──────────────────────
  { kind: 'image', key: 'building_blue',   path: 'assets/Tiny Swords (Free Pack)/Buildings/Blue Buildings/Tower.png' },
  { kind: 'image', key: 'building_yellow', path: 'assets/Tiny Swords (Free Pack)/Buildings/Yellow Buildings/Tower.png' },
  { kind: 'image', key: 'building_red',      path: 'assets/Tiny Swords (Free Pack)/Buildings/Red Buildings/Tower.png' },
  { kind: 'image', key: 'building_barracks', path: 'assets/Tiny Swords (Free Pack)/Buildings/Red Buildings/Barracks.png' },
  { kind: 'image', key: 'building_black',  path: 'assets/Tiny Swords (Free Pack)/Buildings/Black Buildings/Tower.png' },
  { kind: 'image', key: 'building_purple', path: 'assets/Tiny Swords (Free Pack)/Buildings/Purple Buildings/Tower.png' },

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

  // ── Decorations ─────────────────────────────────────────────────────
  // Tree1/Tree2: 1536×256, 6 trees per sheet, each frame 256×256
  { kind: 'spritesheet', key: 'deco_tree1', path: 'assets/Tiny Swords (Free Pack)/Terrain/Resources/Wood/Trees/Tree1.png', frameWidth: 256, frameHeight: 256 },
  { kind: 'spritesheet', key: 'deco_tree2', path: 'assets/Tiny Swords (Free Pack)/Terrain/Resources/Wood/Trees/Tree2.png', frameWidth: 256, frameHeight: 256 },
  // Bushe1: 1024×128, 8 bushes per sheet, each frame 128×128
  { kind: 'spritesheet', key: 'deco_bush1', path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Bushes/Bushe1.png', frameWidth: 128, frameHeight: 128 },
  { kind: 'image', key: 'deco_rock1',  path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Rocks/Rock1.png' },
  { kind: 'image', key: 'deco_rock2',  path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Rocks/Rock2.png' },
  { kind: 'image', key: 'deco_cloud1', path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Clouds/Clouds_01.png' },
  { kind: 'image', key: 'deco_cloud2', path: 'assets/Tiny Swords (Free Pack)/Terrain/Decorations/Clouds/Clouds_02.png' },
];

// ── Typed helpers ────────────────────────────────────────────────────────────

export interface TowerAssetInfo {
  key: string;
  element: ElementType;
  buildingKey: string;
  /** Which soldier row to play for 'idle' anim */
  idleRow: number;
  /** Which soldier row to play for 'fire' anim */
  fireRow: number;
  projKey: string;
}

export const TOWER_ASSETS: TowerAssetInfo[] = [
  { key: 'tower_fire',   element: 'fire',   buildingKey: 'building_yellow', idleRow: 0, fireRow: 6, projKey: 'proj_grenade' },
  { key: 'tower_water',  element: 'water',  buildingKey: 'building_blue',   idleRow: 0, fireRow: 3, projKey: 'proj_bullet'  },
  { key: 'tower_ice',    element: 'ice',    buildingKey: 'building_black',  idleRow: 0, fireRow: 3, projKey: 'proj_bullet'  },
  { key: 'tower_poison', element: 'poison', buildingKey: 'building_purple', idleRow: 0, fireRow: 3, projKey: 'proj_bullet'  },
  { key: 'tower_shared', element: 'fire' as ElementType, buildingKey: 'building_blue', idleRow: 0, fireRow: 3, projKey: 'proj_bullet' },
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
