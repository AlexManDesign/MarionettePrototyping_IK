import { _decorator, Component, Node, animation, game } from "cc";
import { GlobalPauseSwitch } from "./Utilities/GlobalPauseSwitch";
const { ccclass, property } = _decorator;

@ccclass("PauseOn")
export class PauseOn extends animation.StateMachineComponent {
    @property
    enter = false;

    @property
    exit = false;
    
    public onMotionStateEnter (controller: animation.AnimationController): void {
        this._onEnter();
    }

    public onMotionStateExit (controller: animation.AnimationController): void {
        this._onExit();
    }
    
    public onStateMachineEnter (controller: animation.AnimationController) {
        this._onEnter();
    }

    public onStateMachineExit (controller: animation.AnimationController) {
        this._onExit();
    }

    public onFunctorStateEnter(controller: animation.AnimationController): void {
        this._onEnter();
    }

    public onFunctorStateExit(controller: animation.AnimationController): void {
        this._onExit();
    }

    private _onEnter() {
        if (this.enter && GlobalPauseSwitch.pauseEnabled) {
            game.pause();
        }
    }

    private _onExit() {
        if (this.exit && GlobalPauseSwitch.pauseEnabled) {
            game.pause();
        }
    }
}
