
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
        if (!isOut) {
            this.context = context;
            this.aspect = canvas.width / canvas.height;
            // "bgra8unorm"
            this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        }


        const device = this.device;
        context?.configure({
            device,
            format: this.presentationFormat,
        });
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
        }

        return canvas;

    }
}