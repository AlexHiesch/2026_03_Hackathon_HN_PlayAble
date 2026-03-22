#version 300 es
precision mediump float;

uniform sampler2D tex;
uniform float time;
uniform float wavyness;
uniform float bitcrush;
uniform float hue_shift;
uniform float chromatic_aberration;
uniform float line_glitch;
uniform float scanline_intensity;
uniform float curvature;
uniform float vignette_intensity;
uniform vec2 resolution;

in vec2 uvs;
out vec4 f_color;

// --- Color space helpers ---
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

// --- Barrel distortion for CRT curvature ---
vec2 barrel(vec2 uv, float amt) {
    vec2 cc = uv - 0.5;
    float dist = dot(cc, cc);
    return uv + cc * dist * amt;
}

void main() {
    // Apply CRT curvature
    vec2 uv = barrel(uvs, curvature);

    // Out-of-bounds → black
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        f_color = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // Waviness
    uv.x += sin(uv.y * 10.0 + time) * wavyness;

    // Line glitch
    if (rand(vec2(time, floor(uv.y * 480.0) / 480.0)) < line_glitch) {
        discard;
    }

    // Chromatic aberration
    float redOffset = -chromatic_aberration * 0.015;
    float blueOffset = chromatic_aberration * 0.02;
    vec2 direction = vec2(sin(time), cos(time));

    vec3 color;
    color.r = texture(tex, uv + direction * redOffset).r;
    color.g = texture(tex, uv).g;
    color.b = texture(tex, uv + direction * blueOffset).b;

    // Hue shift
    if (hue_shift > 0.001) {
        vec3 hsv = rgb2hsv(color);
        hsv.x = fract(hsv.x + hue_shift);
        color = hsv2rgb(hsv);
    }

    // Bitcrush
    if (bitcrush < 255.0) {
        color = floor(color * bitcrush) / bitcrush;
    }

    // Scanlines — darken every other output pixel row
    if (scanline_intensity > 0.0) {
        float scanline = sin(uvs.y * resolution.y * 3.14159) * 0.5 + 0.5;
        color *= 1.0 - scanline_intensity * (1.0 - scanline);
    }

    // Vignette — darken corners
    if (vignette_intensity > 0.0) {
        vec2 vig = uvs * (1.0 - uvs);
        float v = vig.x * vig.y * 15.0;
        v = clamp(pow(v, vignette_intensity * 0.5), 0.0, 1.0);
        color *= v;
    }

    f_color = vec4(color, 1.0);
}
