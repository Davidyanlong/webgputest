function generateFace(size: number, { faceColor, textColor, text }: { faceColor: string, textColor: string, text: string }) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = faceColor;
    ctx.fillRect(0, 0, size, size);
    ctx.font = `${size * 0.7}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.fillText(text, size / 2, size / 2);
    return canvas;
}

/**
 * layer 0 => positive x
 * layer 1 => negative x
 * layer 2 => positive y
 * layer 3 => negative y
 * layer 4 => positive z
 * layer 5 => negative z
 */

const faceSize = 128;
const faceCanvases = [
    { faceColor: '#F00', textColor: '#0FF', text: '+X' },
    { faceColor: '#FF0', textColor: '#00F', text: '-X' },
    { faceColor: '#0F0', textColor: '#F0F', text: '+Y' },
    { faceColor: '#0FF', textColor: '#F00', text: '-Y' },
    { faceColor: '#00F', textColor: '#FF0', text: '+Z' },
    { faceColor: '#F0F', textColor: '#0F0', text: '-Z' },
].map(faceInfo => generateFace(faceSize, faceInfo));


function createCubeVertices() {
    const vertexData = new Float32Array([
        // front face
        -1, 1, 1,
        -1, -1, 1,
        1, 1, 1,
        1, -1, 1,
        // right face
        1, 1, -1,
        1, 1, 1,
        1, -1, -1,
        1, -1, 1,
        // back face
        1, 1, -1,
        1, -1, -1,
        -1, 1, -1,
        -1, -1, -1,
        // left face
        -1, 1, 1,
        -1, 1, -1,
        -1, -1, 1,
        -1, -1, -1,
        // bottom face
        1, -1, 1,
        -1, -1, 1,
        1, -1, -1,
        -1, -1, -1,
        // top face
        -1, 1, 1,
        1, 1, 1,
        -1, 1, -1,
        1, 1, -1,
    ]);

    const indexData = new Uint16Array([
        0, 1, 2, 2, 1, 3,  // front
        4, 5, 6, 6, 5, 7,  // right
        8, 9, 10, 10, 9, 11,  // back
        12, 13, 14, 14, 13, 15,  // left
        16, 17, 18, 18, 17, 19,  // bottom
        20, 21, 22, 22, 21, 23,  // top
    ]);

    return {
        vertexData,
        indexData,
        numVertices: indexData.length,
    };
}

function createCubeVerticesAndNormal() {
    const vertexData = new Float32Array([
        //  position   |  normals
        //-------------+----------------------
        // front face      positive z
        -1, 1, 1, 0, 0, 1,
        -1, -1, 1, 0, 0, 1,
        1, 1, 1, 0, 0, 1,
        1, -1, 1, 0, 0, 1,
        // right face      positive x
        1, 1, -1, 1, 0, 0,
        1, 1, 1, 1, 0, 0,
        1, -1, -1, 1, 0, 0,
        1, -1, 1, 1, 0, 0,
        // back face       negative z
        1, 1, -1, 0, 0, -1,
        1, -1, -1, 0, 0, -1,
        -1, 1, -1, 0, 0, -1,
        -1, -1, -1, 0, 0, -1,
        // left face        negative x
        -1, 1, 1, -1, 0, 0,
        -1, 1, -1, -1, 0, 0,
        -1, -1, 1, -1, 0, 0,
        -1, -1, -1, -1, 0, 0,
        // bottom face      negative y
        1, -1, 1, 0, -1, 0,
        -1, -1, 1, 0, -1, 0,
        1, -1, -1, 0, -1, 0,
        -1, -1, -1, 0, -1, 0,
        // top face         positive y
        -1, 1, 1, 0, 1, 0,
        1, 1, 1, 0, 1, 0,
        -1, 1, -1, 0, 1, 0,
        1, 1, -1, 0, 1, 0,
    ]);

    const indexData = new Uint16Array([
        0, 1, 2, 2, 1, 3,  // front
        4, 5, 6, 6, 5, 7,  // right
        8, 9, 10, 10, 9, 11,  // back
        12, 13, 14, 14, 13, 15,  // left
        16, 17, 18, 18, 17, 19,  // bottom
        20, 21, 22, 22, 21, 23,  // top
    ]);

    return {
        vertexData,
        indexData,
        numVertices: indexData.length,
    };
}


function createCubeVertices_Normal_Texcoord() {
    const vertexData = new Float32Array([
        // position       normal        texcoord
        1, 1, -1, 1, 0, 0, 1, 0,
        1, 1, 1, 1, 0, 0, 0, 0,
        1, -1, 1, 1, 0, 0, 0, 1,
        1, -1, -1, 1, 0, 0, 1, 1,
        -1, 1, 1, -1, 0, 0, 1, 0,
        -1, 1, -1, -1, 0, 0, 0, 0,
        -1, -1, -1, -1, 0, 0, 0, 1,
        -1, -1, 1, -1, 0, 0, 1, 1,
        -1, 1, 1, 0, 1, 0, 1, 0,
        1, 1, 1, 0, 1, 0, 0, 0,
        1, 1, -1, 0, 1, 0, 0, 1,
        -1, 1, -1, 0, 1, 0, 1, 1,
        -1, -1, -1, 0, -1, 0, 1, 0,
        1, -1, -1, 0, -1, 0, 0, 0,
        1, -1, 1, 0, -1, 0, 0, 1,
        -1, -1, 1, 0, -1, 0, 1, 1,
        1, 1, 1, 0, 0, 1, 1, 0,
        -1, 1, 1, 0, 0, 1, 0, 0,
        -1, -1, 1, 0, 0, 1, 0, 1,
        1, -1, 1, 0, 0, 1, 1, 1,
        -1, 1, -1, 0, 0, -1, 1, 0,
        1, 1, -1, 0, 0, -1, 0, 0,
        1, -1, -1, 0, 0, -1, 0, 1,
        -1, -1, -1, 0, 0, -1, 1, 1,
    ]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]);
    const numVertices = indices.length;

    return {
        vertexData,
        indices,
        numVertices
    }
}


export {
    faceCanvases,
    createCubeVertices,
    createCubeVerticesAndNormal,
    createCubeVertices_Normal_Texcoord
}