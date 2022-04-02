import * as cc from 'cc';
import { DEBUG, EDITOR } from 'cc/env';
import { ConstraintType, JointConstraint } from '../Constraint';
import { EulerAngleOrder, eulerAnglesToQuat, quatMultiply, Range } from '../Util/Math';
// import { rigEditorInterop } from 'db://marionette_prototyping_ik/rig-editor-interop';
import { Avatar, Vector3, Quaternion } from '../Demo/Avatar';
import { IKResolver } from './IKResolver';
import { SkeletonRenderer } from '../Debug/SkeletonRenderer';
import { LineRenderer } from '../Debug/LineRenderer';
import HumanTrait from '../Demo/HumanTrait.json';
import { fromAxes } from './HumanUtil';

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
export class Joint {
    constructor(node?: cc.Node) {
        if (node) {
            this.name = node.name;
            this.node = node;
        }
    }

    @cc._decorator.property({
        displayName: '骨骼名称',
    })
    name = '';

    @cc._decorator.property({
        visible: false,
    })
    children: Joint[] = [];

    get node() {
        return this._node;
    }

    set node(value) {
        this._node = value;
        cc.math.Quat.copy(this._initialLocalRotation, value.getRotation());
        cc.math.Vec3.copy(this._originalPose.position, value.getPosition());
        cc.math.Quat.copy(this._originalPose.rotation, value.getRotation());
        cc.math.Vec3.copy(this._originalPose.scale, value.getScale());
    }

    get parent() {
        return this._parent;
    }

    set parent(value) {
        if (this._parent) {
            this._parent.children.splice(
                this._parent.children.indexOf(this),
                1,
            );
        }
        this._parent = value;
        if (value) {
            value.children.push(this);
        }
    }

    @cc._decorator.property({
        type: JointConstraint,
        displayName: '约束',
    })
    constraint: JointConstraint = new JointConstraint();

    get initialLocalRotation(): Readonly<cc.math.Quat> {
        return this._initialLocalRotation;
    }

    set initialLocalRotation(value) {
        cc.math.Quat.copy(this._initialLocalRotation, value);
    }

    get inverseInitialLocalRotation() {
        return cc.math.Quat.invert(new cc.math.Quat(), this._initialLocalRotation);
    }

    get originalLocalRotation(): Readonly<cc.math.Quat> {
        return this._originalPose.rotation;
    }

    get position() {
        return this._node.worldPosition;
    }

    get rotation() {
        return this._node.worldRotation;
    }

    get localRotation() {
        return this._node.rotation;
    }

    set localRotation(value) {
        this._node.rotation = value;
    }

    get parentRotation() {
        return this._parent ? this._parent.rotation : this._node.worldRotation;
    }

    @cc._decorator.property({
        visible: false,
    })
    public runtimeLocalPosition = new cc.math.Vec3();

    @cc._decorator.property({
        visible: false,
    })
    public runtimeRotation = new cc.math.Quat();

    @cc._decorator.property({
        visible: false,
    })
    public runtimeScale = new cc.math.Vec3();

    public reset() {
        const { node, _originalPose: original } = this;
        if (!node) {
            return;
        }
        node.setPosition(original.position);
        node.setRotation(original.rotation);
        node.setScale(original.scale);
    }

    public resetToLimitInitialPose() {
        const { node, _originalPose: original } = this;
        if (!node) {
            return;
        }
        // node.setPosition(original.position);
        // node.setRotation(this._initialLocalRotation);
        // node.setScale(original.scale);
        // node.setPosition(this._originalPose.position.x, this._originalPose.position.y, -this._originalPose.position.z);
        node.setRotation(this.runtimeRotation);
        // node.setScale(this.runtimeScale);
    }

    public onAfterSerialized() {
        this.node = this._node;
        for (const child of this.children) {
            child._parent = this;
        }
    }

    private _parent: Joint | null = null;

    @cc._decorator.property
    private _initialLocalRotation = new cc.math.Quat();

    @cc._decorator.property({
        visible: false,
    })
    private _node: cc.Node = null!;

