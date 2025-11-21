import { analyzeAudio, type AudioAnalysis } from '../audio/audioProcessor'

export type UploadComplete = (
  ctx: AudioContext,
  buffer: AudioBuffer,
  analysis: AudioAnalysis,
) => void | Promise<void>

export function initUploadScreen(root: HTMLElement, onComplete: UploadComplete) {
  root.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;height:100vh;">
      <h1>Motorized</h1>
      <label class="file-button">
        Start
        <input id="startButton" type="file" accept="audio/*" />
      </label>
      <div id="status" class="status"></div>
    </div>
  `

  const fileInput = root.querySelector<HTMLInputElement>('#startButton')!
  const status = root.querySelector<HTMLDivElement>('#status')!

  let audioCtx: AudioContext | null = null

  function setStatus(msg: string) {
    status.textContent = msg
  }

  fileInput.onchange = async () => {
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
      await new Promise<void>(resolve => setTimeout(resolve, 1000))
      await onComplete(audioCtx, audioBuffer, analysis)
    } catch (err) {
      console.error(err)
      setStatus('Failed to decode/analyze the audio file.')
    }
  }
}
