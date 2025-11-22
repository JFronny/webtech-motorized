import './style.css'
import { initUploadScreen } from './scenes/uploadScene.tsx'
import {initGameScreen} from './scenes/gameScene.tsx'
import { Input } from './input/input.ts'

const container = document.querySelector<HTMLDivElement>('#app')!
container.innerHTML = ''

// 1) Show upload screen; on success, switch to game scene
// Ensure input system is ready before showing upload (for device list)
Input.init()

initUploadScreen(container, async (ctx, buffer, analysis) => {
  // Build game root
  await initGameScreen(container, ctx, buffer, analysis)
})
