import parseBVH_ from 'parse-bvh';

export type {
    Joint as BVHJoint,
    BVH,
} from 'parse-bvh';

export function parseBVH(bvhString: string) {
    return parseBVH_(bvhString);
}
