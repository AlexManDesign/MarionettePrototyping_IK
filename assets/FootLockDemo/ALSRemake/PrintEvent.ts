import { _decorator, Component, Node, animation, log } from "cc";
const { ccclass, property } = _decorator;

@ccclass("PrintEvent")
export class PrintEvent extends animation.StateMachineComponent {
    @property
    public name = '';
    
    public onMotionStateEnter (controller: animation.AnimationController, motionStateStatus: Readonly<animation.MotionStateStatus>): void {
        this._printEvent(controller, 'Enter');
    }

    public onMotionStateExit (controller: animation.AnimationController, motionStateStatus: Readonly<animation.MotionStateStatus>): void {
        this._printEvent(controller, 'Exit');
    }

    public onStateMachineEnter (controller: animation.AnimationController) {
        this._printEvent(controller, 'Enter');
    }

    public onStateMachineExit (controller: animation.AnimationController) {
        this._printEvent(controller, 'Exit');
    }

    public onFunctorStateEnter(controller: animation.AnimationController): void {
        this._printEvent(controller, 'Enter');
    }

    public onFunctorStateExit (controller: animation.AnimationController) {
        this._printEvent(controller, 'Exit');
    }

    private _printEvent(controller: animation.AnimationController, event: string) {
        const now = new Date();
        const last = lastDateMap.get(controller);
        const pastMs = last ? (last.getTime() - now.getTime()) : 0;
        lastDateMap.set(controller, now);
        log(
            `[${now.getHours()}:${now.getMinutes()}:` + 
            `${now.getSeconds()} ${now.getMilliseconds()}, ${(pastMs / 100).toFixed(2)}s passed]` +
            `${this.name} ${event}`);
    }
}

const lastDateMap = new WeakMap<animation.AnimationController, Date>();
