import { Base } from "../common/base"

import histogramChunkShaderCode from '../shaders/computeVideo/histogramChunk.wgsl?raw'
import chunkSumShaderCode from '../shaders/computeVideo/chunkSum.wgsl?raw'
import scaleShaderCode from '../shaders/computeVideo/scale.wgsl?raw'
import drawHistogramShaderCode from '../shaders/computeVideo/drawHistogram.wgsl?raw'
import videoShaderCode from '../shaders/computeVideo/video.wgsl?raw'

import { startPlayingAndWaitForVideo } from "../utils/video"
import { range, subpart } from "../utils/utils"
import { mat4 } from "../utils/mat4"
import { anyNull, Float32ArrayNull, GPUBindGroupNull, GPUBufferNull, GPUCommandEncoderNull, GPUComputePipelineNull, GPURenderPipelineNull, GPUSamplerNull } from "../common/constant"


export class ComputeVideoHistogram extends Base {

    public static dispatchCount: [number, number];
    public static workgroupSize: [number, number];

    private static chunksBuffer: GPUBuffer
    private static videoUniformBuffer: GPUBuffer
    private static scaleBuffer: GPUBuffer

    private static chunkSumPipeline: GPUComputePipeline
    private static scalePipeline: GPUComputePipeline
    private static histogramChunkPipeline: GPUComputePipeline
    private static drawHistogramPipeline: GPURenderPipeline
    private static videoPipeline: GPURenderPipeline

    private static sumBindGroups: GPUBindGroup[]
    private static numChunks: number
    private static video: HTMLVideoElement
    private static histogramDrawInfos: objInfo[]


    private static chunkSize: number
    private static chunksAcross: number
    private static chunksDown: number
    private static encoder: GPUCommandEncoder

    private static videoSampler: GPUSampler
    private static texture: GPUExternalTexture

    private static videoMatrix: Float32Array
    private static videoUniformValues: Float32Array

    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('computeVideoHistogram')

        // 参数初始化
        this.sumBindGroups = [];
        this.histogramDrawInfos = [];
        this.workgroupSize = [256, 1];

        const chunkWidth = this.workgroupSize[0];
        const chunkHeight = this.workgroupSize[1];
        const chunkSize = this.chunkSize = chunkWidth * chunkHeight;

        //#region  compute pipeline
        const histogramChunkModule: GPUShaderModule = device.createShaderModule({
            label: 'histogram chunk shader',
            code: this.replaceShader(histogramChunkShaderCode, [
                { key: 'chunkWidth', value: this.workgroupSize[0] },
                { key: 'chunkHeight', value: this.workgroupSize[1] },
                { key: 'chunkSize', value: chunkSize },
            ])
        });
        const chunkSumModule: GPUShaderModule = device.createShaderModule({
            label: 'chunk sum shader',
            code: this.replaceShader(chunkSumShaderCode, [
                { key: 'chunkWidth', value: this.workgroupSize[0] },
                { key: 'chunkHeight', value: this.workgroupSize[1] },
                { key: 'chunkSize', value: chunkSize },
            ])

        })

        const scaleModule: GPUShaderModule = device.createShaderModule({
            label: 'histogram scale shader',
            code: scaleShaderCode
        });

        const drawHistogramModule = device.createShaderModule({
            label: 'draw histogram shader',
            code: drawHistogramShaderCode
        });

        const videoModule = device.createShaderModule({
            label: 'our hardcoded external textured quad shaders',
            code: videoShaderCode
        });


        this.histogramChunkPipeline = device.createComputePipeline({
            label: 'histogram',
            layout: 'auto',
            compute: {
                module: histogramChunkModule,
            },
        });

        this.chunkSumPipeline = device.createComputePipeline({
            label: 'chunk sum',
            layout: 'auto',
            compute: {
                module: chunkSumModule,
            },
        });

        this.chunkSumPipeline = device.createComputePipeline({
            label: 'histogram chunk',
            layout: 'auto',
            compute: {
                module: chunkSumModule,
            },
        });

        this.scalePipeline = device.createComputePipeline({
            label: 'max',
            layout: 'auto',
            compute: {
                module: scaleModule,
            },
        });


        this.drawHistogramPipeline = device.createRenderPipeline({
            label: 'draw histogram',
            layout: 'auto',
            vertex: {
                module: drawHistogramModule,
            },
            fragment: {
                module: drawHistogramModule,
                targets: [{ format: this.presentationFormat }],
            },
        });

        this.videoPipeline = device.createRenderPipeline({
            label: 'hardcoded video textured quad pipeline',
            layout: 'auto',
            vertex: {
                module: videoModule,
            },
            fragment: {
                module: videoModule,
                targets: [{ format: this.presentationFormat }],
            },
        });


