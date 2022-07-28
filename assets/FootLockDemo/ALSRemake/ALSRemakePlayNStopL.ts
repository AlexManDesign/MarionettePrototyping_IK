import { _decorator, Component, Node, animation } from "cc";
const { ccclass, property } = _decorator;

@ccclass("ALSRemakePlayNStopL")
export class ALSRemakePlayNStopL extends animation.StateMachineComponent {
    public onFunctorStateEnter (controller: animation.AnimationController): void {
        controller.setValue('PlayNStopL', true);
    }
}
