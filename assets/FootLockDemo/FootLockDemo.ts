import { _decorator, Component, Node, input, Input, KeyCode, EventKeyboard, Vec3, animation } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FootLockDemo')
export class FootLockDemo extends Component {
    private _keyPressed: Record<KeyCode.KEY_Q | KeyCode.KEY_E, boolean> = {
        [KeyCode.KEY_Q]: false,
        [KeyCode.KEY_E]: false,
    };

    get moving() {
        return this._moving;
    }

    start() {
        const setKey = (event: EventKeyboard, pressed: boolean) => {
            switch (event.keyCode) {
                case KeyCode.KEY_E:
                case KeyCode.KEY_Q: {
                    this._keyPressed[event.keyCode] = pressed;
                    break;
                }
            }
        };

        input.on(Input.EventType.KEY_UP, (event) => setKey(event, false));
        input.on(Input.EventType.KEY_DOWN, (event) => setKey(event, true));
    }

    update (deltaTime: number) {
        const moveLeftRightAxis = (this._keyPressed[KeyCode.KEY_Q] ? -1 : 0) + (this._keyPressed[KeyCode.KEY_E] ? 1 : 0);
        if (moveLeftRightAxis) {
            const moveLeftRightDistance = moveLeftRightAxis * 0.5 * deltaTime;
            const v = Vec3.transformQuat(new Vec3(), Vec3.UNIT_X, this.node.worldRotation);
            Vec3.scaleAndAdd(v, this.node.worldPosition, v, moveLeftRightDistance);
            this.node.worldPosition = v;
            this.node.getComponent(animation.AnimationController)?.setValue('Walk', true);
            this._moving = true;
        } else {
            this.node.getComponent(animation.AnimationController)?.setValue('Walk', false);
            if (this._moving) {
                this.node.getComponent(animation.AnimationController)?.setValue('QuickStop', true);
                this._moving = false;
            }
        }
        this.node.getComponent(animation.AnimationController)?.setValue('VelocityX', -moveLeftRightAxis);
    }

    private _moving = false;
}


