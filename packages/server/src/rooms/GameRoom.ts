// packages/server/src/rooms/GameRoom.ts
import {
  GameState,
  PlayerState,
  ElementType,
  EconomyState,
  BASE_MAX_HP,
  MAX_PLAYERS,
} from '@td/shared';

interface CommandResult {
  ok: boolean;
  reason?: string;
}

export class GameRoom {
  readonly id: string;
  state: GameState;

  constructor(id: string) {
    this.id = id;
    this.state = {
      phase: 'lobby',
      wave: 0,
      maxWaves: 20,
      baseHp: BASE_MAX_HP,
      maxBaseHp: BASE_MAX_HP,
      gameSpeed: 1,
      economy: { gold: 0, lumber: 0 },
      players: {},
      towers: {},
      enemies: {},
      prepTimeRemaining: 0,
      tick: 0,
    };
  }

  addPlayer(id: string, name: string): CommandResult {
    if (Object.keys(this.state.players).length >= MAX_PLAYERS) {
      return { ok: false, reason: 'Room is full' };
    }
    if (this.state.players[id]) {
      return { ok: false, reason: 'Player already in room' };
    }
    this.state.players[id] = {
      id,
      name,
      elementClass: null,
      connected: true,
      ready: false,
    };
    return { ok: true };
  }

  removePlayer(id: string): void {
    delete this.state.players[id];
  }

  selectClass(playerId: string, elementClass: ElementType): CommandResult {
    const player = this.state.players[playerId];
    if (!player) return { ok: false, reason: 'Player not found' };
    player.elementClass = elementClass;
    return { ok: true };
  }

  readyUp(playerId: string): CommandResult {
    const player = this.state.players[playerId];
    if (!player) return { ok: false, reason: 'Player not found' };
    player.ready = true;

    if (this.state.phase === 'lobby') {
      this.state.phase = 'class_select';
    }

    return { ok: true };
  }

  get playerCount(): number {
    return Object.keys(this.state.players).length;
  }
}
