
import { Base } from "../common/base"
import { anyNull, Float32ArrayNull, GPUBufferNull } from "../common/constant"
import shadercode from '../shaders/reversed/reversedz.wgsl?raw'
import { mat4 } from "../utils/mat4"
import { vec3 } from "../utils/vec3"


export enum DepthBufferMode {
    Default = 0,
    Reversed,
}
/**
 * 反向深度
 */
export class ReversedZ extends Base {
    // GPU BUFFER
    private static uniformBuffer: GPUBuffer
    private static cameraMatrixBuffer: GPUBuffer;
    private static verticesBuffer: GPUBuffer;
    private static cameraMatrixReversedDepthBuffer: GPUBuffer;

    // 几何体
    private static geometryVertexSize: number; // Byte size of one geometry vertex.
    private static geometryPositionOffset: number; // Byte offset of position attribute within vertex.
    private static geometryColorOffset: number; // Byte offset of color attribute within vertex.
    private static geometryDrawCount: number;

    private static depthBufferFormat: GPUTextureFormat;
    private static colorPassPipelines: GPURenderPipeline[];
    private static depthBufferModes: DepthBufferMode[];
    private static depthClearValues: { [key in DepthBufferMode]: number };
    private static depthCompareFuncs: { [key in DepthBufferMode]: GPUCompareFunction };

    private static tmpMat4: Float32Array;

    // draw
    public static xCount = 1;
    public static yCount = 5;
    private static numInstances: number;
    private static matrixFloatCount: number;
    private static matrixStride: number;

    private static modelMatrices: Array<Float32Array>;
    private static mvpMatricesData: Float32Array;
    private static uniformBindGroups: GPUBindGroup[];


    private static drawPassDescriptors: GPURenderPassDescriptor[];



    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('reversedz')

        // 初始化参数
        this.tmpMat4 = mat4.identity();
        this.numInstances = this.xCount * this.yCount;
        this.matrixFloatCount = 16;
        this.modelMatrices = new Array<Float32Array>(this.numInstances);
        this.matrixStride = 4 * this.matrixFloatCount; // 64;
        this.mvpMatricesData = new Float32Array(this.matrixFloatCount * this.numInstances)


        let m = 0;
        for (let x = 0; x < this.xCount; x++) {
            for (let y = 0; y < this.yCount; y++) {
                const z = -800 * m;
                const s = 1 + 50 * m;

                this.modelMatrices[m] = mat4.translation(
                    [
                        x - this.xCount / 2 + 0.5,
                        (4.0 - 0.2 * z) * (y - this.yCount / 2 + 1.0),
                        z
                    ]
                );
                mat4.scale(this.modelMatrices[m], [s, s, s], this.modelMatrices[m]);

                m++;
            }
        }

        this.depthBufferModes = [
            DepthBufferMode.Default,
            DepthBufferMode.Reversed,
        ];

        this.depthCompareFuncs = {
            [DepthBufferMode.Default]: 'less' as GPUCompareFunction,
            [DepthBufferMode.Reversed]: 'greater' as GPUCompareFunction,
        };

        this.depthClearValues = {
            [DepthBufferMode.Default]: 1.0,
            [DepthBufferMode.Reversed]: 0.0,
        };

        this.geometryVertexSize = 4 * 8; // Byte size of one geometry vertex.
        this.geometryPositionOffset = 0; // Byte offset of position attribute within vertex.
        this.geometryColorOffset = 4 * 4;
        this.geometryDrawCount = 6 * 2;
        this.depthBufferFormat = 'depth32float';

