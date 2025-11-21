import './style.css'
import { initCanvas, type CanvasController } from './render/canvas.ts'
import { initUploadScreen } from './scenes/uploadScene'
import { createGameRenderer, startPlayback, type GameRuntime } from './scenes/gameScene'
import { Input } from './input/input.ts'

const container = document.querySelector<HTMLDivElement>('#app')!
container.innerHTML = ''

// Helper: heuristic to decide whether to use fullscreen on start (mobile / small screens)
function shouldUseFullscreen(): boolean {
  const minSide = Math.min(window.innerWidth, window.innerHeight)
  const userAgent = navigator.userAgent || ''
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(userAgent)
  // Use fullscreen for small screens or mobile user agents
  return isMobileUA || minSide < 700
}

let controller: CanvasController | null = null
let gameRoot: HTMLDivElement | null = null
let fsOverlayBtn: HTMLButtonElement | null = null
let runtime: GameRuntime | null = null

// 1) Show upload screen; on success, switch to game scene
// Ensure input system is ready before showing upload (for device list)
Input.init()

initUploadScreen(container, async (ctx, buffer, analysis) => {
  // Build game root
  container.innerHTML = `
    <div id="game-root" class="game-root">
      <!-- canvas is appended here by initCanvas -->
      <div id="fsOverlay" class="fs-overlay hidden">
        <button id="enterFsBtn" type="button">Enter Fullscreen to Resume</button>
      </div>
    </div>
  `
  gameRoot = document.getElementById('game-root') as HTMLDivElement
  fsOverlayBtn = document.getElementById('enterFsBtn') as HTMLButtonElement

  const useFs = shouldUseFullscreen()

  controller = initCanvas(gameRoot)

  // Prepare renderer and playback
  const { source, startTime } = startPlayback(ctx, buffer)
  runtime = {
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
        if (document.getElementById('fsOverlay')) {
          document.getElementById('fsOverlay')!.classList.add('hidden')
        }
      } else {
        // user left fullscreen -> pause rendering and show overlay to re-enter
        controller!.hide()
        if (document.getElementById('fsOverlay')) {
          document.getElementById('fsOverlay')!.classList.remove('hidden')
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
})
