// e2e/lobby.spec.ts — Tests for the lobby/boot flow
import { test, expect } from '@playwright/test';
import { resetServer, waitForGameReady, waitForScene, assertCanvasExists, getActiveScenes, screenshotCanvas } from './helpers';

test.describe('Lobby Scene', () => {
  test.beforeEach(async ({ page }) => {
    await resetServer();
    await page.goto('/');
    await waitForGameReady(page);
  });

  test('game boots and shows the canvas', async ({ page }) => {
    await assertCanvasExists(page);
  });

  test('BootScene loads then transitions to LobbyScene', async ({ page }) => {
    await waitForScene(page, 'LobbyScene', 5_000);
    const scenes = await getActiveScenes(page);
    expect(scenes).toContain('LobbyScene');
    expect(scenes).not.toContain('BootScene');
  });

  test('lobby canvas renders with expected dimensions', async ({ page }) => {
    await waitForScene(page, 'LobbyScene');
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('clicking join navigates to ClassSelectScene', async ({ page }) => {
    await waitForScene(page, 'LobbyScene');

    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') await dialog.accept('TestPlayer');
    });

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.54 } });
    await page.waitForTimeout(200);
    await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.65 } });

    await waitForScene(page, 'ClassSelectScene', 8_000);
    const scenes = await getActiveScenes(page);
    expect(scenes).toContain('ClassSelectScene');
  });
});
