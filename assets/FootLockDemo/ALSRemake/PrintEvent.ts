import { _decorator, Component, Node, animation, log, game } from "cc";
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
        const now = Date.now();
        const last = lastDateMap.get(controller);
        const pastMs = typeof last === 'undefined' ? 0 : (now - last);
        lastDateMap.set(controller, now);
        const nowDate = new Date(now);
        log(
            `[` + 
            `${nowDate.getSeconds()}, Δ${(pastMs / 1000).toFixed(2)}s]` +
            `${this.name} ${event}`);
    }
}

const lastDateMap = new WeakMap<animation.AnimationController, number>();
