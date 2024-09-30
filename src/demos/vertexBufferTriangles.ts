/**
 * 渲染基本流程
 * bindGroup / uniform 学习
 *  uniform max 64k
 *  storage max 128M
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
    private static objectInfos: ObjectInfo[] = [];
    private static storageValues: Float32Array;
    private static bindGroup: GPUBindGroup;
    private static storageBuffer: GPUBuffer;
    private static vertexBuffer:GPUBuffer;
    private static numVertices:number;
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
                };

                struct OurStruct {
                    color: vec4f,
                    offset: vec2f,
                };

                struct OtherStruct {
                    scale: vec2f,
                };
 

                @group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
                @group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;
                
                @vertex fn vs(
                   vert: Vertex,
                    @builtin(instance_index) instanceIndex: u32
                ) -> VSOutput {
                    let otherStruct = otherStructs[instanceIndex];
                    let ourStruct = ourStructs[instanceIndex];
            
                    var vsOut: VSOutput;
                    vsOut.position = vec4f(vert.position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
                    vsOut.color = ourStruct.color;
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
        const staticStorageUnitSize =
            4 * 4 + // color is 4 32bit floats (4bytes each)
            2 * 4 + // offset is 2 32bit floats (4bytes each)
            2 * 4;  // padding

        const changingUnitSize = VertexBufferTriangles.changingUnitSize =
            2 * 4;  // scale is 2 32bit floats (4bytes each)

        const staticStorageBufferSize = staticStorageUnitSize * VertexBufferTriangles.kNumObjects;
        const storageBufferSize = changingUnitSize * VertexBufferTriangles.kNumObjects;

        const staticStorageBuffer = device.createBuffer({
            label: 'static storage for objects',
            size: staticStorageBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        VertexBufferTriangles.storageBuffer = device.createBuffer({
            label: 'changing storage for objects',
            size: storageBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        const staticStorageValues = new Float32Array(staticStorageBufferSize / 4);
        VertexBufferTriangles.storageValues = new Float32Array(storageBufferSize / 4);


        for (let i = 0; i < VertexBufferTriangles.kNumObjects; ++i) {
            const staticOffset = i * (staticStorageUnitSize / 4);

            // These are only set once so set them now
            staticStorageValues.set([rand(), rand(), rand(), 1], staticOffset + VertexBufferTriangles.kColorOffset);        // set the color
            staticStorageValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + VertexBufferTriangles.kOffsetOffset);      // set the offset

            VertexBufferTriangles.objectInfos.push({
                scale: rand(0.2, 0.5),
            });
        }
        device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues);


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


        VertexBufferTriangles.bindGroup = device.createBindGroup({
            label: 'bind group for objects',
            layout: VertexBufferTriangles.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: staticStorageBuffer
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: VertexBufferTriangles.storageBuffer
                    }
                },
            ],
        });


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
        // 渲染多个对象
        let ndx = 0;
        for (const { scale } of VertexBufferTriangles.objectInfos) {
            const offset = ndx * (VertexBufferTriangles.changingUnitSize / 4);
            VertexBufferTriangles.storageValues.set([scale / VertexBufferTriangles.aspect, scale], offset + VertexBufferTriangles.kScaleOffset); // set the scale

            ndx++;
        }
        // upload all scales at once
        VertexBufferTriangles.device.queue.writeBuffer(VertexBufferTriangles.storageBuffer, 0, VertexBufferTriangles.storageValues);
        pass.setBindGroup(0, VertexBufferTriangles.bindGroup);
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

interface ObjectInfo {
    scale: number
}
