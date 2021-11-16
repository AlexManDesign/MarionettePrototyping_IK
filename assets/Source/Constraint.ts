
import * as cc from 'cc';
import { getBit, setOrClearBit } from './Util/Bitwise';
import { Range } from './Util/Math';

const ROTATION_GROUP = 'Rotation';

@cc._decorator.ccclass('JointConstraint')
export class JointConstraint {
    //#region Rotation limits

    @cc._decorator.property({
        group: ROTATION_GROUP,
        displayName: '禁用 X 轴旋转',
    })
    get rotationXLocked() {
        return getBit(this._rotationLock, RotationLockBit.X);
    }

    set rotationXLocked(value) {
        this._rotationLock = setOrClearBit(this._rotationLock, RotationLockBit.X, value);
    }

    @cc._decorator.property({
        group: ROTATION_GROUP,
        displayName: 'X 轴旋转范围',
        visible: function (this: JointConstraint) {
            return !this.rotationXLocked;
        },
    })
    get rotationXRange(): Readonly<Range> {
        return this._rotationXRange;
    }

    set rotationXRange(value) {
        Range.copy(value, this._rotationXRange);
    }

    @cc._decorator.property({
        group: ROTATION_GROUP,
        displayName: '禁用 Y 轴旋转',
    })
    get rotationYLocked() {
        return getBit(this._rotationLock, RotationLockBit.Y);
    }

    set rotationYLocked(value) {
        this._rotationLock = setOrClearBit(this._rotationLock, RotationLockBit.Y, value);
    }

    @cc._decorator.property({
        group: ROTATION_GROUP,
        displayName: 'Y 轴旋转范围',
        visible: function (this: JointConstraint) {
            return !this.rotationYLocked;
        },
    })
    get rotationYRange(): Readonly<Range> {
        return this._rotationYRange;
    }

    set rotationYRange(value) {
        Range.copy(value, this._rotationYRange);
    }

    @cc._decorator.property({
        group: ROTATION_GROUP,
        displayName: '禁用 Z 轴旋转',
    })
    get rotationZLocked() {
        return getBit(this._rotationLock, RotationLockBit.Z);
    }

    set rotationZLocked(value) {
        this._rotationLock = setOrClearBit(this._rotationLock, RotationLockBit.Z, value);
    }

    @cc._decorator.property({
        group: ROTATION_GROUP,
        displayName: 'Z 轴旋转范围',
        visible: function (this: JointConstraint) {
            return !this.rotationZLocked;
        },
    })
    get rotationZRange(): Readonly<Range> {
        return this._rotationZRange;
    }

    set rotationZRange(value) {
        Range.copy(value, this._rotationZRange);
    }

    //#endregion
    
    @cc._decorator.property
    private _rotationLock = 0;
    
    @cc._decorator.property
    private _rotationXRange: Range = new Range(0.0, Math.PI * 2);

    @cc._decorator.property
    private _rotationYRange: Range = new Range(0.0, Math.PI * 2);

    @cc._decorator.property
    private _rotationZRange: Range = new Range(0.0, Math.PI * 2);
}

enum RotationLockBit {
    X,
    Y,
    Z,
}