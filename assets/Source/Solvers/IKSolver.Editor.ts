import { Component, find, js, MeshRenderer, Node, primitives, Quat, utils, Vec3, _decorator } from "cc";
import { EDITOR } from "cc/env";
import { IKSolverBase } from "./IKSolverBase";

declare namespace cce {
    namespace gizmos {
        const GizmoDefines: {
            components: Record<string, Gizmo>;
        };

        export class Gizmo {

        }
    }

    namespace Operation {
        function addListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
        function removeListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
    }

    namespace Scene {
        function on(type: 'mode-change', listener: (mode: string) => void): void;
    }

    namespace Node {
        function change(uuid: string, node: Node): void;
        function query(uuid: string): Node | null;
    }

    namespace Animation {
        const curEditRootNodeUuid: string;
    }
}

if (EDITOR) {
    (async () => {
        await waitUtilGizmoValid();

        cce.Scene.on('mode-change', (newMode: string) => {
            if (newMode === 'animation') {
                onAnimationEditingModeEntered();
            } else {
                onAnimationEditingModeExited();
            }
        });
    })();
}

async function waitUtilGizmoValid() {
    await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
            if (cce.gizmos) {
                clearInterval(timer);
                resolve();
            }
        }, 100);
    });
}

function onAnimationEditingModeEntered() {
    cce.Operation.addListener('keydown', onKeydown);
}

function onAnimationEditingModeExited() {
    cce.Operation.removeListener('keydown', onKeydown);
    ikPreviewerManager.destroy();
}

function onKeydown(event: KeyboardEvent) {
    switch (event.key) {
        case 'i':
        case 'I':
            ikPreviewerManager.setup();
            break;
        case 'u': case 'U':
            ikPreviewerManager.selectNextTarget();
            break;
    }
}

function isInAnimationEditingMode() {
    return Editor.EditMode.getMode() === 'animation';
}

@_decorator.ccclass('ResolveModifier')
@_decorator.executeInEditMode
class IKSolverInvoker extends Component {
    public __init(solver: IKSolverBase) {
        const nEndFactors = solver.getEndFactorCount();
        const targets = Array.from({ length: nEndFactors }, () => new Vec3());
        for (let iEndFactor = 0; iEndFactor < nEndFactors; ++iEndFactor) {
            Vec3.copy(targets[iEndFactor], solver.getEndFactorPosition(iEndFactor));
        }
        this._solver = solver;
        this._targets = targets;
    }

    get targetCount() {
        return this._targets.length;
    }

    public getTargetPosition(targetIndex: number): Readonly<Vec3> {
        return this._targets[targetIndex];
    }

    public setTargetPosition(targetIndex: number, position: Readonly<Vec3>) {
        Vec3.copy(this._targets[targetIndex], position)
    }

    public lateUpdate() {
        const { _solver: solver, _targets: targets } = this;
        solver.solve(targets);
    }

    private declare _solver: IKSolverBase;
    private declare _targets: Vec3[];
}

class IKPreviewer {
    constructor(rootNode: Node, ikSolvers: IKSolverBase[]) {
        const previewUtilityRootNode = new Node(`[[IK Preview]]`);
        rootNode.addChild(previewUtilityRootNode);
        const _invokers = ikSolvers.map((ikSolver) => {
            const ikSolverInvoker = previewUtilityRootNode.addComponent(IKSolverInvoker);
            ikSolverInvoker.__init(ikSolver);
            return ikSolverInvoker;
        });
        const targetNodes: Node[] = [];
        for (const invoker of _invokers) {
            const nInvokerTargets = invoker.targetCount;
            for (let iInvokerTarget = 0; iInvokerTarget < nInvokerTargets; ++iInvokerTarget) {
                const target = new Node(`End factor target ${iInvokerTarget}`);
                const scale = 0.1;
                target.scale = new Vec3(scale, scale, scale);
                previewUtilityRootNode.addChild(target);
                const meshRenderer = target.addComponent(MeshRenderer);
                meshRenderer.mesh = utils.MeshUtils.createMesh(primitives.box());
                target.setWorldPosition(invoker.getTargetPosition(iInvokerTarget));
                target.on(Node.EventType.TRANSFORM_CHANGED, () => {
                    invoker.setTargetPosition(iInvokerTarget, target.worldPosition);
                });
                targetNodes.push(target);
            }
        }
        this._targetNodes = targetNodes;
    }

    public selectTarget() {
        const { _targetNodes: targetNodes } = this;
        const nTargetNodes = targetNodes.length;
        if (nTargetNodes === 0) {
            return;
        }
        const selected = Editor.Selection.getSelected('node');
        const currentSelectedIndex = selected.length === 1
            ? targetNodes.findIndex((node) => node.uuid === selected[0])
            : -1;
        const nextSelectedIndex = (currentSelectedIndex + 1) % nTargetNodes;
        const targetNode = targetNodes[nextSelectedIndex];
        console.debug(`Selecting ${targetNode.name}.`);
        Editor.Selection.clear('node');
        Editor.Selection.select('node', targetNode.uuid);
    }

    private _invokers: IKSolverInvoker[] = [];
    private _targetNodes: Node[] = [];
}

class IKPreviewerManager {
    public setup() {
        if (this._previewer) {
            return;
        }

        const currentEditingNodeUUID = cce.Animation.curEditRootNodeUuid;
        if (!currentEditingNodeUUID) {
            console.error(`I'don't know why I can't obtain current editing node.`);
            return;
        }
    
        const rootNode = cce.Node.query(currentEditingNodeUUID);
        if (!rootNode) {
            console.error(`I'don't know why I can't obtain current editing node.`);
            return;
        }
    
        const ikSolvers = rootNode.getComponents(IKSolverBase)
            .filter((specifier) => specifier.enabled);
    
        this._previewer = new IKPreviewer(rootNode, ikSolvers);
    }

    public destroy() {
        this._previewer = null;
    }

    public selectNextTarget() {
        this._previewer?.selectTarget();
    }

    private _previewer: IKPreviewer | null = null;
}

const ikPreviewerManager = new IKPreviewerManager();