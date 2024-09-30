import { Base } from "./base"

/**
 * 渲染基本流程
 * 顶点着色渲染
 */
export class ColorVertexTriangle  extends Base{
    static async initalize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('colorVertexTriangle')

        ColorVertexTriangle.device = device;

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'our hardcoded rgb  triangle shaders',
            code: `
                struct OurVertexShaderOutput {
                    @builtin(position) position: vec4f,
                    @location(0) color: vec4f,
                };
                @vertex fn vs(
                    @builtin(vertex_index) vertexIndex : u32
                ) -> OurVertexShaderOutput {
                    let pos = array(
                    vec2f( 0.0,  0.5),  // top center
                    vec2f(-0.5, -0.5),  // bottom left
                    vec2f( 0.5, -0.5)   // bottom right
                    );

                    var color = array<vec4f, 3>(
                    vec4f(1, 0, 0, 1), // red
                    vec4f(0, 1, 0, 1), // green
                    vec4f(0, 0, 1, 1), // blue
                    );
            
                   var vsOutput: OurVertexShaderOutput;
                    vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
                    vsOutput.color = color[vertexIndex];
                    return vsOutput;
                }
            
                @fragment fn fs(fsInput: OurVertexShaderOutput) ->  @location(0) vec4f  {
                    return fsInput.color;
                }
                
                // // 也可以这样传参
                // @fragment fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
                //     return color;
                // }
     `,
        });

        //#endregion

        //#region  render pipeline
        ColorVertexTriangle.pipeline = device.createRenderPipeline({
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
                    { format: this.presentationFormat }
                ],
            },
        });

        //#endregion

        //#region  渲染队列参数
        ColorVertexTriangle.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: this.context!.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };
        //#endregion
        ColorVertexTriangle.isInited = true;
    }
    static update() {
       
    }

    static draw() {
        if(!ColorVertexTriangle.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(ColorVertexTriangle.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            ColorVertexTriangle.context!.getCurrentTexture().createView());

        // make a command encoder to start encoding commands
        const encoder = ColorVertexTriangle.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(ColorVertexTriangle.renderPassDescriptor);
        pass.setPipeline(ColorVertexTriangle.pipeline as GPURenderPipeline);
        pass.draw(3);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        ColorVertexTriangle.device!.queue.submit([commandBuffer]);
    }
    static destory() {

    }
}

