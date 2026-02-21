import type { MapConfig } from '../index.js';

// ─── Path layout (32×24 tiles) ────────────────────────────────────────────────
//
// Enemies enter from the left at row y=4, snake through S-curves, and exit
// off-screen to the right at row y=22.
//
// Intentional crossroads at tile (14, 9):
//   • Seg-V  (WP5→WP6):  x=14, y=4→20  (going S)
//   • Seg-H  (WP8→WP9):  y=9,  x=20→8  (going W)
//
// Choke points (build zones that can fire on 2+ path segments simultaneously):
//   CP1  Left S-curve:    build zones BZ3/BZ4 cover both x=2 and x=7 verticals
//   CP2  Crossroads N:    build zones BZ5/BZ6/BZ7 cover Seg-V and Seg-H
//   CP3  Crossroads S:    build zones BZ6/BZ8 cover Seg-V below crossroads
//   CP4  Bottom return:   build zones BZ10/BZ11 cover y=20/y=22 bottom rows
//   CP5  Right parallels: build zones BZ12/BZ13 cover x=26 and x=31 verticals
//
// Path tiles (column, row):
//   y=4  x= 0..2          (WP0→WP1  entry run)
//   x=2  y= 4..16         (WP1→WP2  left descent)
//   y=16 x= 2..7          (WP2→WP3  bottom-left crossbar)
//   x=7  y= 4..16         (WP3→WP4  left re-ascent)
//   y=4  x= 7..14         (WP4→WP5  top run to Seg-V)
//   x=14 y= 4..20         (WP5→WP6  Seg-V, central vertical ← CROSSROADS ARM)
//   y=20 x=14..20         (WP6→WP7  bottom-center run)
//   x=20 y= 9..20         (WP7→WP8  right re-ascent)
//   y=9  x= 8..20         (WP8→WP9  middle return bar ← CROSSROADS ARM)
//   x=8  y= 9..22         (WP9→WP10 back-left descent)
//   y=22 x= 8..26         (WP10→WP11 bottom sweep)
//   x=26 y= 7..22         (WP11→WP12 right-side rise)
//   y=7  x=26..31         (WP12→WP13 top-right run)
//   x=31 y= 7..22         (WP13→WP14 far-right descent)
//   y=22 x=31..33         (WP14→WP15 exit run, off-screen)

