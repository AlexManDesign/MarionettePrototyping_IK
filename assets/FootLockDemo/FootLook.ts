import { _decorator, Component, Node, Vec3, Quat, animation, MeshRenderer, primitives, utils, Material, gfx, Color } from 'cc';
import { Joint } from '../Source/Solvers/Skeleton';
import { solveTwoBoneIK, TwoBoneIK } from '../Source/Solvers/TwoBoneIK';
import { FootLockDemo } from './FootLockDemo';
const { ccclass, property, executionOrder } = _decorator;

@ccclass('FootLook')
@executionOrder(-99999)
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
        console.log(this._lockingPosition);

        Vec3.copy(this._lockingPosition, this._lastActualFootPos);
    }

    start() {
        const lastPosIndicator = createIndicator(Color.YELLOW);
        this.node.scene.addChild(lastPosIndicator);
        this._lastPosIndicator = lastPosIndicator;

        const actualFootIndicator = createIndicator(Color.RED);
        this.node.scene.addChild(actualFootIndicator);
        this._actualFootIndicator = actualFootIndicator;

        const lastCharacterPosIndicator = createIndicator(Color.GRAY);
        this.node.scene.addChild(lastCharacterPosIndicator);
        this._lastCharacterPosIndicator = lastCharacterPosIndicator;

        Vec3.copy(this._lastCharacterPos, this.node.getWorldPosition());
        Vec3.copy(this._lockingPosition, this.foot.worldPosition);
    }

    update () {
        this._updateBeforeAnimation();
    }

    lateUpdate(deltaTime: number) {
        this._updatePostAnimation();
    }

    private _lastCharacterPos = new Vec3();
    private _lockingPosition = new Vec3();
    private _lastActualFootPos = new Vec3();
    private _forceLock = true;
    private declare _lastCharacterPosIndicator: Node;
    private declare _lastPosIndicator: Node;
    private declare _actualFootIndicator: Node;
    private _currentLockStrength = 1.0;

    private _updateBeforeAnimation() {
        // console.log('-------');
        this._lastPosIndicator.setWorldPosition(this._lockingPosition);
        this._actualFootIndicator.setWorldPosition(this.foot.worldPosition);
        // console.log(`${this.foot.worldPosition}`);

        // const characterPosition = this.node.getWorldPosition();
        // const characterPositionDiff = Vec3.subtract(new Vec3(), characterPosition, this._lastCharacterPos);
        // Vec3.copy(this._lastCharacterPos, characterPosition);
        // this._lastCharacterPosIndicator.setWorldPosition(characterPosition);

        Vec3.copy(this._lastActualFootPos, this.foot.worldPosition);

        if (!this.lockCurveName) {
            return;
        }

        const lockingPosition = this._lockingPosition;

        const animationController = this.node.getComponent(animation.AnimationController)!;
        const lockStrength = animationController.getNamedCurveValue(this.lockCurveName);

        if (lockStrength < this._currentLockStrength || lockStrength >= 0.999) {
            this._currentLockStrength = lockStrength;
        }

        const currentLockStrength = this._currentLockStrength;
        if (currentLockStrength >= 0.999) {
            Vec3.copy(lockingPosition, this.foot.worldPosition);
        }
    }

    private _updatePostAnimation() {
        const {
            foot,
            _lockingPosition: lockingPosition,
            _currentLockStrength: currentLockStrength,
        } = this;
        solveTwoBoneIKAlpha(
            foot,
            lockingPosition,
            currentLockStrength,
        );
        const d = Vec3.distance(lockingPosition, foot.worldPosition);
        // console.debug(d);
    }
}

function createIndicator(color = Color.WHITE) {
    const lastPosIndicator = new Node();
    const meshRenderer = lastPosIndicator.addComponent(MeshRenderer);
    const indicatorScale = 0.1;
    meshRenderer.mesh = utils.MeshUtils.createMesh(primitives.box());
    const material = new Material();
    material.reset({
        effectName: 'builtin-standard',
        states: {
            rasterizerState: {
                cullMode: gfx.CullMode.NONE,
            },
        },
    });
    material.setProperty('albedo', color);
    meshRenderer.material = material;
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

function solveTwoBoneIKAlpha(endFactorNode: Node, target: Vec3, alpha: number) {
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

    solveTwoBoneIK(
        rootNodeCopy,
        middleNodeCopy,
        endFactorNodeCopy,
        target,
        {
            node: new Node(),
            debugLineMaterial: null,
            renderer: null,
        }
    );
    // const solver = new TwoBoneIK();
    // const g = solver.solveChain(
    //     endFactor,
    //     [middle, root],
    //     target,
    //     1e-2,
    //     {
    //         node: new Node(),
    //         debugLineMaterial: null,
    //         renderer: null,
    //     },
    // );
    // for (const _ of g) {
    // }

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

