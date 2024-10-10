export function createFVertices() {
  const vertexData = new Float32Array([
    // left column
    0, 0,
    30, 0,
    0, 150,
    30, 150,

    // top rung
    30, 0,
    100, 0,
    30, 30,
    100, 30,

    // middle rung
    30, 60,
    70, 60,
    30, 90,
    70, 90,
  ]);

  const indexData = new Uint32Array([
    0, 1, 2, 2, 1, 3,  // left column
    4, 5, 6, 6, 5, 7,  // top run
    8, 9, 10, 10, 9, 11,  // middle run
  ]);

  return {
    vertexData,
    indexData,
    numVertices: indexData.length,
  };
}

export function create3DFVertices() {
  const positions = [
    // left column
    0, 0, 0,
    30, 0, 0,
    0, 150, 0,
    30, 150, 0,

    // top rung
    30, 0, 0,
    100, 0, 0,
    30, 30, 0,
    100, 30, 0,

    // middle rung
    30, 60, 0,
    70, 60, 0,
    30, 90, 0,
    70, 90, 0,

    // left column back
    0, 0, 30,
    30, 0, 30,
    0, 150, 30,
    30, 150, 30,

    // top rung back
    30, 0, 30,
    100, 0, 30,
    30, 30, 30,
    100, 30, 30,

    // middle rung back
    30, 60, 30,
    70, 60, 30,
    30, 90, 30,
    70, 90, 30,
  ];

  const indices = [
    // front
    0, 1, 2, 2, 1, 3,  // left column
    4, 5, 6, 6, 5, 7,  // top run
    8, 9, 10, 10, 9, 11,  // middle run

    // back
    12, 14, 13, 14, 15, 13,  // left column back
    16, 18, 17, 18, 19, 17,  // top run back
    20, 22, 21, 22, 23, 21,  // middle run back

    0, 12, 5, 12, 17, 5,   // top
    5, 17, 7, 17, 19, 7,   // top rung right
    6, 7, 18, 18, 7, 19,   // top rung bottom
    6, 18, 8, 18, 20, 8,   // between top and middle rung
    8, 20, 9, 20, 21, 9,   // middle rung top
    9, 21, 11, 21, 23, 11,  // middle rung right
    10, 11, 22, 22, 11, 23,  // middle rung bottom
    10, 22, 3, 22, 15, 3,   // stem right
    2, 3, 14, 14, 3, 15,   // bottom
    0, 2, 12, 12, 2, 14,   // left
  ];

  const quadColors = [
    200, 70, 120,  // left column front
    200, 70, 120,  // top rung front
    200, 70, 120,  // middle rung front

    80, 70, 200,  // left column back
    80, 70, 200,  // top rung back
    80, 70, 200,  // middle rung back

    70, 200, 210,  // top
    160, 160, 220,  // top rung right
    90, 130, 110,  // top rung bottom
    200, 200, 70,  // between top and middle rung
    210, 100, 70,  // middle rung top
    210, 160, 70,  // middle rung right
    70, 180, 210,  // middle rung bottom
    100, 70, 210,  // stem right
    76, 210, 100,  // bottom
    140, 210, 80,  // left
  ];

  const numVertices = indices.length;
  const vertexData = new Float32Array(numVertices * 4); // xyz + color
  const colorData = new Uint8Array(vertexData.buffer);

  for (let i = 0; i < indices.length; ++i) {
    const positionNdx = indices[i] * 3;
    const position = positions.slice(positionNdx, positionNdx + 3);
    vertexData.set(position, i * 4);

    const quadNdx = (i / 6 | 0) * 3;
    const color = quadColors.slice(quadNdx, quadNdx + 3);
    colorData.set(color, i * 16 + 12);
    colorData[i * 16 + 15] = 255;
  }

  return {
    vertexData,
    numVertices,
  };
}


