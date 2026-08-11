import './ui/chrome-shell.css';
import './ui/chrome-screens.css';
import './ui/chrome-hud.css';
import './ui/chrome-practice.css';
import { App } from './app/app';
import { showGlFailBanner } from './shell/viewport';

function bootError(err: unknown): void {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error('[lanista] boot failed', err);
  const host = document.getElementById('chrome') ?? document.body;
  const pre = document.createElement('pre');
  pre.setAttribute('role', 'alert');
  pre.style.cssText =
    'margin:1.5rem;padding:1rem;white-space:pre-wrap;color:#e8dcc4;background:#1a2028;border:1px solid #b8954a;font:14px/1.4 ui-monospace,monospace';
  pre.textContent = `Lanista failed to start.\n\n${msg}`;
  host.replaceChildren(pre);
}

try {
  const app = new App();
  if (!app.hasGl) {
    const host = document.getElementById('chrome') ?? document.body;
    showGlFailBanner(host);
  }
  app.start();
} catch (err) {
  bootError(err);
}
