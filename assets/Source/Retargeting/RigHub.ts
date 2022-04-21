import * as cc from 'cc';
import { RemappedJoint, SkeletonRemap } from './SkeletonRemap';

class RigHub {
    public requestJointOnAnimationInstantiation(referenceNode: cc.Node, path: string) {
        return this._getOrCreateMappedJoint(referenceNode, path) as cc.Node | null;
    }

    private _remappedJoints: Record<string, RemappedJoint | null> = {};

    private _getOrCreateMappedJoint(referenceNode: cc.Node, referencePath: string) {
        const fullPath = referenceNode.getPathInHierarchy() + referencePath;
        let remappedJoint = this._remappedJoints[fullPath];
        if (typeof remappedJoint === 'undefined') {
            remappedJoint = this._createMappedJoint(referenceNode, referencePath);
            this._remappedJoints[fullPath] = remappedJoint;
        }
        return remappedJoint;
    }

    private _createMappedJoint(referenceNode: cc.Node, referencePath: string): RemappedJoint | null {
        const skeletonRemap = referenceNode.getComponent(SkeletonRemap);
        if (!skeletonRemap) {
            return null;
        }
        return skeletonRemap.createRemappedJoint(referencePath);
    }
}

export const globalRigHub_ = new RigHub();

declare global {
    var globalRigHub: RigHub;
}

globalThis.globalRigHub = globalRigHub_;
