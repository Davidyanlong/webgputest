import { Base } from "../common/base"
import { anyNull, GPUBindGroupLayoutNull, GPUBindGroupNull, GPUBufferNull } from "../common/constant"
import shadercode from '../shaders/computeShader/computeShader.wgsl?raw'
import { arrayProd } from "../utils/utils"

export class ComputeShader extends Base {
    private static bindGroup: GPUBindGroup
    private static workgroupReadBuffer: GPUBuffer
    private static localReadBuffer: GPUBuffer
    private static globalReadBuffer: GPUBuffer
    private static workgroupBuffer: GPUBuffer
    private static localBuffer: GPUBuffer
    private static globalBuffer: GPUBuffer
    private static isComputed: boolean;

    public static dispatchCount: [number, number, number];
    public static workgroupSize: [number, number, number];
    private static numThreadsPerWorkgroup: number
    private static container: HTMLDivElement
    private static numResults: number

    static async initialize(device: GPUDevice) {

        await super.initialize(device)

        // 参数初始化
        this.dispatchCount = [4, 3, 2];
        this.workgroupSize = [2, 3, 4]

        this.numThreadsPerWorkgroup = arrayProd(this.workgroupSize);

        //#region  compute pipeline
        const computeModule: GPUShaderModule = device.createShaderModule({
            label: 'doubling compute module',
            code: shadercode,
        });

        this.pipeline = device.createComputePipeline({
            label: 'compute pipeline',
            layout: 'auto',
            compute: {
                module: computeModule,
                constants: {
                    workgroupSizeX: this.workgroupSize[0],
                    workgroupSizeY: this.workgroupSize[1],
                    workgroupSizeZ: this.workgroupSize[2],
                    numThreadsPerWorkgroup:this.numThreadsPerWorkgroup
                  },
            },
        });

        const numWorkgroups = arrayProd(this.dispatchCount);
        const numResults = this.numResults = numWorkgroups * this.numThreadsPerWorkgroup;
        const size = numResults * 4 * 4;  // vec3f * u32

        let usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
        this.workgroupBuffer = device.createBuffer({ size, usage });
        this.localBuffer = device.createBuffer({ size, usage });
        this.globalBuffer = device.createBuffer({ size, usage });

        usage = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;
        this.workgroupReadBuffer = device.createBuffer({ size, usage });
        this.localReadBuffer = device.createBuffer({ size, usage });
        this.globalReadBuffer = device.createBuffer({ size, usage });

        this.bindGroup = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.workgroupBuffer } },
                { binding: 1, resource: { buffer: this.localBuffer } },
                { binding: 2, resource: { buffer: this.globalBuffer } },
            ],
        });

        this.container = document.querySelector('#computeShaderDom')!;
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
        computePass.end();

        // copy data to result buffer
        computeEncoder.copyBufferToBuffer(this.workgroupBuffer, 0, this.workgroupReadBuffer, 0, this.workgroupReadBuffer.size);
        computeEncoder.copyBufferToBuffer(this.localBuffer, 0, this.localReadBuffer, 0, this.localReadBuffer.size);
        computeEncoder.copyBufferToBuffer(this.globalBuffer, 0, this.globalReadBuffer, 0, this.globalReadBuffer.size);
        const computeCommandBuffer = computeEncoder.finish();
        //#endregion
        this.device!.queue.submit([computeCommandBuffer]);

        this.isComputed = true;

        this.getBufferData();
    }

    static async getBufferData() {
        if (!this.isInited) return null;
        // Read the results
        await Promise.all([
            this.workgroupReadBuffer.mapAsync(GPUMapMode.READ),
            this.localReadBuffer.mapAsync(GPUMapMode.READ),
            this.globalReadBuffer.mapAsync(GPUMapMode.READ),
        ]);

        const workgroup = new Uint32Array(this.workgroupReadBuffer.getMappedRange());
        const local = new Uint32Array(this.localReadBuffer.getMappedRange());
        const global = new Uint32Array(this.globalReadBuffer.getMappedRange());

        for (let i = 0; i < this.numResults; ++i) {
            if (i % this.numThreadsPerWorkgroup === 0) {
                this.log(`\
        ---------------------------------------
        global                 local     global   dispatch: ${i / this.numThreadsPerWorkgroup}
        invoc.    workgroup    invoc.    invoc.
        index     id           id        id
        ---------------------------------------`);
            }
            this.log(`${i.toString().padStart(3)}:      ${get3(workgroup, i)}      ${get3(local, i)}   ${get3(global, i)}`);
        }


    }

    static destroy(): void {
        super.destroy();

        this.isComputed = true;

        this.bindGroup = GPUBindGroupNull;
        this.workgroupReadBuffer?.destroy();
        this.workgroupBuffer = GPUBufferNull;

        this.localReadBuffer?.destroy();
        this.localReadBuffer = GPUBufferNull

        this.globalReadBuffer?.destroy();
        this.globalBuffer = GPUBufferNull;

        this.workgroupBuffer?.destroy();
        this.workgroupBuffer = GPUBufferNull

        this.localBuffer?.destroy();
        this.localBuffer = GPUBufferNull

        this.globalBuffer?.destroy();
        this.globalBuffer =GPUBufferNull;
    
        this.dispatchCount = anyNull
        this.workgroupSize = anyNull;

        this.container.innerHTML = '';

    }

    private static log(...args: any[]) {
        const elem = document.createElement('pre');
        elem.textContent = args.join(' ');
        this.container.appendChild(elem)
    }
}


const get3 = (arr: Uint32Array, i: number) => {
    const off = i * 4;
    return `${arr[off]}, ${arr[off + 1]}, ${arr[off + 2]}`;
};