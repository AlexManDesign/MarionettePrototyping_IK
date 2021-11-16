import { Mat4, Quat } from 'cc';
import { gfx, IVec3Like, math, primitives, Vec3 } from 'cc';
import { calculateNormals } from './Modelling';

/**
 * Create an octahedral geometry which usually represents a bone.
 * The octahedral is constituted of two rectangular pyramids, both share the same polygonal base.
 * The height of the octahedral is 1.0.
 * @returns The geometry.
 */
export function createOctahedralBone ({
    location,
    width,
    length,
    ratio = 0.2,
}: {
    /**
     * The width of the polygonal base, ie. its length in x axis.
     */
    width: number;

    /**
     * The length of the polygonal base, ie. its length in z axis.
     */
    length: number;

    /**
     * The height ratio of the downside pyramid. Usually in interval [0, 1].
     */
    ratio?: number;

    /**
     * Optional location.
     */
     location?: {
        /**
         * The lower apex's position.
         */
        lower: Readonly<IVec3Like>;

        /**
         * The upper apex's position.
         */
        upper: Readonly<IVec3Like>;
    };
}): primitives.IGeometry {
    const halfWeight = width / 2.0;
    const halfLength = length / 2.0;

    const positions: number[] = [
        0.0, 0.0, 0.0, // lowerApex
        0.0, 1.0, 0.0, // upperApex
        halfWeight, ratio, halfLength, // v0
        -halfWeight, ratio, halfLength, // v1
        -halfWeight, ratio, -halfLength, // v2
        halfWeight, ratio, -halfLength, // v3
    ];

    if (location) {
        const dir = Vec3.subtract(new Vec3(), location.upper, location.lower);
        const dirLen = Vec3.len(dir);
        Vec3.normalize(dir, dir);
        const rot = Quat.rotationTo(new Quat(), Vec3.UNIT_Y, dir);
        const transform = Mat4.fromRTS(new Mat4(), rot, location.lower, new Vec3(dirLen, dirLen, dirLen));
        for (let i = 0; i < positions.length / 3; ++i) {
            const p = Vec3.fromArray(new Vec3(), positions, 3 * i);
            Vec3.transformMat4(p, p, transform);
            Vec3.toArray(positions, p, 3 * i);
        }
    }

    const lowerApex = 0;
    const upperApex = 1;
    const v0 = 2;
    const v1 = 3;
    const v2 = 4;
    const v3 = 5;

    const faceVertices: number[] = [
        v0, v1, lowerApex,
        v1, v2, lowerApex,
        v2, v3, lowerApex,
        v3, v0, lowerApex,
        upperApex, v1, v0,
        upperApex, v2, v1,
        upperApex, v3, v2,
        upperApex, v0, v3,
    ];
    
    const nFaceVertices = faceVertices.length;
    const vertices: number[] = new Array(3 * nFaceVertices).fill(0.0);
    for (let iFaceVertex = 0; iFaceVertex < nFaceVertices; ++iFaceVertex) {
        const positionIndex = faceVertices[iFaceVertex];
        vertices[3 * iFaceVertex] = positions[3 * positionIndex];
        vertices[3 * iFaceVertex + 1] = positions[3 * positionIndex + 1];
        vertices[3 * iFaceVertex + 2] = positions[3 * positionIndex + 2];
    }

    const normals = calculateNormals(
        vertices,
        Array.from({ length: nFaceVertices }, (_, i) => i),
        new Array(vertices.length).fill(0.0),
    ) as number[];

    return {
        primitiveMode: gfx.PrimitiveMode.TRIANGLE_LIST,
        positions: vertices,
        normals,
    };
}