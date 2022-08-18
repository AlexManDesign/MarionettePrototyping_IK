import { _decorator, Component, Node, Vec3, Quat, animation, MeshRenderer, primitives, utils, Material, gfx, Color, clamp01 } from 'cc';
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

    @property
    public debug = true;

    @property({ visible: function(this: FootLook) { return this.debug; } })
    public debugShowLockingPosition = false;

    @property({ visible: function(this: FootLook) { return this.debug; } })
    public debugShowPositionBeforeLock = false;

    @property({ visible: function(this: FootLook) { return this.debug; } })
    public debugShowResultPosition = false;

    @property({ visible: function(this: FootLook) { return this.debug; } })
    public debugShowKneeTargetTranslation = false;

    @property({ visible: function(this: FootLook) { return this.debug; } })
    public debugShowCharacterPosition = false;

    /**
     * The knee's translation, in knee's bone space,
     * **added** to knee bone when foot participates (two bone)IK resolution.
     */
    @property
    public kneeTargetTranslation = new Vec3();

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
        if (this.debug) {
            if (this.debugShowLockingPosition) {
                const lockingPositionIndicator = createIndicator(Color.BLACK);
                this.node.scene.addChild(lockingPositionIndicator);
                this._lockingPositionIndicator = lockingPositionIndicator;
            }

            if (this.debugShowPositionBeforeLock) {
                const positionBeforeLockIndicator = createIndicator(Color.WHITE);
                this.node.scene.addChild(positionBeforeLockIndicator);
                this._positionBeforeLockIndicator = positionBeforeLockIndicator;
            }
    
            if (this.debugShowResultPosition) {
                const resultPositionIndicator = createIndicator(Color.RED);
                this.node.scene.addChild(resultPositionIndicator);
                this._resultPositionIndicator = resultPositionIndicator;
            }

            if (this.debugShowCharacterPosition) {
                const characterPositionIndicator = createIndicator(Color.GRAY);
                this.node.scene.addChild(characterPositionIndicator);
                this._characterPositionIndicator = characterPositionIndicator;   
            }

            if (this.debugShowKneeTargetTranslation) {
                const kneeTargetPosIndicator = createIndicator(Color.YELLOW);
                this.node.scene.addChild(kneeTargetPosIndicator);
                this._kneeTargetPosIndicator = kneeTargetPosIndicator;
            }
        }

        Vec3.copy(this._lastCharacterPos, this.node.getWorldPosition());
        Vec3.copy(this._lockingPosition, this.foot.worldPosition);
        Quat.copy(this._lockingRotation, this.foot.worldRotation);
    }

    update () {
        this._updateBeforeAnimation();
    }

    lateUpdate(deltaTime: number) {
        this._updatePostAnimation();
    }

    private _lastCharacterPos = new Vec3();
    private _lockingPosition = new Vec3();
    private _lockingRotation = new Quat();
    private _lastActualFootPos = new Vec3();
    private _forceLock = true;
    private _characterPositionIndicator: Node | null = null;
    private _kneeTargetPosIndicator: Node | null = null;
    private _lockingPositionIndicator: Node | null = null;
    private _positionBeforeLockIndicator: Node | null = null;
    private _resultPositionIndicator: Node | null = null;
    private _currentLockStrength = 1.0;

    private _updateBeforeAnimation() {
        // console.log('-------');
        this._lockingPositionIndicator?.setWorldPosition(this._lockingPosition);
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
        const lockingRotation = this._lockingRotation;

        const animationController = this.node.getComponent(animation.AnimationController)!;
        const lockStrengthUnclamped = animationController.getNamedCurveValue(this.lockCurveName);
        const lockStrength = clamp01(lockStrengthUnclamped);

        if (lockStrength < this._currentLockStrength || lockStrength >= 0.999) {
            this._currentLockStrength = lockStrength;
        }

        const currentLockStrength = this._currentLockStrength;
        if (currentLockStrength >= 0.999) {
            Vec3.copy(lockingPosition, this.foot.worldPosition);
            Quat.copy(lockingRotation, this.foot.worldRotation);
        }
    }

    private _updatePostAnimation() {
        const {
            foot,
            _lockingPosition: lockingPosition,
            _lockingRotation: lockingRotation,
            _currentLockStrength: currentLockStrength,
        } = this;

        this._positionBeforeLockIndicator?.setWorldPosition(foot.worldPosition);

        // First, find the place where the knee should be placed.
        // This corresponds to the "Modify Knee Targets" in ALS
        const knee = foot.parent!;
        const kneeTarget = Vec3.clone(knee.worldPosition);
        const kneedTargetTranslationWorld = Vec3.transformMat4(new Vec3(), this.kneeTargetTranslation, knee.getWorldRS());
        Vec3.add(kneeTarget, kneeTarget, kneedTargetTranslationWorld);
        this._kneeTargetPosIndicator?.setWorldPosition(kneeTarget);

        const q = Quat.slerp(new Quat(), foot.worldRotation, lockingRotation, currentLockStrength);
        foot.worldRotation = q;
        solveTwoBoneIKAlpha(
            foot,
            lockingPosition,
            currentLockStrength,
            kneeTarget,
        );

        this._resultPositionIndicator?.setWorldPosition(this.foot.worldPosition);
    }
}

function createIndicator(color = Color.WHITE) {
    const lastPosIndicator = new Node();
    const meshRenderer = lastPosIndicator.addComponent(MeshRenderer);
    const indicatorScale = 0.05;
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

function solveTwoBoneIKAlpha(endFactorNode: Node, target: Vec3, alpha: number, kneeTarget: Vec3) {
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
        kneeTarget,
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

