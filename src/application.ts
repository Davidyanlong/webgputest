
import { GPUContext } from './common/gpuContext'
import {demos} from './demos/index'
export class Application {
    static async initalize() {
        // 初始化GPU 上下文
        await GPUContext.initialize();

        for (let  demo of demos) {
            console.log(`${demo.name} initialized`)
            demo.initialize(GPUContext.device);
        }
    }
    static update(dt:number) {
        for (let demo of demos) {
            // console.log(`${demo.name} updated`)
            demo.update(dt);
        }
    }

    static draw(dt:number) {
        for (let demo of demos) {
            // console.log(`${demo.name} drawed`)
            demo.draw(dt);
        }

    }
    static destory() {
        for (let demo of demos) {
            console.log(`${demo.name} destoried`)
            demo.destory();
        }
    }
}