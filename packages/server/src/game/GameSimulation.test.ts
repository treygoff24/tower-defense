// packages/server/src/game/GameSimulation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation.js';

// ─────────────────────────────────────────────────────────────────
// sellTower phase guard tests  (Bug 2)
// ─────────────────────────────────────────────────────────────────
describe('GameSimulation — sellTower phase guard', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = GameSimulation.create('test-room-sell');
    sim.addPlayer('p1', 'Alice');
    sim.selectClass('p1', 'fire');
  });

  it('rejects sellTower during lobby phase', () => {
    // sim is in lobby — never called startGame()
    expect(sim.state.phase).toBe('lobby');
    const result = sim.sellTower('p1', 'tower_1');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not allowed/i);
  });

  it('rejects sellTower during victory phase', () => {
    sim.readyUp('p1');
    sim.startGame();
    // Force victory phase
    (sim as any).room.state.phase = 'victory';
    const result = sim.sellTower('p1', 'tower_1');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not allowed/i);
  });

  it('rejects sellTower during defeat phase', () => {
    sim.readyUp('p1');
    sim.startGame();
    // Force defeat phase
    (sim as any).room.state.phase = 'defeat';
    const result = sim.sellTower('p1', 'tower_1');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not allowed/i);
  });

  it('allows sellTower during prep phase', () => {
    sim.readyUp('p1');
    sim.startGame();
    expect(sim.state.phase).toBe('prep');
    // Place a tower first so we have something to sell
    const place = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(place.ok).toBe(true);
    const instanceId = Object.keys(sim.state.towers)[0];
    const result = sim.sellTower('p1', instanceId);
    expect(result.ok).toBe(true);
  });

  it('allows sellTower during combat phase', () => {
    sim.readyUp('p1');
    sim.startGame();
    // Place a tower in prep
    const place = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(place.ok).toBe(true);
    const instanceId = Object.keys(sim.state.towers)[0];
    // Advance to combat
    sim.startWave();
    expect(sim.state.phase).toBe('combat');
    const result = sim.sellTower('p1', instanceId);
    expect(result.ok).toBe(true);
  });
});

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
    const result = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(result.ok).toBe(true);
  });

  it('rejects tower placement if cannot afford', () => {
    sim.readyUp('p1');
    sim.startGame();
    // Force-spend all gold
    (sim as any).economy.state.gold = 0;
    // Placement rejected due to insufficient gold before zone check
    const result = sim.placeTower('p1', 'arrow_tower', 1, 2);
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

// ─────────────────────────────────────────────────────────────────
// wave_completed event emission  (Bug 8)
// ─────────────────────────────────────────────────────────────────
describe('GameSimulation — wave_completed event', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = GameSimulation.create('test-room-wave');
    sim.addPlayer('p1', 'Alice');
    sim.selectClass('p1', 'fire');
  });

  it('emits wave_completed event with correct goldReward when wave ends', () => {
    sim.readyUp('p1');
    sim.startGame();
    sim.startWave();

    // Clear any existing pending events
    sim.drainEvents();

    // Force spawn queue empty so the wave-complete check fires on next tick
    (sim as any).spawnQueue = [];

    // Tick once — triggers: spawnQueue empty + no alive enemies → wave complete
    sim.tick(0.016);

    const events = sim.drainEvents();
    const waveCompleted = events.find((e) => e.type === 'wave_completed');
    expect(waveCompleted).toBeDefined();
    if (waveCompleted && waveCompleted.type === 'wave_completed') {
      // Formula: (40 + 10 * wave) * playerCount; wave=1, playerCount=1
      expect(waveCompleted.goldReward).toBe(50);
      expect(waveCompleted.wave).toBe(1);
    }
  });
});
