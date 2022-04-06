import * as cc from 'cc';
import { DEBUG } from 'cc/env';
import { ErrorCode, IKResolveMethod, ResolveContext } from './ResolverBase';
import { LineRenderer } from '../Debug/LineRenderer';
import { Joint } from './Skeleton';

enum AlgorithmType {
    FORWARD,

    BACKWARD,

    FORWARD_BOUNCE,

    BACKWARD_BOUNCE,

    FORWARD_BOUNCE_BOUNCE,

    BACKWARD_SMART_BOUNCE,
}

cc.ccenum(AlgorithmType);

@cc._decorator.ccclass('CCDIK')
export class CCDIKResolver extends IKResolveMethod {
    @cc._decorator.property({
        type: AlgorithmType,
        displayName: '算法',
    })
    public algorithm = AlgorithmType.BACKWARD;

    @cc._decorator.property({
        displayName: '最大迭次次数',
    })
    public maxIterations = 32;

    @cc._decorator.property({
        min: 0.8,
        max: 1.2,
        slide: true,
        step: 0.05,
        displayName: '纠正旋转角因子',
    })
    public angleDelta = 1.0;

    @cc._decorator.property({
        displayName: '启用角度限制',
    })
    public angularLimits = true;

    public *solveChain(
        endFactor: Joint,
        chain: Joint[],
        target: Readonly<cc.math.Vec3>,
        maxError: number,
        context: ResolveContext,
    ): Generator<void, ErrorCode> {
        // The root is immutable.
        const chainNoRoot = chain.slice(0, chain.length - 1);

        const debugContext = context.debugLineMaterial ? new CCDDebugContext(context.node, context.debugLineMaterial) : undefined;
        const result = yield* this.solveChainInternal(
            endFactor,
            chainNoRoot,
            target,
            maxError,
            context.renderer,
            debugContext,
        );
        if (debugContext) {
            debugContext.destroy();
        }
        return result;
    }

