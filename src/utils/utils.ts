

export function rand(min?: number, max?: number) {
  if (min === undefined) {
    min = 0;
    max = 1;
  } else if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
};


// 插值
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// 类型数据插值
export const mix = (a: typeArray, b: typeArray, t: number): typeArray => a.map((v, i) => lerp(v, b[i], t));

// 双线性插值
export const bilinearFilter = (tl: typeArray, tr: typeArray, bl: typeArray, br: typeArray, t1: number, t2: number): typeArray => {
  const t = mix(tl, tr, t1);
  const b = mix(bl, br, t1);
  return mix(t, b, t2);
};


// 生成mipmap
export const createNextMipLevelRgba8Unorm = ({ data: src, width: srcWidth, height: srcHeight }: mipMapParams) => {
  // compute the size of the next mip
  const dstWidth = Math.max(1, srcWidth / 2 | 0);
  const dstHeight = Math.max(1, srcHeight / 2 | 0);
  const dst = new Uint8Array(dstWidth * dstHeight * 4);

  const getSrcPixel = (x: number, y: number) => {
    const offset = (y * srcWidth + x) * 4;
    return src.subarray(offset, offset + 4);
  };

  for (let y = 0; y < dstHeight; ++y) {
    for (let x = 0; x < dstWidth; ++x) {
      // compute texcoord of the center of the destination texel
      const u = (x + 0.5) / dstWidth;
      const v = (y + 0.5) / dstHeight;

      // compute the same texcoord in the source - 0.5 a pixel
      const au = (u * srcWidth - 0.5);
      const av = (v * srcHeight - 0.5);

      // compute the src top left texel coord (not texcoord)
      const tx = au | 0;
      const ty = av | 0;

      // compute the mix amounts between pixels
      const t1 = au % 1;
      const t2 = av % 1;

      // get the 4 pixels
      const tl = getSrcPixel(tx, ty);
      const tr = getSrcPixel(tx + 1, ty);
      const bl = getSrcPixel(tx, ty + 1);
      const br = getSrcPixel(tx + 1, ty + 1);

      // copy the "sampled" result into the dest.
      const dstOffset = (y * dstWidth + x) * 4;
      dst.set(bilinearFilter(tl, tr, bl, br, t1, t2), dstOffset);
    }
  }
  return { data: dst, width: dstWidth, height: dstHeight };
};


/**
 * 生成一组mipmap 数据
 * @param src  图像数据
 * @param srcWidth 初始宽度
 * @returns 
 */
export const generateMips = (src: typeArray, srcWidth: number) => {
  const srcHeight = src.length / 4 / srcWidth;

  // populate with first mip level (base level)
  let mip = { data: src, width: srcWidth, height: srcHeight, };
  const mips: mipMapParams[] = [mip];

  while (mip.width > 1 || mip.height > 1) {
    mip = createNextMipLevelRgba8Unorm(mip);
    mips.push(mip);
  }
  return mips;
};

export const euclideanModulo = (x: number, a: number) => x - a * Math.floor(x / a);

export type typeArray = Float32Array | Uint8Array | Int16Array | Int32Array | Uint32Array | Float64Array

export interface mipMapParams {
  data: typeArray,
  width: number,
  height: number
}
