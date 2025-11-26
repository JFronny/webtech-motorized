import type { GameRuntime } from "../scenes/gameScene";

export type GameState = "Finished" | "Initialized" | "Playing" | "Dead";

export interface Game {
  id: string;

  init(runtime: GameRuntime): void;
  render(ctx: CanvasRenderingContext2D): void;
  update(timestamp: number, deltaTime: number): void;

  state: GameState;
}

export type Vec2 = [number, number];
export type Rect = { l: number; r: number; t: number; b: number };
