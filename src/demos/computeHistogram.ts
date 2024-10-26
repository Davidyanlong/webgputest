import { Base } from "../common/base"
import computeHistogramShaderCode from '../shaders/computeHistogram/histogramChunk.wgsl?raw'
import computeChunkSumShaderCode from '../shaders/computeHistogram/chunkSum.wgsl?raw'
import { loadImageBitmap } from "../utils/res"
import { GenerateMips } from "../common/generateMips"
import { anyNull, GPUBindGroupNull, GPUBufferNull, GPUComputePipelineNull, GPUTextureNull } from "../common/constant"


export class ComputeHistogram extends Base {
    private static bindGroup: GPUBindGroup
    private static chunksBuffer: GPUBuffer
    private static resultBuffer: GPUBuffer
    private static isComputed: boolean;

    public static dispatchCount: [number, number];
    public static workgroupSize: [number, number];
    private static container: HTMLDivElement

    private static chunkSumPipeline: GPUComputePipeline
    private static sumBindGroups: GPUBindGroup[]
    private static numChunks: number
    private static imgBitmap: ImageBitmap
    private static texture: GPUTexture

    static async initialize(device: GPUDevice) {

        await super.initialize(device)

        // 初始化参数
        this.workgroupSize = [256, 1];

        //#region  compute pipeline
        const computeModule: GPUShaderModule = device.createShaderModule({
            label: 'histogram chunk shader',
            code: this.replaceShader(computeHistogramShaderCode, [
                { key: 'chunkWidth', value: this.workgroupSize[0] },
                { key: 'chunkHeight', value: this.workgroupSize[1] },
                { key: 'chunkSize', value: this.workgroupSize[0] * this.workgroupSize[1] },
            ])
        });
        const chunkSumModule: GPUShaderModule = device.createShaderModule({
            label: 'chunk sum shader',
            code: this.replaceShader(computeChunkSumShaderCode, [
                { key: 'chunkWidth', value: this.workgroupSize[0] },
                { key: 'chunkHeight', value: this.workgroupSize[1] },
                { key: 'chunkSize', value: this.workgroupSize[0] * this.workgroupSize[1] },
            ])

        })


        this.pipeline = device.createComputePipeline({
            label: 'histogram',
            layout: 'auto',
            compute: {
                module: computeModule,
            },
        });

        this.chunkSumPipeline = device.createComputePipeline({
            label: 'histogram chunk',
            layout: 'auto',
            compute: {
                module: chunkSumModule,
            },
        });



        const imgBitmap = this.imgBitmap = await loadImageBitmap('./images/pexels-francesco-ungaro-96938-mid.jpg');
        // const imgBitmap = this.imgBitmap = await loadImageBitmap('./Granite_paving_tileable_512x512.jpeg');
        // const imgBitmap = this.imgBitmap = await loadImageBitmap('./coins.jpg');
        // const imgBitmap = this.imgBitmap = await loadImageBitmap('./cube/leadenhall_market/pos-x.jpg');
        const texture = this.texture = GenerateMips.createTextureFromSource(device, imgBitmap);



        const chunkWidth = this.workgroupSize[0];
        const chunkHeight = this.workgroupSize[1];
        const chunkSize = chunkWidth * chunkHeight;
        const chunksAcross = Math.ceil(texture.width / chunkWidth);
        const chunksDown = Math.ceil(texture.height / chunkHeight);
        this.numChunks = chunksAcross * chunksDown;

        this.dispatchCount = [chunksAcross, chunksDown];

        this.chunksBuffer = device.createBuffer({
            size: this.numChunks * chunkSize * 4,  // 4 bytes per (u32)
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        this.resultBuffer = device.createBuffer({
            size: chunkSize * 4,  // 4 bytes per (u32)
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });


        this.bindGroup = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.chunksBuffer } },
                { binding: 1, resource: texture.createView() },
            ],
        });

        this.sumBindGroups = []
        const numSteps = Math.ceil(Math.log2(this.numChunks));

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
                    { binding: 0, resource: { buffer: this.chunksBuffer } },
                    { binding: 1, resource: { buffer: uniformBuffer } },
                ],
            });
            this.sumBindGroups.push(chunkSumBindGroup);
        }

        this.container = document.querySelector('#computeHistogram')!;
        this.container.innerHTML = ''

        this.isInited = true;
        this.isComputed = false;

    }

    static update() {
        if (!this.isInited) return;
        if (this.isComputed) return;
        //#region compute encode
        // Encode commands to do the computation
        const computeEncoder = this.device!.createCommandEncoder({
            label: 'compute builtin encoder',
        });
        const computePass = computeEncoder.beginComputePass({
            label: 'compute builtin pass',
        });
        computePass.setPipeline(this.pipeline as GPUComputePipeline);
        // 设置bindGroup buffer的偏移量
        computePass.setBindGroup(0, this.bindGroup);
        // 设置计算通道
        computePass.dispatchWorkgroups(...this.dispatchCount);


        // reduce the chunks
        computePass.setPipeline(this.chunkSumPipeline);
        let chunksLeft = this.numChunks;

        this.sumBindGroups.forEach(bindGroup => {
            computePass.setBindGroup(0, bindGroup);
            const dispatchCount = Math.floor(chunksLeft / 2);
            chunksLeft -= dispatchCount;
            computePass.dispatchWorkgroups(dispatchCount);
        });

        computePass.end();

        // copy data to result buffer
        computeEncoder.copyBufferToBuffer(this.chunksBuffer, 0, this.resultBuffer, 0, this.resultBuffer.size);
        const computeCommandBuffer = computeEncoder.finish();
        //#endregion
        this.device!.queue.submit([computeCommandBuffer]);

        this.isComputed = true;

        this.getBufferData();
    }

    static destroy(): void {
        super.destroy();

        this.isComputed = true;
        this.bindGroup = GPUBindGroupNull
        this.chunksBuffer?.destroy();
        this.chunksBuffer = GPUBufferNull;
        this.resultBuffer?.destroy();
        this.resultBuffer = GPUBufferNull;

        this.dispatchCount = anyNull;
        this.workgroupSize = anyNull;
        this.container.innerHTML = '';

        this.chunkSumPipeline = GPUComputePipelineNull
        this.sumBindGroups = anyNull
        this.imgBitmap?.close();
        this.imgBitmap = anyNull
        this.texture?.destroy();
        this.texture = GPUTextureNull;
    }

    static async getBufferData() {
        if (!this.isInited) return null;
        // Read the results
        await this.resultBuffer.mapAsync(GPUMapMode.READ);
        const histogram = new Uint32Array(this.resultBuffer.getMappedRange());
        this.showImageBitmap(this.imgBitmap);

        const numEntries = this.texture.width * this.texture.height;
        this.drawHistogram(histogram, numEntries);


    }
    private static showImageBitmap(imageBitmap: ImageBitmap) {
        const canvas = document.createElement('canvas');
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;

        canvas.style.height = `150px`
        canvas.style.width = `300px`

        const bm = canvas.getContext('bitmaprenderer')!;
        bm.transferFromImageBitmap(imageBitmap);
        this.container.appendChild(canvas);
    }

    private static drawHistogram(histogram: Uint32Array, numEntries: number, height = 120) {
        const numBins = histogram.length;
        const max = Math.max(...histogram);
        const scale = Math.max(1 / max, 0.2 * numBins / numEntries);

        const canvas = document.createElement('canvas');
        canvas.width = numBins;
        canvas.height = height;
        this.container.appendChild(canvas);
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#fff';

        for (let x = 0; x < numBins; ++x) {
            const v = histogram[x] * scale * height;
            ctx.fillRect(x, height - v, 1, v);
        }
    }

    private static replaceShader(code: string, replaceObj: keyValue[]) {
        replaceObj.forEach((kv: keyValue) => {
            code = code.replace(`$${kv.key}$`, `${kv.value}`)
        })

        return code;

    }
}

interface keyValue {
    key: string,
    value: number
}