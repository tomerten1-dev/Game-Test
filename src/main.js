import './style.css';
import { Game } from './core/Game.js';

const fill = document.getElementById('load-fill');
const text = document.getElementById('load-text');
const game = new Game(document.getElementById('app'));
window.__game = game;

game
  .init((p, msg) => {
    fill.style.width = `${Math.round(p * 100)}%`;
    if (msg) text.textContent = msg;
  })
  .then(() => {
    document.getElementById('loading').classList.add('hide');
    game.start();
  })
  .catch((err) => {
    console.error(err);
    text.textContent = 'Failed to start: ' + err.message;
  });
