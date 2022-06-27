import { _decorator, Component, Node, Vec3, MeshRenderer, utils, primitives, geometry, physics } from 'cc';
import { IKResolver } from '../../Source/Solvers/IKResolver';
const { ccclass, property } = _decorator;

@ccclass('FootIK')
export class FootIK extends Component {
    @property(IKResolver)
    resolver!: IKResolver;

    @property(Node)
    foot!: Node;

    @property(Node)
    ball!: Node;

    @property
    raycastOffset = 0.5;

    @property
    raycastDistance = 30.0;

    start() {
        const { _debugTargetLocation: debugTargetLocation } = this;
        
        
        {
            const meshRenderer = this._debugRayOrigin.addComponent(MeshRenderer);
            const scale = 0.1;
            meshRenderer.mesh = utils.MeshUtils.createMesh(primitives.box({ width: scale, height: scale, length: scale }));
            this._debugRayOrigin.parent = this.node.scene;
        }
    }

    lateUpdate(deltaTime: number) {
        const {
            foot,
            ball,
            raycastOffset: raycastOffset,
            raycastDistance: raycastDistance,
        } = this;
        const ballPosition = ball.getWorldPosition();
        const footPosition = foot.getWorldPosition();
        const footHeight = ballPosition.y - footPosition.y;
        const from = Vec3.scaleAndAdd(new Vec3(), ballPosition, Vec3.UNIT_Y,  raycastOffset);
        this._debugRayOrigin.setWorldPosition(from);
        const ray = geometry.Ray.fromPoints(
            new geometry.Ray(),
            from,
            Vec3.scaleAndAdd(new Vec3(), from, Vec3.UNIT_Y, -raycastDistance),
        );
        if (physics.PhysicsSystem.instance.raycastClosest(
            ray,
            undefined,
            raycastDistance,
        )) {
            const result = physics.PhysicsSystem.instance.raycastClosestResult;
            const target = Vec3.clone(result.hitPoint);
            target.y -= footHeight;
            this._solve(target);
        }
    }

    private _debugTargetLocation: Node = new Node();

    private _debugRayOrigin = new Node();

    private _solve(target: Vec3) {
        this._debugTargetLocation.setWorldPosition(target);
        const steps = this.resolver.resolve(this.foot, target, false);
        for (const step of steps) {
        }
    }
}

class PositionIndicator {
    constructor(parent: Node) {
        const node = this._node = new Node();
        const meshRenderer = node.addComponent(MeshRenderer);
        const scale = 0.1;
        meshRenderer.mesh = utils.MeshUtils.createMesh(primitives.box({ width: scale, height: scale, length: scale }));
        node.parent = parent;
    }

    public setPosition(p: Vec3) {
        this._node.setWorldPosition(p);
    }

    private _node: Node;
}
