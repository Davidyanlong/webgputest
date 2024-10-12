import { Base } from "../common/base"
import shadercode from '../shaders/simpleTriangle/simple_triangle.wgsl?raw'

/**
 * 渲染基本流程
 * MSAA的三角形
 */
export class MSAATriangle extends Base {
    private static multsampleTexture:GPUTexture
    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('msaaTriangle')

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'our hardcoded red triangle shaders',
            code: shadercode,
        });

        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: 'our hardcoded red triangle pipeline',
            layout: 'auto',
            vertex: {
                entryPoint: 'vs',
                module,
            },
            fragment: {
                entryPoint: 'fs',
                module,
                targets: [
                    { format: this.presentationFormat }
                ],
            },
            // 开启采样次数
            multisample: {
                count: 4,
            },
        });


        //#endregion

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

        // 创建多重采样texture
        this.multsampleTexture = this.device.createTexture({
            format:this.presentationFormat,
            usage:GPUTextureUsage.RENDER_ATTACHMENT,
            // resize 需要重新创建texture
            size:[this.context.canvas.width, this.context.canvas.height],
            sampleCount: 4,
        })
        this.isInited = true;
    }


    static draw() {
        if (!this.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(this.renderPassDescriptor.colorAttachments)[0];

        // 图像先渲染到多重采样纹理中
        colorAttach && (colorAttach.view =
            this.multsampleTexture.createView());

        // 然后再输出
        colorAttach && (colorAttach.resolveTarget =
            this.context!.getCurrentTexture().createView());


        // make a command encoder to start encoding commands
        const encoder = this.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(this.renderPassDescriptor);
        pass.setPipeline(this.pipeline as GPURenderPipeline);
        pass.draw(3);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }
}

