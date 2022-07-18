import { _decorator, Component, Node, animation } from "cc";
const { ccclass, property } = _decorator;

@ccclass("ALSRemakePlayNStopL")
export class ALSRemakePlayNStopL extends animation.StateMachineComponent {
    public onMotionStateEnter (controller: animation.AnimationController, motionStateStatus: Readonly<animation.MotionStateStatus>): void {
        controller.setValue('PlayNStopL', true);
    }
}
