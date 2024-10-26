import { mat4 } from "wgpu-matrix"
import { Base } from "../common/base"
import { GenerateMips } from "../common/generateMips"
import shadercode from '../shaders/blend/blend.wgsl?raw'
import { hsl, hsla } from "../utils/color"
import { anyNull, GPUBindGroupLayoutNull, GPUBindGroupNull, GPUPipelineLayoutNull, GPURenderPipelineNull, GPUShaderModuleNull, GPUTextureNull } from "../common/constant"

/**
 * Blend 理解
 */
export class Blend extends Base {
    private static bindGroupLayout: GPUBindGroupLayout
    private static dstPipeline: GPURenderPipeline
    private static textureSets: BlendTexuteObj[]
    private static srcUniform: uniformType
    private static dstUniform: uniformType
    private static module: GPUShaderModule
    private static pipelineLayout: GPUPipelineLayout
    static async initialize(device: GPUDevice) {

        await super.initialize(device)
        super.initCanvas('blend')

        const module = this.module = device.createShaderModule({
            label: 'our hardcoded textured quad shaders',
            code: shadercode,
        });



        const bindGroupLayout = this.bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {}, },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: {} },
            ],
        });


        const pipelineLayout = this.pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [
                bindGroupLayout,
            ],
        });

        const { srcTextureUnpremultipliedAlpha,
            dstTextureUnpremultipliedAlpha,
            srcTexturePremultipliedAlpha,
            dstTexturePremultipliedAlpha,

            srcBindGroupUnpremultipliedAlpha,
            dstBindGroupUnpremultipliedAlpha,
            srcBindGroupPremultipliedAlpha,
            dstBindGroupPremultipliedAlpha } = this.initTexture()


        this.textureSets = [
            {
                srcTexture: srcTexturePremultipliedAlpha,
                dstTexture: dstTexturePremultipliedAlpha,
                srcBindGroup: srcBindGroupPremultipliedAlpha,
                dstBindGroup: dstBindGroupPremultipliedAlpha,
            },
            {
                srcTexture: srcTextureUnpremultipliedAlpha,
                dstTexture: dstTextureUnpremultipliedAlpha,
                srcBindGroup: srcBindGroupUnpremultipliedAlpha,
                dstBindGroup: dstBindGroupUnpremultipliedAlpha,
            },
        ];




        this.dstPipeline = device.createRenderPipeline({
            label: 'hardcoded textured quad pipeline',
            layout: pipelineLayout,
            vertex: {
                module,
            },
            fragment: {
                module,
                targets: [{ format: this.presentationFormat }],
            },
        });




        const clearValue = [0, 0, 0, 0];
        //#region  渲染队列参数
        this.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: this.context!.getCurrentTexture().createView(),
                    clearValue,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };
        //#endregion

        this.initGUI();

        this.isInited = true;
    }

    static update() {
        if (!this.isInited) return;
        makeBlendComponentValid(color);
        makeBlendComponentValid(alpha);

        this.pipeline = this.device.createRenderPipeline({
            label: 'hardcoded textured quad pipeline',
            layout: this.pipelineLayout,
            vertex: {
                module: this.module,
            },
            fragment: {
                module: this.module,
                targets: [
                    {
                        format: this.presentationFormat,
                        blend: {
                            color,
                            alpha,
                        },
                    },
                ],
            },
        });

        const {
            srcTexture,
            dstTexture,
        } = this.textureSets[this.settings.textureSet];
        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: this.settings.alphaMode,
        });

        const canvasTexture = this.context.getCurrentTexture();

        updateUniforms(this.device, this.srcUniform, canvasTexture, srcTexture);
        updateUniforms(this.device, this.dstUniform, canvasTexture, dstTexture);


    }

    static draw() {
        if (!this.isInited) return;

        const {
            srcBindGroup,
            dstBindGroup,
        } = this.textureSets[this.settings.textureSet];

        let colorAttach = Array.from(this.renderPassDescriptor.colorAttachments)[0];

        colorAttach && (colorAttach.view =
            this.context!.getCurrentTexture().createView());


        // make a command encoder to start encoding commands
        const encoder = this.device!.createCommandEncoder({
            label: 'our encoder'
        });

        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(this.renderPassDescriptor);
        // draw dst
        pass.setPipeline(this.dstPipeline);
        pass.setBindGroup(0, dstBindGroup);
        pass.draw(6);  // call our vertex shader 6 times

        // draw src
        pass.setPipeline(this.pipeline as GPURenderPipeline);
        pass.setBindGroup(0, srcBindGroup);
        pass.setBlendConstant([...constant.color, constant.alpha]);
        pass.draw(6);  // call our vertex shader 6 times

        pass.end();

        const commandBuffer = encoder.finish();
        this.device!.queue.submit([commandBuffer]);
    }

    static destroy(): void {
        super.destroy();
        this.bindGroupLayout = GPUBindGroupLayoutNull
        this.dstPipeline = GPURenderPipelineNull
        let obj;
        while (obj = this.textureSets?.pop()) {
            obj.srcTexture?.destroy();
            obj.srcTexture = GPUTextureNull
            obj.dstTexture?.destroy();
            obj.dstTexture = GPUTextureNull
            obj.srcBindGroup = GPUBindGroupNull
            obj.dstBindGroup = GPUBindGroupNull
        }
        this.textureSets = anyNull;

        this.srcUniform = anyNull;
        this.dstUniform = anyNull;
        this.module = GPUShaderModuleNull
        this.pipelineLayout = GPUPipelineLayoutNull
    }

    private static initTexture() {
        const size = 300;
        const srcCanvas = createSourceImage(size);
        const dstCanvas = createDestinationImage(size);

        const srcTextureUnpremultipliedAlpha =
            GenerateMips.createTextureFromSource(
                this.device, srcCanvas,
                { mips: true });
        const dstTextureUnpremultipliedAlpha =
            GenerateMips.createTextureFromSource(
                this.device, dstCanvas,
                { mips: true });

        const srcTexturePremultipliedAlpha =
            GenerateMips.createTextureFromSource(
                this.device, srcCanvas,
                { mips: true, premultipliedAlpha: true });
        const dstTexturePremultipliedAlpha =
            GenerateMips.createTextureFromSource(
                this.device, dstCanvas,
                { mips: true, premultipliedAlpha: true });

        const sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
        });

        const srcUniform = this.srcUniform = makeUniformBufferAndValues(this.device);
        const dstUniform = this.dstUniform = makeUniformBufferAndValues(this.device);


        const srcBindGroupUnpremultipliedAlpha = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: srcTextureUnpremultipliedAlpha.createView() },
                { binding: 2, resource: { buffer: srcUniform.buffer } },
            ],
        });

        const dstBindGroupUnpremultipliedAlpha = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: dstTextureUnpremultipliedAlpha.createView() },
                { binding: 2, resource: { buffer: dstUniform.buffer } },
            ],
        });

        const srcBindGroupPremultipliedAlpha = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: srcTexturePremultipliedAlpha.createView() },
                { binding: 2, resource: { buffer: srcUniform.buffer } },
            ],
        });

        const dstBindGroupPremultipliedAlpha = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: dstTexturePremultipliedAlpha.createView() },
                { binding: 2, resource: { buffer: dstUniform.buffer } },
            ],
        });
        return {
            srcTextureUnpremultipliedAlpha,
            dstTextureUnpremultipliedAlpha,
            srcTexturePremultipliedAlpha,
            dstTexturePremultipliedAlpha,

            srcBindGroupUnpremultipliedAlpha,
            dstBindGroupUnpremultipliedAlpha,
            srcBindGroupPremultipliedAlpha,
            dstBindGroupPremultipliedAlpha
        }
    }

    protected static initGUI() {
        if (this.gui) return;
        super.initGUI();

        this.settings = {
            alphaMode: 'premultiplied',
            textureSet: 0,
            preset: 'default (copy)',
        };

        const presets = {
            'default (copy)': {
                color: {
                    operation: 'add',
                    srcFactor: 'one',
                    dstFactor: 'zero',
                },
            },
            'premultiplied blend (source-over)': {
                color: {
                    operation: 'add',
                    srcFactor: 'one',
                    dstFactor: 'one-minus-src-alpha',
                },
            },
            'un-premultiplied blend': {
                color: {
                    operation: 'add',
                    srcFactor: 'src-alpha',
                    dstFactor: 'one-minus-src-alpha',
                },
            },
            'destination-over': {
                color: {
                    operation: 'add',
                    srcFactor: 'one-minus-dst-alpha',
                    dstFactor: 'one',
                },
            },
            'source-in': {
                color: {
                    operation: 'add',
                    srcFactor: 'dst-alpha',
                    dstFactor: 'zero',
                },
            },
            'destination-in': {
                color: {
                    operation: 'add',
                    srcFactor: 'zero',
                    dstFactor: 'src-alpha',
                },
            },
            'source-out': {
                color: {
                    operation: 'add',
                    srcFactor: 'one-minus-dst-alpha',
                    dstFactor: 'zero',
                },
            },
            'destination-out': {
                color: {
                    operation: 'add',
                    srcFactor: 'zero',
                    dstFactor: 'one-minus-src-alpha',
                },
            },
            'source-atop': {
                color: {
                    operation: 'add',
                    srcFactor: 'dst-alpha',
                    dstFactor: 'one-minus-src-alpha',
                },
            },
            'destination-atop': {
                color: {
                    operation: 'add',
                    srcFactor: 'one-minus-dst-alpha',
                    dstFactor: 'src-alpha',
                },
            },
            'additive (lighten)': {
                color: {
                    operation: 'add',
                    srcFactor: 'one',
                    dstFactor: 'one',
                },
            },
        };
        this.gui.add(this.settings, 'alphaMode', ['opaque', 'premultiplied']).name('canvas alphaMode');
        this.gui.add(this.settings, 'textureSet', ['premultiplied alpha', 'un-premultiplied alpha']);
        this.gui.add(this.settings, 'preset', Object.keys(presets))
            .name('blending preset')
            .onChange((presetName: keyof typeof presets) => {
                const preset = presets[presetName];
                Object.assign(color, preset.color);
                // @ts-ignore
                Object.assign(alpha, preset.alpha || preset.color);
                this.gui.updateDisplay();
            });
    }
}

