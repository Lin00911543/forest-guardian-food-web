import Phaser from 'phaser';
import { gameConfig } from './game/config/game-config';
import './styles/main.css';

async function startGame(): Promise<void> {
  const font = new FontFace(
    'Huninn',
    `url(${import.meta.env.BASE_URL}assets/fonts/jf-openhuninn-2.1.ttf)`,
  );
  try {
    await font.load();
    document.fonts.add(font);
  } catch (error) {
    console.warn('Huninn font failed to load; starting with a system font.', error);
  }

  new Phaser.Game(gameConfig);
}

void startGame();
