import { describe, it, expect } from 'vitest';
import { MAP_CONFIGS } from './maps.js';

const map = MAP_CONFIGS.map_01;

describe('Map Config — map_01', () => {
  it('has 32×24 dimensions', () => {
    expect(map.width).toBe(32);
    expect(map.height).toBe(24);
  });

  it('has at least 15 waypoints', () => {
    expect(map.waypoints.length).toBeGreaterThanOrEqual(15);
  });

  it('has at least 12 build zones', () => {
    expect(map.buildZones.length).toBeGreaterThanOrEqual(12);
  });

  it('has a crossroads (waypoint appears twice in path)', () => {
    const tileVisits = new Map<string, number>();
    for (const wp of map.waypoints) {
      if (wp.x < 0 || wp.x >= map.width) continue; // skip off-screen
      const key = `${wp.x},${wp.y}`;
      tileVisits.set(key, (tileVisits.get(key) ?? 0) + 1);
    }
    const crossroads = [...tileVisits.values()].some(v => v >= 2);
    expect(crossroads).toBe(true);
  });

  it('build zones do not overlap path waypoints', () => {
    const pathTiles = new Set<string>();
    for (const wp of map.waypoints) {
      pathTiles.add(`${wp.x},${wp.y}`);
    }
    for (const zone of map.buildZones) {
      for (let dx = 0; dx < zone.width; dx++) {
        for (let dy = 0; dy < zone.height; dy++) {
          const key = `${zone.x + dx},${zone.y + dy}`;
          expect(pathTiles.has(key)).toBe(false);
        }
      }
    }
  });

  it('all waypoints within bounds (except off-screen start/end)', () => {
    for (let i = 1; i < map.waypoints.length - 1; i++) {
      const wp = map.waypoints[i];
      expect(wp.x).toBeGreaterThanOrEqual(0);
      expect(wp.x).toBeLessThan(map.width);
      expect(wp.y).toBeGreaterThanOrEqual(0);
      expect(wp.y).toBeLessThan(map.height);
    }
  });

  it('has 4 player zones', () => {
    expect(map.playerZones.length).toBe(4);
  });

  it('has decorations on non-path tiles', () => {
    expect(map.decorations).toBeDefined();
    expect(map.decorations!.length).toBeGreaterThanOrEqual(10);
  });
});
