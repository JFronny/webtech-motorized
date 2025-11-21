export function toMono(buffer: AudioBuffer): Float32Array {
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

export function normalize(arr: number[]): number[] {
  let max = 0
  for (const v of arr) if (v > max) max = v
  if (max === 0) return arr.map(() => 0)
  return arr.map(v => v / max)
}

export function movingAverage(src: Float32Array, win: number): Float32Array {
  const n = src.length
  if (win <= 1 || n === 0) return new Float32Array(src)
  const dst = new Float32Array(n)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += src[i]
    if (i >= win) sum -= src[i - win]
    dst[i] = sum / Math.min(i + 1, win)
  }
  return dst
}

export function meanRemove(arr: Float32Array): Float32Array {
  let m = 0
  for (let i = 0; i < arr.length; i++) m += arr[i]
  m /= Math.max(1, arr.length)
  const out = new Float32Array(arr.length)
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] - m
  return out
}
