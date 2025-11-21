// Thanks to https://dsp.stackexchange.com/questions/9521/simple-beat-detection-algorithm-for-microcontroller

import {dwtHaarLevels} from "./dwt.ts";
import {meanRemove, movingAverage, normalize, toMono} from "./util.ts";

export type AudioAnalysis = {
  sampleRate: number
  duration: number
  intensities: number[] // normalized 0..1 per frame
  frameSize: number // samples per frame used for intensities
  peaks: number[] // seconds of detected beat-like peaks
  bpm: number | null
}

function rms(data: Float32Array, start: number, end: number): number {
  let sum = 0
  for (let i = start; i < end; i++) {
    const v = data[i] || 0
    sum += v * v
  }
  return Math.sqrt(sum / Math.max(1, end - start))
}

function getIntensities(data: Float32Array, frameSize: number): number[] {
  const intensities: number[] = []
  for (let start = 0; start < data.length; start += frameSize) {
    const end = Math.min(data.length, start + frameSize)
    intensities.push(rms(data, start, end))
  }
  return intensities
}

function resampleLinear(src: Float32Array, inRate: number, outRate: number): Float32Array {
  if (src.length === 0) return new Float32Array(0)
  const duration = src.length / inRate
  const outLen = Math.max(1, Math.round(duration * outRate))
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const t = i / outRate
    const x = t * inRate
    const i0 = Math.floor(x)
    const i1 = Math.min(src.length - 1, i0 + 1)
    const frac = x - i0
    out[i] = (1 - frac) * src[Math.min(i0, src.length - 1)] + frac * src[i1]
  }
  return out
}

function envelopeFromBand(band: Float32Array, bandRate: number, targetRate: number): Float32Array {
  if (band.length === 0) return new Float32Array(0)
  // Full-wave rectification
  const rect = new Float32Array(band.length)
  for (let i = 0; i < band.length; i++) rect[i] = Math.abs(band[i])
  // Low-pass filter via short moving average at band rate (~30 ms)
  const lpWin = Math.max(1, Math.round(0.03 * bandRate))
  const smoothed = movingAverage(rect, lpWin)
  // Downsample / resample to target envelope rate
  const down = resampleLinear(smoothed, bandRate, targetRate)
  // Mean removal
  const meanRemoved = meanRemove(down)
  // Additional 100 ms smoothing window at envelope rate
  return movingAverage(meanRemoved, Math.max(1, Math.round(0.1 * targetRate)))
}

function sumEnvelopes(envelopes: Float32Array[]): Float32Array {
  let maxLen = 0
  for (const e of envelopes) if (e.length > maxLen) maxLen = e.length
  const out = new Float32Array(maxLen)
  for (const e of envelopes) {
    for (let i = 0; i < e.length; i++) out[i] += e[i]
  }
  return out
}

function autocorrelateForBpm(env: Float32Array, envRate: number, minBpm = 40, maxBpm = 200): { bpm: number | null, bestLag: number | null } {
  if (env.length < 4) return { bpm: null, bestLag: null }
  const minLag = Math.ceil((60 * envRate) / maxBpm)
  const maxLag = Math.ceil((60 * envRate) / minBpm)
  const totalSamples = env.length - maxLag
  if (totalSamples <= 1) return { bpm: null, bestLag: null }
  let bestLag = -1
  let bestVal = -Infinity
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < totalSamples; i++) sum += env[i] * env[i + lag]
    if (sum > bestVal) { bestVal = sum; bestLag = lag }
  }
  if (bestLag <= 0) return { bpm: null, bestLag: null }
  const bpm = 60 * envRate / bestLag
  return { bpm, bestLag }
}

function detectPeaksFromEnvelope(env: Float32Array, envRate: number): number[] {
  const peaksSec: number[] = []
  const n = env.length
  if (n === 0) return peaksSec

  // thresholded local maxima with refractory window ~120ms
  const win = Math.max(2, Math.round(0.12 * envRate))
  // dynamic threshold based on moving average
  const avg = movingAverage(env, Math.max(1, Math.round(0.4 * envRate)))
  for (let i = 1; i < n - 1; i++) {
    const isMax = env[i] > env[i - 1] && env[i] >= env[i + 1]
    if (!isMax) continue
    if (env[i] < avg[i] * 1.2) continue
    // check refractory: last peak must be at least win samples behind
    const last = peaksSec.length ? Math.round(peaksSec[peaksSec.length - 1] * envRate) : -win - 1
    if (i - last < win) continue
    peaksSec.push(i / envRate)
  }
  return peaksSec
}

export function analyzeAudio(buffer: AudioBuffer, fps: number): AudioAnalysis {
  const frameSec = 1 / fps
  const sampleRate = buffer.sampleRate
  const frameSize = Math.max(1, Math.round(sampleRate * frameSec))
  const duration = buffer.duration

  const data = toMono(buffer)
  const intensities = normalize(getIntensities(data, frameSize))

  // DWT (Haar) six-level decomposition
  const maxLevels = 6
  const { details } = dwtHaarLevels(data, maxLevels)
  const bands: Float32Array[] = details.slice(0, maxLevels)
  // Effective sample rate per band reduces by 2 each level
  const envelopes: Float32Array[] = []
  const targetEnvRate = 250 // Hz
  for (let i = 0; i < bands.length; i++) {
    const bandRate = sampleRate / Math.pow(2, i + 1) // detail level i+1
    const env = envelopeFromBand(bands[i], bandRate, targetEnvRate)
    envelopes.push(env)
  }
  const sumEnv = sumEnvelopes(envelopes)
  const { bpm } = autocorrelateForBpm(sumEnv, targetEnvRate, 40, 200)
  const peaks = detectPeaksFromEnvelope(sumEnv, targetEnvRate)

  return {
    sampleRate,
    duration,
    intensities,
    frameSize,
    peaks,
    bpm,
  }
}
