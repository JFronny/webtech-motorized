declare module JSX {
  type Element = HTMLElement | Text
  interface IntrinsicElements {
    [elemName: string]: any
  }
}