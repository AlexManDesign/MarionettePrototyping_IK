import { Quat, Vec3 } from "cc";
import { assertIsTrue } from "../DynamicMesh/Util";

const tempT = new Vec3();
const tempQ = new Quat();

export class Transform {
    public position = new Vec3();
    public rotation = new Quat();
    public scale = new Vec3();

    public static copy(output: Transform, input: Transform) {
        Vec3.copy(output.position, input.position);
        Quat.copy(output.rotation, input.rotation);
        Vec3.copy(output.scale, input.scale);
    }

    /**
     * @returns `transform * v`
     */
    public static multiplyVec3(out: Vec3, lhs: Transform, v: Vec3): Vec3 {
        const scaled = Vec3.multiply(tempT, v, lhs.scale);
        const rotated = Vec3.transformQuat(tempT, scaled, lhs.rotation);
        return Vec3.add(out, rotated, lhs.position);
    }

    /**
     * @returns `inverse(transform) * v`
     */
    public static inverseMultiplyVec3(out: Vec3, transform: Transform, v: Vec3): Vec3 {
        const translated = Vec3.subtract(tempT, v, transform.position);
        // TODO: conjugate
        const rotated = Vec3.transformQuat(tempT, translated, Quat.invert(tempQ, transform.rotation));
        return Vec3.divide(out, rotated, transform.scale);
    }

    /**
     * @returns `lhs * rhs`
     */
    public static multiply(out: Transform, lhs: Transform, rhs: Transform): Transform {
        Transform.multiplyVec3(out.position, lhs, rhs.position);
        Quat.multiply(out.rotation, lhs.rotation, rhs.rotation);
        Vec3.multiply(out.scale, lhs.scale, rhs.scale);
        return out;
    }

    /**
     * @returns `inverse(lhs) * rhs`
     */
    public static inverseMultiply(out: Transform, lhs: Transform, rhs: Transform): Transform {
        Transform.inverseMultiplyVec3(out.position, lhs, rhs.position);
        Quat.multiply(out.rotation, Quat.invert(tempQ, lhs.rotation), rhs.rotation);
        Vec3.divide(out.scale, rhs.scale, lhs.scale);
        return out;
    }
}

/**
 * Parents should be indexed before ancestors.
 */
export type ParentTable = number[];

type TransformArray = Transform[];

export class TransformTree {
    public static toGlobal(
        outputTransforms: TransformArray,
        inputTransforms: TransformArray,
        parentTable: ParentTable,
    ) {
        const nTransforms = inputTransforms.length;
        for (let transformIndex = 0; transformIndex < nTransforms; ++transformIndex) {
            const parentTransformIndex = parentTable[transformIndex];
            if (parentTransformIndex < 0) {
                continue;
            }
            assertIsTrue(parentTransformIndex < transformIndex);
            const localTransform = inputTransforms[transformIndex];
            const parentGlobalTransform = outputTransforms[parentTransformIndex];
            Transform.multiply(
                outputTransforms[transformIndex],
                parentGlobalTransform,
                localTransform,
            );
        }
    }

    public static toGlobalFromBottom(
        outputTransforms: TransformArray,
        inputTransforms: TransformArray,
        parentTable: ParentTable,
        startTransformIndex: number,
        endTransformIndex?: number,
    ) {
        endTransformIndex ??= -1;

        const localTransform = inputTransforms[startTransformIndex];
        const outputTransform = outputTransforms[startTransformIndex];

        const parentTransformIndex = parentTable[startTransformIndex];
        if (parentTransformIndex < 0) {
            Transform.copy(
                outputTransform,
                localTransform,
            );
        } else {
            this.toGlobalFromBottom(
                outputTransforms,
                inputTransforms,
                parentTable,
                parentTransformIndex,
                endTransformIndex,
            );
            const parentGlobalTransform = outputTransforms[parentTransformIndex];
            Transform.multiply(
                outputTransform,
                parentGlobalTransform,
                localTransform,
            );
        }
    }

    public static toLocal(
        outputTransforms: TransformArray,
        inputTransforms: TransformArray,
        parentTable: ParentTable,
    ) {
        const nTransforms = inputTransforms.length;
        for (let transformIndex = nTransforms - 1; transformIndex >= 0; --transformIndex) {
            const parentTransformIndex = parentTable[transformIndex];
            if (parentTransformIndex < 0) {
                continue;
            }
            assertIsTrue(parentTransformIndex < transformIndex);
            const globalTransform = inputTransforms[transformIndex];
            const parentGlobalTransform = outputTransforms[parentTransformIndex];
            Transform.inverseMultiply(
                outputTransforms[transformIndex],
                parentGlobalTransform,
                globalTransform,
            );
        }
    }

    public static toLocalFromBottom(
        outputTransforms: TransformArray,
        inputTransforms: TransformArray,
        parentTable: ParentTable,
        startTransformIndex: number,
        endTransformIndex?: number,
    ) {
        endTransformIndex ??= -1;

        for (let transformIndex = startTransformIndex - 1; transformIndex !== endTransformIndex;) {
            const parentTransformIndex = parentTable[transformIndex];
            const globalTransform = inputTransforms[transformIndex];
            const outputTransform = outputTransforms[transformIndex];
            if (parentTransformIndex < 0) {
                Transform.copy(
                    outputTransform,
                    globalTransform,
                );
            } else {
                const parentGlobalTransform = inputTransforms[parentTransformIndex];
                Transform.inverseMultiply(
                    outputTransform,
                    parentGlobalTransform,
                    globalTransform,
                );
            }
            transformIndex = parentTransformIndex;
        }
    }
}