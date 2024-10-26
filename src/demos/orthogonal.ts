
import { Base } from "../common/base"
import { Float32ArrayNull, GPUBindGroupNull, GPUBufferNull } from "../common/constant"
import shadercode from '../shaders/orthogonal/orthogonal.wgsl?raw'
import { create3DFVertices } from "../utils/createF"
import { radToDegOptions } from "../utils/gui"
import { mat4 } from "../utils/mat4"
import { degToRad } from "../utils/utils"

/**
 * 正交投影
 */
export class Orthogonal extends Base {
    private static vertexBuffer: GPUBuffer
    private static uniformBuffer: GPUBuffer
    private static bindGroup: GPUBindGroup
    private static numVertices: number

    private static uniformValues: Float32Array
    private static matrixValue: Float32Array

    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('orthogonal')

        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: 'premultiplied'
        })


        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'orthogonal shader module',
            code: shadercode,
        });

        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: '2 attributes',
            layout: 'auto',
            vertex: {
                module,
                buffers: [
                    {
                        arrayStride: (4) * 4,     // (2) floats, 4 bytes each
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
                            { shaderLocation: 1, offset: 12, format: 'unorm8x4' },  // color
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
            primitive: {
                cullMode: 'front',  // note: uncommon setting. See article
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });

        //#endregion



        // color, resolution, translation, rotation, scale
        const uniformBufferSize = (16) * 4;
        this.uniformBuffer = device.createBuffer({
            label: 'uniforms',
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const uniformValues = this.uniformValues = new Float32Array(uniformBufferSize / 4);

        // offsets to the various uniform values in float32 indices
        const kMatrixOffset = 0;

        this.matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);

        const { vertexData, numVertices } = create3DFVertices();
        this.numVertices = numVertices;
        const vertexBuffer = this.vertexBuffer = device.createBuffer({
            label: 'vertex buffer vertices',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(vertexBuffer, 0, vertexData);

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
            depthStencilAttachment: {
                // 临时使用，避免ts错误，渲染时动态变化的
                view: this.context!.getCurrentTexture().createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };
        //#endregion

        this.initGUI();

        this.isInited = true;
    }

    static update(): void {
        if (!this.isInited) return;
        const canvas = this.context.canvas as HTMLCanvasElement;
        mat4.ortho(
            0,                   // left
            canvas.clientWidth,  // right
            canvas.clientHeight, // bottom
            0,                   // top
            400,                 // near
            -400,                // far
            this.matrixValue,         // dst
        );
        mat4.translate(this.matrixValue, this.settings.translation, this.matrixValue);
        mat4.rotateX(this.matrixValue, this.settings.rotation[0], this.matrixValue);
        mat4.rotateY(this.matrixValue, this.settings.rotation[1], this.matrixValue);
        mat4.rotateZ(this.matrixValue, this.settings.rotation[2], this.matrixValue);
        mat4.scale(this.matrixValue, this.settings.scale, this.matrixValue);

        // upload the uniform values to the uniform buffer
        this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformValues);
    }

    static draw() {
        if (!this.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(this.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            this.context!.getCurrentTexture().createView());


        // 这段代码正常应该存放到resize 代码中
        super.getDepthTexture();
        this.renderPassDescriptor.depthStencilAttachment!.view = this.depthTexture!.createView();


        // make a command encoder to start encoding commands
        const encoder = this.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(this.renderPassDescriptor);
        pass.setPipeline(this.pipeline as GPURenderPipeline);
        pass.setVertexBuffer(0, this.vertexBuffer)

        pass.setBindGroup(0, this.bindGroup);
        pass.draw(this.numVertices);
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }

    static destroy(): void {
        super.destroy();
        this.vertexBuffer?.destroy()
        this.vertexBuffer = GPUBufferNull
        this.uniformBuffer?.destroy();
        this.uniformBuffer = GPUBufferNull;
        this.bindGroup = GPUBindGroupNull
        this.uniformValues = Float32ArrayNull
        this.matrixValue = Float32ArrayNull
    }

    protected static initGUI() {

        if (this.gui) return;
        super.initGUI();

        this.settings = {
            translation: [45, 100, 0],
            rotation: [degToRad(40), degToRad(25), degToRad(325)],
            scale: [1, 1, 1],
        };

        this.gui.add(this.settings.translation, '0', 0, 1000).name('translation.x');
        this.gui.add(this.settings.translation, '1', 0, 1000).name('translation.y');
        this.gui.add(this.settings.translation, '2', -1000, 1000).name('translation.z');
        this.gui.add(this.settings.rotation, '0', radToDegOptions).name('rotation.x');
        this.gui.add(this.settings.rotation, '1', radToDegOptions).name('rotation.y');
        this.gui.add(this.settings.rotation, '2', radToDegOptions).name('rotation.z');
        this.gui.add(this.settings.scale, '0', -5, 5).name('scale.x');
        this.gui.add(this.settings.scale, '1', -5, 5).name('scale.y');
        this.gui.add(this.settings.scale, '2', -5, 5).name('scale.z');
    }
}

