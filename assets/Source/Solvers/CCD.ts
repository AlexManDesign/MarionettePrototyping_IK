import * as cc from 'cc';
import { DEBUG } from 'cc/env';
import { JointConstraint } from '../Constraint';

enum AlgorithmType {
    FORWARD,

    BACKWARD,

    FORWARD_BOUNCE,

    BACKWARD_BOUNCE,

    FORWARD_BOUNCE_BOUNCE,

    BACKWARD_SMART_BOUNCE,
}

cc.ccenum(AlgorithmType);

@cc._decorator.ccclass('JointInfo')
class Joint {
    @cc._decorator.property({
        type: cc.Node,
        displayName: '节点',
    })
    node!: cc.Node;

    @cc._decorator.property({
        type: JointConstraint,
        displayName: '约束',
    })
    constraint: JointConstraint = new JointConstraint();
}

@cc._decorator.ccclass('CCDIK')
export class CCDIK extends cc.Component {
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
        displayName: '允许的误差',
    })
    public maxError = 1e-5;

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

    @cc._decorator.property({
        type: cc.Node,
        displayName: '根关节',
    })
    get root() {
        return this._root;
    }

    set root(value) {
        this._root = value;
        const oldJoints: Joint[] = this.joints;
        this.joints = [];
        const joints = this.joints;
        value?.walk((node) => {
            const oldJoint = oldJoints.find((joint) => joint.node === node);
            if (oldJoint) {
                joints.push(oldJoint);
            } else {
                const joint = new Joint();
                joint.node = node;
                joints.push(joint);
            }
        });
    }

    @cc._decorator.property({
        type: [Joint],
        displayName: '关节',
    })
    public joints: Joint[] = [];

    public resolve(
        endFactor: cc.Node,
        target: cc.math.Vec3,
    ) {
        const {
            algorithm,
            maxError,
            maxIterations,
            root,
            joints,
            angularLimits,
            angleDelta,
        } = this;

        if (!root) {
            return;
        }

        const links = pathTo(endFactor, root);
        const nLinks = links.length;

        if (nLinks === 0) {
            // endFactor === root
            return;
        }

        if (links[nLinks - 1] !== root) {
            if (DEBUG) {
                cc.debug(`The end factor is not in CCD skeleton.`);
            }
            return;
        }

        const linkConstraints = links.map((link) => joints.find(({ node }) => node === link));

        switch (algorithm) {
            default:
            case AlgorithmType.BACKWARD: {
                for (let iIteration = 0; iIteration < maxIterations; ++iIteration) {
                    for (let iLink = 0; iLink < nLinks; ++iLink) {
                        const finished = correct(iLink);
                        if (finished) {
                            if (DEBUG) {
                                cc.debug(
                                    `[CCD IK]: Successfully resolved. ` +
                                    `Algorithm: ${AlgorithmType[algorithm]}; ` +
                                    `Iterations: ${iIteration}; ` +
                                    `Link: ${iLink}`
                                );
                            }
                            return;
                        }
                    }
                }
                break;
            }

            case AlgorithmType.FORWARD: {
                for (let iIteration = 0; iIteration < maxIterations; ++iIteration) {
                    for (let iLink = nLinks - 1; iLink >= 0; --iLink) {
                        const finished = correct(iLink);
                        if (finished) {
                            if (DEBUG) {
                                cc.debug(
                                    `[CCD IK]: Successfully resolved. ` +
                                    `Algorithm: ${AlgorithmType[algorithm]}; ` +
                                    `Iterations: ${iIteration}; ` +
                                    `Link: ${iLink}`
                                );
                            }
                            return;
                        }
                    }
                }
                break;
            }

            case AlgorithmType.BACKWARD_BOUNCE: {
                for (let iIteration = 0; iIteration < maxIterations; ++iIteration) {
                    for (let iBounceLink = 0; iBounceLink < nLinks; ++iBounceLink) {
                        for (let iLink = 0; iLink <= iBounceLink; ++iLink) {
                            const finished = correct(iLink);
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
                                return;
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

        function correct(linkIndex: number) {
            const link = links[linkIndex];
            const linkConstraint = linkConstraints[linkIndex];
            const linkPosition = link.getWorldPosition();
            const endFactorPosition = endFactor.getWorldPosition();
            const u = cc.math.Vec3.subtract(
                new cc.math.Vec3(),
                endFactorPosition,
                linkPosition,
            );
            const v = cc.math.Vec3.subtract(
                new cc.math.Vec3(),
                target,
                linkPosition,
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
            const rotation = cc.math.Quat.fromAxisAngle(
                new cc.math.Quat(),
                axis,
                correctiveAngle,
            );
            if (cc.Quat.equals(rotation, cc.math.Quat.IDENTITY)) {
                // debugger;
            }
            const newRotation = cc.math.Quat.multiply(
                new cc.math.Quat(),
                rotation,
                link.getWorldRotation(),
            );
            cc.math.Quat.normalize(newRotation, newRotation);
            if (cc.Quat.equals(newRotation, new cc.math.Quat(0, 0, 0, 0))) {
                // debugger;
            }
            link.setWorldRotation(newRotation);
            if (cc.Quat.equals(link.getWorldRotation(), new cc.math.Quat(0, 0, 0, 0))) {
                // debugger;
            }

            endFactor.getWorldPosition(endFactorPosition);
            const distance = cc.math.Vec3.distance(
                endFactorPosition,
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

    @cc._decorator.property(cc.Node)
    private _root: cc.Node | null = null;
}

function pathTo(node: cc.Node, to: cc.Node) {
    const result: cc.Node[] = [];
    if (node === to) {
        return result;
    }
    for (let current: cc.Node | null = node.parent; current; current = current.parent) {
        result.push(current);
        if (current === to) {
            break;
        }
    }
    return result;
}
