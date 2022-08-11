import { Camera, ccenum, Color, Component, geometry, gfx, Input, input, log, Material, math, Mesh, MeshCollider, MeshRenderer, Node, physics, PhysicsSystem, primitives, renderer, RigidBody, utils, Vec3, Vec4, _decorator } from "cc";
import { forceIndexed } from "../Util/Geometry";
import { createOctahedralBone } from "../Util/OctahedralBone";
import { LineRenderer } from "./LineRenderer";

// BUG: MeshCollider does require indices
const defaultBoneMesh =  utils.createMesh(forceIndexed(createOctahedralBone({
    width: 0.5,
    length: 0.5,
})));

const PHYSICS_MASK_BONE = 1;

export enum BoneRenderMode {
    octahedral,

    line,
}

ccenum(BoneRenderMode);

@_decorator.ccclass('SkeletonRenderer')
export class SkeletonRenderer extends Component {
    @_decorator.property(Node)
    public root!: Node;

    @_decorator.property(Material)
    public material!: Material;

    @_decorator.property(Material)
    public lineMaterial!: Material;

    @_decorator.property(Camera)
    public camera: Camera | null = null;

    @_decorator.property
    public filter = '';

    @_decorator.property({ type: BoneRenderMode })
    mode: BoneRenderMode = BoneRenderMode.octahedral;

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
            if (!camera) {
                return;
            }

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

    public clearColor() {
        for (const [, { renderer }] of this._boneRenderMap) {
            renderer.clearColor();
        }
    }

    public setJointColor(name: string, color: Color) {
        for (const [node, { renderer }] of this._boneRenderMap) {
            if (node.name === name) {
                renderer.setJointColor(color);
            }
        }
    }

    public resetJointColor(name: string) {
        for (const [node, { renderer }] of this._boneRenderMap) {
            if (node.name === name) {
                renderer.resetJointColor();
            }
        }
    }

    public setBoneColor(name: string, color: Color) {
        for (const [node, { renderer }] of this._boneRenderMap) {
            if (node.name === name) {
                renderer.setBoneColor(color);
            }
        }
    }

    public resetBoneColor(name: string) {
        for (const [node, { renderer }] of this._boneRenderMap) {
            if (node.name === name) {
                renderer.resetBoneColor();
            }
        }
    }

    private _boneRenderMap = new Map<Node, BoneRenderInfo>();

    private _nDirtyJoints = 0;

    private _dirtyJoints: Node[] = [];

    private _drawBoneRecursive(joint: Node) {
        const excluded = !!(this.filter && new RegExp(this.filter).test(joint.name));
        if (excluded) {
            console.log(`Skip bone ${joint.name}`);
        }
        if (!excluded) {
            joint.on(Node.EventType.TRANSFORM_CHANGED, (flags: number) => {
                return this._onJointTransformChanged(joint, flags);
            }, this);
        }

        for (const child of joint.children) {
            if (!child.activeInHierarchy) {
                continue;
            }
            this._drawBone(child, joint);
            this._drawBoneRecursive(child);
        }
    }

    private _drawBone(child: Node, parent: Node) {
        const boneRenderRoot = new Node(`Bone - ${child.name}`);
        let boneRenderer: BoneRenderer;
        if (this.mode === BoneRenderMode.line) {
            boneRenderer = new LineBoneRenderer(boneRenderRoot, this.material, this.lineMaterial);
        } else {
            boneRenderer = new OctahedralBoneRenderer(boneRenderRoot, this.material);
        }
        this.node.scene.addChild(boneRenderRoot);
        const renderInfo: BoneRenderInfo = {
            rendererNode: boneRenderRoot,
            dirty: true,
            renderer: boneRenderer,
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
        const { renderer } = renderInfo;
        const childPosition = child.getWorldPosition();
        const parentPosition = parent.worldPosition;
        renderer.update(childPosition, parentPosition);
    }
}

class BoneRenderer {
    constructor(renderRoot: Node) { }

