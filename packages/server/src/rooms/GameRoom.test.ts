// packages/server/src/rooms/GameRoom.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from './GameRoom';

describe('GameRoom', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom('test-room');
  });

  it('initializes with lobby phase', () => {
    expect(room.state.phase).toBe('lobby');
  });

  it('initializes with full base HP', () => {
    expect(room.state.baseHp).toBe(100);
    expect(room.state.maxBaseHp).toBe(100);
  });

  it('adds a player', () => {
    room.addPlayer('p1', 'Trey');
    expect(room.state.players['p1']).toBeDefined();
    expect(room.state.players['p1'].name).toBe('Trey');
    expect(room.state.players['p1'].elementClass).toBeNull();
  });

  it('rejects more than MAX_PLAYERS', () => {
    room.addPlayer('p1', 'Trey');
    room.addPlayer('p2', 'Matt');
    room.addPlayer('p3', 'Milk');
    room.addPlayer('p4', 'P4');
    const result = room.addPlayer('p5', 'P5');
    expect(result.ok).toBe(false);
  });

  it('removes a player', () => {
    room.addPlayer('p1', 'Trey');
    room.removePlayer('p1');
    expect(room.state.players['p1']).toBeUndefined();
  });

  it('assigns class to player', () => {
    room.addPlayer('p1', 'Trey');
    room.selectClass('p1', 'fire');
    expect(room.state.players['p1'].elementClass).toBe('fire');
  });

  it('transitions to class_select when host readies', () => {
    room.addPlayer('p1', 'Trey');
    room.readyUp('p1');
    expect(room.state.phase).toBe('class_select');
  });
});
