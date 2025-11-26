import type { Game, GameState } from "./game";
import type { GameRuntime } from "../scenes/gameScene";
import { Input } from "../input/input";
import type { AudioAnalysis } from "../audio/audioProcessor";

type Lane = 0 | 1 | 2 | 3 | 4;
type Note = {
  time: number; // audio time when note should be caught
  lane: Lane;
  caught: boolean;
};

class GuitarGameImpl implements Game {
  id: string = "guitar";
  state: GameState = "Finished";

  private notes: Note[] = [];
  private paddleX: number = 0; // paddle position (-1 to 1)

  // Runtime information
  private audioCtx: AudioContext | undefined;
  private startTime: number | undefined;
  private endTime: number | undefined;
  private analysis: AudioAnalysis | undefined;

  // Game constants
  private readonly NUM_LANES = 5;
  private readonly LANE_SPACING = 4;
  private readonly FALL_DURATION = 1.5;
  private readonly CATCH_WINDOW = 0.15;
  private readonly PADDLE_WIDTH = 0.8;
  private readonly NOTE_SIZE = 0.3;

  // Coordinate system for 16:9 aspect ratio (width=10, height=5.625)
  private readonly SCREEN_HEIGHT = 90 / 16;

  private prng(seed: number): number {
    return Math.abs(Math.sin(seed * 12.9898) * 43758.5453123) % 1;
  }

  private getLaneForPeak(peakIndex: number): Lane {
    const peakClass = this.analysis?.peakClasses[peakIndex] ?? 0;
    const seed = peakIndex * 7 + peakClass * 3;
    return Math.min(Math.max(0, Math.round(peakClass + (this.prng(seed) % 1))), 4) as Lane;
  }

  private laneToX(lane: Lane): number {
    // Convert lane index (0-4) to x position (-1 to 1) to match input range
    const spacing = this.LANE_SPACING / (this.NUM_LANES - 1);
    return -(this.LANE_SPACING / 2) + lane * spacing;
  }

  init(runtime: GameRuntime): void {
    this.audioCtx = runtime.audioCtx;
    this.startTime = runtime.startTime;
    this.endTime = runtime.minigameEndTime;
    this.analysis = runtime.analysis;
    this.state = "Initialized";

    // Reset state
    this.notes = [];
    this.paddleX = 0;

    // Generate notes from peaks
    const peaks = this.analysis.peaks;
    const nowSec = Math.max(0, runtime.audioCtx.currentTime - runtime.startTime);

    for (let i = 0; i < peaks.length; i++) {
      const peakTime = peaks[i];

      // Only include peaks within this game's time window
      if (peakTime < nowSec + this.FALL_DURATION) continue;
      if (peakTime > this.endTime - this.startTime) break;

      const lane = this.getLaneForPeak(i);
      this.notes.push({
        time: peakTime,
        lane,
        caught: false,
      });
    }
  }

  update(_timestamp: number, _deltaTime: number): void {
    if (this.state === "Initialized") this.state = "Playing";
    if (this.state !== "Playing") return;

    const nowSec = Math.max(0, this.audioCtx!.currentTime - this.startTime!);

    // Update paddle position based on input
    const sample = Input.sample();

    // For integer devices (keyboard), map up/down to specific lanes
    if (!Input.isContinuous()) {
      const y = sample[1];
      if (y > 0.5) {
        // Up arrow -> lane 1 (second string from left)
        this.paddleX = this.laneToX(1);
      } else if (y < -0.5) {
        // Down arrow -> lane 3 (fourth string from left)
        this.paddleX = this.laneToX(3);
      } else {
        // Left/right or no vertical input -> use x-axis
        this.paddleX = (this.LANE_SPACING / 2) * sample[0];
      }
    } else {
      // Analog devices use x-axis directly
      this.paddleX = (this.LANE_SPACING / 2) * sample[0];
    }

    // Check for notes that need to be caught
    for (const note of this.notes) {
      if (note.caught) continue;

      const timeDiff = note.time - nowSec;

      if (timeDiff <= 0) {
        const noteX = this.laneToX(note.lane);
        const paddleLeft = this.paddleX - this.PADDLE_WIDTH / 2;
        const paddleRight = this.paddleX + this.PADDLE_WIDTH / 2;

        // Note was caught
        if (noteX >= paddleLeft && noteX <= paddleRight) {
          note.caught = true;
        }
      }

      // Note was missed
      if (timeDiff < -this.CATCH_WINDOW && !note.caught) {
        note.caught = true;
        this.state = "Dead";
        return;
      }
    }

    // Win condition: reached end time
    if (this.audioCtx!.currentTime > this.endTime!) {
      this.state = "Finished";
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.state === "Initialized") this.state = "Playing";

    const nowSec = Math.max(0, this.audioCtx!.currentTime - this.startTime!);

    const paddleY = this.SCREEN_HEIGHT / 2 - 0.3;
    const timeToY = (timeDiff: number) => {
      const progress = 1 - timeDiff / this.FALL_DURATION;
      return -this.SCREEN_HEIGHT / 2 + progress * (paddleY + this.SCREEN_HEIGHT / 2);
    };

    // Draw lane dividers
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 0.05;
    for (let i = 0; i < this.NUM_LANES; i++) {
      const x = this.laneToX(i as Lane);
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x, 10);
      ctx.stroke();
    }

    // Draw paddle
    const paddleLeft = this.paddleX - this.PADDLE_WIDTH / 2;
    const paddleHeight = 0.2;

    ctx.fillStyle = "blue";
    ctx.fillRect(paddleLeft, paddleY, this.PADDLE_WIDTH, paddleHeight);

    // Draw notes
    for (const note of this.notes) {
      if (note.caught) continue;

      const timeDiff = note.time - nowSec;

      // Only draw notes that are visible (falling or about to appear)
      if (timeDiff > this.FALL_DURATION || timeDiff < -this.CATCH_WINDOW * 2) continue;

      const y = timeToY(timeDiff);
      const noteX = this.laneToX(note.lane);
      const halfSize = this.NOTE_SIZE / 2;

      ctx.fillStyle = "white";
      ctx.fillRect(noteX - halfSize, y - this.NOTE_SIZE, this.NOTE_SIZE, this.NOTE_SIZE);

      // Color based on proximity to catch window
      if (Math.abs(timeDiff) <= this.CATCH_WINDOW) {
        // In catch window - highlight
        ctx.strokeStyle = "yellow";
      } else if (timeDiff < 0.3 && timeDiff > 0) {
        // Approaching catch window
        ctx.strokeStyle = "orange";
      } else {
        ctx.strokeStyle = "white";
      }
      ctx.lineWidth = 0.05;
      ctx.strokeRect(noteX - halfSize, y - this.NOTE_SIZE, this.NOTE_SIZE, this.NOTE_SIZE);
    }

    // Draw end of minigame line
    const y = timeToY(this.endTime! - this.audioCtx!.currentTime);
    ctx.lineWidth = 0.05;
    ctx.strokeStyle = "red";
    ctx.beginPath();
    ctx.moveTo(-10, y);
    ctx.lineTo(10, y);
    ctx.stroke();
  }
}

export const GuitarGame = new GuitarGameImpl();
