import type {InputDevice, InputDeviceType, Vec2} from "./input.ts";
import {clamp, norm2} from "./util.ts";

export class OrientationDevice implements InputDevice {
  readonly id = 'orientation'
  readonly name = 'Device Orientation'
  readonly type: InputDeviceType = 'orientation'

  constructor() {
    window.addEventListener('deviceorientation', this.onDeviceOrientation)
  }

  private lastOrientation: DeviceOrientationEvent | null = null
  private onDeviceOrientation(e: DeviceOrientationEvent) {
    this.lastOrientation = e
  }

  sample(): Vec2 {
    const e = this.lastOrientation
    if (!e) return [0, 0]
    return norm2(clamp(e.gamma! / 90, -1, 1), clamp(e.beta! / 90, -1, 1))
  }
}
