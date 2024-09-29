
import {GPUContext} from './gpuContext'
import { SimpleTriangle } from "./simpleTriangle";
import { SimpleCompute } from './simpleCompute';

export class Application {
    static async initalize(){
       // 初始化GPU 上下文
       await GPUContext.initialize();

       // 简单三角形初始化
       SimpleTriangle.initalize(GPUContext.device);

       // 简单的计算管线
       SimpleCompute.initalize(GPUContext.device);
    }
    static update(){
        // 简单三角形
        SimpleTriangle.update();

      

    }

    static draw(){
        SimpleTriangle.draw();
    }
    static destory(){
        SimpleTriangle.draw();
    }
}