import Phaser from 'phaser';
import type { EnemyState, EnemyStatus } from '@td/shared';
import { TILE_SIZE } from '@td/shared';

// ── Constants ─────────────────────────────────────────────────────────────────
const PW = 190; // panel width
const HP_BAR_W = PW - 28;
const HP_BAR_H = 8;
const INSPECTOR_DEPTH = 200;
const PANEL_OFFSET_Y = -110; // how far above the enemy sprite to anchor the panel

// ── Status display helpers ────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  burning: '🔥 Burning',
  soaked:  '💧 Soaked',
  frozen:  '❄ Frozen',
  cold:    '🌊 Cold',
  toxin:   '☠ Toxin',
};

const STATUS_COLORS: Record<string, string> = {
  burning: '#ff6633',
  soaked:  '#44aaff',
  frozen:  '#88ddff',
  cold:    '#aaccee',
  toxin:   '#66ee66',
};

function formatEnemyType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
export class EnemyInspector {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private dismissCallback: () => void;

  /** Enemy this inspector is tracking */
  readonly trackedEnemyId: string;

  // Elements that need per-frame updates
  private hpText!: Phaser.GameObjects.Text;
  private hpBarGraphics!: Phaser.GameObjects.Graphics;
  private hpBarLocalY: number = 0; // y coord within the container
  private maxHp: number;
  private dismissed = false;

  // Status text rows (rebuilt on update when statuses change)
  private statusTexts: Phaser.GameObjects.Text[] = [];
  private statusLocalY: number = 0;

  // ── Constructor ─────────────────────────────────────────────────────────────
  constructor(scene: Phaser.Scene, enemy: EnemyState, onDismiss: () => void) {
    this.scene = scene;
    this.dismissCallback = onDismiss;
    this.trackedEnemyId = enemy.instanceId;
    this.maxHp = enemy.maxHp;

    const wx = enemy.x * TILE_SIZE + TILE_SIZE / 2;
    const wy = enemy.y * TILE_SIZE + TILE_SIZE / 2;

    this.container = scene.add.container(wx, wy + PANEL_OFFSET_Y);
    this.container.setDepth(INSPECTOR_DEPTH);

    this.buildPanel(enemy);
    this.setupKeyboard();
    this.animateIn();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Call every frame from GameScene.update().
   * Moves panel to follow enemy, refreshes HP, auto-dismisses on death.
   */
  update(enemies: Record<string, EnemyState>): void {
    if (this.dismissed) return;

    const enemy = enemies[this.trackedEnemyId];

    // Auto-dismiss if enemy is dead or gone from state
    if (!enemy || !enemy.alive) {
      this.dismiss();
      return;
    }

    // Follow enemy in world space
    const wx = enemy.x * TILE_SIZE + TILE_SIZE / 2;
    const wy = enemy.y * TILE_SIZE + TILE_SIZE / 2;
    this.container.setPosition(wx, wy + PANEL_OFFSET_Y);

    // Refresh HP display
    this.hpText.setText(`HP: ${enemy.hp} / ${this.maxHp}`);
    this.redrawHpBar(enemy.hp, this.maxHp);
  }

  dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    this.dismissCallback();
  }

