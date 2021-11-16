import { Camera, Component, geometry, Input, input, log, Material, math, Mesh, MeshCollider, MeshRenderer, Node, physics, PhysicsSystem, RigidBody, utils, _decorator } from "cc";
import { forceIndexed } from "../Util/Geometry";
import { createOctahedralBone } from "../Util/OctahedralBone";

// BUG: MeshCollider does require indices
const defaultBoneMesh =  utils.createMesh(forceIndexed(createOctahedralBone({
    width: 0.5,
    length: 0.5,
})));

const PHYSICS_MASK_BONE = 1;

@_decorator.ccclass('SkeletonRenderer')
export class SkeletonRenderer extends Component {
    @_decorator.property(Node)
    public root!: Node;

    @_decorator.property(Material)
    public material!: Material;

    @_decorator.property(Camera)
    public camera!: Camera;

    public start () {
        this._drawBoneRecursive(this.root);
        this._dirtyJoints = new Array(this._boneRenderMap.size);
        let iDirtyJoint = 0;
        for (const [joint] of this._boneRenderMap) {
            this._dirtyJoints[iDirtyJoint] = joint;
            ++iDirtyJoint;
        }
        this._nDirtyJoints = iDirtyJoint;

        input.on(Input.EventType.MOUSE_UP, (event) => {
            const camera = this.camera;

            const touchPosition = camera.screenToWorld(new math.Vec3(
                event.getLocationX(),
                event.getLocationY(),
                0.0,
            ), new math.Vec3());

            const cameraPosition = camera.node.getWorldPosition();

            const ray = geometry.Ray.fromPoints(
                new geometry.Ray(),
                cameraPosition,
                touchPosition,
            );

            if (PhysicsSystem.instance.raycastClosest(ray, PHYSICS_MASK_BONE)) {
                const rayCastResult = PhysicsSystem.instance.raycastClosestResult;
                const bone = rayCastResult.collider.node;
                for (const [joint, boneRenderInfo] of this._boneRenderMap) {
                    if (bone === boneRenderInfo.rendererNode) {
                        log(`Bone: ${joint.parent!.name} -> ${joint.name}`);
                        break;
                    }
                }
            }
        });
    }

    public update() {
        if (this._nDirtyJoints) {
            // log(`Changed joints: ${this._dirtyJoints.slice(0, this._nDirtyJoints).map((joint) => joint.name)}`);

            for (let iDirtyJoint = 0; iDirtyJoint < this._nDirtyJoints; ++iDirtyJoint) {
                const dirtyJoint = this._dirtyJoints[iDirtyJoint];
                this._setBoneDirtyRecursive(dirtyJoint);
                this._dirtyJoints[iDirtyJoint] = null!;
            }
            this._nDirtyJoints = 0;

            // log(`Dirty: ${Array.from(this._boneRenderMap.entries()).filter(([, { dirty }]) => dirty).map(([joint]) => joint.name)}`);

            for (const [joint, renderInfo] of this._boneRenderMap) {
                if (renderInfo.dirty) {
                    renderInfo.dirty = false;
                    this._updateBone(joint, joint.parent!, renderInfo);
                }
            }
        }
    }

    private _boneRenderMap = new Map<Node, BoneRenderInfo>();

    private _nDirtyJoints = 0;

    private _dirtyJoints: Node[] = [];

    private _drawBoneRecursive(joint: Node) {
        joint.on(Node.EventType.TRANSFORM_CHANGED, (flags: number) => {
            return this._onJointTransformChanged(joint, flags);
        }, this);

        for (const child of joint.children) {
            this._drawBone(child, joint);
            this._drawBoneRecursive(child);
        }
    }

    private _drawBone(child: Node, parent: Node) {
        const bone = new Node(`Bone - ${child.name}`);
        const boneMesh = defaultBoneMesh;
        const meshRenderer = bone.addComponent(MeshRenderer);
        meshRenderer.mesh = boneMesh;
        meshRenderer.material = this.material;
        const rigidBody = bone.addComponent(RigidBody);
        rigidBody.type = physics.ERigidBodyType.STATIC;
        rigidBody.group = PHYSICS_MASK_BONE;
        const meshCollider = bone.addComponent(MeshCollider);
        meshCollider.mesh = boneMesh;
        this.node.scene.addChild(bone);

        const renderInfo: BoneRenderInfo = {
            rendererNode: bone,
            dirty: true,
        };
        this._boneRenderMap.set(child, renderInfo);
    }

    private _onJointTransformChanged(joint: Node, _flags: number) {
        for (let iDirtyJoint = 0; iDirtyJoint < this._nDirtyJoints; ++iDirtyJoint) {
            const dirtyBone = this._dirtyJoints[iDirtyJoint];
            if (dirtyBone === joint) {
                return;
            }
        }
        if (this._dirtyJoints.length === this._nDirtyJoints) {
            this._dirtyJoints.push(joint);
        } else {
            this._dirtyJoints[this._nDirtyJoints] = joint;
            ++this._nDirtyJoints;
        }
    }

    private _setBoneDirtyRecursive(joint: Node) {
        const renderInfo = this._boneRenderMap.get(joint);
        if (renderInfo) {
            renderInfo.dirty = true;
        }
        for (const child of joint.children) {
            this._setBoneDirtyRecursive(child);
        }
    }

    private _updateBone(child: Node, parent: Node, renderInfo: BoneRenderInfo) {
        const { rendererNode: bone } = renderInfo;

        const childPosition = child.getWorldPosition();
        const parentPosition = parent.getWorldPosition();

        const u = math.Vec3.UP;
        const v = math.Vec3.subtract(
            new math.Vec3(),
            childPosition,
            parentPosition,
        );

        const boneLength = math.Vec3.len(v);

        math.Vec3.normalize(v, v);
        const angle = math.Vec3.angle(u, v);
        const axis = math.Vec3.cross(new math.Vec3(), u, v);
        math.Vec3.normalize(axis, axis);
        const rotation = math.Quat.fromAxisAngle(
            new math.Quat(),
            axis,
            angle,
        );

        bone.setWorldRotation(rotation);
        bone.setWorldScale(boneLength, boneLength, boneLength);
        bone.setWorldPosition(parentPosition);
    }
}

interface BoneRenderInfo {
    rendererNode: Node;
    dirty: boolean;
}