    private _originalPose: {
        position: cc.math.Vec3;
        rotation: cc.math.Quat;
        scale: cc.math.Vec3;
    } = {
        position: new cc.math.Vec3(),
        rotation: new cc.math.Quat(),
        scale: new cc.math.Vec3(),
    };
}

function* visitJoint(root: Joint): Generator<Joint> {
    yield root;
    for (const child of root.children) {
        for (const c of visitJoint(child)) {
            yield c;
        }
    }
}

export enum CCDIKErrorCode {
    NO_ERROR = 0,

    BAD_ARGUMENT = 1,

    TOO_MANY_ATTEMPTS,
}

@cc._decorator.ccclass('CCDIK')
export class CCDIKResolver extends IKResolver {
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
        displayName: '骨架根关节',
    })
    get skeletonRoot() {
        return this._skeletonRoot?.node ?? null;
    }

    set skeletonRoot(value) {
        this._skeletonRoot = null;
        this._ikRoot = null;
        if (!value) {
            cc.log(`Skeleton has been cleared.`);
            return;
        }
        const nodeJointMap = new Map<cc.Node, Joint>();
        let nJoints = 0;
        value.walk((node) => {
            const joint = new Joint(node);
            nodeJointMap.set(node, joint);
            if (node === value) {
                this._skeletonRoot = joint;
                this._ikRoot = joint;
            }
            const nodeParent = node.parent;
            if (nodeParent) {
                const jointParent = nodeJointMap.get(nodeParent);
                if (jointParent) {
                    joint.parent = jointParent;
                }
            }
            ++nJoints;
        });
        cc.log(
            `Skeleton has been reconstructed from root ${value.name}. ` +
            `${nJoints} joints were added. ` +
            `${value.name} was also set as IK root.`);
    }

    @cc._decorator.property({
        displayName: '编辑',
    })
    get edit() {
        return true;
    }

    set edit(_value) {
        // const { _skeletonRoot: skeletonRoot } = this;
        // const joints: Joint[] = [];
        // if (skeletonRoot) {
        //     for (const joint of visitJoint(skeletonRoot)) {
        //         joints.push(joint);
        //     }
        // }

        // const param: RigEditorEditParam = {
        //     rig: {
        //         joints: joints.map((joint) => {
        //             return {
        //                 name: joint.name,
        //                 parent: joint.parent ? joints.findIndex((parent) => parent === joint.parent) : -1,
        //                 rotationLimitX: joint.constraint.constraints[0].range,
        //                 rotationLimitY: joint.constraint.constraints[1].range,
        //                 rotationLimitZ: joint.constraint.constraints[2].range,
        //             };
        //         }),
        //     },
        // };
        // rigEditorInterop?.edit(this, param, (jointId, onJointPropertiesChangedParam) => {
        //     const id = jointId;
        //     joints[id].constraint.constraints[0].range = onJointPropertiesChangedParam.rotationLimitX;
        //     joints[id].constraint.constraints[1].range = onJointPropertiesChangedParam.rotationLimitY;
        //     joints[id].constraint.constraints[2].range = onJointPropertiesChangedParam.rotationLimitZ;
        // });
    }

    @cc._decorator.property(cc.JsonAsset)
    public unityAvatar: cc.JsonAsset | null = null;

    @cc._decorator.property({
        displayName: '从 Unity Avatar 配置',
    })
    get configureFromUnityAvatar() {
        return false;
    }

    set configureFromUnityAvatar(_value) {
        if (!this.unityAvatar) {
            cc.error(`Unity avatar is not set!`);
        } else {
            this._configureFromUnityAvatar(this.unityAvatar.json as Avatar);
        }
    }

    @cc._decorator.property(SkeletonRenderer)
    public renderer: SkeletonRenderer | null = null;

    @cc._decorator.property(cc.Material)
    public debugLineMaterial: cc.Material | null = null;

    public onLoad() {
        const { _skeletonRoot: skeletonRoot } = this;
        if (!skeletonRoot) {
            return;
        }
        for (const joint of visitJoint(skeletonRoot)) {
            joint.onAfterSerialized();
        }
        if (!EDITOR) {
            this.configureFromUnityAvatar = true;
        }
    }

    public *resolve(
        endFactor: cc.Node,
        target: cc.math.Vec3,
    ): Generator<void, CCDIKErrorCode> {
        const {
            _ikRoot: root,
        } = this;

        if (!root) {
            cc.error(`The skeleton is empty.`);
            return CCDIKErrorCode.BAD_ARGUMENT;
        }

        const endFactorJoint = (() => {
            for (const joint of visitJoint(root)) {
                if (joint.node === endFactor) {
                    return joint;
                }
            }
            return null;
        })();

        if (!endFactorJoint) {
            cc.error(`${endFactor.name} is not an IK joint.`);
            return CCDIKErrorCode.BAD_ARGUMENT;
        }

        const links = pathTo(endFactorJoint, root);
        let nLinks = links.length;

        if (nLinks === 0) {
            // endFactor === root
            cc.error(`The end factor shall not be IK root.`);
            return CCDIKErrorCode.BAD_ARGUMENT;
        }

        if (links[nLinks - 1] !== root) {
            if (DEBUG) {
                cc.error(`The end factor is not in CCD skeleton.`);
            }
            return CCDIKErrorCode.BAD_ARGUMENT;
        }

        if (this.renderer) {
            this.renderer.setJointColor(endFactorJoint.name, cc.Color.BLACK);
            const chainColor = cc.Color.GREEN;
            this.renderer.setBoneColor(endFactorJoint.name, chainColor);
            for (const link of links) {
                this.renderer.setBoneColor(link.name, chainColor);
            }
        }

        // The root is immutable.
        links.pop();
        --nLinks;

        const debugContext = this.debugLineMaterial ? new CCDDebugContext(this.node, this.debugLineMaterial) : undefined;
        const resolution = this._solveChain(endFactorJoint, links, target, debugContext);
        let next;
        while (!(next = resolution.next()).done) {
            yield;
        }
        if (debugContext) {
            debugContext.destroy();
        }

        if (this.renderer) {
            this.renderer.resetBoneColor(endFactorJoint.name);
            this.renderer.resetBoneColor(endFactorJoint.name);
            for (const link of links) {
                this.renderer.resetBoneColor(link.name);
            }
        }

        return next.value;
    }

    public revert() {
        const { _skeletonRoot: skeletonRoot } = this;
        if (!skeletonRoot) {
            return;
        }
        for (const joint of visitJoint(skeletonRoot)) {
            joint.reset();
        }
    }

    public resetToLimitInitialPose() {
        const { _skeletonRoot: skeletonRoot } = this;
        if (!skeletonRoot) {
            return;
        }
        for (const joint of visitJoint(skeletonRoot)) {
            joint.resetToLimitInitialPose();
        }
    }

    @cc._decorator.property
    private _skeletonRoot: Joint | null = null;

    @cc._decorator.property
    private _ikRoot: Joint | null = null;

    private *_solveChain(
        endFactor: Joint,
        chain: Joint[],
        target: Readonly<cc.math.Vec3>,
        debugContext?: CCDDebugContext,
    ): Generator<void, CCDIKErrorCode> {
        const {
            algorithm,
            maxError,
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
                            return CCDIKErrorCode.NO_ERROR;
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
                            return CCDIKErrorCode.NO_ERROR;
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
                                return CCDIKErrorCode.NO_ERROR;
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

        return CCDIKErrorCode.TOO_MANY_ATTEMPTS;

        function drawIteration(linkIndex: number) {
            if (!debugContext) {
                return;
            }
            const link = chain[linkIndex];
            debugContext.drawIteration(endFactor.position, target, link.position);
        }

        function correct(this: CCDIKResolver, linkIndex: number) {
            if (this.renderer) {
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

    private _configureFromUnityAvatar(avatar: Avatar) {
        const { _skeletonRoot: skeletonRoot } = this;

        const findJoint = (name: string) => {
            if (!skeletonRoot) {
                return null;
            }
            for (const joint of visitJoint(skeletonRoot)) {
                if (joint.name === name) {
                    return joint;
                }
            }
            return null;
        };

        for (const {
            humanName,
            boneName,
            limit,
        } of avatar.humanDescription.human) {
            const skeletonBone = avatar.humanDescription.skeleton.find((skeletonBone) => skeletonBone.name === boneName);
            if (!skeletonBone) {
                console.warn(`The skeleton bone(${boneName}) of Human bone ${humanName} is not found in Unity.`);
                continue;
            }
            const joint = findJoint(boneName);
            if (!joint) {
                console.warn(`The skeleton bone(${boneName}) of Human bone ${humanName} is not found in Creator.`);
                continue;
            }

            const humanBoneTrait = HumanTrait.bones.find(({ name }) => humanName === name);
            if (!humanBoneTrait) {
                console.warn(`Can not find the human trait on skeleton bone(${boneName}) of Human bone ${humanName}`);
                continue;
            }

            const avatarBone = avatar.avatarBones.find(({ name }) => name === humanName);
            if (!avatarBone) {
                console.warn(`Can not find the avatar bone on skeleton bone(${boneName}) of Human bone ${humanName}`);
                continue;
            }

            const getBoneRotation = () => {
                const convertUnityRotation = (unityRotation: Quaternion) => {
                    const uEuler = cc.math.Quat.toEuler(new cc.math.Vec3(), unityRotation);
                    return cc.math.Quat.fromEuler(new cc.math.Quat(), uEuler.x, uEuler.y, uEuler.z);
                };

                const unityEulerAnglesToCreatorQuat = (unityEulerAngles: Vector3) => {
                    // return cc.math.Quat.fromEuler(new cc.math.Quat(), unityEulerAngles.x, unityEulerAngles.y, -unityEulerAngles.z);
                    const result = eulerAnglesToQuat(unityEulerAngles.x, unityEulerAngles.y, unityEulerAngles.z, EulerAngleOrder.ZXY);
                    const pre = cc.math.Mat3.fromScaling(new cc.math.Mat3(), new cc.math.Vec3(1.0, 1.0, -1.0));
                    const invPre = cc.math.Mat3.invert(new cc.math.Mat3(), pre);
                    const r = cc.math.Mat3.fromQuat(new cc.math.Mat3(), result);
                    const m = new cc.math.Mat3();
                    cc.math.Mat3.multiply(m, r, invPre);
                    cc.math.Mat3.multiply(m, pre, m);
                    cc.math.Quat.fromMat3(result, m);
                    return result;
                };

                const localRotation = new cc.math.Quat();
                const hasAxis = true;
                if (!hasAxis) {
                } else {
                    const preRotation = convertUnityRotation(avatarBone.preRotation);
                    const postRotation = convertUnityRotation(avatarBone.postRotation);
                    const limitSign = avatarBone.limitSign;
                    cc.Quat.normalize(preRotation, preRotation);
                    cc.Quat.normalize(postRotation, postRotation);
                    const axisUnProject = (q: cc.math.Quat) => {
                        return quatMultiply(localRotation, preRotation, q, cc.math.Quat.conjugate(
                            localRotation,
                            postRotation,
                        ));
                    };
                    const muscleX = humanBoneTrait.muscleEnabled[0] ? cc.math.lerp(limit.min.x, limit.max.x, 0.5) : 0;
                    const muscleY = humanBoneTrait.muscleEnabled[1] ? cc.math.lerp(limit.min.y, limit.max.y, 0.5) : 0;
                    const muscleZ = humanBoneTrait.muscleEnabled[2] ? cc.math.lerp(limit.min.z, limit.max.z, 0.5) : 0;
                    // const uvw = cc.math.Vec3.multiply(
                    //     new cc.math.Vec3(), new cc.math.Vec3(muscleX, muscleY, muscleZ), limitSign);
                    // const q = eulerAnglesToQuat(uvw.x, uvw.y, uvw.z, EulerAngleOrder.XYZ);
                    // // const q2 = (() => {
                    // //     const twistAxis = new cc.math.Vec3(0.0, uvw.y, uvw.z);
                    // //     const twistAngle = cc.math.Vec3.len(twistAxis);
                    // //     cc.math.Vec3.normalize(twistAxis, twistAxis);
                    // //     const qTwist = cc.math.Quat.fromAxisAngle(new cc.math.Quat(), twistAxis, twistAngle);
                    // //     const qSwing = cc.math.Quat.fromAxisAngle(new cc.math.Quat(), cc.Vec3.UNIT_X, uvw.x);
                    // //     return cc.math.Quat.multiply(
                    // //         new cc.math.Quat(),
                    // //         qTwist,
                    // //         qSwing,
                    // //     );
                    // // })();
                    // axisUnProject(q);
                    // cc.math.Quat.normalize(localRotation, localRotation);
                    return fromAxes(
                        { preRotation, postRotation, sign: cc.Vec3.clone(limitSign), limit: {
                            min: new cc.math.Vec3(cc.toRadian(limit.min.x), cc.toRadian(limit.min.y), cc.toRadian(limit.min.z)),
                            max: new cc.math.Vec3(cc.toRadian(limit.max.x), cc.toRadian(limit.max.y), cc.toRadian(limit.max.z)),
                        } },
                        new cc.math.Vec3(muscleX, muscleY, muscleZ),
                    );
                }
                // return unityEulerAnglesToCreatorQuat(avatarBone.instanceRotations[0]);
                return localRotation;
            };

            cc.Quat.copy(joint.runtimeRotation, getBoneRotation());
            // positionUnityToCreator(joint.runtimeLocalPosition, skeletonBone.position);
            // quatUnityToCreator(joint.runtimeRotation, skeletonBone.rotation);
            // scaleUnityToCreator(joint.runtimeScale, skeletonBone.scale);

            const { x: centerX, y: centerY, z: centerZ } = eulerAnglesUnityToCreator(limit.center);
            joint.initialLocalRotation = cc.math.Quat.multiply(
                new cc.math.Quat(),
                cc.Quat.fromEuler(new cc.math.Quat(), centerY, centerZ, centerX),
                joint.originalLocalRotation,
            );
            joint.constraint.constraintType = ConstraintType.Y_Z_X;
            const { x: minX, y: minY, z: minZ } = eulerAnglesUnityToCreator(limit.min);
            const { x: maxX, y: maxY, z: maxZ } = eulerAnglesUnityToCreator(limit.max);
            joint.constraint.constraints[0].range.min = minY;
            joint.constraint.constraints[0].range.max = maxY;
            joint.constraint.constraints[1].range.min = minZ;
            joint.constraint.constraints[1].range.max = maxZ;
            joint.constraint.constraints[2].range.min = minX;
            joint.constraint.constraints[2].range.max = maxX;
        }

        function eulerAnglesUnityToCreator(vector: Vector3) {
            return new cc.math.Vec3(
                vector.x,
                vector.y,
                -vector.z,
            );
        }

        function positionUnityToCreator(c: cc.math.Vec3, u: Vector3) {
            return cc.math.Vec3.set(c,
                u.x,
                u.y,
                u.z,
            );
        }

        function scaleUnityToCreator(c: cc.math.Vec3, u: Vector3) {
            return cc.math.Vec3.set(c,
                u.x,
                u.y,
                u.z,
            );
        }

        function quatUnityToCreator(c: cc.math.Quat, u: Quaternion) {
            const uEuler = cc.math.Quat.toEuler(new cc.math.Vec3(), u);
            const cEuler = eulerAnglesUnityToCreator(uEuler);
            return cc.math.Quat.fromEuler(c, uEuler.x, uEuler.y, uEuler.z);
        }
    }
}

function pathTo(node: Joint, to: Joint) {
    const result: Joint[] = [];
    if (node === to) {
        return result;
    }
    for (let current: Joint | null = node.parent; current; current = current.parent) {
        result.push(current);
        if (current === to) {
            break;
        }
    }
    return result;
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
