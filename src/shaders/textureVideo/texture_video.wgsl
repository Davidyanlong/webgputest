struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};
 
struct Uniforms {
  matrix: mat4x4f,
};
 
@group(0) @binding(2) var<uniform> uni: Uniforms;
 
@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
  let pos = array(
    // 1st triangle
    vec2f( 0.0,  0.0),  // center
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 0.0,  1.0),  // center, top
 
    // 2nd triangle
    vec2f( 0.0,  1.0),  // center, top
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 1.0,  1.0),  // right, top
  );
 
  var vsOutput: OurVertexShaderOutput;
  let xy = pos[vertexIndex];
  vsOutput.position = uni.matrix * vec4f(xy, 0.0, 1.0);
  vsOutput.texcoord = xy;
  return vsOutput;
}
 
@group(0) @binding(0) var ourSampler: sampler;
// texture_external 视频专用格式
@group(0) @binding(1) var ourTexture: texture_external;
 
@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {

  // 视频专用采用方式  
  return textureSampleBaseClampToEdge(
      ourTexture,
      ourSampler,
      fsInput.texcoord,
  );
}