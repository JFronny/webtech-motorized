import JSX from "src/jsx";

// Just reloading the page will get us back to the upload screen
// and ensure a fresh state.

export function initWinScreen(root: HTMLElement) {
  root.replaceChildren(
    <div class="intro-root">
      <h1>You Win!</h1>
      <button class="btn" onclick={() => window.location.reload()}>Play Again</button>
    </div>
  );
}
