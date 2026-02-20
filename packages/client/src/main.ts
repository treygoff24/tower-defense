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

// Expose game globally for dev/debug navigation
(window as unknown as { __game: Phaser.Game }).__game = game;

// ── Debug keyboard shortcuts (dev only) ─────────────────────────────────────
// Ctrl+1 → LobbyScene, Ctrl+2 → ClassSelectScene
// Ctrl+3 → GameScene with mock state (visual testing)
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!e.ctrlKey) return;

  // Ctrl+3: GameScene with mock state for visual testing
  if (e.key === '3' && import.meta.env.DEV) {
    e.preventDefault();
    const scenes = ['BootScene', 'LobbyScene', 'ClassSelectScene', 'GameScene', 'HudScene'];
    scenes.forEach(k => {
      const s = game.scene.getScene(k);
      if (s && game.scene.isActive(k) && k !== 'GameScene' && k !== 'HudScene') game.scene.stop(k);
    });

    if (!game.scene.isActive('GameScene')) {
      game.scene.start('GameScene');
    }
    if (!game.scene.isActive('HudScene')) {
      game.scene.start('HudScene');
    }

    // Wait for scene to initialize, then fire mock state
    setTimeout(() => {
      const gameScene = game.scene.getScene('GameScene') as Phaser.Scene;
      if (gameScene && gameScene.events) {
        // Minimal valid GameState for visual testing
        const mockState = {
          phase: 'prep' as const,
          wave: 1,
          maxWaves: 20,
          baseHp: 100,
          maxBaseHp: 100,
          economy: { gold: 150, lumber: 0 },
          players: {},
          towers: {},
          enemies: {},
          prepTimeRemaining: 30,
          tick: 0,
        };
        gameScene.events.emit('sync-state', mockState);
        console.log('[debug] GameScene started with mock state (Ctrl+3)');
      }
    }, 100);
    return;
  }

  const sceneMap: Record<string, string> = {
    '1': 'LobbyScene',
    '2': 'ClassSelectScene',
  };
  const target = sceneMap[e.key];
  if (!target) return;
  e.preventDefault();
  const scenes = ['BootScene', 'LobbyScene', 'ClassSelectScene', 'GameScene', 'HudScene'];
  scenes.forEach(k => {
    const s = game.scene.getScene(k);
    if (s && game.scene.isActive(k) && k !== target) game.scene.stop(k);
  });
  if (!game.scene.isActive(target)) game.scene.start(target);
  console.log(`[debug] Switched to ${target}`);
});

// eslint-disable-next-line no-console
console.log('Tower Defense Client initialized', game);