import { _decorator, Component, Node, input, Input, KeyCode, EventKeyboard, Vec3, animation, toRadian, Quat, ccenum } from 'cc';
const { ccclass, property } = _decorator;

type KeyType = KeyCode.KEY_Q | KeyCode.KEY_E | KeyCode.KEY_A | KeyCode.KEY_D;

enum StopCase {
    LOCK_LEFT_FOOT,
    LOCK_RIGHT_FOOT,
    PLANT_LEFT_FOOT,
    PLANT_RIGHT_FOOT,
}

function getStopCaseFrames(stopCase: StopCase) {
    switch (stopCase) {
        default:
            return 0;
        case StopCase.LOCK_RIGHT_FOOT:
            return 30;
        case StopCase.PLANT_LEFT_FOOT:
            return 50;
        case StopCase.LOCK_LEFT_FOOT:
            return 55;
        case StopCase.PLANT_RIGHT_FOOT:
            return 65;
    }
}

declare namespace globalThis {
    export var __FIXED_FPS: number | undefined;
}


ccenum(StopCase);

@ccclass('FootLockDemo')
export class FootLockDemo extends Component {
    private _keyPressed: Record<KeyType, boolean> = {
        [KeyCode.KEY_Q]: false,
        [KeyCode.KEY_E]: false,
        [KeyCode.KEY_A]: false,
        [KeyCode.KEY_D]: false,
    };

    private _counter = 0;

    @property({ type: StopCase })
    stopCase = StopCase.LOCK_LEFT_FOOT;

    @property
    actualMovement = true;

    @property
    get fixedFPS() {
        return this._fixedFPS;
    }

    set fixedFPS(value) {
        this._fixedFPS = value;
        globalThis.__FIXED_FPS = value ? 60 : undefined;
    }

    start() {
        this.fixedFPS = this._fixedFPS;
        
        // globalThis.slomo = 0.1;
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
                case KeyCode.KEY_X:
                    this._counter = getStopCaseFrames(this.stopCase) * (1.0 / 60.0);
                    break;
            }
        };

        input.on(Input.EventType.KEY_UP, (event) => setKey(event, false));
        input.on(Input.EventType.KEY_DOWN, (event) => setKey(event, true));
    }

    private _lastDebugVelocity = 0.0;

    @property
    private _fixedFPS = false;

    update (deltaTime: number) {
        // if (true) {
        //     const thigh = this.node.scene.getChildByPath('ALS_Mannequin_T_Pose/root/pelvis/thigh_r')!;
        //     const calf = this.node.scene.getChildByPath('ALS_Mannequin_T_Pose/root/pelvis/thigh_r/calf_r')!;
        //     const foot = this.node.scene.getChildByPath('ALS_Mannequin_T_Pose/root/pelvis/thigh_r/calf_r/foot_r')!;
        //     console.log(
        //         'Thigh: ',
        //         thigh.position,
        //         thigh.rotation,
        //     );
        //     console.log(
        //         'Calf: ',
        //         calf.position,
        //         calf.rotation,
        //     );
        //     console.log(
        //         'Foot: ',
        //         foot.position,
        //         foot.rotation,
        //     );
        // }

        deltaTime *= (globalThis.slomo ?? 1.0);
        let moveLeftRightAxis = (this._keyPressed[KeyCode.KEY_A] ? -1 : 0) + (this._keyPressed[KeyCode.KEY_D] ? 1 : 0);
        if (this._counter > 0.0) {
            moveLeftRightAxis = -1;
            this._counter -= deltaTime;
        }
        const targetVelocityX = this._targetVelocityX = moveLeftRightAxis * 1.0;
        const velocityDelta = targetVelocityX - this._currentVelocityX;
        if (velocityDelta !== 0) {
            const acceleration = 5.0;
            const velocityDeltaAbs = Math.abs(velocityDelta);
            const stepDelta = Math.min(acceleration * deltaTime, velocityDeltaAbs);
            this._currentVelocityX += stepDelta * Math.sign(velocityDelta);
            deltaTime -= stepDelta / acceleration;
        }

        if (this._lastDebugVelocity !== this._currentVelocityX) {
            console.log(`Velocity changed: ${this._currentVelocityX}`);
            this._lastDebugVelocity = this._currentVelocityX;
        }

        const animationController = this.node.getComponent(animation.AnimationController);

        const shouldMove = !!targetVelocityX;

        if (this._currentVelocityX && deltaTime) {
            if (this.actualMovement) {
                const moveLeftRightDistance = targetVelocityX * deltaTime;
                const v = Vec3.transformQuat(new Vec3(), Vec3.UNIT_X, this.node.worldRotation);
                Vec3.scaleAndAdd(v, this.node.worldPosition, v, moveLeftRightDistance);
                this.node.worldPosition = v;
            }
            animationController?.setValue('Walk', true);
            this._moving = true;
        } else {
            animationController?.setValue('Walk', false);
            if (this._moving) {
                // animationController?.setValue('QuickStop', true);
                this._moving = false;
            }
        }
        const hasStride = [...(animationController?.getVariables() ?? [])].some(([k, v]) => {
            return k === 'Stride';
        });
        if (targetVelocityX !== 0 && hasStride) {
            const stride = (0.2 + Math.abs(this._currentVelocityX) * 0.8);
            // const stride = Math.sign(this._currentVelocityX) * (0.2 + Math.abs(this._currentVelocityX) * 0.8);
            animationController?.setValue('Stride', stride);
        }
        if (shouldMove) {
            animationController?.setValue('VelocityX', this._currentVelocityX);
        }
        animationController?.setValue('ShouldMove', shouldMove);

        const rotateAxis = (this._keyPressed[KeyCode.KEY_Q] ? -1 : 0) + (this._keyPressed[KeyCode.KEY_E] ? 1 : 0);
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
