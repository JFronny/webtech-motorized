import './style.css'
import {type Audio, initUploadScreen} from './scenes/uploadScene.tsx'
import {initGameScreen} from './scenes/gameScene.tsx'
import { Input } from './input/input.ts'

// Main entry point for the app
// From here on, we rely purely on JSX-built elements

const container = document.querySelector<HTMLDivElement>('#app')!
container.innerHTML = ''

// Ensure input system is ready before showing upload
// (since we need to list devices)
// This does not need to be async since we just use callbacks to fill in the data
Input.init()

initUploadScreen(container, async (audio: Audio) => {
  // Build game root
  await initGameScreen(container, audio)
})
