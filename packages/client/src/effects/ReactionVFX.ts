import Phaser from 'phaser';
import type { ReactionType } from '@td/shared';

interface ReactionConfig {
  color: number;
  text: string;
  scale: number;
  duration: number;
  isBig: boolean;
}

const REACTION_CONFIGS: Record<ReactionType, ReactionConfig> = {
  vaporize: {
    color: 0x88ccff,
    text: 'VAPORIZE!',
    scale: 2,
    duration: 800,
    isBig: true,
  },
  melt: {
    color: 0xff8844,
    text: 'MELT!',
    scale: 1.5,
    duration: 600,
    isBig: false,
  },
  steam_burst: {
    color: 0xaaaaaa,
    text: 'STEAM BURST!',
    scale: 2.5,
    duration: 1000,
    isBig: true,
  },
  freeze: {
    color: 0x00ffff,
    text: 'FREEZE!',
    scale: 1.5,
    duration: 600,
    isBig: false,
  },
  shatter: {
    color: 0x88ccff,
    text: 'SHATTER!',
    scale: 2,
    duration: 700,
    isBig: true,
  },
  blight: {
    color: 0x44cc44,
    text: 'BLIGHT!',
    scale: 1.5,
    duration: 600,
    isBig: false,
  },
  frostburn: {
    color: 0xff44ff,
    text: 'FROSTBURN!',
    scale: 2,
    duration: 800,
    isBig: true,
  },
  conflagration: {
    color: 0xff2200,
    text: 'CONFLAGRATION!',
    scale: 3,
    duration: 1200,
    isBig: true,
  },
};

export class ReactionVFX {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
  }

  playReaction(reactionType: ReactionType, x: number, y: number, damage: number): void {
    const config = REACTION_CONFIGS[reactionType];
    if (!config) return;

    // Flash circle
    this.playFlashCircle(x, y, config.color, config.scale);

    // Floating text
    this.playFloatingText(x, y, config.text, config.color, config.duration);

    // Screen shake for big reactions
    if (config.isBig) {
      this.camera.shake(config.duration / 1000, 0.01);
    }

    // Particle burst
    this.playParticleBurst(x, y, config.color);
  }

  private playFlashCircle(x: number, y: number, color: number, scale: number): void {
    const circle = this.scene.add.circle(x, y, 30 * scale, color, 0.6) as Phaser.GameObjects.Shape;
    circle.setBlendMode(Phaser.BlendModes.ADD);
    circle.setDepth(100);

    this.scene.tweens.add({
      targets: circle,
      scale: 2 * scale,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        circle.destroy();
      },
    });
  }

  private playFloatingText(
    x: number,
    y: number,
    text: string,
    color: number,
    duration: number
  ): void {
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    const textObj = this.scene.add.text(x, y - 20, text, {
      fontSize: '20px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: colorHex,
      strokeThickness: 4,
    });
    textObj.setOrigin(0.5);
    textObj.setDepth(101);

    // Random slight horizontal offset for variety
    const offsetX = (Math.random() - 0.5) * 30;

    this.scene.tweens.add({
      targets: textObj,
      y: y - 60,
      x: x + offsetX,
      alpha: 0,
      duration: duration,
      ease: 'Power2',
      onComplete: () => {
        textObj.destroy();
      },
    });
  }

  private playParticleBurst(x: number, y: number, color: number): void {
    const particleCount = 12;
    const particles: Phaser.GameObjects.Shape[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 50 + Math.random() * 50;

      const particle = this.scene.add.circle(x, y, 3 + Math.random() * 3, color) as Phaser.GameObjects.Shape;
      particle.setBlendMode(Phaser.BlendModes.ADD);
      particle.setDepth(99);

      particles.push(particle);

      const targetX = x + Math.cos(angle) * speed;
      const targetY = y + Math.sin(angle) * speed;

      this.scene.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: 0,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        },
      });
    }
  }

  // Helper to trigger reactions from server events
  triggerFromEvent(reaction: ReactionType, x: number, y: number, damage: number): void {
    this.playReaction(reaction, x, y, damage);
  }
}
