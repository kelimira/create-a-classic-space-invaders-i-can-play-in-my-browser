# Space Invaders

Classic Space Invaders in the browser. Vanilla JS + canvas, no build, no dependencies.

## Play
ES modules need http, not `file://`:

    python3 -m http.server 8000

Open http://localhost:8000. Left/Right or A/D move, Space fires, Enter starts/restarts. On touch devices use the on-screen buttons.

## Test
    npm test

Game logic (`src/game.js`) is pure and unit-tested with `node --test`; rendering and input are checked manually.
