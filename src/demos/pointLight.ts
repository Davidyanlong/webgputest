
import { Base } from "../common/base"
import { Float32ArrayNull, GPUBindGroupNull, GPUBufferNull } from "../common/constant"
import shadercode from '../shaders/pointLight/pointLight.wgsl?raw'
import { createFVerticesNormal } from "../utils/createF"
import { radToDegOptions } from "../utils/gui"
import { mat3 } from "../utils/mat3"
import { mat4 } from "../utils/mat4"
import { degToRad } from "../utils/utils"

/**
 * 点光源
 */
export class PointLight extends Base {
    private static vertexBuffer: GPUBuffer
    private static numVertices: number

    private static bindGroup: GPUBindGroup
    private static worldViewProjectionValue: Float32Array
    private static normalMatrixValue: Float32Array
    private static worldValue: Float32Array
    private static colorValue: Float32Array
    private static lightWorldPositionValue: Float32Array
    private static viewWorldPositionValue: Float32Array
    private static shininessValue: Float32Array
    private static uniformBuffer: GPUBuffer
    private static uniformValues: Float32Array

    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('pointLight')

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
                        arrayStride: (3 + 3) * 4,     // (2) floats, 4 bytes each
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
                            { shaderLocation: 1, offset: 12, format: 'float32x3' },  // normal
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
                cullMode: 'back',  // note: uncommon setting. See article
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });
        //#endregion


        const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
        const uniformBuffer = this.uniformBuffer = device.createBuffer({
            label: 'uniforms',
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const uniformValues = this.uniformValues = new Float32Array(uniformBufferSize / 4);


        // offsets to the various uniform values in float32 indices
        const kNormalMatrixOffset = 0;
        const kWorldViewProjectionOffset = 12;
        const kWorldOffset = 28;
        const kColorOffset = 44;
        const kLightWorldPositionOffset = 48;
        const kViewWorldPositionOffset = 52;
        const kShininessOffset = 55;

        this.normalMatrixValue = uniformValues.subarray(kNormalMatrixOffset, kNormalMatrixOffset + 12);
        this.worldViewProjectionValue = uniformValues.subarray(kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
        this.worldValue = uniformValues.subarray(
            kWorldOffset, kWorldOffset + 16);
        this.colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
        this.lightWorldPositionValue = uniformValues.subarray(
            kLightWorldPositionOffset, kLightWorldPositionOffset + 3);
        this.viewWorldPositionValue = uniformValues.subarray(
            kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
        this.shininessValue = uniformValues.subarray(
            kShininessOffset, kShininessOffset + 1);


        this.bindGroup = device.createBindGroup({
            label: 'bind group for object',
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
            ],
        });

        const { vertexData, numVertices } = createFVerticesNormal();
        this.numVertices = numVertices
        this.vertexBuffer = device.createBuffer({
            label: 'vertex buffer vertices',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.vertexBuffer, 0, vertexData);


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
        const aspect = canvas.clientWidth / canvas.clientHeight
        // 透视投影
        const projection = mat4.perspective(
            degToRad(60),
            aspect,
            1,      // zNear
            2000,   // zFar
        );

        const eye = new Float32Array([100, 150, 200]);
        const target = new Float32Array([0, 35, 0]);
        const up = new Float32Array([0, 1, 0]);

        // Compute a view matrix
        const viewMatrix = mat4.lookAt(eye, target, up);

        // Combine the view and projection matrixes
        const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

        // Compute a world matrix
        const world = mat4.rotationY(this.settings.rotation, this.worldValue);

        // Combine the viewProjection and world matrices
        mat4.multiply(viewProjectionMatrix, world, this.worldViewProjectionValue);

        // Inverse and transpose it into the worldInverseTranspose value
        mat3.fromMat4(mat4.transpose(mat4.inverse(world)), this.normalMatrixValue);

        this.colorValue.set([0.2, 1, 0.2, 1]);  // green
        this.lightWorldPositionValue.set([-10, 30, 100]);
        this.viewWorldPositionValue.set(eye);
        this.shininessValue[0] = this.settings.shininess;

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

        this.vertexBuffer?.destroy();
        this.vertexBuffer = GPUBufferNull

        this.bindGroup = GPUBindGroupNull
        this.worldViewProjectionValue = Float32ArrayNull
        this.normalMatrixValue = Float32ArrayNull
        this.worldValue = Float32ArrayNull
        this.colorValue = Float32ArrayNull
        this.lightWorldPositionValue = Float32ArrayNull
        this.viewWorldPositionValue = Float32ArrayNull
        this.shininessValue = Float32ArrayNull
        this.uniformBuffer?.destroy();
        this.uniformBuffer = GPUBufferNull;
        this.uniformValues = Float32ArrayNull

    }

    protected static initGUI() {
        if (this.gui?.domElement) return
        super.initGUI();

        this.settings = {
            rotation: degToRad(0),
            shininess: 30,
        };

        this.gui.add(this.settings, 'rotation', radToDegOptions);
        this.gui.add(this.settings, 'shininess', { min: 1, max: 250 });
    }
}