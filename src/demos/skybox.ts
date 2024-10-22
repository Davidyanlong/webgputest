import { mat4 } from "wgpu-matrix"
import { Base } from "../common/base"
import { GenerateMips } from "../common/generateMips"
import shadercode from '../shaders/environmentMap/environmentMap.wgsl?raw'
import skyShaderCode from '../shaders/skybox/skybox.wgsl?raw'
import { createCubeVerticesAndNormal } from '../utils/cube'

/**
 * 渲染基本流程
 * 简单的三角形
 */
export class Skybox extends Base {
    private static bindGroup: GPUBindGroup
    private static vertexBuffer: GPUBuffer
    private static indexBuffer: GPUBuffer
    private static uniformBuffer: GPUBuffer
    private static uniformValues: Float32Array
    private static numVertices: number

    private static projectionValue: Float32Array
    private static viewValue: Float32Array
    private static worldValue: Float32Array
    private static cameraPositionValue: Float32Array

    // skybox
    private static skyBoxPipeline: GPURenderPipeline
    private static viewDirectionProjectionInverseValue: Float32Array
    private static skyBoxUniformValues: Float32Array
    private static skyBoxBindGroup: GPUBindGroup
    private static skyBoxUniformBuffer: GPUBuffer

    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('skybox')

        const sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
        });
        const { texture } = await this.initTexture()

        //#region skybox
        const skyBoxModule = device.createShaderModule({
            code: skyShaderCode
        });

        this.skyBoxPipeline = device.createRenderPipeline({
            label: 'no attributes',
            layout: 'auto',
            vertex: {
                module: skyBoxModule,
            },
            fragment: {
                module: skyBoxModule,
                targets: [{ format: this.presentationFormat }],
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less-equal',
                format: 'depth24plus',
            },
        });



        // viewDirectionProjectionInverse
        const skyBoxUniformBufferSize = (16) * 4;
        const skyBoxUniformBuffer = this.skyBoxUniformBuffer = device.createBuffer({
            label: 'uniforms',
            size: skyBoxUniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.skyBoxUniformValues = new Float32Array(skyBoxUniformBufferSize / 4);

        // offsets to the various uniform values in float32 indices
        const kViewDirectionProjectionInverseOffset = 0;

        this.viewDirectionProjectionInverseValue = this.skyBoxUniformValues.subarray(
            kViewDirectionProjectionInverseOffset,
            kViewDirectionProjectionInverseOffset + 16);

        this.skyBoxBindGroup = device.createBindGroup({
            label: 'bind group for object',
            layout: this.skyBoxPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: skyBoxUniformBuffer } },
                { binding: 1, resource: sampler },
                { binding: 2, resource: texture.createView({ dimension: 'cube' }) },
            ],
        });



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
                buffers: [{
                    arrayStride: (3 + 3) * 4, // (6) floats 4 bytes each
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
                        { shaderLocation: 1, offset: 0, format: 'float32x3' },  // normal
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



        const uniformBuffer = this.uniformBuffer = this.initUniform()

        this.initVertexData()



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

        //#endregion
        this.isInited = true;
    }

    static update(dt: number): void {
        if (!this.isInited) return;
        const time = dt * 0.001
        const canvas = this.context.canvas as HTMLCanvasElement
        const aspect = canvas.clientWidth / canvas.clientHeight;
        mat4.perspective(
            60 * Math.PI / 180,
            aspect,
            0.1,      // zNear
            10,      // zFar
            this.projectionValue,
        );
        // Camera going in circle from origin looking at origin
        this.cameraPositionValue.set([Math.cos(time * .1) * 5, 0, Math.sin(time * .1) * 5]);
        const view = mat4.lookAt(
            this.cameraPositionValue,
            [0, 0, 0],  // target
            [0, 1, 0],  // up
        );
        // Copy the view into the viewValue since we're going
        // to zero out the view's translation
        this.viewValue.set(view);

        // We only care about direction so remove the translation
        view[12] = 0;
        view[13] = 0;
        view[14] = 0;
        const viewProjection = mat4.multiply(this.projectionValue, view);
        mat4.inverse(viewProjection, this.viewDirectionProjectionInverseValue);

        // Rotate the cube
        mat4.identity(this.worldValue);
        mat4.rotateX(this.worldValue, time * -0.1, this.worldValue);
        mat4.rotateY(this.worldValue, time * -0.2, this.worldValue);

        // upload the uniform values to the uniform buffers
        this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformValues);
        this.device.queue.writeBuffer(this.skyBoxUniformBuffer, 0, this.skyBoxUniformValues);


    }

    static draw() {
        if (!this.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(this.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            this.context!.getCurrentTexture().createView());

        super.getDepthTexture()
        this.renderPassDescriptor.depthStencilAttachment!.view = this.depthTexture!.createView();
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

        // Draw the skyBox
        pass.setPipeline(this.skyBoxPipeline);
        pass.setBindGroup(0, this.skyBoxBindGroup);
        pass.draw(3);

        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }

    private static async initTexture() {
        const texture = await GenerateMips.createTextureFromImages(
            this.device,
            [
                '/cube/leadenhall_market/pos-x.jpg',
                '/cube//leadenhall_market/neg-x.jpg',
                '/cube//leadenhall_market/pos-y.jpg',
                '/cube//leadenhall_market/neg-y.jpg',
                '/cube//leadenhall_market/pos-z.jpg',
                '/cube//leadenhall_market/neg-z.jpg',
            ],
            { mips: true, flipY: false });


        return {
            texture,
        };
    }

    private static initUniform() {
        // matrix
        const uniformBufferSize = (16 + 16 + 16 + 3 + 1) * 4;
        const uniformBuffer = this.device.createBuffer({
            label: 'uniforms',
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const uniformValues = this.uniformValues = new Float32Array(uniformBufferSize / 4);

        // offsets to the various uniform values in float32 indices
        const kProjectionOffset = 0;
        const kViewOffset = 16;
        const kWorldOffset = 32;
        const kCameraPositionOffset = 48;

        this.projectionValue = uniformValues.subarray(kProjectionOffset, kProjectionOffset + 16);
        this.viewValue = uniformValues.subarray(kViewOffset, kViewOffset + 16);
        this.worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16);
        this.cameraPositionValue = uniformValues.subarray(kCameraPositionOffset, kCameraPositionOffset + 3);

        return uniformBuffer
    }

    private static initVertexData() {
        const { vertexData, indexData, numVertices } = createCubeVerticesAndNormal();
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

