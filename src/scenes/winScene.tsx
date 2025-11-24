import JSX from "src/jsx";
import { initUploadScreen } from "src/scenes/uploadScene.tsx";

// The restart action just replaces the page content with the upload screen again

export function initWinScreen(root: HTMLElement) {
  root.replaceChildren(
    <div class="intro-root">
      <h1>You Win!</h1>
      <button class="btn" onclick={(_: any) => initUploadScreen(root)}>
        Play Again
      </button>
    </div>,
  );
}
