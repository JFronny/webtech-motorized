import type { Game, GameState } from "./game";
import type { GameRuntime } from "../scenes/gameScene";
import type { AudioAnalysis } from "../audio/audioProcessor";
import { Input } from "../input/input";

class DebugGameImpl implements Game {
  readonly id = "debug";

  // Visual params
  private pixelsPerSecond = 360; // scroll speed; higher = faster leftwards
  private peakLineWidth = 2;

  // Precompute style
  private gridColor = "rgba(255,255,255,0.25)";
  private peakColor = "rgba(100,200,255,0.95)";
  private nowColor = "rgba(255,0,0,0.8)";
  private intensityColor = "rgba(255,255,255,0.6)";

  // Runtime information
  private audioCtx: AudioContext | undefined;
  private startTime: number | undefined;
  private analysis: AudioAnalysis | undefined;
  private fps: number | undefined;
  private peaks: number[] | undefined;

  state: GameState = "Finished";

  init(runtime: GameRuntime): void {
    this.audioCtx = runtime.audioCtx;
    this.startTime = runtime.startTime;
    this.analysis = runtime.analysis;
    const frameSec = runtime.analysis.frameSize / runtime.analysis.sampleRate;
    this.fps = 1 / frameSec;
    this.peaks = runtime.analysis.peaks;
    this.state = "Initialized";
  }

  render(ctx: CanvasRenderingContext2D, cssW: number, cssH: number): void {
    if (this.state == "Initialized") this.state = "Playing";

    // Compute current playback time in seconds
    const nowSec = Math.max(0, this.audioCtx!.currentTime - this.startTime!);

    // Draw a baseline in the middle
    const midY = Math.round(cssH * 0.5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = this.gridColor;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(cssW, midY);
    ctx.stroke();

    // Draw intensity rolling graph (right-aligned to "now" at center x)
    const centerX = Math.round(cssW * 0.5);
    const secondsVisibleLeft = centerX / this.pixelsPerSecond;
    const secondsVisibleRight = (cssW - centerX) / this.pixelsPerSecond;
    const startTimeSec = Math.max(0, nowSec - secondsVisibleLeft);
    const endTimeSec = nowSec + secondsVisibleRight;

    // Map time to intensity frame index
    const fps = this.fps!;
    function timeToIndex(t: number) {
      return Math.floor(t * fps);
    }

    const startIdx = Math.max(0, timeToIndex(startTimeSec));
    const endIdx = Math.min(this.analysis!.intensities.length - 1, timeToIndex(endTimeSec));

    ctx.strokeStyle = this.intensityColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    for (let i = startIdx; i <= endIdx; i++) {
      const t = i / fps;
      const x = Math.round(centerX + (t - nowSec) * this.pixelsPerSecond);
      const value = this.analysis!.intensities[i];
      const amp = cssH * 0.35 * value;
      const y = midY - amp;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw vertical lines for beat peaks that are in the visible window
    ctx.strokeStyle = this.peakColor;
    ctx.lineWidth = this.peakLineWidth;
    for (let i = 0; i < this.peaks!.length; i++) {
      const t = this.peaks![i];
      if (t < startTimeSec || t > endTimeSec) continue;
      const x = Math.round(centerX + (t - nowSec) * this.pixelsPerSecond) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, midY - cssH * 0.4);
      ctx.lineTo(x, midY + cssH * 0.35);
      ctx.stroke();
    }

    // Draw four small lines to visualize the bpm according to the current time
    if (this.analysis!.bpm) {
      const bpm = this.analysis!.bpm;
      const spb = 60 / bpm; // seconds per beat
      const firstBeatAfterStart = Math.ceil(startTimeSec / spb) * spb;
      ctx.strokeStyle = this.peakColor;
      ctx.lineWidth = 1;
      for (let t = firstBeatAfterStart; t <= endTimeSec; t += spb) {
        const x = Math.round(centerX + (t - nowSec) * this.pixelsPerSecond) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, midY - cssH * 0.02);
        ctx.lineTo(x, midY + cssH * 0.02);
        ctx.stroke();
      }
    }

    // Center line
    ctx.strokeStyle = this.nowColor;
    ctx.beginPath();
    ctx.moveTo(centerX, midY - cssH);
    ctx.lineTo(centerX, midY + cssH);
    ctx.stroke();

    // Render debug text
    ctx.fillStyle = "white";
    ctx.font = "14px system-ui, sans-serif";
    const text = `t=${nowSec.toFixed(2)}s  bpm≈${this.analysis!.bpm ?? "n/a"}`;
    ctx.fillText(text, 12, 20);

    // Render input
    ctx.fillStyle = "white";
    ctx.beginPath();
    const sample = Input.sample();
    const x = Math.round(centerX + sample[0] * cssW * 0.35);
    const y = midY - sample[1] * cssH * 0.35;
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(`(${sample[0].toFixed(2)}, ${sample[1].toFixed(2)})`, x + 12, y - 4);
  }
  update(_timestamp: number, _deltaTime: number): void {}
}

export const DebugGame = new DebugGameImpl();
