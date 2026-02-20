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

  // Store client in registry so scenes can access it
  game.registry.set('gameClient', client);

  // Expose client globally for dev console debugging
  (window as unknown as { __gameClient: GameClient }).__gameClient = client;

  // Bind scenes immediately (connection happens after player joins)
  client.bindScenes(gameScene, hudScene);
  console.log('Game client initialized and bound to scenes');
});

// eslint-disable-next-line no-console
console.log('Tower Defense Client initialized', game);