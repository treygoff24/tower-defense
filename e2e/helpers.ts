// e2e/helpers.ts — Shared utilities for Playwright E2E tests
import { Page, expect } from '@playwright/test';
import { io as ioClient } from 'socket.io-client';

/**
 * Reset the server-side game simulation so each test starts clean.
 */
export async function resetServer(): Promise<void> {
  return new Promise<void>((resolve) => {
    const sock = ioClient('http://localhost:3001', { transports: ['websocket'], forceNew: true });
    sock.on('connect', () => {
      sock.emit('reset_game', () => { sock.disconnect(); resolve(); });
    });
    sock.on('connect_error', () => { sock.disconnect(); resolve(); });
    setTimeout(() => { sock.disconnect(); resolve(); }, 2000);
  });
}

/**
 * Wait for the Phaser game to be fully initialized.
 */
export async function waitForGameReady(page: Page, timeoutMs = 10_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const game = (window as any).__game;
      return game && game.isBooted;
    },
    { timeout: timeoutMs },
  );
}

/**
 * Wait for a specific Phaser scene to be active.
 */
export async function waitForScene(page: Page, sceneKey: string, timeoutMs = 10_000): Promise<void> {
  await page.waitForFunction(
    (key) => {
      const game = (window as any).__game;
      if (!game || !game.scene) return false;
      return game.scene.isActive(key);
    },
    sceneKey,
    { timeout: timeoutMs },
  );
}

/**
 * Get current active scene keys from the Phaser game.
 */
export async function getActiveScenes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const game = (window as any).__game;
    if (!game?.scene?.scenes) return [];
    return game.scene.scenes
      .filter((s: any) => game.scene.isActive(s.sys.settings.key))
      .map((s: any) => s.sys.settings.key);
  });
}

/**
 * Assert the Phaser canvas exists and has reasonable dimensions.
 */
export async function assertCanvasExists(page: Page): Promise<void> {
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);
}

/**
 * Take a screenshot of just the canvas element.
 */
export async function screenshotCanvas(page: Page, name: string): Promise<Buffer> {
  const canvas = page.locator('canvas');
  return canvas.screenshot({ path: `e2e/screenshots/${name}.png` });
}
