import type {AudioAnalysis} from "src/audio/audioProcessor.ts";
import type {Game, GameState, Rect} from "src/games/game.ts";
import type {GameRuntime} from "src/scenes/gameScene.tsx";
import {Input} from "src/input/input.ts";

type Obstacle = {
  t: number // audio time of obstacle (seconds)
  lane: 'low' | 'high'
}

function chooseObstacleLane(analysis: AudioAnalysis, t: number): 'low' | 'high' | 'none' {
  // Heuristic: look at local intensity around time t and decide
  const frameSec = analysis.frameSize / analysis.sampleRate
  const fps = 1 / frameSec
  const idx = Math.floor(t * fps)
  const start = Math.max(0, idx - 2)
  const end = Math.min(analysis.intensities.length - 1, idx + 2)
  let sum = 0
  let count = 0
  for (let i = start; i <= end; i++) {
    sum += analysis.intensities[i]
    count++
  }
  const avg = count ? (sum / count) : 0
  // thresholds chosen empirically; feel free to tweak
  if (avg > 0.40) return 'low'   // loud -> ground obstacle
  if (avg > 0.10) return 'high'  // quieter -> flying obstacle
  return 'none'
}

class DinoGameImpl implements Game {
  readonly id = 'dino'

  // Visual / game params (pixel-based constants kept for tuning, but converted to normalized space)
  private pixelsPerSecond = 360
  private playerWpx = 30
  private playerHpx = 40
  private obstacleWpx = 28
  private obstacleHpx = 36

  // Reference resolution used to convert pixel-tuned constants into normalized [0,1] units.
  // This keeps internal logic resolution-independent while preserving roughly the same feel.
  private readonly REF_W = 1280
  private readonly REF_H = 720

  // Derived normalized constants
  private normalizedSpeed = this.pixelsPerSecond / this.REF_W // fraction of width per second
  private playerW = this.playerWpx / this.REF_W
  private playerH = this.playerHpx / this.REF_H
  private obstacleW = this.obstacleWpx / this.REF_W
  private obstacleH = this.obstacleHpx / this.REF_H

  // Physics (converted to normalized vertical units per second^2 / per second)
  private gravity = -2000 / this.REF_H // normalized per second^2 (negative = pull down)
  private jumpV = 650 / this.REF_H // normalized units per second (upwards)

  // Runtime
  private audioCtx: AudioContext | undefined
  private startTime: number | undefined
  private analysis: AudioAnalysis | undefined
  private peaks: number[] | undefined
  private nextPeakIndex = 0

  // Game state (normalized units)
  private obstacles: Obstacle[] = []
  private playerY = 0 // vertical offset from floor in normalized height units (0 = on floor)
  private playerV = 0 // vertical velocity (normalized height units / s), positive = up
  private alive = true

  state: GameState = 'Finished'

  init(runtime: GameRuntime): void {
    this.audioCtx = runtime.audioCtx
    this.startTime = runtime.startTime
    this.analysis = runtime.analysis
    this.peaks = runtime.analysis.peaks
    // position nextPeakIndex at first future peak
    const now = Math.max(0, this.audioCtx!.currentTime - this.startTime!)
    this.nextPeakIndex = 0
    while (this.nextPeakIndex < this.peaks!.length && this.peaks![this.nextPeakIndex] < now) this.nextPeakIndex++

    this.obstacles = []
    this.playerY = 0
    this.playerV = 0
    this.alive = true

    this.state = 'Initialized'
  }

  // Normalized rectangle for the player
  private playerRectNorm(): Rect {
    const centerX = 0.5
    const midY = 0.5
    const playerX = centerX - 0.35 // left offset in normalized coords
    return { l: playerX, r: playerX + this.playerW, t: midY - this.playerH - this.playerY, b: midY - this.playerY }
  }

