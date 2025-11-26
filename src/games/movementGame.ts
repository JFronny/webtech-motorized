import type { Game, GameState, Vec2 } from "./game";
import type { GameRuntime } from "../scenes/gameScene";
import { Input } from "../input/input";
import type { AudioAnalysis } from "../audio/audioProcessor";

type Move = {
  direction: Vec2;
  time: number;
  position: Vec2;
  completed: boolean;
};

class MovementGameImpl implements Game {
  id: string = "movement";
  state: GameState = "Finished";

  private playerPosition: Vec2 = [0, 0];
  private lastDirection: Vec2 = [0, 0];
  private cameraPosition: Vec2 = [0, 0];
  private moves: Move[] = [];

  // Runtime information
  private audioCtx: AudioContext | undefined;
  private startTime: number | undefined;
  private endTime: number | undefined;
  private analysis: AudioAnalysis | undefined;

  private prng(seed: number): number {
    return Math.abs(Math.sin(seed) * 10000) % 1;
  }

  private getNextDirection(beat: { time: number; classification: number }): Vec2 {
    const seed = Math.floor(beat.time / 2);
    let rand = this.prng(seed);

    const possibleDirections: Vec2[] = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    if (this.lastDirection[0] !== 0 || this.lastDirection[1] !== 0) {
      const index = possibleDirections.findIndex(
        (d) => d[0] === -this.lastDirection[0] && d[1] === -this.lastDirection[1],
      );
      possibleDirections.splice(index, 1);
    }

    const direction = possibleDirections[Math.floor(rand * possibleDirections.length)];
    this.lastDirection = direction;
    return direction;
  }

  init(runtime: GameRuntime): void {
    this.audioCtx = runtime.audioCtx;
    this.startTime = runtime.startTime;
    this.endTime = runtime.endTime;
    this.analysis = runtime.analysis;
    this.state = "Initialized";

    // Reset state
    this.playerPosition = [0, 0];
    this.lastDirection = [0, 0];
    this.cameraPosition = [0, 0];
    this.moves = [];

    // Generate moves from peaks
    const peaks = this.analysis.peaks;
    let lastPosition: Vec2 = [0, 0];
    let beatIndex = 0;

    for (const peakTime of peaks) {
      if (peakTime < runtime.audioCtx.currentTime - runtime.startTime + 1) continue;
      if (peakTime > this.endTime - this.startTime) break;

      // Create a pseudo-beat object for getNextDirection
      const beat = { time: peakTime, classification: 0 };
      const direction = this.getNextDirection(beat);
      const newPosition: Vec2 = [lastPosition[0] + direction[0], lastPosition[1] + direction[1]];
      this.moves.push({
        direction,
        time: peakTime,
        position: newPosition,
        completed: false,
      });
      lastPosition = newPosition;
      beatIndex++;
    }
  }

