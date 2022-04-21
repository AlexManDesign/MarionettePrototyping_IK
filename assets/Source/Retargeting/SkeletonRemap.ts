import * as cc from 'cc';
import { globalRigHub_ } from './RigHub';

export enum TranslationRemapMode {
    ANIMATION,

    SKELETON,

    PROPORTIONAL_ANIMATION,
}

cc.ccenum(TranslationRemapMode);

@cc._decorator.ccclass('RemapPatternSetOriginal')
class RemapPatternSetOriginal {
    @cc._decorator.property
    public target = '';

    @cc._decorator.property
    public original = '';

    @cc._decorator.property({ type: TranslationRemapMode })
    public translationRemapMode: TranslationRemapMode = TranslationRemapMode.SKELETON;
}

@cc._decorator.ccclass('RemapPatternSetTranslationRemapMode')
class RemapPatternSetTranslationRemapMode {
    @cc._decorator.property
    public target = '';

    @cc._decorator.property({ type: TranslationRemapMode })
    public translationRemapMode: TranslationRemapMode = TranslationRemapMode.SKELETON;
}

type TranslationRemapModeInCommand = 'skeleton' | 'animation' | 'proportional-animation';

function interpretTranslationRemapModeInCommand(mode: TranslationRemapModeInCommand) {
    switch (mode) {
        case 'skeleton': return TranslationRemapMode.SKELETON;
        case 'animation': return TranslationRemapMode.ANIMATION;
        case 'proportional-animation': return TranslationRemapMode.PROPORTIONAL_ANIMATION;
    }
}

export type RemapCommand = {
    type: 'set-original';
    target: string;
    original: string;
    mode?: TranslationRemapModeInCommand;
} | {
    type: 'set-translation-remap-mode',
    target: string;
    mode: TranslationRemapModeInCommand;
};

@cc._decorator.ccclass('SkeletonRemap')
export class SkeletonRemap extends cc.Component {
    @cc._decorator.property([cc.Skeleton])
    get originals() {
        return this._originals;
    }

    set originals(value) {
        this._originals = value;
        this._updateMaps();
    }

    @cc._decorator.property([cc.Skeleton])
    get targets() {
        return this._targets;
    }

    set targets(value) {
        this._targets = value;
        this._updateMaps();
    }
    
    @cc._decorator.property(cc.JsonAsset)
    get commands() {
        return this._commands;
    }

    set commands(value) {
        this._commands = value;
        this._updateMaps();
    }

    onLoad() {
        this._updateMaps();
    }

    public createRemappedJoint(targetJointPath: string): RemappedJoint | null {
        if (!(targetJointPath in this._maps)) {
            return null;
        }

        const {
            originalJointPath,
            originalSkeletonIndex,
            originalJointIndex,
            targetSkeletonIndex,
            targetJointIndex,
            translationRemapMode,
        } = this._maps[targetJointPath];

        const originalSkeleton = this.originals[originalSkeletonIndex];
        const originalJointRefTranslation = getSkeletonBoneTranslation(originalSkeleton, originalJointIndex);
        const originalJoint = this.node.getChildByPath(originalJointPath);
        if (!originalJoint) {
            cc.error(`Can not find original joint ${originalJointPath}`);
            return null;
        }

        const targetSkeleton = this.targets[targetSkeletonIndex];
        const targetJointRefTranslation = getSkeletonBoneTranslation(targetSkeleton, targetJointIndex);
        const targetJointRefLocalTranslation = getSkeletonBoneLocalTranslation(targetSkeleton, targetJointIndex);

        const remappedJoint = new RemappedJoint(
            originalJoint,
            translationRemapMode,
            targetJointRefTranslation,
            targetJointRefLocalTranslation,
            originalJointRefTranslation,
        );
        return remappedJoint;
    }

    // @cc._decorator.property
    private _maps: Record<string, JointRemapSetting> = {};

    @cc._decorator.property
    private _originals: cc.Skeleton[] = [];

