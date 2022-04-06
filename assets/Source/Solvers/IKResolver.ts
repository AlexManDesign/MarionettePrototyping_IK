import * as cc from 'cc';
import { Joint, visitJoint } from './Skeleton';
import { DEBUG, EDITOR } from 'cc/env';
import { ConstraintType, JointConstraint } from '../Constraint';
import { EulerAngleOrder, eulerAnglesToQuat, quatMultiply, Range } from '../Util/Math';
// import { rigEditorInterop } from 'db://marionette_prototyping_ik/rig-editor-interop';
import { Avatar, Vector3, Quaternion, HumanLimit } from '../Demo/Avatar';
import { SkeletonRenderer } from '../Debug/SkeletonRenderer';
import { LineRenderer } from '../Debug/LineRenderer';
import HumanTrait from '../Demo/HumanTrait.json';
import { fromAxes } from './HumanUtil';
import { CCDIKResolver } from './CCD';
import { FABRIK } from './FABRIK';
import { ErrorCode } from './ResolverBase';

export enum ResolverType {
    CCD,

    FABRIK,
}

cc.ccenum(ResolverType);

@cc._decorator.ccclass('IKResolver')
export abstract class IKResolver extends cc.Component {
    @cc._decorator.property({
        displayName: '允许的误差',
    })
    public maxError = 0.001;

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

    @cc._decorator.property(SkeletonRenderer)
    public renderer: SkeletonRenderer | null = null;

    @cc._decorator.property(cc.Material)
    public debugLineMaterial: cc.Material | null = null;

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

    @cc._decorator.property({
        type: ResolverType,
        displayName: '解析器类型',
    })
    public resolverType = ResolverType.CCD;

    @cc._decorator.property({
        visible: function(this: IKResolver) {
            return this.resolverType === ResolverType.CCD;
        },
    })
    public ccd = new CCDIKResolver();

    @cc._decorator.property({
        visible: function(this: IKResolver) {
            return this.resolverType === ResolverType.FABRIK;
        },
    })
    public fabrik = new FABRIK();

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

    public *resolve(endFactor: cc.Node, target: cc.math.Vec3): Generator<void, ErrorCode> {
        const {
            _ikRoot: root,
        } = this;

        const resolver = this.resolverType === ResolverType.CCD
            ? this.ccd
            : this.fabrik;

        if (!root) {
            cc.error(`The skeleton is empty.`);
            return ErrorCode.BAD_ARGUMENT;
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
            return ErrorCode.BAD_ARGUMENT;
        }

        const links = pathTo(endFactorJoint, root);
        let nLinks = links.length;

        if (nLinks === 0) {
            // endFactor === root
            cc.error(`The end factor shall not be IK root.`);
            return ErrorCode.BAD_ARGUMENT;
        }

        if (links[nLinks - 1] !== root) {
            if (DEBUG) {
                cc.error(`The end factor is not in CCD skeleton.`);
            }
            return ErrorCode.BAD_ARGUMENT;
        }

        if (this.renderer) {
            this.renderer.setJointColor(endFactorJoint.name, cc.Color.BLACK);
            const chainColor = cc.Color.GREEN;
            this.renderer.setBoneColor(endFactorJoint.name, chainColor);
            for (const link of links) {
                this.renderer.setBoneColor(link.name, chainColor);
            }
        }

        yield;

        const solveResult = yield* resolver.solveChain(
            endFactorJoint,
            links,
            target,
            this.maxError,
            {
                debugLineMaterial: this.debugLineMaterial,
                node: this.node,
                renderer: this.renderer,
            },
        );

        if (this.renderer) {
            this.renderer.resetBoneColor(endFactorJoint.name);
            this.renderer.resetBoneColor(endFactorJoint.name);
            for (const link of links) {
                this.renderer.resetBoneColor(link.name);
            }
        }

        return solveResult;
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

            cc.Quat.copy(joint.runtimeRotation, getBoneRotation(
                avatarBone,
                humanBoneTrait,
                limit,
            ));

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

        function getBoneRotation(
            avatarBone: Avatar['avatarBones'][0],
            humanBoneTrait: (typeof HumanTrait.bones)[0],
            limit: HumanLimit,
        ) {
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
                const muscleX = humanBoneTrait.muscleEnabled[0] ? cc.math.lerp(limit.min.x, limit.max.x, 0.5) : 0;
                const muscleY = humanBoneTrait.muscleEnabled[1] ? cc.math.lerp(limit.min.y, limit.max.y, 0.5) : 0;
                const muscleZ = humanBoneTrait.muscleEnabled[2] ? cc.math.lerp(limit.min.z, limit.max.z, 0.5) : 0;
                return fromAxes(
                    {
                        preRotation,
                        postRotation,
                        sign: cc.Vec3.clone(limitSign),
                        limit: {
                            min: new cc.math.Vec3(cc.toRadian(limit.min.x), cc.toRadian(limit.min.y), cc.toRadian(limit.min.z)),
                            max: new cc.math.Vec3(cc.toRadian(limit.max.x), cc.toRadian(limit.max.y), cc.toRadian(limit.max.z)),
                        },
                    },
                    new cc.math.Vec3(cc.toRadian(muscleX),  cc.toRadian(muscleY), cc.toRadian(muscleZ)),
                );
            }
            // return unityEulerAnglesToCreatorQuat(avatarBone.instanceRotations[0]);
            return localRotation;
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
