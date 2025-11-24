import { analyzeAudio, type AudioAnalysis } from "../audio/audioProcessor";
import { isWebGLAvailable } from "../render/glUtils";
import { Input } from "../input/input";
import JSX from "src/jsx";
import { initGameScreen } from "src/scenes/gameScene.tsx";

// Implementation for the upload screen
// This is the first screen the user sees when starting the app
// and allows them to select an audio file to play

export type Audio = { ctx: AudioContext; buffer: AudioBuffer; analysis: AudioAnalysis };

export function initUploadScreen(root: HTMLElement) {
  let inputSelect = (
    <select
      onchange={(e: Event) => {
        Input.setActive((e.target as HTMLInputElement).value);
      }}
    ></select>
  ) as HTMLSelectElement;
  let status = (<div class="hint"></div>) as HTMLDivElement;
  let startButton = (
    <button
      onclick={async (_: any) => {
        unregister();
        await initGameScreen(root, audio!);
      }}
      class="btn"
      disabled
    >
      Start
    </button>
  ) as HTMLButtonElement;
  root.replaceChildren(
    <div class="intro-root">
      <h1>Motorized</h1>
      <button id="orientation-permission" class="btn" style="display: none">
        Enable Device Orientation
      </button>
      <label class="select-control">
        <span class="hint">Input Device</span>
        {inputSelect}
      </label>
      <label class="btn">
        Pick a song
        <input
          type="file"
          accept="audio/*"
          onchange={async (e: Event) => {
            const input = e.target as HTMLInputElement;
            input.disabled = true;
            await processAudio(input);
            startButton.disabled = false;
          }}
        />
      </label>
      {status}
      {startButton}
    </div>,
  );

  let audioCtx: AudioContext | null = null;
  let audio: Audio | null = null;

  function setStatus(msg: string) {
    status!.textContent = msg;
  }

  if (!isWebGLAvailable()) {
    setStatus("Note: WebGL not available, post-processing effects are disabled.");
  }

  function refreshDevices() {
    const devices = Input.listDevices();
    const active = Input.getActiveId();
    inputSelect!.innerHTML = "";
    for (const d of devices) {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name;
      if (d.id === active) opt.selected = true;
      inputSelect!.appendChild(opt);
    }
  }

  refreshDevices();

  const unregister = Input.onDeviceChange(refreshDevices);

  async function processAudio(fileInput: HTMLInputElement) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      setStatus("Please choose an audio file first.");
      return;
    }
    setStatus("Reading file...");

    try {
      // Create or resume an AudioContext as part of the user gesture
      if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === "suspended") await audioCtx.resume();

      // Use FileReader API to read the file into an ArrayBuffer
      const arrayBuf: ArrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(file);
      });
      setStatus("Decoding audio...");
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuf.slice(0));

      setStatus("Analyzing...");
      const analysis = analyzeAudio(audioBuffer, 60);

      setStatus(`Done. BPM ≈ ${analysis.bpm ?? "n/a"}`);
      audio = { ctx: audioCtx!, buffer: audioBuffer, analysis };
    } catch (err) {
      console.error(err);
      setStatus("Failed to decode/analyze the audio file.");
    }
  }
}
