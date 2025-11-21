export function dwtHaarOnce(data: Float32Array): { approx: Float32Array, detail: Float32Array } {
  const n = data.length - (data.length % 2)
  const half = n / 2
  const approx = new Float32Array(half)
  const detail = new Float32Array(half)
  const invSqrt2 = 1 / Math.SQRT2
  for (let i = 0, j = 0; i < n; i += 2, j++) {
    const a = data[i]
    const b = data[i + 1]
    approx[j] = (a + b) * invSqrt2
    detail[j] = (a - b) * invSqrt2
  }
  return { approx, detail }
}

export function dwtHaarLevels(data: Float32Array, levels: number): { details: Float32Array[], approx: Float32Array } {
  const details: Float32Array[] = []
  let cur = data
  for (let l = 0; l < levels; l++) {
    if (cur.length < 2) break
    const { approx, detail } = dwtHaarOnce(cur)
    details.push(detail)
    cur = approx
  }
  return { details, approx: cur }
}