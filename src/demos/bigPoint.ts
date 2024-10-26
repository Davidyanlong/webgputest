import { Base } from "../common/base"
import { Float32ArrayNull, GPUBindGroupNull, GPUBufferNull } from "../common/constant";
import shadercode from '../shaders/bigPoint/bigPoint.wgsl?raw'
import { createFibonacciSphereVertices } from "../utils/createFibonacciSphereVertices";
import { mat4 } from "../utils/mat4";
/**
 * 渲染基本流程
 * 顶点着色渲染
 */
export class BigPoint extends Base {
    public static kNumPoints: number;

    private static resolutionValue: Float32Array
    private static uniformBuffer: GPUBuffer
    private static uniformValues: Float32Array
    private static bindGroup: GPUBindGroup
    private static vertexBuffer: GPUBuffer
    private static matrixValue: Float32Array
    private static sizeValue: Float32Array

    static async initialize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('bigPoint')

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'point marker shaders',
            code: shadercode,
        });
        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: '3d points with fixed size',
            layout: 'auto',
            vertex: {
                module,
                buffers: [
                    {
                        arrayStride: (3) * 4, // 2 floats, 4 bytes each
                        stepMode: 'instance',  // 以实例化的方式读取顶点
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
                        ],
                    },
                ],
            },
            fragment: {
                module,
                targets: [
                    {
                        format: this.presentationFormat,
                    },
                ],
            },
        });

        //#endregion
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
    static update(dt: number): void {
        const time = dt * 0.001;
        if (!this.isInited) return;
        const canvas = this.context.canvas as HTMLCanvasElement
        // Set the size in the uniform values
        this.sizeValue[0] = 10;

        const fov = 90 * Math.PI / 180;
        const aspect = canvas.clientWidth / canvas.clientHeight;
        const projection = mat4.perspective(fov, aspect, 0.1, 50);
        const view = mat4.lookAt(
            new Float32Array([0, 0, 1.5]),  // position
            new Float32Array([0, 0, 0]),    // target
            new Float32Array([0, 1, 0]),    // up
        );
        const viewProjection = mat4.multiply(projection, view);
        mat4.rotateY(viewProjection, time, this.matrixValue);
        mat4.rotateX(this.matrixValue, time * 0.1, this.matrixValue);

        // Update the resolution in the uniform values
        this.resolutionValue.set([canvas.width, canvas.height]);

        // Copy the uniform values to the GPU
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

        this.resolutionValue = Float32ArrayNull

        this.uniformBuffer?.destroy();
        this.uniformBuffer = GPUBufferNull;

        this.uniformValues = Float32ArrayNull;
        this.bindGroup = GPUBindGroupNull;

        this.vertexBuffer?.destroy();
        this.vertexBuffer = GPUBufferNull;
        this.matrixValue = Float32ArrayNull
        this.sizeValue = Float32ArrayNull
    }


    private static initVertex() {

        // 顶点数据
        const vertexData = createFibonacciSphereVertices({
            radius: 1,
            numSamples: 500,
        });
        this.kNumPoints = vertexData.length / 3;


        const vertexBuffer = this.vertexBuffer = this.device.createBuffer({
            label: 'vertex buffer vertices',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(vertexBuffer, 0, vertexData);

        // Uniform 数据
        const uniformValues = this.uniformValues = new Float32Array(16 + 2 + 1 + 1);
        const uniformBuffer = this.uniformBuffer = this.device.createBuffer({
            size: uniformValues.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const kMatrixOffset = 0;
        const kResolutionOffset = 16;
        const kSizeOffset = 18;
        this.matrixValue = uniformValues.subarray(
            kMatrixOffset, kMatrixOffset + 16);
        this.resolutionValue = uniformValues.subarray(
            kResolutionOffset, kResolutionOffset + 2);
        this.sizeValue = uniformValues.subarray(
            kSizeOffset, kSizeOffset + 1);

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
            ],
        });
    }
}