    @cc._decorator.property
    private _targets: cc.Skeleton[] = [];

    @cc._decorator.property(cc.JsonAsset)
    private _commands: cc.JsonAsset | null = null;

    private _updateMaps() {
        this._maps = {};

        const {
            _originals: originalSkeletons,
            _targets: targetSkeletons,
            _maps: maps,
            _commands: commandJson,
        } = this;

        if (!commandJson) {
            return;
        }

        const commands = commandJson.json as RemapCommand[];

        const findOriginalBone = (path: string) => {
            return findBoneInSkeletons(originalSkeletons, path);  
        };

        const nTargetSkeletons = targetSkeletons.length;
        for (const command of commands) {
            const targetRegex = new RegExp(command.target, 'g');
            for (let iTargetSkeleton = 0; iTargetSkeleton < nTargetSkeletons; ++iTargetSkeleton) {
                const targetSkeleton = targetSkeletons[iTargetSkeleton];
                for (let iTargetJoint = 0; iTargetJoint < targetSkeleton.joints.length; ++iTargetJoint) {
                    const targetJointPath = targetSkeleton.joints[iTargetJoint];
                    switch (command.type) {
                        case 'set-original': {
                            const originalJointPath = targetJointPath.replace(targetRegex, command.original);
                            const originalBoneInfo = findOriginalBone(originalJointPath);
                            if (!originalBoneInfo) {
                                continue;
                            } else {
                                maps[targetJointPath] = {
                                    originalJointPath,
                                    originalSkeletonIndex: originalBoneInfo.skeletonIndex,
                                    originalJointIndex: originalBoneInfo.jointIndex,
                                    targetSkeletonIndex: iTargetSkeleton,
                                    targetJointIndex: iTargetJoint,
                                    translationRemapMode: command.mode
                                        ? interpretTranslationRemapModeInCommand(command.mode)
                                        : TranslationRemapMode.SKELETON,
                                };
                            }
                            break;
                        }
                        case 'set-translation-remap-mode': {
                            if (!targetJointPath.match(command.target)) {
                                break;
                            }
                            if (!maps[targetJointPath]) {
                                cc.error(`Failed to set the translation remap mode of '${targetJointPath}', it's not mapped yet.`);
                            } else {
                                maps[targetJointPath].translationRemapMode = interpretTranslationRemapModeInCommand(command.mode);
                            }
                            break;
                        }
                    }
                }
            }
        }
    }
}

interface JointRemapSetting {
    originalJointPath: string;

    originalSkeletonIndex: number;

    originalJointIndex: number;

    targetSkeletonIndex: number;

    targetJointIndex: number;

    translationRemapMode: TranslationRemapMode;
}

function findBoneInSkeletons(skeletons: cc.Skeleton[], path: string) {
    for (let iSkeleton = 0; iSkeleton < skeletons.length; ++iSkeleton) {
        const skeleton = skeletons[iSkeleton];
        const jointIndex = skeleton.joints.indexOf(path);
        if (jointIndex >= 0) {
            return {
                skeletonIndex: iSkeleton,
                jointIndex,
            };
        }
    }
    return null;
}


function getSkeletonBoneTranslation(skeleton: cc.Skeleton, index: number) {
    const localTranslation = new cc.math.Vec3();
    skeleton.bindposes[index].getTranslation(localTranslation);
    return localTranslation;
}

function getSkeletonBoneLocalTranslation(skeleton: cc.Skeleton, index: number) {
    const bonePath = skeleton.joints[index];
    const parentBonePath = getParentJointPath(bonePath);
    const boneWorldTransform = skeleton.bindposes[index];

    let localTransform: cc.math.Mat4;
    if (!parentBonePath) {
        localTransform = boneWorldTransform;
    } else {
        const parentBoneIndex = skeleton.joints.indexOf(parentBonePath);
        if (parentBoneIndex < 0) {
            localTransform = boneWorldTransform;
        } else {
            const parentBoneInverseTransform = skeleton.inverseBindposes[parentBoneIndex];
            localTransform = cc.math.Mat4.multiply(
                new cc.math.Mat4(), boneWorldTransform, parentBoneInverseTransform
            );
        }
    }

    const localTranslation = new cc.math.Vec3();
    localTransform.getTranslation(localTranslation);
    return localTranslation;
}

