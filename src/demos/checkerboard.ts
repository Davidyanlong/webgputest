import { Base } from "../common/base"
import vscode from '../shaders/checkerboard/checkerboard.vs.wgsl?raw'
import fscode from '../shaders/checkerboard/checkerboard.fs.wgsl?raw'

/**
 * 渲染基本流程
 * 网格渲染
 */
export class Checkerboard extends Base {

    static async initialize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('checkerboard')

        //#region  shaderModule
        const vsModule = device.createShaderModule({
            label: 'hardcoded triangle',
            code: vscode,
        });

        const fsModule = device.createShaderModule({
            label: 'checkerboard',
            code: fscode,
        });

        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: 'our hardcoded red triangle pipeline',
            layout: 'auto',
            vertex: {
                module: vsModule,
            },
            fragment: {
                module: fsModule,
                targets: [
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
            ],
        };
        //#endregion
        this.isInited = true;
    }

    static draw(dt:number) {
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
        pass.draw(3);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }
}

