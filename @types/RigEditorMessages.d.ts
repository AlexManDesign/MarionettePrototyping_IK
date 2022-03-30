
declare type RigEditorEditParam = {
    rig: RigEditorRig;
};

declare type RigEditorJointPropertiesChangedParam = Pick<RigEditorJoint, 'rotationLimitX' | 'rotationLimitY' | 'rotationLimitZ'>;

declare type RigEditorOnJointPropertiesChanged = (jointId: number, param: RigEditorJointPropertiesChangedParam) => void;

interface RigEditorRig {
    joints: RigEditorJoint[];
}

interface RigEditorJoint {
    name: string;
    parent: number;
    rotationLimitX: RigEditorRotationLimit;
    rotationLimitY: RigEditorRotationLimit;
    rotationLimitZ: RigEditorRotationLimit;
}

interface RigEditorRotationLimit {
    min: number;
    max: number;
}