import { Base } from "./base"
import shadercode from '../shaders/colorvertextriangle/color_vertex_triangle.wgsl?raw'

/**
 * 渲染基本流程
 * 顶点着色渲染
 */
export class ColorVertexTriangle  extends Base{
    static async initalize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('colorVertexTriangle')

        ColorVertexTriangle.device = device;

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'our hardcoded rgb  triangle shaders',
            code: shadercode,
        });

        //#endregion

        //#region  render pipeline
        ColorVertexTriangle.pipeline = device.createRenderPipeline({
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
        });

        //#endregion

        //#region  渲染队列参数
        ColorVertexTriangle.renderPassDescriptor = {
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
        ColorVertexTriangle.isInited = true;
    }
    static update() {
       
    }

    static draw() {
        if(!ColorVertexTriangle.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(ColorVertexTriangle.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            ColorVertexTriangle.context!.getCurrentTexture().createView());

        // make a command encoder to start encoding commands
        const encoder = ColorVertexTriangle.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(ColorVertexTriangle.renderPassDescriptor);
        pass.setPipeline(ColorVertexTriangle.pipeline as GPURenderPipeline);
        pass.draw(3);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        ColorVertexTriangle.device!.queue.submit([commandBuffer]);
    }
    static destory() {

    }
}

