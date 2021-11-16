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