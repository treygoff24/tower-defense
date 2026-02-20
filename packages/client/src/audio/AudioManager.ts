export class AudioManager {
  private scene: Phaser.Scene | null = null;

  bind(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  playTowerPlace(): void {
    // will play sfx later
  }

  playTowerShoot(): void {
    // stub
  }

  playEnemyDeath(): void {
    // stub
  }

  playWaveStart(): void {
    // stub
  }

  playReaction(reactionId: string): void {
    // stub
  }

  playMusic(): void {
    // stub
  }

  stopMusic(): void {
    // stub
  }
}