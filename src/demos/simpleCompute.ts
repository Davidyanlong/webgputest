import { Base } from "../common/base"
import shadercode from '../shaders/simpleCompute/simple_compute.wgsl?raw'

/**
 * 最简单的计算管线示例
 */
export class SimpleCompute extends Base {
    private static bindGroup: GPUBindGroup
    private static input: Float32Array
    private static workBuffer: GPUBuffer
    private static resultBuffer: GPUBuffer
    private static isComputed:boolean;

    static async initialize(device: GPUDevice) {

       await super.initialize(device)
       
       //参数初始化
        this.input = new Float32Array(3)

        //#region  compute pipeline
        const computeModule: GPUShaderModule = device.createShaderModule({
            label: 'doubling compute module',
            code: shadercode,
        });


        this.pipeline = device.createComputePipeline({
            label: 'doubling compute pipeline',
            layout: 'auto',
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
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.workBuffer
                    }
                },
            ],
        });

        //#endregion

        // 测试计算管线
        const button = document.querySelector('#getSimpleCompute') as HTMLButtonElement;
        button.addEventListener('click', this.clickEvent, false);

        this.isInited = true;

    }
    static update() {
        if (!this.isInited) return;
        if(this.isComputed) return;
        //#region compute encode
        // Encode commands to do the computation
        const computeEncoder = this.device!.createCommandEncoder({
            label: 'doubling encoder',
        });
        const computePass = computeEncoder.beginComputePass({
            label: 'doubling compute pass',
        });
        computePass.setPipeline(this.pipeline as GPUComputePipeline);
        computePass.setBindGroup(0, this.bindGroup);
        computePass.dispatchWorkgroups(this.input.length);
        computePass.end();

        // copy data to result buffer
        computeEncoder.copyBufferToBuffer(this.workBuffer, 0, this.resultBuffer, 0, this.resultBuffer.size);
        const computeCommandBuffer = computeEncoder.finish();


        //#endregion

        this.device!.queue.submit([computeCommandBuffer]);
        this.isComputed =true;
    }

    static destroy(): void {
        super.destroy();

        this.workBuffer?.destroy();
        this.resultBuffer?.destroy();
        (this.input as any) = null;
        const button = document.querySelector('#getSimpleCompute') as HTMLButtonElement;
        button.removeEventListener('click', this.clickEvent, false);

    }


    static setData(arr:number[]){
        this.input = new Float32Array(arr);
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
    private static clickEvent = (e:Event)=>{
        e.stopPropagation();
        const resultSpan = document.querySelector('#simpleComputeResult') as HTMLSpanElement;
        this.setData([Math.round(Math.random()*100), Math.round(Math.random()*100), Math.round(Math.random()*100)])
        this.update();
        this.getBufferData().then((data)=>{
            console.log(data);
            resultSpan.innerHTML = `input: ${data?.input} <br/>result: ${data?.result}`
        })
    }

}