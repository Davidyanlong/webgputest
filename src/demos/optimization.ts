import { Base } from "../common/base";
import { anyNull, Float32ArrayNull, GPUBufferNull, GPUSamplerNull, GPUTextureNull } from "../common/constant";
import { GenerateMips } from "../common/generateMips";
import { GPUContext } from "../common/gpuContext";
import shadercode from '../shaders/optimization/optimization.wgsl?raw'
import { hslToRGBA } from "../utils/color";
import { createBufferWithData } from "../utils/createBufferWithData";
import { createCubeVertices_Normal_Texcoord } from "../utils/cube";
import { mat3 } from "../utils/mat3";
import { mat4 } from "../utils/mat4";
import { RollingAverage, TimingHelper } from "../utils/timeingHelper";
import { degToRad, rand, randomArrayElement, roundUp } from "../utils/utils";
import { vec3 } from "../utils/vec3";

/**
 * 渲染基本流程
 * TimestampQuery
 */
export class Optimization extends Base {

    private static vertexBuffer: GPUBuffer;
    private static indicesBuffer: GPUBuffer;
    private static numVertices: number;
    private static objectInfos: objectInfosType[] = [];
    private static timingHelper: TimingHelper;
    private static then: number = 0
    private static fpsAverage: RollingAverage
    private static jsAverage: RollingAverage
    private static gpuAverage: RollingAverage
    private static mathAverage: RollingAverage;
    private static infoElem: HTMLDivElement
    private static canTimestamp: boolean
    private static materials: Material[]

    private static globalUniformBuffer: GPUBuffer
    private static viewProjectionValue: Float32Array
    private static lightWorldPositionValue: Float32Array
    private static viewWorldPositionValue: Float32Array
    private static maxObjects: number;
    private static uniformBuffer: GPUBuffer
    private static uniformBufferSpace: number
    private static mappedTransferBuffers: GPUBuffer[]
    private static kNormalMatrixOffset: number
    private static kWorldOffset: number
    private static uniformBufferSize: number
    private static globalUniformValues: Float32Array


    static async initialize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('optimization')

        // 参数初始化
        this.maxObjects = 30000;
        this.materials = [];
        this.objectInfos = [];
        this.mappedTransferBuffers = [];
        // offsets to the various uniform values in float32 indices
        this.kNormalMatrixOffset = 0;
        this.kWorldOffset = 12;



        this.timingHelper = new TimingHelper(device);

