import { type CanvasRenderer, initCanvas } from "../render/canvas";
import type { AudioAnalysis } from "../audio/audioProcessor";
import JSX from "src/jsx";
import { DinoGame } from "src/games/dinoGame";
import { MovementGame } from "../games/movementGame";
import { GuitarGame } from "../games/guitarGame";
import { Input } from "../input/input";
import type { Audio } from "src/scenes/uploadScene";
import { initWinScreen } from "src/scenes/winScene.tsx";

// Implementation for the game screen
// This is the main screen where the game is played
// Note that the actual game logic is in the game classes themselves

// Helper: heuristic to decide whether to use fullscreen on start (mobile / small screens)
function shouldUseFullscreen(): boolean {
  const minSide = Math.min(window.innerWidth, window.innerHeight);
  const userAgent = navigator.userAgent || "";
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(userAgent);
  // Use fullscreen for small screens or mobile user agents
  return isMobileUA || minSide < 700;
}

export async function initGameScreen(root: HTMLElement, audio: Audio) {
  const { ctx, buffer, analysis } = audio;
  const fsOverlayBtn = (
    <button class="btn" type="button">
      Enter Fullscreen to Resume
    </button>
  ) as HTMLButtonElement;
  const fsOverlay = (<div class="fs-overlay">{fsOverlayBtn}</div>) as HTMLDivElement;
  const gameRoot = (<div class="game-root">{fsOverlay}</div>) as HTMLDivElement;
  root.replaceChildren(gameRoot);
  const useFs = shouldUseFullscreen();
  const controller = initCanvas(gameRoot);
  const { source, startTime } = startPlayback(ctx, buffer);
  const runtime = {
    audioCtx: ctx,
    source,
    startTime,
    analysis,
    endTime: 0, // set in createGameRenderer() via nextGame()
  };
  controller.setRenderer(
    createGameRenderer(runtime, () => {
      controller.stop();
      initWinScreen(root);
    }),
  );

  // Fullscreen change handler: show canvas when in fullscreen (on small devices),
  // hide canvas and show overlay when leaving fullscreen.
  function onFullscreenChange() {
    const inFs = !!document.fullscreenElement;
    if (useFs) {
      if (inFs) {
        controller!.show();
        document.documentElement.classList.add("in-fullscreen");
        // attempt to lock to landscape where available
        try {
          if ((screen as any).orientation && (screen as any).orientation.lock) {
            (screen as any).orientation.lock("landscape").catch(() => {});
          }
        } catch {
          /* ignore */
        }
        if (fsOverlay) {
          fsOverlay.classList.add("hidden");
        }
      } else {
        // user left fullscreen -> pause rendering and show overlay to re-enter
        controller!.hide();
        if (fsOverlay) {
          fsOverlay.classList.remove("hidden");
        }
      }
    } else {
      // Not using fullscreen: always show canvas
      controller!.show();
    }
  }

  document.addEventListener("fullscreenchange", onFullscreenChange);

  // Overlay button attempts to re-enter fullscreen
  fsOverlayBtn!.onclick = async () => {
    try {
      if (gameRoot && gameRoot.requestFullscreen) {
        await gameRoot.requestFullscreen();
      }
    } catch {
      // ignore errors
    }
  };

  if (useFs) {
    try {
      if (gameRoot && gameRoot.requestFullscreen) {
        await gameRoot.requestFullscreen();
      } else {
        controller.show();
      }
    } catch {
      controller.show();
    }
  } else {
    controller.show();
  }
}

export type GameRuntime = {
  audioCtx: AudioContext;
  source: AudioBufferSourceNode;
  startTime: number; // audioCtx.currentTime at start()
  endTime: number; // audioCtx.currentTime when the minigame switches to Finished state
  analysis: AudioAnalysis;
};

export function startPlayback(ctx: AudioContext, buffer: AudioBuffer) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  const startTime = ctx.currentTime;
  source.start(startTime);
  return { source, startTime };
}

const games = [DinoGame, MovementGame, GuitarGame];

