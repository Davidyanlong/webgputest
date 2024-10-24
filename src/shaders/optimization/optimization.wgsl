// 全局通用的 UNIFORM 
struct GlobalUniforms {
    viewProjection : mat4x4f,
    lightWorldPosition : vec3f,
    viewWorldPosition : vec3f,
};

// 材质相关的 UNIFORMs
struct MaterialUniforms {
    color : vec4f,
    shininess : f32,
};

// 每帧都需要变化的数据
struct PerObjectUniforms {
    normalMatrix : mat3x3f,
    world : mat4x4f,
};

// 输入的顶点数据结构
struct Vertex {
    @location(0) position : vec4f,
    @location(1) normal : vec3f,
    @location(2) texcoord : vec2f,
};

// 顶点着色器输出的结果
struct VSOutput {
    @builtin(position) position : vec4f,
    @location(0) normal : vec3f,
    @location(1) surfaceToLight : vec3f,
    @location(2) surfaceToView : vec3f,
    @location(3) texcoord : vec2f,
};


@group(0) @binding(0) var diffuseTexture : texture_2d<f32>;
@group(0) @binding(1) var diffuseSampler : sampler;
@group(0) @binding(2) var<uniform> obj : PerObjectUniforms;
@group(0) @binding(3) var<uniform> glb : GlobalUniforms;
@group(0) @binding(4) var<uniform> material : MaterialUniforms;

@vertex fn vs(vert : Vertex) -> VSOutput {
    var vsOut : VSOutput;
    vsOut.position = glb.viewProjection * obj.world * vert.position;

        //Orient the normals and pass to the fragment shader
    vsOut.normal = obj.normalMatrix * vert.normal;

        //Compute the world position of the surface
    let surfaceWorldPosition = (obj.world * vert.position).xyz;

        //Compute the vector of the surface to the light
        //and pass it to the fragment shader
    vsOut.surfaceToLight = glb.lightWorldPosition - surfaceWorldPosition;

        //Compute the vector of the surface to the light
        //and pass it to the fragment shader
    vsOut.surfaceToView = glb.viewWorldPosition - surfaceWorldPosition;

        //Pass the texture coord on to the fragment shader
    vsOut.texcoord = vert.texcoord;

    return vsOut;
}

@fragment fn fs(vsOut : VSOutput) -> @location(0) vec4f {
        //Because vsOut.normal is an inter-stage variable
        //it's interpolated so it will not be a unit vector.
        //Normalizing it will make it a unit vector again
    let normal = normalize(vsOut.normal);

    let surfaceToLightDirection = normalize(vsOut.surfaceToLight);
    let surfaceToViewDirection = normalize(vsOut.surfaceToView);
    let halfVector = normalize(
    surfaceToLightDirection + surfaceToViewDirection);

        //Compute the light by taking the dot product
        //of the normal with the direction to the light
    let light = dot(normal, surfaceToLightDirection);

    var specular = dot(normal, halfVector);
    specular = select(
    0.0,                                //value if condition is false
    pow(specular, material.shininess),          //value if condition is true
    specular > 0.0);                    //condition

    let diffuse = material.color * textureSample(diffuseTexture, diffuseSampler, vsOut.texcoord);
    //Lets multiply just the color portion (not the alpha)
    //by the light
    let color = diffuse.rgb * light + specular;
    return vec4f(color, diffuse.a);
}