  // Normalized rectangle for an obstacle at time nowSec
  private obstacleRectNorm(ob: Obstacle, nowSec: number): Rect {
    const centerX = 0.5
    const x = centerX + (ob.t - nowSec) * this.normalizedSpeed
    const l = x
    const r = x + this.obstacleW
    const midY = 0.5
    let top = midY - this.obstacleH
    if (ob.lane === 'high') {
      const HIGH_OBS_OFFSET_MULT = 1.8
      top = midY - this.obstacleH - Math.max(0, this.playerH * HIGH_OBS_OFFSET_MULT)
    }
    const bottom = top + this.obstacleH
    return { l, r, t: top, b: bottom }
  }

  render(ctx: CanvasRenderingContext2D, cssW: number, cssH: number): void {
    if (this.state == 'Initialized') this.state = 'Playing'

    // Pixel-scale multipliers
    const pxW = cssW
    const pxH = cssH

    // Current audio time
    const nowSec = Math.max(0, this.audioCtx!.currentTime - this.startTime!)

    // Draw ground line in middle (using pixels)
    const midYpx = Math.round(pxH * 0.5)
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, midYpx)
    ctx.lineTo(pxW, midYpx)
    ctx.stroke()

    // Draw player using normalized rect scaled to pixels
    const p = this.playerRectNorm()
    const playerXpx = Math.round(p.l * pxW)
    const playerYpx = Math.round(p.t * pxH)
    const playerWpx = Math.round((p.r - p.l) * pxW)
    const playerHpx = Math.round((p.b - p.t) * pxH)
    ctx.fillStyle = 'white'
    ctx.fillRect(playerXpx, playerYpx, playerWpx, playerHpx)

    // Draw obstacles (compute normalized rects then scale)
    for (let ob of this.obstacles) {
      const r = this.obstacleRectNorm(ob, nowSec)
      const xpx = Math.round(r.l * pxW)
      const ypx = Math.round(r.t * pxH)
      const wpx = Math.round((r.r - r.l) * pxW)
      const hpx = Math.round((r.b - r.t) * pxH)
      ctx.fillRect(xpx, ypx, wpx, hpx)
    }
  }

  update(_timestamp: number, deltaTime: number): void {
    if (this.state !== 'Playing') return
    if (!this.audioCtx || !this.analysis || !this.peaks) return
    if (!this.alive) return

    const dt = deltaTime / 1000
    const nowSec = Math.max(0, this.audioCtx.currentTime - this.startTime!)

    // Input
    const sample = Input.sample()
    const up = sample[1]
    const down = -sample[1]

    // Jump if up pressed and player on ground
    if (up > 0.6 && this.playerY <= 0.001) {
      this.playerV = this.jumpV
      this.playerY = 0.0001 // mark as airborne
    }
    // If down pressed, instantly drop to floor
    if (down > 0.6) {
      this.playerY = 0
      this.playerV = 0
    }

    // Physics (normalized vertical units)
    this.playerV += this.gravity * dt
    this.playerY += this.playerV * dt
    if (this.playerY < 0) {
      this.playerY = 0
      this.playerV = 0
    }

    // Spawn obstacles based on peaks
    const spawnLead = 0.5 / this.normalizedSpeed + 0.05
    while (this.nextPeakIndex < this.peaks.length) {
      const peakT = this.peaks[this.nextPeakIndex]
      if (peakT < nowSec) { this.nextPeakIndex++; continue }
      if (peakT - nowSec > spawnLead) break
      // decide lane
      const lane = chooseObstacleLane(this.analysis, peakT)
      if (lane !== 'none') {
        this.obstacles.push({ t: peakT, lane })
      }
      this.nextPeakIndex++
    }

    // Remove obstacles that have passed far left
    this.obstacles = this.obstacles.filter(ob => {
      const r = this.obstacleRectNorm(ob, nowSec)
      return r.r > -0.2
    })

    // Collision detection using normalized rects
    const playerRect = this.playerRectNorm()
    for (let ob of this.obstacles) {
      const r = this.obstacleRectNorm(ob, nowSec)
      const collide = !(playerRect.r < r.l || playerRect.l > r.r || playerRect.b < r.t || playerRect.t > r.b)
      if (collide) {
        this.alive = false
        this.state = 'Dead'
        break
      }
    }
  }
}

export const DinoGame = new DinoGameImpl()
