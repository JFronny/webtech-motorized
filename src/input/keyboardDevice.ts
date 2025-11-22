import type {InputDevice, InputDeviceType} from "./input.ts";
import type {Vec2} from "src/games/game.ts";

export class KeyboardDevice implements InputDevice {
  readonly id = 'keyboard'
  readonly name = 'Keyboard (WASD / Arrows)'
  readonly type: InputDeviceType = 'keyboard'
  private keys = new Set<string>()

  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this)
    this.onKeyUp = this.onKeyUp.bind(this)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  private onKeyDown(e: KeyboardEvent) {
    this.keys.add(e.key)
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.key)
  }

  sample(): Vec2 {
    let x = 0, y = 0
    if (this.keys.has('a') || this.keys.has('A') || this.keys.has('ArrowLeft')) x -= 1
    if (this.keys.has('d') || this.keys.has('D') || this.keys.has('ArrowRight')) x += 1
    if (this.keys.has('w') || this.keys.has('W') || this.keys.has('ArrowUp')) y += 1
    if (this.keys.has('s') || this.keys.has('S') || this.keys.has('ArrowDown')) y -= 1
    if (x === 0 && y === 0) return [0, 0]
    // Normalize diagonals to magnitude 1
    const l = Math.hypot(x, y)
    return [x / l, y / l]
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }
}