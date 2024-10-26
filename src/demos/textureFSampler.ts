import { Base } from "../common/base"
import { anyNull, GPUTextureNull } from "../common/constant";
import shadercode from '../shaders/textureFSampler/texturef_sampler.wgsl?raw'

/**
 * 渲染基本流程
 * 简单的三角形
 */
export class TextureFSampler extends Base {
    private static bindGroups: GPUBindGroup[];
    private static texture:GPUTexture;
    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('textureFSampler')

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

        const ndx = (this.settings.addressModeU === 'repeat' ? 1 : 0) +
            (this.settings.addressModeV === 'repeat' ? 2 : 0) +
            (this.settings.magFilter === 'linear' ? 4 : 0);

        const bindGroup = this.bindGroups[ndx];


        pass.setBindGroup(0, bindGroup);
        pass.draw(6);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }
    private static initTexture() {
        const kTextureWidth = 5;
        const kTextureHeight = 7;
        const _ = [255, 0, 0, 255];  // red
        const y = [255, 255, 0, 255];  // yellow
        const b = [0, 0, 255, 255];  // blue
        const textureData = new Uint8Array([
            _, _, _, _, _,
            _, y, _, _, _,
            _, y, _, _, _,
            _, y, y, _, _,
            _, y, _, _, _,
            _, y, y, y, _,
            b, _, _, _, _,
        ].flat());


        const texture = this.texture =  this.device.createTexture({
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
    protected static initGUI() {

        if (this.gui) return;
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
    static destroy(): void {
        super.destroy();
        this.texture?.destroy();
        this.texture = GPUTextureNull;
        this.bindGroups = anyNull;
    }
}

