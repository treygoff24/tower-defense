import { describe, it, expect, vi } from 'vitest';
import { TowerPanel } from './TowerPanel';

function makeInteractiveMock(): { setInteractive: any; setScale: any; setAlpha: any; setOrigin: any; on: any } {
  const obj: Record<string, any> = {
    setOrigin: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  };
  return obj as any;
}

describe('TowerPanel tooltip spacing', () => {
  it('positions tower name, cost, and range text with increased vertical offsets', () => {
    const addCalls: Array<{ x: number; y: number; text: string }> = [];
    const scene = {
      textures: {
        exists: vi.fn(() => false),
      },
      add: {
        graphics: vi.fn(() => ({
          clear: vi.fn().mockReturnThis(),
          fillStyle: vi.fn().mockReturnThis(),
          fillRoundedRect: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          strokeRoundedRect: vi.fn().mockReturnThis(),
        })),
        image: vi.fn(() => ({
          setScale: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
        })),
        sprite: vi.fn(() => ({
          setScale: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
        })),
        rectangle: vi.fn(() => ({
          ...makeInteractiveMock(),
          setDepth: vi.fn().mockReturnThis(),
          setStrokeStyle: vi.fn().mockReturnThis(),
        })),
        circle: vi.fn(() => ({
          ...makeInteractiveMock(),
          setDepth: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
        })),
        text: vi.fn((x: number, y: number, text: string) => {
          addCalls.push({ x, y, text });
          return {
            x,
            y,
            text,
            setOrigin: vi.fn().mockReturnThis(),
          };
        }),
      },
    } as any;

    const panel = Object.create(TowerPanel.prototype) as TowerPanel;
    const listContainer = { add: vi.fn() };

    (panel as any).scene = scene;
    (panel as any).container = listContainer;
    (panel as any).currentGold = 100;
    (panel as any).selectedTower = null;
    (panel as any).tooltip = {
      setContent: vi.fn(),
      showAt: vi.fn(),
      hide: vi.fn(),
    };

    const config = {
      id: 'arrow_tower',
      name: 'Arrow Tower',
      class: 'fire',
      costGold: 50,
      range: 3,
    } as any;

    const item = (panel as any).createTowerListItem(config, true, { add: vi.fn() });

    expect((item as any).nameText.y).toBe(-22);
    expect((item as any).costText.y).toBe(0);
    expect((item as any).rangeText.y).toBe(22);
    expect(addCalls.some((entry) => entry.text.includes('Tower'))) 
      .toBe(true);
  });
});
