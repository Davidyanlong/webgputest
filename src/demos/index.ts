
import { SimpleTriangle } from "./simpleTriangle";
import { ComputeDynamicOffsets } from "./computeDynamicOffsets";
import { SimpleCompute } from './simpleCompute';
import { ColorVertexTriangle } from './colorVertexTriangle'
import { Checkerboard } from './checkerboard';
import { UniformTriangle } from './uniformTriangle';
import { MultUniformTriangle } from './multUniformTriangle';
import { StorageBufferTriangles } from './storageBufferTriangles';
import { VertexBufferTriangles } from './vertexBufferTriangles';
import { TextureF } from './textureF';
import { TextureFSampler } from './textureFSampler';
import { TextureMipMap } from './texturemipmap'
import { TextureImage } from './textureImage';
import { TextureImageMipmap } from './textureImageMipmap';
import { TextureCanvasMipmap } from "./textureCanvasMipmap";
import { TextureVideoMipmap } from "./textureVideoMipmap";
import { TextureVideo } from "./textureVideo";
import { CubeTexture } from "./cubeTexture";
import { StorageTexture } from "./storageTexture";
import { MSAATriangle } from './msaaTriangle'
import { ConstantShaderTriangle } from './constantShaderTriangle'
import { Blend } from "./blend";
import { TimestampQuery } from './timestampQuery'
import { Transform } from './transform'
import { Orthogonal } from './orthogonal'
import { Perspective } from './perspective'
import { Camera } from "./camera";
import { LookAt } from "./lookAt";
import { DirectionalLight } from "./directionalLight";
import { PointLight } from "./pointLight";
import { SpotLight } from "./spotLight";
import { EnvironmentMap } from "./environmentMap";
import { Skybox } from "./skybox";
import { ComputeShader } from "./computeShader";

// 保证案例的输出顺序
export const demos = [
    SimpleTriangle,
    ComputeDynamicOffsets,
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
    TextureCanvasMipmap,
    TextureVideoMipmap,
    TextureVideo,
    CubeTexture,
    StorageTexture,
    MSAATriangle,
    ConstantShaderTriangle,
    Blend,
    TimestampQuery,
    Transform,
    Orthogonal,
    Perspective,
    Camera,
    LookAt,
    DirectionalLight,
    PointLight,
    SpotLight,
    EnvironmentMap,
    Skybox,
    ComputeShader,
]