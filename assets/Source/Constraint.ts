
import * as cc from 'cc';
import { getBit, setOrClearBit } from './Util/Bitwise';
import { clampVec3, mapVec3, Range } from './Util/Math';

export enum ConstraintType {
    NONE,

    DOF_1,

    Z_Y,

    // #region DOF 3

    X_Y_Z,
    X_Z_Y,
    Y_Z_X,
    Z_Y_X,

    // #endregion
}

cc.ccenum(ConstraintType);

@cc._decorator.ccclass('NumericConstraint')
class NumericConstraint {
    @cc._decorator.property
    public tag = '';

    @cc._decorator.property(Range)
    public range: Range = new Range(-180.0, 180.0);
}

@cc._decorator.ccclass('JointConstraint')
export class JointConstraint {
    //#region Rotation limits

    @cc._decorator.property({
        type: ConstraintType,
    })
    public constraintType = ConstraintType.NONE;

    @cc._decorator.property({
        type: [NumericConstraint],
    })
    public constraints: NumericConstraint[] = Array.from({ length: 3 }, () => new NumericConstraint());

    //#endregion

    public apply(rotation: cc.math.Quat, out: cc.math.Quat, debugInfo?: string) {
        cc.math.Quat.copy(out, rotation);
        // return out;

        const { constraintType } = this;
        switch (constraintType) {
            case ConstraintType.X_Y_Z:
            case ConstraintType.X_Z_Y:
            case ConstraintType.Y_Z_X:
            case ConstraintType.Z_Y_X: {
                let iX = 0;
                let iY = 0;
                let iZ = 0;
                switch (constraintType) {
                    case ConstraintType.X_Y_Z: {
                        iX = 0;
                        iY = 1;
                        iZ = 2;
                        break;
                    }
                    case ConstraintType.X_Z_Y: {
                        iX = 0;
                        iY = 2;
                        iZ = 1;
                        break;
                    }
                    case ConstraintType.Y_Z_X: {
                        iX = 2;
                        iY = 0;
                        iZ = 1;
                        break;
                    }
                    case ConstraintType.Z_Y_X: {
                        iX = 2;
                        iY = 1;
                        iZ = 0;
                        break;
                    }
                }
                const {
                    [iX]: { range: x },
                    [iY]: { range: y },
                    [iZ]: { range: z },
                } = this.constraints;
                const eulerAngles = cc.math.Quat.toEuler(new cc.math.Vec3(), rotation) as cc.math.Vec3;
                const clamped = clampVec3(
                    eulerAngles,
                    new cc.math.Vec3(x.min, y.min, z.min),
                    new cc.math.Vec3(x.max, y.max, z.max),
                );
                if (!cc.math.Vec3.strictEquals(eulerAngles, clamped)) {
                    console.log(`${debugInfo}: ${eulerAngles} into ${clamped}`);
                }
                cc.math.Quat.fromEuler(out, clamped.x, clamped.y, clamped.z);
                break;
            }
        }
        return out;
    }
}
