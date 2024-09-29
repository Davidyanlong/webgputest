
import {GPUContext} from './gpuContext'
import { SimpleTriangle } from "./demos/simpleTriangle";
import { SimpleCompute } from './demos/simpleCompute';
import {ColorVertexTriangle} from './demos/colorVertexTriangle'
import { Checkerboard } from './demos/checkerboard';

export class Application {
    static async initalize(){
       // 初始化GPU 上下文
       await GPUContext.initialize();

       // 简单三角形初始化
       SimpleTriangle.initalize(GPUContext.device);

       // 简单的计算管线
       SimpleCompute.initalize(GPUContext.device);

       // 顶点着色
       ColorVertexTriangle.initalize(GPUContext.device);

       // 棋盘渲染
       Checkerboard.initalize(GPUContext.device);
    }
    static update(){
        // 简单三角形
        SimpleTriangle.update();

        // 顶点着色
        ColorVertexTriangle.update();


        //棋盘渲染
        Checkerboard.update();

      

    }

    static draw(){
          // 简单三角形
        SimpleTriangle.draw();

        // 顶点着色
        ColorVertexTriangle.draw();

        // 棋盘渲染
        Checkerboard.draw();

    }
    static destory(){
        SimpleTriangle.destory();
        SimpleCompute.destory();
        ColorVertexTriangle.destory();
        Checkerboard.destory();
    }
}