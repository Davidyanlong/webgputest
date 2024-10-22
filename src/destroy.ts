import { GPUContext } from './common/gpuContext';
import { Application } from './application';
import { demos } from './demos/index'

export class Destroy {
    private static gui:any
    public static async initialize(){
        this.initGUI();
        // 测试列表
        this.deviceTest()
    }
    private static initGUI(){
         const parentDom = document.querySelector('#destroydom')!
         // @ts-ignore
         const gui = this.gui = new GUI({
            parent: parentDom,
            // width: '175px',
            title:'销毁相关测试'
        })
        gui.domElement.style.top = '10px';
        gui.domElement.style.left = '10px';
        
    }

    // 测试一 设备销毁
    private static deviceTest() {

        const parmas = {
            deviceDestory:()=>{
                GPUContext.device.destroy();
            },
            deviceStart:async ()=>{
                await GPUContext.initialize();
                demos.forEach(demo=>{
                    demo.initialize(GPUContext.device)
                })
            }
        }
        let gui = this.gui.addFolder('设备销毁测试')
        gui.add(parmas,"deviceDestory").name('设备销毁');
        gui.add(parmas,"deviceStart").name('设备重启');

       
    }

}