        this.videoSampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });


        // create a typedarray to hold the values for the uniforms in JavaScript
        const videoUniformValues = this.videoUniformValues = new Float32Array(16 * 4);
        // create a buffer for the uniform values
        this.videoUniformBuffer = device.createBuffer({
            label: 'uniforms for video',
            size: videoUniformValues.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const kMatrixOffset = 0;
        this.videoMatrix = videoUniformValues.subarray(kMatrixOffset, 16);


        const { video } = await this.initTexture();


        const chunksAcross = this.chunksAcross = Math.ceil(video.videoWidth / chunkWidth);
        const chunksDown = this.chunksDown = Math.ceil(video.videoHeight / chunkHeight);
        const numChunks = this.numChunks = chunksAcross * chunksDown;

        const chunksBuffer = this.chunksBuffer = device.createBuffer({
            size: numChunks * chunkSize * 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const scaleBuffer = this.scaleBuffer = device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.STORAGE,
        });


        this.sumBindGroups = [];
        const numSteps = Math.ceil(Math.log2(numChunks));
        for (let i = 0; i < numSteps; ++i) {
            const stride = 2 ** i;
            const uniformBuffer = device.createBuffer({
                size: 4,
                usage: GPUBufferUsage.UNIFORM,
                mappedAtCreation: true,
            });
            new Uint32Array(uniformBuffer.getMappedRange()).set([stride]);
            uniformBuffer.unmap();

            const chunkSumBindGroup = device.createBindGroup({
                layout: this.chunkSumPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: chunksBuffer } },
                    { binding: 1, resource: { buffer: uniformBuffer } },
                ],
            });
            this.sumBindGroups.push(chunkSumBindGroup);
        }


        this.histogramDrawInfos = [
            [0, 1, 2],
            [3],
        ].map(channels => {
            //        matrix: mat4x4f;
            //        colors: array<vec4f, 16>;
            //        channelMult; vec4u,
            const uniformValuesAsF32 = new Float32Array(16 + 64 + 4 + 4);
            const uniformValuesAsU32 = new Uint32Array(uniformValuesAsF32.buffer);
            const uniformBuffer = device.createBuffer({
                label: 'draw histogram uniform buffer',
                size: uniformValuesAsF32.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });



            const matrix = subpart(uniformValuesAsF32, 0, 16) as Float32Array;
            const colors = subpart(uniformValuesAsF32, 16, 64);
            const channelMult = subpart(uniformValuesAsU32, 16 + 64, 4);
            channelMult.set(range(4, i => channels.indexOf(i) >= 0 ? 2 ** i : 0));
            colors.set([
                [0, 0, 0, 1],
                [1, 0, 0, 1],
                [0, 1, 0, 1],
                [1, 1, 0, 1],
                [0, 0, 1, 1],
                [1, 0, 1, 1],
                [0, 1, 1, 1],
                [0.5, 0.5, 0.5, 1],
                [1, 1, 1, 1],
                [1, 1, 1, 1],
                [1, 1, 1, 1],
                [1, 1, 1, 1],
                [1, 1, 1, 1],
                [1, 1, 1, 1],
                [1, 1, 1, 1],
                [1, 1, 1, 1],
            ].flat());

            const drawHistogramBindGroup = device.createBindGroup({
                layout: this.drawHistogramPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: chunksBuffer, size: chunkSize * 4 * 4 } },
                    { binding: 1, resource: { buffer: uniformBuffer } },
                    { binding: 2, resource: { buffer: scaleBuffer } },
                ],
            });

            return {
                drawHistogramBindGroup,
                matrix,
                uniformBuffer,
                uniformValuesAsF32,
            };
        });


        this.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: this.context.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };

        this.isInited = true;

    }



    static update() {
        if (!this.isInited) return;

        const texture = this.texture = this.device.importExternalTexture({ source: this.video });

        // make a bind group for to make a histogram from this video texture
        const histogramBindGroup = this.device.createBindGroup({
            layout: this.histogramChunkPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.chunksBuffer } },
                { binding: 1, resource: texture },
            ],
        });


        const scaleBindGroup = this.device.createBindGroup({
            layout: this.scalePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.chunksBuffer, size: this.chunkSize * 4 * 4 } },
                { binding: 1, resource: { buffer: this.scaleBuffer } },
                { binding: 2, resource: texture },
            ],
        });

        const encoder = this.encoder = this.device.createCommandEncoder({ label: 'histogram encoder' });

        {
            const pass = encoder.beginComputePass();

            // create a histogram for each chunk
            pass.setPipeline(this.histogramChunkPipeline);
            pass.setBindGroup(0, histogramBindGroup);
            pass.dispatchWorkgroups(this.chunksAcross, this.chunksDown);

            // reduce the chunks
            pass.setPipeline(this.chunkSumPipeline);
            let chunksLeft = this.numChunks;
            this.sumBindGroups.forEach(bindGroup => {
                pass.setBindGroup(0, bindGroup);
                const dispatchCount = Math.floor(chunksLeft / 2);
                chunksLeft -= dispatchCount;
                pass.dispatchWorkgroups(dispatchCount);
            });

            // Compute scales for the channels
            pass.setPipeline(this.scalePipeline);
            pass.setBindGroup(0, scaleBindGroup);
            pass.dispatchWorkgroups(1);

            pass.end();
        }



        {
            let canvas = this.context.canvas as HTMLCanvasElement
            // 'cover' canvas
            const canvasAspect = canvas.clientWidth / canvas.clientHeight;
            const videoAspect = this.video.videoWidth / this.video.videoHeight;
            const scale: [number, number, number] = canvasAspect > videoAspect
                ? [1, canvasAspect / videoAspect, 1]
                : [videoAspect / canvasAspect, 1, 1];

            const matrix = mat4.identity(this.videoMatrix);
            mat4.scale(matrix, scale, matrix);
            mat4.translate(matrix, [-1, 1, 0], matrix);
            mat4.scale(matrix, [2, -2, 1], matrix);

            this.device.queue.writeBuffer(this.videoUniformBuffer, 0, this.videoUniformValues);
        }

        {
            // Draw Histograms
            this.histogramDrawInfos.forEach(({
                matrix,
                uniformBuffer,
                uniformValuesAsF32,
            }, i) => {
                mat4.identity(matrix);
                mat4.translate(matrix, [-0.95 + i, -1, 0], matrix);
                mat4.scale(matrix, [0.9, 0.5, 1], matrix);

                this.device.queue.writeBuffer(uniformBuffer, 0, uniformValuesAsF32);
            });

        }

    }

    static draw(): void {
        if (!this.isInited) return;


        // Draw to canvas
        {

            let colorAttach = Array.from(this.renderPassDescriptor.colorAttachments)[0];
            colorAttach && (colorAttach.view =
                this.context!.getCurrentTexture().createView());

            const pass = this.encoder.beginRenderPass(this.renderPassDescriptor);

            // Draw video
            const bindGroup = this.device.createBindGroup({
                layout: this.videoPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: this.videoSampler },
                    { binding: 1, resource: this.texture },
                    { binding: 2, resource: { buffer: this.videoUniformBuffer } },
                ],
            });
            pass.setPipeline(this.videoPipeline);
            pass.setBindGroup(0, bindGroup);
            pass.draw(6);  // call our vertex shader 6 times
            // Draw Histograms
            this.histogramDrawInfos.forEach(({
                drawHistogramBindGroup,
            }) => {

                pass.setPipeline(this.drawHistogramPipeline);
                pass.setBindGroup(0, drawHistogramBindGroup);
                pass.draw(6);  // call our vertex shader 6 times
            });

            pass.end();
        }

        const commandBuffer = this.encoder.finish();
        this.device.queue.submit([commandBuffer]);
    }

    static destroy(): void {
        super.destroy();

        this.video?.pause();
        this.video?.removeAttribute('src');
        this.video = anyNull

        this.dispatchCount = anyNull;
        this.workgroupSize = anyNull;

        this.chunksBuffer?.destroy();
        this.chunksBuffer = GPUBufferNull;

        this.videoUniformBuffer?.destroy();
        this.videoUniformBuffer = GPUBufferNull;

        this.scaleBuffer?.destroy();
        this.scaleBuffer = GPUBufferNull;

        this.chunkSumPipeline = GPUComputePipelineNull
        this.scalePipeline = GPUComputePipelineNull
        this.histogramChunkPipeline = GPUComputePipelineNull
        this.drawHistogramPipeline = GPURenderPipelineNull
        this.videoPipeline = GPURenderPipelineNull

        this.sumBindGroups = anyNull;

        let objInfo;
        while (objInfo = this.histogramDrawInfos?.pop()) {
            objInfo.drawHistogramBindGroup = GPUBindGroupNull
            objInfo.matrix = Float32ArrayNull
            objInfo.uniformBuffer?.destroy();
            objInfo.uniformBuffer = GPUBufferNull
            objInfo.uniformValuesAsF32 = Float32ArrayNull
        }
        this.histogramDrawInfos = anyNull

        this.encoder = GPUCommandEncoderNull

        this.videoSampler = GPUSamplerNull; 

        // GPUExternalTexture
        this.texture = anyNull;

        this.videoMatrix = Float32ArrayNull;
        this.videoUniformValues = Float32ArrayNull;

    }


    private static replaceShader(code: string, replaceObj: keyValue[]) {
        replaceObj.forEach((kv: keyValue) => {
            code = code.replace(`$${kv.key}$`, `${kv.value}`)
        })

        return code;

    }

    private static async initTexture() {

        const video = this.video = document.createElement('video');
        video.muted = true;
        video.loop = true;
        video.preload = 'auto';
        video.src = './videos/pexels-kosmo-politeska-5750980 (1080p).mp4';
        //video.src = './videos/production_id_4166349 (540p).mp4'; 
        //video.src = './videos/production_id_5077580 (1080p).mp4'; 

        await startPlayingAndWaitForVideo(video);

        return {
            video
        };

    }
}

interface keyValue {
    key: string,
    value: number
}

interface objInfo {
    drawHistogramBindGroup: GPUBindGroup,
    matrix: Float32Array,
    uniformBuffer: GPUBuffer,
    uniformValuesAsF32: Float32Array,
}