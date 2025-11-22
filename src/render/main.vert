// Basic vertex shader for rendering the canvas content
// This remaps coordinates to 0-1 range and flips the Y axis for texture mapping

attribute vec2 a_position;
varying vec2 v_texCoord;

void main() {
  v_texCoord = vec2(a_position.x * 0.5, a_position.y * -0.5) + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}