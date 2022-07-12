import { _decorator, Component, Node, Vec3, Quat, animation, MeshRenderer, primitives, utils } from 'cc';
import { Joint } from '../Source/Solvers/Skeleton';
import { TwoBoneIK } from '../Source/Solvers/TwoBoneIK';
const { ccclass, property } = _decorator;

@ccclass('FootLook')
export class FootLook extends Component {
    @property(Node)
    public foot!: Node;

    @property
    public lockCurveName = '';

    get forceLock() {
        return this._forceLock;
    }

    set forceLock(value) {
        this._forceLock = value;
    }

    public xlock() {
        console.log(this._lastFootPos);

        Vec3.copy(this._lastFootPos, this._lastActualFootPos);
    }

    start() {
        const lastPosIndicator = createIndicator();
        this.node.scene.addChild(lastPosIndicator);
        this._lastPosIndicator = lastPosIndicator;

        const actualFootIndicator = createIndicator();
        this.node.scene.addChild(actualFootIndicator);
        this._actualFootIndicator = actualFootIndicator;

        const lastCharacterPosIndicator = createIndicator();
        this.node.scene.addChild(lastCharacterPosIndicator);
        this._lastCharacterPosIndicator = lastCharacterPosIndicator;

        Vec3.copy(this._lastCharacterPos, this.node.getWorldPosition());
        Vec3.copy(this._lastFootPos, this.foot.worldPosition);
    }

    update () {
        this._lastPosIndicator.setWorldPosition(this._lastFootPos);
    }

    lateUpdate(deltaTime: number) {
        const characterPosition = this.node.getWorldPosition();
        const characterPositionDiff = Vec3.subtract(new Vec3(), characterPosition, this._lastCharacterPos);
        Vec3.copy(this._lastCharacterPos, characterPosition);
        this._lastCharacterPosIndicator.setWorldPosition(characterPosition);

        Vec3.copy(this._lastActualFootPos, this.foot.worldPosition);

        if (!this.lockCurveName) {
            return;
        }

        this._actualFootIndicator.setWorldPosition(this.foot.worldPosition);

        let lockStrength = 1.0;
        if (this._forceLock) {
            lockStrength = 1.0;
        } else {
            const animationController = this.node.getComponent(animation.AnimationController)!;
            lockStrength = animationController.getNamedCurveValue(this.lockCurveName);
        }

        if (lockStrength > this._lastLockStrength) {
            Vec3.copy(this._lastFootPos, this.foot.worldPosition);
        }
        this._lastLockStrength = lockStrength;

        if (lockStrength >= 0.999) {
            // Vec3.copy(this._lastFootPos, this.foot.worldPosition);
        }

        if (lockStrength > 0.0) {
            // const inputFootPosition = this._lastFootPos;
            // const targetFootPosition = Vec3.add(new Vec3(), inputFootPosition, characterPositionDiff);
            // Vec3.copy(this._lastFootPos, targetFootPosition);
        }

        solveTwoBoneIK(
            this.foot,
            this._lastFootPos,
            lockStrength,
        );
    }

    private _lastCharacterPos = new Vec3();
    private _lastFootPos = new Vec3();
    private _lastActualFootPos = new Vec3();
    private _forceLock = true;
    private declare _lastCharacterPosIndicator: Node;
    private declare _lastPosIndicator: Node;
    private declare _actualFootIndicator: Node;
    private _lastLockStrength = 0.0;
}

function createIndicator() {
    const lastPosIndicator = new Node();
    const meshRenderer = lastPosIndicator.addComponent(MeshRenderer);
    const indicatorScale = 0.1;
    meshRenderer.mesh = utils.MeshUtils.createMesh(primitives.box());
    lastPosIndicator.scale = new Vec3(indicatorScale, indicatorScale, indicatorScale);
    return lastPosIndicator;
}

function cloneNodeTransform(node: Node) {
    const nodeCopy = new Node(`${node.name}(Copy)`);
    nodeCopy.position = node.position;
    nodeCopy.rotation = node.rotation;
    nodeCopy.scale = node.scale;
    return nodeCopy;
}

function cloneNodeWorldTransform(node: Node) {
    const nodeCopy = new Node(`${node.name}(Copy)`);
    nodeCopy.position = node.worldPosition;
    nodeCopy.rotation = node.worldRotation;
    nodeCopy.scale = node.worldScale;
    return nodeCopy;
}

function solveTwoBoneIK(endFactorNode: Node, target: Vec3, alpha: number) {
    // TODO:
    target = Vec3.clone(target);

    const middleNode = endFactorNode.parent!;
    const rootNode = middleNode.parent!;
    const rootRootNode = rootNode.parent!;

    const rootRootNodeCopy = cloneNodeWorldTransform(rootRootNode);
    const rootNodeCopy = cloneNodeTransform(rootNode);
    rootNodeCopy.parent = rootRootNodeCopy;
    const middleNodeCopy = cloneNodeTransform(middleNode);
    middleNodeCopy.parent = rootNodeCopy;
    const endFactorNodeCopy = cloneNodeTransform(endFactorNode);
    endFactorNodeCopy.parent = middleNodeCopy;

    const endFactor = new Joint(endFactorNodeCopy);
    const middle = new Joint(middleNodeCopy);
    const root = new Joint(rootNodeCopy);
    endFactor.parent = middle;
    middle.parent = root;

    const solver = new TwoBoneIK();
    const g = solver.solveChain(
        endFactor,
        [middle, root],
        target,
        1e-2,
        {
            node: new Node(),
            debugLineMaterial: null,
            renderer: null,
        },
    );
    for (const _ of g) {
    }

    for (const [original, target] of [
        [endFactorNode, endFactorNodeCopy],
        [middleNode, middleNodeCopy],
        [rootNode, rootNodeCopy],
    ] as Array<[Node, Node]>) {
        original.position = Vec3.lerp(new Vec3(), original.position, target.position, alpha);
        original.scale = Vec3.lerp(new Vec3(), original.scale, target.scale, alpha);
        original.rotation = Quat.slerp(new Quat(), original.rotation, target.rotation, alpha);
    }
}

