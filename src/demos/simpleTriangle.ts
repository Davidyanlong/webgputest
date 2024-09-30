import { Base } from "./base"

/**
 * 渲染基本流程
 * 简单的三角形
 */
export class SimpleTriangle extends Base{
    private static context2: GPUCanvasContext

    static async initalize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('simpleTriangle1')
        this.context2 = super.initCanvas('simpleTriangle2',true)

        //#endregion

        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'our hardcoded red triangle shaders',
            code: `
       @vertex fn vs(
         @builtin(vertex_index) vertexIndex : u32
       ) -> @builtin(position) vec4f {
         let pos = array(
           vec2f( 0.0,  0.5),  // top center
           vec2f(-0.5, -0.5),  // bottom left
           vec2f( 0.5, -0.5)   // bottom right
         );
  
         return vec4f(pos[vertexIndex], 0.0, 1.0);
       }
  
       struct output{
         @location(0) color1:vec4f,
         @location(1) color2:vec4f,
       }
       @fragment fn fs() -> output {
         var out:output;
         out.color1 = vec4f(1.0, 0.0, 0.0, 1.0);
         out.color2 = vec4f(1.0, 1.0, 0.0, 1.0);
         return out;
       }
     `,
        });

        //#endregion

        //#region  render pipeline
        SimpleTriangle.pipeline = device.createRenderPipeline({
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
                    { format: this.presentationFormat }
                ],
            },
        });

        //#endregion

        //#region  渲染队列参数
        SimpleTriangle.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: this.context!.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.context2!.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };
        //#endregion
        SimpleTriangle.isInited = true;
    }
    static update() {
       
    }

    static draw() {
        if(!SimpleTriangle.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(SimpleTriangle.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            SimpleTriangle.context!.getCurrentTexture().createView());


        let colorAttach2 = Array.from(
            SimpleTriangle.renderPassDescriptor.colorAttachments)[1];

        colorAttach2 && (colorAttach2.view =
            SimpleTriangle.context2!.getCurrentTexture().createView());

        // make a command encoder to start encoding commands
        const encoder = SimpleTriangle.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(SimpleTriangle.renderPassDescriptor);
        pass.setPipeline(SimpleTriangle.pipeline as GPURenderPipeline);
        pass.draw(3);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        SimpleTriangle.device!.queue.submit([commandBuffer]);
    }
    static destory() {

    }
}

