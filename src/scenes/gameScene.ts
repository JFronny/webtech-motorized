import type { CanvasRenderer } from '../render/canvas.ts'
import type { AudioAnalysis } from '../audio/audioProcessor'

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

export function createGameRenderer(runtime: GameRuntime): CanvasRenderer {
  const { audioCtx, startTime, analysis } = runtime
  const frameSec = analysis.frameSize / analysis.sampleRate
  const fps = 1 / frameSec
  const peaks = analysis.peaks

  // Visual params
  const pixelsPerSecond = 360 // scroll speed; higher = faster leftwards
  const peakLineWidth = 2

  // Precompute style
  const gridColor = 'rgba(255,255,255,0.25)'
  const peakColor = 'rgba(100,200,255,0.95)'
  const nowColor = 'rgba(255,0,0,0.8)'
  const intensityColor = 'rgba(255,255,255,0.6)'

  return ({ ctx, cssW, cssH }) => {
    // Compute current playback time in seconds
    const nowSec = Math.max(0, audioCtx.currentTime - startTime)

    // Draw a baseline in the middle
    const midY = Math.round(cssH * 0.5)
    ctx.lineWidth = 1
    ctx.strokeStyle = gridColor
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(cssW, midY)
    ctx.stroke()

    // Draw intensity rolling graph (right-aligned to "now" at center x)
    const centerX = Math.round(cssW * 0.5)
    const secondsVisibleLeft = centerX / pixelsPerSecond
    const secondsVisibleRight = (cssW - centerX) / pixelsPerSecond
    const startTimeSec = Math.max(0, nowSec - secondsVisibleLeft)
    const endTimeSec = nowSec + secondsVisibleRight

    // Map time to intensity frame index
    function timeToIndex(t: number) { return Math.floor(t * fps) }

    const startIdx = Math.max(0, timeToIndex(startTimeSec))
    const endIdx = Math.min(analysis.intensities.length - 1, timeToIndex(endTimeSec))

    ctx.strokeStyle = intensityColor
    ctx.lineWidth = 2
    ctx.beginPath()
    let started = false
    for (let i = startIdx; i <= endIdx; i++) {
      const t = i / fps
      const x = Math.round(centerX + (t - nowSec) * pixelsPerSecond)
      const value = analysis.intensities[i]
      const amp = (cssH * 0.35) * value
      const y = midY - amp
      if (!started) { ctx.moveTo(x, y); started = true } else { ctx.lineTo(x, y) }
    }
    ctx.stroke()

    // Draw vertical lines for beat peaks that are in the visible window
    ctx.strokeStyle = peakColor
    ctx.lineWidth = peakLineWidth
    for (let i = 0; i < peaks.length; i++) {
      const t = peaks[i]
      if (t < startTimeSec || t > endTimeSec) continue
      const x = Math.round(centerX + (t - nowSec) * pixelsPerSecond) + 0.5 // crisp line
      ctx.beginPath()
      ctx.moveTo(x, midY - cssH * 0.4)
      ctx.lineTo(x, midY + cssH * 0.35)
      ctx.stroke()
    }

    // Center line
    ctx.strokeStyle = nowColor
    ctx.beginPath()
    ctx.moveTo(centerX, midY - cssH)
    ctx.lineTo(centerX, midY + cssH)
    ctx.stroke()

    // Render debug text
    ctx.fillStyle = 'white'
    ctx.font = '14px system-ui, sans-serif'
    const text = `t=${nowSec.toFixed(2)}s  bpm≈${analysis.bpm ?? 'n/a'}`
    ctx.fillText(text, 12, 20)
  }
}
