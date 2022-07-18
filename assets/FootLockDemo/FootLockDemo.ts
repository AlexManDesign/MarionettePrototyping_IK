import { _decorator, Component, Node, input, Input, KeyCode, EventKeyboard, Vec3, animation, toRadian, Quat } from 'cc';
const { ccclass, property } = _decorator;

type KeyType = KeyCode.KEY_Q | KeyCode.KEY_E | KeyCode.KEY_A | KeyCode.KEY_D;

@ccclass('FootLockDemo')
export class FootLockDemo extends Component {
    private _keyPressed: Record<KeyType, boolean> = {
        [KeyCode.KEY_Q]: false,
        [KeyCode.KEY_E]: false,
        [KeyCode.KEY_A]: false,
        [KeyCode.KEY_D]: false,
    };

    start() {
        const setKey = (event: EventKeyboard, pressed: boolean) => {
            if (event.keyCode in this._keyPressed) {
                this._keyPressed[event.keyCode as KeyType] = pressed;
            }
            switch (event.keyCode) {
                case KeyCode.ALT_LEFT:
                    if (!pressed) {
                        this._clf = !this._clf;
                        this.node.getComponent(animation.AnimationController)?.setValue('CLF', this._clf);
                    }
                    break;
            }
        };

        input.on(Input.EventType.KEY_UP, (event) => setKey(event, false));
        input.on(Input.EventType.KEY_DOWN, (event) => setKey(event, true));
    }

    private _lastDebugVelocity = 0.0;

    update (deltaTime: number) {
        const moveLeftRightAxis = (this._keyPressed[KeyCode.KEY_Q] ? -1 : 0) + (this._keyPressed[KeyCode.KEY_E] ? 1 : 0);
        const targetVelocityX = this._targetVelocityX = moveLeftRightAxis * 1.0;
        const velocityDelta = targetVelocityX - this._currentVelocityX;
        if (velocityDelta !== 0) {
            const acceleration = 6.0;
            const velocityDeltaAbs = Math.abs(velocityDelta);
            const stepDelta = Math.min(acceleration * deltaTime, velocityDeltaAbs);
            this._currentVelocityX += stepDelta * Math.sign(velocityDelta);
            deltaTime -= stepDelta / acceleration;
        }

        if (this._lastDebugVelocity !== this._currentVelocityX) {
            console.log(`Velocity changed: ${this._currentVelocityX}`);
            this._lastDebugVelocity = this._currentVelocityX;
        }

        if (this._currentVelocityX && deltaTime) {
            const moveLeftRightDistance = targetVelocityX * deltaTime;
            const v = Vec3.transformQuat(new Vec3(), Vec3.UNIT_X, this.node.worldRotation);
            Vec3.scaleAndAdd(v, this.node.worldPosition, v, moveLeftRightDistance);
            this.node.worldPosition = v;
            this.node.getComponent(animation.AnimationController)?.setValue('Walk', true);
            this._moving = true;
        } else {
            this.node.getComponent(animation.AnimationController)?.setValue('Walk', false);
            if (this._moving) {
                // this.node.getComponent(animation.AnimationController)?.setValue('QuickStop', true);
                this._moving = false;
            }
        }
        this.node.getComponent(animation.AnimationController)?.setValue('VelocityX', this._currentVelocityX);

        const rotateAxis = (this._keyPressed[KeyCode.KEY_A] ? -1 : 0) + (this._keyPressed[KeyCode.KEY_D] ? 1 : 0);
        if (rotateAxis) {
            const rotateDelta = rotateAxis * toRadian(180.0) * deltaTime;
            const q = Quat.fromAxisAngle(new Quat(), Vec3.UNIT_Y, rotateDelta);
            this.node.rotate(q);
            this._rotating = true;
        } else {
            if (this._rotating) {
                // this.node.getComponent(animation.AnimationController)?.setValue('QuickStop', true);
                this._rotating = false;
            }
        }
    }

    private _moving = false;
    private _rotating = false;
    private _clf = false;
    private _currentVelocityX = 0.0;
    private _targetVelocityX = 0.0;
}


