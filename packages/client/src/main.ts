import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LobbyScene } from './scenes/LobbyScene';
import { ClassSelectScene } from './scenes/ClassSelectScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scene: [BootScene, LobbyScene, ClassSelectScene, GameScene, HudScene],
};

const game = new Phaser.Game(config);
// eslint-disable-next-line no-console
console.log('Tower Defense Client initialized', game);
