import { _decorator, Component, Node, animation, game } from "cc";
const { ccclass, property } = _decorator;

@ccclass("ALSRemakePlayNStopR")
export class ALSRemakePlayNStopR extends animation.StateMachineComponent {
    public onFunctorStateEnter (controller: animation.AnimationController): void {
        // game.pause();
        controller.setValue('PlayNStopR', true);
    }
}
