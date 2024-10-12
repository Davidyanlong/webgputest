import { Base } from "../common/base"
import shadercode from '../shaders/textureImageMipmap/texture_image_mipmap.wgsl?raw'
import { GenerateMips } from "../common/generateMips"
import { mat4 } from "wgpu-matrix"
import { CanvasAnimationTexture } from "../utils/createCanvasTexture"

/**
 * 渲染基本流程
 * 简单的三角形
 */
export class TextureCanvasMipmap extends Base {
    private static objectInfos: objectInfoInterface[] = []
    private static texNdx = 0;
    private static viewProjectionMatrix: Float32Array
    private static canvasAnimationTexture: CanvasAnimationTexture
    private static texture: GPUTexture
    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('textureCanvasMipmap')

        const module = device.createShaderModule({
            label: 'our hardcoded textured quad shaders',
            code: shadercode,
        });

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

        const textures = await this.initTexture()

        this.context.canvas.addEventListener('click', () => {
            this.texNdx = (this.texNdx + 1) % textures.length;
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
        };
        //#endregion


        const fov = 60 * Math.PI / 180;  // 60 degrees in radians
        const canvas = this.context.canvas as HTMLCanvasElement;
        const aspect = canvas.clientWidth / canvas.clientHeight;
        const zNear = 1;
        const zFar = 2000;
        const projectionMatrix = mat4.perspective(fov, aspect, zNear, zFar);

        const cameraPosition = [0, 0, 2];
        const up = [0, 1, 0];
        const target = [0, 0, 0];
        const viewMatrix = mat4.lookAt(cameraPosition, target, up);
        this.viewProjectionMatrix = mat4.multiply(projectionMatrix, viewMatrix);

        this.isInited = true;
    }


    static update(dt: number) {
        if (!this.isInited) return;
        this.canvasAnimationTexture.update2DCanvas(dt);
        GenerateMips.copySourceToTexture(this.device, this.texture, this.canvasAnimationTexture.ctx.canvas);
        // 数据更新
        this.objectInfos.forEach(({ matrix, uniformBuffer, uniformValues }, i) => {
            const xSpacing = 1.2;
            const ySpacing = 0.7;
            const zDepth = 50;

            const x = i % 4 - 1.5;
            const y = i < 4 ? 1 : -1;

            mat4.translate(this.viewProjectionMatrix, [x * xSpacing, y * ySpacing, -zDepth * 0.5], matrix);
            mat4.rotateX(matrix, 0.5 * Math.PI, matrix);
            mat4.scale(matrix, [1, zDepth * 2, 1], matrix);
            mat4.translate(matrix, [-0.5, -0.5, 0], matrix);

            // copy the values from JavaScript to the GPU
            this.device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

        });
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
        pass.setPipeline(this.pipeline as GPURenderPipeline)
        this.objectInfos.forEach(({ bindGroups }) => {
            const bindGroup = bindGroups[this.texNdx];
            pass.setBindGroup(0, bindGroup);
            pass.draw(6);  // call our vertex shader 6 times
        });
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }

    private static async initTexture() {

        this.canvasAnimationTexture = new CanvasAnimationTexture()
        this.canvasAnimationTexture.initialize();
        this.canvasAnimationTexture.update2DCanvas(0);

        this.texture = GenerateMips.createTextureFromSource(this.device, this.canvasAnimationTexture.ctx.canvas, { mips: true })

        const textures = await Promise.all([
            this.texture
        ]);

        // offsets to the various uniform values in float32 indices
        const kMatrixOffset = 0;

        for (let i = 0; i < 8; ++i) {
            const sampler = this.device.createSampler({
                addressModeU: 'repeat',
                addressModeV: 'repeat',
                magFilter: (i & 1) ? 'linear' : 'nearest',
                minFilter: (i & 2) ? 'linear' : 'nearest',
                mipmapFilter: (i & 4) ? 'linear' : 'nearest',
            });

            // create a buffer for the uniform values
            const uniformBufferSize =
                16 * 4; // matrix is 16 32bit floats (4bytes each)
            const uniformBuffer = this.device.createBuffer({
                label: 'uniforms for quad',
                size: uniformBufferSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            // create a typedarray to hold the values for the uniforms in JavaScript
            const uniformValues = new Float32Array(uniformBufferSize / 4);
            const matrix = uniformValues.subarray(kMatrixOffset, 16);

            const bindGroups = textures.map(texture =>
                this.device.createBindGroup({
                    layout: this.pipeline.getBindGroupLayout(0),
                    entries: [
                        { binding: 0, resource: sampler },
                        { binding: 1, resource: texture.createView() },
                        { binding: 2, resource: { buffer: uniformBuffer } },
                    ],
                }));

            // Save the data we need to render this object.
            this.objectInfos.push({
                bindGroups,
                matrix,
                uniformValues,
                uniformBuffer,
            });
        }
        return textures;
    }
}

interface objectInfoInterface {

    bindGroups: GPUBindGroup[],
    matrix: Float32Array,
    uniformValues: Float32Array,
    uniformBuffer: GPUBuffer,

}