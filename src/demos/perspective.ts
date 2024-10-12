
import { Base } from "../common/base"
import shadercode from '../shaders/orthogonal/orthogonal.wgsl?raw'
import { create3DFVertices } from "../utils/createF"
import { mat4 } from "../utils/mat4"
import { degToRad } from "../utils/utils"

/**
 * 正交投影
 */
export class Perspective extends Base {
    private static settings: Record<string, any>
    private static vertexBuffer: GPUBuffer
    private static uniformBuffer: GPUBuffer
    private static bindGroup: GPUBindGroup
    private static numVertices: number

    private static uniformValues: Float32Array
    private static depthTexture: GPUTexture
    private static matrixValue: Float32Array

    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('perspective')

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



        this.settings = {
            // 透视垂直视角
            fieldOfView: degToRad(100),
            translation: [-65, 0, -120],
            rotation: [degToRad(220), degToRad(25), degToRad(325)],
            scale: [1, 1, 1],
        };

        this.initGUI();

        this.isInited = true;
    }

    static update(): void {
        if (!this.isInited) return;
        const canvas = this.context.canvas as HTMLCanvasElement;
        const aspect = canvas.clientWidth / canvas.clientHeight
        // 透视投影
        mat4.perspective(
            this.settings.fieldOfView,
            aspect,
            1,      // zNear
            2000,   // zFar
            this.matrixValue,
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

        const canvasTexture = this.context.getCurrentTexture();

        // 这段代码正常应该存放到resize 代码中
        if (!this.depthTexture ||
            this.depthTexture.width !== canvasTexture.width ||
            this.depthTexture.height !== canvasTexture.height) {
            if (this.depthTexture) {
                this.depthTexture.destroy();
            }
            this.depthTexture = this.device.createTexture({
                size: [canvasTexture.width, canvasTexture.height],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
        }
        this.renderPassDescriptor.depthStencilAttachment!.view = this.depthTexture.createView();


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
    
    private static initGUI() {

        // @ts-ignore
        const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

        // @ts-ignore
        const gui = new GUI({
            parent: (this.context.canvas as HTMLCanvasElement).parentElement,
            width: '145px'
        })
        gui.domElement.style.top = '-300px';
        gui.domElement.style.left = '150px';

        // @ts-ignore
        gui.add(this.settings, 'fieldOfView', { min: 1, max: 179, converters: GUI.converters.radToDeg });
        gui.add(this.settings.translation, '0', -1000, 1000).name('translation.x');
        gui.add(this.settings.translation, '1', -1000, 1000).name('translation.y');
        gui.add(this.settings.translation, '2', -1400, -100).name('translation.z');
        gui.add(this.settings.rotation, '0', radToDegOptions).name('rotation.x');
        gui.add(this.settings.rotation, '1', radToDegOptions).name('rotation.y');
        gui.add(this.settings.rotation, '2', radToDegOptions).name('rotation.z');
    }
}

