import "./style.css";
import { initUploadScreen } from "./scenes/uploadScene";

// Main entry point for the app
// From here on, we rely purely on JSX-built elements

const container = document.querySelector<HTMLDivElement>("#app")!;
container.innerHTML = "";

initUploadScreen(container);
