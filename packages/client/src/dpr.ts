/**
 * HiDPI / Retina display support.
 *
 * The game is designed for a 1280x720 logical viewport. On HiDPI displays
 * (devicePixelRatio > 1), the canvas backing store is scaled up so every
 * logical pixel maps to `DPR` physical pixels. This eliminates the blurry
 * upscaling that browsers apply when CSS-stretching a low-resolution canvas.
 *
 * Usage:
 *   import { GAME_W, GAME_H, S } from '../dpr';
 *
 *   // Proportional layout (fractions of W/H) — multiply by S
 *   this.add.text(GAME_W * S / 2, GAME_H * S * 0.19, ...);
 *
 *   // Absolute dimensions — multiply by S
 *   fontSize: `${44 * S}px`
 *   panelWidth = 180 * S
 *
 *   // The canvas dimensions (use in Phaser config)
 *   width:  GAME_W * S
 *   height: GAME_H * S
 */

/** Logical game width in design pixels (independent of display density). */
export const GAME_W = 1280;

/** Logical game height in design pixels (independent of display density). */
export const GAME_H = 720;

/** Device pixel ratio, capped at 2 to avoid excessive GPU load on 3x devices. */
export const DPR = Math.min(window.devicePixelRatio ?? 1, 2);

/**
 * Scale factor from design-space to canvas-space. Equals DPR.
 * Multiply any "design pixel" value by S to get the canvas pixel value.
 */
export const S = DPR;
