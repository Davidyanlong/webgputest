struct OurVertexShaderOutput {
    @builtin(position) position : vec4f,
    @location(0) texcoord : vec2f,
};

struct Uniforms {
    matrix : mat4x4f,
    colors : array<vec4f, 16>,
    channelMult : vec4u,
};

@group(0) @binding(0) var<storage, read> bins : array<vec4u>;
@group(0) @binding(1) var<uniform> uni : Uniforms;
@group(0) @binding(2) var<storage, read_write> scale : vec4f;

@vertex fn vs(
@builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
    let pos = array(
    vec2f(0.0, 0.0),        //center
    vec2f(1.0, 0.0),        //right, center
    vec2f(0.0, 1.0),        //center, top

    //2st triangle
    vec2f(0.0, 1.0),        //center, top
    vec2f(1.0, 0.0),        //right, center
    vec2f(1.0, 1.0),        //right, top
    );

    var vsOutput : OurVertexShaderOutput;
    let xy = pos[vertexIndex];
    vsOutput.position = uni.matrix * vec4f(xy, 0.0, 1.0);
    vsOutput.texcoord = xy;
    return vsOutput;
}

@fragment fn fs(fsInput : OurVertexShaderOutput) -> @location(0) vec4f {
    let numBins = arrayLength(&bins);
    let lastBinIndex = u32(numBins - 1);
    let bin = clamp(
    u32(fsInput.texcoord.x * f32(numBins)),
    0,
    lastBinIndex);
    let heights = vec4f(bins[bin]) * scale;
    let bits = heights > vec4f(fsInput.texcoord.y);
    let ndx = dot(select(vec4u(0), uni.channelMult, bits), vec4u(1));
    return uni.colors[ndx];
}
