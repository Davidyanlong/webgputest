@vertex fn vs(
@builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f(0.0, 0.5),        //top center
    vec2f(-0.5, -0.5),      //bottom left
    vec2f(0.5, -0.5)        //bottom right
  );

  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

struct output{
  @location(0) color1 : vec4f,
  @location(1) color2 : vec4f,
}
@fragment fn fs() -> output {
  var out : output;
  out.color1 = vec4f(1.0, 0.0, 0.0, 1.0);
  out.color2 = vec4f(1.0, 1.0, 0.0, 1.0);
  return out;
}
