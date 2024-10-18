import { GPUContext } from "./gpuContext";

export class Base {
    public static domName: string = ''
    public static actived: boolean = true
    protected static pipeline: GPURenderPipeline | GPUComputePipeline
    protected static device: GPUDevice
    protected static context: GPUCanvasContext
    protected static depthTexture:GPUTexture
    protected static renderPassDescriptor: GPURenderPassDescriptor
    protected static aspect = 1;
    protected static presentationFormat: GPUTextureFormat
    protected static io: IntersectionObserver
    protected static observer: ResizeObserver
    protected static mo: MutationObserver
    protected static isInited = false

    private static ioEvent: (e: any) => void
    public static async initialize(device: GPUDevice) {
        this.device = device;
        this.isInited = false;
        this.actived = true;
    }
    protected static initCanvas(canvasId: string, isOut = false, parentDom: HTMLDivElement | null = null) {

        let canvas: HTMLCanvasElement | null = this.createDom(canvasId, parentDom);
        //#region initilize
        canvas ||= document.querySelector(`#${canvasId}`) as HTMLCanvasElement;
        const context = canvas!.getContext('webgpu')!;

        this.domName = canvas.id;

        const hasBGRA8unormStorage = GPUContext.adapter!.features.has('bgra8unorm-storage');
        const presentationFormat = hasBGRA8unormStorage ? navigator.gpu.getPreferredCanvasFormat() : 'rgba8unorm';
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
        //#endregion

        // 初始化窗口大小变化的监听
        this.initObserver();
        this.observer.observe(canvas);

        // 初始化窗口是否在可见区域
        this.initIO();

        // dom是否发生属性等变化监听
        const config = this.initMO();
        
        // 开始观察已配置突变的目标节点
        this.mo.observe(canvas, config);

        // 监听事件
        this.ioEvent = () => {
            this.isInViewPortOfThree(canvas)
        }

        window.addEventListener('scroll', this.ioEvent)
        window.addEventListener('resize', this.ioEvent)

        return context;

    }
    public static update(dt: number) { }
    public static draw(dt: number) { }
    public static destory() {
        // 移除事件
        window.removeEventListener('scroll', this.ioEvent)
        window.removeEventListener('resize', this.ioEvent)
        
        // 停止观察
        this.observer.disconnect();
        this.mo.disconnect();
        this.io.disconnect();
    }

    public static getDepthTexture(){
         // 这段代码正常应该存放到resize 代码中

         const canvasTexture = this.context.getCurrentTexture();
         const textureWidth = canvasTexture.width 
         const textureHeight = canvasTexture.height
         if (!this.depthTexture ||
            this.depthTexture.width !== textureWidth ||
            this.depthTexture.height !== textureHeight) {
            if (this.depthTexture) {
                this.depthTexture.destroy();
            }
            this.depthTexture = this.device.createTexture({
                size: [textureWidth, textureHeight],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
        }
    }

    private static createDom(canvasId: string, parentDom: HTMLDivElement | null = null): HTMLCanvasElement | null {
        let canvas: HTMLCanvasElement | null = null;
        if (parentDom === null) {
            parentDom = document.createElement('div') as HTMLDivElement;
            parentDom.className = 'col';
            canvas = document.createElement('canvas') as HTMLCanvasElement;
            canvas.id = `${canvasId}`
            const containerDom = document.querySelector('.container') as HTMLDivElement;

            parentDom.appendChild(canvas);
            containerDom.appendChild(parentDom);
            canvas.width = parentDom.clientWidth
            canvas.height = parentDom.clientHeight

        }

        return canvas;

    }
    private static initObserver() {
        this.observer ||= new ResizeObserver(entries => {
            for (const entry of entries) {
                const canvas = entry.target as HTMLCanvasElement;
                const width = entry.contentBoxSize[0].inlineSize * devicePixelRatio;
                const height = entry.contentBoxSize[0].blockSize * devicePixelRatio;
                canvas.width = Math.max(1, Math.min(width, this.device.limits.maxTextureDimension2D));
                canvas.height = Math.max(1, Math.min(height, this.device.limits.maxTextureDimension2D));
                // 验证是否在视口内
                this.isInViewPortOfThree(canvas)
            }
        });

    }
    private static initIO() {
        this.io ||= new IntersectionObserver(ioes => {
            ioes.forEach(ioe => {
                // const el = ioe.target
                const intersectionRatio = ioe.intersectionRatio
                if (intersectionRatio > 0 && intersectionRatio <= 1) {
                    console.log(this.domName, 'yes')
                    this.actived = true
                } else {
                    console.log(this.domName, 'no')
                    this.actived = false
                }
            })
        })


    }
    private static isInViewPortOfThree(el: Element) {
        this.io.observe(el)
    }

    private static initMO() {
        // 观察者的选项(要观察哪些突变)
        var config = { attributes: true, childList: false, subtree: false };// 只监听属性发生变化
        // 当观察到突变时执行的回调函数
        var callback =  (mutationsList:MutationRecord[])=> {
            // console.log(mutationsList, 'mutationsList');
            mutationsList.forEach( (item:MutationRecord) =>{
                if (item.type == 'childList') {
                    // console.log('有节点发生改变');
                } else if (item.type == 'attributes') {
                    // console.log('attributes有变化');
                } else if (item.type == 'characterData') {
                    // console.log('subtree有变化');
                }
                this.isInViewPortOfThree(item.target as Element)
            });
        };

        // 创建一个链接到回调函数的观察者实例
        this.mo ||= new MutationObserver(callback);
        return config
    }

    

}