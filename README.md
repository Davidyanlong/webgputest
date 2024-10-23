# WebGPU学习总结

## WebGPU的销毁
* ### 需要修改的对象
    1. Device
    2. GPUBuffer
    3. GPUTexture
    4. GPUQuerySet

* ### 没有显式的提供销毁方法，GPU内部会根据引用情况自动销毁
    1. GPUShaderModule 
    2. GPURenderPipeline
    3. GPUCommandEncoder 
    4. GPURenderPassEncoder 
    5. GPUBindGroupLayout
    6. GPUBindGroup

## 关于性能优化
1. 不使用writeBuffer, 不添加 `GPUBufferUsage.COPY_DST ` 使用  `mappedAtCreation: true` 
```typescript
  function createBufferWithData(device, data, usage) {
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
```
2. 减少 `pass.setVertexBuffer(0, vertexBuffer)` 的调用次数，将所有的顶点相关数据存放在一个gpubuffer 中 
3. 合理的划分Uniform buffer, 那些是共享的(全局的)， 那些是独立的, 减少Uniform Buffers数据的长度
```wgsl

struct GlobalUniforms {
  viewProjection: mat4x4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
};

struct PerObjectUniforms {
  normalMatrix: mat3x3f,
  world: mat4x4f,
  color: vec4f,
  shininess: f32,
};

```
4. 拆分更多的Uniform buffer, 将逐帧改变的与不变的拆分出来
5. 经所有渲染对象的Uniform buffer都集中到一个大的Uniform buffer中，通过offset访问
6. 使用 `Mapped Buffers`, 将已经创建好的GPUBuffer `transferBuffer.getMappedRange()` 出来， 然后修改值，修改完毕后，使用  `transferBuffer.unmap()`,最后通过`copyBufferToBuffer`更新需要修改的uniform
```wgsl
    const transferBuffer = getMappedTransferBuffer();
    const uniformValues = new Float32Array(transferBuffer.getMappedRange());
    const normalMatrixValue = uniformValues.subarray(
          f32Offset + kNormalMatrixOffset, f32Offset + kNormalMatrixOffset + 12);
    const worldValue = uniformValues.subarray(
          f32Offset + kWorldOffset, f32Offset + kWorldOffset + 16);
     transferBuffer.unmap();
     // 更新buffer 到 uniformBuffer
     encoder.copyBufferToBuffer(transferBuffer, 0, uniformBuffer, 0, size);
    // 异步方式数据写入
    transferBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
      mappedTransferBuffers.push(transferBuffer);
    });
```

7. 使用双缓存取，更新后通过`copyBufferToBuffer`, 因为更新缓存会将正在渲染的Uniform暂停掉，通过`copyBufferToBuffer`不会暂停

8. 计算矩阵使用offset
```typescript
    mat4.multiply(a, aOffset, b, bOffset, dst, dstOffset);
```
9. 使用indirect drawing

10. 使用Bundle 方式渲染

TBC ……

  