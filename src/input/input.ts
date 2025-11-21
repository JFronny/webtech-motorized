import {KeyboardDevice} from "./keyboardDevice.ts";
import {GamepadDevice} from "./gamepadDevice.ts";
import {TouchDevice} from "./touchDevice.ts";
import {OrientationDevice} from "./orientationDevice.ts";

export type Vec2 = [number, number]

export type InputDeviceType = 'keyboard' | 'gamepad' | 'touch' | 'orientation'

export interface InputDeviceInfo {
  id: string
  name: string
  type: InputDeviceType
}

export interface InputDevice extends InputDeviceInfo {
  sample(): Vec2
  dispose?(): void
}

class InputManagerImpl {
  private devices = new Map<string, InputDevice>()
  private activeId: string | null = null
  private initialized = false

  init() {
    if (this.initialized) return
    this.initialized = true

    // Keyboard is always available
    this.register(new KeyboardDevice())

    // Touch if supported (heuristic)
    const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (touchCapable) this.register(new TouchDevice())

    // Gamepads via events + initial scan
    window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
      const gp = e.gamepad
      this.register(new GamepadDevice(gp.index, `gamepad-${gp.index}`,
        gp.id ? `Gamepad ${gp.index + 1} — ${gp.id}` : `Gamepad ${gp.index + 1}`))
    })
    window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
      this.unregister(`gamepad-${e.gamepad.index}`)
    })
    const gps = navigator.getGamepads ? navigator.getGamepads() : []
    for (let i = 0; i < (gps?.length || 0); i++) {
      const gp = gps && gps[i]
      if (gp) this.register(new GamepadDevice(gp.index, `gamepad-${gp.index}`, gp.id || `Gamepad ${gp.index + 1}`))
    }

    // Device orientation if supported
    if (window.location.protocol == 'https:' || window.location.hostname == 'localhost') {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {

        // Show permission button for iOS
        const button: HTMLElement = document.getElementById('orientation-permission')!;
        button.style.display = 'block';
        button.addEventListener('click', this.requestOrientationPermission);

      } else if ('DeviceOrientationEvent' in window) {
        // Other browsers - just start listening
        this.register(new OrientationDevice());
      } else {
        console.warn('Device orientation not supported');
      }
    }

    // Default selection
    if (touchCapable) this.activeId = 'touch'
    else this.activeId = 'keyboard'

    const onGpChange = () => setTimeout(this.dispatchDeviceChange, 0)
    window.addEventListener('gamepadconnected', onGpChange)
    window.addEventListener('gamepaddisconnected', onGpChange)
  }

  private requestOrientationPermission() {
    // iOS 13+ requires user interaction and HTTPS
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      alert('Device orientation requires HTTPS. Please use the HTTPS server or deploy to a secure host.');
      return;
    }

    DeviceOrientationEvent.requestPermission()
      .then((response: string) => {
        if (response == 'granted') {
          document.getElementById('orientation-permission')!.style.display = 'block';
          this.register(new OrientationDevice());
        }
      })
      .catch((error: any) => {
        console.error('Error requesting permission:', error);
      });
  }

  private register(dev: InputDevice) {
    this.devices.set(dev.id, dev)
    this.dispatchDeviceChange()
  }

  private unregister(id: string) {
    const dev = this.devices.get(id)
    if (dev && dev.dispose) dev.dispose()
    this.devices.delete(id)
    if (this.activeId === id) this.activeId = this.devices.has('keyboard') ? 'keyboard' : Array.from(this.devices.keys())[0] || null
    this.dispatchDeviceChange()
  }

  private dispatchDeviceChange() {
    document.dispatchEvent(new Event('jf-input-device-change'))
  }

  onDeviceChange(listener: EventListener): () => void {
    document.addEventListener('jf-input-device-change', listener)
    return function () {
      document.removeEventListener('jf-input-device-change', listener)
    }
  }

  listDevices(): InputDeviceInfo[] {
    return Array.from(this.devices.values()).map(d => ({ id: d.id, name: d.name, type: d.type }))
  }

  getActiveId(): string | null { return this.activeId }

  setActive(id: string) { if (this.devices.has(id)) this.activeId = id }

  sample(): Vec2 {
    if (!this.activeId) return [0, 0]
    const dev = this.devices.get(this.activeId)
    return dev ? dev.sample() : [0, 0]
  }
}

export const Input = new InputManagerImpl()
