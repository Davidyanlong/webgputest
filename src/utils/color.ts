export function hexToRgb(hex: string): [number, number, number] {
    return [
        parseInt('0x' + hex.slice(1, 3)) / 255,
        parseInt('0x' + hex.slice(3, 5)) / 255,
        parseInt('0x' + hex.slice(5, 7)) / 255
    ];
}