
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
import { TextureFSampler } from './demos/textureFSampler';
import { TextureMipMap } from './demos/texturemipmap'
import { TextureImage } from './demos/textureImage';
import { TextureImageMipmap } from './demos/textureImageMipmap';

export class Application {
    static async initalize() {
        // 初始化GPU 上下文
        await GPUContext.initialize();

        // 简单三角形初始化
        SimpleTriangle.initialize(GPUContext.device);

        // 简单的计算管线
        SimpleCompute.initialize(GPUContext.device);

        // 顶点着色
        ColorVertexTriangle.initialize(GPUContext.device);

        // 棋盘渲染
        Checkerboard.initialize(GPUContext.device);

        // Uniform 测试
        UniformTriangle.initialize(GPUContext.device);

        // Uniform 多个三角形 多个bindGroup
        MultUniformTriangle.initialize(GPUContext.device);

        // storage buffer
        StorageBufferTriangles.initialize(GPUContext.device);

        // Vertex buffer
        VertexBufferTriangles.initialize(GPUContext.device)

        // TextureF base
        TextureF.initialize(GPUContext.device);

        TextureFSampler.initialize(GPUContext.device);

        TextureMipMap.initialize(GPUContext.device);

        TextureImage.initialize(GPUContext.device);

        TextureImageMipmap.initialize(GPUContext.device);
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

        TextureFSampler.update();

        TextureMipMap.update();

        TextureImage.update();

        TextureImageMipmap.update();

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

        TextureFSampler.draw();

        TextureMipMap.draw();

        TextureImage.draw();

        TextureImageMipmap.draw();

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
        TextureFSampler.destory();
        TextureMipMap.destory();
        TextureImage.destory();
        TextureImageMipmap.destory();


    }
}