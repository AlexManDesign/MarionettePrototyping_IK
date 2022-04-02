import { Quat, Vec3 } from "cc";
import { quatMultiply } from "../Util/Math";

interface Axes {
    preRotation: Quat;
    postRotation: Quat;
    sign: Vec3;
    limit: { min: Vec3, max: Vec3 };
}

export function fromAxes(axes: Axes, uvw: Vec3): Quat {
    const q = ZYRoll2Quat(changeSign(halfTan(limitUnproject(axes.limit, uvw)), axes.sign));
    return axesUnproject(axes, q);
}

function axesUnproject(axes: Axes, q: Quat): Quat {
    const result = new Quat();
    quatMultiply(result, axes.preRotation, q, Quat.conjugate(new Quat(), axes.postRotation));
    return result;
}

// function limitProject(min: number, max: number, v: number) {
//     if (v < 0) {
//         if (min < 0) {
//             return -v / min;
//         } else if (min > 0) {
//             return v;
//         } else {
//             return 0;
//         }
//     } else {
//         if (max > 0) {
//             return v / max;
//         } else if (max < 0) {
//             return v;
//         } else {
//             return 0;
//         }
//     }
// }

function selectV3(a: Vec3, b: Vec3, c: Vec3): Vec3 {
    return new Vec3(
        msb(BigInt(c.x)) ? b.x : a.x,
        msb(BigInt(c.y)) ? b.y : a.y,
        msb(BigInt(c.z)) ? b.z : a.z,
    );
}

function less(lhs: Vec3, rhs: Vec3) {
    return new Vec3(
        -(lhs.x < rhs.x),
        -(lhs.y < rhs.y),
        -(lhs.z < rhs.z),
    );
}

function great(lhs: Vec3, rhs: Vec3) {
    return new Vec3(
        -(lhs.x > rhs.x),
        -(lhs.y > rhs.y),
        -(lhs.z > rhs.z),
    );
}

function limitUnproject(limit: { min: Vec3; max: Vec3; }, v: Vec3) {
    const min = selectV3(selectV3(Vec3.ZERO, v, great(limit.min, Vec3.ZERO)), Vec3.negate(new Vec3(), Vec3.multiply(new Vec3(), v, limit.min)), less(limit.min, Vec3.ZERO));
    const max = selectV3(selectV3(Vec3.ZERO, v, less(limit.max, Vec3.ZERO)), Vec3.multiply(new Vec3(), v, limit.max), great(limit.max, Vec3.ZERO));
    return selectV3(max, min, less(v, Vec3.ZERO));
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

function changeSign(x: Vec3, y: Vec3): Vec3 {
    return new Vec3(
        msb(BigInt(y.x)) ? -x.x : x.x,
        msb(BigInt(y.y)) ? -x.y : x.y,
        msb(BigInt(y.z)) ? -x.z : x.z,
    );
}

function halfTan(v: Vec3) {
    return new Vec3(Math.tan(v.x / 2.0), Math.tan(v.y / 2.0), Math.tan(v.z / 2.0));
}

// https://stackoverflow.com/questions/62084510/efficiently-getting-most-and-least-significant-bit-in-javascript

const deBruijn = [0, 48, -1, -1, 31, -1, 15, 51, -1, 63, 5, -1, -1, -1, 19, -1, 23, 28, -1, -1, -1, 40, 36, 46, -1, 13, -1, -1, -1, 34, -1, 58, -1, 60, 2, 43, 55, -1, -1, -1, 50, 62, 4, -1, 18, 27, -1, 39, 45, -1, -1, 33, 57, -1, 1, 54, -1, 49, -1, 17, -1, -1, 32, -1, 53, -1, 16, -1, -1, 52, -1, -1, -1, 64, 6, 7, 8, -1, 9, -1, -1, -1, 20, 10, -1, -1, 24, -1, 29, -1, -1, 21, -1, 11, -1, -1, 41, -1, 25, 37, -1, 47, -1, 30, 14, -1, -1, -1, -1, 22, -1, -1, 35, 12, -1, -1, -1, 59, 42, -1, -1, 61, 3, 26, 38, 44, -1, 56];
const multiplicator = BigInt("0x6c04f118e9966f6b");

const
  b1 = BigInt(1),
  b2 = BigInt(2),
  b4 = BigInt(4),
  b8 = BigInt(8),
  b16 = BigInt(16),
  b32 = BigInt(32),
  b57 = BigInt(57);

function msb(v: bigint) {
  v |= v >> b1;
  v |= v >> b2;
  v |= v >> b4;
  v |= v >> b8;
  v |= v >> b16;
  v |= v >> b32;
  return deBruijn[
    BigInt.asUintN(
      64,
      (BigInt.asUintN(
        64,
        (v * multiplicator))) >> b57) as unknown as number
  ];
}

function lsb(v: bigint) {
  v = -v | v;
  return deBruijn[
    BigInt.asUintN(
      64,
      (BigInt.asUintN(
        64,
        (~(v) * multiplicator))) >> b57)  as unknown as number
  ];
}