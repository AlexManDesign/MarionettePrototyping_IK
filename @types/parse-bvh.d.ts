
declare module "parse-bvh" {
    export interface Joint {
        name: string;
        index: number;
        offset: [number, number, number];
        channels: string[];
        channelOffset: number;
        parent: Joint | null;
        children: Joint[];
    }

    export interface BVH {
        joints: Joint[];
        frameTime: number;
        frames: Array<number[]>;
    }

    export default function parseBVH(bvhString: string): BVH;
}