import { Base } from "../common/base"
import shadercode from '../shaders/simpleTriangle/simple_triangle.wgsl?raw'

/**
 * 渲染基本流程
 * 简单的三角形
 */
export class SimpleTriangle extends Base {
    private static context2: GPUCanvasContext

    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('simpleTriangle1')
        this.context2 = super.initCanvas('simpleTriangle2', true)

        //#endregion

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
                    { format: this.presentationFormat },
                    { format: this.presentationFormat }
                ],
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
                },
                {
                    view: this.context2!.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };
        //#endregion
        this.isInited = true;
    }

    static draw() {
        if (!this.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(this.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            this.context!.getCurrentTexture().createView());


        let colorAttach2 = Array.from(
            this.renderPassDescriptor.colorAttachments)[1];

        colorAttach2 && (colorAttach2.view =
            this.context2!.getCurrentTexture().createView());

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

