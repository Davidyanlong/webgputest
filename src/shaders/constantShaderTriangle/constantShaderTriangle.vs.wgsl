struct VOut {
  @builtin(position) pos : vec4f,
  @location(0) color : vec4f,
}

@vertex fn vs(
@builtin(vertex_index) vertexIndex : u32
) -> VOut {
  let pos = array(
  vec2f(0.0, 0.5),            //top center
  vec2f(-0.5, -0.5),          //bottom left
  vec2f(0.5, -0.5)            //bottom right
  );

  return VOut(
  vec4f(pos[vertexIndex], 0.0, 1.0),
  vec4f(red, green, blue, 1),
  );
}

override red = 0.0;
override green = 0.0;
override blue = 0.0;
