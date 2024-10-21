import shadercode from '../shaders/generatemips.wgsl?raw'
import { loadImageBitmap } from '../utils/res';
export class GenerateMips {
  private static module: GPUShaderModule
  private static sampler: GPUSampler
  private static pipelineByFormat: Record<string, GPURenderPipeline> = {}
  private static _device:GPUDevice



  public static generateMips(device: GPUDevice, texture: GPUTexture) {
    // 设备丢失后，所有的缓存都要清除掉
    if(this._device !== device){
      this.pipelineByFormat = {};
      (this.module as any) = null;
      (this.sampler as any) = null;

    }
    this.module ||= device.createShaderModule({
      label: 'textured quad shaders for mip level generation',
      code: shadercode
    });

    this.sampler ||= device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
    });

    this.pipelineByFormat[texture.format] ||= device.createRenderPipeline({
      label: 'mip level generator pipeline',
      layout: 'auto',
      vertex: {
        module: this.module,
      },
      fragment: {
        module: this.module,
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
      for (let layer = 0; layer < texture.depthOrArrayLayers; ++layer) {
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, 
            resource: texture.createView({
              dimension: '2d', 
              baseMipLevel, 
              mipLevelCount: 1,
              baseArrayLayer: layer, 
              arrayLayerCount: 1,
            }) 
          },
        ],
      });

   

      const renderPassDescriptor: GPURenderPassDescriptor = {
        label: 'our basic canvas renderPass',
        colorAttachments: [
          {
            view: texture.createView({ 
              baseMipLevel:baseMipLevel+1, 
              mipLevelCount: 1, 
              baseArrayLayer: layer,
              arrayLayerCount: 1,
            }),
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
    ++baseMipLevel;
    }

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  private static getSourceSize(source: sourceType) {
    return [
      (source as HTMLVideoElement).videoWidth || source.width,
      (source as HTMLVideoElement).videoHeight || source.height,
    ];
  }
  public static createTextureFromSource(device: GPUDevice, source: sourceType, options: textureParams = {}) {
    const size = this.getSourceSize(source);
    const texture = device.createTexture({
      format: 'rgba8unorm',
      mipLevelCount: options.mips ? this.numMipLevels(...size) : 1,
      size,
      usage: GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.copySourceToTexture(device, texture, source, options);
    return texture;
  }

  public static async createTextureFromImage(device: GPUDevice, url: string, options: textureParams) {
    const imgBitmap = await loadImageBitmap(url);
    return this.createTextureFromSource(device, imgBitmap, options);
  }


  private static numMipLevels = (...sizes: number[]) => {
    const maxSize = Math.max(...sizes);
    return 1 + Math.log2(maxSize) | 0;
  };

  public static copySourceToTexture(device: GPUDevice, texture: GPUTexture, source: sourceType, { flipY,  premultipliedAlpha }: textureParams = {}) {
    device.queue.copyExternalImageToTexture(
      { source, flipY, },
      { texture, premultipliedAlpha },
      this.getSourceSize(source),
    );

    if (texture.mipLevelCount > 1) {
      this.generateMips(device, texture);
    }
  }
  public static copySourcesToTexture(device: GPUDevice, texture: GPUTexture, sources: sourceType[], { flipY }: textureParams = {}) {
    if (sources?.length > 0) {
      sources.forEach((source, layer) => {
        device.queue.copyExternalImageToTexture(
          { source, flipY, },
          { texture, origin: [0, 0, layer] },
          { width: source.width, height: source.height },
        );
      });
      if (texture.mipLevelCount > 1) {
        this.generateMips(device, texture);
      }
    }

  }
  public static createTextureFromSources(device:GPUDevice, sources:sourceType[], options: textureParams = {}) {
    // Assume are sources all the same size so just use the first one for width and height
    const source = sources[0];
    const texture = device.createTexture({
      format: 'rgba8unorm',
      mipLevelCount: options.mips ? this.numMipLevels(source.width, source.height) : 1,
      size: [source.width, source.height, sources.length],
      usage: GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST |
             GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.copySourcesToTexture(device, texture, sources, options);
    return texture;
  }

  public static async  createTextureFromImages(device:GPUDevice, urls:string[], options?:textureParams) {
    const images = await Promise.all(urls.map(loadImageBitmap));
    return this.createTextureFromSources(device, images, options);
  }
}

interface textureParams {
  mips?: boolean
  flipY?: boolean
  premultipliedAlpha?:boolean
}

type sourceType = ImageBitmap | HTMLCanvasElement | HTMLVideoElement