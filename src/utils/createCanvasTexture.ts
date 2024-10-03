import { GenerateMips } from "../common/generateMips";



const hsl = (h:number, s:number, l:number) => `hsl(${h * 360 | 0}, ${s * 100}%, ${l * 100 | 0}%)`;

export class CanvasAnimationTexture {
    size: number = 256
    half: number = 0
    ctx!: CanvasRenderingContext2D
    initialize() {
        this.half = this.size / 2;
        this.ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
        this.ctx.canvas.width = this.size;
        this.ctx.canvas.height = this.size;
    }
    update2DCanvas(time: number) {
        time *= 0.0001;
        this.ctx.clearRect(0, 0, this.size, this.size);
        this.ctx.save();
        this.ctx.translate(this.half, this.half);
        const num = 20;
        for (let i = 0; i < num; ++i) {
            this.ctx.fillStyle = hsl(i / num * 0.2 + time * 0.1, 1, i % 2 * 0.5);
            this.ctx.fillRect(-this.half, -this.half, this.size, this.size);
            this.ctx.rotate(time * 0.5);
            this.ctx.scale(0.85, 0.85);
            this.ctx.translate(this.size / 16, 0);
        }
        this.ctx.restore();
    }

}