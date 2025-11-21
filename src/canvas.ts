export type CanvasRenderer = (opts: {
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  cssW: number
  cssH: number
  ts: number
  dt: number
}) => void

export type CanvasController = {
  stop: () => void
  show: () => void
  hide: () => void
  resize: () => void
  setRenderer: (renderer: CanvasRenderer) => void
}

export function initCanvas(container: HTMLDivElement): CanvasController {
  // Target aspect ratio for the game view (width / height). Use landscape 16:9.
  const TARGET_ASPECT = 16 / 9
  const MIN_DPR = 1

  // Let stylesheet control layout; add a class for predictable styling.
  container.classList.add('game-canvas-container')

  // Create the canvas element
  const canvas = document.createElement('canvas')
  canvas.id = 'gameCanvas'
  container.appendChild(canvas)

  const ctx = canvas.getContext('2d')!

  let raf = 0
  let lastTimestamp = 0
  let running = false
  let customRenderer: CanvasRenderer | null = null

  // Resize the canvas to fit the viewport while preserving TARGET_ASPECT.
  function resize() {
    const vw = container.clientWidth || window.innerWidth
    const vh = container.clientHeight || window.innerHeight

    let cssWidth: number
    let cssHeight: number

    if (vw / vh > TARGET_ASPECT) {
      // Viewport wider than target -> fit by height
      cssHeight = vh
      cssWidth = Math.round(cssHeight * TARGET_ASPECT)
    } else {
      // Viewport narrower or equal -> fit by width
      cssWidth = vw
      cssHeight = Math.round(cssWidth / TARGET_ASPECT)
    }

    // Backing store size in device pixels
    const dpr = Math.max(MIN_DPR, window.devicePixelRatio || 1)
    canvas.width = Math.floor(cssWidth * dpr)
    canvas.height = Math.floor(cssHeight * dpr)

    // Map drawing coordinates to CSS pixels for convenience
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // Clear the canvas area in CSS pixels
  function clear(cssW: number, cssH: number) {
    ctx.clearRect(0, 0, cssW, cssH)
    // Keep background transparent — container provides the black bars / background.
    ctx.fillStyle = 'transparent'
    ctx.fillRect(0, 0, cssW, cssH)
  }

  // Single-frame render
  function render(ts: number) {
    const dt = (ts - lastTimestamp) || 16
    lastTimestamp = ts

    // Use CSS pixel sizes for layout and drawing calculations
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    clear(cssW, cssH)

    function fallback() {
      ctx.fillStyle = 'white'
      ctx.font = '14px system-ui, sans-serif'
      ctx.fillText('Failed to load audio analysis data.', 12, 20)
    }

    if (customRenderer) {
      try {
        customRenderer({ ctx, canvas, cssW, cssH, ts, dt })
      } catch {
        fallback()
      }
    } else {
      fallback()
    }

    raf = requestAnimationFrame(render)
  }

  function startRendering() {
    if (running) return
    running = true
    lastTimestamp = performance.now()
    raf = requestAnimationFrame(render)
  }

  function stopRendering() {
    if (!running) return
    running = false
    cancelAnimationFrame(raf)
  }

  // Initialize and respond to resizes
  resize()
  window.addEventListener('resize', resize)

  // By default do not start rendering until show() is called
  canvas.style.visibility = 'hidden'

  function show() {
    canvas.style.visibility = 'visible'
    resize()
    startRendering()
  }

  function hide() {
    stopRendering()
    canvas.style.visibility = 'hidden'
  }

  function stop() {
    window.removeEventListener('resize', resize)
    stopRendering()
    if (canvas.parentElement) canvas.parentElement.removeChild(canvas)
    container.classList.remove('game-canvas-container')
  }

  function setRenderer(renderer: CanvasRenderer) {
    customRenderer = renderer
  }

  return { stop, show, hide, resize, setRenderer }
}
