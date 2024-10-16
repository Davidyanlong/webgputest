

const chunkWidth = $chunkWidth$;
const chunkHeight = $chunkHeight$;
const chunkSize = $chunkSize$;

struct Uniforms {
    stride : u32,
};

@group(0) @binding(0) var<storage, read_write> chunks : array<array<u32, chunkSize>>;
@group(0) @binding(1) var<uniform> uni : Uniforms;

@compute @workgroup_size(chunkSize, 1, 1) fn cs(
@builtin(local_invocation_id) local_invocation_id : vec3u,
@builtin(workgroup_id) workgroup_id : vec3u,
)
{
    let chunk0 = workgroup_id.x * uni.stride * 2;
    let chunk1 = chunk0 + uni.stride;

    let sum = chunks[chunk0][local_invocation_id.x] +
    chunks[chunk1][local_invocation_id.x];
    chunks[chunk0][local_invocation_id.x] = sum;
}
