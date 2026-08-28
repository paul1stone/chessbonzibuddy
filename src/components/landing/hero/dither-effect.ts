import { Effect } from "postprocessing";
import { Uniform } from "three";

// 4x4 ordered (Bayer) dither with per-channel quantization. Runs after the low-res render.
const fragmentShader = /* glsl */ `
uniform float levels;

float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float threshold = bayer4(gl_FragCoord.xy) - 0.5;
  vec3 c = inputColor.rgb + threshold / levels;
  outputColor = vec4(floor(c * levels + 0.5) / levels, inputColor.a);
}
`;

export class DitherEffect extends Effect {
  constructor({ levels = 6 }: { levels?: number } = {}) {
    super("DitherEffect", fragmentShader, {
      uniforms: new Map<string, Uniform>([["levels", new Uniform(levels)]]),
    });
  }
}
