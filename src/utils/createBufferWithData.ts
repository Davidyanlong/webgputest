import { typeArray } from "./utils";

export function createBufferWithData(device:GPUDevice, data:typeArray, usage:GPUBufferUsageFlags) {
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: usage,
      mappedAtCreation: true,
    });
    const dst = new Uint8Array(buffer.getMappedRange());
    dst.set(new Uint8Array(data.buffer));
    buffer.unmap();
    return buffer;
  }