    protected *solveChainInternal(
        endFactor: Joint,
        chain: Joint[],
        target: Readonly<cc.math.Vec3>,
        maxError: number,
        renderer: ResolveContext['renderer'],
        debugContext?: CCDDebugContext,
    ): Generator<void, ErrorCode> {
        const {
            algorithm,
            maxIterations,
            angularLimits,
            angleDelta,
        } = this;

        const yieldBeforeIteration: boolean = true;

        const yieldAfterIteration: boolean = true;

        const nLinks = chain.length;

        const linkConstraints = chain;

        switch (algorithm) {
            default:
            case AlgorithmType.BACKWARD: {
                for (let iIteration = 0; iIteration < maxIterations; ++iIteration) {
                    for (let iLink = 0; iLink < nLinks; ++iLink) {
                        if (yieldBeforeIteration) {
                            yield drawIteration(iLink);
                        }
                        const finished = correct.call(this, iLink);
                        if (finished) {
                            if (DEBUG) {
                                cc.debug(
                                    `[CCD IK]: Successfully resolved. ` +
                                    `Algorithm: ${AlgorithmType[algorithm]}; ` +
                                    `Iterations: ${iIteration}; ` +
                                    `Link: ${iLink}`
                                );
                            }
                            return ErrorCode.NO_ERROR;
                        }
                        if (yieldAfterIteration) {
                            yield drawIteration(iLink);
                        }
                    }
                }
                break;
            }

            case AlgorithmType.FORWARD: {
                for (let iIteration = 0; iIteration < maxIterations; ++iIteration) {
                    for (let iLink = nLinks - 1; iLink >= 0; --iLink) {
                        if (yieldBeforeIteration) {
                            yield drawIteration(iLink);
                        }
                        const finished = correct.call(this, iLink);
                        if (finished) {
                            if (DEBUG) {
                                cc.debug(
                                    `[CCD IK]: Successfully resolved. ` +
                                    `Algorithm: ${AlgorithmType[algorithm]}; ` +
                                    `Iterations: ${iIteration}; ` +
                                    `Link: ${iLink}`
                                );
                            }
                            return ErrorCode.NO_ERROR;
                        }
                        if (yieldAfterIteration) {
                            yield drawIteration(iLink);
                        }
                    }
                }
                break;
            }

            case AlgorithmType.BACKWARD_BOUNCE: {
                for (let iIteration = 0; iIteration < maxIterations; ++iIteration) {
                    for (let iBounceLink = 0; iBounceLink < nLinks; ++iBounceLink) {
                        for (let iLink = 0; iLink <= iBounceLink; ++iLink) {
                            if (yieldBeforeIteration) {
                                yield drawIteration(iLink);
                            }
                            const finished = correct.call(this, iLink);
                            if (finished) {
                                if (DEBUG) {
                                    cc.debug(
                                        `[CCD IK]: Successfully resolved. ` +
                                        `Algorithm: ${AlgorithmType[algorithm]}; ` +
                                        `Iterations: ${iIteration}; ` +
                                        `Link: ${iLink}` +
                                        `Bounce Link: ${iBounceLink}`
                                    );
                                }
                                return ErrorCode.NO_ERROR;
                            }
                            if (yieldAfterIteration) {
                                yield drawIteration(iLink);
                            }
                        }
                    }
                }
                break;
            }
        }

        if (DEBUG) {
            cc.debug(`CCD IK failed: max iterations exhausted.`);
        }

        return ErrorCode.TOO_MANY_ATTEMPTS;

        function drawIteration(linkIndex: number) {
            if (!debugContext) {
                return;
            }
            const link = chain[linkIndex];
            debugContext.drawIteration(endFactor.position, target, link.position);
        }

        function correct(this: CCDIKResolver, linkIndex: number) {
            if (renderer) {
                const link = linkIndex === 0 ? endFactor : chain[linkIndex - 1];
            }

            const link = chain[linkIndex];
            const linkConstraint = linkConstraints[linkIndex];
            const linkWorldPosition = link.position;
            const endFactorWorldPosition = endFactor.position;
            const u = cc.math.Vec3.subtract(
                new cc.math.Vec3(),
                endFactorWorldPosition,
                linkWorldPosition,
            );
            const v = cc.math.Vec3.subtract(
                new cc.math.Vec3(),
                target,
                linkWorldPosition,
            );
            cc.math.Vec3.normalize(u, u);
            cc.math.Vec3.normalize(v, v);
            const axis = cc.math.Vec3.cross(
                new cc.math.Vec3(),
                u,
                v,
            );
            cc.math.Vec3.normalize(axis, axis);

            const angle = cc.math.Vec3.angle(u, v);
            const correctiveAngle = angle * angleDelta;
            const correctiveWorldRotation = cc.math.Quat.fromAxisAngle(
                new cc.math.Quat(),
                axis,
                correctiveAngle,
            );
            if (cc.Quat.equals(correctiveWorldRotation, cc.math.Quat.IDENTITY)) {
                // debugger;
            }

            const newWorldRotation = cc.math.Quat.multiply(
                new cc.math.Quat(),
                correctiveWorldRotation,
                link.rotation,
            );

            const newLocalRotation = cc.math.Quat.multiply(
                new cc.math.Quat(),
                cc.math.Quat.invert(new cc.math.Quat(), link.parentRotation),
                newWorldRotation,
            );

            cc.math.Quat.normalize(newLocalRotation, newLocalRotation);

            let newLocalRotationConstrained = newLocalRotation;
            if (linkConstraint) {
                if (link.name.endsWith('Spine1')) {
                    // debugger;
                }
                const relativeLocalRotation = cc.math.Quat.multiply(
                    new cc.math.Quat(),
                    newLocalRotation,
                    linkConstraint.inverseInitialLocalRotation,
                );

                const fixed = linkConstraint.constraint.apply(
                    relativeLocalRotation,
                    new cc.math.Quat(),
                    `${link.name}`,
                );

                newLocalRotationConstrained = cc.math.Quat.multiply(
                    new cc.math.Quat(),
                    fixed,
                    linkConstraint.initialLocalRotation,
                );
            }

            link.localRotation = newLocalRotationConstrained;

            // cc.math.Quat.normalize(newWorldRotation, newWorldRotation);
            // if (cc.Quat.equals(newWorldRotation, new cc.math.Quat(0, 0, 0, 0))) {
            //     // debugger;
            // }
            // link.setWorldRotation(newWorldRotation);
            // if (cc.Quat.equals(link.getWorldRotation(), new cc.math.Quat(0, 0, 0, 0))) {
            //     // debugger;
            // }

            cc.math.Vec3.copy(endFactorWorldPosition, endFactor.position);

            const distance = cc.math.Vec3.distance(
                endFactorWorldPosition,
                target,
            );
            cc.debug(
                `[CCD IK]: New distance: ${distance}`
            );
            if (distance < maxError) {
                return true;
            }

            return false;
        }
    }
}

class CCDDebugContext {
    constructor(renderRoot: cc.Node, material: cc.Material) {
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

