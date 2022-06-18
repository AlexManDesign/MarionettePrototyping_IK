import { math, Quat, Vec3 } from "cc";
import { IKResolveMethod, ResolveContext, ErrorCode } from "./ResolverBase";
import { Joint } from "./Skeleton";

export class TwoBoneIK extends IKResolveMethod {
    protected *solveChain(endFactor: Joint, chain: Joint[], target: math.Vec3, maxError: number, context: ResolveContext): Generator<void, number, unknown> {
        // https://theorangeduck.com/page/simple-two-joint
        
        if (chain.length < 2) {
            return ErrorCode.BAD_ARGUMENT;
        }

        const a = chain[0];
        const b = chain[1];
        const pA = a.position;
        const pB = b.position;
        const pC = endFactor.position;
        const t = target;
        const dAB = Vec3.distance(pA, pB);
        const dBC = Vec3.distance(pB, pC);
        const dAT = Vec3.distance(pA, t);
        if (dAT > dAB + dBC) {
            return ErrorCode.TWO_BONE_FAR_FROM_ROOT;
        }

        const angleBAC = Vec3.angle(
            Vec3.subtract(new Vec3(), pB, pA).normalize(),
            Vec3.subtract(new Vec3(), pC, pA).normalize(),
        );
        const angleABC = Vec3.angle(
            Vec3.subtract(new Vec3(), pA, pB).normalize(),
            Vec3.subtract(new Vec3(), pC, pB).normalize(),
        );
        const angleBAT = Math.acos(
            (dBC * dBC - dAB * dAB - dAT * dAT) / (-2 * dAB * dAT),
        );
        const angleABT = Math.acos(
            (dAT * dAT - dAB * dAB - dBC * dBC) / (-2 * dAB * dBC),
        );
        const axisABC = Vec3.cross(
            new Vec3(),
            Vec3.subtract(new Vec3(), pB, pA).normalize(),
            Vec3.subtract(new Vec3(), pC, pA).normalize(),
        ).normalize();
        const rotationA = Quat.clone(a.rotation);
        const qA = Quat.fromAxisAngle(
            new Quat(),
            Vec3.multiply(new Vec3(), axisABC, Quat.invert(new Quat(), rotationA)),
            angleBAT - angleBAC,
        );
        Quat.multiply(rotationA, rotationA, qA);
        const rotationB = Quat.clone(b.rotation);
        const qB = Quat.fromAxisAngle(
            new Quat(),
            Vec3.multiply(new Vec3(), axisABC, Quat.invert(new Quat(), rotationB)),
            angleABT - angleABC,
        );
        Quat.multiply(rotationB, rotationB, qB);
        const angleCAT = Vec3.angle(
            Vec3.subtract(new Vec3(), pC, pA).normalize(),
            Vec3.subtract(new Vec3(), t, pA).normalize(),
        );
        const axisCAT = Vec3.cross(
            new Vec3(),
            Vec3.subtract(new Vec3(), pC, pA).normalize(),
            Vec3.subtract(new Vec3(), t, pA).normalize(),
        );
        const rFinal = Quat.fromAxisAngle(
            new Quat(),
            Vec3.multiply(new Vec3(), axisCAT, Quat.invert(new Quat(), a.rotation)),
            angleCAT,
        );

        return ErrorCode.NO_ERROR;
    }
}