  destroy(): void {
    if (this.escKey) {
      this.escKey.removeAllListeners();
    }
    this.escKey = null;
    if (this.container.active) {
      this.container.destroy();
    }
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  // ── Panel construction ──────────────────────────────────────────────────────

  private buildPanel(enemy: EnemyState): void {
    const halfW = PW / 2;
    const items: Phaser.GameObjects.GameObject[] = [];
    let cy = 10;

    // ── Enemy type name ─────────────────────────────────────────────────────
    cy += 14;
    const nameText = this.scene.add
      .text(0, cy, formatEnemyType(enemy.type), {
        fontSize: '13px',
        fontFamily: '"Arial Black", Arial',
        color: '#ffdd88',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5);
    items.push(nameText);
    cy += 20;

    // ── Separator ────────────────────────────────────────────────────────────
    items.push(this.makeSep(halfW, cy));
    cy += 10;

    // ── HP label + bar ───────────────────────────────────────────────────────
    this.hpText = this.scene.add
      .text(0, cy, `HP: ${enemy.hp} / ${this.maxHp}`, {
        fontSize: '11px',
        fontFamily: 'Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5);
    items.push(this.hpText);
    cy += 14;

    // HP bar drawn in container-local coordinates
    this.hpBarLocalY = cy;
    this.hpBarGraphics = this.scene.add.graphics();
    this.redrawHpBar(enemy.hp, this.maxHp);
    items.push(this.hpBarGraphics);
    cy += HP_BAR_H + 6;

    // ── Separator ────────────────────────────────────────────────────────────
    cy += 4;
    items.push(this.makeSep(halfW, cy));
    cy += 10;

    // ── Stats ────────────────────────────────────────────────────────────────
    const statRows: Array<{ label: string; value: string }> = [
      { label: '💨 Speed', value: enemy.speed.toFixed(1) },
      { label: '🛡 Armor', value: enemy.armor.toFixed(0) },
    ];
    for (const row of statRows) {
      const lbl = this.scene.add
        .text(-halfW + 12, cy, row.label, {
          fontSize: '11px',
          fontFamily: 'Arial',
          color: '#aabbcc',
        })
        .setOrigin(0, 0.5);
      const val = this.scene.add
        .text(halfW - 12, cy, row.value, {
          fontSize: '11px',
          fontFamily: '"Arial Black", Arial',
          color: '#ffffff',
        })
        .setOrigin(1, 0.5);
      items.push(lbl, val);
      cy += 20;
    }

    // ── Active statuses ──────────────────────────────────────────────────────
    if (enemy.statuses.length > 0) {
      cy += 4;
      items.push(this.makeSep(halfW, cy));
      cy += 10;

      this.statusLocalY = cy;
      const statusItems = this.buildStatusTexts(enemy.statuses, cy);
      for (const t of statusItems) items.push(t);
      cy += enemy.statuses.length * 18;
    }

    cy += 12; // bottom padding

    // ── Background (inserted first so it renders behind everything) ──────────
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x080816, 0.93);
    bg.fillRoundedRect(-halfW, 0, PW, cy, 10);
    bg.lineStyle(2, 0xcc8844, 0.9);
    bg.strokeRoundedRect(-halfW, 0, PW, cy, 10);

    // ── Close (×) button ─────────────────────────────────────────────────────
    const closeBtn = this.buildCloseButton(halfW - 12, 12);
    items.push(closeBtn);

    this.container.add([bg, ...items]);
  }

  // ── HP bar (drawn in container-local coords) ──────────────────────────────

  private redrawHpBar(hp: number, maxHp: number): void {
    const g = this.hpBarGraphics;
    g.clear();

    const x = -HP_BAR_W / 2;
    const y = this.hpBarLocalY;
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

    // Background track
    g.fillStyle(0x000000, 0.6);
    g.fillRect(x - 1, y - 1, HP_BAR_W + 2, HP_BAR_H + 2);

    // Fill
    const color = ratio > 0.5 ? 0x44ee44 : ratio > 0.25 ? 0xeecc00 : 0xee2222;
    g.fillStyle(color, 1);
    g.fillRect(x, y, HP_BAR_W * ratio, HP_BAR_H);

    // Shine
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(x, y, HP_BAR_W * ratio, 2);
  }

  // ── Status rows ───────────────────────────────────────────────────────────

  private buildStatusTexts(
    statuses: EnemyStatus[],
    startY: number
  ): Phaser.GameObjects.Text[] {
    const texts: Phaser.GameObjects.Text[] = [];
    let cy = startY;
    for (const status of statuses) {
      const label = STATUS_LABELS[status.type] ?? status.type;
      const color = STATUS_COLORS[status.type] ?? '#ffffff';
      const durStr =
        status.remainingSec > 0
          ? ` (${status.remainingSec.toFixed(1)}s)`
          : '';
      const stackStr = status.stacks > 1 ? ` ×${status.stacks}` : '';
      const txt = this.scene.add
        .text(0, cy, `${label}${stackStr}${durStr}`, {
          fontSize: '10px',
          fontFamily: 'Arial',
          color,
          stroke: '#000000',
          strokeThickness: 1,
        })
        .setOrigin(0.5, 0.5);
      texts.push(txt);
      this.statusTexts.push(txt);
      cy += 18;
    }
    return texts;
  }

  // ── Separator ─────────────────────────────────────────────────────────────

  private makeSep(halfW: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.lineStyle(1, 0x886644, 0.5);
    g.lineBetween(-halfW + 10, y, halfW - 10, y);
    return g;
  }

  // ── Close button ─────────────────────────────────────────────────────────

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
    const label = this.scene.add
      .text(0, 0, '✕', { fontSize: '10px', color: '#ccaaaa' })
      .setOrigin(0.5, 0.5);
    const hit = this.scene.add
      .rectangle(0, 0, 18, 18, 0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => this.dismiss());
    c.add([gfx, label, hit]);
    return c;
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  private setupKeyboard(): void {
    if (!this.scene.input.keyboard) return;
    this.escKey = this.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC
    );
    this.escKey.on('down', () => this.dismiss());
  }

  // ── Entrance animation ────────────────────────────────────────────────────

  private animateIn(): void {
    this.container.setScale(0.8);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 140,
      ease: 'Back.Out',
    });
  }
}
