import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LobbyScene } from './scenes/LobbyScene';
import { ClassSelectScene } from './scenes/ClassSelectScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { GameClient } from './GameClient';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scene: [BootScene, LobbyScene, ClassSelectScene, GameScene, HudScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

// Initialize client after scenes are ready
game.events.once('ready', () => {
  const gameScene = game.scene.getScene('GameScene') as GameScene;
  const hudScene = game.scene.getScene('HudScene') as HudScene;

  const client = new GameClient();

  // Expose client globally for dev console debugging
  (window as unknown as { __gameClient: GameClient }).__gameClient = client;

  client.connect('Player').then(() => {
    client.bindScenes(gameScene, hudScene);
    console.log('Game client connected and bound to scenes');
  }).catch((err) => {
    console.error('Failed to connect:', err);
  });
});

// eslint-disable-next-line no-console
console.log('Tower Defense Client initialized', game);