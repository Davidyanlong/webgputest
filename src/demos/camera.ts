
import { Base } from "../common/base"
import { anyNull, Float32ArrayNull, GPUBindGroupNull, GPUBufferNull } from "../common/constant"
import shadercode from '../shaders/orthogonal/orthogonal.wgsl?raw'
import { createFVerticesCCW } from "../utils/createF"
import { radToDegOptions } from "../utils/gui"
import { mat4 } from "../utils/mat4"
import { degToRad } from "../utils/utils"

/**
 * 正交投影
 */
export class Camera extends Base {
    public static radius: number;
    private static vertexBuffer: GPUBuffer
    private static numVertices: number
    private static objectInfos: objectInfosType[]
    private static numFs: number


    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('camera')

        // 参数初始化
        this.radius = 200;
        this.numFs = 5;
        this.objectInfos = [];

        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: 'premultiplied'
        })

        // 参数初始化
        this.objectInfos = [];


        //#region  shaderModule
        const module = device.createShaderModule({
            label: 'orthogonal shader module',
            code: shadercode,
        });

        //#endregion

        //#region  render pipeline
        this.pipeline = device.createRenderPipeline({
            label: '2 attributes',
            layout: 'auto',
            vertex: {
                module,
                buffers: [
                    {
                        arrayStride: (4) * 4,     // (2) floats, 4 bytes each
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
                            { shaderLocation: 1, offset: 12, format: 'unorm8x4' },  // color
                        ],
                    },
                ],
            },
            fragment: {
                module,
                targets: [
                    { format: this.presentationFormat },
                ],
            },
            primitive: {
                cullMode: 'back',  // note: uncommon setting. See article
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });

        //#endregion



        for (let i = 0; i < this.numFs; ++i) {
            // matrix
            const uniformBufferSize = (16) * 4;
            const uniformBuffer = device.createBuffer({
                label: 'uniforms',
                size: uniformBufferSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            const uniformValues = new Float32Array(uniformBufferSize / 4);

            // offsets to the various uniform values in float32 indices
            const kMatrixOffset = 0;

            const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);

            const bindGroup = device.createBindGroup({
                label: 'bind group for object',
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: uniformBuffer } },
                ],
            });

            this.objectInfos.push({
                uniformBuffer,
                uniformValues,
                matrixValue,
                bindGroup,
            });
        }
        const { vertexData, numVertices } = createFVerticesCCW();
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
                    // clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                // 临时使用，避免ts错误，渲染时动态变化的
                view: this.context!.getCurrentTexture().createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };
        //#endregion

        this.initGUI();

        this.isInited = true;
    }

    static update(): void {
        if (!this.isInited) return;

        const canvas = this.context.canvas as HTMLCanvasElement;
        const aspect = canvas.clientWidth / canvas.clientHeight
        // 透视投影
        const projection = mat4.perspective(
            this.settings.fieldOfView,
            aspect,
            1,      // zNear
            2000,   // zFar
        );
        // Compute the position of the first F
        const fPosition = new Float32Array([this.radius, 0, 0]);

        // Use matrix math to compute a position on a circle where
        // the camera is
        const tempMatrix = mat4.rotationY(this.settings.cameraAngle);
        mat4.translate(tempMatrix, [0, 0, this.radius * 1.5], tempMatrix);

        // Get the camera's position from the matrix we computed
        const eye = tempMatrix.slice(12, 15);

        const up = new Float32Array([0, 1, 0]);

        // Compute a view matrix
        const viewMatrix = mat4.lookAt(eye, fPosition, up);

        // combine the view and projection matrixes
        const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);
        this.objectInfos.forEach(({
            matrixValue,
            uniformBuffer,
            uniformValues,
        }, i) => {
            const angle = i / this.numFs * Math.PI * 2;
            const x = Math.cos(angle) * this.radius;
            const z = Math.sin(angle) * this.radius;

            mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValue);

            // upload the uniform values to the uniform buffer
            this.device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

        });
    }

    static draw() {
        if (!this.isInited) return;
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        let colorAttach = Array.from(this.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            this.context!.getCurrentTexture().createView());

        // 这段代码正常应该存放到resize 代码中
        super.getDepthTexture();
        this.renderPassDescriptor.depthStencilAttachment!.view = this.depthTexture!.createView();


        // make a command encoder to start encoding commands
        const encoder = this.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(this.renderPassDescriptor);
        pass.setPipeline(this.pipeline as GPURenderPipeline);
        pass.setVertexBuffer(0, this.vertexBuffer)

        this.objectInfos.forEach(({
            bindGroup,
        }) => {
            pass.setBindGroup(0, bindGroup);
            pass.draw(this.numVertices);
        });
        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }

    static destroy(): void {
        super.destroy();

        this.vertexBuffer?.destroy()
        this.vertexBuffer = GPUBufferNull
        let objInfo;
        while(objInfo = this.objectInfos?.pop()){
            objInfo.bindGroup = GPUBindGroupNull
            objInfo.matrixValue = Float32ArrayNull
            objInfo.uniformBuffer?.destroy()
            objInfo.uniformBuffer = GPUBufferNull
            objInfo.uniformValues = Float32ArrayNull
        }

        this.objectInfos = anyNull
    }

    protected static initGUI() {

        if (this.gui) return;

        super.initGUI();


        this.settings = {
            // 透视垂直视角
            fieldOfView: degToRad(100),
            cameraAngle: 0,
        };

      
        // @ts-ignore
        this.gui.add(this.settings, 'fieldOfView', { min: 1, max: 179, converters: GUI.converters.radToDeg });
        this.gui.add(this.settings, 'cameraAngle', radToDegOptions);
    }
}

interface objectInfosType {
    uniformBuffer: GPUBuffer,
    uniformValues: Float32Array,
    matrixValue: Float32Array,
    bindGroup: GPUBindGroup,
}