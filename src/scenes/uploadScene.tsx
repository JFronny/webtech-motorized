import { analyzeAudio, type AudioAnalysis } from '../audio/audioProcessor'
import { isWebGLAvailable } from '../render/glUtils.ts'
import { Input } from '../input/input'
import JSX from "src/jsx.ts";

// Implementation for the upload screen
// This is the first screen the user sees when starting the app
// and allows them to select an audio file to play

export type UploadComplete = (
  ctx: AudioContext,
  buffer: AudioBuffer,
  analysis: AudioAnalysis,
) => void | Promise<void>

export function initUploadScreen(root: HTMLElement, onComplete: UploadComplete) {
  let inputSelect = <select onchange={(e: Event) => {Input.setActive((e.target as HTMLInputElement).value)}}></select> as HTMLSelectElement
  let status = <div id="status" class="hint"></div> as HTMLDivElement
  root.replaceChildren(<div class="intro-root">
    <h1>Motorized</h1>
    <button id="orientation-permission" style="display: none">
      Enable Device Orientation
    </button>
    <label class="select-control">
      <span class="hint">Input Device</span>
      {inputSelect}
    </label>
    <label class="file-button">
      Start
      <input type="file" accept="audio/*" onchange={async (e: Event) => {
        await switchToGame(e.target as HTMLInputElement)
      }} />
    </label>
    {status}
  </div>)

  let audioCtx: AudioContext | null = null

  function setStatus(msg: string) {
    status!.textContent = msg
  }

  if (!isWebGLAvailable()) {
    setStatus('Note: WebGL not available, post-processing effects are disabled.')
  }

  function refreshDevices() {
    const devices = Input.listDevices()
    const active = Input.getActiveId()
    inputSelect!.innerHTML = ''
    for (const d of devices) {
      const opt = document.createElement('option')
      opt.value = d.id
      opt.textContent = d.name
      if (d.id === active) opt.selected = true
      inputSelect!.appendChild(opt)
    }
  }

  refreshDevices()

  const unregister = Input.onDeviceChange(refreshDevices)

  async function switchToGame(fileInput: HTMLInputElement) {
    const file = fileInput.files && fileInput.files[0]
    if (!file) {
      setStatus('Please choose an audio file first.')
      return
    }
    setStatus('Reading file...')

    try {
      // Create or resume an AudioContext as part of the user gesture
      if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (audioCtx.state === 'suspended') await audioCtx.resume()

      // Use FileReader API to read the file into an ArrayBuffer
      const arrayBuf: ArrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error)
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.readAsArrayBuffer(file)
      })
      setStatus('Decoding audio...')
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuf.slice(0))

      setStatus('Analyzing...')
      const analysis = analyzeAudio(audioBuffer, 60)

      setStatus(`Done. BPM ≈ ${analysis.bpm ?? 'n/a'} — switching to game...`)
      await new Promise<void>(resolve => setTimeout(resolve, 500))
      await onComplete(audioCtx, audioBuffer, analysis)
    } catch (err) {
      console.error(err)
      setStatus('Failed to decode/analyze the audio file.')
    }
    // Cleanup listeners from upload screen once transitioning
    unregister()
  }
}