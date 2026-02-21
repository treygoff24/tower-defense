// packages/client/src/networking/NetworkManager.ts
import { io, Socket } from 'socket.io-client';
import type { ClientCommand, GameState, ElementType } from '@td/shared';

type SnapshotCallback = (state: GameState) => void;

export class NetworkManager {
  private socket: Socket | null = null;
  private onSnapshot: SnapshotCallback | null = null;
  private serverUrl: string;

  constructor(serverUrl = 'http://localhost:3001') {
    this.serverUrl = serverUrl;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('Connected to server:', this.socket!.id);
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
        reject(err);
      });

      this.socket.on('snapshot', (state: GameState) => {
        this.onSnapshot?.(state);
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('Disconnected:', reason);
      });
    });
  }

  onGameSnapshot(callback: SnapshotCallback): void {
    this.onSnapshot = callback;
  }

  sendCommand(command: ClientCommand): Promise<{ ok: boolean; reason?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ ok: false, reason: 'Not connected' });
        return;
      }
      this.socket.emit('command', command, (response: { ok: boolean; reason?: string }) => {
        resolve(response);
      });
    });
  }

  async joinGame(playerName: string): Promise<{ ok: boolean; reason?: string }> {
    return this.sendCommand({ type: 'join_game', playerName });
  }

  async selectClass(elementClass: ElementType): Promise<{ ok: boolean; reason?: string }> {
    return this.sendCommand({ type: 'select_class', elementClass });
  }

  async readyUp(): Promise<{ ok: boolean; reason?: string }> {
    return this.sendCommand({ type: 'ready_up' });
  }

  async placeTower(configId: string, x: number, y: number): Promise<{ ok: boolean; reason?: string }> {
    return this.sendCommand({ type: 'place_tower', configId, x, y });
  }

  async sellTower(instanceId: string): Promise<{ ok: boolean; reason?: string; goldRefund?: number }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ ok: false, reason: 'Not connected' });
        return;
      }
      this.socket.emit(
        'command',
        { type: 'sell_tower', instanceId },
        (response: { ok: boolean; reason?: string; goldRefund?: number }) => {
          resolve(response);
        }
      );
    });
  }

  async startWave(): Promise<{ ok: boolean; reason?: string }> {
    return this.sendCommand({ type: 'start_wave' });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  get socketId(): string | undefined {
    return this.socket?.id;
  }
}