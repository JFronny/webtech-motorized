precision mediump float;
uniform sampler2D u_texture;
varying vec2 v_texCoord;

uniform float u_aberration;
uniform float u_bloom;
uniform vec2 u_resolution;
uniform float u_time;

void main() {
  // --- Lens Distortion ---
  float distortion = 0.5;
  float scale = 1.8;

  vec2 centeredCoord = v_texCoord - 0.5;
  float radius = length(centeredCoord);
  vec2 distortedCoord = centeredCoord * scale * (1.0 - distortion * pow(radius, 2.0));
  vec2 finalCoord = distortedCoord + 0.5;

  if (finalCoord.x < 0.0 || finalCoord.x > 1.0 || finalCoord.y < 0.0 || finalCoord.y > 1.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // --- Chromatic Aberration ---
  vec2 center = vec2(0.5, 0.5);
  vec2 dir = finalCoord - center;
  float dist = length(dir);
  float pulse = 4.0; //0.9 + 0.2 * sin(u_time * 0.5);
  float radialFactor = pow(dist, 1.5) * pulse;
  vec2 texel = 1.0 / u_resolution;

  float aberration = u_aberration * (0.5 + 0.5 * sin(u_time * 0.5)); // Pulsing effect
  vec2 rOffset = normalize(dir) * (u_aberration * radialFactor) * vec2(texel.x, texel.y);
  vec2 gOffset = vec2(0.0);
  vec2 bOffset = -rOffset * 0.9;

  vec4 rValue = texture2D(u_texture, finalCoord - rOffset);
  vec4 gValue = texture2D(u_texture, finalCoord - gOffset);
  vec4 bValue = texture2D(u_texture, finalCoord - bOffset);

  // Combine the offset colors.
  vec3 caColor = vec3(rValue.r, gValue.g, bValue.b);

  // --- Bloom (simplified) ---
  vec3 bloomColor = vec3(0.0);
//  if (u_bloom > 0.0) {
//    const int blurRadius = 4;
//    float totalWeight = 0.0;
//    vec2 texelSize = 1.0 / u_resolution;
//
//    for (int x = -blurRadius; x <= blurRadius; x++) {
//      for (int y = -blurRadius; y <= blurRadius; y++) {
//        float weight = 1.0;
//        vec2 offset = vec2(x, y) * texelSize * 2.0; // increase blur spread
//        vec4 sampleColor = texture2D(u_texture, finalCoord + offset);
//
//        float brightness = dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114));
//        if (brightness > 0.6) { // threshold
//          bloomColor += sampleColor * weight;
//          totalWeight += weight;
//        }
//      }
//    }
//    if (totalWeight > 0.0) {
//      bloomColor /= totalWeight;
//    }
//  }

  // --- Combine ---
  vec4 finalColor = vec4(caColor + bloomColor * u_bloom, 1.0);
  gl_FragColor = finalColor;
}