  update(_timestamp: number, _deltaTime: number): void {
    if (this.state === "Initialized") this.state = "Playing";
    if (this.state !== "Playing") return;

    const nowSec = Math.max(0, this.audioCtx!.currentTime - this.startTime!);

    // Adjust timing windows for slow devices (orientation)
    const isSlow = Input.hasAttribute("imprecise");
    const moveWindow = isSlow ? 0.5 : 0.3;
    const gracePeriodAfterMove = isSlow ? 1 : 0.15;
    const threshold = Input.hasAttribute("imprecise") ? 0.5 : 0.3;

    // Find the current move (the first uncompleted move)
    let currentMoveIndex = -1;
    let previousMoveTime = -Infinity;
    let previousMoveDirection: Vec2 | null = null;
    for (let i = 0; i < this.moves.length; i++) {
      if (!this.moves[i].completed) {
        currentMoveIndex = i;
        // Get the time and direction of the previous move (if it exists)
        if (i > 0) {
          previousMoveTime = this.moves[i - 1].time;
          previousMoveDirection = this.moves[i - 1].direction;
        }
        break;
      }
    }

    // If all moves are completed, we're done
    if (currentMoveIndex === -1) {
      this.state = "Finished";
      return;
    }

    const currentMove = this.moves[currentMoveIndex];
    const timeToMove = currentMove.time - nowSec;
    const timeSincePreviousMove = nowSec - previousMoveTime;

    const moveVec = Input.sample();
    const hasInput = Math.abs(moveVec[0]) > threshold || Math.abs(moveVec[1]) > threshold;
    const directionMatches = (movement: Vec2, direction: Vec2) =>
      Math.abs(movement[0] - direction[0]) < threshold && Math.abs(movement[1] + direction[1]) < threshold;

    // Check if we're within the input window
    if (timeToMove < moveWindow && timeToMove > -moveWindow) {
      if (directionMatches(moveVec, currentMove.direction)) {
        this.playerPosition = currentMove.position;
        currentMove.completed = true;
      }
    }

    // Lose condition: if the window has passed and the move wasn't completed
    if (timeToMove < -moveWindow && !currentMove.completed) {
      this.state = "Dead";
      return;
    }

    // Players shouldn't be able to hold the input for too long after completing a move
    const outsideCurrentWindow = timeToMove > moveWindow || timeToMove < -moveWindow;

    let inGracePeriod = false;
    if (previousMoveDirection && timeSincePreviousMove <= gracePeriodAfterMove) {
      inGracePeriod = directionMatches(moveVec, previousMoveDirection);
    }

    if (hasInput && outsideCurrentWindow && !inGracePeriod) {
      this.state = "Dead";
      return;
    }

    if (this.audioCtx!.currentTime > this.endTime!) {
      this.state = "Finished";
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.state == "Initialized") this.state = "Playing";

    // Update camera to follow player smoothly
    const cameraSpeed = 0.05;
    const targetX = this.playerPosition[0];
    const targetY = this.playerPosition[1];
    this.cameraPosition[0] += (targetX - this.cameraPosition[0]) * cameraSpeed;
    this.cameraPosition[1] += (targetY - this.cameraPosition[1]) * cameraSpeed;

    // Transform world coordinates to camera space
    ctx.save();
    ctx.translate(-this.cameraPosition[0], -this.cameraPosition[1]);
    ctx.lineWidth = 0.05;

    // Draw player
    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.arc(this.playerPosition[0], this.playerPosition[1], 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Draw path
    const nowSec = Math.max(0, this.audioCtx!.currentTime - this.startTime!);
    const upcomingMoves = this.moves.filter((move) => !move.completed);

    for (let i = 0; i < Math.min(upcomingMoves.length, 5); i++) {
      const move = upcomingMoves[i];
      const timeToMove = move.time - nowSec;

      const squareSize = 1;
      const halfSize = squareSize / 2;

      ctx.strokeStyle = "white";
      ctx.lineWidth = 0.1;
      ctx.strokeRect(move.position[0] - halfSize, move.position[1] - halfSize, squareSize, squareSize);

      // Draw double rectangle for the last target
      if (upcomingMoves.length === 1) {
        const doubleRectOffset = 0.2;
        ctx.strokeStyle = "red";
        ctx.strokeRect(
          move.position[0] - halfSize - doubleRectOffset,
          move.position[1] - halfSize - doubleRectOffset,
          squareSize + doubleRectOffset * 2,
          squareSize + doubleRectOffset * 2,
        );
      }

      const innerSquareSize = Math.max(0, squareSize * (1 - timeToMove));
      const innerHalfSize = innerSquareSize / 2;
      ctx.fillStyle = "white";
      ctx.fillRect(
        move.position[0] - innerHalfSize,
        move.position[1] - innerHalfSize,
        innerSquareSize,
        innerSquareSize,
      );
    }

    ctx.restore();
  }
}

export const MovementGame = new MovementGameImpl();
