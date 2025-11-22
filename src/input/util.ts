import type {Vec2} from "src/games/game.ts";

export function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

export function norm2(x: number, y: number): Vec2 {
  const l = Math.hypot(x, y)
  if (l > 1e-6) {
    const m = Math.min(1, l)
    return [x / l * m, y / l * m]
  }
  return [0, 0]
}