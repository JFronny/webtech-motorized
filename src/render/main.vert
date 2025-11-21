attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  float dist = length(a_position);
  float factor = 1.0 - pow(dist, 2.0) * 0.2;// + smoothstep(0.0, 1.0, dist) * 0.2;
  vec2 exploded = vec2(a_position.x * factor, a_position.y * factor);
  v_texCoord = vec2(exploded.x * 0.5, exploded.y * -0.5) + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}