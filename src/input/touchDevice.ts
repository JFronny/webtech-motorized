import type { InputDevice } from "./input";
import { clamp } from "./util";
import type { Vec2 } from "src/games/game";

export class TouchDevice implements InputDevice {
  readonly id = "touch";
  readonly name = "Touch (first finger)";
  readonly isContinuous: boolean = true;
  readonly precision: number = 0.3;
  readonly slow: boolean = false;

  private touchId: number | null = null;
  private px = 0;
  private py = 0;

  constructor() {
    this.onStart = this.onStart.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onEnd = this.onEnd.bind(this);
    window.addEventListener("touchstart", this.onStart, { passive: false });
    window.addEventListener("touchmove", this.onMove, { passive: false });
    window.addEventListener("touchend", this.onEnd);
    window.addEventListener("touchcancel", this.onEnd);
  }

  private onStart(e: TouchEvent) {
    if (this.touchId !== null) return; // no multitouch: keep first
    const t = e.changedTouches[0];
    if (!t) return;
    this.touchId = t.identifier;
    this.px = t.clientX;
    this.py = t.clientY;
  }

  private onMove(e: TouchEvent) {
    if (this.touchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.touchId) {
        this.px = t.clientX;
        this.py = t.clientY;
        break;
      }
    }
  }

  private onEnd(e: TouchEvent) {
    if (this.touchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.touchId) {
        this.touchId = null;
        this.px = 0;
        this.py = 0;
        break;
      }
    }
  }

  sample(): Vec2 {
    if (this.touchId === null) return [0, 0];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;
    // Map to [-1, 1] with origin in center, y up positive
    const x = clamp((this.px - cx) / cx, -1, 1);
    const y = clamp((cy - this.py) / cy, -1, 1);
    return [x, y];
  }

  dispose() {
    window.removeEventListener("touchstart", this.onStart);
    window.removeEventListener("touchmove", this.onMove);
    window.removeEventListener("touchend", this.onEnd);
    window.removeEventListener("touchcancel", this.onEnd);
  }
}
