import * as cc from 'cc';

@cc._decorator.ccclass('IKResolver')
export abstract class IKResolver extends cc.Component {
    public abstract maxError: number;

    public abstract resolve(endFactor: cc.Node, target: cc.math.Vec3): Generator<void, number>;
}
