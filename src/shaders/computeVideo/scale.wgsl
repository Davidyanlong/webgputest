@group(0) @binding(0) var<storage, read> bins : array<vec4u>;
@group(0) @binding(1) var<storage, read_write> scale : vec4f;
@group(0) @binding(2) var ourTexture : texture_external;

@compute @workgroup_size(1, 1, 1) fn cs()
{
    let size = textureDimensions(ourTexture);
    let numEntries = f32(size.x * size.y);
    var m = vec4u(0);
    let numBins = arrayLength(&bins);
    for (var i = 0u; i < numBins; i++)
    {
        m = max(m, bins[i]);
    }
    scale = max(1.0 / vec4f(m), vec4f(0.2 * f32(numBins) / numEntries));
}
