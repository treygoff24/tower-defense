// packages/server/src/integration/multiplayer.test.ts
// Socket.IO integration tests — real server + real client connections
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import express from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { GameSimulation } from '../game/GameSimulation.js';
import { GameLoop } from '../game/GameLoop.js';
import type { ClientCommand, GameState } from '@td/shared';

// ── Test server setup ──────────────────────────────────────────────
let httpServer: HttpServer;
let ioServer: IOServer;
let sim: GameSimulation;
let gameLoop: GameLoop;
let serverPort: number;

function createTestServer(): Promise<number> {
  return new Promise((resolve) => {
    const app = express();
    httpServer = createServer(app);
    ioServer = new IOServer(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    sim = GameSimulation.create('test-room');
    gameLoop = new GameLoop((dt: number) => {
      sim.tick(dt);
      ioServer.emit('snapshot', sim.state);
    });

    ioServer.on('connection', (socket) => {
      socket.on('command', (command: ClientCommand, ack: (r: any) => void) => {
        try {
          let result: any = { ok: false, reason: 'Unknown command' };
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
            case 'sell_tower':
              result = sim.sellTower(socket.id, command.instanceId);
              break;
            case 'start_wave':
              sim.startWave();
              result = { ok: true };
              break;
            case 'chat':
              ioServer.emit('event', { type: 'chat_message', playerId: socket.id, message: command.message });
              result = { ok: true };
              break;
            default:
              result = { ok: false, reason: 'Unknown command type' };
          }
          if (typeof ack === 'function') ack(result);
        } catch (error) {
          if (typeof ack === 'function') ack({ ok: false, reason: 'Internal error' });
        }
      });

      socket.on('disconnect', () => {
        sim.removePlayer(socket.id);
      });
    });

    // Listen on port 0 to get a random available port
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve(port);
    });
  });
}

// ── Client helper ──────────────────────────────────────────────────
function createClient(): ClientSocket {
  return ioClient(`http://localhost:${serverPort}`, {
    transports: ['websocket'],
    forceNew: true,
  });
}

function sendCommand(client: ClientSocket, command: ClientCommand): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    client.emit('command', command, (result: { ok: boolean; reason?: string }) => {
      resolve(result);
    });
  });
}

function waitForSnapshot(client: ClientSocket, timeoutMs = 3000): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Snapshot timeout')), timeoutMs);
    client.once('snapshot', (state: GameState) => {
      clearTimeout(timer);
      resolve(state);
    });
  });
}

function waitForConnection(client: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (client.connected) { resolve(); return; }
    client.on('connect', () => resolve());
    client.on('connect_error', (err) => reject(err));
  });
}

// ── Test lifecycle ─────────────────────────────────────────────────
const clients: ClientSocket[] = [];

function trackClient(client: ClientSocket): ClientSocket {
  clients.push(client);
  return client;
}

beforeEach(async () => {
  serverPort = await createTestServer();
  gameLoop.start();
});

afterEach(async () => {
  // Disconnect all tracked clients
  for (const c of clients) {
    if (c.connected) c.disconnect();
  }
  clients.length = 0;

  // Tear down server
  gameLoop.stop();
  ioServer?.close();
  await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
});

