import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameSimulation } from './game/GameSimulation.js';
import { GameLoop } from './game/GameLoop.js';
import { TICK_RATE } from '@td/shared';

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

// Create game simulation instance
const sim = GameSimulation.create('main-room');

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

  // Handle client commands
  socket.on('command', (command: { type: string; payload?: Record<string, unknown> }) => {
    try {
      let result: { ok: boolean; reason?: string } = { ok: false, reason: 'Unknown command' };

      switch (command.type) {
        case 'join_game': {
          const playerName = command.payload?.playerName as string;
          result = sim.addPlayer(socket.id, playerName);
          break;
        }
        case 'select_class': {
          const elementClass = command.payload?.elementClass as 'fire' | 'water' | 'ice' | 'poison';
          result = sim.selectClass(socket.id, elementClass);
          break;
        }
        case 'ready_up': {
          result = sim.readyUp(socket.id);
          break;
        }
        case 'place_tower': {
          const configId = command.payload?.configId as string;
          const x = command.payload?.x as number;
          const y = command.payload?.y as number;
          result = sim.placeTower(socket.id, configId, x, y);
          break;
        }
        case 'sell_tower': {
          const instanceId = command.payload?.instanceId as string;
          // sellTower returns { ok: boolean; goldRefund?: number; reason?: string }
          result = sim.sellTower(socket.id, instanceId);
          break;
        }
        case 'start_wave': {
          sim.startWave();
          result = { ok: true };
          break;
        }
        default:
          result = { ok: false, reason: `Unknown command type: ${command.type}` };
      }

      socket.emit('command_ack', result);
    } catch (error) {
      console.error(`Error processing command from ${socket.id}:`, error);
      socket.emit('command_ack', { ok: false, reason: 'Internal error' });
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