import { Base } from "../common/base";
import { anyNull, Float32ArrayNull, GPUBindGroupNull, GPUBufferNull } from "../common/constant";
import shadercode from '../shaders/storageBufferTriangles/storage_buffer_triangles.wgsl?raw'
import { createCircleVertices } from "../utils/createCircleVertices";
import { rand } from "../utils/utils";

/**
 * 渲染基本流程
 * bindGroup / uniform 学习
 *  uniform max 64k
 *  storage max 128M
 */
export class StorageBufferTriangles extends Base {
    private static kColorOffset: number;
    private static kScaleOffset: number;
    private static kOffsetOffset: number;
    private static changingUnitSize: number;

    private static kNumObjects: number;
    private static objectInfos: ObjectInfo[];
    private static storageValues: Float32Array;
    private static bindGroup: GPUBindGroup;
    private static storageBuffer: GPUBuffer;
    private static numVertices: number;


    static async initialize(device: GPUDevice) {
        await super.initialize(device)
        this.initCanvas('storageBufferTriangles')

        // 初始化值
        this.objectInfos = []
        this.kColorOffset = 0;
        this.kScaleOffset = 0;
        this.kOffsetOffset = 4;
        this.kNumObjects = 100;

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: shadercode,
        });
        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: 'split storage buffer pipeline',
            layout: 'auto',
            vertex: {
                module,
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
        const staticStorageUnitSize =
            4 * 4 + // color is 4 32bit floats (4bytes each)
            2 * 4 + // offset is 2 32bit floats (4bytes each)
            2 * 4;  // padding

        const changingUnitSize = this.changingUnitSize =
            2 * 4;  // scale is 2 32bit floats (4bytes each)

        const staticStorageBufferSize = staticStorageUnitSize * this.kNumObjects;
        const storageBufferSize = changingUnitSize * this.kNumObjects;

        const staticStorageBuffer = device.createBuffer({
            label: 'static storage for objects',
            size: staticStorageBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.storageBuffer = device.createBuffer({
            label: 'changing storage for objects',
            size: storageBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        const staticStorageValues = new Float32Array(staticStorageBufferSize / 4);
        this.storageValues = new Float32Array(storageBufferSize / 4);


        for (let i = 0; i < this.kNumObjects; ++i) {
            const staticOffset = i * (staticStorageUnitSize / 4);

            // These are only set once so set them now
            staticStorageValues.set([rand(), rand(), rand(), 1], staticOffset + this.kColorOffset);        // set the color
            staticStorageValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + this.kOffsetOffset);      // set the offset

            this.objectInfos.push({
                scale: rand(0.2, 0.5),
            });
        }
        device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues);


        // setup a storage buffer with vertex data
        const { vertexData, numVertices } = createCircleVertices({
            radius: 0.5,
            innerRadius: 0.25,
        });

        this.numVertices = numVertices
        const vertexStorageBuffer = device.createBuffer({
            label: 'storage buffer vertices',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(vertexStorageBuffer, 0, vertexData);


        this.bindGroup = device.createBindGroup({
            label: 'bind group for objects',
            layout: this.pipeline.getBindGroupLayout(0),
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
                        buffer: this.storageBuffer
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: vertexStorageBuffer
                    }
                },
            ],
        });


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
    static update(): void {
        if (!this.isInited) return;
        // 渲染多个对象
        let ndx = 0;
        for (const { scale } of this.objectInfos) {
            const offset = ndx * (this.changingUnitSize / 4);
            this.storageValues.set([scale / this.aspect, scale], offset + this.kScaleOffset); // set the scale

            ndx++;
        }
        // upload all scales at once
        this.device.queue.writeBuffer(this.storageBuffer, 0, this.storageValues);
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

        pass.setBindGroup(0, this.bindGroup);
        pass.draw(this.numVertices, this.kNumObjects);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }

    static destory(): void {
        super.destory();
        this.objectInfos = anyNull;
        this.storageValues = Float32ArrayNull
        this.bindGroup = GPUBindGroupNull
        this.storageBuffer?.destroy();
        this.storageBuffer = GPUBufferNull
    }

}

interface ObjectInfo {
    scale: number
}
