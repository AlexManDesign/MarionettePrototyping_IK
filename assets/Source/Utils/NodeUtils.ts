
import * as cc from 'cc';

export function getForward (node: cc.Node) {
    return cc.math.Vec3.transformQuat(new cc.math.Vec3(), cc.math.Vec3.UNIT_Z, node.worldRotation);
}

export function getRight (node: cc.Node) {
    return cc.math.Vec3.transformQuat(new cc.math.Vec3(), cc.math.Vec3.negate(new cc.math.Vec3(), cc.math.Vec3.UNIT_X), node.worldRotation);
}

export function getUp (node: cc.Node) {
    return cc.math.Vec3.transformQuat(new cc.math.Vec3(), cc.math.Vec3.UP, node.worldRotation);
}

const DOWN = Object.freeze(cc.Vec3.negate(new cc.Vec3(), cc.Vec3.UNIT_Y));

export function getDown (node: cc.Node) {
    return cc.math.Vec3.transformQuat(new cc.math.Vec3(), DOWN, node.worldRotation);
}