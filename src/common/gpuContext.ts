export class GPUContext {
  static device: GPUDevice;
  static adapter:GPUAdapter;
  static async initialize() {
    const adapter = this.adapter =  await navigator.gpu!.requestAdapter() as GPUAdapter;
    const hasBGRA8unormStorage = adapter!.features.has('bgra8unorm-storage');
    GPUContext.device = await adapter!.requestDevice({
      requiredFeatures: hasBGRA8unormStorage
      ? ['bgra8unorm-storage']
      : [],
      requiredLimits:{
        minUniformBufferOffsetAlignment: 256,
        maxBufferSize: adapter!.limits.maxBufferSize,
        maxStorageBufferBindingSize:
          adapter!.limits.maxStorageBufferBindingSize,
      }
    });
    if (! GPUContext.device) {
      fail("need a browser that supports WebGPU");
      return;
    }

    GPUContext.device .lost.then((info) => {
      console.error(`WebGPU device was lost: ${info.message}`);
  
      // 'reason' will be 'destroyed' if we intentionally destroy the device.
      if (info.reason !== 'destroyed') {
        // try again
        GPUContext.initialize();
      }
    });
  }
  update(){}
}

function fail(arg0: string) {
  throw new Error("Function not implemented.");
}