/**
 * 创建源图像
 * @param size 图形大小
 * @returns 
 */
function createSourceImage(size: number) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(size / 2, size / 2);

    ctx.globalCompositeOperation = 'screen';
    const numCircles = 3;
    for (let i = 0; i < numCircles; ++i) {
        ctx.rotate(Math.PI * 2 / numCircles);
        ctx.save();
        ctx.translate(size / 6, 0);
        ctx.beginPath();

        const radius = size / 3;
        ctx.arc(0, 0, radius, 0, Math.PI * 2);

        const gradient = ctx.createRadialGradient(0, 0, radius / 2, 0, 0, radius);
        const h = i / numCircles;
        gradient.addColorStop(0.5, hsla(h, 1, 0.5, 1));
        gradient.addColorStop(1, hsla(h, 1, 0.5, 0));

        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
    }
    return canvas;
}

/**
 * 创建目标图像
 * @param size 图像大小
 * @returns 
 */
function createDestinationImage(size: number) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    for (let i = 0; i <= 6; ++i) {
        gradient.addColorStop(i / 6, hsl(i / -6, 1, 0.5));
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 255)';
    ctx.globalCompositeOperation = 'destination-out';
    ctx.rotate(Math.PI / -4);
    for (let i = 0; i < size * 2; i += 32) {
        ctx.fillRect(-size, i, size * 2, 16);
    }

    return canvas;
}


