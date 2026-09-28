import '@fontsource/anton/latin-400.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import '@fontsource/barlow-condensed/latin-900-italic.css';
import './style.css';
import { Game } from './core/Game.js';

const fill = document.getElementById('load-fill');
const text = document.getElementById('load-text');
const game = new Game(document.getElementById('app'));
window.__game = game;

// canvas labels (map names, signs) are drawn once, so wait for the webfonts first
const fontsReady = Promise.race([
  Promise.all(['800 20px "Barlow Condensed"', '900 italic 20px "Barlow Condensed"', '20px Anton'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
]).catch(() => {});

fontsReady.then(() => game
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
  }));
