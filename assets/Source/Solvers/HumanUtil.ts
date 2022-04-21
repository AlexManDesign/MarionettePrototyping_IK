// cSpell:words unproject chgsign fmod

import { clamp, Quat, Vec3, Mat3, toRadian } from "cc";
import { Avatar, HumanLimit, Quaternion, Vector3 } from "../Demo/Avatar";
import HumanTrait from "../Demo/HumanTrait.json";
import { assertIsTrue } from "../DynamicMesh/Util";
import { quatMultiply } from "../Util/Math";

/**
 * [-1, 1]
 */
type MuscleValue = number;

export function calculateHumanBoneRotation(
    avatarBone: Avatar['avatarBones'][0],
    limit: HumanLimit,
    muscles: [MuscleValue, MuscleValue, MuscleValue],
) {
    const localRotation = new Quat();
    const hasAxis = true;
    if (!hasAxis) {
    } else {
        const preRotation = Quat.clone(avatarBone.preRotation); // convertUnityRotation(avatarBone.preRotation);
        const postRotation = Quat.clone(avatarBone.postRotation); // convertUnityRotation(avatarBone.postRotation);
        const limitSign = avatarBone.limitSign;
        Quat.normalize(preRotation, preRotation);
        Quat.normalize(postRotation, postRotation);
        return fromAxes(
            {
                preRotation,
                postRotation,
                sign: Vec3.clone(limitSign),
                limit: {
                    min: new Vec3(toRadian(limit.min.x), toRadian(limit.min.y), toRadian(limit.min.z)),
                    max: new Vec3(toRadian(limit.max.x), toRadian(limit.max.y), toRadian(limit.max.z)),
                },
            },
            new Vec3(muscles[0], muscles[1], muscles[2]),
        );
    }
    return localRotation;
}

export function groupMuscles(muscles: MuscleValue[]) {
    const LAST_BODY_DOF = 55;
    const LAST_LEFT_FINGER_DOF = 75;
    const LAST_RIGHT_FINGER_DOF = 95;
    assertIsTrue(muscles.length === HumanTrait.muscles.length);
    return {
        body: muscles.slice(0, LAST_BODY_DOF),
        leftHand: muscles.slice(LAST_BODY_DOF, LAST_LEFT_FINGER_DOF),
        rightHandle: muscles.slice(LAST_LEFT_FINGER_DOF, LAST_RIGHT_FINGER_DOF),
    };
}

interface Axes {
    preRotation: Quat;
    postRotation: Quat;
    sign: Vec3;
    limit: { min: Vec3, max: Vec3 };
}

function fromAxes(axes: Axes, uvw: Vec3): Quat {
    const q = ZYRoll2Quat(chgsignV3(halfTan(limitUnprojectV3(axes.limit, uvw)), axes.sign));
    return axesUnproject(axes, q);
}

function axesUnproject(axes: Axes, q: Quat): Quat {
    const result = new Quat();
    quatMultiply(result, axes.preRotation, q, Quat.conjugate(new Quat(), axes.postRotation));
    return result;
}

function limitUnproject(min: number, max: number, v: number) {
    if (v < 0) {
        if (min < 0) {
            return -v * min;
        } else if (min > 0) {
            return v;
        } else {
            return 0;
        }
    } else {
        if (max > 0) {
            return v * max;
        } else if (max < 0) {
            return v;
        } else {
            return 0;
        }
    }
}

function limitUnprojectV3({ min, max }: { min: Vec3; max: Vec3; }, v: Vec3) {
    return new Vec3(
        limitUnproject(min.x, max.x, v.x),
        limitUnproject(min.y, max.y, v.y),
        limitUnproject(min.z, max.z, v.z),
    );
}

function ZYRoll2Quat(zyRoll: Vec3) {
    const { x, y, z } = zyRoll;
    const result = new Quat();
    Quat.set(
        result,
        x,
        y + x * z,
        z - x * y,
        1.0,
    );
    Quat.normalize(result, result);
    return result;
}

function chgsign(x: number, y: number) {
    return Math.sign(y) < 0 ? -x : x;
}

function chgsignV3(x: Vec3, y: Vec3): Vec3 {
    return new Vec3(
        chgsign(x.x, y.x),
        chgsign(x.y, y.y),
        chgsign(x.z, y.z),
    );
}

function fmod(a: number, b: number) {
    return a % b;
}

const PI_OVER_TWO = Math.PI * 0.5;

const EPSILON_RADIAN = 1e-6;

function halfTan(v: Vec3) {
    const h = (a: number) => clamp(
        0.5 * chgsign(
            fmod(Math.abs(a) + Math.PI, 2.0 * Math.PI) - Math.PI,
            a,
        ),
        -PI_OVER_TWO + EPSILON_RADIAN,
        PI_OVER_TWO - EPSILON_RADIAN,
    );
    return new Vec3(Math.tan(h(v.x)), Math.tan(h(v.y)), Math.tan(h(v.z)));
}

function positionUnityToCreator(c: Vec3, u: Vector3) {
    return Vec3.set(c,
        u.x,
        u.y,
        u.z,
    );
}

function scaleUnityToCreator(c: Vec3, u: Vector3) {
    return Vec3.set(c,
        u.x,
        u.y,
        u.z,
    );
}

function quatUnityToCreator(c: Quat, u: Quaternion) {
    const uEuler = Quat.toEuler(new Vec3(), u);
    const cEuler = eulerAnglesUnityToCreator(uEuler);
    return Quat.fromEuler(c, uEuler.x, uEuler.y, uEuler.z);
}

export function eulerAnglesUnityToCreator(vector: Vector3) {
    return new Vec3(
        vector.x,
        vector.y,
        -vector.z,
    );
}
