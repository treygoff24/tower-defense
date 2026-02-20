import Phaser from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scene: [],
};

const game = new Phaser.Game(config);
// eslint-disable-next-line no-console
console.log('Tower Defense Client initialized', game);
