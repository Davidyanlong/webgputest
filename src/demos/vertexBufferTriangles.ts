import { Base } from "../common/base";
import shadercode from '../shaders/vertexBufferTriangles/vertex_buffer_triangles.wgsl?raw'

/**
 * 渲染基本流程
 * bindGroup / uniform 学习
 *  顶点的结构信息是设置在renderpipeline
 *  渲染需要单独绑定顶点插槽
 */
export class VertexBufferTriangles extends Base{
    private static kColorOffset = 0;
    private static kScaleOffset = 0;
    private static kOffsetOffset = 1;
    private static changingUnitSize: number;

    private static kNumObjects = 100;
    private static changingVertexBuffer : GPUBuffer;
    private static staticVertexBuffer:GPUBuffer;
    private static vertexBuffer:GPUBuffer;
    private static indexBuffer:GPUBuffer;
    private static vertexValues:Float32Array;
    private static numVertices:number;
    private static objectInfos:{scale:number}[] = [];


    static async initialize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('vertexBufferTriangles')

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: shadercode,
        });

        //#endregion

        //#region  render pipeline
        VertexBufferTriangles.pipeline = device.createRenderPipeline({
            label: 'per vertex color',
            layout: 'auto',
            vertex: {
                module,
                buffers:[
                    {
                        arrayStride: 2 * 4 +  4 , // 2 floats, 4 bytes each
                        attributes:[
                            {   // position
                                shaderLocation:0,
                                offset:0,
                                format:'float32x2'
                            },
                            {   // perVertexColor
                                shaderLocation:4,
                                offset: 2 * 4,
                                format:'unorm8x4'
                            }
                        ]
                    },
                    {
                        arrayStride:  4 + 2 * 4, // 6 floats, 4 bytes each
                        stepMode:'instance',
                        attributes:[
                            {   // color
                                shaderLocation:1,
                                offset:0,
                                format:'unorm8x4'
                            },
                            {   // offset
                                shaderLocation:2,
                                offset: 4,   // color 4 floats,
                                format:'float32x2'
                            }

                        ]
                    },
                    {
                        arrayStride: 2 * 4, // 2 floats, 4 bytes each
                        stepMode:'instance',
                        attributes:[
                            {   // scale
                                shaderLocation:3,
                                offset:0,
                                format:'float32x2'
                            }
                        ]
                    }
                ]
            },
            fragment: {
                module,
                targets: [
                    { format: this.presentationFormat },
                ],
            },
        });

        //#endregion


        // create 2 buffers for the uniform values
        const staticUnitSize  =
            4 + // color is 4 32bit floats (4bytes each)
            2 * 4 // offset is 2 32bit floats (4bytes each)

        const changingUnitSize = VertexBufferTriangles.changingUnitSize =
            2 * 4;  // scale is 2 32bit floats (4bytes each)

        const staticVertexBufferSize  = staticUnitSize  * VertexBufferTriangles.kNumObjects;
        const changingVertexBufferSize  = changingUnitSize * VertexBufferTriangles.kNumObjects;

        VertexBufferTriangles.staticVertexBuffer  = device.createBuffer({
            label: 'static vertex for objects',
            size: staticVertexBufferSize ,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        VertexBufferTriangles.changingVertexBuffer  = device.createBuffer({
            label: 'changing vertex for objects',
            size: changingVertexBufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

   
        {
            const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
            const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer);
            for (let i = 0; i < VertexBufferTriangles.kNumObjects; ++i) {
                const staticOffsetU8 = i * staticUnitSize;
                const staticOffsetF32 = staticOffsetU8 / 4;
        
              // These are only set once so set them now
              staticVertexValuesU8.set(        // set the color
                [rand() * 255, rand() * 255, rand() * 255, 255],
                staticOffsetU8 + VertexBufferTriangles.kColorOffset);
       
            staticVertexValuesF32.set(      // set the offset
                [rand(-0.9, 0.9), rand(-0.9, 0.9)],
                staticOffsetF32 + VertexBufferTriangles.kOffsetOffset);
              VertexBufferTriangles.objectInfos.push({
                scale: rand(0.2, 0.5),
              });
            }
            device.queue.writeBuffer(VertexBufferTriangles.staticVertexBuffer, 0, staticVertexValuesF32);
          }

        // a typed array we can use to update the changingStorageBuffer
        VertexBufferTriangles.vertexValues = new Float32Array(changingVertexBufferSize / 4);
        // setup a storage buffer with vertex data
        const { vertexData,indexData, numVertices } = VertexBufferTriangles.createCircleVerticesIndex({
            radius: 0.5,
            innerRadius: 0.25,
        });

        VertexBufferTriangles.numVertices = numVertices
        const vertexBuffer  = VertexBufferTriangles.vertexBuffer = device.createBuffer({
            label: 'vertex buffer vertices',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(vertexBuffer, 0, vertexData);

        const indexBuffer = VertexBufferTriangles.indexBuffer = device.createBuffer({
            label: 'index buffer',
            size: indexData.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
          });
          device.queue.writeBuffer(indexBuffer, 0, indexData);


        //#region  渲染队列参数
        VertexBufferTriangles.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: this.context!.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                }
            ],
        };
        //#endregion
        VertexBufferTriangles.isInited = true;
    }

    static update() {
        if (!VertexBufferTriangles.isInited) return;

    }

    static draw() {
        if (!VertexBufferTriangles.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(VertexBufferTriangles.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            VertexBufferTriangles.context!.getCurrentTexture().createView());

        // make a command encoder to start encoding commands
        const encoder = VertexBufferTriangles.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(VertexBufferTriangles.renderPassDescriptor);
        pass.setPipeline(this.pipeline as GPURenderPipeline);
        pass.setVertexBuffer(0,VertexBufferTriangles.vertexBuffer);
        pass.setVertexBuffer(1, VertexBufferTriangles.staticVertexBuffer);
        pass.setVertexBuffer(2, VertexBufferTriangles.changingVertexBuffer);
        pass.setIndexBuffer(VertexBufferTriangles.indexBuffer,'uint32');

        // 渲染多个对象
        let ndx = 0;
        for (const { scale } of VertexBufferTriangles.objectInfos) {
            const offset = ndx * (VertexBufferTriangles.changingUnitSize / 4);
            VertexBufferTriangles.vertexValues.set([scale / VertexBufferTriangles.aspect, scale], offset + VertexBufferTriangles.kScaleOffset); // set the scale
            ndx++;
        }

        // upload all scales at once
        VertexBufferTriangles.device.queue.writeBuffer(VertexBufferTriangles.changingVertexBuffer, 0, VertexBufferTriangles.vertexValues);


        pass.drawIndexed(VertexBufferTriangles.numVertices, VertexBufferTriangles.kNumObjects);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        VertexBufferTriangles.device!.queue.submit([commandBuffer]);
    }
    static destory() {

    }

    private static createCircleVertices({
        radius = 1,
        numSubdivisions = 24,
        innerRadius = 0,
        startAngle = 0,
        endAngle = Math.PI * 2,
    } = {}) {
        // 2 triangles per subdivision, 3 verts per tri, 2 values (xy) each.
        const numVertices = numSubdivisions * 3 * 2;
          // 2 32-bit values for position (xy) and 1 32-bit value for color (rgb_)
        // The 32-bit color value will be written/read as 4 8-bit values
        const vertexData = new Float32Array(numVertices * (2 + 1));
        const colorData = new Uint8Array(vertexData.buffer);

        let offset = 0;
        let colorOffset = 8;
        const addVertex = (x: number, y: number, r:number, g:number, b:number) => {
            vertexData[offset++] = x;
            vertexData[offset++] = y;
            offset += 1;  // skip the color
            colorData[colorOffset++] = r * 255;
            colorData[colorOffset++] = g * 255;
            colorData[colorOffset++] = b * 255;
            colorOffset += 9;  // skip extra byte and the position
        };

        const innerColor:[number, number, number] = [1, 1, 1];
        const outerColor:[number, number, number] = [0.1, 0.1, 0.1];

        // 2 triangles per subdivision
        //
        // 0--1 4
        // | / /|
        // |/ / |
        // 2 3--5
        for (let i = 0; i < numSubdivisions; ++i) {
            const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
            const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;

            const c1 = Math.cos(angle1);
            const s1 = Math.sin(angle1);
            const c2 = Math.cos(angle2);
            const s2 = Math.sin(angle2);

            // first triangle
            addVertex(c1 * radius, s1 * radius, ...outerColor);
            addVertex(c2 * radius, s2 * radius, ...outerColor);
            addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);

            // second triangle
            addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
            addVertex(c2 * radius, s2 * radius, ...outerColor);
            addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor);
        }

        return {
            vertexData,
            numVertices,
        };
    }

    private static  createCircleVerticesIndex({
        radius = 1,
        numSubdivisions = 24,
        innerRadius = 0,
        startAngle = 0,
        endAngle = Math.PI * 2,
      } = {}) {
        // 2 vertices at each subdivision, + 1 to wrap around the circle.
        const numVertices = (numSubdivisions + 1) * 2;
        // 2 32-bit values for position (xy) and 1 32-bit value for color (rgb)
        // The 32-bit color value will be written/read as 4 8-bit values
        const vertexData = new Float32Array(numVertices * (2 + 1));
        const colorData = new Uint8Array(vertexData.buffer);
       
        let offset = 0;
        let colorOffset = 8;
        const addVertex = (x:number, y:number, r:number, g:number, b:number) => {
          vertexData[offset++] = x;
          vertexData[offset++] = y;
          offset += 1;  // skip the color
          colorData[colorOffset++] = r * 255;
          colorData[colorOffset++] = g * 255;
          colorData[colorOffset++] = b * 255;
          colorOffset += 9;  // skip extra byte and the position
        };
        const innerColor:[number, number, number] = [1, 1, 1];
        const outerColor:[number, number, number] = [0.1, 0.1, 0.1];
       
        // 2 triangles per subdivision
        //
        // 0  2  4  6  8 ...
        //
        // 1  3  5  7  9 ...
        for (let i = 0; i <= numSubdivisions; ++i) {
          const angle = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
       
          const c1 = Math.cos(angle);
          const s1 = Math.sin(angle);
       
          addVertex(c1 * radius, s1 * radius, ...outerColor);
          addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
        }
       
        const indexData = new Uint32Array(numSubdivisions * 6);
        let ndx = 0;
       
        // 1st tri  2nd tri  3rd tri  4th tri
        // 0 1 2    2 1 3    2 3 4    4 3 5
        //
        // 0--2        2     2--4        4  .....
        // | /        /|     | /        /|
        // |/        / |     |/        / |
        // 1        1--3     3        3--5  .....
        for (let i = 0; i < numSubdivisions; ++i) {
          const ndxOffset = i * 2;
       
          // first triangle
          indexData[ndx++] = ndxOffset;
          indexData[ndx++] = ndxOffset + 1;
          indexData[ndx++] = ndxOffset + 2;
       
          // second triangle
          indexData[ndx++] = ndxOffset + 2;
          indexData[ndx++] = ndxOffset + 1;
          indexData[ndx++] = ndxOffset + 3;
        }
       
        return {
          vertexData,
          indexData,
          numVertices: indexData.length,
        };
      }


}

function rand(min?: number, max?: number) {
    if (min === undefined) {
        min = 0;
        max = 1;
    } else if (max === undefined) {
        max = min;
        min = 0;
    }
    return min + Math.random() * (max - min);
};

