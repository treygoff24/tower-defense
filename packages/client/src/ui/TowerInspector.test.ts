import { describe, it, expect, vi } from 'vitest';
import { TowerInspector } from './TowerInspector';

describe('TowerInspector spacing', () => {
  it('adds extra vertical spacing after description text', () => {
    const description = 'A patient sniper line of fire';
    const textCalls: Array<{ x: number; y: number; text: string; height: number }> = [];

    const scene = {
      add: {
        graphics: vi.fn(() => ({
          fillStyle: vi.fn().mockReturnThis(),
          fillRoundedRect: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          strokeRoundedRect: vi.fn().mockReturnThis(),
        })),
        text: vi.fn((x: number, y: number, text: string) => {
          const height = text === description ? 16 : 14;
          textCalls.push({ x, y, text, height });
          return {
            x,
            y,
            text,
            height,
            setOrigin: vi.fn().mockReturnThis(),
          };
        }),
        container: vi.fn(() => ({
          setScrollFactor: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          add: vi.fn(),
          destroy: vi.fn(),
          setScale: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
        })),
        rectangle: vi.fn(() => ({
          setOrigin: vi.fn().mockReturnThis(),
          setScrollFactor: vi.fn().mockReturnThis(),
        })),
        circle: vi.fn(() => ({
          setAlpha: vi.fn().mockReturnThis(),
          setScrollFactor: vi.fn().mockReturnThis(),
        })),
        image: vi.fn(() => ({
          setDisplaySize: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          setScale: vi.fn().mockReturnThis(),
        })),
      },
    } as any;

    const inspector = Object.create(TowerInspector.prototype) as TowerInspector;
    const container = {
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      add: vi.fn(),
      destroy: vi.fn(),
      setScale: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      x: 0,
      y: 0,
    };

    (inspector as any).scene = scene;
    (inspector as any).container = container;
    (inspector as any).opts = {
      instanceId: 'tower-1',
      configId: 'arrow_tower',
      tier: 1,
      refund: 10,
      gold: 20,
      targetingMode: 'first',
      ownerName: 'Unit test user',
      onSell: vi.fn(),
      onUpgrade: vi.fn(),
      onTargetingChange: vi.fn(),
      onDismiss: vi.fn(),
    };
    (inspector as any).config = {
      id: 'arrow_tower',
      name: 'Arrow Tower',
      description,
      costGold: 50,
      range: 3,
      damage: 12,
      attackPeriod: 1,
      splashRadius: 0,
      upgrades: [],
      class: 'fire',
    };
    (inspector as any).currentTargetingMode = 'first';

    (inspector as any).computeStats = vi.fn(() => ({
      damage: 12,
      range: 3,
      attackPeriodSec: 1,
      splashRadius: 0,
    }));
    (inspector as any).buildStatRows = vi.fn(() => []);
    (inspector as any).buildUpgradeButton = vi.fn(() => ({}));
    (inspector as any).buildSellButton = vi.fn(() => ({}));
    (inspector as any).buildTargetingSelector = vi.fn(() => ({}));
    (inspector as any).buildCloseButton = vi.fn(() => ({}));
    (inspector as any).makeSep = vi.fn(() => ({}));

    (inspector as any).buildPanel();

    const ownerCall = textCalls.find((entry) => entry.text.startsWith('👤 Owned by:'));
    expect(ownerCall).toBeDefined();

    // name: +12, cost row: +20, description starts at 64 => owner starts at 64 + 16 + 14.
    expect(ownerCall!.y).toBe(94);
  });
});
