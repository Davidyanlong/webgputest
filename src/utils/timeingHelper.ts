export class TimingHelper {
    private canTimestamp: boolean;
    private device: GPUDevice;
    private querySet!: GPUQuerySet;
    private resolveBuffer!: GPUBuffer;
    private resultBuffer!: GPUBuffer;
    private resultBuffers: GPUBuffer[] = [];
    // state can be 'free', 'need resolve', 'wait for result'
    private state: string = 'free';

    constructor(device: GPUDevice) {
        this.device = device;
        this.canTimestamp = device.features.has('timestamp-query');
        if (this.canTimestamp) {
            this.querySet = device.createQuerySet({
                type: 'timestamp',
                count: 2,
            });
            this.resolveBuffer = device.createBuffer({
                size: this.querySet.count * 8,
                usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
            });
        }
    }

    private beginTimestampPass(encoder: GPUCommandEncoder, fnName: 'beginRenderPass' | 'beginComputePass', descriptor: GPURenderPassDescriptor) {
        if (this.canTimestamp) {
            assert(this.state === 'free', 'state not free');
            this.state = 'need resolve';

            const pass = encoder[fnName]({
                ...descriptor,
                ...{
                    timestampWrites: {
                        querySet: this.querySet,
                        beginningOfPassWriteIndex: 0,
                        endOfPassWriteIndex: 1,
                    },
                },
            });

            const resolve = () => this.resolveTiming(encoder);
            pass.end = (function (origFn, context) {
                return function () {
                    origFn.call(context);
                    resolve();
                };
            })(pass.end,pass);

            return pass;
        } else {
            return encoder[fnName](descriptor);
        }
    }

    beginRenderPass(encoder: GPUCommandEncoder, descriptor: Partial<GPURenderPassDescriptor> = {}) {
        return this.beginTimestampPass(encoder, 'beginRenderPass', descriptor as GPURenderPassDescriptor);
    }

    beginComputePass(encoder: GPUCommandEncoder, descriptor: Partial<GPURenderPassDescriptor> = {}) {
        return this.beginTimestampPass(encoder, 'beginComputePass', descriptor as GPURenderPassDescriptor);
    }

    private resolveTiming(encoder: GPUCommandEncoder) {
        if (!this.canTimestamp) {
            return;
        }
        assert(this.state === 'need resolve', 'must call addTimestampToPass');
        this.state = 'wait for result';

        this.resultBuffer = this.resultBuffers.pop() || this.device.createBuffer({
            size: this.resolveBuffer.size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        encoder.resolveQuerySet(this.querySet, 0, this.querySet.count, this.resolveBuffer, 0);
        encoder.copyBufferToBuffer(this.resolveBuffer, 0, this.resultBuffer, 0, this.resultBuffer.size);
    }

    async getResult() {
        if (!this.canTimestamp) {
            return 0;
        }
        assert(this.state === 'wait for result', 'must call resolveTiming');
        this.state = 'free';

        const resultBuffer = this.resultBuffer;
        await resultBuffer.mapAsync(GPUMapMode.READ);
        const times = new BigInt64Array(resultBuffer.getMappedRange());
        const duration = Number(times[1] - times[0]);
        resultBuffer.unmap();
        this.resultBuffers.push(resultBuffer);
        return duration;
    }
}

export class RollingAverage {
    private total: number = 0;
    private samples: number[] = [];
    private cursor: number = 0;
    private numSamples: number;
    constructor(numSamples = 30) {
        this.numSamples = numSamples;
    }
    addSample(v: number) {
        this.total += v - (this.samples[this.cursor] || 0);
        this.samples[this.cursor] = v;
        this.cursor = (this.cursor + 1) % this.numSamples;
    }
    get() {
        return this.total / this.samples.length;
    }
}


export function assert(cond: boolean, msg: string = '') {
    if (!cond) {
        throw new Error(msg);
    }
}