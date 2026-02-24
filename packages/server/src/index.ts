import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameSimulation } from './game/GameSimulation.js';
import { GameLoop } from './game/GameLoop.js';
import { TICK_RATE } from '@td/shared';
import type { ClientCommand, DevCheatCommand } from '@td/shared';

const PORT = 3001;

// Create Express app and HTTP server
const app = express();
const httpServer = createServer(app);

// Create Socket.IO server with CORS
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Create game simulation instance (mutable — reset creates a fresh one)
let sim = GameSimulation.create('main-room');

// Start game loop
const gameLoop = new GameLoop((dt: number) => {
  sim.tick(dt);
  io.emit('snapshot', sim.state);
});

gameLoop.start();
console.log(`Game loop started at ${TICK_RATE}Hz`);

// Handle socket connections
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Dev-only: reset the game simulation (used by E2E tests)
  socket.on('reset_game', (ack: (result: { ok: boolean }) => void) => {
    console.log(`[reset] Game simulation reset by ${socket.id}`);
    sim = GameSimulation.create('main-room');
    if (typeof ack === 'function') ack({ ok: true });
  });

  // Dev-only: cheat commands for testing
  socket.on('dev_cheat', (cheat: DevCheatCommand, ack: (result: { ok: boolean; reason?: string }) => void) => {
    const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    const reject = (reason: string) => { if (typeof ack === 'function') ack({ ok: false, reason }); };

    switch (cheat.type) {
      case 'add_gold':
        if (!fin(cheat.amount)) return reject('invalid amount');
        sim.cheatAddGold(cheat.amount);
        break;
      case 'set_gold':
        if (!fin(cheat.amount)) return reject('invalid amount');
        sim.devSetGold(cheat.amount);
        break;
      case 'skip_prep':
        sim.devSkipPrep();
        break;
      case 'spawn_enemies':
        if (!fin(cheat.count) || cheat.count < 1 || cheat.count > 100) return reject('invalid count');
        sim.devSpawnEnemies(cheat.enemyType, cheat.count, cheat.hp, cheat.speed);
        break;
      case 'kill_all_enemies':
        sim.devKillAllEnemies();
        break;
      case 'set_phase':
        sim.devSetPhase(cheat.phase);
        break;
      case 'set_base_hp':
        if (!fin(cheat.hp) || cheat.hp < 0) return reject('invalid hp');
        sim.devSetBaseHp(cheat.hp);
        break;
      case 'set_wave':
        if (!fin(cheat.wave) || cheat.wave < 0) return reject('invalid wave');
        sim.devSetWave(cheat.wave);
        break;
      case 'god_mode':
        sim.devGodMode(cheat.enabled);
        break;
      case 'pause_prep_timer':
        sim.devPausePrepTimer(cheat.paused);
        break;
      default:
        return reject('unknown dev cheat type');
    }
    if (typeof ack === 'function') ack({ ok: true });
  });

  // Handle client commands — uses Socket.IO ack callback so client Promises resolve
  socket.on('command', (command: ClientCommand, ack: (result: { ok: boolean; reason?: string }) => void) => {
    try {
      let result: { ok: boolean; reason?: string } = { ok: false, reason: 'Unknown command' };

      switch (command.type) {
        case 'join_game':
          result = sim.addPlayer(socket.id, command.playerName);
          break;
        case 'select_class':
          result = sim.selectClass(socket.id, command.elementClass);
          break;
        case 'ready_up':
          result = sim.readyUp(socket.id);
          break;
        case 'place_tower':
          result = sim.placeTower(socket.id, command.configId, command.x, command.y);
          break;
        case 'upgrade_tower':
          result = { ok: false, reason: 'upgrade_tower not yet implemented' };
          break;
        case 'sell_tower':
          result = sim.sellTower(socket.id, command.instanceId);
          break;
        case 'start_wave':
          sim.startWave();
          result = { ok: true };
          break;
        case 'reconnect':
          result = { ok: false, reason: 'reconnect not yet implemented' };
          break;
        case 'chat':
          // Broadcast chat to all clients
          io.emit('chat', { playerId: socket.id, message: command.message });
          result = { ok: true };
          break;
        default:
          result = { ok: false, reason: `Unknown command type` };
      }

      if (typeof ack === 'function') ack(result);
    } catch (error) {
      console.error(`Error processing command from ${socket.id}:`, error);
      if (typeof ack === 'function') ack({ ok: false, reason: 'Internal error' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    sim.removePlayer(socket.id);
  });
});

// Start HTTP server
httpServer.listen(PORT, () => {
  console.log(`Tower Defense Server running on http://localhost:${PORT}`);
});