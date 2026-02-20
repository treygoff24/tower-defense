// packages/server/src/game/GameSimulation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation.js';

describe('GameSimulation — Phase Management', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = GameSimulation.create('test-room');
    sim.addPlayer('p1', 'Trey');
    sim.selectClass('p1', 'fire');
  });

  it('starts in lobby phase', () => {
    expect(sim.state.phase).toBe('lobby');
  });

  it('transitions to prep phase when game starts', () => {
    sim.readyUp('p1');
    sim.startGame();
    expect(sim.state.phase).toBe('prep');
  });

  it('grants starting gold on game start', () => {
    sim.readyUp('p1');
    sim.startGame();
    expect(sim.state.economy.gold).toBeGreaterThan(0);
  });

  it('counts down prep timer during prep phase', () => {
    sim.readyUp('p1');
    sim.startGame();
    const initialTime = sim.state.prepTimeRemaining;
    sim.tick(5.0);
    expect(sim.state.prepTimeRemaining).toBeCloseTo(initialTime - 5.0, 1);
  });

  it('auto-starts wave when prep timer expires', () => {
    sim.readyUp('p1');
    sim.startGame();
    // Exhaust prep timer
    sim.tick(31.0);
    expect(sim.state.phase).toBe('combat');
  });

  it('allows tower placement during prep phase', () => {
    sim.readyUp('p1');
    sim.startGame();
    // Zone A covers x:[1,2] y:[5,6,7] — (1,5) is valid
    const result = sim.placeTower('p1', 'arrow_tower', 1, 5);
    expect(result.ok).toBe(true);
  });

  it('rejects tower placement if cannot afford', () => {
    sim.readyUp('p1');
    sim.startGame();
    // Force-spend all gold
    (sim as any).economy.state.gold = 0;
    // Placement rejected due to insufficient gold before zone check
    const result = sim.placeTower('p1', 'arrow_tower', 1, 5);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/gold/i);
  });

  it('transitions to combat when wave starts explicitly', () => {
    sim.readyUp('p1');
    sim.startGame();
    sim.startWave();
    expect(sim.state.phase).toBe('combat');
  });
});
