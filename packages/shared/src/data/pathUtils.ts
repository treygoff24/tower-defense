import type { Vec2 } from '../index.js';

export function isOnPath(tx: number, ty: number, waypoints: Vec2[]): boolean {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (a.x === b.x) {
      if (tx === a.x && ty >= Math.min(a.y, b.y) && ty <= Math.max(a.y, b.y)) return true;
    } else {
      if (ty === a.y && tx >= Math.min(a.x, b.x) && tx <= Math.max(a.x, b.x)) return true;
    }
  }
  return false;
}
