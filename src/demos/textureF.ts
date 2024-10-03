import { Base } from "../common/base"
import shadercode from '../shaders/textureF/texture_f.wgsl?raw'

/**
 * 渲染基本流程
 * 简单的三角形
 */
export class TextureF extends Base{
    private static bindGroup:GPUBindGroup
    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('textureF')

        //#endregion

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'our hardcoded textured quad shaders',
            code: shadercode,
        });

        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: 'our hardcoded red triangle pipeline',
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

        this.initTexture()


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

    private static initTexture(){
        const kTextureWidth = 5;
        const kTextureHeight = 7;
        const _ = [255,   0,   0, 255];  // red
        const y = [255, 255,   0, 255];  // yellow
        const b = [  0,   0, 255, 255];  // blue
        const textureData = new Uint8Array([
            _, _, _, _, _,
            _, y, _, _, _,
            _, y, _, _, _,
            _, y, y, _, _,
            _, y, _, _, _,
            _, y, y, y, _,
            b, _, _, _, _,
        ].flat());


        const texture = this.device.createTexture({
            label: 'yellow F on red',
            size: [kTextureWidth, kTextureHeight],
            format: 'rgba8unorm',
            usage:
              GPUTextureUsage.TEXTURE_BINDING |
              GPUTextureUsage.COPY_DST,
        });

        this.device.queue.writeTexture(
            { texture },
            textureData,
            { bytesPerRow: kTextureWidth * 4 },
            { width: kTextureWidth, height: kTextureHeight },
        );
      
        const sampler = this.device.createSampler();

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: sampler },
              { binding: 1, resource: texture.createView() },
            ],
          });

    }
    static update() {
       
    }

    static draw() {
        if(!this.isInited) return;
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
        pass.draw(6);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }
    static destory() {

    }
}

