import * as cc from 'cc';
import { IKResolver } from '../Solvers/IKResolver';

@cc._decorator.ccclass('CCDIKDemo')
export class IKDemo extends cc.Component {
    @cc._decorator.property(cc.Node)
    public leftHand: cc.Node | null = null;

    @cc._decorator.property(cc.Node)
    public rightHand: cc.Node | null = null;

    @cc._decorator.property(cc.Node)
    public leftFoot: cc.Node | null = null;

    @cc._decorator.property(cc.Node)
    public rightFoot: cc.Node | null = null;

    @cc._decorator.property(IKResolver)
    public resolver!: IKResolver;

    @cc._decorator.property
    public speed = 1.0;

    public start() {

    }

    public update (_deltaTime: number) {
    }

    get running() {
        return !!this._task;
    }

    public execute() {
        if (!this._task) {
            return;
        }
        for (const _ of this._task) {

        }
    }

    public step() {
        if (!this._task) {
            return;
        }
        this._task.next();
    }

    public onResolve(endFactor: cc.Node, target: cc.Node) {
        this._task = (function*(this: IKDemo) {
            const task = this._startImmediateResolutionTask(endFactor, target.getWorldPosition());
            let next;
            while (!(next = task.next()).done) {
                yield next.value;
            }
            this._task = null;
            return next.value;
        }).call(this);
    }

    private _task: Generator | null = null;

    private *_startLinearlyResolutionTask(endFactor: cc.Node, target: cc.Node, deltaTime: number) {
        const endFactorPosition = endFactor.getWorldPosition();
        const targetPosition = target.getWorldPosition();
        const d = cc.math.Vec3.distance(endFactorPosition, targetPosition);
        const step = Math.min(deltaTime * this.speed + this.resolver.maxError, d);
        const immediateTargetPosition = cc.math.Vec3.lerp(
            new cc.math.Vec3(),
            endFactorPosition,
            targetPosition,
            step / d,
        );
        const resolveSteps = this._startImmediateResolutionTask(endFactor, immediateTargetPosition);
        for (const _ of resolveSteps) {
            yield;
        }
    }

    private *_startImmediateResolutionTask(endFactor: cc.Node, target: cc.math.Vec3) {
        const resolveGenerator = this.resolver.resolve(
            endFactor,
            target,
        );
        let next;
        while (!(next = resolveGenerator.next()).done) {
            yield;
        }
        const err = next.value;
        if (err) {
            cc.error(`IK Unreachable.`);
        } else {
            cc.log(`IK finished.`);
        }
    }
}
