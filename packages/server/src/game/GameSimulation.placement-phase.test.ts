// packages/server/src/game/GameSimulation.placement-phase.test.ts
// Task 1C: Phase-gated tower placement tests
import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation.js';

/**
 * Helper: advance sim to prep phase (1 player, ready, game started)
 */
function setupPrep(): GameSimulation {
  const sim = GameSimulation.create('test-room');
  sim.addPlayer('p1', 'Trey');
  sim.selectClass('p1', 'fire');
  sim.readyUp('p1');
  sim.startGame();
  // Sanity check
  return sim;
}

/**
 * Helper: advance sim to combat phase
 */
function setupCombat(): GameSimulation {
  const sim = setupPrep();
  sim.startWave();
  return sim;
}

describe('GameSimulation — Phase-gated Tower Placement (Task 1C)', () => {
  // ─────────────────────────────────────────────────────────────────
  // Allowed phases
  // ─────────────────────────────────────────────────────────────────

  it('allows tower placement during prep phase', () => {
    const sim = setupPrep();
    expect(sim.state.phase).toBe('prep');
    const result = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(result.ok).toBe(true);
  });

  it('allows tower placement during combat phase', () => {
    const sim = setupCombat();
    expect(sim.state.phase).toBe('combat');
    const result = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(result.ok).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  // Rejected phases
  // ─────────────────────────────────────────────────────────────────

  it('rejects tower placement during lobby phase', () => {
    const sim = GameSimulation.create('test-room');
    sim.addPlayer('p1', 'Trey');
    sim.selectClass('p1', 'fire');
    // Do NOT call readyUp or startGame — stays in lobby
    expect(sim.state.phase).toBe('lobby');
    const result = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/phase/i);
  });

  it('rejects tower placement during victory phase', () => {
    const sim = setupPrep();
    // Force victory phase directly
    (sim as any).room.state.phase = 'victory';
    const result = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/phase/i);
  });

  it('rejects tower placement during defeat phase', () => {
    const sim = setupPrep();
    // Force defeat phase directly
    (sim as any).room.state.phase = 'defeat';
    const result = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/phase/i);
  });

  it('rejects tower placement during class_select phase', () => {
    const sim = GameSimulation.create('test-room');
    sim.addPlayer('p1', 'Trey');
    // Force class_select phase
    (sim as any).room.state.phase = 'class_select';
    const result = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/phase/i);
  });

  // ─────────────────────────────────────────────────────────────────
  // Gold check still applies during allowed phases
  // ─────────────────────────────────────────────────────────────────

  it('still rejects placement when insufficient gold during combat', () => {
    const sim = setupCombat();
    (sim as any).economy.state.gold = 0;
    const result = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/gold/i);
  });

  // ─────────────────────────────────────────────────────────────────
  // Regression: existing prep phase tests still pass
  // ─────────────────────────────────────────────────────────────────

  it('spends gold when tower placed during combat', () => {
    const sim = setupCombat();
    const goldBefore = sim.state.economy.gold;
    const result = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(result.ok).toBe(true);
    expect(sim.state.economy.gold).toBeLessThan(goldBefore);
  });
});
