import type { MapConfig } from '../index.js';

export const MAP_CONFIGS: Record<string, MapConfig> = {
  map_01: {
    id: 'map_01',
    name: 'Forest Path',
    width: 20,
    height: 15,
    tileSize: 64,
    // Winding path through the map with 10 waypoints - creates multiple firing windows
    waypoints: [
      { x: -1, y: 7 },    // 0: Start (off-screen left)
      { x: 2, y: 7 },     // 1: Entry
      { x: 2, y: 3 },     // 2: First turn up
      { x: 6, y: 3 },     // 3: Top section
      { x: 6, y: 8 },     // 4: Middle descent
      { x: 10, y: 8 },    // 5: Center
      { x: 10, y: 4 },    // 6: Upper center
      { x: 14, y: 4 },    // 7: Upper right
      { x: 14, y: 11 },   // 8: Lower right
      { x: 18, y: 11 },   // 9: Near end
      { x: 21, y: 11 },   // 10: End (off-screen right)
    ],
    // 6 build zones positioned for multiple firing windows
    buildZones: [
      // Zone A: Early game coverage (left side)
      { x: 1, y: 5, width: 2, height: 3 },
      // Zone B: Top path coverage
      { x: 3, y: 1, width: 3, height: 2 },
      // Zone C: Middle section - key intersection
      { x: 7, y: 5, width: 2, height: 3 },
      // Zone D: Center coverage
      { x: 8, y: 9, width: 3, height: 2 },
      // Zone E: Upper right coverage
      { x: 12, y: 2, width: 2, height: 3 },
      // Zone F: Late game coverage (right side)
      { x: 15, y: 9, width: 2, height: 3 },
    ],
    // 3 player zones - unlock based on player count
    playerZones: [
      {
        id: 0,
        minPlayers: 1,
        buildZones: [0, 2], // Zone A + C available at 1+ players
      },
      {
        id: 1,
        minPlayers: 2,
        buildZones: [1, 3], // Add top + center zones at 2+ players
      },
      {
        id: 2,
        minPlayers: 3,
        buildZones: [4, 5], // Add upper right + late game at 3+ players
      },
    ],
  },
};