        this.fpsAverage = new RollingAverage();
        this.jsAverage = new RollingAverage();
        this.gpuAverage = new RollingAverage();
        this.mathAverage = new RollingAverage();


        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: shadercode,
        });

        //#endregion


        const { vertexData, indices, numVertices } = createCubeVertices_Normal_Texcoord();
        this.vertexBuffer = createBufferWithData(device, vertexData, GPUBufferUsage.VERTEX);
        this.indicesBuffer = createBufferWithData(device, indices, GPUBufferUsage.INDEX);
        this.numVertices = numVertices;

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: 'textured model with point light w/specular highlight',
            layout: 'auto',
            vertex: {
                module,
                buffers: [
                    {
                        arrayStride: (3 + 3 + 2) * 4, // position normal texcoord, 4 bytes each
                        attributes: [
                            {   // position
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x3'
                            },
                            {   // normal
                                shaderLocation: 1,
                                offset: 3 * 4,
                                format: 'float32x3'
                            },
                            {   // texcoord
                                shaderLocation: 2,
                                offset: 6 * 4,
                                format: 'float32x2'
                            }
                        ]
                    }
                ]
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

        this.initTexture();


        const globalUniformBufferSize = (16 + 4 + 4) * 4;
        this.globalUniformBuffer = device.createBuffer({
            label: 'global uniforms',
            size: globalUniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const globalUniformValues = this.globalUniformValues = new Float32Array(globalUniformBufferSize / 4);

        const kViewProjectionOffset = 0;
        const kLightWorldPositionOffset = 16;
        const kViewWorldPositionOffset = 20;

        this.viewProjectionValue = globalUniformValues.subarray(
            kViewProjectionOffset, kViewProjectionOffset + 16);
        this.lightWorldPositionValue = globalUniformValues.subarray(
            kLightWorldPositionOffset, kLightWorldPositionOffset + 3);
        this.viewWorldPositionValue = globalUniformValues.subarray(
            kViewWorldPositionOffset, kViewWorldPositionOffset + 3);


        this.uniformBufferSize = (12 + 16) * 4;
        this.uniformBufferSpace = roundUp(this.uniformBufferSize, device.limits.minUniformBufferOffsetAlignment);
        this.uniformBuffer = device.createBuffer({
            label: 'uniforms',
            size: this.uniformBufferSpace * this.maxObjects,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });





        for (let i = 0; i < this.maxObjects; ++i) {
            const uniformBufferOffset = i * this.uniformBufferSpace;

            const material = randomArrayElement(this.materials);

            const bindGroup = device.createBindGroup({
                label: 'bind group for object',
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: material.texture.createView() },
                    { binding: 1, resource: material.sampler },
                    { binding: 2, resource: { buffer: this.uniformBuffer, offset: uniformBufferOffset, size: this.uniformBufferSize } },
                    { binding: 3, resource: { buffer: this.globalUniformBuffer } },
                    { binding: 4, resource: { buffer: material.materialUniformBuffer } },
                ],
            });

            const axis = vec3.normalize(new Float32Array([rand(-1, 1), rand(-1, 1), rand(-1, 1)]));
            const radius = rand(10, 100);
            const speed = rand(0.1, 0.4);
            const rotationSpeed = rand(-1, 1);
            const scale = rand(2, 10);

            this.objectInfos.push({
                bindGroup,

                axis,
                radius,
                speed,
                rotationSpeed,
                scale,
            });
        }



        //#region  渲染队列参数
        this.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: this.context!.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                }
            ],
            depthStencilAttachment: {
                // 暂时使用，防止语法报错，更新时候会替换
                view: this.context!.getCurrentTexture().createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };
        //#endregion

        this.initGUI();
        this.statInit();

        this.isInited = true;
    }
    static update(): void {

        if (!this.isInited) return;
        const canvas = this.context.canvas as HTMLCanvasElement
        const aspect = canvas.clientWidth / canvas.clientHeight;
        const projection = mat4.perspective(
            degToRad(60),
            aspect,
            1,      // zNear
            2000,   // zFar
        );

        const eye = new Float32Array([100, 150, 200]);
        const target = new Float32Array([0, 0, 0]);
        const up = new Float32Array([0, 1, 0]);

        // Compute a view matrix
        const viewMatrix = mat4.lookAt(eye, target, up);

        // Combine the view and projection matrixes
        mat4.multiply(projection, viewMatrix, this.viewProjectionValue);

        this.lightWorldPositionValue.set([-10, 30, 300]);
        this.viewWorldPositionValue.set(eye);

        this.device.queue.writeBuffer(this.globalUniformBuffer, 0, this.globalUniformValues);


    }

    static draw(dt: number) {
        let time = dt * 0.001;
        const deltaTime = time - this.then;
        const startTime = performance.now();
        let mathElapsedTimeMs = 0;

        if (!this.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(this.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            this.context!.getCurrentTexture().createView());

        super.getDepthTexture();
        this.renderPassDescriptor!.depthStencilAttachment!.view = this.depthTexture!.createView()


        // make a command encoder to start encoding commands
        const encoder = this.device!.createCommandEncoder({
            label: 'our encoder'
        });

        //#region  unifromBuffer 更新
        // 这里必须是临时变量， 不然会报错
        const transferBuffer = this.getMappedTransferBuffer();
        const uniformValues = new Float32Array(transferBuffer.getMappedRange());

        for (let i = 0; i < this.settings.numObjects; ++i) {
            const {
                axis,
                radius,
                speed,
                rotationSpeed,
                scale,
            } = this.objectInfos[i];
            const mathTimeStartMs = performance.now();

            // Make views into the mapped buffer.
            const uniformBufferOffset = i * this.uniformBufferSpace;
            const f32Offset = uniformBufferOffset / 4;
            const normalMatrixValue = uniformValues.subarray(
                f32Offset + this.kNormalMatrixOffset, f32Offset + this.kNormalMatrixOffset + 12);
            const worldValue = uniformValues.subarray(
                f32Offset + this.kWorldOffset, f32Offset + this.kWorldOffset + 16);

            // Compute a world matrix
            mat4.identity(worldValue);
            mat4.axisRotate(worldValue, axis, i + time * speed, worldValue);
            mat4.translate(worldValue, [0, 0, Math.sin(i * 3.721 + time * speed) * radius], worldValue);
            mat4.translate(worldValue, [0, 0, Math.sin(i * 9.721 + time * 0.1) * radius], worldValue);
            mat4.rotateX(worldValue, time * rotationSpeed + i, worldValue);
            mat4.scale(worldValue, [scale, scale, scale], worldValue);

            // Inverse and transpose it into the normalMatrix value
            mat3.fromMat4(mat4.transpose(mat4.inverse(worldValue)), normalMatrixValue);

            mathElapsedTimeMs += performance.now() - mathTimeStartMs;
        }
        transferBuffer.unmap();

        // copy the uniform values from the transfer buffer to the uniform buffer
        if (this.settings.numObjects) {
            const size = (this.settings.numObjects - 1) * this.uniformBufferSpace + this.uniformBufferSize;
            encoder.copyBufferToBuffer(transferBuffer, 0, this.uniformBuffer, 0, size);
        }
        //#endregion

        const pass = this.timingHelper.beginRenderPass(encoder, this.renderPassDescriptor) as GPURenderPassEncoder;
        pass.setPipeline(this.pipeline as GPURenderPipeline);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setIndexBuffer(this.indicesBuffer, 'uint16');



        for (let i = 0; i < this.settings.numObjects; ++i) {
            const { bindGroup } = this.objectInfos[i];
            pass.setBindGroup(0, bindGroup);
            pass.drawIndexed(this.numVertices);
        }


        pass.end();


        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
        transferBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
            this.mappedTransferBuffers.push(transferBuffer);
        });


        this.timingHelper.getResult().then(gpuTime => {
            this.gpuAverage.addSample(gpuTime / 1000);
        });

        const jsTime = performance.now() - startTime;
        if (this.then != 0) {
            this.fpsAverage.addSample(1 / deltaTime);
        }

        this.jsAverage.addSample(jsTime);
        this.mathAverage.addSample(jsTime);
        this.stat();
        this.then = time;
    }

    static destroy(): void {
        super.destroy();
        this.vertexBuffer?.destroy();
        this.vertexBuffer = GPUBufferNull;

        this.indicesBuffer?.destroy();
        this.indicesBuffer = GPUBufferNull;

        let objInfo;
        while (objInfo = this.objectInfos?.pop()) {
            objInfo.bindGroup = anyNull;
            objInfo.axis = anyNull
            objInfo.radius = anyNull
            objInfo.rotationSpeed = anyNull
            objInfo.scale = anyNull
            objInfo.speed = anyNull
        }
        this.objectInfos = anyNull;

        this.timingHelper?.destroy();
        this.timingHelper = anyNull;

        this.fpsAverage?.destroy();
        this.fpsAverage = anyNull
        this.jsAverage?.destroy();
        this.jsAverage = anyNull;
        this.gpuAverage?.destroy();
        this.gpuAverage = anyNull;
        this.mathAverage?.destroy();
        this.mathAverage = anyNull
        if (this.infoElem) {
            this.infoElem.innerHTML = ''
        }

        let mat;
        while (mat = this.materials?.pop()) {
            mat.materialUniformBuffer?.destroy();
            mat.materialUniformBuffer = GPUBufferNull
            mat.sampler = GPUSamplerNull
            mat.texture?.destroy()
            mat.texture = GPUTextureNull
        }
        this.materials = anyNull;

        this.globalUniformBuffer?.destroy();
        this.globalUniformBuffer = GPUBufferNull;

        this.viewProjectionValue = Float32ArrayNull
        this.lightWorldPositionValue = Float32ArrayNull
        this.viewWorldPositionValue = Float32ArrayNull

        this.uniformBuffer?.destroy();
        this.uniformBuffer = GPUBufferNull

        let buffer;
        while (buffer = this.mappedTransferBuffers?.pop()) {
            buffer.destroy();
        }

        this.mappedTransferBuffers = anyNull
        this.globalUniformValues = Float32ArrayNull

    }


    protected static initGUI() {
        if (this.gui) return;
        super.initGUI();

        this.settings = {
            numObjects: 1000,
        };

        // @ts-ignore  
        this.gui.add(this.settings, 'numObjects', { min: 0, max: this.maxObjects, step: 1 });

    }

    private static statInit() {
        this.canTimestamp = GPUContext.adapter.features.has('timestamp-query');
        const parent = (this.context.canvas as HTMLCanvasElement).parentElement
        let infoElem = parent!.querySelector('#statElement') as HTMLDivElement
        if (infoElem) {
            infoElem.innerHTML = ''
            parent?.removeChild(infoElem)
        }
        infoElem = this.infoElem = document.createElement('div')
        infoElem.id = 'statElement';
        infoElem.style.cssText = ` 
            position: relative;
            top: -350px;
            left: 0;
            margin: 0;
            padding: 0.5em;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            width:120px;
            `
        parent?.appendChild(infoElem);
    }
    private static stat() {
        this.infoElem.innerText = `\
            fps: ${this.fpsAverage.get().toFixed(1)}
            math: ${this.mathAverage.get().toFixed(1)}ms
            js: ${this.jsAverage.get().toFixed(1)}ms
            gpu: ${this.canTimestamp ? `${this.gpuAverage.get().toFixed(1)}µs` : 'N/A'}
            `
    }
    private static initTexture() {
        const textures = [
            '😂', '👾', '👍', '👀', '🌞', '🛟',
        ].map(s => {
            const size = 128;
            const ctx = new OffscreenCanvas(size, size).getContext('2d')!;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, size, size);
            ctx.font = `${size * 0.9}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s, size / 2, size / 2);
            return GenerateMips.createTextureFromSource(this.device, ctx.canvas, { mips: true });
        });

        const sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'nearest',
        });


        const numMaterials = 20;
        const materials: Material[] = this.materials = [];
        for (let i = 0; i < numMaterials; ++i) {
            const color = hslToRGBA(rand(), rand(0.5, 0.8), rand(0.5, 0.7));
            const shininess = rand(10, 120);

            const materialValues = new Float32Array([
                ...color,
                shininess,
                0, 0, 0,  // padding
            ]);
            const materialUniformBuffer = createBufferWithData(
                this.device,
                materialValues,
                GPUBufferUsage.UNIFORM,
            );

            materials.push({
                materialUniformBuffer,
                texture: randomArrayElement(textures),
                sampler,
            });
        }



        return {
            textures,
            sampler
        }

    }

    private static getMappedTransferBuffer() {
        return this.mappedTransferBuffers.pop() || this.device.createBuffer({
            label: 'transfer buffer',
            size: this.uniformBufferSpace * this.maxObjects,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
    }

}



interface objectInfosType {
    bindGroup: GPUBindGroup
    axis: Float32Array
    radius: number
    speed: number
    rotationSpeed: number
    scale: number
}

interface Material {
    materialUniformBuffer: GPUBuffer,
    texture: GPUTexture,
    sampler: GPUSampler,
}