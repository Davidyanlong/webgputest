import { Base } from "../common/base";
import { GPUContext } from "../common/gpuContext";
import shadercode from '../shaders/vertexBufferTriangles/vertex_buffer_triangles.wgsl?raw'
import { createCircleVerticesColor } from "../utils/createCircleVertices";
import { RollingAverage, TimingHelper } from "../utils/timeingHelper";
import { euclideanModulo, rand } from "../utils/utils";

/**
 * 渲染基本流程
 * TimestampQuery
 */
export class TimestampQuery extends Base {
    private static kColorOffset = 0;
    private static kScaleOffset = 2;
    private static kOffsetOffset = 0;
    private static changingUnitSize: number;

    private static kNumObjects = 10000;
    private static changingVertexBuffer: GPUBuffer;
    private static staticVertexBuffer: GPUBuffer;
    private static vertexBuffer: GPUBuffer;
    private static vertexValues: Float32Array;
    private static numVertices: number;
    private static objectInfos: objectInfosType[] = [];
    private static timingHelper: TimingHelper;
    private static settings: Record<string, number>
    private static then: number = 0
    private static fpsAverage: RollingAverage
    private static jsAverage: RollingAverage
    private static gpuAverage: RollingAverage
    private static infoElem:HTMLDivElement
    private static canTimestamp:boolean

