<p align="center">
  <a href="https://omegarusdev.github.io/lanista-simulator/">
    <img src="https://img.shields.io/badge/▶_PLAY_NOW-playable_in_browser-brightgreen?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Play Now" height="40" />
  </a>
</p>

<p align="center"><strong>No install.</strong> Works in the browser (desktop &amp; mobile).</p>

Roman lanista roguelite — thin season management plus a **raw WebGL2** procedural amphitheatre autobattler. Zero external art/audio assets; zero runtime deps beyond Vite/TS.

**Play online:** [omegarusdev.github.io/lanista-simulator](https://omegarusdev.github.io/lanista-simulator/)

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5299/lanista-simulator/` (Vite base path; port 5299 avoids colliding with other local games). Hard-refresh after pulls.

```bash
npm test
npm run typecheck
npm run build
```

## Flow

**Title:** Instant Match (one click) · New Season · Continue (if saved) · How to Play · Exit.  
**Instant Match:** Lab amphitheatre — 1v1/2v2/3v3, Match/Venatio — no career side effects.  
**Season:** Ludus hub → Munera board → slot Lineup → Fight → Aftermath → End Day. Heal, rest days, upkeep, virtus tiers. Armamentarium unlocks Armory (kit piece swaps on a live GL mannequin). Day 18 ends the season with a Grand Munus capstone. Destructive actions (New Season over a save, Release, Forfeit) ask for confirmation; `Esc` backs out of any menu.

## Controls

**Sandbox / Fight:** Wheel or pinch to dolly; drag to pan the arena plane; Shift+drag to orbit yaw/pitch. Click fighters to inspect.  
**Fight (lab):** Pause menu — Leave, Restart, Reroll, Mute; bottom chrome has speed + Pause.  
**Fight (career):** Pause menu — Leave (forfeit if early, with confirmation), Mute; Continue on result.  
Keys: `Space` fight, `Esc`/`P` pause (or clear inspect / back on menus), `Q` leave, `R`/`N` lab restart/reroll, `1`/`2`/`4` speed, `D` feel debug, `+/-` dolly. Full controls are in the in-game **How to Play** panel (title screen or pause menu).

**Armaturae:** Murmillo, Thraex, Retiarius, Secutor, Hoplomachus, Provocator, Dimachaerus, Scissor.

## Tech

Vite + TypeScript + **raw WebGL2** (`src/gl/`) — perspective amphitheatre camera, procedural sand/cavea/kit meshes, GL combat FX. DOM chrome for menus/HUD. Deterministic arena-plane sim unchanged. Deployed to GitHub Pages from `main` via Actions.
