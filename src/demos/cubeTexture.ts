import { mat4 } from "wgpu-matrix"
import { Base } from "../common/base"
import { GenerateMips } from "../common/generateMips"
import shadercode from '../shaders/cubeTexture/cube_texture.wgsl?raw'
import { createCubeVertices, faceCanvases } from '../utils/cube'

/**
 * 渲染基本流程
 * 简单的三角形
 */
export class CubeTexture extends Base {
    private static bindGroup: GPUBindGroup
    private static vertexBuffer: GPUBuffer
    private static indexBuffer: GPUBuffer
    private static uniformBuffer: GPUBuffer
    private static matrixValue: Float32Array
    private static projectionMatrix: Float32Array
    private static viewMatrix: Float32Array
    private static uniformValues: Float32Array
    private static numVertices: number
    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('cubeTexture')

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
                buffers: [{
                    arrayStride: 3 * 4, // (3) floats 4 bytes each
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
                    ],
                }],
            },
            fragment: {
                module,
                targets: [
                    { format: this.presentationFormat },
                ],
            },
            primitive: {
                cullMode: 'back',
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });

        //#endregion

        const { texture } = await this.initTexture()

        const uniformBuffer = this.uniformBuffer = this.initUniform()

        this.initVertexData()

        const sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
        });

        this.bindGroup = device.createBindGroup({
            label: 'bind group for object',
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
                { binding: 1, resource: sampler },
                // 这里的 dimension 为 `cube`
                { binding: 2, resource: texture.createView({ dimension: 'cube' }) },
            ],
        });


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
            depthStencilAttachment: {
                view: this.context!.getCurrentTexture().createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };

        const canvas = this.context.canvas as HTMLCanvasElement;
        const aspect = canvas.clientWidth / canvas.clientHeight;
        this.projectionMatrix = new Float32Array(16)
        mat4.perspective(
            60 * Math.PI / 180,
            aspect,
            0.1,      // zNear
            10,      // zFar
            this.projectionMatrix,
        );
        this.viewMatrix = new Float32Array(16);
        this.viewMatrix = mat4.lookAt(
            [0, 1, 5],  // camera position
            [0, 0, 0],  // target
            [0, 1, 0],  // up
        );


        //#endregion
        this.isInited = true;
    }

    static update(dt: number): void {
        if (!this.isInited) return;
        const time = dt * 0.001
        mat4.multiply(this.projectionMatrix, this.viewMatrix, this.matrixValue);
        mat4.rotateX(this.matrixValue, time, this.matrixValue);
        mat4.rotateY(this.matrixValue, time, this.matrixValue);
        mat4.rotateZ(this.matrixValue, time, this.matrixValue);

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
        this.renderPassDescriptor.depthStencilAttachment!.view = this.depthTexture.createView();

        // make a command encoder to start encoding commands
        const encoder = this.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(this.renderPassDescriptor);
        pass.setPipeline(this.pipeline as GPURenderPipeline);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setIndexBuffer(this.indexBuffer, 'uint16');

        pass.setBindGroup(0, this.bindGroup);
        pass.drawIndexed(this.numVertices);
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }

    private static async initTexture() {
        const texture = await GenerateMips.createTextureFromSources(
            this.device, faceCanvases, { mips: true, flipY: false });
       

        return {
            texture
        };
    }

    private static initUniform() {
        // matrix
        const uniformBufferSize = (16) * 4;
        const uniformBuffer = this.device.createBuffer({
            label: 'uniforms',
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const uniformValues = this.uniformValues = new Float32Array(uniformBufferSize / 4);

        // offsets to the various uniform values in float32 indices
        const kMatrixOffset = 0;

        this.matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
        return uniformBuffer
    }

    private static initVertexData() {
        const { vertexData, indexData, numVertices } = createCubeVertices();
        this.numVertices = numVertices;
        this.vertexBuffer = this.device.createBuffer({
            label: 'vertex buffer vertices',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertexData);

        this.indexBuffer = this.device.createBuffer({
            label: 'index buffer',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.indexBuffer, 0, indexData);
    }
}

