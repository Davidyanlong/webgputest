struct Vertex {
    @location(0) position : vec4f,
};

struct Uniforms {
    matrix : mat4x4f,
    resolution : vec2f,
    size : f32,
};

struct VSOutput {
    @builtin(position) position : vec4f,
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
    let clipPos = uni.matrix * vert.position;
    // 透视效果
    let pointPos = vec4f(pos * uni.size / uni.resolution, 0, 0);
    // 固定大小 透视是需要裁剪W值得相乘
    // let pointPos = vec4f(pos * uni.size / uni.resolution * clipPos.w, 0, 0);
    vsOut.position = clipPos + pointPos;
    return vsOut;
}

@fragment fn fs(vsOut : VSOutput) -> @location(0) vec4f {
    return vec4f(1, 0.5, 0.2, 1);
}
