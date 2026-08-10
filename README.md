<p align="center">
  <a href="https://omegarusdev.github.io/lanista-simulator/">
    <img src="https://img.shields.io/badge/▶_PLAY_NOW-playable_in_browser-brightgreen?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Play Now" height="40" />
  </a>
</p>

<p align="center"><strong>No install.</strong> Works in the browser (desktop &amp; mobile).</p>

<p align="center"><sub>Offline shortcut: open <a href="PLAY.html"><code>PLAY.html</code></a> for local Lab / Pages links.</sub></p>

# Lanista Simulator

Roman lanista roguelite — thin season management plus Canvas2D autobattler. Zero external art/audio assets.

**Play online:** [omegarusdev.github.io/lanista-simulator](https://omegarusdev.github.io/lanista-simulator/)

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5299/lanista-simulator/` (Vite base path; port 5299 avoids colliding with other local games).

```bash
npm test
npm run typecheck
npm run build
```

## Flow

**Title:** Instant Match (one click) · New Season · Continue (if saved).  
**Instant Match:** Lab amphitheatre — 1v1/2v2/3v3, Match/Venatio — no career side effects.  
**Season:** Ludus hub → Munera board (class-gated classics + spectacles/melees up to 3v3) → slot Lineup → Fight → Aftermath → End Day (`economy.seasonDays`, currently 14). Heal, rest days, upkeep, virtus tiers. Insolvency or season end closes the run.

## Controls

**Sandbox:** Title back, Blue/Red picks, historical presets, Fight.  
**Fight (lab):** Pause menu — Leave, Restart, Reroll, Mute; bottom chrome has speed + Pause.  
**Fight (career):** Pause menu — Leave (forfeit if early), Mute; Continue on result.  
Keys: `Space` fight, `Esc`/`P` pause (or clear inspect), `Q` leave, `R`/`N` lab restart/reroll, `1`/`2`/`4` speed, `D` feel debug.

**Armaturae:** Murmillo, Thraex, Retiarius, Secutor, Hoplomachus, Provocator, Dimachaerus, Scissor.

## Tech

Vite + TypeScript + Canvas2D. Deployed to GitHub Pages from `main` via Actions.
