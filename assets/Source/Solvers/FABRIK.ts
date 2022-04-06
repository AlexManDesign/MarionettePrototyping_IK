import * as cc from 'cc';
import { DEBUG } from 'cc/env';
import { Joint as FABRIKJoint, Joint, visitJoint } from './Skeleton';
import { ErrorCode, IKResolveMethod, ResolveContext } from './ResolverBase';
import { LineRenderer } from '../Debug/LineRenderer';
import { SkeletonRenderer } from '../Debug/SkeletonRenderer';

@cc._decorator.ccclass('FABRIK')
export class FABRIK extends IKResolveMethod {
    @cc._decorator.property({
        displayName: '最大迭次次数',
    })
    public maxIterations = 32;

    public *solveChain(
        endFactor: Joint,
        chain: Joint[],
        target: Readonly<cc.math.Vec3>,
        maxError: number,
        context: ResolveContext,
    ): Generator<void, number> {
        const debugContext = context.debugLineMaterial ? new FABRIKDebugContext(context.node, context.debugLineMaterial, context.renderer) : undefined;
        const result = yield* this.solveChainInternal(
            [endFactor, ...chain],
            target,
            maxError,
            debugContext,
        );
        if (debugContext) {
            debugContext.destroy();
        }
        return result;
    }

    private *solveChainInternal(
        chain: Joint[],
        target: Readonly<cc.math.Vec3>,
        maxError: number,
        debugContext: FABRIKDebugContext | undefined,
    ): Generator<void, number> {
        const {
            maxIterations,
        } = this;

        const nLinks = chain.length;
        const root = chain[nLinks - 1];
        const linkPositionTable = chain.map((link) => cc.Vec3.clone(link.position));
        const linkLengthTable = chain.map((link, linkIndex, chain) => linkIndex === chain.length - 1 ? 0.0 : link.linkLength);
        const iEndFactor = 0;
        const iRoot = nLinks - 1;
        const rootPosition = cc.math.Vec3.copy(new cc.math.Vec3(), root.position);

        const apply = () => {
            // Apply from root, so we won't suffer from "parent changed, so child changed"
            // for (let iLink = nLinks - 1; iLink >= 0; --iLink) {
            //     chain[iLink].position = linkPositionTable[iLink];
            // }
            for (let iLink = nLinks - 1; iLink >= 0; --iLink) {
                if (iLink === nLinks - 1) {
                    chain[iLink].position = linkPositionTable[iLink];
                } else {
                    const originalWorldRotation = chain[iLink].rotation;
                    const originalWorldPosition = chain[iLink].position;
                    const positionWithoutRotation = cc.Vec3.transformQuat(
                        new cc.Vec3(),
                        originalWorldPosition,
                        cc.Quat.invert(new cc.Quat(), originalWorldRotation),
                    );
                    const newRot = cc.Quat.rotationTo(new cc.Quat(), originalWorldPosition, linkPositionTable[iLink]);
                    const newPos = cc.Vec3.transformQuat(
                        new cc.Vec3(),
                        positionWithoutRotation,
                        newRot,
                    );
                    chain[iLink].node.worldRotation = newRot;
                    chain[iLink].position = newPos;
                }
            }
        };

        const chainLength = chain.reduce((result, joint) => result += joint.linkLength, 0.0);
        const distanceRootToTarget = cc.math.Vec3.distance(root.position, target);
        if (distanceRootToTarget > chainLength) {
            cc.debug(`The end factor is far from root, which exceeds the chain length.`);
            return ErrorCode.FABRIK_FAR_FROM_ROOT;
        }

        const isReached = () => {
            const distance = cc.math.Vec3.distance(linkPositionTable[0], target);
            return distance < maxError;
        };

        const createChainRenderer = !debugContext ? undefined : () => {
            const renderRoot = new cc.Node();
            renderRoot.parent = debugContext.renderRoot;
            const linkRenderers: LineRenderer[] =[];
            for (const link of chain) {
                const linkRenderer = new LineRenderer(renderRoot, debugContext.material, cc.Color.GREEN);
                linkRenderer.setEndings(link.position, link.parentPosition);
                linkRenderer.commit();
                linkRenderers.push(linkRenderer);
            }
            return {
                destroy() {
                    linkRenderers.forEach((linkRenderer) => linkRenderer.destroy());
                },
            };
        };

        for (let iIteration = 0;
            !isReached() && iIteration < maxIterations;
            ++iIteration
        ) {
            // EndFactor -> Root
            let chainRenderer = createChainRenderer?.();
            cc.Vec3.copy(linkPositionTable[iEndFactor], target);
            for (let iLink = 1; iLink < nLinks; ++iLink) {
                debugContext?.renderer?.setBoneColor(chain[iLink - 1].name, cc.Color.BLUE);
                yield;
                debugContext?.renderer?.resetBoneColor(chain[iLink - 1].name);

                moveJoint(
                    linkPositionTable[iLink],
                    linkPositionTable[iLink - 1],
                    linkLengthTable[iLink - 1],
                );
                apply();
            }
            chainRenderer?.destroy();

            // Root -> EndFactor
            chainRenderer = createChainRenderer?.();
            cc.Vec3.copy(linkPositionTable[iRoot], rootPosition);
            for (let iLink = nLinks - 2; iLink >= 0; --iLink) {
                debugContext?.renderer?.setBoneColor(chain[iLink].name, cc.Color.BLUE);
                yield;
                debugContext?.renderer?.resetBoneColor(chain[iLink].name);

                moveJoint(
                    linkPositionTable[iLink],
                    linkPositionTable[iLink + 1],
                    linkLengthTable[iLink],
                );
                apply();
            }
            chainRenderer?.destroy();
        }

        apply();

        return ErrorCode.TOO_MANY_ATTEMPTS;

        function moveJoint(targetPosition: cc.Vec3, fixedPosition: cc.Vec3, distance: number) {
            const direction = cc.math.Vec3.subtract(
                new cc.math.Vec3(),
                targetPosition,
                fixedPosition,
            );
            cc.math.Vec3.normalize(direction, direction);
            cc.Vec3.scaleAndAdd(
                targetPosition,
                fixedPosition,
                direction,
                distance,
            );
        }
    }
}

class FABRIKDebugContext {
    constructor(public renderRoot: cc.Node, public material: cc.Material, public renderer: SkeletonRenderer | null) {
        const endFactorToLinkLineRenderer = new LineRenderer(renderRoot, material);
        endFactorToLinkLineRenderer.setColor(cc.Color.RED);
        const targetToLinkLineRenderer = new LineRenderer(renderRoot, material);
        targetToLinkLineRenderer.setColor(cc.Color.BLUE);
        this._endFactorToLinkLineRenderer = endFactorToLinkLineRenderer;
        this._targetToLinkLineRenderer = targetToLinkLineRenderer;
    }

    public destroy() {
        this._endFactorToLinkLineRenderer.destroy();
        this._targetToLinkLineRenderer.destroy();
    }

    public drawIteration(endFactor: cc.Vec3, target: cc.Vec3, link: cc.Vec3) {
        this._endFactorToLinkLineRenderer.setEndings(endFactor, link);
        this._endFactorToLinkLineRenderer.commit();
        this._targetToLinkLineRenderer.setEndings(target, link);
        this._targetToLinkLineRenderer.commit();
    }

    private _endFactorToLinkLineRenderer: LineRenderer;
    private _targetToLinkLineRenderer: LineRenderer;
}
