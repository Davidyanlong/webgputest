struct OurVertexShaderOutput {
    @builtin(position) position : vec4f,
    //数据传递方式 perspective linear flat
    @location(1) @interpolate(linear) z : f32
};

@vertex fn vs(
@builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
    let pos = array(
        vec2f(0.0, 0.5),                //top center
        vec2f(-0.5, -0.5),              //bottom left
        vec2f(0.5, -0.5)                //bottom right
    );

    var vsOutput : OurVertexShaderOutput;
    vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    vsOutput.z = abs(vsOutput.position.x + 0.5);
    return vsOutput;
}
