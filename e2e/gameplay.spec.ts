// e2e/gameplay.spec.ts — Deep gameplay tests that actually PLAY THE GAME
import { test, expect, Page } from '@playwright/test';
import { io as ioClient } from 'socket.io-client';
import { waitForGameReady, waitForScene, screenshotCanvas } from './helpers';

// ── Server helpers (run in Node, not the browser) ──────────────────

function resetServer(): Promise<void> {
  return new Promise<void>((resolve) => {
    const sock = ioClient('http://localhost:3001', { transports: ['websocket'], forceNew: true });
    sock.on('connect', () => {
      sock.emit('reset_game', () => { sock.disconnect(); resolve(); });
    });
    sock.on('connect_error', () => { sock.disconnect(); resolve(); });
    setTimeout(() => { sock.disconnect(); resolve(); }, 2000);
  });
}

// ── Browser helpers ────────────────────────────────────────────────

async function getToGameScene(page: Page): Promise<void> {
  await resetServer();
  await page.goto('/');
  await waitForGameReady(page);
  await waitForScene(page, 'LobbyScene', 5_000);

  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') await dialog.accept('Tester');
  });

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.54 } });
  await page.waitForTimeout(200);
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.65 } });

  await waitForScene(page, 'ClassSelectScene', 8_000);
  await page.waitForTimeout(600);

  // Select fire class
  await canvas.click({ position: { x: box.width * 0.18, y: box.height * 0.5 } });
  await page.waitForTimeout(300);
  // Ready up
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.93 } });

  await waitForScene(page, 'GameScene', 10_000);
  await page.waitForFunction(() => {
    const c = (window as any).__gameClient;
    const s = c?.getLatestState?.();
    return s?.phase === 'prep' && s?.economy?.gold > 0;
  }, { timeout: 5_000 });
}

async function cheatGold(page: Page, amount: number): Promise<void> {
  await page.evaluate(async (amt) => {
    return new Promise<void>((resolve) => {
      const game = (window as any).__game;
      const client = game.registry.get('gameClient');
      const socket = (client as any).network?.socket;
      if (socket) {
        socket.emit('dev_cheat', { type: 'add_gold', amount: amt }, () => resolve());
      } else {
        resolve();
      }
      setTimeout(resolve, 500);
    });
  }, amount);
  await page.waitForTimeout(300); // Wait for snapshot with updated gold
}

async function placeTower(page: Page, configId: string, tileX: number, tileY: number): Promise<boolean> {
  return page.evaluate(async ({ configId, tileX, tileY }) => {
    const client = (window as any).__gameClient;
    client.selectTower(configId);
    const game = (window as any).__game;
    const gameScene = game.scene.getScene('GameScene');
    gameScene.events.emit('tile-clicked', { tileX, tileY, configId });
    await new Promise((r) => setTimeout(r, 400));
    const state = client.getLatestState();
    return Object.values(state?.towers ?? {}).some(
      (t: any) => t.configId === configId && t.x === tileX && t.y === tileY,
    );
  }, { configId, tileX, tileY });
}

async function startWave(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (window as any).__gameClient.startWave();
  });
}

async function getState(page: Page): Promise<any> {
  return page.evaluate(() => (window as any).__gameClient?.getLatestState?.());
}

async function waitForState(page: Page, predicate: string, timeoutMs = 10_000): Promise<void> {
  await page.waitForFunction(
    (pred) => {
      const s = (window as any).__gameClient?.getLatestState?.();
      if (!s) return false;
      return new Function('state', `return ${pred}`)(s);
    },
    predicate,
    { timeout: timeoutMs },
  );
}

// ════════════════════════════════════════════════════════════════════
// THE REAL TEST — One deep playthrough
// ════════════════════════════════════════════════════════════════════

