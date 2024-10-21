
export function createFibonacciSphereVertices({
    numSamples,
    radius,
}: { numSamples: number, radius: number }):Float32Array {
    const vertices = [];
    const increment = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < numSamples; ++i) {
        const offset = 2 / numSamples;
        const y = ((i * offset) - 1) + (offset / 2);
        const r = Math.sqrt(1 - Math.pow(y, 2));
        const phi = (i % numSamples) * increment;
        const x = Math.cos(phi) * r;
        const z = Math.sin(phi) * r;
        vertices.push(x * radius, y * radius, z * radius);
    }
    return new Float32Array(vertices);
}