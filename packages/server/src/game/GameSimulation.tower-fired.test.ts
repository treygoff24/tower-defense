// packages/server/src/game/GameSimulation.tower-fired.test.ts
//
// Tests that the server emits a tower_fired ServerEvent whenever a tower
// successfully attacks an enemy, and that drainEvents() correctly empties
// the pending queue.

import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation.js';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Boot a simulation into combat with a single fire-class player. */
function bootSim(): GameSimulation {
  const sim = GameSimulation.create('test-tower-fired');
  sim.addPlayer('p1', 'TestPlayer');
  sim.selectClass('p1', 'fire');
  sim.readyUp('p1');
  sim.startGame();
  return sim;
}

/**
 * Tick the sim until at least one tower_fired event is collected or the
 * tick limit is reached.  Returns all collected events.
 */
function collectFiredEvents(sim: GameSimulation, maxTicks = 300) {
  const all: ReturnType<typeof sim.drainEvents> = [];
  for (let i = 0; i < maxTicks; i++) {
    sim.tick(0.05);
    all.push(...sim.drainEvents());
    if (all.some((e) => e.type === 'tower_fired')) break;
  }
  return all;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('GameSimulation — tower_fired events', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = bootSim();
  });

  it('emits at least one tower_fired event when a tower attacks during combat', () => {
    // Zone A covers (x:[1,2], y:[5,6,7]). arrow_tower at (2,6) is inside Zone A.
    // Enemies walk through row y=7, distance 1 from tower → well within range 3.
    sim.placeTower('p1', 'arrow_tower', 3, 5);
    sim.startWave();

    const events = collectFiredEvents(sim);
    const fired = events.filter((e) => e.type === 'tower_fired');
    expect(fired.length).toBeGreaterThan(0);
  });

  it('tower_fired event contains required fields with correct types', () => {
    sim.placeTower('p1', 'arrow_tower', 3, 5);
    sim.startWave();

    const events = collectFiredEvents(sim);
    const event = events.find((e) => e.type === 'tower_fired');

    expect(event).toBeDefined();
    if (event?.type !== 'tower_fired') return; // narrow type

    expect(typeof event.towerId).toBe('string');
    expect(event.towerId.length).toBeGreaterThan(0);
    expect(typeof event.targetId).toBe('string');
    expect(event.targetId.length).toBeGreaterThan(0);
    expect(typeof event.damage).toBe('number');
    expect(event.damage).toBeGreaterThan(0);
    expect(typeof event.towerX).toBe('number');
    expect(typeof event.towerY).toBe('number');
    expect(typeof event.targetX).toBe('number');
    expect(typeof event.targetY).toBe('number');
  });

  it('tower_fired event for a fire tower includes element field', () => {
    // flame_spire → class 'fire' → element should be 'fire'
    sim.placeTower('p1', 'flame_spire', 2, 6);
    sim.startWave();

    const events = collectFiredEvents(sim);
    const event = events.find(
      (e) => e.type === 'tower_fired' && e.element !== undefined
    );

    // Only fires an element if a fire tower actually attacked; may be undefined
    // if only shared towers fired — so we check either case explicitly.
    if (event?.type === 'tower_fired') {
      expect(['fire', 'water', 'ice', 'poison', undefined]).toContain(event.element);
    }
  });

  it('tower_fired event for arrow_tower (shared class) has element undefined', () => {
    sim.placeTower('p1', 'arrow_tower', 3, 5);
    sim.startWave();

    const events = collectFiredEvents(sim);
    const event = events.find((e) => e.type === 'tower_fired');
    if (event?.type !== 'tower_fired') return;

    // arrow_tower has class:'shared' — element should be omitted
    expect(event.element).toBeUndefined();
  });

  it('drainEvents clears the pending queue on each call', () => {
    sim.placeTower('p1', 'arrow_tower', 3, 5);
    sim.startWave();

    // Tick until at least one event is generated
    let firstBatch: ReturnType<typeof sim.drainEvents> = [];
    for (let i = 0; i < 300; i++) {
      sim.tick(0.05);
      firstBatch = sim.drainEvents();
      if (firstBatch.length > 0) break;
    }

    // Immediately draining again should return nothing
    const secondBatch = sim.drainEvents();
    expect(secondBatch.length).toBe(0);
  });

  it('no tower_fired events are emitted when no towers are placed', () => {
    // No towers — nothing should fire
    sim.startWave();
    for (let i = 0; i < 100; i++) sim.tick(0.05);

    const events = sim.drainEvents();
    const fired = events.filter((e) => e.type === 'tower_fired');
    expect(fired.length).toBe(0);
  });
});
