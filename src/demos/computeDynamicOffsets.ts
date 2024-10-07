import { Base } from "../common/base"
import shadercode from '../shaders/computeDynamicOffsets/computeDynamicOffsets.wgsl?raw'

export class ComputeDynamicOffsets extends Base {
    public static numLen = 5
    private static bindGroup: GPUBindGroup
    private static input: Float32Array = new Float32Array(64 * 3)
    private static workBuffer: GPUBuffer
    private static resultBuffer: GPUBuffer
    private static isComputed: boolean;

    static async initialize(device: GPUDevice) {

        await super.initialize(device)

        //#region  compute pipeline
        const computeModule: GPUShaderModule = device.createShaderModule({
            label: 'doubling compute module',
            code: shadercode,
        });

        // layout 设置buffer 是hasDynamicOffset
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                        hasDynamicOffset: true,
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                        hasDynamicOffset: true,
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                        hasDynamicOffset: true,
                    },
                },
            ],
        });

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });

        this.pipeline = device.createComputePipeline({
            label: 'add elements compute pipeline',
            layout: pipelineLayout,
            compute: {
                module: computeModule,
            },
        });


        // create a buffer on the GPU to hold our computation
        // input and output
        this.workBuffer = device.createBuffer({
            label: 'work buffer',
            size: this.input.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.workBuffer, 0, this.input);


        // create a buffer on the GPU to get a copy of the results
        this.resultBuffer = device.createBuffer({
            label: 'result buffer',
            size: this.input.byteLength,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });


        // Setup a bindGroup to tell the shader which
        // buffer to use for the computation
        this.bindGroup = device.createBindGroup({
            label: 'bindGroup for work buffer',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.workBuffer, size: 256 } },
                { binding: 1, resource: { buffer: this.workBuffer, size: 256 } },
                { binding: 2, resource: { buffer: this.workBuffer, size: 256 } },
            ],
        });

        //#endregion

        // 测试计算管线
        const button = document.querySelector('#getSimpleCompute2') as HTMLButtonElement;
        const resultSpan = document.querySelector('#simpleComputeResult2') as HTMLSpanElement;
        button.addEventListener('click', (e) => {
            e.stopPropagation()
            this.setData(this.getRandomNums())
            this.setData(this.getRandomNums(), 64)
            this.update(0);
            this.getBufferData().then((data) => {
                console.log(data);
                resultSpan.innerHTML = `input:<br/> a: ${data?.input.slice(0, this.numLen)} <br/> b: ${data?.input.slice(64, 64 + this.numLen)} <br/>result: ${data?.result.slice(128, 128+this.numLen)}`
            })
        }, false);

        this.isInited = true;

    }
    private static getRandomNums(){
        let arr = []
        for(let i=0;i<this.numLen;i++){
            arr.push(Math.round(Math.random() * 100))
        }
        return arr
    }
    static update(dt: number) {
        if (!this.isInited) return;
        if (this.isComputed) return;
        //#region compute encode
        // Encode commands to do the computation
        const computeEncoder = this.device!.createCommandEncoder({
            label: 'doubling encoder',
        });
        const computePass = computeEncoder.beginComputePass({
            label: 'doubling compute pass',
        });
        computePass.setPipeline(this.pipeline as GPUComputePipeline);
        // 设置bindGroup buffer的偏移量
        computePass.setBindGroup(0, this.bindGroup,[0, 256, 512]);
        // 设置计算通道
        computePass.dispatchWorkgroups(this.numLen);
        computePass.end();

        // copy data to result buffer
        computeEncoder.copyBufferToBuffer(this.workBuffer, 0, this.resultBuffer, 0, this.resultBuffer.size);
        const computeCommandBuffer = computeEncoder.finish();


        //#endregion

        this.device!.queue.submit([computeCommandBuffer]);
        this.isComputed = true;
    }


    static setData(arr: number[], offset:number = 0) {
        this.input.set(arr, offset);
        this.device.queue.writeBuffer(this.workBuffer, 0, this.input);
        this.isComputed = false;
    }

    static async getBufferData() {
        if (!this.isInited) return null;
        await this.resultBuffer.mapAsync(GPUMapMode.READ);
        const result = new Float32Array(this.resultBuffer.getMappedRange().slice(0));
        this.resultBuffer.unmap();

        return {
            input: this.input,
            result
        }
    }
}