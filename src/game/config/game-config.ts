import Phaser from 'phaser';
import { ForestScene } from '../scenes/ForestScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1440,
  height: 900,
  backgroundColor: '#17382c',
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [ForestScene],
};
