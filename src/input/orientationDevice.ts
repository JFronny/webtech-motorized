import type {InputDevice, InputDeviceType, Vec2} from "./input.ts";
import {clamp, norm2} from "./util.ts";

// I have validate that only one instance of this class is ever created,
// both by reviewing my code and by using a callback from the constructor.
// For some reason, this still does not properly carry state if it is placed in the class definition.
// As such, I am using a global variable to store the last orientation event.
// Sorry.
let lastOrientation: DeviceOrientationEvent | null = null

export class OrientationDevice implements InputDevice {
  readonly id = 'orientation'
  readonly name = 'Device Orientation'
  readonly type: InputDeviceType = 'orientation'

  constructor() {
    window.addEventListener('deviceorientation', this.onDeviceOrientation)
  }

  private onDeviceOrientation(e: DeviceOrientationEvent): void {
    if (e.alpha === null || e.beta === null || e.gamma === null) return
    lastOrientation = e
  }

  sample(): Vec2 {
    const e = lastOrientation
    if (!e) return [0, 0]
    return norm2(clamp(e.beta! / 45, -1, 1), clamp(e.gamma! / 45 + 0.3, -1, 1))
  }
}