        this.colorPassPipelines = [];

        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: 'premultiplied'
        })
        const d = 0.0001; // half distance between two planes
        const o = 0.5; // half x offset to shift planes so they are only partially overlaping

        // prettier-ignore
        let geometryVertexArray = new Float32Array([
            // float4 position, float4 color
            -1 - o, -1, d, 1, 1, 0, 0, 1,
            1 - o, -1, d, 1, 1, 0, 0, 1,
            -1 - o, 1, d, 1, 1, 0, 0, 1,
            1 - o, -1, d, 1, 1, 0, 0, 1,
            1 - o, 1, d, 1, 1, 0, 0, 1,
            -1 - o, 1, d, 1, 1, 0, 0, 1,

            -1 + o, -1, -d, 1, 0, 1, 0, 1,
            1 + o, -1, -d, 1, 0, 1, 0, 1,
            -1 + o, 1, -d, 1, 0, 1, 0, 1,
            1 + o, -1, -d, 1, 0, 1, 0, 1,
            1 + o, 1, -d, 1, 0, 1, 0, 1,
            -1 + o, 1, -d, 1, 0, 1, 0, 1,
        ]);

        const verticesBuffer = this.verticesBuffer = device.createBuffer({
            size: geometryVertexArray.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(verticesBuffer.getMappedRange()).set(geometryVertexArray);
        verticesBuffer.unmap();
        geometryVertexArray = Float32ArrayNull

        const viewMatrix = mat4.translation([0, 0, -12]);

        const depthRangeRemapMatrix = mat4.identity();
        depthRangeRemapMatrix[10] = -1;
        depthRangeRemapMatrix[14] = 1;



        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'reversedz shader module',
            code: shadercode,
        });
        //#endregion

        //#region  render pipeline


        // Model, view, projection matrices
        const uniformBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: 'uniform',
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: 'uniform',
                    },
                },
            ],
        });


        // colorPass is the regular render pass to render the scene
        const colorPassRenderPiplineLayout = device.createPipelineLayout({
            bindGroupLayouts: [uniformBindGroupLayout],
        });
        const colorPassRenderPipelineDescriptorBase: GPURenderPipelineDescriptor = {
            layout: colorPassRenderPiplineLayout,
            vertex: {
                module,
                buffers: [
                    {
                        arrayStride: this.geometryVertexSize,
                        attributes: [
                            {
                                // position
                                shaderLocation: 0,
                                offset: this.geometryPositionOffset,
                                format: 'float32x4',
                            },
                            {
                                // color
                                shaderLocation: 1,
                                offset: this.geometryColorOffset,
                                format: 'float32x4',
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module,
                targets: [
                    {
                        format: this.presentationFormat,
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back',
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: this.depthBufferFormat,
            },
        };

        colorPassRenderPipelineDescriptorBase.depthStencil!.depthCompare =
            this.depthCompareFuncs[DepthBufferMode.Default];
        this.colorPassPipelines[DepthBufferMode.Default] = device.createRenderPipeline(
            colorPassRenderPipelineDescriptorBase
        );
        colorPassRenderPipelineDescriptorBase.depthStencil!.depthCompare =
            this.depthCompareFuncs[DepthBufferMode.Reversed];
        this.colorPassPipelines[DepthBufferMode.Reversed] = device.createRenderPipeline(
            colorPassRenderPipelineDescriptorBase
        );

        //#endregion



        // color, resolution, translation, rotation, scale
        const uniformBufferSize = this.numInstances * this.matrixStride;
        this.uniformBuffer = device.createBuffer({
            label: 'uniforms',
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.cameraMatrixBuffer = device.createBuffer({
            size: 4 * 16, // 4x4 matrix
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.cameraMatrixReversedDepthBuffer = device.createBuffer({
            size: 4 * 16, // 4x4 matrix
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const aspect = (0.5 * this.context.canvas.width) / this.context.canvas.height;
        // wgpu-matrix perspective doesn't handle zFar === Infinity now.
        // https://github.com/greggman/wgpu-matrix/issues/9
        const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, aspect, 5, 9999);

        const viewProjectionMatrix = mat4.multiply(projectionMatrix, viewMatrix);
        // to use 1/z we just multiple depthRangeRemapMatrix to our default camera view projection matrix
        const reversedRangeViewProjectionMatrix = mat4.multiply(
            depthRangeRemapMatrix,
            viewProjectionMatrix
        );

        let bufferData = viewProjectionMatrix as Float32Array;
        device.queue.writeBuffer(
            this.cameraMatrixBuffer,
            0,
            bufferData.buffer,
            bufferData.byteOffset,
            bufferData.byteLength
        );
        bufferData = reversedRangeViewProjectionMatrix as Float32Array;
        device.queue.writeBuffer(
            this.cameraMatrixReversedDepthBuffer,
            0,
            bufferData.buffer,
            bufferData.byteOffset,
            bufferData.byteLength
        );

        this.uniformBindGroups = [
            device.createBindGroup({
                layout: uniformBindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.uniformBuffer,
                        },
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this.cameraMatrixBuffer,
                        },
                    },
                ],
            }),
            device.createBindGroup({
                layout: uniformBindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.uniformBuffer,
                        },
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this.cameraMatrixReversedDepthBuffer,
                        },
                    },
                ],
            }),
        ];

        const defaultDepthTexture = device.createTexture({
            size: [this.context.canvas.width, this.context.canvas.height],
            format: this.depthBufferFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });

        const defaultDepthTextureView = defaultDepthTexture.createView();
        const drawPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    // view is acquired and set in render loop.
                    view: this.context.getCurrentTexture().createView(),

                    clearValue: [0.0, 0.0, 0.5, 1.0],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: defaultDepthTextureView,

                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };

        const drawPassLoadDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    // attachment is acquired and set in render loop.
                    view: this.context.getCurrentTexture().createView(),

                    loadOp: 'load',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: defaultDepthTextureView,

                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };

        this.drawPassDescriptors = [drawPassDescriptor, drawPassLoadDescriptor];

        // this.initGUI();

        this.isInited = true;
    }

    static update(): void {
        if (!this.isInited) return;
        const canvas = this.context.canvas as HTMLCanvasElement;
        const aspect = canvas.clientWidth / canvas.clientHeight


        const now = Date.now() / 1000;

        for (let i = 0, m = 0; i < this.numInstances; i++, m += this.matrixFloatCount) {
            mat4.rotate(
                this.modelMatrices[i],
                vec3.fromValues(Math.sin(now), Math.cos(now), 0),
                (Math.PI / 180) * 30,
                this.tmpMat4
            );
            this.mvpMatricesData.set(this.tmpMat4, m);
        }

        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            this.mvpMatricesData.buffer,
            this.mvpMatricesData.byteOffset,
            this.mvpMatricesData.byteLength
        );
    }

    static draw() {
        if (!this.isInited) return;
        const canvas = this.context.canvas as HTMLCanvasElement;
        const attachment = this.context!.getCurrentTexture().createView()
        // make a command encoder to start encoding commands
        const encoder = this.device!.createCommandEncoder({
            label: 'our encoder'
        });
        for (const m of this.depthBufferModes) {
            let colorAttach = Array.from(this.drawPassDescriptors[m].colorAttachments)[0];
            colorAttach && (colorAttach.view = attachment);

            this.drawPassDescriptors[m].depthStencilAttachment!.depthClearValue = this.depthClearValues[m];
            const colorPass = encoder.beginRenderPass(this.drawPassDescriptors[m]);
            colorPass.setPipeline(this.colorPassPipelines[m]);
            colorPass.setBindGroup(0, this.uniformBindGroups[m]);
            colorPass.setVertexBuffer(0, this.verticesBuffer);
            colorPass.setViewport(
                (canvas.width * m) / 2,
                0,
                canvas.width / 2,
                canvas.height,
                0,
                1
            );
            colorPass.draw(this.geometryDrawCount, this.numInstances, 0, 0);
            colorPass.end();
        }

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }

    static destroy(): void {
        super.destroy();
        this.uniformBuffer?.destroy();
        this.uniformBuffer = GPUBufferNull
        this.cameraMatrixBuffer?.destroy();
        this.cameraMatrixBuffer = GPUBufferNull;
        this.verticesBuffer?.destroy();
        this.verticesBuffer = GPUBufferNull;
        this.cameraMatrixReversedDepthBuffer?.destroy();
        this.cameraMatrixReversedDepthBuffer = GPUBufferNull;
        this.colorPassPipelines = anyNull
        this.depthBufferModes = anyNull;
        this.depthClearValues = anyNull;
        this.depthCompareFuncs = anyNull;
        this.tmpMat4 = Float32ArrayNull;
        this.modelMatrices = anyNull
        this.mvpMatricesData = anyNull;
        this.uniformBindGroups = anyNull;
        this.drawPassDescriptors = anyNull;
    }

    protected static initGUI() {
        if (this.gui) return;
        super.initGUI();

        // this.settings = {
        //     // 透视垂直视角
        //     fieldOfView: degToRad(100),
        //     translation: [-65, 0, -120],
        //     rotation: [degToRad(220), degToRad(25), degToRad(325)],
        //     scale: [1, 1, 1],
        // };
        // // @ts-ignore
        // this.gui.add(this.settings, 'fieldOfView', { min: 1, max: 179, converters: GUI.converters.radToDeg });
        // this.gui.add(this.settings.translation, '0', -1000, 1000).name('translation.x');
        // this.gui.add(this.settings.translation, '1', -1000, 1000).name('translation.y');
        // this.gui.add(this.settings.translation, '2', -1400, -100).name('translation.z');
        // this.gui.add(this.settings.rotation, '0', radToDegOptions).name('rotation.x');
        // this.gui.add(this.settings.rotation, '1', radToDegOptions).name('rotation.y');
        // this.gui.add(this.settings.rotation, '2', radToDegOptions).name('rotation.z');
    }
}

