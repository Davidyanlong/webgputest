
import { GPUContext } from './gpuContext'
import { SimpleTriangle } from "./demos/simpleTriangle";
import { SimpleCompute } from './demos/simpleCompute';
import { ColorVertexTriangle } from './demos/colorVertexTriangle'
import { Checkerboard } from './demos/checkerboard';
import { UniformTriangle } from './demos/uniformTriangle';
import { MultUniformTriangle } from './demos/multUniformTriangle';
import { StorageBufferTriangles } from './demos/storageBufferTriangles';
import { VertexBufferTriangles } from './demos/vertexBufferTriangles';
import { TextureF } from './demos/textureF';

export class Application {
    static async initalize() {
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

        // Uniform 测试
        UniformTriangle.initalize(GPUContext.device);

        // Uniform 多个三角形 多个bindGroup
        MultUniformTriangle.initalize(GPUContext.device);

        // storage buffer
        StorageBufferTriangles.initalize(GPUContext.device);

        // Vertex buffer
        VertexBufferTriangles.initalize(GPUContext.device)

        // TextureF base
        TextureF.initalize(GPUContext.device);
    }
    static update() {
        // 简单三角形
        SimpleTriangle.update();

        // 顶点着色
        ColorVertexTriangle.update();


        // 棋盘渲染
        Checkerboard.update();

        // Uniform 测试
        UniformTriangle.update();

        MultUniformTriangle.update();

        StorageBufferTriangles.update();

        VertexBufferTriangles.update();

        TextureF.update();

    }

    static draw() {
        // 简单三角形
        SimpleTriangle.draw();

        // 顶点着色
        ColorVertexTriangle.draw();

        // 棋盘渲染
        Checkerboard.draw();

        // Uniform 测试
        UniformTriangle.draw();

        MultUniformTriangle.draw();

        StorageBufferTriangles.draw();

        VertexBufferTriangles.draw();

        TextureF.draw();

    }
    static destory() {
        SimpleTriangle.destory();
        SimpleCompute.destory();
        ColorVertexTriangle.destory();
        Checkerboard.destory();
        UniformTriangle.destory();
        MultUniformTriangle.destory();
        StorageBufferTriangles.destory();
        VertexBufferTriangles.destory();

        TextureF.destory();

    }
}