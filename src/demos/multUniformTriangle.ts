import { Base } from "./base";

/**
 * 渲染基本流程
 * bindGroup / uniform 学习
 */
export class MultUniformTriangle extends Base{
    private static kColorOffset = 0;
    private static kScaleOffset = 0;
    private static kOffsetOffset = 4;

    private static kNumObjects = 100;
    private static objectInfos:ObjectInfo[] = [];


    static async initalize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('multUniformTriangle')


        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: `
                struct OurStruct {
                    color: vec4f,
                    offset: vec2f,
                };

                struct OtherStruct {
                    scale: vec2f,
                };
 
                @group(0) @binding(0) var<uniform> ourStruct: OurStruct;
                @group(0) @binding(1) var<uniform> otherStruct: OtherStruct;
                @vertex fn vs(
                    @builtin(vertex_index) vertexIndex : u32
                ) -> @builtin(position) vec4f {
                    let pos = array(
                    vec2f( 0.0,  0.5),  // top center
                    vec2f(-0.5, -0.5),  // bottom left
                    vec2f( 0.5, -0.5)   // bottom right
                    );
            
                   return vec4f(pos[vertexIndex] * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
                }
            
                @fragment fn fs() -> @location(0) vec4f {
                   return ourStruct.color;
                }
        `,
        });

        //#endregion

        //#region  render pipeline
        MultUniformTriangle.pipeline = device.createRenderPipeline({
            label: 'multiple uniform buffe',
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


        // create 2 buffers for the uniform values
        const staticUniformBufferSize =
            4 * 4 + // color is 4 32bit floats (4bytes each)
            2 * 4 + // offset is 2 32bit floats (4bytes each)
            2 * 4;  // padding
        const uniformBufferSize =
            2 * 4;  // scale is 2 32bit floats (4bytes each)
        
        


        for (let i = 0; i < MultUniformTriangle.kNumObjects; ++i) {
            const staticUniformBuffer = device.createBuffer({
              label: `static uniforms for obj: ${i}`,
              size: staticUniformBufferSize,
              usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
        
            // These are only set once so set them now
            {
              const uniformValues = new Float32Array(staticUniformBufferSize / 4);
              uniformValues.set([rand(), rand(), rand(), 1], MultUniformTriangle.kColorOffset);        // set the color
              uniformValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], MultUniformTriangle.kOffsetOffset);      // set the offset
        
              // copy these values to the GPU
              device.queue.writeBuffer(staticUniformBuffer, 0, uniformValues);
            }
        
            // create a typedarray to hold the values for the uniforms in JavaScript
            const uniformValues = new Float32Array(uniformBufferSize / 4);
            const uniformBuffer = device.createBuffer({
              label: `changing uniforms for obj: ${i}`,
              size: uniformBufferSize,
              usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
        
            const bindGroup = device.createBindGroup({
              label: `bind group for obj: ${i}`,
              layout: MultUniformTriangle.pipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: { buffer: staticUniformBuffer }},
                { binding: 1, resource: { buffer: uniformBuffer }},
              ],
            });
        
            MultUniformTriangle.objectInfos.push({
              scale: rand(0.2, 0.5),
              uniformBuffer,
              uniformValues,
              bindGroup,
            });
        }

        //#region  渲染队列参数
        MultUniformTriangle.renderPassDescriptor = {
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
        //#endregion
        MultUniformTriangle.isInited = true;
    }

    static update() {
        if (!MultUniformTriangle.isInited) return;
    }

    static draw() {
        if (!MultUniformTriangle.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(MultUniformTriangle.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            MultUniformTriangle.context!.getCurrentTexture().createView());

        // make a command encoder to start encoding commands
        const encoder = MultUniformTriangle.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(MultUniformTriangle.renderPassDescriptor);
        pass.setPipeline(MultUniformTriangle.pipeline as GPURenderPipeline);
        // 渲染多个对象
        for (const {scale, bindGroup, uniformBuffer, uniformValues} of MultUniformTriangle.objectInfos) {
            uniformValues.set([scale / MultUniformTriangle.aspect, scale], MultUniformTriangle.kScaleOffset); // set the scale
            MultUniformTriangle.device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
      
            pass.setBindGroup(0, bindGroup);
            pass.draw(3);  // call our vertex shader 3 times
      
          }
        pass.end();

        const commandBuffer = encoder.finish();
        MultUniformTriangle.device!.queue.submit([commandBuffer]);
    }
    static destory() {
      
    }


}

function rand(min?: number, max?: number) {
    if (min === undefined) {
        min = 0;
        max = 1;
    } else if (max === undefined) {
        max = min;
        min = 0;
    }
    return min + Math.random() * (max - min);
};

interface ObjectInfo {
    scale: number,
    uniformBuffer:GPUBuffer,
    uniformValues:Float32Array,
    bindGroup:GPUBindGroup,
}
