import {type CanvasRenderer, initCanvas} from '../render/canvas.ts'
import type { AudioAnalysis } from '../audio/audioProcessor'
import JSX from "src/jsx.ts";
import {DinoGame} from "src/games/dinoGame.ts";
import {Input} from "../input/input.ts";
import type {Audio} from "src/scenes/uploadScene.tsx";

// Implementation for the game screen
// This is the main screen where the game is played
// Note that the actual game logic is in the game classes themselves

// Helper: heuristic to decide whether to use fullscreen on start (mobile / small screens)
function shouldUseFullscreen(): boolean {
  const minSide = Math.min(window.innerWidth, window.innerHeight)
  const userAgent = navigator.userAgent || ''
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(userAgent)
  // Use fullscreen for small screens or mobile user agents
  return isMobileUA || minSide < 700
}

export async function initGameScreen(root: HTMLElement, audio: Audio) {
  const { ctx, buffer, analysis } = audio
  const fsOverlayBtn = <button class="btn" type="button">Enter Fullscreen to Resume</button> as HTMLButtonElement
  const fsOverlay = <div class="fs-overlay">{fsOverlayBtn}</div> as HTMLDivElement
  const gameRoot = <div class="game-root">
    {fsOverlay}
  </div> as HTMLDivElement
  root.replaceChildren(gameRoot)
  const useFs = shouldUseFullscreen()
  const controller = initCanvas(gameRoot)
  const { source, startTime } = startPlayback(ctx, buffer)
  const runtime = {
    audioCtx: ctx,
    source,
    startTime,
    analysis
  }
  controller.setRenderer(createGameRenderer(runtime))

  // Fullscreen change handler: show canvas when in fullscreen (on small devices),
  // hide canvas and show overlay when leaving fullscreen.
  function onFullscreenChange() {
    const inFs = !!document.fullscreenElement
    if (useFs) {
      if (inFs) {
        controller!.show()
        document.documentElement.classList.add('in-fullscreen')
        // attempt to lock to landscape where available
        try {
          if ((screen as any).orientation && (screen as any).orientation.lock) {
            ;(screen as any).orientation.lock('landscape').catch(() => {})
          }
        } catch { /* ignore */ }
        if (fsOverlay) {
          fsOverlay.classList.add('hidden')
        }
      } else {
        // user left fullscreen -> pause rendering and show overlay to re-enter
        controller!.hide()
        if (fsOverlay) {
          fsOverlay.classList.remove('hidden')
        }
      }
    } else {
      // Not using fullscreen: always show canvas
      controller!.show()
    }
  }

  document.addEventListener('fullscreenchange', onFullscreenChange)

  // Overlay button attempts to re-enter fullscreen
  fsOverlayBtn!.onclick = async () => {
    try {
      if (gameRoot && gameRoot.requestFullscreen) {
        await gameRoot.requestFullscreen()
      }
    } catch {
      // ignore errors
    }
  }

  if (useFs) {
    try {
      if (gameRoot && gameRoot.requestFullscreen) {
        await gameRoot.requestFullscreen()
      } else {
        controller.show()
      }
    } catch {
      controller.show()
    }
  } else {
    controller.show()
  }
}

export type GameRuntime = {
  audioCtx: AudioContext
  source: AudioBufferSourceNode
  startTime: number // audioCtx.currentTime at start()
  analysis: AudioAnalysis
}

export function startPlayback(ctx: AudioContext, buffer: AudioBuffer) {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  const startTime = ctx.currentTime
  source.start(startTime)
  return { source, startTime }
}

const games = [DinoGame]

export function createGameRenderer(runtime: GameRuntime): CanvasRenderer {
  let currentGame = -1

  let deadInfo: { active: boolean; waitingForRelease: boolean; releaseTimestamp: number; cooldownUntil: number } = {
    active: false,
    waitingForRelease: false,
    releaseTimestamp: 0,
    cooldownUntil: 0
  }

  function nextGame() {
    currentGame = (currentGame + 1) % games.length
    console.log(`Switching to game ${games[currentGame].id}`)
    if (games[currentGame].state != 'Finished') {
      throw new Error(`Game ${games[currentGame].id} is not finished`)
    }
    games[currentGame].init(runtime)
    if (games[currentGame].state != 'Initialized') {
      throw new Error(`Game ${games[currentGame].id} did not initialize`)
    }
    // reset dead-screen when switching/starting a game
    deadInfo.active = false
    deadInfo.waitingForRelease = false
    deadInfo.releaseTimestamp = 0
    deadInfo.cooldownUntil = 0
    console.log(`Game ${games[currentGame].id} initialized`)
  }

  nextGame()

  return {
    render(
      ctx: CanvasRenderingContext2D,
      _canvas2d: HTMLCanvasElement,
      cssW: number,
      cssH: number,
      timestamp: number,
      deltaTime: number,
    ): void {
      games[currentGame].render(ctx, cssW, cssH)
      switch (games[currentGame].state) {
        case 'Finished':
          nextGame()
          break
        case 'Dead':
          const sample = Input.sample()
          const y = sample[1]

          // Initialize dead-info on first frame we see Dead
          if (!deadInfo.active) {
            runtime.audioCtx.suspend()
            runtime.source.stop()
            deadInfo.active = true
            deadInfo.waitingForRelease = y > 0
            deadInfo.releaseTimestamp = timestamp
            deadInfo.cooldownUntil = timestamp + 3000
          }

          // Darken the screen
          ctx.fillStyle = 'rgba(255,0,0,0.3)'
          ctx.fillRect(0, 0, cssW, cssH)
          ctx.fillStyle = 'white'
          ctx.textAlign = 'center'
          ctx.font = '96px system-ui, sans-serif'
          ctx.fillText('Game Over', cssW / 2, cssH / 2 - 36)

          // Flow: wait for release (y<=0) -> start 3s cooldown -> accept up (y>0) to restart
          ctx.font = '28px system-ui, sans-serif'
          if (deadInfo.waitingForRelease) {
            // waiting for the user to release Up
            ctx.fillText('Release Up to start 3s timer to enable restart', cssW / 2, cssH / 2 + 8)
            if (y <= 0) {
              deadInfo.waitingForRelease = false
              deadInfo.releaseTimestamp = timestamp
              deadInfo.cooldownUntil = timestamp + 3000
            }
          } else if (timestamp < deadInfo.cooldownUntil) {
            const remaining = Math.ceil((deadInfo.cooldownUntil - timestamp) / 1000)
            ctx.fillText(`Ready in ${remaining}s…`, cssW / 2, cssH / 2 + 8)
          } else {
            ctx.fillText('Press Up to restart', cssW / 2, cssH / 2 + 8)
            if (y > 0) {
              // Restart the same game and restart audio
              deadInfo.active = false
              runtime.audioCtx.resume().then(() => {
                const { source, startTime } = startPlayback(runtime.audioCtx, runtime.source.buffer!)
                runtime.source = source
                runtime.startTime = startTime
                games[currentGame].init(runtime)
                runtime.source.start()
              })
            }
          }
           break
         default:
           throw new Error(`Unknown game state: ${games[currentGame].state}`)
         case 'Playing':
           games[currentGame].update(timestamp, deltaTime)
           // ensure deadInfo reset while playing
           deadInfo.active = false
           break
       }
     }
   }
 }
