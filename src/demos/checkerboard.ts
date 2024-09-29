/**
 * 渲染基本流程
 * 网格渲染
 */
export class Checkerboard {
    private static pipeline: GPURenderPipeline
    private static renderPassDescriptor: GPURenderPassDescriptor
    private static context: GPUCanvasContext
    private static device:GPUDevice
    private static isInited = false

    static async initalize(device: GPUDevice) {

        Checkerboard.device = device;

        //#region initilize
        const canvas = document.querySelector('#canvas4') as HTMLCanvasElement;
        const context = Checkerboard.context= canvas!.getContext('webgpu')!;
        // "bgra8unorm"
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        context?.configure({
            device,
            format: presentationFormat,
        });

        //#endregion

        //#region  shaderModule
        const vsModule = device.createShaderModule({
            label: 'hardcoded triangle',
            code: `
              struct OurVertexShaderOutput {
                @builtin(position) position: vec4f,
                // 数据传递方式 perspective linear flat
                 @location(1) @interpolate(linear) z: f32
              };
         
              @vertex fn vs(
                @builtin(vertex_index) vertexIndex : u32
              ) -> OurVertexShaderOutput {
                let pos = array(
                  vec2f( 0.0,  0.5),  // top center
                  vec2f(-0.5, -0.5),  // bottom left
                  vec2f( 0.5, -0.5)   // bottom right
                );
         
                var vsOutput: OurVertexShaderOutput;
                vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
                vsOutput.z = abs(vsOutput.position.x+0.5);
                return vsOutput;
              }
            `,
          });

          const fsModule = device.createShaderModule({
            label: 'checkerboard',
            code: `
              @fragment fn fs(
              //  @builtin(position) 数据的区间是[0,300] 屏幕坐标
              @builtin(position) pixelPosition: vec4f,   
               @location(1) @interpolate(linear) z: f32,
              ) -> @location(0) vec4f {
                let red = vec4f(1, 0, 0, 1);
                let cyan = vec4f(0, 1, 1, 1);
                let grid = vec2u(pixelPosition.xy) / 8;
                let checker = (grid.x + grid.y) % 2 == 1;
         
                return  select(red, cyan, checker);
              }
            `,
          });

        const module = device.createShaderModule({
            label: 'hardcoded checkerboard triangle shaders',
            code: `
                struct OurVertexShaderOutput {
                    @builtin(position) position: vec4f,
                };
                @vertex fn vs(
                    @builtin(vertex_index) vertexIndex : u32
                ) -> OurVertexShaderOutput {
                    let pos = array(
                    vec2f( 0.0,  0.5),  // top center
                    vec2f(-0.5, -0.5),  // bottom left
                    vec2f( 0.5, -0.5)   // bottom right
                    );

            
                   var vsOutput: OurVertexShaderOutput;
                    vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
                    return vsOutput;
                }
            
                @fragment fn fs(fsInput: OurVertexShaderOutput) ->  @location(0) vec4f  {
                   let red = vec4f(1, 0, 0, 1);
                   let cyan = vec4f(0, 1, 1, 1);

                   let grid = vec2u(fsInput.position.xy) / 3;
                   let checker = (grid.x + grid.y) % 2 == 1;

                   return select(red, cyan, checker);
                }
                
               
     `,
        });

        //#endregion

        //#region  render pipeline
        Checkerboard.pipeline = device.createRenderPipeline({
            label: 'our hardcoded red triangle pipeline',
            layout: 'auto',
            vertex: {
                entryPoint: 'vs',
                module:vsModule,
            },
            fragment: {
                entryPoint: 'fs',
                module:fsModule,
                targets: [
                    { format: presentationFormat }
                ],
            },
        });

        //#endregion

        //#region  渲染队列参数
        Checkerboard.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: context!.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };
        //#endregion
        Checkerboard.isInited = true;
    }
    static update() {
       
    }

    static draw() {
        if(!Checkerboard.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(Checkerboard.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            Checkerboard.context!.getCurrentTexture().createView());

        // make a command encoder to start encoding commands
        const encoder = Checkerboard.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(Checkerboard.renderPassDescriptor);
        pass.setPipeline(Checkerboard.pipeline);
        pass.draw(3);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        Checkerboard.device!.queue.submit([commandBuffer]);
    }
    static destory() {

    }
}

