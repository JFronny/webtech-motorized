export type AudioAnalysis = {
  sampleRate: number
  duration: number
  intensities: number[] // normalized 0..1 per frame
  frameSize: number // samples per frame used for intensities
  peaks: number[] // seconds of detected beat-like peaks
  bpm: number | null
}

function toMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0)
  const len = buffer.length
  const out = new Float32Array(len)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < len; i++) out[i] += data[i]
  }
  for (let i = 0; i < len; i++) out[i] /= buffer.numberOfChannels
  return out
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

function normalize(arr: number[]): number[] {
  let max = 0
  for (const v of arr) if (v > max) max = v
  if (max === 0) return arr.map(() => 0)
  return arr.map(v => v / max)
}

function detectPeaks(intensities: number[], fps: number): number[] {
  // Simple moving-average threshold + local maxima
  const window = Math.max(1, Math.round(fps * 0.5))
  const peaks: number[] = []
  const avgWin = Math.max(1, Math.round(fps * 1.0))
  let movingSum = 0
  for (let i = 0; i < intensities.length; i++) {
    const val = intensities[i]
    // compute moving average
    movingSum += val
    if (i >= avgWin) movingSum -= intensities[i - avgWin]

    const avg = movingSum / Math.min(i + 1, avgWin)
    const threshold = avg * 1.3 // heuristic

    // local maxima within window
    const left = Math.max(0, i - window)
    const right = Math.min(intensities.length - 1, i + window)
    let isPeak = val > threshold
    if (isPeak) {
      for (let j = left; j <= right; j++) {
        if (intensities[j] > val) { isPeak = false; break }
      }
    }
    if (isPeak) peaks.push(i / fps)
  }
  return peaks
}

function estimateBpmFromPeaks(peaksSec: number[]): number | null {
  if (peaksSec.length < 4) return null
  // Build histogram of intervals between peaks (up to 8 neighbors)
  const counts = new Map<number, number>()
  for (let i = 0; i < peaksSec.length; i++) {
    for (let j = 1; j <= 8 && i + j < peaksSec.length; j++) {
      let interval = peaksSec[i + j] - peaksSec[i]
      if (interval <= 0) continue
      let bpm = 60 / interval
      // fold into 60..200 range
      while (bpm < 60) bpm *= 2
      while (bpm > 200) bpm /= 2
      const key = Math.round(bpm)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }
  let best: number | null = null
  let bestCount = -1
  for (const [bpm, c] of counts.entries()) {
    if (c > bestCount) { best = bpm; bestCount = c }
  }
  return best
}

export function analyzeAudio(buffer: AudioBuffer, fps: number): AudioAnalysis {
  const frameSec = 1 / fps
  const sampleRate = buffer.sampleRate
  const frameSize = Math.max(1, Math.round(sampleRate * frameSec))
  const duration = buffer.duration

  const data = toMono(buffer)
  const intensities = getIntensities(data, frameSize)
  const normInt = normalize(intensities)
  const peaks = detectPeaks(normInt, fps)
  const bpm = estimateBpmFromPeaks(peaks)

  return {
    sampleRate,
    duration,
    intensities: normInt,
    frameSize,
    peaks,
    bpm,
  }
}
