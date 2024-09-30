/**
 * 渲染基本流程
 * bindGroup / uniform 学习
 *  顶点的结构信息是设置在renderpipeline
 *  渲染需要单独绑定顶点插槽
 */
export class VertexBufferTriangles {
    private static pipeline: GPURenderPipeline
    private static renderPassDescriptor: GPURenderPassDescriptor
    private static context: GPUCanvasContext
    private static device: GPUDevice
    private static kColorOffset = 0;
    private static kScaleOffset = 0;
    private static kOffsetOffset = 4;
    private static changingUnitSize: number;
    private static aspect = 1;

    private static kNumObjects = 100;
    private static changingVertexBuffer : GPUBuffer;
    private static staticVertexBuffer:GPUBuffer;
    private static vertexBuffer:GPUBuffer;
    private static vertexValues:Float32Array;
    private static numVertices:number;
    private static objectInfos:{scale:number}[] = [];
    private static isInited = false


    static async initalize(device: GPUDevice) {

        VertexBufferTriangles.device = device;

        //#region initilize
        const canvas = document.querySelector('#vertexBufferTriangles') as HTMLCanvasElement;
        const context = VertexBufferTriangles.context = canvas!.getContext('webgpu')!;
        // "bgra8unorm"
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        context?.configure({
            device,
            format: presentationFormat,
        });

        VertexBufferTriangles.aspect = canvas.width / canvas.height;
        //#endregion


        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: `
                struct VSOutput {
                    @builtin(position) position: vec4f,
                    @location(0) color: vec4f,
                }

                struct Vertex {
                    @location(0) position: vec2f,
                    @location(1) color: vec4f,
                    @location(2)offset: vec2f,
                    @location(3) scale: vec2f,
                };
                
                @vertex fn vs(
                   vert: Vertex,
                ) -> VSOutput {
                    var vsOut: VSOutput;
                    vsOut.position = vec4f(vert.position * vert.scale + vert.offset, 0.0, 1.0);
                    vsOut.color = vert.color;
                   return vsOut;
                }
            
                @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
                   return vsOut.color;
                }
        `,
        });

        //#endregion

        //#region  render pipeline
        VertexBufferTriangles.pipeline = device.createRenderPipeline({
            label: 'split storage buffer pipeline',
            layout: 'auto',
            vertex: {
                module,
                buffers:[
                    {
                        arrayStride: 2 * 4, // 2 floats, 4 bytes each
                        attributes:[
                            {   // position
                                shaderLocation:0,
                                offset:0,
                                format:'float32x2'
                            }
                        ]
                    },
                    {
                        arrayStride: 6 * 4, // 6 floats, 4 bytes each
                        stepMode:'instance',
                        attributes:[
                            {   // color
                                shaderLocation:1,
                                offset:0,
                                format:'float32x4'
                            },
                            {   // offset
                                shaderLocation:2,
                                offset: 4 * 4,   // color 4 floats,
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
                    { format: presentationFormat },
                ],
            },
        });

        //#endregion


        // create 2 buffers for the uniform values
        const staticUnitSize  =
            4 * 4 + // color is 4 32bit floats (4bytes each)
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
            const staticVertexValues = new Float32Array(staticVertexBufferSize / 4);
            for (let i = 0; i < VertexBufferTriangles.kNumObjects; ++i) {
              const staticOffset = i * (staticUnitSize / 4);
        
              // These are only set once so set them now
              staticVertexValues.set([rand(), rand(), rand(), 1], staticOffset + VertexBufferTriangles.kColorOffset);        // set the color
              staticVertexValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + VertexBufferTriangles.kOffsetOffset);      // set the offset
        
              VertexBufferTriangles.objectInfos.push({
                scale: rand(0.2, 0.5),
              });
            }
            device.queue.writeBuffer(VertexBufferTriangles.staticVertexBuffer, 0, staticVertexValues);
          }

        // a typed array we can use to update the changingStorageBuffer
        VertexBufferTriangles.vertexValues = new Float32Array(changingVertexBufferSize / 4);
        // setup a storage buffer with vertex data
        const { vertexData, numVertices } = VertexBufferTriangles.createCircleVertices({
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


        //#region  渲染队列参数
        VertexBufferTriangles.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: context!.getCurrentTexture().createView(),
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
        pass.setPipeline(VertexBufferTriangles.pipeline);
        pass.setVertexBuffer(0,VertexBufferTriangles.vertexBuffer);
        pass.setVertexBuffer(1, VertexBufferTriangles.staticVertexBuffer);
        pass.setVertexBuffer(2, VertexBufferTriangles.changingVertexBuffer);

        // 渲染多个对象
        let ndx = 0;
        for (const { scale } of VertexBufferTriangles.objectInfos) {
            const offset = ndx * (VertexBufferTriangles.changingUnitSize / 4);
            VertexBufferTriangles.vertexValues.set([scale / VertexBufferTriangles.aspect, scale], offset + VertexBufferTriangles.kScaleOffset); // set the scale
            ndx++;
        }

        // upload all scales at once
        VertexBufferTriangles.device.queue.writeBuffer(VertexBufferTriangles.changingVertexBuffer, 0, VertexBufferTriangles.vertexValues);


        pass.draw(VertexBufferTriangles.numVertices, VertexBufferTriangles.kNumObjects);  // call our vertex shader 3 times
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
        const vertexData = new Float32Array(numSubdivisions * 2 * 3 * 2);

        let offset = 0;
        const addVertex = (x: number, y: number) => {
            vertexData[offset++] = x;
            vertexData[offset++] = y;
        };

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
            addVertex(c1 * radius, s1 * radius);
            addVertex(c2 * radius, s2 * radius);
            addVertex(c1 * innerRadius, s1 * innerRadius);

            // second triangle
            addVertex(c1 * innerRadius, s1 * innerRadius);
            addVertex(c2 * radius, s2 * radius);
            addVertex(c2 * innerRadius, s2 * innerRadius);
        }

        return {
            vertexData,
            numVertices,
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

