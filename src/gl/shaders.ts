/** Inline GLSL sources (no asset files). */

export const SKY_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
layout(location=2) in vec2 a_uv;
out vec2 v_uv;
void main(){
  v_uv = a_uv;
  gl_Position = vec4(a_pos.xy, 0.999, 1.0);
}`;

export const SKY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec3 u_high;
uniform vec3 u_mid;
uniform vec3 u_low;
out vec4 outColor;
void main(){
  float t = 1.0 - v_uv.y;
  vec3 c = mix(u_high, u_mid, smoothstep(0.0, 0.45, t));
  c = mix(c, u_low, smoothstep(0.35, 1.0, t));
  outColor = vec4(c, 1.0);
}`;

export const LIT_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
layout(location=2) in vec2 a_uv;
uniform mat4 u_viewProj;
uniform mat4 u_model;
out vec3 v_world;
out vec3 v_nrm;
out vec2 v_uv;
void main(){
  vec4 w = u_model * vec4(a_pos, 1.0);
  v_world = w.xyz;
  v_nrm = mat3(u_model) * a_nrm;
  v_uv = a_uv;
  gl_Position = u_viewProj * w;
}`;

export const LIT_FS = `#version 300 es
precision highp float;
in vec3 v_world;
in vec3 v_nrm;
in vec2 v_uv;
uniform vec3 u_albedo;
uniform vec3 u_lightDir;
uniform vec3 u_lightColor;
uniform vec3 u_ambient;
uniform float u_noiseAmt;
uniform sampler2D u_noise;
uniform int u_useNoise;
out vec4 outColor;
void main(){
  vec3 n = normalize(v_nrm);
  float ndl = max(0.0, dot(n, normalize(u_lightDir)));
  vec3 alb = u_albedo;
  if (u_useNoise == 1) {
    float g = texture(u_noise, v_uv * 4.0).r;
    alb *= mix(1.0 - u_noiseAmt, 1.0 + u_noiseAmt, g);
  }
  vec3 col = alb * (u_ambient + u_lightColor * ndl);
  float ao = smoothstep(0.0, 0.15, length(v_world.xz) * 0.001);
  col *= mix(0.85, 1.0, ao);
  outColor = vec4(col, 1.0);
}`;

export const SOLID_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
uniform mat4 u_viewProj;
uniform mat4 u_model;
out vec3 v_nrm;
void main(){
  v_nrm = mat3(u_model) * a_nrm;
  gl_Position = u_viewProj * u_model * vec4(a_pos, 1.0);
}`;

export const SOLID_FS = `#version 300 es
precision highp float;
in vec3 v_nrm;
uniform vec3 u_albedo;
uniform vec3 u_lightDir;
uniform float u_desat;
uniform float u_alpha;
out vec4 outColor;
void main(){
  vec3 n = normalize(v_nrm);
  float ndl = max(0.12, dot(n, normalize(u_lightDir)));
  vec3 c = u_albedo * (0.35 + 0.65 * ndl);
  float g = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(g), u_desat);
  outColor = vec4(c, u_alpha);
}`;

export const FX_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
uniform mat4 u_viewProj;
uniform vec3 u_center;
uniform float u_size;
void main(){
  vec3 p = u_center + a_pos * u_size;
  gl_Position = u_viewProj * vec4(p, 1.0);
  gl_PointSize = u_size * 18.0;
}`;

export const FX_FS = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;
void main(){
  // Drawn as triangle boxes (not GL_POINTS) — do not use gl_PointCoord.
  outColor = u_color;
}`;
