import { _decorator, Component, Node, animation } from "cc";
const { ccclass, property } = _decorator;

@ccclass("LockFoot")
export class LockFoot extends animation.StateMachineComponent {
    @property
    trigger = '';

    public onFunctorStateEnter(controller: animation.AnimationController): void {
        controller.setValue(this.trigger, true);
    }

    public onFunctorStateExit(controller: animation.AnimationController): void {
        console.debug;
    }
}
