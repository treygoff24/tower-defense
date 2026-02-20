import type { ElementType } from '@td/shared';

export type AssetEntry =
  | { kind: 'image'; key: string; path: string }
  | { kind: 'placeholder'; key: string; color: number; width?: number; height?: number };

export const ASSET_MANIFEST: AssetEntry[] = [
  // Towers
  { kind: 'placeholder', key: 'tower_fire', color: 0xff4400 },
  { kind: 'placeholder', key: 'tower_water', color: 0x0088ff },
  { kind: 'placeholder', key: 'tower_ice', color: 0x88ccff },
  { kind: 'placeholder', key: 'tower_poison', color: 0x44cc44 },
  { kind: 'placeholder', key: 'tower_shared', color: 0xaaaaaa },
  // Enemies
  { kind: 'placeholder', key: 'enemy_grunt', color: 0xcc0000 },
  { kind: 'placeholder', key: 'enemy_runner', color: 0xff8800 },
  { kind: 'placeholder', key: 'enemy_tank', color: 0x880000 },
  { kind: 'placeholder', key: 'enemy_flyer', color: 0xcc00cc },
  { kind: 'placeholder', key: 'enemy_invisible', color: 0x444444 },
  { kind: 'placeholder', key: 'enemy_boss', color: 0xff0000 },
  // Map tiles
  { kind: 'placeholder', key: 'tile_path', color: 0x665533 },
  { kind: 'placeholder', key: 'tile_build', color: 0x336633 },
  { kind: 'placeholder', key: 'tile_empty', color: 0x222222 },
  // Effects
  { kind: 'placeholder', key: 'projectile', color: 0xffff00, width: 16, height: 16 },
];

export interface TowerAssetInfo {
  key: string;
  element: ElementType;
}

export const TOWER_ASSETS: TowerAssetInfo[] = [
  { key: 'tower_fire', element: 'fire' },
  { key: 'tower_water', element: 'water' },
  { key: 'tower_ice', element: 'ice' },
  { key: 'tower_poison', element: 'poison' },
  { key: 'tower_shared', element: 'shared' as ElementType },
];

export interface EnemyAssetInfo {
  key: string;
  enemyType: string;
}

export const ENEMY_ASSETS: EnemyAssetInfo[] = [
  { key: 'enemy_grunt', enemyType: 'grunt' },
  { key: 'enemy_runner', enemyType: 'runner' },
  { key: 'enemy_tank', enemyType: 'tank' },
  { key: 'enemy_flyer', enemyType: 'flyer' },
  { key: 'enemy_invisible', enemyType: 'invisible' },
  { key: 'enemy_boss', enemyType: 'boss' },
];
