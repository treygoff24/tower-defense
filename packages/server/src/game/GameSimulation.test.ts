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
// BUG-02: sellTower ownership check
// ─────────────────────────────────────────────────────────────────
describe('GameSimulation — sellTower ownership check', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = GameSimulation.create('test-room-sell-own');
    sim.addPlayer('p1', 'Alice');
    sim.addPlayer('p2', 'Bob');
    sim.selectClass('p1', 'fire');
    sim.selectClass('p2', 'ice');
    sim.readyUp('p1');
    sim.readyUp('p2');
    sim.startGame();
  });

  it('rejects sell when player2 tries to sell player1s tower', () => {
    const place = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(place.ok).toBe(true);
    const instanceId = Object.keys(sim.state.towers).find(
      id => sim.state.towers[id].ownerId === 'p1'
    )!;
    const result = sim.sellTower('p2', instanceId);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/do not own/i);
  });

  it('allows owner to sell their own tower', () => {
    const place = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(place.ok).toBe(true);
    const instanceId = Object.keys(sim.state.towers).find(
      id => sim.state.towers[id].ownerId === 'p1'
    )!;
    const result = sim.sellTower('p1', instanceId);
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// BUG-05: setTargeting ownership check
// ─────────────────────────────────────────────────────────────────
describe('GameSimulation — setTargeting ownership check', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = GameSimulation.create('test-room-target-own');
    sim.addPlayer('p1', 'Alice');
    sim.addPlayer('p2', 'Bob');
    sim.selectClass('p1', 'fire');
    sim.selectClass('p2', 'ice');
    sim.readyUp('p1');
    sim.readyUp('p2');
    sim.startGame();
  });

  it('rejects retarget when player2 tries to change player1s tower targeting', () => {
    const place = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(place.ok).toBe(true);
    const instanceId = Object.keys(sim.state.towers).find(
      id => sim.state.towers[id].ownerId === 'p1'
    )!;
    const result = sim.setTargeting('p2', instanceId, 'first');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/do not own/i);
  });

  it('allows owner to change their own tower targeting', () => {
    const place = sim.placeTower('p1', 'arrow_tower', 1, 2);
    expect(place.ok).toBe(true);
    const instanceId = Object.keys(sim.state.towers).find(
      id => sim.state.towers[id].ownerId === 'p1'
    )!;
    const result = sim.setTargeting('p1', instanceId, 'first');
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// BUG-23: startWave phase guard
// ─────────────────────────────────────────────────────────────────
describe('GameSimulation — startWave phase guard', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = GameSimulation.create('test-room-wave-guard');
    sim.addPlayer('p1', 'Alice');
    sim.selectClass('p1', 'fire');
  });

  it('does nothing when startWave called during lobby phase', () => {
    expect(sim.state.phase).toBe('lobby');
    sim.startWave();
    expect(sim.state.phase).toBe('lobby');
  });

  it('does nothing when startWave called during combat phase', () => {
    sim.readyUp('p1');
    sim.startGame();
    sim.startWave(); // advances to combat
    expect(sim.state.phase).toBe('combat');
    const waveAfterFirst = sim.state.wave;
    sim.startWave(); // should be ignored (already in combat)
    expect(sim.state.phase).toBe('combat');
    expect(sim.state.wave).toBe(waveAfterFirst);
  });

  it('does nothing when startWave called during victory phase', () => {
    sim.readyUp('p1');
    sim.startGame();
    (sim as any).room.state.phase = 'victory';
    const waveBefore = sim.state.wave;
    sim.startWave();
    expect(sim.state.phase).toBe('victory');
    expect(sim.state.wave).toBe(waveBefore);
  });
});
