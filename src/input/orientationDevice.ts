import type { InputDevice } from "./input";
import { clamp } from "./util";
import type { Vec2 } from "src/games/game";

// I have validate that only one instance of this class is ever created,
// both by reviewing my code and by using a callback from the constructor.
// For some reason, this still does not properly carry state if it is placed in the class definition.
// As such, I am using a global variable to store the last orientation event.
// Sorry.
let lastOrientation: DeviceOrientationEvent | null = null;

export class OrientationDevice implements InputDevice {
  readonly id = "orientation";
  readonly name = "Device Orientation";
  readonly isContinuous: boolean = true;
  readonly precision: number = 0.5;
  readonly slow: boolean = false;

  constructor() {
    window.addEventListener("deviceorientation", this.onDeviceOrientation);
  }

  private onDeviceOrientation(e: DeviceOrientationEvent): void {
    if (e.alpha === null || e.beta === null || e.gamma === null) return;
    lastOrientation = e;
  }

  sample(): Vec2 {
    const e = lastOrientation;
    if (!e) return [0, 0];
    return [clamp(e.beta! / 45, -1, 1), clamp(e.gamma! / 45 + 0.3, -1, 1)];
  }
}
