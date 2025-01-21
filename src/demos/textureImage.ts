import { Base } from "../common/base"
import { anyNull, GPUTextureNull } from "../common/constant";
import shadercode from '../shaders/textureF/texture_f.wgsl?raw'
import { loadImageBitmap } from "../utils/res"

/**
 * 渲染基本流程
 * 简单的三角形
 */
export class TextureImage extends Base {
    private static bindGroups: GPUBindGroup[];
    private static texture:GPUTexture
    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('textureImage')

        // 初始化值
        this.bindGroups = [];

        this.initGUI();

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

        await this.initTexture()


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

    static draw() {
        if (!this.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(this.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            this.context!.getCurrentTexture().createView());

            const ndx = (this.settings.addressModeU === 'repeat' ? 1 : 0) +
            (this.settings.addressModeV === 'repeat' ? 2 : 0) +
            (this.settings.magFilter === 'linear' ? 4 : 0);
            const bindGroup = this.bindGroups[ndx];


        // make a command encoder to start encoding commands
        const encoder = this.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(this.renderPassDescriptor);
        pass.setPipeline(this.pipeline as GPURenderPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }

    static destroy(): void {
        super.destroy();
        this.texture?.destroy();
        this.texture = GPUTextureNull;
        this.bindGroups = anyNull;
    }

    private static async initTexture() {
        const url = './f-texture.png';
        const source = await loadImageBitmap(url);
        const texture = this.texture =  this.device.createTexture({
            label: url,
            format: 'rgba8unorm',
            size: [source.width, source.height],
            usage: GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.device.queue.copyExternalImageToTexture(
            { source, flipY: true },
            { texture },
            { width: source.width, height: source.height },
        );

  
        for (let i = 0; i < 8; ++i) {
            const sampler = this.device.createSampler({
                addressModeU: (i & 1) ? 'repeat' : 'clamp-to-edge',
                addressModeV: (i & 2) ? 'repeat' : 'clamp-to-edge',
                magFilter: (i & 4) ? 'linear' : 'nearest',
            });

            const bindGroup = this.device.createBindGroup({
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: texture.createView() },
                ],
            });
            this.bindGroups.push(bindGroup);

        }
    }

    protected static initGUI(){
        if(this.gui?.domElement) return;
        super.initGUI();

        this.settings = {
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            magFilter: 'linear',
          };

        const addressOptions = ['repeat', 'clamp-to-edge'];
        const filterOptions = ['nearest', 'linear'];

        this.gui.add(this.settings, 'addressModeU', addressOptions);
        this.gui.add(this.settings, 'addressModeV', addressOptions);
        this.gui.add(this.settings, 'magFilter', filterOptions);
    }
}

