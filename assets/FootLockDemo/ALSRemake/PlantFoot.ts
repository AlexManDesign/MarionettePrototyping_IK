import { _decorator, Component, Node, animation, game } from "cc";
const { ccclass, property } = _decorator;

@ccclass("PlantFoot")
export class PlantFoot extends animation.StateMachineComponent {
    @property
    trigger = '';

    public onFunctorStateEnter(controller: animation.AnimationController): void {
        controller.setValue(this.trigger, true);
    }

    public onFunctorStateExit(controller: animation.AnimationController): void {
        console.debug;
    }
}
