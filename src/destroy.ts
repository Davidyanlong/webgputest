import { GPUContext } from './common/gpuContext';
import { demos } from './demos/index'
import GUI from 'muigui';

export class Destroy {
    private static gui:GUI
    public static async initialize(){
        this.initGUI();
        // 测试列表
        this.deviceTest();
        // demo 销毁
        this.bufferTest();
    }
    private static initGUI(){
         const parentDom = document.querySelector('#destroydom')!

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
            devicedestroy:()=>{
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
        gui.add(parmas,"devicedestroy").name('设备销毁');
        gui.add(parmas,"deviceStart").name('设备重启');

       
    }
    // 测试二 demo 销毁
    private static bufferTest(){
        const parmas = {
            demodestroy:()=>{
                demos.forEach(demo=>{
                    demo.destroy()
                })
                GPUContext.device.destroy();
            },
            demoReStart: async()=>{
                await GPUContext.initialize();
                demos.forEach(demo=>{
                    demo.initialize(GPUContext.device);
                })
            }
            
        }
        let gui = this.gui.addFolder('buffer销毁')
        gui.add(parmas,"demodestroy").name('demo销毁');
        gui.add(parmas,"demoReStart").name('demo重新启动');

    } 

}