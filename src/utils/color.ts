export function hexToRgb(hex: string): [number, number, number] {
    return [
        parseInt('0x' + hex.slice(1, 3)) / 255,
        parseInt('0x' + hex.slice(3, 5)) / 255,
        parseInt('0x' + hex.slice(5, 7)) / 255
    ];
}

export const hsl = (h: number, s: number, l: number) => `hsl(${h * 360 | 0}, ${s * 100}%, ${l * 100 | 0}%)`;
export const hsla = (h: number, s: number, l: number, a: number) => `hsla(${h * 360 | 0}, ${s * 100}%, ${l * 100 | 0}%, ${a})`;

/** Given a css color string, return an array of 4 values from 0 to 255 */
export const cssColorToRGBA8 = (() => {
    const canvas = new OffscreenCanvas(1, 1);
    // willReadFrequently 用于提高多次读取像素的性能
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    return (cssColor: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = cssColor;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    };
})();

/** Given a css color string, return an array of 4 values from 0 to 1 */
export const cssColorToRGBA = (cssColor: string) => cssColorToRGBA8(cssColor).map(v => v / 255);


export const hslToRGBA = (h:number, s:number, l:number) => cssColorToRGBA(hsl(h, s, l));