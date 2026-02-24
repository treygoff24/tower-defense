import { describe, it, expect, vi } from 'vitest';
import { TILE_SIZE } from '@td/shared';
import { GameScene } from './GameScene';

describe('GameScene click handling', () => {
  it('uses pointer.button to detect right-click ping on pointerup', () => {
    const scene = Object.create(GameScene.prototype) as GameScene;
    const sendPing = vi.fn().mockResolvedValue(undefined);

    (scene as unknown as { currentPhase: string }).currentPhase = 'prep';
    (scene as unknown as { selectedTowerId: string | null }).selectedTowerId = null;
    (scene as unknown as { towers: Map<string, unknown> }).towers = new Map();
    (scene as unknown as { registry: { get: () => { sendPing: unknown } } }).registry = {
      get: () => ({ sendPing }),
    };
    const emit = vi.fn();
    (scene as unknown as { events: { emit: typeof emit } }).events = { emit };

    const pointer = {
      button: 2,
      rightButtonDown: vi.fn(() => false),
      getDistance: vi.fn(() => 2),
      worldX: TILE_SIZE * 3 + 7,
      worldY: TILE_SIZE * 4 + 5,
    } as unknown as Phaser.Input.Pointer;

    (scene as unknown as { handleTileClick: (pointer: Phaser.Input.Pointer) => void }).handleTileClick(pointer);

    expect(pointer.rightButtonDown).not.toHaveBeenCalled();
    expect(sendPing).toHaveBeenCalledWith(3, 4);
    expect(emit).not.toHaveBeenCalled();
  });

  it('disables tower base hand cursor while placing and restores it after deselect', () => {
    const scene = Object.create(GameScene.prototype) as GameScene;
    const setDefaultCursor = vi.fn();
    const baseA = { setInteractive: vi.fn().mockReturnThis() };
    const baseB = { setInteractive: vi.fn().mockReturnThis() };

    (scene as unknown as { input: { setDefaultCursor: typeof setDefaultCursor } }).input = { setDefaultCursor };
    (scene as unknown as { towers: Map<string, { base: { setInteractive: () => unknown } }> }).towers = new Map([
      ['a', { base: baseA }],
      ['b', { base: baseB }],
    ]);

    (scene as unknown as { handleTowerSelected: (configId: string) => void }).handleTowerSelected('arrow_tower');
    expect(setDefaultCursor).toHaveBeenCalledWith('crosshair');
    expect(baseA.setInteractive).toHaveBeenCalledWith({ useHandCursor: false });
    expect(baseB.setInteractive).toHaveBeenCalledWith({ useHandCursor: false });

    (scene as unknown as { handleTowerDeselected: () => void }).handleTowerDeselected();
    expect(setDefaultCursor).toHaveBeenCalledWith('auto');
    expect(baseA.setInteractive).toHaveBeenCalledWith({ useHandCursor: true });
    expect(baseB.setInteractive).toHaveBeenCalledWith({ useHandCursor: true });
  });
});
