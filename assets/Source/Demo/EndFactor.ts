
import { _decorator, Component, Node, EventTouch, math, CameraComponent, physics, PhysicsSystem, geometry, UITransform } from 'cc';
import { injectComponent } from '../Util/Component';
import { CCDIKDemo } from './CCDIDDemo';
const { ccclass, property } = _decorator;
 
@ccclass('EndFactor')
export class EndFactor extends Component {
    @property(CameraComponent)
    public camera!: CameraComponent;

    @property(Node)
    public endFactorNode: Node | null = null;

    start () {
        this.node.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
    }

    @injectComponent(UITransform)
    private _uiTransform!: UITransform;

    private _onTouchStart(touchEvent: EventTouch) {

    }

    private _onTouchCancel(touchEvent: EventTouch) {
        if (!this.endFactorNode) {
            return;
        }

        const touches = touchEvent.getTouches();
        if (touches.length === 0) {
            return;
        }

        const touch = touches[0];

        const camera = this.camera;
        const touchX = touch.getUILocationX();
        const touchY = touch.getUILocationY();

        const touchPosition = this._uiTransform.convertToWorldSpaceAR(new math.Vec3(
            touchX,
            touchY,
            0.0,
        ), new math.Vec3());

        const touchPosition2 = camera.screenToWorld(new math.Vec3(
            touch.getLocationX(),
            touch.getLocationY(),
            0.0,
        ), new math.Vec3());

        const cameraPosition = camera.node.getWorldPosition();
        const ray = geometry.Ray.fromPoints(
            new geometry.Ray(),
            cameraPosition,
            touchPosition2,
        );

        if (PhysicsSystem.instance.raycastClosest(ray)) {
            const rayCastResult = PhysicsSystem.instance.raycastClosestResult;

            const demo = this.node.scene.getComponentInChildren(CCDIKDemo);
            demo?.onResolve(this.endFactorNode, rayCastResult.collider.node);
        }
    }
}
