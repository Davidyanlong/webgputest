export type vec3Type = Float32Array
export const vec3 = {
    fromValues(x: number, y: number, z: number) {
        const dst = new Float32Array(3);
        if (x !== undefined) {
            dst[0] = x;
            if (y !== undefined) {
                dst[1] = y;
                if (z !== undefined) {
                    dst[2] = z;
                }
            }
        }
        return dst;
    },
    cross(a: vec3Type, b: vec3Type, dst?: vec3Type) {
        dst = dst || new Float32Array(3);

        const t0 = a[1] * b[2] - a[2] * b[1];
        const t1 = a[2] * b[0] - a[0] * b[2];
        const t2 = a[0] * b[1] - a[1] * b[0];

        dst[0] = t0;
        dst[1] = t1;
        dst[2] = t2;

        return dst;
    },

    subtract(a: vec3Type, b: vec3Type, dst?: vec3Type) {
        dst = dst || new Float32Array(3);

        dst[0] = a[0] - b[0];
        dst[1] = a[1] - b[1];
        dst[2] = a[2] - b[2];

        return dst;
    },

    normalize(v: vec3Type, dst?: vec3Type) {
        dst = dst || new Float32Array(3);

        const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        // make sure we don't divide by 0.
        if (length > 0.00001) {
            dst[0] = v[0] / length;
            dst[1] = v[1] / length;
            dst[2] = v[2] / length;
        } else {
            dst[0] = 0;
            dst[1] = 0;
            dst[2] = 0;
        }

        return dst;
    },
};