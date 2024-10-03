
import  { SimpleTriangle } from "./simpleTriangle";
import  { SimpleCompute } from './simpleCompute';
import  { ColorVertexTriangle } from './colorVertexTriangle'
import  { Checkerboard } from './checkerboard';
import  { UniformTriangle } from './uniformTriangle';
import  { MultUniformTriangle } from './multUniformTriangle';
import  { StorageBufferTriangles } from './storageBufferTriangles';
import  { VertexBufferTriangles } from './vertexBufferTriangles';
import  { TextureF } from './textureF';
import  { TextureFSampler } from './textureFSampler';
import  { TextureMipMap } from './texturemipmap'
import  { TextureImage } from './textureImage';
import  { TextureImageMipmap } from './textureImageMipmap';
import { TextureCanvasMipmap } from "./textureCanvasMipmap";

// 保证案例的输出顺序
export const demos = [
    SimpleTriangle,
    SimpleCompute,
    ColorVertexTriangle,
    Checkerboard,
    UniformTriangle,
    MultUniformTriangle,
    StorageBufferTriangles,
    VertexBufferTriangles,
    TextureF,
    TextureFSampler,
    TextureMipMap,
    TextureImage,
    TextureImageMipmap,
    TextureCanvasMipmap
]