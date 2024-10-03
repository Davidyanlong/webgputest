struct VOut {
  @builtin(position) pos : vec4f,
  @location(0) color : vec4f,
}

override red = 0.0;
override green = 0.0;
override blue = 0.0;

@fragment fn fs(v : VOut) -> @location(0) vec4f {
  let colorFromVertexShader = v.color;
  let colorFromFragmentShader = vec4f(red, green, blue, 1.0);
        //select one color or the other every 50 pixels
  return select(
  colorFromVertexShader,
  colorFromFragmentShader,
  v.pos.x % 20.0 > 10.0);
}
