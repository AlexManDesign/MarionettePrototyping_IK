import { Vec3 } from "cc";

interface IWritableArrayLike<T> {
    length: number;
    [index: number]: T;
}

export const calculateNormals = (() => {
    const p0 = new Vec3();
    const p1 = new Vec3();
    const p2 = new Vec3();
    const e1 = new Vec3();
    const e2 = new Vec3();
    const n = new Vec3();
    return (positions: ArrayLike<number>, indices: ArrayLike<number>, out: IWritableArrayLike<number> = []) => {
        const nFaces = indices.length / 3;
        const nVertices = positions.length / 3;
        const normals = Array(3 * nVertices).fill(0).map(() => new Vec3());
        for (let iFace = 0; iFace < nFaces; ++iFace) {
            const i0 = indices[3 * iFace + 0];
            const i1 = indices[3 * iFace + 1];
            const i2 = indices[3 * iFace + 2];
            Vec3.fromArray(p0, positions, i0 * 3);
            Vec3.fromArray(p1, positions, i1 * 3);
            Vec3.fromArray(p2, positions, i2 * 3);

            Vec3.subtract(e1, p1, p0);
            Vec3.subtract(e2, p2, p0);
            Vec3.cross(n, e1, e2);

            Vec3.add(normals[i0], normals[i0], n);
            Vec3.add(normals[i1], normals[i1], n);
            Vec3.add(normals[i2], normals[i2], n);
        }
        for (let iVertex = 0; iVertex < nVertices; ++iVertex) {
            Vec3.toArray(out, Vec3.normalize(n, normals[iVertex]), iVertex * 3);
        }
        return out;
    };
})();