import type { InputDevice } from "./input";
import { clamp } from "./util";
import type { Vec2 } from "src/games/game";

export class GamepadDevice implements InputDevice {
  readonly index: number;
  readonly id: string;
  readonly name: string;
  readonly isContinuous: boolean = true;
  readonly precision: number = 0.2;
  readonly slow: boolean = false;

  constructor(index: number, id: string, name: string) {
    this.index = index;
    this.id = id;
    this.name = name;
  }

  sample(): Vec2 {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gps && gps[this.index];
    if (!gp) return [0, 0];
    const dead = 0.15;
    let x = 0;
    let y = 0;
    if (gp.axes && gp.axes.length >= 2) {
      x = Math.abs(gp.axes[0]) > dead ? gp.axes[0] : 0;
      y = Math.abs(gp.axes[1]) > dead ? gp.axes[1] : 0;
    }
    // Fallback to D-Pad buttons
    const btn = (i: number) => Boolean(gp.buttons?.[i]?.pressed);
    if (btn(14)) x -= 1; // left
    if (btn(15)) x += 1; // right
    if (btn(12)) y += 1; // up
    if (btn(13)) y -= 1; // down
    x = clamp(x, -1, 1);
    y = clamp(y, -1, 1);
    return [x, y];
  }
}
