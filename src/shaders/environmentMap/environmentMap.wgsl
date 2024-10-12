struct Uniforms {
    projection : mat4x4f,
    view : mat4x4f,
    world : mat4x4f,
    cameraPosition : vec3f,
};

// 输入的顶点数据
struct Vertex {
    @location(0) position : vec4f,
    @location(1) normal : vec3f,
};

struct VSOutput {
    @builtin(position) position : vec4f,
    @location(0) worldPosition : vec3f,
    @location(1) worldNormal : vec3f,
};

@group(0) @binding(0) var<uniform> uni : Uniforms;
@group(0) @binding(1) var ourSampler : sampler;
@group(0) @binding(2) var ourTexture : texture_cube < f32>;

@vertex fn vs(vert : Vertex) -> VSOutput {
    var vsOut : VSOutput;
    vsOut.position = uni.projection * uni.view * uni.world * vert.position;
    vsOut.worldPosition = (uni.world * vert.position).xyz;
    vsOut.worldNormal = (uni.world * vec4f(vert.normal, 0)).xyz;
    return vsOut;
}

@fragment fn fs(vsOut : VSOutput) -> @location(0) vec4f {
    let worldNormal = normalize(vsOut.worldNormal);
    // 每个点到相机的向量
    let eyeToSurfaceDir = normalize(vsOut.worldPosition - uni.cameraPosition);
    // 反射方向
    let direction = reflect(eyeToSurfaceDir, worldNormal);
    // 反转Z， 使用左手系坐标
    return textureSample(ourTexture, ourSampler, direction * vec3f(1, 1, -1));
}
