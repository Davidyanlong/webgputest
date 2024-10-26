import { Base } from "../common/base";
import { anyNull, Float32ArrayNull, GPUBufferNull } from "../common/constant";
import shadercode from '../shaders/vertexBufferTriangles/vertex_buffer_triangles.wgsl?raw'
import { createCircleVerticesIndex } from "../utils/createCircleVertices";
import { rand } from "../utils/utils";

/**
 * 渲染基本流程
 * bindGroup / uniform 学习
 *  顶点的结构信息是设置在renderpipeline
 *  渲染需要单独绑定顶点插槽
 */
export class VertexBufferTriangles extends Base {
    private static kColorOffset: number;
    private static kScaleOffset: number;
    private static kOffsetOffset: number;
    private static changingUnitSize: number;

    private static kNumObjects: number;
    private static changingVertexBuffer: GPUBuffer;
    private static staticVertexBuffer: GPUBuffer;
    private static vertexBuffer: GPUBuffer;
    private static indexBuffer: GPUBuffer;
    private static vertexValues: Float32Array;
    private static numVertices: number;
    private static objectInfos: { scale: number }[];


    static async initialize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('vertexBufferTriangles')

        // 初始化值
        this.objectInfos = []
        this.kColorOffset = 0;
        this.kScaleOffset = 0;
        this.kOffsetOffset = 1;
        this.kNumObjects = 100;

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: shadercode,
        });

        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: 'per vertex color',
            layout: 'auto',
            vertex: {
                module,
                buffers: [
                    {
                        arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each
                        attributes: [
                            {   // position
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x2'
                            },
                            {   // perVertexColor
                                shaderLocation: 4,
                                offset: 2 * 4,
                                format: 'unorm8x4'
                            }
                        ]
                    },
                    {
                        arrayStride: 4 + 2 * 4, // 6 floats, 4 bytes each
                        stepMode: 'instance',
                        attributes: [
                            {   // color
                                shaderLocation: 1,
                                offset: 0,
                                format: 'unorm8x4'
                            },
                            {   // offset
                                shaderLocation: 2,
                                offset: 4,   // color 4 floats,
                                format: 'float32x2'
                            }

                        ]
                    },
                    {
                        arrayStride: 2 * 4, // 2 floats, 4 bytes each
                        stepMode: 'instance',
                        attributes: [
                            {   // scale
                                shaderLocation: 3,
                                offset: 0,
                                format: 'float32x2'
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
        const staticUnitSize =
            4 + // color is 4 32bit floats (4bytes each)
            2 * 4 // offset is 2 32bit floats (4bytes each)

        const changingUnitSize = this.changingUnitSize =
            2 * 4;  // scale is 2 32bit floats (4bytes each)

        const staticVertexBufferSize = staticUnitSize * this.kNumObjects;
        const changingVertexBufferSize = changingUnitSize * this.kNumObjects;

        this.staticVertexBuffer = device.createBuffer({
            label: 'static vertex for objects',
            size: staticVertexBufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.changingVertexBuffer = device.createBuffer({
            label: 'changing vertex for objects',
            size: changingVertexBufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });


        {
            const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
            const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer);
            for (let i = 0; i < this.kNumObjects; ++i) {
                const staticOffsetU8 = i * staticUnitSize;
                const staticOffsetF32 = staticOffsetU8 / 4;

                // These are only set once so set them now
                staticVertexValuesU8.set(        // set the color
                    [rand() * 255, rand() * 255, rand() * 255, 255],
                    staticOffsetU8 + this.kColorOffset);

                staticVertexValuesF32.set(      // set the offset
                    [rand(-0.9, 0.9), rand(-0.9, 0.9)],
                    staticOffsetF32 + this.kOffsetOffset);
                this.objectInfos.push({
                    scale: rand(0.2, 0.5),
                });
            }
            device.queue.writeBuffer(this.staticVertexBuffer, 0, staticVertexValuesF32);
        }

        // a typed array we can use to update the changingStorageBuffer
        this.vertexValues = new Float32Array(changingVertexBufferSize / 4);
        // setup a storage buffer with vertex data
        const { vertexData, indexData, numVertices } = createCircleVerticesIndex({
            radius: 0.5,
            innerRadius: 0.25,
        });

        this.numVertices = numVertices
        const vertexBuffer = this.vertexBuffer = device.createBuffer({
            label: 'vertex buffer vertices',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(vertexBuffer, 0, vertexData);

        const indexBuffer = this.indexBuffer = device.createBuffer({
            label: 'index buffer',
            size: indexData.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(indexBuffer, 0, indexData);


        //#region  渲染队列参数
        this.renderPassDescriptor = {
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
        this.isInited = true;
    }
    static update() {
        if (!this.isInited) return;
        // 渲染多个对象
        let ndx = 0;
        for (const { scale } of this.objectInfos) {
            const offset = ndx * (this.changingUnitSize / 4);
            this.vertexValues.set([scale / this.aspect, scale], offset + this.kScaleOffset); // set the scale
            ndx++;
        }

        // upload all scales at once
        this.device.queue.writeBuffer(this.changingVertexBuffer, 0, this.vertexValues);
    }
    static draw() {
        if (!this.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(this.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            this.context!.getCurrentTexture().createView());

        // make a command encoder to start encoding commands
        const encoder = this.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(this.renderPassDescriptor);
        pass.setPipeline(this.pipeline as GPURenderPipeline);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setVertexBuffer(1, this.staticVertexBuffer);
        pass.setVertexBuffer(2, this.changingVertexBuffer);
        pass.setIndexBuffer(this.indexBuffer, 'uint32');
        pass.drawIndexed(this.numVertices, this.kNumObjects);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }
    static destroy(): void {
        super.destroy();

        this.changingVertexBuffer?.destroy();
        this.staticVertexBuffer?.destroy();
        this.changingVertexBuffer = GPUBufferNull;
        this.staticVertexBuffer = GPUBufferNull;
        this.vertexValues = Float32ArrayNull;
        this.objectInfos = anyNull;
    }



}



