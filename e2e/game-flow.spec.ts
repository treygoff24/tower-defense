// e2e/game-flow.spec.ts — Full scene navigation flow
import { test, expect } from '@playwright/test';
import { resetServer, waitForGameReady, waitForScene, getActiveScenes } from './helpers';

test.describe('Scene Navigation', () => {
  test('lobby → class select → game scene full flow', async ({ page }) => {
    await resetServer();
    await page.goto('/');
    await waitForGameReady(page);
    await waitForScene(page, 'LobbyScene', 5_000);

    // Handle name prompt
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') await dialog.accept('E2EPlayer');
    });

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Join
    await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.54 } });
    await page.waitForTimeout(200);
    await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.65 } });

    await waitForScene(page, 'ClassSelectScene', 8_000);
    await page.waitForTimeout(600);

    // Select fire class + ready up
    await canvas.click({ position: { x: box.width * 0.18, y: box.height * 0.5 } });
    await page.waitForTimeout(300);
    await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.93 } });

    await waitForScene(page, 'GameScene', 10_000);
    const scenes = await getActiveScenes(page);
    expect(scenes).toContain('GameScene');
    expect(scenes).toContain('HudScene');

    // Verify game state
    await page.waitForFunction(() => {
      const c = (window as any).__gameClient;
      return c?.getLatestState?.() !== null;
    }, { timeout: 5_000 });

    const state = await page.evaluate(() => (window as any).__gameClient.getLatestState());
    expect(state.phase).toBe('prep');
    expect(state.baseHp).toBe(100);
    expect(state.economy.gold).toBeGreaterThan(0);
    expect(Object.keys(state.players)).toHaveLength(1);

    // Map structure
    const mapInfo = await page.evaluate(() => {
      const gs = (window as any).__game.scene.getScene('GameScene');
      return { waypoints: gs.getWaypoints().length, buildZones: gs.getBuildZones().length };
    });
    expect(mapInfo.waypoints).toBe(11);
    expect(mapInfo.buildZones).toBe(6);
  });
});
