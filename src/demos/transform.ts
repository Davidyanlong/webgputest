
import { Base } from "../common/base"
import shadercode from '../shaders/transform/transform.wgsl?raw'
import { createFVertices } from "../utils/createF"
import { degToRad } from "../utils/utils"

/**
 * 渲染基本流程
 * 简单的三角形
 */
export class Transform extends Base {
    private static settings: Record<string, any>
    private static vertexBuffer: GPUBuffer
    private static indexBuffer: GPUBuffer
    private static uniformBuffer: GPUBuffer
    private static bindGroup: GPUBindGroup
    private static numVertices: number

    private static resolutionValue: Float32Array
    private static translationValue: Float32Array
    private static rotationValue: Float32Array
    private static scaleValue: Float32Array
    private static uniformValues: Float32Array

    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('transform')

        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: 'premultiplied'
        })


        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'our hardcoded red triangle shaders',
            code: shadercode,
        });

        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: 'just 2d positio',
            layout: 'auto',
            vertex: {
                module,
                buffers: [
                    {
                        arrayStride: (2) * 4,     // (2) floats, 4 bytes each
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' },  // position
                        ],
                    },
                ],
            },
            fragment: {
                module,
                targets: [
                    { format: this.presentationFormat },
                ],
            },
        });

        //#endregion



        // color, resolution, translation, rotation, scale
        const uniformBufferSize = (4 + 2 + 2 + 2 + 2) * 4;
        this.uniformBuffer = device.createBuffer({
            label: 'uniforms',
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const uniformValues = this.uniformValues = new Float32Array(uniformBufferSize / 4);

        // offsets to the various uniform values in float32 indices
        const kColorOffset = 0;
        const kResolutionOffset = 4;
        const kTranslationOffset = 6;
        const kRotationOffset = 8;
        const kScaleOffset = 10;

        const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
        this.resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
        this.translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
        this.rotationValue = uniformValues.subarray(kRotationOffset, kRotationOffset + 2);
        this.scaleValue = uniformValues.subarray(kScaleOffset, kScaleOffset + 2);

        // The color will not change so let's set it once at init time
        colorValue.set([Math.random(), Math.random(), Math.random(), 1]);

        const { vertexData, indexData, numVertices } = createFVertices();
        this.numVertices = numVertices;
        const vertexBuffer = this.vertexBuffer = device.createBuffer({
            label: 'vertex buffer vertices',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(vertexBuffer, 0, vertexData);
        const indexBuffer = this.indexBuffer = device.createBuffer({
            label: 'index buffer',
            size: indexData.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(indexBuffer, 0, indexData);

        this.bindGroup = device.createBindGroup({
            label: 'bind group for object',
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
            ],
        });




        //#region  渲染队列参数
        this.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: this.context!.getCurrentTexture().createView(),
                    // clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };
        //#endregion



        this.settings = {
            translation: [150, 100],
            rotation: degToRad(30),
            scale: [1, 1],
        };

        this.initGUI();

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
        pass.setVertexBuffer(0, this.vertexBuffer)
        pass.setIndexBuffer(this.indexBuffer, 'uint32');

        let canvas = this.context.canvas;
        // Set the uniform values in our JavaScript side Float32Array
        this.resolutionValue.set([canvas.width, canvas.height]);
        this.translationValue.set(this.settings.translation);
        this.rotationValue.set([
            Math.cos(this.settings.rotation),
            Math.sin(this.settings.rotation),
        ]);
        this.scaleValue.set(this.settings.scale);

        // upload the uniform values to the uniform buffer
        this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformValues);

        pass.setBindGroup(0, this.bindGroup);
        pass.drawIndexed(this.numVertices);
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }
    private static initGUI() {

        // @ts-ignore
        const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

        // @ts-ignore
        const gui = new GUI({
            parent: (this.context.canvas as HTMLCanvasElement).parentElement,
            width: '145px'
        })
        gui.domElement.style.top = '-300px';

        gui.add(this.settings.translation, '0', 0, 1000).name('translation.x');
        gui.add(this.settings.translation, '1', 0, 1000).name('translation.y');
        gui.add(this.settings, 'rotation', radToDegOptions);
        gui.add(this.settings.scale, '0', -5, 5).name('scale.x');
        gui.add(this.settings.scale, '1', -5, 5).name('scale.y');
    }
}

