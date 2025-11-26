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

## Notes for evaluation

1. Idea: I use the canvas API for rendering, WebGL for post-processing, the gamepad and orientation APIs for input, the web audio API for processing and playback, and the File API for loading songs.
2. Code Quality: I use TypeScript for type safety and linting, as well as prettier for formatting.
   This should ensure uniform formatting.
   I used TSX for the HTML content which is not technically separated,
   but this makes the code a lot less messy.
3. Documentation: This README (specifically the section above) is intended to be an entry point. I have added comments to each major component to explain how they work and commented code where I deemed it helpful.
4. Technical sophistication: According to tokei, the project contains more than 2000 lines of code at the time of writing.
   I think the game engine and minigame implementations are sufficient to count here, even if the audio processing is not due to its origin (researching stackoverflow).
5. Responsive: The game supports various input methods and adjusts the gameplay to fit them.
   The main screen works well across devices and the canvas is scaled to fit the screen, including going into fullscreen on mobile to maximize its surface area.
