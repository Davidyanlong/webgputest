struct Uniforms {
    matrix : mat4x4f,
};

struct Vertex {
    @location(0) position : vec4f,
};

struct VSOutput {
    @builtin(position) position : vec4f,
    @location(0) normal : vec3f,
};

@group(0) @binding(0) var<uniform> uni : Uniforms;
@group(0) @binding(1) var ourSampler : sampler;
// cube纹理类型为 texture_cube
@group(0) @binding(2) var ourTexture : texture_cube < f32>;

@vertex fn vs(vert : Vertex) -> VSOutput {
    var vsOut : VSOutput;
    vsOut.position = uni.matrix * vert.position;
    vsOut.normal = normalize(vert.position.xyz);
    return vsOut;
}

@fragment fn fs(vsOut : VSOutput) -> @location(0) vec4f {
    return textureSample(ourTexture, ourSampler, normalize(vsOut.normal));
}
