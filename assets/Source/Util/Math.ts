import * as cc from 'cc';

@cc._decorator.ccclass('Range')
export class Range {
    constructor(min: number, max: number) {
        this.min = min;
        this.max = max;
    }

    public static copy(source: Range, out: Range) {
        out.min = source.min;
        out.max = source.max;
        return out;
    }

    @cc._decorator.property
    public min: number = Infinity;

    @cc._decorator.property
    public max: number = -Infinity;
}

export function clampVec3(value: cc.Vec3, min: cc.math.Vec3, max: cc.math.Vec3, out?: cc.math.Vec3) {
    out ??= new cc.math.Vec3();
    return cc.math.Vec3.set(
        out,
        cc.math.clamp(value.x, min.x, max.x),
        cc.math.clamp(value.y, min.y, max.y),
        cc.math.clamp(value.z, min.z, max.z),
    );
}

export function mapVec3(input: cc.math.Vec3, mapper: (value: number) => number) {
    return new cc.math.Vec3(
        mapper(input.x),
        mapper(input.y),
        mapper(input.z),
    );
}

export enum EulerAngleOrder {
    XYZ,
    ZXY,
}

export function eulerAnglesToQuat(x: number, y: number, z: number, order: EulerAngleOrder) {
    const qx = cc.math.Quat.fromAxisAngle(
        new cc.math.Quat(),
        cc.math.Vec3.UNIT_X,
        cc.math.toRadian(x),
    );
    const qy = cc.math.Quat.fromAxisAngle(
        new cc.math.Quat(),
        cc.math.Vec3.UNIT_Y,
        cc.math.toRadian(y),
    );
    const qz = cc.math.Quat.fromAxisAngle(
        new cc.math.Quat(),
        cc.math.Vec3.UNIT_Z,
        cc.math.toRadian(z),
    );
    let q0: cc.Quat;
    let q1: cc.Quat;
    let q2: cc.Quat;
    switch (order) {
        case EulerAngleOrder.XYZ:
            q0 = qx;
            q1 = qy;
            q2 = qz;
            break;
        case EulerAngleOrder.ZXY:
            q0 = qz;
            q1 = qx;
            q2 = qy;
            break;
    }
    const result = new cc.math.Quat();
    cc.Quat.multiply(
        result,
        q0,
        cc.Quat.multiply(
            result,
            q1,
            q2,
        ),
    );
    return result;
}

export function quatMultiply(out: cc.Quat, q0: cc.Quat, q1: cc.Quat, ...quats: cc.Quat[]) {
    const nTails = quats.length;
    if (nTails === 0) {
        cc.Quat.multiply(out, q0, q1);
    } else {
        const iLast = nTails - 1;
        cc.math.Quat.copy(out, quats[iLast]);
        for (let i = iLast - 1; i >= 0; --i) {
            cc.Quat.multiply(out, quats[i], out);
        }
        cc.Quat.multiply(out, q1, out);
        cc.Quat.multiply(out, q0, out);
    }
    return out;
}
