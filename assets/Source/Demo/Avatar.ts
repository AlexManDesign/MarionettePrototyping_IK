

export interface Avatar {
    isValid: boolean;
    isHuman: boolean;
    humanDescription: HumanDescription;
    avatarBones: Array<{
        name: string;
        preRotation: Quaternion;
        postRotation: Quaternion;
        instanceRotations: Vector3[];
        limitSign: Vector3;
    }>;
}

export interface HumanDescription {
    human: HumanBone[];
    skeleton: SkeletonBone[];
    upperArmTwist: number;
    lowerArmTwist: number;
    upperLegTwist: number;
    lowerLegTwist: number;
    armStretch: number;
    legStretch: number;
    feetSpacing: number;
    hasTranslationDoF: boolean;
}

export interface HumanBone {
    limit: HumanLimit;
    boneName: string;
    humanName: string;
}

export interface HumanLimit {
    useDefaultValues: boolean;
    min: Vector3;
    max: Vector3;
    center: Vector3;
    axisLength: number;
}

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface SkeletonBone {
    name: string;
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
}

export interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

export {};