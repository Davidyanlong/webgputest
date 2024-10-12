import { Base } from "../common/base"
import shadercode from '../shaders/uniformTriangle/uniform_triangle.wgsl?raw'
import { hexToRgb } from "../utils/color";

/**
 * 渲染基本流程
 * bindGroup / uniform 学习
 */
export class UniformTriangle extends Base {
    private static bindGroup: GPUBindGroup
    private static kColorOffset = 0;
    private static kScaleOffset = 4;
    private static kOffsetOffset = 6;
    private static color: [number, number, number, number] = [0, 1, 0, 1]
    private static scale: [number, number] = [0.5, 0.5]
    private static offset: [number, number] = [-0.5, -0.25]
    private static uniformValues: Float32Array
    private static uniformBuffer: GPUBuffer
    private static valueChange = true

    static async initialize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('uniformTriangle')

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: shadercode,
        });

        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: 'our hardcoded red triangle pipeline',
            layout: 'auto',
            vertex: {
                entryPoint: 'vs',
                module,
            },
            fragment: {
                entryPoint: 'fs',
                module,
                targets: [
                    { format: this.presentationFormat },
                ],
            },
        });

        //#endregion


        const uniformBufferSize =
            4 * 4 + // color is 4 32bit floats (4bytes each)
            2 * 4 + // scale is 2 32bit floats (4bytes each)
            2 * 4;  // offset is 2 32bit floats (4bytes each)
        this.uniformBuffer = device.createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // create a typedarray to hold the values for the uniforms in JavaScript
        this.uniformValues = new Float32Array(uniformBufferSize / 4);

        this.bindGroup = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformBuffer
                    }
                },
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
                }
            ],
        };

        this.initHTMLControl();
        //#endregion
        this.isInited = true;
    }

    static update() {
        if (!this.isInited) return;
        if (this.valueChange) {
            this.uniformValues.set(this.color, this.kColorOffset);        // set the color
            this.uniformValues.set(this.offset, this.kOffsetOffset);      // set the offset
            this.uniformValues.set([this.scale[0] / this.aspect, this.scale[1]], this.kScaleOffset); // set the scale

            // copy the values from JavaScript to the GPU
            this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformValues);
            this.valueChange = false
        }
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
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(3);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }
    static destory() {
        const parentDom = (this.context.canvas as HTMLCanvasElement).parentElement!;
        {
            const input = parentDom.querySelector('#uniformTriangleInputColor') as HTMLInputElement
            input.removeEventListener('input', UniformTriangle.colorChange)
        }
        {
            const input = parentDom.querySelector('#uniformTriangleInputScaleX') as HTMLInputElement
            input.removeEventListener('input', UniformTriangle.scaleXChange)
        }

        {
            const input = parentDom.querySelector('#uniformTriangleInputOffsetX') as HTMLInputElement
            input.removeEventListener('input', UniformTriangle.offstXChange)
        }


    }
    //#region  user control
    private static initHTMLControl() {
        const parentDom = (this.context.canvas as HTMLCanvasElement).parentElement!;
        parentDom.style.position = 'relative';
        {
            const input = document.createElement('input');
            input.id = "uniformTriangleInputColor"
            input.type = "color"
            input.style.position = 'absolute';
            input.style.right = '5px';
            input.style.top = '5px';
            input.value = '#00ff00'
            input.addEventListener('input', UniformTriangle.colorChange, false)
            parentDom?.appendChild(input);
        }
        {
            const input = document.createElement('input');
            input.id = "uniformTriangleInputScaleX"
            input.type = "range"
            input.min = '0.1';
            input.max = '2';
            input.step = '0.1'
            input.value = '0.5'
            input.style.position = 'absolute';
            input.style.right = '5px';
            input.style.top = '35px';
            input.addEventListener('input', UniformTriangle.scaleXChange, false)
            parentDom?.appendChild(input);
        }

        {
            const input = document.createElement('input');
            input.id = "uniformTriangleInputOffsetX"
            input.type = "range"
            input.min = '-1';
            input.max = '1';
            input.step = '0.1'
            input.value = '-0.5'
            input.style.position = 'absolute';
            input.style.right = '5px';
            input.style.top = '65px';
            input.addEventListener('input', UniformTriangle.offstXChange, false)
            parentDom?.appendChild(input);
        }


    }
    private static colorChange(e: Event) {

        const value = (e.target as HTMLInputElement).value;
        console.log(hexToRgb(value))
        this.color = [...hexToRgb(value), 1]
        this.valueChange = true;
    }

    private static scaleXChange(e: Event) {

        const value = (e.target as HTMLInputElement).value;
        this.scale[0] = +value
        this.valueChange = true;
    }

    private static offstXChange(e: Event) {

        const value = (e.target as HTMLInputElement).value;
        this.offset[0] = +value
        this.valueChange = true;
    }
    //#endregion
}


