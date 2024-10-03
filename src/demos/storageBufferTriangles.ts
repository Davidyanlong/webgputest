import { Base } from "../common/base";
import shadercode from '../shaders/storageBufferTriangles/storage_buffer_triangles.wgsl?raw'
import { createCircleVertices } from "../utils/createCircleVertices";
import { rand } from "../utils/utils";

/**
 * 渲染基本流程
 * bindGroup / uniform 学习
 *  uniform max 64k
 *  storage max 128M
 */
export class StorageBufferTriangles extends Base{
    private static kColorOffset = 0;
    private static kScaleOffset = 0;
    private static kOffsetOffset = 4;
    private static changingUnitSize: number;

    private static kNumObjects = 100;
    private static objectInfos: ObjectInfo[] = [];
    private static storageValues: Float32Array;
    private static bindGroup: GPUBindGroup;
    private static storageBuffer: GPUBuffer;
    private static numVertices:number;


    static async initialize(device: GPUDevice) {
        await super.initialize(device)
        this.initCanvas('storageBufferTriangles')

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: shadercode,
        });

        //#endregion

        //#region  render pipeline
        StorageBufferTriangles.pipeline = device.createRenderPipeline({
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

        const changingUnitSize = StorageBufferTriangles.changingUnitSize =
            2 * 4;  // scale is 2 32bit floats (4bytes each)

        const staticStorageBufferSize = staticStorageUnitSize * StorageBufferTriangles.kNumObjects;
        const storageBufferSize = changingUnitSize * StorageBufferTriangles.kNumObjects;

        const staticStorageBuffer = device.createBuffer({
            label: 'static storage for objects',
            size: staticStorageBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        StorageBufferTriangles.storageBuffer = device.createBuffer({
            label: 'changing storage for objects',
            size: storageBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        const staticStorageValues = new Float32Array(staticStorageBufferSize / 4);
        StorageBufferTriangles.storageValues = new Float32Array(storageBufferSize / 4);


        for (let i = 0; i < StorageBufferTriangles.kNumObjects; ++i) {
            const staticOffset = i * (staticStorageUnitSize / 4);

            // These are only set once so set them now
            staticStorageValues.set([rand(), rand(), rand(), 1], staticOffset + StorageBufferTriangles.kColorOffset);        // set the color
            staticStorageValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + StorageBufferTriangles.kOffsetOffset);      // set the offset

            StorageBufferTriangles.objectInfos.push({
                scale: rand(0.2, 0.5),
            });
        }
        device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues);


        // setup a storage buffer with vertex data
        const { vertexData, numVertices } = createCircleVertices({
            radius: 0.5,
            innerRadius: 0.25,
        });

        StorageBufferTriangles.numVertices = numVertices
        const vertexStorageBuffer = device.createBuffer({
            label: 'storage buffer vertices',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(vertexStorageBuffer, 0, vertexData);


        StorageBufferTriangles.bindGroup = device.createBindGroup({
            label: 'bind group for objects',
            layout: StorageBufferTriangles.pipeline.getBindGroupLayout(0),
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
                        buffer: StorageBufferTriangles.storageBuffer
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
        StorageBufferTriangles.renderPassDescriptor = {
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
        StorageBufferTriangles.isInited = true;
    }


    static draw(dt:number) {
        if (!StorageBufferTriangles.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(StorageBufferTriangles.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            StorageBufferTriangles.context!.getCurrentTexture().createView());

        // make a command encoder to start encoding commands
        const encoder = StorageBufferTriangles.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(StorageBufferTriangles.renderPassDescriptor);
        pass.setPipeline(StorageBufferTriangles.pipeline as GPURenderPipeline);
        // 渲染多个对象
        let ndx = 0;
        for (const { scale } of StorageBufferTriangles.objectInfos) {
            const offset = ndx * (StorageBufferTriangles.changingUnitSize / 4);
            StorageBufferTriangles.storageValues.set([scale / StorageBufferTriangles.aspect, scale], offset + StorageBufferTriangles.kScaleOffset); // set the scale

            ndx++;
        }
        // upload all scales at once
        StorageBufferTriangles.device.queue.writeBuffer(StorageBufferTriangles.storageBuffer, 0, StorageBufferTriangles.storageValues);
        pass.setBindGroup(0, StorageBufferTriangles.bindGroup);
        pass.draw(StorageBufferTriangles.numVertices, StorageBufferTriangles.kNumObjects);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        StorageBufferTriangles.device!.queue.submit([commandBuffer]);
    }

}

interface ObjectInfo {
    scale: number
}
