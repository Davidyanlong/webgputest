/**
 * 渲染基本流程
 * bindGroup / uniform 学习
 *  uniform max 64k
 *  storage max 128M
 */
export class StorageBufferTriangles {
    private static pipeline: GPURenderPipeline
    private static renderPassDescriptor: GPURenderPassDescriptor
    private static context: GPUCanvasContext
    private static device: GPUDevice
    private static kColorOffset = 0;
    private static kScaleOffset = 0;
    private static kOffsetOffset = 4;
    private static changingUnitSize:number;
    private static aspect = 1;

    private static kNumObjects = 100;
    private static objectInfos:ObjectInfo[] = [];
    private static storageValues:Float32Array;
    private static bindGroup:GPUBindGroup;
    private static storageBuffer:GPUBuffer
    private static isInited = false


    static async initalize(device: GPUDevice) {

        StorageBufferTriangles.device = device;

        //#region initilize
        const canvas = document.querySelector('#storageBufferTriangles') as HTMLCanvasElement;
        const context = StorageBufferTriangles.context = canvas!.getContext('webgpu')!;
        // "bgra8unorm"
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        context?.configure({
            device,
            format: presentationFormat,
        });

        StorageBufferTriangles.aspect = canvas.width / canvas.height;
        //#endregion


        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: `
                struct VSOutput {
                    @builtin(position) position: vec4f,
                    @location(0) color: vec4f,
                }

                struct OurStruct {
                    color: vec4f,
                    offset: vec2f,
                };

                struct OtherStruct {
                    scale: vec2f,
                };
 
                // @group(0) @binding(0) var<storage, read> ourStruct: OurStruct;
                // @group(0) @binding(1) var<storage, read> otherStruct: OtherStruct;

                @group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
                @group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;
                @vertex fn vs(
                    @builtin(vertex_index) vertexIndex : u32,
                    @builtin(instance_index) instanceIndex: u32
                ) -> VSOutput {
                    let pos = array(
                    vec2f( 0.0,  0.5),  // top center
                    vec2f(-0.5, -0.5),  // bottom left
                    vec2f( 0.5, -0.5)   // bottom right
                    );

                    let otherStruct = otherStructs[instanceIndex];
                    let ourStruct = ourStructs[instanceIndex];
            
                    var vsOut: VSOutput;
                    vsOut.position = vec4f(pos[vertexIndex] * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
                    vsOut.color = ourStruct.color;
                   return vsOut;
                }
            
                @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
                   return vsOut.color;
                }
        `,
        });

        //#endregion

        //#region  render pipeline
        StorageBufferTriangles.pipeline = device.createRenderPipeline({
            label: 'split storage buffer pipeline',
            layout: 'auto',
            vertex: {
                module,
            },
            fragment: {
                module,
                targets: [
                    { format: presentationFormat },
                ],
            },
        });

        //#endregion


        // create 2 buffers for the uniform values
        const staticStorageUnitSize  =
            4 * 4 + // color is 4 32bit floats (4bytes each)
            2 * 4 + // offset is 2 32bit floats (4bytes each)
            2 * 4;  // padding
        
        const changingUnitSize = StorageBufferTriangles.changingUnitSize  =
            2 * 4;  // scale is 2 32bit floats (4bytes each)
        
        const staticStorageBufferSize = staticStorageUnitSize * StorageBufferTriangles.kNumObjects;
        const storageBufferSize = changingUnitSize * StorageBufferTriangles.kNumObjects;

        const staticStorageBuffer = device.createBuffer({
            label: 'static storage for objects',
            size: staticStorageBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
          });
         
          StorageBufferTriangles.storageBuffer = device.createBuffer({
            label: 'changing storage for objects',
            size: storageBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
          });

          const staticStorageValues = new Float32Array(staticStorageBufferSize / 4);
          StorageBufferTriangles.storageValues = new Float32Array(storageBufferSize / 4);

          
          for (let i = 0; i < StorageBufferTriangles.kNumObjects; ++i) {
            const staticOffset = i * (staticStorageUnitSize / 4);
        
            // These are only set once so set them now
            staticStorageValues.set([rand(), rand(), rand(), 1], staticOffset + StorageBufferTriangles.kColorOffset);        // set the color
            staticStorageValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + StorageBufferTriangles.kOffsetOffset);      // set the offset
        
            StorageBufferTriangles.objectInfos.push({
              scale: rand(0.2, 0.5),
            });
          }
            device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues);
          

            StorageBufferTriangles.bindGroup = device.createBindGroup({
                label: 'bind group for objects',
                layout: StorageBufferTriangles.pipeline.getBindGroupLayout(0),
                entries: [
                  {
                    binding: 0, 
                    resource: { 
                        buffer: staticStorageBuffer 
                    }
                },
                { 
                    binding: 1, 
                    resource: { 
                        buffer: StorageBufferTriangles.storageBuffer 
                    }
                },
                ],
              });
   

        //#region  渲染队列参数
        StorageBufferTriangles.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: context!.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                }
            ],
        };
        //#endregion
        StorageBufferTriangles.isInited = true;
    }

    static update() {
        if (!StorageBufferTriangles.isInited) return;

    }

    static draw() {
        if (!StorageBufferTriangles.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(StorageBufferTriangles.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            StorageBufferTriangles.context!.getCurrentTexture().createView());

        // make a command encoder to start encoding commands
        const encoder = StorageBufferTriangles.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(StorageBufferTriangles.renderPassDescriptor);
        pass.setPipeline(StorageBufferTriangles.pipeline);
        // 渲染多个对象
        let ndx=0;
        for (const {scale } of StorageBufferTriangles.objectInfos) {
            const offset = ndx * (StorageBufferTriangles.changingUnitSize / 4);
            StorageBufferTriangles.storageValues.set([scale / StorageBufferTriangles.aspect, scale], offset + StorageBufferTriangles.kScaleOffset); // set the scale
             
            ndx++;
          }
        // upload all scales at once
        StorageBufferTriangles.device.queue.writeBuffer(StorageBufferTriangles.storageBuffer, 0, StorageBufferTriangles.storageValues);
        pass.setBindGroup(0, StorageBufferTriangles.bindGroup);
        pass.draw(3,StorageBufferTriangles.kNumObjects);  // call our vertex shader 3 times
        pass.end();

        const commandBuffer = encoder.finish();
        StorageBufferTriangles.device!.queue.submit([commandBuffer]);
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
    scale: number
}
