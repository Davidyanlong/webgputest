import { Base } from "../common/base";
import { Float32ArrayNull, GPUBindGroupNull, GPUBufferNull } from "../common/constant";
import shadercode from '../shaders/multUniformTriangle/mult_uniform_triangle.wgsl?raw'
import { rand } from "../utils/utils";

/**
 * 渲染基本流程
 * bindGroup / uniform 学习
 */
export class MultUniformTriangle extends Base {
    private static kColorOffset: number;
    private static kScaleOffset: number
    private static kOffsetOffset: number;

    private static kNumObjects: number;
    private static objectInfos: ObjectInfo[];


    static async initialize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('multUniformTriangle')

        // 初始化值，尽量在初始化的时候进行，下次初始化的时候依然有效
        this.objectInfos = [];
        this.kColorOffset = 0;
        this.kScaleOffset = 0;
        this.kOffsetOffset = 4;

        this.kNumObjects = 100

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: shadercode,
        });
        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: 'multiple uniform buffe',
            layout: 'auto',
            vertex: {
                entryPoint: 'vs',
                module,
            },
            fragment: {
                entryPoint: 'fs',
                module,
                targets: [
                    { format: this.presentationFormat },
                ],
            },
        });
        //#endregion


        // create 2 buffers for the uniform values
        const staticUniformBufferSize =
            4 * 4 + // color is 4 32bit floats (4bytes each)
            2 * 4 + // offset is 2 32bit floats (4bytes each)
            2 * 4;  // padding
        const uniformBufferSize =
            2 * 4;  // scale is 2 32bit floats (4bytes each)

        for (let i = 0; i < this.kNumObjects; ++i) {
            const staticUniformBuffer = device.createBuffer({
                label: `static uniforms for obj: ${i}`,
                size: staticUniformBufferSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            // These are only set once so set them now
            {
                const uniformValues = new Float32Array(staticUniformBufferSize / 4);
                uniformValues.set([rand(), rand(), rand(), 1], this.kColorOffset);        // set the color
                uniformValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], this.kOffsetOffset);      // set the offset

                // copy these values to the GPU
                device.queue.writeBuffer(staticUniformBuffer, 0, uniformValues);
            }

            // create a typedarray to hold the values for the uniforms in JavaScript
            const uniformValues = new Float32Array(uniformBufferSize / 4);
            const uniformBuffer = device.createBuffer({
                label: `changing uniforms for obj: ${i}`,
                size: uniformBufferSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            const bindGroup = device.createBindGroup({
                label: `bind group for obj: ${i}`,
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: staticUniformBuffer } },
                    { binding: 1, resource: { buffer: uniformBuffer } },
                ],
            });

            this.objectInfos.push({
                scale: rand(0.2, 0.5),
                uniformBuffer,
                uniformValues,
                bindGroup,
            });
        }

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
        // 更新渲染数据
        for (const { scale, uniformBuffer, uniformValues } of this.objectInfos) {
            uniformValues.set([scale / this.aspect, scale], this.kScaleOffset); // set the scale
            this.device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
        }
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

        // 渲染多个对象
        for (const { bindGroup } of this.objectInfos) {
            pass.setBindGroup(0, bindGroup);
            pass.draw(3);  // call our vertex shader 3 times

        }
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }
    static destroy(): void {
        super.destroy();
        while (this.objectInfos?.length) {
            let obj = this.objectInfos.pop()!;
            obj.bindGroup = GPUBindGroupNull;
            obj.uniformBuffer.destroy();
            obj.uniformBuffer = GPUBufferNull;
            obj.uniformValues = Float32ArrayNull;
        }
    }

}

interface ObjectInfo {
    scale: number,
    uniformBuffer: GPUBuffer,
    uniformValues: Float32Array,
    bindGroup: GPUBindGroup,
}
