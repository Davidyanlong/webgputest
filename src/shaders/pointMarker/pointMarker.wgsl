struct Vertex {
    @location(0) position : vec2f,
    @location(1) size : f32,
    @location(2) rotation : f32,
};

struct Uniforms {
    resolution : vec2f,
};

struct VSOutput {
    @builtin(position) position : vec4f,
    @location(0) texcoord : vec2f,
};

@group(0) @binding(0) var<uniform> uni : Uniforms;

@vertex fn vs(
vert : Vertex,
@builtin(vertex_index) vNdx : u32,
) -> VSOutput {
    let points = array(
    vec2f(-1, -1),
    vec2f(1, -1),
    vec2f(-1, 1),
    vec2f(-1, 1),
    vec2f(1, -1),
    vec2f(1, 1),
    );
    var vsOut : VSOutput;
    let pos = points[vNdx];
    let c = cos(vert.rotation);
    let s = sin(vert.rotation);
    let rot = mat2x2f(
    c, s,
    -s, c,
    );
    
    vsOut.position = vec4f(vert.position + rot * pos * vert.size / uni.resolution, 0, 1);
    vsOut.texcoord = pos * 0.5 + 0.5;
    return vsOut;
}

@group(0) @binding(1) var s : sampler;
@group(0) @binding(2) var t : texture_2d<f32>;

@fragment fn fs(vsOut : VSOutput) -> @location(0) vec4f {
    return textureSample(t, s, vsOut.texcoord);
}
