import { _decorator, Component, Node, Vec3, toRadian, Quat, NodeSpace, input, Input, KeyCode } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Chase')
export class Chase extends Component {
    @property(Node)
    target: Node | null = null;

    _target: Node | null = null;

    rotationSpeed = 10;

    start() {
        input.on(Input.EventType.KEY_UP, (k) => {
            if (k.keyCode === KeyCode.KEY_K) {
                this._target = this.target;
            }
        });
    }

    update(deltaTime: number) {
        const { _target: target } = this;
        if (!target) {
            return;
        }

        const currentDir = Vec3.transformQuat(new Vec3(), Vec3.UNIT_Z, this.node.worldRotation);
        const destDir = Vec3.subtract(new Vec3(), target.worldPosition, this.node.worldPosition);
        destDir.normalize();

        const angle = Vec3.angle(currentDir, destDir);
        const axis = Vec3.cross(new Vec3(), currentDir, destDir);
        axis.normalize();

        const theta = Math.min(angle, toRadian(this.rotationSpeed * deltaTime));
        if (theta >= angle) {
            this._target = null;
        }

        this.node.rotate(
            Quat.fromAxisAngle(new Quat(), axis, theta),
            NodeSpace.WORLD,
        );

        const omega = toRadian(this.rotationSpeed);

        const speed = 1;
        const v0x = currentDir.x * speed;
        const v0y = currentDir.y * speed;
        const sx = (v0x * Math.sin(theta) - v0y * Math.cos(theta) + v0y) / omega;
        const sy = (v0x * Math.cos(theta) + v0y * Math.sin(theta) - v0x) / omega;
        this.node.worldPosition = Vec3.add(new Vec3(), this.node.worldPosition, new Vec3(sx, 0.0, sy));
    }
}