function getParentJointPath(path: string) {
    const nodes = path.split('/');
    if (nodes.length < 2) {
        return '';
    } else {
        nodes.pop();
        return nodes.join('/');
    }
}

const PROPORTION_POSITION_CACHE = new cc.math.Vec3();

export type NodeLike = {
    readonly position: Readonly<cc.math.Vec3>;
    readonly rotation: Readonly<cc.math.Quat>;
    readonly scale: Readonly<cc.math.Vec3>;
    readonly eulerAngles: Readonly<cc.math.Vec3>;
    setRTS(rot?: cc.math.Quat | cc.math.Vec3, pos?: cc.math.Vec3, scale?: cc.math.Vec3): void;
}

class RemappedJoint implements NodeLike {
    constructor(
        originalJoint: cc.Node,
        translationRemapMode: TranslationRemapMode,
        originalRefTranslation: cc.math.Vec3,
        originalLocalRefTranslation: cc.math.Vec3,
        targetRefTranslation: cc.math.Vec3,
    ) {
        this._instance = originalJoint;
        this._isRemapped = true;
        this._translationRemapMode = translationRemapMode;
        cc.math.Vec3.copy(this._originalRefTranslation, originalRefTranslation);
        cc.math.Vec3.copy(this._originalRefLocalTranslation, originalLocalRefTranslation);
        cc.math.Vec3.copy(this._targetRefTranslation, targetRefTranslation);
        const {
            position: initialPosition,
            rotation: initialRotation,
            scale: initialScale,
        } = this._instance;
    }

    get position () {
        return this._instance.position;
    }

    get rotation () {
        return this._instance.rotation;
    }

    get scale () {
        return this._instance.scale;
    }

    get eulerAngles () {
        return this._instance.eulerAngles;
    }

    public setRTS (rot?: cc.math.Quat | cc.math.Vec3, pos?: cc.math.Vec3, scale?: cc.math.Vec3) {
        const { _instance: instance } = this;

        if (!instance) {
            // Happen when an animation request to animate this joint,
            // but it's not presented or is not mapped.
            return;
        }

        if (this._isRemapped) {
            if (pos) {
                switch (this._translationRemapMode) {
                case TranslationRemapMode.SKELETON:
                    pos = undefined;// this._instanceHasBeenSet ? this._originalRefLocalTranslation : undefined;
                    break;
                case TranslationRemapMode.PROPORTIONAL_ANIMATION: {
                    debugger;
                    const { _targetRefTranslation: remappedRefTranslation } = this;
                    const remappedLength = cc.math.Vec3.len(remappedRefTranslation);
                    if (remappedLength > 1e-6) {
                        const { _originalRefTranslation: originalRefTranslation } = this;
                        const originalLength = cc.math.Vec3.len(originalRefTranslation);
                        const proportion = originalLength / remappedLength;
                        const proportionalTranslation = cc.math.Vec3.multiplyScalar(
                            PROPORTION_POSITION_CACHE,
                            pos,
                            proportion,
                        );
                        pos = proportionalTranslation;
                    }
                    break;
                }
                default:
                    break;
                }
            }
        }

        instance.setRTS(rot, pos, scale);
    }

    private _instance: cc.Node;

    private _isRemapped = false;
    private _translationRemapMode = TranslationRemapMode.ANIMATION;
    private _originalRefLocalTranslation = new cc.math.Vec3();
    private _originalRefTranslation = new cc.math.Vec3();
    private _targetRefTranslation = new cc.math.Vec3();
}

export type { RemappedJoint };