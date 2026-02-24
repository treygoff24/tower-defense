import { describe, it, expect, vi } from 'vitest';
import { HudScene } from './HudScene';

describe('HudScene wave preview interaction', () => {
  it('adds a panel hitbox that stops pointerdown propagation', () => {
    const scene = Object.create(HudScene.prototype) as HudScene;
    const children: any[] = [];
    const rects: any[] = [];
    const graphics: any[] = [];
    const textObjs: any[] = [];

    const container = {
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      add: vi.fn((child: any) => {
        if (Array.isArray(child)) {
          child.forEach((entry) => children.push(entry));
        } else {
          children.push(child);
        }
        return container;
      }),
      destroy: vi.fn(),
    };

    const createGraphics = () => {
      const obj = {
        fillStyle: vi.fn().mockReturnThis(),
        fillRoundedRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRoundedRect: vi.fn().mockReturnThis(),
      };
      graphics.push(obj);
      return obj;
    };

    const createRectangle = (x: number, y: number, width: number, height: number) => {
      const handlers: Record<string, (...args: unknown[]) => void> = {};
      const interactive = {
        setInteractive: vi.fn().mockReturnThis(),
        on: vi.fn((evt: string, cb: (...args: unknown[]) => void) => {
          handlers[evt] = cb;
          return obj;
        }),
      };
      const obj = {
        x,
        y,
        width,
        height,
        handlers,
        ...interactive,
      };
      rects.push(obj);
      return obj;
    };

    const createText = (x: number, y: number, text: string) => {
      const obj = {
        x,
        y,
        text,
        setOrigin: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setColor: vi.fn().mockReturnThis(),
      };
      textObjs.push(obj);
      return obj;
    };

    scene.cameras = { main: { width: 900, height: 620 } } as any;
    scene.currentWaveNum = 1;
    scene.add = {
      container: vi.fn(() => container),
      rectangle: vi.fn((x: number, y: number, width: number, height: number) => createRectangle(x, y, width, height)),
      graphics: vi.fn(createGraphics),
      text: vi.fn(createText),
    } as any;

    (scene as any).toggleWavePreview();

    const panelW = Math.min(760, 900 - 64);
    const panelHit = rects.find((rect) => rect.width === panelW);
    expect(panelHit).toBeDefined();

    const panelBg = graphics[0];
    const title = textObjs.find((txt) => txt.text === '📋 Wave Preview');
    expect(children.indexOf(panelHit)).toBeGreaterThan(children.indexOf(panelBg));
    expect(children.indexOf(panelHit)).toBeLessThan(children.indexOf(title));

    const evt = { stopPropagation: vi.fn() };
    panelHit!.handlers.pointerdown({}, 0, 0, evt as unknown as Phaser.Types.Input.EventData);
    expect(evt.stopPropagation).toHaveBeenCalledTimes(1);
  });
});