    public destroy(): void {}

    public update(child: math.Vec3, parent: math.Vec3): void { }

    public setBoneColor(color: Color) {}

    public resetBoneColor() {}

    public setJointColor(color: Color) {}

    public resetJointColor() {}

    public clearColor() {}
}

class OctahedralBoneRenderer extends BoneRenderer {
    constructor(renderRoot: Node, material: Material) {
        super(renderRoot);
        const boneMesh = defaultBoneMesh;
        const meshRenderer = renderRoot.addComponent(MeshRenderer);
        meshRenderer.mesh = boneMesh;
        meshRenderer.material = material;
        const rigidBody = renderRoot.addComponent(RigidBody);
        rigidBody.type = physics.ERigidBodyType.STATIC;
        rigidBody.group = PHYSICS_MASK_BONE;
        const meshCollider = renderRoot.addComponent(MeshCollider);
        meshCollider.mesh = boneMesh;
        this._boneRenderNode = renderRoot;
    }

    public update(child: math.Vec3, parent: math.Vec3): void {
        const { _boneRenderNode: boneRenderNode } = this;
        const u = math.Vec3.UP;
        const v = math.Vec3.subtract(
            new math.Vec3(),
            child,
            parent,
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

        boneRenderNode.setWorldRotation(rotation);
        boneRenderNode.setWorldScale(boneLength, boneLength, boneLength);
        boneRenderNode.setWorldPosition(parent);
    }

    private _boneRenderNode: Node;
}

class LineBoneRenderer extends BoneRenderer {
    constructor(renderRoot: Node, material: Material, lineMaterial: Material) {
        super(renderRoot);

        const jointPositionIndicatorNode = new Node("Position Indicator");
        renderRoot.addChild(jointPositionIndicatorNode);
        const indicatorMeshRenderer = jointPositionIndicatorNode.addComponent(MeshRenderer);
        indicatorMeshRenderer.mesh = utils.createMesh(primitives.sphere(0.007));
        const indicatorMaterial = indicatorMeshRenderer.material = new renderer.MaterialInstance({
            parent: material,
        });

        const boneConnectionNode = new Node("Bone Connection");
        renderRoot.addChild(boneConnectionNode);
        const lineRenderer = new LineRenderer(boneConnectionNode,  lineMaterial);
        lineRenderer.setColor(LineBoneRenderer._defaultBoneColor);

        this._indicator = jointPositionIndicatorNode;
        this._materialIndicator = indicatorMaterial;
        this._connection = boneConnectionNode;
        this._connectionRenderer = lineRenderer;
    }

    public update(child: math.Vec3, parent: math.Vec3): void {
        this._indicator.setWorldPosition(child);
        this._connectionRenderer.setEndings(child, parent);
        this._connectionRenderer.commit();
    }

    public setBoneColor(color: Color) {
        this._connectionRenderer.setColor(color);
        this._connectionRenderer.commit();
    }

    public resetBoneColor() {
        this._connectionRenderer.setColor(LineBoneRenderer._defaultBoneColor);
        this._connectionRenderer.commit();
    }

    public setJointColor(color: math.Color): void {
        this._materialIndicator.setProperty('mainColor', color);
    }

    public resetJointColor(): void {
        this._materialIndicator.setProperty('mainColor', LineBoneRenderer._defaultJointColor);
    }

    public clearColor(): void {
        this._connectionRenderer.setColor(LineBoneRenderer._defaultBoneColor);
    }

    private static _defaultJointColor = Color.WHITE;
    private static _defaultBoneColor = Color.WHITE;

    private _materialIndicator: renderer.MaterialInstance;
    private _indicator: Node;
    private _connection: Node;
    private _connectionRenderer: LineRenderer;
}

interface BoneRenderInfo {
    rendererNode: Node;
    renderer: BoneRenderer;
    dirty: boolean;
}