test.describe('Full Gameplay Test', () => {

  test('build a diverse defense, fight wave 1, survive, and prep for wave 2', async ({ page }) => {
    test.setTimeout(180_000); // 3 minutes — this test plays a real game

    await getToGameScene(page);

    // ── STEP 1: Verify initial state ──────────────────────────────
    let state = await getState(page);
    expect(state.phase).toBe('prep');
    expect(state.baseHp).toBe(100);
    expect(state.wave).toBe(0);
    expect(Object.keys(state.towers)).toHaveLength(0);
    const startingGold = state.economy.gold;
    console.log(`Starting gold: ${startingGold}`);

    // ── STEP 2: Grant gold for a full loadout ─────────────────────
    await cheatGold(page, 5000);
    state = await getState(page);
    expect(state.economy.gold).toBeGreaterThan(5000);
    console.log(`Gold after cheat: ${state.economy.gold}`);

    // ── STEP 3: Build diverse towers across build zones ───────────
    //
    // Map build zones:
    //   Zone A: x:[1,2] y:[5,6,7]  — left side, covers early path
    //   Zone B: x:[3,4,5] y:[1,2]  — top, covers first turn
    //   Zone C: x:[7,8] y:[5,6,7]  — middle, covers center path
    //   Zone D: x:[8,9,10] y:[9,10] — bottom center
    //   Zone E: x:[12,13] y:[2,3,4] — upper right
    //   Zone F: x:[15,16] y:[9,10,11] — right side, covers exit

    // Zone A — fire towers (our class) for early damage
    expect(await placeTower(page, 'flame_spire', 1, 5)).toBe(true);
    expect(await placeTower(page, 'arrow_tower', 2, 5)).toBe(true);
    expect(await placeTower(page, 'arrow_tower', 1, 6)).toBe(true);
    expect(await placeTower(page, 'inferno_cannon', 2, 6)).toBe(true);

    // Zone B — ballistas for long range coverage on top path
    expect(await placeTower(page, 'ballista', 3, 1)).toBe(true);
    expect(await placeTower(page, 'ballista', 4, 1)).toBe(true);
    expect(await placeTower(page, 'arrow_tower', 5, 1)).toBe(true);

    // Zone C — fire + shared towers for middle intersection
    expect(await placeTower(page, 'magma_pool', 7, 5)).toBe(true);
    expect(await placeTower(page, 'flame_spire', 8, 5)).toBe(true);
    expect(await placeTower(page, 'arrow_tower', 7, 6)).toBe(true);
    expect(await placeTower(page, 'arrow_tower', 8, 6)).toBe(true);

    // Zone D — AOE coverage at bottom center
    expect(await placeTower(page, 'magma_pool', 8, 9)).toBe(true);
    expect(await placeTower(page, 'arrow_tower', 9, 9)).toBe(true);

    // Zone E — sniper coverage upper right
    expect(await placeTower(page, 'ballista', 12, 2)).toBe(true);
    expect(await placeTower(page, 'inferno_cannon', 13, 2)).toBe(true);

    // Zone F — last line of defense near exit
    expect(await placeTower(page, 'flame_spire', 15, 9)).toBe(true);
    expect(await placeTower(page, 'ballista', 16, 9)).toBe(true);
    expect(await placeTower(page, 'arrow_tower', 15, 10)).toBe(true);
    expect(await placeTower(page, 'inferno_cannon', 16, 10)).toBe(true);

    // Verify all towers placed
    state = await getState(page);
    const towerCount = Object.keys(state.towers).length;
    console.log(`Towers placed: ${towerCount}`);
    expect(towerCount).toBe(19);

    // Verify gold was spent
    expect(state.economy.gold).toBeLessThan(5100);

    // Check tower variety
    const towerTypes = new Set(Object.values(state.towers).map((t: any) => t.configId));
    console.log(`Tower types used: ${[...towerTypes].join(', ')}`);
    expect(towerTypes.size).toBeGreaterThanOrEqual(5); // arrow, ballista, flame_spire, inferno_cannon, magma_pool

    await screenshotCanvas(page, 'full-defense-built');

    // ── STEP 4: Start Wave 1 ──────────────────────────────────────
    const goldBeforeWave = state.economy.gold;
    await startWave(page);

    // Wait for the server to transition to combat (socket round-trip)
    await waitForState(page, 'state.phase === "combat"', 5_000);
    state = await getState(page);
    expect(state.phase).toBe('combat');
    expect(state.wave).toBe(1);
    console.log('Wave 1 started!');

    // ── STEP 5: Wait for enemies to spawn ─────────────────────────
    await waitForState(page, 'Object.keys(state.enemies).length > 0', 5_000);
    state = await getState(page);
    console.log(`Enemies spawned: ${Object.keys(state.enemies).length}`);

    await page.waitForTimeout(2000);
    await screenshotCanvas(page, 'wave1-enemies-spawned');

    // ── STEP 6: Verify combat is happening ────────────────────────
    // Wait a bit then check that enemies are taking damage
    await page.waitForTimeout(3000);
    state = await getState(page);

    const enemies = Object.values(state.enemies) as any[];
    const aliveEnemies = enemies.filter((e: any) => e.alive);
    const damagedEnemies = enemies.filter((e: any) => e.hp < e.maxHp);
    const deadEnemies = enemies.filter((e: any) => !e.alive);

    console.log(`Combat status: ${aliveEnemies.length} alive, ${damagedEnemies.length} damaged, ${deadEnemies.length} dead`);
    expect(damagedEnemies.length + deadEnemies.length).toBeGreaterThan(0);

    await screenshotCanvas(page, 'wave1-combat-in-progress');

    // ── STEP 7: Wait for wave to complete ─────────────────────────
    console.log('Waiting for wave 1 to complete...');
    await waitForState(
      page,
      'state.phase === "prep" || state.phase === "victory" || state.phase === "defeat"',
      120_000,
    );

    state = await getState(page);
    console.log(`Wave 1 result: phase=${state.phase}, baseHp=${state.baseHp}, gold=${state.economy.gold}`);

    await screenshotCanvas(page, 'wave1-complete');

    // ── STEP 8: Verify results ────────────────────────────────────
    // With 19 towers, we should absolutely survive wave 1 (5 grunts, 50hp each)
    expect(state.phase).toBe('prep');
    expect(state.baseHp).toBe(100); // No leaks with this many towers
    expect(state.wave).toBe(1);

    // Should have received wave completion gold bonus
    expect(state.economy.gold).toBeGreaterThan(goldBeforeWave);
    console.log(`Gold earned from wave: ${state.economy.gold - goldBeforeWave}`);

    // All enemies should be dead
    const postEnemies = Object.values(state.enemies) as any[];
    const stillAlive = postEnemies.filter((e: any) => e.alive);
    expect(stillAlive).toHaveLength(0);

    // Towers should still be there
    expect(Object.keys(state.towers)).toHaveLength(19);

    // ── STEP 9: Sell some towers and verify refund ────────────────
    const goldBeforeSell = state.economy.gold;
    const towerIds = Object.keys(state.towers);
    const towerToSell = state.towers[towerIds[0]];
    console.log(`Selling tower: ${towerToSell.configId} at (${towerToSell.x},${towerToSell.y})`);

    await page.evaluate(async (id) => {
      return new Promise<void>((resolve) => {
        const game = (window as any).__game;
        const client = game.registry.get('gameClient');
        const socket = (client as any).network?.socket;
        if (socket) {
          socket.emit('command', { type: 'sell_tower', instanceId: id }, () => resolve());
        }
        setTimeout(resolve, 500);
      });
    }, towerIds[0]);
    await page.waitForTimeout(300);

    state = await getState(page);
    expect(Object.keys(state.towers)).toHaveLength(18);
    expect(state.economy.gold).toBeGreaterThan(goldBeforeSell);
    console.log(`Gold after selling: ${state.economy.gold} (+${state.economy.gold - goldBeforeSell})`);

    // ── STEP 10: Start Wave 2 ─────────────────────────────────────
    console.log('Starting wave 2...');
    await startWave(page);

    await waitForState(page, 'state.phase === "combat"', 5_000);
    state = await getState(page);
    expect(state.phase).toBe('combat');
    expect(state.wave).toBe(2);

    // Wait for enemies
    await waitForState(page, 'Object.keys(state.enemies).length > 0', 5_000);
    state = await getState(page);
    console.log(`Wave 2 enemies: ${Object.keys(state.enemies).length}`);

    await page.waitForTimeout(3000);
    await screenshotCanvas(page, 'wave2-combat');

    // Wait for wave 2 to complete
    await waitForState(
      page,
      'state.phase === "prep" || state.phase === "victory" || state.phase === "defeat"',
      120_000,
    );

    state = await getState(page);
    console.log(`Wave 2 result: phase=${state.phase}, baseHp=${state.baseHp}, gold=${state.economy.gold}`);

    await screenshotCanvas(page, 'wave2-complete');

    expect(state.baseHp).toBe(100); // Still no leaks with 18 towers
    expect(state.phase).toBe('prep');

    console.log('✅ Full gameplay test passed — built 19 towers, survived 2 waves, sold a tower, verified combat.');
  });

  test('no towers = base destruction', async ({ page }) => {
    test.setTimeout(120_000);

    await getToGameScene(page);

    // Don't build anything — just start the wave
    await startWave(page);

    await waitForState(page, 'state.phase === "combat"', 5_000);
    let state = await getState(page);
    expect(state.phase).toBe('combat');

    // Wait for enemies to leak and damage the base
    await waitForState(page, 'state.baseHp < 100', 60_000);

    state = await getState(page);
    console.log(`Base taking damage: HP=${state.baseHp}`);
    expect(state.baseHp).toBeLessThan(100);

    await screenshotCanvas(page, 'base-taking-damage');

    // Wait for wave to end
    await waitForState(
      page,
      'state.phase === "prep" || state.phase === "defeat"',
      90_000,
    );

    state = await getState(page);
    console.log(`No-defense result: phase=${state.phase}, baseHp=${state.baseHp}`);
    // Base should have taken at least 5 damage (5 grunts leaked)
    expect(state.baseHp).toBeLessThanOrEqual(95);

    await screenshotCanvas(page, 'wave-ended-no-towers');
  });
});
