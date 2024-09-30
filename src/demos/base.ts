
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
    protected static initCanvas(canvasId: string, isOut = false) {
        //#region initilize
        const canvas = document.querySelector(`#${canvasId}`) as HTMLCanvasElement;
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
    public static update() { }
    public static draw() { }
    public static destory() { }
}