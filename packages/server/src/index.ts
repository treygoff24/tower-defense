import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameSimulation } from './game/GameSimulation.js';
import { GameLoop } from './game/GameLoop.js';
import { TICK_RATE } from '@td/shared';
import type { ClientCommand } from '@td/shared';

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
  // Broadcast any pending server events (e.g. tower_fired) to all clients
  for (const event of sim.drainEvents()) {
    io.emit('event', event);
  }
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
  socket.on('dev_cheat', (cheat: { type: string; amount?: number }, ack: (result: { ok: boolean }) => void) => {
    if (cheat.type === 'add_gold') {
      sim.cheatAddGold(cheat.amount ?? 10000);
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
        case 'upgrade_tower': {
          const upgradeResult = sim.upgradeTower(socket.id, command.instanceId);
          if (upgradeResult.ok && upgradeResult.newTier !== undefined) {
            // Emit tower_upgraded ServerEvent to the requesting client
            socket.emit('event', {
              type: 'tower_upgraded',
              instanceId: command.instanceId,
              newTier: upgradeResult.newTier,
            } satisfies import('@td/shared').ServerEvent);
          }
          result = upgradeResult;
          break;
        }
        case 'sell_tower':
          result = sim.sellTower(socket.id, command.instanceId);
          break;
        case 'set_targeting':
          result = sim.setTargeting(socket.id, command.instanceId, command.mode);
          break;
        case 'start_wave':
          sim.startWave();
          result = { ok: true };
          break;
        case 'reconnect':
          result = { ok: false, reason: 'reconnect not yet implemented' };
          break;
        case 'chat': {
          const player = sim.state.players[socket.id];
          const playerName = player?.name ?? 'Unknown';
          io.emit('event', { type: 'chat_message', playerId: socket.id, playerName, message: command.message });
          result = { ok: true };
          break;
        }
        case 'ping': {
          io.emit('event', { type: 'ping_marker', playerId: socket.id, x: command.x, y: command.y });
          result = { ok: true };
          break;
        }
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