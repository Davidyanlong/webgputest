import { Base } from "../common/base"
import { GPUContext } from "../common/gpuContext";

/**
 * 渲染基本流程
 * 简单的三角形
 */
export class StorageTexture extends Base {
    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        const context = super.initCanvas('storageTexture', true)
        const hasBGRA8unormStorage = GPUContext.adapter!.features.has('bgra8unorm-storage');
        this.presentationFormat = hasBGRA8unormStorage ? navigator.gpu.getPreferredCanvasFormat() : 'rgba8unorm';
        context.configure({
            device,
            format: this.presentationFormat,
            usage: GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.STORAGE_BINDING,
        });
        this.context = context;

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'circles in storage texture',
            code: `
                @group(0) @binding(0) var tex: texture_storage_2d<${this.presentationFormat}, write>;

                @compute @workgroup_size(1) fn cs(
                    @builtin(global_invocation_id) id : vec3u
                )  {
                    let size = textureDimensions(tex);
                    let center = vec2f(size) / 2.0;
                    let pos = id.xy;
                    let dist = distance(vec2f(pos), center);
                    let stripe = dist / 8.0 % 2.0;
                    let red = vec4f(1, 0, 0, 1);
                    let cyan = vec4f(0, 1, 1, 1);
                    let color = select(red, cyan, stripe < 1.0);
                    textureStore(tex, pos, color);
                }
        `,
        });

        //#endregion

        //#region  render pipeline
        this.pipeline = device.createComputePipeline({
            label: 'circles in storage texture',
            layout: 'auto',
            compute: {
                module,
            }
        });

        //#endregion


        this.isInited = true;
    }

    static draw() {
        if (!this.isInited) return;
        const texture = this.context.getCurrentTexture();

        const bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: texture.createView() },
            ],
        });

        const encoder = this.device.createCommandEncoder({ label: 'our encoder' });
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.pipeline as GPUComputePipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(texture.width, texture.height);
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }
}

