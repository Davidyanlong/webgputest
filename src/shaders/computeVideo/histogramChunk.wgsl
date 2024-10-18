const chunkWidth = $chunkWidth$;
const chunkHeight = $chunkHeight$;
const chunkSize = $chunkSize$;

var<workgroup> bins : array<array<atomic < u32>, 4>, chunkSize>;
@group(0) @binding(0) var<storage, read_write> chunks : array<array<vec4u, chunkSize>>;
@group(0) @binding(1) var ourTexture : texture_external;

const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
fn srgbLuminance(color : vec3f) -> f32 {
    return saturate(dot(color, kSRGBLuminanceFactors));
}

@compute @workgroup_size(chunkWidth, chunkHeight, 1)
fn cs(
@builtin(workgroup_id) workgroup_id : vec3u,
@builtin(local_invocation_id) local_invocation_id : vec3u,
)
{
    let size = textureDimensions(ourTexture);
    let position = workgroup_id.xy * vec2u(chunkWidth, chunkHeight) +
    local_invocation_id.xy;
    if (all(position < size))
    {
        let numBins = f32(chunkSize);
        let lastBinIndex = u32(numBins - 1);
        var channels = textureLoad(ourTexture, position);
        channels.w = srgbLuminance(channels.rgb);
        for (var ch = 0; ch < 4; ch++)
        {
            let v = channels[ch];
            let bin = min(u32(v * numBins), lastBinIndex);
            atomicAdd(&bins[bin][ch], 1u);
        }
    }
    // 一个组完全执行完再写入chunks
    workgroupBarrier();

    let chunksAcross = (size.x + chunkWidth - 1) / chunkWidth;
    let chunk = workgroup_id.y * chunksAcross + workgroup_id.x;
    let bin = local_invocation_id.y * chunkWidth + local_invocation_id.x;

    chunks[chunk][bin] = vec4u(
    atomicLoad(&bins[bin][0]),
    atomicLoad(&bins[bin][1]),
    atomicLoad(&bins[bin][2]),
    atomicLoad(&bins[bin][3]),
    );
}
