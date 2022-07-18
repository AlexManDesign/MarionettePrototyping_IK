import { _decorator, Component, Node, animation } from "cc";
const { ccclass, property } = _decorator;

@ccclass("ALSRemakePlayNStopR")
export class ALSRemakePlayNStopR extends animation.StateMachineComponent {
    public onMotionStateEnter (controller: animation.AnimationController, motionStateStatus: Readonly<animation.MotionStateStatus>): void {
        controller.setValue('PlayNStopR', true);
    }
}
