export class GPUContext {
  static device: GPUDevice;
  static adapter: GPUAdapter;
  private static _isLost: boolean = false
  static async initialize() {
    const adapter = this.adapter = await navigator.gpu!.requestAdapter(
      {powerPreference: 'high-performance'}
    ) as GPUAdapter;
    const hasBGRA8unormStorage = adapter!.features.has('bgra8unorm-storage');
    const canTimestamp = adapter.features.has('timestamp-query');

    const requiredFeatures = [
      ...(hasBGRA8unormStorage ? ['bgra8unorm-storage'] : []),
      ...(canTimestamp ? ['timestamp-query'] : []),
    ] as Iterable<GPUFeatureName>;

    GPUContext.device = await adapter!.requestDevice({
      requiredFeatures,
      requiredLimits: {
        minUniformBufferOffsetAlignment: 256,
        maxBufferSize: adapter!.limits.maxBufferSize,
        maxStorageBufferBindingSize:
          adapter!.limits.maxStorageBufferBindingSize,
      }
    });
    if (!GPUContext.device) {
      fail("need a browser that supports WebGPU");
      return;
    }

    GPUContext.device.lost.then((info) => {
      console.error(`WebGPU device was lost: ${info.message}`);

      // 'reason' will be 'destroyed' if we intentionally destroy the device.
      if (info.reason !== 'destroyed') {
        // try again
        GPUContext.initialize();
      }
      this._isLost = true
    });
    this._isLost = false
  }

  static get isLost() {
    return this._isLost;
  }
  update() { }
}

function fail(_arg0?: string) {
  throw new Error("Function not implemented.");
}
