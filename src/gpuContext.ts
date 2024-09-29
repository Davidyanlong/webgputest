export class GPUContext {
  static device: GPUDevice;
  static async initialize() {
    const adapter = await navigator.gpu!.requestAdapter();
    GPUContext.device = await adapter!.requestDevice();
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
