#version 300 es
in vec2 a_position;
out vec2 v_fragCoord;
uniform vec2 u_resolution;
void main() {
  v_fragCoord = (a_position * 0.5 + 0.5) * u_resolution;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