    static async initialize(device: GPUDevice) {

        await super.initialize(device);
        super.initCanvas('timestampQuery')

        this.timingHelper = new TimingHelper(device);

        this.fpsAverage = new RollingAverage();
        this.jsAverage = new RollingAverage();
        this.gpuAverage = new RollingAverage();



        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'triangle shaders with uniforms',
            code: shadercode,
        });

        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: 'per vertex color',
            layout: 'auto',
            vertex: {
                module,
                buffers: [
                    {
                        arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each
                        attributes: [
                            {   // position
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x2'
                            },
                            {   // perVertexColor
                                shaderLocation: 4,
                                offset: 2 * 4,
                                format: 'unorm8x4'
                            }
                        ]
                    },
                    {
                        arrayStride: 4, //  4 bytes each
                        stepMode: 'instance',
                        attributes: [
                            {   // color
                                shaderLocation: 1,
                                offset: 0,
                                format: 'unorm8x4'
                            }
                        ]
                    },
                    {
                        arrayStride: 2 * 4 + 2 * 4, // 2 floats, 4 bytes each
                        stepMode: 'instance',
                        attributes: [
                            {   // offset
                                shaderLocation: 2,
                                offset: 0,   // color 4 floats,
                                format: 'float32x2'
                            },
                            {   // scale
                                shaderLocation: 3,
                                offset: 4,
                                format: 'float32x2'
                            }
                        ]
                    }
                ]
            },
            fragment: {
                module,
                targets: [
                    { format: this.presentationFormat },
                ],
            },
        });

        //#endregion


        // create 2 buffers for the uniform values
        const staticUnitSize =
            4 // color is 4 32bit floats (4bytes each)

        const changingUnitSize = this.changingUnitSize =
            2 * 4 +  // scale is 2 32bit floats (4bytes each)
            2 * 4  // offset is 2 32bit floats (4bytes each)

        const staticVertexBufferSize = staticUnitSize * this.kNumObjects;
        const changingVertexBufferSize = changingUnitSize * this.kNumObjects;

        this.staticVertexBuffer = device.createBuffer({
            label: 'static vertex for objects',
            size: staticVertexBufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.changingVertexBuffer = device.createBuffer({
            label: 'changing vertex for objects',
            size: changingVertexBufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });


        {
            const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
            for (let i = 0; i < this.kNumObjects; ++i) {
                const staticOffsetU8 = i * staticUnitSize;
          
                // These are only set once so set them now
                staticVertexValuesU8.set(        // set the color
                    [rand() * 255, rand() * 255, rand() * 255, 255],
                    staticOffsetU8 + this.kColorOffset);
          
                this.objectInfos.push({
                  scale: rand(0.2, 0.5),
                  offset: [rand(-0.9, 0.9), rand(-0.9, 0.9)],
                  velocity: [rand(-0.1, 0.1), rand(-0.1, 0.1)],
                });
              }
            device.queue.writeBuffer(this.staticVertexBuffer, 0, staticVertexValuesU8);
        }

        // a typed array we can use to update the changingStorageBuffer
        this.vertexValues = new Float32Array(changingVertexBufferSize / 4);
        // setup a storage buffer with vertex data
        const { vertexData, numVertices } = createCircleVerticesColor({
            radius: 0.5,
            innerRadius: 0.25,
        });

        this.numVertices = numVertices
        this.vertexBuffer = device.createBuffer({
            label: 'vertex buffer vertices',
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.vertexBuffer, 0, vertexData);


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
        //#endregion


        this.settings = {
            numObjects: 100,
        }

        this.initGUI();
        this.statInit();

        this.isInited = true;
    }
    static update(dt: number): void {
        let now = dt * 0.001;
        const deltaTime = now - this.then;
        this.then = now;
      
        if (!this.isInited) return;
          // 渲染多个对象
          for (let ndx = 0; ndx < this.settings.numObjects; ++ndx) {
            const { scale, offset, velocity } = this.objectInfos[ndx];
            // -1.5 to 1.5
            offset[0] = euclideanModulo(offset[0] + velocity[0] * deltaTime + 1.5, 3) - 1.5;
            offset[1] = euclideanModulo(offset[1] + velocity[1] * deltaTime + 1.5, 3) - 1.5;

            const off = ndx * (this.changingUnitSize / 4);
            this.vertexValues.set(offset, off + this.kOffsetOffset);
            this.vertexValues.set([scale / this.aspect, scale], off + this.kScaleOffset);
        }
        // upload all offsets and scales at once
        this.device.queue.writeBuffer(
            this.changingVertexBuffer, 0,
            this.vertexValues, 0, this.settings.numObjects * this.changingUnitSize / 4);
    }

    static draw(dt: number) {
        let now = dt * 0.001;
        const deltaTime = now - this.then;
        const startTime = performance.now();
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
        const pass = this.timingHelper.beginRenderPass(encoder, this.renderPassDescriptor) as GPURenderPassEncoder ;
        pass.setPipeline(this.pipeline as GPURenderPipeline);
        
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setVertexBuffer(1, this.staticVertexBuffer);
        pass.setVertexBuffer(2, this.changingVertexBuffer);     

        pass.draw(this.numVertices, this.settings.numObjects);  // call our vertex shader 3 times
        pass.end();


        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);



        this.timingHelper.getResult().then(gpuTime => {
            this.gpuAverage.addSample(gpuTime / 1000);
        });

        const jsTime = performance.now() - startTime;
        this.fpsAverage.addSample(1 / deltaTime);
        this.jsAverage.addSample(jsTime);
        this.stat();
    }

    private static initGUI() {

        // @ts-ignore
        const gui = new GUI({
            parent: (this.context.canvas as HTMLCanvasElement).parentElement,
            width: '145px'
        })
        gui.domElement.style.top = '-300px';
        gui.domElement.style.left = '150px';
        gui.add(this.settings, 'numObjects', 0, this.kNumObjects, 1);

    }

    private static statInit(){
        this.canTimestamp =  GPUContext.adapter.features.has('timestamp-query');
        const parent = (this.context.canvas as HTMLCanvasElement).parentElement
        const infoElem = this.infoElem =  document.createElement('div')
        infoElem.style.cssText = ` 
            position: relative;
            top: -350px;
            left: 0;
            margin: 0;
            padding: 0.5em;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            width:120px;
            `
        parent?.appendChild(infoElem);
    }
    private static stat(){
        this.infoElem.innerText = `\
            fps: ${this.fpsAverage.get().toFixed(1)}
            js: ${this.jsAverage.get().toFixed(1)}ms
            gpu: ${this.canTimestamp ? `${this.gpuAverage.get().toFixed(1)}µs` : 'N/A'}
            `
    }

}



interface objectInfosType {
    scale: number
    offset: [number, number]
    velocity: [number, number]
}