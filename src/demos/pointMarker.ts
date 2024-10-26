import { Base } from "../common/base"
import { Float32ArrayNull, GPUBindGroupNull, GPUBufferNull, GPUSamplerNull, GPUTextureNull } from "../common/constant";
import shadercode from '../shaders/pointMarker/pointMarker.wgsl?raw'
import { rand } from "../utils/utils";

/**
 * 渲染基本流程
 * 顶点着色渲染
 */
export class PointMarker extends Base {
    public static kNumPoints: number;

    private static texture: GPUTexture
    private static sampler: GPUSampler
    private static resolutionValue: Float32Array
    private static uniformBuffer: GPUBuffer
    private static uniformValues: Float32Array
    private static bindGroup: GPUBindGroup
    private static vertexBuffer: GPUBuffer

    static async initialize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('pointMarker')

        // 参数初始化
        this.kNumPoints = 100;

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'point marker shaders',
            code: shadercode,
        });
        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: 'sizeable rotatable points with texture',
            layout: 'auto',
            vertex: {
                module,
                buffers: [
                    {
                        arrayStride: (2 + 1 + 1) * 4, // 2 floats, 4 bytes each
                        stepMode: 'instance',  // 以实例化的方式读取顶点
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' },  // position
                            { shaderLocation: 1, offset: 8, format: 'float32' },  // size
                            { shaderLocation: 2, offset: 12, format: 'float32' },  // rotation
                        ],
                    },
                ],
            },
            fragment: {
                module,
                targets: [
                    {
                        format: this.presentationFormat,
                        blend: {  // 贴图透明必须开启 blend 模式
                            color: {
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha',
                                operation: 'add',
                            },
                            alpha: {
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha',
                                operation: 'add',
                            },
                        }
                    },
                ],
            },
        });
        //#endregion

        this.initTexture();
        this.initVertex();

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
    static update(): void {
        if (!this.isInited) return;
        // Update the resolution in the uniform buffer
        const canvasTexture = this.context.canvas
        this.resolutionValue.set([canvasTexture.width, canvasTexture.height]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformValues);
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
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(6, this.kNumPoints);
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }

    static destroy(): void {
        super.destroy();

        this.texture?.destroy();
        this.texture = GPUTextureNull;

        this.sampler = GPUSamplerNull
        this.resolutionValue = Float32ArrayNull

        this.uniformBuffer?.destroy()
        this.uniformBuffer = GPUBufferNull

        this.uniformValues = Float32ArrayNull
        this.bindGroup = GPUBindGroupNull

        this.vertexBuffer?.destroy();
        this.vertexBuffer = GPUBufferNull;

    }

    private static initTexture() {
        // 使用离线canvas 
        const ctx = new OffscreenCanvas(32, 32).getContext('2d')!;
        ctx.font = '27px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👉', 16, 16);

        const texture = this.texture = this.device.createTexture({
            size: [32, 32],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.device.queue.copyExternalImageToTexture(
            { source: ctx.canvas, flipY: true },
            { texture, premultipliedAlpha: true },
            [32, 32],
        );

        const sampler = this.sampler = this.device.createSampler({
            minFilter: 'linear',
            magFilter: 'linear',
        });
        return {
            texture,
            sampler
        }
    }

    private static initVertex() {
        const vertexData = new Float32Array(this.kNumPoints * 4);
        for (let i = 0; i < this.kNumPoints; ++i) {
            const offset = i * 4;
            vertexData[offset + 0] = rand(-1, 1);
            vertexData[offset + 1] = rand(-1, 1);
            vertexData[offset + 2] = rand(10, 64);
            vertexData[offset + 3] = rand(0, Math.PI * 2);
        }

        const vertexBuffer = this.vertexBuffer = this.device.createBuffer({
            label: 'vertex buffer vertices',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(vertexBuffer, 0, vertexData);

        const uniformValues = this.uniformValues = new Float32Array(2);
        const uniformBuffer = this.uniformBuffer = this.device.createBuffer({
            size: uniformValues.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const kResolutionOffset = 0;
        this.resolutionValue = uniformValues.subarray(
            kResolutionOffset, kResolutionOffset + 2);

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
                { binding: 1, resource: this.sampler },
                { binding: 2, resource: this.texture.createView() },
            ],
        });
    }
}