export function createFVerticesCCW() {
  const positions = [
    // left column
    -50, 75, 15,
    -20, 75, 15,
    -50, -75, 15,
    -20, -75, 15,

    // top rung
    -20, 75, 15,
    50, 75, 15,
    -20, 45, 15,
    50, 45, 15,

    // middle rung
    -20, 15, 15,
    20, 15, 15,
    -20, -15, 15,
    20, -15, 15,

    // left column back
    -50, 75, -15,
    -20, 75, -15,
    -50, -75, -15,
    -20, -75, -15,

    // top rung back
    -20, 75, -15,
    50, 75, -15,
    -20, 45, -15,
    50, 45, -15,

    // middle rung back
    -20, 15, -15,
    20, 15, -15,
    -20, -15, -15,
    20, -15, -15,
  ];

  const indices = [
    0, 2, 1, 2, 3, 1,   // left column
    4, 6, 5, 6, 7, 5,   // top run
    8, 10, 9, 10, 11, 9,   // middle run

    12, 13, 14, 14, 13, 15,   // left column back
    16, 17, 18, 18, 17, 19,   // top run back
    20, 21, 22, 22, 21, 23,   // middle run back

    0, 5, 12, 12, 5, 17,   // top
    5, 7, 17, 17, 7, 19,   // top rung right
    6, 18, 7, 18, 19, 7,   // top rung bottom
    6, 8, 18, 18, 8, 20,   // between top and middle rung
    8, 9, 20, 20, 9, 21,   // middle rung top
    9, 11, 21, 21, 11, 23,   // middle rung right
    10, 22, 11, 22, 23, 11,   // middle rung bottom
    10, 3, 22, 22, 3, 15,   // stem right
    2, 14, 3, 14, 15, 3,   // bottom
    0, 12, 2, 12, 14, 2,   // left
  ];

  const quadColors = [
    200, 70, 120,  // left column front
    200, 70, 120,  // top rung front
    200, 70, 120,  // middle rung front

    80, 70, 200,  // left column back
    80, 70, 200,  // top rung back
    80, 70, 200,  // middle rung back

    70, 200, 210,  // top
    160, 160, 220,  // top rung right
    90, 130, 110,  // top rung bottom
    200, 200, 70,  // between top and middle rung
    210, 100, 70,  // middle rung top
    210, 160, 70,  // middle rung right
    70, 180, 210,  // middle rung bottom
    100, 70, 210,  // stem right
    76, 210, 100,  // bottom
    140, 210, 80,  // left
  ];

  const numVertices = indices.length;
  const vertexData = new Float32Array(numVertices * 4); // xyz + color
  const colorData = new Uint8Array(vertexData.buffer);

  for (let i = 0; i < indices.length; ++i) {
    const positionNdx = indices[i] * 3;
    const position = positions.slice(positionNdx, positionNdx + 3);
    vertexData.set(position, i * 4);

    const quadNdx = (i / 6 | 0) * 3;
    const color = quadColors.slice(quadNdx, quadNdx + 3);
    colorData.set(color, i * 16 + 12);
    colorData[i * 16 + 15] = 255;
  }

  return {
    vertexData,
    numVertices,
  };
}


export function createFVerticesNormal() {
  const positions = [
    // left column
    -50, 75, 15,
    -20, 75, 15,
    -50, -75, 15,
    -20, -75, 15,

    // top rung
    -20, 75, 15,
    50, 75, 15,
    -20, 45, 15,
    50, 45, 15,

    // middle rung
    -20, 15, 15,
    20, 15, 15,
    -20, -15, 15,
    20, -15, 15,

    // left column back
    -50, 75, -15,
    -20, 75, -15,
    -50, -75, -15,
    -20, -75, -15,

    // top rung back
    -20, 75, -15,
    50, 75, -15,
    -20, 45, -15,
    50, 45, -15,

    // middle rung back
    -20, 15, -15,
    20, 15, -15,
    -20, -15, -15,
    20, -15, -15,
  ];

  const indices = [
    0, 2, 1, 2, 3, 1,   // left column
    4, 6, 5, 6, 7, 5,   // top run
    8, 10, 9, 10, 11, 9,   // middle run

    12, 13, 14, 14, 13, 15,   // left column back
    16, 17, 18, 18, 17, 19,   // top run back
    20, 21, 22, 22, 21, 23,   // middle run back

    0, 5, 12, 12, 5, 17,   // top
    5, 7, 17, 17, 7, 19,   // top rung right
    6, 18, 7, 18, 19, 7,   // top rung bottom
    6, 8, 18, 18, 8, 20,   // between top and middle rung
    8, 9, 20, 20, 9, 21,   // middle rung top
    9, 11, 21, 21, 11, 23,   // middle rung right
    10, 22, 11, 22, 23, 11,   // middle rung bottom
    10, 3, 22, 22, 3, 15,   // stem right
    2, 14, 3, 14, 15, 3,   // bottom
    0, 12, 2, 12, 14, 2,   // left
  ];

  const normals = [
    0, 0, 1,  // left column front
    0, 0, 1,  // top rung front
    0, 0, 1,  // middle rung front

    0, 0, -1,  // left column back
    0, 0, -1,  // top rung back
    0, 0, -1,  // middle rung back

    0, 1, 0,  // top
    1, 0, 0,  // top rung right
    0, -1, 0,  // top rung bottom
    1, 0, 0,  // between top and middle rung
    0, 1, 0,  // middle rung top
    1, 0, 0,  // middle rung right
    0, -1, 0,  // middle rung bottom
    1, 0, 0,  // stem right
    0, -1, 0,  // bottom
    -1, 0, 0,  // left
  ];

  const numVertices = indices.length;
  const vertexData = new Float32Array(numVertices * 6); // xyz + normal

  for (let i = 0; i < indices.length; ++i) {
    const positionNdx = indices[i] * 3;
    const position = positions.slice(positionNdx, positionNdx + 3);
    vertexData.set(position, i * 6);

    const quadNdx = (i / 6 | 0) * 3;
    const normal = normals.slice(quadNdx, quadNdx + 3);
    vertexData.set(normal, i * 6 + 3);
  }

  return {
    vertexData,
    numVertices,
  };
}