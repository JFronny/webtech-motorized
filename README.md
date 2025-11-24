# Motorized

Motorized is a simple canvas-based rhythm game.
Given an arbitrary song, it does its best to generate a playable level consisting of several minigames.

## Building

- `npm install`
- `npm run build`

Then host the contents of the `dist` folder under the path `/webtech-motorized/` on a web server that supports HTTPS.

## Songs that work well:

- stolen dance (milky chance)
- evolution once again (big data)
- unglued (big data)
- lent (autoheart)
- hardware store (weird al)

## This repository

- no external (run-time) dependencies
- vite to bundle the project
- JSX (/TSX) support via custom glue code (no React!) - see `src/jsx.ts`, `src/external.d.ts` and the typescript config
- the repository is structured as follows:
  - `src/audio`: audio processing logic (independent of other modules)
  - `src/input`: basic abstract input system to allow the game to work with a keyboard, touch, device orientation, and (hopefully) a gamepad (I couldn't test this one)
  - `src/render`: rendering logic using canvas and (if available) WebGL for post-processing
  - `src/scenes`: the HTML pages that make up the game
  - `src/games`: the actual minigames
