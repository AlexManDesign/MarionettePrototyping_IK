import * as cc from 'cc';
import { DEBUG } from 'cc/env';
import { Joint } from './CCD';
import { IKResolver } from './IKResolver';

@cc._decorator.ccclass('FABRIKJoint')
class FABRIKJoint {
    constructor(parent?: FABRIKJoint) {
        this._parent = parent ?? null;
        if (parent) {
            this._mathNode.parent = parent._mathNode;
        }
    }

    get parent() {
        return this._parent;
    }

    set parent(value) {
        this._parent = value;
        this._mathNode.parent = value?._mathNode ?? null;
    }

    /**
     * The scene node this joint associated with.
     */
    public sceneNode: cc.Node | null = null;

    /**
     * The distance between the joint and its parent joint.
     */
    get linkLength(): number {
        return this._linkLength;
    }

    public getWorldPosition(): Readonly<cc.math.Vec3> {
        return this._mathNode.getWorldPosition();
    }

    public setWorldPosition(value: Readonly<cc.math.Vec3>) {
        this._mathNode.setWorldPosition(value);
    }

    private _parent: FABRIKJoint | null = null;
    private _mathNode = new cc.Node();
    private _worldPosition = new cc.math.Vec3();
    private _worldRotation = new cc.math.Quat();
    private _worldScale = new cc.math.Vec3();
    private _localPosition = new cc.math.Vec3();
    private _localRotation = new cc.math.Quat();
    private _localScale = new cc.math.Vec3();
    private _linkLength = 0.0;
}

@cc._decorator.ccclass('FABRIK')
export class FABRIK extends IKResolver {
    @cc._decorator.property({
        displayName: '允许的误差',
    })
    public maxError = 1e-5;

    @cc._decorator.property({
        displayName: '最大迭次次数',
    })
    public maxIterations = 32;

    @cc._decorator.property({
        type: FABRIKJoint,
        displayName: '从场景结点创建',
    })
    get createFromSceneNode() {
        return this._root?.sceneNode ?? null;
    }

    set createFromSceneNode(value) {
        this._root = null;
        this.joints.length = 0;
        this.joints = [];
        this._originalPose = [];

        value?.walk((node) => {
            const joint = new FABRIKJoint();
            joint.sceneNode = node;
            this.joints.push(joint);
            this._originalPose.push(this._dumpJointPose(node));
        });
    }

    @cc._decorator.property({
        type: [Joint],
        displayName: '关节',
    })
    public joints: FABRIKJoint[] = [];

    public resolve(
        endFactor: FABRIKJoint,
        target: cc.math.Vec3,
    ) {
        const {
            _root: root,
            maxIterations,
            maxError,
        } = this;

        if (!root) {
            return false;
        }

        const joints = this._getChain(endFactor, root);
        const nLinks = joints.length;

        if (nLinks === 0) {
            // endFactor === root
            return false;
        }

        const rootPosition = cc.math.Vec3.copy(new cc.math.Vec3(), joints[nLinks - 1].getWorldPosition());

        const chainLength = joints.reduce((result, joint) => result += joint.linkLength, 0.0);
        const distanceRootToTarget = cc.math.Vec3.distance(joints[nLinks - 1].getWorldPosition(), target);
        if (distanceRootToTarget > chainLength) {
            cc.debug(`The end factor is far from root, which exceeds the chain length.`);
            return false;
        }

        const isReached = () => {
            const distance = cc.math.Vec3.distance(endFactor.getWorldPosition(), target);
            return distance < maxError;
        };

        for (let iIteration = 0;
            isReached() || iIteration < maxIterations;
            ++iIteration
        ) {
            const endFactor = joints[0];

            // EndFactor -> Root
            endFactor.setWorldPosition(target);
            for (let iLink = 1; iLink < nLinks; ++iLink) {
                const currentJoint = joints[iLink];
                const childJoint = joints[iLink - 1];
                this._moveJoint(
                    currentJoint,
                    childJoint,
                    childJoint.linkLength,
                );
            }

            // Root -> EndFactor
            root.setWorldPosition(rootPosition);
            for (let iLink = nLinks - 2; iLink > 0; --iLink) {
                const currentJoint = joints[iLink];
                const parentJoint = joints[iLink + 1];
                this._moveJoint(
                    currentJoint,
                    parentJoint,
                    currentJoint.linkLength,
                );
            }
        }

        return false;
    }

    @cc._decorator.property(FABRIKJoint)
    private _root: FABRIKJoint | null = null;

    private _originalPose: {
        t: cc.math.Vec3;
        r: cc.math.Quat;
        s: cc.math.Vec3;
    }[] = [];

    private _getChain(from: FABRIKJoint, to: FABRIKJoint) {
        const result: FABRIKJoint[] = [];
        if (from === to) {
            return result;
        }
        for (let current: FABRIKJoint | null = from.parent; current; current = current.parent) {
            result.push(current);
            if (current === to) {
                break;
            }
        }
        return result;
    }

    private _moveJoint(target: FABRIKJoint, fixed: FABRIKJoint, distance: number) {
        const objectJointPosition = target.getWorldPosition();
        const fixedJointPosition = fixed.getWorldPosition();
        const direction = cc.math.Vec3.subtract(
            new cc.math.Vec3(),
            objectJointPosition,
            fixedJointPosition,
        );
        cc.math.Vec3.normalize(direction, direction);
        const newPosition = cc.math.Vec3.scaleAndAdd(
            new cc.math.Vec3(),
            fixedJointPosition,
            direction,
            distance,
        );
        target.setWorldPosition(newPosition);
    }

    private _dumpJointPose(node: cc.Node) {
        const pose: FABRIK['_originalPose'][0] = {
            t: cc.math.Vec3.clone(node.getPosition()),
            r: cc.math.Quat.clone(node.getRotation()),
            s: cc.math.Vec3.clone(node.getScale()),
        };

        return pose;
    }
}