export const MAP_CONFIGS: Record<string, MapConfig> = {
  map_01: {
    id: 'map_01',
    name: 'Elemental Crossroads',
    width: 32,
    height: 24,
    tileSize: 64,

    // ── Waypoints ──────────────────────────────────────────────────────────
    // 18 waypoints (WP0–WP17), creating S-curves and one central crossroads.
    waypoints: [
      { x: -1, y:  4 },   //  0 – off-screen entry (left edge, top zone)
      { x:  2, y:  4 },   //  1 – entry point; turn S
      { x:  2, y: 16 },   //  2 – left descent bottom; turn E
      { x:  7, y: 16 },   //  3 – bottom-left corner; turn N
      { x:  7, y:  4 },   //  4 – left S-curve apex; turn E  (S-curve 1)
      { x: 14, y:  4 },   //  5 – top of Seg-V; turn S
      { x: 14, y:  9 },   //  6 – ★ CROSSROADS tile (1st pass, going S on Seg-V)
      { x: 14, y: 20 },   //  7 – bottom of Seg-V; turn E
      { x: 20, y: 20 },   //  8 – bottom-center; turn N
      { x: 20, y:  9 },   //  9 – middle-right; turn W (S-curve 2 apex)
      { x: 14, y:  9 },   // 10 – ★ CROSSROADS tile (2nd pass, going W on Seg-H)
      { x:  8, y:  9 },   // 11 – Seg-H end; turn S
      { x:  8, y: 22 },   // 12 – back-left bottom; turn E
      { x: 26, y: 22 },   // 13 – bottom sweep end; turn N
      { x: 26, y:  7 },   // 14 – right-side apex; turn E    (S-curve 3)
      { x: 31, y:  7 },   // 15 – top-right; turn S
      { x: 31, y: 22 },   // 16 – bottom-right; turn E
      { x: 33, y: 22 },   // 17 – off-screen exit (right edge)
    ],

    // ── Build Zones ────────────────────────────────────────────────────────
    // 14 zones (BZ0–BZ13). None overlap path tiles (verified above).
    buildZones: [
      // BZ0  – Small entry sentinel: covers approaching enemies on WP0→WP1
      { x:  0, y:  1, width: 2, height: 3 },

      // BZ1  – Upper-left gap: above the left S-curve gap (y=4 gap x=3..6)
      { x:  3, y:  0, width: 4, height: 4 },

      // BZ2  – Upper-center: above WP4→WP5 top run and top of Seg-V
      { x:  9, y:  0, width: 5, height: 3 },

      // BZ3  – Left S-curve interior upper (CHOKE 1: covers x=2 & x=7 verticals)
      { x:  3, y:  5, width: 4, height: 5 },

      // BZ4  – Left S-curve interior lower (CHOKE 1: covers x=2 & x=7 verticals)
      { x:  3, y: 11, width: 4, height: 4 },

      // BZ5  – Above crossroads bar, left of Seg-V (CHOKE 2: covers Seg-H & Seg-V)
      { x:  8, y:  5, width: 5, height: 3 },

      // BZ6  – Below crossroads bar, left of Seg-V (CHOKE 2/3: covers Seg-H & Seg-V)
      { x: 10, y: 10, width: 4, height: 4 },

      // BZ7  – Above crossroads bar, right of Seg-V (CHOKE 2: covers Seg-H & Seg-V)
      { x: 15, y:  5, width: 4, height: 3 },

      // BZ8  – Below crossroads bar, right of Seg-V (CHOKE 3: covers Seg-V & bottom)
      { x: 15, y: 10, width: 4, height: 5 },

      // BZ9  – Upper-right quadrant: large zone, covers x=26 rise from above
      { x: 21, y:  0, width: 5, height: 7 },

      // BZ10 – Lower-left: covers bottom of left S-curve & bottom sweep (CHOKE 4)
      { x:  0, y: 17, width: 7, height: 4 },

      // BZ11 – Middle-right: covers WP7→WP8 rise and bottom sweep (CHOKE 4)
      { x: 21, y: 10, width: 5, height: 5 },

      // BZ12 – Between right parallels, upper (CHOKE 5: covers x=26 & x=31)
      { x: 27, y:  8, width: 3, height: 6 },

      // BZ13 – Between right parallels, lower (CHOKE 5: covers x=26 & x=31)
      { x: 27, y: 15, width: 3, height: 6 },
    ],

    // ── Player Zones ───────────────────────────────────────────────────────
    // 4 tiers – build zones unlock as player count increases.
    // playerZones[i].buildZones = array of BZ indices unlocked at that tier.
    playerZones: [
      {
        id: 0,
        minPlayers: 1,
        // Core zones: entry sentinel, left S-curve interior, crossroads south
        buildZones: [0, 3, 6, 8],
      },
      {
        id: 1,
        minPlayers: 2,
        // Add upper zones + crossroads north for better range coverage
        buildZones: [1, 4, 5, 7],
      },
      {
        id: 2,
        minPlayers: 3,
        // Add upper-center, upper-right, lower-left, middle-right
        buildZones: [2, 9, 10, 11],
      },
      {
        id: 3,
        minPlayers: 4,
        // Unlock right-side parallels for full map coverage
        buildZones: [12, 13],
      },
    ],

    // ── Decorative Tiles ───────────────────────────────────────────────────
    // Placed on tiles that are neither path nor build-zone tiles.
    decorations: [
      // Top-left corner trees
      { x:  0, y:  0, type: 'tree' },
      { x:  1, y:  0, type: 'tree' },
      { x:  0, y:  4, type: 'bush' },

      // Between BZ1 and BZ2 – rocks along top edge
      { x:  7, y:  0, type: 'rock' },
      { x:  8, y:  0, type: 'rock' },

      // Upper-center, outside BZ2/BZ9
      { x: 14, y:  1, type: 'tree' },
      { x: 15, y:  2, type: 'bush' },
      { x: 20, y:  0, type: 'tree' },

      // Far-upper-right corner
      { x: 26, y:  0, type: 'rock' },
      { x: 27, y:  0, type: 'rock' },
      { x: 29, y:  1, type: 'tree' },
      { x: 30, y:  0, type: 'tree' },
      { x: 31, y:  0, type: 'bush' },

      // Left side below S-curve
      { x:  0, y: 22, type: 'tree' },
      { x:  1, y: 23, type: 'bush' },
      { x:  2, y: 23, type: 'rock' },
      { x:  6, y: 22, type: 'bush' },

      // Bottom-center gap (y=21 between bottom paths)
      { x: 15, y: 21, type: 'rock' },
      { x: 16, y: 21, type: 'bush' },
      { x: 18, y: 21, type: 'tree' },

      // Right-edge decorations between x=31 and map edge (x=28..30, y=0..6)
      { x: 28, y:  2, type: 'tree' },
      { x: 29, y:  5, type: 'bush' },
      { x: 30, y:  4, type: 'rock' },

      // Bottom-right corner (below exit path y=23)
      { x: 22, y: 23, type: 'rock' },
      { x: 24, y: 23, type: 'bush' },
      { x: 28, y: 23, type: 'tree' },
      { x: 30, y: 23, type: 'tree' },
    ],
  },
};
