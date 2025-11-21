import { createProgram, isWebGLAvailable } from './gl-utils.ts'
import fragmentShaderSource from './main.frag?raw'
import vertexShaderSource from './main.vert?raw'

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
  const useWebGL = isWebGLAvailable()
  // Target aspect ratio for the game view (width / height). Use landscape 16:9.
  const TARGET_ASPECT = 16 / 9
  const MIN_DPR = 1

  // Let stylesheet control layout; add a class for predictable styling.
  container.classList.add('game-canvas-container')

  // The 2D canvas is where the game scene is drawn.
  // If WebGL is used, this is an offscreen buffer.
  const canvas2d = document.createElement('canvas')
  canvas2d.id = 'gameCanvas2d' // for debugging
  const ctx = canvas2d.getContext('2d')!

  // The WebGL canvas is what is shown on screen.
  let canvas: HTMLCanvasElement
  let gl: WebGLRenderingContext | null = null
  let glProgram: WebGLProgram | null = null
  let texture: WebGLTexture | null = null
  let u_resolution: WebGLUniformLocation | null = null
  let u_time: WebGLUniformLocation | null = null
  let u_aberration: WebGLUniformLocation | null = null
  let u_bloom: WebGLUniformLocation | null = null

  if (useWebGL) {
    const webglCanvas = document.createElement('canvas')
    webglCanvas.id = 'gameCanvas'
    container.appendChild(webglCanvas)
    canvas = webglCanvas
    gl = canvas.getContext('webgl')

    if (gl) {
      // Setup GL program
      glProgram = createProgram(gl, vertexShaderSource, fragmentShaderSource)!
      gl.useProgram(glProgram)

      // Buffer for screen quad
      const positionBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      )

      const positionAttributeLocation = gl.getAttribLocation(glProgram, 'a_position')
      gl.enableVertexAttribArray(positionAttributeLocation)
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0)

      // Texture for 2D canvas content
      texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

      // Get uniform locations
      u_resolution = gl.getUniformLocation(glProgram, 'u_resolution')
      u_time = gl.getUniformLocation(glProgram, 'u_time')
      u_aberration = gl.getUniformLocation(glProgram, 'u_aberration')
      u_bloom = gl.getUniformLocation(glProgram, 'u_bloom')
    } else {
      // Fallback if context creation fails
      container.appendChild(canvas2d)
      canvas = canvas2d
    }
  } else {
    // No WebGL support, just use the 2D canvas
    container.appendChild(canvas2d)
    canvas = canvas2d
    canvas.id = 'gameCanvas'
  }

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
    const backingW = Math.floor(cssWidth * dpr)
    const backingH = Math.floor(cssHeight * dpr)

    canvas.width = backingW
    canvas.height = backingH

    // The 2D canvas must have the same backing store size
    canvas2d.width = backingW
    canvas2d.height = backingH

    // The 2D context should always be scaled to CSS pixels for consistent drawing logic
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (gl) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    }
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
        customRenderer({ ctx, canvas: canvas2d, cssW, cssH, ts, dt })
      } catch {
        fallback()
      }
    } else {
      fallback()
    }

    // If using WebGL, render 2D canvas to screen with shaders
    if (gl && glProgram) {
      // Update texture with 2D canvas content
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d)

      // Set uniforms
      gl.uniform2f(u_resolution, gl.drawingBufferWidth, gl.drawingBufferHeight)
      gl.uniform1f(u_time, ts / 1000.0)
      gl.uniform1f(u_aberration, 2.0) // effect strength
      gl.uniform1f(u_bloom, 0.4) // effect strength

      // Draw the quad
      gl.drawArrays(gl.TRIANGLES, 0, 6)
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
