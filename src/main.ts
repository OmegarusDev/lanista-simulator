import { App } from './app/app';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#game canvas not found');
}

const app = new App(canvas);
app.start();
