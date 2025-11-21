import type { CanvasRenderer } from '../render/canvas.ts'
import type { AudioAnalysis } from '../audio/audioProcessor'
import type { InputDeviceInfo } from '../input/input.ts'
import {DebugGame} from "../games/debugGame.ts";

export type GameInput = {
  sample: () => [number, number]
  listDevices: () => InputDeviceInfo[]
  setActive: (id: string) => void
  getActiveId: () => string | null
}

export type GameRuntime = {
  audioCtx: AudioContext
  source: AudioBufferSourceNode
  startTime: number // audioCtx.currentTime at start()
  analysis: AudioAnalysis
  input: GameInput
}

export function startPlayback(ctx: AudioContext, buffer: AudioBuffer) {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  const startTime = ctx.currentTime
  source.start(startTime)
  return { source, startTime }
}

const games = [DebugGame]

export function createGameRenderer(runtime: GameRuntime): CanvasRenderer {
  let currentGame = -1
  let wasPlying = false

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
    wasPlying = true
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
          if (wasPlying) runtime.audioCtx.suspend()
          wasPlying = false
          ctx.fillStyle = 'rgba(255,0,0,0.3)'
          ctx.fillRect(0, 0, cssW, cssH)
          ctx.fillStyle = 'white'
          ctx.textAlign = 'center'
          ctx.font = '96px system-ui, sans-serif'
          ctx.fillText('Game Over', cssW / 2, cssH / 2)
          ctx.font = '48px system-ui, sans-serif'
          ctx.fillText('Press space to restart', cssW / 2, cssH / 2 + 48)
          break
        default:
          throw new Error(`Unknown game state: ${games[currentGame].state}`)
        case 'Playing':
          games[currentGame].update(timestamp, deltaTime)
          break
      }
    }
  }
}
