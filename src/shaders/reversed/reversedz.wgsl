struct Uniforms {
  modelMatrix : array<mat4x4f, 5>,
}
struct Camera {
  viewProjectionMatrix : mat4x4f,
}

@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<uniform> camera : Camera;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragColor : vec4f,
}

@vertex
fn vs(
  @builtin(instance_index) instanceIdx : u32,
  @location(0) position : vec4f,
  @location(1) color : vec4f
) -> VertexOutput {
  var output : VertexOutput;
  output.Position = camera.viewProjectionMatrix * uniforms.modelMatrix[instanceIdx] * vec4f(position.xyz,1);
  output.fragColor = color;
  return output;
}

@fragment
fn fs(
  @location(0) fragColor: vec4f
) -> @location(0) vec4f {
  return fragColor;
}