// ── Tests ──────────────────────────────────────────────────────────
describe('Multiplayer Socket.IO Integration', () => {
  it('client can connect to the server', async () => {
    const client = trackClient(createClient());
    await waitForConnection(client);
    expect(client.connected).toBe(true);
  });

  it('client receives snapshots after connecting', async () => {
    const client = trackClient(createClient());
    await waitForConnection(client);
    const state = await waitForSnapshot(client);
    expect(state).toBeDefined();
    expect(state.phase).toBeDefined();
  });

  it('player can join via command and appear in state', async () => {
    const client = trackClient(createClient());
    await waitForConnection(client);

    const result = await sendCommand(client, { type: 'join_game', playerName: 'Alice' });
    expect(result.ok).toBe(true);

    const state = await waitForSnapshot(client);
    const players = Object.values(state.players);
    expect(players.some((p) => p.name === 'Alice')).toBe(true);
  });

  it('multiple players can join the same game', async () => {
    const c1 = trackClient(createClient());
    const c2 = trackClient(createClient());
    await waitForConnection(c1);
    await waitForConnection(c2);

    const r1 = await sendCommand(c1, { type: 'join_game', playerName: 'Alice' });
    const r2 = await sendCommand(c2, { type: 'join_game', playerName: 'Bob' });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    const state = await waitForSnapshot(c1);
    const names = Object.values(state.players).map((p) => p.name);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('player can select a class', async () => {
    const client = trackClient(createClient());
    await waitForConnection(client);

    await sendCommand(client, { type: 'join_game', playerName: 'Alice' });
    const result = await sendCommand(client, { type: 'select_class', elementClass: 'fire' });
    expect(result.ok).toBe(true);

    const state = await waitForSnapshot(client);
    const player = Object.values(state.players).find((p) => p.name === 'Alice');
    expect(player?.elementClass).toBe('fire');
  });

  it('ready up transitions game phase', async () => {
    const client = trackClient(createClient());
    await waitForConnection(client);

    await sendCommand(client, { type: 'join_game', playerName: 'Alice' });
    await sendCommand(client, { type: 'select_class', elementClass: 'water' });
    const result = await sendCommand(client, { type: 'ready_up' });
    expect(result.ok).toBe(true);

    // After all players ready, game starts → prep phase
    const state = await waitForSnapshot(client);
    expect(['class_select', 'prep']).toContain(state.phase);
  });

  it('tower placement works during prep phase', async () => {
    const client = trackClient(createClient());
    await waitForConnection(client);

    await sendCommand(client, { type: 'join_game', playerName: 'Alice' });
    await sendCommand(client, { type: 'select_class', elementClass: 'fire' });
    await sendCommand(client, { type: 'ready_up' });

    // Wait for prep phase
    const prepState = await new Promise<GameState>((resolve) => {
      const handler = (s: GameState) => {
        if (s.phase === 'prep') { client.off('snapshot', handler); resolve(s); }
      };
      client.on('snapshot', handler);
    });
    expect(prepState.phase).toBe('prep');

    // Place a tower in build zone A (x:1, y:5)
    const result = await sendCommand(client, { type: 'place_tower', configId: 'arrow_tower', x: 1, y: 2 });
    expect(result.ok).toBe(true);

    // Verify tower appears in state
    const state = await waitForSnapshot(client);
    const towers = Object.values(state.towers);
    expect(towers.length).toBeGreaterThanOrEqual(1);
    expect(towers.some((t) => t.configId === 'arrow_tower')).toBe(true);
  });

  it('tower placement rejects invalid positions', async () => {
    const client = trackClient(createClient());
    await waitForConnection(client);

    await sendCommand(client, { type: 'join_game', playerName: 'Alice' });
    await sendCommand(client, { type: 'select_class', elementClass: 'ice' });
    await sendCommand(client, { type: 'ready_up' });

    // Wait for prep phase
    await new Promise<void>((resolve) => {
      const handler = (s: GameState) => {
        if (s.phase === 'prep') { client.off('snapshot', handler); resolve(); }
      };
      client.on('snapshot', handler);
    });

    // Try placing outside any build zone (0,0)
    const result = await sendCommand(client, { type: 'place_tower', configId: 'arrow_tower', x: 0, y: 0 });
    expect(result.ok).toBe(false);
  });

  it('starting a wave transitions to combat phase', async () => {
    const client = trackClient(createClient());
    await waitForConnection(client);

    await sendCommand(client, { type: 'join_game', playerName: 'Alice' });
    await sendCommand(client, { type: 'select_class', elementClass: 'poison' });
    await sendCommand(client, { type: 'ready_up' });

    // Wait for prep phase
    await new Promise<void>((resolve) => {
      const handler = (s: GameState) => {
        if (s.phase === 'prep') { client.off('snapshot', handler); resolve(); }
      };
      client.on('snapshot', handler);
    });

    const result = await sendCommand(client, { type: 'start_wave' });
    expect(result.ok).toBe(true);

    // Should transition to combat
    const state = await waitForSnapshot(client);
    expect(state.phase).toBe('combat');
    expect(state.wave).toBe(1);
  });

  it('enemies spawn during combat and appear in state', async () => {
    const client = trackClient(createClient());
    await waitForConnection(client);

    await sendCommand(client, { type: 'join_game', playerName: 'Alice' });
    await sendCommand(client, { type: 'select_class', elementClass: 'fire' });
    await sendCommand(client, { type: 'ready_up' });

    await new Promise<void>((resolve) => {
      const handler = (s: GameState) => {
        if (s.phase === 'prep') { client.off('snapshot', handler); resolve(); }
      };
      client.on('snapshot', handler);
    });

    await sendCommand(client, { type: 'start_wave' });

    // Wait for enemies to appear (they spawn based on elapsed time)
    const stateWithEnemies = await new Promise<GameState>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No enemies spawned within timeout')), 5_000);
      const handler = (s: GameState) => {
        if (Object.keys(s.enemies).length > 0) {
          client.off('snapshot', handler);
          clearTimeout(timer);
          resolve(s);
        }
      };
      client.on('snapshot', handler);
    });

    expect(Object.keys(stateWithEnemies.enemies).length).toBeGreaterThan(0);
  });

  it('player disconnection removes them from state', async () => {
    const c1 = trackClient(createClient());
    const c2 = trackClient(createClient());
    await waitForConnection(c1);
    await waitForConnection(c2);

    await sendCommand(c1, { type: 'join_game', playerName: 'Alice' });
    await sendCommand(c2, { type: 'join_game', playerName: 'Bob' });

    // Verify both present
    let state = await waitForSnapshot(c1);
    expect(Object.values(state.players).length).toBe(2);

    // Disconnect Bob
    c2.disconnect();

    // Wait for snapshot that reflects the disconnect
    const updated = await new Promise<GameState>((resolve) => {
      const handler = (s: GameState) => {
        if (Object.values(s.players).length === 1) {
          c1.off('snapshot', handler);
          resolve(s);
        }
      };
      c1.on('snapshot', handler);
    });

    const remaining = Object.values(updated.players);
    expect(remaining.length).toBe(1);
    expect(remaining[0].name).toBe('Alice');
  });

  it('chat messages broadcast to all clients', async () => {
    const c1 = trackClient(createClient());
    const c2 = trackClient(createClient());
    await waitForConnection(c1);
    await waitForConnection(c2);

    await sendCommand(c1, { type: 'join_game', playerName: 'Alice' });
    await sendCommand(c2, { type: 'join_game', playerName: 'Bob' });

    // Listen for chat on c2 — server emits 'event' with type 'chat_message'
    const chatPromise = new Promise<{ type: string; playerId: string; message: string }>((resolve) => {
      c2.on('event', (data) => {
        if (data.type === 'chat_message') resolve(data);
      });
    });

    // Send chat from c1
    await sendCommand(c1, { type: 'chat', message: 'Hello world!' });

    const chatMsg = await chatPromise;
    expect(chatMsg.message).toBe('Hello world!');
    expect(chatMsg.playerId).toBe(c1.id);
  });

  it('selling a tower refunds gold', async () => {
    const client = trackClient(createClient());
    await waitForConnection(client);

    await sendCommand(client, { type: 'join_game', playerName: 'Alice' });
    await sendCommand(client, { type: 'select_class', elementClass: 'fire' });
    await sendCommand(client, { type: 'ready_up' });

    await new Promise<void>((resolve) => {
      const handler = (s: GameState) => {
        if (s.phase === 'prep') { client.off('snapshot', handler); resolve(); }
      };
      client.on('snapshot', handler);
    });

    // Get gold before placement
    let state = await waitForSnapshot(client);
    const goldBefore = state.economy.gold;

    // Place arrow_tower (costs 50 gold)
    await sendCommand(client, { type: 'place_tower', configId: 'arrow_tower', x: 1, y: 2 });
    state = await waitForSnapshot(client);
    expect(state.economy.gold).toBe(goldBefore - 50);

    // Find the tower instance
    const towerId = Object.keys(state.towers)[0];
    expect(towerId).toBeDefined();

    // Sell it (50% refund = 25 gold)
    const sellResult = await sendCommand(client, { type: 'sell_tower', instanceId: towerId });
    expect(sellResult.ok).toBe(true);

    state = await waitForSnapshot(client);
    expect(state.economy.gold).toBe(goldBefore - 50 + 25);
    expect(Object.keys(state.towers).length).toBe(0);
  });
});