function makeUniformBufferAndValues(device: GPUDevice) {
    // offsets to the various uniform values in float32 indices
    const kMatrixOffset = 0;

    // create a buffer for the uniform values
    const uniformBufferSize =
        16 * 4; // matrix is 16 32bit floats (4bytes each)
    const buffer = device.createBuffer({
        label: 'uniforms for quad',
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // create a typedarray to hold the values for the uniforms in JavaScript
    const values = new Float32Array(uniformBufferSize / 4);
    const matrix = values.subarray(kMatrixOffset, 16);
    return { buffer, values, matrix };
}

function makeBlendComponentValid(blend: GPUBlendComponent) {
    const { operation } = blend;
    if (operation === 'min' || operation === 'max') {
        blend.srcFactor = 'one';
        blend.dstFactor = 'one';
    }
}

function updateUniforms(device: GPUDevice, uniform: uniformType, canvasTexture: GPUTexture, texture: GPUTexture) {
    const projectionMatrix = mat4.ortho(0, canvasTexture.width, canvasTexture.height, 0, -1, 1);

    mat4.scale(projectionMatrix, [texture.width, texture.height, 1], uniform.matrix);

    // copy the values from JavaScript to the GPU
    device.queue.writeBuffer(uniform.buffer, 0, uniform.values);
}


interface uniformType {

    buffer: GPUBuffer;
    values: Float32Array;
    matrix: Float32Array;
}

interface BlendTexuteObj {
    srcTexture: GPUTexture
    dstTexture: GPUTexture
    srcBindGroup: GPUBindGroup
    dstBindGroup: GPUBindGroup
}

const color: GPUBlendComponent = {
    operation: 'add',
    srcFactor: 'one',
    dstFactor: 'one-minus-src',
};

const alpha: GPUBlendComponent = {
    operation: 'add',
    srcFactor: 'one',
    dstFactor: 'one-minus-src',
};

const constant = {
    color: [1, 0.5, 0.25],
    alpha: 1,
};
