import Phaser from 'phaser';
import { TOWER_CONFIGS } from '@td/shared';
import type { TowerConfig, TowerUpgrade } from '@td/shared';

// ── Targeting mode (client-side only, not sent to server yet) ─────────────────
export type TargetingMode = 'first' | 'last' | 'strongest' | 'weakest' | 'closest';

const TARGETING_MODES: TargetingMode[] = ['first', 'last', 'strongest', 'weakest', 'closest'];

const TARGETING_LABELS: Record<TargetingMode, string> = {
  first:    '⬆ First',
  last:     '⬇ Last',
  strongest:'💪 Strongest',
  weakest:  '🩹 Weakest',
  closest:  '🎯 Closest',
};

// ── Options bag ───────────────────────────────────────────────────────────────
export interface TowerInspectorOptions {
  instanceId: string;
  configId: string;
  /** Current upgrade tier (1 = base, 2, 3 = max) */
  tier: number;
  /** Gold refund on sell */
  refund: number;
  /** Player's current gold (used to grey-out unaffordable upgrade) */
  gold: number;
  /** Initial targeting mode */
  targetingMode: TargetingMode;
  /** Name of the player who owns this tower */
  ownerName?: string;
  onSell: () => void;
  onUpgrade: () => void;
  onTargetingChange: (mode: TargetingMode) => void;
  onDismiss: () => void;
}

// ── Internal stat computation ─────────────────────────────────────────────────
interface ComputedStats {
  damage: number;
  range: number;
  attackPeriodSec: number;
  splashRadius?: number;
}

// ── Panel constants ───────────────────────────────────────────────────────────
const PW = 300; // panel width