export function createGameRenderer(runtime: GameRuntime, onWin: () => void): CanvasRenderer {
  let currentGame = -1;
  let gameCount = -1;
  let isRestarting = false;

  let deadInfo: { active: boolean; waitingForRelease: boolean; releaseTimestamp: number; cooldownUntil: number } = {
    active: false,
    waitingForRelease: false,
    releaseTimestamp: 0,
    cooldownUntil: 0,
  };

  function nextGameDuration() {
    const desiredSeconds = 10;
    const bpm = Math.max(1, runtime.analysis?.bpm || 120);
    const secondsPerBeat = 60 / bpm;
    const beats = Math.max(1, Math.round(desiredSeconds / secondsPerBeat));
    return Math.min(runtime.source.buffer!.duration, (gameCount + 1) * beats * secondsPerBeat);
  }

  function nextGame() {
    currentGame = (currentGame + 1) % games.length;
    gameCount++;
    console.log(`Switching to game ${games[currentGame].id}`);
    if (games[currentGame].state != "Finished" && games[currentGame].state != "Dead") {
      throw new Error(`Game ${games[currentGame].id} is not finished`);
    }
    runtime.endTime = runtime.startTime + nextGameDuration();
    games[currentGame].init(runtime);
    if (games[currentGame].state != "Initialized") {
      throw new Error(`Game ${games[currentGame].id} did not initialize`);
    }
    // reset dead-screen when switching/starting a game
    deadInfo.active = false;
    deadInfo.waitingForRelease = false;
    deadInfo.releaseTimestamp = 0;
    deadInfo.cooldownUntil = 0;
    console.log(`Game ${games[currentGame].id} initialized`);
  }

  function restart() {
    console.log("Restarting game");
    isRestarting = true; // hack: fixes firefox
    runtime.audioCtx.resume().then(() => {
      const { source, startTime } = startPlayback(runtime.audioCtx, runtime.source.buffer!);
      runtime.source = source;
      runtime.startTime = startTime;
      currentGame = -1;
      gameCount = -1;
      nextGame();
      isRestarting = false;
      console.log("Game restarted");
    });
  }

  nextGame();

  return {
    render(ctx: CanvasRenderingContext2D, _canvas2d: HTMLCanvasElement, timestamp: number, deltaTime: number): void {
      if (isRestarting) return;
      games[currentGame].render(ctx);
      switch (games[currentGame].state) {
        case "Finished":
          if (runtime.audioCtx.currentTime <= runtime.startTime + runtime.source.buffer!.duration - 0.5) {
            // not yet finished, go to the next minigame
            nextGame();
          } else {
            // finished, player won the game
            onWin();
          }
          break;
        case "Dead":
          const sample = Input.sample();
          const y = sample[1];

          // Initialize dead-info on first frame we see Dead
          if (!deadInfo.active) {
            runtime.source.stop();
            runtime.source.disconnect();
            runtime.audioCtx.suspend().then(() => console.log("Audio suspended"));
            deadInfo.active = true;
            deadInfo.waitingForRelease = y > 0;
            deadInfo.releaseTimestamp = timestamp;
            deadInfo.cooldownUntil = timestamp + 3000;
          }

          // Darken the screen
          ctx.fillStyle = "rgba(255,0,0,0.3)";
          ctx.fillRect(-5, -5, 10, 10);
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.font = `1.8px system-ui, sans-serif`;
          ctx.fillText("Game Over", 0, -0.5);

          // Flow: wait for release (y<=0) -> start 3s cooldown -> accept up (y>0) to restart
          ctx.font = `0.45px system-ui, sans-serif`;
          if (deadInfo.waitingForRelease) {
            // waiting for the user to release Up
            ctx.fillText("Release Up to start 3s timer to enable restart", 0, 1);
            if (y <= 0) {
              deadInfo.waitingForRelease = false;
              deadInfo.releaseTimestamp = timestamp;
              deadInfo.cooldownUntil = timestamp + 3000;
            }
          } else if (timestamp < deadInfo.cooldownUntil) {
            const remaining = Math.ceil((deadInfo.cooldownUntil - timestamp) / 1000);
            ctx.fillText(`Ready in ${remaining}s…`, 0, 1);
          } else {
            ctx.fillText("Press Up to restart", 0, 1);
            if (y > 0) restart();
          }
          break;
        default:
          throw new Error(`Unknown game state: ${games[currentGame].state}`);
        case "Playing":
          games[currentGame].update(timestamp, deltaTime);
          // ensure deadInfo reset while playing
          deadInfo.active = false;
          break;
      }
    },
  };
}
