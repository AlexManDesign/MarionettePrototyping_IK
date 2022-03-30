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
