import Phaser from 'phaser';
import { gameConfig } from './game/config/game-config';
import './styles/main.css';

async function startGame(): Promise<void> {
  const font = new FontFace('Huninn', 'url(/assets/fonts/jf-openhuninn-2.1.ttf)');
  await font.load();
  document.fonts.add(font);
  new Phaser.Game(gameConfig);
}

void startGame();
