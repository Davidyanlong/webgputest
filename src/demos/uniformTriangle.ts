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
    private static setting: Record<string, any>
    private static gui:any

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
        this.initGUI()
        this.valueChange = true
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

    }

    private static initGUI() {
        // @ts-ignore
        const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

        if(this.gui) return;

        this.setting = {
            color: '#00ff00',
            scaleX: 1,
            scaleY: 1,
            offsetX: 0,
            offsetY: 0,
        }


        // @ts-ignore
        const gui = this.gui = new GUI({
            parent: (this.context.canvas as HTMLCanvasElement).parentElement,
            width: '145px'
        })
        gui.domElement.style.top = '-300px';
        gui.domElement.style.left = '150px';

        this.setting
        gui.addColor( this.setting, 'color').onChange((v:string)=>{
            this.color = [...hexToRgb(v), 1]
            this.valueChange = true;
        })
        gui.add(this.setting,'scaleX',0.1, 2).onChange((v:number)=>{
            this.scale[0] = v
            this.valueChange = true;
        })
        gui.add(this.setting,'scaleY',0.1, 2).onChange((v:number)=>{
            this.scale[1] = v
            this.valueChange = true;
        })
        gui.add(this.setting,'offsetX',-1, 1).onChange((v:number)=>{
            this.offset[0] = v
            this.valueChange = true;
        })
        gui.add(this.setting,'offsetY',-1, 1).onChange((v:number)=>{
            this.offset[1] = v
            this.valueChange = true;
        })

    }
   
}


