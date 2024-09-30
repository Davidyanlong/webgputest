import { Base } from "./base"

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

    static async initalize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('uniformTriangle')

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: `
                struct OurStruct {
                    color: vec4f,
                    scale: vec2f,
                    offset: vec2f,
                };
 
                @group(0) @binding(0) var<uniform> ourStruct: OurStruct;
                @vertex fn vs(
                    @builtin(vertex_index) vertexIndex : u32
                ) -> @builtin(position) vec4f {
                    let pos = array(
                    vec2f( 0.0,  0.5),  // top center
                    vec2f(-0.5, -0.5),  // bottom left
                    vec2f( 0.5, -0.5)   // bottom right
                    );
            
                   return vec4f(pos[vertexIndex] * ourStruct.scale + ourStruct.offset, 0.0, 1.0);
                }
            
                @fragment fn fs() -> @location(0) vec4f {
                   return ourStruct.color;
                }
        `,
        });

        //#endregion

        //#region  render pipeline
        UniformTriangle.pipeline = device.createRenderPipeline({
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
        UniformTriangle.uniformBuffer = device.createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // create a typedarray to hold the values for the uniforms in JavaScript
        UniformTriangle.uniformValues = new Float32Array(uniformBufferSize / 4);

        UniformTriangle.bindGroup = device.createBindGroup({
            layout: UniformTriangle.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: UniformTriangle.uniformBuffer
                    }
                },
            ],
        });

        //#region  渲染队列参数
        UniformTriangle.renderPassDescriptor = {
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

        UniformTriangle.initHTMLControl();
        //#endregion
        UniformTriangle.isInited = true;
    }

    static update() {
        if (!UniformTriangle.isInited) return;
        if (UniformTriangle.valueChange) {
            UniformTriangle.uniformValues.set(UniformTriangle.color, UniformTriangle.kColorOffset);        // set the color
            UniformTriangle.uniformValues.set(UniformTriangle.offset, UniformTriangle.kOffsetOffset);      // set the offset
            UniformTriangle.uniformValues.set([UniformTriangle.scale[0] / UniformTriangle.aspect, UniformTriangle.scale[1]], UniformTriangle.kScaleOffset); // set the scale

            // copy the values from JavaScript to the GPU
            UniformTriangle.device.queue.writeBuffer(UniformTriangle.uniformBuffer, 0, UniformTriangle.uniformValues);
            UniformTriangle.valueChange = false
        }
    }

    static draw() {
        if (!UniformTriangle.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(UniformTriangle.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            UniformTriangle.context!.getCurrentTexture().createView());

        // make a command encoder to start encoding commands
        const encoder = UniformTriangle.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(UniformTriangle.renderPassDescriptor);
        pass.setPipeline(this.pipeline as GPURenderPipeline);
        pass.setBindGroup(0, UniformTriangle.bindGroup);
        pass.draw(3);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        UniformTriangle.device!.queue.submit([commandBuffer]);
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
        UniformTriangle.color = [...hexToRgb(value), 1]
        UniformTriangle.valueChange = true;
    }

    private static scaleXChange(e: Event) {

        const value = (e.target as HTMLInputElement).value;
        UniformTriangle.scale[0] = +value
        UniformTriangle.valueChange = true;
    }

    private static offstXChange(e: Event) {

        const value = (e.target as HTMLInputElement).value;
        UniformTriangle.offset[0] = +value
        UniformTriangle.valueChange = true;
    }
}

function hexToRgb(hex: string): [number, number, number] {
    return [
        parseInt('0x' + hex.slice(1, 3)) / 255,
        parseInt('0x' + hex.slice(3, 5)) / 255,
        parseInt('0x' + hex.slice(5, 7)) / 255
    ];
}
