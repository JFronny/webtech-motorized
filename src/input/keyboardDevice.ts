import type { InputDevice } from "./input";
import type { Vec2 } from "src/games/game";

export class KeyboardDevice implements InputDevice {
  readonly id = "keyboard";
  readonly name = "Keyboard (WASD / Arrows)";
  readonly isContinuous: boolean = false;
  readonly precision: number = 0.1;
  readonly slow: boolean = false;

  private keys = new Set<string>();

  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown(e: KeyboardEvent) {
    this.keys.add(e.key);
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.key);
  }

  sample(): Vec2 {
    let x = 0,
      y = 0;
    if (this.keys.has("a") || this.keys.has("A") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("D") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("w") || this.keys.has("W") || this.keys.has("ArrowUp")) y += 1;
    if (this.keys.has("s") || this.keys.has("S") || this.keys.has("ArrowDown")) y -= 1;
    if (x === 0 && y === 0) return [0, 0];
    // Do not normalize to 1 to match touch device behavior
    return [x, y];
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }
}
