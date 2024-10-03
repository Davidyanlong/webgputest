import shadercode from '../shaders/generatemips.wgsl?raw'
import { loadImageBitmap } from '../utils/res';
export class GenerateMips {
    private static module: GPUShaderModule
    private static sampler: GPUSampler
    private static pipelineByFormat:Record<string,GPURenderPipeline> = {}
    public static generateMips(device: GPUDevice, texture: GPUTexture) {
        this.module ||= device.createShaderModule({
            label: 'textured quad shaders for mip level generation',
            code: shadercode
        });
        this.sampler ||= device.createSampler({
            minFilter: 'linear',
        });

        this.pipelineByFormat[texture.format] ||= device.createRenderPipeline({
            label: 'mip level generator pipeline',
            layout: 'auto',
            vertex: {
              module:this.module,
            },
            fragment: {
              module:this.module,
              targets: [{ format: texture.format }],
            },
          });

          const pipeline = this.pipelineByFormat[texture.format];
    
          const encoder = device.createCommandEncoder({
            label: 'mip gen encoder',
          });
    
          let width = texture.width;
          let height = texture.height;
          let baseMipLevel = 0;

          while (width > 1 || height > 1) {
            width = Math.max(1, width / 2 | 0);
            height = Math.max(1, height / 2 | 0);
    
            const bindGroup = device.createBindGroup({
              layout: pipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: this.sampler },
                { binding: 1, resource: texture.createView({baseMipLevel, mipLevelCount: 1}) },
              ],
            });
    
            ++baseMipLevel;
    
            const renderPassDescriptor:GPURenderPassDescriptor = {
              label: 'our basic canvas renderPass',
              colorAttachments: [
                {
                  view: texture.createView({baseMipLevel, mipLevelCount: 1}),
                  loadOp: 'clear',
                  storeOp: 'store',
                },
              ],
            };
    
            const pass = encoder.beginRenderPass(renderPassDescriptor);
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.draw(6);  // call our vertex shader 6 times
            pass.end();
          }
    
          const commandBuffer = encoder.finish();
          device.queue.submit([commandBuffer]);
    }

   
    public static createTextureFromSource(device:GPUDevice, source:ImageBitmap|HTMLCanvasElement, options:textureParams = {}) {
        const texture = device.createTexture({
          format: 'rgba8unorm',
          mipLevelCount: options.mips ? this.numMipLevels(source.width, source.height) : 1,
          size: [source.width, source.height],
          usage: GPUTextureUsage.TEXTURE_BINDING |
                 GPUTextureUsage.COPY_DST |
                 GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.copySourceToTexture(device, texture, source, options);
        return texture;
      }

    public static async createTextureFromImage(device:GPUDevice, url:string, options:textureParams) {
        const imgBitmap = await loadImageBitmap(url);
        return this.createTextureFromSource(device, imgBitmap, options);
    }


    private static numMipLevels = (...sizes: number[]) => {
        const maxSize = Math.max(...sizes);
        return 1 + Math.log2(maxSize) | 0;
    };

    private static copySourceToTexture(device:GPUDevice, texture:GPUTexture, source:ImageBitmap|HTMLCanvasElement, {flipY}:{flipY?:boolean} = {}) {
        device.queue.copyExternalImageToTexture(
          { source, flipY, },
          { texture },
          { width: source.width, height: source.height },
        );
    
        if (texture.mipLevelCount > 1) {
          this.generateMips(device, texture);
        }
      }
}

interface textureParams{
    mips?:boolean
    flipY?:boolean
}