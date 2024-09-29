async function main() {

  //#region initilize
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

  const canvas = document.querySelector('#canvas1');
  const context = canvas?.getContext('webgpu');
  // "bgra8unorm"
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context?.configure({
    device,
    format: presentationFormat,
  });

  const canvas2 = document.querySelector('#canvas2');
  const context2 = canvas2?.getContext('webgpu');
  // "bgra8unorm"
  context2?.configure({
    device,
    format: presentationFormat,
  });

  

  //#endregion

 //#region  shaderModule
  const module = device.createShaderModule({
    label: 'our hardcoded red triangle shaders',
    code: `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
 
        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }
 
      struct output{
        @location(0) color1:vec4f,
        @location(1) color2:vec4f,
      }
      @fragment fn fs() -> output {
        var out:output;
        out.color1 = vec4f(1.0, 0.0, 0.0, 1.0);
        out.color2 = vec4f(1.0, 1.0, 0.0, 1.0);
        return out;
      }
    `,
  });

  //#endregion

//#region  render pipeline
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded red triangle pipeline',
    layout: 'auto',
    vertex: {
      entryPoint: 'vs',
      module,
    },
    fragment: {
      entryPoint: 'fs',
      module,
      targets: [
        { format: presentationFormat }, 
        { format: presentationFormat }
      ],
    },
  });

//#endregion
  

const renderPassDescriptor:GPURenderPassDescriptor  = {
  label: 'our basic canvas renderPass',
  colorAttachments: [
    {
      view: context!.getCurrentTexture().createView(),
      clearValue: [0.3, 0.3, 0.3, 1],
      loadOp: 'clear',
      storeOp: 'store',
    },
    {
      view: context2!.getCurrentTexture().createView(),
      clearValue: [0.3, 0.3, 0.3, 1],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
};  

function render() {
  // Get the current texture from the canvas context and
  // set it as the texture to render to.
  let colorAttach = Array.from(renderPassDescriptor.colorAttachments)[0];
  
  colorAttach && (colorAttach.view = 
  context!.getCurrentTexture().createView());


  let colorAttach2 = Array.from(
    renderPassDescriptor.colorAttachments)[1];
  
  colorAttach2 && (colorAttach2.view = 
  context2!.getCurrentTexture().createView());

  // make a command encoder to start encoding commands
  const encoder = device!.createCommandEncoder({ 
    label: 'our encoder'
   });

  // make a render pass encoder to encode render specific commands
  const pass = encoder.beginRenderPass(renderPassDescriptor);
  pass.setPipeline(pipeline);
  pass.draw(3);  // call our vertex shader 3 times
  pass.end();

  const commandBuffer = encoder.finish();
  device!.queue.submit([commandBuffer]);
}

render();

}
main();

function fail(arg0: string) {
  throw new Error("Function not implemented.");
}

