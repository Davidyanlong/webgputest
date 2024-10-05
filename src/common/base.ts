import { GPUContext } from "./gpuContext";

export class Base {
    protected static pipeline: GPURenderPipeline | GPUComputePipeline
    protected static device: GPUDevice
    protected static context: GPUCanvasContext
    protected static renderPassDescriptor: GPURenderPassDescriptor
    protected static aspect = 1;
    protected static presentationFormat: GPUTextureFormat
    protected static isInited = false
    public static async initialize(device: GPUDevice) {
        this.device = device;
        this.isInited = false;
    }
    protected static initCanvas(canvasId: string, isOut = false, parentDom:HTMLDivElement|null = null) {

        let canvas:HTMLCanvasElement|null = this.createDom(canvasId, parentDom);
        //#region initilize
        canvas ||=  document.querySelector(`#${canvasId}`) as HTMLCanvasElement;
        const context = canvas!.getContext('webgpu')!;

        const hasBGRA8unormStorage =  GPUContext.adapter!.features.has('bgra8unorm-storage');
        const presentationFormat =hasBGRA8unormStorage? navigator.gpu.getPreferredCanvasFormat():'rgba8unorm';
        if (!isOut) {
            this.context = context;
            this.aspect = canvas.width / canvas.height;
            // "bgra8unorm"
            this.presentationFormat = presentationFormat
        }

        const device = this.device;
        
        context?.configure({
            device,
            format: presentationFormat,
        });

        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
              const canvas = entry.target as HTMLCanvasElement;
              const width = entry.contentBoxSize[0].inlineSize;
              const height = entry.contentBoxSize[0].blockSize;
              canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
              canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
            }
          });
          observer.observe(canvas);


        return context;

        //#endregion
    }
    public static update(dt:number) { }
    public static draw(dt:number) { }
    public static destory() { }

    private static createDom(canvasId:string, parentDom:HTMLDivElement|null = null):HTMLCanvasElement | null{
        let canvas:HTMLCanvasElement|null = null;
        if(parentDom===null){
            parentDom =document.createElement('div') as HTMLDivElement;
            parentDom.className = 'col'; 
            canvas = document.createElement('canvas') as HTMLCanvasElement;
            canvas.id=`${canvasId}`
            const containerDom = document.querySelector('.container') as HTMLDivElement;
            
            parentDom.appendChild(canvas);
            containerDom.appendChild(parentDom);
            canvas.width = parentDom.clientWidth 
            canvas.height = parentDom.clientHeight

        }

        return canvas;

    }
}