// ─────────────────────────────────────────────────────────────────────────────
export class TowerInspector {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private opts: TowerInspectorOptions;
  private config: TowerConfig | undefined;
  private currentTargetingMode: TargetingMode;
  private targetingBtnText: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: TowerInspectorOptions) {
    this.scene = scene;
    this.opts = opts;
    this.config = TOWER_CONFIGS[opts.configId];
    this.currentTargetingMode = opts.targetingMode;

    this.container = scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(205);

    this.buildPanel();
    this.setupKeyboard();
    this.animateIn();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Panel construction (top-to-bottom layout from container origin)
  // ───────────────────────────────────────────────────────────────────────────

  private buildPanel(): void {
    const halfW = PW / 2;
    const items: Phaser.GameObjects.GameObject[] = [];
    let cy = 14; // vertical cursor (relative to container origin = panel top-center)

    // ── Tower name ──────────────────────────────────────────────────────────
    cy += 12;
    const nameText = this.scene.add
      .text(0, cy, this.config?.name ?? this.opts.configId, {
        fontSize: '22px',
        fontFamily: '"Arial Black", Arial',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5);
    items.push(nameText);
    cy += 20;

    // ── Tier stars ──────────────────────────────────────────────────────────
    const stars = '★'.repeat(this.opts.tier) + '☆'.repeat(Math.max(0, 3 - this.opts.tier));
    const tierText = this.scene.add
      .text(0, cy, stars, { fontSize: '18px', fontFamily: 'Arial', color: '#ffd700' })
      .setOrigin(0.5, 0.5);
    items.push(tierText);
    cy += 18;

    // ── Tower description ───────────────────────────────────────────────
    const description = this.config?.description ?? '';
    if (description.length > 0) {
      const descriptionText = this.scene.add
        .text(0, cy, description, {
          fontSize: '14px',
          fontFamily: 'Arial',
          color: '#ccccdd',
          align: 'center',
          wordWrap: {
            width: PW - 28,
            useAdvancedWrap: true,
          },
      })
      .setOrigin(0.5, 0);
      items.push(descriptionText);
      cy += descriptionText.height + 14;
    }

    // ── Owner ────────────────────────────────────────────────────────────────
    if (this.opts.ownerName) {
      const ownerText = this.scene.add
      .text(0, cy, `👤 Owned by: ${this.opts.ownerName}`, {
          fontSize: '15px',
          fontFamily: 'Arial',
          color: '#88ccff',
        })
        .setOrigin(0.5, 0.5);
      items.push(ownerText);
      cy += 18;
    }

    // ── Separator ───────────────────────────────────────────────────────────
    cy += 4;
    items.push(this.makeSep(halfW, cy));
    cy += 10;

    // ── Stats ───────────────────────────────────────────────────────────────
    const stats = this.computeStats();
    const rows = this.buildStatRows(stats);
    for (const row of rows) {
      const lbl = this.scene.add
      .text(-halfW + 14, cy, row.label, { fontSize: '16px', fontFamily: 'Arial', color: '#aabbcc' })
        .setOrigin(0, 0.5);
      const val = this.scene.add
        .text(halfW - 14, cy, row.value, {
          fontSize: '16px',
          fontFamily: '"Arial Black", Arial',
          color: '#ffffff',
        })
        .setOrigin(1, 0.5);
      items.push(lbl, val);
      cy += 28;
    }

    // ── Separator ───────────────────────────────────────────────────────────
    cy += 4;
    items.push(this.makeSep(halfW, cy));
    cy += 12;

    // ── Upgrade button (hidden at tier 3) ───────────────────────────────────
    if (this.opts.tier < 3) {
      const nextUpgrade = this.config?.upgrades.find((u) => u.tier === this.opts.tier + 1);
      const upgradeCost = nextUpgrade?.costGold ?? 0;
      const canAfford = this.opts.gold >= upgradeCost;
      items.push(this.buildUpgradeButton(cy, upgradeCost, nextUpgrade, canAfford));
      cy += 46;
    }

    // ── Sell button ─────────────────────────────────────────────────────────
    items.push(this.buildSellButton(cy, this.opts.refund));
    cy += 38;

    // ── Separator ───────────────────────────────────────────────────────────
    cy += 4;
    items.push(this.makeSep(halfW, cy));
    cy += 10;

    // ── Targeting selector ──────────────────────────────────────────────────
    items.push(this.buildTargetingSelector(cy));
    cy += 34;

    cy += 12; // bottom padding

    // ── Background (drawn first in container child list) ────────────────────
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a22, 0.95);
    bg.fillRoundedRect(-halfW, 0, PW, cy, 12);
    bg.lineStyle(2, 0x8866aa, 0.9);
    bg.strokeRoundedRect(-halfW, 0, PW, cy, 12);

    // Close (×) button top-right
    const closeBtn = this.buildCloseButton(halfW - 14, 14);
    items.push(closeBtn);

    this.container.add([bg, ...items]);
  }

  // ── Helpers for panel building ─────────────────────────────────────────────

  private makeSep(halfW: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.lineStyle(1, 0x6666aa, 0.5);
    g.lineBetween(-halfW + 10, y, halfW - 10, y);
    return g;
  }

  private buildCloseButton(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const gfx = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x553333 : 0x332222, 1);
      gfx.fillCircle(0, 0, 9);
      gfx.lineStyle(1, 0xaa6666, 0.9);
      gfx.strokeCircle(0, 0, 9);
    };
    draw(false);
    const label = this.scene.add.text(0, 0, '✕', { fontSize: '10px', color: '#ccaaaa' }).setOrigin(0.5, 0.5);
    const hit = this.scene.add.rectangle(0, 0, 18, 18, 0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => this.opts.onDismiss());
    c.add([gfx, label, hit]);
    return c;
  }

  private buildUpgradeButton(
    y: number,
    cost: number,
    upgrade: TowerUpgrade | undefined,
    canAfford: boolean
  ): Phaser.GameObjects.Container {
    const halfW = PW / 2;
    const btnW = PW - 20;
    const btnH = 38;
    const c = this.scene.add.container(0, y + btnH / 2);

    const gfx = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      gfx.clear();
      const fill = canAfford ? (hover ? 0x007700 : 0x005500) : 0x334433;
      gfx.fillStyle(fill, canAfford ? 1 : 0.55);
      gfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
      gfx.lineStyle(1, canAfford ? 0x44ff44 : 0x336633, 0.8);
      gfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
    };
    draw(false);

    // Build delta preview string
    let deltaStr = '';
    if (upgrade) {
      const parts: string[] = [];
      for (const [key, delta] of Object.entries(upgrade.deltas)) {
        if (key.startsWith('onHit')) continue;
        const statName =
          key === 'baseDamage' ? 'dmg'
          : key === 'range' ? 'rng'
          : key === 'attackPeriodSec' ? 'spd'
          : key === 'splashRadius' ? 'spl'
          : key;
        const formatted =
          typeof delta === 'string' && delta.startsWith('*')
            ? `${(parseFloat(delta.slice(1)) * 100).toFixed(0)}% ${statName}`
            : `${delta} ${statName}`;
        parts.push(formatted);
      }
      deltaStr = parts.slice(0, 3).join('  ');
    }

    const labelColor = canAfford ? '#88ff88' : '#446644';
    const label = this.scene.add
      .text(0, deltaStr ? -9 : 0, `⬆ Upgrade — 💰 ${cost}g`, {
        fontSize: '16px',
        fontFamily: '"Arial Black", Arial',
        color: labelColor,
      })
      .setOrigin(0.5, 0.5);

    const deltaLabel = this.scene.add
      .text(0, 9, deltaStr, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: canAfford ? '#aaffaa' : '#448844',
      })
      .setOrigin(0.5, 0.5);

    const hit = this.scene.add.rectangle(0, 0, btnW, btnH, 0, 0);
    if (canAfford) {
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => draw(true));
      hit.on('pointerout', () => draw(false));
      hit.on('pointerdown', () => this.opts.onUpgrade());
    }

    c.add([gfx, label, ...(deltaStr ? [deltaLabel] : []), hit]);
    return c;
  }

  private buildSellButton(y: number, refund: number): Phaser.GameObjects.Container {
    const btnW = PW - 20;
    const btnH = 30;
    const c = this.scene.add.container(0, y + btnH / 2);

    const gfx = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0xee4400 : 0xcc2200, 1);
      gfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
      gfx.lineStyle(1, 0xff6644, 0.8);
      gfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
    };
    draw(false);

    const label = this.scene.add
      .text(0, 0, `💰 Sell for ${refund}g`, {
        fontSize: '16px',
        fontFamily: '"Arial Black", Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5);

    const hit = this.scene.add
      .rectangle(0, 0, btnW, btnH, 0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => this.opts.onSell());

    c.add([gfx, label, hit]);
    return c;
  }

  private buildTargetingSelector(y: number): Phaser.GameObjects.Container {
    const halfW = PW / 2;
    const rowH = 26;
    const c = this.scene.add.container(0, y + rowH / 2);

    const lbl = this.scene.add
      .text(-halfW + 14, 0, 'Target:', { fontSize: '15px', fontFamily: 'Arial', color: '#aabbcc' })
      .setOrigin(0, 0.5);

    const btnW = 118;
    const gfx = this.scene.add.graphics();
    const bx = halfW - btnW / 2 - 6;
    const draw = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x445577 : 0x334455, 1);
      gfx.fillRoundedRect(bx - btnW / 2, -rowH / 2 + 2, btnW, rowH - 4, 4);
      gfx.lineStyle(1, 0x6688aa, 0.7);
      gfx.strokeRoundedRect(bx - btnW / 2, -rowH / 2 + 2, btnW, rowH - 4, 4);
    };
    draw(false);

    this.targetingBtnText = this.scene.add
      .text(bx, 0, TARGETING_LABELS[this.currentTargetingMode], {
        fontSize: '11px',
        fontFamily: '"Arial Black", Arial',
        color: '#88ccff',
      })
      .setOrigin(0.5, 0.5);

    const hit = this.scene.add
      .rectangle(bx, 0, btnW, rowH - 4, 0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => this.cycleTargetingMode());

    c.add([lbl, gfx, this.targetingBtnText, hit]);
    return c;
  }

  // ── Stat computation ──────────────────────────────────────────────────────

  private computeStats(): ComputedStats {
    const cfg = this.config;
    if (!cfg) return { damage: 0, range: 0, attackPeriodSec: 0 };

    let damage = cfg.baseDamage;
    let range = cfg.range;
    let attackPeriodSec = cfg.attackPeriodSec;
    let splashRadius = cfg.splashRadius;

    for (let t = 2; t <= this.opts.tier; t++) {
      const upg = cfg.upgrades.find((u) => u.tier === t);
      if (!upg) continue;
      for (const [key, delta] of Object.entries(upg.deltas)) {
        if (key === 'baseDamage') damage = this.applyDelta(damage, delta);
        else if (key === 'range') range = this.applyDelta(range, delta);
        else if (key === 'attackPeriodSec') attackPeriodSec = this.applyDelta(attackPeriodSec, delta);
        else if (key === 'splashRadius' && splashRadius !== undefined) {
          splashRadius = this.applyDelta(splashRadius, delta);
        }
      }
    }

    return { damage, range, attackPeriodSec, splashRadius };
  }

  private applyDelta(value: number, delta: string | number): number {
    if (typeof delta === 'number') return value + delta;
    if (delta.startsWith('*')) return value * (1 + parseFloat(delta.slice(1)));
    return value + parseFloat(delta);
  }

  private buildStatRows(stats: ComputedStats): Array<{ label: string; value: string }> {
    const rows: Array<{ label: string; value: string }> = [
      { label: '⚔ Damage', value: stats.damage.toFixed(0) },
      { label: '📏 Range', value: stats.range.toFixed(1) + ' tiles' },
    ];
    if (stats.attackPeriodSec > 0) {
      rows.push({ label: '⚡ Attack Speed', value: (1 / stats.attackPeriodSec).toFixed(2) + '/s' });
    }
    if (stats.splashRadius !== undefined) {
      rows.push({ label: '💥 Splash', value: stats.splashRadius.toFixed(1) + ' tiles' });
    }
    if (this.config?.onHit?.length) {
      const eff = this.config.onHit[0];
      if (eff.dps !== undefined) {
        rows.push({ label: '🔥 DoT DPS', value: eff.dps.toFixed(0) });
      } else if (eff.slowPercent !== undefined) {
        rows.push({ label: '❄ Slow', value: eff.slowPercent + '%' });
      } else if (eff.value !== undefined) {
        rows.push({ label: '↩ Pushback', value: eff.value + ' tiles' });
      }
    }
    return rows;
  }

  // ── Targeting cycling ─────────────────────────────────────────────────────

  private cycleTargetingMode(): void {
    const idx = TARGETING_MODES.indexOf(this.currentTargetingMode);
    this.currentTargetingMode = TARGETING_MODES[(idx + 1) % TARGETING_MODES.length];
    if (this.targetingBtnText) {
      this.targetingBtnText.setText(TARGETING_LABELS[this.currentTargetingMode]);
    }
    this.opts.onTargetingChange(this.currentTargetingMode);
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  private setupKeyboard(): void {
    if (!this.scene.input.keyboard) return;
    this.escKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on('down', () => this.opts.onDismiss());
  }

  // ── Animation ─────────────────────────────────────────────────────────────

  private animateIn(): void {
    this.container.setScale(0.85);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 150,
      ease: 'Back.Out',
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.escKey) {
      this.escKey.removeAllListeners();
      // Don't call destroy on the key — it's managed by the input plugin
    }
    this.escKey = null;
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /** Current targeting mode chosen by the user */
  getTargetingMode(): TargetingMode {
    return this.currentTargetingMode;
  }
}
