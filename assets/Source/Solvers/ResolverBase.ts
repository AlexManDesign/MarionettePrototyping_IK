import * as cc from 'cc';
import { SkeletonRenderer } from '../Debug/SkeletonRenderer';
import { Joint } from './Skeleton';

export enum ErrorCode {
    NO_ERROR,

    BAD_ARGUMENT,

    TOO_MANY_ATTEMPTS,
    
    FABRIK_FAR_FROM_ROOT,

    TWO_BONE_FAR_FROM_ROOT,
}

@cc._decorator.ccclass('IKResolveMethod')
export abstract class IKResolveMethod {
    protected abstract solveChain(
        endFactor: Joint,
        chain: Joint[],
        target: cc.Vec3,
        maxError: number,
        context: ResolveContext,
    ): Generator<void, number>;
}

export interface ResolveContext {
    debugLineMaterial: cc.Material | null;
    node: cc.Node;
    renderer: SkeletonRenderer | null;
}
