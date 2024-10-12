import { Base } from "../common/base"
import shadercode from '../shaders/simpleCompute/simple_compute.wgsl?raw'

export class SimpleCompute extends Base {
    private static bindGroup: GPUBindGroup
    private static input: Float32Array=new Float32Array(3)
    private static workBuffer: GPUBuffer
    private static resultBuffer: GPUBuffer
    private static isComputed:boolean;

    static async initialize(device: GPUDevice) {

       await super.initialize(device)

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
        SimpleCompute.workBuffer = device.createBuffer({
            label: 'work buffer',
            size: SimpleCompute.input.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(SimpleCompute.workBuffer, 0, SimpleCompute.input);


        // create a buffer on the GPU to get a copy of the results
        SimpleCompute.resultBuffer = device.createBuffer({
            label: 'result buffer',
            size: SimpleCompute.input.byteLength,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });


        // Setup a bindGroup to tell the shader which
        // buffer to use for the computation
        SimpleCompute.bindGroup = device.createBindGroup({
            label: 'bindGroup for work buffer',
            layout: SimpleCompute.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: SimpleCompute.workBuffer
                    }
                },
            ],
        });

        //#endregion

        // 测试计算管线
        const button = document.querySelector('#getSimpleCompute') as HTMLButtonElement;
        const resultSpan = document.querySelector('#simpleComputeResult') as HTMLSpanElement;
        button.addEventListener('click', (e)=>{
            e.stopPropagation();

            SimpleCompute.setData([Math.round(Math.random()*100), Math.round(Math.random()*100), Math.round(Math.random()*100)])
            SimpleCompute.update();
            SimpleCompute.getBufferData().then((data)=>{
                console.log(data);
                resultSpan.innerHTML = `input: ${data?.input} <br/>result: ${data?.result}`
            })
        }, false);

        SimpleCompute.isInited = true;

    }
    static update() {
        if (!SimpleCompute.isInited) return;
        if(SimpleCompute.isComputed) return;
        //#region compute encode
        // Encode commands to do the computation
        const computeEncoder = SimpleCompute.device!.createCommandEncoder({
            label: 'doubling encoder',
        });
        const computePass = computeEncoder.beginComputePass({
            label: 'doubling compute pass',
        });
        computePass.setPipeline(this.pipeline as GPUComputePipeline);
        computePass.setBindGroup(0, SimpleCompute.bindGroup);
        computePass.dispatchWorkgroups(SimpleCompute.input.length);
        computePass.end();

        // copy data to result buffer
        computeEncoder.copyBufferToBuffer(SimpleCompute.workBuffer, 0, SimpleCompute.resultBuffer, 0, SimpleCompute.resultBuffer.size);
        const computeCommandBuffer = computeEncoder.finish();


        //#endregion

        SimpleCompute.device!.queue.submit([computeCommandBuffer]);
        SimpleCompute.isComputed =true;
    }


    static setData(arr:number[]){
        SimpleCompute.input = new Float32Array(arr);
        SimpleCompute.device.queue.writeBuffer(SimpleCompute.workBuffer, 0, SimpleCompute.input);
        SimpleCompute.isComputed = false;
    }

    static async getBufferData() {
        if (!SimpleCompute.isInited) return null;
        await SimpleCompute.resultBuffer.mapAsync(GPUMapMode.READ);
        const result = new Float32Array(SimpleCompute.resultBuffer.getMappedRange().slice(0));
        SimpleCompute.resultBuffer.unmap();

        return {
            input: SimpleCompute.input,
            result
        }
    }
}