export function hexToRgb(hex: string): [number, number, number] {
    return [
        parseInt('0x' + hex.slice(1, 3)) / 255,
        parseInt('0x' + hex.slice(3, 5)) / 255,
        parseInt('0x' + hex.slice(5, 7)) / 255
    ];
}

export const hsl = (h: number, s: number, l: number) => `hsl(${h * 360 | 0}, ${s * 100}%, ${l * 100 | 0}%)`;
export const hsla = (h: number, s: number, l: number, a: number) => `hsla(${h * 360 | 0}, ${s * 100}%, ${l * 100 | 0}%, ${a})`;
