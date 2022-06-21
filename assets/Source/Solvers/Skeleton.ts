import * as cc from 'cc';
import { ConstraintType, JointConstraint } from '../Constraint';

@cc._decorator.ccclass('JointInfo')
export class Joint {
    constructor(node?: cc.Node) {
        if (node) {
            this.name = node.name;
            this.node = node;
        }
    }

    @cc._decorator.property({
        displayName: '骨骼名称',
    })
    name = '';

    @cc._decorator.property({
        visible: false,
    })
    children: Joint[] = [];

    get node() {
        return this._node;
    }

    set node(value) {
        this._node = value;
        cc.math.Quat.copy(this._initialLocalRotation, value.getRotation());
        cc.math.Vec3.copy(this._originalPose.position, value.getPosition());
        cc.math.Quat.copy(this._originalPose.rotation, value.getRotation());
        cc.math.Vec3.copy(this._originalPose.scale, value.getScale());
    }

    get parent() {
        return this._parent;
    }

    set parent(value) {
        if (this._parent) {
            this._parent.children.splice(
                this._parent.children.indexOf(this),
                1,
            );
        }
        this._parent = value;
        if (value) {
            value.children.push(this);
        }
    }

    @cc._decorator.property({
        type: JointConstraint,
        displayName: '约束',
    })
    constraint: JointConstraint = new JointConstraint();

    get initialLocalRotation(): Readonly<cc.math.Quat> {
        return this._initialLocalRotation;
    }

    set initialLocalRotation(value) {
        cc.math.Quat.copy(this._initialLocalRotation, value);
    }

    get inverseInitialLocalRotation() {
        return cc.math.Quat.invert(new cc.math.Quat(), this._initialLocalRotation);
    }

    get originalLocalRotation(): Readonly<cc.math.Quat> {
        return this._originalPose.rotation;
    }

    get position() {
        return this._node.worldPosition;
    }

    set position(value) {
        this._node.worldPosition = value;
    }

    get rotation() {
        return this._node.worldRotation;
    }

    set rotation(value) {
        this._node.worldRotation = value;
    }

    get localRotation() {
        return this._node.rotation;
    }

    set localRotation(value) {
        this._node.rotation = value;
    }

    get parentPosition() {
        return this._parent ? this._parent.position : this._node.worldPosition;
    }

    get parentRotation() {
        return this._parent ? this._parent.rotation : this._node.worldRotation;
    }

    get linkLength() {
        // TODO: cc.Vec3.len(this._node.position) ?
        return this._parent ? cc.Vec3.distance(this.position, this._parent.position) : 0.0;
    }

    @cc._decorator.property({
        visible: false,
    })
    public runtimeLocalPosition = new cc.math.Vec3();

    public runtimeLocalPositionEnabled = false;

    @cc._decorator.property({
        visible: false,
    })
    public runtimeRotation = new cc.math.Quat();

    @cc._decorator.property({
        visible: false,
    })
    public runtimeScale = new cc.math.Vec3();

    public reset() {
        const { node, _originalPose: original } = this;
        if (!node) {
            return;
        }
        node.setPosition(original.position);
        node.setRotation(original.rotation);
        node.setScale(original.scale);
    }

    public resetToLimitInitialPose() {
        const { node, _originalPose: original } = this;
        if (!node) {
            return;
        }
        // node.setPosition(original.position);
        // node.setRotation(this._initialLocalRotation);
        // node.setScale(original.scale);
        if (this.runtimeLocalPositionEnabled) {
            node.setPosition(this.runtimeLocalPosition.x, this.runtimeLocalPosition.y, this.runtimeLocalPosition.z);
        }
        node.setRotation(this.runtimeRotation);
        // node.setScale(this.runtimeScale);
    }

    public onAfterSerialized() {
        this.node = this._node;
        for (const child of this.children) {
            child._parent = this;
        }
    }

    private _parent: Joint | null = null;

    @cc._decorator.property
    private _initialLocalRotation = new cc.math.Quat();

    @cc._decorator.property({
        visible: false,
        type: cc.Node,
    })
    private _node: cc.Node = null!;

    private _originalPose: {
        position: cc.math.Vec3;
        rotation: cc.math.Quat;
        scale: cc.math.Vec3;
    } = {
        position: new cc.math.Vec3(),
        rotation: new cc.math.Quat(),
        scale: new cc.math.Vec3(),
    };
}

export function* visitJoint(root: Joint): Generator<Joint> {
    yield root;
    for (const child of root.children) {
        for (const c of visitJoint(child)) {
            yield c;
        }
    }
}
