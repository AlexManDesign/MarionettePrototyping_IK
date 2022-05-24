import * as cc from 'cc';
import { DEBUG } from 'cc/env';
import { Joint as FABRIKJoint, Joint, visitJoint } from './Skeleton';
import { ErrorCode, IKResolveMethod, ResolveContext } from './ResolverBase';
import { LineRenderer } from '../Debug/LineRenderer';
import { SkeletonRenderer } from '../Debug/SkeletonRenderer';
import { quatMultiply } from '../Util/Math';

interface Goal {
    chain: Joint[];
    target: Readonly<cc.math.Vec3>;
}

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

    private *solveMultiChainInternal(
        goals: Goal[],
        maxError: number,
        debugContext: FABRIKDebugContext | undefined,
    ): Generator<void, number> {
        const {
            maxIterations,
        } = this;

        interface IKNode {
            parent: IKNode | null;
            children: IKNode[];
            position: cc.Vec3;
            length: number;
            target: cc.Vec3;
            intermediateBasePosition?: cc.Vec3;
            subbase: boolean;
        }

        const endFactors: IKNode[] = [];
        const roots: IKNode[] = [];

        const queue: IKNode[] = [];
        for (let iIteration = 0;
            iIteration < maxIterations;
            ++iIteration
        ) {
            // Forward pass: EndFactor -> Root
            queue.push(
                ...endFactors,
            );
            while (queue.length !== 0) {
                const endFactor = queue.shift()!;
                if (endFactor.subbase) {
                    // Subbase
                    const { position: subbasePosition } = endFactor;
                    cc.Vec3.zero(subbasePosition);
                    for (const child of endFactor.children) {
                        cc.Vec3.add(subbasePosition, subbasePosition, child.intermediateBasePosition!);
                    }
                    cc.Vec3.multiplyScalar(subbasePosition, subbasePosition, 1.0 / endFactor.children.length);
                } else {
                    cc.Vec3.copy(endFactor.position, endFactor.target);
                }
                for (let link = endFactor; ;) {
                    const parent = link.parent;
                    if (!parent) { // Root
                        break;
                    }
                    const outputPosition = link.intermediateBasePosition
                        ? cc.Vec3.copy(link.intermediateBasePosition, parent.position)
                        : parent.position;
                    moveJoint(
                        outputPosition,
                        link.position,
                        link.length,
                    );
                    if (!parent.subbase) {
                        queue.push(parent);
                    } else {
                        if (!queue.includes(parent)) {
                            queue.push(parent);
                        }
                        break;
                    }
                }
            }

            // Backward pass: Root -> EndFactor
            queue.push(
                ...roots,
            );
            while (queue.length !== 0) {
                const base = queue.shift()!;
                for (const child of base.children) {
                    moveJoint(
                        child.position,
                        base.position,
                        child.length,
                    );
                    queue.push(child);
                }
            }
        }

        return ErrorCode.NO_ERROR;
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
        const originalLinkPositionTable = chain.map((link) => {
            return {
                position: cc.Vec3.clone(link.position),
                rotation: cc.Quat.clone(link.rotation),
            };
        });
        const linkLengthTable = chain.map((link, linkIndex, chain) => linkIndex === chain.length - 1 ? 0.0 : link.linkLength);
        const iEndFactor = 0;
        const iRoot = nLinks - 1;
        const rootPosition = cc.math.Vec3.copy(new cc.math.Vec3(), root.position);

        const DEBUG_EACH_MOVEMENT: boolean = false;

        const apply = () => {
            // Apply from root, so we won't suffer from "parent changed, so child changed"
            // for (let iLink = nLinks - 1; iLink >= 0; --iLink) {
            //     chain[iLink].position = linkPositionTable[iLink];
            // }
            for (let iLink = nLinks - 1; iLink >= 0; --iLink) {
                chain[iLink].position = linkPositionTable[iLink];
                continue;
            }
        };

        const ROTATE_PARENT: boolean = true;

        const applyWithRotationAdjustment = function*() {
            for (let iLink = nLinks - 1; iLink >= 0; --iLink) {
                const { position, rotation } = originalLinkPositionTable[iLink];
                chain[iLink].position = position;
                chain[iLink].rotation = rotation;
            }

            if (ROTATE_PARENT) {
                for (let iLink = nLinks - 1; iLink >= 0; --iLink) {
                    if (iLink === nLinks - 1) {
                        // chain[iLink].position = linkPositionTable[iLink];
                    } else {
                        const iParentLink = iLink + 1;
                        const originalLocalPoint = chain[iParentLink].node.inverseTransformPoint(new cc.Vec3(), chain[iLink].position);
                        const expectedLocalPoint = chain[iParentLink].node.inverseTransformPoint(new cc.Vec3(), linkPositionTable[iLink]);
                        const originalDir = originalLocalPoint;
                        cc.Vec3.normalize(originalDir, originalDir);
                        const expectedDir = expectedLocalPoint;
                        cc.Vec3.normalize(expectedDir, expectedDir);
                        const rotation = cc.Quat.rotationTo(new cc.Quat(), originalDir, expectedDir);
                        const finalRotation = cc.Quat.multiply(new cc.Quat(), chain[iParentLink].rotation, rotation);
                        chain[iParentLink].rotation = finalRotation;
    
                        // const p = chain[iLink].position;
                        // const eq = cc.Vec3.equals(p, linkPositionTable[iLink], 1e-4);
                        // if (!eq) {
                        //     debugger;
                        // }
                    }
                }
            } else {
                const targetChainRenderer = createChainRenderer2?.(cc.Color.BLACK);

                const applyingChainRenderer = createChainRenderer2?.(cc.Color.RED, new cc.Vec3(0.01));

                const axisRenderer = createChainAxisRenderer?.(0.05);
                
                for (let iLink = nLinks - 1; iLink >= 0; --iLink) {
                    if (iLink === nLinks - 1) {
                        // chain[iLink].position = linkPositionTable[iLink];
                    } else {
                        applyingChainRenderer?.setColor(iLink, cc.Color.BLUE);
                        yield;

                        const iParentLink = iLink + 1;
                        const node = chain[iLink].node;
                        const worldRS = chain[iLink].node.parent?.getWorldMatrix() ?? new cc.Mat4();
                        cc.Mat4.multiply(worldRS, worldRS, cc.Mat4.fromRTS(new cc.Mat4(), node.rotation, cc.Vec3.ZERO, node.scale));
                        cc.Mat4.invert(worldRS, worldRS);
                        const originalLocalPoint = cc.Vec3.transformMat4(
                            new cc.Vec3(),
                            chain[iLink].position,
                            worldRS,
                        );
                        const expectedLocalPoint = cc.Vec3.transformMat4(
                            new cc.Vec3(),
                            linkPositionTable[iLink],
                            worldRS,
                        );
                        if (!cc.approx(cc.Vec3.lengthSqr(originalLocalPoint), cc.Vec3.lengthSqr(expectedLocalPoint), 1e-5)) {
                            // debugger;
                        }
                        const originalDir = originalLocalPoint;
                        cc.Vec3.normalize(originalDir, originalDir);
                        const expectedDir = expectedLocalPoint;
                        cc.Vec3.normalize(expectedDir, expectedDir);
                        const rotation = cc.Quat.rotationTo(new cc.Quat(), originalDir, expectedDir);
                        const finalRotation = quatMultiply(new cc.Quat(), rotation, chain[iLink].localRotation);
                        chain[iLink].localRotation = finalRotation;

                        // const p = chain[iLink].position;
                        // const eq = cc.Vec3.equals(p, linkPositionTable[iLink], 1e-4);
                        // if (!eq) {
                        //     debugger;
                        // }

                        applyingChainRenderer?.setEndings(iLink, chain[iParentLink].position, chain[iLink].position);
                        axisRenderer?.update();
                        yield;
                        applyingChainRenderer?.setColor(iLink, cc.Color.RED);
                    }
                }
                yield;
                applyingChainRenderer?.destroy();

                targetChainRenderer?.destroy();
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

        const createChainRenderer2 = !debugContext ? undefined : (color = cc.Color.GREEN, translation = cc.Vec3.ZERO) => {
            const renderRoot = new cc.Node();
            renderRoot.parent = debugContext.renderRoot;
            const linkRenderers: LineRenderer[] =[];
            const setEndings = (iLink: number, start: cc.Vec3, end: cc.Vec3) => {
                linkRenderers[iLink].setEndings(cc.Vec3.add(new cc.Vec3(), start, translation),  cc.Vec3.add(new cc.Vec3(), end, translation));
                linkRenderers[iLink].commit();
            };
            const setColor = (iLink: number, color: cc.Color) => {
                linkRenderers[iLink].setColor(color);
                linkRenderers[iLink].commit();
            };
            chain.forEach((link, iLink) => {
                const linkRenderer = new LineRenderer(renderRoot, debugContext.material, color);
                linkRenderers.push(linkRenderer);
                setEndings(iLink, link.position, link.parentPosition);
            });
            return {
                destroy() {
                    linkRenderers.forEach((linkRenderer) => linkRenderer.destroy());
                },
                setColor,
                setEndings,
            };
        };

        const createChainAxisRenderer = !debugContext ? undefined : (scale = 1.0) => {
            const renderRoot = new cc.Node();
            renderRoot.parent = debugContext.renderRoot;
            const linkRenderers = chain.map((link, iLink) => {
                const lineRenderers = Array.from({ length: 3 }, (_, i) => {
                    const linkRenderer = new LineRenderer(renderRoot, debugContext.material);
                    linkRenderer.setColor(i === 0 ? cc.Color.RED : i === 1 ? cc.Color.GREEN : cc.Color.BLUE);
                    return linkRenderer;
                });
                return lineRenderers;
            });
            function update () {
                for (let i = 0; i < linkRenderers.length; ++i) {
                    const [x, y, z] = linkRenderers[i];
                    const link = chain[i];
                    const px = cc.Vec3.transformQuat(new cc.Vec3(), cc.Vec3.UNIT_X, link.node.getWorldRotation());
                    const py = cc.Vec3.transformQuat(new cc.Vec3(), cc.Vec3.UNIT_Y, link.node.getWorldRotation());
                    const pz = cc.Vec3.transformQuat(new cc.Vec3(), cc.Vec3.UNIT_Z, link.node.getWorldRotation());
                    for (const p of [px, py, pz]) {
                        cc.Vec3.scaleAndAdd(p, link.position, p, scale)
                    }
                    x.setEndings(
                        link.position,
                        px,
                    );
                    x.commit();
                    y.setEndings(
                        link.position,
                        py,
                    );
                    y.commit();
                    z.setEndings(
                        link.position,
                        pz,
                    );
                    z.commit();
                }
            };
            update();
            return {
                destroy() {
                    for (const lines of linkRenderers) {
                        for (const line of lines) {
                            line.destroy();
                        }
                    }
                },
                update,
            };
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
            iIteration < maxIterations;
            ++iIteration
        ) {
            if (isReached()) {
                yield* applyWithRotationAdjustment();
                return ErrorCode.NO_ERROR;
            }

            // EndFactor -> Root
            let chainRenderer = createChainRenderer?.();
            cc.Vec3.copy(linkPositionTable[iEndFactor], target);
            apply();
            if (DEBUG_EACH_MOVEMENT) {
                yield;
            }
            for (let iLink = 1; iLink < nLinks; ++iLink) {
                if (DEBUG_EACH_MOVEMENT) {
                    debugContext?.renderer?.setBoneColor(chain[iLink - 1].name, cc.Color.BLUE);
                    yield;
                    debugContext?.renderer?.resetBoneColor(chain[iLink - 1].name);
                }

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
            apply();
            if (DEBUG_EACH_MOVEMENT) {
                yield;
            }
            for (let iLink = nLinks - 2; iLink >= 0; --iLink) {
                if (DEBUG_EACH_MOVEMENT) {
                    debugContext?.renderer?.setBoneColor(chain[iLink].name, cc.Color.BLUE);
                    yield;
                    debugContext?.renderer?.resetBoneColor(chain[iLink].name);
                }

                moveJoint(
                    linkPositionTable[iLink],
                    linkPositionTable[iLink + 1],
                    linkLengthTable[iLink],
                );
                apply();
            }
            chainRenderer?.destroy();

            yield* applyWithRotationAdjustment();
        }

        yield* applyWithRotationAdjustment();

        return ErrorCode.TOO_MANY_ATTEMPTS;
    }
}

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
