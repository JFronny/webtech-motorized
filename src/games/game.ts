import type {GameRuntime} from "../scenes/gameScene.ts";

type GameState = 'Finished' | 'Initialized' | 'Playing' | 'Dead'

export interface Game {
  id: string

  init(runtime: GameRuntime): void
  render(ctx: CanvasRenderingContext2D, cssW: number, cssH: number): void
  update(timestamp: number, deltaTime: number): void

  state: GameState
}
